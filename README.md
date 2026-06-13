# CoachOS - Project Geheugen

## Project
- App naam: CoachOS
- Versie: 5.6.0
- App URL: https://coach-os-tau.vercel.app
- GitHub: https://github.com/stuctech-eng/coachOS
- Supabase: https://fabtmkrzqrrwbvgaugjst.supabase.co
- Architectuur: V4.0

## Stack
- Frontend: Next.js 14.2.29 + TypeScript + PWA
- Auth: Supabase Auth
- Database: Supabase PostgreSQL
- AI: Claude API via /api/ai proxy (geen SDK — directe fetch)
- State: Zustand
- Styling: Tailwind CSS
- Hosting: Vercel
- Afbeelding compressie: sharp ^0.33.0

---

# CoachOS V5.0 — Volledige AI Architectuur

## Kernvisie
CoachOS is een AI Coaching Operating System.
Observe → Learn → Predict → Coach → Execute → Learn Again

## AI Lagen (alle compleet)

### Coach AI (Master Brain — Altijd Leidend)
- bepaalt training vs herstel vs rust
- analyseert ALLE data: Garmin, check-in, levensgebeurtenissen, werktijden, blessures, trainingshistorie, Performance AI
- genereert dagplannen BUITEN werktijden
- plant activiteiten op basis van werktijden uit levensgebeurtenissen

### Trainer AI (✅ Universal — v5.5)
- genereert sessies per module (kettlebell, rowing, running, cycling, strength, bodyweight)
- houdt rekening met equipment profiel — alleen oefeningen met beschikbaar materiaal
- module-keuze is hard equipment-gated: rowing alleen als concept2_available=true,
  kettlebell alleen als kettlebell_available=true (zie src/utils/equipment.ts)
- adaptief op basis van experience, Body Battery, check-in (energie/stress/spierpijn), ratings, blessures
- output altijd: segments[] (oefeningen met sets/reps/duration/rest/instructie/cue/common_errors)
- fallback schema als AI parsing faalt — sessie kan altijd starten (kettlebell of rowing fallback,
  afhankelijk van beschikbaar equipment)

### Recovery AI (✅)
- Ademhaling: Box Breathing, 4-7-8, Coherent, Stress Reset
- Mobiliteit: Nek & Schouders, Heupen, Full Body
- Wandeling: Herstelwandeling

### Performance AI (✅ v5.1)
- Analyseert trainingsresultaten over 30 dagen
- Output: progressie_trend, consistentie, herstel_na_training, niveau_gereed
- Dagelijks gecached in coach_recommendations
- Zichtbaar in Progressie tab
- Stuurt Coach AI bij via context

---

## AI Context per Route (v5.0 — volledig)

| Route | Life events | Werktijden | Garmin | Blessures | Trainingen | Performance |
|---|---|---|---|---|---|---|
| action-plan | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| training/today | ✅ | — | ✅ | ✅ | — | — |
| coach | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| chat | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| predictions | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| memory | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| weekly | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| performance | — | — | ✅ | ✅ | ✅ | — |

training/today is bewust lichtgewicht gehouden (5 queries i.p.v. 13) om
Vercel timeouts te voorkomen — alleen profiel, check-in, garmin, blessures, doelen.

---

## System Flow
USER DATA + GARMIN + WERKTIJDEN + BLESSURES + TRAININGEN → COACH AI + PERFORMANCE AI → TRAINER AI / RECOVERY AI → UNIVERSAL TRAINING ENGINE → RESULT → COACH AI (learning)

## Harde Regels
1. Coach AI is altijd leidend
2. Plan NOOIT activiteiten tijdens werktijd
3. Home = dagelijkse actie
4. Progressie = eigen tab (met Performance AI)
5. Training = uitvoering via Universal Training Engine
6. Coach = AI interface

---

# Navigatie V4.5
Home | Training | Progressie | Coach | Instellingen

Inzichten en Equipment bereikbaar via Instellingen.

---

# Universal Training Engine (V3) — v5.4.0

Eén dynamische route `/training/session/[module]/page.tsx` voor alle sportmodules
(kettlebell, rowing, running, cycling, strength, bodyweight). State leeft in
localStorage (`SESSION_STORAGE_KEY`), Supabase write alleen bij voltooien.

