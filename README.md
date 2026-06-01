# CoachOS - Project Geheugen

## Project
- App naam: CoachOS
- Versie: 1.3.0
- App URL: https://coach-os-tau.vercel.app
- GitHub: https://github.com/stuctech-eng/coachOS
- Supabase: https://fabtmkrzqrrwbvgaugjm.supabase.co
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
Browser (client-side):
- Auth via browserClient (publishable key)
- UI state via Zustand
- Data via fetch('/api/...')
- Geen directe Supabase data calls

API Routes (server-side):
- Auth check via createServerClient + cookies
- Data via createAdminClient (secret key)
- Alle database operaties hier

## Bestandsstructuur
src/
  app/
    api/
      ai/route.ts              klaar
      checkin/route.ts         klaar
      coach/route.ts           klaar
      memory/route.ts          klaar
      profile/route.ts         klaar
      strava/
        auth/route.ts          klaar - start OAuth
        callback/route.ts      klaar - verwerkt OAuth
        sync/route.ts          klaar - GET status + POST sync
    login/page.tsx             klaar
    register/page.tsx          klaar
    onboarding/page.tsx        klaar
    home/page.tsx              klaar
    checkin/page.tsx           klaar
    insights/page.tsx          klaar
    settings/page.tsx          klaar - met Strava sectie
    layout.tsx                 klaar
    page.tsx                   klaar
  components/
    ui/index.tsx               klaar
    layout/index.tsx           klaar
  core/
    ai-engine/recovery-engine.ts  klaar
    prompts/daily-coach.ts        klaar
  hooks/
    useAuth.ts                 klaar
    useCoach.ts                klaar
  lib/
    supabase.ts                klaar
  store/
    index.ts                   klaar
  types/
    index.ts                   klaar
  utils/
    index.ts                   klaar

## Database Tabellen
- profiles, user_goals, activity_templates, activities
- activity_sessions, daily_checkins, health_metrics
- daily_status, coach_memory, coach_recommendations
- coach_insights, knowledge_observations, ai_conversations
- strava_tokens (nieuw v1.3.0)

## Huidige staat
- Login/register werkt
- Onboarding werkt
- Check-in werkt
- Home scherm werkt
- Genereer advies werkt
- Coach memory werkt
- Inzichten pagina werkt
- Strava OAuth koppeling werkt
- Strava activiteiten sync werkt

## Strava Setup
- Client ID: 254388
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

## Supabase Instellingen
- Site URL: https://coach-os-tau.vercel.app
- Redirect URLs: https://coach-os-tau.vercel.app/**
- Email bevestiging: AAN

## Bekende issues
- Activiteiten pagina nog niet gebouwd
- PWA icons ontbreken
- Apple Health nog niet geintegreerd

## Volgende stappen
1. Apple Health export verwerken
2. Activiteiten pagina bouwen
3. Garmin API aanvraag indienen
4. Weekly review

## Afspraken
- Altijd overleg voor code
- Volledige bestanden tonen
- Python write_file() voor UTF-8 clean bestanden
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

## Nieuwe chat starten
Lees mijn README op
https://raw.githubusercontent.com/stuctech-eng/coachOS/refs/heads/main/README.md
en help me verder met CoachOS
