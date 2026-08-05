# CoachOS Data Model Analysis — Uitgevoerde Trainingen

**Versie 1.0 — Status: Analyse, geen implementatie**
**Aanleiding:** bij het aansluiten van de handmatige/bibliotheek-import
op de Workout Matching Service bleek `api/training/complete/route.ts`
niet naar `activity_sessions` te schrijven, maar naar `training_results`
— een tabel die de Matching Service niet kent. Op verzoek van de
gebruiker: eerst het volledige datamodel in kaart brengen, geen code
totdat dit compleet is.

**Methode:** uitsluitend gebaseerd op wat daadwerkelijk in de code en
het README staat — geen aannames. Waar iets niet gevonden kon worden
(GitHub code search was rate-limited, dus geen volledige repo-scan
mogelijk), staat dat expliciet vermeld als open vraag, niet als
conclusie.

---

## Samenvatting vooraf

Er blijken **niet twee, maar drie relevante lagen** te zijn, en ze zijn
niet zomaar duplicaten van elkaar — ze zijn oorspronkelijk voor
verschillende doelen gebouwd:

| Tabel | Rol (geverifieerd) |
|---|---|
| `activity_sessions` | Canonical Activity Model voor **extern geïmporteerde** activiteiten (device-data: Concept2/Garmin/Strava). Enige bron die het Performance Platform (CTL/ATL/TSB) leest. |
| `training_results` | Sessielaag voor **in-app doorlopen trainingen** (bibliotheek/coach-plan/handmatig) — duur, RPE, type, evaluatie. Wordt WEL getoond op specialist-dashboards, maar NIET gelezen door het Performance Platform. |
| `exercise_records` | Detaillaag onder `training_results` — per-oefening data (gewicht, reps, sets), gekoppeld via `training_result_id`. |
| `training_plan_sessions` | Het geplande schema (Training Plan Engine) — wat er volgens het plan moet gebeuren. Dit is waar de Workout Matching Service tegen matcht. |
| `training_sessions` | Alleen gevonden als foreign key-doel (`session_id`) in `training/complete/route.ts`. **Geen enkele vermelding gevonden** in README of changelog. Vermoedelijk legacy — zie sectie hieronder, niet bevestigd. |

**De kernvraag is dus niet (alleen) "hoe sluit ik Matching aan op
`training_results`", maar: "waarom telt een in-app voltooide training
al niet mee voor het Performance Platform, en is dat bewust of een
gat?"** Dat is groter dan de Matching Service alleen.

---

## Tabel-voor-tabel

### `activity_sessions`
**Doel (bevestigd, README "Project Geheugen"-sectie, sinds v2.4.119):**
*"Strava/Garmin activiteiten"* — expliciet gedocumenteerd als de plek
voor extern geïmporteerde device-data, niet voor in-app trainingen.

**Schrijvende routes (bevestigd in deze sessie):**
- `api/specialists/rowing/concept2/sync/route.ts` (Concept2)
- `src/lib/strava-activity-processor.ts` (Strava)
- `api/health/garmin-activity-tcx/route.ts` (Garmin TCX)
- `api/health/garmin-activity-vision/route.ts` (vermoedelijk — zelfde
  patroon als TCX, niet deze sessie expliciet geverifieerd)

**Lezende routes (bevestigd):**
- `rowing-data.ts` / `running-data.ts` / `cycling-data.ts` (specialist-
  dashboards, veld `activiteiten`)
- `running-grafieken.ts` / `cycling-grafieken.ts` / `rowing-grafieken.ts`
  → `load-engine.ts` (Performance Platform, CTL/ATL/TSB) — **enige
  bron hiervoor, geverifieerd door `running-grafieken.ts` te lezen: geen
  enkele query naar `training_results`**
- `training-plan-engine/workout-matcher.ts` (nieuw, deze week)

**Status:** actief, kernonderdeel van het platform.

---

### `training_results`
**Doel (bevestigd, README "Project Geheugen"-sectie):** *"sessielaag
(duur, RPE, type)"* — voor trainingen die via de Universal Training
Engine (`session/[module]`-flow) in de app zelf worden doorlopen:
bibliotheek-trainingen, coach-plan-trainingen, handmatige invoer.
`training_source` onderscheidt: `'coach_plan' | 'library' | 'manual' |
'imported'`.

**Schrijvende routes (bevestigd):**
- `api/training/complete/route.ts` — enige gevonden schrijfroute

**Lezende routes (bevestigd):**
- `rowing-data.ts` / `running-data.ts` / `cycling-data.ts` — **als
  aparte array naast `activiteiten`**, genaamd `trainingsresultaten`.
  Dit bevestigt: de specialist-dashboards behandelen dit al als een
  bewust gescheiden, parallelle stroom, geen samengevoegd model.
- `debug/page.tsx`, sectie "Coach Call Integriteit" — vergelijkt tegen
  `coach_call_items`
