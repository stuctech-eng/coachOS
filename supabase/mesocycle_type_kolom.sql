-- v2.4.176: Periodiserings-context (Coach Agenda Fase 2, vervolg)
-- Bron: overleg 22 juli 2026. bepaalMesocycli() berekent dit al bij het
-- genereren van elk trainingsplan, maar het type (basis/opbouw/piek/
-- herstel) werd nergens opgeslagen — alleen gebruikt om het sessietype
-- te kiezen, daarna weggegooid. Nullable, volledig backwards compatible
-- — bestaande rijen blijven gewoon werken zonder dit veld.

alter table training_plan_sessions
  add column if not exists mesocycle_type text
  check (mesocycle_type is null or mesocycle_type in ('basis', 'opbouw', 'piek', 'herstel'));
