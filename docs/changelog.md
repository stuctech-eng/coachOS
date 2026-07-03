# CoachOS — Changelog

## v2.4.6 — Coach Call: OR-drempel Strava + altijd triggeren bij bibliotheek
- `src/app/api/coach-calls/route.ts` — Strava-kwalificatie gewijzigd van
  AND naar OR: een activiteit kwalificeert nu als afstand ÓF duur voldoet,
  niet beide tegelijk. `MIN_DURATION_MIN` verlaagd van 45 naar 30 minuten.
  Afstandsdrempels ongewijzigd (Hardlopen 5km, Fietsen 20km, Roeien 5km).
  Reden: in herstelfases is afstand soms niet haalbaar maar duur wel een
  reëel belastingssignaal — dat moet de coach kunnen zien.
- `src/app/api/training/complete/route.ts` — Coach Call wordt nu ALTIJD
  aangemaakt bij `training_source: 'library'` (Archief + Trainingsbibliotheek),
  ongeacht welk coach-advies die dag gold. Voorheen alleen bij advies
  'herstel' of 'rust' — dat miste gevallen zonder advies of met advies
  'trainen'. De evaluatie zelf zat al in de sessie (EvaluatieLayer); dit
  triggert nu consistent de melding aan de coach dat er buiten zijn advies
  om getraind is, voor de herstelinschatting van de volgende dag.
- `src/app/settings/hoe-werkt-het/page.tsx` — sectie "Coach Call" herschreven:
  legt nu het onderscheid uit tussen Strava (OR-drempel, enige bron van
  evaluatiedata) en Archief/Trainingsbibliotheek (altijd triggeren, evaluatie
  zit al in de sessie zelf). Trainer AI-sectie kreeg een verwijzing naar
  dezelfde Coach Call-trigger voor Trainingsbibliotheek.
  Noot: deze pagina toont onderaan "CoachOS v1.8.6" — een apart, niet met
  de hoofdversie gesynchroniseerd versienummer. Niet gewijzigd, want de
  juiste waarde is niet vastgesteld (geen aanname gemaakt).

## v2.4.5 — Illustratie-koppeling 12 kettlebell-oefeningen + workflow-herziening
- `src/lib/kettlebell-exercises.ts` — `illustratie`-veld toegevoegd aan 12
  entries: kb-sumo-deadlift, kb-single-arm-deadlift, kb-romanian-deadlift,
  kb-staggered-deadlift, kb-russian-swing, kb-american-swing,
  kb-one-arm-swing, kb-hand-to-hand-swing, kb-double-swing,
  kb-alternating-swing, kb-front-squat, kb-double-front-squat.
  Bestanden waren al als PNG geüpload naar `public/exercises/` in Working
  Copy; deze wijziging koppelt ze aan de bibliotheek-entries.
  Totaal nu 18/102 kettlebell-oefeningen met live illustratie.
- Workflow-besluit: Dropbox als centraal archief overwogen en weer
  afgeschaft — GitHub zelf is al voldoende archief/backup. WebP als
  standaardformaat blijft staan, maar alleen vanaf illustratie #16 (Box
  Squat) — de 18 hierboven blijven PNG (geen herwerk van reeds voltooide
  illustraties). Zie README sectie "Illustratie Workflow" voor details.

## v2.4.4 — Fix: "Genereer advies" hangt bij trage/onbereikbare Open-Meteo
- Nieuw: `src/lib/fetch-with-timeout.ts` — gedeelde helper die `fetch` wrapt
  met een `AbortController`-timeout. Voorkomt dat een trage externe API een
  serverless function laat vastlopen tot de platform-timeout (die als
  onafgevangen 500 naar buiten komt — een `.catch()` in de eigen code helpt
  dan niet, want de hele function wordt door het platform afgebroken).
- `src/app/api/weather/route.ts` — beide externe fetches (`ipapi.co` en
  `api.open-meteo.com`) krijgen nu een timeout (3s / 4s).
- `src/app/api/coach/route.ts` — de interne fetch naar `/api/weather` binnen
  de `Promise.all` krijgt een timeout (3s) i.p.v. onbeperkt wachten.
  Root cause: Vercel logs toonden `ConnectTimeoutError` naar
  `api.open-meteo.com:443` (10s). Doordat deze fetch zonder timeout in een
  `Promise.all` met 16 andere calls zat, liep de hele `/api/coach` POST vast
  tot de Vercel function-timeout — zichtbaar als "spint, maar geeft niets"
  op de "Genereer advies"-knop, en als POST 500 / GET 500 in de logs.
  `useCoach.ts` toonde deze fout niet aan de gebruiker (silent catch) — dat
  blijft een bekend aandachtspunt, zie README sectie Troubleshooting.

