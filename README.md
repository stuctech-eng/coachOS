# CoachOS - Project Geheugen

## Project
- App naam: CoachOS
- Versie: 2.0.0
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
- Coach-persoonlijkheid (toon, karakter) is gecentraliseerd in
  `src/core/prompts/coach-personality.ts` — drie niveaus (1 Professioneel/
  blessures-veiligheid-techniek, altijd serieus; 2 Coach/dagadvies, warm
  en persoonlijk; 3 Vriendschappelijk/evaluaties, plagerig mag). Nieuwe
  AI-prompts importeren `COACH_CORE_IDENTITY` + `getCoachTone(niveau)`
  in plaats van een eigen persoonlijkheidsblok te schrijven — voorkomt
  prompt-sprawl. CORE_SAFETY_RULE (geen humor bij blessures/veiligheid)
  geldt altijd, ongeacht aangeroepen niveau.
- Levensgebeurtenissen-context is gecentraliseerd in
  `src/core/utils/life-events-context.ts` (`fetchTodaysLifeEvents` +
  `formatLifeEventsContext`) — gebruikt door zowel `coach/route.ts` als
  `action-plan/route.ts`, zodat Coach en Dagplan altijd exact dezelfde
  levensgebeurtenissen zien (alle categorieën: Werk, Leven, Gezondheid,
  Omgeving — niet alleen werk-types). Vóór v1.8.5 hadden beide routes
  losgegroeide, inconsistente filters, wat tot tegenstrijdig advies kon
  leiden (Coach "geen bijzonderheden" terwijl Dagplan wél een
  levensgebeurtenis meewoog). `training/today/route.ts` gebruikt deze
  module NIET — Trainer leest alleen de al-verwerkte coach-output
  (`trainer_instructies`, `action_plan`), nooit ruwe brondata rechtstreeks.

## Werkwijze (Guardian Mode)
Analyse gaat altijd vóór implementatie. Nooit gokken, nooit aannames,
nooit symptomen fixen zonder root cause.

Bij ontbrekende informatie: STOP, stel exact één gerichte vraag. Geen
analyse, geen implementatie, geen alternatieven totdat het antwoord er is.

SQL, code, commando's en andere kopieer-content: ALTIJD in een eigen
code-blok, nooit vermengd met uitleg of bestandsnamen erboven/eronder
in dezelfde alinea — voorkomt dat de gebruiker per ongeluk uitleg mee
kopieert en plakt (bv. in de Supabase SQL editor, die dan een syntax
error geeft op de eerste regel uitleg).

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

## Coach Call — volledige architectuur en roadmap

### Hoe het hoort te werken (volledig systeem)
De Coach Call is de terugkoppelingslaag tussen wat de coach adviseert en wat
de gebruiker daadwerkelijk doet. De volledige flow:

1. Coach geeft dagadvies (trainen / herstel / rust)
2. Gebruiker doet al dan niet wat de coach zegt — bewust of niet
3. Na een serieuze activiteit (Strava OF interne bibliotheek-training tegen
   advies in) verschijnt een Coach Call op Home
4. Gebruiker vult RPE + mood + optionele notitie in per activiteit
5. Coach reageert direct (Niveau 3 toon — plagerig mag bij genegeerd advies)
6. Die evaluatiedata (wat gedaan, hoe zwaar, hoe gevoeld, advies genegeerd?)
   wordt opgeslagen EN teruggelezen door de coach bij het volgende dagadvies
7. Coach past zijn advies bij op basis van wat hij nu weet — "gisteren ben je
   toch gaan roeien, vandaag echt herstel"

### Wat nu al werkt (v1.8.6)
- ✅ Coach Call triggert op Strava-activiteiten (45+ min + sport-specifieke
  afstand: Hardlopen 5km, Fietsen 20km, Roeien 5km)
