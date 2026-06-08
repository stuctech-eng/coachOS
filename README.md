# CoachOS - Project Geheugen

## Project
- App naam: CoachOS
- Versie: 5.0.0
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

# CoachOS V4.0 — AI Architectuur

## Kernvisie
CoachOS is een AI Coaching Operating System.
Observe → Learn → Predict → Coach → Execute → Learn Again

## AI Lagen

### Coach AI (Master Brain — Altijd Leidend)
- bepaalt training vs herstel vs rust
- analyseert ALLE data: Garmin, check-in, levensgebeurtenissen, werktijden, blessures, trainingshistorie
- genereert dagplannen + voorspellingen BUITEN werktijden

### Trainer AI (✅ gebouwd — Kettlebell v2, adaptief)
### Recovery AI (✅ gebouwd)
BreathingEngine | MobilityEngine | WalkEngine ✅

---

## AI Context per Route (v5.0 — volledig)

| Route | Life events | Werktijden | Garmin | Blessures | Trainingen |
|---|---|---|---|---|---|
| action-plan | ✅ | ✅ | ✅ | ✅ | ✅ |
| training/today | ✅ | ✅ | ✅ | ✅ | ✅ |
| coach | ✅ | ✅ | ✅ | ✅ | ✅ |
| chat | ✅ | ✅ | ✅ | ✅ | ✅ |
| predictions | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## System Flow
USER DATA + GARMIN + WERKTIJDEN + BLESSURES + TRAININGEN → COACH AI → TRAINER AI / RECOVERY AI → RESULT → COACH AI (learning)

## Harde Regels
1. Coach AI is altijd leidend
2. Plan NOOIT activiteiten tijdens werktijd
3. Home = dagelijkse actie
4. Progressie = eigen tab
5. Training = uitvoering
6. Coach = AI interface

---

# Navigatie V4.5
Home | Training | Progressie | Coach | Instellingen

---

# Garmin Import Schema (v4.7)
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

---

# Home — Garmin indicator bolletje
- 🟢 Groen = Garmin import vandaag
- 🟡 Amber = Garmin import van gisteren
- ⚪ Grijs = Geen recente data

---

# Recovery System V1 (✅)
Ademhaling: Box Breathing, 4-7-8, Coherent, Stress Reset
Mobiliteit: Nek & Schouders, Heupen, Full Body
Wandeling: Herstelwandeling ✅ (definitief gefixed v5.0)

---

# Training System V2 (✅)

## Kettlebell Trainer AI — Adaptief
25 oefeningen | Niveau 1-2-3 | Progressielogica | Feedbackveld

---

# Bestandsstructuur

src/
  app/
    api/
      action-plan/route.ts                klaar (v5.0 — volledig context)
      coach/route.ts                      klaar (v5.0 — life events + blessures + werktijden)
      chat/route.ts                       klaar (v5.0 — Garmin + trainingen toegevoegd)
      predictions/route.ts                klaar (v5.0 — Garmin + werktijden + trainingen)
      training/
        today/route.ts                    klaar (v5.0 — werktijden fix)
        session/route.ts                  klaar (v4.5)
        complete/route.ts                 klaar (v4.4)
      recovery/
        complete/route.ts                 klaar (v4.2)
      health/
        garmin-vision/route.ts            klaar (v4.8)
      strava/                             klaar
    home/page.tsx                         klaar (v4.7)
    insights/page.tsx                     klaar (v4.7)
    progressie/page.tsx                   klaar (v4.6)
    settings/page.tsx                     klaar (v4.9.1)
    settings/hoe-werkt-het/page.tsx       klaar (v4.9.2)
    settings/garmin-import/page.tsx       klaar (v4.7)
    training/
      page.tsx                            klaar (v5.0 — walk icoon + route fix)
      kettlebell/page.tsx                 klaar (v4.8)
      recovery/
        breathing/page.tsx                klaar (v4.2)
        mobility/page.tsx                 klaar (v4.2)
        walk/page.tsx                     klaar (v5.0 — definitief herschreven)
    reset-password/page.tsx               klaar (v4.9.4)
    auth/callback/route.ts                klaar (v4.9.4)

---

# Supabase Tabellen
profiles, user_goals, daily_checkins, health_metrics(inactief), coach_memory,
coach_recommendations, activities, activity_sessions, activity_templates,
strava_tokens, knowledge_observations, ai_conversations, daily_status,
injuries, life_events, training_sessions, training_results(rating+notes),
recovery_sessions, recovery_results, garmin_imports

---

# Huidige Staat (v5.0.0)

Werkend:
- Volledige AI context in alle routes (leven, werk, garmin, blessures, trainingen)
- Coach AI plant BUITEN werktijden
- Herstelwandeling ✅
- Wachtwoord vergeten flow ✅
- Alle navigatie correct
- Progressie dashboard
- Hoe werkt CoachOS uitlegpagina

---

# Nog Te Bouwen
- Performance AI
- Memory route context uitbreiden
- Weekly route context uitbreiden

---

# Versiehistorie
- v4.0.0 t/m v4.9.4: zie vorige versies
- v5.0.0: Volledige AI context in alle routes + walk fix + wachtwoord reset

---

# Nieuwe Chat Starten
Lees mijn README op
https://raw.githubusercontent.com/stuctech-eng/coachOS/refs/heads/main/README.md
en help me verder met CoachOS

---

# Standaard Werkwijze

## Checklist nieuwe bestanden
1. 'use client' bovenaan pagina
2. export const dynamic = 'force-dynamic' bovenaan API route
3. RLS policy toevoegen indien nieuwe tabel
4. Altijd volledig bestand
5. "Hoe werkt CoachOS" bijwerken indien relevant

## Bug flow
1. Buildlog → exacte fout lezen
2. Pagina scrollt niet → gebruik AppShell
3. Icon crash → controleer lucide-react 0.400
4. 401 → aanroepen via router.push vanuit ingelogde pagina
5. Coach plant tijdens werk → life_events start_hour ontbreekt in context

## Technische standaarden
- API route: export const dynamic = 'force-dynamic'
- Pagina: 'use client'
- Auth: createServerClient + cookies → getUser()
- Database: createAdminClient()
- Navigatie: router.push() — nooit router.back()
- Anthropic: directe fetch — geen SDK
- Afbeelding: sharp resize 800px JPEG 80%
- Pagina's zonder AppShell: aanroepen via router.push
- Pagina's die scrollen: gebruik AppShell (body heeft overflow-hidden)

## Voor Dick altijd
- Zip → naam + .zip → uitpakken → Working Copy → push
- Na deploy testen
- Overleggen voor bouwen
- README altijd in zip, zelfde naam
- Secrets NOOIT in de chat
