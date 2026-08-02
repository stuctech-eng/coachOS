-- v2.4.238: Universal Athlete Platform — opslag
-- Bron: overleg 2 augustus 2026. Eén rij per gebruiker, de volledige
-- UniversalAthleteState als JSONB — geen aparte kolom per veld (30+
-- velden, zou een zeer brede tabel geven voor iets dat nog experimenteel
-- is). Kan later genormaliseerd worden als dat nodig blijkt.

create table if not exists universal_athlete_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table universal_athlete_state enable row level security;

create policy "Gebruikers zien alleen hun eigen Athlete State"
  on universal_athlete_state for all
  using (auth.uid() = user_id);
