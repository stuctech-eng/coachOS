# CoachOS — Changelog

## v2.4.36 — Fix: Garmin-activiteit-import-pagina kon niet scrollen
- `src/app/settings/garmin-activity-import/page.tsx` — root-`<div>`
  gewijzigd van `min-h-screen` naar `h-screen overflow-y-auto`.
- **Root cause:** deze pagina gebruikt bewust geen `AppShell` (geen
  bottom-navigatie gewenst tijdens de import-flow), maar de globale
  app-stijl schakelt scrollen op `body`/`html` doorgaans uit — een
  aanname die klopt zolang een pagina `AppShell`'s eigen `scroll-area`
  gebruikt (zie v2.4.20), maar niet als een pagina daar bewust buiten
  valt. Deze pagina had dus **nergens** een scrollbare container.
  Bij content die de schermhoogte overschreed (bijvoorbeeld een lange
  TCX-preview met alle datavelden + 8 keuzeknoppen + melding + knop,
  zoals bij een fietsactiviteit van 54km/1u44m) kon de gebruiker niet bij
  de knoppen onderaan komen — leek op "niet kunnen opslaan", maar was
  eigenlijk "niet kunnen scrollen om bij de knop te komen".
  `h-screen` + `overflow-y-auto` geeft de pagina een eigen, onafhankelijke
  scroll-context, los van het AppShell-mechanisme.
- **Vergelijkbaar risico elders:** dit is de enige pagina in het project
  die bewust buiten `AppShell` valt (voor zover deze sessie onderzocht) —
  mocht een toekomstige pagina ook `AppShell` overslaan, geef die dan
  vanaf het begin een eigen `overflow-y-auto`-container.

## v2.4.35 — Fix: TCX-import gaf 413 (payload te groot) bij lange activiteiten
- **Nieuw:** `src/lib/tcx-parser.ts` — de TCX-XML-parslogica (`parseTcx`,
  `bepaalKeuzeNodig`, `suggereerType`, `ACTIVITEIT_OPTIES`) is verplaatst
  naar een isomorfe, gedeelde module die zowel in de browser als
  server-side werkt.
- `src/app/settings/garmin-activity-import/page.tsx` — parseert het
  TCX-bestand nu **in de browser** (`file.text()` + `parseTcx()`) in
  plaats van het volledige bestand naar de server te uploaden. Alleen het
  kleine, samengevatte resultaat (JSON, enkele KB) gaat naar de server.
- `src/app/api/health/garmin-activity-tcx/route.ts` — de extract-flow
  accepteert nu JSON (`{ parsed }`) in plaats van `multipart/form-data`
  met het volledige bestand. Confirm-flow ongewijzigd (blijft FormData,
  was toch al klein).
- **Root cause:** Vercel serverless functions hebben een payload-limiet
  van ~4,5MB. Langere activiteiten genereren TCX-bestanden met veel meer
  trackpoints (per-seconde GPS/hartslag/cadans-data) — bij een lange
  activiteit overschreed het bestand die limiet, wat resulteerde in
  `413 FUNCTION_PAYLOAD_TOO_LARGE` vóórdat de request onze route-code
  ooit bereikte (vandaar dat er geen `[garmin-activity-tcx]`-logregel
  verscheen — Vercel blokkeerde het al op platformniveau).
  **Waarom dit pas nu opviel:** de 5 testbestanden waarmee de TCX-import
  in v2.4.25 gebouwd en getest is, waren allemaal relatief kort
  (20-60 minuten) — geen van allen kwam in de buurt van de limiet.
- **Waarom dit de definitieve fix is, niet een tijdelijke workaround:**
  parsen in de browser heeft principieel geen bestandsgrootte-limiet zoals
  een serverless function die heeft — dit lost het probleem op voor
  activiteiten van elke lengte, niet alleen de iets grotere bestanden die
  net onder een verhoogde limiet zouden passen.

## v2.4.34 — NIEUW: Audio (Fase 2) voor beide trainingssystemen
**Gebouwd volgens de afgesproken architectuurregels: geluid is uitsluitend
een luisterlaag, nooit sturend. Eén gedeelde module, tegelijk gekoppeld
aan Archief én Trainer AI/Bibliotheek om divergentie tussen de twee
systemen te voorkomen.**

**Nieuw bestand:**
- `src/lib/workout-sound.ts` — gedeelde audio-module, geïmporteerd door
  beide `page.tsx`-bestanden. Bevat:
  - `ontgrendelAudio()` — ontgrendelt de gedeelde `AudioContext` voor de
    rest van de sessie. Moet aangeroepen worden vanuit een ECHTE
    gebruikersinteractie (iOS Safari-vereiste); nooit automatisch.
  - `speelTick()` — kort/droog/hoog, laatste 3 sec van countdown/rust.
  - `speelEindsignaal()` — lager/langer, einde van een actieve set.
  - `speelStarttoon()` — hoger/helder, start van een nieuwe set/oefening.
  - Synthetische tonen via Web Audio API (`OscillatorNode` +
    `GainNode`-envelope) — geen externe geluidsbestanden, laadt niets.
  - Elke functie faalt volledig stil (try/catch) — een geblokkeerde of
    falende `AudioContext` kan de workout nooit onderbreken.

**Koppeling — Archief (`archief/oefening/[id]/page.tsx`):**
- `ontgrendelAudio()` in `startWorkout()` (de "Start oefening"-knop)
- `speelStarttoon()`: countdown→actief (1e set), rust→actief (vervolgset)
- `speelEindsignaal()`: actief→rust (einde set)
- `speelTick()`: losse `useEffect`, laatste 3 sec van countdown/rust

**Koppeling — Trainer AI/Bibliotheek (`training/session/[module]/page.tsx`):**
- `ontgrendelAudio()` in `handleReadyFromUitleg()` (de "Ready"-knop die de
  eerste countdown start)
- `speelStarttoon()`: countdown→active (elke set/oefening-start),
  rest→active (vervolgset zonder countdown)
- `speelEindsignaal()`: active→rest/last_rest (einde set)
- `speelTick()`: losse `useEffect`, laatste 3 sec van countdown/rest/last_rest

**Bewust nog niet in deze versie:**
- Geen aan/uit-instelling — geluid staat standaard aan, toggle volgt in
  Fase 3.
- Trilfunctie/vibratie — niet gevraagd voor deze fase.

**Test-aandachtspunten:** i) eerste start (audio moet daadwerkelijk
hoorbaar zijn, niet stilzwijgend geblokkeerd door iOS), ii) einde van een
set, iii) laatste 3 sec van rust (3 losse ticks), iv) countdown bij nieuwe
oefening (Trainer AI/Bibliotheek), v) pauzeren/hervatten (geen geluid
tijdens pauze, geen dubbel geluid bij hervatten), vi) lockscreen/
achtergrond-herstel (geluid moet niet "inhalen" met meerdere gemiste
ticks tegelijk).

## v2.4.33 — Kleurprincipe consistent: rood = "maak je klaar", niet "tijd loopt af"
**Bevestigd principe (gebruiker): rood betekent uitsluitend "je moet zo
beginnen" (rust/countdown), nooit "je huidige oefening loopt bijna af"
(actief). Archief volgde dit al sinds v2.4.31/32; Trainer AI/Bibliotheek
volgde het gedeeltelijk niet.**

- `src/app/training/session/[module]/page.tsx` — twee wijzigingen in
  `WorkoutEngine`/`CountdownScherm`:
  1. **`actief`-fase:** cijfer is nu altijd wit, wordt niet meer rood bij
     de laatste 3 seconden (was: `remaining <= 3 ? 'text-red-400' :
     'text-white'`, nu: altijd `text-white`).
  2. **`countdown`-fase** (bij elke nieuwe oefening, 3 of 5 sec): cijfer
     wordt nu rood bij de laatste 3 seconden (was: altijd wit, geen
     rood-signaal). Dit ontbrak nog volledig — een gemiste kans om het
     principe consistent toe te passen, niet alleen "geen onterecht rood
     weghalen" maar ook "terecht rood toevoegen".
  3. **`rust`/`last_rest`-fase:** ongewijzigd — was al rood bij de laatste
     3 seconden, en dat is precies correct volgens het principe.
