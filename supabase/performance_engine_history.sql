-- ============================================================
-- Performance Engine History
-- Bron: overleg 21 juli 2026 (Performance Intelligence Platform, Fase 1B)
-- ============================================================

create table if not exists performance_engine_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  engine text not null,
  score numeric not null,
  payload jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, date, engine)
);

create index if not exists idx_performance_engine_history_user_engine_date
  on performance_engine_history(user_id, engine, date desc);

comment on table performance_engine_history is
  'Dagelijkse snapshot per engine-score (Recovery/Load/Fatigue/Readiness/Consistency/...), voor trendweergave. Eén rij per (user_id, date, engine).';

alter table performance_engine_history enable row level security;

drop policy if exists "Gebruiker kan eigen performance engine history lezen" on performance_engine_history;
create policy "Gebruiker kan eigen performance engine history lezen"
  on performance_engine_history for select using (auth.uid() = user_id);
