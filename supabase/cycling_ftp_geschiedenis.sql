-- ============================================================
-- Cycling Specialist Roadmap v1.0 — FTP-geschiedenis
-- Bron: vervolgoverleg op Fase 2i (Progress Center). Bewust NU
-- toegevoegd, niet pas wanneer de trend-weergave zelf gebouwd wordt —
-- elke dag later is historische data die nooit meer wordt ingehaald.
-- ============================================================

create table if not exists cycling_ftp_geschiedenis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ftp integer not null,
  datum date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists idx_cycling_ftp_geschiedenis_user
  on cycling_ftp_geschiedenis(user_id, datum);

comment on table cycling_ftp_geschiedenis is
  'FTP-geschiedenis, één rij per keer dat FTP is opgeslagen via het Cycling Profile. Verzameld vanaf v2.4.108, ook al is de trend-weergave zelf nog beperkt bij weinig datapunten.';

alter table cycling_ftp_geschiedenis enable row level security;

drop policy if exists "Gebruiker kan eigen FTP-geschiedenis lezen" on cycling_ftp_geschiedenis;
create policy "Gebruiker kan eigen FTP-geschiedenis lezen"
  on cycling_ftp_geschiedenis for select using (auth.uid() = user_id);
-- Geen insert/update/delete-policy voor gewone gebruikers — wordt
-- uitsluitend server-side gevuld (via createAdminClient), zelfde
-- patroon als de rest van de specialistlaag.
