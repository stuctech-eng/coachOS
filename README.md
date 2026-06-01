# CoachOS - Project Geheugen

## Project
- App naam: CoachOS
- Versie: 1.1.0
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

## Environment Variables (Vercel)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SECRET_KEY
- ANTHROPIC_API_KEY
- NEXT_PUBLIC_APP_URL=https://coach-os-tau.vercel.app

## Supabase Instellingen
- Site URL: https://coach-os-tau.vercel.app
- Redirect URLs: https://coach-os-tau.vercel.app/**
- Email bevestiging: AAN

## Roadmap
- Fase 1 KLAAR: Fundering (login, onboarding, home, check-in, AI coach)
- Fase 2: Coach Core (Garmin integratie, coach memory opbouw)
- Fase 3: Data (Apple Health, activiteiten registratie)
- Fase 4: Intelligence (strength/fitness engine, predictions)
- Fase 5: Toekomst (video analyse, Strava/Oura/Whoop)

## Afspraken
- Altijd overleg voor code
- Volledige bestanden tonen
- Python writer voor UTF-8 clean bestanden
- Python zipfile voor zip export (geen bash zip)
- README updaten na elke grote wijziging
- Taal UI: Nederlands
- Design: Dark mode first, mobile-first

## Versiehistorie
- v1.0.0: Fase 1 eerste versie
- v1.1.0: Correcte architectuur API routes, Python UTF-8 writer

## Nieuwe chat starten
Lees mijn README op
https://raw.githubusercontent.com/stuctech-eng/coachOS/refs/heads/main/README.md
en help me verder met CoachOS
