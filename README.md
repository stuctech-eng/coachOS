# CoachOS - Project Geheugen

## Project
- App naam: CoachOS
- Versie: 4.0.0
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

Niet een fitness app. Niet een tracking app. Niet een dashboard app.

Maar: één AI Coach die beslist, uitvoert en leert via gespecialiseerde uitvoermodules.

Observe → Learn → Predict → Coach → Execute → Learn Again

De gebruiker kiest niet wat hij doet. Coach AI bepaalt alles op basis van context.

---

## Coach AI (Master Brain — Altijd Leidend)

Coach AI is de enige beslissende laag. Alle andere AI-systemen zijn uitvoerende specialisten.

Verantwoordelijkheden:
- bepaalt training vs herstel vs rust
- bepaalt intensiteit en duur
- analyseert slaap, stress, motivatie, spierpijn
- verwerkt life events
- analyseert trends (7/30/90 dagen)
- maakt voorspellingen
- bewaakt risico (overtraining / burnout)
- genereert dagplannen
- interpreteert resultaten van Training + Recovery

Coach AI ziet: check-ins, activiteiten, trends, historie, recovery data, life events
Coach AI ziet NIET: timers, rep counting, audio cues, runtime session details

Coach AI kijkt alleen naar impact, niet naar uitvoering.

---

## Trainer AI (Execution — Training Specialist)

Trainer AI is uitvoerend. Bepaalt nooit OF iemand traint.

Verantwoordelijkheden:
- vertaalt Coach AI instructie naar training sessies
- genereert workouts (sets/reps/rust/tempo)
- begeleidt live training
- audio cues + timing
- session flow (warm-up → main → cooldown)

Input van Coach AI:
{ type: "kettlebell", duration: 25, intensity: "medium" }

Trainer AI ziet NIET: planning, coaching beslissingen, health trends

---

## Recovery AI (Execution — Herstel Specialist)

Recovery AI is uitvoerend. Bepaalt nooit zelfstandig wat nodig is.

Verantwoordelijkheden:
- ademhaling sessies
- mobiliteit sessies
- ontspanning sessies
- herstelwandelingen
- slaap ondersteuning

Modules:
- Ademhaling: Box Breathing, 4-7-8, Coherent Breathing, Stress Reset
- Mobiliteit: nek/schouders, heupen, rug, full body
- Ontspanning: bodyscan, meditatie, stress reset
- Herstelwandeling: lage intensiteit
- Slaap: avondroutines, rust voorbereiding

Recovery AI ziet NIET: planning, coaching beslissingen

---

## System Flow

USER DATA (check-ins, activity, sleep, stress)
        ↓
     COACH AI (beslist alles)
        ↓
   TRAINER AI / RECOVERY AI (execution only)
        ↓
     RESULT DATA
        ↓
     COACH AI (learning + adaptatie)

---

## Harde Regels

1. Coach AI is altijd leidend
2. Trainer AI bepaalt nooit training noodzaak
3. Recovery AI bepaalt nooit herstel noodzaak
4. Execution modules voeren alleen uit
5. Alles start bij Coach AI
6. Home is command center
7. Training = uitvoering
8. Inzichten = analyse
9. Coach = AI interface
10. Gebruiker kiest niets — Coach AI beslist

---

# Navigatie V4.0

## Bottom Navigation
Home | Training | Inzichten | Coach | Instellingen

## Home (Command Center)
- Coach Score
- Check-in module (onder Coach Score)
- Daily Briefing
- Dagplan
- Quick actions
- Korte voorspellingen

## Training (Execution Layer)
- Uitvoering van Coach AI plannen
- Kettlebell training
- Future sports
- Live training runtime (timer + audio)
- Recovery flows

Flow: Home Dagplan → START → Trainer AI → uitvoering → resultaat → Coach AI

## Inzichten (Analyse Layer)
- Trends (7/30/90 dagen)
- Patronen (coach memory)
- Voorspellingen detail
- Activiteiten (Strava / Garmin)
- Grafieken

## Coach (AI Interface)
- Chat met Coach AI
- Memory en coaching historie
- Advies en uitleg
- Context vragen

## Instellingen
- Profiel
- Doelen
- Integraties (Strava, Apple Health, Garmin)
- Notificaties
- App settings

---

# Training System

## Kettlebell V1 — Oefeningen
- Kettlebell Swing (hoofdoefening)
- Goblet Squat
- Deadlift
- Clean
- Press
- Clean & Press (combo)
- Turkish Get-Up (technisch/langzaam)
- Farmer Carry

