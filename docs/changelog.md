# CoachOS — Changelog

## v2.4.73 — Memory Engine, sub-stap 1/5: SQL specialist_memory
**Eerste stap van de Memory Engine, zoals vastgelegd in
`specialist-memory.md`. Alleen de opslagstructuur — nog geen Learning-
of Confidence-logica (sub-stappen 2 en 4), nog geen AI-integratie
(sub-stap 3), nog geen terugkoppeling naar de Coach Layer (sub-stap 5).**

- **Nieuw:** `supabase/specialist_memory.sql`
  - Exact het veldontwerp uit `specialist-memory.md`: `id`, `user_id`,
    `specialist_type`, `knowledge_type` (hard/soft, met check-constraint),
    `insight`, `category`, `confidence` (0-100), `status`
    (candidate/active/deprecated, met check-constraint),
    `confirmation_count`, `first_observed_at`, `last_confirmed_at`
  - Bewust **geen** wijziging aan `specialist_profiles` of
    `specialist_analyses` — derde, losstaande tabel, zoals onderbouwd
    in `specialist-database-design.md` §4.5 / `specialist-memory.md`
  - `updated_at`-trigger, indexen, RLS — zelfde patroon als
    `specialist_layer.sql` (v2.4.59)

**Volgende sub-stap (2/5):** Learning Engine — deterministische logica
die bepaalt of een kandidaat-inzicht gepromoveerd wordt van `candidate`
naar `active`.

## v2.4.72 — specialist-api.md: vijf inhoudelijke aanscherpingen na review
**Reactie op een externe review van de v2.4.71-reconstructie. Eerst
geverifieerd (niet aangenomen) dat alle versieclaims kloppen — alle zes
`specialist-*.md`-documenten + kerncode gaven HTTP 200 op GitHub, plus
bevestigd door live tests eerder in de sessie. Daarna vijf inhoudelijke
verbeteringen doorgevoerd:**

1. **"AI berekent nooit" genuanceerd** — te absoluut voor de praktijk.
   Nieuwe formulering: *"Alle bedrijfskritische berekeningen, trends,
   scores en beslislogica worden deterministisch uitgevoerd. AI mag
   deze niet vervangen."* AI mag nog steeds geen bron van waarheid
   worden voor een cijfer — kleine interpretatieve stappen in lopende
   tekst blijven toegestaan.
2. **Generieke rekenbibliotheek benoemd** — trendberekening, moving
   average, rolling windows horen niet per sport opnieuw geschreven te
   worden. Cycling Analysis Engine (v2.4.66) heeft dit nog inline staan
   — bij een tweede specialist is dit het moment om te extraheren naar
   een gedeelde bibliotheek.
3. **Goal Engine: Global Goals vs. Specialist Goals** — niet elk doel is
   sportspecifiek (bijv. "minder stress", "beter slapen" horen bij de
   Master Coach, niet bij een specialist). Beide blijven in `user_goals`,
   onderscheid zit in wie de voortgang berekent/gebruikt.
