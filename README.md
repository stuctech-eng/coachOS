# CoachOS - Project Geheugen

## Project
- App naam: CoachOS
- Versie: 4.3.0
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

---

# CoachOS V4.0 — AI Architectuur

## Kernvisie
CoachOS is een AI Coaching Operating System.
Observe → Learn → Predict → Coach → Execute → Learn Again

## AI Lagen

### Coach AI (Master Brain — Altijd Leidend)
- bepaalt training vs herstel vs rust
- analyseert alle data + trends + Garmin data
- genereert dagplannen + voorspellingen
- interpreteert resultaten

### Trainer AI (⬜ nog te bouwen)
Input: { type, duration, intensity }
Output: volledige training sessie

### Recovery AI — Execution Engines (✅ gebouwd)

RecoveryEngine
├── BreathingEngine (phase-based timer)
├── MobilityEngine (sequence-based flow)
└── WalkEngine (single timer)

**BreathingEngine:** vaste fases met timers, ritmisch/cycle-based
**MobilityEngine:** stap-voor-stap oefeningen, per oefening timer, volgende navigatie
**WalkEngine:** één countdown timer, minimale UI

---

## System Flow
USER DATA + GARMIN DATA → COACH AI → TRAINER AI / RECOVERY AI → RESULT DATA → COACH AI (learning)

## Harde Regels
1. Coach AI is altijd leidend
2. Trainer AI bepaalt nooit training noodzaak
3. Recovery AI bepaalt nooit herstel noodzaak
4. Home is command center
5. Training = uitvoering
6. Inzichten = analyse
7. Coach = AI interface

---

# Navigatie V4.0
Home | Training | Inzichten | Coach | Instellingen

---

# Data Strategie V4.3

## Garmin Import (✅ primaire databron)
- Dagelijkse screenshot van Garmin Connect "In één oogopslag"
- Claude Vision leest data uit: rusthartslag, Body Battery, slaapscore, slaapduur, HRV (7d gem.), calorieën, stappen
- Pipeline: foto → Vision → normalize → validate → store → confirm
- Opgeslagen in: `garmin_imports` tabel
- Daily lock: één confirmed record per user per dag (Europe/Amsterdam timezone)
- Reminder banner op Home als import nog niet gedaan

## Apple Health (❌ niet in gebruik)
- Werkte niet betrouwbaar via Garmin → Apple Health → Shortcut
- Vervangen door Garmin Vision Import
- Routes blijven staan maar worden niet actief gebruikt

## Strava (✅ actief)
- Activiteiten sync via OAuth
- GPX/TCX import

---

# Recovery System V1 (✅ Gebouwd)

## Ademhaling
- Box Breathing (4-4-4-4)
- 4-7-8 Ademhaling
- Coherent Breathing
- Stress Reset

## Mobiliteit
- Nek & Schouders (6 oefeningen)
- Heup mobiliteit (8 oefeningen)
- Full Body (8 oefeningen)

## Wandeling
- Herstelwandeling (timer engine)

## Herstelbibliotheek
Alle modules beschikbaar via Training tab → Herstelbibliotheek (handmatige keuze)

---

# Training System

## Kettlebell V1 Oefeningen (⬜ Trainer AI nog te bouwen)
Swing, Goblet Squat, Deadlift, Clean, Press, Clean & Press, Turkish Get-Up, Farmer Carry

## Coach AI beslissing
- `/api/training/today` gecached per dag
- Beslist: trainen/herstellen, type, duur, intensiteit, recovery modules
- Toont plan op Training tab

---

# Bestandsstructuur

