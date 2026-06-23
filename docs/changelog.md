# CoachOS — Changelog & Architectuurbeslissingen

## Architectuurbeslissingen

### AD-001: Optie C Filter Architectuur
**Beslissing:** Coach bepaalt doel → route filtert bibliotheek → AI assembleert uit gefilterde lijst.
**Reden:** Voorkomt AI-hallucinaties in oefeningen. Bibliotheek is single source of truth.
**Alternatieven overwogen:** A (AI genereert alles), B (route geeft volledige lijst)
**Status:** Geïmplementeerd v1.9.1+

### AD-002: Aparte bibliotheekbestanden
**Beslissing:** `bodyweight-exercises.ts`, `strength-exercises.ts`, `kettlebell-exercises.ts` apart van `exercises.ts`.
**Reden:** Verschillende structuur en metadata. Kettlebell `exercises.ts` blijft voor bestaande uitlegpagina's.
**Status:** Geïmplementeerd v1.9.1+

### AD-003: Uitlegpagina bibliotheek-driven
**Beslissing:** `zoekInBibliotheek()` matcht AI oefening naam met bibliotheek. Bibliotheek heeft prioriteit.
**Reden:** Consistente, Nederlandse uitleg zonder AI-hallucinaties. AI geeft alleen coaching cue.
**Volgorde:** Beschrijving → Spieren → Tips → Fouten → Coaching tip (AI)
**Status:** Geïmplementeerd v2.0.2+

### AD-004: PWA localStorage voor state-overdracht
**Beslissing:** Gebruik altijd `localStorage` voor state-overdracht tussen pagina's in de PWA.
**Reden:** iOS PWA gooit query parameters weg bij `router.push()`. Dit brak de bibliotheek routing.
**Implementatie:** `library_module_pending` + `library_module_datum` in localStorage vóór navigatie.
**Status:** Geïmplementeerd v1.8.7+

### AD-005: isLibrary detectie vóór resume-dialog
**Beslissing:** isLibrary detectie staat ALTIJD vóór de resume-dialog check in de useEffect.
**Reden:** Een oude gecachede sessie activeerde de resume-dialog en blokkeerde de library-flow.
**Status:** Geïmplementeerd v1.8.7+

### AD-006: Coaching cirkel gesloten
**Beslissing:** Coach onthoudt evaluaties (RPE + mood) en past dagadvies aan.
**Implementatie:** Coach Call (Stap 1: routing, Stap 2: bibliotheek-trainingen, Stap 3: coach leest terug)
**Status:** Volledig geïmplementeerd v1.8.8 + v1.8.9

### AD-007: Strength is uitbreiding, geen nieuw systeem
**Beslissing:** Strength volgt exact hetzelfde patroon als Bodyweight. Geen nieuwe architectuur.
**Reden:** Consistentie in de codebase. Coach bepaalt, Trainer voert uit.
**Status:** Geïmplementeerd v1.9.5+

---

## Versiehistorie

### v2.0.3 (2026-06-23)
- Bibliotheek naam matching verbeterd — 80+ aliassen map
- Prompt instructie: AI gebruikt exact bibliotheek namen
- Fix: "Bodyweight Squats" → Air Squat, "Push-ups" → Push-Up

### v2.0.2 (2026-06-23)
- Uitlegpagina gekoppeld aan bibliotheek (zoekInBibliotheek)
- Volgorde: Beschrijving → Spieren → Tips → Fouten → Coaching tip
- AI geeft alleen coaching cue, bibliotheek is de rest

### v2.0.1 (2026-06-23)
- Kettlebell filter (Optie C) toegevoegd aan training/today/route.ts
- Alle drie bibliotheken actief: kettlebell + bodyweight + strength
- Fix: hypertrofie → kracht in KettlebellDoel type

### v2.0.0 (2026-06-23)
- Kettlebell bibliotheek volledig — 102 oefeningen
- CoachOS totaal: 322 oefeningen (Bodyweight 120 + Strength 100 + Kettlebell 102)

### v1.9.9 (2026-06-23)
- Strength bibliotheek compleet — 100 oefeningen

### v1.9.8 (2026-06-23)
- Strength Fase 4 — 85 oefeningen

### v1.9.7 (2026-06-23)
- Strength Fase 3 — 70 oefeningen

### v1.9.6 (2026-06-23)
- Strength Fase 2 — 53 oefeningen
- Fix: strength_available type error in route

### v1.9.5 (2026-06-23)
- Strength Bibliotheek Fase 1 — 30 oefeningen
- STRENGTH FORMAT toegevoegd aan training/today/route.ts
- Optie C voor strength module

### v1.9.4 (2026-06-23)
- Bodyweight bibliotheek compleet — 120 oefeningen

### v1.9.3 (2026-06-23)
- Bodyweight Fase 3 — 96 oefeningen

### v1.9.2 (2026-06-23)
- Bodyweight Fase 2 — 65 oefeningen

### v1.9.1 (2026-06-23)
- Bodyweight Bibliotheek Fase 1 — 30 oefeningen
- Optie C architectuur geïmplementeerd
- BODYWEIGHT FORMAT toegevoegd aan training/today/route.ts

### v1.9.0 (2026-06-22)
- Coach Compliance — 30 dagen statistieken in Progressie pagina
- /api/compliance/route.ts nieuw endpoint

### v1.8.9 (2026-06-22)
- Coach Call Stap 3 — coach leest evaluatiedata terug
- coach/route.ts haalt recente coach_calls op als context

### v1.8.8 (2026-06-22)
- Coach Call Stap 2 — bibliotheek-trainingen triggeren Coach Call
- training/complete/route.ts: auto-aanmaken coach_call item
- DB: training_result_id toegevoegd aan coach_call_items

### v1.8.7 (2026-06-22)
- Bibliotheek routing-fix — alle modules werken correct
- localStorage voor state-overdracht (AD-004)
- isLibrary detectie vóór resume-dialog (AD-005)
- session/page.tsx verwijderd (blokkeerde [module] route)

### v1.9.0 — v1.8.2 (zie README voor volledige history)
