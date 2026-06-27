# CoachOS — Master Architecture Spec (v2)

## 0. Kernprincipe

CoachOS is een **data-first training engine** met AI als uitvoerende coach laag.

> De AI is nooit de bron van waarheid.
> De bron van waarheid is altijd de bibliotheek.

---

## 1. De 7 Architectuurregels (niet onderhandelbaar)

1. **Libraries are the source of truth.** Oefeningen, beschrijvingen, tips, fouten en spieren komen altijd uit de bibliotheek — nooit van de AI.
2. **AI never creates exercises.** AI mag geen oefeningen verzinnen buiten de gefilterde lijst.
3. **Filter first, assemble second.** Route filtert op doel/niveau/equipment → AI assembleert uit die set.
4. **Equipment is a hard constraint.** Geen dumbbell in het profiel = geen dumbbell oefeningen in de sessie.
5. **Progression is data-driven.** Niveau, volume en belasting zijn data — geen AI-inschatting.
6. **Explanations come from libraries.** Uitlegpagina toont bibliotheekdata. AI-data is fallback, nooit primair.
7. **AI provides coaching cues only.** AI geeft één coaching tip per oefening. Dat is de enige AI-bijdrage in de uitleg.

---

## 2. Universele 3-staps Pipeline

Alle modules volgen exact dezelfde pipeline:

```
Stap 1 — Context input
  trainingType, doel, niveau, equipment

Stap 2 — FILTER LAYER (hard rule)
  Filter op trainingType → doel → niveau → equipment
  ❗ AI werkt NOOIT buiten deze gefilterde set

Stap 3 — AI ASSEMBLY LAYER
  AI selecteert uit gefilterde lijst
  AI structureert de training (volgorde, sets, reps)
  AI geeft coaching cues
  ❗ AI verzint GEEN nieuwe oefeningen
```

---

## 3. Module Classificatie

### A. Structured Training Modules
**Bodyweight / Strength / Kettlebell**

- Volledige oefenbibliotheek met metadata
- Equipment constraints (hard filter)
- Sets / reps / formats (EMOM, AMRAP, circuits, ladders, complexes)
- Progressie via niveau en volume
- Uitlegpagina 100% bibliotheek-driven

### B. Intensity-Based Modules
**Running / Cycling / Rowing**

- Geen volledige oefenbibliotheek — drill structuur
- Intensiteitszones (recovery, endurance, tempo, interval, sprint)
- Progressie via duur, tempo en interval ratio
- Strava historiek als context voor de AI
- Uitlegpagina valt terug op AI-data (geen bibliotheek)

### C. Guided Modules (toekomst)
**Mobility / Recovery / Stretching**

- Context-based
- AI is meer coach dan assembler
- Geen vaste oefenstructuur

---

## 4. Bibliotheekstructuur

```typescript
// Alle structured modules gebruiken dit patroon
interface Oefening {
  id: string
  naam: string              // Nederlands, exact — AI gebruikt deze naam
  categorie: string
  lichaamsdelen: string[]
  doelen: string[]          // coach filtert hierop
  niveau: Niveau            // beginner | gemiddeld | gevorderd
  equipment?: string[]      // hard filter voor strength
  uitleg: string            // korte prompt-vriendelijke versie
  beschrijving: string      // volledige uitleg voor uitlegpagina
  tips: string[]
  fouten: string[]
  primaireSpieren: string[]
  secundaireSpieren: string[]
}
```