## v2.4.3 — Fix: Strava Coach Call niet zichtbaar na voltooide call
- `src/app/api/coach-calls/route.ts` — POST heropent een bestaande `coach_call`
  (status `completed` of `expired`) wanneer er nieuwe kwalificerende Strava-
  activiteiten voor diezelfde datum bijkomen. Voorheen werden nieuwe
  `coach_call_items` wel toegevoegd aan de bestaande call, maar bleef de
  `coach_calls.status` op `completed`/`expired` staan — waardoor de GET-route
  (die filtert op `status in (pending, partial)`) de call nooit meer teruggaf
  en de banner op de home-pagina niet verscheen.
  Root cause: als een gebruiker die dag al één Coach Call had afgerond en
  daarna een nieuwe kwalificerende activiteit synchroniseerde (bv. een
  Strava-fietsrit), werd die activiteit stil toegevoegd aan een call die al
  als voltooid gemarkeerd stond.
  Fix: bij het toevoegen van nieuwe items aan een bestaande call wordt nu ook
  gecontroleerd of die call `completed`/`expired` is — zo ja, dan wordt de
  status teruggezet naar `pending` en `completed_at` naar `null`.
  Geen wijziging aan drempelwaarden, database-schema of overige flows.

## v2.4.2 — Timer + Countdown Fix Archief
- `src/app/archief/oefening/[id]/page.tsx` — 5 seconden countdown toegevoegd
  vóór elke set (cirkel-voortgang, skip-knop). Reps omgezet naar tijdseenheid
  (3 sec/rep) zodat altijd een aftellende timer zichtbaar is, ook bij
  rep-gebaseerde oefeningen zoals Kettlebell Swing.
  Consistent met sessie-engine, mobility en relaxation pagina's.

## v2.4.1 — Archief Standalone Flow
- Nieuw: `src/app/archief/oefening/[id]/page.tsx`
  Instelpaneel: sets/reps/duur/rust instelbaar, kettlebell gewicht
  keuzemenu (14/16/20kg, uitbreidbaar tot 32kg in stappen van 4).
  Toont vorige sessie uit exercise_records als referentie.
  Geen Trainer AI call — eigen mini workout-engine voor 1 oefening.
  training_source: library triggert bestaande Coach Call logica.

## v2.4.0 — Exercise Illustraties + Archief
- `illustratie` veld toegevoegd aan BibliotheekOefening interfaces
- Kettlebell Swing eerste oefening met mannequin-stijl illustratie
  (public/exercises/kettlebell-swing.png), GPT-gegenereerd
- UitlegScherm toont illustratie boven Doelwaarden als beschikbaar
- Nieuw: `/archief` pagina — alle 354 oefeningen doorbladerbaar per
  categorie, los van coach advies. Zoekfunctie.

## v2.3.6 — Weerbericht
- `src/app/api/weather/route.ts` — nieuw. IP → locatie → Open-Meteo.
  Uurlijkse data voor ochtend/middag/avond regen. Geen API key.
- `src/app/home/page.tsx` — weerbericht onder de datum (emoji, stad, temp, dagdelen)
- `src/app/api/coach/route.ts` — weercontext toegevoegd aan dagadvies

## v2.3.5 — Coach Rapport op aanvraag (Fase 3B)
- `src/app/api/progress-analysis/route.ts` — nieuw. 60 dagen data → Claude Sonnet
  → kracht/conditie/herstel/compliance/risicos/focus/samenvatting.
  Cache: max 1 analyse per 24 uur in `progress_analyses` tabel.
- `src/app/progressie/page.tsx` — "Analyseer mijn ontwikkeling" knop.
  Toont 6 secties met persoonlijk maandrapport. Opnieuw analyseren knop.

## v2.3.4 — Coach Trendanalyse (Fase 3A)
- `src/app/api/coach/route.ts` — progressie trendanalyse toegevoegd.
  Eerste vs laatste uitvoering per oefening, % verandering, trend richting.
  Gemiddelde RPE laatste 7 dagen. Belastingtrend t.o.v. vorige week.
  Coach ziet: "Goblet Squat 16kg → 20kg (+25%) ↑"

