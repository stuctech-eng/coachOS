# CoachOS - Project Geheugen

## Project

- App naam: CoachOS
- Versie: 5.2.0
- App URL: <https://coach-os-tau.vercel.app>
- GitHub: <https://github.com/stuctech-eng/coachOS>
- Supabase: <https://fabtmkrzqrrwbvgaugjst.supabase.co>
- Architectuur: V5.0

## Stack

- Frontend: Next.js 14.2.29 + TypeScript + PWA
- Auth: Supabase Auth
- Database: Supabase PostgreSQL
- AI: Claude API via /api/ai proxy (geen SDK — directe fetch)
- State: Zustand
- Styling: Tailwind CSS
- Hosting: Vercel
- Afbeelding compressie: sharp ^0.33.0

-----

# CoachOS V5.0 — Volledige AI Architectuur

## Kernvisie

CoachOS is een AI Coaching Operating System.
Observe → Learn → Predict → Coach → Execute → Learn Again

## AI Lagen (alle compleet)

### Coach AI (Master Brain — Altijd Leidend)

- bepaalt training vs herstel vs rust
- analyseert ALLE data: Garmin, check-in, levensgebeurtenissen, werktijden, blessures, trainingshistorie, Performance AI, Training Load
- genereert dagplannen BUITEN werktijden
- denkt in belasting (load), niet in sport

### Trainer AI (✅ Kettlebell v2)

- 25 oefeningen, niveau 1-2-3
- Adaptief op basis van experience, Body Battery, ratings
- Progressie: rating ≥ 8 + BB ≥ 70 → niveau omhoog
- Feedbackveld (rating + notes) na elke sessie

### Recovery AI (✅)

- Ademhaling: Box Breathing, 4-7-8, Coherent, Stress Reset
- Mobiliteit: Nek & Schouders, Heupen, Full Body
- Wandeling: Herstelwandeling

### Performance AI (✅ v5.1)

- Analyseert trainingsresultaten over 30 dagen
- Output: progressie_trend, consistentie, herstel_na_training, niveau_gereed
- Dagelijks gecached, zichtbaar in Progressie tab

### Training Load Layer (✅ v5.2)

- Vertaalt ALLE activiteiten naar uniforme belasting
- HR modifier: lage HR × 0.8, hoge HR × 1.4
- Output: cardio_load, strength_load, recovery_load, total_load
- 7-daagse trend + vandaag intensiteit + laatste zware sessie
- Coach AI denkt in belasting, niet in sport

-----

## System Flow

GARMIN + CHECK-IN + LEVENSGEBEURTENISSEN + WERKTIJDEN + BLESSURES + TRAININGEN
↓
TRAINING LOAD LAYER
↓
COACH AI (beslist)
↓
TRAINER AI / RECOVERY AI (uitvoert)
↓
EVALUATIE + FEEDBACK
↓
PERFORMANCE AI (analyseert)
↓
COACH AI (leert)

-----

## AI Context per Route (v5.2 — volledig)

|Route         |Life events|Werktijden|Garmin|Blessures|Trainingen|Performance|Load|
|--------------|-----------|----------|------|---------|----------|-----------|----|
|action-plan   |✅          |✅         |✅     |✅        |✅         |—          |✅   |
|training/today|✅          |✅         |✅     |✅        |✅         |✅          |✅   |
|coach         |✅          |✅         |✅     |✅        |✅         |—          |✅   |
|chat          |✅          |✅         |✅     |✅        |✅         |—          |—   |
|predictions   |✅          |✅         |✅     |✅        |✅         |—          |—   |
|memory        |✅          |✅         |✅     |✅        |✅         |—          |—   |
|weekly        |✅          |✅         |✅     |✅        |✅         |—          |—   |
|performance   |—          |—         |✅     |✅        |✅         |—          |—   |
|training-load |—          |—         |—     |—        |✅         |—          |—   |

-----

## Training Load Factoren

|Activiteit|Cardio|Strength|Recovery|
|----------|------|--------|--------|
|Hardlopen |0.50  |0.05    |0.05    |
|Roeien    |0.40  |0.20    |0.05    |
|Fietsen   |0.35  |0.05    |0.05    |
|Kettlebell|0.20  |0.40    |0.05    |
|Wandeling |0.10  |0.00    |0.20    |
|Ademhaling|0.00  |0.00    |0.50    |

HR modifier: <110 bpm=×0.8 | 110-130=×1.0 | 130-150=×1.2 | >150=×1.4

