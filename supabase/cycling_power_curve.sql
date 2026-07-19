-- ============================================================
-- Vermogenscurve-datalaag — Cycling Specialist Roadmap v1.0, Fase 3
-- Bron: docs/vermogenscurve-datalaag-spec.md
-- ============================================================

create table if not exists cycling_power_curve (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activity_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  duration_sec integer not null,
  watts integer not null,
  created_at timestamptz not null default now(),
  unique(activity_id, duration_sec)
);

create index if not exists idx_cycling_power_curve_user_duration
  on cycling_power_curve(user_id, duration_sec, watts desc);

comment on table cycling_power_curve is
  'Beste vermogen per duur, per activiteit. Smal (activity x duur -> watt), geen ruwe tijdreeks. "All-time beste 5 minuten" = max(watts) where duration_sec=300 for user. Zie docs/vermogenscurve-datalaag-spec.md.';

alter table cycling_power_curve enable row level security;

drop policy if exists "Gebruiker kan eigen vermogenscurve lezen" on cycling_power_curve;
create policy "Gebruiker kan eigen vermogenscurve lezen"
  on cycling_power_curve for select using (auth.uid() = user_id);
-- Geen insert/update/delete-policy voor gewone gebruikers — wordt
-- uitsluitend server-side gevuld, zelfde patroon als de rest van de
-- specialistlaag.
