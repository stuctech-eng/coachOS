# CoachOS — Changelog

## v2.4.16 — Illustratie-koppeling: 6 nieuwe WebP-oefeningen (#16-21)
- `src/lib/kettlebell-exercises.ts` — `illustratie`-veld toegevoegd aan 6
  entries: kb-box-squat, kb-tempo-goblet-squat, kb-pause-squat,
  kb-split-squat, kb-bulgarian-split-squat, kb-reverse-lunge.
  Eerste WebP-illustraties sinds de workflow-herziening in v2.4.5 (PNG
  t/m #15, WebP vanaf #16) — bevestigt dat de eerder vastgestelde
  formaat-knip in de praktijk werkt zonder verdere codewijziging nodig.
  Totaal nu 24/102 kettlebell-oefeningen met live illustratie (18 PNG
  legacy + 6 WebP nieuw).

## v2.4.15 — Fix: coach-geheugen/patroonherkenning heeft nooit gewerkt
**Gevonden via de nieuwe gezondheidscheck (v2.4.14): een 401-fout op
`POST /api/memory` met `User Agent: node`, dus een server-naar-server
aanroep — geen gebruikersactie.**

- `src/app/api/coach/route.ts` — de fire-and-forget call naar `/api/memory`
  aan het einde van de POST geeft nu `userId` mee in de request-body:
  ```js
  fetch('https://coach-os-tau.vercel.app/api/memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.id }),
  }).catch(() => {})
  ```
- `src/app/api/memory/route.ts` — `POST` accepteert nu optioneel een
  `userId` in de body; valt terug op cookie-gebaseerde `getUser()` als die
  ontbreekt (voor eventuele toekomstige directe client-aanroepen).
- **Root cause:** deze server-naar-server fetch stuurde nooit cookies mee.
  `getUser()` (cookie-gebaseerd) kon de gebruiker daardoor nooit
  identificeren, en de route gaf sinds de eerste implementatie altijd 401
  terug. De aanroeper ving dit stil af met `.catch(() => {})`, dus dit was
  nooit zichtbaar in normaal gebruik.
- **Impact:** de coach-geheugen/patroonherkenning-feature — beschreven in
  `hoe-werkt-het/page.tsx` ("Coach AI heeft een geheugen... na een week
  begint hij patronen te herkennen") — heeft dus **nog nooit gedraaid**
  sinds de eerste implementatie. `coach_memory` bevatte hierdoor nooit
  automatisch gegenereerde patronen.
  **Besluit:** geen eenmalige achterstand-inhaaltrigger. Vanaf nu bouwt de
  patroonherkenning organisch op bij elke nieuwe coach-advies-generatie —
  rustig, zonder een geforceerde eenmalige analyse over oude data.

## v2.4.14 — Eén versienummer: package.json leidend, automatische update-detectie
**Definitieve oplossing voor drie los van elkaar lopende versienummers
(package.json 1.8.0, hoe-werkt-het-pagina "v1.8.6" hardcoded, README
2.4.13) — vastgesteld tijdens de gezondheidscheck-discussie.**

- `package.json` — versienummer bijgewerkt naar `2.4.14`. **Dit is vanaf
  nu de enige bron van waarheid voor het app-versienummer.** Bij elke
  toekomstige wijziging: `package.json`, README en changelog gaan altijd
  samen omhoog, in dezelfde beweging.
- **Nieuw:** `src/app/api/version/route.ts` — leest het versienummer
  rechtstreeks uit `package.json` en geeft het terug als JSON. Geen
  wijziging aan `next.config.js` nodig (geen build-time env-injectie) —
  een simpele runtime-route volstaat en is minder risicovol.
- `src/app/settings/hoe-werkt-het/page.tsx` — de hardcoded `"CoachOS
  v1.8.6"`-tekst is vervangen door een `fetch('/api/version')`-call. Kan
  nooit meer los gaan lopen van de werkelijke versie.
- `src/app/home/page.tsx` — **automatische update-detectie toegevoegd.**
  Bij elke keer dat de app opent, vergelijkt een nieuwe `useEffect` het
  versienummer (via `/api/version`) met wat in `localStorage`
  (`coachos_laatst_geziene_versie`) stond bij het vorige bezoek. Bij een
  verschil draait een **lichte** gezondheidscheck op de achtergrond (5
  kerntabellen + 3 kernroutes, puur lezend — bewust géén Laag 3
  schrijftest op de achtergrond, dat blijft voorbehouden aan een bewuste
  handmatige `/debug`-run). Bij gevonden problemen verschijnt een rode
  banner bovenaan Home die doorlinkt naar `/debug` voor de volledige
  diagnose. Faalt de check zelf (netwerk e.d.), dan gebeurt er stil niets
  — geen storende fout-banner voor een probleem dat er niet is.
- **Wat dit oplost:** de oorspronkelijke wens ("waarschuwen als een update
  de code breekt") is nu functioneel — niet volledig automatisch vóóraf
  (dat kan niet zonder CI/CD-pipeline, zie eerdere overleg), maar wel
  automatisch **gedetecteerd bij het eerstvolgende bezoek na een update**,
  zonder dat de gebruiker zelf naar `/debug` hoeft te navigeren.

## v2.4.13 — Debug Panel uitgebreid tot volledige gezondheidscheck
- `src/app/debug/page.tsx` — drie lagen toegevoegd/uitgebreid:
  - **Laag 1 — alle tabellen:** bereikbaarheidscheck uitgebreid van 4 naar
    alle 29 tabellen uit het schema (`select id limit 1`, puur lezend).
    Toont nooit inhoud van gevoelige tabellen (`strava_tokens`,
    `health_api_keys`) — alleen bereikbaar/niet.
  - **Laag 2 — kernroutes:** uitgebreid van 2 naar 17 veilig-te-testen
    GET-routes. Schrijfroutes (training/complete, coach-calls/rate,
    strava/sync, etc.) worden bewust NIET aangeroepen — dat zou echte data
    aanmaken/wijzigen.
  - **Laag 3 — schrijftest coach_calls/coach_call_items:** maakt een
    tijdelijke, herkenbare testrij aan (`sport_type: '__SELFTEST__'`,
    datum `1900-01-01`, status `__selftest_pending__`/`__selftest__` — kan
    nooit met echte data clashen), test de insert, en ruimt direct op via
    een `finally`-blok (ook bij een fout onderweg). Ruimt bij elke run ook
    oude testrijen op (ouder dan 5 min) mocht een eerdere run gecrasht
    zijn vóór opruiming. Dit is precies de test die de v2.4.12
    NOT NULL-constraint-bug **direct** had gevangen, in plaats van het
    uren durende onderzoekstraject dat nu nodig was.
  - Kleine bugfix: de bestaande localStorage-check gaf een false-positive
    "GEEN geldige JSON" voor `*_datum`-keys (die bewust kale datumstrings
    bevatten, geen JSON) — nu correct herkend als verwacht gedrag.
- **Nog niet gebouwd:** automatisch draaien na een update (zoals
  besproken). Vereist een betrouwbaar versienummer-mechanisme in de app
  (bv. `NEXT_PUBLIC_APP_VERSION` env-variabele vergeleken met een
  `localStorage`-waarde) — dat bestaat momenteel niet. De
  "hoe-werkt-het"-pagina toont een hardcoded "v1.8.6", losstaand van het
  README-versienummer; dit moet eerst rechtgetrokken worden voordat
  automatische update-detectie zinvol gebouwd kan worden. Zie Openstaand.

## v2.4.12 — DEFINITIEVE FIX: NOT NULL constraint op activity_session_id
**Root cause van het volledige "geen Coach Call na bibliotheek-training"-
traject (v2.4.6 t/m v2.4.11), eindelijk gevonden en opgelost.**

- **Databasewijziging (uitgevoerd in Supabase SQL Editor, geen code):**
  ```sql
  alter table coach_call_items
  alter column activity_session_id drop not null;
  ```
- **Wat er mis was:** `coach_call_items` is oorspronkelijk ontworpen voor
  uitsluitend Strava-items, met `activity_session_id` als verplichte
  (`NOT NULL`) kolom. Toen v2.4.6 bibliotheek-trainingen dezelfde tabel
  liet gebruiken (met `training_result_id` in plaats van
  `activity_session_id`, dat laatste dus leeg), is het databaseschema zelf
  nooit aangepast. Elke insert vanuit de bibliotheek-tak faalde daardoor
  met Postgres-foutcode `23502` ("null value in column
  activity_session_id... violates not-null constraint") — 100% consistent,
  geen toeval, geen RLS-probleem.
- **Waarom dit zo lang duurde om te vinden:** de fout was van meet af aan
  onzichtbaar. `training/complete/route.ts` had de insert in een
  `try/catch` die alleen logde, en de retry-helper (v2.4.9) checkte het
  `.error`-veld van de Supabase-response niet — Supabase gooit standaard
  geen JS-exception bij een DB-fout. Pas v2.4.11 (expliciete
  `.error`-check + eigen Error met volledige Postgres-details) maakte de
  echte foutmelding zichtbaar in Vercel logs, waarna de oorzaak in één
  oogopslag duidelijk werd.
- **Onderzoekspad ter referentie (voor vergelijkbare toekomstige gevallen):**
  1. v2.4.8 loste een écht ander probleem op (completed/expired call niet
     heropend) — nodig maar niet voldoende
  2. Vercel function trace liet zien dat de POST naar `coach_call_items`
     wél plaatsvond, met 200-status op de hele route
  3. SQL-onderzoek naar RLS-policies (`pg_policies`, `rolbypassrls`) bleek
     achteraf een verkeerd spoor — alle policies waren consistent en
     correct; dit kostte de meeste tijd
  4. Pas expliciete `.error`-logging (v2.4.11) gaf het echte antwoord:
     een constraint-violation, geen RLS-probleem
- **Les voor toekomstige Supabase-debugging:** controleer bij een "stil
  falende" insert altijd eerst of de code het `.error`-veld daadwerkelijk
  checkt, vóórdat er tijd gestoken wordt in RLS/policy-onderzoek. Supabase
  se client-bibliotheek gooit geen exceptions bij databasefouten.
- **Bevestigd werkend:** test via Trainingsbibliotheek (kettlebell, 3 juli
  21:37) — Coach Call verscheen, evaluatie (rating + mood verplicht) kon
  verstuurd worden, AI coach-reactie werd correct gegenereerd.

## v2.4.11 — Fix: retry checkte nooit het .error-veld van Supabase-responses
- `src/app/api/training/complete/route.ts` — root cause van het aanhoudende
  "geen Coach Call na bibliotheek-training"-probleem (ook na v2.4.9/v2.4.10):
  Supabase-queries gooien standaard GEEN JavaScript-exception bij een
  database-fout (RLS-blokkade, constraint-violation, etc.) — ze retourneren
  gewoon `{ data: null, error: {...} }`. De `withRetry()`-helper uit v2.4.9
  checkte dit `.error`-veld nergens, ving alleen echte JS-exceptions
  (netwerkfouten) op. Een mislukte insert werd dus stil als "succesvol"
  behandeld: geen retry, geen log, geen enkele indicatie — precies wat het
  onderzoek deze sessie liet zien (4 van 4 bibliotheek-trainingen misten
  hun coach_call_item, zonder een enkele foutmelding in Vercel logs).
  Fix: `withRetry()` checkt nu expliciet `result.error` en gooit zelf een
  `Error` met de volledige Postgres-foutdetails (code/message/details/hint).
  Dit maakt retry en logging voor het eerst daadwerkelijk functioneel voor
  deze Supabase-call-patronen.
  **Nog open:** de exacte onderliggende oorzaak (waarom de insert faalt —
  RLS, key-configuratie, of iets anders) is nog niet bevestigd. RLS-policies
  op `training_results`, `coach_calls` en `exercise_records` bleken bij
  onderzoek vergelijkbaar met die van `coach_call_items` (allemaal
  `auth.uid() = user_id`), wat de eenvoudige "verkeerde key"-hypothese
  weerlegt aangezien `training_results` wél altijd slaagt. Met deze fix
  live wordt de eerstvolgende mislukking eindelijk met exacte Postgres-
  foutcode gelogd — dat is de volgende stap om de echte oorzaak te vinden.

## v2.4.10 — Build-fix: TypeScript-fout in withRetry-helper (v2.4.9)
- `src/app/api/training/complete/route.ts` — de `withRetry()`-helper uit
  v2.4.9 gaf een Vercel build-fout: `Property 'data' does not exist on
  type 'unknown'`. Oorzaak: de signatuur `fn: () => Promise<T>` liet
  TypeScript het generic type `T` niet correct afleiden, omdat Supabase's
  query builders een `PromiseLike` (thenable) zijn, geen echte `Promise`-
  instantie — daardoor viel `T` terug op `unknown`.
  Fix: signatuur aangepast naar `F extends () => PromiseLike<unknown>` met
  `Promise<Awaited<ReturnType<F>>>` als retourtype. Lokaal geverifieerd met
  `tsc --strict` tegen een gesimuleerde thenable query builder — compileert
  zonder fouten. Functioneel identiek gedrag aan v2.4.9, alleen de types
  gecorrigeerd.

## v2.4.9 — Retry-logica Stap 3 + nieuwe debug-check "Coach Call Integriteit"
- `src/app/api/training/complete/route.ts` — Stap 3 (Coach Call aanmaken/
  heropenen) krijgt nu een retry: bij falen wordt na 400ms één keer
  opnieuw geprobeerd, via een kleine `withRetry()`-helper. Vangt
  kortstondige Supabase pooler-timeouts op (zie v2.4.8 root cause —
  "Warp server error: Thread killed by timeout manager" in Postgres Logs).
  Een structureel probleem faalt ook na de retry en wordt gelogd zoals
  voorheen; dit lost dus specifiek het "eenmalige hik"-scenario op, niet
  een aanhoudende infrastructuurstoring.
- `src/app/debug/page.tsx` — nieuwe diagnostiek-sectie "Coach Call
  Integriteit (laatste 24u)". Vergelijkt alle `training_results` met
  `training_source: 'library'` van de afgelopen 24 uur tegen
  `coach_call_items`, en meldt expliciet welke trainingen geen
  bijbehorend Coach Call-item hebben — dat is precies het probleem dat
  leidde tot deze toevoeging (een training werd opgeslagen, maar het
  Coach Call-item niet, door een tijdelijke Supabase-storing). Voorheen
  was dit alleen op te sporen via Vercel function traces + Supabase
  Postgres Logs (zie sessie juli 2026, coach_call_id 85e5b7d6...). Nu
  zichtbaar met één druk op "Start diagnostiek" in de app zelf, conform
  Kernregel §15 (fouten moeten zichtbaar zijn zonder externe tools).

## v2.4.8 — Fix: bibliotheek-Coach Call onzichtbaar na eerdere afgeronde call
- `src/app/api/training/complete/route.ts` — Stap 3 heropent nu een bestaande
  `coach_call` als die al `completed`/`expired` was, vóórdat het nieuwe item
  wordt toegevoegd. Zelfde root cause en fix als v2.4.3 (`coach-calls/route.ts`),
  hier ontbrak de heropen-logica nog in de bibliotheek-tak.
  Bevestigd via test + Vercel function trace: de POST naar `/api/training/complete`
  gaf 200, `coach_call_items` werd wel degelijk aangemaakt (zichtbaar in de
  external API calls: GET coach_calls → POST coach_call_items), maar de
  bijbehorende `coach_calls`-rij bleef op status `completed` staan van een
  eerder die dag afgeronde evaluatie. `GET /api/coach-calls` filtert op
  `pending`/`partial`, dus de banner op Home verscheen niet — ondanks dat de
  data correct was opgeslagen.
  Reproductiestap die dit aan het licht bracht: Coach Call afronden (bv. via
  Strava), daarna dezelfde dag een training uit de Trainingsbibliotheek
  doorlopen en evalueren — geen nieuwe Coach Call zichtbaar op Home.
  **Vervolgonderzoek (zelfde sessie):** een tweede test, ná deze fix, liet
  alsnog geen Coach Call zien. Onderzoek via Vercel function trace + Supabase
  Postgres Logs bracht de échte oorzaak van dié herhaling aan het licht: een
  kortstondige Supabase-pooler-timeout ("Warp server error: Thread killed by
  timeout manager") liet de `coach_call_items`-insert stil mislukken, terwijl
  de hoofdroute alsnog 200 teruggaf. Dit is geen logicafout in deze fix, maar
  een infrastructuur-timing-probleem — opgelost in v2.4.9 met retry-logica.

## v2.4.7 — Opruiming: dubbele oefening-databron verwijderd

**Wat er weg is:**
- `src/app/oefening/[id]/page.tsx` — verwijderd
- `src/lib/exercises.ts` — verwijderd

**Waarom dit bestond en waarom het weg kon:**
Naast de acht bibliotheekbestanden (`kettlebell-exercises.ts`, `bodyweight-exercises.ts`, etc. — samen 390 oefeningen, bron van waarheid volgens `docs/architecture.md` §2) bestond er een tweede, kleinere, op zichzelf staande oefeningenlijst in `src/lib/exercises.ts` met slechts 5 hardcoded oefeningen (Two Hand Swing, Goblet Squat, Kettlebell Clean, Kettlebell Press, Farmer Carry). Deze gebruikte een ander ID-formaat (`two-hand-swing` i.p.v. `kb-swing`) en een ander veld voor de illustratie (`afbeelding`, volledig pad, i.p.v. `illustratie`, alleen bestandsnaam).

Dit werd gerenderd door `src/app/oefening/[id]/page.tsx`, een apart UitlegScherm dat losstond van het eigenlijke Archief-systeem (`src/app/archief/oefening/[id]/page.tsx`), dat wél uit de acht echte bibliotheken put via `vindOefening()`.

**Onderzoek (deze sessie) — is dit ooit gebruikt?**
Voordat verwijderd werd, is expliciet gecontroleerd of er ergens in de app naar `/oefening/[id]` gelinkt wordt:
- `src/app/archief/page.tsx` — linkt naar `/archief/oefening/${id}` (niet naar `/oefening/`)
- `src/app/training/page.tsx` — alle routes gaan naar `/training/session/[module]` of `/training/recovery/...`
- `src/components/layout/index.tsx` (bottom nav) — alleen `/home`, `/training`, `/progressie`, `/chat`, `/settings`
- `src/app/api/training/today/route.ts` — genereert alleen oefening-**namen** in `segments`, nooit een ID-link naar `/oefening/`
- `src/store/index.ts`, `src/types/index.ts` — geen state of type die naar `exercises.ts` of `/oefening/[id]` verwijst

Conclusie: geen enkele plek in de app linkte naar deze route. Het was dode code, vermoedelijk een eerdere, kleinere implementatie van vóór het Archief-systeem (v2.4.0) die nooit is opgeruimd.

**Impact van de verwijdering:**
- Geen — er was geen actieve link naar deze route, dus er is niets in de UI dat nu een 404 geeft.
- Lost de architectuur-inconsistentie volledig op die eerder alleen was gedocumenteerd (zie v2.4.5-notitie in README, sectie "Bekende architectuur-inconsistentie" — die sectie is nu verwijderd omdat het probleem is opgelost, niet langer alleen gemeld).
- `public/exercises/` blijft ongewijzigd — alle illustraties (legacy PNG én nieuwe WebP) blijven exact zoals ze waren, gekoppeld via de acht bibliotheekbestanden.

**Wat een volgende sessie moet weten:**
Er is nu nog maar **één** manier waarop een gebruiker een losse oefening met uitleg/illustratie te zien krijgt: via het Archief (`/archief` → `/archief/oefening/[id]`), dat leest uit de acht bibliotheekbestanden in `src/lib/`. Er bestaat geen aparte of alternatieve oefeningenlijst meer. Als er ooit weer een `Oefening`-achtig type of `exercises.ts`-achtig bestand opduikt, is dat een nieuwe toevoeging, geen herstel van iets bestaands — behandel dat met dezelfde argwaan (Kernregel: geen dubbele modules) als deze opruiming zelf.

## v2.4.6 — Coach Call: OR-drempel Strava + altijd triggeren bij bibliotheek
- `src/app/api/coach-calls/route.ts` — Strava-kwalificatie gewijzigd van
  AND naar OR: een activiteit kwalificeert nu als afstand ÓF duur voldoet,
  niet beide tegelijk. `MIN_DURATION_MIN` verlaagd van 45 naar 30 minuten.
  Afstandsdrempels ongewijzigd (Hardlopen 5km, Fietsen 20km, Roeien 5km).
  Reden: in herstelfases is afstand soms niet haalbaar maar duur wel een
  reëel belastingssignaal — dat moet de coach kunnen zien.
- `src/app/api/training/complete/route.ts` — Coach Call wordt nu ALTIJD
  aangemaakt bij `training_source: 'library'` (Archief + Trainingsbibliotheek),
  ongeacht welk coach-advies die dag gold. Voorheen alleen bij advies
  'herstel' of 'rust' — dat miste gevallen zonder advies of met advies
  'trainen'. De evaluatie zelf zat al in de sessie (EvaluatieLayer); dit
  triggert nu consistent de melding aan de coach dat er buiten zijn advies
  om getraind is, voor de herstelinschatting van de volgende dag.
- `src/app/settings/hoe-werkt-het/page.tsx` — sectie "Coach Call" herschreven:
  legt nu het onderscheid uit tussen Strava (OR-drempel, enige bron van
  evaluatiedata) en Archief/Trainingsbibliotheek (altijd triggeren, evaluatie
  zit al in de sessie zelf). Trainer AI-sectie kreeg een verwijzing naar
  dezelfde Coach Call-trigger voor Trainingsbibliotheek.
  Noot: deze pagina toont onderaan "CoachOS v1.8.6" — een apart, niet met
  de hoofdversie gesynchroniseerd versienummer. Niet gewijzigd, want de
  juiste waarde is niet vastgesteld (geen aanname gemaakt).

## v2.4.5 — Illustratie-koppeling 12 kettlebell-oefeningen + workflow-herziening
- `src/lib/kettlebell-exercises.ts` — `illustratie`-veld toegevoegd aan 12
  entries: kb-sumo-deadlift, kb-single-arm-deadlift, kb-romanian-deadlift,
  kb-staggered-deadlift, kb-russian-swing, kb-american-swing,
  kb-one-arm-swing, kb-hand-to-hand-swing, kb-double-swing,
  kb-alternating-swing, kb-front-squat, kb-double-front-squat.
  Bestanden waren al als PNG geüpload naar `public/exercises/` in Working
  Copy; deze wijziging koppelt ze aan de bibliotheek-entries.
  Totaal nu 18/102 kettlebell-oefeningen met live illustratie.
- Workflow-besluit: Dropbox als centraal archief overwogen en weer
  afgeschaft — GitHub zelf is al voldoende archief/backup. WebP als
  standaardformaat blijft staan, maar alleen vanaf illustratie #16 (Box
  Squat) — de 18 hierboven blijven PNG (geen herwerk van reeds voltooide
  illustraties). Zie README sectie "Illustratie Workflow" voor details.

## v2.4.4 — Fix: "Genereer advies" hangt bij trage/onbereikbare Open-Meteo
- Nieuw: `src/lib/fetch-with-timeout.ts` — gedeelde helper die `fetch` wrapt
  met een `AbortController`-timeout. Voorkomt dat een trage externe API een
  serverless function laat vastlopen tot de platform-timeout (die als
  onafgevangen 500 naar buiten komt — een `.catch()` in de eigen code helpt
  dan niet, want de hele function wordt door het platform afgebroken).
- `src/app/api/weather/route.ts` — beide externe fetches (`ipapi.co` en
  `api.open-meteo.com`) krijgen nu een timeout (3s / 4s).
- `src/app/api/coach/route.ts` — de interne fetch naar `/api/weather` binnen
  de `Promise.all` krijgt een timeout (3s) i.p.v. onbeperkt wachten.
  Root cause: Vercel logs toonden `ConnectTimeoutError` naar
  `api.open-meteo.com:443` (10s). Doordat deze fetch zonder timeout in een
  `Promise.all` met 16 andere calls zat, liep de hele `/api/coach` POST vast
  tot de Vercel function-timeout — zichtbaar als "spint, maar geeft niets"
  op de "Genereer advies"-knop, en als POST 500 / GET 500 in de logs.
  `useCoach.ts` toonde deze fout niet aan de gebruiker (silent catch) — dat
  blijft een bekend aandachtspunt, zie README sectie Troubleshooting.

## v2.4.3 — Fix: Strava Coach Call niet zichtbaar na voltooide call
- `src/app/api/coach-calls/route.ts` — POST heropent een bestaande `coach_call`
  (status `completed` of `expired`) wanneer er nieuwe kwalificerende Strava-
  activiteiten voor diezelfde datum bijkomen. Voorheen werden nieuwe
  `coach_call_items` wel toegevoegd aan de bestaande call, maar bleef de
  `coach_calls.status` op `completed`/`expired` staan — waardoor de GET-route
  (die filtert op `status in (pending, partial)`) de call nooit meer teruggaf
  en de banner op de home-pagina niet verscheen.
  Root cause: als een gebruiker die dag al één Coach Call had afgerond en
  daarna een nieuwe kwalificerende activiteit synchroniseerde (bv. een
  Strava-fietsrit), werd die activiteit stil toegevoegd aan een call die al
  als voltooid gemarkeerd stond.
  Fix: bij het toevoegen van nieuwe items aan een bestaande call wordt nu ook
  gecontroleerd of die call `completed`/`expired` is — zo ja, dan wordt de
  status teruggezet naar `pending` en `completed_at` naar `null`.
  Geen wijziging aan drempelwaarden, database-schema of overige flows.

## v2.4.2 — Timer + Countdown Fix Archief
- `src/app/archief/oefening/[id]/page.tsx` — 5 seconden countdown toegevoegd
  vóór elke set (cirkel-voortgang, skip-knop). Reps omgezet naar tijdseenheid
  (3 sec/rep) zodat altijd een aftellende timer zichtbaar is, ook bij
  rep-gebaseerde oefeningen zoals Kettlebell Swing.
  Consistent met sessie-engine, mobility en relaxation pagina's.

## v2.4.1 — Archief Standalone Flow
- Nieuw: `src/app/archief/oefening/[id]/page.tsx`
  Instelpaneel: sets/reps/duur/rust instelbaar, kettlebell gewicht
  keuzemenu (14/16/20kg, uitbreidbaar tot 32kg in stappen van 4).
  Toont vorige sessie uit exercise_records als referentie.
  Geen Trainer AI call — eigen mini workout-engine voor 1 oefening.
  training_source: library triggert bestaande Coach Call logica.

## v2.4.0 — Exercise Illustraties + Archief
- `illustratie` veld toegevoegd aan BibliotheekOefening interfaces
- Kettlebell Swing eerste oefening met mannequin-stijl illustratie
  (public/exercises/kettlebell-swing.png), GPT-gegenereerd
- UitlegScherm toont illustratie boven Doelwaarden als beschikbaar
- Nieuw: `/archief` pagina — alle 354 oefeningen doorbladerbaar per
  categorie, los van coach advies. Zoekfunctie.

## v2.3.6 — Weerbericht
- `src/app/api/weather/route.ts` — nieuw. IP → locatie → Open-Meteo.
  Uurlijkse data voor ochtend/middag/avond regen. Geen API key.
- `src/app/home/page.tsx` — weerbericht onder de datum (emoji, stad, temp, dagdelen)
- `src/app/api/coach/route.ts` — weercontext toegevoegd aan dagadvies

## v2.3.5 — Coach Rapport op aanvraag (Fase 3B)
- `src/app/api/progress-analysis/route.ts` — nieuw. 60 dagen data → Claude Sonnet
  → kracht/conditie/herstel/compliance/risicos/focus/samenvatting.
  Cache: max 1 analyse per 24 uur in `progress_analyses` tabel.
- `src/app/progressie/page.tsx` — "Analyseer mijn ontwikkeling" knop.
  Toont 6 secties met persoonlijk maandrapport. Opnieuw analyseren knop.

## v2.3.4 — Coach Trendanalyse (Fase 3A)
- `src/app/api/coach/route.ts` — progressie trendanalyse toegevoegd.
  Eerste vs laatste uitvoering per oefening, % verandering, trend richting.
  Gemiddelde RPE laatste 7 dagen. Belastingtrend t.o.v. vorige week.
  Coach ziet: "Goblet Squat 16kg → 20kg (+25%) ↑"

## v2.3.3 — Progressie Fase 2
- `src/app/progressie/page.tsx` — grafiek per oefening (tik op PR).
  Volume per week grafiek (8 weken). OefeningGeschiedenis berekend uit exercise_records.

## v2.3.2 — Persoonlijke Records
- `src/app/progressie/page.tsx` — PR sectie met module filter.
  Toont max gewicht/reps/duur per oefening. Sortering op meest uitgevoerd.

## v2.3.1 — Exercise Records
- Supabase tabel `exercise_records` aangemaakt (id, user_id, training_result_id,
  exercise_id, exercise_name, exercise_type, module, weight_kg, reps,
  duration_sec, distance_m, sets, rpe, performed_at)
- `src/app/api/training/complete/route.ts` — segments worden opgeslagen als exercise_records
- `src/app/training/session/[module]/page.tsx` — segments meegegeven bij opslaan

## v2.3.0 — Drill Libraries Running/Rowing/Cycling
- `src/lib/running-drills.ts` — 13 drills (recovery, endurance, tempo, interval, techniek)
- `src/lib/rowing-drills.ts` — 12 drills (recovery, endurance, interval, techniek)
- `src/lib/cycling-drills.ts` — 11 drills (recovery, endurance, tempo, interval, techniek)
- `src/app/api/training/today/route.ts` — runningContext, rowingContext, cyclingContext
- Trainer Rule volledig van kracht voor ALLE modules

## v2.2.2 — Scroll en Navigatie Fixes
- Alle recovery pagina's: terug → `/training?herstel=1&terug=[categorie]`
- `training/page.tsx` — herstelbibliotheek opent op juiste categorie bij terugkeren
- Categorieën standaard ingeklapt, scroll naar categorie bij openen
- Suspense wrapper voor useSearchParams (build fix)

## v2.2.1 — Relaxation Pagina + Categorische Herstelbibliotheek
- `src/app/training/recovery/relaxation/page.tsx` — nieuw. 6 schemas:
  Progressieve Spierontspanning, Body Scan, Visualisatie Herstel,
  Savasana, Cooling Down Protocol, Diafragma Ademhaling
- `src/app/training/page.tsx` — herstelbibliotheek inklapbaar per categorie:
  Ademhaling (5), Mobiliteit (11), Ontspanning (5), Wandelen (2)

## v2.2.0 — Recovery Bibliotheek
- `src/lib/recovery-exercises.ts` — 12 modules:
  Ademhaling (5), Wandelen (2), Ontspanning (4), Visualisatie (1)
- `filterRecovery()` en `formateerRecoveryVoorPrompt()` toegevoegd aan route
- Herstelbibliotheek uitgebreid met 7 nieuwe modules

## v2.1.2 — Alle Mobility Schemas in Herstelbibliotheek
- `src/app/training/page.tsx` — alle 11 mobility schemas zichtbaar in herstelbibliotheek
- Trainer Rule gedocumenteerd in docs/architecture.md

## v2.1.1 — Mobility Filter in Route
- `src/app/api/training/today/route.ts` — filterMobility() geïmporteerd
- Blessure-gebaseerde lichaamsdeel focus
- mobilityContext toegevoegd aan bibliotheekContext

## v2.1.0 — Mobility Bibliotheek
- `src/lib/mobility-exercises.ts` — 20 oefeningen
- Types: MobilityDoel, MobilityNiveau, MobilityLichaamsdeel, MobilityCategorie
- filterMobility() en formateerMobilityVoorPrompt()

## v2.0.4 — Mobility Bug Fix
- `src/app/training/recovery/mobility/page.tsx` — 11 schemas toegevoegd
- Fallback van neck_shoulders → full_body
- Route prompt: AI mag alleen bekende mobility subtypes gebruiken

## v2.0.3 en eerder — Zie eerdere sessies
- Coach Call Stap 1+2+3
- Bodyweight bibliotheek (120 oefeningen)
- Strength bibliotheek (100 oefeningen)
- Kettlebell bibliotheek (102 oefeningen)
- Uitlegpagina bibliotheek-koppeling
- Naam matching met aliassen
- Strava integratie
- Garmin integratie
- Life-events module