- **Resultaat:** Archief en Trainer AI/Bibliotheek volgen nu exact
  hetzelfde kleurprincipe: rood verschijnt uitsluitend vlak vóór een
  moment waarop de gebruiker in actie moet komen (rust-einde,
  countdown-einde), nooit tijdens de uitvoering van een oefening zelf.

## v2.4.32 — Fix: pauze in Archief bevroor het cijfer niet (bug sinds v2.4.30)
- `src/app/archief/oefening/[id]/page.tsx` — `remaining` komt tijdens
  pauze nu uit de bevroren `paused_remaining_ms`, niet meer uit een live
  herberekening op basis van `phase_end_at`.
- **Root cause:** `phase_end_at` verandert bewust niet tijdens pauze (dat
  was al correct — nodig om de fase-overgang tegen te houden via de
  `gepauzeerd`-guard in de ticking-`useEffect`). Maar `remaining` werd bij
  elke render nog steeds live herberekend als
  `phase_end_at - Date.now()`, en `Date.now()` loopt gewoon door tijdens
  pauze — dus het GETOONDE cijfer bleef doortellen naar 0 en bleef daar
  hangen, ook al werd de daadwerkelijke fase-overgang terecht
  tegengehouden. Dit zag eruit als "pauze doet niets", terwijl de
  onderliggende logica (geen ongewenste fase-overgang) wel klopte —
  een zuiver weergave-probleem, geen logica-probleem.
- Aanwezig sinds v2.4.30 (de Archief-timer-herbouw), pas nu opgemerkt
  omdat v2.4.31 (kleur-fix) toevallig de aandacht op het rust-scherm
  vestigde.

## v2.4.31 — Fix: Archief-timer werd niet rood bij laatste 3 seconden
- `src/app/archief/oefening/[id]/page.tsx` — het cijfer tijdens `rust` en
  `countdown` kleurt nu rood zodra `remaining <= 3`, consistent met hoe de
  `actief`-fase dat al deed (`WorkoutEngine` in de Coach AI-trainingen had
  dit gedrag ook al).
- **Root cause:** bij de v2.4.30-timer-herbouw is dit visuele detail
  gemist — het cijfer bleef altijd amber (`rust`) of wit (`countdown`),
  ongeacht hoeveel seconden er nog over waren. Functioneel klopte de timer
  zelf (telde correct af), maar het ontbrekende visuele signaal bij de
  laatste 3 seconden viel op ten opzichte van de rest van de app.

## v2.4.30 — Workout Engine REBUILD toegepast op Archief (eigen flowregels)
**Vervolg op v2.4.29 — die herbouw raakte alleen Coach AI/Trainingsbibliotheek
(`training/session/[module]/page.tsx`). Archief gebruikt een volledig los
bestand met eigen timer-logica, die nog niet was meegenomen.**

- `src/app/archief/oefening/[id]/page.tsx` — zelfde onderliggende
  `phase_end_at`-engine als v2.4.29 (vast eindtijdstip i.p.v. los
  `tellerSec`-getal, centrale 250ms-ticking-loop, `visibilitychange`-
  herstel, drift-vrij), maar met **bewust andere flowregels** dan Coach
  AI-trainingen — beargumenteerd door de gebruiker: Archief is één losse
  oefening met herhaalde sets (ritme/herhaling gewenst), geen opeenvolging
  van verschillende oefeningen (geen "omschakel-moment" nodig).

**Archief-flow (nieuw, vervangt "elke set opnieuw 5 sec countdown"):**
- 5 sec countdown **alleen vóór de allereerste set**
- Bij elke volgende set: **geen countdown** — rust loopt af, dan direct
  door naar de volgende set (de rust zelf is de voorbereiding)

Ter vergelijking, Coach AI-trainingen (v2.4.29, ongewijzigd):
- 5 sec bij de allereerste oefening van de hele sessie
- 3 sec bij elke overgang naar een NIEUWE oefening (wél een
  omschakel-moment, andere beweging/spiergroep)
- Geen countdown tussen sets binnen dezelfde oefening

- Pauzeren/hervatten volgt hetzelfde `paused_remaining_ms`-patroon als
  v2.4.29 — geen verloren/gewonnen tijd door de pauzeduur.
- De v2.4.17-navigatiefix (`router.back()` i.p.v. `router.push('/archief')`)
  blijft behouden in deze herbouwde versie.
- "Volgende set" / "Skip countdown" / "Skip rust"-knoppen forceren nu
  `phase_end_at = Date.now()` in plaats van een eigen aparte
  transitielogica — dezelfde aanpak als v2.4.29's `handleNext()`, voorkomt
  twee losse plekken die weten hoe overgangen werken.

**Nog steeds niet in deze versie:** geluid (Fase 3) — volgt voor beide
systemen (Coach AI én Archief) tegelijk, zodra deze timer-basis in de
praktijk bevestigd is.

## v2.4.29 — Workout Engine REBUILD: Fase 1 (timer-engine) + Fase 2 (flow)
**Volgens de CoachOS Workout Engine Master Architecture — bewust in deze
volgorde gebouwd (eerst fundament, dan flow, geluid volgt in een latere
stap als Fase 3).**

- `src/app/training/session/[module]/page.tsx` — volledig herbouwd rond
  één centrale timer-engine.

**FASE 1 — Drift-vrije timer-engine:**
- Elke getimede fase (`countdown`/`active`/`rest`/`last_rest`) krijgt een
  vast `phase_end_at`-tijdstip (`Date.now() + duur`) in plaats van een los
  aftellend getal (`countdown_seconds`/`active_seconds_left`/`rest_seconds`
  zijn verwijderd uit de state).
- Resterende tijd wordt **elke render herberekend** uit `phase_end_at` —
  nooit opgeslagen als eigen state die kan gaan driften.
- Eén centrale `setInterval(250ms)` + `visibilitychange`-listener in
  `SessionPage` forceert herberekening, ook direct bij terugkeer uit de
  achtergrond/lockscreen — lost het probleem op dat `setInterval` op iOS
  vertraagt zodra het scherm uitgaat.
- `WorkoutEngine` is nu **puur presentationeel** — geen eigen
  `setInterval`-effecten meer (voorheen 3 aparte intervals voor
  countdown/active/rest). Ontvangt `remaining` als prop.
- Pauzeren bewaart de resterende tijd in `paused_remaining_ms` (ms);
  hervatten berekent een nieuw `phase_end_at` vanaf dat punt — de
  pauzeduur zelf telt niet mee.

**FASE 2 — Vereenvoudigde flow:**
- **Geen countdown meer tussen sets** van dezelfde oefening — na `rest`
  gaat het direct door naar `active` (volgende set).
- **5 sec countdown** alleen bij de allereerste oefening van de sessie
  (`current_segment === 0 && completed_segments.length === 0`).
- **3 sec countdown** bij elke overgang naar een nieuwe oefening (na
  `last_rest`).
- Nieuwe flow: `uitleg → countdown(5s, 1x) → active → rest → active →
  rest → active → last_rest → [nieuwe oefening] → countdown(3s) → active
  → ... → voltooid`.
- De "Next"-knop (`handleNext`) forceert nu `phase_end_at = Date.now()` in
  plaats van een eigen, aparte transitielogica te hebben — de centrale
  ticking-loop pikt dit binnen 250ms op en roept dezelfde `advancePhase()`
  aan die ook bij natuurlijk verlopen van de tijd gebruikt wordt. Voorkomt
  dat er twee losse plekken zijn die weten hoe fase-overgangen werken.

**Nog niet in deze versie (bewust, volgende stap):**
- Fase 3 (geluid: Tick + Beep) — bouwen zodra deze timer-basis in de
  praktijk bevestigd is als 100% betrouwbaar.