## Lagen
1. **Schema Layer** — overzicht alle oefeningen (titel, sets, reps, rust)
   → "Training Starten"
2. **Uitleg/Learning Layer** (`UitlegScherm`, universeel component) — uitvoering,
   coaching tip, veelgemaakte fouten → "Ready"
3. **Workout Engine** — automatische flow met sets/rust/navigatie
4. **Voltooid scherm** — statistieken (voltooid/overgeslagen/sets)
5. **Evaluatie Layer** — zwaarte/energie/techniek (1-10) + notities → POST /api/training/complete

## Automatische flow (auto_running)
```
Ready → Set 1 actief (countdown) → Rust → Set 2 → Rust → Set 3
→ Laatste rust: toont uitleg volgende oefening (timer rechtsboven)
→ Rust op 0 → volgende oefening start automatisch
```

## Reps → tijd (tempo systeem)
Rep-based oefeningen (reps gezet, duration_sec null) worden omgezet naar tijd:
```
TEMPO_SEC_PER_REP = { slow: 4, normal: 3, fast: 2 }
actieve_tijd = reps × sec_per_rep(tempo)
```
Tempo is per oefeningsnaam instelbaar (Slow/Normaal/Fast) en wordt onthouden
in localStorage (`coachos_exercise_tempo`). Zodra `active_seconds_left` op 0 komt
→ automatisch naar rust.

## Navigatie tijdens workout
- Back (onderaan) — stopt auto_running, reset timers naar 0, toont uitleg
  van de VORIGE oefening (Ready om opnieuw te starten)
- Volgend — zelfde maar voor de VOLGENDE oefening
- Next — slaat alleen de huidige stap over (set→rust of rust→volgende set),
  auto_running blijft aan
- Header back-arrow — tijdens workout: zelfde als Back (stop+reset+uitleg
  huidige oefening); tijdens learning: terug naar schema; anders: terug naar
  Training tab

## Pause
Onderste knop tijdens workout. Stopt auto_running, toont overlay
"Training Gepauzeerd" met huidige oefening/set/tijd.
- Hervatten — auto_running weer aan, verder vanaf zelfde punt
- Stop Training — bevestiging "Weet je zeker?" → clear sessie → terug naar Training

## Sessie herstel
Bij mount: als er een geldige sessie in localStorage staat (zelfde module,
niet completed, segments aanwezig) → dialog "Actieve training gevonden"
met Hervatten / Verwijderen.

---

# Equipment Profiel (v5.4.0)

Instellingen → Equipment. Booleans in `profiles`:
kettlebell_available, concept2_available, cycling_available, running_available,
dumbbell_available, barbell_available, ab_wheel_available, bodyweight_available
(bodyweight altijd true). Trainer AI genereert alleen oefeningen met
beschikbaar materiaal.

`training_results` uitgebreid met: perceived_effort, fatigue_after, soreness,
soreness_notes — ingevuld via Evaluatie Layer.

---

# Rowing Module (v5.5.0)

Eerste niet-kettlebell module op de Universal Training Engine. Geen aparte
architectuur — zelfde `/training/session/[module]/page.tsx`, `RowingSegment`
type sluit aan op dezelfde basisvelden als `KettlebellSegment`
(exercise/sets/reps/duration_sec/rest_sec/instruction/cue/common_errors).

## Equipment-gating (hard, per module)

| Module | Vereist (src/utils/equipment.ts) |
|---|---|
| kettlebell | kettlebell_available |
| rowing | concept2_available |
| cycling | cycling_available |
| running | running_available |
| strength | dumbbell_available OR barbell_available |
| bodyweight | altijd |

Trainer AI mag `training_type: "rowing"` alleen retourneren als
`concept2_available = true` — anders forceert de prompt `"kettlebell"`.
De route valideert dit ook na ontvangst van het AI-antwoord
(`typeAllowed` check in `training/today/route.ts`) en valt anders terug
op het fallback-schema passend bij het beschikbare equipment.

