# CoachOS - Project Geheugen

## Project

- App naam: CoachOS
- Versie: 5.3.0
- App URL: <https://coach-os-tau.vercel.app>
- GitHub: <https://github.com/stuctech-eng/coachOS>
- Supabase: <https://fabtmkrzqrrwbvgaugjst.supabase.co>

## Stack

- Frontend: Next.js 14.2.29 + TypeScript + PWA
- Auth: Supabase Auth
- Database: Supabase PostgreSQL
- AI: Claude API — directe fetch, geen SDK
- State: Zustand
- Styling: Tailwind CSS
- Hosting: Vercel
- Afbeelding compressie: sharp ^0.33.0

-----

# Definitieve AI Architectuur

## System Flow

Garmin + Strava + Check-in + Dagboek + Blessures + Werktijden + Life Events + Performance AI + Training Load Layer
↓
Coach AI — Beslist OF je traint
↓
Trainer AI              Recovery AI
Beslist HOE             Beslist HOE
je traint               je herstelt
↓                       ↓
Uitvoering              Uitvoering
↓                       ↓
Evaluatie               Evaluatie
↓
Performance AI — Analyseert resultaten
↓
Coach AI

## Rolverdeling (hard gescheiden)

### Coach AI

- Analyseert: Garmin, check-in, dagboek, load, Performance AI, blessures, werktijden
- Beslist: trainen / herstel / rust
- Kiest NOOIT oefeningen
- Ontvangt NOOIT oefeningen als context — alleen belasting + progressie + herstelstatus

### Trainer AI

- Bepaalt: trainingsvorm, oefeningen, sets, reps, duur, rust, intensiteit
- Kiest automatisch uit beschikbare modules op basis van equipment profiel
- Gebruikt Training Load Layer voor intensiteit

### Recovery AI

- Ademhaling, mobiliteit, wandeling

### Performance AI

- 30 dagen analyse → progressie_trend, consistentie, herstel_na_training, niveau_gereed
- Zichtbaar in Progressie tab

### Training Load Layer

- Elke activiteit → cardio_load, strength_load, recovery_load, total_load
- HR modifier: <110=×0.8 | 110-130=×1.0 | 130-150=×1.2 | >150=×1.4

-----

# Navigatie

Home | Training | Progressie | Coach | Instellingen

## Home — Actiecentrum

- Coach Score
- Check-in
- Dagboek knop
- Vandaag van je Coach (main_action + advice_bullets + actie_type + dagplan)
- Garmin Status

## Training — Uitvoering

- Vandaag Aanbevolen (Coach AI beslissing + START knop) — V5.4
- Trainer AI Modules
- Recovery AI

## Progressie — Analyse

1. Performance AI
1. Trainingsbelasting
1. Coach Inzichten
1. Voorspellingen (wekelijks)
1. Historisch (inklapbaar)

## Coach — Gesprek

- Chat, Memory, Uitleg adviezen

## Instellingen

- Profiel, Equipment (V5.4), Garmin Import, Hoe werkt CoachOS

-----

# Equipment Profiel (V5.4)

Jouw equipment:

- Kettlebells ✅
- Concept2 Roeimachine ✅
- Indoor Fiets ✅
- Running ✅
- Dumbbells ✅
- Barbell + Gewichten ✅
- Ab Wheel ✅
- Bodyweight ✅ (altijd beschikbaar)

DB kolommen (profiles):
kettlebell_available, concept2_available, cycling_available, running_available,
dumbbell_available, barbell_available, ab_wheel_available, bodyweight_available

-----

# Evaluatie Na Iedere Sessie (V5.4)

Rating: 1-10
Perceived Effort: 1-10
Fatigue After: 1-10
Soreness: 1-10
Opmerkingen: vrij tekst

SQL:
alter table training_results
add column if not exists perceived_effort int,
add column if not exists fatigue_after int,
add column if not exists soreness int,
add column if not exists soreness_notes text;

-----

# Trainer AI Sportmodules

1. Kettlebell ✅ gebouwd
1. Rowing (Concept2) ⬜ V5.5
- Recovery Row, Steady State, Endurance, Tempo, Threshold, Interval, Sprint
- Meetwaarden: tijd, afstand, hartslag, split/500m, calories, SPM
1. Running ⬜ V5.6
- Recovery, Easy, Long, Tempo, Threshold, Interval, Hill, Fartlek
1. Cycling ⬜ V5.7
- Recovery, Easy, Endurance, Tempo, Threshold, Interval, Hill
1. Kettlebell Uitbreiding ⬜ V5.8
1. Strength ⬜ V5.9
- Dumbbells + Barbell
- Squat, Deadlift, Bench, OHP, Row, Pull-Up, Lunge, Bulgarian Split Squat
1. Bodyweight & Core ⬜ V5.10
- Ab Wheel + bodyweight
- Push, Legs, Core, Conditioning

-----

# Coach AI Output Formaat

{
“actie_type”: “herstel”,
“main_action”: “Doe vandaag een herstelwandeling van 30 minuten.”,
“advice_bullets”: [“Vermijd zware training”, “Drink voldoende water”],
“reasoning”: “Onderbouwing…”
}

Cache: coach_recommendations — dagelijks
Kolommen: recommendation, reasoning, actie_type, advice_bullets

-----

# AI Context per Route (v5.3)

