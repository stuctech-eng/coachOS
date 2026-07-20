-- ============================================================
-- Morning Health Repository + Performance Repository
-- Bron: overleg 20 juli 2026 (Health Analysis Engine + Vision Engine)
-- ============================================================
--
-- Vervangt het ontwerp van v2.4.136 (hrv_measurements) — die tabel kan
-- ongebruikt blijven staan als je v2.4.136 al had toegepast, geen
-- migratie nodig. Optioneel opruimen: drop table if exists hrv_measurements;
--
-- BEWUSTE KEUZE: geen baseline/trend/status-kolommen — dat zijn
-- afgeleide waarden, berekend door de Health Analysis Engine bij
-- opvragen, nooit opgeslagen. Voorkomt migraties als de trend-regel
-- ooit verandert (bijv. 7 naar 14 dagen).
--
-- BEWUSTE KEUZE: hrv_ms (ochtendwaarde, meestal handmatig) en
-- hrv_7d_avg_ms (Garmin's eigen voortschrijdend gemiddelde, uit de
-- screenshot) zijn APARTE kolommen — het zijn twee verschillende
-- concepten, niet hetzelfde getal via twee invoerwegen.

create table if not exists morning_health_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,

  hrv_ms numeric,
  hrv_7d_avg_ms numeric,
  hrv_status text,
  resting_hr numeric,
  body_battery_current numeric,
  body_battery_charged numeric,
  body_battery_spent numeric,
  sleep_score numeric,
  sleep_duration_minutes numeric,
  stress numeric,
  respiration_current_brpm numeric,
  respiration_avg_awake_brpm numeric,
  respiration_avg_sleep_brpm numeric,

  source_type text not null default 'manual',
  import_method text not null default 'manual',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, date)
);

create index if not exists idx_morning_health_metrics_user_date
  on morning_health_metrics(user_id, date desc);

comment on table morning_health_metrics is
  'Ruwe ochtend-gezondheidsdata, één rij per dag. Trend/baseline/status worden NIET hier opgeslagen — zie health-analysis-engine.ts. source_type: garmin_connect/apple_health/manual/whoop/polar/fitbit/coros/suunto/future_api. import_method: vision/api/manual/sync.';

alter table morning_health_metrics enable row level security;

drop policy if exists "Gebruiker kan eigen morning health metrics lezen" on morning_health_metrics;
create policy "Gebruiker kan eigen morning health metrics lezen"
  on morning_health_metrics for select using (auth.uid() = user_id);

-- ============================================================

create table if not exists performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,

  training_readiness numeric,
  training_readiness_label text,
  acute_load numeric,
  chronic_load numeric,
  load_ratio numeric,
  training_status_label text,
  load_focus_low numeric,
  load_focus_moderate numeric,
  load_focus_high numeric,
  vo2max numeric,
  vo2max_label text,
  endurance_score numeric,
  endurance_score_label text,
  hill_score numeric,
  recovery_time_hours numeric,
  race_predictor jsonb,

  source_type text not null default 'manual',
  import_method text not null default 'manual',

  created_at timestamptz not null default now(),
  unique(user_id, date)
);

create index if not exists idx_performance_snapshots_user_date
  on performance_snapshots(user_id, date desc);

comment on table performance_snapshots is
  'Ruwe Garmin Performance-widgets, één rij per dag. hill_score/recovery_time_hours/race_predictor zijn NULL-baar en bewust alvast aanwezig voor toekomstige screenshots die deze widgets wél tonen — voorkomt een latere tabelwijziging.';

alter table performance_snapshots enable row level security;

drop policy if exists "Gebruiker kan eigen performance snapshots lezen" on performance_snapshots;
create policy "Gebruiker kan eigen performance snapshots lezen"
  on performance_snapshots for select using (auth.uid() = user_id);