4. **Hub-structuur herzien: capabilities i.p.v. vaste modulelijst** — een
   specialist publiceert zijn eigen capability-set (bijv. Cycling:
   Dashboard/Records/Grafieken/FTP/Wedstrijden, Nutrition: Maaltijden/
   Macro's/Recepten), geen gedeelde lijst waar elke specialist uit put.
   Capability Registry is hierin leidend.
5. **Decision Engine expliciet in de Fase 4-flow** — was eerder alleen
   een verwijzing ("zie ook"), nu een expliciete stap in het
   flow-diagram: `Specialist(en) → Decision Engine → Master Coach`.

**Alle vijf punten waren gerichte verbeteringen op een al goed
beoordeeld document (9,5/10 review) — geen fundamentele koerswijziging.**

## v2.4.71 — Herstel: docs/specialist-api.md gereconstrueerd
**`docs/specialist-api.md` bleek nooit gecommit (ontdekt in v2.4.70) —
gereconstrueerd vanuit de conversatiegeschiedenis. GOEDE-TROUW-
RECONSTRUCTIE, geen byte-perfecte kopie van het origineel — controleer
bij twijfel of de inhoud overeenkomt met wat destijds is goedgekeurd.**

- **Hersteld:** `docs/specialist-api.md` — Fase 1-4, Goal Engine,
  Hub-structuur (modules), Event Engine (toekomstig), endpoints-
  overzicht, relatie tot overige documenten
- **Bijgewerkt t.o.v. het origineel:** elke Fase-sectie geeft nu ook de
  daadwerkelijke gebouwd-status aan (✅ v2.4.60-67 voor Fase 1-3, ⏳ voor
  Fase 4/Goal Engine) — het origineel was een zuiver ontwerpdocument
  zonder deze latere realisatiestatus
- **Alle zes documenten nu daadwerkelijk in de repo:**
  `specialist-coaches.md`, `specialist-database-design.md`,
  `specialist-api.md` (hersteld), `specialist-memory.md` (hersteld,
  v2.4.70), `specialist-decision-engine.md`,
  `specialist-engine-architecture.md`

**Aanbeveling:** commit dit, en doe een korte controle-leesbeurt van
beide herstelde documenten (`specialist-api.md`,
`specialist-memory.md`) om te bevestigen dat de reconstructie voldoet.

## v2.4.70 — Specialist Lifecycle Engine + herstel ontbrekende documenten
**⚠️ Belangrijke bevinding tijdens deze stap: `docs/specialist-api.md` en
`docs/specialist-memory.md` bleken nooit daadwerkelijk gecommit, ondanks
eerdere levering als zip. `specialist-memory.md` is hersteld (volledige
tekst was nog beschikbaar). `specialist-api.md` volgt apart, moet
zorgvuldiger gereconstrueerd worden.**

- **Nieuw:** `src/lib/specialists/lifecycle-engine.ts` — volledig
  deterministisch, **geen opgeslagen status-veld**. Berekent de
  levenscyclus-toestand (`DISCOVERABLE`/`SUGGESTED`/`ACTIVE`/`DORMANT`/
  `RETURNING`) elke keer opnieuw uit `specialist_profiles.active` +
  `activity_sessions` — businesslogica, geen data, dus geen SQL-migratie
  nodig.
  - `SUGGESTED`: ≥3 activiteiten in 30 dagen, nog niet actief
  - `DORMANT`: actief, maar ≥60 dagen geen activiteit
  - `RETURNING`: actief, hervat binnen 14 dagen na een gap van ≥60 dagen
    — inclusief `vorige_actieve_periode` (start/eind) voor persoonlijkere
    context in het Coach Layer-advies
- `src/app/api/specialists/route.ts` — `GET` uitgebreid met
  `lifecycle`-veld per specialist (alleen berekend voor cycling, de
  enige specialist met een werkende data-fetcher)
- `src/app/chat/page.tsx` — twee nieuwe banners, **beide met expliciete
  gebruikerskeuze, nooit automatische activatie**:
  - `SUGGESTED` → "Je fietst regelmatig. Wil je de Cycling Coach
    activeren?" met Activeren/Niet nu
  - `RETURNING` → "Welkom terug!" met vorige-periode-context indien
    bekend
- `src/app/coach/cycling/page.tsx` — `DORMANT`-melding toegevoegd; Hub
  blijft **volledig zichtbaar** (kennis/geschiedenis gaat nooit
  verloren, alleen een informatieve melding erbij)
- **Hersteld:** `docs/specialist-memory.md` (v3) — volledige v1/v2-inhoud
  teruggezet, plus nieuwe sectie **Maturity Engine** (toekomstig
  concept, bewust NIET nu gebouwd — vereist eerst een operationele
  Memory + Confidence Engine, anders wordt het een schijnwaarde)

**Vier gescheiden engines nu expliciet onderscheiden:** Lifecycle
("wat doet de gebruiker") ✅ gebouwd, Memory ("wat is geleerd") ⏳,
Confidence ("hoe zeker") ⏳, Maturity ("hoe volwassen is de begeleiding")
toekomstig, in die volgorde.

**Test-instructies:** zie bericht bij levering.

## v2.4.69 — Navigatie-integratie: "Mijn Coaches" in de Coach-tab
**Kleine, gerichte toevoeging aan de bestaande, productie-actieve
`/chat`-pagina (de Coach-tab). Maakt `/coach/cycling` (v2.4.68)
bereikbaar zonder handmatige URL — de laagdrempelige helft van
navigatie-integratie. Raakt NIET `api/coach/route.ts` zelf (Fase 4
Master Coach-integratie) — dat blijft een aparte, expliciet af te
stemmen stap.**

- `src/app/chat/page.tsx` — nieuwe **"Mijn Coaches"-rij** direct onder de
  header, vóór de chat-berichten. Toont alleen specialisten die de
  gebruiker daadwerkelijk heeft geactiveerd (`GET /api/specialists`,
  gefilterd op `actief: true`) — **geen lege sectie** als er niets actief
  is, geen overclaiming van functionaliteit die er niet is.
- Elke chip navigeert naar `/coach/${specialist_type}` — voor Cycling dus
  naar de in v2.4.68 gebouwde Hub.
- Ophalen van specialisten faalt bewust **stil** (geen foutmelding aan de
  gebruiker) — dit is een secundaire, niet-kritieke functie, mag de
  hoofdfunctionaliteit van de Coach-chat nooit verstoren.
- Bewust géén wijziging aan de bestaande chat-logica, berichten-opslag,
  of `/api/chat`-aanroep — puur een toevoeging, geen refactor.

**Resultaat:** vanaf nu, zodra Cycling Coach actief staat, is de Hub
rechtstreeks vanuit de normale Coach-tab bereikbaar.

**Nog steeds bewust niet gedaan (ongewijzigd t.o.v. v2.4.68):** Fase 4 —
Master Coach Orchestrator-integratie in `api/coach/route.ts` zelf. Dat
raakt bestaande, actieve productiecode (het dagelijkse coach-advies) en
vereist expliciete, aparte afstemming voordat daaraan begonnen wordt.

## v2.4.68 — Capability Registry + Cycling Hub-UI (Cycling-referentie, stap 5/5 — LAATSTE STAP)
**De vijfde en laatste stap van de Cycling-referentie-implementatie.
Eerste echte, gebruikersgerichte UI in de specialistlaag — geen
debug-testknop meer, maar een daadwerkelijk bruikbaar scherm.**

- **Nieuw:** `src/lib/specialists/capability-registry.ts`
  - Centrale registratie van wat elke specialist daadwerkelijk
    ondersteunt — voorkomt if-specialist-constructies in de UI
  - **Bewust eerlijk:** Cycling heeft `hasDataLayer`/`hasAnalysisEngine`/
    `hasCoachLayer` op `true` (stappen 1-4, daadwerkelijk gebouwd), maar
    `supportsPeriodization`/`supportsEvents`/`supportsPredictions`/
    `supportsBenchmarks` staan op `false` — niet omdat ze onmogelijk
    zijn, maar omdat ze nog niet bestaan. Geen overclaiming.
- **Nieuw:** `src/app/coach/cycling/page.tsx` — de Cycling Hub zelf
  - Aparte route (`/coach/cycling`), zoals vastgelegd in
    `specialist-coaches.md` §6
  - Toont het Coach Layer-advies (Fase 3) leesbaar geformatteerd —
    samenvatting, sterke punten, aandachtspunten, advies — in plaats
    van ruwe JSON
  - Toont de onderliggende Analysis Engine-cijfers (Fase 2b) als
    overzichtelijke statistiek-kaarten (frequentie met trend-icoon,
    vermogen, afstand, trainingsbelasting)
  - "Ververs analyse"-knop, respecteert de bestaande 24-uur-cache
  - **Geen grijze/uitgeschakelde placeholders** voor niet-bestaande
    modules (Periodisering, Wedstrijden, etc.) — die worden simpelweg
    niet getoond, in lijn met "geen overclaiming"

**Bewust nog niet meegenomen, buiten scope van de 5-stappen-referentie:**
- Integratie in de hoofdnavigatie (een link vanuit de Coach-tab/"Mijn
  Coaches"-sectie, zoals `specialist-coaches.md` §6 beschrijft) —
  `/coach/cycling` is nu alleen bereikbaar via directe URL
- Fase 4 (Master Coach Orchestrator-integratie in `api/coach/route.ts`)
- Decision Engine (pas relevant zodra een 2e specialist actief kan zijn)
- Goal Engine, Specialist Memory — apart ontworpen, nog niet gebouwd

**Test-instructies:** zie bericht bij levering.

---

## 🎉 Cycling-referentie-implementatie compleet — alle 5 stappen

1. ✅ Identity Layer/Registry (v2.4.60)
2. ✅ Data Layer (v2.4.61)
3. ✅ Cycling Analysis Engine (v2.4.66)
4. ✅ Coach Layer/AI (v2.4.67)
5. ✅ Capability Registry + Hub-UI (v2.4.68)

**Zoals vastgelegd in de ontwerpfase:** Running, Rowing en Strength zijn
nu grotendeels een invuloefening binnen dezelfde architectuur — Data
Layer en Analysis Engine zijn per sport uniek werk, maar Identity Layer,
Learning/Confidence/Decision Engine-patronen en de Hub-structuur zijn al
generiek herbruikbaar (zie `specialist-engine-architecture.md`,
Herbruikbaarheid-sectie).

## v2.4.67 — Fase 3: Cycling Coach Layer — eerste AI-call (Cycling-referentie, stap 4/5)
**Eerste daadwerkelijke AI-aanroep in de specialistlaag. Personality
volledig hergebruikt uit de bestaande `coach-personality.ts` — geen
nieuwe stem, dezelfde coach met extra vakkennis.**

- **Nieuw:** `src/app/api/specialists/cycling/coach/route.ts`
  - `GET` — meest recente cycling-analyse ophalen (`specialist_analyses`)
  - `POST` — nieuwe analyse genereren: cache-check (max 1x/24u, zelfde
    patroon als `progress-analysis/route.ts`), roept intern Fase 2b aan
    (`analyseerCycling`), haalt lichte context op (`user_goals`,
    `specialist_profiles.preferences`), bouwt de prompt, roept Claude
    aan, valideert/parseert, slaat op in `specialist_analyses`
  - **Personality-hergebruik, expliciet:** `COACH_CORE_IDENTITY` +
    `CORE_SAFETY_RULE` + `getCoachTone(2)` — allemaal geïmporteerd uit de
    bestaande `@/core/prompts/coach-personality.ts`, niets nieuws
    geschreven. Niveau 2 gekozen (niet 3) — dit is periodiek advies
    genereren, geen reactie op een zojuist afgeronde evaluatie
  - **"AI rekent nooit"-principe, hard afgedwongen in de prompt:** de
    prompt bevat expliciet *"onderstaande cijfers zijn AL BEREKEND (...)
    jij rekent zelf NIETS opnieuw uit"* — de AI krijgt de Fase 2b-
    `resultaat` én `reden[]` kant-en-klaar aangeleverd, mag alleen
    interpreteren
  - Output vaste vorm: `samenvatting`/`sterke_punten`/`aandachtspunten`/
    `advies` — bewust een eigen vorm, niet gedeeld met de
    `ProgressAnalysis`-interface van `progress_analyses` (zie eerdere
    onderbouwing in `specialist-database-design.md` §4.5 waarom die twee
    gescheiden zijn)
  - **Fallback bij AI-storing:** nette Nederlandse standaardtekst, geen
    crash — zelfde patroon als andere AI-routes in dit project
- `src/app/debug/page.tsx` — testsectie uitgebreid met de Coach Layer-test

**Bewust nog niet meegenomen:** Goal Engine-berekening (voortgang t.o.v.
doel) — doelen worden nu alleen als ruwe context meegegeven, geen
deterministische "ligt op schema"-berekening. Specialist Memory — nog
niet gebouwd (apart ontwerp, `specialist-memory.md`, geen
geïmplementeerde tabel). Master Coach-context — Fase 4 Orchestrator-
integratie is een aparte, latere stap.

**Test-instructies:** zie bericht bij levering.

**Volgende stap (5/5, laatste):** Capability Registry-entry voor Cycling
+ eerste Hub-UI-element.

## v2.4.66 — Fase 2b: Cycling Analysis Engine (Cycling-referentie, stap 3/5)
**Volledig deterministisch, geen AI — precies zoals vastgelegd in
`docs/specialist-engine-architecture.md`. Berekent frequentie, vermogen-
trend, afstand, trainingsbelasting uit de Data Layer-output (v2.4.61).**

- **Nieuw:** `src/lib/specialists/cycling-data.ts` — Data Layer-logica
  geëxtraheerd uit `[type]/data/route.ts` naar een herbruikbare functie
  (`haalCyclingData`), zodat de Analysis Engine dit intern kan aanroepen
  zonder aparte HTTP-roundtrip (zoals vastgelegd in `specialist-api.md`
  Fase 3). `[type]/data/route.ts` is nu een dunne wrapper hieromheen,
  gedrag ongewijzigd.
- **Nieuw:** `src/lib/specialists/cycling-analysis.ts` — de eigenlijke
  Engine. Berekent:
  - **Trainingsfrequentie:** huidige vs. vorige periode (evenlang),
    trend bij ≥15% verschil
  - **Vermogen:** gemiddeld/max watt, trend t.o.v. vorige periode.
    **Eerlijk gevlagd:** `max_watts` is tot nu toe alleen bevestigd
    aanwezig bij Garmin-imports, niet bij Strava — expliciete null-checks
    overal, geen aanname dat het veld altijd bestaat
  - **Afstand:** totaal + gemiddeld per activiteit
  - **Trainingsbelasting:** duur-gebaseerd (bewust géén RPE-weging zoals
    de bestaande `trainingsCoachContext` in `api/coach/route.ts` doet —
    losse `activity_sessions` hebben doorgaans geen RPE, dus dat zou een
    onvolledig beeld geven; hier puur transparant duur-gebaseerd)
  - **Output-vorm:** volgt het `EngineResult`-patroon uit
    `specialist-engine-architecture.md` — `resultaat` + `reden[]`
    (Explainability-verplichting) + `databronnen[]` + `gegenereerd_op`,
    plus `engine_version`/`algorithm_version` (versionering,
    vastgelegd in hetzelfde document)
- **Nieuw:** `src/app/api/specialists/cycling/engine/route.ts` — GET-
  endpoint die de Engine blootgeeft, testbaar zoals de vorige stappen
- `src/app/debug/page.tsx` — testsectie uitgebreid met de Engine-test

**Bewust nog niet meegenomen, zoals vastgelegd in `specialist-api.md`:**
FTP/TSS/CTL — vereist een FTP-referentiewaarde die nergens bevestigd
aanwezig is. `herstel_indicatie` uit het architectuurdocument-voorbeeld
is bewust weggelaten — dat vermengt Recovery-domein (Master Coach) met
Cycling-domein, in strijd met de scheiding uit
`specialist-decision-engine.md`.

**Test-instructies:** zie bericht bij levering.

**Volgende stap (4/5):** Coach Layer (AI) — de eerste daadwerkelijke
AI-call in de specialistlaag, met `coach-personality.ts` hergebruikt.

## v2.4.65 — Specialistlaag-tests verplaatst naar bestaande /debug-pagina
**Gebruiker stelde terecht de vraag: kon dit niet in de app zelf? Ja —
en dat is een betere oplossing dan de losse `/debug/specialists`-pagina
die deze sessie twee losse problemen had (geen scroll, v2.4.36-patroon
gemist; en een nooit-volledig-verklaarde paginaherlaad tijdens
navigatie). De bestaande `/debug`-pagina gebruikt al `AppShell`
(werkende scroll) en wordt al bereikt via normale, al-ingelogde
app-navigatie — geen van beide problemen is daar van toepassing.**

- `src/app/debug/page.tsx` — nieuwe sectie **"Specialistlaag — Fase 1 +
  2a"** toegevoegd: dezelfde activeer/deactiveer-knoppen en Data
  Layer-test die op de losse pagina stonden, nu hier ingebed
- **Bijkomstige bug gevonden en gefixt:** `specialist_profiles` en
  `specialist_analyses` (SQL v2.4.59) ontbraken in `ALLE_TABELLEN` — de
  algemene diagnostiek testte deze twee nieuwe tabellen dus nooit mee.
  Toegevoegd.
- `/api/specialists` toegevoegd aan `KERN_ROUTES_GET` — wordt nu ook
  meegenomen in de "Start diagnostiek"-algehele-health-check
- **Verwijderd** (handmatig te verwijderen in Working Copy):
  `src/app/debug/specialists/page.tsx` — overbodig, en de bron van de
  twee problemen hierboven
- `next.config.js` — `skipWaiting` teruggezet naar `false` (van
  volledig `disable: true` in v2.4.63). Nu we terugvallen op een
  bestaande, al-werkende pagina zonder navigatie-gevoelige flow, is
  volledige uitschakeling waarschijnlijk niet meer nodig. **Als het
  reset-probleem hier ook optreedt, is dat een sterk signaal dat de
  service worker alsnog (mede)oorzaak was — meld dat direct.**

## v2.4.64 — Testpagina herbouwd: ingebouwd inlogformulier, geen navigatie
**Gebruiker meldde dat het reset-probleem óók optrad met de service
worker volledig uit (v2.4.63) — dus de service worker was waarschijnlijk
niet (de enige) oorzaak. Nieuwe hypothese: het probleem hangt samen met
de paginanavigatie zelf (van /login naar /debug/specialists), niet met
een achtergrondmechanisme. Test hiervoor gebouwd, geen definitieve
conclusie getrokken zonder bevestiging.**

- `src/app/debug/specialists/page.tsx` — volledig herbouwd met een
  **ingebouwd inlogformulier** (`browserClient.auth.signInWithPassword`)
  direct op dezelfde pagina. **Nooit meer `router.push('/login')`** — in-
  en uitloggen en alle Fase 1/2a-tests gebeuren nu op exact één pagina,
  zonder enige client-side route-wissel.
- **Doel:** isoleren of het probleem specifiek aan navigatie gekoppeld
  is. Als dit stabiel blijft waar de oude versie (met navigatie naar
  /login) niet stabiel bleef, bevestigt dat de hypothese. Zo niet, dan
  ligt de oorzaak elders en moet verder gezocht worden.

## v2.4.63 — Service worker TIJDELIJK volledig uitgeschakeld
**v2.4.62 (`skipWaiting: false`) loste het probleem niet volledig op —
gebruiker meldde nog steeds "even blijft staan, dan springt terug",
resterende service-worker-interferentie. Ik kon de daadwerkelijk
gedraaide, live service worker niet inspecteren (geen tool-toegang tot
het Vercel-domein, alleen naar bijv. GitHub) — in plaats van verder te
gokken naar de exacte resterende oorzaak: de service worker staat nu
volledig uit.**

- `next.config.js` — `disable: true` toegevoegd aan de `next-pwa`-config
- **Gevolg:** geen enkele service-worker-registratie meer, dus ook geen
  enkele mogelijkheid tot een onverwachte automatische paginaherlaad
  vanuit dat mechanisme — dit zou het probleem definitief moeten
  wegnemen, ongeacht de exacte resterende oorzaak binnen de SW zelf
- **Bijwerking:** dit schakelt ook PWA-offline-functionaliteit uit
  (geen app-installatie-prompt, geen offline-toegang) — geaccepteerd
  compromis tijdens de specialistlaag-testfase, niet bedoeld als
  permanente staat
- **Volgende stap, expliciet vastgelegd:** zodra alle 5
  implementatiestappen van de Cycling-referentie-specialist getest en
  stabiel zijn, `disable: true` weer verwijderen/terugzetten naar
  `false` — PWA-functionaliteit is nodig voor productiegebruik

## v2.4.62 — Fix: pagina reset zichzelf willekeurig (service-worker-config)
**Gemeld tijdens het testen van de Fase 2a Data Layer (v2.4.61) —
`/debug/specialists` "sprong terug" naar een initiële laadstatus,
schijnbaar willekeurig. Root cause gevonden, niet aangenomen.**

- `next.config.js` — `skipWaiting: true` → `skipWaiting: false`
- **Root cause:** `skipWaiting: true` laat een nieuwe service-worker-
  versie **onmiddellijk** overnemen zodra hij beschikbaar is — ook
  midden in een actieve sessie, ook potentieel bij een gewone
  paginalading zonder dat er per se net een nieuwe deploy was. Dit
  triggert doorgaans een geforceerde paginaherlaad, wat zich voordeed
  als "de hele pagina reset zichzelf naar de initiële staat" —
  reproduceerbaar bevestigd via screenshots (Fase 1 én Fase 2a beide
  terug naar "Laden.../nog niets opgehaald" op hetzelfde tijdstip).
- **Fix:** `skipWaiting: false` laat een nieuwe service-worker-versie
  netjes wachten totdat alle open tabbladen/instanties van de oude
  versie gesloten zijn, vóórdat hij overneemt — geen onderbreking meer
  van een actieve sessie.
- **Reikwijdte:** dit is een bestaand configuratiebestand, niet iets
  wat vandaag is geïntroduceerd — de fix raakt de **hele app**, niet
  alleen de nieuwe specialist-testpagina's.

## v2.4.61 — Fase 2a: Data Layer (Cycling-referentie, stap 2/5)
**Puur verzamelen/filteren — geen berekening, geen AI, geen
interpretatie. De Cycling Analysis Engine (Fase 2b, volgende stap) rekent
met deze ruwe output.**

- **Nieuw:** `src/app/api/specialists/[type]/data/route.ts`
  - `GET /api/specialists/cycling/data?period_days=30` — combineert twee
    bestaande bronnen: `activity_sessions` (Strava/Garmin-ritten,
    gefilterd via gekoppelde `activities.name`) en `training_results`
    (AI-gecoachte cycling-trainingen, `training_type='cycling'`)
  - `period_days` optioneel via query-param, standaard 30
  - Andere `[type]`-waarden dan `cycling` geven bewust een `501 Not
    Implemented` — geen stille lege response die verwarring zou geven
  - **Eerlijk gevlagd:** de lijst cycling-gerelateerde activity-namen
    (`Fietsen`, `Fietsen (buiten)`, `Indoor Fietsen`) is gebaseerd op wat
    deze sessie is gezien, mogelijk niet uitputtend
- `src/app/debug/specialists/page.tsx` — testsectie toegevoegd voor deze
  route, naast de bestaande Fase 1-tests

**Test-instructies:** zie bericht bij levering.

**Volgende stap (3/5):** Cycling Analysis Engine (Fase 2b) — sport-
specifieke berekeningen op deze ruwe data (frequentie, vermogen-trend,
trainingsbelasting). FTP/TSS/CTL blijven uitgeschakeld totdat een
FTP-referentiewaarde-bron is bevestigd (zie `specialist-api.md`).

## v2.4.60 — Fase 1: Specialist Registry (Cycling-referentie-implementatie, stap 1/5)
**Eerste code na de ontwerpstop (6 architectuurdocumenten, zie
`docs/specialist-*.md`). Cycling gekozen als referentie-specialist.
Deze stap: alleen Fase 1 (Identity Layer/Registry) — geen AI, geen
berekeningen, puur activatie-beheer.**

- **Nieuw:** `src/app/api/specialists/route.ts`
  - `GET` — lijst specialisten voor de gebruiker (actief/beschikbaar/
    in-ontwikkeling), combineert vaste code-config met
    `specialist_profiles` (SQL v2.4.59)
  - `POST` — activeer/deactiveer, body `{ specialist_type, active }`,
    upsert naar `specialist_profiles`
  - **Vaste config:** alleen `cycling` heeft status `active` — overige
    specialisten (`running`, `rowing`, `strength`) staan op
    `development`, bewust niet activeerbaar totdat ze daadwerkelijk
    gebouwd zijn (geen overclaiming van functionaliteit die nog niet
    bestaat)
- **Nieuw, tijdelijk:** `src/app/debug/specialists/page.tsx` — testscherm
  om Fase 1 te kunnen testen zonder curl/Postman, direct op de telefoon.
  **Geen onderdeel van de uiteindelijke architectuur** — wordt vervangen
  zodra de echte Hub-UI gebouwd wordt (zie
  `specialist-engine-architecture.md`, Hub-modules-sectie).

**Test-instructies:** zie bericht bij levering.

**Volgende stap (2/5):** Data Layer (Fase 2a) —
`/api/specialists/cycling/data`, ruwe data verzamelen uit
`activity_sessions`/`training_results`, nog geen berekeningen.

## v2.4.59 — SQL: specialist_profiles + specialist_analyses
**Eerste daadwerkelijke code van het specialistlaag-traject — exact de
twee tabellen die in `docs/specialist-database-design.md` zijn besloten,
niets extra's. Nog geen API-routes, nog geen UI (volgende stappen).**

- **Nieuw:** `supabase/specialist_layer.sql`
  - `specialist_profiles` — identity/activatie-laag. `user_id`,
    `specialist_type`, `active`, `activated_at`, `preferences` (JSONB).
    **Geen `goals`-veld** — doelen leven in de bestaande `user_goals`,
    zoals besloten. Unieke constraint op `(user_id, specialist_type)` —
    voorkomt duplicaten bij dubbel activeren. `updated_at` automatisch
    bijgewerkt via trigger.
  - `specialist_analyses` — analyse-laag, bewust **losstaand** van
    `progress_analyses` (onderbouwing: zie changelog-entry
    "Specialist Coach Platform" hierboven, en §4.5 van
    `specialist-database-design.md`). `user_id`, `specialist_type`,
    `period_days`, `analysis` (JSONB, vrije vorm), `generated_at`.
  - RLS ingeschakeld op beide tabellen, standaard Supabase-patroon
    (`auth.uid() = user_id`). **Aanname, niet geverifieerd tegen
    bestaande RLS-policies elders in dit project** — routes gebruiken tot
    nu toe vrijwel overal `createAdminClient()` (service-role, omzeilt
    RLS toch al), dus dit is vooral een vangnet. Pas aan indien dit
    project een ander RLS-patroon hanteert.
  - **Geen wijzigingen aan bestaande tabellen** — `activity_sessions`,
    `training_results`, `exercise_records`, `coach_calls`,
    `progress_analyses`, `user_goals` blijven allemaal ongewijzigd,
    exact zoals in het goedgekeurde ontwerp vastgelegd.

**Volgende stap (nog niet gestart):** API-ontwerp (Orchestrator-route,
specialist-activatie-endpoint), daarna pas UI ("Mijn Coaches"-sectie).

## [docs] Specialist Coach Platform — architectuur + database-ontwerp
**Geen versie-ophoging — puur documentatie, geen code/SQL gewijzigd.**

- **Nieuw:** `docs/specialist-coaches.md` — architectuur voor een
  uitbreiding van CoachOS naar een platform met gespecialiseerde coaches
  (Cycling, Running, Rowing, Strength, ...) onder één Master Coach.
  Kernprincipe: specialisten adviseren, Master Coach beslist. Bevat
  rollen, data-driven activatiemodel (3-in-30-dagen-drempel + "opkomend
  patroon"-signaal, gebruiker beslist altijd zelf over activatie),
  Hub-structuur (geen nieuwe bottom-nav, aparte routes binnen Coach),
  kostenbewuste AI-routing (niet elke dagelijkse call raadpleegt alle
  actieve specialisten).
- **Nieuw:** `docs/specialist-database-design.md` — impactanalyse vóór
  enige SQL geschreven wordt. Conclusie: bestaand fundament
  (`activity_sessions`, `training_results`, `exercise_records`,
  `coach_calls`, `user_goals`) is grotendeels herbruikbaar. Slechts **2
  nieuwe tabellen** nodig (`specialist_profiles`, `specialist_analyses`),
  **0 wijzigingen** aan bestaande tabellen. Elke keuze onderbouwd met
  daadwerkelijk opgehaalde code (`api/progress-analysis/route.ts`,
  `api/goals/route.ts`) — niet op aanname, na een expliciete correctie
  onderweg toen een eerste "voeg een kolom toe aan progress_analyses"-
  aanname bij nader onderzoek risicovol bleek (vaste JSONB-vorm,
  ongefilterde cache-/ophaal-logica).
- `README.md` — nieuwe sectie "Specialist Coach Platform" toegevoegd,
  verwijst naar beide documenten en de huidige status.

**Volgende stap (nog niet gestart):** exacte SQL voor de twee nieuwe
tabellen, daarna API, dan pas UI.

## v2.4.58 — 6 nieuwe illustraties (#22-27) + alle 24 bestaande retroactief gecomprimeerd
**Ontdekking: de 100-300 KB-richtlijn uit de Illustratie Workflow-sectie is
nooit daadwerkelijk gehaald, ook niet bij eerdere illustraties — alle 24
al-gekoppelde bestanden (18 "PNG", 6 "WebP") bleken in werkelijkheid
allemaal ~0,8-1,3 MB, ongeacht bestandsextensie. Bevestigd door de
bestanden rechtstreeks van GitHub op te halen en te meten, niet aangenomen.**

**6 nieuwe illustraties gekoppeld:**
- Forward Lunge (#22), Walking Lunge (#23), Lateral Lunge (#24),
  Cossack Squat (#25), Thruster (#26), Push Press (#27)
- **Totaal nu 30/102 kettlebell-oefeningen met illustratie.**

**Alle 24 bestaande illustraties retroactief gecomprimeerd:**
- Opgehaald van GitHub (commit `0b8f5a9`), geconverteerd met PIL/Pillow
  (quality=85, method=6), teruggezet als `.webp`.
- **Totale reductie: 23,5 MB → 1,5 MB (94%)** voor de 24 bestaande, plus
  de 6 nieuwe (~450 KB samen) — **totaal pakket nu ~2,0 MB voor 30
  illustraties**, was ~29,5 MB.
- **18 bestanden die eerder `.png` waren, zijn nu `.webp`** —
  `kettlebell-exercises.ts` is bijgewerkt: alle `illustratie`-velden
  wijzen nu naar `.webp`, geen `.png`-referenties meer over.
- Visueel gecontroleerd (2 steekproeven, waaronder een voormalig PNG-
  bestand): geen zichtbaar kwaliteitsverlies bij quality=85.

**Belangrijke correctie op de eerdere v2.4.57-aanname:** bestandsgrootte
was **geen** technisch blokkerend probleem voor GitHub/Vercel (beide
kunnen dit probleemloos aan) — puur een laadtijd-optimalisatie voor
eindgebruikers op mobiel. De gebruiker had gelijk dat dit niet per se
nodig was om te "werken", maar koos ervoor het alsnog te doen zodra
bleek dat de bestaande richtlijn nooit werd gehaald.

**Bijwerking nodig in Working Copy:** de oude `.png`-bestanden
(kettlebell-deadlift.png, sumo-deadlift.png, etc.) blijven ongebruikt in
de repo staan — kunnen op een gewenst moment handmatig verwijderd worden,
niet urgent (geen functionele impact, alleen overbodige opslag).

## v2.4.57 — Gewicht nu ook live bijstelbaar tijdens de actieve set (Archief)
**Gemist bij v2.4.56: tempo werd toen wel live bijstelbaar gemaakt tijdens
de actieve set, gewicht bleef alleen statische tekst (`· 16kg`) — een
inconsistentie die de gebruiker meteen opmerkte.**

- `src/app/archief/oefening/[id]/page.tsx` — gewicht-keuzeknoppen
  (6, 14-32kg) toegevoegd aan de actieve set, direct boven de al
  bestaande tempo-knoppen. Zelfde patroon als in het instelscherm.
- Geen aanpassing aan de timer nodig bij een gewichtswijziging (in
  tegenstelling tot tempo, dat de resterende tijd herberekent) — gewicht
  heeft geen invloed op de duur van een set.

## v2.4.56 — Tempo-keuze (Slow/Normaal/Fast) nu ook in Archief
**Laatste stap van de gewicht/tempo-consistentie tussen Trainer AI/
Bibliotheek en Archief. Archief had al gewicht (v2.4.49), tempo ontbrak
nog volledig — vaste 3 sec/rep, niet instelbaar.**

- `src/app/archief/oefening/[id]/page.tsx` — nieuw tempo-systeem, zelfde
  concept als Trainer AI/Bibliotheek (`localStorage`-voorkeur per
  oefeningnaam, 4/3/2 sec-per-rep voor slow/normal/fast). **Geen
  advies-vergelijking** — Archief heeft geen coach-schema om van af te
  wijken, dus dat deel (v2.4.52/53) is hier niet van toepassing, puur een
  persoonlijke instelling.
- Tempo-knoppen op **twee plekken**, consistent met hoe gewicht/tempo in
  Trainer AI werken sinds v2.4.54:
  - **Instelscherm** (vóór starten): tempo instelbaar, naast de
    bestaande gewicht-knoppen — alleen zichtbaar bij rep-gebaseerde
    oefeningen.
  - **Actieve set**: tempo live bijstelbaar, past de resterende tijd
    direct aan (`phase_end_at` herberekend op basis van het nieuwe tempo).
- Bij opslaan wordt het gebruikte tempo meegestuurd (`segment.tempo`) —
  komt via de al bestaande `training/complete/route.ts`-logica (v2.4.53)
  terecht in `exercise_records.tempo`, zonder dat dat bestand aangepast
  hoefde te worden (de fallback las al `seg.tempo` als er geen
  `actual_tempo` aanwezig was).

**Resultaat: Trainer AI/Bibliotheek en Archief bieden nu identieke
gewicht- en tempo-functionaliteit**, met als enige verschil dat Trainer
AI een coach-advies als startpunt heeft (en de coach ziet afwijkingen),
terwijl Archief een pure, geheugen-gebaseerde persoonlijke voorkeur
gebruikt (geen advies om van af te wijken).

## v2.4.55 — NIEUW: "Ververs schema"-knop — doorbreekt dubbele cache
**Directe aanleiding: gebruiker zag geen gewicht/tempo-knoppen (v2.4.51/54)
bij een Kettlebell-schema dat die dag al eerder was geopend. Root cause:
twee losse caches, beide op datum, allebei ongevoelig voor nieuwe
code-deploys diezelfde dag.**

- **Server-side cache** (`coach_recommendations`-tabel, `training/today/
  route.ts`): gaf bij elke aanvraag dezelfde dag altijd de eerder
  gegenereerde versie terug, zelfs na een nieuwe deploy met nieuwe velden.
- **Client-side cache** (`localStorage`, `session/[module]/page.tsx`):
  checkte zelfs vóórdat de server ooit benaderd werd — dus zelfs een
  server-side fix zou nooit zichtbaar worden zonder deze ook te doorbreken.

**Fix:**
- `src/app/api/training/today/route.ts` — nieuwe `force: true`-optie in
  de POST-body omzeilt de server-side cache-check volledig.
- `src/app/training/session/[module]/page.tsx` — nieuwe **ververs-knop**
  (rond-pijltjes-icoon) naast de titel op het schema-overzichtsscherm.
  Wist bij een tik zowel de relevante `localStorage`-sleutels als de
  server-cache (via `force: true`), haalt een écht vers schema op, en
  herbouwt de sessie daarmee.
- Werkt voor zowel Trainingsbibliotheek-schema's (`training_lib_*`-sleutels)
  als het normale coach-gegenereerde dagschema (`training_instructie_data`).

**Nuttig, niet alleen voor dit specifieke geval:** dit soort dubbele
cache-problemen kan bij elke toekomstige schema-gerelateerde codewijziging
opnieuw optreden — de knop is een permanente uitweg, niet een eenmalige
patch.

## v2.4.54 — Gewicht + tempo nu ook instelbaar in het trainingsoverzicht
**Besluit (overleg): gewicht is een eenmalige, vooraf-te-bepalen keuze per
oefening (hoort in het overzicht) — tempo is bedoeld om ook TIJDENS het
sporten bij te stellen (blijft daarom op beide plekken: overzicht én
actieve set).**

- `src/app/training/session/[module]/page.tsx` (`SchemaLayer`, het scherm
  vóór "Training Starten") — elke kettlebell-oefening met coach-advies
  toont nu compacte gewicht- (6 knoppen, 14-32kg) en tempo-knoppen
  (Slow/Normaal/Fast), voorgeselecteerd op het advies, aanpasbaar vóór je
  start.
- Bij "Training Starten" worden deze keuzes vastgelegd in
  `session.gebruikt_gewicht`/`gebruikt_tempo` (per segment-index) — het
  originele advies in het schema zelf blijft ongewijzigd, nodig voor de
  advies-vs-gebruikt-vergelijking die de coach ziet (v2.4.52/53).
- De bestaande per-segment-initialisatie (v2.4.51) ziet deze waarden dan
  al ingevuld staan en overschrijft ze niet opnieuw met het kale advies —
  de overzicht-keuze blijft dus behouden tot in de actieve set.
- **Consistentie-bug gevonden en gefixt tijdens het bouwen:** de tempo-
  knop-highlight in de actieve set las nog steeds alleen het ruwe advies
  (`seg.target_tempo`), niet een eventuele overzicht-aanpassing — de
  highlight zou dus de verkeerde knop hebben getoond ondanks dat de
  juiste waarde intern al correct was vastgelegd. Nu leest de highlight
  eerst `session.gebruikt_tempo`, dan pas het advies.

## v2.4.53 — Tempo-afwijking nu ook zichtbaar voor de coach (naast gewicht)

**⚠️ VEREIST VÓÓR DEPLOY — nieuwe kolommen in Supabase SQL Editor:**
```sql
alter table exercise_records add column tempo text;
alter table exercise_records add column advised_tempo text;
```

**Bonus-fix, ontdekt tijdens het bouwen:** het generieke `tempo`-veld dat
v2.4.50 al meestuurde voor rep-gebaseerde niet-kettlebell-oefeningen
(bodyweight/strength) werd tot nu toe **nergens opgeslagen** —
`training/complete/route.ts` las dat veld nooit uit bij het samenstellen
van `exercise_records`. Sinds deze versie wordt het wél vastgelegd (in de
nieuwe `tempo`-kolom), voor alle rep-gebaseerde oefeningen, niet alleen
kettlebell.

**Wijzigingen, exact hetzelfde patroon als v2.4.52 (gewicht):**
- `src/app/api/training/complete/route.ts` — `exercise_records`-insert
  slaat nu ook `tempo` (gebruikt) en `advised_tempo` (coach-advies, alleen
  bij kettlebell) op.
- `src/app/api/coach/route.ts` — progressie-analyse uitgebreid: als het
  laatst geadviseerde tempo afwijkt van het laatst gebruikte, wordt dat
  vermeld: `[tempo-advies: normal, gebruiker deed: slow]`, met een eigen
  instructie aan de coach (niet elke afwijking is een probleem — een
  bewust langzamer tempo bij een explosieve oefening kan juist positief
  zijn; een sneller tempo bij een gecontroleerde oefening kan op haast/
  vermoeidheid wijzen).

**Resultaat:** de coach ziet nu zowel gewicht- als tempo-afwijkingen bij
kettlebell-training, en tempo-tracking voor alle rep-oefeningen in het
algemeen (niet eerder het geval, ook niet vóór v2.4.51).

## v2.4.52 — Fix: gewicht-advies-bug + coach geeft nu commentaar op afwijking

**⚠️ VEREIST VÓÓR DEPLOY — nieuwe kolom in Supabase SQL Editor:**
```sql
alter table exercise_records add column advised_weight_kg integer;
```
Zonder deze kolom faalt de `exercise_records`-insert bij elke kettlebell-
training (poging tot schrijven naar een niet-bestaande kolom).

**Gevonden bug (bij het bouwen van deze koppeling, vóór uitlevering):**
in v2.4.51 werd `actual_weight_kg` als NIEUW veld toegevoegd náást het
bestaande `weight_kg`-veld op een segment — maar `exercise_records` (de
tabel die de progressie-trends van de coach voedt) las nog steeds het
oorspronkelijke `weight_kg` (= altijd het coach-ADVIES), nooit het
daadwerkelijk gebruikte gewicht. Bij elke afwijking van het advies zou de
progressie-tracking dus het verkeerde getal hebben vastgelegd.

**Fixes en uitbreiding:**
- `src/app/api/training/complete/route.ts` — `exercise_records`-insert
  gebruikt nu `seg.actual_weight_kg` (met terugval op `seg.weight_kg` voor
  niet-kettlebell-segmenten, ongewijzigd gedrag daar). Nieuwe kolom
  `advised_weight_kg` wordt apart opgeslagen.
- `src/app/api/coach/route.ts` — de bestaande progressie-analyse
  (`exercise_records` → trend per oefening) leest nu ook
  `advised_weight_kg`. Als het laatst geadviseerde gewicht afwijkt van het
  laatst gebruikte, wordt dat expliciet in de prompt vermeld:
  `[Trainer AI adviseerde Xkg, gebruiker deed Ykg]`, met een instructie aan
  de coach om dit kort en niet-veroordelend te kunnen benoemen — alleen
  bij een daadwerkelijke afwijking, geen ruis bij een exacte match.
- Tempo wordt in deze stap **niet** meegenomen in de coach-vergelijking —
  `exercise_records` heeft geen tempo-kolom, en dat zou een aparte
  schema-uitbreiding vergen. Bewust uitgesteld; kan later alsnog als
  gewenst.

## v2.4.51 — NIEUW: Coach adviseert kettlebell-gewicht + tempo, gebruiker kan afwijken
**Bevestigd via `training/today/route.ts`: kettlebell-segmenten bevatten
géén gewicht- of tempo-informatie, niet in de AI-prompt-instructie, niet
in de fallback-data. Volledig gat, geen aanname.**

**Besluit (overleg met gebruiker):** de coach geeft een advies (gewicht +
tempo), de gebruiker kan er tijdens de training van afwijken via
dezelfde soort keuzeknoppen, en bij opslaan gaat zowel het advies als de
daadwerkelijk gebruikte waarde naar de coach — zodat die bij een
volgende sessie kan reageren op eventuele afwijking. **Alleen van
toepassing op kettlebell** (rowing/running/cycling hebben al eigen
doelwaarden zoals `target_pace`/`target_power_w`).

**`src/app/api/training/today/route.ts`:**
- Prompt-instructie voor KETTLEBELL uitgebreid: elk segment krijgt nu ook
  `weight_kg` (advies, uit 14/16/20/24/28/32) en `target_tempo`
  (advies: `slow`/`normal`/`fast`, gebaseerd op het type beweging —
  explosief zoals swings = fast, gecontroleerd zoals squats = normal/slow).
- `kettlebellFallback`-segmenten kregen dezelfde velden, zodat een
  mislukte AI-call ook advies bevat.

**`src/app/training/session/[module]/page.tsx`:**
- `DisplaySegment` uitgebreid met `weight_kg`/`target_tempo` (advies,
  uitgelezen in `asDisplay()`).
- `ExtendedSessionState` uitgebreid met `gebruikt_gewicht`/`gebruikt_tempo`
  (`Record<number, ...>`, per segment-index) — legt de daadwerkelijk
  gebruikte waarde vast, apart van het advies.
- Nieuw `useEffect`: initialiseert deze op het coach-advies zodra een
  kettlebell-segment voor het eerst actief wordt (dus ook als de
  gebruiker nooit een knop aanraakt, staat het advies alsnog als
  "gebruikte waarde" vast — correct, want dan volgde hij het advies).
- Nieuwe gewicht-keuzeknoppen (6, 14-32kg) in `WorkoutEngine`'s actief-
  scherm, alleen zichtbaar bij kettlebell mét advies. Bestaande tempo-
  knoppen hergebruikt, nu ook gekoppeld aan `gebruikt_tempo` voor
  kettlebell (naast de bestaande localStorage-koppeling die voor alle
  rep-oefeningen blijft werken).
- `handleSave`: voor kettlebell-segmenten worden nu **vier** velden
  meegestuurd — `advised_weight_kg`, `advised_tempo`, `actual_weight_kg`,
  `actual_tempo` — in plaats van alleen het generieke `tempo`-veld dat
  v2.4.50 voor andere rep-oefeningen toevoegde.

**Geen wijziging in Archief** — die heeft geen coach-gegenereerd advies
om van af te wijken (gebruiker kiest daar zelf, buiten de coach om), dus
het "advies vs. afwijking"-concept is daar niet van toepassing.

## v2.4.50 — Tempo (Slow/Normaal/Fast) nu zichtbaar voor de coach
**Correctie op eerste poging: ik nam eerst ten onrechte aan dat Archief
ook een tempo-concept had (met een `getTempo()`-aanroep die daar niet
bestaat) — teruggedraaid vóór uitlevering. Tempo bestaat uitsluitend bij
Trainer AI/Bibliotheek.**

- `src/app/training/session/[module]/page.tsx` (`handleSave`) — elk
  rep-gebaseerd segment (reps gezet, geen vaste `duration_sec`) krijgt nu
  een `tempo`-veld (`slow`/`normal`/`fast`) toegevoegd vóór het opslaan
  naar `/api/training/complete`.
- **Root cause van het gemis:** het tempo werd al sinds de invoering van
  de Slow/Normaal/Fast-knoppen alleen lokaal opgeslagen (`localStorage`,
  puur voor timer-kalibratie) — nooit meegestuurd in de opslag-payload,
  dus nooit zichtbaar voor Coach AI bij de evaluatie.
- Segmenten zonder reps (tijd-gebaseerd) of zonder herkenbare
  oefeningnaam blijven ongewijzigd — tempo is daar begripsmatig niet van
  toepassing.
- **Geen wijziging in Archief** — die heeft geen tempo-concept.

## v2.4.49 — Kettlebell-gewichten uitgebreid: 14-16-20 → 14-16-20-24-28-32
- `src/app/archief/oefening/[id]/page.tsx` — `KETTLEBELL_GEWICHTEN`
  uitgebreid van `[14, 16, 20]` naar `[14, 16, 20, 24, 28, 32]`. Deze
  uitbreiding stond al voorbereid als uitgecommentarieerde regel sinds
  het begin van de sessie — nu geactiveerd.
- Weergave omgezet van een enkele flex-rij naar een **3-koloms grid**
  (2 rijen van 3 knoppen) — met 6 gewichten zou een enkele rij te smalle
  knoppen hebben gegeven op een telefoonscherm.
- Alleen Archief heeft een gewichtselectie — Trainer AI/Bibliotheek
  (`training/session/[module]/page.tsx`) heeft geen vergelijkbare UI,
  daar hoefde dus niets aangepast te worden.

## v2.4.48 — Fix: Slow/Normaal/Fast-tempoknoppen leken niet te reageren
- `src/app/training/session/[module]/page.tsx` (`WorkoutEngine`) —
  tempo-knop-`onClick` werkt lokale `currentTempo`-state nu direct bij,
  naast de bestaande `onTempoChange()`-aanroep naar de ouder.
- **Root cause:** de gekozen tempo werd wél correct opgeslagen
  (`localStorage` via `setTempo()`) en de timer werd wél correct
  aangepast (`phase_end_at` in de ouder-component) — maar de visuele
  highlight van welke knop actief is (`currentTempo`) ververste alleen via
  een `useEffect` die op `seg.exercise` reageert. Omdat het tikken op een
  andere tempo-knop de oefening zelf niet verandert, vuurde die `useEffect`
  niet af, en bleef de knop-highlight op de oude waarde staan — het leek
  daardoor alsof de knoppen niet reageerden, terwijl de onderliggende
  functionaliteit wél werkte.
- Gemeld door gebruiker: "Ik kan ze niet veranderen" — bevestigt het
  visuele, niet-functionele karakter van dit probleem.

## v2.4.47 — Build-fix: SessionStatus-type-fout in Finish Tone-effect
- `src/app/training/session/[module]/page.tsx` — build-fout: *"This
  comparison appears to be unintentional because the types 'SessionStatus'
  and '\"voltooid\"' have no overlap"*.
- **Root cause:** `'voltooid'` zit niet in de officiële `SessionStatus`-
  type-definitie (`@/types/training-engine`) — de rest van het bestand
  gebruikt hiervoor consequent een expliciete cast
  (`(session.status as string) === 'voltooid'`, zie bestaande code rond
  regel 1303), maar dat patroon was niet toegepast in het nieuwe
  Finish Tone-effect (v2.4.46).
- Fix: `vorigeStatusRef` getypeerd als `string | null` in plaats van
  `SessionStatus | null`, en `session.status` gecast naar `string` vóór
  vergelijking — consistent met de bestaande stijl in dit bestand.
  Functioneel geen wijziging.

## v2.4.46 — Professionele soundset (Polar/Garmin/Concept2-stijl) + nieuwe Finish Tone
**Herontwerp op basis van gedetailleerde gebruikersspecificatie — geen
schelle piepjes (irritant bij 30-60 min training), maar korte, relatief
hoge tonen (~1-2 kHz) die door achtergrondmuziek heen blijven snijden.**

**Belangrijke, niet-technisch-oplosbare kanttekening:** een website/PWA
heeft geen toegang tot het systeem-audiokanaal van iOS en kan dus het
volume van andere apps (Spotify, Apple Music) niet dempen ("ducking") —
een bewuste iOS-beperking, niet iets wat met code te omzeilen is. De
enige hefboom is dat onze eigen tonen duidelijk genoeg zijn.

- `src/lib/workout-sound.ts` — volledig herontworpen:
  - **Start Tone:** was één toon, nu een dubbele oplopende toon ("DI-DIT",
    ±180ms) — energiek zonder agressief.
  - **Tick:** frequentie verhoogd (880Hz → 1568Hz) voor beter doorsnijden
    door muziek, blijft kort/droog, geen oplopend volume over de 3 tikken.
  - **Rest Tone** (hernoemd vanuit "Eindsignaal", zelfde functienaam
    `speelEindsignaal` behouden voor compatibiliteit): één zachte
    bevestigingstoon i.p.v. een simpele lage toon.
  - **Finish Tone (NIEUW):** `speelFinishToon()` — twee rustige oplopende
    tonen ("DI—DING"), specifiek voor het einde van de VOLLEDIGE training,
    niet per set/oefening. Bestond nog niet — er was voorheen geen enkel
    geluid bij volledige trainingsafronding.
  - Basisvolume verhoogd (0.15 → 0.28) voor betere hoorbaarheid naast
    zachte achtergrondmuziek, met behoud van de zachte in/uit-fade
    (voorkomt een schel/hard karakter).
- `src/app/training/session/[module]/page.tsx` — nieuw `useEffect` dat
  `session.status` volgt en `speelFinishToon()` afspeelt bij de overgang
  naar `'voltooid'`. Apart van het bestaande fase-luister-effect (v2.4.45),
  omdat `workout_phase` zelf niet verandert op het moment dat de volledige
  training als voltooid wordt gemarkeerd — alleen `status` doet dat.
- `src/app/archief/oefening/[id]/page.tsx` — volledige geluidskoppeling
  toegevoegd (was nog nooit definitief uitgeleverd voor dit bestand — een
  eerdere poging werd halverwege gestopt op verzoek). Inclusief tick-
  effect voor de laatste 3 sec van countdown/rust, en `speelFinishToon()`
  bij de laatste set in plaats van de gewone Rest Tone.

## v2.4.45 — Fix: eindsignaal ontbrak bij Trainer AI/Bibliotheek (actief → rust)
**Gemeld: bij Archief werkte het eindsignaal (lage toon bij einde set)
correct, bij Trainer AI/Bibliotheek niet — starttoon en tick werkten daar
wel.**

- `src/app/training/session/[module]/page.tsx` — `speelStarttoon()`/
  `speelEindsignaal()` stonden als directe aanroepen **binnen** de
  `setSession()`-functionele-updater (`advancePhase()`). Dat is geen
  zuivere state-berekening — React state-updaters horen vrij te zijn van
  side effects zoals geluid afspelen, en zo'n aanroep kan in bepaalde
  situaties onbetrouwbaar worden uitgevoerd (bijv. als React de updater
  aanroept voor een berekening die uiteindelijk niet gecommit wordt).
- **Fix:** geluidsaanroepen volledig verwijderd uit `advancePhase()`. In
  plaats daarvan een nieuwe, losse `useEffect` die reageert op de
  daadwerkelijk gecommitte `session.workout_phase`-verandering (bewaart de
  vorige fase in een ref, vergelijkt bij elke wijziging) — exact hetzelfde
  betrouwbare patroon dat het tick-geluid al gebruikte sinds v2.4.34.
- **Bijkomend voordeel:** dit is preciezer in lijn met de architectuurregel
  "geluid luistert alleen naar de timer, bestuurt nooit de workout" — de
  geluidslogica zat voorheen inhoudelijk verweven in de state-berekening
  zelf, nu is het een pure, losstaande "luisteraar".
- Archief (`archief/oefening/[id]/page.tsx`) had dit probleem niet — daar
  stonden de geluidsaanroepen al buiten de `setFase`-aanroepen, in gewone
  functie-body's, niet in een React state-updater.

## v2.4.44 — TCX-bestand nu links en standaard geselecteerd (was Screenshot)
- `src/app/settings/garmin-activity-import/page.tsx` — tabblad-volgorde
  omgedraaid (TCX-bestand links, Screenshot rechts) en de standaard
  geselecteerde methode gewijzigd van `'screenshot'` naar `'tcx'`.
- Reden: gebruiker geeft aan Garmin/TCX vaker te gebruiken dan de
  screenshot-methode — dit bespaart een extra tik bij elke import.

## v2.4.43 — Activiteiten in bottom-nav + Strava-consolidatie (zelfde principe als v2.4.40)
**Vervolg op v2.4.40 (Garmin-consolidatie) — nu Strava's "Synchroniseren"
en "Bekijk activiteiten" ook verplaatst naar `/activities`. Ontdekking
tijdens overleg: `/activities` had geen permanente ingang in de app (geen
bottom-nav-tab) — opgelost door een 6e tab toe te voegen.**

- `src/components/layout/index.tsx` (`BottomNav`) — nieuwe **"Activiteiten"**-
  tab toegevoegd (6e item). De balk is nu horizontaal scrollbaar
  (`overflow-x-auto` i.p.v. `justify-around`, elk item met vaste
  `min-w-[68px]`) zodat 6 tabs niet knijpen op kleinere schermen.
- `src/app/settings/page.tsx` — `StravaSection` sterk vereenvoudigd: toont
  nu alleen de koppelingsstatus (verbonden/niet, "Verbind Strava"). De
  "Activiteiten synchroniseren"- en "Bekijk activiteiten"-knoppen
  (inclusief alle bijbehorende sync-state en -logica) zijn verwijderd —
  verplaatst naar `/activities`. Ongebruikte imports opgeschoond
  (`RefreshCw`, `BarChart2`, `AlertTriangle`, `useRef`, `SyncResult`-type).
- `src/app/activities/page.tsx` — nieuwe **"Synchroniseer Strava"**-knop,
  direct onder de bestaande "Activiteit toevoegen" (Garmin). Bewuste
  volgorde: Garmin bovenaan, want naar verwachting vaker gebruikt dan
  Strava. Sync-logica (inclusief de v2.4.22-timeout- en
  duidelijke-foutafhandeling) hergebruikt, nu hier in plaats van in
  Instellingen.

**Resultaat — alle activiteiten-gerelateerde acties nu op één plek:**
- `/activities` → "Activiteit toevoegen" (Garmin screenshot/TCX)
- `/activities` → "Synchroniseer Strava"
- `/activities` → activiteitenlijst zelf, klikbaar voor detail+route (v2.4.41)
- Instellingen → Strava-kaart: alleen nog koppeling zelf (echte instelling)

## v2.4.42 — TCX-import overschrijft nu i.p.v. te weigeren bij duplicaat
**Directe aanleiding: route-data (v2.4.41) ontbrak bij al eerder
geïmporteerde activiteiten (geüpload vóór die functie bestond). Opnieuw
uploaden werd geblokkeerd door de idempotency-check (v2.4.28) — nu wordt
de bestaande activiteit ververst in plaats van geweigerd.**

- `src/app/api/health/garmin-activity-tcx/route.ts` — bij een duplicaat
  (zelfde TCX-starttijd) wordt de bestaande `activity_sessions`-rij nu
  **overschreven** met de opnieuw geparste `metrics` (inclusief route,
  en eventuele andere velden die sindsdien zijn toegevoegd aan de
  parser) — in plaats van een 409-foutmelding te geven.
- **Bewust GEEN nieuwe Coach Call** bij overschrijven — dat zou een
  mogelijk al-geëvalueerde training opnieuw om RPE/mood vragen, verwarrend
  voor wat feitelijk dezelfde training is. Wel wordt
  `coach_call_items.duration_min` bijgewerkt als de duur is veranderd
  (bijv. door een verbeterde parser), zodat een nog-niet-ingevulde
  evaluatie de juiste duur toont.
- `src/app/settings/garmin-activity-import/page.tsx` — toont nu
  **"Bijgewerkt"** met een duidelijke uitleg in plaats van "Opgeslagen"
  wanneer het om een overschrijving ging, zodat de gebruiker weet dat het
  geen nieuwe activiteit betreft.
- **Praktisch gebruik:** activiteiten die vóór v2.4.41 zijn geïmporteerd
  (dus zonder route) kunnen nu alsnog van een route worden voorzien door
  hetzelfde TCX-bestand simpelweg opnieuw te uploaden — geen handmatige
  database-opschoning nodig.

## v2.4.41 — NIEUW: Route-kaart bij activiteiten (Leaflet + OpenStreetMap)
**Ontdekking: TCX-bestanden bevatten al de volledige GPS-route (lat/lon per
trackpoint) — we gebruikten dat tot nu toe alleen om `has_gps` te bepalen
en gooiden de coördinaten daarna weg. Geen Garmin API nodig, puur gebruik
van data die al binnenkomt.**

**Nieuwe dependency:** `leaflet` (^1.9.4) + `@types/leaflet` (^1.9.12).
Gratis kaarttegels via OpenStreetMap, geen API-key nodig.

**Nieuwe bestanden:**
- `src/components/ActivityRouteMap.tsx` — kaart-component. Puur
  client-side (Leaflet gebruikt `window`, kan niet server-side gerenderd
  worden) — altijd via `next/dynamic` met `ssr: false` laden. Tekent de
  route als lijn, met start/eind-markers, kaart past zich automatisch aan
  op de route (`fitBounds`).
- `src/app/api/activities/[id]/route.ts` — nieuwe route om één activiteit
  op te halen (nodig voor de detailpagina, i.p.v. de hele lijst van max.
  100 activiteiten opnieuw te laden).
- `src/app/activities/[id]/page.tsx` — nieuwe detailpagina: route-kaart
  bovenaan, daaronder alle metrics als stat-blokken (duur, afstand,
  hartslag, calorieën, snelheid, cadans, watts, hoogtemeters).

**Gewijzigde bestanden:**
- `src/lib/tcx-parser.ts` — `TcxParsed` uitgebreid met `route: {lat, lng}[]
  | null`. GPS-coördinaten worden nu verzameld tijdens de bestaande
  trackpoint-loop (geen aparte doorloop) en **gedownsampled naar max ~300
  punten** — ruim voldoende voor een vloeiende lijn op een kaart, houdt de
  opslag klein ongeacht activiteitsduur (getest: 1250 ruwe punten → 250,
  ~12,5KB JSON).
- `src/app/api/health/garmin-activity-tcx/route.ts` — `route` toegevoegd
  aan de opgeslagen `metrics`.
- `src/app/activities/page.tsx` — niet-Strava-activiteitenkaartjes zijn nu
  klikbaar, linken naar de nieuwe detailpagina. Strava-kaartjes
  ongewijzigd (blijven extern linken naar strava.com).

**Bewust niet meegenomen:** screenshot-geïmporteerde activiteiten hebben
geen route (een foto bevat geen GPS-data) — voor die activiteiten toont de
detailpagina een duidelijke melding ("Geen GPS-route beschikbaar") in
plaats van een lege/kapotte kaart.

## v2.4.40 — Consolidatie: één importweg voor losse activiteiten (was 3)
**Gebruiker merkte op dat de "Importeer"-knop op `/activities` een ouder,
apart systeem gebruikte naast de nieuwe Garmin-activiteit-import. Bij
onderzoek bleek dit oude systeem daadwerkelijk kapot te zijn.**

**Gevonden bugs in de verwijderde route (`POST /api/activities`):**
- **Lap-bug:** regex `content.match(/<TotalTimeSeconds>.../)` pakte alleen
  de EERSTE match in het bestand — bij een TCX met meerdere laps (bijna
  elk bestand, zie v2.4.25-onderzoek) werd dus alleen lap 1 gebruikt in
  plaats van het totaal. Een activiteit van 1u44m/54,74km zou hierdoor een
  veel te lage waarde hebben opgeleverd.
- **Geen Coach Call-trigger:** activiteiten via deze route telden nooit
  mee in de herstelberekening — stil, onopgemerkt gemis.
- **Zwakke duplicaatcheck:** alleen op datum + afgeronde duur (geen
  starttijd-ID zoals v2.4.28's fix).
- Zelfde 413-payload-risico dat v2.4.35 al oploste voor de nieuwe route
  (uploadde het volledige bestand naar de server).

**Wijzigingen:**
- `src/app/api/activities/route.ts` — `POST` volledig verwijderd. `GET`
  (activiteitenlijst laden) blijft ongewijzigd.
- `src/app/activities/page.tsx` — de kapotte "Garmin importeren"-upload-
  kaart vervangen door één simpele knop **"Activiteit toevoegen"**, die
  naar `/settings/garmin-activity-import` linkt (de geteste flow met
  screenshot + TCX-keuze, v2.4.23-39). Overbodige state
  (`importing`/`importResult`/`fileInputRef`) en de oude
  `importeerGarmin()`-functie verwijderd.
- `src/app/settings/page.tsx` — de losse "Garmin Activiteit"-kaart
  verwijderd (was dubbelop met de nieuwe knop op `/activities`, beide
  linkten naar dezelfde pagina).

**Resultaat: van 3 knoppen/systemen naar 1.**
- ~~Instellingen → "Garmin Activiteit"~~ (verwijderd, was duplicaat)
- ~~/activities → "Importeer" (.gpx/.tcx upload)~~ (verwijderd, was kapot)
- **/activities → "Activiteit toevoegen"** (nieuw, enige overgebleven weg,
  linkt naar de geteste screenshot+TCX-pagina)

De dagelijkse "Garmin Import" (Body Battery/slaap) in Instellingen blijft
ongewijzigd — dat is een apart, dagelijks terugkerend proces.

**Bekend gat, niet in scope van deze consolidatie:** GPX-ondersteuning
ging verloren met de verwijderde route (de nieuwe flow ondersteunt alleen
TCX). Kan bij gelegenheid apart toegevoegd worden aan de nieuwe flow als
gewenst.

## v2.4.39 — Snelheid, cadans en watts nu ook zichtbaar op Activiteiten-kaartjes
- `src/app/activities/page.tsx` — drie nieuwe metric-blokken toegevoegd
  aan elk activiteitenkaartje (naast de bestaande Duur/Afstand/Hartslag/
  Calorieën/Hoogte): **Snelheid**, **Cadans**, **Watts** — elk met de
  max-waarde als subtekst indien beschikbaar.
- Werkt voor zowel Strava- als Garmin-activiteiten, aangezien beide
  bronnen dezelfde veldnamen gebruiken in `metrics`
  (`avg_speed`/`avg_cadence`/`avg_watts`, plus `max_*`-varianten sinds de
  TCX-uitbreiding in v2.4.37). Strava levert doorgaans geen max-waarden
  (alleen gemiddelden) — die subtekst verschijnt dan simpelweg niet, geen
  probleem.
- Elk blok verschijnt alleen als de betreffende data daadwerkelijk
  aanwezig is (zelfde patroon als het bestaande hoogte-blok) — geen lege
  "–"-velden die de kaartjes onnodig vol maken.

## v2.4.38 — Garmin-activiteiten zichtbaar in Activiteiten-overzicht + hoogtemeters-fix
**Bevestigd: Garmin-activiteiten (screenshot én TCX) verschenen al
automatisch op `/activities` met een "Garmin"-badge — de pagina filtert
nergens op `source: 'strava'`. Geen wijziging nodig om ze zichtbaar te
maken. Wel twee kleine verbeteringen gevonden en gefixt.**

- `src/app/settings/garmin-activity-import/page.tsx` — nieuwe **"Bekijk
  activiteiten"**-knop op het bevestigingsscherm, naast "Naar Home".
  Zelfde patroon als de bestaande knop bij Strava.
- `src/app/activities/page.tsx` — **echte bug gefixt:** hoogtemeters
  werden niet getoond voor Garmin-activiteiten. Root cause: deze pagina
  las `session.metrics.elevation` (Strava's veldnaam), maar de
  TCX-import (v2.4.37) slaat hoogtemeters op als `metrics.elevation_gain`
  — een andere sleutelnaam, dus geen match. Nu leest de pagina beide
  (`metrics.elevation ?? metrics.elevation_gain`), zodat hoogtemeters
  correct tonen ongeacht de bron.
- **Nog niet meegenomen:** de overige nieuwe TCX-velden (max cadans, max
  watts, snelheid) worden nog niet getoond in de kaartjes op deze
  lijstpagina — alleen duur, afstand, hartslag, calorieën en hoogte. Kan
  bij gelegenheid uitgebreid worden als gewenst.

## v2.4.37 — TCX-import: extra velden voor rijkere coach-analyses
**Op verzoek uitgebreid — deze data zat al in het TCX-bestand maar werd
niet gebruikt. Alles berekend binnen de bestaande trackpoint-loop, geen
nieuwe parsing-structuur nodig.**

- `src/lib/tcx-parser.ts` — `TcxParsed` uitgebreid met:
  - `max_cadence`, `max_watts`, `avg_speed_kmh`, `max_speed_kmh`
  - `elevation_gain_m`, `elevation_loss_m` — berekend als de som van
    positieve/negatieve hoogteverschillen tussen opeenvolgende
    trackpoints (`AltitudeMeters`), met een ruisdrempel van 0,5m per stap
    om GPS-hoogtetrilling niet als valse stijging/daling te tellen.
  - Snelheid wordt omgerekend van m/s (TCX-eenheid) naar km/u.
  - **Getest tegen alle 5 eerder gebruikte voorbeeldbestanden** — waarden
    zijn plausibel (bv. wandeling: 30m stijging/29m daling; indoor
    fietsen: geen hoogtedata, zoals verwacht).
- `src/app/api/health/garmin-activity-tcx/route.ts` — `metrics`-object bij
  het opslaan in `activity_sessions` uitgebreid met alle nieuwe velden.
- `src/app/settings/garmin-activity-import/page.tsx` — preview toont nu
  ook max-cadans, max-watts, snelheid (gem./max) en hoogtemeters
  (stijging/daling). Lokale, verouderde `TcxParsed`-interface verwijderd
  — gebruikt nu de gedeelde definitie uit `tcx-parser.ts` (voorkomt drift
  tussen de twee).
- **Bewust NIET toegevoegd:** Training Effect/Exercise Load-achtige
  duiding voor deze extra cijfers (bv. "hoog voor jouw niveau") — dat zou
  een aparte analyselaag vereisen die buiten de scope van deze
  parser-uitbreiding valt. De ruwe cijfers zijn nu beschikbaar in
  `activity_sessions.metrics`; interpretatie is aan Coach AI zelf, via de
  bestaande promptlogica die deze tabel al leest.

## v2.4.36 — Fix: Garmin-activiteit-import-pagina kon niet scrollen
- `src/app/settings/garmin-activity-import/page.tsx` — root-`<div>`
  gewijzigd van `min-h-screen` naar `h-screen overflow-y-auto`.
- **Root cause:** deze pagina gebruikt bewust geen `AppShell` (geen
  bottom-navigatie gewenst tijdens de import-flow), maar de globale
  app-stijl schakelt scrollen op `body`/`html` doorgaans uit — een
  aanname die klopt zolang een pagina `AppShell`'s eigen `scroll-area`
  gebruikt (zie v2.4.20), maar niet als een pagina daar bewust buiten
  valt. Deze pagina had dus **nergens** een scrollbare container.
  Bij content die de schermhoogte overschreed (bijvoorbeeld een lange
  TCX-preview met alle datavelden + 8 keuzeknoppen + melding + knop,
  zoals bij een fietsactiviteit van 54km/1u44m) kon de gebruiker niet bij
  de knoppen onderaan komen — leek op "niet kunnen opslaan", maar was
  eigenlijk "niet kunnen scrollen om bij de knop te komen".
  `h-screen` + `overflow-y-auto` geeft de pagina een eigen, onafhankelijke
  scroll-context, los van het AppShell-mechanisme.
- **Vergelijkbaar risico elders:** dit is de enige pagina in het project
  die bewust buiten `AppShell` valt (voor zover deze sessie onderzocht) —
  mocht een toekomstige pagina ook `AppShell` overslaan, geef die dan
  vanaf het begin een eigen `overflow-y-auto`-container.

## v2.4.35 — Fix: TCX-import gaf 413 (payload te groot) bij lange activiteiten
- **Nieuw:** `src/lib/tcx-parser.ts` — de TCX-XML-parslogica (`parseTcx`,
  `bepaalKeuzeNodig`, `suggereerType`, `ACTIVITEIT_OPTIES`) is verplaatst
  naar een isomorfe, gedeelde module die zowel in de browser als
  server-side werkt.
- `src/app/settings/garmin-activity-import/page.tsx` — parseert het
  TCX-bestand nu **in de browser** (`file.text()` + `parseTcx()`) in
  plaats van het volledige bestand naar de server te uploaden. Alleen het
  kleine, samengevatte resultaat (JSON, enkele KB) gaat naar de server.
- `src/app/api/health/garmin-activity-tcx/route.ts` — de extract-flow
  accepteert nu JSON (`{ parsed }`) in plaats van `multipart/form-data`
  met het volledige bestand. Confirm-flow ongewijzigd (blijft FormData,
  was toch al klein).
- **Root cause:** Vercel serverless functions hebben een payload-limiet
  van ~4,5MB. Langere activiteiten genereren TCX-bestanden met veel meer
  trackpoints (per-seconde GPS/hartslag/cadans-data) — bij een lange
  activiteit overschreed het bestand die limiet, wat resulteerde in
  `413 FUNCTION_PAYLOAD_TOO_LARGE` vóórdat de request onze route-code
  ooit bereikte (vandaar dat er geen `[garmin-activity-tcx]`-logregel
  verscheen — Vercel blokkeerde het al op platformniveau).
  **Waarom dit pas nu opviel:** de 5 testbestanden waarmee de TCX-import
  in v2.4.25 gebouwd en getest is, waren allemaal relatief kort
  (20-60 minuten) — geen van allen kwam in de buurt van de limiet.
- **Waarom dit de definitieve fix is, niet een tijdelijke workaround:**
  parsen in de browser heeft principieel geen bestandsgrootte-limiet zoals
  een serverless function die heeft — dit lost het probleem op voor
  activiteiten van elke lengte, niet alleen de iets grotere bestanden die
  net onder een verhoogde limiet zouden passen.

## v2.4.34 — NIEUW: Audio (Fase 2) voor beide trainingssystemen
**Gebouwd volgens de afgesproken architectuurregels: geluid is uitsluitend
een luisterlaag, nooit sturend. Eén gedeelde module, tegelijk gekoppeld
aan Archief én Trainer AI/Bibliotheek om divergentie tussen de twee
systemen te voorkomen.**

**Nieuw bestand:**
- `src/lib/workout-sound.ts` — gedeelde audio-module, geïmporteerd door
  beide `page.tsx`-bestanden. Bevat:
  - `ontgrendelAudio()` — ontgrendelt de gedeelde `AudioContext` voor de
    rest van de sessie. Moet aangeroepen worden vanuit een ECHTE
    gebruikersinteractie (iOS Safari-vereiste); nooit automatisch.
  - `speelTick()` — kort/droog/hoog, laatste 3 sec van countdown/rust.
  - `speelEindsignaal()` — lager/langer, einde van een actieve set.
  - `speelStarttoon()` — hoger/helder, start van een nieuwe set/oefening.
  - Synthetische tonen via Web Audio API (`OscillatorNode` +
    `GainNode`-envelope) — geen externe geluidsbestanden, laadt niets.
  - Elke functie faalt volledig stil (try/catch) — een geblokkeerde of
    falende `AudioContext` kan de workout nooit onderbreken.

**Koppeling — Archief (`archief/oefening/[id]/page.tsx`):**
- `ontgrendelAudio()` in `startWorkout()` (de "Start oefening"-knop)
- `speelStarttoon()`: countdown→actief (1e set), rust→actief (vervolgset)
- `speelEindsignaal()`: actief→rust (einde set)
- `speelTick()`: losse `useEffect`, laatste 3 sec van countdown/rust

**Koppeling — Trainer AI/Bibliotheek (`training/session/[module]/page.tsx`):**
- `ontgrendelAudio()` in `handleReadyFromUitleg()` (de "Ready"-knop die de
  eerste countdown start)
- `speelStarttoon()`: countdown→active (elke set/oefening-start),
  rest→active (vervolgset zonder countdown)
- `speelEindsignaal()`: active→rest/last_rest (einde set)
- `speelTick()`: losse `useEffect`, laatste 3 sec van countdown/rest/last_rest

**Bewust nog niet in deze versie:**
- Geen aan/uit-instelling — geluid staat standaard aan, toggle volgt in
  Fase 3.
- Trilfunctie/vibratie — niet gevraagd voor deze fase.

**Test-aandachtspunten:** i) eerste start (audio moet daadwerkelijk
hoorbaar zijn, niet stilzwijgend geblokkeerd door iOS), ii) einde van een
set, iii) laatste 3 sec van rust (3 losse ticks), iv) countdown bij nieuwe
oefening (Trainer AI/Bibliotheek), v) pauzeren/hervatten (geen geluid
tijdens pauze, geen dubbel geluid bij hervatten), vi) lockscreen/
achtergrond-herstel (geluid moet niet "inhalen" met meerdere gemiste
ticks tegelijk).

## v2.4.33 — Kleurprincipe consistent: rood = "maak je klaar", niet "tijd loopt af"
**Bevestigd principe (gebruiker): rood betekent uitsluitend "je moet zo
beginnen" (rust/countdown), nooit "je huidige oefening loopt bijna af"
(actief). Archief volgde dit al sinds v2.4.31/32; Trainer AI/Bibliotheek
volgde het gedeeltelijk niet.**

- `src/app/training/session/[module]/page.tsx` — twee wijzigingen in
  `WorkoutEngine`/`CountdownScherm`:
  1. **`actief`-fase:** cijfer is nu altijd wit, wordt niet meer rood bij
     de laatste 3 seconden (was: `remaining <= 3 ? 'text-red-400' :
     'text-white'`, nu: altijd `text-white`).
  2. **`countdown`-fase** (bij elke nieuwe oefening, 3 of 5 sec): cijfer
     wordt nu rood bij de laatste 3 seconden (was: altijd wit, geen
     rood-signaal). Dit ontbrak nog volledig — een gemiste kans om het
     principe consistent toe te passen, niet alleen "geen onterecht rood
     weghalen" maar ook "terecht rood toevoegen".
  3. **`rust`/`last_rest`-fase:** ongewijzigd — was al rood bij de laatste
     3 seconden, en dat is precies correct volgens het principe.
- **Resultaat:** Archief en Trainer AI/Bibliotheek volgen nu exact
  hetzelfde kleurprincipe: rood verschijnt uitsluitend vlak vóór een
  moment waarop de gebruiker in actie moet komen (rust-einde,
  countdown-einde), nooit tijdens de uitvoering van een oefening zelf.

## v2.4.32 — Fix: pauze in Archief bevroor het cijfer niet (bug sinds v2.4.30)
- `src/app/archief/oefening/[id]/page.tsx` — `remaining` komt tijdens
  pauze nu uit de bevroren `paused_remaining_ms`, niet meer uit een live
  herberekening op basis van `phase_end_at`.
- **Root cause:** `phase_end_at` verandert bewust niet tijdens pauze (dat
  was al correct — nodig om de fase-overgang tegen te houden via de
  `gepauzeerd`-guard in de ticking-`useEffect`). Maar `remaining` werd bij
  elke render nog steeds live herberekend als
  `phase_end_at - Date.now()`, en `Date.now()` loopt gewoon door tijdens
  pauze — dus het GETOONDE cijfer bleef doortellen naar 0 en bleef daar
  hangen, ook al werd de daadwerkelijke fase-overgang terecht
  tegengehouden. Dit zag eruit als "pauze doet niets", terwijl de
  onderliggende logica (geen ongewenste fase-overgang) wel klopte —
  een zuiver weergave-probleem, geen logica-probleem.
- Aanwezig sinds v2.4.30 (de Archief-timer-herbouw), pas nu opgemerkt
  omdat v2.4.31 (kleur-fix) toevallig de aandacht op het rust-scherm
  vestigde.

## v2.4.31 — Fix: Archief-timer werd niet rood bij laatste 3 seconden
- `src/app/archief/oefening/[id]/page.tsx` — het cijfer tijdens `rust` en
  `countdown` kleurt nu rood zodra `remaining <= 3`, consistent met hoe de
  `actief`-fase dat al deed (`WorkoutEngine` in de Coach AI-trainingen had
  dit gedrag ook al).
- **Root cause:** bij de v2.4.30-timer-herbouw is dit visuele detail
  gemist — het cijfer bleef altijd amber (`rust`) of wit (`countdown`),
  ongeacht hoeveel seconden er nog over waren. Functioneel klopte de timer
  zelf (telde correct af), maar het ontbrekende visuele signaal bij de
  laatste 3 seconden viel op ten opzichte van de rest van de app.

## v2.4.30 — Workout Engine REBUILD toegepast op Archief (eigen flowregels)
**Vervolg op v2.4.29 — die herbouw raakte alleen Coach AI/Trainingsbibliotheek
(`training/session/[module]/page.tsx`). Archief gebruikt een volledig los
bestand met eigen timer-logica, die nog niet was meegenomen.**

- `src/app/archief/oefening/[id]/page.tsx` — zelfde onderliggende
  `phase_end_at`-engine als v2.4.29 (vast eindtijdstip i.p.v. los
  `tellerSec`-getal, centrale 250ms-ticking-loop, `visibilitychange`-
  herstel, drift-vrij), maar met **bewust andere flowregels** dan Coach
  AI-trainingen — beargumenteerd door de gebruiker: Archief is één losse
  oefening met herhaalde sets (ritme/herhaling gewenst), geen opeenvolging
  van verschillende oefeningen (geen "omschakel-moment" nodig).

**Archief-flow (nieuw, vervangt "elke set opnieuw 5 sec countdown"):**
- 5 sec countdown **alleen vóór de allereerste set**
- Bij elke volgende set: **geen countdown** — rust loopt af, dan direct
  door naar de volgende set (de rust zelf is de voorbereiding)

Ter vergelijking, Coach AI-trainingen (v2.4.29, ongewijzigd):
- 5 sec bij de allereerste oefening van de hele sessie
- 3 sec bij elke overgang naar een NIEUWE oefening (wél een
  omschakel-moment, andere beweging/spiergroep)
- Geen countdown tussen sets binnen dezelfde oefening

- Pauzeren/hervatten volgt hetzelfde `paused_remaining_ms`-patroon als
  v2.4.29 — geen verloren/gewonnen tijd door de pauzeduur.
- De v2.4.17-navigatiefix (`router.back()` i.p.v. `router.push('/archief')`)
  blijft behouden in deze herbouwde versie.
- "Volgende set" / "Skip countdown" / "Skip rust"-knoppen forceren nu
  `phase_end_at = Date.now()` in plaats van een eigen aparte
  transitielogica — dezelfde aanpak als v2.4.29's `handleNext()`, voorkomt
  twee losse plekken die weten hoe overgangen werken.

**Nog steeds niet in deze versie:** geluid (Fase 3) — volgt voor beide
systemen (Coach AI én Archief) tegelijk, zodra deze timer-basis in de
praktijk bevestigd is.

## v2.4.29 — Workout Engine REBUILD: Fase 1 (timer-engine) + Fase 2 (flow)
**Volgens de CoachOS Workout Engine Master Architecture — bewust in deze
volgorde gebouwd (eerst fundament, dan flow, geluid volgt in een latere
stap als Fase 3).**

- `src/app/training/session/[module]/page.tsx` — volledig herbouwd rond
  één centrale timer-engine.

**FASE 1 — Drift-vrije timer-engine:**
- Elke getimede fase (`countdown`/`active`/`rest`/`last_rest`) krijgt een
  vast `phase_end_at`-tijdstip (`Date.now() + duur`) in plaats van een los
  aftellend getal (`countdown_seconds`/`active_seconds_left`/`rest_seconds`
  zijn verwijderd uit de state).
- Resterende tijd wordt **elke render herberekend** uit `phase_end_at` —
  nooit opgeslagen als eigen state die kan gaan driften.
- Eén centrale `setInterval(250ms)` + `visibilitychange`-listener in
  `SessionPage` forceert herberekening, ook direct bij terugkeer uit de
  achtergrond/lockscreen — lost het probleem op dat `setInterval` op iOS
  vertraagt zodra het scherm uitgaat.
- `WorkoutEngine` is nu **puur presentationeel** — geen eigen
  `setInterval`-effecten meer (voorheen 3 aparte intervals voor
  countdown/active/rest). Ontvangt `remaining` als prop.
- Pauzeren bewaart de resterende tijd in `paused_remaining_ms` (ms);
  hervatten berekent een nieuw `phase_end_at` vanaf dat punt — de
  pauzeduur zelf telt niet mee.

**FASE 2 — Vereenvoudigde flow:**
- **Geen countdown meer tussen sets** van dezelfde oefening — na `rest`
  gaat het direct door naar `active` (volgende set).
- **5 sec countdown** alleen bij de allereerste oefening van de sessie
  (`current_segment === 0 && completed_segments.length === 0`).
- **3 sec countdown** bij elke overgang naar een nieuwe oefening (na
  `last_rest`).
- Nieuwe flow: `uitleg → countdown(5s, 1x) → active → rest → active →
  rest → active → last_rest → [nieuwe oefening] → countdown(3s) → active
  → ... → voltooid`.
- De "Next"-knop (`handleNext`) forceert nu `phase_end_at = Date.now()` in
  plaats van een eigen, aparte transitielogica te hebben — de centrale
  ticking-loop pikt dit binnen 250ms op en roept dezelfde `advancePhase()`
  aan die ook bij natuurlijk verlopen van de tijd gebruikt wordt. Voorkomt
  dat er twee losse plekken zijn die weten hoe fase-overgangen werken.

**Nog niet in deze versie (bewust, volgende stap):**
- Fase 3 (geluid: Tick + Beep) — bouwen zodra deze timer-basis in de
  praktijk bevestigd is als 100% betrouwbaar.
- Fase 4 (instellingen geluid aan/uit).
- Trillingen, Apple Watch, Live Activities, Dynamic Island — genoemd in
  het architectuurdocument als toekomstige uitbreidingen, vandaar de keuze
  voor één centrale state (`phase`, `phase_end_at`) waar dit later op kan
  aanhaken zonder de kern opnieuw te hoeven bouwen.

**Test-aandachtspunten voor deze release:** i) eerste oefening start met
5 sec countdown, ii) geen countdown tussen sets binnen dezelfde oefening,
iii) elke volgende oefening start met 3 sec countdown, iv) timer blijft
correct na scherm-uit/achtergrond (val niet stil, geen drift), v) pauzeren
en hervatten geeft geen verloren/extra seconden.