- Fase 4 (instellingen geluid aan/uit).
- Trillingen, Apple Watch, Live Activities, Dynamic Island — genoemd in
  het architectuurdocument als toekomstige uitbreidingen, vandaar de keuze
  voor één centrale state (`phase`, `phase_end_at`) waar dit later op kan
  aanhaken zonder de kern opnieuw te hoeven bouwen.

**Test-aandachtspunten voor deze release:** i) eerste oefening start met
5 sec countdown, ii) geen countdown tussen sets binnen dezelfde oefening,
iii) elke volgende oefening start met 3 sec countdown, iv) timer blijft
correct na scherm-uit/achtergrond (val niet stil, geen drift), v) pauzeren
en hervatten geeft geen verloren/extra seconden.

## v2.4.28 — Fix: geen duplicaatcheck bij TCX-import (idempotency ontbrak)

**Mogelijk relevant vóór deploy — check of je al een duplicaat hebt
aangemaakt:** als je hetzelfde TCX-bestand meerdere keren hebt bevestigd
vóór deze fix, staan er nu waarschijnlijk dubbele `activity_sessions`-
rijen (en dubbele Coach Call-items). Check met:
```sql
select id, date, duration, notes, created_at
from activity_sessions
where user_id = 'JOUW_USER_ID' and source = 'garmin'
order by created_at desc;
```
Verwijder handmatig de duplicaat-rij(en) indien aanwezig (en het
bijbehorende `coach_call_items`-record) — dit gebeurt niet automatisch.

**Wat er is gefixt:**
- `src/app/api/health/garmin-activity-tcx/route.ts` — vóór het opslaan
  wordt nu gecontroleerd of er al een `activity_sessions`-rij bestaat met
  dezelfde TCX-starttijd (`garmin_tcx_start:[Id]` in `notes`). Zo ja: de
  confirm wordt geweigerd met status 409 en een duidelijke melding,
  in plaats van een duplicaat aan te maken.
- **Root cause:** deze idempotency-check bestond al voor Strava-sync (via
  `strava:ID` in `notes`, zie `strava-activity-processor.ts`), maar was
  niet meegenomen bij het bouwen van de TCX-route (v2.4.25) — een gemiste
  parallel tussen twee vergelijkbare importwegen.
- `src/app/settings/garmin-activity-import/page.tsx` — toont nu de
  specifieke "al eerder geïmporteerd"-melding bij een 409-response, in
  plaats van een generieke foutmelding.
- **Bewuste keuze — screenshot-import (v2.4.23/24) heeft dit nog niet.**
  Een screenshot heeft geen betrouwbaar uniek kenmerk zoals een TCX-
  starttijd om op te dedupliceren; dat zou een aparte oplossing vergen
  (bijv. datum + tijd + activiteitstype als samengestelde sleutel). Nog
  niet gebouwd — laag risico, want een screenshot opnieuw uploaden is een
  bewustere, minder toevallige handeling dan een TCX-bestand dat je
  mogelijk per ongeluk twee keer aanklikt.

## v2.4.27 — Build-fix: ongeldige export in garmin-activity-tcx/route.ts
- `src/app/api/health/garmin-activity-tcx/route.ts` — `export const
  ACTIVITEIT_OPTIES = [...]` gaf een Vercel build-fout: *"ACTIVITEIT_OPTIES
  is not a valid Route export field"*.
- **Root cause:** Next.js App Router staat in `route.ts`-bestanden
  uitsluitend specifieke exports toe (`GET`, `POST`, `dynamic`,
  `revalidate`, etc.) — een losse geëxporteerde constante wordt door
  Next.js' eigen type-validatie geweigerd, ongeacht of hij ergens
  daadwerkelijk wordt geïmporteerd. In dit geval werd de constante alleen
  intern in hetzelfde bestand gebruikt, dus de `export` was sowieso
  overbodig.
- Fix: `export` weggehaald, functioneel geen enkele wijziging.
  **Les:** in `route.ts`-bestanden nooit hulpconstantes/functies
  exporteren tenzij écht nodig vanuit een ander bestand — anders eerst
  overwegen of het naar een apart `lib/`-bestand hoort.

## v2.4.26 — NIEUW: Blessures-archief met volledige historie

**⚠️ VEREIST VÓÓR DEPLOY — nieuwe kolom in Supabase SQL Editor:**
```sql
alter table injuries add column ended_at timestamptz;
```
Zonder deze kolom slaagt de PATCH in `injuries/route.ts` niet meer bij het
markeren van een blessure als hersteld (poging tot schrijven naar een
niet-bestaande kolom).

**Wat er is veranderd:**
- `src/app/api/injuries/route.ts` — `PATCH` zet nu `ended_at` op het huidige
  tijdstip zodra een blessure op `active: false` wordt gezet (hersteld), en
  maakt het weer leeg als een blessure ooit heropend zou worden
  (`active: true`). Nodig om duur en hersteldatum te kunnen tonen.
- `src/app/injuries/page.tsx` — de kleine "Hersteld"-sectie onderaan
  (toonde alleen de naam, doorgestreept, geen historie) is verwijderd.
  Herstelde blessures verdwijnen nu uit dit scherm en verhuizen naar het
  nieuwe archief. Een "Archief"-kaart onderaan linkt daarnaartoe.
- **Nieuw:** `src/app/injuries/archief/page.tsx` — toont elke herstelde
  blessure als uitklapbare kaart met lichaamsdeel, start-/hersteldatum,
  berekende duur (dagen/weken/maanden, leesbaar geformatteerd), en bij het
  uitklappen de **volledige pijnscore-historie** (hergebruikt de bestaande
  `injury-updates`-data via `GET /api/injury-updates`, alleen-lezen).
- Geen nieuwe API-route nodig voor het archief zelf — hergebruikt de
  bestaande `GET /api/injuries` en filtert client-side op `!active`,
  consistent met hoe de hoofdpagina dat al deed voor actieve blessures.

## v2.4.25 — NIEUW: TCX-import gecombineerd met screenshot-import (één pagina)
**Gebouwd na onderzoek van 5 echte Garmin TCX-exports (Hardlopen, Wandelen,
Fietsen buiten, Fietsen indoor, Roeien, Zwift) — het ontwerp is direct op
bewijs gebaseerd, niet op aannames over hoe Garmin activiteiten labelt.**

**Nieuwe dependency:** `fast-xml-parser` (^4.5.0) toegevoegd aan `package.json`.

**Onderzoeksbevindingen (bepalend voor het ontwerp):**
- `Sport="Running"` is 100% betrouwbaar → automatisch "Hardlopen"
- `Sport="Biking"` geldt voor ZOWEL buiten als indoor fietsen — **Zwift
  genereert zelfs nep-GPS-coördinaten die op een buitenrit lijken**, dus
  GPS-aanwezigheid is geen betrouwbaar onderscheid
- `Sport="Other"` dekt wandelen, roeien, kracht, kettlebell — geen enkel
  TCX-veld onderscheidt deze onderling
- Conclusie: alleen `Running` mag automatisch worden aangenomen; voor al het
  overige toont de UI een keuzemenu met een voorgestelde default

**Nieuwe bestanden:**
- `src/app/api/health/garmin-activity-tcx/route.ts` — parseert TCX-XML met
  `fast-xml-parser` (geen AI nodig, exacte cijfers). Let op een subtiele
  parser-eigenaardigheid, gevonden door te testen tegen echte bestanden:
  `fast-xml-parser` behoudt de `ns3:`-naamruimte-prefix OOK op
  onderliggende veldnamen (bv. `Extensions['ns3:TPX']['ns3:Watts']`, niet
  `Extensions.TPX.Watts`). Cadans staat top-level als `Cadence` bij fietsen,
  maar als `ns3:RunCadence` binnen `ns3:TPX` bij hardlopen — beide worden
  gecombineerd.
