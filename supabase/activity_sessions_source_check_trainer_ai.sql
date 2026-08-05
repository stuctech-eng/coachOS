-- Fix v2.4.280: activity_sessions_source_check stond 'trainer_ai' niet toe
-- (Activity Bridge, v2.4.278/279). Eerst uit te voeren, aanbevolen, ter
-- bevestiging van de huidige set (geen SELECT-resultaat nodig om door te gaan):
--
-- select conname, pg_get_constraintdef(oid) from pg_constraint
-- where conname = 'activity_sessions_source_check';

alter table activity_sessions drop constraint activity_sessions_source_check;
alter table activity_sessions add constraint activity_sessions_source_check
  check (source = ANY (ARRAY['manual'::text, 'garmin'::text, 'apple_health'::text, 'strava'::text, 'concept2'::text, 'trainer_ai'::text]));
