# CoachOS - Project Geheugen

## Project
- App naam: CoachOS
- Versie: 1.7.1
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
`common_errors` als string teruggaf in plaats van een array.
Regel: AI-data altijd normaliseren vóór gebruik in UI (zie asDisplay()
patroon in training/session/[module]/page.tsx). Elke route die
AI-data rendert heeft een error.tsx boundary.

## ⚠️ BEKENDE BEPERKING — WACHTWOORD RESET IN PWA
Reset-links werken NIET als ze direct vanuit de Mail-app worden geopend
op iOS — de PKCE code verifier (opgeslagen in browser storage tijdens
het aanvragen) is niet beschikbaar in de Mail-app's eigen browser-context.

**Root cause:** Standalone PWA's en de Mail-app's interne browser delen
geen storage/cookie-context met gewone Safari. Dit is een bekend,
gedocumenteerd iOS-patroon (zelfde categorie als Google OAuth redirect
falen in standalone PWA's).

**Workaround (geïmplementeerd in UI):**
1. Open de e-mail in Mail
2. Houd de link lang ingedrukt → "Kopieer link"
3. Open Safari (niet de PWA)
4. Plak de link in de adresbalk en open hem daar
5. Stel wachtwoord in, ga terug naar de PWA om in te loggen

Deze instructie wordt automatisch getoond op /reset-password wanneer:
- De PKCE-fout optreedt ("code verifier not found"), OF
- De gebruiker de pagina opent vanuit standalone PWA-modus (preventief)

**Structurele fix (magic-link login i.p.v. wachtwoord-reset, of eigen
server-side token-exchange route) is bewust niet gebouwd — te grote
wijziging voor een zelden voorkomend scenario.**

## Trainingsysteem
**Actieve route:** `src/app/training/session/[module]/page.tsx`
ENIGE actieve trainingsroute — kettlebell, rowing, running, cycling
via dynamische `[module]` parameter.
**Niet meer gebruiken:** `kettlebell/page.tsx` bestaat niet meer —
veroorzaakte routing-conflict, NOOIT opnieuw aanmaken naast `[module]`.

Features: schema overzicht → uitleg → automatische workout flow
(active → rest → last_rest met uitleg volgende oefening) → tempo
systeem → pause overlay → back/next/volgend met reset-gedrag →
evaluatie layer per module type.

## Coach → Trainer communicatie
Coach schrijft `trainer_instructies` in JSON response.
Trainer leest dit als ⚠️ DIRECTE INSTRUCTIE bovenaan zijn prompt.

## Architectuur
- AI calls naar api.anthropic.com/v1/messages (NOOIT via /api/ai proxy)
- Coach = Sonnet 4.6, Training/action-plan = Haiku 4.5

## Debug pagina
/debug — diagnostiek + training-sessie localStorage check + wis-knop.

## Guardian Mode
Analyse vóór implementatie. Bij onzekerheid STOP + 1 vraag.
Root cause vinden vóór fixen — nooit symptomen patchen.

## Workflow: Claude → iPhone → Working Copy → GitHub → Vercel
1. Bestanden in /home/claude/update/ met exacte projectstructuur
2. Zip zonder tussenmap
3. Zip in /mnt/user-data/outputs/coachOS-vX.X.X.zip
4. present_files

## Bestandsstructuur
src/
  app/
    api/
      ai/route.ts                    klaar (proxy — NIET intern gebruiken)
      action-plan/route.ts           klaar - Haiku
      coach/route.ts                 klaar - Sonnet + trainer_instructies
      training/today/route.ts        klaar - Haiku + coach sync
      training/session/route.ts      klaar
      training/complete/route.ts     klaar
      strava/, health/                klaar
      checkin/, injuries/, goals/, journal/, life-events/, weekly/  klaar
    oefening/[id]/page.tsx           klaar - uitlegpagina + Gemini afbeelding
    debug/page.tsx                   klaar
    reset-password/page.tsx          klaar - PWA-instructie + PKCE diagnose
    home/, checkin/, chat/, coach-call/, dagboek/, goals/, injuries/,
    insights/, life-events/, progressie/, weekly/, settings/  klaar
    training/page.tsx                klaar
    training/session/[module]/
      page.tsx                       klaar - VOLLEDIGE workout engine, alle guards
      error.tsx                      klaar - crash boundary
    training/recovery/               klaar
  lib/
    exercises.ts                     klaar - 5 kettlebell oefeningen
    supabase.ts                      klaar - browserClient (@supabase/ssr) + adminClient

public/
  exercises/                         → Gemini afbeeldingen hier plaatsen

## Database Tabellen
profiles, user_goals, activity_templates, activities, activity_sessions,
daily_checkins, health_metrics, daily_status, coach_memory,
coach_recommendations (incl. trainer_instructies), coach_insights,
knowledge_observations, ai_conversations, strava_tokens, garmin_imports,
injuries, life_events, journal_entries, training_results

## Huidige staat — ALLES WERKT
- Login/register, onboarding, check-in, home + refresh
- Coach advies, dagplan, training schema + coach sync — volledig gefixt
- Coach memory, chat, coach calls
- Inzichten, progressie, weekoverzicht, dagboek, doelen, blessures
- Strava OAuth + sync, Garmin import
- PWA icons, debug pagina
- Oefening uitlegpagina met Gemini afbeeldingen
- Reset-password met zichtbare PWA-instructie (geen silent failures meer)

## Strava Setup
- Client ID: 254388, Callback: coach-os-tau.vercel.app

## Environment Variables (Vercel)
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
SUPABASE_SECRET_KEY, ANTHROPIC_API_KEY,
STRAVA_CLIENT_ID=254388, STRAVA_CLIENT_SECRET=9b4822ef38ccd541a9bbc86730f965a8f5149208

## Versiehistorie
- v1.0.0 t/m v1.5.0: Basis app volledig gebouwd
- v1.6.0: Oefening bibliotheek + Gemini afbeeldingen
- v1.7.0: Training crash root cause gefixt (common_errors.map + alle guards)
- v1.7.1: Reset-password PWA-beperking gedocumenteerd + zichtbare instructie

## Nieuwe chat starten
Lees mijn README op
https://raw.githubusercontent.com/stuctech-eng/coachOS/refs/heads/main/README.md
en help me verder met CoachOS