Route          | Life | Werk | Garmin | Bles | Train | Perf | Load | Dagboek
action-plan    | ✅   | ✅   | ✅     | ✅   | ✅    | —    | ✅   | ✅
training/today | ✅   | ✅   | ✅     | ✅   | ✅    | ✅   | ✅   | ✅
coach          | ✅   | ✅   | ✅     | ✅   | ✅    | —    | ✅   | ✅
chat           | ✅   | ✅   | ✅     | ✅   | ✅    | —    | —    | —
predictions    | ✅   | ✅   | ✅     | ✅   | ✅    | —    | —    | —
memory         | ✅   | ✅   | ✅     | ✅   | ✅    | —    | —    | —
weekly         | ✅   | ✅   | ✅     | ✅   | ✅    | —    | —    | —

-----

# Supabase Tabellen

profiles, user_goals, daily_checkins, health_metrics(inactief), coach_memory,
coach_recommendations, activities, activity_sessions, activity_templates,
strava_tokens, knowledge_observations, ai_conversations, daily_status,
injuries, life_events, training_sessions,
training_results (rating, notes, perceived_effort*, fatigue_after*, soreness*, soreness_notes*),
recovery_sessions, recovery_results, garmin_imports, journal_entries

coach_recommendations types:

- action_plan (dagelijks)
- predictions (wekelijks — maandag)
- performance_ai (dagelijks)
- training_load (dagelijks)

*V5.4 kolommen

-----

# Huidige Staat (v5.3.0)

✅ Werkend:

- Login, onboarding, profiel, doelen, blessures, levensgebeurtenissen
- Check-in, dagboek, weekly review (vorige week op maandag)
- Home: Coach Score + Vandaag van je Coach + Garmin bolletje
- Coach Score herberekent automatisch na Garmin import
- Coach AI — volledige context, plant BUITEN werktijden
- Garmin Vision Import — compressie + stress + ademhaling
- Recovery AI — ademhaling, mobiliteit, wandeling
- Trainer AI Kettlebell — 25 oefeningen, adaptief
- Training Load Layer — HR modifier, 7d trend
- Performance AI — progressie analyse in Progressie tab
- Progressie tab — definitieve architectuur (conclusie → bewijs)
- Voorspellingen — wekelijks gegenereerd, localStorage cache
- Coach Inzichten — patronen uit memory

-----

# Roadmap

Fase 1 ✅  V5.2.0 Training Load Layer
Fase 2 ✅  V5.3.0 Home + Dagboek + Progressie architectuur
Fase 3     V5.4.0 Trainer Fundament
- Equipment profiel (Instellingen)
- Training tab herindeling (Vandaag Aanbevolen + START)
- Evaluatie uitbreiden (effort, fatigue, soreness)
Fase 4     V5.5.0  Rowing Module (Concept2)
V5.6.0  Running Module
V5.7.0  Cycling Module
V5.8.0  Kettlebell Uitbreiding
V5.9.0  Strength Module (dumbbells + barbell)
V5.10.0 Bodyweight & Core Module

-----

# Evoluties Status

E1-E17: ✅ (zie vorige versies)
E18 Equipment profiel:        ⬜ V5.4
E19 Evaluatieloop uitgebreid: ⬜ V5.4
E20 Training tab herindeling: ⬜ V5.4
E21 Rowing Module:            ⬜ V5.5
E22 Running Module:           ⬜ V5.6
E23 Cycling Module:           ⬜ V5.7
E24 Kettlebell uitbreiding:   ⬜ V5.8
E25 Strength Module:          ⬜ V5.9
E26 Bodyweight & Core:        ⬜ V5.10

-----

# Versiehistorie

- v4.0–4.9: Architectuur, Recovery/Trainer AI, Garmin, Progressie
- v5.0.0: Volledige AI context alle routes
- v5.0.1–5.0.5: Bug fixes
- v5.1.0: Performance AI + Progressie tab
- v5.2.0: Training Load Layer + Coach Score refresh
- v5.3.0: Home herindeling + Dagboek + Progressie architectuur + Voorspellingen wekelijks

-----

# Nieuwe Chat Starten

Lees mijn README op
<https://raw.githubusercontent.com/stuctech-eng/coachOS/refs/heads/main/README.md>
en help me verder met CoachOS

-----

# Standaard Werkwijze

## Voor elke wijziging

1. git pull
1. npx tsc –noEmit
1. Bestanden lezen
1. Checken: force-dynamic, destructuring, unused imports, braces
1. Na wijziging: TypeScript opnieuw checken
1. Dan pas zippen

## Bug flow

1. Buildlog → exacte fout
1. TypeScript lokaal: npx tsc –noEmit
1. Destructuring telt altijd queries
1. Pagina scrollt niet → AppShell
1. Type cast → as unknown as Type
1. API route mag GEEN andere API route fetchen (server-side)
1. Cache leeg → check type filter op coach_recommendations

## Technische standaarden

- API route: export const dynamic = ‘force-dynamic’
- Pagina: ‘use client’
- Auth: createServerClient + cookies → getUser()
- Database: createAdminClient()
- Navigatie: router.push() — nooit router.back()
- Anthropic: directe fetch — geen SDK
- Afbeelding: sharp resize 800px JPEG 80%

## Voor Dick altijd

- Zip → naam + .zip → Working Copy → push
- Na deploy testen
- Overleggen voor bouwen
- README bijwerken na elke versie
- Secrets NOOIT in de chat

## Environment Variables (Vercel)

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SECRET_KEY
- ANTHROPIC_API_KEY
- NEXT_PUBLIC_APP_URL=<https://coach-os-tau.vercel.app>
- STRAVA_CLIENT_ID=254388
- STRAVA_CLIENT_SECRET=9b4822ef38ccd541a9bbc86730f965a8f5149208