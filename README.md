# CoachOS — Project Geheugen

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

## Bestandsstructuur
src/
  app/
    api/
      ai/route.ts              klaar
      checkin/route.ts         klaar
      coach/route.ts           klaar
      profile/route.ts         klaar
    login/page.tsx             klaar
    register/page.tsx          klaar
    onboarding/page.tsx        klaar
    home/page.tsx              klaar
    checkin/page.tsx           klaar
    settings/page.tsx          klaar
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

## Huidige staat
- Login/register werkt
- Onboarding werkt (Start CoachOS knop werkt)
- Check-in werkt (opslaan via API route)
- Home scherm werkt
- Genereer advies — nog niet getest na v1.1 push

## Bekende bugs
- Activiteiten pagina niet gebouwd
- PWA icons ontbreken

## Volgende stappen
1. v1.1 push naar GitHub bevestigen
2. Vercel deployment controleren
3. Genereer advies testen
4. Naam tonen op home scherm controleren

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
- v1.1.0: Correcte architectuur API routes, Python UTF-8 writer

## Nieuwe chat starten
Lees mijn README op
https://raw.githubusercontent.com/stuctech-eng/coachOS/refs/heads/main/README.md
en help me verder met CoachOS