## Sessietypes
Trainer AI kiest op basis van Body Battery/stress/HRV/blessures/historie:
- **recovery** — zone 1-2, 15-30 min
- **endurance** — 30-90 min steady state
- **tempo** — drempeltraining (bijv. 3x10min/2min rust)
- **interval** — bijv. 10x500m
- **sprint** — korte explosieve intervallen (bijv. 8x250m)
- **test** — bijv. 500m/1000m/2000m/5000m test

## RowingSegment velden (training-engine.ts)
```ts
exercise, session_type, sets, reps (altijd null), duration_sec, rest_sec,
distance_m?, target_split?, target_spm?, target_hr_zone?,
instruction, cue, common_errors, equipment_required?
```
`duration_sec` is de actieve tijd per set/interval — door Trainer AI berekend
uit distance_m + target_split (bijv. 500m @ 2:05/500m = 125 sec) of direct
de tijd bij steady/recovery/tempo sessies. Dit laat de bestaande Workout
Engine (countdown, auto-advance naar rust) ongewijzigd werken.

## Weergave
- Schema en Uitleg tonen "10 × 500m @ 2:05/500m" i.p.v. "10 × 12 herh."
- Tijdens workout: bij sets > 1 toont de header "Interval X van Y"
  (i.p.v. "Set X van Y"); bij sets = 1 (steady) wordt de set-indicator verborgen
- Doelwaarden-kaart toont afstand, doelsplit, SPM-doel en hartslagzone indien aanwezig
- Tempo-selector (Slow/Normaal/Fast) wordt verborgen voor rowing — duration_sec
  staat al vast

## Evaluatie-uitbreiding
Bij rowing toont de Evaluatie Layer 3 extra vragen (1-10), opgeslagen in
`training_results`:
- `rowing_technique_rating` — techniek (haal, timing)
- `rowing_pacing_rating` — tempo controle / split gehouden
- `rowing_fatigue_rating` — vermoeidheid na sessie

## /api/training/complete (herschreven v5.5)
De Universal Engine stuurt geen `session_id` — de route accepteert dit nu als
optioneel en schrijft direct naar `training_results` met `training_type`,
de standaard evaluatievelden (rating/perceived_effort/fatigue_after/soreness/notes)
en de rowing-velden indien aanwezig.

## Benodigde SQL migratie
```sql
alter table training_results
  add column if not exists training_type text,
  add column if not exists rowing_technique_rating int,
  add column if not exists rowing_pacing_rating int,
  add column if not exists rowing_fatigue_rating int;

alter table training_results
  alter column session_id drop not null;
```

## Performance AI compatibiliteit
Geen wijziging nodig — `training_results` rijen van rowing (met
`training_type: 'rowing'`, `rating`, `actual_duration`, `completed_at`)
stromen automatisch mee in de bestaande consistentie/trend-berekeningen.
Split-, SPM- en vermogensanalyse volgen in V6 via de Concept2 API.

## V6 Roadmap (Concept2 API — nog niet gebouwd)
- V6.0 Concept2 OAuth Login
- V6.1 Concept2 Logbook Sync
- V6.2 Automatische workout import
- V6.3 PR Tracking (500m/1000m/2000m/5000m)
- V6.4 Rowing Coach AI (pacing/split/SPM/vermogen analyse)
- V6.5 Volledig Concept2 analyse dashboard

`RowingSegment` en `SessionResult` zijn al uitbreidbaar voor toekomstige
velden (avg_split, best_split, avg_spm, max_spm, avg_power, drag_factor,
calories, interval_data) zonder breaking changes.

---

# Running Module (v5.6.0)

Derde trainingsmodule op de Universal Training Engine — architectuur identiek
aan Rowing (v5.5.0). Geen aparte engine, geen decision layer, geen scoring-
systeem. `RunningSegment` deelt dezelfde basisvelden als `RowingSegment`
(exercise/sets/reps/duration_sec/rest_sec/instruction/cue/common_errors).

## Equipment-gating
`running_available` (al aanwezig in `src/utils/equipment.ts`). Trainer AI mag
`training_type: "running"` alleen retourneren als dit `true` is.

