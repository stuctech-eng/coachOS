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

## Fase 2 — Verdieping (In Progress)

### Category B — Intensity Modules
**Doel:** Drill libraries toevoegen voor cardio modules

**Running drill library**
- easy run / recovery run / tempo run / interval run / fartlek / long run
- Elk met beschrijving, doelpace, hartslagzone
- Filter op niveau + coachDoel

**Cycling drill library**
- endurance ride / tempo ride / interval ride / recovery ride / sweetspot
- Filter op niveau + FTP percentage

**Rowing drill library**
- steady state / power intervals / technique focus / pyramid / race prep
- Filter op niveau + splits

### Progressie Engine
**Doel:** Data-driven progressie tracking

- Gewicht tracking per oefening over tijd
- Volume tracking (sets × reps × gewicht)
- Progressieregels (wanneer verhogen)
- Persoonlijke records per oefening
- Belastingsgrafiek in Progressie pagina

### Naam Matching Verbetering
- Automatische alias generatie bij bibliotheekupdate
- Logging van niet-gevonden namen voor aliassen uitbreiding

---

## Fase 3 — Uitbreiding

### Category C — Guided Modules
- Mobility module (30+ oefeningen)
- Recovery module (ademhaling, ontspanning, foam rolling)
- Warming-up module (dynamische warming-ups)

### Oefening Uitlegpagina's
- Aparte pagina per oefening met volledige uitleg
- Toegankelijk vanuit sessie én los
- Video placeholder per oefening

### iOS Shortcut Garmin Import
- Automatische dagelijkse Garmin sync
- Geen handmatige import meer nodig

### Meer Strava Data
- Route kaart per activiteit
- Splits per kilometer/interval
- Hartslag grafiek

---

## Fase 4 — Toekomst

### Adaptieve Coaching
- Coach past adviezen aan op basis van compliance history
- "Je negeert rustdagen vaak — plan we dit anders?"
- Seizoensgebonden planning

### Periodisering
- Macro/meso/micro cycles
- Piektraining voor evenementen
- Tapering protocollen

### Social Features
- Trainingslog delen
- Vergelijken met vorige week/maand
- Uitdagingen

### Wearable Integratie
- Apple Watch real-time hartslag
- Apple Health sync
- Whoop integratie

---

## Architectuurprincipes voor toekomstige ontwikkeling

Bij elke nieuwe feature:

1. **Bibliotheken eerst** — maak de data aan voor de UI
2. **Filter layer vóór AI** — AI assembleert, verzint niet
3. **Coach bepaalt, Trainer voert uit** — scheiding bewaken
4. **Bestaande code intact** — alleen uitbreiding, nooit afbraak
5. **Documenteer de beslissing** — update changelog.md
