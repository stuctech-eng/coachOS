# CoachOS - Project Geheugen

## Project
- App naam: CoachOS
- Versie: 4.5.0
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
- analyseert alle data + trends + Garmin data + trainingshistorie
- genereert dagplannen + voorspellingen
- interpreteert resultaten

### Trainer AI (✅ gebouwd — Kettlebell v2)
Input: { intensity, duration, experience_level, body_battery, ratings_laatste_3, injuries }
Output: warmup + blocks + cooldown — adaptief op basis van progressielogica

### Recovery AI — Execution Engines (✅ gebouwd)

RecoveryEngine
├── BreathingEngine (phase-based timer)
├── MobilityEngine (sequence-based flow)
└── WalkEngine (single timer)

---

## System Flow
USER DATA + GARMIN DATA + TRAININGSRESULTATEN → COACH AI → TRAINER AI / RECOVERY AI → RESULT DATA → COACH AI (learning)

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

# Data Strategie

## Garmin Import (✅ primaire databron)
- Dagelijkse screenshot van Garmin Connect "In één oogopslag"
- Claude Vision leest data uit: rusthartslag, Body Battery, slaapscore, slaapduur, HRV (7d gem.), calorieën, stappen
- Pipeline: foto → Vision → normalize → validate → store → confirm
- Opgeslagen in: `garmin_imports` tabel
- Daily lock: één confirmed record per user per dag (Europe/Amsterdam timezone)
- Reminder banner op Home als import nog niet gedaan

## Apple Health (❌ niet in gebruik)
- Vervangen door Garmin Vision Import

## Strava (✅ actief)
- Activiteiten sync via OAuth

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

---

# Training System V2 (✅ Gebouwd)

## Kettlebell Trainer AI — Adaptief

### Oefeningen Bibliotheek — 25 oefeningen

Hinge (5): Deadlift(1), Swing(1), Single-Arm Swing(2), High Pull(2), Snatch(3)
Squat (4): Goblet Squat(1), Front Squat(2), Split Squat(2), Reverse Lunge(2)
Push (4): Floor Press(1), Strict Press(2), Push Press(2), Clean & Press(3)
Pull (2): Bent-Over Row(1), Renegade Row(2)
Carry (4): Farmer Carry(1), Suitcase Carry(2), Rack Carry(2), Overhead Carry(3)
Core/Complex (6): Halo(1), Russian Twist(1), Clean(2), Turkish Get-Up(3), Windmill(3)

Niveau 1 = Beginner, 2 = Gemiddeld, 3 = Gevorderd

### Selectielogica

Experience Level:
- beginner → max niveau 1, soms 2
- gemiddeld → niveau 1-2, soms 3
- gevorderd → alle niveaus

Body Battery:
- 0-40 → alleen niveau 1
- 40-70 → niveau 1-2
- 70-100 → niveau 2-3

Progressie (ratings laatste 3 sessies):
- Rating ≥ 8 + Body Battery ≥ 70 → niveau omhoog
- Rating ≤ 4 → niveau omlaag
- Anders → niveau behouden

Blessures overschrijven altijd alle andere logica.

### Sessie opbouw
Altijd: Hinge → Squat → Push/Pull → Carry/Core → Finisher

### Coach AI context (v4.5)
- Trainingshistorie (laatste 3-5 sessies: rating, duur)
- Garmin data meegegeven aan Coach AI beslissing
- Recovery resultaten in context

---

# Bestandsstructuur