## v2.4.28 — Fix: geen duplicaatcheck bij TCX-import (idempotency ontbrak)

**Mogelijk relevant vóór deploy — check of je al een duplicaat hebt
aangemaakt:** als je hetzelfde TCX-bestand meerdere keren hebt bevestigd
vóór deze fix, staan er nu waarschijnlijk dubbele `activity_sessions`-
rijen (en dubbele Coach Call-items). Check met:
```sql
select id, date, duration, notes, created_at
from activity_sessions
where user_id = 'JOUW_USER_ID' and source = 'garmin'
order by created_at desc;
```
Verwijder handmatig de duplicaat-rij(en) indien aanwezig (en het
bijbehorende `coach_call_items`-record) — dit gebeurt niet automatisch.

**Wat er is gefixt:**
- `src/app/api/health/garmin-activity-tcx/route.ts` — vóór het opslaan
  wordt nu gecontroleerd of er al een `activity_sessions`-rij bestaat met
  dezelfde TCX-starttijd (`garmin_tcx_start:[Id]` in `notes`). Zo ja: de
  confirm wordt geweigerd met status 409 en een duidelijke melding,
  in plaats van een duplicaat aan te maken.
- **Root cause:** deze idempotency-check bestond al voor Strava-sync (via
  `strava:ID` in `notes`, zie `strava-activity-processor.ts`), maar was
  niet meegenomen bij het bouwen van de TCX-route (v2.4.25) — een gemiste
  parallel tussen twee vergelijkbare importwegen.
