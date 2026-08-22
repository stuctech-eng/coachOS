-- ── Intervals.icu — sync-status ─────────────────────────────────────────
-- v2.4.341. Master plan §12 (Rate Limiting): "laatste sync bewaren...
-- geen agressieve polling." Minimale tabel, één rij per gebruiker.

create table if not exists intervals_icu_sync_state (
  user_id uuid primary key references auth.users(id),
  last_synced_at timestamptz not null default now()
);

alter table intervals_icu_sync_state enable row level security;
create policy "select_own" on intervals_icu_sync_state for select using (auth.uid() = user_id);
-- Geen insert/update-policy voor gebruikers — server-managed, zelfde
-- patroon als ri_response_links eerder vandaag.
