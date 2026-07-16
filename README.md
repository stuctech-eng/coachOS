# CoachOS

> Data-first training engine met AI als uitvoerende coach laag.
> De bibliotheek is altijd de bron van waarheid. AI assembleert alleen.

## Core Architectuurregels

1. **Libraries are the source of truth** — oefeningen komen altijd uit de bibliotheek
2. **AI never creates exercises** — AI verzint geen oefeningen buiten de gefilterde lijst
3. **Filter first, assemble second** — route filtert → AI assembleert
4. **Equipment is a hard constraint** — geen dumbbell in profiel = geen dumbbell oefeningen
5. **Progression is data-driven** — niveau en volume zijn data, geen AI-inschatting
6. **Explanations come from libraries** — uitlegpagina = bibliotheek, AI is fallback
7. **AI provides coaching cues only** — AI geeft één tip per oefening
8. **Trainer Rule** — AI mag UITSLUITEND kiezen uit oefeningen die in een CoachOS-bibliotheek bestaan

📖 Volledige architectuurspec: [docs/architecture.md](docs/architecture.md)
🗺️ Roadmap: [docs/roadmap.md](docs/roadmap.md)
📋 Changelog & beslissingen: [docs/changelog.md](docs/changelog.md)

## Huidige Status — Bibliotheken

| Module | Status | Oefeningen/Modules |
|--------|--------|--------------------|
| Bodyweight | ✅ Volledig | 120 |
| Strength | ✅ Volledig | 100 |
| Kettlebell | ✅ Volledig | 102 |
| Mobility | ✅ Volledig | 20 |
| Recovery | ✅ Volledig | 12 |
| Running drills | ✅ Volledig | 13 |
| Cycling drills | ✅ Volledig | 11 |
| Rowing drills | ✅ Volledig | 12 |
| **Totaal** | | **390** |

## Huidige Status — Systemen

| Systeem | Status |
|---------|--------|
| Optie C Filter Layer | ✅ |
| AI Assembly Layer | ✅ |
| Coaching Cirkel | ✅ |
| Coach Compliance | ✅ |
| Coach Call Systeem (interne + Strava) | ✅ |
| Uitlegpagina Bibliotheek | ✅ |
| Drill Libraries (Running/Rowing/Cycling) | ✅ |
| Mobility Bibliotheek | ✅ |
| Recovery Bibliotheek | ✅ |
| Relaxation Pagina | ✅ |
| Herstelbibliotheek (inklapbaar) | ✅ |
| Progressie Tracking (exercise_records) | ✅ |
| Persoonlijke Records | ✅ |
| Coach Trendanalyse (Fase 3A) | ✅ |
| Coach Rapport op aanvraag (Fase 3B) | ✅ |
| Life-events Module | ✅ |
| Trainer Rule (alle modules) | ✅ |
| Weerbericht (Open-Meteo) | ✅ |
| Archief (354 oefeningen los) | ✅ |
| Exercise Illustraties Systeem | ✅ |
| Countdown + Timer (alle modules) | ✅ |

## Werkinstructies aan Claude — vaste regels deze sessie

Deze regels gelden vanaf nu en altijd, in elke sessie over dit project:

1. **Bestandsverzoeken altijd in een apart copy-blok.** Als Claude een bestand
   nodig heeft, wordt het exacte pad in een losse code-blok gegeven — niet in
   lopende tekst — zodat het direct te kopiëren is.
2. **STOP bij ontbrekende informatie** (Kernregel, zie Start Prompt hieronder)
   — nooit aannemen welk bestand relevant is; zie sectie Troubleshooting voor
   bekende bestand-per-probleemtype lijsten.

---

## Versienummer — één bron van waarheid (vastgelegd juli 2026)

**`package.json` is het enige, leidende versienummer van CoachOS.** Er
bestond lang verwarring doordat drie plekken losstaande nummers toonden
(`package.json` bleef op `1.8.0` steken, `hoe-werkt-het/page.tsx` toonde een
hardcoded `"v1.8.6"`, en README/changelog liepen apart op naar 2.4.x). Dat is
sinds v2.4.14 opgelost:

- **Bij elke wijziging: `package.json`, README en `docs/changelog.md` gaan
  altijd samen omhoog, in dezelfde beweging.** Nooit één van de drie
  vergeten — dat is precies hoe de verwarring ontstond.
- **`src/app/api/version/route.ts`** leest het nummer rechtstreeks uit
  `package.json` en dient als enige runtime-bron voor de app zelf. Andere
  schermen (zoals `hoe-werkt-het/page.tsx`) tonen het versienummer via een
  `fetch('/api/version')`-call — nooit een eigen hardcoded string.
- **Automatische update-detectie:** `src/app/home/page.tsx` vergelijkt bij
  elk bezoek het huidige versienummer met `localStorage`
  (`coachos_laatst_geziene_versie`). Bij een verschil draait een lichte
  gezondheidscheck (kerntabellen + kernroutes, puur lezend) op de
  achtergrond; bij gevonden problemen verschijnt een banner die naar
  `/debug` verwijst voor de volledige diagnose (inclusief de schrijftest
  uit Laag 3, zie sectie hieronder). Dit is de "onderdelen tester die
  waarschuwt als een update de code breekt" die tijdens deze sessie werd
  gevraagd — met de kanttekening dat dit een update **detecteert na
  deploy**, niet **voorkomt vóór** deploy (dat vereist een CI/CD-pipeline,
  die nu niet bestaat).
- **Als je ooit een nieuw versienummer-achtig veld tegenkomt** (een tweede
  `VERSION`-constante, een ander hardcoded getal ergens), behandel dat met
  dezelfde argwaan als de vorige twee dubbele-databron-gevallen deze sessie
  (oefening-databronnen, zie verderop): eerst navragen of het een bewuste
  losse waarde is, niet aannemen dat het hetzelfde hoort te zijn als
  `package.json`.

---

## Gezondheidscheck — Debug Panel (`/debug`)

Sinds v2.4.13 is `/debug` uitgebreid van een kleine diagnostiek naar een
volledige gezondheidscheck, in drie lagen:

| Laag | Wat | Risico | Wanneer |
|------|-----|--------|---------|
| **1 — Tabellen** | Alle 29 tabellen uit het schema, `select id limit 1` | Geen (puur lezend) | Handmatig (`/debug`) én automatisch-licht (Home, subset van 5 tabellen) |
| **2 — Routes** | 17 kern-GET-routes | Geen (puur lezend, geen schrijfroutes aangeroepen) | Handmatig én automatisch-licht (Home, subset van 3 routes) |
| **3 — Schrijftest** | Tijdelijke testrij in `coach_calls`/`coach_call_items`, direct weer opgeruimd | Laag — herkenbaar gemarkeerd (`__SELFTEST__`, datum 1900-01-01), opruiming via `finally`-blok + cleanup van oude testrijen | **Alleen handmatig** via `/debug` — nooit automatisch op de achtergrond |

