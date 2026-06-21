# CoachOS - Project Geheugen

## Project
- App naam: CoachOS
- Versie: 1.8.3
- App URL: https://coach-os-tau.vercel.app
- GitHub: https://github.com/stuctech-eng/coachOS
- Supabase: https://fabtmkrzqrrwbvgaugjm.supabase.co

## Stack
- Frontend: Next.js 14.2.29 + TypeScript + PWA
- Auth: Supabase Auth (e-mail/wachtwoord + Google OAuth)
- Database: Supabase PostgreSQL
- AI: Claude API (directe Anthropic calls, niet via interne proxy)
- State: Zustand
- Styling: Tailwind CSS
- Hosting: Vercel

## Kernprincipe
**Coach bepaalt alles. Trainer pakt het over.**
- Coach (Sonnet 4.6) bepaalt: trainen / herstel / rust, dagplan, intensiteit
- Coach geeft expliciete instructies aan Trainer via `trainer_instructies`
  veld in coach_recommendations
- Trainer (Haiku 4.5) voert dit uit, voegt niets toe op eigen initiatief

## Architectuurregels
- AI calls altijd rechtstreeks naar api.anthropic.com/v1/messages
  (NOOIT via de interne /api/ai proxy route — die geeft 500 errors)
- AI-gegenereerde data (segments, common_errors, recovery_modules)
  altijd normaliseren/type-checken vóór gebruik in UI — nooit direct
  .map() of property-toegang zonder guard (zie asDisplay() patroon in
  training/session/[module]/page.tsx als voorbeeld)
- Database writes op coach_recommendations: gebruik update() eerst
  (raakt alleen genoemde velden op een bestaande rij), met een insert-
  fallback als er nog geen rij bestaat voor user_id+date+type. NOOIT
  upsert() met een gedeeltelijke payload — dat overschrijft de hele
  rij en zet niet-meegegeven NOT NULL velden (zoals recommendation)
  op null, wat een database-constraint schending geeft
- AI calls die JSON moeten teruggeven: max_tokens ruim instellen
  (niet te krap, anders wordt de JSON afgekapt en faalt het parsen)
- Elke route die AI-data rendert heeft een error.tsx boundary
- Pagina's die geen eigen layout.tsx hebben, MOETEN gewrapt worden in
  `<AppShell>` (uit `@/components/layout`) — de root `layout.tsx` zet
  `html`/`body` op `overflow: hidden`, dus zonder AppShell (die de
  `.scroll-area` class levert) kan een pagina nergens scrollen, ook
  niet bij weinig content. Nooit een eigen `min-h-screen` div +
  losse `<BottomNav />` bouwen — altijd `<AppShell>` gebruiken.

## Werkwijze (Guardian Mode)
Analyse gaat altijd vóór implementatie. Nooit gokken, nooit aannames,
nooit symptomen fixen zonder root cause.

Bij ontbrekende informatie: STOP, stel exact één gerichte vraag. Geen
analyse, geen implementatie, geen alternatieven totdat het antwoord er is.

Voor elke wijziging, kort en impliciet (niet elke keer expliciet
uitschrijven, maar wel toepassen):
- Root cause: waarom bestaat het probleem, waar ontstaat het
- Impact: wat verandert, wat kan breken, welk risico (LOW/MEDIUM/HIGH)
- Kleinste veilige wijziging — geen refactors zonder reden, geen
  breaking changes zonder waarschuwing, geen duplicatie

Anti-sprawl: geen losse features zonder context, geen dubbele services
of routes. Alles moet bestaande systemen uitbreiden of een nieuw
coherent systeem introduceren — geen ad-hoc toevoegingen.

## Command System
Als de gebruiker een command geeft, is dat leidend boven alles —
direct uitvoeren zonder extra interpretatie:
- STATUS → wat werkt / ontbreekt / risico / volgende stap
- NEXT → volgende stap + concreet plan
- FIX → oorzaak + oplossing voorstellen, wachten op akkoord vóór bouwen
- README → volledige README.md herschrijven
- REVIEW → volledige technische doorlichting

## Workflow: Claude → iPhone → Working Copy → GitHub → Vercel
1. Bestanden in /home/claude/update/ met exacte projectstructuur
2. Zip zonder tussenmap (direct src/... en README.md, dus NIET
   zip/update/src/... maar zip/src/...)
3. Zip in /mnt/user-data/outputs/coachOS-vX.X.X.zip
4. present_files

Regels:
- Alleen gewijzigde bestanden in de zip, nooit het hele project
- Mappenstructuur in de zip moet exact overeenkomen met de
  projectstructuur (submappen zijn submappen, geen punten in
  bestandsnamen — dus training/session/[module]/page.tsx, niet
  training.session.page.tsx)