**Huidige bibliotheken:**
- `src/lib/bodyweight-exercises.ts` — 120 oefeningen
- `src/lib/strength-exercises.ts` — 100 oefeningen
- `src/lib/kettlebell-exercises.ts` — 102 oefeningen
- `src/lib/exercises.ts` — originele kettlebell bibliotheek (uitlegpagina's)

---

## 5. Optie C — De Filter Architectuur

```typescript
// Coach bepaalt doel
const coachDoel = coachActieType === 'herstel' ? 'herstel' : 'kracht'

// Route filtert bibliotheek
const beschikbaar = filterOpCoachDoel(coachDoel)

// Trainer AI krijgt alleen de gefilterde lijst
const context = `BESCHIKBARE OEFENINGEN:\n${formateerVoorPrompt(beschikbaar)}`

// AI prompt instructie (kritisch)
// "Gebruik UITSLUITEND de exacte naam zoals die in de lijst staat.
//  Gebruik GEEN vertalingen, varianten of alternatieve namen."
```

---

## 6. Uitlegpagina Architectuur

```
Oefening naam uit AI-response
    ↓
zoekInBibliotheek(naam, moduleType)
    ↓ (5-staps matching: exact → id → bevat → omgekeerd bevat → eerste woord)
    ↓
Gevonden in bibliotheek?
    ├── JA → beschrijving + spieren + tips + fouten uit bibliotheek
    │         + coaching cue van AI
    └── NEE → instruction + common_errors van AI (fallback)
```

**Volgorde in de UI:**
1. Beschrijving (bibliotheek)
2. Spieren (bibliotheek)
3. Tips (bibliotheek)
4. Veelgemaakte fouten (bibliotheek)
5. Coaching tip (AI)

---

## 7. Coach ↔ Trainer Scheiding

```
Coach (claude-sonnet):
  - Bepaalt of je mag trainen (rust/herstel/trainen)
  - Bepaalt het module type (normale flow)
  - Bepaalt de intensiteit
  - Geeft trainer_instructies mee
  - Onthoudt evaluaties (Coach Call)

Trainer (claude-haiku):
  - Filtert oefeningen op basis van coach beslissing
  - Assembleert de sessie
  - Mag NIET de module wijzigen
  - Mag GEEN nieuwe oefeningen verzinnen
  - Geeft coaching cues per oefening
```

---

## 8. Coaching Cirkel (volledig gesloten)

```
Coach advies
    ↓
Gebruiker beslist (volgt op of gaat toch trainen)
    ↓
Training uitgevoerd
    ↓
RPE + Mood (Coach Call evaluatie)
    ↓
Coach reflecteert (babbelbox)
    ↓
Coach onthoudt (volgende dag)
    ↓
Nieuw advies (past aan op basis van evaluatie)
```

**Coach Compliance:** berekent over 30 dagen hoe vaak adviezen worden opgevolgd en wat de uitkomst was bij afwijking.

---

## 9. Kritische Implementatieregels (PWA specifiek)

Deze regels zijn geleerd door fouten — niet onderhandelen:

1. **PWA gooit query params weg** bij `router.push()` op iOS. Gebruik altijd `localStorage` voor state-overdracht tussen pagina's.
2. **isLibrary detectie EERST** in de `useEffect` van `session/[module]/page.tsx` — vóór de resume-dialog check. Anders blokkeert een oude sessie de library-flow.
3. **Nooit `session/page.tsx`** naast de `[module]` map aanmaken — dit onderschept alle navigatie.
4. **AI calls altijd rechtstreeks** naar `https://api.anthropic.com/v1/messages`. Nooit via een `/api/ai` proxy — dit geeft 500 errors.
5. **Upsert op `coach_recommendations`:** altijd `update()` eerst + `insert()` fallback. Nooit `upsert()` met partial payload.
6. **Apostrofs escapen** in TypeScript strings — `\'` in Nederlandse tekst brak meerdere builds.

---

## 10. Database Architectuur

**Kern tabellen:**
- `profiles` — gebruiker profiel + equipment beschikbaarheid
- `coach_recommendations` — coach adviezen + training instructies (gecached per dag)
- `training_results` — voltooide trainingen + evaluaties
- `coach_calls` + `coach_call_items` — evaluaties per activiteit
- `activity_sessions` — Strava activiteiten
- `garmin_imports` — Garmin data
- `daily_checkins` — dagelijkse check-in
- `health_metrics` — gezondheidsdata
- `coach_memory` — AI-gegenereerde inzichten

**Caching strategie:**
- Coach advies: gecached per dag via `coach_recommendations` (type: 'coach')
- Training instructie: gecached per dag via `coach_recommendations` (type: 'training_today')
- Bibliotheek sessies: gecached per dag via `coach_recommendations` (type: 'library_[module]')
- Client-side: `localStorage` voor snelle toegang zonder API-call

---

## 11. Huidige Status

### ✅ Volledig geïmplementeerd
- Structured modules: Bodyweight (120), Strength (100), Kettlebell (102)
- Filter layer (Optie C) voor alle drie structured modules
- AI assembly layer — verzint geen oefeningen
- Equipment filtering (dumbbell/barbell/both)
- Uitlegpagina — bibliotheek is single source of truth
- Coaching cirkel — volledig gesloten (Coach Call Stap 1+2+3)
- Coach Compliance — 30 dagen statistieken

### 🟡 Gedeeltelijk geïmplementeerd
- Intensity modules (Running/Cycling/Rowing) — drill structuur werkt, geen aparte drill library
- Progressie systeem — niveau filtering werkt, geen gewichtsprogressie tracking
- Naam matching — aliassen map aanwezig, niet 100% dekkend

### ❌ Nog niet geïmplementeerd
- Drill library voor Running/Cycling/Rowing
- Gewicht/volume progressie tracking
- Guided modules (Mobility/Recovery) als aparte categorie
- iOS Shortcut Garmin import

---

## 12. De Trainer als Programmeur — Niet als Generator

Dit is de kern van de CoachOS architectuur:

```
Coach
    ↓ bepaalt doel, belasting, duur, beperkingen
Bibliotheek
    ↓ levert beschikbare oefeningen (gefilterd)
Trainer AI
    ↓ kiest beste combinatie, volgorde, sets, rust
Workout
    ↓ wordt uitgevoerd
Evaluatie
    ↓ gaat terug naar de coach
```

**Wat de Trainer AI NIET doet:**
- ❌ Nieuwe oefeningen verzinnen
- ❌ Nieuwe subtype-namen bedenken
- ❌ Oefeningen geven die niet in de bibliotheek staan
- ❌ Coach instructies negeren

**Wat de Trainer AI WEL doet:**
- ✅ Volgorde bepalen
- ✅ Sets en duur bepalen
- ✅ Rust bepalen
- ✅ Variatie aanbrengen binnen de gefilterde set
- ✅ Beste combinatie maken uit beschikbare oefeningen

**Schaalbaarheid:**
Voeg `Copenhagen Hold`, `Pigeon Stretch` of `Bear Crawl` toe aan de bibliotheek
en de Trainer kan ze automatisch gebruiken zodra ze binnen de coach filters vallen.
Geen aanpassingen aan de AI nodig. Geen nieuwe prompts. Geen nieuwe code.

CoachOS is schaalbaar zonder dat de AI steeds opnieuw geleerd hoeft te worden
welke oefeningen er bestaan.

---

## 13. Mobility Module — Huidige Status & Roadmap

**Huidig probleem:**
Mobility werkt als Categorie B (intensity-based) maar zou Categorie A moeten zijn.
AI verzint subtype namen → UI kent ze niet → verkeerde fallback.

**Roadmap:**

Stap 1 (nu): Extra schemas + betere fallback in `mobility/page.tsx`
Stap 2: `src/lib/mobility-exercises.ts` — 15-20 oefeningen
Stap 3: `src/lib/recovery-exercises.ts` — ademhaling, ontspanning
Stap 4: Alle bibliotheken samenvoegen onder `src/lib/exercises/`
Stap 5: Universele `allExercises.filter()` engine

**Doel:** Mobility wordt Categorie A — zelfde architectuur als bodyweight/strength/kettlebell.