## Module-keuze (3-weg, dynamisch)
`/api/training/today` bouwt nu een dynamische `keuzeModules`-lijst
(kettlebell/rowing/running, gefilterd op equipment) en geeft Trainer AI de
vrije keuze daaruit — exact zoals de 2-weg kettlebell/rowing-keuze in v5.5,
nu uitgebreid naar 3 modules. **Geen** decision engine, **geen**
recovery/training-load scoring, **geen** harde prioriteitsregels — Strava-
historie is uitsluitend context (zie hieronder).

## Sessietypes
- **recovery** — rustige herstelrun, zone 1-2, 20-30 min
- **endurance** — 5-10km of 30-60min steady
- **tempo** — drempeltraining (bijv. 3x10min/2min rust)
- **interval** — bijv. 6x400m, 8x500m, 5x800m
- **sprint** — bijv. 10x100m, 8x200m
- **test** — bijv. 1km/5km/10km test

## RunningSegment velden (training-engine.ts)
```ts
exercise, session_type, sets, reps (altijd null), duration_sec, rest_sec,
distance_m?, target_pace? (bijv. "5:30/km"), target_speed_kmh?, target_hr_zone?,
instruction, cue, common_errors, equipment_required?
```
`duration_sec` is de actieve tijd per set/interval — door Trainer AI berekend
uit distance_m + target_pace (bijv. 400m @ 5:30/km = 132 sec) of direct de
tijd bij steady/recovery/tempo sessies.

## Strava-context (6e query, lichtgewicht)
`/api/training/today` haalt de laatste 5 runs (max 14 dagen) op uit
`activity_sessions` (join met `activities` waar `name = 'Hardlopen'`,
`source = 'strava'`). Per run: afstand (km), duur, gemiddelde pace (berekend
uit `avg_speed`), gemiddelde hartslag, hoogteverschil. Dit wordt als platte
tekst-context aan de prompt toegevoegd:

> Gebruik deze gegevens uitsluitend als context om een passende running
> training te genereren. Coach AI blijft leidend. Trainer AI bepaalt de
> sessie. Gebruik geen vaste berekeningen of scoringsmodellen.

Geen cadence, splits, PR's of suffer score in v5.6 — bewaard voor V6/V7.

## Personal Progression Principle
De prompt instrueert Trainer AI om Strava-historie te gebruiken voor kleine,
persoonlijke opbouw (afstand/tempo) en consistentie te belonen (bijv. een
herstelrun na een drukke week), met voorbeeldformuleringen in
`coach_message` ("vorige week 5 km, vandaag 6 km"). Vergelijking is
uitsluitend met de eigen historie — nooit met andere lopers, geen rankings.

## Weergave
- Schema en Uitleg tonen "6 × 400m @ 5:30/km" of "5000m @ 6:00/km" i.p.v.
  reps
- Doelwaarden-kaart toont afstand, doeltempo (min/km), snelheid (km/u) en
  hartslagzone indien aanwezig
- Bij sets > 1: "Interval X van Y" (zelfde als rowing)
- Tempo-selector (Slow/Normaal/Fast) verborgen — duration_sec staat al vast

## Evaluatie-uitbreiding (4 vragen, 1 meer dan rowing)
- `running_technique_rating` — looptechniek
- `running_pacing_rating` — tempo controle (pace gehouden)
- `running_fatigue_rating` — vermoeidheid nu (herstelkosten)
- `running_rpe_rating` — hoe zwaar voelde de training (intensiteit tijdens
  de sessie, Borg-achtige schaal) — los van fatigue: RPE meet de inspanning
  *tijdens*, fatigue de herstelbehoefte *na* de sessie

## Benodigde SQL migratie
```sql
alter table training_results
  add column if not exists running_technique_rating int,
  add column if not exists running_pacing_rating int,
  add column if not exists running_fatigue_rating int,
  add column if not exists running_rpe_rating int;
```

## Trainingsbibliotheek + Performance AI
Running was al opgenomen in `TRAININGSBIBLIOTHEEK` (v5.5.1, toonde "Instellen"
zolang Trainer AI het niet ondersteunde) — nu volledig werkend, equipment-
gated via `running_available`. Performance AI: geen wijziging nodig, running-
resultaten tellen automatisch mee (zelfde principe als rowing v5.5.0).

