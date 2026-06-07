# CoachOS - Project Geheugen

## Project
- App naam: CoachOS
- Versie: 4.8.0
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

# CoachOS V4.0 — AI Architectuur

## Kernvisie
CoachOS is een AI Coaching Operating System.
Observe → Learn → Predict → Coach → Execute → Learn Again

## AI Lagen

### Coach AI (Master Brain — Altijd Leidend)
- bepaalt training vs herstel vs rust
- analyseert alle data + trends + Garmin data + trainingshistorie
- genereert dagplannen + voorspellingen

### Trainer AI (✅ gebouwd — Kettlebell v2, adaptief)
Input: { intensity, duration, experience_level, body_battery, ratings_laatste_3, injuries }
Output: warmup + blocks + cooldown — adaptief op basis van progressielogica

### Recovery AI (✅ gebouwd)
BreathingEngine | MobilityEngine | WalkEngine

---

## System Flow
USER DATA + GARMIN DATA + TRAININGSRESULTATEN → COACH AI → TRAINER AI / RECOVERY AI → RESULT DATA → COACH AI (learning)

## Harde Regels
1. Coach AI is altijd leidend
2. Trainer AI bepaalt nooit training noodzaak
3. Recovery AI bepaalt nooit herstel noodzaak
4. Home = dagelijkse actie
5. Progressie = eigen tab
6. Training = uitvoering
7. Coach = AI interface

---

# Navigatie V4.5
Home | Training | Progressie | Coach | Instellingen

Inzichten bereikbaar via Instellingen.

---

# Data Strategie

## Garmin Import (✅ primaire databron)
- Dagelijkse screenshot van Garmin Connect "In één oogopslag"
- Foto wordt automatisch gecomprimeerd (800px, JPEG 80%) voor Vision call
- Claude Vision leest uit: rusthartslag, Body Battery, slaapscore, slaapduur, HRV (7d gem.), stress, ademhaling
- Pipeline: foto → compress → Vision → normalize → validate → store → confirm
- Daily lock: één confirmed record per user per dag (Europe/Amsterdam)
- Reminder banner op Home als import nog niet gedaan

## Garmin Import Schema (v4.7)
```json
{
  "resting_hr": 46,
  "body_battery": { "current": 83, "charged": 49, "spent": 8 },
  "sleep": { "score": 83, "duration_minutes": 408 },
  "hrv": { "avg_7d_ms": 49, "status": "balanced" },
  "stress": 18,
  "breathing": {
    "current_brpm": 20,
    "avg_awake_brpm": 15,
    "avg_sleep_brpm": 13
  },
  "meta": { "source": "garmin_screenshot", "parsed_at": "timestamp" }
}
```

## Apple Health (❌ niet in gebruik)
## Strava (✅ actief)

---

# Home — Garmin indicator bolletje
- 🟢 Groen = Garmin import vandaag bevestigd
- 🟡 Amber = Garmin import van gisteren
- ⚪ Grijs = Geen recente Garmin data

---

# Recovery System V1 (✅)
Ademhaling: Box Breathing, 4-7-8, Coherent, Stress Reset
Mobiliteit: Nek & Schouders, Heupen, Full Body
Wandeling: Herstelwandeling

---

# Training System V2 (✅)

## Kettlebell Trainer AI — Adaptief

### Oefeningen Bibliotheek — 25 oefeningen
Hinge (5): Deadlift(1), Swing(1), Single-Arm Swing(2), High Pull(2), Snatch(3)
Squat (4): Goblet Squat(1), Front Squat(2), Split Squat(2), Reverse Lunge(2)
Push (4): Floor Press(1), Strict Press(2), Push Press(2), Clean & Press(3)
Pull (2): Bent-Over Row(1), Renegade Row(2)
Carry (4): Farmer Carry(1), Suitcase Carry(2), Rack Carry(2), Overhead Carry(3)
Core (6): Halo(1), Russian Twist(1), Clean(2), Turkish Get-Up(3), Windmill(3)

### Selectielogica
Experience: beginner→max 1-2, gemiddeld→1-3, gevorderd→alle
Body Battery: <40→niveau 1, 40-70→1-2, >70→2-3
Progressie: rating≥8 + BB≥70→omhoog | rating≤4→omlaag | anders→behouden
Blessures overschrijven altijd alles.

### Sessie opbouw
Hinge → Squat → Push/Pull → Carry/Core → Finisher

### Feedback per sessie (v4.8)
- Rating 1-10
- Vrij tekstveld "Opmerkingen" — opgeslagen in training_results.notes

---

# Bestandsstructuur

