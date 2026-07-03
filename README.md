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

## Openstaand

| Item | Prioriteit |
|------|-----------|
| GitHub tags aanmaken v2.0.4 t/m v2.4.3 | 🟡 |
| Life-events pagina testen | 🟡 |
| Kettlebell illustraties uitrollen (prompts klaar t/m #15, uploaden loopt) | 🔄 In progress |
| Kettlebell gewicht uitbreiden naar 32kg | 🟡 |
| Coach Call: POST-trigger alleen vanaf home-pagina (bekend gedrag, geen bug) | ℹ️ Info |
| Exercise records vullen na eerste training | 🔄 automatisch |

---

# CoachOS - Project Geheugen

## Project
- App naam: CoachOS
- Versie: 2.4.4
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

## Coach Call Systeem

**Wat het is:**
De Coach Call is de evaluatiestap in de Coaching Cirkel (zie `docs/architecture.md` §4). Na een training of Strava-activiteit vraagt de app de gebruiker om een korte evaluatie (RPE + mood + notitie). Op basis daarvan genereert de coach een persoonlijke reactie, en die evaluatie stroomt terug in het dagadvies van de coach (zie `coachCallContext` in `src/app/api/coach/route.ts`).

Er zijn twee bronnen die een Coach Call kunnen triggeren:
1. **Interne bibliotheek-training** (`training_source: library`) — bijvoorbeeld een losse Archief-oefening (v2.4.1)
2. **Strava-activiteit** — alleen als de activiteit een drempelwaarde haalt (zie hieronder)

**Strava-drempelwaarden (hardcoded in `route.ts`):**
```
Hardlopen: 5km + 45 min
Fietsen:   20km + 45 min
Roeien:    5km + 45 min
```
Beide voorwaarden (afstand ÉN duur) moeten gehaald worden. Andere sporttypes (Wandelen, Yoga, Krachttraining, etc.) triggeren geen Coach Call via Strava.

**Betrokken bestanden:**

| Bestand | Rol |
|---------|-----|
| `src/app/api/coach-calls/route.ts` | **Kern.** `POST` maakt/heropent `coach_calls` + `coach_call_items` op basis van kwalificerende Strava-activiteiten. `GET` haalt de actieve (pending/partial) call op, inclusief 24u-expiry check. |
| `src/app/api/coach-calls/rate/route.ts` | Verwerkt de evaluatie (rating/mood/notes) per item, genereert een AI coach-reactie per item, herberekent de call-status (pending → partial → completed). |
| `src/app/home/page.tsx` | Roept bij laden `POST` aan (trigger), daarna `GET` (ophalen), en toont de Coach Call-banner als `pending_count > 0`. **Belangrijk:** de trigger draait dus alleen als de home-pagina geladen wordt. |
| `src/app/coach-call/page.tsx` | De evaluatiepagina zelf waar de gebruiker rating/mood/notities invult. |
| `src/app/activities/page.tsx` | Toont Strava/Garmin-activiteiten; bron van de data die `coach-calls/route.ts` filtert. |
| `src/lib/strava-activity-processor.ts` | Verwerkt de ruwe Strava-sync naar `activity_sessions` (sporttype-mapping, metrics). Draait vóór de Coach Call-logica, niet erin. |

**Statusmachine van een `coach_call`:**
`pending` → (items deels beoordeeld) → `partial` → (alle items beoordeeld) → `completed`
Een call die 24 uur oud is zonder voltooiing wordt automatisch `expired`.

**Bekende fix (v2.4.3):** als er op een datum al een `completed`/`expired` call bestond en er kwam een nieuwe kwalificerende Strava-activiteit bij, bleef die call onzichtbaar (GET filtert op `pending`/`partial`). De `POST`-route heropent zo'n call nu automatisch. Zie changelog v2.4.3 voor detail.

**Bekend gedrag (geen bug):** de `POST`-trigger draait alleen wanneer `home/page.tsx` geladen wordt. Na een Strava-sync moet de gebruiker dus naar de home-pagina navigeren voordat een nieuwe Coach Call verschijnt.

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
```
src/app/api/coach-calls/route.ts
src/app/api/coach-calls/rate/route.ts
src/hooks/useCoach.ts (niet van toepassing — zie useCoach vs coach-calls onderscheid hieronder)
src/app/home/page.tsx
src/lib/strava-activity-processor.ts
```
Let op onderscheid: `/api/coach` (enkelvoud) = dagelijks coach-advies.
`/api/coach-calls` (meervoud) = evaluatie van trainingen/activiteiten. Dit
zijn twee losse routes met eigen bugs — niet aannemen dat een fix in de één
de ander raakt.

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

### Algemeen (bij twijfel over welk bestand)
Vraag altijd eerst om:
1. Het Debug Panel (`/debug`) — zie punt 15, architectuurregel
2. Vercel Logs (rode 500-regels, uitgeklapt voor volledig pad + error-tekst)
3. Het exacte symptoom: hangt het, geeft het een foutmelding, of gebeurt er
   zichtbaar niets?

---

## Exercise Illustraties — Voortgang

Mannequin-stijl illustraties per oefening, gegenereerd via GPT, opgeslagen in
`public/exercises/[id].png`. Gekoppeld via `illustratie` veld op de
BibliotheekOefening interfaces. Eerste categorie: Kettlebell (102 oefeningen).

Volgorde: array-volgorde in `src/lib/kettlebell-exercises.ts`, met reeds
voltooide oefeningen overgeslagen (niet chronologisch op array-index).

| Oefening | Status |
|----------|--------|
| Kettlebell Deadlift | ✅ Live |
| Kettlebell Swing | ✅ Live |
| Goblet Squat | ✅ Live |
| Strict Press | ✅ Live |
| Clean | ✅ Live |
| Farmer Carry | ✅ Live |
| Sumo Deadlift | 🔄 Prompt klaar |
| Single Arm Deadlift | 🔄 Prompt klaar |
| Romanian Deadlift | 🔄 Prompt klaar |
| Staggered Stance Deadlift | 🔄 Prompt klaar |
| Russian Swing | 🔄 Prompt klaar |
| American Swing | 🔄 Prompt klaar |
| One Arm Swing | 🔄 Prompt klaar |
| Hand-to-Hand Swing | 🔄 Prompt klaar |
| Double Swing | 🔄 Prompt klaar |
| Alternating Swing | 🔄 Prompt klaar |
| Front Squat | 🔄 Prompt klaar |
| Double Front Squat | 🔄 Prompt klaar |

**Volgende:** vraag "volgende" voor de eerstvolgende oefening zonder illustratie
(array-volgorde in `kettlebell-exercises.ts`, reeds voltooide overgeslagen).
Prompt-sjabloon (stijl, layout, kwaliteitseisen) blijft hetzelfde — alleen
oefeningnaam en de 5 fasenamen wijzigen per oefening.

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
- ZIP naam: `coachos-fix.zip` / `coachos-update.zip` / `coachos-docs.zip`
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

**Bestandsnaam:** `[oefening-id].png`
**Bestandsformaat:** PNG, witte achtergrond, minimaal 1200px breed

---

Bestandsnaam-conventie: `[oefening-id].png` in `/public/exercises/`.
Naamgeving: kebab-case van de oefeningnaam, **zonder** `kb-` prefix en zonder
categorie-prefix (bijv. "Sumo Deadlift" → `sumo-deadlift.png`). De eerste vier
bestanden (`kettlebell-deadlift.png`, `kettlebell-swing.png`,
`kettlebell-press.png`, `kettlebell-clean.png`) zijn legacy-namen van vóór
deze conventie — die blijven ongewijzigd.

Voorbeeld: Kettlebell Swing → `kettlebell-swing.png` (legacy)
Voorbeeld: Sumo Deadlift → `sumo-deadlift.png` (huidige conventie)
