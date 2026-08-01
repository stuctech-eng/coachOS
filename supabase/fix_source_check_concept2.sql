-- v2.4.221: fix voor activity_sessions_source_check — 'concept2'
-- ontbrak, waardoor alle 56 gevonden Concept2-sessies niet konden
-- worden opgeslagen. Bevestigde huidige waarden (via pg_get_constraintdef):
-- 'manual', 'garmin', 'apple_health', 'strava' — allemaal behouden,
-- alleen 'concept2' toegevoegd.

alter table activity_sessions drop constraint activity_sessions_source_check;

alter table activity_sessions add constraint activity_sessions_source_check
  check (source = ANY (ARRAY['manual'::text, 'garmin'::text, 'apple_health'::text, 'strava'::text, 'concept2'::text]));
