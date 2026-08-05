# CoachOS Dataflow Audit — Fase 0.5

**Versie 1.0 — Status: Audit, geen implementatie**
**Sport:** Running (eerste van drie — Rowing en Cycling volgen apart)
**Methode:** per stap alleen "wie schrijft, wie leest, welke data" —
geen code gewijzigd, puur gevolgd. Elke stap is gemarkeerd:
**bevestigd** (code gelezen deze audit), **eerder bevestigd** (deze
week al vastgesteld), of **niet bevestigd** (aanname/gat, expliciet
benoemd).

---

## De keten, zoals 'm daadwerkelijk loopt

```
1. Coach Agenda / CoachPolicy   (bevestigd, laag 1 van Today Engine)
        │
        ▼
2. Today Engine                 (bevestigd, today-engine.ts)
        │
        ▼
3. [SPLITST HIER — twee paden, niet één]
        │
        ├── 3a. Specialist-sessie bestaat vandaag → "Open trainingsplan"
        │       (bevestigd)
        │
        └── 3b. Geen specialist-sessie → Trainer AI-vangnet → "Start Training"
                (bevestigd — dit pad raakt Running NIET als er een
                trainingsplan actief is)
        │
        ▼ (pad 3a, het relevante pad voor een actief Running-plan)
4. Running Specialist / Trainingsplan-pagina  (bevestigd — TOONT
   status, GEEN uitvoerings-UI)
        │
        ▼
5. Workout Player            ❌ NIET GEVONDEN voor Running — zie
   analyse hieronder
        │
        ▼
6. training_results          (bestaat, maar niet bevestigd dat een
   Running-sessie hier via deze route ooit binnenkomt)
        │
        ▼ (het pad dat WEL bevestigd is, via een compleet andere route)
7. Externe uitvoering (Garmin/Concept2/device) → TCX/API-import
        │
        ▼
8. activity_sessions          (bevestigd, deze week uitgebreid gebouwd)
        │
        ▼
9. Workout Matching Service   (bevestigd, deze week gebouwd + getest)
        │
        ▼
10. Performance Platform      (bevestigd, leest uitsluitend
    activity_sessions)
        │
        ▼
11. Universal Athlete Platform (bevestigd bestaand, rol niet
    diepgaand geverifieerd)
        │
        ▼
12. Learning Rules Engine     (bevestigd, volledig aangesloten)
        │
        ▼
13. Master Coach              (bevestigd bestaand, "kan dieper"
    volgens het README zelf)
```

---

## Per stap: schrijft / leest / data

### 1. Coach Agenda / CoachPolicy
- **Schrijft:** `coach_recommendations` (elders in de app, niet deze
  audit getraceerd tot de bron)
- **Leest:** `today-engine.ts` regel 190-194 — leest
  `coach_recommendations.actie_type` voor vandaag
- **Data:** `'trainen' | 'herstel' | 'rust'`
- **Status: bevestigd (deze audit).** Dit is "Laag 1: veiligheid" in
  Today Engine — als `rust`, stopt de keten hier volledig (geen
  training vandaag, punt).

### 2. Today Engine
- **Schrijft:** niets direct-persistent voor dit pad (behalve de
  rolling-horizon-verlenging, een side-effect op
  `training_plan_sessions` — apart mechanisme, niet dit dataflow-pad)
- **Leest:** `training_plans` (actieve plannen per sport) →
  `training_plan_sessions` (sessie van vandaag, via
  `haalSpecialistSessieVanVandaag()`)
- **Data:** `TrainingPlanSessie { id, type, duration, status,
  adjustment_reason, mesocycle_type }`
- **Status: bevestigd (deze audit, `today-engine.ts` volledig
  gelezen).** Bij meerdere gelijktijdige sport-voorstellen kiest
  `kiesTussenProposals()` via een Decision Engine (importance/
  calculated_urgency) — niet relevant voor de single-sport Running-trace.

### 3. Splitsing — dit is een bevinding op zich
**Niet één pad, zoals het diagram in de Final Architecture
veronderstelt, maar een expliciete either/or:** als er een
Running-sessie voor vandaag bestaat, wordt de Trainer AI-laag
(Laag 3 in `today-engine.ts`) **helemaal niet aangeroepen** — de
functie `return`t al bij `proposalNaarTodayPlan(gekozenProposal)`.
**Status: bevestigd (deze audit).**

### 4. Running Specialist / Trainingsplan-pagina
- **actionHref:** `/coach/running/trainingsplan` (uit
  `proposalNaarTodayPlan()`, bevestigd)
- **Leest:** `training_plan_sessions` (status, type, duur — bevestigd,
  `coach/running/trainingsplan/page.tsx` gelezen, 386 regels)
- **Schrijft:** niets gevonden op deze pagina
- **Bevinding, belangrijk:** deze pagina toont per sessie een
  statusicoon (`planned/scheduled/completed/skipped/adjusted/
  cancelled`) — **geen timer, geen "Start"-knop, geen RPE-invoer
  gevonden.** Dit is een planningsoverzicht, geen uitvoerings-UI.
- **Status: bevestigd (deze audit).**

### 5. Workout Player
**Niet gevonden voor Running.** Twee kandidaten onderzocht:
- `Trainer AI` (`api/training/today`) — bevestigd dat dit UITSLUITEND
  het vangnet-pad is (stap 3b), niet bereikbaar zolang er een actief
  Running-plan is. Dus dit IS niet de Workout Player voor een geplande
  Running-sessie.