---

# Trainingsbron & Trainingsbibliotheek (v5.5.1)

Naast Coach AI's dagelijkse "Vandaag voor jou" kan de gebruiker via een nieuwe
**Trainingsbibliotheek** (naast Herstelbibliotheek op de Training tab) zelf een
module kiezen, los van het dagadvies. Coach AI blijft leidend: Trainer AI
bepaalt — net als bij het dagadvies — het sessietype binnen die module op
basis van Body Battery/stress/HRV/blessures (bijv. lage BB → Recovery Row,
hoge BB → Interval Row).

## training_source (type, niet alleen kolom-default)
```ts
type TrainingSource =
  | 'coach_plan'  // "Vandaag voor jou" — Coach AI's dagadvies
  | 'library'     // Trainingsbibliotheek — gebruiker koos zelf een module
  | 'manual'      // toekomstig: handmatig ingevoerde training
  | 'imported'    // toekomstig: Strava/Concept2 import
```
Gedefinieerd in `src/types/training-engine.ts`. Alleen `coach_plan` en
`library` worden nu geschreven; `manual`/`imported` liggen vast voor
toekomstige Strava-import en Concept2 sync zonder migratie.

## Flow
- Training tab → "Vandaag voor jou" → Start → `training_source: 'coach_plan'`
- Training tab → Trainingsbibliotheek → module tikken → `/training/session/[module]?source=library`
  → `training_source: 'library'`
- Beide lopen door dezelfde Universal Training Engine → `/api/training/complete`
  → `training_results.training_source`

## /api/training/today — library mode
Body `{ module, source: 'library' }`:
- valideert `isModuleAvailable(module, equipment)` — 403 als equipment ontbreekt
- forceert `training_type = module` in de prompt, Trainer AI kiest zelf het
  sessietype (Coach AI blijft leidend over intensiteit)
- leest/schrijft NIET de dagcache (`type='training_today'`) — "Vandaag voor jou"
  blijft ongewijzigd

## Performance AI & Progressie
Alle `training_results` rijen tellen mee, ongeacht `training_source` — het
lichaam maakt geen onderscheid. Per-sessie labels (🏋️ Coach Advies /
📚 Bibliotheek) zijn nog niet getoond in Progressie, omdat er nog geen
sessiehistorie-lijst is — data staat al klaar voor wanneer die lijst gebouwd wordt.

## Benodigde SQL migratie
```sql
alter table training_results
  add column if not exists training_source text default 'coach_plan';
```

---



Eén tabel, meerdere AI-outputs per dag, onderscheiden via `type` kolom om
overschrijven tussen routes te voorkomen:

```sql
alter table coach_recommendations add column if not exists type text default 'coach';
alter table coach_recommendations drop constraint if exists coach_recommendations_user_id_date_key;
alter table coach_recommendations add constraint coach_recommendations_user_id_date_type_key
  unique (user_id, date, type);
```

| type | route | bevat |
|---|---|---|
| coach | /api/coach | recommendation, reasoning, actie_type, advice_bullets |
| training_today | /api/training/today | training_instruction |
| predictions | /api/predictions | voorspellingen |
| performance_ai | /api/performance | progressie analyse |

Elke upsert gebruikt `onConflict: 'user_id,date,type'`.

---

# Data Strategie

## Garmin Import Schema (v4.7)
```json
{
  "resting_hr": 46,
  "body_battery": { "current": 83, "charged": 49, "spent": 8 },
  "sleep": { "score": 83, "duration_minutes": 408 },
  "hrv": { "avg_7d_ms": 49, "status": "balanced" },
  "stress": 18,
  "breathing": { "current_brpm": 20, "avg_awake_brpm": 15, "avg_sleep_brpm": 13 },
  "meta": { "source": "garmin_screenshot", "parsed_at": "timestamp" }
}
```

## Garmin indicator bolletje (Home)
- 🟢 Groen = vandaag bevestigd
- 🟡 Amber = gisteren
- ⚪ Grijs = geen recente data

---