- `src/app/settings/garmin-activity-import/page.tsx` — toont nu de
  specifieke "al eerder geïmporteerd"-melding bij een 409-response, in
  plaats van een generieke foutmelding.
- **Bewuste keuze — screenshot-import (v2.4.23/24) heeft dit nog niet.**
  Een screenshot heeft geen betrouwbaar uniek kenmerk zoals een TCX-
  starttijd om op te dedupliceren; dat zou een aparte oplossing vergen
  (bijv. datum + tijd + activiteitstype als samengestelde sleutel). Nog
  niet gebouwd — laag risico, want een screenshot opnieuw uploaden is een
  bewustere, minder toevallige handeling dan een TCX-bestand dat je
  mogelijk per ongeluk twee keer aanklikt.

## v2.4.27 — Build-fix: ongeldige export in garmin-activity-tcx/route.ts
- `src/app/api/health/garmin-activity-tcx/route.ts` — `export const
  ACTIVITEIT_OPTIES = [...]` gaf een Vercel build-fout: *"ACTIVITEIT_OPTIES
  is not a valid Route export field"*.
- **Root cause:** Next.js App Router staat in `route.ts`-bestanden
  uitsluitend specifieke exports toe (`GET`, `POST`, `dynamic`,
  `revalidate`, etc.) — een losse geëxporteerde constante wordt door
  Next.js' eigen type-validatie geweigerd, ongeacht of hij ergens
  daadwerkelijk wordt geïmporteerd. In dit geval werd de constante alleen
  intern in hetzelfde bestand gebruikt, dus de `export` was sowieso
  overbodig.
