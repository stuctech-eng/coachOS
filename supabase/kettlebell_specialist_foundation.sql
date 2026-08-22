-- ============================================================
-- CoachOS Kettlebell Specialist — Fase 0 + MVP1 database-migratie
-- Bron: Kettlebell Specialist Master Plan (gebruiker) +
-- kettlebell-specialist-architectuurvoorstel-v1.md (22 augustus 2026).
--
-- Scope van dit bestand: UITSLUITEND wat MVP1 nodig heeft (sessies
-- loggen, dashboard, PR-tracking), plus een federatie-onafhankelijk
-- fundament voor MVP2 (Federatie Engine) — expliciet gevraagd door de
-- gebruiker: "ontwerp MVP2 vanaf het begin federatie-onafhankelijk",
-- "federation_id verplicht in alle wedstrijdlogica".
--
-- GEEN classificatienormen, wedstrijdregels of records hierin — die
-- horen bij MVP2 en vereisen een officiële, aangeleverde bron (WKSF
-- Rules English 2023-2027 als prioriteit 1, daarna IUKL, daarna GSU/
-- overige). Deze migratie verzint dus bewust geen enkele norm.
--
-- Reuse-bevestiging: kettlebell_gs_sessions is een NIEUWE tabel omdat
-- de bestaande exercise_records/training_results (module='kettlebell')
-- de generieke krachttraining-kettlebellbibliotheek bedienen
-- (src/lib/kettlebell-exercises.ts) — dat is een ander domein dan
-- Girevoy Sport (timed sets, RPM, discipline, wedstrijdcontext). Geen
-- dubbele opslag van dezelfde data, wel een bewust apart domein, exact
-- zoals de gebruiker in de Master Plan-opdracht §1 vraagt.
-- ============================================================

-- ── 1. kettlebell_federations ───────────────────────────────
-- Minimaal skeleton — alléén naam/slug, GEEN reglementinhoud. Regels/
-- classificaties/versies volgen in een aparte MVP2-migratie zodra een
-- officiële bron is aangeleverd. Bestaat nu al zodat federation_id
-- vanaf Fase 0 een echte foreign key kan zijn i.p.v. een losse tekst-
-- kolom die later omgezet moet worden.

create table if not exists kettlebell_federations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

comment on table kettlebell_federations is
  'Skeleton-registratie van Girevoy Sport-federaties (naam/slug). Bevat GEEN reglementinhoud — die volgt in MVP2 als aparte, versiebeheerde tabel(len) per aangeleverde officiële bron.';

insert into kettlebell_federations (slug, name) values
  ('wksf', 'World Kettlebell Sport Federation'),
  ('iukl', 'International Union of Kettlebell Lifting'),
  ('gsu',  'Girevoy Sport Union')
on conflict (slug) do nothing;

-- ── 2. kettlebell_gs_sessions ───────────────────────────────
-- MVP1: handmatige registratie van Girevoy Sport-sets (Jerk/Snatch/
-- Long Cycle/Biathlon) — apart van de generieke exercise_records-flow.
-- federation_id NULLABLE hier bewust: een trainingssessie hoeft niet
-- per se aan één federatie gebonden te zijn (bijv. vrije oefensessie).
-- Wordt in MVP2 wél verplicht (NOT NULL) op kettlebell_competitions en
-- kettlebell_classifications, zoals de gebruiker expliciet vroeg.

create table if not exists kettlebell_gs_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  discipline text not null check (discipline in ('jerk', 'snatch', 'long_cycle', 'biathlon')),
  bell_weight_kg numeric not null check (bell_weight_kg > 0),
  duration_sec integer not null check (duration_sec > 0),
  reps integer not null check (reps >= 0),

  rpm_avg numeric,
  hr_avg integer,
  hr_max integer,
  rpe numeric check (rpe is null or (rpe >= 1 and rpe <= 10)),
  technique_score integer check (technique_score is null or (technique_score between 1 and 5)),
  no_counts integer not null default 0 check (no_counts >= 0),

  -- Federatie-onafhankelijk fundament (MVP2-voorbereiding): welke
  -- regelset context de sportbeoefenaar hanteerde bij deze sessie,
  -- indien van toepassing. Geen classificatie/norm — puur context.
  federation_id uuid references kettlebell_federations(id),

  notes text,
  performed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_kettlebell_gs_sessions_user_date
  on kettlebell_gs_sessions(user_id, performed_at desc);

create index if not exists idx_kettlebell_gs_sessions_user_discipline
  on kettlebell_gs_sessions(user_id, discipline, bell_weight_kg);

comment on table kettlebell_gs_sessions is
  'MVP1 — handmatige Girevoy Sport-sessieregistratie (Jerk/Snatch/Long Cycle/Biathlon). Los van exercise_records (generieke kettlebell-krachttraining). Zie docs/kettlebell-specialist-architectuurvoorstel-v1.md.';
comment on column kettlebell_gs_sessions.federation_id is
  'Optioneel in MVP1 (vrije training). Wordt verplicht (NOT NULL) op toekomstige kettlebell_competitions/kettlebell_classifications-tabellen in MVP2 — federatie-onafhankelijk ontwerp vanaf Fase 0.';

-- ── Row Level Security ──────────────────────────────────────
-- Zelfde patroon als supabase/specialist_layer.sql: vangnet voor het
-- geval een route ooit de niet-admin Supabase-client gebruikt.

alter table kettlebell_gs_sessions enable row level security;

drop policy if exists "Gebruiker kan eigen kettlebell_gs_sessions beheren" on kettlebell_gs_sessions;
create policy "Gebruiker kan eigen kettlebell_gs_sessions beheren"
  on kettlebell_gs_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- kettlebell_federations is platformbrede, niet-gebruikersgebonden
-- referentiedata — leesbaar voor iedere ingelogde gebruiker, geen
-- schrijftoegang vanuit de client (alleen via createAdminClient/
-- migraties, zelfde patroon als andere referentietabellen).
alter table kettlebell_federations enable row level security;

drop policy if exists "Ingelogde gebruikers kunnen kettlebell_federations lezen" on kettlebell_federations;
create policy "Ingelogde gebruikers kunnen kettlebell_federations lezen"
  on kettlebell_federations
  for select
  using (auth.role() = 'authenticated');
