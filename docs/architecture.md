# CoachOS — Architectuur

## 1. Kernprincipe

```
Coach bepaalt. Bibliotheek levert. Trainer voert uit. Data bewijst.
```

CoachOS is geen AI die oefeningen verzint. Het is een systeem waarbij:
- **Coach** de richting bepaalt op basis van data
- **Bibliotheek** de beschikbare oefeningen levert
- **Trainer AI** assembleert de beste sessie uit de gefilterde lijst
- **Data** (RPE, mood, progressie) terugvloeit naar de coach

---

## 2. De Drie Lagen

### Laag 1 — Coach
De coach is de strategische laag. Hij bepaalt:
- Wat vandaag nodig is (trainen / herstel / rust)
- Welke intensiteit passend is
- Welke beperkingen gelden (blessures, vermoeidheid)
- Wat de trainer moet doen en laten

**Input van de coach:**
- Check-in (gevoel, energie, stress, spierpijn)
- Garmin data (Body Battery, slaap, HRV, stappen)
- Trainingsbelasting laatste 7 dagen
- Blessures
- Coach Call evaluaties (RPE, mood, notities)
- Dagboek notities
- Life-events (reizen, stress, feestdagen)
- Weerbericht (temperatuur, regen, wind)
- Oefening progressie trends (laatste 30 dagen)
- Gemiddelde RPE trend
- Belastingtrend t.o.v. vorige week
- Coach geheugen (patronen uit eerdere sessies)

**Output van de coach:**
- Actie type: trainen / herstel / rust
- Aanbeveling (één concrete actie)
- Advice bullets (3-4 punten)
- Trainer instructies (directe instructie aan Trainer AI)
- Dagplan (tijdgebonden acties)

### Laag 2 — Bibliotheek
De bibliotheek is de bron van waarheid. Trainer AI mag NOOIT oefeningen verzinnen buiten de bibliotheek.

| Bibliotheek | Bestand | Modules |
|-------------|---------|---------|
| Bodyweight | `src/lib/bodyweight-exercises.ts` | 120 |
| Strength | `src/lib/strength-exercises.ts` | 100 |
| Kettlebell | `src/lib/kettlebell-exercises.ts` | 102 |
| Mobility | `src/lib/mobility-exercises.ts` | 20 |
| Recovery | `src/lib/recovery-exercises.ts` | 12 |
| Running drills | `src/lib/running-drills.ts` | 13 |
| Rowing drills | `src/lib/rowing-drills.ts` | 12 |
| Cycling drills | `src/lib/cycling-drills.ts` | 11 |
| **Totaal** | | **390** |

### Laag 3 — Trainer AI
De Trainer AI is de uitvoerende laag. Hij:
- Krijgt de coach instructies
- Ontvangt een gefilterde lijst uit de bibliotheek
- Assembleert de beste sessie uit die lijst
- Bepaalt volgorde, sets, duur, rust

**Wat de Trainer WEL doet:**
- ✅ Oefeningen selecteren uit de gefilterde lijst
- ✅ Volgorde bepalen
- ✅ Sets, reps, duur, rust bepalen
- ✅ Sessietype kiezen (recovery/endurance/tempo/interval)
- ✅ Coaching cues geven per oefening

**Wat de Trainer NIET doet:**
- ❌ Nieuwe oefeningen verzinnen
- ❌ Subtypes verzinnen die niet in de bibliotheek staan
- ❌ Coach instructies negeren
- ❌ Equipment gebruiken dat niet beschikbaar is

---

## 3. Optie C Filter Architectuur

```
Coach bepaalt doel
    ↓
Route filtert bibliotheek op doel + niveau + equipment
    ↓
Trainer AI krijgt gefilterde lijst
    ↓
Trainer assembleert sessie uit die lijst
    ↓
UI toont bibliotheekdata (niet AI-tekst)
```

Alle filters actief in `src/app/api/training/today/route.ts`:

```typescript
filterKettlebell(doel, niveau)     → kettlebellContext
filterStrength(doel, equipment)    → strengthContext
filterOpCoachDoel(doel)            → bodyweightContext
filterMobility(doel, lichaamsdeel) → mobilityContext
filterRecovery(doel, type)         → recoveryContext
filterRunning(doel, niveau)        → runningContext
filterRowing(doel, niveau)         → rowingContext
filterCycling(doel, niveau)        → cyclingContext
```

---

## 4. De Coaching Cirkel

```
Coach advies
    ↓
Gebruiker beslist (trainen / herstel / bibliotheek)
    ↓
Training uitgevoerd
    ↓
RPE + Mood evaluatie
    ↓
exercise_records opgeslagen (gewicht, reps, duur per oefening)
    ↓
Coach Call (coach reageert op evaluatie)
    ↓
Coach onthoudt patronen
    ↓
Nieuw coach advies (met progressie context)
```

---

## 5. Progressie Systeem

### Tabel: exercise_records
Elke voltooide oefening wordt opgeslagen:
```sql
exercise_id, exercise_name, exercise_type, module,
weight_kg, reps, duration_sec, distance_m, sets, rpe, performed_at
```

### Wat de coach ziet
```
Goblet Squat (kettlebell, 8×): 16kg → 20kg (+25%) ↑
Push-up (bodyweight, 6×): 12 → 15 reps (+25%) ↑
Gemiddelde RPE laatste 7 dagen: 7.1/10
Trainingsbelasting t.o.v. vorige week: +18%
```

### Progressie pagina
- Persoonlijke Records per oefening (filter op module)
- Oefening detail grafiek (tik op oefening)
- Volume per week grafiek
- Coach Rapport op aanvraag (analyse van 60 dagen data)

---

## 6. Herstelbibliotheek

De herstelbibliotheek is gebruiker-gestuurd — geen AI tussenkomst.

**Categorieën:**
- 🔵 **Ademhaling** (5): Box Breathing, 4-7-8, Coherent, Stress Reset, Diafragma
- 🟢 **Mobiliteit** (11): Nek & Schouders, Heup, Full Body, Hamstring, Heupbuiger, Onderrug, Thoracaal, Schouder, Kuit/Enkel, Herstel Flow, Wervelkolom
- 🟣 **Ontspanning** (5): Savasana, Body Scan, Progressieve Spierontspanning, Visualisatie Herstel, Cooling Down
- 🩵 **Wandelen** (2): Herstelwandeling, Wandeling in de Natuur

Elke categorie is inklapbaar. Bij terugkeren vanuit een sessie opent de juiste categorie automatisch.

---

## 7. Trainingsbibliotheek

De trainingsbibliotheek is gebruiker-gestuurd maar Trainer AI assembleert de sessie.

**Modules:**
- Kettlebell — Trainer AI kiest oefeningen & intensiteit
- Rowing — Trainer AI kiest sessietype
- Hardlopen — Trainer AI kiest sessietype
- Fietsen — Trainer AI kiest sessietype
- Kracht — Trainer AI kiest oefeningen
- Bodyweight & Core — Trainer AI kiest oefeningen

---

## 8. Weerbericht

Automatisch op de home pagina. Coach ontvangt weercontext.

**Flow:**
```
IP → ipapi.co (locatie) → Open-Meteo (weer) → home pagina + coach context
```

**Coach krijgt:**
```
Weer in Volendam: 22°C, Regen, wind 15 km/u.
Ochtend: 0mm, Middag: 4.4mm, Avond: 0mm.
Warm weer — let op hydratatie bij buitentraining.
```

---

## 9. Bijwerken van CoachOS

### Normale update flow
1. Bestanden aanpassen in Working Copy
2. Commit + Push naar GitHub (branch: main)
3. Vercel deploy automatisch (±45 seconden)
4. Controleer build log in Vercel dashboard

