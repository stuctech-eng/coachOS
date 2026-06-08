# CoachOS - Project Geheugen

## Project
- App naam: CoachOS
- Versie: 5.1.0
- App URL: https://coach-os-tau.vercel.app
- GitHub: https://github.com/stuctech-eng/coachOS
- Supabase: https://fabtmkrzqrrwbvgaugjst.supabase.co
- Architectuur: V4.0

## Stack
- Frontend: Next.js 14.2.29 + TypeScript + PWA
- Auth: Supabase Auth
- Database: Supabase PostgreSQL
- AI: Claude API via /api/ai proxy (geen SDK — directe fetch)
- State: Zustand
- Styling: Tailwind CSS
- Hosting: Vercel
- Afbeelding compressie: sharp ^0.33.0

---

# CoachOS V5.0 — Volledige AI Architectuur

## Kernvisie
CoachOS is een AI Coaching Operating System.
Observe → Learn → Predict → Coach → Execute → Learn Again

## AI Lagen (alle compleet)

### Coach AI (Master Brain — Altijd Leidend)
- bepaalt training vs herstel vs rust
- analyseert ALLE data: Garmin, check-in, levensgebeurtenissen, werktijden, blessures, trainingshistorie, Performance AI
- genereert dagplannen BUITEN werktijden
- plant activiteiten op basis van werktijden uit levensgebeurtenissen

### Trainer AI (✅ Kettlebell v2)
- 25 oefeningen, niveau 1-2-3
- Adaptief op basis van experience, Body Battery, ratings
- Progressie: rating ≥ 8 + BB ≥ 70 → niveau omhoog
- Feedbackveld (rating + notes) na elke sessie

### Recovery AI (✅)
- Ademhaling: Box Breathing, 4-7-8, Coherent, Stress Reset
- Mobiliteit: Nek & Schouders, Heupen, Full Body
- Wandeling: Herstelwandeling

### Performance AI (✅ v5.1)
- Analyseert trainingsresultaten over 30 dagen
- Output: progressie_trend, consistentie, herstel_na_training, niveau_gereed
- Dagelijks gecached in coach_recommendations
- Zichtbaar in Progressie tab
- Stuurt Coach AI bij via context

---

## AI Context per Route (v5.0 — volledig)

| Route | Life events | Werktijden | Garmin | Blessures | Trainingen | Performance |
|---|---|---|---|---|---|---|
| action-plan | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| training/today | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| coach | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| chat | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| predictions | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| memory | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| weekly | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| performance | — | — | ✅ | ✅ | ✅ | — |

---

## System Flow
USER DATA + GARMIN + WERKTIJDEN + BLESSURES + TRAININGEN → COACH AI + PERFORMANCE AI → TRAINER AI / RECOVERY AI → RESULT → COACH AI (learning)

## Harde Regels
1. Coach AI is altijd leidend
2. Plan NOOIT activiteiten tijdens werktijd
3. Home = dagelijkse actie
4. Progressie = eigen tab (met Performance AI)
5. Training = uitvoering
6. Coach = AI interface

---

# Navigatie V4.5
Home | Training | Progressie | Coach | Instellingen

Inzichten bereikbaar via Instellingen.

---

# Data Strategie

## Garmin Import Schema (v4.7)
```json
{
  "resting_hr": 46,
  "body_battery": { "current": 83, "charged": 49, "spent": 8 },
  "sleep": { "score": 83, "duration_minutes": 408 },
  "hrv": { "avg_7d_ms": 49, "status": "balanced" },
  "stress": 18,
  "breathing": { "current_brpm": 20, "avg_awake_brpm": 15, "avg_sleep_brpm": 13 },
  "meta": { "source": "garmin_screenshot", "parsed_at": "timestamp" }
}
```

## Garmin indicator bolletje (Home)
- 🟢 Groen = vandaag bevestigd
- 🟡 Amber = gisteren
- ⚪ Grijs = geen recente data

---

# Performance AI — Analyse Schema
```
progressie_trend:    stijgend / stabiel / dalend / onvoldoende_data
consistentie:        hoog / gemiddeld / laag / onvoldoende_data
herstel_na_training: goed / matig / slecht / onvoldoende_data
niveau_gereed:       true / false
gem_rating:          getal of null
trainingen_per_week: getal of null
samenvatting:        tekst voor Coach AI
```

Niveau gereed = gem. rating laatste 3 sessies ≥ 8 ÉN Body Battery ≥ 70

---

# Bestandsstructuur