- Fix: `export` weggehaald, functioneel geen enkele wijziging.
  **Les:** in `route.ts`-bestanden nooit hulpconstantes/functies
  exporteren tenzij écht nodig vanuit een ander bestand — anders eerst
  overwegen of het naar een apart `lib/`-bestand hoort.

## v2.4.26 — NIEUW: Blessures-archief met volledige historie

**⚠️ VEREIST VÓÓR DEPLOY — nieuwe kolom in Supabase SQL Editor:**
```sql
alter table injuries add column ended_at timestamptz;
```
Zonder deze kolom slaagt de PATCH in `injuries/route.ts` niet meer bij het
markeren van een blessure als hersteld (poging tot schrijven naar een
niet-bestaande kolom).

**Wat er is veranderd:**
- `src/app/api/injuries/route.ts` — `PATCH` zet nu `ended_at` op het huidige
  tijdstip zodra een blessure op `active: false` wordt gezet (hersteld), en
  maakt het weer leeg als een blessure ooit heropend zou worden
  (`active: true`). Nodig om duur en hersteldatum te kunnen tonen.
- `src/app/injuries/page.tsx` — de kleine "Hersteld"-sectie onderaan
  (toonde alleen de naam, doorgestreept, geen historie) is verwijderd.
  Herstelde blessures verdwijnen nu uit dit scherm en verhuizen naar het
  nieuwe archief. Een "Archief"-kaart onderaan linkt daarnaartoe.