- Geen tussenmap
- Altijd README updaten met versienummer
- Bestandsnaam eindigt op .zip zodat iPhone hem als zip herkent
  (soms hernoemt iPhone dit zelf weg — gebruiker hernoemt dan
  handmatig in Bestanden-app)

Gebruiker download de zip op iPhone, pakt uit in Bestanden-app, zet
bestanden op de juiste plek in Working Copy, pusht naar GitHub,
Vercel deployt automatisch.

## Rollback procedure
Bij een vastgelopen/kapotte staat: tag van een laatst bekende werkende
versie terugzetten via Working Copy.
1. GitHub: tag aanmaken op een werkende commit (bv. V1.8.2) als
   voorzorg, vóór risicovolle wijzigingen
2. Working Copy → Repository → history-icoon → commit met het juiste
   versie-label/hash opzoeken (let op: commit-message kan afwijken
   van het tag-nummer — de hash is leidend)
3. Tik op de commit → "Show Commit details"
4. Alleen kijken: Checkout (veilig, omkeerbaar, niet pushen)
5. Echt terugzetten: Reset → Hard → bevestigen
6. Push → force push bevestigen (overschrijft remote geschiedenis
   na dit punt — onomkeerbaar tenzij hashes van latere commits eerst
   genoteerd zijn)
7. README bijwerken naar het teruggezette versienummer

## Inlogmethoden
- Google Sign-In (primair, aanbevolen — knop bovenaan login pagina)
- E-mail/wachtwoord (fallback)
- Wachtwoord-reset toont automatisch een instructie in de UI wanneer
  nodig: open de reset-link niet direct vanuit Mail, maar kopieer de
  link en open hem in Safari (PWA/Mail-app beperking op iOS)
- Let op: Google-login met een ander e-mailadres dan een bestaand
  account maakt een nieuw, los account aan (geen automatische koppeling)

## Trainingsysteem
**Actieve route:** `src/app/training/session/[module]/page.tsx`
Dit is de ENIGE trainingsroute — kettlebell, rowing, running, cycling
lopen allemaal via de dynamische `[module]` parameter. Er bestaat geen
aparte `kettlebell/page.tsx` meer — niet opnieuw aanmaken, dat geeft
een routing-conflict.

Flow: schema-overzicht → uitleg eerste oefening → automatische workout
(actief → rust → laatste rust toont uitleg volgende oefening) → tempo-
systeem (reps→seconden, slow/normal/fast) → pause overlay → back/next/
volgend knoppen (elk met eigen reset-gedrag) → evaluatie per module.

## Oefening bibliotheek
`src/lib/exercises.ts` — 5 kettlebell oefeningen met Gemini-gegenereerde
afbeeldingen in `public/exercises/`. Uitlegpagina op `/oefening/[id]`.
Afbeeldingen worden gegenereerd met een vaste prompt-template (consistent
karakter, donkere achtergrond, groene spiermarkering) — zie eerdere
gesprekken voor de exacte prompts indien nieuwe oefeningen nodig zijn.

## Activiteiten pagina
`src/app/activities/page.tsx` — overzicht van alle Strava- en Garmin-
sessies, met weekstats, filter per sporttype en Garmin .gpx/.tcx import.

Strava-koppeling per activiteit: het originele Strava activity-ID wordt
niet in een eigen kolom opgeslagen, maar zit in het `notes`-veld van
`activity_sessions` als `strava:{id}` (zie processStravaActivity in
`src/lib/strava-activity-processor.ts`). Activiteit-kaarten met
`source === 'strava'` zijn volledig tikbaar en linken naar
`https://www.strava.com/activities/{id}` (nieuw tabblad/Strava-app).
Garmin-kaarten hebben geen externe link, want geen Strava-ID beschikbaar.

De pagina toont alleen wat de sync daadwerkelijk opslaat: afstand,
hartslag (gem/max), hoogtewinst, snelheid, calorieën, watts, cadans.
Geen route-kaart, foto's, kudos of splits — die haalt de sync niet op;
de Strava-link is de manier om die volledige data te zien.

## Debug pagina
`/debug` — diagnostiek voor environment vars, Supabase auth, database
tabellen, API routes, Anthropic bereikbaarheid, PWA modus, vandaag-data
(check-in/Garmin/coach advies), en training-sessie localStorage check
met een wis-knop voor crash-herstel. Bereikbaar ook via Instellingen.

