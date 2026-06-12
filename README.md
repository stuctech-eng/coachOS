# CoachOS - Project Geheugen

## Project
- App naam: CoachOS
- Versie: 5.4.0
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

### Trainer AI (✅ Universal — v5.4)
- genereert sessies per module (kettlebell, rowing, running, cycling, strength, bodyweight)
- houdt rekening met equipment profiel — alleen oefeningen met beschikbaar materiaal
- adaptief op basis van experience, Body Battery, check-in (energie/stress/spierpijn), ratings, blessures
- output altijd: segments[] (oefeningen met sets/reps/duration/rest/instructie/cue/common_errors)
- fallback schema als AI parsing faalt — sessie kan altijd starten

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

E�n dynamische route `/training/session/[module]/page.tsx` voor alle sportmodules
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

# coach_recommendations — type kolom (v5.4.0)

E�n tabel, meerdere AI-outputs per dag, onderscheiden via `type` kolom om
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
    training-engine.ts                  klaar (v5.4 — Universal Training Engine types)
  app/
    api/
      action-plan/route.ts                klaar (v5.0)
      coach/route.ts                      klaar (v5.4 — type='coach' upsert)
      chat/route.ts                       klaar (v5.0)
      predictions/route.ts                klaar (v5.0)
      memory/route.ts                     klaar (v5.0)
      status/route.ts                     klaar (v4.3)
      weekly/route.ts                     klaar (v5.1 — vorige week op maandag)
      performance/route.ts                klaar (v5.1)
      equipment/route.ts                  klaar (v5.4 — GET/POST equipment profiel)
      training/
        today/route.ts                    klaar (v5.4 — lichtgewicht, 5 queries + fallback, type='training_today')
        session/route.ts                  klaar (v4.5)
        complete/route.ts                 klaar (v5.4 — perceived_effort/fatigue/soreness)
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
    settings/hoe-werkt-het/page.tsx       klaar (v5.4 — Training Engine sectie)
    settings/garmin-import/page.tsx       klaar (v4.7)
    training/
      page.tsx                            klaar (v5.4 — start → session/[module])
      session/[module]/page.tsx           klaar (v5.4 — Universal Training Engine V3)
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
training_sessions, training_results (+ perceived_effort/fatigue_after/soreness v5.4),
recovery_sessions, recovery_results, garmin_imports

---

# Huidige Staat (v5.4.0) — Volledig

Werkend:
- Login, onboarding, profiel, doelen, blessures, levensgebeurtenissen
- Check-in, weekly review (vorige week op maandag)
- Home: Coach Score + Check-in + Dagboek + "Vandaag van je Coach" (actie_type-knop) + Coach Chat/Week + Garmin status
- Coach AI — volledige context, plant BUITEN werktijden
- Inzichten: Garmin grafieken + Trends + Coach inzichten
- Garmin Vision Import — automatische compressie, stress + ademhaling
- Recovery AI — ademhaling, mobiliteit, wandeling
- Equipment profiel — Instellingen → Equipment
- Trainer AI — sessie generatie per module, equipment-aware, fallback schema
- Universal Training Engine V3 — schema → uitleg → automatische workout
  (tempo-systeem, Back/Volgend/Next/Pause, sessie herstel) → voltooid → evaluatie
- Performance AI — progressie analyse zichtbaar in Progressie tab
- Progressie dashboard + Performance AI sectie
- Hoe werkt CoachOS — alle secties incl. Universal Training Engine
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
- E8 Training Execution (Universal Training Engine): ✅ kettlebell, overige modules ⏳
- E9 Recovery Execution (Recovery AI): ✅
- E10 Garmin Vision Import: ✅
- E11 Progressie Dashboard: ✅
- E12 Gebruikersuitleg: ✅
- E13 Performance AI: ✅
- E14 Equipment Profiel: ✅
- E15 Universal Training Engine V3: ✅ (kettlebell)

---

# V5.5 - V5.10 Roadmap (modules op Universal Training Engine)

- V5.5.0 — Rowing Module (Concept2)
- V5.6.0 — Running Module
- V5.7.0 — Cycling Module
- V5.8.0 — Kettlebell uitbreiding (meer oefeningen/varianten)
- V5.9.0 — Strength Module (dumbbells + barbell)
- V5.10.0 — Bodyweight & Core Module

Elke module: eigen Trainer AI prompt + segment-type in
`src/types/training-engine.ts`, draait op dezelfde
`/training/session/[module]/page.tsx` engine.

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