- **Nieuw:** `src/app/injuries/archief/page.tsx` — toont elke herstelde
  blessure als uitklapbare kaart met lichaamsdeel, start-/hersteldatum,
  berekende duur (dagen/weken/maanden, leesbaar geformatteerd), en bij het
  uitklappen de **volledige pijnscore-historie** (hergebruikt de bestaande
  `injury-updates`-data via `GET /api/injury-updates`, alleen-lezen).
- Geen nieuwe API-route nodig voor het archief zelf — hergebruikt de
  bestaande `GET /api/injuries` en filtert client-side op `!active`,
  consistent met hoe de hoofdpagina dat al deed voor actieve blessures.

## v2.4.25 — NIEUW: TCX-import gecombineerd met screenshot-import (één pagina)
**Gebouwd na onderzoek van 5 echte Garmin TCX-exports (Hardlopen, Wandelen,
Fietsen buiten, Fietsen indoor, Roeien, Zwift) — het ontwerp is direct op
bewijs gebaseerd, niet op aannames over hoe Garmin activiteiten labelt.**

**Nieuwe dependency:** `fast-xml-parser` (^4.5.0) toegevoegd aan `package.json`.

**Onderzoeksbevindingen (bepalend voor het ontwerp):**
- `Sport="Running"` is 100% betrouwbaar → automatisch "Hardlopen"
- `Sport="Biking"` geldt voor ZOWEL buiten als indoor fietsen — **Zwift
  genereert zelfs nep-GPS-coördinaten die op een buitenrit lijken**, dus
  GPS-aanwezigheid is geen betrouwbaar onderscheid