### Bij TypeScript errors
- Literal newlines in strings → gebruik `\n` escape of backtick template literals
- Type errors → voeg `as any` toe of definieer interface

### Bij database wijzigingen
1. SQL uitvoeren in Supabase SQL Editor
2. RLS policy aanmaken
3. Index aanmaken voor performance
4. Route aanpassen om nieuwe data te gebruiken

### Versienummering
- Patch (x.x.X) — bug fix, kleine UI aanpassing
- Minor (x.X.0) — nieuwe bibliotheek of module
- Major (X.0.0) — architectuurwijziging

---

## 10. Kritische Implementatieregels

1. **PWA gooit query params weg** → gebruik localStorage voor module keuze
2. **isLibrary detectie EERST** in useEffect vóór resume-dialog
3. **Nooit session/page.tsx** naast de `[module]` map
4. **AI calls altijd rechtstreeks** naar Anthropic API (niet via /api/ai proxy)
5. **useSearchParams altijd in Suspense boundary** (Next.js 14 vereiste)
6. **Literal newlines in strings** → altijd `\n` escape gebruiken

---

## 11. Bestandsstructuur (kern)

```
src/
├── app/
│   ├── api/
│   │   ├── coach/route.ts          — Dagelijks coach advies
│   │   ├── training/today/route.ts — Trainer AI + bibliotheek filters
│   │   ├── training/complete/route.ts — Opslaan + exercise_records
│   │   ├── progress-analysis/route.ts — Coach rapport op aanvraag
│   │   └── weather/route.ts        — Weerbericht (Open-Meteo)
│   ├── home/page.tsx               — Dashboard met weerbericht
│   ├── training/
│   │   ├── page.tsx                — Trainings- en herstelbibliotheek
│   │   ├── session/[module]/       — Universele sessie engine
│   │   └── recovery/
│   │       ├── breathing/          — Ademhaling sessies
│   │       ├── mobility/           — Mobiliteit sessies
│   │       ├── walk/               — Wandeling sessies
│   │       └── relaxation/         — Ontspanning sessies
│   └── progressie/page.tsx         — Progressie + PR's + Coach Rapport
├── lib/
│   ├── bodyweight-exercises.ts
│   ├── strength-exercises.ts
│   ├── kettlebell-exercises.ts
│   ├── mobility-exercises.ts
│   ├── recovery-exercises.ts
│   ├── running-drills.ts
│   ├── rowing-drills.ts
│   └── cycling-drills.ts
└── core/
    ├── prompts/daily-coach.ts      — Coach prompt builder
    └── ai-engine/recovery-engine.ts
```

---

## 12. Supabase Schema (kern)

```sql
training_results     — sessielaag (duur, RPE, type, rating)
exercise_records     — detaillaag (oefening, gewicht, reps per set)
progress_analyses    — coach rapporten op aanvraag (24u cache)
coach_recommendations — dagadvies + compliance
coach_calls          — evaluatie na training
coach_memory         — coach geheugen / patronen
garmin_imports       — Garmin screenshot data
injuries             — actieve blessures
user_goals           — actieve doelen
life_events          — reizen, stress, feestdagen
```

---

## 13. Trainer Rule — De Absolute Architectuurgregel

```
TRAINER RULE:
De Trainer AI mag uitsluitend oefeningen,
drills, stretches of herstelmodules gebruiken
die in een CoachOS-bibliotheek bestaan.

De Trainer bepaalt:
  - selectie uit de gefilterde lijst
  - volgorde
  - intensiteit
  - sets, reps, duur, rust

De bibliotheek bepaalt:
  - wat bestaat
  - wat beschreven staat
  - wat de gebruiker ziet
```

**Schaalbaarheid:**
Voeg een oefening toe aan de bibliotheek → Trainer kan hem automatisch gebruiken.
Geen aanpassingen aan de AI nodig. Geen nieuwe prompts.