## Logica
Coach AI bepaalt: of training gebeurt, type, duur, intensiteit
Trainer AI bepaalt: sessie structuur, sets/reps, volgorde, tempo

## Data opslag
NIET bewaren: timers, audio events, rep-level logs, runtime details
WEL bewaren (training_session_result):
- duration, intensity_score, load_score
- fatigue_after, completion_status, recovery_impact

---

# Recovery System

## Modules
- Ademhaling (Box Breathing, 4-7-8, Coherent, Stress Reset)
- Mobiliteit (nek/schouders, heupen, rug, full body)
- Ontspanning (bodyscan, meditatie, stress reset)
- Herstelwandeling
- Slaap support (avondroutines, rust voorbereiding)

## Data opslag (recovery_session_result)
- type, duration, completion_status, recovery_impact

---

# Architectuur — Technisch

## Browser (client-side)
- Auth via browserClient (publishable key)
- UI state via Zustand
- Data via fetch('/api/...')

## API Routes (server-side)
- Auth check via createServerClient + cookies
- Data via createAdminClient (secret key)

---

# Bestandsstructuur

src/
  app/
    api/
      ai/route.ts                    klaar
      checkin/route.ts               klaar (v3.5)
      coach/route.ts                 klaar (v1.9)
      memory/route.ts                klaar (v3.6 — dagelijks vers)
      profile/route.ts               klaar
      profile/update/route.ts        klaar
      goals/route.ts                 klaar
      weekly/route.ts                klaar
      activities/route.ts            klaar
      status/route.ts                klaar (v3.0)
      chat/route.ts                  klaar (v3.1 — volledige context)
      injuries/route.ts              klaar (v3.3)
      life-events/route.ts           klaar (v3.5)
      action-plan/route.ts           klaar (v3.5 — dagplan)
      predictions/route.ts           klaar (v3.7)
      trends/route.ts                klaar (v3.6 — 7/30/90 dagen)
      training/
        session/route.ts             ⬜ nog te bouwen
        complete/route.ts            ⬜ nog te bouwen
      recovery/
        session/route.ts             ⬜ nog te bouwen
        complete/route.ts            ⬜ nog te bouwen
      health/
        shortcut/route.ts            klaar
        apikey/route.ts              klaar
        metrics/route.ts             klaar
      strava/
        auth/route.ts                klaar
        callback/route.ts            klaar
        sync/route.ts                klaar
    login/page.tsx                   klaar
    register/page.tsx                klaar
    onboarding/page.tsx              klaar
    home/page.tsx                    klaar (v3.7 — voorspellingen)
    checkin/page.tsx                 klaar (v3.5)
    insights/page.tsx                klaar (v3.6 — auto-analyse)
    settings/page.tsx                klaar (v3.5)
    profile/page.tsx                 klaar
    goals/page.tsx                   klaar
    activities/page.tsx              klaar
    weekly/page.tsx                  klaar
    chat/page.tsx                    klaar (v3.6 — wis-bevestiging)
    injuries/page.tsx                klaar (v3.3)
    life-events/page.tsx             klaar (v3.5)
    training/
      page.tsx                       ⬜ nog te bouwen
      kettlebell/page.tsx            ⬜ nog te bouwen
      recovery/page.tsx              ⬜ nog te bouwen
    layout.tsx                       klaar
    page.tsx                         klaar
  components/
    ui/index.tsx                     klaar (v3.5)
    layout/index.tsx                 klaar — navigatie update nodig (v4.0)
  core/
    ai-engine/recovery-engine.ts     klaar (v3.5)
    prompts/
      daily-coach.ts                 klaar (v3.7 — goal-specific)
      trainer-ai.ts                  ⬜ nog te bouwen
      recovery-ai.ts                 ⬜ nog te bouwen
    engines/
      training-engine.ts             klaar (v3.0)
      lifestyle-engine.ts            klaar (v3.0)
      coach-score-engine.ts          klaar (v3.0)
      risk-engine.ts                 klaar (v3.0)
  hooks/
    useAuth.ts                       klaar
    useCoach.ts                      klaar (v3.5)
  lib/
    supabase.ts                      klaar
  store/
    index.ts                         klaar
  types/
    index.ts                         klaar
  utils/
    index.ts                         klaar

---

# Supabase Tabellen

