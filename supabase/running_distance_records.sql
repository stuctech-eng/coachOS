-- ============================================================
-- Running Distance Records — Running Specialist Roadmap v1.0, Fase 1
-- Bron: docs/running-specialist-roadmap-v1.md
-- ============================================================

create table if not exists running_distance_records (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activity_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  distance_m integer not null,
  tijd_sec integer not null,
  created_at timestamptz not null default now(),
  unique(activity_id, distance_m)
);

create index if not exists idx_running_distance_records_user_distance
  on running_distance_records(user_id, distance_m, tijd_sec asc);

comment on table running_distance_records is
  'Snelste tijd per doelafstand, per activiteit. Smal (activity x afstand -> tijd), geen ruwe tijdreeks. "All-time snelste 5km" = min(tijd_sec) where distance_m=5000 for user. Zie docs/running-specialist-roadmap-v1.md.';

alter table running_distance_records enable row level security;

drop policy if exists "Gebruiker kan eigen records lezen" on running_distance_records;
create policy "Gebruiker kan eigen records lezen"
  on running_distance_records for select using (auth.uid() = user_id);
-- Geen insert/update/delete-policy voor gewone gebruikers — wordt
-- uitsluitend server-side gevuld, zelfde patroon als cycling_power_curve.