- `session/[module]/page.tsx` (genoemd in `training/complete/route.ts`'s
  commentaar) — **kon niet opgehaald worden** (pad-gok gaf 404),
  dus niet bevestigd of dit voor Running gebruikt wordt of uitsluitend
  voor Kettlebell/Strength/Bodyweight (de sporten waarvoor
  `training_results` wél de enige waarheid is, per de Final
  Architecture-regel).
- **Voorlopige conclusie, met nadruk op voorlopig:** voor Running lijkt
  er in de huidige app **geen in-app uitvoeringsstap** te bestaan. De
  trainingsplan-pagina toont WAT er moet gebeuren; de training zelf
  wordt op een extern apparaat (Garmin-horloge) gedaan, niet in
  CoachOS zelf.
- **Status: NIET bevestigd — dit is de grootste onzekerheid in deze
  hele audit.** Vergt ofwel het juiste pad voor
  `session/[module]/page.tsx` vinden, ofwel bevestiging dat dit
  bewust zo is (Running heeft geen in-app uitvoering, per ontwerp).

### 6. `training_results`
- **Status: niet bevestigd dat een Running-sessie hier ooit
  binnenkomt.** Zoals vastgesteld in de eerdere Datamodelanalyse: de
  enige schrijvende route (`training/complete/route.ts`) bestaat en
  ondersteunt `training_type: 'running'` in principe (zie
  `exerciseTypeMap`), maar of dat pad in de praktijk ooit voor Running
  gebruikt wordt — i.p.v. uitsluitend voor Kettlebell/Strength/
  Bodyweight — is niet vastgesteld.

### 7. Externe uitvoering → import
**Dit IS het pad dat daadwerkelijk bevestigd en deze week grondig
getest is:** Garmin-horloge → TCX-export → handmatige upload
(`garmin-activity-tcx/route.ts`) of Concept2-sync. **Status: eerder
bevestigd (deze week, uitgebreid getest).**

### 8. `activity_sessions`
Canonical Activity Model — Source Isolation-principe geverifieerd.
**Status: eerder bevestigd.**

### 9. Workout Matching Service
`workout-matcher.ts` + `matchers/running-matcher.ts`. **Status: eerder
bevestigd, deze week gebouwd en doorgetest** (dry-run/forceer/reset via
debug-scherm, plus een echte her-upload getest).

### 10. Performance Platform
`running-grafieken.ts` → `load-engine.ts`, leest uitsluitend
`activity_sessions`. **Status: eerder bevestigd.**

### 11. Universal Athlete Platform
`athlete-platform/storage.ts`/`impact-engine.ts`. **Status: eerder
bevestigd bestaand — rol als zuivere Observer (nooit beslissend) niet
apart geverifieerd, zie Platform Audit punt 8.**

### 12. Learning Rules Engine
`evalueerRegels()`, IF-THEN. **Status: eerder bevestigd, "volledig
aangesloten".**

### 13. Master Coach
`api/coach/route.ts`, leest TodayPlan. **Status: eerder bevestigd
bestaand, zelf al erkend als "kan dieper" (Fase 4, README).**

---

## De kernbevinding van deze audit

**De keten uit de Final Architecture is voor Running NIET één
doorlopende lijn — hij splitst zich, en het middenstuk (Workout
Platform → Workout Player → training_results) lijkt voor Running in de
praktijk niet gebruikt te worden.** Wat wél bevestigd is: er bestaat
een volledig werkende, **parallelle** route om bij hetzelfde eindpunt
(`activity_sessions` → Matching → Performance) te komen, namelijk via
extern device + import. Die route is deze week grondig gebouwd en
getest.

**Dit is geen probleem dat opgelost hoeft te worden — het kan
uitstekend een bewuste, correcte situatie zijn:** een hardloop- of
fietstraining ís iets dat je buiten doet, met een horloge om, niet iets
waarvoor je een timer in een telefoon-app nodig hebt (in tegenstelling
tot bijvoorbeeld Kettlebell, waar een in-app timer wél logisch is).

**Maar dat is een aanname, geen bevestiging.** De enige manier om dit
zeker te weten: navragen bij de gebruiker of bevestigen via
`session/[module]/page.tsx` (nog niet gevonden) of een ander bestand
dat wél een Running-sessie in-app laat "starten".

---

## Aanbeveling

**Eén gerichte vraag aan de gebruiker beantwoordt dit volledig, zonder
verder codeonderzoek:**

> Doorloop je een geplande Running-training ooit in de app zelf (een
> "Start Training"-knop, timer, tussentijdse instructies), of ga je
> altijd los met je Garmin-horloge en importeer je het resultaat
> achteraf?

Als het antwoord "altijd extern, nooit in-app" is: dan is de
"Workout Player"-vraag voor Running/Cycling/Rowing **al beantwoord** —
er is geen bestaande code om te herzien, en de Final Architecture's
Workout Player-laag is voor deze drie sporten grotendeels
**theoretisch/toekomstig**, niet een bestaand onderdeel dat "fout"
gebruikt wordt. Dat zou het risico van dit onderdeel drastisch
verkleinen t.o.v. wat de Platform Audit (Fase 0) veronderstelde — de
zorg was "levende code die verkeerd gebruikt wordt", maar het kan ook
zijn dat er voor cardio-sporten simpelweg geen in-app-uitvoeringscode
bestaat om te breken.

**Rowing/Cycling zijn nog niet getraceerd** — gezien de sterke
structurele gelijkenis (zelfde Today Engine-patroon, zelfde
Training Plan Engine-adapters) is de verwachting dat beide dezelfde
keten volgen als Running, maar dat is nog niet bevestigd per sport.