- ✅ RPE (1-10) + Mood (1-5: 😞😐🙂😃🔥) per activiteit, los van elkaar
- ✅ Optionele vrije tekst per activiteit
- ✅ Directe coach-reactie per activiteit na opslaan (Niveau 3 toon)
- ✅ Humor-gate: plagerig alleen na 5+ voltooide calls + mood 3+ + genegeerd
  advies — voorkomt dat nieuwe gebruikers meteen geplaagd worden
- ✅ Coach_call_items.coach_response opgeslagen (geen herhaalde AI-call)
- ✅ Bibliotheek-trainingen: gebruiker kan altijd zelf een module kiezen,
  ongeacht coach-advies

### Wat nog gebouwd moet worden (stap voor stap)

**Stap 1 — Routing-fix bibliotheek (v1.8.7, nu te bouwen)**
Probleem: bibliotheek-keuze "Roeien" genereert een Kettlebell sessie.
Root cause: de huidige `training/today/route.ts` mist module-specifieke
fallbacks (rowing/running/cycling) — bij een mislukte AI-call valt hij
altijd terug op kettlebell, ongeacht wat de gebruiker koos. Ook heeft de
coach-sturing in de prompt te veel gewicht bij library-keuze, waardoor
Trainer AI de forcedModule-instructie negeert.
Fix: module-specifieke fallbacks terugzetten + coach-sturing verzwakken
bij library-keuze zodat forcedModule altijd wint.

**Stap 2 — Coach Call voor interne bibliotheek-trainingen (v1.8.x)**
Probleem: Coach Call triggert alleen op Strava-activiteiten. Een
bibliotheek-training (bijv. roeien terwijl coach herstel adviseerde) levert
geen Coach Call op — de coach komt het nooit te weten via dit kanaal.
Fix: bij voltooien van een bibliotheek-training (`training/complete/route.ts`)
checken of coach vandaag "rust" of "herstel" adviseerde. Zo ja → Coach Call
item aanmaken zodat de kaart op Home verschijnt. coach-calls/route.ts en
coach-call/page.tsx uitbreiden zodat ook interne trainingen (zonder Strava
activity_session_id) zichtbaar zijn in de evaluatie.

**Stap 3 — Coach leest evaluatiedata terug (v1.8.x)**
Probleem: Coach Call evaluatiedata (RPE, mood, genegeerd advies) wordt
opgeslagen in coach_call_items maar wordt NIET teruggelezen door
`coach/route.ts` bij het volgende dagadvies. De coach weet dus niet dat
je gisteren zijn advies hebt genegeerd, noch hoe je je daarna voelde.
Fix: `coach/route.ts` uitbreiden om recente coach_calls (laatste 2-3 dagen,
status completed) op te halen en samen te vatten als extra context in de
prompt. Zodat de coach expliciet kan zeggen: "Gisteren ben je toch gaan
roeien (RPE 7, voelde goed 🙂) — vandaag echt herstel."

### Afhankelijkheden tussen stappen
Stap 1 staat los — kan nu gebouwd worden.
Stap 2 heeft Stap 1 niet nodig maar bouwt voort op de bestaande
coach-call architectuur (v1.8.4).
Stap 3 heeft Stap 2 nodig — anders heeft de coach geen interne
trainingsdata om terug te lezen naast de Strava-data.
Volgorde: 1 → 2 → 3.


Bij kwalificerende Strava-activiteiten (45+ min EN sport-specifieke
afstand: Hardlopen 5km, Fietsen 20km, Roeien 5km) maakt
`src/app/api/coach-calls/route.ts` een `coach_calls` record aan met
`coach_call_items` per activiteit. Detectie kijkt alleen naar vandaag/
gisteren (Amsterdam-tijd) — activiteiten ouder dan dat triggeren geen
nieuwe call.

Op Home verschijnt een amber kaart zolang er `pending`/`partial` items
zijn (max 24u, daarna `expired`). Evaluatiescherm op `/coach-call`.

