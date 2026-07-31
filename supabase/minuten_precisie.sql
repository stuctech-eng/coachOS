-- v2.4.196: Minuten-precisie voor tijden
-- Bron: overleg 30 juli 2026. Puur additief — bestaande start_hour/
-- end_hour blijven ongewijzigd (default 0 minuten, geen migratie van
-- bestaande rijen nodig, alles blijft backwards compatible).

alter table life_events
  add column if not exists start_minute integer not null default 0
    check (start_minute >= 0 and start_minute <= 59),
  add column if not exists end_minute integer not null default 0
    check (end_minute >= 0 and end_minute <= 59);
