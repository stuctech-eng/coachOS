# CoachOS - Project Geheugen

## Project
- App naam: CoachOS
- Versie: 1.7.0
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

## ⚠️ KRITIEKE LES — AI-OUTPUT NOOIT VERTROUWEN ZONDER GUARD
Op 19 juni 2026 crashte de hele training-flow omdat de Trainer AI
`common_errors` als string teruggaf in plaats van een array, en de
code deed direct `.map()` zonder te checken.

**Regel voortaan:** ELKE keer dat AI-gegenereerde data (segments,
common_errors, recovery_modules, etc.) in de UI wordt gebruikt:
- Nooit direct `.map()`, `.length`, of property-toegang zonder check
- Gebruik `asDisplay()` normalisatie in training/session/[module]/page.tsx
  als voorbeeldpatroon — elk veld wordt expliciet getypecheckt met
  een veilige fallback
- `getSegments()` en `getSeg()` retourneren altijd een veilige waarde,
  nooit een crash
- Een `error.tsx` boundary staat in elke route die AI-data rendert,
  zodat een onverwachte crash een leesbare foutmelding toont in plaats
  van een witte "Application error" pagina

## Trainingsysteem (BELANGRIJK)
**Actieve route:** `src/app/training/session/[module]/page.tsx`
Dit is de ENIGE actieve trainingsroute — behandelt kettlebell, rowing,
running, cycling allemaal via de dynamische `[module]` parameter.

**Niet meer gebruiken:** `src/app/training/session/kettlebell/page.tsx`
bestond als losse, simpelere route en veroorzaakte een routing-conflict
(Next.js geeft specifieke routes voorrang boven dynamische routes).
Deze map is verwijderd — NOOIT opnieuw aanmaken naast `[module]`.

**Features in [module]/page.tsx:**
- Schema overzicht → uitleg eerste oefening → automatische workout flow
- workout_phase: active → rest → last_rest (toont uitleg volgende oefening
  met aftellende rust timer) → volgende oefening start automatisch
- Tempo systeem (reps → seconden, slow/normal/fast, opslag in localStorage)
- Pause overlay (stopt timer + oefening)
- Back/Next/Volgend knoppen — elk met eigen reset-gedrag:
  - Back: vorige oefening, timer reset, naar uitleg
  - Next: skip huidige stap (rust/set/oefening), timer reset, auto blijft aan
  - Volgend: naar volgende oefening, timer reset, naar uitleg
- Evaluatie layer met module-specifieke scores (rowing/running/cycling)
- Sessie hervatten via localStorage (SESSION_STORAGE_KEY)

## Coach → Trainer communicatie
Coach schrijft `trainer_instructies` in zijn JSON response.
Trainer leest dit als ⚠️ DIRECTE INSTRUCTIE bovenaan zijn prompt.

## Architectuur
- AI calls naar api.anthropic.com/v1/messages (NOOIT via /api/ai proxy)
- Coach = Sonnet 4.6
- Training/action-plan = Haiku 4.5

## Debug pagina
Bereikbaar via: Instellingen → Debug diagnostiek → /debug
Bevat training-sessie localStorage check + wis-knop voor crash-herstel.

## Guardian Mode
Analyse vóór implementatie. Bij onzekerheid STOP + 1 vraag.
Root cause vinden vóór fixen — nooit symptomen patchen.

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
- AI-output altijd normaliseren vóór gebruik in UI (zie kritieke les hierboven)

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
    debug/page.tsx                   klaar - diagnostiek + training-sessie check
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
    training/session/[module]/
      page.tsx                       klaar - VOLLEDIGE workout engine, alle guards
      error.tsx                      klaar - crash boundary met leesbare foutmelding
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
- Training schema + coach sync — VOLLEDIG GEFIXT met defensieve guards
- Coach memory, coach chat, coach calls
- Inzichten, progressie, weekoverzicht
- Dagboek, doelen, blessures, levensgebeurtenissen
- Strava OAuth + sync, Garmin import
- PWA icons, debug pagina
- Oefening uitlegpagina met Gemini afbeeldingen

## Bekende issue — wachtwoord reset / magic link
Reset-password flow opent soms verkeerd scherm in Mail-app context
(vraagt opnieuw om e-mail i.p.v. wachtwoord-formulier te tonen).
Tijdelijke workaround: nieuw wachtwoord direct instellen via
Supabase Dashboard → Authentication → Users → gebruiker → Reset password.
Nog niet root-cause opgelost — volgende sessie oppakken.

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
- v1.6.x: Training routing conflict (kettlebell vs [module]) — opgelost
  door kettlebell/page.tsx te verwijderen
- v1.7.0: Root cause crash gevonden (common_errors.map op non-array) +
  volledige defensieve guards in [module]/page.tsx + error.tsx boundary

## Nieuwe chat starten
Lees mijn README op
https://raw.githubusercontent.com/stuctech-eng/coachOS/refs/heads/main/README.md
en help me verder met CoachOS