-----

## Harde Regels

1. Coach AI is altijd leidend
1. Coach AI ziet nooit oefeningen — alleen belasting
1. Plan NOOIT activiteiten tijdens werktijd
1. Home = dagelijkse actie
1. Progressie = eigen tab
1. Training = uitvoering
1. Coach = AI interface

-----

# Navigatie V4.5

Home | Training | Progressie | Coach | Instellingen

Inzichten bereikbaar via Instellingen.

-----

# Garmin Import Schema (v4.7)

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

-----

# Garmin indicator bolletje (Home)

- 🟢 Groen = vandaag bevestigd — Coach Score wordt automatisch herberekend
- 🟡 Amber = gisteren
- ⚪ Grijs = geen recente data

Coach Score ververst automatisch na Garmin import (v5.2).

-----

# Bestandsstructuur

src/
app/
api/
action-plan/route.ts                klaar (v5.2 — load context)
coach/route.ts                      klaar (v5.2 — load context)
chat/route.ts                       klaar (v5.0)
predictions/route.ts                klaar (v5.0)
memory/route.ts                     klaar (v5.0)
status/route.ts                     klaar (v4.3)
weekly/route.ts                     klaar (v5.1)
performance/route.ts                klaar (v5.1)
training-load/route.ts              klaar (v5.2 — nieuw)
training/
today/route.ts                    klaar (v5.2 — load context)
session/route.ts                  klaar (v4.5)
complete/route.ts                 klaar (v4.4)
recovery/
complete/route.ts                 klaar (v4.2)
health/
garmin-vision/route.ts            klaar (v4.8)
strava/                             klaar
home/page.tsx                         klaar (v5.2 — score refresh)
insights/page.tsx                     klaar (v4.7)
progressie/page.tsx                   klaar (v5.1)
settings/page.tsx                     klaar (v4.9.1)
settings/hoe-werkt-het/page.tsx       klaar (v5.1)
settings/garmin-import/page.tsx       klaar (v5.2 — score refresh na import)
training/
page.tsx                            klaar (v5.0)
kettlebell/page.tsx                 klaar (v4.8)
recovery/
breathing/page.tsx                klaar (v4.2)
mobility/page.tsx                 klaar (v4.2)
walk/page.tsx                     klaar (v5.0)
reset-password/page.tsx               klaar (v4.9.4)
auth/callback/route.ts                klaar (v4.9.4)

-----

# Supabase Tabellen

profiles, user_goals, daily_checkins, health_metrics(inactief),
coach_memory, coach_recommendations, activities, activity_sessions,
activity_templates, strava_tokens, knowledge_observations, ai_conversations,
daily_status, injuries, life_events, training_sessions,
training_results(rating+notes), recovery_sessions, recovery_results,
garmin_imports

coach_recommendations cache types:

- action_plan
- predictions
- performance_ai
- training_load

-----

# Huidige Staat (v5.2.0) — Volledig

Werkend:

- Login, onboarding, profiel, doelen, blessures, levensgebeurtenissen
- Check-in, weekly review (vorige week op maandag)
- Home: Coach Score + Dagplan + Voorspellingen + Garmin reminder + indicator
- Coach Score herberekent automatisch na Garmin import
- Coach AI — volledige context inclusief load layer, plant BUITEN werktijden
- Inzichten: Garmin grafieken + Trends + Coach inzichten
- Garmin Vision Import — automatische compressie, stress + ademhaling
- Recovery AI — ademhaling, mobiliteit, wandeling
- Trainer AI Kettlebell — adaptief, 25 oefeningen, feedbackveld
- Training Load Layer — HR modifier, 7d trend, alle activiteiten
- Performance AI — progressie analyse in Progressie tab
- Progressie dashboard + Performance AI sectie
- Hoe werkt CoachOS uitlegpagina
- Wachtwoord vergeten flow
- Navigatie: Home | Training | Progressie | Coach | Instellingen

-----

# Roadmap

## V5.3.0 — Dagboek (volgende stap)

Dagelijkse vrije invoer naast check-in.
Velden: energie, stress, motivatie, opmerkingen (vrije tekst)
Coach AI krijgt dagboek als extra context — ziet wat Garmin niet ziet.
Verschil met check-in: check-in is gestructureerd (sliders), dagboek is vrij tekst.

## V5.4.0 — Evaluatieloop uitbreiden

Na training toevoegen:

