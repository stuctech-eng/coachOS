# CoachOS - Project Geheugen

## Project
- App naam: CoachOS
- Versie: 1.5.0
- App URL: https://coach-os-tau.vercel.app
- GitHub: https://github.com/stuctech-eng/coachOS
- Supabase: https://fabtmkrzqrrwbvgaugjm.supabase.co
- Blueprint: V2.2

## Stack
- Frontend: Next.js 14.2.29 + TypeScript + PWA
- Auth: Supabase Auth
- Database: Supabase PostgreSQL
- AI: Claude API (directe Anthropic calls vanuit API routes)
- State: Zustand
- Styling: Tailwind CSS
- Hosting: Vercel

## ⚠️ KERNPRINCIPE — NOOIT VERGETEN
**Coach bepaalt alles. Trainer pakt het over.**

- Coach (Sonnet 4.6) bepaalt: trainen / herstel / rust
- Coach houdt rekening met blessures, Garmin, check-in, dagboek, doelen
- Coach geeft expliciete instructies aan Trainer via `trainer_instructies` veld
- Trainer (Haiku 4.5) voert exact uit wat Coach zegt
- Trainer voegt NIETS toe op eigen initiatief
- Coach kan alle trainingen geven: kettlebell, rowing, running, cycling, strength, bodyweight

## Guardian Mode — Altijd actief
Analyse gaat altijd vóór implementatie.

NOOIT:
- gokken of aannames doen
- direct code schrijven zonder analyse
- symptomen fixen zonder root cause
- bestaande functionaliteit breken

ALTIJD:
- eerst begrijpen
- root cause + dependency + impact analyse
- kleinste veilige wijziging
- geen duplicatie

Bij ontbrekende context: STOP + 1 gerichte vraag.

## Command System
Commands zijn leidend boven alles.

- README → volledige README.md maken
- FIX → oorzaak + oplossing, wachten op akkoord
- NEXT → volgende stap + plan
- STATUS → wat werkt / ontbreekt / risico / volgende stap
- DEBUG → debug pagina aanmaken
- VERSION → versie + changelog

## Coach → Trainer communicatie
Coach schrijft `trainer_instructies` in zijn JSON response.
Trainer leest dit als ⚠️ DIRECTE INSTRUCTIE bovenaan zijn prompt.

Supabase migratie (eenmalig uitgevoerd):
```sql
ALTER TABLE coach_recommendations
ADD COLUMN IF NOT EXISTS trainer_instructies text;
```

## Architectuur
Browser (client-side):
- Auth via browserClient (publishable key)
- UI state via Zustand
- Data via fetch('/api/...')
- Geen directe Supabase data calls

API Routes (server-side):
- Auth check via createServerClient + cookies
- Data via createAdminClient (secret key)
- AI calls rechtstreeks naar api.anthropic.com/v1/messages
- NOOIT via /api/ai proxy (geeft 500 errors)
- Coach = Sonnet 4.6
- Training/action-plan = Haiku 4.5

## Debug pagina
Bereikbaar via: Instellingen → Debug diagnostiek → /debug

Checks:
1. Environment variables
2. Supabase auth sessie
3. Database tabellen
4. API routes
5. Anthropic API
6. PWA standalone modus
7. Vandaag data (check-in, Garmin, coach advies)

Kopieerknop: kopieert volledige log → plak in chat voor hulp.

## Workflow: Claude → iPhone → Working Copy → GitHub → Vercel

### Hoe Claude bestanden aanlevert:
1. Bestanden in /home/claude/update/ met exacte projectstructuur
2. Zip zonder tussenmap (direct src/... en README.md)
3. Zip in /mnt/user-data/outputs/coachOS-vX.X.X.zip
4. present_files om zip zichtbaar te maken

### Hoe jij de update doorvoert:
1. Download zip op iPhone
2. Hernoem naar naam.zip als iPhone extensie weglaat
3. Uitpakken in Bestanden-app
4. Working Copy → bestanden op juiste plek
5. Push → Vercel deployt automatisch

### Regels voor Claude:
- Alleen gewijzigde bestanden in de zip
- Geen tussenmap in de zip
- Altijd README updaten met versienummer
- Directe Anthropic API calls — NOOIT via /api/ai proxy
- Coach bepaalt alles — Trainer voegt niets toe
- Guardian Mode altijd actief

