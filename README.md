# CoachOS — Project Geheugen

## Project
- **App naam:** CoachOS
- **Versie:** 1.0.0
- **Stack:** Next.js 14 + TypeScript + Supabase + Claude API + Zustand + Tailwind + PWA
- **Hosting:** Vercel
- **Blueprint:** V2.2

## URLs
- App: (na deployment invullen)
- GitHub: (na setup invullen)
- Supabase: (na setup invullen)
- Vercel: (na deployment invullen)

## Bestandsstructuur

```
coachOS/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ai/route.ts              ✅ Claude API proxy
│   │   │   └── coach/daily/route.ts     ✅ Dagelijks advies genereren
│   │   ├── login/page.tsx               ✅ Login scherm
│   │   ├── register/page.tsx            ✅ Registratie scherm
│   │   ├── onboarding/page.tsx          ✅ 5-stappen onboarding
│   │   ├── home/page.tsx                ✅ Dagelijkse coach (hoofdscherm)
│   │   ├── checkin/page.tsx             ✅ Ochtend check-in
│   │   ├── settings/page.tsx            ✅ Instellingen
│   │   ├── layout.tsx                   ✅ Root layout + PWA meta
│   │   └── page.tsx                     ✅ Root redirect
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx               ✅ Button component
│   │   │   └── index.tsx                ✅ Card, Input, Badge, ScoreSlider
│   │   ├── coach/
│   │   │   ├── DailyAdvice.tsx          ✅ Dagelijks advies kaart
│   │   │   └── RecoveryStatus.tsx       ✅ Herstelstatus indicator
│   │   └── layout/
│   │       ├── AppShell.tsx             ✅ App layout wrapper
│   │       └── BottomNav.tsx            ✅ Navigatie onderaan
│   ├── core/
│   │   ├── ai-engine/
│   │   │   ├── providers.ts             ✅ AI Provider abstractie (Claude default)
│   │   │   ├── coach-engine.ts          ✅ Coach orchestratie
│   │   │   └── recovery-engine.ts       ✅ Herstel score berekening
│   │   └── prompts/
│   │       └── daily-coach.ts           ✅ Dagelijkse coach prompt
│   ├── hooks/
│   │   ├── useAuth.ts                   ✅ Auth hook
│   │   └── useCoach.ts                  ✅ Coach hook
│   ├── services/
│   │   ├── supabase.ts                  ✅ Supabase client
│   │   ├── auth.ts                      ✅ Auth service
│   │   ├── profile.ts                   ✅ Profiel + goals service
│   │   ├── checkin.ts                   ✅ Check-in service
│   │   └── coach.ts                     ✅ Coach service
│   ├── store/
│   │   ├── userStore.ts                 ✅ User + profile state
│   │   └── coachStore.ts                ✅ Coach + check-in state
│   ├── types/
│   │   └── index.ts                     ✅ Alle TypeScript types
│   └── utils/
│       └── index.ts                     ✅ cn, getGreeting, formatDate
├── supabase/
│   └── schema.sql                       ✅ Volledig database schema
├── public/
│   └── manifest.json                    ✅ PWA manifest
├── .env.example                         ✅
├── next.config.js                       ✅ PWA config
├── tailwind.config.js                   ✅ Design tokens
├── tsconfig.json                        ✅
└── package.json                         ✅
```

## Database Schema

Tabellen in Supabase:
- `profiles` — Gebruikersprofiel (first_name, display_name, age, etc.)
- `user_goals` — Doelen (meerdere per gebruiker, prioriteit)
- `activity_templates` — Activiteiten bibliotheek (systeem + gebruiker)
- `activities` — Gebruikers activiteiten
- `activity_sessions` — Trainingen
- `daily_checkins` — Ochtend check-ins
- `health_metrics` — Garmin/Apple Health data
- `daily_status` — Gecachte dagelijkse scores
- `coach_memory` — Coach geheugen
- `coach_recommendations` — Dagelijkse adviezen
- `coach_insights` — Inzichten met versioning
- `knowledge_observations` — Persoonlijke observaties
- `ai_conversations` — Alle AI gesprekken

## Huidige staat (v1.0.0)

**Werkt:**
- Auth flow (login, register, signout)
- Onboarding (5 stappen)
- Home scherm met recovery status + dagelijks advies
- Ochtend check-in
- Instellingen
- AI Provider abstractie (Claude)
- Recovery engine berekening
- Supabase RLS (Row Level Security)
- PWA manifest

**Nog niet gebouwd:**
- Garmin integratie
- Apple Health
- Activiteiten registratie scherm
- Activiteiten pagina in nav
- Strength/Fitness engine
- Weekly/Monthly reviews
- Push notificaties

## Bekende aandachtspunten
- PWA icons (icon-192.png + icon-512.png) moeten nog aangemaakt worden
- Geist font vereist `geist` npm package
- `activities` route in BottomNav verwijst naar `/activities` — pagina nog niet gebouwd

## Roadmap

```
Fase 1 ✅ — Fundering
Fase 2 ⬜ — Coach Core (Garmin, verbeterde AI, patronen)
Fase 3 ⬜ — Data Integraties (Garmin, Apple Health)
Fase 4 ⬜ — Intelligence (Strength/Fitness engine, predictions)
Fase 5 ⬜ — Toekomst (Video analyse, Strava/Oura/Whoop)
```

## Afspraken
- Altijd overleg voor code
- Nooit direct beginnen zonder plan
- Altijd volledige bestanden tonen
- Stap voor stap met bevestiging
- Platte zip (-j) voor export
- README updaten na elke grote wijziging
- AI Provider: Claude default, abstract voor toekomst
- Taal UI: Nederlands
- Design: Dark/Light, mobile-first

## Versiehistorie
- v1.0.0 — Fase 1 Fundering compleet

## Nieuwe chat starten
```
Lees mijn README op
https://raw.githubusercontent.com/[gebruiker]/coachOS/refs/heads/main/README.md
en help me verder met CoachOS
```
