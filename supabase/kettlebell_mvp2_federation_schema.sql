-- ============================================================
-- CoachOS Kettlebell Specialist — MVP2 schema-fundament
-- (Federatie → Rulebook → Discipline → Classificatie/Judging/
--  Competition/Records)
--
-- BELANGRIJK: dit is UITSLUITEND schema. Geen enkele rij met een
-- classificatienorm, judging-regel, bell weight-toewijzing of record is
-- hier ingevoegd — dat zou een wedstrijdnorm verzinnen zijn. Elke tabel
-- hieronder is leeg en blijft leeg totdat het officiële WKSF Rules
-- English 2023-2027-document is aangeleverd (prioriteit 1, daarna IUKL
-- als aparte, niet-samengevoegde regelset, daarna GSU/overige).
--
-- Bouwt voort op supabase/kettlebell_specialist_foundation.sql
-- (kettlebell_federations, kettlebell_gs_sessions — al live, v2.4.349).
--
-- Vaste regel, letterlijk overgenomen uit de instructie van de
-- gebruiker: federation_id is VERPLICHT (NOT NULL) op alle
-- wedstrijdlogica-tabellen hieronder — nooit een losse tekstkolom, altijd
-- een foreign key. WKSF/IUKL/GSU-records/classificaties worden nooit in
-- één ongedifferentieerde set samengevoegd: elke query filtert of groepeert
-- altijd op federation_id.
--
-- Promotion Engine heeft bewust GEEN eigen tabel: promotie is een
-- berekening (huidige PR vs. kettlebell_classifications.required_reps
-- van de volgende klasse), geen opgeslagen norm op zich.
-- ============================================================

-- ── 1. kettlebell_rulebooks ──────────────────────────────────
-- Eén reglementversie van één federatie. status='pending_source' totdat
-- de daadwerkelijke brontekst is verwerkt.

create table if not exists kettlebell_rulebooks (
  id uuid primary key default gen_random_uuid(),
  federation_id uuid not null references kettlebell_federations(id),
  version text not null,
  name text not null,
  source_document text,
  published_at date,
  effective_from date,
  effective_until date,
  status text not null default 'pending_source'
    check (status in ('pending_source', 'active', 'superseded')),
  created_at timestamptz not null default now(),
  unique (federation_id, version)
);

comment on table kettlebell_rulebooks is
  'Eén reglementversie per federatie. status=pending_source zolang er geen officiële brontekst verwerkt is — dan bevatten onderliggende tabellen (disciplines/classificaties/judging) nog geen rijen.';

