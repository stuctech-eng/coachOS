-- ============================================================
-- CoachOS Specialist Coach Platform — Memory Engine, sub-stap 1/5
-- Bron: docs/specialist-memory.md ("Database-implicatie")
-- Status bij aanmaken: Lifecycle Engine (v2.4.70) gebouwd, dit is de
-- eerste stap van de Memory Engine — nog geen Learning/Confidence-logica,
-- puur de opslagstructuur.
-- ============================================================

-- ── specialist_memory ────────────────────────────────────────
-- Knowledge Base — GEEN chatgeheugen, GEEN logboek. Duurzame,
-- over-tijd-gevalideerde inzichten (bijv. "reageert goed op
-- pyramideschema's"), niet losse feiten uit één moment (die horen al
-- thuis in activity_sessions/training_results).
--
-- Bewust GESCHEIDEN van specialist_profiles (gebruiker-ingestelde
-- configuratie) en specialist_analyses (periodieke, vervangbare
-- snapshots) — dit is cumulatieve, systeem-geleerde kennis met een
-- eigen levenscyclus. Zie specialist-memory.md §"Database-implicatie"
-- voor de volledige onderbouwing.

create table if not exists specialist_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  specialist_type text not null,

  -- Hard: objectief bewezen (FTP, max hartslag, PR's) — confidence in
  -- principe altijd hoog/vast. Soft: waarschijnlijkheden, ontstaan via
  -- de volledige Learning/Confidence-pijplijn.
  knowledge_type text not null check (knowledge_type in ('hard', 'soft')),

  insight text not null,
  category text,

  -- 0-100, kern van de Confidence Engine (nog te bouwen, sub-stap 4)
  confidence integer not null default 0 check (confidence >= 0 and confidence <= 100),

  -- candidate: voorgesteld door Coach Layer, nog niet bevestigd
  -- active: door Learning Engine gepromoveerd, wordt door AI gebruikt
  -- deprecated: confidence onder ondergrens gezakt, niet meer geldig
  status text not null default 'candidate' check (status in ('candidate', 'active', 'deprecated')),

  confirmation_count integer not null default 1,
  first_observed_at timestamptz not null default now(),
  last_confirmed_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_specialist_memory_user_specialist
  on specialist_memory(user_id, specialist_type);

create index if not exists idx_specialist_memory_active
  on specialist_memory(user_id, specialist_type, status)
  where status = 'active';

comment on table specialist_memory is
  'Knowledge Base voor de specialistlaag — duurzame, gevalideerde inzichten. Geen chatgeheugen, geen logboek. Zie docs/specialist-memory.md.';
comment on column specialist_memory.confidence is
  'Kern van de Confidence Engine (sub-stap 4). Stijgt bij herbevestiging, daalt geleidelijk bij tegenspraak. Onder een ondergrens: status automatisch naar deprecated.';
comment on column specialist_memory.confirmation_count is
  'Kern van de Learning Engine (sub-stap 2). Drempel bepaalt promotie van candidate naar active.';

-- updated_at automatisch bijwerken, zelfde patroon als specialist_profiles
create or replace function specialist_memory_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_specialist_memory_updated_at on specialist_memory;
create trigger trg_specialist_memory_updated_at
  before update on specialist_memory
  for each row
  execute function specialist_memory_set_updated_at();

-- ── Row Level Security ──────────────────────────────────────
-- Zelfde patroon en zelfde kanttekening als specialist_layer.sql
-- (v2.4.59): routes gebruiken vrijwel overal createAdminClient()
-- (service-role, omzeilt RLS toch al) — dit is vooral een vangnet.

alter table specialist_memory enable row level security;

drop policy if exists "Gebruiker kan eigen specialist_memory lezen" on specialist_memory;
create policy "Gebruiker kan eigen specialist_memory lezen"
  on specialist_memory
  for select
  using (auth.uid() = user_id);

-- Geen insert/update/delete-policy voor gewone gebruikers — deze tabel
-- wordt uitsluitend server-side gevuld/bijgewerkt (Learning + Confidence
-- Engine, via createAdminClient), consistent met specialist_analyses.