- `Sport="Other"` dekt wandelen, roeien, kracht, kettlebell — geen enkel
  TCX-veld onderscheidt deze onderling
- Conclusie: alleen `Running` mag automatisch worden aangenomen; voor al het
  overige toont de UI een keuzemenu met een voorgestelde default

**Nieuwe bestanden:**
- `src/app/api/health/garmin-activity-tcx/route.ts` — parseert TCX-XML met
  `fast-xml-parser` (geen AI nodig, exacte cijfers). Let op een subtiele
  parser-eigenaardigheid, gevonden door te testen tegen echte bestanden:
  `fast-xml-parser` behoudt de `ns3:`-naamruimte-prefix OOK op
  onderliggende veldnamen (bv. `Extensions['ns3:TPX']['ns3:Watts']`, niet
  `Extensions.TPX.Watts`). Cadans staat top-level als `Cadence` bij fietsen,
  maar als `ns3:RunCadence` binnen `ns3:TPX` bij hardlopen — beide worden
  gecombineerd.
- `src/app/settings/garmin-activity-import/page.tsx` — **volledig herbouwd**
  als gecombineerde pagina met tabblad-keuze (Screenshot/TCX-bestand) in
  plaats van een aparte derde knop in Instellingen. Bij TCX met
  `keuze_nodig: true` toont de pagina een keuzemenu (Hardlopen, Fietsen
  buiten, Indoor Fietsen, Wandelen, Roeien, Krachttraining, Kettlebell,
  Anders), voorgevuld met een suggestie.
- Hergebruikt de bestaande `garmin_activity_imports`-tabel (v2.4.23) —
  geen nieuwe tabel nodig, `parsed_data` is generiek genoeg voor beide
  brontypes.
- Zelfde vervolgpad als v2.4.23/24: opslag in `activity_sessions`
  (`source: 'garmin'`) + altijd een Coach Call, ongeacht duur/afstand.

**Bewust ontbrekend bij TCX (eerlijk, geen verzonnen waarde):** Training
Effect en Exercise Load staan niet in het ruwe TCX-bestand — dat is
Garmin's eigen berekende duiding, alleen zichtbaar op het Statistieken-
scherm. TCX-imports missen dit veld; screenshot-imports hebben het wel.
Beide methodes blijven daarom naast elkaar bestaan, geen vervanging.

## v2.4.24 — Fix: Garmin-activiteit-import faalde op check constraint (source)
- `src/app/api/health/garmin-activity-vision/route.ts` — `source`-waarde
  bij de insert in `activity_sessions` gecorrigeerd van `'garmin_manual'`
  naar **`'garmin'`**.
- **Root cause:** `activity_sessions` heeft een check constraint
  (`activity_sessions_source_check`) die `source` beperkt tot
  `manual`/`garmin`/`apple_health`/`strava`. `'garmin_manual'` (verzonnen
  bij het bouwen van v2.4.23, niet geverifieerd tegen het bestaande schema)
  bestond niet in die lijst — Postgres-foutcode `23514`, direct zichtbaar
  via de `console.error('[garmin-activity-vision]', err)`-log.
  **Les:** bij een nieuwe insert in een bestaande tabel altijd eerst de
  check constraints verifiëren (`select conname, pg_get_constraintdef(oid)
  from pg_constraint where conname = '...'`), niet aannemen welke waarden
  zijn toegestaan — exact de fout die v2.4.12 (NOT NULL constraint) ook al
  had blootgelegd, hier herhaald bij een nieuwe feature.
- Onderscheid tussen de dagelijkse Garmin-import en deze nieuwe
  activiteit-import blijft behouden via de `notes`-prefix
  (`garmin_activity_import:[id]`) in plaats van via een eigen
  `source`-waarde — functioneel gelijk, past binnen het bestaande schema.
- README-tabel (Coach Call Systeem) bijgewerkt met de gecorrigeerde waarde.

## v2.4.23 — NIEUW: Garmin-activiteit-import (alternatief voor Strava)
**Context: Strava heeft per 30 juni 2026 API-toegang voor bestaande
Standard-tier ontwikkelaars afhankelijk gemaakt van een betaald abonnement
(zie sectie "Strava API-toegang" hieronder). Dit is een externe
beleidswijziging van Strava, geen bug in CoachOS. Deze nieuwe feature is
een parallel, handmatig alternatief — geen vervanging van Strava-sync zelf.**

**⚠️ VEREIST VÓÓR DEPLOY — nieuwe tabel in Supabase SQL Editor:**
```sql
create table garmin_activity_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  activity_session_id uuid references activity_sessions(id),
  raw_vision_response jsonb,
  parsed_data jsonb,
  validation_flags jsonb,
  confidence_score int,
  status text default 'pending',
  created_at timestamptz default now()
);

alter table garmin_activity_imports enable row level security;

create policy "Users manage own garmin_activity_imports"
  on garmin_activity_imports for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```
Zonder deze tabel geeft `/api/health/garmin-activity-vision` een 500-fout
bij elke poging.

**Nieuwe bestanden:**
- `src/app/api/health/garmin-activity-vision/route.ts` — leest het
  "Statistieken"-tabblad van een Garmin-activiteit uit via Claude Vision
  (zelfde patroon als de bestaande dagelijkse Garmin-import:
  `sharp`-compressie, `claude-opus-4-5`, extract → preview → confirm-flow).
  Bij bevestigen: slaat op in `activity_sessions` (`source: 'garmin_manual'`
  — dezelfde tabel als Strava, dus telt automatisch mee in bestaande
  trainingsbelasting-berekeningen) én maakt **altijd** een Coach Call aan.
- `src/app/settings/garmin-activity-import/page.tsx` — UI voor upload/
  preview/bevestigen, zelfde stijl als `garmin-import/page.tsx`.
- `src/app/settings/page.tsx` — nieuwe kaart "Garmin Activiteit" toegevoegd
  naast de bestaande "Garmin Import"-kaart.

**Belangrijk architectuurbesluit — waarom GEEN drempel zoals Strava:**
Strava-activiteiten triggeren een Coach Call alleen bij een kwalificerende
duur/afstand (OR-drempel, v2.4.6), omdat dat een **automatische bulk-sync**
is met mogelijk veel triviale activiteiten. Een Garmin-screenshot-upload is
daarentegen een **bewuste, eenmalige handeling** — vergelijkbaar met het
starten van een Trainingsbibliotheek-sessie (die ook altijd triggert, zie
v2.4.6). Daarom triggert deze route altijd een Coach Call, ongeacht duur.
Bevat ook de v2.4.8/v2.4.12-heropen-logica voor een reeds
completed/expired call van diezelfde dag.