- `src/app/settings/garmin-activity-import/page.tsx` — **volledig herbouwd**
  als gecombineerde pagina met tabblad-keuze (Screenshot/TCX-bestand) in
  plaats van een aparte derde knop in Instellingen. Bij TCX met
  `keuze_nodig: true` toont de pagina een keuzemenu (Hardlopen, Fietsen
  buiten, Indoor Fietsen, Wandelen, Roeien, Krachttraining, Kettlebell,
  Anders), voorgevuld met een suggestie.
- Hergebruikt de bestaande `garmin_activity_imports`-tabel (v2.4.23) —
  geen nieuwe tabel nodig, `parsed_data` is generiek genoeg voor beide
  brontypes.
- Zelfde vervolgpad als v2.4.23/24: opslag in `activity_sessions`
  (`source: 'garmin'`) + altijd een Coach Call, ongeacht duur/afstand.

**Bewust ontbrekend bij TCX (eerlijk, geen verzonnen waarde):** Training
Effect en Exercise Load staan niet in het ruwe TCX-bestand — dat is
Garmin's eigen berekende duiding, alleen zichtbaar op het Statistieken-
scherm. TCX-imports missen dit veld; screenshot-imports hebben het wel.
Beide methodes blijven daarom naast elkaar bestaan, geen vervanging.

## v2.4.24 — Fix: Garmin-activiteit-import faalde op check constraint (source)
- `src/app/api/health/garmin-activity-vision/route.ts` — `source`-waarde
  bij de insert in `activity_sessions` gecorrigeerd van `'garmin_manual'`
  naar **`'garmin'`**.
- **Root cause:** `activity_sessions` heeft een check constraint
  (`activity_sessions_source_check`) die `source` beperkt tot
  `manual`/`garmin`/`apple_health`/`strava`. `'garmin_manual'` (verzonnen
  bij het bouwen van v2.4.23, niet geverifieerd tegen het bestaande schema)
  bestond niet in die lijst — Postgres-foutcode `23514`, direct zichtbaar
  via de `console.error('[garmin-activity-vision]', err)`-log.
  **Les:** bij een nieuwe insert in een bestaande tabel altijd eerst de
  check constraints verifiëren (`select conname, pg_get_constraintdef(oid)
  from pg_constraint where conname = '...'`), niet aannemen welke waarden
  zijn toegestaan — exact de fout die v2.4.12 (NOT NULL constraint) ook al
  had blootgelegd, hier herhaald bij een nieuwe feature.
- Onderscheid tussen de dagelijkse Garmin-import en deze nieuwe
  activiteit-import blijft behouden via de `notes`-prefix
  (`garmin_activity_import:[id]`) in plaats van via een eigen
  `source`-waarde — functioneel gelijk, past binnen het bestaande schema.
- README-tabel (Coach Call Systeem) bijgewerkt met de gecorrigeerde waarde.

## v2.4.23 — NIEUW: Garmin-activiteit-import (alternatief voor Strava)
**Context: Strava heeft per 30 juni 2026 API-toegang voor bestaande
Standard-tier ontwikkelaars afhankelijk gemaakt van een betaald abonnement
(zie sectie "Strava API-toegang" hieronder). Dit is een externe
beleidswijziging van Strava, geen bug in CoachOS. Deze nieuwe feature is
een parallel, handmatig alternatief — geen vervanging van Strava-sync zelf.**

**⚠️ VEREIST VÓÓR DEPLOY — nieuwe tabel in Supabase SQL Editor:**
```sql
create table garmin_activity_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  activity_session_id uuid references activity_sessions(id),
  raw_vision_response jsonb,
  parsed_data jsonb,
  validation_flags jsonb,
  confidence_score int,
  status text default 'pending',
  created_at timestamptz default now()
);

alter table garmin_activity_imports enable row level security;

create policy "Users manage own garmin_activity_imports"
  on garmin_activity_imports for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```
Zonder deze tabel geeft `/api/health/garmin-activity-vision` een 500-fout
bij elke poging.

**Nieuwe bestanden:**
- `src/app/api/health/garmin-activity-vision/route.ts` — leest het
  "Statistieken"-tabblad van een Garmin-activiteit uit via Claude Vision
  (zelfde patroon als de bestaande dagelijkse Garmin-import:
  `sharp`-compressie, `claude-opus-4-5`, extract → preview → confirm-flow).
  Bij bevestigen: slaat op in `activity_sessions` (`source: 'garmin_manual'`
  — dezelfde tabel als Strava, dus telt automatisch mee in bestaande
  trainingsbelasting-berekeningen) én maakt **altijd** een Coach Call aan.
- `src/app/settings/garmin-activity-import/page.tsx` — UI voor upload/
  preview/bevestigen, zelfde stijl als `garmin-import/page.tsx`.
- `src/app/settings/page.tsx` — nieuwe kaart "Garmin Activiteit" toegevoegd
  naast de bestaande "Garmin Import"-kaart.

**Belangrijk architectuurbesluit — waarom GEEN drempel zoals Strava:**
Strava-activiteiten triggeren een Coach Call alleen bij een kwalificerende
duur/afstand (OR-drempel, v2.4.6), omdat dat een **automatische bulk-sync**
is met mogelijk veel triviale activiteiten. Een Garmin-screenshot-upload is
daarentegen een **bewuste, eenmalige handeling** — vergelijkbaar met het
starten van een Trainingsbibliotheek-sessie (die ook altijd triggert, zie
v2.4.6). Daarom triggert deze route altijd een Coach Call, ongeacht duur.
Bevat ook de v2.4.8/v2.4.12-heropen-logica voor een reeds
completed/expired call van diezelfde dag.

**Wat nog niet is gedaan:**
- Geen retry-logica (v2.4.9/v2.4.11) toegevoegd aan de Coach Call-insert in
  deze nieuwe route — dat kan bij gelegenheid alsnog toegevoegd worden als
  hier ooit hetzelfde stille-faal-patroon optreedt als bij
  `training/complete/route.ts`.
- Sportnaam-mapping (`ACTIVITY_LABEL_MAP`) dekt de meest voorkomende
  activiteiten maar is niet zo uitgebreid als Strava's `SPORT_TYPE_MAP` —
  uit te breiden indien nodig.

## v2.4.22 — REBUILD: Strava sync (timeout + duidelijke feedback) + v1.8.5 versienummer gefixt
**Op verzoek herbouwd in plaats van opnieuw gepatcht, na een reeks
symptomen (geen resultaatbericht meer, knop bleef "laden") die niet met
gerichte fixes op te lossen bleken.**

- `src/app/api/strava/sync/route.ts` — volledig herbouwd:
  - **Eigen timeout (20 sec, `AbortController`)** op de fetch naar Strava's
    API. Dit was de root cause: de aanroep had voorheen géén timeout, dus
    bij een trage Strava-respons bleef de request oneindig hangen (of tot
    een onduidelijke platform-timeout) zonder ooit een bericht naar de
    gebruiker te sturen — precies het "blijft laden, geen resultaat meer"
    -symptoom.
  - Expliciete afhandeling van Strava-statuscodes: `401` (token ongeldig
    ondanks refresh — vraagt om opnieuw te koppelen), `429` (rate limit),
    overige non-200 statussen.
  - Elke stap gelogd (`console.log`/`console.error` met `[strava/sync]`
    prefix) — token-refresh, aantal opgehaalde activiteiten, per-activiteit
    verwerkingsfouten, totale duur. Een volgend probleem is nu direct
    zichtbaar in Vercel logs zonder eerst code te hoeven doorpluizen.
  - Response bevat nu altijd `success`, `message`, en bij succes ook
    `importedNames` (welke activiteiten precies) en eventuele
    per-activiteit `errors` — nooit meer een stille, betekenisloze
    "Sync klaar".
- `src/app/settings/page.tsx` (`StravaSection`) — volledig herbouwd:
  - Resultaatbericht **blijft zichtbaar** tot de volgende sync-poging
    (was: kon verdwijnen/overschreven worden zonder duidelijke reden).
  - Na **10 seconden zonder resultaat**: expliciete "dit duurt langer dan
    gebruikelijk"-melding in plaats van een spinner die niets zegt.
  - Toont bij succes de namen van geïmporteerde activiteiten; toont bij
    fouten een duidelijke foutmelding in plaats van een generieke tekst.
  - **Bonus, zelfde bestand:** het hardcoded `"v1.8.5"`-versienummer
    (derde losstaande versie naast `package.json` en de al in v2.4.14
    gefixte hoe-werkt-het-pagina) is nu ook dynamisch via `/api/version`.
