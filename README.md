# CoachOS - Project Geheugen

## Project
- App naam: CoachOS
- Versie: 4.9.4
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
- analyseert alle data + trends + Garmin data + trainingshistorie
- genereert dagplannen + voorspellingen

### Trainer AI (✅ gebouwd — Kettlebell v2, adaptief)
### Recovery AI (✅ gebouwd)
BreathingEngine | MobilityEngine | WalkEngine

---

## System Flow
USER DATA + GARMIN DATA + TRAININGSRESULTATEN → COACH AI → TRAINER AI / RECOVERY AI → RESULT DATA → COACH AI (learning)

## Harde Regels
1. Coach AI is altijd leidend
2. Home = dagelijkse actie
3. Progressie = eigen tab
4. Training = uitvoering
5. Coach = AI interface

---

# Navigatie V4.5
Home | Training | Progressie | Coach | Instellingen

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

---

# Huidige Staat (v4.9.4)

Werkend:
- Login, onboarding, profiel, doelen, blessures
- Check-in, weekly review, levensgebeurtenissen
- Home: Coach Score + Dagplan + Voorspellingen + Garmin reminder + indicator bolletje
- Coach Score automatisch berekend (Garmin-aware)
- Risk Engine, AI Coach Chat, Coach memory
- Inzichten: Garmin grafieken + Trends + Coach inzichten
- Garmin Vision Import — automatische compressie
- Recovery AI: ademhaling, mobiliteit, wandeling
- Trainer AI Kettlebell — adaptief, 25 oefeningen, feedbackveld
- Progressie dashboard
- Hoe werkt CoachOS uitlegpagina
- Navigatie: Home | Training | Progressie | Coach | Instellingen

---

# Nog Te Bouwen
- Coach AI stress + ademhaling in context
- Performance AI

---

# Versiehistorie
- v4.9.4: Walk pagina fix — Square icon vervangen door StopCircle

---

# Nieuwe Chat Starten
Lees mijn README op
https://raw.githubusercontent.com/stuctech-eng/coachOS/refs/heads/main/README.md
en help me verder met CoachOS

---

# Standaard Werkwijze

## Bug flow
1. Buildlog → exacte fout lezen
2. TypeScript error → props/types checken
3. Pagina scrollt niet → gebruik AppShell (body heeft overflow-hidden)
4. Icon crash → controleer of icon bestaat in lucide-react 0.400

## Technische standaarden
- API route: export const dynamic = 'force-dynamic'
- Pagina: 'use client'
- Auth: createServerClient + cookies → getUser()
- Database: createAdminClient()
- Navigatie: router.push() — nooit router.back()
- Anthropic: directe fetch — geen SDK
- Afbeelding: sharp resize 800px JPEG 80%
- Pagina's zonder AppShell: aanroepen via router.push vanuit ingelogde pagina