src/
  app/
    api/
      ai/route.ts                         klaar
      checkin/route.ts                    klaar (v3.5)
      coach/route.ts                      klaar (v4.5)
      memory/route.ts                     klaar (v3.6)
      profile/route.ts                    klaar
      profile/update/route.ts             klaar
      goals/route.ts                      klaar
      weekly/route.ts                     klaar
      activities/route.ts                 klaar
      status/route.ts                     klaar (v4.3)
      chat/route.ts                       klaar (v3.1)
      injuries/route.ts                   klaar (v3.3)
      life-events/route.ts                klaar (v4.1)
      action-plan/route.ts                klaar (v4.3)
      predictions/route.ts                klaar (v3.7)
      trends/route.ts                     klaar (v4.4)
      trents/route.ts                     klaar (v4.4 — alias)
      training/
        today/route.ts                    klaar (v4.5)
        session/route.ts                  klaar (v4.5 — 25 oefeningen + progressie)
        complete/route.ts                 klaar (v4.4)
      recovery/
        complete/route.ts                 klaar (v4.2)
      health/
        garmin-vision/route.ts            klaar (v4.8 — sharp compressie)
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
    home/page.tsx                         klaar (v4.7 — Garmin indicator bolletje)
    checkin/page.tsx                      klaar (v3.5)
    insights/page.tsx                     klaar (v4.7 — stress + ademhaling grafieken)
    progressie/page.tsx                   klaar (v4.6)
    settings/page.tsx                     klaar (v4.4)
    profile/page.tsx                      klaar
    goals/page.tsx                        klaar
    activities/page.tsx                   klaar (v4.5.1)
    weekly/page.tsx                       klaar
    chat/page.tsx                         klaar (v3.6)
    injuries/page.tsx                     klaar (v3.3)
    life-events/page.tsx                  klaar (v4.1)
    training/
      page.tsx                            klaar (v4.4)
      kettlebell/page.tsx                 klaar (v4.8 — feedbackveld notes)
      recovery/
        breathing/page.tsx                klaar (v4.2)
        mobility/page.tsx                 klaar (v4.2)
        walk/page.tsx                     klaar (v4.2)
    settings/
      garmin-import/page.tsx              klaar (v4.7)
    layout.tsx                            klaar
    page.tsx                              klaar
  components/
    ui/index.tsx                          klaar (v3.5)
    layout/index.tsx                      klaar (v4.5.1 — Progressie tab)
  hooks/
    useAuth.ts                            klaar
    useCoach.ts                           klaar (v3.5)
  lib/
    supabase.ts                           klaar
  store/index.ts                          klaar
  types/index.ts                          klaar
  utils/index.ts                          klaar

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
- knowledge_observations
- ai_conversations
- daily_status
- injuries (v3.3)
- life_events (v4.1)
- training_sessions (v4.4)
- training_results (v4.4) — rating + notes
- recovery_sessions (v4.2)
- recovery_results (v4.2)
- garmin_imports (v4.3 — primaire databron)

---

# Huidige Staat (v4.8.0)

Werkend:
- Login, onboarding, profiel, doelen, blessures
- Check-in, weekly review, levensgebeurtenissen
- Home: Coach Score + Dagplan + Voorspellingen + Garmin reminder + indicator bolletje
- Coach Score automatisch berekend (Garmin-aware)
- Risk Engine, AI Coach Chat, Coach memory
- Inzichten: Garmin grafieken (hartslag, BB, slaap, HRV, stress, ademhaling) + Trends
- Dagplan weekend-aware + Garmin-aware
- Strava sync
- Garmin Vision Import — automatische compressie + stress + ademhaling schema
- Recovery AI volledig
- Trainer AI Kettlebell — adaptief, 25 oefeningen, progressielogica, feedbackveld
- Progressie dashboard
- Activiteiten via Instellingen
- Navigatie: Home | Training | Progressie | Coach | Instellingen

---

# Nog Te Bouwen

## Volgende (v4.9)
- Coach AI stress + ademhaling meenemen in context
- Performance AI — trainingsresultaten analyseren over tijd

---

# Evoluties Status

- E1 Pattern Discovery: ✅
- E2 Trend Engine: ✅
- E3 Prediction Engine: ✅
- E4 Coach Personality: ✅
- E5 Daily Action Plan: ✅
- E6 Goal-specific Coaching: ✅
- E7 Second Brain: ⏳ groeit
- E8 Training Execution (Trainer AI): ✅ adaptief + feedback
- E9 Recovery Execution (Recovery AI): ✅
- E10 Garmin Vision Import: ✅ stress + ademhaling + compressie
- E11 Progressie Dashboard: ✅

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
- README altijd meegeleverd in zip, zelfde naam als zip
- Taal UI: Nederlands
- Design: Dark mode first, mobile-first

---

# Versiehistorie
- v1.0.0 t/m v3.7.0: zie vorige versies
- v4.0.0: Architectuur V4.0
- v4.1.0: Levensgebeurtenissen V2
- v4.2.0: Recovery AI volledig
- v4.3.0: Garmin Vision Import
- v4.4.0: Trainer AI Kettlebell
- v4.5.0: Trainer AI adaptief — 25 oefeningen
- v4.5.1: Navigatie Progressie tab + terugknop
- v4.6.0: Progressie dashboard
- v4.7.0: Garmin schema stress + ademhaling + indicator bolletje
- v4.8.0: Sharp compressie Garmin foto + feedbackveld kettlebell

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
- Afbeelding compressie: sharp — resize 800px, JPEG 80%
- Pagina's zonder AppShell: altijd aanroepen via router.push vanuit ingelogde pagina