Per activiteit, los van elkaar:
- RPE 1-10 (bestaand, trainingsbelasting)
- Mood 1-5 (nieuw: 😞😐🙂😃🔥, hoe het voelde — apart van RPE, niet
  vervangend, want RPE en mood meten verschillende dingen en kunnen
  uiteenlopen, bv. RPE 8 + 🔥 = zware maar motiverende training)
- Optionele vrije tekst

Bij opslaan van één activiteit (niet pas bij het hele formulier) wordt
direct een coach-reactie gegenereerd via `coach-calls/rate/route.ts`,
opgeslagen in `coach_call_items.coach_response` (geen herhaalde AI-call
bij opnieuw openen). Plagerige/Volendamse humor (Niveau 3, zie
coach-personality.ts) is alleen toegestaan bij `mayUsePlayfulHumor()`:
minstens 5 eerder voltooide coach calls, mood 3+, én genegeerd
rust/herstel-advies — voorkomt dat nieuwe gebruikers meteen geplaagd
worden.

## Coach-persoonlijkheid
`src/core/prompts/coach-personality.ts` — gedeeld fundament voor alle
coach-prompts. `daily-coach.ts` (dagadvies, Niveau 2) en
`coach-call-reaction.ts` (evaluatie-reactie, Niveau 3) importeren
hieruit i.p.v. eigen persoonlijkheidstekst te dupliceren.

## Debug pagina
`/debug` — diagnostiek voor environment vars, Supabase auth, database
tabellen, API routes, Anthropic bereikbaarheid, PWA modus, vandaag-data
(check-in/Garmin/coach advies), en training-sessie localStorage check
met een wis-knop voor crash-herstel. Bereikbaar ook via Instellingen.

## Bekende technische grens
Browsers staan nooit toe dat een website automatisch een foto uit de
bibliotheek selecteert zonder gebruikersactie — Garmin screenshot
upload vereist dus altijd een handmatige tik in de file picker.

## Hoe alles samenhangt (data-flow)
1. **Input verzamelen** — gebruiker doet check-in, upload Garmin-screenshot,
   beheert blessures/doelen/levensgebeurtenissen/dagboek
2. **Coach beslist** (`coach/route.ts`) — leest alle input, genereert advies,
   bepaalt trainen/herstel/rust, schrijft `trainer_instructies`
3. **Sequentieel, niet parallel:**
   - **Dagplan** (`action-plan/route.ts`) — concreet tijdschema voor de dag,
     schrijft `action_plan` op dezelfde `coach_recommendations`-rij
   - **Trainingsschema** (`training/today/route.ts`, Haiku) — leest daarna
     ZOWEL `trainer_instructies` ALS `action_plan` als input, genereert pas
     dan het trainingsschema. Trainer leest dus nooit ruwe brondata zelf —
     alleen de al-verwerkte output van Coach en Dagplan.
4. **Uitvoering** — `training/session/[module]/page.tsx` leidt de gebruiker
   door de workout (timers, sets, rust, pauze)
5. **Terugkoppeling** — voltooide trainingen (`training_results`) en
   kwalificerende Strava-activiteiten (Coach Call, RPE+mood+reactie) worden
   opgeslagen en gebruikt als context voor de VOLGENDE dag's coach-advies

## Verificatie-status — wat is echt gezien vs. aangenomen
Voorkomt dat een volgende sessie aanneemt dat iets gecontroleerd is terwijl
dat (nog) niet zo is. "Gezien" = bestandsinhoud is in een gesprek gedeeld
en gelezen, niet alleen de bestandsnaam.

**Volledig gezien en geverifieerd:**
coach/route.ts, action-plan/route.ts, training/today/route.ts,
coach-calls/route.ts, coach-calls/rate/route.ts, activities/page.tsx,
activities/route.ts, home/page.tsx, life-events/page.tsx, coach-call/page.tsx,
training/page.tsx, daily-coach.ts, strava-activity-processor.ts,
strava/sync/route.ts (POST/GET), layout.tsx (root), globals.css,
components/layout (AppShell/BottomNav), settings/page.tsx,
settings/hoe-werkt-het/page.tsx

