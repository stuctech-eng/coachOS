-- CoachOS Connect-contract (28 augustus 2026): 'coachos_connect'
-- toevoegen als toegestane bron in activity_sessions.source.
--
-- ⚠️ VERPLICHT vóór uitvoeren: eerst de daadwerkelijke huidige set
-- bevestigen, NIET aannemen. Deze migratie overschrijft de VOLLEDIGE
-- toegestane set, niet alleen een toevoeging:
--
-- select conname, pg_get_constraintdef(oid) from pg_constraint
-- where conname = 'activity_sessions_source_check';
--
-- Zelfde patroon als fix_source_check_concept2.sql en
-- activity_sessions_source_check_trainer_ai.sql: de check-constraint
-- staat los van de code-level SOURCE_PRIORITEIT-tabel
-- (source-priority-policy.ts) en moet er expliciet mee in sync
-- gehouden worden — zie de waarschuwing daar.
--
-- LET OP, gevonden tijdens deze contract-review: 'intervals_icu' komt
-- voor in zowel SOURCE_PRIORITEIT als in een daadwerkelijke insert
-- (src/app/api/debug/intervals-icu-import/route.ts, .from('activity_sessions').insert(...)),
-- maar er is GEEN los migratiebestand voor gevonden in supabase/ —
-- waarschijnlijk rechtstreeks in het dashboard toegevoegd. Onderstaande
-- ARRAY bevat 'intervals_icu' daarom uit voorzorg, gebaseerd op dat
-- bewijs — maar dit is een afgeleide aanname, GEEN bevestigde
-- databasestatus. De SELECT hierboven is de enige manier om dit
-- zeker te weten vóór uitvoeren.

alter table activity_sessions drop constraint activity_sessions_source_check;

alter table activity_sessions add constraint activity_sessions_source_check
  check (source = ANY (ARRAY[
    'manual'::text,
    'garmin'::text,
    'apple_health'::text,
    'strava'::text,
    'concept2'::text,
    'trainer_ai'::text,
    'intervals_icu'::text,
    'coachos_connect'::text
  ]));
