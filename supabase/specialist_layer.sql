-- ============================================================
-- CoachOS Specialist Coach Platform — database-migratie
-- Bron: docs/specialist-coaches.md + docs/specialist-database-design.md
-- Status bij aanmaken: architectuur + database-ontwerp goedgekeurd,
-- dit is de eerste code/SQL van dat traject.
--
-- Bevat UITSLUITEND de twee tabellen die in het goedgekeurde ontwerp
-- zijn besloten. Geen extra kolommen op bestaande tabellen (die
-- blijven allemaal ongewijzigd — activity_sessions, training_results,
-- exercise_records, coach_calls, progress_analyses, user_goals).
-- ============================================================

-- ── 1. specialist_profiles ──────────────────────────────────
-- Identity/activatie-laag: welke specialist is actief voor welke
-- gebruiker, sinds wanneer, met welke voorkeuren. GEEN goals-veld —
-- doelen leven in de bestaande user_goals-tabel (zie §3.2 van
-- specialist-database-design.md), via een eigen goal_type-waarde.
-- Traag-veranderende configuratie, vandaar losstaand van de
-- snel-veranderende analyse-tabel hieronder.

create table if not exists specialist_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  specialist_type text not null,
  active boolean not null default false,
  activated_at timestamptz,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Eén rij per specialist per gebruiker — voorkomt duplicaten als de
  -- gebruiker bijvoorbeeld twee keer op "activeer Cycling Coach" tikt
  constraint specialist_profiles_user_specialist_unique
    unique (user_id, specialist_type)
);

create index if not exists idx_specialist_profiles_user_id
  on specialist_profiles(user_id);

create index if not exists idx_specialist_profiles_user_active
  on specialist_profiles(user_id, active)
  where active = true;

comment on table specialist_profiles is
  'Identity/activatie-laag voor de specialistlaag — welke specialist is actief per gebruiker. Zie docs/specialist-coaches.md §5.';
comment on column specialist_profiles.specialist_type is
  'Bijv. cycling, running, rowing, strength — vaste config-waarden, zie Specialist Registry in docs/specialist-coaches.md §5. Geen foreign-key-constraint hierop, want de lijst van geldige types leeft in code, niet in de database.';
comment on column specialist_profiles.preferences is
  'Specialist-specifieke voorkeuren (JSONB, vrije vorm per specialist).';

-- updated_at automatisch bijwerken bij elke wijziging
create or replace function specialist_profiles_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_specialist_profiles_updated_at on specialist_profiles;
create trigger trg_specialist_profiles_updated_at
  before update on specialist_profiles
  for each row
  execute function specialist_profiles_set_updated_at();

-- ── 2. specialist_analyses ──────────────────────────────────
-- Analyse-laag: berekende, periodieke specialist-analyses (bijv.
-- Cycling FTP-trend over 30 dagen). Bewust LOSSTAAND van de bestaande
-- progress_analyses-tabel — die bleek bij onderzoek een vaste,
-- getypeerde JSONB-vorm te hebben (ProgressAnalysis-interface) en
-- ongefilterde GET/cache-logica, wat het onveilig maakte om
-- specialist-data daar zomaar tussen te voegen. Zie §4.5 van
-- specialist-database-design.md voor de volledige onderbouwing.

create table if not exists specialist_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  specialist_type text not null,
  period_days integer not null,
  analysis jsonb not null,
  generated_at timestamptz not null default now()
);

create index if not exists idx_specialist_analyses_user_type
  on specialist_analyses(user_id, specialist_type, generated_at desc);

comment on table specialist_analyses is
  'Analyse-laag voor de specialistlaag — periodieke, berekende specialist-analyses. Bewust gescheiden van progress_analyses, zie docs/specialist-database-design.md §4.5.';
comment on column specialist_analyses.analysis is
  'Vrije JSONB-vorm, specifiek per specialist_type — geen gedeeld schema met progress_analyses.analysis.';

-- ── Row Level Security ──────────────────────────────────────
-- Standaard Supabase-patroon: gebruiker kan alleen zijn eigen rijen
-- lezen/schrijven. NB: routes in dit project gebruiken tot nu toe
-- vrijwel overal createAdminClient() (service-role, omzeilt RLS) — deze
-- policies zijn dus vooral een vangnet voor het geval een route ooit
-- de gewone (niet-admin) Supabase-client gebruikt, consistent met
-- gangbare Supabase-praktijk. Pas aan indien dit project een ander
-- RLS-patroon hanteert dan hieronder aangenomen.

alter table specialist_profiles enable row level security;
alter table specialist_analyses enable row level security;

drop policy if exists "Gebruiker kan eigen specialist_profiles beheren" on specialist_profiles;
create policy "Gebruiker kan eigen specialist_profiles beheren"
  on specialist_profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Gebruiker kan eigen specialist_analyses lezen" on specialist_analyses;
create policy "Gebruiker kan eigen specialist_analyses lezen"
  on specialist_analyses
  for select
  using (auth.uid() = user_id);

-- Geen insert/update/delete-policy voor gewone gebruikers op
-- specialist_analyses — deze tabel wordt uitsluitend server-side
-- gevuld (via createAdminClient, service-role), consistent met hoe
-- progress_analyses ook alleen server-side geschreven wordt.