**Nooit gezien — alleen naam/rol bekend uit bestandsstructuur, NIET de
inhoud:**
login/register, onboarding, settings/ (incl. equipment, garmin-import),
goals/page.tsx + api/goals/route.ts, checkin/page.tsx + api/checkin/route.ts,
dagboek/page.tsx + api/journal/route.ts, injuries/page.tsx + api/injuries/route.ts,
weekly/page.tsx + api/weekly/route.ts, progressie/page.tsx,
insights/page.tsx (WEL gezien — zie hierboven, corrigeer als dit afwijkt),
chat/page.tsx, api/memory/route.ts, api/trends/route.ts,
api/training/session/route.ts, api/training/complete/route.ts,
api/health/ (Garmin import), api/strava/webhook, auth/callback/route.ts,
reset-password/page.tsx, debug/page.tsx

**Tabellen met onbekende rol** (genoemd in schema, nooit een route gezien
die ze leest/schrijft anders dan coach_memory):
`coach_insights`, `knowledge_observations` — coach_memory wordt wél
gebruikt (gezien in coach/route.ts en insights/page.tsx via /api/memory)

Bij twijfel: vraag het bestand op voordat je iets over de inhoud beweert.

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
  core/
    prompts/
      daily-coach.ts                 dagadvies prompt (Niveau 2)
      coach-call-reaction.ts         evaluatie-reactie prompt (Niveau 3)
      coach-personality.ts           gedeelde coach-toon, alle niveaus
    utils/
      life-events-context.ts         gedeelde life-events ophaling,
                                      gebruikt door coach + action-plan

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
- v1.8.4: Coach Evaluations — mood (1-5) naast RPE in Coach Call
  evaluatiescherm, directe coach-reactie per activiteit (Niveau 3
  toon), gecentraliseerde coach-persoonlijkheid in coach-personality.ts
  (3 niveaus, hergebruikt door daily-coach.ts). DB: coach_call_items
  kreeg mood, notes, coach_response kolommen (zie
  supabase/migration_v1.8.4_coach_evaluations.sql — handmatig uitvoeren
  in Supabase SQL editor, niet automatisch toegepast)
- v1.8.5: Levensgebeurtenissen-fix — coach/route.ts en
  action-plan/route.ts gebruiken nu beide dezelfde gedeelde
  life-events-context.ts module. Voorheen zag coach/route.ts alleen
  6 werk-types, action-plan/route.ts zag wel alle categorieën voor
  eenmalige events maar filterde herhalende events alsnog op werk —
  inconsistentie die tot tegenstrijdig advies tussen Coach en Dagplan
  kon leiden. Nu zien beide alle categorieën (Werk/Leven/Gezondheid/
  Omgeving), eenmalig + herhalend, inclusief notities en impact-scores
  (recovery_impact/stress_load/sleep_disruption). Geen DB- of
  UI-wijziging, alleen prompt-context. training/today/route.ts
  ongewijzigd (leest alleen coach-output, geen ruwe brondata).

- v1.8.6: Settings verbeterd — versienummer bijgewerkt naar v1.8.6,
  Activiteiten-knop verplaatst van Profiel-sectie naar Strava-kaart (naast
  synchroniseren), zodat alles wat met Strava te maken heeft op één plek
  staat. Levensgebeurtenissen-detail nu volledig bewerkbaar: datum, tijden
  (begin/einde), herhaling én notitie zijn aanpasbaar zonder verwijderen
  en opnieuw aanmaken. Hoe-werkt-het pagina bijgewerkt: Coach Call sectie
  toegevoegd, levensgebeurtenissen-uitleg gecorrigeerd (alle 4 categorieën),
  Strava-deeplink gedocumenteerd, versienummer hardcoded v1.8.6.
  settings/page.tsx + life-events/page.tsx + hoe-werkt-het/page.tsx
  gewijzigd, geen DB- of API-wijziging.

