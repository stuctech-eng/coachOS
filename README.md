# CoachOS - Project Geheugen

## Project
- App naam: CoachOS
- Versie: 4.2.0
- App URL: https://coach-os-tau.vercel.app
- GitHub: https://github.com/stuctech-eng/coachOS
- Supabase: https://fabtmkrzqrrwbvgaugjst.supabase.co
- Architectuur: V4.0

## Stack
- Frontend: Next.js 14.2.29 + TypeScript + PWA
- Auth: Supabase Auth
- Database: Supabase PostgreSQL
- AI: Claude API via /api/ai proxy
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
- analyseert alle data + trends
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
USER DATA → COACH AI → TRAINER AI / RECOVERY AI → RESULT DATA → COACH AI (learning)

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
      coach/route.ts                      klaar (v1.9)
      memory/route.ts                     klaar (v3.6)
      profile/route.ts                    klaar
      profile/update/route.ts             klaar
      goals/route.ts                      klaar
      weekly/route.ts                     klaar
      activities/route.ts                 klaar
      status/route.ts                     klaar (v3.0)
      chat/route.ts                       klaar (v3.1)
      injuries/route.ts                   klaar (v3.3)
      life-events/route.ts                klaar (v4.1)
      action-plan/route.ts                klaar (v4.1 — weekend-aware)
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
        shortcut/route.ts                 klaar
        apikey/route.ts                   klaar
        metrics/route.ts                  klaar
      strava/
        auth/route.ts                     klaar
        callback/route.ts                 klaar
        sync/route.ts                     klaar
    login/page.tsx                        klaar
    register/page.tsx                     klaar
    onboarding/page.tsx                   klaar
    home/page.tsx                         klaar (v3.7)
    checkin/page.tsx                      klaar (v3.5)
    insights/page.tsx                     klaar (v3.6)
    settings/page.tsx                     klaar (v4.0)
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
- health_metrics
- coach_memory
- coach_recommendations (v4.2: + training_instruction jsonb)
- activities
- activity_sessions
- activity_templates
- strava_tokens
- health_api_keys
- knowledge_observations
- ai_conversations
- daily_status (v3.0: + scores + risk_flags)
- injuries (v3.3)
- life_events (v4.1: + recurrence_days, recurrence_end_date, vacation_type, end_date)
- training_sessions (v4.0: aangemaakt, nog niet in gebruik)
- training_results (v4.0: aangemaakt, nog niet in gebruik)
- recovery_sessions (v4.2: in gebruik)
- recovery_results (v4.2: in gebruik)

---

# Huidige Staat

Werkend:
- Login/register, onboarding
- Check-in (stress/motivatie/spierpijn/slaap)
- Home: Coach Score + Daily Briefing + Dagplan + Voorspellingen
- Coach Score automatisch berekend
- Risk Engine
- AI Coach Chat + wis-bevestiging
- Coach memory dagelijks vers
- Inzichten met auto-analyse + grafieken
- Voorspellingen + Dagplan gecached per dag
- Dagplan weekend-aware
- Goal-specific coaching
- Strava sync + Garmin GPX/TCX import
- Apple Health Shortcut sync (07:00)
- Profiel, doelen, blessures, weekly review
- Levensgebeurtenissen: agenda-stijl, weekkalender, feestdagen, herhaling
- Navigatie V4.0: Home/Training/Inzichten/Coach/Instellingen
- Training tab: Coach AI plan + START knop + Herstelbibliotheek
- Recovery AI volledig werkend:
  - Ademhaling: Box Breathing, 4-7-8, Coherent, Stress Reset
  - Mobiliteit: Nek/Schouders, Heupen, Full Body
  - Wandeling: Herstelwandeling
- Resultaten opgeslagen in recovery_results

Bekende issues:
- Apple Health levert HRV/hartslag niet via Garmin → via check-in
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

---

# Apple Health Setup
- Automatisering: 07:00 Garmin Connect → 15s wachten → CoachOS
- Data: stappen, gewicht, slaap, calorieën
- HRV/hartslag: via check-in
- Flow: Garmin → Apple Health → Shortcut → Supabase

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
- Exports: Python zipfile → /mnt/user-data/outputs/
