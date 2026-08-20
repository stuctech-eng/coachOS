-- ══════════════════════════════════════════════════════════════
-- CoachOS — Recovery Intelligence — Database-migratie
-- Fase 8.1 (migration hardening) + Fase 8.2 (SQL hardening) samengevoegd
-- Vastgesteld: 16 augustus 2026, gebruiker + GPT-overleg
--
-- SCOPE VAN DEZE MIGRATIE: uitsluitend tabellen/views/RLS.
-- GEEN applicatiecode, GEEN pattern-detection.ts, GEEN Coach-
-- routewijzigingen, GEEN historische backfill — die volgen pas na
-- een apart akkoord, ná controle van dit schema (Fase 9).
--
-- enabled=false staat standaard aan: functioneel bestaat Recovery
-- Intelligence na deze migratie nog niet voor de gebruiker.
-- ══════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════
-- 1. CONFIGURATIE — versioned, atomaire overgang bij wijziging
-- ══════════════════════════════════════════════════════════════
create table if not exists ri_algorithm_config_versions (
  version text primary key,
  config jsonb not null,
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_ri_config_one_active
  on ri_algorithm_config_versions (active) where active = true;

insert into ri_algorithm_config_versions (version, config, active) values (
  'ri-v1.0',
  jsonb_build_object(
    'enabled', false,
    'deviation_threshold_sd', 1.0,
    'min_comparable_instances', 3,
    'min_baseline_days', 10,
    'baseline_window_days', 30,
    'no_recent_confirmation_months', 6
  ),
  true
) on conflict (version) do nothing;

-- IMPLEMENTATIEREGEL (Fase 8.2, punt 1) — een nieuwe configuratie-
-- versie activeren gebeurt ALTIJD atomair, nooit als twee losse
-- statements:
--
--   begin;
--     update ri_algorithm_config_versions set active = false where active = true;
--     update ri_algorithm_config_versions set active = true where version = '<nieuwe_versie>';
--   commit;
--
-- Geen RLS — server-side-only configuratie, nooit client-toegankelijk.


-- ══════════════════════════════════════════════════════════════
-- 2. AUDIT TRAIL — wanneer is welke gebruiker geanalyseerd
-- ══════════════════════════════════════════════════════════════
create table if not exists ri_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  algorithm_version text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null check (status in ('running', 'completed', 'failed')),
  error text,
  data_through_date date
);

create index if not exists idx_ri_analysis_runs_user_status
  on ri_analysis_runs (user_id, status, completed_at desc);

alter table ri_analysis_runs enable row level security;
create policy "select_own" on ri_analysis_runs for select using (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════
-- 3. DAG-RESPONS — kalenderdag-venster, V1
-- ══════════════════════════════════════════════════════════════
create table if not exists ri_calendar_day_response (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  load_event_date date not null,
  offset_days integer not null check (offset_days in (0, 1, 2, 3)),
  temporal_confidence text not null check (
    temporal_confidence in ('unknown_order', 'likely_before', 'likely_after', 'confirmed_after')
  ),
  classification text not null check (
    classification in ('stable', 'mild_decline', 'strong_decline', 'improvement')
  ),
  computed_at timestamptz not null default now(),
  algorithm_version text not null
);

create index if not exists idx_ri_cdr_user_date
  on ri_calendar_day_response (user_id, load_event_date);

alter table ri_calendar_day_response enable row level security;
create policy "select_own" on ri_calendar_day_response for select using (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════
-- 4. RESPONS-KOPPELINGEN — server-managed, polymorf (geen echte FK)
-- ══════════════════════════════════════════════════════════════
-- SERVER-MANAGED: uitsluitend geschreven door de service-role
-- (admin-client). Gewone gebruikers krijgen alleen SELECT — bewust
-- geen insert/update/delete-policy voor gebruikers.
create table if not exists ri_response_links (
  id uuid primary key default gen_random_uuid(),
  calendar_day_response_id uuid not null references ri_calendar_day_response(id) on delete cascade,
  source_table text not null check (source_table in ('daily_checkins', 'health_metrics', 'coach_call_items')),
  source_id uuid not null,
  signal_type text not null check (
    signal_type in ('energy', 'feeling', 'mood', 'sleep_duration', 'hrv', 'resting_hr', 'functioning')
  )
  -- Geen FK op (source_table, source_id) — polymorf. Applicatielaag
  -- verifieert vóór insert dat de bronrij bestaat.
);

create index if not exists idx_ri_response_links_cdr
  on ri_response_links (calendar_day_response_id);

alter table ri_response_links enable row level security;
create policy "select_via_parent" on ri_response_links for select using (
  exists (
    select 1 from ri_calendar_day_response cdr
    where cdr.id = calendar_day_response_id and cdr.user_id = auth.uid()
  )
);


-- ══════════════════════════════════════════════════════════════
-- 5. PATRONEN + evidence-junction-tabel
-- ══════════════════════════════════════════════════════════════
create table if not exists ri_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  pattern_type text not null check (
    pattern_type in ('delayed_decline', 'boom_bust', 'stable_tolerance', 'improving_capacity')
  ),
  description text not null,
  occurrence_count integer not null default 0,
  confidence_tier text not null check (
    confidence_tier in ('observatie', 'mogelijk_verband', 'patroon', 'sterk_patroon')
  ),
  first_observed date not null,
  last_observed date not null,
  last_confirmed_at timestamptz not null default now(),
  algorithm_version text not null,
  status text not null default 'active' check (status in ('active', 'superseded')),
  influences_decision boolean not null default false
);

create index if not exists idx_ri_patterns_user_active
  on ri_patterns (user_id, status, confidence_tier);

alter table ri_patterns enable row level security;
create policy "select_own" on ri_patterns for select using (auth.uid() = user_id);

create table if not exists ri_pattern_evidence (
  id uuid primary key default gen_random_uuid(),
  pattern_id uuid not null references ri_patterns(id) on delete cascade,
  calendar_day_response_id uuid not null references ri_calendar_day_response(id) on delete cascade
);

create index if not exists idx_ri_pattern_evidence_pattern
  on ri_pattern_evidence (pattern_id);

alter table ri_pattern_evidence enable row level security;

-- Fase 8.2, punt 2 — GECORRIGEERDE policy: beide kanten (pattern EN
-- calendar_day_response) moeten bij dezelfde gebruiker horen. De
-- eerdere versie checkte alleen de pattern-kant.
create policy "select_via_parent" on ri_pattern_evidence for select using (
  exists (
    select 1 from ri_patterns p
    join ri_calendar_day_response cdr on cdr.id = calendar_day_response_id
    where p.id = pattern_id
      and p.user_id = auth.uid()
      and cdr.user_id = auth.uid()
  )
);
-- APPLICATIELAAG-INVARIANT, verplicht: elke plek die een rij in deze
-- tabel aanmaakt, moet vóór het schrijven verifiëren dat
-- pattern.user_id == calendar_day_response.user_id — nooit een
-- impliciete aanname.


-- ══════════════════════════════════════════════════════════════
-- 6. HYPOTHESES — intern kwantitatief, extern (Coach) kwalitatief
-- ══════════════════════════════════════════════════════════════
create table if not exists ri_hypotheses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  pattern_id uuid references ri_patterns(id),
  statement text not null,
  confidence integer not null check (confidence between 0 and 100),
  confidence_history jsonb not null default '[]',
  status text not null default 'active' check (
    status in ('active', 'strengthened', 'weakened', 'rejected')
  ),
  created_at timestamptz not null default now(),
  last_evaluated_at timestamptz not null default now()
);