- v1.8.7: Routing-fix bibliotheek (Stap 1 van Coach Call roadmap) —
  bibliotheek-keuze geeft nu altijd het juiste module-type terug.
  Root cause (na lange debug-sessie): drie gecombineerde problemen:
  1. PWA op iOS gooit ?source=library query param weg bij router.push()
  2. session/page.tsx had een aparte session/page.tsx die alle navigatie
     naar /training/session/* onderschepte vóór de [module] route
  3. isLibrary-detectie vond plaats NA de resume-dialog check — een oude
     kettlebell-sessie in SESSION_STORAGE_KEY activeerde de resume-dialog
     en blokkeerde de library-flow volledig (race condition)
  Fix: (1) library_module_pending in localStorage schrijven vóór navigatie
  in training/page.tsx ipv query param, (2) session/page.tsx verwijderd,
  (3) isLibrary-detectie verplaatst naar VOOR de resume-dialog check in
  useEffect — library-flow slaat resume-dialog altijd over.
  Bij herstel/rust: module-specifieke fallbacks (rowing/cycling/running)
  gebruiken ipv AI-output — Haiku genereert anders wandel-segmenten.
  training/page.tsx + training/session/[module]/page.tsx +
  training/today/route.ts gewijzigd, geen DB-wijziging.
  Coach Call roadmap Stap 2 en 3 staan nog open.

- v1.8.8: Coach Call Stap 2 — bibliotheek-trainingen tegen coach-advies
  triggeren nu een Coach Call. Na voltooien van een bibliotheek-training
  (training_source=library) terwijl coach herstel of rust adviseerde,
  wordt automatisch een coach_call item aangemaakt zodat de coach het
  te weten komt via de evaluatie. DB-migratie: training_result_id (uuid)
  toegevoegd aan coach_call_items. training/complete/route.ts en
  coach-calls/route.ts gewijzigd. Stap 3 (coach leest evaluatiedata
  terug) staat nog open.

- v1.8.9: Coach Call Stap 3 — coach leest evaluatiedata terug bij
  volgend dagadvies. coach/route.ts haalt nu recente coach_calls op
  (laatste 3 dagen, completed items) en voegt RPE, mood en notities
  toe als context in de prompt. Coach kan nu reageren op genegeerd
  advies met kennis van hoe het ging: "Gisteren ben je toch gaan
  roeien (RPE 7, voelde goed) — vandaag echt herstel."
  Alleen coach/route.ts gewijzigd, geen DB-wijziging.
  Coach Call roadmap volledig afgerond (Stap 1+2+3).

- v1.9.0: Coach Compliance — sluit de coaching-cirkel volledig af.
  Nieuwe /api/compliance/route.ts berekent over de laatste 30 dagen:
  % hersteladviezen gevolgd, aantal afwijkingen en hun uitkomst
  (goed: RPE ≤ 6 + mood ≥ 3 / zwaar: RPE ≥ 7 of mood ≤ 2 / onbekend).
  progressie/page.tsx uitgebreid met Coach Compliance sectie direct
  na Performance AI. Geen DB-wijziging — gebruikt bestaande
  coach_recommendations, training_results en coach_call_items data.

- v1.9.1: Bodyweight Bibliotheek Fase 1 — 30 oefeningen in Nederlands,
  verdeeld over 5 coachDoelen (herstel/mobiliteit/warmup/kracht/core).
  Nieuw bestand: src/lib/bodyweight-exercises.ts met types CoachDoel,
  Lichaamsdeel, Niveau en BodyweightOefening. Architectuur Optie C:
  Coach bepaalt doel → route filtert oefeningen op coachDoel →
  Trainer AI krijgt de beschikbare lijst en maakt de sessie.
  Trainer AI mag GEEN nieuwe oefeningen verzinnen buiten de lijst.
  training/today/route.ts uitgebreid met BODYWEIGHT FORMAT,
  bodyweightFallback en filter-logica. Bestaande modules ongewijzigd.
  Fase 2 (60-80 oefeningen) en uitlegpaginas volgen later.

- v1.9.2: Bodyweight Bibliotheek Fase 2 — 35 extra oefeningen toegevoegd.
  Totaal nu 65 oefeningen verdeeld over alle coachDoelen. Uitbreidingen:
  benen (Bulgaarse Split Squat, Jump Squat, Curtsy Lunge, Zijwaartse Lunge,
  Eénbeen Glute Bridge, Wall Sit March), bilspieren (Hip Thrust, Donkey Kick,
  Fire Hydrant, Clamshell, Frog Pump), core (Hollow Hold, Beenheffen, V-Up,
  Bicycle Crunch, Russian Twist, Shoulder Tap, Plank Jack), borst (Wide/
  Diamond/Decline/Knie Push-Up), rug (Swimmer, Cobra Hold, Reverse Snow Angel),
  mobiliteit (Pigeon Stretch, Thread the Needle, Hamstring/Quad Stretch),
  conditie (Burpee, Butt Kicks, Skater Jump, Zijwaartse Shuffle), kracht
  (Squat Hold, Good Morning). Alleen bodyweight-exercises.ts gewijzigd.

- v1.9.3: Bodyweight Bibliotheek Fase 3 — 31 extra oefeningen toegevoegd.
  Totaal nu 96 oefeningen. Uitbreidingen: benen gevorderd (Pistol Squat,
  Shrimp Squat, Cossack Squat), schouders (Wall Walk, Scapulaire Push-Up,
  Y/T/W Raise), core gevorderd (Toe Touch, Reverse Crunch, Flutter Kick,
  Plank Reach), mobiliteit (Dynamic Lunge Stretch, Ruggegraatrotatie,
  Nekmobiliteit, Enkelmobiliteit, Heupcirkels, Deurkozijn Stretch),
  recovery (Buikademhaling, Benen Tegen de Muur, Bekkenkatrol), conditie
  (Bear Crawl, Tuck Jump, Seal Jack, Speed Skater, Plank Jack), bilspieren
  gevorderd (Copenhagen Hold, Bridge March), kracht (Dip, Hindu Push-Up,
  Archer Push-Up, Typewriter Push-Up). Alleen bodyweight-exercises.ts.

- v1.9.4: Bodyweight Bibliotheek Fase 4 — bibliotheek volledig afgerond.
  Totaal 120 oefeningen. Laatste toevoegingen: Sumo Squat, Box Squat,
  Zijwaarts Lopen, Step-Back Lunge, Hollow Rock, Boat Hold, Seated Knee
  Tuck, Binnenkant Dij Stretch, Kuitstrekking, Lies Stretch, Staande/
  Zittende Voorwaartse Buiging, Progressieve Spierontspanning,
  Herstelwandeling, Prone Snow Angel, Pike Hold, Staggered Push-Up,
  Isometrische Squat, Brede Sprong, Explosieve Push-Up, L-Sit,
  Windshield Wiper, Reverse Plank, Staande Heupabductie.
  Coach heeft nu voor elke situatie een passende training:
  herstel, mobiliteit, hotel, blessure, core, kracht, conditie, warmup.
  Alleen bodyweight-exercises.ts gewijzigd.

- v1.9.5: Strength Bibliotheek Fase 1 — 30 oefeningen (10 dumbbell,
  10 barbell, 10 both/warmup/herstel/conditie). Nieuw bestand:
  src/lib/strength-exercises.ts met types KrachtDoel, Equipment,
  StrengthNiveau, StrengthLichaamsdeel en StrengthOefening. Architectuur
  identiek aan bodyweight: Optie C — coach filtert op doel + equipment,
  Trainer AI assembleert uit de gefilterde lijst. STRENGTH FORMAT
  toegevoegd aan training/today/route.ts. strengthFallback toegevoegd.
  Bestaande modules volledig intact.

- v1.9.6: Strength Bibliotheek Fase 2 — 23 extra oefeningen toegevoegd.
  Totaal nu 53 strength oefeningen. Uitbreidingen: dumbbell (sumo deadlift,
  single arm press, pullover, hammer curl, skull crusher, chest fly, reverse
  fly, split squat, step-up, kuitverheffen), barbell (lunge, sumo deadlift,
  biceps curl, close grip press, power clean, upright row, shrug, zercher
  squat), both (push-pull superset, drop set curl, pause squat, tempo
  deadlift, bulgaarse split squat DB). Alleen strength-exercises.ts.

- v1.9.7: Strength Bibliotheek Fase 3 — 17 extra oefeningen toegevoegd.
  Totaal nu 70 strength oefeningen. Uitbreidingen: dumbbell (hip thrust,
  arnold press, concentration curl, single leg RDL, bent over row, floor
  press), barbell (hip thrust met pauze, deficit deadlift, pause bench,
  rack pull, RDL-row combinatie), both (giant set benen, giant set
  bovenlichaam, wave loading, cluster set, pre-exhaust, mechanische drop
  set). Alleen strength-exercises.ts gewijzigd.

- v1.9.8: Strength Bibliotheek Fase 4 — 15 extra oefeningen toegevoegd.
  Totaal nu 85 strength oefeningen. Uitbreidingen: dumbbell (goblet squat
  zijstap, incline curl, overhead triceps, zijlunge curl, renegade row,
  thruster), barbell (snatch grip deadlift, floor press, high pull,
  landmine press), both (periodization blokken kracht/hypertrofie,
  actief herstel, krachtcircuit, EMOM kracht).
  Alleen strength-exercises.ts gewijzigd.

- v1.9.9: Strength Bibliotheek compleet — 100 oefeningen.
  Fase 5 toevoegingen: dumbbell (seal row, meadows row, spider curl,
  kickback, paused row), barbell (jefferson curl, landmine squat, yates
  row, barbell romanian pause), both (conjugate methode, AMRAP, rest-pause,
  loaded carry complex, deload training, dumbbell krachtcomplex).
  Strength bibliotheek volledig afgerond: 30 Fase 1 + 23 Fase 2 +
  17 Fase 3 + 15 Fase 4 + 15 Fase 5 = 100 oefeningen.
  Alleen strength-exercises.ts gewijzigd.

- v2.0.0: Kettlebell Bibliotheek volledig — 102 oefeningen in één keer
  gebouwd. Nieuw bestand: src/lib/kettlebell-exercises.ts met types
  KettlebellDoel, KettlebellNiveau, KettlebellCategorie, KettlebellLichaamsdeel
  en KettlebellOefening. Categorieën: hinge (12), squat (14), push (11),
  pull (7), ballistisch (10), carry (9), core (11), mobiliteit/herstel (10),
  conditie (9), complexes/flows (9). Architectuur identiek aan bodyweight en
  strength: filterKettlebell(), filterKettlebellNiveau(),
  formateerKettlebellVoorPrompt(). CoachOS bibliotheek compleet:
  Bodyweight 120 + Strength 100 + Kettlebell 102 = 322 oefeningen totaal.

## Coach-routes — geverifieerde architectuur (Sonnet 4.6, tenzij anders vermeld)
Alle drie onderstaande bestanden zijn in de loop van het project
daadwerkelijk gelezen en geverifieerd (niet aangenomen op basis van
bestandsnaam):
- `coach/route.ts` — dagadvies, schrijft `coach_recommendations`
  (type='coach') incl. `trainer_instructies`
- `action-plan/route.ts` — dagplan, schrijft `action_plan` op dezelfde
  rij (update-met-insert-fallback patroon)
- `training/today/route.ts` (Haiku) — leest UITSLUITEND coach-output
  (`trainer_instructies`, `action_plan`) + Strava-historie + equipment-
  profiel, nooit ruwe brondata (checkins/life-events/etc.) rechtstreeks

## Tips voor de volgende chat — begin zo
Voordat je ook maar iets bouwt of voorstelt:

1. **Lees eerst deze hele README**, niet alleen de laatste paar secties.
   De "Verificatie-status" hierboven vertelt je precies wat al gecontroleerd
   is en wat niet — behandel "nooit gezien" als ECHT nooit gezien, ook al
   staat de naam en rol van het bestand er duidelijk bij.
2. **Vraag het bestand op voordat je over de inhoud beweert.** Een naam als
   "goals/page.tsx" of een rol-omschrijving in de structuur-boom is geen
   vervanging voor de echte code. Raad nooit wat er waarschijnlijk in staat.
3. **web_fetch op GitHub werkt onbetrouwbaar voor dit repo** — eerdere
   pogingen gaven herhaaldelijk verouderde/gecachete content terug, ook na
   bevestigde pushes. Vertrouw bij twijfel op wat de gebruiker zelf laat
   zien (Working Copy, GitHub-app), niet op je eigen fetch-resultaat.
4. **Eén gerichte vraag tegelijk** bij ontbrekende info — niet drie vragen
   in één bericht, niet doorbouwen op een aanname.
5. **Root cause vóór fix.** Als iets "niet meer werkt", ga ervan uit dat de
   oorzaak specifiek en vindbaar is (zoals de 45-min+afstand drempel, de
   AppShell-wrapper, de WERK_TYPES-filter) — niet een vage "bug". Vraag door
   tot je het zeker weet, ook al kost dat meerdere rondes.
6. **Bij twee samenhangende routes (zoals coach/route.ts en
   action-plan/route.ts): check of ze consistent zijn met elkaar**, niet
   alleen of elk apart correct werkt. De levensgebeurtenissen-inconsistentie
   in v1.8.5 ontstond doordat twee routes onafhankelijk van elkaar waren
   gegroeid — dat patroon kan zich elders ook voordoen.
7. **SQL/code altijd in een eigen code-blok**, nooit gemengd met uitleg —
   zie Werkwijze hierboven, dit voorkwam een syntax-error in Supabase.
8. **Test apostrofs/quotes in string literals** voordat je TypeScript-
   bestanden oplevert — een ongeëscapete `'` in een string brak v1.8.4's
   build (zie Versiehistorie). Gebruik bij twijfel dubbele quotes of
   backticks in plaats van enkele quotes voor strings met mogelijke
   apostrofs (Nederlandse tekst bevat ze vaak).
9. **PWA op iOS gooit query params weg bij router.push()** — gebruik
   NOOIT ?source=library of andere query params voor state-overdracht
   tussen pagina's in deze PWA. Gebruik localStorage als tussenopslag:
   schrijf de waarde vóór router.push(), lees hem op de nieuwe pagina
   in een useEffect (niet op module-niveau — window is dan nog niet
   beschikbaar bij SSR).
10. **isLibrary-detectie moet VOOR de resume-dialog check** in de
    useEffect van session/[module]/page.tsx — anders blokkeert een oude
    gecachede sessie de library-flow volledig. Volgorde is kritisch:
    (1) detecteer isLibrary, (2) check bestaande sessie alleen als
    !isLibrary, (3) pas dan clearSession() en run().
11. **Nooit een session/page.tsx maken naast de [module] map** — dat
    onderschept alle navigatie naar /training/session/* en maakt de
    dynamische [module] route onbereikbaar. Alleen [module]/page.tsx
    mag bestaan in de session map.

## Nieuwe chat starten
Lees mijn README op
https://raw.githubusercontent.com/stuctech-eng/coachOS/refs/heads/main/README.md
en help me verder met CoachOS
