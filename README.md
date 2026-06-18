# CoachOS - Project Geheugen

## Project
- App naam: CoachOS
- Versie: 1.6.0
- App URL: https://coach-os-tau.vercel.app
- GitHub: https://github.com/stuctech-eng/coachOS
- Supabase: https://fabtmkrzqrrwbvgaugjm.supabase.co

## Stack
- Frontend: Next.js 14.2.29 + TypeScript + PWA
- Auth: Supabase Auth
- Database: Supabase PostgreSQL
- AI: Claude API (directe Anthropic calls)
- State: Zustand
- Styling: Tailwind CSS
- Hosting: Vercel

## ⚠️ KERNPRINCIPE — NOOIT VERGETEN
**Coach bepaalt alles. Trainer pakt het over.**

- Coach (Sonnet 4.6): trainen / herstel / rust + trainer_instructies
- Trainer (Haiku 4.5): voert exact uit wat Coach zegt
- Trainer voegt NIETS toe op eigen initiatief

## Oefening Bibliotheek
Statische oefenkaarten met Gemini afbeeldingen.

Afbeeldingen in: public/exercises/
- kettlebell-swing.png
- goblet-squat.png
- kettlebell-clean.png
- kettlebell-press.png
- farmer-carry.png

Oefening data: src/lib/exercises.ts
Uitleg pagina: src/app/oefening/[id]/page.tsx

Flow:
1. Kettlebell sessie overzicht → tik oefening → uitlegpagina
2. Training start → uitleg vóór elke oefening → Ready → training
3. Na rust → uitleg volgende oefening → Ready → training

## Guardian Mode
Analyse vóór implementatie. Bij onzekerheid STOP + 1 vraag.

## Command System
- README → volledige README
- FIX → oorzaak + oplossing, wachten op akkoord
- NEXT → volgende stap + plan
- STATUS → wat werkt / ontbreekt / risico
- DEBUG → debug pagina aanmaken

## Coach → Trainer communicatie
trainer_instructies kolom in coach_recommendations:
```sql
ALTER TABLE coach_recommendations
ADD COLUMN IF NOT EXISTS trainer_instructies text;
```

## Architectuur
- AI calls naar api.anthropic.com/v1/messages (NOOIT via /api/ai proxy)
- Coach = Sonnet 4.6
- Training/action-plan = Haiku 4.5

## Workflow: Claude → iPhone → Working Copy → GitHub → Vercel
1. Bestanden in /home/claude/update/ met exacte projectstructuur
2. Zip zonder tussenmap
3. Zip in /mnt/user-data/outputs/coachOS-vX.X.X.zip
4. present_files

Regels:
- Alleen gewijzigde bestanden
- Geen tussenmap
- Altijd README updaten
- NOOIT via /api/ai proxy
- Coach bepaalt alles

## Bestandsstructuur
src/
  app/
    api/
      ai/route.ts                    klaar (proxy — NIET intern gebruiken)
      action-plan/route.ts           klaar - Haiku
      checkin/route.ts               klaar
      coach/route.ts                 klaar - Sonnet + trainer_instructies
      coach-calls/route.ts           klaar
      memory/route.ts                klaar
      profile/route.ts               klaar
      status/route.ts                klaar
      training/
        today/route.ts               klaar - Haiku + coach sync
        session/route.ts             klaar
        complete/route.ts            klaar
      strava/                        klaar
      health/                        klaar
      injuries/route.ts              klaar
      goals/route.ts                 klaar
      journal/route.ts               klaar
      life-events/route.ts           klaar
      weekly/route.ts                klaar
    oefening/[id]/page.tsx           klaar - uitlegpagina met Gemini afbeelding
    debug/page.tsx                   klaar - diagnostiek + kopieerknop
    home/page.tsx                    klaar
    checkin/page.tsx                 klaar
    chat/page.tsx                    klaar
    coach-call/page.tsx              klaar
    dagboek/page.tsx                 klaar
    goals/page.tsx                   klaar
    injuries/page.tsx                klaar
    insights/page.tsx                klaar
    life-events/page.tsx             klaar
    progressie/page.tsx              klaar
    training/page.tsx                klaar
    training/session/kettlebell/page.tsx  klaar - uitleg voor/tijdens training
    training/session/[module]/       klaar
    training/recovery/               klaar
    weekly/page.tsx                  klaar
    settings/page.tsx                klaar
  lib/
    exercises.ts                     klaar - oefening data (5 kettlebell oefeningen)

public/
  exercises/                         → Gemini afbeeldingen hier plaatsen

## Database Tabellen
- profiles, user_goals, activity_templates, activities
- activity_sessions, daily_checkins, health_metrics
- daily_status, coach_memory, coach_recommendations (incl. trainer_instructies)
- coach_insights, knowledge_observations, ai_conversations
- strava_tokens, garmin_imports, injuries, life_events
- journal_entries, training_results

## Huidige staat — ALLES WERKT
- Login/register, onboarding, check-in
- Home + refresh, coach advies, dagplan
- Training schema + coach sync
- Coach memory, coach chat, coach calls
- Inzichten, progressie, weekoverzicht
- Dagboek, doelen, blessures, levensgebeurtenissen
- Strava OAuth + sync, Garmin import
- PWA icons, debug pagina
- Oefening uitlegpagina met Gemini afbeeldingen (v1.6.0)
- Uitleg vóór en tijdens kettlebell training (v1.6.0)

## Strava Setup
- Client ID: 254388
- Callback: coach-os-tau.vercel.app

## Environment Variables (Vercel)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SECRET_KEY
- ANTHROPIC_API_KEY
- STRAVA_CLIENT_ID=254388
- STRAVA_CLIENT_SECRET=9b4822ef38ccd541a9bbc86730f965a8f5149208

## Versiehistorie
- v1.0.0 t/m v1.5.0: Basis app volledig gebouwd
- v1.6.0: Oefening bibliotheek + uitlegpagina + Gemini afbeeldingen

## Nieuwe chat starten
Lees mijn README op
https://raw.githubusercontent.com/stuctech-eng/coachOS/refs/heads/main/README.md
en help me verder met CoachOS