## Bestandsstructuur
src/
  app/
    api/
      ai/route.ts                    klaar (proxy — NIET meer gebruiken intern)
      action-plan/route.ts           klaar - Haiku
      checkin/route.ts               klaar
      coach/route.ts                 klaar - Sonnet + trainer_instructies
      coach-calls/route.ts           klaar
      coach-calls/rate/route.ts      klaar
      memory/route.ts                klaar
      profile/route.ts               klaar
      profile/update/route.ts        klaar
      status/route.ts                klaar
      training/
        today/route.ts               klaar - Haiku + coach sync
        session/route.ts             klaar
        complete/route.ts            klaar
      strava/
        auth/route.ts                klaar
        callback/route.ts            klaar
        sync/route.ts                klaar
        webhook/route.ts             klaar
      health/
        import/route.ts              klaar
        garmin-vision/route.ts       klaar
        shortcut/route.ts            klaar
      injuries/route.ts              klaar
      goals/route.ts                 klaar
      journal/route.ts               klaar
      life-events/route.ts           klaar
      weekly/route.ts                klaar
    debug/page.tsx                   klaar - diagnostiek + kopieerknop
    login/page.tsx                   klaar
    register/page.tsx                klaar
    onboarding/page.tsx              klaar
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
    training/kettlebell/page.tsx     klaar
    training/session/[module]/       klaar
    training/recovery/               klaar
    weekly/page.tsx                  klaar
    settings/page.tsx                klaar
    settings/equipment/page.tsx      klaar
    settings/garmin-import/page.tsx  klaar
    settings/hoe-werkt-het/page.tsx  klaar
    layout.tsx                       klaar
    page.tsx                         klaar

## Database Tabellen
- profiles
- user_goals
- activity_templates
- activities
- activity_sessions
- daily_checkins
- health_metrics
- daily_status
- coach_memory
- coach_recommendations (incl. trainer_instructies kolom)
- coach_insights
- knowledge_observations
- ai_conversations
- strava_tokens
- garmin_imports
- injuries
- life_events
- journal_entries
- training_results

## Huidige staat — ALLES WERKT
- Login/register
- Onboarding
- Check-in
- Home scherm + refresh
- Coach advies (Sonnet)
- Dagplan (Haiku)
- Training schema (Haiku) + coach sync
- Coach memory
- Coach chat
- Coach calls (Strava activiteiten evaluatie)
- Inzichten pagina
- Progressie pagina
- Weekoverzicht + coach weekanalyse
- Dagboek
- Doelen
- Blessures
- Levensgebeurtenissen
- Strava OAuth + activiteiten sync
- Garmin import via screenshot
- PWA icons
- Debug pagina met kopieerknop

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
- NEXT_PUBLIC_APP_URL=https://coach-os-tau.vercel.app (optioneel)
- STRAVA_CLIENT_ID=254388
- STRAVA_CLIENT_SECRET=9b4822ef38ccd541a9bbc86730f965a8f5149208

## Supabase Instellingen
- Site URL: https://coach-os-tau.vercel.app
- Redirect URLs: https://coach-os-tau.vercel.app/**
- Email bevestiging: AAN

## Versiehistorie
- v1.0.0: Fase 1 eerste versie
- v1.1.0: Correcte architectuur API routes
- v1.1.1: Check-in upsert fix
- v1.2.0: Coach memory + inzichten pagina
- v1.3.0: Strava OAuth + activiteiten sync
- v1.3.1: API key fix + directe Anthropic calls + Coach/Training sync
- v1.4.0: Coach leidend + Haiku + skeleton loading
- v1.4.1: Heup mobiliteit logica
- v1.4.2: Coach bepaalt, Trainer geen eigen logica
- v1.4.3: Geen dubbele modules
- v1.4.4: Coach geeft trainer_instructies aan Trainer
- v1.4.5: Strikt recovery_modules formaat + filter ongeldige modules
- v1.4.6: Debug diagnostiek pagina
- v1.4.7: Debug link in Instellingen
- v1.4.8: Debug kopieerknop
- v1.4.9: README bijgewerkt
- v1.5.0: Alles werkt — Guardian Mode + Command System in README

## Nieuwe chat starten
Lees mijn README op
https://raw.githubusercontent.com/stuctech-eng/coachOS/refs/heads/main/README.md
en help me verder met CoachOS