## v2.3.3 — Progressie Fase 2
- `src/app/progressie/page.tsx` — grafiek per oefening (tik op PR).
  Volume per week grafiek (8 weken). OefeningGeschiedenis berekend uit exercise_records.

## v2.3.2 — Persoonlijke Records
- `src/app/progressie/page.tsx` — PR sectie met module filter.
  Toont max gewicht/reps/duur per oefening. Sortering op meest uitgevoerd.

## v2.3.1 — Exercise Records
- Supabase tabel `exercise_records` aangemaakt (id, user_id, training_result_id,
  exercise_id, exercise_name, exercise_type, module, weight_kg, reps,
  duration_sec, distance_m, sets, rpe, performed_at)
- `src/app/api/training/complete/route.ts` — segments worden opgeslagen als exercise_records
- `src/app/training/session/[module]/page.tsx` — segments meegegeven bij opslaan

## v2.3.0 — Drill Libraries Running/Rowing/Cycling
- `src/lib/running-drills.ts` — 13 drills (recovery, endurance, tempo, interval, techniek)
- `src/lib/rowing-drills.ts` — 12 drills (recovery, endurance, interval, techniek)
- `src/lib/cycling-drills.ts` — 11 drills (recovery, endurance, tempo, interval, techniek)
- `src/app/api/training/today/route.ts` — runningContext, rowingContext, cyclingContext
- Trainer Rule volledig van kracht voor ALLE modules

## v2.2.2 — Scroll en Navigatie Fixes
- Alle recovery pagina's: terug → `/training?herstel=1&terug=[categorie]`
- `training/page.tsx` — herstelbibliotheek opent op juiste categorie bij terugkeren
- Categorieën standaard ingeklapt, scroll naar categorie bij openen
- Suspense wrapper voor useSearchParams (build fix)

## v2.2.1 — Relaxation Pagina + Categorische Herstelbibliotheek
- `src/app/training/recovery/relaxation/page.tsx` — nieuw. 6 schemas:
  Progressieve Spierontspanning, Body Scan, Visualisatie Herstel,
  Savasana, Cooling Down Protocol, Diafragma Ademhaling
- `src/app/training/page.tsx` — herstelbibliotheek inklapbaar per categorie:
  Ademhaling (5), Mobiliteit (11), Ontspanning (5), Wandelen (2)

## v2.2.0 — Recovery Bibliotheek
- `src/lib/recovery-exercises.ts` — 12 modules:
  Ademhaling (5), Wandelen (2), Ontspanning (4), Visualisatie (1)
- `filterRecovery()` en `formateerRecoveryVoorPrompt()` toegevoegd aan route
- Herstelbibliotheek uitgebreid met 7 nieuwe modules

## v2.1.2 — Alle Mobility Schemas in Herstelbibliotheek
- `src/app/training/page.tsx` — alle 11 mobility schemas zichtbaar in herstelbibliotheek
- Trainer Rule gedocumenteerd in docs/architecture.md

## v2.1.1 — Mobility Filter in Route
- `src/app/api/training/today/route.ts` — filterMobility() geïmporteerd
- Blessure-gebaseerde lichaamsdeel focus
- mobilityContext toegevoegd aan bibliotheekContext

## v2.1.0 — Mobility Bibliotheek
- `src/lib/mobility-exercises.ts` — 20 oefeningen
- Types: MobilityDoel, MobilityNiveau, MobilityLichaamsdeel, MobilityCategorie
- filterMobility() en formateerMobilityVoorPrompt()

## v2.0.4 — Mobility Bug Fix
- `src/app/training/recovery/mobility/page.tsx` — 11 schemas toegevoegd
- Fallback van neck_shoulders → full_body
- Route prompt: AI mag alleen bekende mobility subtypes gebruiken

## v2.0.3 en eerder — Zie eerdere sessies
- Coach Call Stap 1+2+3
- Bodyweight bibliotheek (120 oefeningen)
- Strength bibliotheek (100 oefeningen)
- Kettlebell bibliotheek (102 oefeningen)
- Uitlegpagina bibliotheek-koppeling
- Naam matching met aliassen
- Strava integratie
- Garmin integratie
- Life-events module