- Hoe zwaar voelde het? (1-10)
- Vermoeidheid achteraf (1-10)
- Spierpijn (ja/nee + locatie)
  Trainer AI gebruikt dit voor progressie. Coach AI krijgt alleen samenvatting.

## V5.5.0 — Running Module (Trainer AI)

- Herstelrun, duurloop, tempo, interval
- Route via Strava of handmatig
- Pace, afstand, hartslag

## V5.6.0 — Cycling Module (Trainer AI)

- Herstelrit, duurtraining, interval, tempo
- Power zones indien beschikbaar

## V5.7.0 — Rowing Module (Trainer AI)

- Intervallen, duurtraining
- Split times, slagfrequentie

## V5.8.0 — Strength / Bodyweight uitbreiding

- Dumbbell, barbell, bodyweight
- Automatische progressie per oefening

-----

# Evoluties Status

- E1 Pattern Discovery: ✅
- E2 Trend Engine: ✅
- E3 Prediction Engine: ✅
- E4 Coach Personality: ✅
- E5 Daily Action Plan: ✅
- E6 Goal-specific Coaching: ✅
- E7 Second Brain: ⏳ groeit
- E8 Training Execution (Trainer AI): ✅
- E9 Recovery Execution (Recovery AI): ✅
- E10 Garmin Vision Import: ✅
- E11 Progressie Dashboard: ✅
- E12 Gebruikersuitleg: ✅
- E13 Performance AI: ✅
- E14 Training Load Layer: ✅
- E15 Dagboek: ⬜ V5.3
- E16 Evaluatieloop uitgebreid: ⬜ V5.4
- E17 Running Module: ⬜ V5.5
- E18 Cycling Module: ⬜ V5.6
- E19 Rowing Module: ⬜ V5.7
- E20 Strength/Bodyweight: ⬜ V5.8

-----

# Versiehistorie

- v4.0.0 t/m v4.9.4: zie vorige sessies
- v5.0.0: Volledige AI context alle routes
- v5.0.1-5.0.5: Bug fixes routes
- v5.1.0: Performance AI + Progressie tab + Weekly fix
- v5.2.0: Training Load Layer + Coach Score refresh

-----

# Nieuwe Chat Starten

Lees mijn README op
<https://raw.githubusercontent.com/stuctech-eng/coachOS/refs/heads/main/README.md>
en help me verder met CoachOS

-----

# Standaard Werkwijze

## Nieuwe bestanden checklist

1. ‘use client’ bovenaan pagina
1. export const dynamic = ‘force-dynamic’ bovenaan API route
1. RLS policy indien nieuwe tabel
1. Altijd volledig bestand
1. README bijwerken
1. Hoe werkt CoachOS bijwerken indien relevant
1. TypeScript checken: npx tsc –noEmit

## Bug flow

1. Buildlog → exacte fout lezen
1. TypeScript: clone repo lokaal → npx tsc –noEmit
1. Destructuring telt altijd queries — check met script
1. Pagina scrollt niet → gebruik AppShell
1. Icon crash → controleer lucide-react 0.400
1. 401 → aanroepen via router.push vanuit ingelogde pagina
1. .data?.parsed_data fout → query mist .single()
1. Type cast fout → gebruik ‘as unknown as Type’
1. API route fetch andere API route → NIET DOEN — geeft build fout

## Technische standaarden

- API route: export const dynamic = ‘force-dynamic’
- Pagina: ‘use client’
- Auth: createServerClient + cookies → getUser()
- Database: createAdminClient()
- Navigatie: router.push() — nooit router.back()
- Anthropic: directe fetch — geen SDK
- Afbeelding: sharp resize 800px JPEG 80%
- API routes mogen NIET andere API routes fetchen (server-side)
- Pagina’s die scrollen: gebruik AppShell

## Voor Dick altijd

- Zip → naam + .zip → uitpakken → Working Copy → push
- Na deploy testen
- Overleggen voor bouwen
- README + Hoe werkt CoachOS altijd bijwerken
- Secrets NOOIT in de chat

## Strava Setup

- Client ID: 254388
- Callback: coach-os-tau.vercel.app

## Environment Variables (Vercel)

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SECRET_KEY
- ANTHROPIC_API_KEY
- NEXT_PUBLIC_APP_URL=<https://coach-os-tau.vercel.app>
- STRAVA_CLIENT_ID=254388
- STRAVA_CLIENT_SECRET=9b4822ef38ccd541a9bbc86730f965a8f5149208