**Wat nog niet is gedaan:**
- Geen retry-logica (v2.4.9/v2.4.11) toegevoegd aan de Coach Call-insert in
  deze nieuwe route — dat kan bij gelegenheid alsnog toegevoegd worden als
  hier ooit hetzelfde stille-faal-patroon optreedt als bij
  `training/complete/route.ts`.
- Sportnaam-mapping (`ACTIVITY_LABEL_MAP`) dekt de meest voorkomende
  activiteiten maar is niet zo uitgebreid als Strava's `SPORT_TYPE_MAP` —
  uit te breiden indien nodig.

## v2.4.22 — REBUILD: Strava sync (timeout + duidelijke feedback) + v1.8.5 versienummer gefixt
**Op verzoek herbouwd in plaats van opnieuw gepatcht, na een reeks
symptomen (geen resultaatbericht meer, knop bleef "laden") die niet met
gerichte fixes op te lossen bleken.**

- `src/app/api/strava/sync/route.ts` — volledig herbouwd:
  - **Eigen timeout (20 sec, `AbortController`)** op de fetch naar Strava's
    API. Dit was de root cause: de aanroep had voorheen géén timeout, dus
    bij een trage Strava-respons bleef de request oneindig hangen (of tot
    een onduidelijke platform-timeout) zonder ooit een bericht naar de
    gebruiker te sturen — precies het "blijft laden, geen resultaat meer"
    -symptoom.
  - Expliciete afhandeling van Strava-statuscodes: `401` (token ongeldig
    ondanks refresh — vraagt om opnieuw te koppelen), `429` (rate limit),
    overige non-200 statussen.
  - Elke stap gelogd (`console.log`/`console.error` met `[strava/sync]`
    prefix) — token-refresh, aantal opgehaalde activiteiten, per-activiteit
    verwerkingsfouten, totale duur. Een volgend probleem is nu direct
    zichtbaar in Vercel logs zonder eerst code te hoeven doorpluizen.
  - Response bevat nu altijd `success`, `message`, en bij succes ook
    `importedNames` (welke activiteiten precies) en eventuele
    per-activiteit `errors` — nooit meer een stille, betekenisloze
    "Sync klaar".
- `src/app/settings/page.tsx` (`StravaSection`) — volledig herbouwd:
  - Resultaatbericht **blijft zichtbaar** tot de volgende sync-poging
    (was: kon verdwijnen/overschreven worden zonder duidelijke reden).
  - Na **10 seconden zonder resultaat**: expliciete "dit duurt langer dan
    gebruikelijk"-melding in plaats van een spinner die niets zegt.
  - Toont bij succes de namen van geïmporteerde activiteiten; toont bij
    fouten een duidelijke foutmelding in plaats van een generieke tekst.
  - **Bonus, zelfde bestand:** het hardcoded `"v1.8.5"`-versienummer
    (derde losstaande versie naast `package.json` en de al in v2.4.14
    gefixte hoe-werkt-het-pagina) is nu ook dynamisch via `/api/version`.
- **Nog te bevestigen:** of de eerder gemelde ontbrekende wandelactiviteit
  nu wél verschijnt bij een nieuwe sync-poging — dat hangt af van of
  Strava de activiteit inmiddels heeft verwerkt (buiten onze controle),
  maar met deze rebuild krijgt de gebruiker in elk geval altijd een
  duidelijk, waarheidsgetrouw resultaat te zien, ongeacht de uitkomst.

## v2.4.21 — Verfijning v2.4.20: Training blijft bovenaan vanuit Home, herstelt scroll vanuit Archief
**Verduidelijking na terugkoppeling: de v2.4.20 scroll-herstel-fix in
`AppShell` werkt technisch correct, maar het "probleem" bleek deels een
bewuste keuze te zijn — Training-pagina opent bewust bovenaan bij
`Start Training`/`Start Herstel` vanuit Home. Deze wijziging maakt het
onderscheid expliciet in plaats van dat beide paden hetzelfde
scroll-herstel-gedrag delen.**

- `src/app/home/page.tsx` — de `Start Training`/`Start Herstel`-knop wist nu
  expliciet de opgeslagen scrollpositie voor `/training`
  (`sessionStorage` key `coachos_scroll_/training`, uit v2.4.20) vlak vóór
  het navigeren.
- **Resultaat:**
  - Vanuit **Home** → Start Training/Herstel → Training opent **bovenaan**
    (ongewijzigd t.o.v. voor deze hele fix-reeks — dit was en blijft
    gewenst gedrag).
  - Vanuit **Archief** → terug (via `router.back()`, v2.4.17/18) → Training
    **herstelt de scrollpositie** van vóór het bezoek aan Archief (via
    v2.4.20's `AppShell`-logica, die hier niet gewist wordt).
- **Geen wijziging nodig in `AppShell` zelf** — de v2.4.20-logica was
  inhoudelijk correct, alleen ontbrak er een manier om "vergeet de vorige
  positie, dit is een verse start" aan te geven voor het Home-pad. Dat is
  wat deze wijziging toevoegt.

## v2.4.20 — DEFINITIEVE FIX: scrollpositie-herstel in AppShell (v2.4.19 was onjuist)
**Correctie: de analyse in v2.4.19 was fout. Dit lost het daadwerkelijke
probleem op, in het juiste bestand.**

- `src/components/layout/index.tsx` (`AppShell`) — scrollpositie van het
  binnenste `<main>`-element wordt nu bijgehouden in `sessionStorage`, per
  pathname, en hersteld bij het opnieuw mounten van diezelfde route.
- **De echte root cause, gemist in v2.4.17-v2.4.19:** `AppShell` rendert een
  buitenste `<div className="h-screen ... overflow-hidden">` met daarbinnen
  een `<main className="flex-1 scroll-area ...">`. **Het binnenste `<main>`
  scrolt, niet `window`.** Browser-native scrollherstel en Next.js'
  ingebouwde scroll-restoration werken uitsluitend op `window.scrollTo` —
  die hebben dus **nooit** invloed gehad op dit element, ongeacht of de
  navigatie via `router.push()`, `router.back()` of `router.replace()`
  gebeurde, en ongeacht of data synchroon of asynchroon geladen werd. Bij
  elke hermount van een route begint dit `<main>`-element simpelweg weer op
  `scrollTop: 0` — dat is standaard DOM-gedrag, geen bug in onze routing.
- **Waarom v2.4.17/v2.4.18 gedeeltelijk hielpen, maar niet genoeg:** die
  fixes losten een écht apart probleem op (dubbele geschiedenis-entries die
  naar de verkeerde PAGINA navigeerden). Dat probleem bestond naast dit
  scrollprobleem, met een deels overlappend symptoom ("terug gaat niet
  goed"). Beide moesten apart gefixt worden.
- **Waarom v2.4.19 niet hielp:** de analyse ging uit van een layout-shift
  die *window*-scrollherstel zou breken — maar er was helemaal geen
  window-scrollherstel actief om te breken, dus die fix raakte de
  daadwerkelijke oorzaak nooit. Nuttige les: verifieer welk element
  daadwerkelijk scrolt (`window` vs. een inner container met
  `overflow-y`) vóórdat je scroll-herstel-gedrag probeert te fixen.
- **Waarom deze fix wél moet werken:** hij grijpt rechtstreeks in op het
  element dat daadwerkelijk scrolt (`mainRef.current.scrollTop`), volledig
  onafhankelijk van hoe Next.js of de browser navigatie/scroll intern
  afhandelen. Zit in `AppShell` — werkt hierdoor voor élke pagina in de
  app, niet alleen Training/Archief.
- **Dubbele herstelpoging** (direct bij mount + na 150ms) omdat sommige
  pagina's (zoals Training, met de v2.4.19 cache-fix) een fractie van een
  seconde na mount nog van hoogte kunnen veranderen.

## v2.4.19 — Fix: scroll-positie reset bij terugkeer naar Training (INCORRECTE ANALYSE, zie v2.4.20)
**Belangrijk: dit is een ANDER probleem dan de dubbele-geschiedenis-bug uit
v2.4.17/v2.4.18, ook al leek het symptoom in eerste instantie identiek
("terugknop gaat verkeerd").**

- `src/app/training/page.tsx` — `instruction` en `laden` state worden nu
  synchroon geïnitialiseerd vanuit de `localStorage`-cache via een lazy
  `useState`-initializer (`leesGecachteInstructie()`), in plaats van pas in
  een `useEffect` na de eerste render.
- **Root cause:** deze pagina toonde bij elke (her)mount altijd eerst de
  `TrainingSkeleton` (`laden` start op `true`), zelfs als er al geldige
  cache-data in `localStorage` stond — de cache werd pas in een `useEffect`
  gecontroleerd, die pas ná de eerste render draait. De skeleton heeft een
  andere (kortere) hoogte dan de uiteindelijke pagina-inhoud. Wanneer de
  gebruiker teruggnavigeerde (bv. vanuit Archief) via `router.back()` of
  swipe, probeerde de browser de scrollpositie te herstellen op het moment
  dat de pagina nog de korte skeleton toonde — waardoor de herstelde
  positie niet meer klopte zodra de volledige content (met de al bezochte
  categorieën, Trainingsbibliotheek, etc.) een fractie van een seconde later
  verscheen. Dit voelde aan als "terugknop gaat 2 stappen terug" of "reset
  naar boven", terwijl de navigatie zelf (welke pagina) wel degelijk correct
  was.
- **Onderscheid met v2.4.17/v2.4.18:** die fixes losten een echte
  dubbele-`push()`-geschiedenis op (verkeerde bestemmingspagina). Deze fix
  lost een layout-shift op die scroll-herstel breekt binnen de juiste
  pagina. Beide konden hetzelfde voelen voor de gebruiker ("terug gaat
  niet goed"), maar hadden compleet losstaande oorzaken en fixes — een
  les voor toekomstig soortgelijk onderzoek: bevestig altijd expliciet of
  het probleem "verkeerde pagina" of "verkeerde scrollpositie op de juiste
  pagina" is, met screenshots van vóór/na indien mogelijk.

## v2.4.18 — Navigatie-fix uitgebreid: Archief-overzicht + Trainingsbibliotheek-sessie
**Vervolg op v2.4.17 — dezelfde root cause bleek breder aanwezig dan alleen
de losse Archief-oefeningpagina.**

- `src/app/archief/page.tsx` — terugknop gebruikte `router.push('/training')`,
  nu `router.back()`.
- `src/app/training/session/[module]/page.tsx` — drie plekken gefixt:
  1. `handleHeaderBack()`, fallback zonder actieve sessie:
     `router.push('/training')` → `router.back()`
  2. `handleHeaderBack()`, laatste "verlaat sessie helemaal"-tak:
     `router.push('/training')` → `router.back()`
  3. `handleSave()`, redirect na voltooide evaluatie:
     `router.push('/training')` → `router.replace('/training')`
- **Root cause (zelfde als v2.4.17):** `router.push()` voegt bij elk gebruik
  een NIEUWE entry toe aan de browsergeschiedenis. Bij herhaald gebruik van
  Archief of Trainingsbibliotheek (oefening bekijken → terug → andere
  oefening bekijken, of training starten → afbreken → opnieuw starten)
  stapelen duplicaten zich op. Swipe-terug (systeem-navigatie, buiten
  React's routing) volgt die vervuilde geschiedenis, wat zich uit als
  meerdere stappen tegelijk terug, "hangen en terugspringen", of
  terechtkomen op een oude, ongerelateerde pagina.
- **Waarom dit gevonden werd:** gebruiker meldde dat swipe-terug vanuit een
  Archief-oefeningpagina uitkwam op een kettlebell-trainingssessie van
  eerder die dag. Doorvragen naar het exacte navigatiepad
  (Archief → oefening → terug → andere oefening) bevestigde het patroon.
  Vervolgvraag "geldt dit voor het hele Archief?" bracht de bredere scope
  aan het licht — de fix in v2.4.17 dekte slechts één van de vier
  betrokken plekken.
- **Suggestie voor toekomstig onderzoek:** dit `push` vs. `back`/`replace`-
  patroon kan mogelijk ook in andere delen van de app voorkomen die niet
  deze sessie zijn gecontroleerd (bv. Coach Call-pagina, Checkin-pagina,
  Settings-subpagina's). Zie README sectie Troubleshooting voor het
  algemene fix-patroon, mocht een vergelijkbaar probleem zich elders
  voordoen.

## v2.4.17 — Fix: navigatie Archief-oefening bouwde dubbele geschiedenis op
- `src/app/archief/oefening/[id]/page.tsx` — twee wijzigingen:
  1. Terugknop gebruikt nu `router.back()` in plaats van
     `router.push('/archief')` (alleen in de `instellen`-fase — andere
     fases blijven state-only teruggaan via `setFase('instellen')`,
     ongewijzigd).
  2. De automatische redirect na een voltooide evaluatie gebruikt nu
     `router.replace('/archief')` in plaats van `router.push()`.
- **Root cause:** `router.push('/archief')` voegt bij elk gebruik een
  NIEUWE entry toe aan de browsergeschiedenis, ook als je al eerder op
  Archief was. Bij de flow "oefening bekijken → terug → andere oefening
  bekijken → terug → ..." stapelden zich dubbele `/archief`-entries op.
  De in-app terugknop leek daardoor te werken (het scherm zag er correct
  uit), maar de browsergeschiedenis raakte vervuild. Swipe-terug (echte
  browser-navigatie, buiten React's routing om) volgt die vervuilde
  geschiedenis letterlijk, wat zich uitte als: soms 2 stappen tegelijk
  terug, soms "hangen en terugspringen", en in het ergste geval
  terechtkomen op een compleet ongerelateerde eerdere pagina (bijv. een
  kettlebell-trainingssessie van eerder die dag).
  Gevonden via reproductie: Archief → oefening bekijken → terug →
  andere oefening bekijken → swipe-terug gedraagt zich inconsistent.
- `router.back()` navigeert altijd naar de daadwerkelijk vorige pagina in
  de bestaande stack, zonder duplicaten toe te voegen — dit synchroniseert
  het gedrag van de in-app knop met swipe-navigatie.

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