Laag 3 is bewust beperkt tot `coach_calls`/`coach_call_items` — de twee
tabellen die in juli 2026 daadwerkelijk een probleem gaven (zie Coach Call
Systeem-sectie, v2.4.12). Uitbreiden naar andere tabellen kan, maar vraagt
per tabel eigen zorgvuldige opruim-logica (bijv. foreign-key-afhankelijkheden
checken) — niet in één keer voor alle tabellen doen, dat verhoogt het risico
op precies het soort fout die deze gezondheidscheck juist moet voorkomen.

---

## Illustratie Workflow — WebP vanaf #16

**Besloten (overleg juli 2026, herzien):**

- **Geen Dropbox.** Overwogen als centraal archief, maar afgeschaft — GitHub
  zelf is al een archief (volledige versiegeschiedenis van elk bestand), en
  een extra opslaglaag voegt alleen frictie toe zonder functioneel voordeel
  bij één beheerder die rechtstreeks naar de repo werkt.
- **`public/exercises/` blijft de enige locatie** waaruit de app illustraties
  laadt tijdens runtime. Architectuur ongewijzigd.
- **PNG t/m #15, WebP vanaf #16 (Box Squat).** De eerste 18 kettlebell-
  illustraties (de oorspronkelijke 6 + de 12 die deze sessie zijn gegenereerd
  en al in Working Copy stonden toen WebP werd afgesproken) blijven PNG —
  geen herwerk van reeds voltooide illustraties (Kernregel: geen quick fixes
  die technische schuld verhogen, stabiliteit boven netheid). Alle **nieuwe**
  illustraties vanaf #16 worden WebP.
- Bevestigd zonder enige codewijziging nodig: `src/app/archief/oefening/[id]/page.tsx`
  (de enige plek die illustraties toont, zie sectie "Oefening-databron"
  hieronder) gebruikt een kale `<img src=...>` zonder formaat-afhankelijke
  logica — een `.webp`-bestand werkt daar identiek aan `.png`. iOS Safari
  16.4+ (al vereist, zie §13) ondersteunt WebP volledig.

