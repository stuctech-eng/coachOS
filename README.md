# CoachOS - Project Geheugen

## Project
- App naam: CoachOS
- Versie: 1.4.8
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

## Coach → Trainer communicatie
Coach schrijft `trainer_instructies` in zijn JSON response.
Trainer leest dit als ⚠️ DIRECTE INSTRUCTIE bovenaan zijn prompt.
Kolom `trainer_instructies` (text) toegevoegd aan coach_recommendations tabel:
```sql
ALTER TABLE coach_recommendations
ADD COLUMN IF NOT EXISTS trainer_instructies text;
```

## Debug pagina
Bereikbaar via: Instellingen → Debug diagnostiek → /debug

Checks:
1. Environment variables (Supabase URL, Key, App URL)
2. Supabase auth sessie actief?
3. Database tabellen bereikbaar? (profiles, checkins, garmin, coach)
4. API routes werken? (/api/checkin, /api/status)
5. Anthropic API bereikbaar? (Haiku mini call)
6. PWA standalone modus?
7. Vandaag data (check-in, Garmin, coach advies, trainer_instructies)

Kopieerknop: kopieert volledige log naar clipboard — plak direct in chat voor hulp.

Veelvoorkomende fouten:
- App URL ONTBREEKT → zet NEXT_PUBLIC_APP_URL in Vercel
- Anthropic API FOUT → nieuwe key aanmaken op console.anthropic.com
- trainer_instructies kolom ontbreekt → SQL: ALTER TABLE coach_recommendations ADD COLUMN IF NOT EXISTS trainer_instructies text;

## Workflow: Claude → iPhone → Working Copy → GitHub → Vercel

### Hoe Claude bestanden aanlevert:
1. Claude bewerkt bestanden in /home/claude/update/ met exacte projectstructuur
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

## Bestandsstructuur
src/
  app/
    api/
      ai/route.ts                    klaar (proxy — NIET meer gebruiken intern)
      action-plan/route.ts           klaar - Haiku
      checkin/route.ts               klaar
      coach/route.ts                 klaar - Sonnet + trainer_instructies
      memory/route.ts                klaar
      profile/route.ts               klaar
      training/
        today/route.ts               klaar - Haiku, strikt recovery_modules formaat
      strava/
        auth/route.ts                klaar
        callback/route.ts            klaar
        sync/route.ts                klaar
    debug/page.tsx                   klaar - diagnostiek + kopieerknop
    login/page.tsx                   klaar
    register/page.tsx                klaar
    onboarding/page.tsx              klaar
    home/page.tsx                    klaar
    checkin/page.tsx                 klaar
    insights/page.tsx                klaar
    training/page.tsx                klaar - skeleton loading + filter modules
    settings/page.tsx                klaar - debug link onderaan
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

## Huidige staat
- Login/register werkt
- Onboarding werkt
- Check-in werkt
- Home scherm werkt + refresh
- Coach advies werkt (Sonnet)
- Dagplan werkt (Haiku)
- Training schema werkt (Haiku)
- Coach memory werkt
- Inzichten pagina werkt
- Strava OAuth + sync werkt
- Coach en Training gesynchroniseerd via trainer_instructies
- Skeleton loading tijdens genereren
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
- NEXT_PUBLIC_APP_URL niet gezet (waarschuwing in debug)

## Volgende stappen
1. Apple Health export verwerken
2. Activiteiten pagina bouwen
3. Garmin API aanvraag indienen
4. Weekly review
5. NEXT_PUBLIC_APP_URL toevoegen in Vercel

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
- v1.4.7: Debug link in Instellingen + settings page update
- v1.4.8: Debug kopieerknop + volledige README update

## Nieuwe chat starten
Lees mijn README op
https://raw.githubusercontent.com/stuctech-eng/coachOS/refs/heads/main/README.md
en help me verder met CoachOS
