# CoachOS - Project Geheugen

## Project
- App naam: CoachOS
- Versie: 3.7.0
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
      memory/route.ts                klaar (v3.6 — dagelijks vers, oude patronen wissen)
      profile/route.ts               klaar
      profile/update/route.ts        klaar
      goals/route.ts                 klaar
      weekly/route.ts                klaar
      activities/route.ts            klaar
      status/route.ts                klaar (v3.0 — coach score engine)
      chat/route.ts                  klaar (v3.1 — volledige context)
      injuries/route.ts              klaar (v3.3)
      life-events/route.ts           klaar (v3.5)
      action-plan/route.ts           klaar (v3.5 — dagplan)
      predictions/route.ts           klaar (v3.7 — prediction engine)
      trends/route.ts                klaar (v3.6 — 7/30/90 dagen trends)
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
    home/page.tsx                    klaar (v3.7 — voorspellingen sectie)
    checkin/page.tsx                 klaar (v3.5 — uitgebreid)
    insights/page.tsx                klaar (v3.6 — auto-analyse, dagelijks vers)
    settings/page.tsx                klaar (v3.5 — alle links)
    profile/page.tsx                 klaar
    goals/page.tsx                   klaar
    activities/page.tsx              klaar
    weekly/page.tsx                  klaar
    chat/page.tsx                    klaar (v3.6 — bevestiging bij wissen)
    injuries/page.tsx                klaar (v3.3)
    life-events/page.tsx             klaar (v3.5)
    layout.tsx                       klaar
    page.tsx                         klaar
  components/
    ui/index.tsx                     klaar (v3.5 — ScoreSlider lowLabel/highLabel)
    layout/index.tsx                 klaar (v3.1 — Coach tab)
  core/
    ai-engine/recovery-engine.ts     klaar (v3.5 — stress/motivatie/life events)
    prompts/daily-coach.ts           klaar (v3.7 — goal-specific coaching)
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
- coach_recommendations (v3.7: + predictions jsonb kolom)
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
- Chat geschiedenis blijft bewaard (ai_conversations in Supabase)
- Chat wissen vereist bevestiging
- Coach memory analyseert patronen automatisch — dagelijks vers
- Inzichten pagina auto-analyseert bij openen, elke dag nieuwe patronen
- Inzichten pagina werkt met grafieken
- Voorspellingen op home pagina — gecached per dag
- Dagplan op home pagina — gecached per dag
- Goal-specific coaching — andere adviezen per doel type
- Strava sync werkt
- Activiteiten pagina werkt
- Garmin GPX/TCX import werkt
- Apple Health Shortcut sync werkt
- Apple Health automatisering: 07:00 Garmin Connect → 15s wachten → CoachOS sync
- Profiel bewerken werkt
- Doelen beheren werkt
- Blessures beheren werkt
- Levensgebeurtenissen werkt
- Weekly review werkt

## Bekende issues
- Apple Health levert HRV en hartslag in rust niet via Garmin → via check-in
- Apple Health sync levert soms lage waarden als Garmin nog niet volledig gesynchroniseerd heeft

## Volgende stappen
- E7 groeit automatisch met data over tijd
- Prediction Engine verfijnen na 30+ dagen data
- Push notificaties voor check-in herinnering

## Coach Intelligence Architectuur
Raw Data → Engines → Daily Status → AI Coach

Engines:
- Recovery Engine: HRV + hartslag + slaap + stress + motivatie + life events
- Training Engine: activiteiten + volume + trend
- Lifestyle Engine: stappen + consistentie
- Coach Score: Recovery (50%) + Training (30%) + Lifestyle (20%)
- Risk Engine: detecteert overtraining/ziekte/slaapschuld/blessure/mentale vermoeidheid

## Apple Health Setup
- Opdracht: CoachOS (in Opdrachten app)
- Automatisering: dagelijks 07:00 — Open Garmin Connect → Wacht 15s → Voer CoachOS uit
- Data: stappen, gewicht, slaap, calorieën
- HRV en hartslag in rust: via dagelijkse check-in
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

## Roadmap — Next Evolution

### Visie
Observe → Learn → Predict → Coach

Niet: Collect → Display → Graph

