-- Workout Matching Service, Fase 1 — v2.4.267
-- Bron: docs/workout-completion-platform-adr-v1.md
-- completed_activity_id bestaat al sinds v2.4.96 (training_plan_engine.sql)
-- en wordt hiermee voor het eerst daadwerkelijk gevuld. Deze twee kolommen
-- zijn nieuw, puur voor uitlegbaarheid (geen schijnprecisie — je kunt
-- straks altijd zien WAAROM iets automatisch gekoppeld is).

alter table training_plan_sessions
  add column if not exists match_confidence numeric,
  add column if not exists match_reden text;
