-- v2.4.218: Concept2 OAuth-koppeling — tokenopslag
-- Bron: overleg 1 augustus 2026, Rowing Platform Fase 1.
-- access_token/refresh_token nooit in code of logs tonen.

create table if not exists concept2_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  concept2_user_id integer,
  scope text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table concept2_tokens enable row level security;

create policy "Gebruikers zien alleen hun eigen Concept2-token"
  on concept2_tokens for all
  using (auth.uid() = user_id);
