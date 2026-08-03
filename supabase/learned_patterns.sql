-- v2.4.253: Learning Rules Engine — opslag van gevuurde regels
-- Bron: overleg 3 augustus 2026. Eén rij per gebruiker+sport+regel die
-- ooit gevuurd heeft — voorkomt dat dezelfde ontdekking telkens opnieuw
-- "nieuw" lijkt.

create table if not exists learned_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sport text not null,
  rule_id text not null,
  rule_naam text not null,
  beschrijving text not null,
  effect_pad text not null,
  aanpassing_percentage numeric not null,
  ontdekt_op timestamptz not null default now(),
  unique(user_id, sport, rule_id)
);

alter table learned_patterns enable row level security;

create policy "Gebruikers zien alleen hun eigen geleerde patronen"
  on learned_patterns for all
  using (auth.uid() = user_id);