## Bekende technische grens
Browsers staan nooit toe dat een website automatisch een foto uit de
bibliotheek selecteert zonder gebruikersactie — Garmin screenshot
upload vereist dus altijd een handmatige tik in de file picker.

## Bestandsstructuur
src/
  app/
    api/
      ai/route.ts                    proxy — niet intern gebruiken
      action-plan/route.ts           Haiku, dagplan generatie
      coach/route.ts                 Sonnet, dagadvies + trainer_instructies
      coach-calls/route.ts           Strava activiteiten evaluatie
      training/today/route.ts        Haiku, trainingsschema
      training/session/route.ts
      training/complete/route.ts
      activities/route.ts            GET sessies, POST Garmin import
      strava/                        OAuth + sync
      health/                        Garmin import + shortcuts
      checkin/, injuries/, goals/, journal/, life-events/, weekly/
    auth/callback/route.ts           Google OAuth code exchange
    oefening/[id]/page.tsx           oefening uitlegpagina
    debug/page.tsx
    login/page.tsx                   Google Sign-In + wachtwoord
    reset-password/page.tsx          PWA-instructie + PKCE diagnose
    home/, checkin/, chat/, coach-call/, dagboek/, goals/, injuries/,
    insights/, life-events/, progressie/, weekly/, settings/
    activities/page.tsx              Strava/Garmin activiteiten overzicht
    training/page.tsx                trainingsbibliotheek overzicht
    training/session/[module]/
      page.tsx                       volledige workout engine
      error.tsx                      crash boundary
    training/recovery/               ademhaling/mobiliteit/wandel modules
  lib/
    exercises.ts                     oefening data
    supabase.ts                      browserClient + adminClient
    strava-activity-processor.ts     gedeelde Strava verwerking (sync + webhook)

public/
  exercises/                         Gemini afbeeldingen per oefening

## Database Tabellen
profiles, user_goals, activity_templates, activities, activity_sessions,
daily_checkins, health_metrics, daily_status, coach_memory,
coach_recommendations (incl. trainer_instructies, action_plan),
coach_insights, knowledge_observations, ai_conversations, strava_tokens,
garmin_imports, injuries, life_events, journal_entries, training_results

## Huidige staat — alles werkt
Login/register, Google Sign-In, onboarding, check-in, home + refresh,
coach advies, dagplan, training (alle modules + volledige workout
engine), coach memory/chat/calls, inzichten, progressie, weekoverzicht,
dagboek, doelen, blessures, levensgebeurtenissen, Strava OAuth + sync,
Strava deeplink per activiteit, Garmin import, PWA icons, debug pagina,
oefening bibliotheek.

## Strava Setup
- Client ID: 254388
- Callback domain: coach-os-tau.vercel.app
- Scope: read, activity:read_all

## Google OAuth Setup
- Google Cloud project: CoachOS (project ID coachos-500007)
- Client ID: 118053072224-2l82evoc3n05srj7thc6ieb60jb9s96s.apps.googleusercontent.com
- Redirect URI: https://fabtmkrzqrrwbvgaugjm.supabase.co/auth/v1/callback
- Ingeschakeld in Supabase → Authentication → Sign In/Providers → Google

## Environment Variables (Vercel)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SECRET_KEY
- ANTHROPIC_API_KEY
- STRAVA_CLIENT_ID=254388
- STRAVA_CLIENT_SECRET=9b4822ef38ccd541a9bbc86730f965a8f5149208

## Supabase Instellingen
- Site URL: https://coach-os-tau.vercel.app
- Redirect URLs: https://coach-os-tau.vercel.app/**,
  https://coach-os-tau.vercel.app/auth/callback
- Email bevestiging: AAN

## Volgende stappen / openstaande wensen
- Oefening bibliotheek uitbreiden met meer modules (rowing, running,
  cycling oefenkaarten — alleen kettlebell heeft nu Gemini afbeeldingen)
- Eventueel: iOS Shortcut voor snellere Garmin screenshot import
- Eventueel: meer Strava-data tonen in de app zelf (route-kaart, splits,
  foto's) — vereist uitbreiding van de sync, momenteel niet opgehaald

## Versiehistorie
- v1.8.2: laatst bekende stabiele tag vóór scroll-fix
- v1.8.3: Activiteiten-pagina scroll-fix (AppShell wrapper i.p.v.
  losse div + BottomNav) + Strava deeplink per activiteit (tikbare
  kaart linkt naar strava.com/activities/{id} via notes-veld)

## Nieuwe chat starten
Lees mijn README op
https://raw.githubusercontent.com/stuctech-eng/coachOS/refs/heads/main/README.md
en help me verder met CoachOS