src/
  app/
    api/
      action-plan/route.ts                klaar (v5.0)
      coach/route.ts                      klaar (v5.0)
      chat/route.ts                       klaar (v5.0)
      predictions/route.ts                klaar (v5.0)
      memory/route.ts                     klaar (v5.0)
      status/route.ts                     klaar (v4.3)
      weekly/route.ts                     klaar (v5.1 — vorige week op maandag)
      performance/route.ts                klaar (v5.1 — nieuw)
      training/
        today/route.ts                    klaar (v5.1 — Performance AI context)
        session/route.ts                  klaar (v4.5)
        complete/route.ts                 klaar (v4.4)
      recovery/
        complete/route.ts                 klaar (v4.2)
      health/
        garmin-vision/route.ts            klaar (v4.8)
      strava/                             klaar
    home/page.tsx                         klaar (v4.7)
    insights/page.tsx                     klaar (v4.7)
    progressie/page.tsx                   klaar (v5.1 — Performance AI sectie)
    settings/page.tsx                     klaar (v4.9.1)
    settings/hoe-werkt-het/page.tsx       klaar (v5.1 — Performance AI sectie)
    settings/garmin-import/page.tsx       klaar (v4.7)
    training/
      page.tsx                            klaar (v5.0)
      kettlebell/page.tsx                 klaar (v4.8)
      recovery/
        breathing/page.tsx                klaar (v4.2)
        mobility/page.tsx                 klaar (v4.2)
        walk/page.tsx                     klaar (v5.0)
    reset-password/page.tsx               klaar (v4.9.4)
    auth/callback/route.ts                klaar (v4.9.4)

---

# Supabase Tabellen
profiles, user_goals, daily_checkins, health_metrics(inactief),
coach_memory, coach_recommendations, activities, activity_sessions,
activity_templates, strava_tokens, knowledge_observations, ai_conversations,
daily_status, injuries, life_events, training_sessions,
training_results(rating+notes), recovery_sessions, recovery_results,
garmin_imports

coach_recommendations gebruikt voor cache van:
- dagplan (type: action_plan)
- voorspellingen (type: predictions)
- performance AI (type: performance_ai)

---

# Huidige Staat (v5.1.0) — Volledig

Werkend:
- Login, onboarding, profiel, doelen, blessures, levensgebeurtenissen
- Check-in, weekly review (vorige week op maandag)
- Home: Coach Score + Dagplan + Voorspellingen + Garmin reminder + indicator
- Coach AI — volledige context, plant BUITEN werktijden
- Inzichten: Garmin grafieken + Trends + Coach inzichten
- Garmin Vision Import — automatische compressie, stress + ademhaling
- Recovery AI — ademhaling, mobiliteit, wandeling
- Trainer AI Kettlebell — adaptief, 25 oefeningen, feedbackveld
- Performance AI — progressie analyse zichtbaar in Progressie tab
- Progressie dashboard + Performance AI sectie
- Hoe werkt CoachOS — alle secties inclusief Performance AI
- Wachtwoord vergeten flow
- Navigatie: Home | Training | Progressie | Coach | Instellingen

---

# Evoluties Status

- E1 Pattern Discovery: ✅
- E2 Trend Engine: ✅
- E3 Prediction Engine: ✅
- E4 Coach Personality: ✅
- E5 Daily Action Plan: ✅
- E6 Goal-specific Coaching: ✅
- E7 Second Brain: ⏳ groeit
- E8 Training Execution (Trainer AI): ✅
- E9 Recovery Execution (Recovery AI): ✅
- E10 Garmin Vision Import: ✅
- E11 Progressie Dashboard: ✅
- E12 Gebruikersuitleg: ✅
- E13 Performance AI: ✅

---

# Versiehistorie
- v4.0.0 t/m v4.9.4: zie vorige sessies
- v5.0.0: Volledige AI context alle routes + walk fix + wachtwoord reset
- v5.0.1-5.0.5: Bug fixes routes (chat, predictions, memory, weekly)
- v5.1.0: Performance AI + Progressie tab uitbreiding + Hoe werkt CoachOS update + Weekly vorige week fix

---

# Nieuwe Chat Starten
Lees mijn README op
https://raw.githubusercontent.com/stuctech-eng/coachOS/refs/heads/main/README.md
en help me verder met CoachOS

---

# Standaard Werkwijze

## Nieuwe bestanden checklist
1. 'use client' bovenaan pagina
2. export const dynamic = 'force-dynamic' bovenaan API route
3. RLS policy indien nieuwe tabel
4. Altijd volledig bestand
5. README bijwerken
6. Hoe werkt CoachOS bijwerken indien relevant

## Bug flow
1. Buildlog → exacte fout lezen
2. Destructuring telt altijd queries — check met python script
3. Pagina scrollt niet → gebruik AppShell (body heeft overflow-hidden)
4. Icon crash → controleer lucide-react 0.400
5. 401 → aanroepen via router.push vanuit ingelogde pagina
6. .data?.parsed_data fout → query mist .single()

## Technische standaarden
- API route: export const dynamic = 'force-dynamic'
- Pagina: 'use client'
- Auth: createServerClient + cookies → getUser()
- Database: createAdminClient()
- Navigatie: router.push() — nooit router.back()
- Anthropic: directe fetch — geen SDK
- Afbeelding: sharp resize 800px JPEG 80%
- Pagina's zonder AppShell: aanroepen via router.push
- Pagina's die scrollen: gebruik AppShell

## Voor Dick altijd
- Zip → naam + .zip → uitpakken → Working Copy → push
- Na deploy testen
- Overleggen voor bouwen
- README + Hoe werkt CoachOS altijd bijwerken
- Secrets NOOIT in de chat

## Strava Setup
- Client ID: 254388
- Callback: coach-os-tau.vercel.app