src/
  app/
    api/
      ai/route.ts                         klaar
      checkin/route.ts                    klaar (v3.5)
      coach/route.ts                      klaar (v4.3 — Garmin data in context)
      memory/route.ts                     klaar (v3.6)
      profile/route.ts                    klaar
      profile/update/route.ts             klaar
      goals/route.ts                      klaar
      weekly/route.ts                     klaar
      activities/route.ts                 klaar
      status/route.ts                     klaar (v4.3 — Garmin data in score)
      chat/route.ts                       klaar (v3.1)
      injuries/route.ts                   klaar (v3.3)
      life-events/route.ts                klaar (v4.1)
      action-plan/route.ts                klaar (v4.3 — Garmin Body Battery + slaap)
      predictions/route.ts                klaar (v3.7)
      trends/route.ts                     klaar (v3.6)
      training/
        today/route.ts                    klaar (v4.2 — Coach AI beslissing)
        session/route.ts                  ⬜ nog te bouwen (Trainer AI)
        complete/route.ts                 ⬜ nog te bouwen
      recovery/
        complete/route.ts                 klaar (v4.2 — resultaat opslaan)
        session/route.ts                  ⬜ optioneel
      health/
        garmin-vision/route.ts            klaar (v4.3 — Vision pipeline)
        shortcut/route.ts                 klaar (niet actief)
        apikey/route.ts                   klaar (niet actief)
        metrics/route.ts                  klaar (niet actief)
      strava/
        auth/route.ts                     klaar
        callback/route.ts                 klaar
        sync/route.ts                     klaar
    login/page.tsx                        klaar
    register/page.tsx                     klaar
    onboarding/page.tsx                   klaar
    home/page.tsx                         klaar (v4.3 — Garmin reminder banner)
    checkin/page.tsx                      klaar (v3.5)
    insights/page.tsx                     klaar (v4.3 — Garmin grafieken, inklapbare secties)
    settings/page.tsx                     klaar (v4.3 — Apple Health weg, Garmin knop)
    profile/page.tsx                      klaar
    goals/page.tsx                        klaar
    activities/page.tsx                   klaar
    weekly/page.tsx                       klaar
    chat/page.tsx                         klaar (v3.6)
    injuries/page.tsx                     klaar (v3.3)
    life-events/page.tsx                  klaar (v4.1)
    training/
      page.tsx                            klaar (v4.2 — Coach AI plan + bibliotheek)
      recovery/
        breathing/page.tsx                klaar (v4.2 — BreathingEngine)
        mobility/page.tsx                 klaar (v4.2 — MobilityEngine)
        walk/page.tsx                     klaar (v4.2 — WalkEngine)
    settings/
      garmin-import/page.tsx              klaar (v4.3 — upload UI + preview + confirm)
    layout.tsx                            klaar
    page.tsx                              klaar
  components/
    ui/index.tsx                          klaar (v3.5)
    layout/index.tsx                      klaar (v4.0 — nieuwe navigatie)
  core/
    ai-engine/recovery-engine.ts          klaar (v3.5)
    prompts/
      daily-coach.ts                      klaar (v3.7 — goal-specific)
      trainer-ai.ts                       ⬜ nog te bouwen
    engines/
      training-engine.ts                  klaar (v3.0)
      lifestyle-engine.ts                 klaar (v3.0)
      coach-score-engine.ts               klaar (v3.0)
      risk-engine.ts                      klaar (v3.0)
  hooks/
    useAuth.ts                            klaar
    useCoach.ts                           klaar (v3.5)
  lib/
    supabase.ts                           klaar
  store/
    index.ts                              klaar
  types/
    index.ts                              klaar
  utils/
    index.ts                              klaar

---

# Supabase Tabellen

Bestaand:
- profiles
- user_goals
- daily_checkins (v3.5: + stress/motivatie/spierpijn/slaap)
- health_metrics (niet actief — vervangen door garmin_imports)
- coach_memory
- coach_recommendations (v4.2: + training_instruction jsonb)
- activities
- activity_sessions
- activity_templates
- strava_tokens
- health_api_keys (niet actief)
- knowledge_observations
- ai_conversations
- daily_status (v3.0: + scores + risk_flags)
- injuries (v3.3)
- life_events (v4.1: + recurrence_days, recurrence_end_date, vacation_type, end_date)
- training_sessions (v4.0: aangemaakt, nog niet in gebruik)
- training_results (v4.0: aangemaakt, nog niet in gebruik)
- recovery_sessions (v4.2: in gebruik)
- recovery_results (v4.2: in gebruik)
- garmin_imports (v4.3: primaire health databron)
  - user_id, date (UNIQUE per user+dag)
  - raw_vision_response (jsonb)
  - parsed_data (jsonb): resting_hr, body_battery, sleep, hrv, calories, steps
  - validation_flags (jsonb)
  - confidence_score (int)
  - status: pending | confirmed | flagged

---

# Garmin Vision Import — Schema

```json
{
  "resting_hr": 43,
  "body_battery": { "current": 66, "charged": 55, "spent": 36 },
  "sleep": { "score": 84, "duration_minutes": 526 },
  "hrv": { "avg_7d_ms": 49, "status": "balanced" },
  "calories": { "active": 285, "rest": 1401, "total": 1686 },
  "steps": { "value": 6811, "goal": 6870 },
  "meta": { "source": "garmin_screenshot", "parsed_at": "timestamp" }
}
```

Validatieregels:
- resting_hr: 25–100
- body_battery: 0–100
- sleep.score: 0–100
- sleep.duration_minutes: 60–840
- hrv.avg_7d_ms: 10–200
- steps.value: 0–60.000
- calories.total cross-check: active + rest ± 10

---

# Huidige Staat