CoachOS is succesvol wanneer een gebruiker zegt: "Mijn coach kent mij."

### Status per evolutie
- Evolutie 1 — Pattern Discovery Engine: ✅ gebouwd (Memory 2.0 — dagelijks vers)
- Evolutie 2 — Trend Engine: ✅ gebouwd (7/30/90 dagen trends)
- Evolutie 3 — Prediction Engine: ✅ gebouwd (voorspellingen op home pagina)
- Evolutie 4 — Coach Personality Engine: ✅ gebouwd (menselijke toon in chat + briefing)
- Evolutie 5 — Daily Action Plan: ✅ gebouwd (dagplan op home pagina)
- Evolutie 6 — Goal-specific Coaching: ✅ gebouwd (marathon/afvallen/kracht/gezondheid)
- Evolutie 7 — Second Brain System: ⏳ groeit (ai_conversations + coach_memory)

---

### Evolutie 1 — Pattern Discovery Engine
Detecteert automatisch patronen uit laatste 30 dagen data.
Elke dag bij openen Inzichten: oude patronen wissen, nieuwe genereren.
Opgeslagen in coach_memory, meegestuurd in AI Chat context.

### Evolutie 2 — Trend Engine
Analyseert trends over 7, 30 en 90 dagen.
HRV, rusthartslag, slaap, stappen, coach score.
Toon in Inzichten pagina + samenvatting met alarmen.

### Evolutie 3 — Prediction Engine
Voorspelt wat er de komende 1-3 dagen gaat gebeuren.
2-4 voorspellingen met kanspercentage en concrete actie.
Gecached per dag in coach_recommendations.predictions.

### Evolutie 4 — Coach Personality Engine
Spreekt als een ervaren coach, niet als een dashboard.
Persoonlijk, direct, altijd met concrete actie.
Zowel in Daily Briefing als AI Chat.

### Evolutie 5 — Daily Action Plan
Volledig dagplan met tijden en concrete acties.
Houdt rekening met life events, blessures, coach score.
Gecached per dag in coach_recommendations.action_plan.

### Evolutie 6 — Goal-specific Coaching
Detecteert automatisch doel type: marathon/fietsen, afvallen, kracht, gezondheid.
Geeft andere coaching prioriteiten per doel.
Geïmplementeerd in daily-coach.ts prompt.

### Evolutie 7 — Second Brain System
Groeit via ai_conversations + coach_memory over tijd.
CoachOS leert de gebruiker beter kennen dan de gebruiker zichzelf kent.

---

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
- v3.6.0: Apple Health fix + Inzichten dagelijks vers + Chat wis-bevestiging
- v3.7.0: Prediction Engine + Goal-specific Coaching

## Nieuwe chat starten
Lees mijn README op
https://raw.githubusercontent.com/stuctech-eng/coachOS/refs/heads/main/README.md
en help me verder met CoachOS

## Standaard Werkwijze

### Nieuwe bestanden checklist
1. `'use client'` bovenaan pagina
2. `export const dynamic = 'force-dynamic'` bovenaan API route
3. Supabase tabel aanmaken
4. RLS policy aanmaken: `CREATE POLICY "Users own data" ON tabel FOR ALL USING (auth.uid() = user_id);`
5. Altijd volledig bestand — nooit fragment

### Bug flow
1. Buildlog → exacte fout lezen
2. TypeScript error → props/types checken
3. "Niets veranderd" → bestand op juist pad in Working Copy?
4. "Slaat niet op" → RLS policy Supabase checken
5. "404" → mapnaam exact controleren
6. Dan pas code fixen

### Voor Dick altijd
- Volledig bestand in chat of als zip
- Zip → naam + .zip → uitpakken → Working Copy → push
- Na deploy testen voor volgende stap
- Overleggen voor bouwen
- Secrets NOOIT in de chat plakken

### Technische standaarden
- API route: `export const dynamic = 'force-dynamic'`
- Pagina: `'use client'`
- Auth check: createServerClient + cookies → getUser()
- Database: createAdminClient() voor alle queries
- Supabase: RLS + "Users own data" policy per tabel
- Navigatie: router.push() — nooit router.back()
- Exports: Python zipfile → /mnt/user-data/outputs/
