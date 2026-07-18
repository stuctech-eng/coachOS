-- ============================================================
-- Adaptive Training Plan Engine — Fase 1 (Engine zonder AI)
-- Bron: docs/adaptive-training-plan-decision-contract-v1.md
-- ============================================================

create table if not exists training_plans (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users(id) on delete cascade,
  -- Verwijzing naar het leidende Goal Engine-doel, NIET gedupliceerd —
  -- consistent met specialist-database-design.md's principe
  goal_id uuid references user_goals(id) on delete set null,
  start_date date not null,
  end_date date not null,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  -- welke laag dit plan initieel aanmaakte
  created_by text not null default 'generator' check (created_by in ('generator', 'specialist')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists training_plan_sessions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references training_plans(id) on delete cascade,
  date date not null,
  -- voor toekomstige multi-sport-plannen, nu altijd 'cycling'
  sport text not null default 'cycling',
  type text not null, -- bijv. duurtraining, interval, herstel, tempo
  duration integer not null, -- minuten
  intensity jsonb, -- bijv. { "van_watt": 150, "tot_watt": 175 }
  load_target numeric,
  status text not null default 'planned'
    check (status in ('planned', 'scheduled', 'completed', 'skipped', 'adjusted', 'cancelled')),
  -- alleen gevuld bij status='adjusted' — verwijst naar de vervangen sessie,
  -- historische waarheid gaat NOOIT verloren
  original_session_id uuid references training_plan_sessions(id) on delete set null,
  -- VERPLICHT zodra status='adjusted' — zie check-constraint hieronder
  adjustment_reason text
    check (adjustment_reason is null or adjustment_reason in (
      'missed_session', 'fatigue_detected', 'injury_protection', 'vacation_mode', 'goal_change'
    )),
  completed_activity_id uuid references activity_sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Afdwingen: adjustment_reason is verplicht zodra status='adjusted'
  -- (Decision Contract v1.0, sectie 2: "geen enkele wijziging wordt
  -- opgeslagen zonder reason code")
  constraint adjustment_reason_verplicht_bij_adjusted check (
    status != 'adjusted' or adjustment_reason is not null
  )
);

create index if not exists idx_training_plans_athlete
  on training_plans(athlete_id, status);

create index if not exists idx_training_plan_sessions_plan_date
  on training_plan_sessions(plan_id, date);

comment on table training_plans is
  'Adaptive Training Plan Engine — één rij per macrocyclus. Zie docs/adaptive-training-plan-decision-contract-v1.md.';
comment on table training_plan_sessions is
  'Eén rij per geplande training. status=adjusted overschrijft NOOIT de oorspronkelijke sessie — original_session_id behoudt de historie.';

-- RLS — zelfde patroon als eerdere specialistlaag-tabellen
alter table training_plans enable row level security;
alter table training_plan_sessions enable row level security;

drop policy if exists "Gebruiker kan eigen training_plans lezen" on training_plans;
create policy "Gebruiker kan eigen training_plans lezen"
  on training_plans for select using (auth.uid() = athlete_id);

drop policy if exists "Gebruiker kan eigen training_plan_sessions lezen" on training_plan_sessions;
create policy "Gebruiker kan eigen training_plan_sessions lezen"
  on training_plan_sessions for select using (
    exists (select 1 from training_plans p where p.id = plan_id and p.athlete_id = auth.uid())
  );
-- Geen insert/update/delete-policy voor gewone gebruikers — deze tabellen
-- worden uitsluitend server-side gevuld door de Plan Generator/Daily
-- Adjustment Layer (via createAdminClient), consistent met specialist_analyses.