Bestaand:
- profiles
- user_goals
- daily_checkins (v3.5: + stress/motivatie/spierpijn/slaap)
- health_metrics
- coach_memory
- coach_recommendations (v3.7: + predictions jsonb)
- activities
- activity_sessions
- activity_templates
- strava_tokens
- health_api_keys
- knowledge_observations
- ai_conversations
- daily_status (v3.0: + training/lifestyle/coach score + risk_flags)
- injuries (v3.3)
- life_events (v3.5)

Nog aan te maken (V4.0):
- training_sessions (tijdelijk — runtime data)
- training_results (permanent — impact data voor Coach AI)
- recovery_sessions (tijdelijk — runtime data)
- recovery_results (permanent — impact data voor Coach AI)

SQL voor nieuwe tabellen:
CREATE TABLE training_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  date date NOT NULL,
  type text NOT NULL,
  status text DEFAULT 'scheduled',
  coach_instruction jsonb,
  trainer_plan jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE POLICY "Users own data" ON training_sessions FOR ALL USING (auth.uid() = user_id);

CREATE TABLE training_results (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  date date NOT NULL,
  session_id uuid REFERENCES training_sessions,
  type text,
  duration integer,
  intensity_score numeric,
  load_score integer,
  fatigue_after numeric,
  completion_status text,
  recovery_impact text,
  notes text,
  created_at timestamptz DEFAULT now()
);
CREATE POLICY "Users own data" ON training_results FOR ALL USING (auth.uid() = user_id);

CREATE TABLE recovery_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  date date NOT NULL,
  type text NOT NULL,
  module text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE POLICY "Users own data" ON recovery_sessions FOR ALL USING (auth.uid() = user_id);

CREATE TABLE recovery_results (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  date date NOT NULL,
  session_id uuid REFERENCES recovery_sessions,
  type text,
  module text,
  duration integer,
  completion_status text,
  recovery_impact text,
  notes text,
  created_at timestamptz DEFAULT now()
);
CREATE POLICY "Users own data" ON recovery_results FOR ALL USING (auth.uid() = user_id);

---

# Huidige Staat

Werkend:
- Login/register
- Onboarding
- Check-in (stress/motivatie/spierpijn/slaap)
- Home met Coach Score + Daily Briefing + Dagplan + Voorspellingen
- Coach Score automatisch berekend bij openen app
- Risk Engine (overtraining/ziekte/slaapschuld)
- AI Coach Chat met volledige context + wis-bevestiging
- Chat geschiedenis bewaard in Supabase
- Coach memory — dagelijks vers
- Inzichten pagina met auto-analyse + grafieken
- Voorspellingen gecached per dag
- Dagplan gecached per dag
- Goal-specific coaching
- Strava sync
- Activiteiten pagina + Garmin GPX/TCX import
- Apple Health Shortcut sync
- Apple Health automatisering 07:00
- Profiel, doelen, blessures, levensgebeurtenissen
- Weekly review

Bekende issues:
- Apple Health levert HRV/hartslag in rust niet via Garmin → via check-in
- Apple Health sync soms lage waarden als Garmin nog niet gesynchroniseerd

---

# Nog Te Bouwen — V4.0

## Stap 1 — Navigatie (fundament)
- layout/index.tsx aanpassen
- Tabs: Home, Training, Inzichten, Coach, Instellingen
- Check-in tab verwijderen als tab (blijft als pagina bestaan)
- Activiteiten tab verwijderen als tab (blijft als pagina bestaan)

## Stap 2 — Supabase tabellen
- training_sessions aanmaken
- training_results aanmaken
- recovery_sessions aanmaken
- recovery_results aanmaken
- SQL staat hierboven

## Stap 3 — Training tab placeholder
- /training/page.tsx — basis pagina
- Toont wat Coach AI vandaag heeft besloten
- START knop (nog niet functioneel)

## Stap 4 — Recovery AI (eerste uitvoeringsmodule)
- /api/recovery/session/route.ts
- /training/recovery/page.tsx
- Box Breathing als eerste module
- Timer + Web Audio API
- Resultaat opslaan in recovery_results

## Stap 5 — Trainer AI Kettlebell
- /api/training/session/route.ts
- /training/kettlebell/page.tsx
- Coach AI instructie → Trainer AI sessie
- Live uitvoering met timer
- Resultaat opslaan in training_results

## Stap 6 — Integratie
- Dagplan koppelen aan Training tab
- Coach AI krijgt training/recovery resultaten mee in context
- Home quick actions koppelen

---

# Evoluties Status