Werkend:
- Login/register, onboarding
- Check-in (stress/motivatie/spierpijn/slaap)
- Home: Coach Score + Daily Briefing + Dagplan + Voorspellingen + Garmin reminder
- Coach Score automatisch berekend (gebruikt Garmin data als fallback)
- Risk Engine
- AI Coach Chat + wis-bevestiging
- Coach memory dagelijks vers
- Inzichten: inklapbare secties (Trends, Garmin 14d, Coach inzichten) + grafieken
- Voorspellingen + Dagplan gecached per dag
- Dagplan weekend-aware + Garmin-aware (Body Battery, slaap, HRV)
- Goal-specific coaching
- Coach AI gebruikt Garmin data: rusthartslag, Body Battery, slaap, HRV, stappen
- Strava sync + Garmin GPX/TCX import
- Profiel, doelen, blessures, weekly review
- Levensgebeurtenissen: agenda-stijl, weekkalender, feestdagen, herhaling
- Navigatie V4.0: Home/Training/Inzichten/Coach/Instellingen
- Training tab: Coach AI plan + START knop + Herstelbibliotheek
- Recovery AI volledig werkend:
  - Ademhaling: Box Breathing, 4-7-8, Coherent, Stress Reset
  - Mobiliteit: Nek/Schouders, Heupen, Full Body
  - Wandeling: Herstelwandeling
- Resultaten opgeslagen in recovery_results
- Garmin Vision Import: screenshot → Claude Vision → parse → validate → store

Bekende issues:
- Trainer AI nog niet gebouwd (kettlebell)

---

# Nog Te Bouwen

## Stap 5 — Trainer AI Kettlebell
- `/api/training/session/route.ts`
- `/training/kettlebell/page.tsx`
- Coach AI instructie → Trainer AI sessie genereren
- Live begeleiding per oefening
- Resultaat opslaan

## Stap 6 — Integratie
- Dagplan koppelen aan Training tab START knop
- Coach AI krijgt training/recovery resultaten mee in context

---

# Evoluties Status

- E1 Pattern Discovery: ✅
- E2 Trend Engine: ✅
- E3 Prediction Engine: ✅
- E4 Coach Personality: ✅
- E5 Daily Action Plan: ✅
- E6 Goal-specific Coaching: ✅
- E7 Second Brain: ⏳ groeit
- E8 Training Execution (Trainer AI): ⬜
- E9 Recovery Execution (Recovery AI): ✅ gebouwd
- E10 Garmin Vision Import: ✅ gebouwd

---

# Strava Setup
- Client ID: 254388
- Client Secret: 9b4822ef38ccd541a9bbc86730f965a8f5149208
- Callback: coach-os-tau.vercel.app

# Environment Variables (Vercel)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SECRET_KEY
- ANTHROPIC_API_KEY
- NEXT_PUBLIC_APP_URL=https://coach-os-tau.vercel.app
- STRAVA_CLIENT_ID=254388
- STRAVA_CLIENT_SECRET=9b4822ef38ccd541a9bbc86730f965a8f5149208

---

# Afspraken
- Altijd overleg voor code
- Volledige bestanden als zip
- Bestandsnaam eindigt altijd op .zip
- Na download iPhone: naam + .zip toevoegen
- README updaten na elke grote wijziging
- Taal UI: Nederlands
- Design: Dark mode first, mobile-first

---

# Versiehistorie
- v1.0.0 t/m v3.7.0: zie vorige versies
- v4.0.0: Architectuur V4.0 + Navigatie herstructurering
- v4.1.0: Levensgebeurtenissen V2 — agenda flow, feestdagen, weekkalender
- v4.2.0: Recovery AI volledig — BreathingEngine + MobilityEngine + WalkEngine + Coach AI beslissing
- v4.3.0: Garmin Vision Import — screenshot pipeline, Coach AI Garmin-aware, Inzichten grafieken

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
3. Supabase tabel aanmaken indien nodig
4. RLS policy: CREATE POLICY "Users own data" ON tabel FOR ALL USING (auth.uid() = user_id);
5. Altijd volledig bestand

## Bug flow
1. Buildlog → exacte fout lezen
2. TypeScript error → props/types checken
3. Niets veranderd → bestand op juist pad?
4. Slaat niet op → RLS policy checken
5. 404 → mapnaam exact controleren
6. Supabase 400 → ontbrekende kolom (ADD COLUMN IF NOT EXISTS)

## Voor Dick altijd
- Zip → naam + .zip → uitpakken → Working Copy → push
- Na deploy testen voor volgende stap
- Overleggen voor bouwen
- Secrets NOOIT in de chat

## Technische standaarden
- API route: export const dynamic = 'force-dynamic'
- Pagina: 'use client'
- Auth: createServerClient + cookies → getUser()
- Database: createAdminClient()
- Navigatie: router.push() — nooit router.back()
- Anthropic: directe fetch naar api.anthropic.com — geen SDK
- Exports: Python zipfile → /mnt/user-data/outputs/