src/
  app/
    api/
      ai/route.ts                         klaar
      checkin/route.ts                    klaar (v3.5)
      coach/route.ts                      klaar (v4.5 — trainingsresultaten in context)
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
      action-plan/route.ts                klaar (v4.3 — Garmin aware)
      predictions/route.ts                klaar (v3.7)
      trends/route.ts                     klaar (v4.4 — Garmin data)
      trents/route.ts                     klaar (v4.4 — alias)
      training/
        today/route.ts                    klaar (v4.5 — Garmin + trainingshistorie in context)
        session/route.ts                  klaar (v4.5 — 25 oefeningen + progressielogica)
        complete/route.ts                 klaar (v4.4)
      recovery/
        complete/route.ts                 klaar (v4.2)
      health/
        garmin-vision/route.ts            klaar (v4.3)
        shortcut/route.ts                 niet actief
        apikey/route.ts                   niet actief
        metrics/route.ts                  niet actief
      strava/
        auth/route.ts                     klaar
        callback/route.ts                 klaar
        sync/route.ts                     klaar
    login/page.tsx                        klaar
    register/page.tsx                     klaar
    onboarding/page.tsx                   klaar
    home/page.tsx                         klaar (v4.3 — Garmin reminder)
    checkin/page.tsx                      klaar (v3.5)
    insights/page.tsx                     klaar (v4.3 — Garmin grafieken)
    settings/page.tsx                     klaar (v4.4 — Activiteiten link)
    profile/page.tsx                      klaar
    goals/page.tsx                        klaar
    activities/page.tsx                   klaar
    weekly/page.tsx                       klaar
    chat/page.tsx                         klaar (v3.6)
    injuries/page.tsx                     klaar (v3.3)
    life-events/page.tsx                  klaar (v4.1)
    training/
      page.tsx                            klaar (v4.4)
      kettlebell/page.tsx                 klaar (v4.4 — live begeleiding)
      recovery/
        breathing/page.tsx                klaar (v4.2)
        mobility/page.tsx                 klaar (v4.2)
        walk/page.tsx                     klaar (v4.2)
    settings/
      garmin-import/page.tsx              klaar (v4.3)
    layout.tsx                            klaar
    page.tsx                              klaar

---

# Supabase Tabellen

- profiles
- user_goals
- daily_checkins
- health_metrics (niet actief)
- coach_memory
- coach_recommendations
- activities
- activity_sessions
- activity_templates
- strava_tokens
- health_api_keys (niet actief)
- knowledge_observations
- ai_conversations
- daily_status
- injuries (v3.3)
- life_events (v4.1)
- training_sessions (v4.4: in gebruik)
- training_results (v4.4: in gebruik)
- recovery_sessions (v4.2: in gebruik)
- recovery_results (v4.2: in gebruik)
- garmin_imports (v4.3: primaire health databron)

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

---

# Huidige Staat

Werkend:
- Login, onboarding, profiel, doelen, blessures
- Check-in, weekly review, levensgebeurtenissen
- Home: Coach Score + Dagplan + Voorspellingen + Garmin reminder
- Coach Score automatisch berekend (Garmin-aware)
- Risk Engine, AI Coach Chat, Coach memory
- Inzichten: Garmin grafieken + Trends + Coach inzichten
- Dagplan weekend-aware + Garmin-aware
- Goal-specific coaching
- Strava sync
- Garmin Vision Import
- Recovery AI volledig
- Trainer AI Kettlebell — adaptief, 25 oefeningen, progressielogica
- Coach AI krijgt trainingsresultaten mee in context
- Activiteiten bereikbaar via Instellingen

Bekende issues:
- Trends tonen pas na 3+ Garmin imports
- Coach AI toestaat training pas bij score ≥ 75

---

# Nog Te Bouwen

## Stap 7 — Performance AI (optioneel)
- Analyseert trainingsresultaten over tijd
- Vergelijkt verwachte vs werkelijke progressie
- Stuurt Coach AI bij met aanbevelingen

---

# Evoluties Status

- E1 Pattern Discovery: ✅
- E2 Trend Engine: ✅
- E3 Prediction Engine: ✅
- E4 Coach Personality: ✅
- E5 Daily Action Plan: ✅
- E6 Goal-specific Coaching: ✅
- E7 Second Brain: ⏳ groeit
- E8 Training Execution (Trainer AI): ✅ gebouwd + adaptief
- E9 Recovery Execution (Recovery AI): ✅ gebouwd
- E10 Garmin Vision Import: ✅ gebouwd

---

# Strava Setup
- Client ID: 254388
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
- v4.1.0: Levensgebeurtenissen V2
- v4.2.0: Recovery AI volledig
- v4.3.0: Garmin Vision Import — Coach AI Garmin-aware
- v4.4.0: Trainer AI Kettlebell — live begeleiding + Trends Garmin-aware
- v4.5.0: Trainer AI adaptief — 25 oefeningen + progressielogica + Coach AI trainingshistorie

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
7. 401 op API → altijd aanroepen via router.push vanuit ingelogde pagina

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
- Pagina's zonder AppShell: altijd aanroepen via router.push vanuit ingelogde pagina
