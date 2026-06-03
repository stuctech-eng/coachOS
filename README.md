# CoachOS - Project Geheugen

## Project
- App naam: CoachOS
- Versie: 3.5.0
- App URL: https://coach-os-tau.vercel.app
- GitHub: https://github.com/stuctech-eng/coachOS
- Supabase: https://fabtmkrzqrrwbvgaugjst.supabase.co
- Blueprint: V2.2

## Stack
- Frontend: Next.js 14.2.29 + TypeScript + PWA
- Auth: Supabase Auth
- Database: Supabase PostgreSQL
- AI: Claude API via /api/ai proxy
- State: Zustand
- Styling: Tailwind CSS
- Hosting: Vercel

## Architectuur
Raw Data → Engines → Daily Status → AI Coach

Browser (client-side):
- Auth via browserClient (publishable key)
- UI state via Zustand
- Data via fetch('/api/...')

API Routes (server-side):
- Auth check via createServerClient + cookies
- Data via createAdminClient (secret key)

## Bestandsstructuur
src/
  app/
    api/
      ai/route.ts                    klaar
      checkin/route.ts               klaar (v3.5 — stress/motivatie/spierpijn/slaap)
      coach/route.ts                 klaar (v1.9 — week health trend)
      memory/route.ts                klaar (v3.4 — health+activiteiten+deduplicatie)
      profile/route.ts               klaar
      profile/update/route.ts        klaar
      goals/route.ts                 klaar
      weekly/route.ts                klaar
      activities/route.ts            klaar
      status/route.ts                klaar (v3.0 — coach score engine)
      chat/route.ts                  klaar (v3.1 — volledige context)
      injuries/route.ts              klaar (v3.3)
      life-events/route.ts           klaar (v3.5)
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
    home/page.tsx                    klaar (v3.2 — daily briefing 2.0)
    checkin/page.tsx                 klaar (v3.5 — uitgebreid)
    insights/page.tsx                klaar (v1.8 — grafieken)
    settings/page.tsx                klaar (v3.5 — alle links)
    profile/page.tsx                 klaar
    goals/page.tsx                   klaar
    activities/page.tsx              klaar
    weekly/page.tsx                  klaar
    chat/page.tsx                    klaar (v3.1)
    injuries/page.tsx                klaar (v3.3)
    life-events/page.tsx             klaar (v3.5)
    layout.tsx                       klaar
    page.tsx                         klaar
  components/
    ui/index.tsx                     klaar (v3.5 — ScoreSlider lowLabel/highLabel)
    layout/index.tsx                 klaar (v3.1 — Coach tab)
  core/
    ai-engine/recovery-engine.ts     klaar (v3.5 — stress/motivatie/life events)
    prompts/daily-coach.ts           klaar (v1.9)
    engines/
      training-engine.ts             klaar (v3.0)
      lifestyle-engine.ts            klaar (v3.0)
      coach-score-engine.ts          klaar (v3.0)
      risk-engine.ts                 klaar (v3.0)
  hooks/
    useAuth.ts                       klaar
    useCoach.ts                      klaar (v3.5 — nieuwe checkin velden)
  lib/
    supabase.ts                      klaar
  store/
    index.ts                         klaar
  types/
    index.ts                         klaar
  utils/
    index.ts                         klaar

## Supabase tabellen
- profiles
- user_goals
- daily_checkins (v3.5: + stress_score, motivation_score, soreness_score, sleep_quality)
- health_metrics
- coach_memory
- coach_recommendations
- activities
- activity_sessions
- activity_templates
- strava_tokens
- health_api_keys
- knowledge_observations
- ai_conversations
- daily_status (v3.0: + training_score, lifestyle_score, coach_score, risk_flags)
- injuries (v3.3)
- life_events (v3.5)

## Huidige staat
- Login/register werkt
- Onboarding werkt
- Check-in werkt (uitgebreid met stress/motivatie/spierpijn/slaap)
- Home scherm werkt met Coach Score + Daily Briefing
- Coach Score automatisch berekend bij openen app
- Risk Engine detecteert overtraining/ziekte/slaapschuld
- AI Coach Chat werkt met volledige context
- Coach memory analyseert patronen automatisch
- Inzichten pagina werkt met grafieken
- Strava sync werkt
- Activiteiten pagina werkt
- Garmin GPX/TCX import werkt
- Apple Health Shortcut sync werkt (elke dag 07:00)
- Profiel bewerken werkt
- Doelen beheren werkt
- Blessures beheren werkt
- Levensgebeurtenissen werkt
- Weekly review werkt

## Bekende issues
- Geen

## Volgende stappen
1. Life events meenemen in AI Chat context
2. DailyCheckin type uitbreiden met nieuwe velden
3. Coach Score label tonen in chat context
4. Push notificaties voor check-in herinnering
5. Coach Memory patronen verfijnen na 30+ dagen data

## Coach Intelligence Architectuur
Raw Data → Engines → Daily Status → AI Coach

Engines:
- Recovery Engine: HRV + hartslag + slaap + stress + motivatie + life events
- Training Engine: activiteiten + volume + trend
- Lifestyle Engine: stappen + consistentie
- Coach Score: Recovery (50%) + Training (30%) + Lifestyle (20%)
- Risk Engine: detecteert overtraining/ziekte/slaapschuld/blessure/mentale vermoeidheid

## Apple Health Setup
- Opdracht: CoachOS Sync
- Automatisering: dagelijks 07:00
- Data: hartslag, HRV, stappen, gewicht, slaap, calorieën
- Flow: Garmin → Apple Health → CoachOS Shortcut → Supabase

## Strava Setup
- Client ID: 254388
- Client Secret: 9b4822ef38ccd541a9bbc86730f965a8f5149208
- Callback domain: coach-os-tau.vercel.app
- Scope: read, activity:read_all
- Garmin is gekoppeld aan Strava

## Environment Variables (Vercel)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SECRET_KEY
- ANTHROPIC_API_KEY
- NEXT_PUBLIC_APP_URL=https://coach-os-tau.vercel.app
- STRAVA_CLIENT_ID=254388
- STRAVA_CLIENT_SECRET=9b4822ef38ccd541a9bbc86730f965a8f5149208

## Afspraken
- Altijd overleg voor code
- Volledige bestanden tonen
- Python make_zip() voor zip export
- Bestandsnaam eindigt altijd op .zip
- Na download iPhone: naam + .zip toevoegen
- README updaten na elke grote wijziging
- Taal UI: Nederlands
- Design: Dark mode first, mobile-first

## Versiehistorie
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

## Nieuwe chat starten
Lees mijn README op
https://raw.githubusercontent.com/stuctech-eng/coachOS/refs/heads/main/README.md
en help me verder met CoachOS