- E1 — Pattern Discovery Engine: ✅ gebouwd
- E2 — Trend Engine: ✅ gebouwd (7/30/90 dagen)
- E3 — Prediction Engine: ✅ gebouwd
- E4 — Coach Personality Engine: ✅ gebouwd
- E5 — Daily Action Plan: ✅ gebouwd
- E6 — Goal-specific Coaching: ✅ gebouwd
- E7 — Second Brain System: ⏳ groeit met data
- E8 — Training Execution (Trainer AI): ⬜ bouwen
- E9 — Recovery Execution (Recovery AI): ⬜ bouwen

---

# Coach Intelligence Architectuur

Engines:
- Recovery Engine: HRV + hartslag + slaap + stress + motivatie + life events
- Training Engine: activiteiten + volume + trend
- Lifestyle Engine: stappen + consistentie
- Coach Score: Recovery (50%) + Training (30%) + Lifestyle (20%)
- Risk Engine: overtraining/ziekte/slaapschuld/blessure/mentale vermoeidheid

---

# Apple Health Setup
- Opdracht: CoachOS (Opdrachten app)
- Automatisering: dagelijks 07:00 — Open Garmin Connect → Wacht 15s → Voer CoachOS uit
- Data: stappen, gewicht, slaap, calorieën
- HRV en hartslag: via dagelijkse check-in
- Flow: Garmin → Apple Health → CoachOS Shortcut → Supabase

# Strava Setup
- Client ID: 254388
- Client Secret: 9b4822ef38ccd541a9bbc86730f965a8f5149208
- Callback: coach-os-tau.vercel.app
- Scope: read, activity:read_all
- Garmin gekoppeld aan Strava

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
- Volledige bestanden tonen
- Python make_zip() voor zip export
- Bestandsnaam eindigt altijd op .zip
- Na download iPhone: naam + .zip toevoegen
- README updaten na elke grote wijziging
- Taal UI: Nederlands
- Design: Dark mode first, mobile-first

---

# Versiehistorie
- v1.0.0: Fase 1 eerste versie
- v1.1.0: Correcte architectuur API routes
- v1.1.1: Check-in upsert fix
- v1.2.0: Coach memory + inzichten pagina
- v1.3.0: Strava OAuth + activiteiten sync
- v1.3.1: Suspense fix settings pagina
- v1.4.0: Activiteiten pagina + Garmin GPX/TCX import
- v1.5.0: Apple Health import poging (te groot)
- v1.6.0: Apple Health API key systeem
- v1.7.0: Apple Health Shortcut sync + automatisering
- v1.8.0: Inzichten pagina met grafieken
- v1.9.0: Coach AI verbeterd met week health trend
- v2.0.0: Profiel bewerken + doelen beheren
- v2.1.0: Weekly review
- v3.0.0: Coach Score Engine + Risk Engine + Daily Briefing
- v3.1.0: AI Coach Chat
- v3.2.0: Daily Briefing 2.0
- v3.3.0: Injury Engine
- v3.4.0: Coach Memory 2.0
- v3.5.0: Check-in uitgebreid + Life Events
- v3.6.0: Apple Health fix + Inzichten dagelijks vers + Chat wis-bevestiging
- v3.7.0: Prediction Engine + Goal-specific Coaching
- v4.0.0: Architectuur upgrade — Trainer AI + Recovery AI + Navigatie V4.0

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
3. Supabase tabel aanmaken
4. RLS policy: CREATE POLICY "Users own data" ON tabel FOR ALL USING (auth.uid() = user_id);
5. Altijd volledig bestand — nooit fragment

## Bug flow
1. Buildlog → exacte fout lezen
2. TypeScript error → props/types checken
3. Niets veranderd → bestand op juist pad in Working Copy?
4. Slaat niet op → RLS policy Supabase checken
5. 404 → mapnaam exact controleren
6. Dan pas code fixen

## Voor Dick altijd
- Volledig bestand in chat of als zip
- Zip → naam + .zip → uitpakken → Working Copy → push
- Na deploy testen voor volgende stap
- Overleggen voor bouwen
- Secrets NOOIT in de chat plakken

## Technische standaarden
- API route: export const dynamic = 'force-dynamic'
- Pagina: 'use client'
- Auth check: createServerClient + cookies → getUser()
- Database: createAdminClient() voor alle queries
- Supabase: RLS + "Users own data" policy per tabel
- Navigatie: router.push() — nooit router.back()
- Exports: Python zipfile → /mnt/user-data/outputs/