-- Registratie van het WKSF-rulebook als PLACEHOLDER — alleen de naam/
-- periode die de gebruiker zelf al publiek geverifieerd heeft ("WKSF
-- Rules English 2023-2027"), GEEN regelinhoud. status blijft
-- pending_source totdat het document daadwerkelijk verwerkt is.
insert into kettlebell_rulebooks (federation_id, version, name, status)
select id, '2023-2027', 'WKSF Rules English 2023-2027', 'pending_source'
from kettlebell_federations where slug = 'wksf'
on conflict (federation_id, version) do nothing;

-- ── 2. kettlebell_rulebook_disciplines ───────────────────────
-- Welke disciplines een rulebook officieel ondersteunt. Geen CHECK-
-- constraint op discipline-namen (i.t.t. kettlebell_gs_sessions) omdat
-- spec §4 expliciet aanvullende, federatiespecifieke disciplines
-- toestaat ("eventueel aanvullende disciplines wanneer een gekozen
-- federatie deze officieel ondersteunt").

create table if not exists kettlebell_rulebook_disciplines (
  id uuid primary key default gen_random_uuid(),
  rulebook_id uuid not null references kettlebell_rulebooks(id) on delete cascade,
  discipline text not null,
  competition_duration_sec integer,
  source_reference text,
  notes text,
  created_at timestamptz not null default now(),
  unique (rulebook_id, discipline)
);

comment on table kettlebell_rulebook_disciplines is
  'Leeg totdat het officiële rulebook verwerkt is — geen wedstrijdduur/discipline hier vooraf ingevuld.';

-- ── 3. kettlebell_categories ──────────────────────────────────
-- Leeftijds-/niveaucategorieën (bijv. Elite/Amateur/Master/Young/
-- Children/Junior) per rulebook. Bewust GEEN rijen geseed, ook al heeft
-- de gebruiker deze namen zelf al genoemd — de exacte definities
-- (leeftijdsgrenzen e.d.) staan pas vast zodra de brontekst er is.

create table if not exists kettlebell_categories (
  id uuid primary key default gen_random_uuid(),
  rulebook_id uuid not null references kettlebell_rulebooks(id) on delete cascade,
  name text not null,
  min_age integer,
  max_age integer,
  source_reference text,
  created_at timestamptz not null default now(),
  unique (rulebook_id, name)
);

-- ── 4. kettlebell_classifications ────────────────────────────
-- De kern van de Classification Engine. Elke rij = één norm
-- (discipline + categorie + bell weight → vereiste reps voor een klasse).
-- Leeg totdat de brontekst verwerkt is.

create table if not exists kettlebell_classifications (
  id uuid primary key default gen_random_uuid(),
  rulebook_id uuid not null references kettlebell_rulebooks(id) on delete cascade,
  discipline text not null,
  category_id uuid references kettlebell_categories(id),
  sex text check (sex in ('male', 'female', 'open')),
  bodyweight_class text,
  bell_weight_kg numeric,
  class_name text not null,
  required_reps integer,
  required_duration_sec integer,
  source_reference text,
  created_at timestamptz not null default now()
);

create index if not exists idx_kettlebell_classifications_lookup
  on kettlebell_classifications(rulebook_id, discipline, bell_weight_kg);

comment on table kettlebell_classifications is
  'Officiële classificatienormen. LEEG totdat een officiële brontekst is verwerkt — nooit handmatig een reps-eis invullen zonder bron.';

-- ── 5. kettlebell_judging_rules ──────────────────────────────
-- No-counts, fixation, equipment/kledingregels e.d. — puur tekstuele
-- regelbeschrijving met brontekstverwijzing, geen automatisch te
-- evalueren logica in MVP2.

create table if not exists kettlebell_judging_rules (
  id uuid primary key default gen_random_uuid(),
  rulebook_id uuid not null references kettlebell_rulebooks(id) on delete cascade,
  discipline text,
  rule_type text not null
    check (rule_type in ('no_count', 'fixation', 'technique', 'equipment', 'clothing', 'weigh_in', 'assistance', 'other')),
  description text not null,
  source_reference text,
  created_at timestamptz not null default now()
);

-- ── 6. kettlebell_competitions ───────────────────────────────
-- Officiële wedstrijden (referentiedata, niet per se gebruikersgebonden).
-- federation_id VERPLICHT — wedstrijdlogica-regel van de gebruiker.

create table if not exists kettlebell_competitions (
  id uuid primary key default gen_random_uuid(),
  federation_id uuid not null references kettlebell_federations(id),
  rulebook_id uuid references kettlebell_rulebooks(id),
  name text not null,
  event_date date,
  location text,
  created_at timestamptz not null default now()
);

-- ── 7. kettlebell_competition_entries ────────────────────────
-- Iemands persoonlijke deelname/voorbereiding voor een wedstrijd
-- (spec §24-25, Competition Preparation/Calendar). federation_id hier
-- ook verplicht, ook al is dat af te leiden via competition_id — expliciet
-- gevraagd door de gebruiker om nooit impliciet te laten via een join.

create table if not exists kettlebell_competition_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  competition_id uuid not null references kettlebell_competitions(id),
  federation_id uuid not null references kettlebell_federations(id),
  discipline text not null,
  target_class text,
  target_reps integer,
  result_reps integer,
  result_class text,
  status text not null default 'planned'
    check (status in ('planned', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists idx_kettlebell_competition_entries_user
  on kettlebell_competition_entries(user_id, status);

-- ── 8. kettlebell_records ────────────────────────────────────
-- Federatie-/nationale/wereldrecords. federation_id VERPLICHT — records
-- van verschillende federaties worden nooit in één ranking samengevoegd
-- (expliciete eis van de gebruiker), dus elke query groepeert of filtert
-- altijd op federation_id.

create table if not exists kettlebell_records (
  id uuid primary key default gen_random_uuid(),
  federation_id uuid not null references kettlebell_federations(id),
  rulebook_id uuid references kettlebell_rulebooks(id),
  record_scope text not null check (record_scope in ('federation', 'national', 'world')),
  discipline text not null,
  category text,
  bell_weight_kg numeric,
  result_reps integer,
  result_duration_sec integer,
  athlete_name text,
  record_date date,
  source text,
  created_at timestamptz not null default now()
);

create index if not exists idx_kettlebell_records_lookup
  on kettlebell_records(federation_id, discipline, record_scope);

-- ── Row Level Security ───────────────────────────────────────
-- Referentiedata (rulebooks/disciplines/categorieën/classificaties/
-- judging/competitions/records): leesbaar voor ingelogde gebruikers,
-- geen client-side schrijftoegang (alleen via createAdminClient/
-- migraties) — zelfde patroon als kettlebell_federations.
-- kettlebell_competition_entries: gebruikersgebonden, zelfde patroon als
-- kettlebell_gs_sessions.

alter table kettlebell_rulebooks enable row level security;
alter table kettlebell_rulebook_disciplines enable row level security;
alter table kettlebell_categories enable row level security;
alter table kettlebell_classifications enable row level security;
alter table kettlebell_judging_rules enable row level security;
alter table kettlebell_competitions enable row level security;
alter table kettlebell_records enable row level security;
alter table kettlebell_competition_entries enable row level security;

drop policy if exists "Ingelogde gebruikers kunnen kettlebell_rulebooks lezen" on kettlebell_rulebooks;
create policy "Ingelogde gebruikers kunnen kettlebell_rulebooks lezen"
  on kettlebell_rulebooks for select using (auth.role() = 'authenticated');

drop policy if exists "Ingelogde gebruikers kunnen kettlebell_rulebook_disciplines lezen" on kettlebell_rulebook_disciplines;
create policy "Ingelogde gebruikers kunnen kettlebell_rulebook_disciplines lezen"
  on kettlebell_rulebook_disciplines for select using (auth.role() = 'authenticated');

drop policy if exists "Ingelogde gebruikers kunnen kettlebell_categories lezen" on kettlebell_categories;
create policy "Ingelogde gebruikers kunnen kettlebell_categories lezen"
  on kettlebell_categories for select using (auth.role() = 'authenticated');

drop policy if exists "Ingelogde gebruikers kunnen kettlebell_classifications lezen" on kettlebell_classifications;
create policy "Ingelogde gebruikers kunnen kettlebell_classifications lezen"
  on kettlebell_classifications for select using (auth.role() = 'authenticated');

drop policy if exists "Ingelogde gebruikers kunnen kettlebell_judging_rules lezen" on kettlebell_judging_rules;
create policy "Ingelogde gebruikers kunnen kettlebell_judging_rules lezen"
  on kettlebell_judging_rules for select using (auth.role() = 'authenticated');

drop policy if exists "Ingelogde gebruikers kunnen kettlebell_competitions lezen" on kettlebell_competitions;
create policy "Ingelogde gebruikers kunnen kettlebell_competitions lezen"
  on kettlebell_competitions for select using (auth.role() = 'authenticated');

drop policy if exists "Ingelogde gebruikers kunnen kettlebell_records lezen" on kettlebell_records;
create policy "Ingelogde gebruikers kunnen kettlebell_records lezen"
  on kettlebell_records for select using (auth.role() = 'authenticated');

drop policy if exists "Gebruiker kan eigen kettlebell_competition_entries beheren" on kettlebell_competition_entries;
create policy "Gebruiker kan eigen kettlebell_competition_entries beheren"
  on kettlebell_competition_entries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