- `rpeStabiel`-berekening (regel 1339 README) gebruikt
  `training_results`

**Status:** actief, maar **niet verbonden aan het Performance Platform
of de Workout Matching Service.**

---

### `exercise_records`
**Doel (bevestigd):** detaillaag onder `training_results` — individuele
oefeningen (gewicht, tempo, reps, sets), gekoppeld via
`training_result_id`. Voor Kettlebell/Strength/Bodyweight is dit de
enige progressie-tracking die bestaat (die sporten hebben geen
`activity_sessions`-data, per definitie — geen device om te
importeren).

**Status:** actief, niet relevant voor de Matching Service (geen
sport met een Training Plan Engine schrijft hierheen als primaire
bron).

---

### `training_plan_sessions`
**Doel (bevestigd, uitgebreid gedocumenteerd deze week):** het geplande
schema van de Training Plan Engine (Rowing/Running/Cycling). Dit is
waar `completed_activity_id`, `match_confidence`, `match_reden` op
staan — het doelwit van de Workout Matching Service.

**Status:** actief, kernonderdeel van dit hele traject.

---

### `training_sessions` (het onopgeloste punt)
**Enige vondst:** `api/training/complete/route.ts`, regel 86-92 —
`session_id` (uit de request body) wordt gebruikt om een rij in
`training_sessions` bij te werken (`status: completed ? 'completed' :
'skipped'`), **alleen als `session_id` is meegegeven** (`if
(session_id) { ... }`) — dus optioneel, niet verplicht.

**Niet gevonden, ondanks zoeken:**
- Geen vermelding in README (0 treffers)
- Geen vermelding in changelog (0 treffers)
- Geen schrijvende route gevonden die een NIEUWE `training_sessions`-rij
  aanmaakt (alleen een update op een bestaand `session_id`) — wat
  betekent dat er ergens ANDERS een `training_sessions`-rij moet
  ontstaan, maar die plek is niet gevonden
- Kon niet uitsluiten dat dit gewoon een oude, losstaande tabel is, of
  dat `session_id` in de praktijk meestal `null`/leeg is

**Conclusie: onbevestigd.** Dit vergt ofwel een directe blik in de
Supabase-tabel zelf (bestaat de tabel, hoeveel rijen, hoe recent
bijgewerkt), ofwel een GitHub code-search zodra die niet meer
rate-limited is. **Ik geef dit niet als "waarschijnlijk legacy"
door als vaststaand feit — dat is een vermoeden, geen bevestiging.**

---

## Wat dit betekent voor de drie scenario's (A/B/C)

**Scenario A** (`training_results` is puur detail, er ontstaat ook een
`activity_sessions`-rij) — **klopt niet.** Geen enkele
`activity_sessions`-insert gevonden in `training/complete/route.ts`.

**Scenario B** (`training_results` IS de activity voor deze stroom,
Matching Service moet uitgebreid worden) — **dit lijkt het dichtst bij
de waarheid,** met een belangrijke kanttekening: het is niet alleen een
Matching Service-vraagstuk. Zelfs vóór de Matching Service bestond, was
er al geen brug naar het Performance Platform. Dit is dus een **breder,
al langer bestaand gat** dan alleen "geen matching voor
bibliotheektrainingen" — het is "in-app voltooide cardio-trainingen
tellen niet mee voor CTL/ATL/TSB, punt."

**Scenario C** (`training_sessions` is een oud systeem, migratie nodig)
— **mogelijk, voor `training_sessions` specifiek** (niet voor
`training_results`, die is duidelijk actief), maar niet bevestigd.

---

## Aanbeveling (analyse, geen besluit — dat is aan de gebruiker)

Twee onafhankelijke vervolgvragen, bewust apart gehouden:

1. **Voor de Matching Service, nu:** hoe vaak wordt
   `api/training/complete/route.ts` in de praktijk gebruikt vóór
   Rowing/Running/Cycling specifiek (niet Kettlebell/Strength/
   Bodyweight, die hebben toch geen Training Plan Engine/Matching)? Als
   het antwoord "zelden tot nooit voor die drie sporten" is
   (bijvoorbeeld omdat je altijd via Concept2/Garmin importeert), dan
   heeft dit punt dezelfde status als Garmin Vision: bewust
   overslaan, niet blokkeren.

2. **Los daarvan, groter:** is het gewenst dat in-app voltooide
   cardio-trainingen (Rowing/Running/Cycling via de bibliotheek/coach-
   plan-speler, niet geïmporteerd) ooit gaan meetellen voor CTL/ATL/TSB?
   Dat is een Performance Platform-vraagstuk, ouder en groter dan de
   Workout Matching Service, en zou zijn eigen afweging verdienen —
   niet iets om terloops mee te nemen in Fase 3.

**Geen code geschreven. Wacht op richting.**