- **Nog te bevestigen:** of de eerder gemelde ontbrekende wandelactiviteit
  nu wél verschijnt bij een nieuwe sync-poging — dat hangt af van of
  Strava de activiteit inmiddels heeft verwerkt (buiten onze controle),
  maar met deze rebuild krijgt de gebruiker in elk geval altijd een
  duidelijk, waarheidsgetrouw resultaat te zien, ongeacht de uitkomst.

## v2.4.21 — Verfijning v2.4.20: Training blijft bovenaan vanuit Home, herstelt scroll vanuit Archief
**Verduidelijking na terugkoppeling: de v2.4.20 scroll-herstel-fix in
`AppShell` werkt technisch correct, maar het "probleem" bleek deels een
bewuste keuze te zijn — Training-pagina opent bewust bovenaan bij
`Start Training`/`Start Herstel` vanuit Home. Deze wijziging maakt het
onderscheid expliciet in plaats van dat beide paden hetzelfde
scroll-herstel-gedrag delen.**

- `src/app/home/page.tsx` — de `Start Training`/`Start Herstel`-knop wist nu
  expliciet de opgeslagen scrollpositie voor `/training`
  (`sessionStorage` key `coachos_scroll_/training`, uit v2.4.20) vlak vóór
  het navigeren.
- **Resultaat:**
  - Vanuit **Home** → Start Training/Herstel → Training opent **bovenaan**
    (ongewijzigd t.o.v. voor deze hele fix-reeks — dit was en blijft
    gewenst gedrag).
  - Vanuit **Archief** → terug (via `router.back()`, v2.4.17/18) → Training
    **herstelt de scrollpositie** van vóór het bezoek aan Archief (via
    v2.4.20's `AppShell`-logica, die hier niet gewist wordt).
- **Geen wijziging nodig in `AppShell` zelf** — de v2.4.20-logica was
  inhoudelijk correct, alleen ontbrak er een manier om "vergeet de vorige
  positie, dit is een verse start" aan te geven voor het Home-pad. Dat is
  wat deze wijziging toevoegt.

## v2.4.20 — DEFINITIEVE FIX: scrollpositie-herstel in AppShell (v2.4.19 was onjuist)
**Correctie: de analyse in v2.4.19 was fout. Dit lost het daadwerkelijke
probleem op, in het juiste bestand.**

- `src/components/layout/index.tsx` (`AppShell`) — scrollpositie van het
  binnenste `<main>`-element wordt nu bijgehouden in `sessionStorage`, per
  pathname, en hersteld bij het opnieuw mounten van diezelfde route.
- **De echte root cause, gemist in v2.4.17-v2.4.19:** `AppShell` rendert een
  buitenste `<div className="h-screen ... overflow-hidden">` met daarbinnen
  een `<main className="flex-1 scroll-area ...">`. **Het binnenste `<main>`
  scrolt, niet `window`.** Browser-native scrollherstel en Next.js'
  ingebouwde scroll-restoration werken uitsluitend op `window.scrollTo` —
  die hebben dus **nooit** invloed gehad op dit element, ongeacht of de
  navigatie via `router.push()`, `router.back()` of `router.replace()`
  gebeurde, en ongeacht of data synchroon of asynchroon geladen werd. Bij
  elke hermount van een route begint dit `<main>`-element simpelweg weer op
  `scrollTop: 0` — dat is standaard DOM-gedrag, geen bug in onze routing.
- **Waarom v2.4.17/v2.4.18 gedeeltelijk hielpen, maar niet genoeg:** die
  fixes losten een écht apart probleem op (dubbele geschiedenis-entries die
  naar de verkeerde PAGINA navigeerden). Dat probleem bestond naast dit
  scrollprobleem, met een deels overlappend symptoom ("terug gaat niet
  goed"). Beide moesten apart gefixt worden.
- **Waarom v2.4.19 niet hielp:** de analyse ging uit van een layout-shift
  die *window*-scrollherstel zou breken — maar er was helemaal geen
  window-scrollherstel actief om te breken, dus die fix raakte de
  daadwerkelijke oorzaak nooit. Nuttige les: verifieer welk element
  daadwerkelijk scrolt (`window` vs. een inner container met
  `overflow-y`) vóórdat je scroll-herstel-gedrag probeert te fixen.
- **Waarom deze fix wél moet werken:** hij grijpt rechtstreeks in op het
  element dat daadwerkelijk scrolt (`mainRef.current.scrollTop`), volledig
  onafhankelijk van hoe Next.js of de browser navigatie/scroll intern
  afhandelen. Zit in `AppShell` — werkt hierdoor voor élke pagina in de
  app, niet alleen Training/Archief.
- **Dubbele herstelpoging** (direct bij mount + na 150ms) omdat sommige
  pagina's (zoals Training, met de v2.4.19 cache-fix) een fractie van een
  seconde na mount nog van hoogte kunnen veranderen.

## v2.4.19 — Fix: scroll-positie reset bij terugkeer naar Training (INCORRECTE ANALYSE, zie v2.4.20)
**Belangrijk: dit is een ANDER probleem dan de dubbele-geschiedenis-bug uit
v2.4.17/v2.4.18, ook al leek het symptoom in eerste instantie identiek
("terugknop gaat verkeerd").**

- `src/app/training/page.tsx` — `instruction` en `laden` state worden nu
  synchroon geïnitialiseerd vanuit de `localStorage`-cache via een lazy
  `useState`-initializer (`leesGecachteInstructie()`), in plaats van pas in
  een `useEffect` na de eerste render.
- **Root cause:** deze pagina toonde bij elke (her)mount altijd eerst de
  `TrainingSkeleton` (`laden` start op `true`), zelfs als er al geldige
  cache-data in `localStorage` stond — de cache werd pas in een `useEffect`
  gecontroleerd, die pas ná de eerste render draait. De skeleton heeft een
  andere (kortere) hoogte dan de uiteindelijke pagina-inhoud. Wanneer de
  gebruiker teruggnavigeerde (bv. vanuit Archief) via `router.back()` of
  swipe, probeerde de browser de scrollpositie te herstellen op het moment
  dat de pagina nog de korte skeleton toonde — waardoor de herstelde
  positie niet meer klopte zodra de volledige content (met de al bezochte
  categorieën, Trainingsbibliotheek, etc.) een fractie van een seconde later
  verscheen. Dit voelde aan als "terugknop gaat 2 stappen terug" of "reset
  naar boven", terwijl de navigatie zelf (welke pagina) wel degelijk correct
  was.
- **Onderscheid met v2.4.17/v2.4.18:** die fixes losten een echte
  dubbele-`push()`-geschiedenis op (verkeerde bestemmingspagina). Deze fix
  lost een layout-shift op die scroll-herstel breekt binnen de juiste
  pagina. Beide konden hetzelfde voelen voor de gebruiker ("terug gaat
  niet goed"), maar hadden compleet losstaande oorzaken en fixes — een
  les voor toekomstig soortgelijk onderzoek: bevestig altijd expliciet of
  het probleem "verkeerde pagina" of "verkeerde scrollpositie op de juiste
  pagina" is, met screenshots van vóór/na indien mogelijk.

## v2.4.18 — Navigatie-fix uitgebreid: Archief-overzicht + Trainingsbibliotheek-sessie
**Vervolg op v2.4.17 — dezelfde root cause bleek breder aanwezig dan alleen
de losse Archief-oefeningpagina.**

- `src/app/archief/page.tsx` — terugknop gebruikte `router.push('/training')`,
  nu `router.back()`.
- `src/app/training/session/[module]/page.tsx` — drie plekken gefixt:
  1. `handleHeaderBack()`, fallback zonder actieve sessie:
     `router.push('/training')` → `router.back()`
  2. `handleHeaderBack()`, laatste "verlaat sessie helemaal"-tak:
     `router.push('/training')` → `router.back()`
  3. `handleSave()`, redirect na voltooide evaluatie:
     `router.push('/training')` → `router.replace('/training')`
- **Root cause (zelfde als v2.4.17):** `router.push()` voegt bij elk gebruik
  een NIEUWE entry toe aan de browsergeschiedenis. Bij herhaald gebruik van
  Archief of Trainingsbibliotheek (oefening bekijken → terug → andere
  oefening bekijken, of training starten → afbreken → opnieuw starten)
  stapelen duplicaten zich op. Swipe-terug (systeem-navigatie, buiten
  React's routing) volgt die vervuilde geschiedenis, wat zich uit als
  meerdere stappen tegelijk terug, "hangen en terugspringen", of
  terechtkomen op een oude, ongerelateerde pagina.
- **Waarom dit gevonden werd:** gebruiker meldde dat swipe-terug vanuit een
  Archief-oefeningpagina uitkwam op een kettlebell-trainingssessie van
  eerder die dag. Doorvragen naar het exacte navigatiepad
  (Archief → oefening → terug → andere oefening) bevestigde het patroon.
  Vervolgvraag "geldt dit voor het hele Archief?" bracht de bredere scope
  aan het licht — de fix in v2.4.17 dekte slechts één van de vier
  betrokken plekken.
- **Suggestie voor toekomstig onderzoek:** dit `push` vs. `back`/`replace`-
  patroon kan mogelijk ook in andere delen van de app voorkomen die niet
  deze sessie zijn gecontroleerd (bv. Coach Call-pagina, Checkin-pagina,
  Settings-subpagina's). Zie README sectie Troubleshooting voor het
  algemene fix-patroon, mocht een vergelijkbaar probleem zich elders
  voordoen.

## v2.4.17 — Fix: navigatie Archief-oefening bouwde dubbele geschiedenis op
- `src/app/archief/oefening/[id]/page.tsx` — twee wijzigingen:
  1. Terugknop gebruikt nu `router.back()` in plaats van
     `router.push('/archief')` (alleen in de `instellen`-fase — andere
     fases blijven state-only teruggaan via `setFase('instellen')`,
     ongewijzigd).
  2. De automatische redirect na een voltooide evaluatie gebruikt nu
     `router.replace('/archief')` in plaats van `router.push()`.
- **Root cause:** `router.push('/archief')` voegt bij elk gebruik een
  NIEUWE entry toe aan de browsergeschiedenis, ook als je al eerder op
  Archief was. Bij de flow "oefening bekijken → terug → andere oefening
  bekijken → terug → ..." stapelden zich dubbele `/archief`-entries op.
  De in-app terugknop leek daardoor te werken (het scherm zag er correct
  uit), maar de browsergeschiedenis raakte vervuild. Swipe-terug (echte
  browser-navigatie, buiten React's routing om) volgt die vervuilde
  geschiedenis letterlijk, wat zich uitte als: soms 2 stappen tegelijk
  terug, soms "hangen en terugspringen", en in het ergste geval
  terechtkomen op een compleet ongerelateerde eerdere pagina (bijv. een
  kettlebell-trainingssessie van eerder die dag).
  Gevonden via reproductie: Archief → oefening bekijken → terug →
  andere oefening bekijken → swipe-terug gedraagt zich inconsistent.
- `router.back()` navigeert altijd naar de daadwerkelijk vorige pagina in
  de bestaande stack, zonder duplicaten toe te voegen — dit synchroniseert
  het gedrag van de in-app knop met swipe-navigatie.

## v2.4.16 — Illustratie-koppeling: 6 nieuwe WebP-oefeningen (#16-21)
- `src/lib/kettlebell-exercises.ts` — `illustratie`-veld toegevoegd aan 6
  entries: kb-box-squat, kb-tempo-goblet-squat, kb-pause-squat,
  kb-split-squat, kb-bulgarian-split-squat, kb-reverse-lunge.
  Eerste WebP-illustraties sinds de workflow-herziening in v2.4.5 (PNG
  t/m #15, WebP vanaf #16) — bevestigt dat de eerder vastgestelde
  formaat-knip in de praktijk werkt zonder verdere codewijziging nodig.
  Totaal nu 24/102 kettlebell-oefeningen met live illustratie (18 PNG
  legacy + 6 WebP nieuw).

## v2.4.15 — Fix: coach-geheugen/patroonherkenning heeft nooit gewerkt
**Gevonden via de nieuwe gezondheidscheck (v2.4.14): een 401-fout op
`POST /api/memory` met `User Agent: node`, dus een server-naar-server
aanroep — geen gebruikersactie.**

- `src/app/api/coach/route.ts` — de fire-and-forget call naar `/api/memory`
  aan het einde van de POST geeft nu `userId` mee in de request-body:
  ```js
  fetch('https://coach-os-tau.vercel.app/api/memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.id }),
  }).catch(() => {})
  ```
- `src/app/api/memory/route.ts` — `POST` accepteert nu optioneel een
  `userId` in de body; valt terug op cookie-gebaseerde `getUser()` als die
  ontbreekt (voor eventuele toekomstige directe client-aanroepen).
- **Root cause:** deze server-naar-server fetch stuurde nooit cookies mee.
  `getUser()` (cookie-gebaseerd) kon de gebruiker daardoor nooit
  identificeren, en de route gaf sinds de eerste implementatie altijd 401
  terug. De aanroeper ving dit stil af met `.catch(() => {})`, dus dit was
  nooit zichtbaar in normaal gebruik.
- **Impact:** de coach-geheugen/patroonherkenning-feature — beschreven in
  `hoe-werkt-het/page.tsx` ("Coach AI heeft een geheugen... na een week
  begint hij patronen te herkennen") — heeft dus **nog nooit gedraaid**
  sinds de eerste implementatie. `coach_memory` bevatte hierdoor nooit
  automatisch gegenereerde patronen.
  **Besluit:** geen eenmalige achterstand-inhaaltrigger. Vanaf nu bouwt de
  patroonherkenning organisch op bij elke nieuwe coach-advies-generatie —
  rustig, zonder een geforceerde eenmalige analyse over oude data.

## v2.4.14 — Eén versienummer: package.json leidend, automatische update-detectie
**Definitieve oplossing voor drie los van elkaar lopende versienummers
(package.json 1.8.0, hoe-werkt-het-pagina "v1.8.6" hardcoded, README
2.4.13) — vastgesteld tijdens de gezondheidscheck-discussie.**

- `package.json` — versienummer bijgewerkt naar `2.4.14`. **Dit is vanaf
  nu de enige bron van waarheid voor het app-versienummer.** Bij elke
  toekomstige wijziging: `package.json`, README en changelog gaan altijd
  samen omhoog, in dezelfde beweging.
- **Nieuw:** `src/app/api/version/route.ts` — leest het versienummer
  rechtstreeks uit `package.json` en geeft het terug als JSON. Geen
  wijziging aan `next.config.js` nodig (geen build-time env-injectie) —
  een simpele runtime-route volstaat en is minder risicovol.
- `src/app/settings/hoe-werkt-het/page.tsx` — de hardcoded `"CoachOS
  v1.8.6"`-tekst is vervangen door een `fetch('/api/version')`-call. Kan
  nooit meer los gaan lopen van de werkelijke versie.
- `src/app/home/page.tsx` — **automatische update-detectie toegevoegd.**
  Bij elke keer dat de app opent, vergelijkt een nieuwe `useEffect` het
  versienummer (via `/api/version`) met wat in `localStorage`
  (`coachos_laatst_geziene_versie`) stond bij het vorige bezoek. Bij een
  verschil draait een **lichte** gezondheidscheck op de achtergrond (5
  kerntabellen + 3 kernroutes, puur lezend — bewust géén Laag 3
  schrijftest op de achtergrond, dat blijft voorbehouden aan een bewuste
  handmatige `/debug`-run). Bij gevonden problemen verschijnt een rode
  banner bovenaan Home die doorlinkt naar `/debug` voor de volledige
  diagnose. Faalt de check zelf (netwerk e.d.), dan gebeurt er stil niets
  — geen storende fout-banner voor een probleem dat er niet is.
- **Wat dit oplost:** de oorspronkelijke wens ("waarschuwen als een update
  de code breekt") is nu functioneel — niet volledig automatisch vóóraf
  (dat kan niet zonder CI/CD-pipeline, zie eerdere overleg), maar wel
  automatisch **gedetecteerd bij het eerstvolgende bezoek na een update**,
  zonder dat de gebruiker zelf naar `/debug` hoeft te navigeren.

## v2.4.13 — Debug Panel uitgebreid tot volledige gezondheidscheck
- `src/app/debug/page.tsx` — drie lagen toegevoegd/uitgebreid:
  - **Laag 1 — alle tabellen:** bereikbaarheidscheck uitgebreid van 4 naar
    alle 29 tabellen uit het schema (`select id limit 1`, puur lezend).
    Toont nooit inhoud van gevoelige tabellen (`strava_tokens`,
    `health_api_keys`) — alleen bereikbaar/niet.
  - **Laag 2 — kernroutes:** uitgebreid van 2 naar 17 veilig-te-testen
    GET-routes. Schrijfroutes (training/complete, coach-calls/rate,
    strava/sync, etc.) worden bewust NIET aangeroepen — dat zou echte data
    aanmaken/wijzigen.
  - **Laag 3 — schrijftest coach_calls/coach_call_items:** maakt een
    tijdelijke, herkenbare testrij aan (`sport_type: '__SELFTEST__'`,
    datum `1900-01-01`, status `__selftest_pending__`/`__selftest__` — kan
    nooit met echte data clashen), test de insert, en ruimt direct op via
    een `finally`-blok (ook bij een fout onderweg). Ruimt bij elke run ook
    oude testrijen op (ouder dan 5 min) mocht een eerdere run gecrasht
    zijn vóór opruiming. Dit is precies de test die de v2.4.12
    NOT NULL-constraint-bug **direct** had gevangen, in plaats van het
    uren durende onderzoekstraject dat nu nodig was.
  - Kleine bugfix: de bestaande localStorage-check gaf een false-positive
    "GEEN geldige JSON" voor `*_datum`-keys (die bewust kale datumstrings
    bevatten, geen JSON) — nu correct herkend als verwacht gedrag.
- **Nog niet gebouwd:** automatisch draaien na een update (zoals
  besproken). Vereist een betrouwbaar versienummer-mechanisme in de app
  (bv. `NEXT_PUBLIC_APP_VERSION` env-variabele vergeleken met een
  `localStorage`-waarde) — dat bestaat momenteel niet. De
  "hoe-werkt-het"-pagina toont een hardcoded "v1.8.6", losstaand van het
  README-versienummer; dit moet eerst rechtgetrokken worden voordat
  automatische update-detectie zinvol gebouwd kan worden. Zie Openstaand.

## v2.4.12 — DEFINITIEVE FIX: NOT NULL constraint op activity_session_id
**Root cause van het volledige "geen Coach Call na bibliotheek-training"-
traject (v2.4.6 t/m v2.4.11), eindelijk gevonden en opgelost.**

- **Databasewijziging (uitgevoerd in Supabase SQL Editor, geen code):**
  ```sql
  alter table coach_call_items
  alter column activity_session_id drop not null;
  ```
- **Wat er mis was:** `coach_call_items` is oorspronkelijk ontworpen voor
  uitsluitend Strava-items, met `activity_session_id` als verplichte
  (`NOT NULL`) kolom. Toen v2.4.6 bibliotheek-trainingen dezelfde tabel
  liet gebruiken (met `training_result_id` in plaats van
  `activity_session_id`, dat laatste dus leeg), is het databaseschema zelf
  nooit aangepast. Elke insert vanuit de bibliotheek-tak faalde daardoor
  met Postgres-foutcode `23502` ("null value in column
  activity_session_id... violates not-null constraint") — 100% consistent,
  geen toeval, geen RLS-probleem.
- **Waarom dit zo lang duurde om te vinden:** de fout was van meet af aan
  onzichtbaar. `training/complete/route.ts` had de insert in een
  `try/catch` die alleen logde, en de retry-helper (v2.4.9) checkte het
  `.error`-veld van de Supabase-response niet — Supabase gooit standaard
  geen JS-exception bij een DB-fout. Pas v2.4.11 (expliciete
  `.error`-check + eigen Error met volledige Postgres-details) maakte de
  echte foutmelding zichtbaar in Vercel logs, waarna de oorzaak in één
  oogopslag duidelijk werd.
- **Onderzoekspad ter referentie (voor vergelijkbare toekomstige gevallen):**
  1. v2.4.8 loste een écht ander probleem op (completed/expired call niet
     heropend) — nodig maar niet voldoende
  2. Vercel function trace liet zien dat de POST naar `coach_call_items`
     wél plaatsvond, met 200-status op de hele route
  3. SQL-onderzoek naar RLS-policies (`pg_policies`, `rolbypassrls`) bleek
     achteraf een verkeerd spoor — alle policies waren consistent en
     correct; dit kostte de meeste tijd
  4. Pas expliciete `.error`-logging (v2.4.11) gaf het echte antwoord:
     een constraint-violation, geen RLS-probleem
- **Les voor toekomstige Supabase-debugging:** controleer bij een "stil
  falende" insert altijd eerst of de code het `.error`-veld daadwerkelijk
  checkt, vóórdat er tijd gestoken wordt in RLS/policy-onderzoek. Supabase
  se client-bibliotheek gooit geen exceptions bij databasefouten.
- **Bevestigd werkend:** test via Trainingsbibliotheek (kettlebell, 3 juli
  21:37) — Coach Call verscheen, evaluatie (rating + mood verplicht) kon
  verstuurd worden, AI coach-reactie werd correct gegenereerd.

## v2.4.11 — Fix: retry checkte nooit het .error-veld van Supabase-responses
- `src/app/api/training/complete/route.ts` — root cause van het aanhoudende
  "geen Coach Call na bibliotheek-training"-probleem (ook na v2.4.9/v2.4.10):
  Supabase-queries gooien standaard GEEN JavaScript-exception bij een
  database-fout (RLS-blokkade, constraint-violation, etc.) — ze retourneren
  gewoon `{ data: null, error: {...} }`. De `withRetry()`-helper uit v2.4.9
  checkte dit `.error`-veld nergens, ving alleen echte JS-exceptions
  (netwerkfouten) op. Een mislukte insert werd dus stil als "succesvol"
  behandeld: geen retry, geen log, geen enkele indicatie — precies wat het
  onderzoek deze sessie liet zien (4 van 4 bibliotheek-trainingen misten
  hun coach_call_item, zonder een enkele foutmelding in Vercel logs).
  Fix: `withRetry()` checkt nu expliciet `result.error` en gooit zelf een
  `Error` met de volledige Postgres-foutdetails (code/message/details/hint).
  Dit maakt retry en logging voor het eerst daadwerkelijk functioneel voor
  deze Supabase-call-patronen.
  **Nog open:** de exacte onderliggende oorzaak (waarom de insert faalt —
  RLS, key-configuratie, of iets anders) is nog niet bevestigd. RLS-policies
  op `training_results`, `coach_calls` en `exercise_records` bleken bij
  onderzoek vergelijkbaar met die van `coach_call_items` (allemaal
  `auth.uid() = user_id`), wat de eenvoudige "verkeerde key"-hypothese
  weerlegt aangezien `training_results` wél altijd slaagt. Met deze fix
  live wordt de eerstvolgende mislukking eindelijk met exacte Postgres-
  foutcode gelogd — dat is de volgende stap om de echte oorzaak te vinden.

## v2.4.10 — Build-fix: TypeScript-fout in withRetry-helper (v2.4.9)
- `src/app/api/training/complete/route.ts` — de `withRetry()`-helper uit
  v2.4.9 gaf een Vercel build-fout: `Property 'data' does not exist on
  type 'unknown'`. Oorzaak: de signatuur `fn: () => Promise<T>` liet
  TypeScript het generic type `T` niet correct afleiden, omdat Supabase's
  query builders een `PromiseLike` (thenable) zijn, geen echte `Promise`-
  instantie — daardoor viel `T` terug op `unknown`.
  Fix: signatuur aangepast naar `F extends () => PromiseLike<unknown>` met
  `Promise<Awaited<ReturnType<F>>>` als retourtype. Lokaal geverifieerd met
  `tsc --strict` tegen een gesimuleerde thenable query builder — compileert
  zonder fouten. Functioneel identiek gedrag aan v2.4.9, alleen de types
  gecorrigeerd.

## v2.4.9 — Retry-logica Stap 3 + nieuwe debug-check "Coach Call Integriteit"
- `src/app/api/training/complete/route.ts` — Stap 3 (Coach Call aanmaken/
  heropenen) krijgt nu een retry: bij falen wordt na 400ms één keer
  opnieuw geprobeerd, via een kleine `withRetry()`-helper. Vangt
  kortstondige Supabase pooler-timeouts op (zie v2.4.8 root cause —
  "Warp server error: Thread killed by timeout manager" in Postgres Logs).
  Een structureel probleem faalt ook na de retry en wordt gelogd zoals
  voorheen; dit lost dus specifiek het "eenmalige hik"-scenario op, niet
  een aanhoudende infrastructuurstoring.
- `src/app/debug/page.tsx` — nieuwe diagnostiek-sectie "Coach Call
  Integriteit (laatste 24u)". Vergelijkt alle `training_results` met
  `training_source: 'library'` van de afgelopen 24 uur tegen
  `coach_call_items`, en meldt expliciet welke trainingen geen
  bijbehorend Coach Call-item hebben — dat is precies het probleem dat
  leidde tot deze toevoeging (een training werd opgeslagen, maar het
  Coach Call-item niet, door een tijdelijke Supabase-storing). Voorheen
  was dit alleen op te sporen via Vercel function traces + Supabase
  Postgres Logs (zie sessie juli 2026, coach_call_id 85e5b7d6...). Nu
  zichtbaar met één druk op "Start diagnostiek" in de app zelf, conform
  Kernregel §15 (fouten moeten zichtbaar zijn zonder externe tools).

## v2.4.8 — Fix: bibliotheek-Coach Call onzichtbaar na eerdere afgeronde call
- `src/app/api/training/complete/route.ts` — Stap 3 heropent nu een bestaande
  `coach_call` als die al `completed`/`expired` was, vóórdat het nieuwe item
  wordt toegevoegd. Zelfde root cause en fix als v2.4.3 (`coach-calls/route.ts`),
  hier ontbrak de heropen-logica nog in de bibliotheek-tak.
  Bevestigd via test + Vercel function trace: de POST naar `/api/training/complete`
  gaf 200, `coach_call_items` werd wel degelijk aangemaakt (zichtbaar in de
  external API calls: GET coach_calls → POST coach_call_items), maar de
  bijbehorende `coach_calls`-rij bleef op status `completed` staan van een
  eerder die dag afgeronde evaluatie. `GET /api/coach-calls` filtert op
  `pending`/`partial`, dus de banner op Home verscheen niet — ondanks dat de
  data correct was opgeslagen.
  Reproductiestap die dit aan het licht bracht: Coach Call afronden (bv. via
  Strava), daarna dezelfde dag een training uit de Trainingsbibliotheek
  doorlopen en evalueren — geen nieuwe Coach Call zichtbaar op Home.
  **Vervolgonderzoek (zelfde sessie):** een tweede test, ná deze fix, liet
  alsnog geen Coach Call zien. Onderzoek via Vercel function trace + Supabase
  Postgres Logs bracht de échte oorzaak van dié herhaling aan het licht: een
  kortstondige Supabase-pooler-timeout ("Warp server error: Thread killed by
  timeout manager") liet de `coach_call_items`-insert stil mislukken, terwijl
  de hoofdroute alsnog 200 teruggaf. Dit is geen logicafout in deze fix, maar
  een infrastructuur-timing-probleem — opgelost in v2.4.9 met retry-logica.

## v2.4.7 — Opruiming: dubbele oefening-databron verwijderd

**Wat er weg is:**
- `src/app/oefening/[id]/page.tsx` — verwijderd
- `src/lib/exercises.ts` — verwijderd

**Waarom dit bestond en waarom het weg kon:**
Naast de acht bibliotheekbestanden (`kettlebell-exercises.ts`, `bodyweight-exercises.ts`, etc. — samen 390 oefeningen, bron van waarheid volgens `docs/architecture.md` §2) bestond er een tweede, kleinere, op zichzelf staande oefeningenlijst in `src/lib/exercises.ts` met slechts 5 hardcoded oefeningen (Two Hand Swing, Goblet Squat, Kettlebell Clean, Kettlebell Press, Farmer Carry). Deze gebruikte een ander ID-formaat (`two-hand-swing` i.p.v. `kb-swing`) en een ander veld voor de illustratie (`afbeelding`, volledig pad, i.p.v. `illustratie`, alleen bestandsnaam).

Dit werd gerenderd door `src/app/oefening/[id]/page.tsx`, een apart UitlegScherm dat losstond van het eigenlijke Archief-systeem (`src/app/archief/oefening/[id]/page.tsx`), dat wél uit de acht echte bibliotheken put via `vindOefening()`.

**Onderzoek (deze sessie) — is dit ooit gebruikt?**
Voordat verwijderd werd, is expliciet gecontroleerd of er ergens in de app naar `/oefening/[id]` gelinkt wordt:
- `src/app/archief/page.tsx` — linkt naar `/archief/oefening/${id}` (niet naar `/oefening/`)
- `src/app/training/page.tsx` — alle routes gaan naar `/training/session/[module]` of `/training/recovery/...`
- `src/components/layout/index.tsx` (bottom nav) — alleen `/home`, `/training`, `/progressie`, `/chat`, `/settings`
- `src/app/api/training/today/route.ts` — genereert alleen oefening-**namen** in `segments`, nooit een ID-link naar `/oefening/`
- `src/store/index.ts`, `src/types/index.ts` — geen state of type die naar `exercises.ts` of `/oefening/[id]` verwijst

Conclusie: geen enkele plek in de app linkte naar deze route. Het was dode code, vermoedelijk een eerdere, kleinere implementatie van vóór het Archief-systeem (v2.4.0) die nooit is opgeruimd.

**Impact van de verwijdering:**
- Geen — er was geen actieve link naar deze route, dus er is niets in de UI dat nu een 404 geeft.
- Lost de architectuur-inconsistentie volledig op die eerder alleen was gedocumenteerd (zie v2.4.5-notitie in README, sectie "Bekende architectuur-inconsistentie" — die sectie is nu verwijderd omdat het probleem is opgelost, niet langer alleen gemeld).
- `public/exercises/` blijft ongewijzigd — alle illustraties (legacy PNG én nieuwe WebP) blijven exact zoals ze waren, gekoppeld via de acht bibliotheekbestanden.

**Wat een volgende sessie moet weten:**
Er is nu nog maar **één** manier waarop een gebruiker een losse oefening met uitleg/illustratie te zien krijgt: via het Archief (`/archief` → `/archief/oefening/[id]`), dat leest uit de acht bibliotheekbestanden in `src/lib/`. Er bestaat geen aparte of alternatieve oefeningenlijst meer. Als er ooit weer een `Oefening`-achtig type of `exercises.ts`-achtig bestand opduikt, is dat een nieuwe toevoeging, geen herstel van iets bestaands — behandel dat met dezelfde argwaan (Kernregel: geen dubbele modules) als deze opruiming zelf.

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