# Performance AI — Analyse Schema
```
progressie_trend:    stijgend / stabiel / dalend / onvoldoende_data
consistentie:        hoog / gemiddeld / laag / onvoldoende_data
herstel_na_training: goed / matig / slecht / onvoldoende_data
niveau_gereed:       true / false
gem_rating:          getal of null
trainingen_per_week: getal of null
samenvatting:        tekst voor Coach AI
```

Niveau gereed = gem. rating laatste 3 sessies ≥ 8 ÉN Body Battery ≥ 70

---

# Bestandsstructuur

src/
  types/
    training-engine.ts                  klaar (v5.6.0 — + RowingSegment/RunningSegment, equipment_required, TrainingSource, rowing/running evaluatievelden)
  utils/
    equipment.ts                        klaar (v5.5 — nieuw, module ↔ equipment mapping)
  app/
    api/
      action-plan/route.ts                klaar (v5.0)
      coach/route.ts                      klaar (v5.4 — type='coach' upsert)
      chat/route.ts                       klaar (v5.0)
      predictions/route.ts                klaar (v5.0)
      memory/route.ts                     klaar (v5.0)
      status/route.ts                     klaar (v4.3)
      weekly/route.ts                     klaar (v5.1 — vorige week op maandag)
      performance/route.ts                klaar (v5.1, compatibel met rowing v5.5)
      equipment/route.ts                  klaar (v5.4 — GET/POST equipment profiel)
      training/
        today/route.ts                    klaar (v5.6.0 — + running module, 3-weg keuze, Strava-runninghistorie context)
        session/route.ts                  klaar (v4.5)
        complete/route.ts                 klaar (v5.6.0 — + running evaluatievelden)
      recovery/
        complete/route.ts                 klaar (v4.2)
      health/
        garmin-vision/route.ts            klaar (v4.8)
      strava/                             klaar
    home/page.tsx                         klaar (v4.7)
    insights/page.tsx                     klaar (v4.7)
    progressie/page.tsx                   klaar (v5.1)
    settings/page.tsx                     klaar (v5.4 — Equipment link)
    settings/equipment/page.tsx           klaar (v5.4 — nieuw)
    settings/hoe-werkt-het/page.tsx       klaar (v5.6.0 — + Running sectie)
    settings/garmin-import/page.tsx       klaar (v4.7)
    training/
      page.tsx                            klaar (v5.5.1 — + Trainingsbibliotheek, equipment-gated)
      session/[module]/page.tsx           klaar (v5.5.1 — + training_source via ?source=library)
      kettlebell/page.tsx                 oud, niet meer in gebruik (vervangen door session/[module])
      recovery/
        breathing/page.tsx                klaar (v4.2)
        mobility/page.tsx                 klaar (v4.2)
        walk/page.tsx                     klaar (v5.0)
    reset-password/page.tsx               klaar (v4.9.4)
    auth/callback/route.ts                klaar (v4.9.4)

---

# Supabase Tabellen
profiles (+ equipment booleans v5.4), user_goals, daily_checkins,
health_metrics(inactief), coach_memory, coach_recommendations (+ type kolom v5.4),
activities, activity_sessions, activity_templates, strava_tokens,
knowledge_observations, ai_conversations, daily_status, injuries, life_events,
training_sessions, training_results (+ perceived_effort/fatigue_after/soreness v5.4,
+ training_type + rowing_technique_rating/rowing_pacing_rating/rowing_fatigue_rating v5.5,
+ training_source v5.5.1, session_id nu nullable), recovery_sessions, recovery_results, garmin_imports

---

# Huidige Staat (v5.5.0) — Volledig

Werkend:
- Login, onboarding, profiel, doelen, blessures, levensgebeurtenissen
- Check-in, weekly review (vorige week op maandag)
- Home: Coach Score + Check-in + Dagboek + "Vandaag van je Coach" (actie_type-knop) + Coach Chat/Week + Garmin status
- Coach AI — volledige context, plant BUITEN werktijden
- Inzichten: Garmin grafieken + Trends + Coach inzichten
- Garmin Vision Import — automatische compressie, stress + ademhaling
- Recovery AI — ademhaling, mobiliteit, wandeling
- Equipment profiel — Instellingen → Equipment
- Trainer AI — sessie generatie per module, equipment-aware (hard gated), fallback schema
- Universal Training Engine V3 — schema → uitleg → automatische workout
  (tempo-systeem, Back/Volgend/Next/Pause, sessie herstel) → voltooid → evaluatie
