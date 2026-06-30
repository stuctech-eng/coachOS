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

## Openstaand

| Item | Prioriteit |
|------|-----------|
| GitHub tags aanmaken v2.0.4 t/m v2.3.5 | 🟡 |
| Life-events pagina testen | 🟡 |
| Exercise records vullen na eerste training | 🔄 automatisch |
| Fase 3B testen na data | 🔄 automatisch |

---

# CoachOS - Project Geheugen

## Project
- App naam: CoachOS
- Versie: 2.3.5
- App URL: https://coach-os-tau.vercel.app
- GitHub: https://github.com/stuctech-eng/coachOS
- Stack: Next.js 14.2.29, TypeScript, Supabase, Vercel, Claude API

## Supabase Tabellen (relevant)
- `training_results` — sessielaag (duur, RPE, type)
- `exercise_records` — detaillaag (oefening, gewicht, reps, sets, module) — v2.3.1
- `progress_analyses` — coach rapporten op aanvraag — v2.3.5
- `coach_recommendations` — dagadvies + compliance
- `coach_calls` — evaluatie na training

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
- v2.0.4 — Mobility bug fix (fallback neck_shoulders → full_body)
- v2.1.0 — Mobility Bibliotheek (20 oefeningen)
- v2.1.1 — Mobility filter in route
- v2.1.2 — Alle mobility schemas in herstelbibliotheek
- v2.2.0 — Recovery Bibliotheek (12 modules)
- v2.2.1 — Relaxation pagina + categorische herstelbibliotheek
- v2.2.2 — Scroll en navigatie fixes (terug → juiste categorie)
- v2.3.0 — Drill Libraries Running/Rowing/Cycling (36 drills)
- v2.3.1 — Exercise Records tabel + opslag bij voltooide training
- v2.3.2 — Progressie pagina met Persoonlijke Records
- v2.3.3 — Progressie Fase 2 (grafieken per oefening + volume per week)
- v2.3.4 — Coach Trendanalyse Fase 3A (eerste→laatste, % verandering)
- v2.3.5 — Coach Rapport op aanvraag Fase 3B (progress-analysis route)

- v2.4.0: Exercise Illustraties + Archief.
  illustratie veld toegevoegd aan BibliotheekOefening interfaces.
  Kettlebell Swing eerste oefening met mannequin-stijl illustratie
  (public/exercises/kettlebell-swing.png). UitlegScherm toont
  illustratie boven Doelwaarden als beschikbaar.
  Nieuw: /archief pagina — alle 354 oefeningen doorbladerbaar per
  categorie, los van coach advies. Zoekfunctie, direct te starten,
  evaluatie werkt via bestaande sessie-engine.

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
