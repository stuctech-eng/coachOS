# CoachOS — Roadmap

## Fase 1 — Fundamenten (✅ Voltooid v1.0 - v2.0)

- ✅ Coach AI dagadvies (herstel/rust/trainen)
- ✅ Trainer AI sessiegeneratie
- ✅ Kettlebell module
- ✅ Rowing module (Concept2)
- ✅ Running module
- ✅ Cycling module
- ✅ Trainingsbibliotheek (gebruiker kiest module)
- ✅ Evaluatie systeem (RPE + mood)
- ✅ Coach Call (evaluatie → coach reageert)
- ✅ Coach onthoudt (Stap 1+2+3)
- ✅ Coach Compliance (30 dagen statistieken)
- ✅ Strava integratie
- ✅ Garmin integratie
- ✅ Bodyweight bibliotheek (120 oefeningen)
- ✅ Strength bibliotheek (100 oefeningen)
- ✅ Kettlebell bibliotheek (102 oefeningen)
- ✅ Uitlegpagina bibliotheek-driven
- ✅ Optie C filter architectuur

---

## Fase 2 — Verdieping (✅ Voltooid v2.0 - v2.3)

- ✅ Mobility bibliotheek (20 oefeningen)
- ✅ Recovery bibliotheek (12 modules)
- ✅ Relaxation pagina (6 sessies)
- ✅ Herstelbibliotheek inklapbaar per categorie
- ✅ Scroll naar categorie bij openen
- ✅ Terug → juiste categorie blijft open
- ✅ Running drill library (13 drills)
- ✅ Rowing drill library (12 drills)
- ✅ Cycling drill library (11 drills)
- ✅ Trainer Rule — AI mag alleen uit bibliotheek kiezen (alle modules)
- ✅ Life-events module

---

## Fase 3 — Progressie (✅ Voltooid v2.3)

- ✅ exercise_records tabel (Supabase)
- ✅ Oefeningen opslaan bij voltooide training
- ✅ Persoonlijke Records per oefening
- ✅ Filter op module (kettlebell/bodyweight/strength/etc.)
- ✅ Oefening detail grafiek (gewicht/reps over tijd)
- ✅ Volume per week grafiek
- ✅ Coach trendanalyse Fase 3A (eerste→laatste, % verandering)
- ✅ Coach Rapport op aanvraag Fase 3B (maandrapport)
- ✅ progress_analyses tabel met 24u cache

---

## Fase 4 — Uitbreiding (Volgende)

### Openstaand
- 🟡 GitHub tags aanmaken v2.0.4 t/m v2.3.5
- 🟡 Life-events pagina testen
- 🟡 Exercise records vullen na eerste training post-v2.3.1

### Warming-up Module
- Dynamische warming-up bibliotheek
- Coach koppelt warming-up aan training type
- 10-15 warming-up drills

### Oefening Uitlegpagina's
- Aparte pagina per oefening met volledige uitleg
- Toegankelijk vanuit sessie én los
- Tips + veelgemaakte fouten

### Progressie Fase 4
- Deload detectie (belasting stijgt te snel)
- Coach stelt automatisch progressie voor
- "Je Goblet Squat staat 3 weken op 20kg — tijd voor 22kg"

### iOS Shortcut Garmin Import
- Automatische dagelijkse Garmin sync
- Geen handmatige import meer nodig

---

## Fase 5 — Toekomst

### Adaptieve Coaching
- Coach past adviezen aan op basis van compliance history
- Seizoensgebonden planning

### Periodisering
- Macro/meso/micro cycles
- Piektraining voor evenementen
- Tapering protocollen

### Wearable Integratie
- Apple Watch real-time hartslag
- Apple Health sync

### Universele Exercise Database
```
src/lib/exercises/
    kettlebell.ts
    bodyweight.ts
    mobility.ts
    recovery.ts
    running.ts
    rowing.ts
    cycling.ts
```
Met één gedeeld `Exercise` interface en `allExercises.filter()` als universele engine.

---

## Architectuurprincipes

Bij elke nieuwe feature:

1. **Bibliotheken eerst** — maak de data aan voor de UI
2. **Filter layer vóór AI** — AI assembleert, verzint niet
3. **Coach bepaalt, Trainer voert uit** — scheiding bewaken
4. **Bestaande code intact** — alleen uitbreiding, nooit afbraak
5. **Documenteer de beslissing** — update changelog.md
6. **Trainer Rule** — AI mag NOOIT oefeningen verzinnen buiten de bibliotheek