- Rowing Module (Concept2) — recovery/endurance/tempo/interval/sprint/test sessies,
  afstand/split/SPM/HR-zone weergave, rowing-evaluatievragen
- Trainingsbibliotheek — los van Coach AI's dagadvies zelf een module starten
  (equipment-gated), training_source onderscheidt coach_plan/library
- Performance AI — progressie analyse zichtbaar in Progressie tab, rowing-compatibel
- Progressie dashboard + Performance AI sectie
- Hoe werkt CoachOS — alle secties incl. Universal Training Engine + Rowing
- Wachtwoord vergeten flow
- Navigatie: Home | Training | Progressie | Coach | Instellingen

---

# Evoluties Status

- E1 Pattern Discovery: ✅
- E2 Trend Engine: ✅
- E3 Prediction Engine: ✅
- E4 Coach Personality: ✅
- E5 Daily Action Plan: ✅
- E6 Goal-specific Coaching: ✅
- E7 Second Brain: ⏳ groeit
- E8 Training Execution (Universal Training Engine): ✅ kettlebell + rowing, overige modules ⏳
- E9 Recovery Execution (Recovery AI): ✅
- E10 Garmin Vision Import: ✅
- E11 Progressie Dashboard: ✅
- E12 Gebruikersuitleg: ✅
- E13 Performance AI: ✅
- E14 Equipment Profiel: ✅
- E15 Universal Training Engine V3: ✅ (kettlebell)
- E16 Rowing Module: ✅ (kettlebell + rowing op Universal Engine, equipment-gated)
- E17 Running Module: ✅ (kettlebell + rowing + running, 3-weg keuze, Strava-context)

---

# V5.7 - V5.10 Roadmap (modules op Universal Training Engine)

- V5.7.0 — Cycling Module
- V5.8.0 — Kettlebell uitbreiding (meer oefeningen/varianten)
- V5.9.0 — Strength Module (dumbbells + barbell)
- V5.10.0 — Bodyweight & Core Module

Elke module: eigen Trainer AI prompt + segment-type in
`src/types/training-engine.ts`, gebruikt `equipment_required` voor gating
via `src/utils/equipment.ts`, draait op dezelfde
`/training/session/[module]/page.tsx` engine.

V6 Concept2 API roadmap: zie sectie "Rowing Module (v5.5.0)" hierboven.

---

# Versiehistorie
- v4.0.0 t/m v4.9.4: zie vorige sessies
- v5.0.0: Volledige AI context alle routes + walk fix + wachtwoord reset
- v5.0.1-5.0.5: Bug fixes routes (chat, predictions, memory, weekly)
- v5.1.0: Performance AI + Progressie tab uitbreiding + Hoe werkt CoachOS update + Weekly vorige week fix
- v5.2.0: Home redesign ("Vandaag van je Coach" met actie_type) + Progressie tab herordening
- v5.3.0: README volledige rewrite + V5.4-V5.10 roadmap vastgelegd
- v5.4.0: Equipment profiel + coach_recommendations type-kolom (race condition fix
  coach vs training_today) + training/today lichtgewicht (5 queries + fallback) +
  Universal Training Engine V3 (schema/uitleg/workout/voltooid/evaluatie,
  automatische flow, tempo-systeem reps→tijd, Back/Volgend/Next/Pause,
  sessie herstel) + training_results evaluatie-uitbreiding +
  Hoe werkt CoachOS Training Engine sectie
- v5.5.0: Rowing Module (Concept2) op Universal Training Engine — RowingSegment
  type (distance_m/target_split/target_spm/target_hr_zone/session_type/
  equipment_required), src/utils/equipment.ts (hard equipment-gating per module:
  rowing alleen bij concept2_available), Trainer AI rowing-prompt (recovery/
  endurance/tempo/interval/sprint/test), rowing-aware Schema/Uitleg/Workout
  weergave (afstand/split/SPM/HR-zone, interval-telling, geen tempo-selector),
  rowing evaluatievragen (techniek/pacing/vermoeidheid →
  rowing_technique_rating/rowing_pacing_rating/rowing_fatigue_rating),
  /api/training/complete herschreven (session_id optioneel, training_type kolom,
  rowing-velden), training/page.tsx generiek gemaakt (icon/label per module),
  README + Hoe werkt CoachOS bijgewerkt, V6 Concept2 API roadmap vastgelegd
