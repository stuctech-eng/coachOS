-- v2.4.185: Coach Agenda Fase A (Master Foundation)
-- Bron: overleg 30 juli 2026. Puur additief — raakt GEEN bestaande
-- velden. recovery_impact/stress_load/sleep_disruption blijven
-- ongewijzigd de "operationele" velden voor de Recovery Engine.
-- Deze nieuwe velden zijn bedoeld voor de Context Resolver/Today
-- Engine/Master Coach, niet voor de Recovery Score-formule.

alter table life_events
  add column if not exists available_time_minutes integer,
  add column if not exists priority text
    check (priority is null or priority in ('laag', 'normaal', 'hoog')),
  add column if not exists coach_note text,
  add column if not exists location_type text,
  add column if not exists energy_expectation text,
  add column if not exists travel_distance_km numeric,
  -- Uitzonderingen op een terugkerende regel — bijv. "iedere maandag
  -- dagdienst, BEHALVE 17 augustus". Array met specifieke datums
  -- (yyyy-mm-dd) die de regel voor die ene dag overschrijven, zonder
  -- de regel zelf te hoeven aanpassen of stop te zetten.
  add column if not exists recurrence_exceptions date[];