**Bijgewerkte workflow (vanaf #16):**
```
Claude genereert illustratie-prompt (bestaand sjabloon, ongewijzigd)
    ↓
Genereren via GPT (vaak PNG)
    ↓
Als PNG: Claude converteert naar WebP (PIL/Pillow, quality=90) — vangnet
voor het geval de externe generator geen WebP oplevert, of de bestandsgrootte
boven de 100-300 KB-richtlijn uitkomt
    ↓
Kopiëren naar public/exercises/[naam].webp via Working Copy
    ↓
illustratie-veld koppelen in de betreffende bibliotheek
    ↓
Commit + push → Vercel deploy
```

**Exportvereisten (nieuwe illustraties, vanaf #16):**
- Formaat: WebP (voorkeur), PNG alleen bij noodzakelijke transparantie
- Doelgrootte: ~100-300 KB per illustratie
- Resolutie: 1024×1024px (of hoger), sRGB, geen onnodige metadata
- Scherpe lijnen en professionele uitstraling behouden

---

## Oefening-databron — historie en huidige staat (opgelost v2.4.7)

**Dit is nu de enige waarheid:** de acht bibliotheekbestanden in `src/lib/`
(`kettlebell-exercises.ts`, `bodyweight-exercises.ts`, `strength-exercises.ts`,
`mobility-exercises.ts`, `recovery-exercises.ts`, `running-drills.ts`,
`rowing-drills.ts`, `cycling-drills.ts` — samen 390 oefeningen) zijn de
**enige** bron voor oefeningdata in de hele app. Er bestaat geen alternatieve
of parallelle lijst meer.

**Toegang tot een losse oefening met uitleg/illustratie loopt altijd via:**
```
/archief → /archief/oefening/[id]
```
Bestand: `src/app/archief/oefening/[id]/page.tsx`, functie `vindOefening()`
zoekt op `id` door alle acht bibliotheken heen. Het `illustratie`-veld
(alleen bestandsnaam, bv. `goblet-squat.png` of `sumo-deadlift.webp`) wordt
gecombineerd met `public/exercises/` om het pad te vormen.

**Wat er eerder was en waarom het weg is (context voor toekomstige sessies):**
Tot v2.4.7 bestond er ook `src/lib/exercises.ts` — een kleine, losse lijst
met 5 hardcoded oefeningen en een ander ID-formaat (`two-hand-swing` i.p.v.
`kb-swing`), gerenderd door `src/app/oefening/[id]/page.tsx`. Onderzoek wees
uit dat **niets in de app** naar die route linkte (niet vanuit Archief,
Trainingsbibliotheek, bottom nav, of de Trainer AI-output) — het was dode
code, waarschijnlijk een vroege implementatie van vóór het Archief-systeem
(v2.4.0) die nooit werd opgeruimd. Beide bestanden zijn in v2.4.7 verwijderd.
Zie `docs/changelog.md` v2.4.7 voor het volledige onderzoek dat hieraan
voorafging.

**Als je dit leest als nieuwe sessie:** ga er niet vanuit dat er ooit weer
een aparte `exercises.ts` of `/oefening/[id]`-route nodig is. Als iemand
vraagt om "de oefeningpagina" te wijzigen, is dat vrijwel zeker
`src/app/archief/oefening/[id]/page.tsx` — controleer dat expliciet voordat
je een nieuw bestand aanmaakt, om deze duplicatie niet opnieuw te
introduceren (Kernregel: geen dubbele modules, eerst uitbreiden dan
vervangen).

---

## Nieuwe Claude-sessie starten

Deze repo is openbaar — een nieuwe Claude-sessie kan bestanden
rechtstreeks ophalen van GitHub, zonder handmatige upload:

```
curl -sL -o /home/claude/<naam> "https://raw.githubusercontent.com/stuctech-eng/coachOS/main/<pad-in-repo>"
```

Werkt voor elk bestand (code, `.md`, `.webp`/`.png`), met deze
kanttekeningen:
- Repo moet publiek blijven — anders werkt dit niet meer
- Alleen gecommitte **én** gepushte wijzigingen zijn zichtbaar
- Pad moet kloppen — bij een 404: ander pad proberen, niet per se afwezig
- Geen live-verbinding — elke fetch is een eenmalige snapshot

**Lees bij elke nieuwe sessie eerst:**
1. `README.md` (dit bestand) — actuele status, versiegeschiedenis, openstaand
2. `docs/changelog.md` — volledige wijzigingsgeschiedenis
3. Eventuele andere `docs/*.md` die relevant blijken voor de huidige vraag

**ZIP-naamconventie** bij het leveren van wijzigingen — zie de
uitgebreide regels verderop in dit document.

---

## Specialist Coach Platform — architectuurtraject (Cycling-referentie compleet)

**Status: architectuur ✅, database-ontwerp ✅ (SQL v2.4.59), API/Engine/AI/
Hub-UI ✅ — Cycling-referentie-implementatie volledig afgerond (v2.4.68).**

Uitbreiding van CoachOS van één brede coach naar een platform met
gespecialiseerde coaches (Cycling, Running, Rowing, Strength, ...) onder
één centrale Master Coach.

**Kernbeslissing:** specialisten *adviseren*, de Master Coach *beslist* —
geen losse AI-coaches, één coachervaring voor de gebruiker.

**Ontwerpfase (6 documenten, allemaal afgerond):**
`specialist-coaches.md`, `specialist-database-design.md`,
`specialist-api.md`, `specialist-memory.md`,
`specialist-decision-engine.md`, `specialist-engine-architecture.md`.

**Implementatie — Cycling als referentie-specialist, 5/5 stappen compleet:**
1. ✅ Identity Layer/Registry (`/api/specialists`, v2.4.60)
2. ✅ Data Layer (`/api/specialists/cycling/data`, v2.4.61)
3. ✅ Cycling Analysis Engine (`/api/specialists/cycling/engine`, v2.4.66)
4. ✅ Coach Layer/AI (`/api/specialists/cycling/coach`, v2.4.67)
5. ✅ Capability Registry + Hub-UI (`/coach/cycling`, v2.4.68)

**Bereikbaar via de Coach-tab** (v2.4.69, "Mijn Coaches"-rij) én
rechtstreekse URL `/coach/cycling`.

**Volgende, niet-gestart, buiten de 5-stappen-referentie:**
- Fase 4 — Master Coach Orchestrator-integratie (`api/coach/route.ts`)
- Decision Engine (pas relevant bij 2e actieve specialist)
- Goal Engine, Specialist Memory (apart ontworpen, nog niet gebouwd)
- Running/Rowing/Strength — invuloefening binnen dezelfde architectuur
  zodra gewenst

---

## Openstaand

| Item | Prioriteit |
|------|-----------|
| **🔴 `docs/specialist-api.md` ontbreekt nog in de repo** — nooit daadwerkelijk gecommit, ondanks eerdere levering als zip (v2.4.70-bevinding). Moet zorgvuldig gereconstrueerd worden (bevat Fase 1-4, Capability Registry, Hub-modules, Event sourcing, Analyse-versionering) — niet zomaar opnieuw improviseren, de oorspronkelijke inhoud was al goedgekeurd. | 🔴 |
| **Service worker weer op `skipWaiting: false` gezet (v2.4.65, was volledig `disable: true` in v2.4.63)** — test of het reset-probleem terugkeert nu tests via de bestaande `/debug`-pagina lopen (geen navigatie meer). Root cause nooit 100% bevestigd. Komt het terug: service worker is alsnog (mede)schuldig, dan opnieuw `disable: true` overwegen. | 🟡 |
| **Testen: neemt de coach gewicht/tempo-afwijking (v2.4.51-53) daadwerkelijk mee in zijn geschreven advies?** De data komt gegarandeerd in de prompt terecht (code, geen AI-gok), maar of Sonnet het ook elke keer expliciet benoemt is niet gegarandeerd — instructie staat nu als "je mag dit benoemen" (optioneel), niet dwingend. Test door bewust af te wijken tijdens een kettlebell-training en het volgende coach-advies te checken. Reminder gezet voor 10 juli. Indien coach het niet consistent noemt: instructie in `coach/route.ts` aanscherpen naar een dwingender "je MOET dit noemen als relevant". | 🟡 |
| **Controleer op bestaand duplicaat in `activity_sessions` vóór/na v2.4.28-deploy** (zie changelog) | 🟡 |
| Screenshot-import (v2.4.23/24) heeft nog geen duplicaatcheck — TCX wel sinds v2.4.28 | 🟡 |
| **SQL uitvoeren voor `injuries.ended_at`-kolom vóór v2.4.26 werkt** (zie changelog) | 🔴 Blokkerend |
| **SQL uitvoeren voor `garmin_activity_imports`-tabel vóór v2.4.23 werkt** (zie changelog) | 🔴 Blokkerend |
| GitHub tags aanmaken v2.0.4 t/m v2.4.70 | 🟡 |
| Life-events pagina testen | 🟡 |
| Kettlebell illustraties: 30/102 live (allemaal WebP, gecomprimeerd ~55-71KB), #28 volgende | 🔄 In progress |
| Coach Call: POST-trigger alleen vanaf home-pagina (bekend gedrag, geen bug) | ℹ️ Info |
| Exercise records vullen na eerste training | 🔄 automatisch |

---

# CoachOS - Project Geheugen

## Project
- App naam: CoachOS
- Versie: 2.4.70
- App URL: https://coach-os-tau.vercel.app
- GitHub: https://github.com/stuctech-eng/coachOS
- Stack: Next.js 14.2.29, TypeScript, Supabase, Vercel, Claude API

## Supabase Tabellen (relevant)
- `training_results` — sessielaag (duur, RPE, type)
- `exercise_records` — detaillaag (oefening, gewicht, reps, sets, module) — v2.3.1
- `progress_analyses` — coach rapporten op aanvraag — v2.3.5
- `coach_recommendations` — dagadvies + compliance
- `coach_calls` — evaluatie na training (zie sectie Coach Call Systeem)
- `coach_call_items` — losse activiteiten/trainingen binnen één Coach Call
- `activity_sessions` — Strava/Garmin activiteiten

---

## Strava API-toegang — externe beleidswijziging (juli 2026)

**Dit is geen CoachOS-bug — vastgelegd zodat een volgende sessie hier geen
tijd aan verspilt met code-fixes.**

Strava heeft aangekondigd dat **Standard-tier API-ontwikkelaars** (waar
CoachOS onder valt) per **30 juni 2026** een actief, betaald
Strava-abonnement (~€/$11,99/maand) nodig hebben op het account waarmee de
API-applicatie geregistreerd staat, om de API te mogen blijven gebruiken.
Reden volgens Strava: misbruik door AI-bedrijven die de API/website
scrapen voor trainingsdata.

**Symptoom:** `403`-fout bij elke Strava-sync-poging, **ondanks** een
volledig verse, correcte OAuth-autorisatie met de juiste scope
(`activity:read_all`). Dit onderscheidt het van een normaal token-probleem
— een 403 na een geldige herautorisatie wijst op dit account-niveau-slot,
niet op een scope- of tokenfout.

**Oplossingsrichtingen (geen van beide een code-fix):**
1. Een Strava-abonnement afsluiten op het account achter de API-registratie
2. Overstappen op de nieuwe Garmin-activiteit-import (v2.4.23, zie
   Coach Call Systeem-tabel) als (deels) alternatief — vereist wel een
   handmatige screenshot per activiteit, geen automatische sync

**Zie ook:** `strava.com/settings/api` toont de huidige scope/status van
het *developer-testtoken* — dat is **niet** hetzelfde token als wat
gebruikers via de OAuth-flow krijgen (die staan in `strava_tokens` in onze
eigen database). Verwar deze twee niet bij toekomstig troubleshooten.

---

## Coach Call Systeem

**Wat het is:**
De Coach Call is de evaluatiestap in de Coaching Cirkel (zie `docs/architecture.md` §4). Coach AI wil altijd weten wanneer er getraind is — via Strava, Garmin-activiteit-import, Archief of Trainingsbibliotheek — zodat dit meeweegt in het herstel-/belastingadvies van de volgende dag (zie `coachCallContext` in `src/app/api/coach/route.ts`).

Er zijn drie bronnen die een Coach Call kunnen triggeren, met elk een andere reden (zie tabel):

| Bron | Reden voor Coach Call | Wanneer triggert het? |
|---|---|---|
| **Strava-activiteit** | Enige manier om evaluatiedata (RPE/mood) binnen te krijgen — een Strava-rit heeft zelf geen evaluatiescherm en de belasting telt zonder Coach Call niet mee in de herstel-berekening | Alleen als een drempelwaarde gehaald wordt (zie hieronder). **Sinds 30 juni 2026 vereist Strava-sync een betaald Strava-abonnement op het API-account, zie sectie hieronder.** |
| **Garmin-activiteit-import** (`source: garmin`, onderscheiden via `notes`-prefix `garmin_activity_import:`, sinds v2.4.23/24) | Bewuste, eenmalige handmatige upload — vergelijkbaar met een Trainingsbibliotheek-sessie starten, geen automatische bulk-sync | **Altijd**, ongeacht duur/afstand — zelfde redenering als Archief/Trainingsbibliotheek |
| **Archief / Trainingsbibliotheek** (`training_source: library`) | De evaluatie (RPE, energie, techniek) zit al in de sessie zelf vóór opslag — de Coach Call meldt hier dát er buiten het coach-advies om getraind is | **Altijd**, ongeacht welk advies die dag gold of zelfs als er geen advies was (sinds v2.4.6) |

**Strava-drempelwaarden (hardcoded in `route.ts`, sinds v2.4.6):**
```
Hardlopen: 5km OF 30 min
Fietsen:   20km OF 30 min
Roeien:    5km OF 30 min
```
Afstand **of** duur is voldoende — niet beide tegelijk nodig (vóór v2.4.6 was dit een AND-voorwaarde met 45 min). Reden: in herstelfases is afstand soms niet haalbaar maar duur wel een reëel belastingssignaal. Andere sporttypes (Wandelen, Yoga, Krachttraining, etc.) triggeren geen Coach Call via Strava.

**Betrokken bestanden:**

| Bestand | Rol |
|---------|-----|
| `src/app/api/coach-calls/route.ts` | **Kern (Strava-tak).** `POST` maakt/heropent `coach_calls` + `coach_call_items` op basis van kwalificerende Strava-activiteiten (OR-drempel). `GET` haalt de actieve (pending/partial) call op, inclusief 24u-expiry check. |
| `src/app/api/training/complete/route.ts` | **Kern (bibliotheek-tak).** Stap 3 maakt altijd een Coach Call aan bij `training_source: 'library'`, ongeacht coach-advies (sinds v2.4.6), heropent completed/expired calls (v2.4.8), met retry op de insert (v2.4.9). Slaat ook `training_results` en `exercise_records` op. |
| `src/app/api/coach-calls/rate/route.ts` | Verwerkt de evaluatie (rating/mood/notes) per item, genereert een AI coach-reactie per item, herberekent de call-status (pending → partial → completed). |
| `src/app/home/page.tsx` | Roept bij laden `POST` aan (Strava-trigger), daarna `GET` (ophalen), en toont de Coach Call-banner als `pending_count > 0`. **Belangrijk:** de Strava-trigger draait dus alleen als de home-pagina geladen wordt. |
| `src/app/coach-call/page.tsx` | De evaluatiepagina zelf waar de gebruiker rating/mood/notities invult. |
| `src/app/activities/page.tsx` | Toont Strava/Garmin-activiteiten; bron van de data die `coach-calls/route.ts` filtert. |
| `src/lib/strava-activity-processor.ts` | Verwerkt de ruwe Strava-sync naar `activity_sessions` (sporttype-mapping, metrics). Draait vóór de Coach Call-logica, niet erin. |
| `src/app/settings/hoe-werkt-het/page.tsx` | In-app uitleg voor de gebruiker (sectie "Coach Call") — houd dit synchroon met wijzigingen aan de trigger-logica. |
| `src/app/debug/page.tsx` | Bevat sinds v2.4.9 de sectie "Coach Call Integriteit" — vergelijkt recente `training_results` (library-bron) tegen `coach_call_items` en meldt ontbrekende koppelingen. Eerste stap bij een "geen Coach Call"-melding: laat de gebruiker hier "Start diagnostiek" draaien. |

**Statusmachine van een `coach_call`:**
`pending` → (items deels beoordeeld) → `partial` → (alle items beoordeeld) → `completed`
Een call die 24 uur oud is zonder voltooiing wordt automatisch `expired`.

**Bekende fixes:**
- **v2.4.3:** als er op een datum al een `completed`/`expired` call bestond en er kwam een nieuwe kwalificerende Strava-activiteit bij, bleef die call onzichtbaar (GET filtert op `pending`/`partial`). De `POST`-route (`coach-calls/route.ts`) heropent zo'n call nu automatisch.
- **v2.4.6:** de bibliotheek-tak (`training/complete/route.ts`) triggerde voorheen alleen een Coach Call als het coach-advies die dag `herstel` of `rust` was. Dat miste gevallen zonder advies of met advies `trainen`. Nu triggert elke Archief/Trainingsbibliotheek-training altijd een Coach Call. Tegelijk is de Strava-drempel verruimd naar OR-logica (afstand of duur) met 30 min i.p.v. 45 min.
- **v2.4.8:** dezelfde "onzichtbaar na completed/expired"-bug als v2.4.3, maar dan in de bibliotheek-tak — `training/complete/route.ts` had de heropen-logica nog niet.
- **v2.4.9-v2.4.11:** een reeks pogingen om een aanhoudend "geen Coach Call na bibliotheek-training"-probleem op te lossen. v2.4.9 vermoedde een kortstondige Supabase pooler-timeout en voegde retry-logica toe — **dit was een verkeerd spoor**, de timeout in de Postgres Logs bleek een eenmalig, ongerelateerd voorval. v2.4.11 bracht de echte doorbraak: de retry-logica checkte nooit het `.error`-veld van Supabase-responses (Supabase gooit geen JS-exception bij een DB-fout), waardoor de werkelijke foutmelding nooit gelogd werd. Zodra dat gefixt was, bleek de oorzaak in één test duidelijk (zie v2.4.12).
- **v2.4.12 — DEFINITIEVE FIX:** `coach_call_items.activity_session_id` had een `NOT NULL`-constraint uit de tijd dat deze tabel alleen voor Strava-items bestond. Bibliotheek-trainingen vullen die kolom nooit (ze gebruiken `training_result_id`), dus elke insert vanuit de bibliotheek-tak faalde met Postgres-foutcode `23502`. Opgelost met `alter table coach_call_items alter column activity_session_id drop not null;` in Supabase SQL Editor — geen codewijziging nodig. **Les:** bij een stil falende Supabase-insert altijd eerst checken of `.error` daadwerkelijk gelogd wordt, vóór tijd te steken in RLS/policy-onderzoek.

**Databaseschema — belangrijk voor toekomstige wijzigingen:**
`coach_call_items` bedient nu twee verschillende bronnen met verschillende
verplichte velden:
- Strava-items: `activity_session_id` ingevuld, `training_result_id` NULL
- Bibliotheek-items (Archief/Trainingsbibliotheek): `training_result_id`
  ingevuld, `activity_session_id` NULL
Beide kolommen zijn dus terecht **nullable** (sinds v2.4.12) — dat is geen
datakwaliteitsprobleem, maar een bewuste consequentie van één tabel die
twee brontypes bedient. Voeg bij een nieuwe Coach Call-bron altijd expliciet
een `CHECK`- of applicatie-validatie toe die garandeert dat minstens één
van de twee kolommen gevuld is, in plaats van te vertrouwen op `NOT NULL`
op één specifieke kolom.

**Bekend gedrag (geen bug):** de Strava-`POST`-trigger draait alleen wanneer `home/page.tsx` geladen wordt. Na een Strava-sync moet de gebruiker dus naar de home-pagina navigeren voordat een nieuwe Coach Call verschijnt.

---

## Troubleshooting — bestanden per probleemtype

Bij een bugmelding vraagt een nieuwe sessie STOP (punt 1, Kernregels) om het
juiste bestand, in plaats van te gokken. Onderstaande lijst versnelt dat:
plak het genoemde kopy-blok zodra het probleemtype herkenbaar is.

### "Genereer advies" / Coach dagadvies werkt niet, hangt, of blijft spinnen
```
src/app/api/coach/route.ts
src/hooks/useCoach.ts
src/app/api/weather/route.ts
```
Bekend risico (opgelost in v2.4.4, maar relevant bij vergelijkbare klachten):
externe fetches zonder timeout (Open-Meteo, ipapi.co, of andere derde
partijen) kunnen de hele serverless function laten vastlopen tot de
platform-timeout — dat verschijnt als een onafgevangen 500, ook al staat er
een `.catch()` in de code. Vraag bij twijfel ook om de Vercel Logs-screenshot
(rode 500-regels, tijdstip + volledig pad) en, indien beschikbaar, de
uitgeklapte error-tekst.

### Coach Call (Strava of bibliotheek-training) verschijnt niet
**Eerste stap, vóórdat je bestanden opvraagt:** vraag de gebruiker "Start
diagnostiek" te draaien op `/debug` en te kijken naar de sectie "Coach Call
Integriteit (laatste 24u)". Die check (sinds v2.4.9) vergelijkt recente
bibliotheek-trainingen met hun Coach Call-item en meldt direct een mismatch
— dat scheelt het hele traject van Vercel-logs + Supabase Postgres Logs
doorzoeken dat nodig was om deze check te bouwen.
```
src/app/api/coach-calls/route.ts
src/app/api/training/complete/route.ts
src/app/api/coach-calls/rate/route.ts
src/app/home/page.tsx
src/lib/strava-activity-processor.ts
src/app/debug/page.tsx
```
Let op onderscheid: `/api/coach` (enkelvoud) = dagelijks coach-advies.
`/api/coach-calls` (meervoud) = evaluatie van trainingen/activiteiten. Dit
zijn twee losse routes met eigen bugs — niet aannemen dat een fix in de één
de ander raakt.

**Bekend patroon (v2.4.8/v2.4.9):** als een `training_results`-rij wél
bestaat maar het bijbehorende `coach_call_item` niet, controleer eerst
Supabase → Logs → Postgres Logs op "Warp server error: Thread killed by
timeout manager" rond het tijdstip van de training. Dat is een kortstondige
infrastructuur-timeout, geen logicafout — de retry in Stap 3 zou dit sinds
v2.4.9 grotendeels moeten opvangen, maar bij herhaling is een hogere
Supabase compute-tier het te onderzoeken vervolgspoor.

### Exercise illustraties tonen niet in UitlegScherm
```
src/lib/kettlebell-exercises.ts (of de betreffende bibliotheek)
```
Check: staat `illustratie: '[bestandsnaam].png'` op de juiste entry, en staat
het bestand daadwerkelijk in `public/exercises/`?

### Training-sessie / Trainer AI kiest verkeerde of geen oefeningen
```
src/app/api/training/today/route.ts
src/lib/[betreffende]-exercises.ts
```

### Progressie / exercise_records tonen niet correct
```
src/app/progressie/page.tsx
src/app/api/training/complete/route.ts
```

### Navigatie/terugknop gedraagt zich vreemd (swipe-terug, verkeerde bestemming)
```
[betreffende page.tsx bestand]
```
**Bekend patroon (v2.4.17):** zoek naar `router.push('/...')` op plekken die
bedoeld zijn als "terug"-navigatie (bijv. een terugknop, of een automatische
redirect na het voltooien van een actie). `push` voegt altijd een NIEUWE
entry toe aan de browsergeschiedenis — bij herhaald gebruik (bijv. meerdere
keren een detail-pagina bekijken en terugkeren) stapelen zich duplicaten op.
Dat is onzichtbaar in de UI zelf (de in-app knop lijkt te werken), maar
swipe-terug (iOS systeem-navigatie, buiten React's routing om) volgt de
werkelijke, vervuilde geschiedenis-stack — wat zich uit als: meerdere stappen
tegelijk terug, "hangen en terugspringen", of uitkomen op een oude,
ongerelateerde pagina.
**Fix-patroon:** gebruik `router.back()` voor knoppen die simpelweg "één
stap terug" moeten doen, en `router.replace()` (niet `push()`) voor
automatische redirects na het voltooien van een flow (voorkomt dat de
gebruiker per ongeluk terugkomt op een net-afgeronde actie).

**Let op — ander probleem met hetzelfde symptoom, definitief opgelost in
v2.4.20:** "terugknop gaat niet goed" kan ook betekenen dat de navigatie
zelf correct is (juiste pagina), maar de **scrollpositie** reset naar
boven. **Controleer eerst welk element daadwerkelijk scrolt** — in
CoachOS is dat het `<main>`-element binnen `AppShell`
(`src/components/layout/index.tsx`, class `scroll-area`), NIET `window`
(de buitenste wrapper heeft `overflow-hidden`). Browser- en Next.js-
scrollherstel werken alleen op `window.scrollTo` en hebben dus **geen**
effect op dit soort binnenste scroll-containers, ongeacht `push`/`back`/
`replace` of synchrone/asynchrone data-loading.
**Fix-patroon (al geïmplementeerd sinds v2.4.20):** `AppShell` bewaart de
`scrollTop` van het `<main>`-element in `sessionStorage`, per pathname, en
herstelt die bij hermount. Dit werkt app-breed. Als een scroll-probleem
zich toch weer voordoet, check eerst of deze `AppShell`-logica nog intact
is vóór je een nieuwe fix bouwt.

### Algemeen (bij twijfel over welk bestand)
Vraag altijd eerst om:
1. Het Debug Panel (`/debug`) — zie punt 15, architectuurregel
2. Vercel Logs (rode 500-regels, uitgeklapt voor volledig pad + error-tekst)
3. Het exacte symptoom: hangt het, geeft het een foutmelding, of gebeurt er
   zichtbaar niets?

---

## Exercise Illustraties — Voortgang

Mannequin-stijl illustraties per oefening, gegenereerd via GPT, opgeslagen in
`public/exercises/[id].png` (t/m #15) of `.webp` (vanaf #16). Gekoppeld via
`illustratie` veld op de BibliotheekOefening interfaces. Eerste categorie:
Kettlebell (102 oefeningen).

Volgorde: array-volgorde in `src/lib/kettlebell-exercises.ts`, met reeds
voltooide oefeningen overgeslagen (niet chronologisch op array-index).
Zie sectie "Illustratie Workflow" voor de PNG→WebP-knip vanaf #16.

| Oefening | Status |
|----------|--------|
| Kettlebell Deadlift | ✅ Live (PNG) |
| Sumo Deadlift | ✅ Live (PNG) |
| Single Arm Deadlift | ✅ Live (PNG) |
| Romanian Deadlift | ✅ Live (PNG) |
| Staggered Stance Deadlift | ✅ Live (PNG) |
| Kettlebell Swing | ✅ Live (PNG) |
| Russian Swing | ✅ Live (PNG) |
| American Swing | ✅ Live (PNG) |
| One Arm Swing | ✅ Live (PNG) |
| Hand-to-Hand Swing | ✅ Live (PNG) |
| Double Swing | ✅ Live (PNG) |
| Alternating Swing | ✅ Live (PNG) |
| Goblet Squat | ✅ Live (PNG) |
| Front Squat | ✅ Live (PNG) |
| Double Front Squat | ✅ Live (PNG) |
| Strict Press | ✅ Live (PNG) |
| Clean | ✅ Live (PNG) |
| Farmer Carry | ✅ Live (PNG) |
| Box Squat | ✅ Live (WebP) |
| Tempo Goblet Squat | ✅ Live (WebP) |
| Pause Squat | ✅ Live (WebP) |
| Split Squat | ✅ Live (WebP) |
| Bulgaarse Split Squat | ✅ Live (WebP) |
| Reverse Lunge | ✅ Live (WebP) |
| Forward Lunge | ✅ Live (WebP) |
| Walking Lunge | ✅ Live (WebP) |
| Lateral Lunge | ✅ Live (WebP) |
| Cossack Squat | ✅ Live (WebP) |
| Thruster | ✅ Live (WebP) |
| Push Press | ✅ Live (WebP) |
| Strict Press | 🔄 Volgende (#28, WebP) — eerdere sessie-aanname dat dit al gekoppeld was, klopte niet, gecontroleerd en gecorrigeerd |

**Volgende:** vraag "volgende" voor de eerstvolgende oefening zonder illustratie
(array-volgorde in `kettlebell-exercises.ts`, reeds voltooide overgeslagen).
Prompt-sjabloon (stijl, layout, kwaliteitseisen) blijft hetzelfde — alleen
oefeningnaam, 5 fasenamen en bestandsformaat (WebP vanaf #16) wijzigen per
oefening.

## Bibliotheek Totaal
- Bodyweight: 120 oefeningen (`src/lib/bodyweight-exercises.ts`)
- Strength: 100 oefeningen (`src/lib/strength-exercises.ts`)
- Kettlebell: 102 oefeningen (`src/lib/kettlebell-exercises.ts`)
- Mobility: 20 oefeningen (`src/lib/mobility-exercises.ts`)
- Recovery: 12 modules (`src/lib/recovery-exercises.ts`)
- Running drills: 13 (`src/lib/running-drills.ts`)
- Rowing drills: 12 (`src/lib/rowing-drills.ts`)
- Cycling drills: 11 (`src/lib/cycling-drills.ts`)
- **Totaal: 390 modules**

## Architectuur Flow
```
Coach (bepaalt doel + beperkingen)
    ↓
Bibliotheek (levert beschikbare oefeningen)
    ↓
Trainer AI (assembleert beste sessie uit bibliotheek)
    ↓
Workout (wordt uitgevoerd)
    ↓
Evaluatie (RPE + mood → exercise_records)
    ↓
Coach (leert van data → past advies aan)
```

## Versiehistorie (recent)
- v2.4.70 — Specialist Lifecycle Engine (SUGGESTED/DORMANT/RETURNING-banners) + herstel ontbrekend specialist-memory.md (v3, Maturity Engine toegevoegd)
- v2.4.69 — Navigatie-integratie: "Mijn Coaches"-rij in de Coach-tab, /coach/cycling nu bereikbaar zonder handmatige URL
- v2.4.68 — Capability Registry + Cycling Hub-UI (Cycling-referentie, stap 5/5, LAATSTE STAP — referentie-implementatie compleet)
- v2.4.67 — Fase 3 Cycling Coach Layer, eerste AI-call (Cycling-referentie, stap 4/5), personality volledig hergebruikt
- v2.4.66 — Fase 2b Cycling Analysis Engine (Cycling-referentie, stap 3/5), volledig deterministisch
- v2.4.65 — Specialistlaag-tests verplaatst naar bestaande /debug-pagina (AppShell, geen navigatie-problemen), losse pagina overbodig
- v2.4.64 — Testpagina herbouwd: ingebouwd inlogformulier, geen navigatie meer (isoleert of navigatie zelf de trigger was)
- v2.4.63 — Service worker TIJDELIJK volledig uitgeschakeld (disable: true) — v2.4.62 loste het probleem niet volledig op
- v2.4.62 — Fix: pagina reset zichzelf willekeurig (skipWaiting: true → false in service-worker-config)
- v2.4.61 — Fase 2a Data Layer (Cycling-referentie, stap 2/5)
- v2.4.60 — Fase 1 Specialist Registry (Cycling-referentie, stap 1/5) + tijdelijk testschermpje
- v2.4.59 — SQL: specialist_profiles + specialist_analyses (eerste code van het specialistlaag-traject)
- v2.4.58 — 6 nieuwe illustraties (#22-27) + alle 24 bestaande retroactief gecomprimeerd (23,5MB → 1,5MB)
- v2.4.57 — Gewicht nu ook live bijstelbaar tijdens de actieve set (was alleen tempo, v2.4.56)
- v2.4.56 — Tempo-keuze (Slow/Normaal/Fast) nu ook in Archief, consistent met Trainer AI/Bibliotheek
- v2.4.55 — NIEUW: "Ververs schema"-knop, doorbreekt dubbele (server+client) cache
- v2.4.54 — Gewicht + tempo nu ook instelbaar in trainingsoverzicht (vóór starten), plus highlight-consistentie-fix
- v2.4.53 — Tempo-afwijking nu ook zichtbaar voor coach (vereist 2 nieuwe kolommen)
- v2.4.52 — Fix: gewicht-advies-bug in exercise_records + coach geeft nu commentaar op afwijking (vereist nieuwe kolom)
- v2.4.51 — NIEUW: Coach adviseert kettlebell-gewicht + tempo, gebruiker kan afwijken (advies + gebruikt naar coach)
- v2.4.50 — Tempo (Slow/Normaal/Fast) nu meegestuurd naar coach bij Trainer AI/Bibliotheek
- v2.4.49 — Kettlebell-gewichten uitgebreid: 14-16-20 → 14-16-20-24-28-32 (3-koloms grid)
- v2.4.48 — Fix: Slow/Normaal/Fast-tempoknoppen leken niet te reageren (visuele highlight-bug)
- v2.4.47 — Build-fix: SessionStatus-type-fout in Finish Tone-effect
- v2.4.46 — Professionele soundset (Polar/Garmin-stijl) + nieuwe Finish Tone bij volledige training-afronding
- v2.4.45 — Fix: eindsignaal ontbrak bij Trainer AI/Bibliotheek (geluid nu via losse useEffect i.p.v. in setState-updater)
- v2.4.44 — TCX-bestand nu links en standaard geselecteerd bij Garmin-activiteit-import
- v2.4.43 — Activiteiten in bottom-nav (6e tab, horizontaal scrollbaar) + Strava-consolidatie naar /activities
- v2.4.42 — TCX-import overschrijft nu i.p.v. te weigeren bij duplicaat (geen nieuwe Coach Call)
- v2.4.41 — NIEUW: Route-kaart bij activiteiten (Leaflet + OpenStreetMap), nieuwe detailpagina /activities/[id]
- v2.4.40 — Consolidatie: 3 importwegen → 1, kapotte oude GPX/TCX-route (lap-bug) verwijderd
- v2.4.39 — Snelheid, cadans en watts nu ook zichtbaar op Activiteiten-kaartjes
- v2.4.38 — Bekijk activiteiten-knop bij Garmin-import + hoogtemeters-veldnaam-fix
- v2.4.37 — TCX-import: extra velden (max cadans/watts/snelheid, hoogtemeters) voor rijkere coach-analyses
- v2.4.36 — Fix: Garmin-activiteit-import-pagina kon niet scrollen (geen AppShell, geen eigen scroll-container)
- v2.4.35 — Fix: TCX-import gaf 413 bij lange activiteiten (parsen nu client-side, geen payload-limiet meer)
- v2.4.34 — NIEUW: Audio (Tick/Eindsignaal/Starttoon) voor beide trainingssystemen, gedeelde workout-sound.ts
- v2.4.33 — Kleurprincipe consistent: Trainer AI/Bibliotheek volgt nu hetzelfde rood-principe als Archief
- v2.4.32 — Fix: pauze in Archief bevroor het cijfer niet (weergave-bug sinds v2.4.30)
- v2.4.31 — Fix: Archief-timer werd niet rood bij laatste 3 seconden (rust/countdown)
- v2.4.30 — Workout Engine REBUILD ook toegepast op Archief (eigen flowregels: 5s alleen 1e set, dan direct door)
- v2.4.29 — Workout Engine REBUILD Fase 1+2: drift-vrije timer-engine + vereenvoudigde flow (geen sound nog)
- v2.4.28 — Fix: idempotency-check toegevoegd aan TCX-import (voorkomt duplicaten)
- v2.4.27 — Build-fix: ongeldige export verwijderd uit garmin-activity-tcx/route.ts
- v2.4.26 — NIEUW: Blessures-archief met volledige historie (vereist nieuwe kolom, zie changelog)
- v2.4.25 — NIEUW: TCX-import (bewezen sportherkenning) gecombineerd met screenshot in één pagina
- v2.4.24 — Fix: Garmin-activiteit-import faalde op check constraint (source-waarde gecorrigeerd)
- v2.4.23 — NIEUW: Garmin-activiteit-import als alternatief voor Strava (vereist nieuwe tabel, zie changelog)
- v2.4.22 — REBUILD: Strava sync timeout + duidelijke feedback, v1.8.5 versienummer gefixt
- v2.4.21 — Verfijning: Training blijft bovenaan vanuit Home, herstelt scroll vanuit Archief
- v2.4.20 — DEFINITIEVE FIX: scrollpositie-herstel in AppShell zelf (v2.4.19 loste het verkeerde probleem op)
- v2.4.19 — Fix: scroll-positie reset bij terugkeer naar Training (INCORRECTE analyse, zie v2.4.20)
- v2.4.18 — Navigatie-fix uitgebreid: Archief-overzicht + Trainingsbibliotheek-sessie (3 extra plekken)
- v2.4.17 — Fix: navigatie Archief-oefening bouwde dubbele geschiedenis op (router.back/replace i.p.v. push)
- v2.4.16 — Illustratie-koppeling: 6 nieuwe WebP-oefeningen (#16-21), totaal 24/102
- v2.4.15 — Fix: coach-geheugen/patroonherkenning werkte nooit (userId nu meegegeven aan /api/memory)
- v2.4.14 — Eén versienummer (package.json leidend) + automatische update-detectie met lichte gezondheidscheck op Home
- v2.4.13 — Debug Panel uitgebreid tot volledige gezondheidscheck (29 tabellen, 17 routes, schrijftest)
- v2.4.12 — DEFINITIEVE FIX: NOT NULL constraint activity_session_id opgeheven (SQL, geen code) — hele Coach Call-traject afgesloten
- v2.4.11 — Fix: retry checkte nooit het .error-veld — echte Postgres-foutmelding nu zichtbaar in logs
- v2.4.10 — Build-fix: TypeScript-fout in withRetry-helper (v2.4.9 deployde niet)
- v2.4.9 — Retry-logica Stap 3 + nieuwe debug-check "Coach Call Integriteit"
- v2.4.8 — Fix: bibliotheek-Coach Call onzichtbaar na eerdere afgeronde call (zelfde bug als v2.4.3, andere tak) + gevonden root cause Supabase pooler-timeout
- v2.4.7 — Opruiming: dubbele oefening-databron verwijderd (exercises.ts + oefening/[id]/page.tsx)
- v2.4.6 — Coach Call: OR-drempel Strava (30 min of afstand) + altijd triggeren bij bibliotheek-training
- v2.4.5 — Illustratie-koppeling 12 kettlebell-oefeningen + Dropbox afgeschaft, WebP vanaf #16
- v2.4.4 — Fix: "Genereer advies" hangt bij trage/onbereikbare Open-Meteo (timeout toegevoegd)
- v2.4.3 — Fix: Strava Coach Call niet zichtbaar na voltooide call (zie sectie Coach Call Systeem + changelog)
- v2.4.2 — Timer + countdown fix Archief losse-oefening flow
- v2.4.1 — Archief standalone losse oefening flow
- v2.4.0 — Exercise Illustraties + Archief
- v2.3.6 — Weerbericht
- v2.3.5 — Coach Rapport op aanvraag (Fase 3B)
- v2.3.4 — Coach Trendanalyse Fase 3A
- v2.3.3 — Progressie Fase 2
- v2.3.2 — Persoonlijke Records
- v2.3.1 — Exercise Records
- v2.3.0 — Drill Libraries Running/Rowing/Cycling
- v2.2.2 — Scroll en navigatie fixes
- v2.2.1 — Relaxation pagina + categorische herstelbibliotheek
- v2.2.0 — Recovery Bibliotheek
- v2.1.2 — Alle mobility schemas in herstelbibliotheek
- v2.1.1 — Mobility filter in route
- v2.1.0 — Mobility Bibliotheek
- v2.0.4 — Mobility bug fix

Volledige details per versie: zie [docs/changelog.md](docs/changelog.md)

## Coach-routes — geverifieerde architectuur
Alle filters actief in `src/app/api/training/today/route.ts`:
- filterKettlebell() → kettlebellContext
- filterStrength() → strengthContext
- filterOpCoachDoel() → bodyweightContext
- filterMobility() → mobilityContext
- filterRecovery() → recoveryContext
- filterRunning() → runningContext
- filterRowing() → rowingContext
- filterCycling() → cyclingContext

Trainer AI mag ALLEEN kiezen uit de gefilterde lijst.

---

## Start Prompt — MASTER SYSTEM v7.3

Je bent een senior software engineer, software architect, systems designer en iPhone-first applicatiespecialist.

Dit systeem is volledig ontworpen voor iPhone-first ontwikkeling. Desktop-workflows zijn optioneel en nooit verplicht.

**Kernregels:**
- Geen aannames, geen gokken, geen verzonnen bestanden/API's/routes
- Ontbrekende informatie → STOP, stel exact één gerichte vraag
- Nooit implementeren vóór analyse, tenzij expliciet gevraagd
- Stabiliteit boven snelheid
- Bestaande functionaliteit beschermen
- Eerst uitbreiden, daarna vervangen

**Volgorde van waarheid:**
1. README.md
2. docs/architecture.md
3. docs/roadmap.md
4. docs/changelog.md
5. Bestaande broncode

**Implementatieregels:**
- Volledige bestanden, geen gedeeltelijke implementaties
- Bestaande stijl en naamgeving behouden
- Geen dubbele code, geen dode code, geen placeholders
- ZIP naam: volgt het formaat `<project-slug>-<type>.zip` (project-slug =
  `coachos`, altijd kleine letters, geen spaties/streepjes-varianten)

  **Type-opties:**
  - `fix` / `hotfix` / `patch` → kleine correctie (geen auto-tag)
  - `update` / `feature` / `refactor` → grote wijziging (auto-tag)
  - `docs` / `config` → documentatie/configuratie (geen auto-tag)

  **Illustraties/assets vallen onder `update` of `feature`, geen apart
  "assets"-type** — bijvoorbeeld:
  - `coachos-update.zip` → een paar nieuwe illustraties toevoegen aan `public/`
  - `coachos-feature.zip` → grote hoeveelheid nieuwe assets als onderdeel
    van een feature

  **Ongeacht het type bestand:** naam begint altijd met de exacte
  project-slug, paden in de ZIP beginnen bij de repo root (dus
  `public/exercises/naam.webp`, niet `coachos/public/exercises/naam.webp`
  en niet met een omvattende prefix-map), geen spaties/hoofdletters in de
  bestandsnaam zelf.
- Paden beginnen bij repo root: `src/app/page.tsx` niet `coachOS/src/app/page.tsx`

**iPhone-first workflow:**
- iPhone + Working Copy + GitHub + Vercel + Supabase
- Oplossingen uitvoerbaar vanaf iPhone
- Git-oplossingen compatibel met Working Copy
- Deployments geschikt voor Vercel

**Beslissingsprioriteit:** Stabiliteit → Architectuur → Onderhoudbaarheid → Schaalbaarheid → Prestaties → Functionaliteit → Snelheid

---

## Illustratie Prompt Sjabloon

Voor het genereren van oefening-illustraties via GPT. Vaste tekst — pas alleen **[OEFENINGNAAM]** en de **5 fasen** aan per oefening.

---

Maak een spritesheet-afbeelding voor een trainingsapp die de oefening **[OEFENINGNAAM]** uitlegt in 5 stappen, naast elkaar in één afbeelding.

**Stijl:**
- Mannequinpop / 3D-skeletfiguur stijl: ovaal hoofd, ronde gewrichtsbollen, dikke cilindrische ledematen met zachte gradient-belichting (licht-naar-donker) voor een ruimtelijk, "draaibaar 3D-model" effect
- Lichte, neutrale achtergrond (wit of zeer lichtgrijs, geen scène of decor)
- Donkere lijnkleur voor de contouren (slate/navy, geen zwart)
- Subtiele slagschaduw onder de voeten van elke pose
- Een groene gestippelde lijn die de hoofd-naar-schouder houding aangeeft
- Het gewicht (kettlebell/dumbbell) duidelijk zichtbaar in de juiste positie per stap, donkergrijs/zwart metaal kleur

**Layout:**
- 5 poses naast elkaar in een horizontale rij, gelijke afstand
- Onder elke pose: een nummer (1-5) en een korte titel (max 2 woorden)
- Geen extra decoratie, geen logo's, geen tekst behalve stapnummers en titels
- Consistente schaal en oriëntatie — zelfde personage, zijaanzicht

**Functioneel:**
- De 5 poses moeten de daadwerkelijke beweging duidelijk laten zien
- Zichtbare verandering in gewrichtshoeken tussen elke stap
- Geen anatomische fouten, realistische proporties

**De 5 fasen zijn:** [FASE 1 — FASE 2 — FASE 3 — FASE 4 — FASE 5]

**Bestandsnaam:** `[oefening-id].webp`
**Bestandsformaat:** WebP (voorkeur), witte achtergrond, minimaal 1200px breed.
Levert GPT een PNG op (gebruikelijk): Claude converteert deze naar WebP
(PIL/Pillow, quality=90) vóór levering — geen aparte vraag nodig, dit is
een vaste stap in de workflow (zie sectie "Illustratie Workflow" hierboven).

---

Bestandsnaam-conventie: `[oefening-id].png` in `/public/exercises/`.
Naamgeving: kebab-case van de oefeningnaam, **zonder** `kb-` prefix en zonder
categorie-prefix (bijv. "Sumo Deadlift" → `sumo-deadlift.png`). De eerste vier
bestanden (`kettlebell-deadlift.png`, `kettlebell-swing.png`,
`kettlebell-press.png`, `kettlebell-clean.png`) zijn legacy-namen van vóór
deze conventie — die blijven ongewijzigd.

Voorbeeld: Kettlebell Swing → `kettlebell-swing.png` (legacy)
Voorbeeld: Sumo Deadlift → `sumo-deadlift.png` (huidige conventie)