- v5.5.1: Trainingsbron & Trainingsbibliotheek — TrainingSource type
  (coach_plan/library/manual/imported), Trainingsbibliotheek op Training tab
  (naast Herstelbibliotheek, equipment-gated, "Instellen" link bij ontbrekend
  equipment), /api/training/today library mode (forced module + equipment
  validatie, geen overschrijving van dagcache, Trainer AI bepaalt sessietype
  binnen geforceerde module), training_source opgeslagen in training_results
  (telt mee voor Performance AI/Progressie, geen aparte statistieken)
- v5.6.0: Running Module — RunningSegment type (distance_m/target_pace/
  target_speed_kmh/target_hr_zone/session_type, identiek qua opzet aan
  RowingSegment), 3-weg module-keuze in /api/training/today (kettlebell/
  rowing/running, dynamisch gefilterd op equipment, geen decision engine/
  scoring), 6e query voor Strava-runninghistorie (laatste 5 runs/14 dagen,
  uitsluitend als context — distance/avg_speed→pace/avg_hr/duration/elevation),
  runningFormat prompt-sectie + runningFallback (5km steady run), running-aware
  Schema/Uitleg/Workout weergave (afstand/pace/snelheid/HR-zone, "Interval X
  van Y", geen tempo-selector), 4 evaluatievragen (techniek/pacing/
  vermoeidheid/RPE — RPE en fatigue bewust gescheiden), Footprints-icon,
  README + Hoe werkt CoachOS bijgewerkt

---

# Nieuwe Chat Starten
Lees mijn README op
https://raw.githubusercontent.com/stuctech-eng/coachOS/refs/heads/main/README.md
en help me verder met CoachOS

---

# Standaard Werkwijze

## Nieuwe bestanden checklist
1. 'use client' bovenaan pagina
2. export const dynamic = 'force-dynamic' bovenaan API route
3. RLS policy indien nieuwe tabel
4. Altijd volledig bestand
5. README bijwerken
6. Hoe werkt CoachOS bijwerken indien relevant

## Bug flow
1. Buildlog → exacte fout lezen
2. Destructuring telt altijd queries — check met python script
3. Pagina scrollt niet → gebruik AppShell (body heeft overflow-hidden)
4. Icon crash → controleer lucide-react 0.400
5. 401 → aanroepen via router.push vanuit ingelogde pagina
6. .data?.parsed_data fout → query mist .single()
7. API route mag NOOIT andere interne API route fetchen, behalve /api/ai
8. coach_recommendations upserts ALTIJD met type kolom + onConflict 'user_id,date,type'
9. Nieuwe trainingsmodule? Check src/utils/equipment.ts of de module al een
   equipment-mapping heeft — anders is_module_available retourneert false en
   genereert Trainer AI hem nooit

## Technische standaarden
- API route: export const dynamic = 'force-dynamic'
- Pagina: 'use client'
- Auth: createServerClient + cookies → getUser()
- Database: createAdminClient()
- Navigatie: router.push() — nooit router.back()
- Anthropic: directe fetch via /api/ai — geen SDK, geen andere interne routes
- Afbeelding: sharp resize 800px JPEG 80%
- Pagina's zonder AppShell: aanroepen via router.push
- Pagina's die scrollen: gebruik AppShell
- Training sessie state: localStorage (SESSION_STORAGE_KEY), Supabase write
  alleen bij completed

## Voor Dick altijd
- Zip → naam + .zip → uitpakken → Working Copy → push
- Na deploy testen
- Overleggen voor bouwen
- README + Hoe werkt CoachOS altijd bijwerken
- Secrets NOOIT in de chat

## Strava Setup
- Client ID: 254388
- Callback: coach-os-tau.vercel.app