create index if not exists idx_ri_hypotheses_user
  on ri_hypotheses (user_id, status);

alter table ri_hypotheses enable row level security;
create policy "select_own" on ri_hypotheses for select using (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════
-- 7. BASELINES — SD/steekproefgrootte, fysiek uniek per metric
-- ══════════════════════════════════════════════════════════════
create table if not exists ri_baselines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  metric text not null check (
    metric in ('energy', 'hrv', 'resting_hr', 'sleep_duration', 'feeling')
  ),
  baseline_value numeric not null,
  baseline_stddev numeric not null,
  sample_count integer not null,
  baseline_range jsonb not null,
  algorithm_version text not null,
  computed_at timestamptz not null default now(),
  valid_from date not null,
  valid_until date,
  superseded_by uuid references ri_baselines(id)
);

-- Fase 8.2, punt 3 — ECHT UNIEK, geen gewone index. Fysiek onmogelijk
-- dat twee actieve baselines voor dezelfde (user_id, metric) bestaan.
create unique index if not exists idx_ri_baselines_one_current
  on ri_baselines (user_id, metric)
  where valid_until is null;

alter table ri_baselines enable row level security;
create policy "select_own" on ri_baselines for select using (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════
-- 8. INTERVENTIES — expliciete typologie
-- ══════════════════════════════════════════════════════════════
create table if not exists ri_interventions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  date date not null,
  intervention_type text not null check (
    intervention_type in ('training', 'walk', 'rest', 'pacing_adjustment', 'sleep_intervention', 'other')
  ),
  description text not null,
  load_event_date date,
  tolerance_outcome text not null check (
    tolerance_outcome in ('well_tolerated', 'partially_tolerated', 'poorly_tolerated')
  ),
  response_ref_id uuid references ri_calendar_day_response(id)
);

create index if not exists idx_ri_interventions_user_date
  on ri_interventions (user_id, date);

alter table ri_interventions enable row level security;
create policy "select_own" on ri_interventions for select using (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════
-- 9. VIEWS — security_invoker=true (voorkomt RLS-omzeiling)
-- ══════════════════════════════════════════════════════════════
create or replace view ri_load_proxy_view
with (security_invoker = true) as
select
  user_id,
  date,
  sum(minutes) as load_total_min
from (
  select user_id, date::date as date, coalesce(actual_duration, 0) as minutes
  from training_results
  where completed = true
  union all
  select user_id, date, coalesce(duration, 0) as minutes
  from activity_sessions
  where source != 'trainer_ai'   -- Activity Bridge-schaduw uitgesloten, voorkomt dubbeltelling
) combined
group by user_id, date;

create or replace view ri_response_observations_view
with (security_invoker = true) as
select id, user_id, date, 'energy' as signal_type, energy_score as value_numeric, null::text as value_categorical, 'daily_checkins' as source_table
from daily_checkins where energy_score is not null
union all
select id, user_id, date, 'feeling', feeling_score, null, 'daily_checkins'
from daily_checkins where feeling_score is not null
union all
select id, user_id, date, 'hrv', hrv, null, 'health_metrics'
from health_metrics where hrv is not null
union all
select id, user_id, date, 'resting_hr', resting_hr, null, 'health_metrics'
from health_metrics where resting_hr is not null
union all
select id, user_id, date, 'sleep_duration', sleep_duration, null, 'health_metrics'
from health_metrics where sleep_duration is not null;
-- mood uit coach_call_items bewust nog niet opgenomen — vergt eerst
-- verificatie van de exacte user_id/date-toegang op die tabel.

-- ══════════════════════════════════════════════════════════════
-- EINDE MIGRATIE. Na uitvoering: schema/RLS controleren (Fase 9),
-- daarna pas historische analyse — nog GEEN applicatiecode, GEEN
-- Coach-integratie geactiveerd (enabled=false, kill switch aan).
-- ══════════════════════════════════════════════════════════════
