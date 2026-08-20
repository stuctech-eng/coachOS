# CoachOS — Changelog

> **Oudere entries (vóór v2.4.185)** staan in `docs/changelog-archief.md` — gearchiveerd op 20 augustus 2026 om het actieve bestand onder de groottedrempel van Working Copy's zip-import te houden (595 KB werd als "mogelijk binair" overgeslagen).


## v2.4.323 — FIX: v2.4.322's SQL miste RLS
**Geen code. Gemeld via Supabase's eigen beveiligingswaarschuwing
("Row Level Security disabled, clients using anon or authenticated
keys may be able to read/write today_plan_cache") bij het proberen uit
te voeren van de v2.4.322-SQL.**

### Root cause — mijn eigen fout
Had zelf al genoteerd dat andere tabellen in de app RLS gebruiken,
maar dit niet toegepast op de nieuwe `today_plan_cache`-tabel.

### Fix
README bijgewerkt met de gecorrigeerde SQL — tabel + RLS ingeschakeld
+ drie policies (select/insert/update, elk beperkt tot `auth.uid() =
user_id`). Breekt niets aan de werkende code: de app gebruikt
`createAdminClient()` (service-role, omzeilt RLS sowieso). RLS
voorkomt alleen dat een gewone anon/authenticated-sleutel rechtstreeks
bij andermans cache zou kunnen.

**Actie voor de gebruiker:** de eerdere, onvolledige SQL nog niet
uitgevoerd (bevestigd, "Cancel" gekozen op Supabase's waarschuwing) —
de nieuwe, complete versie uit het README gebruiken.

## v2.4.321 — Terminologie/presentatie: Coach Score, Herstel, Coach Compliance
**Gemeld, met bewijs (twee screenshots): geen bugs gevonden bij
onderzoek — elk getal klopt voor zijn eigen, smalle definitie, maar de
presentatie oogde tegenstrijdig. Overleg gebruiker + GPT: berekeningen
en CoachPolicy ONGEWIJZIGD, alleen UI/tekst aangepast.**

### Bevindingen, bevestigd met bewijs
- "Coach Score 42" naast een onveranderde 84-min-training: `Herstel:
  53` (de sub-score) IS letterlijk `recovery.score` — dezelfde waarde
  die CoachPolicy gebruikt voor `recoveryState`. 53 valt in
  'moderate' (50-74), niet 'low' — dus terecht geen aanpassing. De
  samengestelde Coach Score (42, inclusief Training/Leefstijl) is een
  ander, breder getal dan wat de beslissing bepaalt
- "100%, uitstekend consistent herstel" naast "inconsistent trainen
  0,3x/week": Coach Compliance meet uitsluitend opvolging van
  gegeven hersteladviezen, niet trainingsfrequentie — bij weinig
  trainingen zijn er ook weinig hersteladviezen, en die paar werden
  wél allemaal opgevolgd

### Wijzigingen — puur presentatie
- **`home/page.tsx`** — subtekst onder "Coach Score":
  "Samengesteld uit herstel, training en leefstijl". "Herstel"-
  subscore krijgt een eigen label: "Bepaalt trainingsaanpassingen"
- **`progressie/page.tsx`** — vaste ondertitel bij Coach Compliance:
  "Opvolging van gegeven hersteladviezen — geen maat voor
  trainingsfrequentie", naast de bestaande dynamische samenvatting

### Bewust ongewijzigd
Geen enkele berekening, geen CoachPolicy-logica, geen drempelwaarden
— zoals expliciet afgesproken, dit was een presentatieprobleem, geen
logicaprobleem.

### Nog open — Smart Actions "Open trainingsplan" blijft soms weg
Gemeld: ondanks v2.4.320 (dubbele CoachPolicy-berekening al
weggenomen) verschijnt "Open trainingsplan" bij Snelle Acties nog
steeds soms niet. Resterende keten (CoachPolicy + haalAthleteState +
voerDailyAdjustmentUitCore's eigen queries) is nog steeds substantieel
— kan bij een trage verbinding over de bestaande 2,5-seconden-
tijdslimiet gaan. Twee mogelijke vervolgstappen besproken (tijdslimiet
verruimen met nieuwe onderbouwing, of Smart Actions op een gecachet
TodayPlan laten draaien) — wacht op een keuze vóór bouwen.

## v2.4.320 — FIX: performance-regressie in Smart Actions, veroorzaakt door v2.4.319
**Gemeld: "Open trainingsplan" verscheen vaak niet meer bij Snelle
Acties.**

### Root cause
`api/smart-actions/route.ts` heeft al sinds v2.4.207 een harde 2,5-
seconden-tijdslimiet op Today Engine (bewuste, eerder goedgekeurde
keuze — bij overschrijding wordt het trainingsvoorstel stil
overgeslagen, de rest van Smart Actions blijft snel). v2.4.319's
nieuwe CoachDecision-REST-check riep `genereerCoachPolicy()` aan
vóór de bestaande, interne aanroep binnen `voerDailyAdjustmentUitCore()`
— **twee keer dezelfde, meerdere-queries-kostende berekening binnen
één Today Engine-aanroep**, genoeg extra latency om de bestaande
tijdslimiet vaak te overschrijden.

### Fix
Geen tijdslimiet-verhoging — geen bewijs dat dat de juiste correctie
zou zijn, en lost de onderliggende trage berekening niet op. In
plaats daarvan de daadwerkelijke dubbele berekening weggenomen:

- **`adjuster-core.ts`**: `voerDailyAdjustmentUitCore()` accepteert nu
  een optioneel, vierde parameter (`vooraf_berekend_recoveryState`) —
  backward-compatible. De drie workout-detailroutes (Cycling/Running/
  Rowing), die dit dubbel-probleem nooit hadden, blijven volledig
  ongewijzigd — ze geven de nieuwe parameter niet mee, dus exact
  hetzelfde gedrag als vóór deze fix
- **`today-engine.ts`**: `berekenDefinitieveDuur()` uitgebreid met
  hetzelfde optionele parameter, `proposalNaarTodayPlan()` geeft nu
  zijn al-berekende `policy.recoveryState` door

**Resultaat:** binnen één Today Engine-aanroep wordt
`genereerCoachPolicy()` weer precies één keer aangeroepen — exact
zoals vóór v2.4.319, met de nieuwe REST-check erbij zonder de eerder
opgetreden dubbele kostbare berekening.

### Twee gewijzigde bestanden
`adjuster-core.ts`, `today-engine.ts`.

**Nog niet gemeten of dit de 2,5-seconden-tijdslimiet daadwerkelijk
weer voldoende onder controle brengt** — vergt observatie in de
draaiende app of "Open trainingsplan" nu weer consistent verschijnt.

## v2.4.319 — CoachDecision-contract: REST | TRAIN | ADJUST
**De belangrijkste architectuurwijziging van vandaag. Gebruiker + GPT-
overleg, na feedback die de gebruiker zelf van de in-app Coach kreeg:
"rustdag geadviseerd, systeem maakte toch een training aan."**

### Wat dit oplost
Regel 0c (Coach Decision Integrity, v2.4.317-318) zorgde dat schermen
niet meer een ander GETAL konden tonen voor dezelfde sessie. Maar
niets voorkwam dat de AI zelfstandig "vandaag geen training" kon
adviseren terwijl het systeem gewoon een training aanmaakte — geen
getalverschil, een tegenstrijdige BESLISSING. Guardian-onderzoek
bevestigde: nergens in CoachOS bestond een structurele REST-uitkomst.

### Semantiek
- **REST** = actieve blessure OF ziekte (bestaande `-100%`-blokkade in
  `context-resolver.ts`, geen nieuwe regel) → geen workout
- **TRAIN** = geen REST, geen aanpassing nodig → originele workout
- **ADJUST** = geen REST, context vereist aanpassing → `pasWorkoutAan()`

**Expliciet niet gedaan:** ACWR > 1,7 wordt geen REST (geen bestaand
contract daarvoor). Geen `confidence`-veld. Prioriteit ongewijzigd
hergebruikt (blessure > ziekte > vakantie > herstel > wedstrijd >
werk > training > vrije_tijd).

### Zeven gewijzigde bestanden
1. **`coach-policy.ts`** — kern, nieuw `decision`-veld, haalt nu ook
   `life_events` op (bevestigd: kon dat eerder niet), roept
   `bepaalDagContext()` aan — beide bestaande functies, geen
   duplicatie, geen tweede engine
2. **`today-engine.ts`** — `genereerCoachPolicy()` als allereerste
   stap; bij REST: direct terug, `bouwWorkout()`/`pasWorkoutAan()`
   nooit aangeroepen
3-5. **Cycling/Running/Rowing workout-routes** — dezelfde REST-check
   vóór het bouwen, ook op de detailpagina
6-7. **`api/coach/route.ts` + `api/action-plan/route.ts`** — harde
   REST-instructie: AI mag geen training voorstellen bij REST

### Bug gevonden en gefixt tijdens eindcontrole
`geenAanpassingContext` (v2.4.318) zou bij REST ook afvuren met
`todayPlan.duration = null` — onzin-tekst ("null min is de originele
duur"). Nu expliciet uitgesloten bij `trainingDecision === 'REST'`, in
beide AI-routes.

### Integratietest-eis — belangrijkste regressietest, nog niet uitgevoerd
Als CoachDecision = REST, mag geen enkele downstream-route alsnog
TRAIN/ADJUST produceren. Volledige keten testen: REST → TodayPlan →
Home → Dagplan → Coach → Workout-endpoint. **Vergt een scenario met
een actieve blessure of ziekte-levensgebeurtenis — nog niet
organisch getest.**

## v2.4.318 — Twee vervolgfixes na productietest van v2.4.317
**Gemeld met screenshots, direct na het pushen van v2.4.317.**

### 1. AI verzon een vals "al gecorrigeerd"-verhaal
Getallen kloppen nu overal (84 min consistent) — Regel 0c's
numerieke garantie werkt. Maar de AI schreef: *"De -10% aanpassing is
al meegenomen... dus de 84 minuten is al het gecorrigeerde advies"* —
feitelijk onjuist, er was geen enkele aanpassing (geen signaal vuurde).

**Fix:** `geenAanpassingContext` (`api/coach/route.ts` +
`api/action-plan/route.ts`) expliciet uitgebreid — verbiedt nu ook
letterlijk de claim dat er al een correctie heeft plaatsgevonden, niet
alleen het verzinnen van een nieuw getal.

### 2. Dagplan negeerde de echte einddienst-tijd voor avondactiviteiten
Gemeld: "ga op tijd slapen" gepland om 23:30, terwijl de avonddienst
pas om 00:45 eindigt.

**Root cause:** de bestaande "plan niets tijdens werktijd"-instructie
in `api/action-plan/route.ts` gebruikte een voorbeeld met een normale
dagdienst (06:00-15:00) — bij een dienst die na middernacht eindigt,
viel de AI kennelijk terug op generiek bedtijd-advies i.p.v. de echte
eindtijd te respecteren.

**Fix:** expliciete instructie toegevoegd — ook avond/slaap-
gerelateerde acties moeten na de daadwerkelijke, exacte eindtijd
vallen, met het 00:45-scenario als concreet voorbeeld in de prompt
zelf.

### Twee gewijzigde bestanden
`api/coach/route.ts`, `api/action-plan/route.ts`.

**Nog te testen:** een scenario waarbij `fatigueSignaal` wél vuurt
(écht laag herstel + duurtraining) — tot nu toe alleen het "geen
aanpassing"-pad organisch bevestigd.

## v2.4.317 — Coach Decision Integrity, deel 2: fatigue uitgebreid + Regel 0c technisch afgedwongen
**Vervolg op v2.4.314-316. Overleg gebruiker + GPT: de "84/75/76
minuten"-bevinding was geen herhaling van eerdere bugs, maar een
dieper gat — de AI kon zelf trainingsparameters berekenen uit rauwe
Garmin/HRV-data, langs het gestructureerde signalensysteem heen.**

### Deel 1 — fatigue-signaal uitgebreid naar duurtrainingen
**Onderzocht vóór wijzigen:** het oorspronkelijke contract
(`docs/adaptive-training-plan-decision-contract-v1.md`) omschrijft
`fatigue_detected` breder dan de huidige implementatie. Geen ADR/
changelog-regel gevonden die de "alleen intervallen"-beperking als
bewuste, fysiologisch onderbouwde keuze vastlegt.

`adjuster-core.ts`: `vandaagSessie.type === adapter.hoogIntensiteitsType`
verwijderd — geldt nu voor elke geplande sessie bij laag herstel.
**Drempelwaarde ongewijzigd** (`recoveryState === 'low'`, confidence
65).

### Deel 2 — Regel 0c technisch afgedwongen, niet alleen als instructie
- **`api/coach/route.ts`:** nieuwe, expliciete "GEEN AANPASSING"-tak —
  als er geen signaal vuurde, mag de AI letterlijk geen eigen
  kortere duur meer voorstellen, ook niet op basis van HRV/Garmin.
  Garmin-context kreeg een expliciete kopregel: alleen voor uitleg,
  nooit voor trainingsparameter-berekening
- **`api/action-plan/route.ts`:** had de aanpassings-/geen-
  aanpassings-tekst nog helemaal niet (alleen coach/route.ts had 'm
  sinds v2.4.314) — nu identiek toegevoegd, plus dezelfde
  Garmin-grens

### Bewust niet gedaan
Geen database-migratie, geen tweede Adjustment Engine, geen nieuwe
drempelwaarden. Cycling's route (`training-plan-adjuster.ts`)
bevestigd een dunne wrapper om dezelfde `voerDailyAdjustmentUitCore()`
— profiteert automatisch mee, geen aparte wijziging.

### Getest tijdens implementatie
Balans-check op alle drie gewijzigde bestanden. Bevestigd:
`adapter`-parameter blijft elders in `adjuster-core.ts` gebruikt (geen
ongebruikte variabele). Cycling's wrapper-relatie expliciet
geverifieerd vóór aanname dat de fix daar ook aankomt.

**Nog niet getest in de draaiende app** — vergt een scenario met laag
herstel + een geplande duurtraining, controle dat kaart/Dagplan/
hoofdadvies nu consistent hetzelfde getal tonen.

## v2.4.316 — FIX: minuten-precisie ontbrak in de werktijden-instructie
**Gemeld met bewijs (screenshot echte event vs. coach-advies):
"14:00-00:00" i.p.v. de echte "14:45-00:45".**

### Root cause — mijn eigen fout, niet gecontroleerd vóór v2.4.315
`start_minute`/`end_minute` bestaan al sinds v2.4.196, specifiek voor
dit precisieprobleem gebouwd ("AI-invoer met 14:45 kon niet correct
worden opgeslagen"). Bij het schrijven van de v2.4.315-fix
(werktijden aan de coach-instructie toevoegen) heb ik niet
gecontroleerd of zulke velden al bestonden — precies de fout die
Architectuurregel #0 (consolidatie vóór nieuwbouw) had moeten
voorkomen.

### Fix
- `life-events-context.ts`: `start_minute`/`end_minute` toegevoegd aan
  `LifeEventRow` en de select-query (ontbraken)
- `context-resolver.ts`: `LifeEventInput` uitgebreid, nieuwe
  `formatUurMinuut()`-helper, `werkTijdenTekst` toont nu de echte
  minuten (`?? 0` als terugval voor rijen zonder ingevulde minuten —
  bestaand gedrag voor die gevallen blijft ongewijzigd)

**Geverifieerd met de exacte waarden uit de melding:**
`formatUurMinuut(14, 45) + '-' + formatUurMinuut(0, 45)` → `"14:45-00:45"`
— exacte match met het echte event.

## v2.4.315 — Vier gemelde bevindingen opgelost
**Overleg n.a.v. vier screenshots. Alle vier onafhankelijk onderzocht
(geen aannames), drie bevestigde bugs + één inconsistentie gevonden en
opgelost.**

### 1. "84 minuten" (kop) vs. "83 minuten" (blokken) — Cycling/Running
**Root cause:** de trainingsplan-detailpagina toonde de rauwe
`sessie.duration` in de kop, terwijl de losse workout-detail-fetch de
daadwerkelijk gebouwde blokken toont — twee bronnen, konden uit elkaar
lopen (zelfde bug-klasse als de "35 vs. 50 minuten"-bevinding).

**Fix:** `today-engine.ts`'s `berekenDefinitieveDuur()` geëxporteerd
en hergebruikt in de Cycling/Running `training-plan`-GET-routes —
berekent nu ook voor de sessie van vandaag de definitieve duur. Beide
pagina's tonen bij een verschil nu expliciet beide waarden
(doorgestreepte originele duur + definitieve duur). Rowing had deze
tekst niet, dus niet aangeraakt.

### 2. "Vakantie voorbereiden"-kaart verscheen zonder aanleiding
**Zelfde root cause als bevinding 3** (zie hieronder) — geen aparte
fix nodig, lost automatisch mee op.

### 3. "Vakantie — Over -22 dagen" op Home
**Root cause:** `coach-planning-overzicht.ts`'s `volgendeVakantie`
pakte simpelweg de EERSTE vakantie-rij op startdatum (oplopend
gesorteerd), zonder te checken of die al voorbij was. Bij twee
vakantie-events (oud + nieuw) won altijd de oude.

**Fix:** eerst filteren op "nog actueel (isEventActiefOpDag) of
toekomstig (start_time >= vandaag)" vóór de eerstvolgende gekozen
wordt.

### 4. Dagplan hield geen rekening met de avonddienst
**Root cause, genuanceerder dan eerst gedacht:** de levensgebeurtenis
werd wél degelijk correct gecategoriseerd als `'werk'`
(`context-resolver.ts`), maar de bijbehorende coach-instructietekst
was een **statische, generieke zin** zonder de daadwerkelijke tijden
— de AI wist dus dat er werk was, maar niet wanneer, en kon er
daardoor niet omheen plannen.

**Fix:** `bepaalDagContext()` zoekt nu het winnende werk-event met
`start_hour`/`end_hour` op en voegt de concrete tijden toe aan de
instructie (bijv. "...(17:00-23:00) — plan geen training in dit
tijdvak"). **Bonus:** deze functie wordt gedeeld door zowel
`action-plan/route.ts` (Dagplan) als `coach/route.ts` (Coach-chat) —
één fix, twee plekken tegelijk gecorrigeerd.

### Zeven gewijzigde bestanden
`today-engine.ts`, `api/specialists/cycling/training-plan/route.ts`,
`api/specialists/running/training-plan/route.ts`,
`coach/cycling/trainingsplan/page.tsx`,
`coach/running/trainingsplan/page.tsx`,
`coach-planning-overzicht.ts`, `context-resolver.ts`.

**Correctie tijdens onderzoek:** eerste aanname over bevinding 4
("life_events wordt nooit opgehaald") bleek bij nader inzien onjuist —
er bestond al een gedeeld ophaalmechanisme. De echte oorzaak (een
generieke instructie zonder concrete tijden) lag dieper. Niet
stilzwijgend gecorrigeerd — hier expliciet benoemd.

**Nog niet getest in de draaiende app** — vergt echte data voor elk
scenario (twee vakantie-events, een avonddienst vandaag, een
aangepaste Cycling/Running-sessie).

## v2.4.314 — Coach Decision Integrity geïmplementeerd (vacation_mode)
**Bouw-akkoord gebruiker + GPT (Claude eindverantwoordelijk), na
ontwerp (v2.4.313) en vier verificaties. Lost het "35 vs. 50
minuten"-gat definitief op: Home-kaart, trainingsplan en AI-tekst
gebruiken voortaan gegarandeerd dezelfde, daadwerkelijk uitgevoerde
workout-beslissing.**

### Kern
`training_plan_sessions.duration` blijft altijd onaangetast. Een
aanpassing (vakantie, vermoeidheid) is een runtime-beslissing —
Today Engine bouwt nu dezelfde workout als de detailpagina
(`bouwWorkout()` → signalen → `pasWorkoutAan()`), en leidt daaruit de
definitieve duur af via een nieuwe, pure `totaalDuurVanWorkout()` —
nooit uit `UniversalWorkout.duration_sec` zelf (dat veld wordt door
`pasWorkoutAan()` nooit herberekend, bevestigd tijdens verificatie).

### Acht gewijzigde bestanden
1. **`coach-planning-overzicht.ts`** — `LifeEventRij`/
   `isEventActiefOpDag()` geëxporteerd (waren lokaal) — hergebruikt
   voor vacation-detectie, geen nieuwe datalaag
2. **`adaptation.ts`** — `'vacation'` toegevoegd aan
   `AdaptationSignal['source']`; nieuwe `totaalDuurVanWorkout()`
3. **`adjuster-core.ts`** — Trigger 5 (vacation_mode) toegevoegd aan
   de bestaande Daily Adjustment Layer — geen database-mutatie, puur
   een signaal (zelfde categorie als het al-bestaande
   `fatigue_detected`)
4-6. **Cycling/Running/Rowing `training-plan/workout`-routes** — elk
   één regel: `vacationSignaal` meegenomen in de signalenlijst
7. **`today-engine.ts`** — `proposalNaarTodayPlan()` nu async, roept
   de volledige keten aan (nieuwe `berekenDefinitieveDuur()`-helper),
   met try/catch-terugval op de originele duur bij een fout.
   `TodayPlan` uitgebreid: `originalDuration`/`adjustmentReason`
8. **`api/coach/route.ts`** — AI-prompt toont origineel vs. definitief
   + reden expliciet wanneer ze verschillen, met een harde instructie:
   nooit een ander getal noemen dan wat hier gegeven wordt

### Idempotentie, bevestigd door constructie
De keten start altijd bij de pure, onaangetaste `duration`-kolom —
nooit bij een eerder resultaat. Herhaalde aanroepen geven dezelfde
uitkomst zolang signalen niet veranderen (geen 50→35→24,5-cascade).
Herstel is automatisch: vakantie voorbij → geen signaal meer →
volgende aanroep geeft weer de originele duur, niets terug te
schrijven.

### Meerdere signalen tegelijk
Bevestigd niet-optellend — `pasWorkoutAan()`'s bestaande
downscale-mechaniek wordt hooguit één keer toegepast, ongeacht het
aantal actieve signalen (vakantie + vermoeidheid + slecht herstel
geeft dus niet -30%-20%-15%).

### Niet aangeraakt, zoals gevraagd
Coach Decision Engine, Workout Matching, Coach Call-statusmachine,
Strava/Garmin Coach Call-logica, Trainer AI-pad, bestaande
injury/missed-session-architectuur — geen van allen gewijzigd.

### Getest tijdens implementatie
Balans-check (haakjes/accolades) op alle acht bestanden. Elke nieuwe
import expliciet tegen de bijbehorende export gelegd — na de eerdere
v2.4.305/306-importfout bewust extra zorgvuldig, geen fout meer
gevonden. Volledige, regel-voor-regel eindcontrole van
`today-engine.ts` en `adjuster-core.ts` (de twee grootste/meest
kritieke wijzigingen).

### Nog NIET getest — vergt de draaiende app
1. Normale sessie zonder signalen (50 → 50)
2. Alleen vakantie (50 → aangepast, kaart/trainingsplan/AI tonen
   dezelfde waarde)
3. Alleen fatigue/recovery (bestaande aanpassing blijft werken)
4. Vakantie + fatigue + recovery tegelijk (één aanpassing, geen
   cascade)
5. Signaal verdwijnt (originele planning komt automatisch terug)
6-8. Cycling/Running/Rowing, elk afzonderlijk
9. Herhaalde requests (identieke input → identieke output)
10-12. `duration_sec` niet als bron, `repeat`-blokken correct
   meegerekend, AI presenteert geen niet-bestaande parameter

**Vergt een echte vakantie-`life_event` + een geplande
specialist-sessie dezelfde dag om end-to-end te kunnen testen.**

## v2.4.313 — Coach Decision Integrity vastgelegd + vier verificaties afgerond
**Geen code. Ontwerp-stap D uit het overleg met gebruiker + GPT
(Claude eindverantwoordelijk) — vier gerichte verificaties, dan de
nieuwe invariant vastgelegd. Implementatie volgt pas na apart akkoord.**

### Vier verificaties, alle vier bevestigd met bewijs
1. **Rowing's workout-route** volgt exact hetzelfde signalenpatroon
   als Running — identieke imports/structuur, geen afwijking
2. **`WorkoutBlock.duration_sec`** is de betrouwbare bron per blok.
   **Extra bevinding:** het topniveau `UniversalWorkout.duration_sec`
   wordt door `pasWorkoutAan()` nooit herberekend na een aanpassing —
   blijft verouderd. Een totaalduur moet dus altijd vers uit de
   blokken gesommeerd worden, nooit uit dit veld gelezen
3. **Vakantie-detectie** kan de bestaande `isEventActiefOpDag()` +
   `life_events`-query hergebruiken — patroon bestaat al letterlijk in
   `coach-planning-overzicht.ts`
4. **Signaalcombinatie is bevestigd niet-optellend** — `pasWorkoutAan()`
   past de downscale-mechaniek precies één keer toe, ongeacht het
   aantal actieve signalen (voorkomt een 50→35→24,5-cascade)

### Coach Decision Integrity — nieuwe Regel 0c
Bredere, definitieve formulering van Regel 0b (AI Output Integrity):
elke gepresenteerde trainingsparameter (duur/intensiteit/afstand/
sets/herhalingen/gewicht/tempo/hartslagzone/rustduur) moet uit
dezelfde, daadwerkelijk uitgevoerde workout-beslissing komen — de AI
mag nooit zelf berekenen, aanpassen of vervangen.

### Ontwerp voor de implementatie vastgelegd (nog NIET gebouwd)
- Kern: `training_plan_sessions.duration` blijft altijd onaangetast —
  een aanpassing is een runtime-beslissing, nergens persistent
  opgeslagen (zelfde categorie als het bestaande fatigue-signaal)
- Today Engine moet dezelfde keten aanroepen die de detailpagina al
  gebruikt (`bouwWorkout()` → signalen → `pasWorkoutAan()`) — geen
  tweede interpretatie, geen nieuw/parallel systeem
- Idempotentie door constructie: altijd start bij de pure, onaangetaste
  bron — geen cascade mogelijk, herstel gebeurt vanzelf

**Status: alleen ontwerp + vastgelegde invariant. Wacht op apart
bouw-akkoord vóór implementatie.**

## v2.4.312 — AI Output Integrity Rule + Adaptation Engine-onderzoek beantwoord
**Geen code. Overleg met gebruiker + GPT (Claude eindverantwoordelijk,
zie standing rule), stap A en B van de afgesproken volgorde.**

### A — Nieuwe architectuurregel vastgelegd (Regel 0b)
**AI Output Integrity Rule:** de AI mag geen concrete
trainingsparameter (duur/intensiteit/afstand/sets/gewicht/tempo)
presenteren die niet uit een gestructureerde Coach-/Adjustment-
beslissing komt. Aanleiding: gevonden kaart/tekst-mismatch op Home
("Coach zegt 35 min, kaart zegt 50 min") — de AI noemde een getal dat
nergens in de data was vastgelegd.

### B — Onderzoeksvraag beantwoord: lopen specialistsessies door de Adaptation Engine?
**Gedeeltelijk ja, met exact bewijs, niet aangenomen:**
- `api/specialists/{sport}/training-plan/workout` (gedetailleerde
  workout-weergave) roept al `bouwWorkout()` + `pasWorkoutAan()` aan
- `today-engine.ts`'s `proposalNaarTodayPlan()` (de Home-kaart, waar
  de AI-tekst over praat) leest dezelfde `training_plan_sessions.
  duration`-kolom rechtstreeks — **nooit** de Adaptation Engine

**Consequentie voor het vervolgontwerp (nog niet gebouwd):** geen
nieuw/parallel systeem — Today Engine's kaart-logica moet aansluiten
op hetzelfde `pasWorkoutAan()`-mechanisme dat de detailpagina al
gebruikt. Dit is stap D uit de afgesproken volgorde, wacht nog op een
apart akkoord.

### Overig, vastgelegd maar niet uitgevoerd
- Locatietoestemming (vraag 1): bevestigd dat de app als PWA
  geïnstalleerd is — dus als het probleem aanhoudt ondanks de correcte
  60-min-cache, is er een ander probleem dan een simpel verlopen
  cache. Apart op te pakken (stap E), niet nu.
- "Connect 69"/slaapgegevens (vraag 3): derde screenshot niet
  beschikbaar — blijft open tot een nieuwe upload (stap F).

## v2.4.310 — Rowing Records/Progressie ("niet laten liggen")
**Het in v2.4.309 opengelaten gat alsnog gedicht, op expliciet
verzoek. Bij het uitwerken bleek de eigen eerdere inschatting te
zwaar — geen nieuwe tabel nodig, wel een klein, echt precisiegat
gevonden en gefixt.**

### Herziening van de aanpak
Running haalt records uit **losse lap-segmenten** binnen één langere
activiteit — vergt een aparte tabel (`running_distance_records`) +
parser-tijd-berekening (`tcx-parser.ts`+`afstandscurve.ts`). Roeiers
doen typisch een **hele sessie** exact als testafstand (2k-test,
5k-test) — geen sub-segment-extractie nodig. Daarom: query-time
afgeleid direct uit `activity_sessions`, geen nieuwe tabel, geen
parser-wijziging.

### Gevonden tijdens het bouwen: precisiegat
`activity_sessions.duration` is afgerond op hele minuten (7:32 zou
8:00 worden) — te grof voor een betekenisvolle PR. Nieuw, puur
additief veld in `concept2-result-processor.ts`:
`metrics.precieze_duur_sec` — Concept2 geeft dit al (tienden van een
seconde), nooit eerder bewaard. **Bestaande `duration`-afronding blijft
ongewijzigd** (CTL/ATL/TSB heeft er niets aan een preciezere waarde,
niet aangeraakt).

### `rowing-grafieken.ts` — twee nieuwe functies
- `haalRowingRecords()` — beste tijd per standaard testafstand
  (500/1000/2000/5000/6000/10.000m), ±2% tolerantie (vangt normale
  erg-stopvariatie op)
- `haalRowingAfstandTrends()` — chronologische reeks per testafstand,
  zelfde brondata, gedeelde filterlogica (`groepeerPerTestafstand()`)

### `api/specialists/rowing/grafieken` + `/coach/rowing/performance`
Beide uitgebreid met `records`/`afstand_trends` — Records-kaart en
Progressie-kaart, zelfde visuele patroon als Running's equivalenten.

### Eerlijke beperking, expliciet — niet stilzwijgend
**Alleen Concept2-sessies.** Garmin TCX heeft hetzelfde
afrondingsprobleem, maar `tcx-parser.ts` is gedeeld door alle sporten
— bewust niet in deze levering aangepast (groter risico dan de
Concept2-only-wijziging). Garmin-TCX-Rowing-sessies tellen dus nog
niet mee. Kleiner vervolgpunt dan de oorspronkelijke inschatting, maar
nog steeds een apart puntje.

### Extra controle na eerdere importfouten
Zelf-check vóór het toevoegen van de nieuwe functies: fresh live-fetch
van `rowing-grafieken.ts` vergeleken met het lokale werkbestand om
zeker te weten dat de basis klopte (niet een verouderde lokale versie
per ongeluk uitgebreid). Alle imports in de bijgewerkte route
nogmaals expliciet tegen de nieuwe exports gelegd vóór levering.

**Nog niet getest** — vergt een blik op de echte pagina met een
2k-test en/of 5k-test als losse, gesynchroniseerde Concept2-sessie.


## v2.4.311 — Halve marathon + marathon toegevoegd
**Gemeld: deze twee testafstanden ontbraken. Bevestigd vóór
toevoegen, niet aangenomen.**

Concept2's eigen ranking-documentatie (forumcitaat, direct van hun
site): *"500m, 1000m, 2000m, 5000m, 6000m, 10000m, 21097m, 42195m or
100,000m"* — 21097m (halve marathon) en 42195m (marathon) zijn dus
officiële Concept2-standaardafstanden, geen verzinsel. Exact dezelfde
waarden als Running's `PROGRESSIE_AFSTANDEN`.

`STANDAARD_TESTAFSTANDEN` (`rowing-grafieken.ts`) en de labellijst in
`/coach/rowing/performance/page.tsx` beide aangevuld. Geen wijziging
aan de tolerantielogica nodig (±2% blijft ruim genoeg, ook voor deze
langere afstanden — Concept2's preset-distance-workouts stoppen
sowieso automatisch exact op de ingestelde afstand).

## v2.4.309 — Rowing Performance Center
**Het bevestigde gat gedicht — Cycling/Running hadden dit al, Rowing
nu ook. Zelfde eerlijke aanpak: geen nieuwe formules verzinnen, alleen
bestaande data samengevoegd achter één scherm.**

### `rowing-grafieken.ts` — twee nieuwe functies
- **`haalRowingDashboard()`** — spiegelbeeld van `haalRunningDashboard()`.
  Roei-conventies: split per 500m (Concept2/British Rowing-standaard)
  i.p.v. pace/km, slagfrequentie i.p.v. cadans. Snelheid altijd
  afgeleid uit `distance/duration` — Concept2's eigen sync slaat geen
  los `avg_speed`-veld op (bevestigd, niet aangenomen), dus geen veld
  gebruikt dat er niet is
- **`haalWekelijkseRowingTrend()`** — spiegelbeeld van
  `haalWekelijkseRunningTrend()`, zelfde patroon

### `api/specialists/rowing/grafieken` — nieuwe route
Combineert Dashboard + CTL/ATL/TSB (bestond al, `haalRowingCTLATLTSB`)
+ Wekelijkse Trend. Spiegelbeeld van `api/specialists/running/grafieken`.

### `/coach/rowing/performance` — nieuwe pagina
E�n gecombineerd scherm i.p.v. Running's twee losse pagina's (bewust
compacter, sluit aan bij Cycling's single-page aanpak). Dashboard-
kaart, Trainingsbelasting-kaart met CTL/ATL-lijngrafiek, drie
wekelijkse-trend-staafdiagrammen (split/hartslag/slagfrequentie).
**Zelfde dependency-vrije SVG/CSS-grafiekcomponenten
(`LijnGrafiek`/`StaafGrafiek`) 1-op-1 hergebruikt van
`coach/running/grafieken/page.tsx`** — geen nieuwe chart-library,
geen nieuwe implementatie van iets dat al bestond.

### `/coach/rowing/page.tsx` — link toegevoegd
Nieuwe pagina was nergens vanuit de app bereikbaar — kaart toegevoegd,
direct onder de bestaande Trainingsplan-kaart.

### Bewust NIET meegenomen — expliciet benoemd, niet stilzwijgend
**Records en Afstand-trends.** Running's versie hiervan leest uit een
aparte tabel (`running_distance_records`), gevuld door parser-logica
tijdens TCX-import. Voor Rowing bestaat geen equivalente tabel of
import-tijd-berekening — een eigen, groter traject (nieuwe tabel +
parser-wijziging in `tcx-parser.ts`/de Concept2-sync), niet iets voor
deze levering.

### Extra zorgvuldigheid bij imports
Na de v2.4.305/306-importfout (verkeerd bestand voor Running's
drempelfunctie) dit keer expliciet alle imports in de nieuwe route
tegen de zojuist geschreven exports gelegd, vóór levering — niet
achteraf via een mislukte build ontdekt.

**Nog niet getest** — vergt een blik op de echte pagina, idealiter met
een ingevulde 2k-testtijd en wat Concept2-historie.

## v2.4.308 — Activiteiten-scherm: visuele verfijning (contrast/lucht)
**Overleg: witte kaarten (zoals de mockup) vs. donker (consistent met
de rest van de app). Besloten: donker blijft, met een lichte
tussenweg-verfijning voor iets meer contrast en witruimte.**

### Wijziging
`ActiviteitenSectie.tsx`:
- Alle 9 voorkomens van de hardcoded `bg-[#1c2128]` vervangen door het
  al-bestaande, gedeelde design-token `bg-coach-card` (`#1E293B`,
  hergebruikt van de standaard `Card`-component elders in de app —
  geen nieuwe kleur verzonnen, iets lichter dan de vorige waarde)
- Activiteitenkaarten en het Voortgang Dashboard-kaartje: subtiele
  rand toegevoegd (`border-coach-border/40`, eveneens een bestaand
  token) + padding `p-4` → `p-5` voor iets meer lucht

**Bewust ongewijzigd:** het algehele donkere kleurenschema, de overige
kaarten (sync-knoppen, loading-skeleton, compact-modus-statistieken) —
scope bewust beperkt tot wat besproken is, geen bredere restyling.

## v2.4.307 — FIX: verkeerde Garmin-dashboard-URL
**Gemeld door de gebruiker: `connect.garmin.com/modern/activities`
werkt niet.**

### Root cause
Deze URL was aangenomen, niet geverifieerd — ik kon 'm niet
betrouwbaar bevestigen via zoeken (Garmin's site is zwaar in
JavaScript, matig doorzoekbaar) en heb 'm destijds ingevuld zonder dat
hardop te benoemen als aanname. Zelfde soort fout als de
Running-import van v2.4.305/306, nu bij een URL in plaats van een
importpad.

### Fix
Vervangen door de URL die de gebruiker daadwerkelijk getest heeft op
een echt Garmin Connect-account:
```
https://connect.garmin.com/app/activities?activityType=All
```

### Les, herhaald
Een aanname die ik niet hardop als aanname benoem, wordt te makkelijk
als feit behandeld — ook door mezelf. Bij externe URL's die ik niet
sluitend kan verifiëren: dat expliciet zo melden, niet stilzwijgend
het meest waarschijnlijke antwoord invullen.

## v2.4.306 — FIX: build-fout, verkeerd geïmporteerd bestand
**De v2.4.305-build faalde op Vercel — mijn eigen fout, niet
gecontroleerd vóór levering.**

### Root cause
`import { berekenDrempelsnelheidKmh } from '@/lib/specialists/running-zones'`
— maar die functie zit in `running-grafieken.ts`, niet in
`running-zones.ts` (waar wél `berekenVDOT` zit). Bij het schrijven van
de import-regel per ongeluk allebei uit hetzelfde bestand aangenomen,
zonder dat apart terug te checken tegen de eerdere verificatie (die
wél het juiste bestand vond).

### Fix
Import gesplitst over de twee juiste bestanden:
```ts
import { berekenGeschatteRunningTSS, berekenDrempelsnelheidKmh } from '@/lib/specialists/running-grafieken'
import { berekenVDOT } from '@/lib/specialists/running-zones'
```
Ter controle nog eens alle vier TSS-gerelateerde imports (Cycling/
Running/Rowing) tegen de bevestigde bronbestanden gelegd — de andere
drie klopten al.

### Les
Balans-check (haakjes/accolades) vangt dit type fout niet — een
verkeerd geïmporteerd, wél bestaand symbool is syntactisch geldig.
Vergt een aparte, expliciete controle van elke import-regel tegen de
eerder-geverifieerde bronlocatie, niet alleen syntaxcontrole.

## v2.4.305 — Activiteiten-scherm-redesign (Stap 3, implementatie)
**Volledige verificatiefase (7 punten) vooraf doorlopen, geen aannames
— zie v2.4.304 en de chatgeschiedenis 8 augustus 2026 voor de details.
Screenshot-referentie van de gebruiker als UX-doel.**

### Belangrijke correctie tijdens de verificatiefase
`compact={true}` (bedoeld voor hergebruik binnen Voortgang) bleek
**nul consumers** te hebben — `progressie/page.tsx` importeert
`ActiviteitenSectie` niet meer sinds v2.4.93's terugdraai (bevestigd
via de navigatie-config, niet via het verouderde code-commentaar in
het component zelf). De prop blijft bestaan, maar beperkte het
ontwerp niet meer dan nodig.

### `GET /api/activities` — uitgebreid, server-side
- **`tss`/`intensiteit` per sessie** — geen nieuwe formule: de drie
  bestaande, geëxporteerde pure functies
  (`berekenGeschatteTSS`/`berekenGeschatteRunningTSS`/
  `berekenGeschatteRowingTSS`) rechtstreeks aangeroepen met de
  bestaande specialist-profiel-drempelwaarden. Wandelen: altijd
  `null`, geen formule
- **`bronLink` per sessie** — Concept2 naar de specifieke workout
  (`log.concept2.com/profile/{id}/log/{resultId}`, **nog niet
  handmatig geverifieerd**, wacht op Concept2's API-stabiliteit),
  Garmin/Strava naar hun algemene dashboard, Trainer AI/onbekend: geen
  link
- **`weekdoelMinuten`** — som van `beschikbare_uren_per_week × 60`
  over specialist-profielen, geen nieuw doelensysteem

### `ActiviteitenSectie.tsx` — uitgebreid
- Nieuw Voortgang Dashboard (alleen volledige pagina): Week/Maand
  (rollend 7/30 dagen), totalen, trend vs. vorige periode,
  weekdoel-voortgangsbalk (alleen bij "week")
- **Bug gefixt:** bronlabel toonde Concept2/Trainer AI ten onrechte
  als "Garmin" — nu een expliciete mapping
- Trainingsbelasting-regel met kleurcode (groen/blauw/rood) —
  "Trainingsbelasting"/TSS, bewust niet "Suffer Score"
- `getStravaActivityId()` verwijderd (dode code na de bronLink-
  vervanging)

### Ongewijzigd
`src/app/activities/page.tsx` (wrapper), `/activities/[id]/page.tsx`
(routekaart/Ritanalyse, unieke waarde, blijft bestaan),
`compact={true}`-gedrag zelf (2-kaarten-grid, ongewijzigde logica).

### Nog niet getest
Handmatige controle op de echte pagina met echte data volgt. Concept2-
deep-link blijft "gebouwd, niet geverifieerd" zolang Concept2's API
instabiel blijft.

## v2.4.304 — Concept2-deep-link-verificatietool (Activiteiten-scherm, voorbereiding)
**Geen nieuwe pagina — bestaande `/debug/concept2-webhook` uitgebreid,
zelfde discipline als de rest van deze week (hergebruik, niet
dupliceren).**

### Aanleiding
Vóór de Activiteiten-scherm-bouw eerst handmatig bevestigen dat
`log.concept2.com/profile/{concept2_user_id}/log/{resultId}` ook
daadwerkelijk naar de juiste training leidt — niet aannemen op basis
van twee forumberichten.

### Nieuw
- `GET /api/debug/concept2-webhook` — haalt nu ook één echte,
  bestaande `activity_session` met `source: 'concept2'` op, extraheert
  het result-ID uit `notes`, en bouwt de kandidaat-URL
- `/debug/concept2-webhook`-pagina — toont deze URL als klikbare link,
  met expliciete instructie: handmatig aantikken en controleren, niet
  automatisch aannemen dat het klopt

**Puur leesfunctionaliteit, geen schrijfactie, geen risico voor
bestaande data.**

## v2.4.303 — Twee notities vastgelegd: gesloten besluiten + Rowing-gat
**Geen code. Aanleiding: een extern voorstel (GPT) met verouderde
aannames over Coach Decision Engine/Matching-confidence, en een vraag
van de gebruiker of Rowing een eigen Performance Center mist.**

### Gesloten architectuurbesluiten, expliciet vastgelegd
Voorkomt dat een volgende sessie (of extern voorstel) dit opnieuw als
open beschouwt:
- Coach Decision Engine (Fase 1-3, v2.4.288-293) is af
- Workout Matching-confidence blijft volledig intern — geen Match
  Review UI, geen gebruikersvraag
- Matching en Coach Call blijven twee gescheiden vragen

### Bevestigd gat: Rowing Performance Center ontbreekt
Cycling (Power Center) en Running (Performance Center: VDOT/Pace
Curve/records/zones/progressie) hebben allebei een eigen pagina.
Rowing niet — `rowing-grafieken.ts` bestaat en werkt, voedt alleen het
gecombineerde platform-Performance-scherm, geen eigen zichtbare
pagina. **Expliciet afgesproken volgorde:** eerst het Activiteiten-
scherm afmaken, dan dit oppakken.

## v2.4.302 — MIJLPAAL: Fase 1-verificatie in productie geslaagd
**Geen code. De laatste, niet-via-debug-bevestigde onzekerheid van het
hele Workout Completion Platform is nu gesloten — 7 augustus 2026, een
echte training, geen simulatie.**

### Wat er gebeurde
Gebruiker rondde een geplande Rowing-sessie (31 min, "Duurtraining")
daadwerkelijk af, importeerde via "Sync nu" (webhook nog niet bruikbaar
door het aanhoudende Concept2-probleem). Resultaat, bevestigd met een
screenshot van de trainingsplan-pagina:

- **Workout Matching Service:** de sessie kreeg automatisch een groen
  vinkje — `completed`, zonder `[TEST]`-label. Eerste organische
  bevestiging van de volledige keten (Concept2-sync →
  `concept2-result-processor.ts` → Matching → `training_plan_sessions.
  status`), na een week van uitsluitend debug-tests en historische data.
- **Coach Decision Engine:** geen Coach Call — correct, want de sessie
  kwam exact overeen met de planning (31 gepland, 31 gedaan). Eerste
  organische bevestiging dat "geen afwijking → geen gesprek" ook in de
  praktijk klopt, niet alleen in de debug-simulator.

### Wat dit niet oplost
Het Concept2-webhook-probleem blijft (aparte, externe kwestie — zie
v2.4.301). "Sync nu" blijft het werkende, handmatige alternatief.

### Status
Hiermee is het volledige Workout Completion Platform + Coach Decision
Engine niet alleen gebouwd en via debug-tools getest, maar ook
één keer volledig organisch bevestigd in productie. Enige resterende
externe afhankelijkheid: de Concept2-webhook, voor automatische i.p.v.
handmatige sync.

## v2.4.301 — FIX: geen manier om Concept2 opnieuw te koppelen
**Root cause van waarom "verbreek en herverbind" (mijn eigen advies,
meerdere keren gegeven) niet werkte: die functie bestond niet in de
UI. Mijn fout — geadviseerd zonder de code te checken.**

### Root cause
`coach/rowing/page.tsx`: `{!concept2Verbonden ? <Verbind-link> :
<Sync nu-knop>}` — zodra `concept2Verbonden` true is, verdwijnt de
"Verbind"-link volledig. Er was dus letterlijk geen weg terug om de
OAuth-flow opnieuw te triggeren zodra je al gekoppeld was. Een leeg
`concept2_user_id` (v2.4.286) kon hierdoor nooit via de UI gerepareerd
worden, ongeacht hoe vaak "Sync nu" werd ingedrukt — die knop doet iets
compleet anders (nieuwe resultaten ophalen, geen OAuth).

### Fix
`coach/rowing/page.tsx`: naast "Sync nu" nu ook een kleine "Opnieuw
koppelen"-link, altijd zichtbaar zodra gekoppeld. Geverifieerd veilig:
`callback/route.ts` doet toch al een `upsert` (`onConflict: user_id`),
dus opnieuw autoriseren terwijl je al gekoppeld bent overschrijft de
bestaande rij netjes — geen aparte disconnect-stap nodig aan de
backend-kant, alleen de UI miste de ingang ernaartoe.

**Test-instructie:** ga naar `/coach/rowing`, tik nu op "Opnieuw
koppelen" (niet "Sync nu") — dat triggert de echte OAuth-flow, en zou
`concept2_user_id` alsnog moeten vullen als Concept2's API op dat
moment werkt. Controleer daarna via `/debug/concept2-webhook`.

## v2.4.300 — FIX: leeg concept2_user_id was onzichtbaar voor de gebruiker
**Gemeld: opnieuw koppelen loste een leeg `concept2_user_id` niet op,
zonder enig zichtbaar signaal waarom.**

### Root cause
`concept2/callback/route.ts` logde een mislukte `GET /api/users/me`-
aanroep alleen naar `console.error` — nergens zichtbaar in de app.
Bevestigd: v2.4.286/299 stonden al live, de code werkte zoals bedoeld,
maar als de aanroep naar Concept2 zelf faalde (waarschijnlijk: hun API
had op dat moment ook problemen, gezien de bekende 502-storing van de
site zelf), kreeg de gebruiker gewoon "succesvol gekoppeld" te zien —
geen enkele aanwijzing dat er iets miste. Precies het patroon dat de
eigen debugstrategie (§15, iPhone-first) wil voorkomen: nooit alleen op
console vertrouwen.

### Fix
- `callback/route.ts`: bij een geslaagde koppeling zonder
  `concept2_user_id` een extra query-param
  (`concept2_user_id_ontbreekt=1`) mee terug
- `coach/rowing/page.tsx`: toont in dat geval een aparte, duidelijke
  waarschuwing i.p.v. het gewone "succesvol gekoppeld" — legt uit dat
  Sync nu blijft werken, maar de webhook niet, en verwijst naar
  `/debug/concept2-webhook` om het later te verifiëren

**Geen wijziging aan de onderliggende logica** — de `GET /api/users/
me`-aanroep zelf functioneert zoals bedoeld, dit maakt alleen een al
bestaand faalscenario zichtbaar i.p.v. stil.

**Blijft afhankelijk van Concept2's eigen stabiliteit** — als hun API
op het moment van koppelen zelf een probleem heeft, zal een
herverbinding blijven mislukken totdat dat is opgelost. Deze fix zorgt
er alleen voor dat je dat nu kan ZIEN i.p.v. te gokken.

## v2.4.299 — Concept2-webhook debug-tool + Coach Inbox (eerste signaal)
**Twee builds tegelijk, op verzoek: "bouw alle twee".**

### 1. Concept2-webhook Debug Simulator
`/debug/concept2-webhook` — test de webhook-verwerkingslogica zonder
op een echte Concept2-push te wachten. Twee stappen:
1. **Koppelingsstatus** — checkt of `concept2_tokens.concept2_user_id`
   gevuld is (zonder dit zou de echte webhook de gebruiker nooit
   herkennen — vaak de eerste reden waarom "het doet niks" bij een
   bestaande, oude koppeling)
2. **Volledige verwerking** — simuleert een `result-added`-payload,
   roept exact dezelfde `verwerkConcept2Resultaat()` aan die de echte
   webhook ook gebruikt (insert/matching/Coach Decision Engine/dedup)

**Eerlijke grens, expliciet in de code en de UI benoemd:** test NIET
het geheime pad-segment (`CONCEPT2_WEBHOOK_SECRET`) zelf — dat vergt
een echte externe HTTP-aanroep, niet iets wat een ingelogd debug-
scherm zinvol kan nadoen zonder de beveiliging te omzeilen.

### 2. Coach Inbox — Fase C, eerste signaal
Vakantie-pauze-voorstel: als een vakantie binnen 7 dagen begint (nog
niet gestart) én er actieve trainingsplannen zijn, verschijnt een
kaart op Home. "Ja, pauzeren" pauzeert alle betrokken sporten in één
tik (dezelfde `training_plans.status → 'paused'`-mutatie als de
bestaande, losse pauzeer-knoppen per specialist).

**Consolidatie, geen nieuwbouw:** hergebruikt `haalOverzichtData()`
(bestond al) voor de vakantie-data, geen nieuwe query verzonnen.

**Nieuw:**
- `lib/coach/coach-inbox.ts` — `evalueerCoachInboxSignalen()` +
  `pauzeerTrainingsplannen()`
- `api/coach-inbox/route.ts` — GET signalen, POST actie
- `home/page.tsx` — nieuwe kaart, direct onder de bestaande
  meldingen-secties, boven "Vandaag van je Coach"

**Bewust simpel gehouden voor een eerste versie:** "Niet nu" verbergt
de kaart alleen voor de huidige sessie (geen permanente dismissal-
opslag) — als daar behoefte aan blijkt, een latere toevoeging.

**Nog niet getest, geen van beide** — vergt respectievelijk een echte
Concept2-koppeling met gevuld `concept2_user_id`, en een geplande
vakantie binnen 7 dagen om te zien verschijnen.

## v2.4.298 — Documentatie: Coach Agenda-status rechtgezet + "Snel instellen" toegevoegd
**Geen code. Nieuwe staande afspraak: documentatie altijd bijhouden,
niet pas na een expliciet verzoek (opgeslagen in Claude's geheugen).
Eerste toepassing: bij een screenshot-check bleek het README zichzelf
tegen te spreken over Coach Agenda's status.**

### Wat er fout stond
Regel "Fase B-D blijven visie, niets gebouwd" sprak de paar regels
erboven tegen, die juist specifiek beschreven wat er wél gebouwd was
(tekst-invoer v2.4.188, Coach Vooruitblik-kaart v2.4.201). Rechtgezet:
expliciet onderscheid tussen wat wél (tekst-invoer, Vooruitblik-kaart,
Snel instellen) en wat niet (spraak, Quick Cards, Rule Engine, Fase
C/D) gebouwd is.

### Nieuw gedocumenteerd — bestond al, was nooit beschreven
`SnelInstellenRij` (`coach-planning/page.tsx`) — drie knoppen (🏖️
Vakantie, 🤒 Ziek, 🩹 Blessure). Geen AI, geen aparte logica: Vakantie/
Ziek zetten het type voor en openen dezelfde bottom-sheet als een
handmatige toevoeging, Blessure linkt door naar de bestaande
`/injuries`-module. Expliciet niet te verwarren met "Quick Cards" (de
AI-geïnterpreteerde bevestigingskaarten uit de Fase B-visie) — dat
blijft ongebouwd.

## v2.4.297 — FIX: "Vakantie — Over -16 dagen" op Home
**Gemeld met screenshots: Home's Coach Vooruitblik toonde een negatief
dagen-getal voor een lopende vakantie, terwijl /coach-planning correct
"Nu bezig" toonde voor dezelfde vakantie.**

### Root cause
`dagenTot()` in `home/page.tsx` rekende alleen dagen-tot-STARTdatum uit
— geen enkele check of het huidige moment al voorbij die startdatum
lag maar nog vóór de einddatum (dus: een lopende periode). De data zelf
bevatte de einddatum al (`vooruitblik.volgendeVakantie.eindDatum`,
onderdeel van de al-bestaande `/api/coach-planning/overzicht`-response
die beide schermen delen), maar Home's rendering gebruikte dat veld
nooit. `/coach-planning`'s eigen "Overzicht"-tab had kennelijk wél een
losse, correcte check — vandaar het verschil tussen de twee schermen
voor exact dezelfde onderliggende data.

### Fix
Nieuwe helper `labelMetPeriodeCheck()`: als een item een `eindDatum`
heeft én vandaag daartussen valt → "Nu bezig", anders het bestaande
dagen-tot-start-label. Toegepast op vakantie (het enige vooruitblik-
item met een einddatum in het huidige schema) — generiek genoeg
geschreven om ook te gelden zodra een ander vooruitblik-item ooit een
einddatum krijgt, niet een vakantie-specifieke patch.

**Geen wijziging aan** `/api/coach-planning/overzicht` zelf (de
backend-data was al correct — beide schermen gebruiken 'm, alleen
Home's eigen weergavelogica miste de periode-check) of aan
`/coach-planning`'s eigen Overzicht-tab (die was al correct).

## v2.4.296 — FIX: locatietoestemming werd te vaak opnieuw gevraagd
**Gemeld: de iOS-locatietoestemmingsvraag verscheen bij vrijwel elk
bezoek aan Home.**

### Root cause
`src/app/home/page.tsx`'s `visibilitychange`-listener riep
`vraagGpsEnHaalWeerOp()` aan bij ELKE terugkeer naar de voorgrond
(schermontgrendeling, tussen apps wisselen, etc. — op mobiel heel
frequent), en elke aanroep deed een nieuwe
`navigator.geolocation.getCurrentPosition()`-aanvraag zonder enige
cache. Elke aanvraag kan de systeem-toestemmingsvraag opnieuw tonen,
afhankelijk van hoe iOS/Safari de toestemming voor dit specifieke PWA-
scenario cachet.

### Fix
`localStorage`-cache toegevoegd (`coachos_weer_cache_v1`, 60 minuten
geldig). Bij een verse cache: weerdata direct tonen, GEEN nieuwe GPS-
aanvraag — dus ook geen nieuwe toestemmingsvraag. Bewust niet langer
dan 60 minuten, want "opnieuw ophalen tijdens reizen" (de
oorspronkelijke reden voor de visibilitychange-listener, v2.4.168) moet
een werkende functie blijven — deze fix lost alleen de te-frequente-
aanvraag op, niet de onderliggende functionaliteit. Bij een
`localStorage`-fout (bijv. volle quota in privémodus): valt terug op
het oude gedrag, geen regressie.

**Nog steeds ongewijzigd:** de GPS-eerst/IP-als-vangnet-volgorde
(v2.4.168), de foutafhandeling/logging (v2.4.181), de weather-API zelf.

## v2.4.295 — Eindopschoning: platform-status definitief bijgewerkt
**Geen code. Twee verouderde, tegenstrijdige regels rechtgezet die nog
"niet bevestigd"/"nog niets gebouwd" zeiden over dingen die inmiddels
wél afgerond waren — gevonden bij een laatste doorloop op verzoek van
de gebruiker ("systeem is eindelijk gebouwd?").**

### Wat er nog verouderd stond
- Detail-checklist (regel ~326): Intelligence/Knowledge Platform stond
  nog op "bewust NIET nu oppakken... niet bevestigd" — de verkenning
  (v2.4.294) had dit al beantwoord, alleen de samenvatting bovenaan was
  bijgewerkt, deze regel verderop niet
- Eind-statusalinea: zei nog "Coach Decision Engine (analyse compleet,
  nog niets gebouwd)" — Fase 1/2/3 waren toen al lang gebouwd
  (v2.4.288-293)

### Definitieve eindstatus
Het platform (Workout Completion Platform, Activity Bridge, Source
Priority Policy, Coach Decision Engine, Intelligence/Knowledge
Platform) is afgerond. Wat resteert is geen bouwwerk meer:
- Fase 1-verificatie in productie — wacht op 7/9 augustus
- Concept2-webhook-test — wacht op Concept2's eigen site
- Coach Decision Engine's signalen — nog nooit organisch gezien

Strength als volwaardige specialist blijft bewust buiten scope, op
uitdrukkelijk verzoek van de gebruiker ("kan altijd later").

## v2.4.294 — Intelligence/Knowledge Platform-verkenning afgerond
**Geen code. Stap 2 van "het platform af" — precies zoals
Architectuurregel #0 voorschrijft: eerst vaststellen of het al bestaat,
vóór er iets gebouwd wordt.**

### Intelligence Platform — bestaat al
`beslisTussenSpecialisten()` (`lib/specialists/decision-engine.ts`),
samen met `genereerCoachPolicy()` en `api/coach/route.ts`, doet al
precies wat het oorspronkelijke Intelligence Platform-ontwerp
beschreef: volledig deterministisch (expliciet zo gedocumenteerd —
"geen AI"), combineert meerdere specialist-samenvattingen tot één
besluit via vaste regels (blessures/verhoogd risico > periodisering,
herstel > gecombineerde belasting, doelbelangrijkheid, berekende
urgentie als tiebreaker), met reasoning erbij voor uitlegbaarheid.

### Knowledge Platform — bestaat al
Zes oefeningenbibliotheken (`kettlebell/bodyweight/strength/mobility/
recovery/running-drills-exercises.ts`) — al ontdubbeld sinds v2.4.7,
Core Architectuurregel #1 ("Libraries are the source of truth") is
hier al jaren van toepassing. Plus master-spec-documenten (bijv.
`docs/running-specialist-master-spec.md`, expliciet "goedgekeurde
master-spec voor een compleet analyseplatform") en de bestaande Sport
Adapters.

### Conclusie
Geen aparte "Platform"-laag bouwen — dat zou precies de dubbele logica
creëren die Architectuurregel #0 wil voorkomen. Deze verkenning is
zelf het antwoord: consolidatie bevestigd, geen bouwopdracht volgt.

### Status: alle drie de openstaande architectuur-vraagstukken van
vandaag afgerond (dedup-consolidatie, Coach Decision Engine
Fase 1-3, Intelligence/Knowledge Platform-verkenning). Resteert alleen
nog Strength als specialist — bewust apart gehouden, geen platformwerk.

## v2.4.293 — Coach Decision Engine, Fase 3 (cumulatieve belasting)
**Opdracht: "Stap 1. Geen losse eindjes. Afmaken" — het bewust
opengehouden gat uit Fase 2 (v2.4.292) alsnog gedicht, op verzoek van
de gebruiker die het platform (los van Strength) volledig af wil
hebben.**

### Twee nieuwe signalen, beide consolidatie
- **Meerdere sessies dezelfde dag** — `activity_sessions`, telling
  per datum, drempel 2
- **Herhaald overslaan** — `training_plan_sessions`,
  `status='skipped'` (exacte waarde geverifieerd in
  `adjuster-core.ts`'s `missed_session`-trigger, niet aangenomen),
  laatste 14 dagen, drempel 3× (zelfde voorbeeldgetal als de
  architectuuropdracht zelf: "je hebt drie trainingen overgeslagen")

Beide gecontroleerd vóór de Fase 1-planningscheck, zelfde reden als de
Fase 2-signalen: een sessie kan matchen met het plan én alsnog
coachwaardig zijn.

### Opschoning tijdens het samenvoegen
De eigen-sport-plan-lookup (`training_plans` waar `sport`+`active`)
werd twee keer apart uitgevoerd — één keer voor het herhaald-overslaan-
signaal, één keer voor de bestaande Fase 1-planningscheck. Samengevoegd
tot één query (`eigenPlan`), niet dubbel bevraagd.

### Fout gevonden en gefixt vóór levering, niet erna
Bij het herschikken van de signalen (comment-block voor Fase 3 ervoor
geplaatst) raakte de `export interface CoachCallBehoefte {`-declaratie
zelf per ongeluk kwijt — de comment overschreef de regel in plaats van
ervoor te komen, wat een compile-fout zou hebben gegeven. Opgemerkt bij
de verplichte volledige-bestand-doorlezing vóór levering (niet via een
latere test of bugmelding).

### Status: Coach Decision Engine compleet voor de huidige scope
Alle signalen uit de architectuuropdracht zijn nu gedekt: planning-
vergelijking, cross-sport, blessure, herstel, cumulatieve belasting.
Alle drie ingest-routes (Concept2/Garmin TCX/Bibliotheek) geven de
sessieduur al mee sinds Fase 2, geen wijziging nodig aan de
aanroeppunten voor deze Fase 3-toevoeging.

**Nog niet getest** — vergt scenario's met meerdere sessies/dag of een
herhaald-overslaan-patroon, geen debug-tool gebouwd deze keer.

**Nog steeds ongewijzigd:** Fase 1/2-logica verder, Workout Matching
Service, Activity Bridge, Source Priority Policy.

## v2.4.292 — Coach Decision Engine, Fase 2 + nieuwe architectuurregel
**Verkenning bevestigde opnieuw het patroon dat deze hele week
terugkwam: alles bleek al te bestaan. Bron: gebruiker, 5 augustus
2026.**

### Nieuwe, expliciete architectuurregel (Core Architectuurregels #0)
*"Nieuwe functionaliteit mag pas gebouwd worden nadat expliciet is
vastgesteld dat de benodigde logica niet al elders in CoachOS bestaat.
De standaardaanname is consolidatie en hergebruik, niet nieuwbouw."*
Vastgelegd na herhaalde bevestiging over meerdere audits heen (Platform
Audit, Dataflow Audit, deze Coach Decision Engine-verkenning).

### Fase 2 — drie nieuwe signalen, alle drie consolidatie
- **Blessure:** `injuries`-tabel (`active=true`) — exact dezelfde query
  die `genereerCoachPolicy()` zelf al intern doet
- **Herstel:** `genereerCoachPolicy()`'s kant-en-klare `recoveryState`
  ('low'/'moderate'/'good') — geen aparte `calculateRecoveryScore()`-
  aanroep nodig, CoachPolicy wrapt dat al. Alleen relevant bij een
  sessie ≥20 min (drempel tegen ruis bij korte activiteiten)
- **Cross-sport:** nieuwe query (andere sport gepland dezelfde dag),
  bestaande tabellen — geen nieuwe databron

Alle drie gecontroleerd VÓÓR de Fase 1-planningscheck: een sessie kan
matchen met het plan én alsnog coachwaardig zijn (bijv. wél volgens
schema getraind, ondanks een actieve blessure).

**Bewust NIET meegenomen: cumulatieve belasting** (meerdere zware
trainingen/herhaald overslaan) — vergt een periode-analyse (meerdere
dagen tegelijk), een ander soort vraag dan de per-activiteit-signalen
hierboven. Apart traject, niet stilzwijgend overgeslagen.

### Naamgeving — bewust NIET gewijzigd
Voorstel was "Coach Decision Service/Layer" — inhoudelijk juist
(bestandsnaam `coach-decision-engine.ts` beschrijft nu een pure
aggregator, geen eigen berekeningen), maar een file-rename zou de drie
al-gekoppelde aanroeppunten onnodig laten schuiven zonder functionele
winst. Documentatie in de module-comment zelf past de framing wel aan.

### Aangesloten
Alle drie bestaande aanroeppunten (Concept2/Garmin TCX/Bibliotheek)
geven nu ook de sessieduur mee — nodig voor het herstel-signaal.

**Nog niet getest** — vergt een scenario met een actieve blessure of
lage herstelscore, geen debug-tool gebouwd deze keer.

**Nog steeds ongewijzigd:** Fase 1-logica zelf, Workout Matching
Service, Activity Bridge, Source Priority Policy.

## v2.4.291 — Roadmap opgeruimd: stale checkbox + samenvattend overzicht
**Geen code. Gevonden op verzoek van de gebruiker ("buiten de laatste
specialist is alles gedaan?") — één stale checkbox rechtgezet, en een
betrouwbaar samenvattend blok toegevoegd zodat de status niet meer
tussen oudere, gedetailleerde regels verdwaalt.**

### Wat er fout stond
Een `[ ]` bij het Fase 3/Bibliotheek-punt stond al sinds de eerdere
herziening (5 augustus, na de Datamodel-analyse) ten onrechte nog op
"open" — het was toen al inhoudelijk vervangen door de Activity Bridge.
Puur een markdown-checkbox die nooit werd omgezet, geen echt
openstaand werk.

### Nieuw — samenvattend openstaand-blok, bovenaan de roadmap-sectie
Twee categorieën, eerlijk onderscheiden:
- **Wacht op een externe gebeurtenis** (Fase 1-verificatie: 7/9
  augustus; Concept2-webhook-test: wacht op Concept2's site)
- **Nog niet gebouwd, geen externe blokkade** (Strength-specialist,
  Coach Decision Engine Fase 2, Intelligence/Knowledge Platform)

## v2.4.290 — Coach Decision Engine: kritieke fix + Fase 3 (Bibliotheek)
**Twee dingen: een fix die vóór schade ontdekt is, en de laatste van
de vier ingest-routes gemigreerd.**

### Kritieke fix — geen_actief_plan gaf ten onrechte nodig:false
Gevonden vóór het bouwen van Fase 3, niet via een bugmelding.
`evalueerCoachCallBehoefte()` gaf bij "geen actief trainingsplan"
`nodig: false` terug — leek veilig voor Concept2/Garmin TCX (meestal
wél een plan), maar was al een stille regressie: de oude logica in
alle vier bronnen maakte ALTIJD een Coach Call, ongeacht plan. Iemand
zonder actief plan kreeg dus na de eerdere migraties opeens geen
evaluatie meer.

**Zou Fase 3 hard gebroken hebben:** Strength/Kettlebell/Bodyweight
hebben per ontwerp NOOIT een Training Plan Engine (Final Architecture,
expliciete regel) — "geen plan" zou daar dus altijd gelden, en Coach
Call zou voor die sporten nooit meer afgaan. Gecorrigeerd:
`geen_actief_plan` → `nodig: true`. Geen plan is zelf onzekerheid,
dus voorzichtigheidshalve wél vragen — behoudt het oude, veilige
gedrag. Werkt automatisch door in Concept2 en Garmin TCX, geen aparte
fix per bestand nodig.

### Fase 3 — Bibliotheek gemigreerd
`training/complete/route.ts`'s oude, onvoorwaardelijke Coach Call-
aanmaak vervangen door de Decision Engine.

**`coach-call-writer.ts` uitgebreid** met `trainingResultId` als
alternatief voor `activiteitId` — `coach_call_items` bediende al twee
brontypes via twee wederzijds-nullable kolommen (zie README-sectie
"Coach Call Systeem"); deze functie ondersteunt nu beide, met
applicatie-validatie dat precies één van de twee gevuld is (zelfde
waarschuwing die het README zelf al gaf bij de vorige nieuwe bron).

**Opschoning, niet alleen migratie:**
- Oude, handmatige "bestaat de call al, is dit item al toegevoegd"-
  check verwijderd — `schrijfCoachCallItem()` doet die idempotency-
  check nu zelf al intern
- `withRetry()` (v2.4.9, retry-wrapper specifiek voor de oude
  coach_call-aanmaak) — enige gebruik zat in de nu-vervangen logica,
  dus verwijderd i.p.v. dode code te laten staan

### Status: alle vier bronnen gemigreerd
Concept2 (v2.4.288) → Garmin TCX (v2.4.289) → Bibliotheek (v2.4.290).
**Strava bewust overgeslagen** — ligt stil (Operationele context, 5
augustus), geen prioriteit zolang er geen nieuwe data binnenkomt.

**Nog steeds ongewijzigd:** Workout Matching Service, Activity Bridge,
Source Priority Policy.

## v2.4.289 — Coach Decision Engine, Fase 2 (Garmin TCX)
**Vervolg op v2.4.288 — zelfde incrementele opbouw als Workout
Matching (Rowing eerst bewijzen, dan uitbreiden).**

### Garmin TCX gemigreerd
Oude, onvoorwaardelijke Coach Call-aanmaak (nieuwe-insert-pad)
vervangen door de Coach Decision Engine — zelfde patroon als Concept2.

**Bewust ONGEWIJZIGD gelaten:** het overschrijf-pad (her-upload van
hetzelfde TCX-bestand) — dat werkt al correct anders (update van de
duur op een bestaand `coach_call_item`, geen nieuwe call aanmaken).
Geen "moet ik hier iets aanmaken"-beslissing, dus geen Decision Engine
nodig op dat pad.

### Bug gevonden en gefixt tijdens het bouwen zelf
Eerste versie van de wijziging nam aan dat een `sportSleutel`-variabele
uit de matching-aanroep (hoger in het bestand) hergebruikt kon worden.
Bleek lokaal gescoped binnen `probeerMatching()`, niet beschikbaar op
de nieuwe plek — bij het schrijven zelf opgemerkt (code-review op
mezelf), niet via een latere test. Rechtgezet: sport-sleutel wordt op
de nieuwe plek opnieuw opgezocht via de al-bestaande
`ACTIVITEIT_NAAM_NAAR_SPORT_SLEUTEL`-mapping.

### Resterend
Strava en Bibliotheek behouden nog hun oude, directe aanmaaklogica —
volgen later, één voor één.

**Nog steeds ongewijzigd:** Concept2 (v2.4.288, apart), Workout
Matching Service, Activity Bridge.

## v2.4.288 — Coach Decision Engine, Fase 1 (Concept2)
**Bron: docs/guardian-mode-coach-call-trigger-v1.md (v1.2), Final
Architecture Update (gebruiker, 5 augustus 2026).**

### Scope, bewust beperkt
Twee bewuste beperkingen, geen aannames:
1. **Vergelijkingsfunctie:** alleen "was er een geplande sessie voor
   deze sport op deze datum" (rustdag-toch-getraind/extra-training/
   ondanks-annulering). Cross-sport-vergelijking, Recovery/HRV,
   blessureprotocol-naleving en cumulatieve belasting zijn NIET gedekt
   — vergen bredere, nog niet geverifieerde signaalbronnen. Expliciet
   Fase 2, niet stilzwijgend weggelaten.
2. **Eerste toepassing: alleen Concept2.** Bewust gekozen — Concept2
   had NUL bestaande Coach Call-logica (nevenbevinding uit de
   Guardian Mode-analyse), dus dit is de enige plek zonder oude code om
   te ontmantelen. Garmin TCX/Strava/Bibliotheek behouden hun oude,
   directe aanmaaklogica — bewust niet aangeraakt in deze levering.

### Nieuw
- **`coach/coach-decision-engine.ts`** —
  `evalueerCoachCallBehoefte(supabase, userId, sport, datum)`. Eigen,
  directe databasequery i.p.v. `bepaalTodayPlan()` (today-engine.ts)
  hergebruiken — die laatste vergt een cookieHeader/baseUrl
  (request-context, voor interne API-aanroepen) en is dus niet bruikbaar
  vanuit een achtergrondproces. Zelfde onderliggende tabel
  (`training_plan_sessions`) rechtstreeks bevraagd, geen duplicatie van
  businesslogica.
- **`coach/coach-call-writer.ts`** —
  `schrijfCoachCallItem(supabase, userId, datum, item)`. Schema en
  aanmaakpatroon ("zoek bestaande call, voeg toe of maak aan, heropen
  indien nodig") 1-op-1 hergebruikt van de bestaande logica in
  `api/coach-calls/route.ts` (Strava-pad) — geen nieuw schema verzonnen.
  Idempotent: een dubbele aanroep voor dezelfde activiteit levert geen
  dubbel item op.
- **`coach_call_items.deviation_reason`** (SQL) — puur additief, de
  bestaande vier aanmaakplekken vulden dit nooit (geen "waarom"-
  classificatie), breekt niets aan bestaande rendering.

### Aangesloten op `concept2-result-processor.ts`
Na matching/dedup, in try/catch (fout hier mag de import zelf nooit
laten falen).

### SQL
```sql
alter table coach_call_items add column if not exists deviation_reason text;
```

### Nog niet getest
Geen debug-tool deze keer (zou een test-`training_plan_sessions`-
scenario vergen). Vergt een echte Concept2-sync op een dag met/zonder
geplande sessie.

**Nog steeds ongewijzigd:** Garmin TCX/Strava/Bibliotheek's bestaande
Coach Call-aanmaaklogica, Workout Matching Service zelf.

## v2.4.286 — Concept2-webhook gebouwd
**Bron: docs/workout-completion-platform-adr-v1.md, Addendum (4
augustus 2026) + roadmap-punt 1 (5 augustus 2026).**

### Onderzoek vóór het bouwen
Concept2's officiële API-documentatie (log.concept2.com/developers/
documentation/, Webhook-sectie) volledig doorgelezen. Bevestigd, niet
aangenomen:
- **Geen signature/HMAC-verificatie beschikbaar** — Concept2 biedt dit
  simpelweg niet (in tegenstelling tot bijv. Schlage/FreshBooks)
- Webhook-payload bij `result-added`/`result-updated` bevat wél
  Concept2's eigen `user_id`
- Webhook-payload bij `result-deleted` bevat **geen** `user_id`, alleen
  `result_id` — een grens van Concept2's eigen ontwerp
- `concept2_tokens` sloeg Concept2's eigen user-id nooit op
  (geverifieerd in `concept2/callback/route.ts` — geen
  `GET /api/users/me`-aanroep aanwezig)

### Nieuw
- **`concept2_tokens.concept2_user_id`** (SQL, zie hieronder)
- **`concept2/callback/route.ts`** uitgebreid: na de token-uitwisseling
  een `GET /api/users/me`-aanroep, resultaat opgeslagen. Eigen
  try/catch — een fout hier mag de OAuth-koppeling zelf niet laten
  mislukken (de bestaande "Sync nu"-knop blijft werken, alleen de
  webhook zou dan niet werken voor die gebruiker)
- **`specialists/concept2-result-processor.ts`** — de per-resultaat-
  verwerking (idempotency/metrics/Universal Athlete State/matching/
  dedup) geëxtraheerd uit `concept2/sync/route.ts`'s for-lus. Gedrag
  1-op-1 ongewijzigd (pure extractie) — nodig omdat de webhook exact
  dezelfde stappen nodig heeft voor één resultaat i.p.v. een lijst.
  `concept2/sync/route.ts` zelf aangepast om deze gedeelde functie aan
  te roepen, geen dubbele logica meer tussen de twee routes.
- **`api/webhooks/concept2/[secret]/route.ts`** — de webhook zelf.
  Beveiliging: geheim pad-segment (404 bij mismatch, niet 401/403) +
  validatie tegen `concept2_user_id`. Bij `result-deleted`: eigenaar
  bepaald via de bestaande `activity_sessions`-rij (geen vooraf-
  validatie mogelijk, zie boven). Retourneert bewust altijd HTTP 200,
  ook bij een interne fout — een 500 zou Concept2 laten retryen, wat
  bij een eigen bug geen zin heeft.

### SQL
```sql
alter table concept2_tokens add column if not exists concept2_user_id bigint;
create index if not exists idx_concept2_tokens_concept2_user_id on concept2_tokens(concept2_user_id);
```

### Handmatige stap, niet te automatiseren
De webhook-URL zelf registreren in Concept2's developer-portal
(`log.concept2.com/developers`) — vergt de `CONCEPT2_WEBHOOK_SECRET`-
omgevingsvariabele (zelf te kiezen, willekeurige lange string) in de
uiteindelijke URL.

### Nog niet getest
Vergt een echte Concept2-webhook-registratie — geen debug-tool voor
gebouwd (in tegenstelling tot Workout Matching/Activity Bridge), omdat
dit een extern systeem is dat CoachOS aanroept, niet andersom — lastig
zinvol te simuleren zonder de registratie zelf.

## v2.4.285 — Documentatie-inhaalslag: alle analysedocumenten van 5 augustus naar de repo
**Geen code. Sluit de architectuurronde van vandaag formeel af — alle
tussentijds gedeelde analyses staan nu in `docs/`, niet langer alleen
als losse bestanden buiten de repo.**

### Nieuw toegevoegd (stonden nog niet in de repo)
- `docs/data-model-analysis-v1.md` — de eerste analyse van vandaag:
  `training_results` vs. `activity_sessions` vs. `training_sessions`
  vs. `training_plan_sessions`, wie schrijft/leest wat, wat canonical is
- `docs/guardian-mode-coach-call-trigger-v1.md` (v1.2) — de Coach Call
  Decision Engine-analyse: vier bestaande aanmaakplekken in kaart,
  bevestigd dat Master Coach al vrijwel alle bouwstenen heeft, herzien
  naar een aparte Decision Engine (Master Coach beslist niet zelf),
  met de concrete JA/NEE-triggerlijst (coachwaardige gebeurtenis, geen
  activiteit-aanwezigheid)

### Al eerder toegevoegd, ter bevestiging (geen wijziging)
`docs/platform-audit-fase0-v1.md`, `docs/dataflow-audit-running-v1.md`,
`docs/confidence-ux-fase4-design-v1.md`/`v2.md` — stonden al in de
repo sinds v2.4.284.

### Roadmap
Nieuw punt 5: **Coach Decision Engine** — analyse compleet, niets
geïmplementeerd, bouwvolgorde staat in het document. Nevenbevinding
(Concept2 maakt geen Coach Call) expliciet als nog-niet-beoordeeld
vermeld, niet stilzwijgend meegenomen.

**Status van de dag, samengevat:** Workout Completion Platform (Fase
1-3) gebouwd en grotendeels getest, Fase 4 bewust niet gebouwd
(herdefinieerd), Activity Bridge + Source Priority Policy gebouwd en
getest (met twee bugs onderweg gevonden en gefixt), dedup-consolidatie
afgerond, en een brede architectuuranalyse (Platform Audit, Dataflow
Audit, Coach Call Decision Engine) die vooral bevestigde: de
fundamenten bestaan al, het werk is consolideren, niet opnieuw bouwen.

## v2.4.284 — Final Architecture Update: Coach Call NIET voor matching + Source Priority Policy-gat gedicht
**Definitief architectuurbesluit van de gebruiker, sluit de Fase 4-
discussie af en verifieert punt 17 uit datzelfde document.**

### Fase 4 herdefinieerd — geen UI gebouwd, bewust
Twee ontwerprondes doorlopen deze dag (Coach Card-component →
hergebruik Coach Call). Beide **definitief ingehaald**: Coach Call
mag nooit voor workout matching gebruikt worden, op geen enkel
confidence-niveau. Coach Call blijft exclusief voor onverwachte/
ongeplande trainingen — een fundamenteel ander gesprek ("waarom deed
je dit") dan een matching-bevestiging. Confidence blijft volledig
intern: bij <70% simpelweg niet koppelen, alleen loggen (bestaat al
sinds v2.4.267), geen gebruikersvraag, geen nieuwe UI, geen nieuwe
Coach Call-brontype. **Dit sluit het punt af — er is niets meer te
bouwen voor Fase 4.**

### Punt 17 geverifieerd — echt gat gevonden, niet alleen bevestigd
De opdracht vroeg om te controleren of de Source Priority Policy de
Activity Bridge altijd correct overschrijft zodra een device-import
beschikbaar komt. Bij verificatie (niet aangenomen dat v2.4.283 dit al
dekte): **Strava en Garmin TCX blokkeerden zichzelf al correct** bij
een bestaande hogere/gelijke prioriteit, maar **ruimden een bestaande
lagere-prioriteit-rij nooit op** na hun eigen succesvolle import —
alleen Concept2 deed dat (sinds v2.4.222).

**Fix:** beide routes (`strava-activity-processor.ts`,
`garmin-activity-tcx/route.ts`) uitgebreid met dezelfde opruim-logica
als Concept2 al had — na een succesvolle insert wordt elke bestaande
rij die dag/sport waar de nieuwe bron overheen wint (via
`nieuweBronWint()`) verwijderd. Zonder deze fix konden een Trainer
AI-rij (Activity Bridge) en een latere Strava/Garmin-rij voor dezelfde
dag naast elkaar blijven bestaan — precies het scenario dat punt 17
wilde uitsluiten.

### Nieuwe referentie
De volledige "Final Architecture Update — v2.4.284" is vanaf nu de
definitieve architectuurreferentie in het README, vervangt eerdere
aannames over Workout Player/Match Review/Coach Call.

**Nog steeds ongewijzigd:** Workout Matching Service zelf, Performance
Platform, Activity Bridge-kernlogica.

### Nuancering, dezelfde dag
Eerste versie van dit punt formuleerde Coach Call te absoluut als
"uitsluitend voor onverwachte/ongeplande trainingen." Gecorrigeerd:
Coach Call is **bron-onafhankelijk** (Garmin/Concept2/TCX/Trainer AI
triggeren 'm allemaal al, bevestigd tegen het bestaande README —
Garmin-imports triggerden altijd al Coach Call, niet pas bij een
afwijking) en is architectonisch **de evaluatielaag van de Master
Coach zelf** (niet van Trainer, niet van een Specialist) — voedt Coach
Memory/Learning Rules met subjectieve context die apparaten nooit
kunnen meten. De kernregel die overeind blijft: Workout Matching-
confidence is een puur technisch systeemproces, geen coachgesprek —
dát onderscheid, niet "wel/niet in-app", bepaalt of iets via Coach
Call loopt.

## v2.4.283 — Dedup-consolidatie: alle vier ingest-routes naar de Source Priority Policy
**Roadmap-punt 1 van "1 t/m 3. Go" — kleinste, veiligste van de drie
resterende taken.**

### Wat er gemigreerd is
Vier bestanden, allemaal van een hardcoded "check specifiek op
Concept2, bewust alleen voor Roeien"-regel (v2.4.222) naar de
generieke Source Priority Policy (v2.4.278):

- **`concept2/sync/route.ts`** — de opruim-kant: verwijderde eerst een
  hardcoded lijst (`strava`/`garmin`/`apple_health`/`manual`), nu elke
  bestaande rij die dag waar Concept2 overheen wint (via
  `nieuweBronWint()`) — inclusief `trainer_ai`, dat in de oude lijst
  ontbrak omdat het nog niet bestond toen die geschreven werd
- **`strava-activity-processor.ts`**, **`garmin-activity-tcx/route.ts`**,
  **`garmin-activity-vision/route.ts`** — de blokkeer-kant: checkten
  eerst alleen "bestaat er een Concept2-rij", nu "bestaat er een rij
  met gelijke-of-hogere prioriteit dan mijzelf"

### Bewuste scope-uitbreiding, niet alleen refactor
Alle drie de blokkeer-checks waren **bewust alleen voor 'Roeien'**
(letterlijke code-comment, v2.4.222) — er was toen nog geen andere
sport met een hogere-prioriteit-bron om tegen te beschermen. Met
Trainer AI (v2.4.278) als lage-prioriteit-bron voor óók Running/
Cycling/Rowing, geldt "device wint van in-app" nu voor alle drie, niet
meer alleen voor Roeien-tegen-Concept2. Deze migratie breidt de
bescherming daarom bewust uit naar alle activiteitssporten.

### Bug gevonden en gefixt TIJDENS het migreren, niet erna
De eerste versie van de Strava-wijziging filterde de dedup-check
alleen op datum+gebruiker, niet op sport (`activity_id`) — zou een
Concept2-Rowing-sessie ten onrechte een Strava-Cycling-import diezelfde
dag hebben kunnen blokkeren. Gevonden vóór levering (code-review op
mezelf, geen test nodig om dit te zien), rechtgezet door de
`userActivity`-lookup vóór de dedup-check te verplaatsen — alle drie
de blokkeer-checks filteren nu correct op `activity_id`.

### Gedragsbevestiging
Voor Rowing/Concept2-vs-Strava/Garmin blijft het gedrag **identiek**
aan vóór deze migratie (Concept2 blijft prioriteit 100, hoogste) — dit
is voor het bestaande, al-geverifieerde pad een pure refactor. De
uitbreiding naar andere sporten en naar Trainer AI-bescherming is
nieuw, nog niet organisch getest (net als de rest van de Activity
Bridge-keten — vergt een natuurlijk moment of een debug-aanpassing).

**Nog steeds ongewijzigd:** de insert-logica zelf in alle vier routes,
Workout Matching, Universal Athlete State-koppeling.

## v2.4.282 — Roadmap bijgewerkt: Activity Bridge volledig doorgetest
**Geen code — documentatie-update na afronding van het testen.**

`/debug/activity-bridge` volledig doorlopen (5 augustus): basistest
geslaagd, dedup-herhaaltest geslaagd — na twee tussentijds gevonden en
gefixte bugs (v2.4.280 constraint, v2.4.281 dedup-logica). Roadmap
bijgewerkt om dit te weerspiegelen, met de vier resterende openstaande
punten expliciet als keuze neergezet i.p.v. impliciet volgordelijk.

## v2.4.281 — FIX: Source Priority Policy blokkeerde gelijke prioriteit niet
**Gemeld via /debug/activity-bridge: dezelfde test twee keer achter
elkaar (Running, 45 min, vandaag) gaf BEIDE keren "✓ aangemaakt" —
twee identieke activity_sessions-rijen i.p.v. de verwachte blokkade
bij de tweede poging.**

### Root cause
`nieuweBronWint()` gebruikte `prioriteit(nieuw) >= prioriteit(bestaand)`.
Bij een gelijke bron tegen zichzelf (`trainer_ai` tegen `trainer_ai`,
10 tegen 10) gaf dat `true` ("nieuwe bron wint") — de blokkade in
`activity-bridge.ts` (`!nieuweBronWint(...)`) werd daardoor nooit
gevonden bij gelijke prioriteit, alleen bij een STRIKT lagere. De
functie was bedoeld voor "hogere prioriteit mag overschrijven", maar
gaf dat ten onrechte ook terug bij een gelijke bron — precies het
scenario waarin de Activity Bridge zichzelf zou kunnen dupliceren bij
een herhaalde aanroep.

### Fix
`src/lib/activity-import/source-priority-policy.ts` —
`prioriteit(nieuw) >= prioriteit(bestaand)` → `prioriteit(nieuw) >
prioriteit(bestaand)` (strikt groter). Nu: gelijke of lagere
prioriteit blokkeert altijd, alleen een STRIKT hogere prioriteit mag
een bestaande activiteit overschrijven/naast leggen.

**Geen andere aanroepers geraakt** — `nieuweBronWint()` wordt op dit
moment alleen door `activity-bridge.ts` gebruikt.

### Bekende, nog niet opgeruimde data
De twee dubbele testrijen uit de bug-melding (2026-08-05, beide 45 min,
beide `trainer_ai`, beide `[debug-testrij]`-gelabeld) staan nog in de
database — via `/debug/activity-bridge`'s reset-knop op te ruimen
(veilig, beide zijn debug-testrijen).

**Test-instructie:** ruim de dubbele testrijen op, herhaal de
dedup-test (zelfde sport/duur/datum twee keer achter elkaar) — de
tweede poging zou nu `✗ Niet aangemaakt` moeten geven, met een reden
die de bestaande `trainer_ai`-rij noemt.

## v2.4.280 — SQL-fix: activity_sessions_source_check miste 'trainer_ai'
**Gemeld via `/debug/activity-bridge`: eerste test gaf direct
"insert mislukt: violates check constraint activity_sessions_source_
check". Zelfde foutpatroon als v2.4.221 en v2.4.24, nu opnieuw
gemaakt — bij het bouwen van de Activity Bridge (v2.4.278) is
`source: 'trainer_ai'` gebruikt zonder de bestaande constraint te
verifiëren. Eigen fout, geen testfout.**

### Root cause
`activity_sessions_source_check` stond (sinds v2.4.221) alleen
`manual`/`garmin`/`apple_health`/`strava`/`concept2` toe. `'trainer_ai'`
(nieuw voor de Activity Bridge) ontbrak.

### Fix — SQL only, geen codewijziging
`activity-bridge.ts`/`debug/activity-bridge`-route gebruikten al
correct `'trainer_ai'` — alleen de database moest bijgewerkt worden:
```sql
alter table activity_sessions drop constraint activity_sessions_source_check;
alter table activity_sessions add constraint activity_sessions_source_check
  check (source = ANY (ARRAY['manual'::text, 'garmin'::text, 'apple_health'::text, 'strava'::text, 'concept2'::text, 'trainer_ai'::text]));
```

**Les, herhaald vastgelegd (stond al bij v2.4.24, blijkbaar niet
genoeg):** bij een nieuwe `source`-waarde voor `activity_sessions`
altijd eerst de bestaande constraint verifiëren
(`pg_get_constraintdef`), nooit aannemen welke waarden al toegestaan
zijn — vooral bij de Source Priority Policy (v2.4.278), die juist
bedoeld is om nieuwe bronnen makkelijk toe te voegen. Het gemak van
"voeg een regel toe aan de policy" dekt niet automatisch de
database-constraint — die twee moeten met opzet samen bijgewerkt
worden, dat is nu expliciet benoemd zodat een toekomstige nieuwe bron
(Polar/COROS/Zwift) niet in dezelfde valkuil loopt.

**Test-instructie:** na het uitvoeren van de SQL, `/debug/activity-bridge`
opnieuw proberen — zou nu `✓ aangemaakt` moeten geven.

## v2.4.279 — Activity Bridge Debug Dashboard
**Bron: vervolg op v2.4.278 (Activity Bridge + Source Priority
Policy). Zelfde reden als destijds bij Rowing: eerst in-app kunnen
testen, niet blind vertrouwen op ongeziene code.**

### Verschil met /debug/workout-matching
Geen historische testdata beschikbaar (geen oude, ongematchte
`training_results` zoals er bij Rowing wél oude Concept2-activiteiten
waren). `/debug/activity-bridge` roept daarom de Bridge aan met een
**synthetisch** `training_result`-id (`debug-<uuid>`) — test specifiek
de Bridge- en Source Priority Policy-logica zelf, zonder een echte
`training_results`-rij nodig te hebben (die insert-logica bestond al
en is ongewijzigd).

### Nieuw
- `api/debug/activity-bridge/route.ts` — GET toont activiteiten van de
  laatste 14 dagen (alle 5 activiteitssporten), POST met `actie: 'test'`
  roept `overwegActiviteitUitTrainingResultaat()` rechtstreeks aan
  (sport/duur/datum zelf te kiezen), `actie: 'reset'` verwijdert een
  debug-testrij — geweigerd als de rij niet `source: 'trainer_ai'` +
  `notes` met het `debug-`-label heeft, zodat een echte Bridge-rij hier
  nooit per ongeluk kan verdwijnen
- `debug/activity-bridge/page.tsx` — formulier (sport-dropdown, duur,
  optionele datum) + resultaat + lijst met reset-knop per debug-rij
- Link toegevoegd aan `/debug` (hoofdscherm)
- Kleine correctie tegelijk meegenomen: de bestaande
  `/debug/workout-matching`-link zei nog "(Rowing)" — al lang
  multi-sport (Running/Cycling toegevoegd in Fase 2), label
  bijgewerkt

### Nog te doen
Gebruiker moet de debugpagina daadwerkelijk doorlopen — zelfde
stappenplan-aanpak als bij Rowing/Running/Cycling (lage/hoge
confidence-achtige checks, hier: sport zonder externe bron testen,
daarna dedup checken door dezelfde sport+datum nog een keer te testen
met een bestaande device-activiteit ernaast).

## v2.4.278 — Activity Bridge + Source Priority Policy
**Bron: CoachOS Platform Final Architecture v1.0 (gebruiker, 5 augustus
2026), verfijnd met een generieke Source Priority Policy i.p.v.
hardcoded dedup-regels.**

### Scope-correctie t.o.v. de vorige README-versie
Het roadmap-punt stond eerder omgekeerd: de brug is voor
**activiteitssporten zonder externe bron** (Running/Cycling/Rowing/
Walking/Swimming), NIET voor Strength/Kettlebell/Bodyweight — die
blijven bewust bij `training_results` alleen. Rechtgezet vóór het
bouwen, niet erna.

### Nieuw — Source Priority Policy
`src/lib/activity-import/source-priority-policy.ts` — generieke
prioriteitstabel i.p.v. losse if/else-dedup-checks:
```
concept2: 100, garmin: 90, strava: 80, apple_health: 70,
trainer_ai: 10, manual: 0
```
Uitbreidbaar zonder herontwerp: een toekomstige bron (Polar/COROS/
Zwift/Wahoo) voegt alleen een regel toe, geen enkele aanroeper wijzigt.
**Bewust NIET met terugwerkende kracht toegepast** op de bestaande
dedup-checks (Concept2/Garmin/Strava-routes) — die werken al correct,
migratie is een aparte, latere consolidatie.

### Nieuw — Activity Bridge
`src/lib/activity-import/activity-bridge.ts` —
`overwegActiviteitUitTrainingResultaat()`. Eigen, aparte
verantwoordelijkheid ("moet hier een activiteit uit ontstaan?"),
bewust gescheiden van `training/complete/route.ts` (die alleen "de
training is afgerond" registreert) — één verantwoordelijkheid per
component.

- Alleen voor `training_type` in `{running, cycling, rowing, walking,
  swimming}` — andere types (strength/kettlebell/etc.) worden
  overgeslagen, geen brug
- Idempotent: `notes: training_result:{id}`, zelfde patroon als
  concept2:/strava:/garmin_tcx_import:-markers elders
- Dedup via de nieuwe Source Priority Policy: bestaat er die dag al een
  activity_session met hogere/gelijke prioriteit (bijv. een
  Garmin-import), dan wordt de brug overgeslagen — geen dubbele
  registratie
- **Eerlijke beperking:** `metrics` blijft leeg — `training/complete`
  levert geen afstand/hartslag, geen schijndata verzinnen
- Na een geslaagde brug: roept ook de Workout Matching Service aan
  (dezelfde flow als elke andere bron — Source Isolation-principe,
  ADR §2b, geen uitzondering voor deze nieuwe bron)

### Aangesloten op `training/complete/route.ts`
Na de bestaande `training_results`-insert, in try/catch (fout hier mag
de evaluatie-opslag zelf nooit laten falen).

### Nog niet getest
Geen historische testdata beschikbaar zoals bij Rowing/Concept2 —
vergt een echte Trainer AI-sessie voor Running/Cycling/Rowing zonder
Garmin-import diezelfde dag, of een handmatige test.

**Nog steeds ongewijzigd:** alle bestaande ingest-routes
(Concept2/Garmin TCX/Strava), Rowing/Running/Cycling-matchers zelf.

## v2.4.277 — Analysefase afgesloten: Platform Audit, Dataflow Audit, architectuur bevroren
**Grote documentatie-consolidatie, geen code. Sluit de architectuurronde
af die begon met de Workout Completion Platform-ADR (4 augustus) en
via Source Isolation, Platform Audit en Dataflow Audit uitkwam op een
"CoachOS Platform Final Architecture v1.0" (gebruiker, 5 augustus).**

### Nieuw — twee auditdocumenten
- `docs/platform-audit-fase0-v1.md` — classificatie van alle 14
  platformlagen (A: bestaat correct / B: bestaat, andere naam of
  verspreid / C: gedeeltelijk / D: bestaat niet / E: legacy) tegen de
  Final Architecture. **Belangrijkste correctie t.o.v. de eerste versie:**
  Workout Player ging van "onbekend/hoog risico" naar **Categorie B,
  bevestigd** — zie hieronder.
- `docs/dataflow-audit-running-v1.md` — Running end-to-end gevolgd
  (schrijft/leest/data per stap, geen code gewijzigd). Bevestigde dat
  de keten zich splitst: cardio-sporten met een Training Plan Engine
  gebruiken nooit Trainer AI, uitvoering gebeurt extern.

### De kernvondst: Trainer AI = Universal Training Engine
Niet twee systemen — één. README bevestigt dit al letterlijk (elders,
langer bestaand): *"Trainer AI (de Universal Training Engine) blijft
voorlopig de generieke uitvoerder voor deze disciplines"*. Rol:
generieke Workout Player voor sporten ZONDER eigen Training Plan Engine
(Strength/Kettlebell/Bodyweight). Wordt nooit gebruikt zodra een
specialist-trainingsplan bestaat (Today Engine, vaste
prioriteitsvolgorde, bevestigd in `today-engine.ts`). Dit verlaagt het
risico van dit onderdeel drastisch: geen dubbel systeem dat voorzichtig
ontward moet worden, gewoon één al-bestaand, begrepen systeem.

### Nieuw in README — Final Architecture als bevroren referentie
Sectie "🏛️ CoachOS Platform Final Architecture — bevroren referentie":
de twee-takken-architectuur (Cardio → extern apparaat →
`activity_sessions`, Gym → Trainer AI/Universal Training Engine →
`training_results`), plus de negen bevestigde architectuurprincipes,
plus vaste ontwikkelregels (geen nieuwe parallelle systemen, geen
speculatieve platformlagen).

### Roadmap herzien
- **Vision-checklist-item alsnog gecorrigeerd** — was eerder al
  besproken/toegezegd (5 augustus, "Ja. Goed plan") maar per ongeluk
  nooit daadwerkelijk gepusht; nu wél: bewust overgeslagen (niet
  geblokkeerd), Vision blijft ongewijzigd bestaan als feature
- **"Handmatige/bibliotheek-import aansluiten" vervangen** door een
  preciezer punt: **`training_results` → `activity_sessions`-brug**
  (Final Architecture-besluit). Expliciete scope-grens vastgelegd: dit
  ontsluit GEEN Workout Matching voor Strength — die blijft
  geblokkeerd tot er een eigen Training Plan Engine is. Geverifieerd
  veilig voor Performance Platform: `load-engine.ts` leest alleen
  cycling/running/rowing-grafieken, negeert een Strength-
  `activity_session` simpelweg.
- Intelligence Platform/Knowledge Platform expliciet als "niet nu
  oppakken, wel vermoeden gedocumenteerd" toegevoegd aan de checklist

### Volgende stap
Analysefase officieel afgesloten. Eerstvolgende bouwstap: de
`training_results` → `activity_sessions`-brug — kleinste, meest
concrete openstaande implementatiepunt, met een al vastgelegde
scope-grens.

## v2.4.276 — Workout Matching Service, Fase 3 (Garmin TCX)
**Bron: `docs/workout-completion-platform-adr-v1.md`, Fase 3 — het
daadwerkelijk testbare pad (zie Operationele context: Strava ligt
stil, TCX is de actieve Garmin-import).**

### Garmin TCX aangesloten op de Matching Service
`garmin-activity-tcx/route.ts` heeft TWEE plekken waar een activiteit
in `activity_sessions` terechtkomt — een nieuwe insert, én een
overschrijving (opnieuw uploaden van hetzelfde bestand, bijv. na een
parserverbetering). Beide nu aangesloten via een lokale
`probeerMatching()`-helper (voorkomt dat de matching-aanroep twee keer
apart wordt uitgeschreven binnen hetzelfde bestand):

- **Nieuwe insert:** matching direct na de succesvolle insert
- **Overschrijving:** matching opnieuw geprobeerd — als de duur is
  veranderd (bijv. door een verbeterde parser) kan een eerder
  niet-matchende activiteit nu wél binnen tolerantie vallen. Geen
  risico op een dubbele/foute koppeling: als de sessie al gekoppeld
  was, vindt de Core geen openstaande kandidaat meer
  (`completed_activity_id` al gevuld) en gebeurt er niets.

### Nieuw — gedeelde sport-mapping
`training-plan-engine/activiteit-sport-mapping.ts` —
`ACTIVITEIT_NAAR_SPORT_SLEUTEL` stond lokaal in
`strava-activity-processor.ts`; met Garmin TCX als tweede plek die dit
nodig heeft, nu gecentraliseerd. Bewuste unie van beide
bron-vocabulaires: Strava's generieke `'Fietsen'` én TCX's
`'Fietsen (buiten)'`/`'Indoor Fietsen'` wijzen nu allebei naar dezelfde
`'cycling'`-sleutel. `strava-activity-processor.ts` aangepast om
dezelfde bron te gebruiken (refactor, geen gedragswijziging).

Precies het Source Isolation-principe uit v2.4.275 in de praktijk: de
mapping zit bewust nog IN de importlaag (elke route kent zijn eigen
weergavenaam), maar levert een brononafhankelijke sleutel op zodra die
de Matching Service ingaat.

### README — roadmap-checklist bijgewerkt
Garmin TCX afgevinkt (Vision nog niet). Volgende stap:
`garmin-activity-vision/route.ts` — met de aantekening om eerst te
checken of foto-import daadwerkelijk actief gebruikt wordt vóór het
prioriteit krijgt boven de handmatige/bibliotheek-import.

**Nog steeds ongewijzigd:** Concept2-sync-route, Rowing/Running/
Cycling-matchers zelf.

## v2.4.275 — Architectuurprincipe vastgelegd: Source Isolation
**Geen code — een precisering van de architectuur, geformuleerd samen
met de gebruiker naar aanleiding van de Strava/Garmin-operationele
context (v2.4.274).**

### Het principe
> De importlaag is bronbewust; het platform is brononafhankelijk.
> `activity_sessions` vormt de grens tussen beide werelden.

Nieuwe sectie 2b in `docs/workout-completion-platform-adr-v1.md`:
- **Fase 1 (Activity Import, bronbewust):** authenticatie/parser/
  validatie/dedup/bronprioriteit hoort hier thuis — de bestaande
  Rowing-dedup-prioriteit (Concept2 > Garmin > Strava/Apple Health/
  handmatig) is hier een voorbeeld van, geen uitzondering
- **Fase 2 (`activity_sessions`, normalisatiepunt):** het Canonical
  Activity Model — vanaf hier is een activiteit gestandaardiseerd
- **Fase 3 (Platform, brononafhankelijk):** Matching/Performance/
  Universal Athlete Platform/Learning Rules/Coach Memory/Today Engine/
  Master Coach zien nooit `source` — geverifieerd (niet aangenomen):
  `ActiviteitVoorMatching` bevat al geen `source`-veld, dit was zonder
  opzet al zo gebouwd

### TCX als primaire importstrategie — nu expliciet, geen toeval
Vastgelegd dat Garmin TCX-upload een bewuste architectuurkeuze is
(volledige parser-controle, geen externe API-afhankelijkheid, één
parser voor meerdere sporten), niet een tijdelijke workaround omdat
Strava stilligt. Strava blijft mogelijk als optionele bron, de
platformarchitectuur wordt er nooit afhankelijk van gemaakt.

### Waarom dit vastgelegd is
Voorkomt dat bron-specifieke logica zich later verspreidt door de rest
van CoachOS — belangrijk nu er over een paar jaar mogelijk Polar/
Suunto/COROS/Zwift/Wahoo/Health Connect bijkomen: alleen de importlaag
zou dan moeten veranderen, niets in Matching/Performance/Learning/Coach.

**Geen enkele code gewijzigd** — dit bevestigt en documenteert alleen
wat er al zo gebouwd bleek te zijn.

## v2.4.274 — Operationele context vastgelegd: Strava gepauzeerd, Garmin via TCX
**Geen code — een correctie op aannames, vastgelegd vóór er verder
gebouwd wordt op Fase 3.**

### Gemeld door de gebruiker
- **Strava:** gestart toen de API nog gratis was, inmiddels is een
  betaald developer-abonnement vereist. Wordt voorlopig niet gebruikt.
  Gevolg: de Strava-matching uit v2.4.273 is gebouwd en klopt qua code,
  maar is nu NIET te testen — er komt geen nieuwe Strava-data meer
  binnen. Blijft staan voor de toekomst.
- **Garmin:** activiteiten worden nu geïmporteerd via handmatige
  TCX-bestand-upload (`api/health/garmin-activity-tcx/route.ts`), NIET
  via de Garmin Connect API. Garmin API-toegang staat uit, onbekend
  hoe lang dat duurt.

### Consequentie voor de roadmap
Bewust vastgelegd in het README (sectie "Operationele context") zodat
dit niet vergeten wordt bij een volgende sessie: wanneer Fase 3 het
Garmin-punt bereikt, is de TCX-upload-route (en mogelijk de
Vision-route, `garmin-activity-vision/route.ts`) het punt om op aan te
sluiten — dat is wat daadwerkelijk gebruikt en dus testbaar is. Niet
wachten op of bouwen tegen een hypothetische toekomstige Garmin-API.

**Uitgangspunt, herbevestigd:** bouwen gaat door ook als iets (nog)
niet te testen is (Strava) — geen losse eindjes betekent niet
"wachten tot alles testbaar is", het betekent "niets stilzwijgend
overslaan of ten onrechte als getest beschouwen." Bij elke stap die
niet te testen is: dat expliciet benoemen.

## v2.4.273 — Workout Matching Service, Fase 2 afgesloten + Fase 3 (Strava)
**Twee dingen in één levering: de Fase 2-afsluiting (Strength
geblokkeerd, vorige keer per ongeluk niet gepusht — bij het self-checken
ontdekt) en de eerste Fase 3-stap.**

### Fase 2 — afgesloten (zie vorige sessie, nu pas gepusht)
Strength Matcher bewust geblokkeerd — geen Training Plan Engine, dus
geen `training_plan_sessions` om tegen te matchen. Rowing/Running/
Cycling zijn de drie sporten die Fase 2 dekt.

### Fase 3 — Strava aangesloten op de Matching Service
Eerste keer dat de Matching Service in een ECHTE productie-ingest-route
draait (tot nu toe alleen via `/debug/workout-matching` of Concept2's
eigen route). `strava-activity-processor.ts`:

- Hergebruikt de al-bestaande `ACTIVITEIT_NAAR_SPORT_SLEUTEL`-mapping
  (bestond al voor de Learning Rules-koppeling) om per binnenkomende
  activiteit de juiste matcher te vinden — geen tweede mapping
  verzonnen
- `'Roeien'` toegevoegd aan die mapping (ontbrak: Rowing-via-Strava
  heeft geen impact-adapter, dus was nooit nodig geweest vóór dit)
- Matching-aanroep bewust in een EIGEN try/catch, los van de bestaande
  Universal Athlete State-koppeling — mag niet meeliften op
  `MINIMUM_SESSIE_DUUR_MINUTEN` (die drempel beschermt het
  athlete-state-gemiddelde, is geen reden om matching over te slaan;
  een te korte activiteit faalt de duur-tolerantie in de matcher toch
  vanzelf al)

### Nieuw — gedeelde matcher-registry
`training-plan-engine/matcher-registry.ts` — `SPORT_MATCHERS` was tot
nu toe lokaal gedefinieerd in het debug-scherm. Met een tweede plek die
het nodig heeft (Strava) zou dat twee kopieën betekenen die uit elkaar
kunnen groeien (tegen "dubbele utilities vermijden"). Debug-scherm
aangepast om nu ook uit deze registry te importeren, geen eigen kopie
meer.

**Nog NIET aangesloten:** Garmin (TCX + Vision, twee aparte routes),
handmatige/bibliotheek-import — dat is de rest van Fase 3.

## v2.4.272 — Fase 2 afgesloten: Strength Matcher bewust geblokkeerd
**Geen code deze keer — een bevinding, vóór het bouwen vastgesteld,
precies om te voorkomen dat er een los eindje ontstaat.**

### Wat er gecheckt is vóór er iets gebouwd werd
Volgende punt op de roadmap was de Strength Matcher (laatste van
Fase 2). Voordat daarmee begonnen werd, eerst gecontroleerd of
Strength dezelfde basis heeft als Rowing/Running/Cycling:

- Geen `strength-adapter.ts` — 404 bij ophalen
- Dit README zegt het al expliciet, elders: "Rowing/Strength/
  Kettlebell als volwaardige specialisten — ⏳ Niet gestart"
- Strength heeft alleen een oefeningenbibliotheek (100 oefeningen,
  `strength-exercises.ts`), geen Training Plan Engine

**Conclusie:** zonder Training Plan Engine bestaan er geen
`training_plan_sessions` voor Strength. Een Strength Matcher bouwen nu
zou een matcher zijn zonder iets om tegen te matchen — precies het
soort "ziet er klaar uit maar doet functioneel niks"-resultaat dat
vermeden moet worden.

### Besluit
Strength Matcher **geblokkeerd**, niet geannuleerd — pas oppakken
zodra Strength een eigen Training Plan Engine krijgt (apart, groter
traject, al langer bekend als openstaand punt in dit README).

Fase 2 is daarmee inhoudelijk klaar voor de drie sporten die wél een
Training Plan Engine hebben: Rowing, Running, Cycling — alle drie
gebouwd, doorgetest via `/debug/workout-matching`.

### Volgende stap: Fase 3
Strava aansluiten op de Matching Service — eerste kans om de Running/
Cycling-matchers ook daadwerkelijk in een productie-ingest-route te
laten draaien, niet alleen via het debug-scherm. Aandachtspunt vooraf:
hoe `strava-activity-processor.ts` per activiteit de sport herkent
(`SPORT_TYPE_MAP`) moet vertaald worden naar de juiste matcher uit de
registry — dat mapping-stuk bestaat nu alleen in het debug-scherm.

## v2.4.271 — Workout Matching Service, Fase 2 (Cycling Matcher)
**Bron: `docs/workout-completion-platform-adr-v1.md`, Fase 2 — tweede
Sport Matcher na Running.**

### Nieuw — Cycling Matcher
`training-plan-engine/matchers/cycling-matcher.ts` — zelfde structuur
als Rowing/Running. Beperking dit keer expliciet GEVERIFIEERD, niet
overgenomen: `core.ts`'s insert in `training_plan_sessions` gebruikt
voor alle sporten identiek dezelfde kolommen (`duration`,
`load_target`) — geen vermogen- of afstand-target, ook niet specifiek
voor Cycling. Duur blijft dus ook hier het enige score-signaal.

Bewust nog NIET aangesloten op een ingest-route (Fase 3, apart).

### Debug-dashboard — registry uitgebreid
`SPORT_MATCHERS` + `ACTIVITEIT_NAMEN_PER_SPORT` in
`api/debug/workout-matching/route.ts` uitgebreid met `cycling`. Enige
bijzonderheid t.o.v. Rowing/Running: Cycling heeft 3 activiteit-namen
i.p.v. 1 (`'Fietsen'`, `'Fietsen (buiten)'`, `'Indoor Fietsen'` —
gespiegeld van `cycling-data.ts`, niet verzonnen). Sport-selector in de
UI toont nu Rowing/Running/Cycling.

### README — roadmap-checklist bijgewerkt
Cycling Matcher afgevinkt. Volgende stap: **Fase 2, Strength Matcher**
— met een expliciete waarschuwing dat Strength waarschijnlijk niet
dezelfde duur-tolerantie-aanpak kan gebruiken (geen duur-gedreven
cardio — eerder oefening+volume, zie ADR §3).

**Nog steeds ongewijzigd:** de productieflow zelf
(`concept2/sync` → `matchActiviteitAanPlan` → `rowingMatcher`).

## v2.4.270 — Workout Matching Service, Fase 2 (Running Matcher) + debug-scherm gegeneraliseerd
**Bron: `docs/workout-completion-platform-adr-v1.md`, Fase 2 — eerste
vervolgstap na Fase 1 (Rowing).**

### Nieuw — Running Matcher
`training-plan-engine/matchers/running-matcher.ts` — zelfde structuur
als de Rowing Matcher (Fase 1), sport `'running'`. Zelfde eerlijke
beperking, nu geverifieerd i.p.v. aangenomen: `training_plan_sessions`
heeft ook voor Running geen doel-afstand-veld (decision-contract-v1.md
§4, ongewijzigd) — duur blijft het enige score-signaal. Zelfde
ambiguïteit-garantie via `unique(plan_id, date)` (v2.4.259).

**Bewust nog NIET aangesloten op een ingest-route** (Strava/Garmin) —
dat is Fase 3, een aparte stap. Deze matcher is deze levering alleen
bereikbaar via het debug-dashboard.

### Debug-dashboard gegeneraliseerd naar meerdere sporten
`/debug/workout-matching` was hardcoded op Rowing. Met een tweede
Sport Matcher zou dat een aparte kopie van het hele scherm betekenen
(tegen de architectuurregel "dubbele utilities vermijden"). Nu:
- API: `SPORT_MATCHERS`-registry (`{ rowing, running }`) +
  `ACTIVITEIT_NAMEN_PER_SPORT` (gespiegeld van rowing-data.ts/
  running-data.ts, niet zelf verzonnen), aangestuurd via `?sport=`
  (GET) en `body.sport` (POST)
- UI: sport-selector-knoppen bovenaan, alle bestaande functionaliteit
  (automatisch/handmatig-test/handmatig-forceer/reset) ongewijzigd van
  gedrag, nu alleen sport-parametrisch

Nieuwe sporten toevoegen (Cycling/Strength) raakt straks alleen de
registry, niet de rest van route.ts of page.tsx.

### README — roadmap-checklist bijgewerkt
"🎯 Actieve Roadmap — Workout Completion Platform": Fase 2/Running
afgevinkt. Volgende stap: Fase 2/Cycling Matcher — met een expliciete
aantekening om de "geen doel-afstand-veld"-aanname opnieuw te
verifiëren voor Cycling, niet automatisch over te nemen van Rowing/
Running.

**Nog steeds ongewijzigd:** de productieflow zelf
(`concept2/sync` → `matchActiviteitAanPlan` → `rowingMatcher`).

## v2.4.268 — Workout Matching Debug: venster-fix + handmatige testtools
**Twee losse meldingen tijdens het testen van de Fase 1-debugpagina
(`/debug/workout-matching`, v2.4.267), in één keer gedocumenteerd.**

### Fix 1 — activiteiten-blok bleef leeg
Gemeld: 56 gesyncte Concept2-sessies aanwezig, maar het activiteiten-
blok toonde niets. Root cause: het 21-dagen-venster (bedoeld voor
PLAN-sessies, die altijd recent/toekomstig zijn) werd ook op de
ACTIVITEITEN toegepast — de meest recente sessie van de gebruiker
(30 juni) viel daarmee al buiten beeld vanaf 4 augustus. Losgekoppeld:
activiteiten tonen nu de laatste 30, ongeacht datum.

### Fix 2 — geen enkele match te produceren om te testen
Na fix 1 bleek: alle historische activiteiten (2025) en alle
koppelbare geplande sessies (`scheduled`/`planned`, nog in de
toekomst) hadden nergens een overlappende datum — dus geen enkele
automatische match mogelijk zonder te wachten tot begin augustus.

Toegevoegd aan `/api/debug/workout-matching` (POST, nieuw `actie`-veld,
`automatisch` blijft de originele echte flow):
- **`handmatig-test`** — dry-run: kies zelf een activiteit + een sessie
  (ongeacht datum), zie de confidence-berekening (`rowingMatcher.
  berekenConfidence()` rechtstreeks aangeroepen) zonder database-
  schrijving
- **`handmatig-forceer`** — schrijft wél weg (`status: completed`,
  `completed_activity_id`, confidence, reden), ongeacht drempel —
  `match_reden` krijgt altijd een `[TEST]`-prefix, zodat dit nooit met
  een echte automatische match te verwarren is
- **`reset`** — zet een sessie terug naar `scheduled`. Weigert
  expliciet (server-side, niet alleen in de UI) als `match_reden` niet
  met `[TEST]` begint — een echte, automatisch tot stand gekomen
  koppeling kan via dit scherm dus nooit per ongeluk ongedaan gemaakt
  worden.

UI: per activiteit een dropdown om een sessie te kiezen (los van de
datum-gebaseerde knop die er al was), plus dry-run/forceer-knoppen.
Sessies die via een test gekoppeld zijn krijgen een zichtbare
"🔄 Ontkoppelen"-knop.

**Nog steeds ongewijzigd:** de productieflow zelf (`concept2/sync` →
`matchActiviteitAanPlan` → `rowingMatcher`) — deze levering raakt
uitsluitend het debug-scherm.

## v2.4.267 — Workout Matching Service, Fase 1 (Rowing referentie-implementatie)
**Platformontwerp, geen losse Rowing-fix. Bron: architectuurgesprek 4
augustus 2026, vastgelegd in `docs/workout-completion-platform-adr-
v1.md` (Status: Proposed → nu in uitvoering, Fase 1).**

### Het gevonden gat, bevestigd in code vóór het bouwen
`training_plan_sessions.completed_activity_id` bestaat sinds v2.4.96,
maar werd door GEEN van de vier ingest-routes (Concept2-sync, Strava-
processor, Garmin TCX/Vision, handmatig) ooit gevuld. Gevolg:
`adjuster-core.ts`'s `missed_session`-trigger (filtert op
`completed_activity_id IS NULL AND date < vandaag`) behandelde elke
sessie na de datum als gemist — ook als de training daadwerkelijk was
uitgevoerd. Geen bug in de trigger zelf (die query was al correct
geschreven), maar een ontbrekende laag ervoor.

### Ontwerp — Workout Completion Platform
Volledige keten vastgelegd: Training Plan → Workout Platform → Workout
uitgevoerd → Activity Import → **Workout Matching Service** → Workout
Completion → Performance Platform → Universal Athlete Platform →
Learning Rules → Coach Memory → Master Coach. Elke laag met precies
één verantwoordelijkheid (Activity Import importeert/dedupliceert
alleen, mag nooit een plan wijzigen; Workout Matching Service koppelt/
bepaalt confidence, mag nooit prestaties analyseren — zie het ADR voor
de volledige tabel).

### Nieuw — generieke Core + eerste Sport Matcher
- **`training-plan-engine/workout-matcher-types.ts`** — gedeeld
  contract (`SportMatcher`), zelfde patroon als het bestaande
  `TrainingPlanSportAdapter`
- **`training-plan-engine/workout-matcher.ts`** — Core, sport-
  agnostisch: zoekt het actieve plan + de geplande sessie op dezelfde
  datum (uniek dankzij `unique(plan_id, date)`, v2.4.259 — geen
  ambiguïteit tussen kandidaten nodig), roept de sport-matcher aan voor
  een confidence-score, koppelt automatisch bij `confidence >=
  AUTO_MATCH_DREMPEL` (0,7 — eerste schatting, losse constante)
- **`training-plan-engine/matchers/rowing-matcher.ts`** — eerste
  referentie-implementatie. Score op duur-afwijking (tolerantie 30%,
  eerste schatting). **Eerlijke beperking, expliciet in code-comment:**
  geen meters-vergelijking mogelijk — `training_plan_sessions` heeft
  geen doel-afstand-veld, alleen duur/load_target. Bewust weggelaten
  i.p.v. tegen een verzonnen aanname te toetsen.
- **`api/specialists/rowing/concept2/sync/route.ts`** — roept na elke
  succesvolle import de Matching Service aan, in try/catch (zelfde
  discipline als de bestaande Universal Athlete State-koppeling — een
  fout hier mag de sync zelf nooit laten falen)

### Database
`supabase/workout_matching_kolommen.sql`:
```sql
alter table training_plan_sessions
  add column if not exists match_confidence numeric,
  add column if not exists match_reden text;
```
Geen nieuwe tabel — `completed_activity_id` bestond al. Deze twee
kolommen zijn puur voor uitlegbaarheid (geen schijnprecisie: altijd
zichtbaar waarom iets automatisch gekoppeld is).

### Verhouding tot ADR-007 (Single Workout Mutation Principle, v2.4.265)
Geen overlap: dit is een PLANNING-mutatie (welke status heeft een
sessie), geen workout-INHOUD-mutatie (duur/intensiteit/herhalingen,
exclusief bij de Adaptation Engine). Zelfde categorie als de
al-bestaande, ongewijzigde `missed_session`/`injury_protection`/
`goal_change`-triggers.

### Test in-app — geen console/desktop nodig
`/debug/workout-matching` (nieuw, gelinkt vanaf `/debug`) — zelfde
opzet als `/debug/recovery`: puur uitlezen, plus een "Test matching"-
knop per al-geïmporteerde Rowing-activiteit die **exact dezelfde**
`matchActiviteitAanPlan()`-functie aanroept als de echte Concept2-sync.
Toont confidence + reden direct in de UI. Hiermee is de service
retroactief testbaar tegen al-bestaande activiteiten, zonder een
nieuwe ErgData-sessie nodig te hebben. Volgt de iPhone-first
debugstrategie (§15 MASTER SYSTEM): geen `console.log`-afhankelijkheid
voor verificatie — de lage-confidence-log blijft als extra diagnose
bestaan, maar is niet meer de enige manier om het resultaat te zien.

### Bewust nog niet gebouwd (zie README Openstaande Punten)
- Fase 2: Running/Cycling/Strength Matchers
- Fase 3: Strava/Garmin/handmatig aansluiten op de Matching Service
- Fase 4: confidence-UX ("was dit je geplande training?" bij een lage
  score), retrofit van de Cycling-ritanalyse naar de expliciete
  koppeling i.p.v. datum-gok

`npx next build` — nog te bevestigen na deploy.

**Test-instructie:** sync een Concept2-sessie op een dag met een
geplande Rowing-sessie binnen redelijke duur-marge (±30%) — de
geplande sessie zou nu op `status: completed` moeten staan met
`match_confidence`/`match_reden` gevuld, i.p.v. de volgende dag als
`missed_session` te worden doorgeschoven.

## v2.4.266 — UI-gat gedicht: Cycling/Running kunnen nu ook geopend worden
**Gemeld direct na het testen van ADR-007: "kan de trainingen zien.
Alleen bij Rowing kan ik ze openen."**

### Root cause
De backend-koppeling voor Cycling/Running (`/training-plan/workout`-
route, `bouwWorkout()`) werkte al — bevestigd via de ADR-007-test.
Maar er was geen UI om een sessie open te tikken en de concrete
workout te zien. Dat bestond alleen bij Rowing. Geen nieuwe bug — het
eerder al gevonden, nog niet opgeloste gat.

### Fix
`WorkoutDetail`-component toegevoegd aan zowel `coach/cycling/
trainingsplan/page.tsx` als `coach/running/trainingsplan/page.tsx` —
mirror van Rowing's versie, aangepast per sport:
- Cycling: `vermogen_watt` i.p.v. SPM
- Running: `pace` i.p.v. SPM

Zowel de "Vandaag"-kaart als elke "Komende trainingen"-kaart is nu
klikbaar/uitklapbaar, exact zoals Rowing al werkte.

### Kleine extra
Als er nog geen FTP (Cycling) of recente wedstrijdprestatie (Running)
is ingevuld, toont het scherm nu een duidelijke hint i.p.v.
stilzwijgend geen pace/vermogen te tonen.

`npx next build` — compileert zonder fouten, beide pagina's.

**Daarmee gebruiken Rowing, Running en Cycling nu écht dezelfde weg —
niet alleen op API-niveau (al sinds vandaag eerder bevestigd), maar
ook zichtbaar en bruikbaar in de app zelf.**

**Test-instructie:** open Cycling of Running → Trainingsplan → tik op
"Vandaag" of een komende sessie — zou nu moeten uitklappen met
concrete blokken en pace/vermogen-waarden, net als Rowing.

## v2.4.265 — ADR-007: Single Workout Mutation Principle
**Gevraagd tijdens een architectuur-review: "Gebruikt elke specialist
dezelfde weg?" Bij het uitzoeken kwam een reëel, ernstig risico naar
boven: twee onafhankelijke lagen konden dezelfde workout cumulatief,
niet-uitlegbaar verkleinen.**

### Het gevonden risico
- **Daily Adjustment Layer** (ouder, sinds v2.4.97), trigger
  `fatigue_detected`: bij laag herstel werd een sessie op
  databaseniveau vervangen door een lichtere variant, duur `× 0.6`
- **Adaptation Engine** (nieuwer, v2.4.227+), kruis-sport-signaal:
  verkleinde de (mogelijk al verkleinde) workout ALSNOG — kortere
  warming-up, minder herhalingen, lagere intensiteit

Bij een gebruiker met beide tegelijk: dubbele verkleining, cumulatief,
niet meer herleidbaar tot een enkele reden. Doorgerekend en bevestigd
met een simulatie: warmup kromp nogmaals (300→210 sec) bovenop een
al-gehalveerde sessie.

### Architectuurbeslissing — ADR-007
Vastgelegd in `docs/adr/ADR-007-single-workout-mutation-principle.md`:
**slechts één component mag een workout daadwerkelijk wijzigen — de
Adaptation Engine.** Alle andere componenten leveren uitsluitend
signalen, in een gedeeld contract:

```typescript
interface AdaptationSignal {
  source: 'fatigue' | 'cross_sport' | 'sleep' | 'weather'
  severity: 'low' | 'medium' | 'high'
  confidence: number
  reden: string
  metadata?: Record<string, unknown>
}
```

### Fase 1 (deze levering) — bewust afgebakend
- **`adjuster-core.ts`** — `fatigue_detected`-trigger muteert de
  database niet meer, levert een `AdaptationSignal` op via het nieuwe
  `DailyAdjustmentResultaat`-return-type (`{ aanpassingen,
  fatigueSignaal }`)
- **`cross-sport-bridge.ts`** — `bepaalKruisSportSignaal()` spreekt nu
  hetzelfde contract (severity o.b.v. aantal belaste dimensies 1=low/
  2=medium/3+=high, confidence o.b.v. het gemiddelde van de
  bijdragende Universal Athlete State-velden)
- **`adaptation.ts`** — `pasWorkoutAan()` herschreven, ontvangt een
  array van signalen, past de downscale hooguit ÉÉN keer toe
  (gesorteerd op severity), combineert alle redenen in één toelichting
- **Alle 3 Workout Builder-routes** (Rowing/Running/Cycling) bijgewerkt
  om beide signalen te verzamelen vóór één gecombineerde aanroep
- **3 aanroepende routes + 1 wrapper** (`training-plan-adjuster.ts`,
  Cycling/Running/Rowing's `/training-plan`-routes) bijgewerkt naar
  het nieuwe return-type, `AanpassingResultaat[]`-gedrag ongewijzigd

### Bewust NIET in deze fase
- `missed_session`/`injury_protection`/`goal_change` blijven
  database-mutaties — planning-beslissingen, geen intensiteit-
  downscale, overlapten niet met het gevonden risico
- Intelligence Platform (volledige signaal-combinatielaag) — dit
  contract bereidt die stap voor, bouwt 'm nog niet
- Learning Rules Engine als eigen signaalbron — nog niet aangesloten

### Gevalideerd — exact het gevonden risico
Fatigue-signaal + cross-sport-signaal tegelijk aangeboden geeft
**exact dezelfde magnitude** als één signaal alleen (herhalingen 4→3,
identiek aan het enkele-signaal-scenario) — bevestigd met een directe
vergelijking. Toelichting combineert beide redenen correct in één
zin: "Kortere warming-up (laag herstel vandaag; lichaam al belast —
cardio al belast, core vermoeid — ...)."

`npx next build` — compileert zonder fouten.

**Wat hierdoor niet verandert:** Rowing/Running/Cycling behouden al
hun bestaande kennis, analyses en policies. De downscale-magnitude
zelf is ongewijzigd — alleen de garantie dat 'ie hooguit één keer
afgaat, is nieuw.

## v2.4.264 — BIJVANGST-FIX: "Over -15 dagen"
**Direct gevonden bij het testen van v2.4.263 — bevestigd dat die fix
werkte (2 i.p.v. 8), maar meteen ook een nieuw, eigen bijverschijnsel.**

### Root cause
Door v2.4.263's query-fix (gte-filter verwijderd) vond
`volgendeVakantie` voor het eerst correct een AL-LOPENDE vakantie —
maar de weergave-berekening (`dagenTot()`) berekent dagen tot de
STARTDATUM, zonder rekening te houden met een vakantie die al
begonnen is. Resultaat: "Over -15 dagen".

### Fix
`coach-planning/page.tsx` — als de startdatum al voorbij is maar de
einddatum nog niet: "Nu bezig". Is de hele vakantie al voorbij: 
"Voorbij" (i.p.v. een steeds groter wordend negatief getal).

**Gevalideerd — 4 scenario's:**
- Al-lopende vakantie → "Nu bezig"
- Al-voorbije vakantie → "Voorbij"
- Toekomstige vakantie → "Over 5 dagen" (ongewijzigd gedrag)
- Vakantie die vandaag begint → "Vandaag"

`npx next build` — compileert zonder fouten.

**Test-instructie:** open Coach Planning → Overzicht tijdens een
actieve vakantie — "Volgende vakantie" zou nu "Nu bezig" moeten tonen
i.p.v. een negatief getal.

## v2.4.263 — FIX: "Trainingen komende week" negeerde vakantie
**Gemeld tijdens het samen doorlopen van Coach Planning: Overzicht
toonde "8", Week-weergave toonde 0 — gebruiker zat middenin een
vakantieweek.**

### Root cause 1
`trainingenKomendeWeek` telde gewoon alle `training_plan_sessions`-
rijen in de komende 7 dagen, zonder vakantie-check. De rijen bestaan
nog (al gegenereerd door de rolling horizon), maar deze teller wist
niet dat een deel van die dagen vakantie was.

### Root cause 2 — gevonden tijdens het bouwen van de fix
De query voor eenmalige life-events had nog een `gte('start_time',
vandaag)`-filter — exact hetzelfde patroon dat al in v2.4.203 gefixt
werd voor HERHALENDE events, maar hier nooit toegepast. Een vakantie
die vóór vandaag begon maar nog doorloopt werd hierdoor structureel
gemist — niet alleen in deze teller, ook bij `volgendeVakantie`.

### Fix
- `gte('start_time', vandaag)` verwijderd uit de eenmalige-events-
  query
- `trainingenKomendeWeek` sluit nu sessies uit op vakantiedagen
  (hergebruikt `isEventActiefOpDag()`)

**Gevalideerd — exact het gerapporteerde scenario:** vakantie 20 jul
t/m 9 aug, vandaag 4 aug. Met de fix: 2 (alleen 10-11 aug vallen
buiten vakantie). Zonder de fix: 8 — de exacte, misleidende waarde
die gerapporteerd werd.

`npx next build` — compileert zonder fouten.

**Test-instructie:** open Coach Planning → Overzicht tijdens een
actieve vakantie — "Trainingen komende week" zou nu alleen dagen
buiten de vakantie moeten meetellen.

## v2.4.262 — Meerdere dagen bij Wekelijks/Om de week
**Gemeld: "Ik kan niet meerdere dagen selecteren."**

### Bevestigd
Bij "Aangepast" werkte multi-select al correct. Bij "Wekelijks"/"Om
de week" verving elke tik de hele selectie (`setRecurrenceDays(
[dag.nummer])`) in plaats van toe te voegen. **Geen bug in de
berekeningslogica** — `isHerhalendActiefOpDag()` ondersteunde
`recurrence_days` als array voor weekly/biweekly al gewoon (matcht op
`.includes(dagNummer)`), alleen de knoppen zelf gebruikten nooit een
toggle.

### Fix
Dezelfde toggle-logica als "Aangepast" nu ook toegepast op Wekelijks/
Om de week — in beide schermen (aanmaken én bewerken):
```js
onClick={() => setRecurrenceDays(
  recurrenceDays.includes(dag.nummer)
    ? (recurrenceDays.length > 1 ? recurrenceDays.filter(d => d !== dag.nummer) : recurrenceDays)
    : [...recurrenceDays, dag.nummer]
)}
```
Vangnet ingebouwd: de laatste overgebleven dag kan niet uitgezet
worden (altijd minimaal 1 dag actief, anders zou de hele reeks
zomaar leeglopen).

### Bijkomende fixes
- Labels bijgewerkt: "Op welke dag?" → "Op welke dag(en)?"
- `formatHerhaling()` (de samenvattingstekst) toonde voorheen altijd
  maar 1 dag, ook als er meerdere geselecteerd waren — toont nu alle
  geselecteerde dagen, comma-separated

**Gevalideerd:**
- Toevoegen van een tweede dag (maandag → maandag+woensdag) werkt
- Verwijderen van een dag (terug naar alleen woensdag) werkt
- Vangnet: poging om de laatste dag te verwijderen wordt genegeerd

`npx next build` — compileert zonder fouten.

**Test-instructie:** open een Wekelijks- of Om de week-item, tik
meerdere dagen aan in de selector, sla op — de samenvatting zou nu
alle gekozen dagen moeten tonen (bijv. "Om de week · Ma, Wo").

## v2.4.261 — DERDE EN DEFINITIEVE FIX: "om de week" echte oorzaak
**Gemeld met twee screenshots: v2.4.260 werkte (dag-selector toonde
al "Ma" automatisch), maar het resultaat bleef fout: "Slaat 1 week
maandag op. Dan niets meer."**

### Root cause, eindelijk de juiste
Tweede screenshot toonde het hoofdscherm: **BEGINDATUM 17 aug 2026,
EINDDATUM 21 aug 2026** — een apart, bovenliggend datumveld, los van
de Herhaling-instelling. Er bestaan TWEE aparte "einddatum"-concepten
in het datamodel:
- `end_date` (het bovenste veld) — bedoeld voor een eenmalig event
  van dag X t/m dag Y
- `recurrence_end_date` — een eigen veld ÍN het Herhaling-scherm,
  bedoeld om een herhalende reeks te laten stoppen

`isHerhalendActiefOpDag()` checkt BEIDE velden en stopt zodra één van
de twee overschreden wordt. Met Einddatum op 21 augustus (4 dagen na
Begindatum) stopte de HELE "om de week"-reeks na de eerste maandag —
ver vóór de volgende biweekly-maandag (31 augustus) bereikt zou
worden. Geen bug in de herhalingsberekening zelf, maar een verwarrend
datamodel met twee overlappende velden.

### Fix — in beide schermen (aanmaken én bewerken)
- Het bovenste "Einddatum"-veld wordt nu verborgen/uitgeschakeld
  zodra er een herhaling actief is ("Zie Herhaling →")
- Bij opslaan: `end_date` wordt altijd expliciet `null` zodra er een
  herhaling actief is — `recurrence ? null : (endDate || null)` —
  ook als er nog een oude waarde in de state hangt

### Repareert bestaande items automatisch
Omdat de save-logica `end_date` nu altijd nult zodra recurrence actief
is, is er geen aparte handmatige stap nodig — gewoon het bestaande
"Vroege dienst"-item openen en op Opslaan tikken (zonder verder iets
te wijzigen) repareert het, want de herhaling staat al ingesteld.

**Gevalideerd — volledige simulatie, exact het gerapporteerde
scenario:**
- MET de fix (`end_date: null`): 17 aug actief, 24 aug niet, 31 aug
  actief, 7 sep niet, 14 sep actief — correct doorlopend patroon
- ZONDER de fix (oude situatie, `end_date: '2026-08-21'`): stopt na
  de eerste maandag — exact het gemelde, kapotte gedrag bevestigd

`npx next build` — compileert zonder fouten.

**Test-instructie:** open de bestaande "Vroege dienst" opnieuw, tik
direct op Opslaan (geen wijzigingen nodig) — de reeks zou nu door
moeten lopen na 21 augustus. Check ook de agenda-weergave voor
september om te bevestigen dat het patroon blijft doorgaan.

## v2.4.260 — VERVOLG-FIX: "om de week" — de échte oorzaak
**Gemeld met een screenshot: v2.4.259's fix loste het niet volledig
op. Grondiger uitgezocht, echte root cause gevonden.**

### Onderzoek
Gebruiker vroeg terecht: "Moet de dagen toch niet invullen?" — de
dag-selector ("Op welke dag?") bleek al te bestaan in zowel het
aanmaak- als bewerk-formulier. Maar `needsDay`/`needsDays` (metadata
bij de herhaling-opties, gedefinieerd bij elke recurrence-optie)
bleken **dode metadata** — nergens in de code daadwerkelijk gebruikt
of gecontroleerd.

### Root cause
`kiesHerhaling()` — de functie die draait zodra je een
herhalingsoptie kiest — zette al een automatische standaard-dag voor
"Werkdagen" (ma-vr) en "Weekend" (za-zo), maar **niet voor "Om de
week"/"Wekelijks"**. Wie meteen opsloeg zonder zelf een dag aan te
tikken in de sub-selector, kreeg `recurrence_days: null`. De
berekeningslogica (`isHerhalendActiefOpDag()`) interpreteert een lege
`recurrence_days` als "elke dag matcht" — dus voor de helft van de
weken (om de week) leek de dienst op ELKE dag actief, niet op de
gekozen dag.

### Fix
`kiesHerhaling()` (beide identieke instanties — aanmaken en bewerken)
zet nu automatisch de dag van de huidige startdatum als standaard
zodra "Wekelijks" of "Om de week" gekozen wordt.

**Gevalideerd:** volledige simulatie over 4 weken, 17 augustus 2026
(maandag) als startdatum, `recurrence_days: [1]` — actief 17 aug,
niet 24 aug, weer actief 31 aug. Exact het juiste patroon.

`npx next build` — compileert zonder fouten.

### Belangrijk voor bestaande items
Deze fix werkt alleen voor NIEUWE dag-keuzes vanaf nu. Bestaande
items (zoals de "Vroege dienst" uit de melding) hebben mogelijk nog
`recurrence_days: null` — open het item, tik de dag opnieuw aan, sla
op.

**Test-instructie:** open de bestaande "Vroege dienst", tik nogmaals
op een dag (of heropen "Herhaling" → "Om de week"), sla op — daarna
zou het patroon (om de week, specifieke dag) correct moeten werken.

## v2.4.259 — VIER-IN-ÉÉN FIX
**Vier gemelde problemen tegelijk uitgezocht en gefixt.**

### 1. Rowing-activatie deed niks
**Root cause:** `specialisten/page.tsx`'s "Beschikbaar"-kaart was een
kale `<Link>` die rechtstreeks navigeerde — de al-bestaande
`activeer()`-functie (POST met `active:true`) werd nooit aangeroepen.
**Fix:** kaart roept nu `activeer()` aan, die zelf ook al navigeert.

### 2 + 3. Duplicaat trainingsplan-sessies (geen Cycling-actie op Home + "om de week")
**Root cause:** de rolling horizon-verlenging (v2.4.248/249) kan
vanuit meerdere plekken tegelijk draaien (trainingsplan-pagina + Today
Engine bij elke Home-load) — bij bijna-gelijktijdige aanroepen zag de
tweede nog niet dat de eerste al iets had aangemaakt, wat **twee
identieke sessies voor dezelfde dag** opleverde. Bevestigd met een
SQL-query: 2 rijen, zelfde sport, zelfde datum.

**Fix — twee lagen:**
- `training-plan-engine/core.ts` — idempotency-check vóór elke insert
- `supabase/fix_duplicate_sessions.sql` — ruimt bestaande duplicaten
  op + voegt een `unique(plan_id, date)`-constraint toe (database-
  niveau-beveiliging, want de applicatie-check alleen is niet 100%
  race-condition-vrij)

```sql
delete from training_plan_sessions a
using training_plan_sessions b
where a.plan_id = b.plan_id and a.date = b.date and a.id > b.id;

alter table training_plan_sessions
  add constraint training_plan_sessions_plan_date_uniek unique (plan_id, date);
```

### 4. Herstel/stress-impact bij bewerken sloeg niet op
**Root cause:** de PATCH-route van `life-events` (bewerken van een
bestaand item) miste 4 velden die de POST-route (nieuw aanmaken) wél
altijd opsloeg: `start_time`, `recovery_impact`, `stress_load`,
`sleep_disruption`. Het formulier stuurde ze wél mee, de route
negeerde ze stilzwijgend. **Bonus:** `start_time` ontbreken verklaart
ook punt 3 — de "om de week"-berekening (`weekVerschil()`) leunt
rechtstreeks op dat veld, dus bij het bewerken van een bestaande
dienst bleef het oorspronkelijke `start_time` staan.

**Fix:** alle 4 velden toegevoegd aan `api/life-events/route.ts`'s
PATCH-handler.

`npx next build` — compileert zonder fouten na alle vier de fixes.

**Test-instructie:**
1. Voer eerst de SQL uit (ruimt duplicaten op + voorkomt nieuwe)
2. Tik op de Rowing-kaart in Specialisten — zou nu naar "Actief" moeten
   verhuizen met een blauw icoontje
3. Bewerk een bestaande dienst (bijv. avonddienst), pas herstel/stress-
   impact aan, sla op, open opnieuw — zou nu de nieuwe waarden moeten
   tonen

## v2.4.258 — KRITIEKE FIX: weer werd toegepast op indoor-sessies
**Gemeld: "dus indoor en buiten. Weet hij ook?" — antwoord op dat
moment: nee. v2.4.257 paste weer-gebaseerde hitte/koude-adaptatie toe
op ELKE sessie, zonder te checken of die wel buiten was.**

### Root cause — het meest ernstige geval
**Concept2 (Rowing) is per definitie een indoor roeimachine.** De
vorige levering haalde bij elke Rowing-sync het actuele weer op en
paste dat toe, alsof de gebruiker buiten had geroeid. Dat is
structureel fout, niet incidenteel — élke Rowing-sessie kreeg een
onterechte weer-impact.

### Fix — Rowing/Concept2
De weer-adapter-aanroep is **volledig verwijderd** uit `concept2/
sync/route.ts` — niet voorwaardelijk gemaakt, maar weggehaald. Er is
hier geen enkel scenario waarin dit relevant is.

### Fix — Running/Cycling (Strava)
Nieuw `trainer?: boolean`-veld toegevoegd aan de `StravaActivity`-
interface (Strava's API geeft dit al mee, stond alleen nog niet
getypeerd). Weer wordt nu alleen toegepast als:
```
isIndoor = activity.trainer === true || activity.sport_type === 'VirtualRide'
```
Bij twijfel (het `trainer`-veld ontbreekt): WEL toepassen — de
meerderheid van Strava-activiteiten is buiten, dus dat is de veiligere
default dan structureel niets doen.

**Gevalideerd — 5 scenario's:**
- Buiten fietsen (Ride, trainer=false) → weer geldt
- Indoor trainer (Ride, trainer=true) → weer geldt niet, ondanks
  sport_type "Ride"
- Zwift (VirtualRide) → weer geldt niet, ongeacht het trainer-veld
- Buiten hardlopen (Run, geen trainer-veld) → weer geldt (veilige
  default bij onbekend)
- Treadmill met trainer=true (Run) → weer geldt niet

Bevestigd: nul weer-referenties meer in de Rowing/Concept2-route.
`npx next build` — compileert zonder fouten. Ongebruikte `NextRequest`-
import en functieparameter opgeschoond (niet meer nodig na het
verwijderen van de weer-aanroep).

## v2.4.257 — Omgeving-categorie: hitte/koude-adaptatie gevuld
**Gecorrigeerde aanname: eerder vandaag werd gezegd "geen weerdata
beschikbaar" voor de Omgeving-categorie — dat klopte niet. Er bestond
al een uitgebreide weer-API (`api/weather`, gevoelstemperatuur,
luchtvochtigheid, UV-index).**

### Nieuw
**`src/lib/specialists/weer-impact-adapter.ts`**:
- `vertaalWeerNaarImpact()` — vertaalt gevoelstemperatuur naar
  hitte_adaptatie (≥20°C) of koude_adaptatie (≤8°C) impact-bijdragen,
  geen bijdrage bij neutrale temperaturen
- `haalHuidigWeer()` — server-side fetch naar de al-bestaande interne
  weather-route, geen lat/lon nodig (die route valt zelf terug op
  Vercel-edge-locatie/IP/Amsterdam)

### Eerlijk, welke velden WEL en NIET gevuld worden
- ✅ hitte_adaptatie, koude_adaptatie — directe, bruikbare proxy
- ❌ hoogte_adaptatie — geen hoogtedata beschikbaar
- ❌ hydratatie_status — luchtvochtigheid ≠ hydratatie, te zwakke gok
- ❌ energie_beschikbaarheid — geen voedingsdata beschikbaar

### Belangrijke, expliciet benoemde beperking
Gebruikt het weer OP HET MOMENT VAN SYNCEN als proxy voor "de
omstandigheden tijdens de sessie" — niet het historische weer op het
exacte trainingsmoment. Bewust NIET toegepast bij de terugvul-functie
(backfill van oude sessies) — daar zou dit niet accuraat zijn, alleen
bij live syncs.

### Koppeling
- `api/specialists/rowing/concept2/sync/route.ts` — weer één keer per
  sync-batch opgehaald (`req.nextUrl.origin`)
- `src/lib/strava-activity-processor.ts` (Running/Cycling) —
  `process.env.NEXT_PUBLIC_APP_URL`, hetzelfde patroon dat al overal
  in de codebase gebruikt wordt

**Gevalideerd:**
- 5 scenario's: warme dag, koude dag, neutraal weer (terecht geen
  bijdrage), extreme hitte (plafond op 100), precies op de drempel
- Volledige keten getest: rowing-bijdragen + weer-bijdragen samen door
  de Impact Engine — hitte_adaptatie correct gevuld, de 3 overige
  Omgeving-velden blijven terecht op LOW/0%

`npx next build` — compileert zonder fouten.

**Daarmee: 5,5 van de 6 punten uit het overzicht opgelost.** De
resterende 3 Omgeving-velden zijn geen vergeten aansluiting, maar een
eerlijk benoemd gebrek aan databron.

## v2.4.256 — Geleerde patronen daadwerkelijk toegepast
**Vervolg op v2.4.253 (evalueren + tonen). De bewust opengelaten stap
nu afgemaakt: een geleerd patroon past ook echt de opgeslagen state
aan, niet alleen zichtbaar op een kaartje.**

### Nieuw
**`src/core/athlete-platform/learned-adjustments.ts`** —
`pasGeleerdeAanpassingenToe()`: past de ruwe waarde aan met het
geleerde percentage (bijv. exact het visie-effect: +4% op
`herstel_capaciteit`), herberekent het bijbehorende kwalitatieve
niveau, geklemd tussen 0-100.

### Bewuste ontwerpkeuze
**Confidence blijft ongewijzigd door een geleerde aanpassing** — een
geleerde correctie zegt iets over de VERWACHTE waarde, niet over
hoeveel data er is. Die twee blijven losse berekeningen
(`aantal_observaties` regelt confidence, zoals al in v2.4.245
vastgelegd).

### Koppeling
Aangeroepen ná `pasImpactToe()`, vóór het opslaan — in beide
sync-routes:
- `api/specialists/rowing/concept2/sync/route.ts` — geleerde patronen
  één keer per sync-batch opgehaald (niet per sessie — zou bij 56
  sessies 56 onnodige identieke queries geven)
- `src/lib/strava-activity-processor.ts` (Running/Cycling)

`waardeNaarNiveau()` geëxporteerd uit `impact-engine.ts` voor
hergebruik, geen dubbele niveau-berekeningslogica.

**Gevalideerd — 5 scenario's:**
- Exact het visie-effect (+4%) op een echte, door de Impact Engine
  berekende waarde — komt precies uit
- Confidence blijft aantoonbaar ongewijzigd
- Immutability bevestigd (origineel blijft ongewijzigd)
- Plafond-check: 98 + 20% zou 117,6 zijn, correct geklemd op 100
- Onbekend pad: netjes overgeslagen, geen crash

`npx next build` — compileert zonder fouten.

**Daarmee is de Learning Rules Engine nu volledig end-to-end
functioneel:** evalueren → opslaan → tonen → daadwerkelijk toepassen
op toekomstige berekeningen.

## v2.4.255 — Rowing Coach Layer (laatste openstaande sweep-punt)
**Laatste van de 6 punten uit het "Openstaande Punten"-overzicht.
Coach Memory zelf werkte al (v2.4.232), maar niets vulde 'm
automatisch.**

### Nieuw
- **`src/lib/specialists/rowing-analysis.ts`** — bestond nog helemaal
  niet, eerste stap van deze levering. Spiegelbeeld van
  `running-analysis.ts`: trainingsfrequentie/snelheid/afstand/
  trainingsbelasting, 100% deterministisch. Snelheid = afstand/duur
  (m/min) — geen SPM als hoofdmetric, want die is niet betrouwbaar
  aanwezig bij alle importbronnen (handmatig/Strava missen 'm vaak),
  in tegenstelling tot afstand
- **`api/specialists/rowing/coach`** — exact spiegelbeeld van
  `running/coach/route.ts`. Bevestigt dezelfde "invuloefening"-belofte:
  `genereerCoachPolicy()`, `verwerkKandidaatInzicht()`, `haalMemoryOp()`
  rechtstreeks hergebruikt, geen wijziging nodig

### Resultaat
Elke keer dat dit endpoint een kandidaat-inzicht vindt in de AI-
respons, gaat dat nu door dezelfde Learning Engine als Cycling/Running
— Rowing's Coach Memory kan voor het eerst automatisch gevuld worden.

**Gevalideerd:** kernberekeningen los getest — snelheidsberekening
(afstand/duur) filtert correct activiteiten zonder afstandsdata,
trainingsbelasting-score-grenzen (laag/gemiddeld/hoog) kloppen.
`npx next build` — compileert zonder fouten, nieuwe route bevestigd
in de build-output.

### Daarmee: 5 van de 6 openstaande punten opgelost
Het enige resterende punt (Universal Athlete Platform's Omgeving-
categorie) is bewust zo gelaten — geen vergeten aansluiting, maar een
eerlijk benoemde, grotere toekomstige uitbreiding.

**Test-instructie:** roep `POST /api/specialists/rowing/coach` aan
(of via de app, als daar een trigger voor bestaat) — zou een Rowing-
specifiek AI-advies moeten genereren, en bij een herkend patroon een
kandidaat-inzicht opslaan.

## v2.4.254 — Alternative Engine daadwerkelijk aangesloten
**Gevonden in de systematische sweep (v2.4.251): volledig gebouwd
(v2.4.228), door niets aangeroepen. Laatste van de twee openstaande
Engine-punten (na Learning Rules Engine, v2.4.253).**

### Nieuw
`api/specialists/rowing/training-plan/workout/route.ts` — eerste,
concrete trigger: ontbrekend materiaal (`materiaal.ontbreekt.length >
0`, bijv. geen Concept2 gekoppeld).

**Pragmatische keuze:** `workout_id` wijst niet naar een niet-
bestaande "workout-catalogus" — die bestaat niet in CoachOS. In
plaats daarvan: sport-sleutel. De mogelijke alternatieven zijn de
ANDERE sporten waar de gebruiker daadwerkelijk een actief
trainingsplan voor heeft (`training_plans` waar `status='active'`),
geen gok naar irrelevante sporten.

### UI
`coach/rowing/trainingsplan/page.tsx` — als er alternatieven zijn,
verschijnen ze onder de materiaal-waarschuwing, elk met een directe
link naar de betreffende sport se trainingsplan.

### Bewust nog niet gebouwd
Slecht-weer/blessure-triggers (ook onderdeel van `AlternativeContext`)
— geen weer-/blessuredata op dit moment aan deze route gekoppeld.

**Gevalideerd:**
- Realistisch scenario (Running+Cycling actief, geen Concept2) → beide
  correct als alternatief
- Geen probleem-context → terecht niets
- Geen andere actieve plannen → lege lijst, geen crash

`npx next build` — compileert zonder fouten.

**Daarmee zijn nu alle 3 van de 3 openstaande "gebouwd maar niet
aangesloten"-punten uit de sweep opgelost** (rolling horizon, Learning
Rules Engine, Alternative Engine). Eén punt resteert in het overzicht:
de Rowing coach-conversatieroute (automatische inzicht-generatie).

**Test-instructie:** ontkoppel tijdelijk Concept2 (of test met een
account zonder Concept2-koppeling maar met een actief Running/Cycling-
plan) — Rowing's Trainingsplan-pagina zou nu alternatieve sporten
moeten voorstellen.

## v2.4.253 — Learning Rules Engine daadwerkelijk aangesloten
**Gebouwd na "toch merk ik dat er veel foutjes gevonden worden, kunnen
we alles nog eens checken" — de systematische sweep (v2.4.251) legde
bloot dat deze Engine (v2.4.236), ondanks volledig gebouwd en getest,
door niets werd aangeroepen.**

### SQL (uitvoeren vóór deze code)
```sql
create table if not exists learned_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sport text not null,
  rule_id text not null,
  rule_naam text not null,
  beschrijving text not null,
  effect_pad text not null,
  aanpassing_percentage numeric not null,
  ontdekt_op timestamptz not null default now(),
  unique(user_id, sport, rule_id)
);
alter table learned_patterns enable row level security;
create policy "Gebruikers zien alleen hun eigen geleerde patronen"
  on learned_patterns for all using (auth.uid() = user_id);
```

### Nieuw
- **`src/lib/specialists/learning-context.ts`** — verzamelt de échte
  `LearningContext` uit al-bestaande tabellen (`activity_sessions`,
  `daily_status.recovery_score`, `training_results.perceived_effort`),
  geen nieuwe databron. Eerlijke vereenvoudigingen expliciet benoemd
  in commentaar (recovery-trend is een simpele proxy, RPE-stabiliteit
  vergt minimaal 5 metingen, anders conservatief `false`)
- **`src/lib/specialists/learning-rules-koppeling.ts`** —
  `evalueerEnBewaarLeerpatronenIndienNodig()`, aangeroepen na elke
  Concept2-sync (Rowing, één keer ná de lus) en Strava-import (Running/
  Cycling)
- **`api/athlete-platform/learned-patterns`** + UI-kaart op
  `/athlete-platform` ("🧠 Geleerde patronen") — matcht de "eerst
  zichtbaar maken"-aanpak

### Scope, eerlijk begrensd
Deze levering evalueert en **toont** gevuurde regels. Wat 'ie NIET
doet: het gevonden patroon automatisch laten meewegen in toekomstige
Impact Engine-berekeningen — een bewust aparte, latere stap.

### Fout gevonden en gefixt tijdens de build-validatie
Verkeerd importpad (`./learning-rules-engine` i.p.v. `@/core/
athlete-platform/learning-rules-engine`) — gevonden en gefixt vóórdat
dit geleverd werd.

**Gevalideerd:**
- RPE-stabiliteit: 3 scenario's (te weinig data → conservatief false,
  stabiele reeks → true, instabiele reeks → false)
- Volledige keten met realistische context (35 sessies, positieve
  trend, stabiele RPE) — regel vuurt correct met het juiste effect
- Onder de drempel (10 sessies) → terecht `population_model`, geen
  enkele regel geëvalueerd

`npx next build` — compileert zonder fouten.

**Test-instructie:** sync een nieuwe Concept2-sessie (of importeer via
Strava) — als er genoeg sessies + data zijn, zou `/athlete-platform`
een "🧠 Geleerde patronen"-kaart moeten tonen.

## v2.4.252 — Rowing Personal Baseline (2k-testtijd) + Performance-fix
**Gebouwd na v2.4.251's systematische controle, die blootlegde dat
Rowing volledig ontbrak in het Performance-scherm (CTL/ATL/TSB).**

### Architectuurprincipe
"Geen schijnprecisie. Geen verborgen aannames. Alles moet uitlegbaar
zijn. Een persoonlijke baseline voordat je personaliseert." — exact
hetzelfde principe dat al voor Running gold (VDOT uit een
wedstrijdprestatie), nu ook voor Rowing (2.000m-testtijd). Drie fasen:
Population Model → Personal Baseline → Continuous Learning.

### Nieuw
- **`/settings/rowing-profile`** — 2.000m-testtijd-invoerveld (min:sec),
  optioneel, met uitleg over Population Model vs. Personal Baseline
- **`api/specialists/rowing/profile`** — `laatste_2k_tijd_sec` toegevoegd
  aan preferences
- **`src/lib/specialists/rowing-grafieken.ts`** — `haalRowingCTLATLTSB()`,
  spiegelbeeld van `running-grafieken.ts`: exact dezelfde EWMA-wiskunde
  (CTL=42 dagen, ATL=7 dagen), exact dezelfde intensity-factor-in-het-
  kwadraat-TSS-formule. 2k-tijd → drempelsnelheid (m/min) — geen extra
  fysiologische correctiestap nodig (2k-tijd is in de roeiwereld zelf
  al de gangbare referentie, in tegenstelling tot Running's VDOT dat
  eerst naar %VO2max omgerekend moet worden)
- **`load-engine.ts`** — Rowing volledig meegeteld in het
  platformbrede CTL/ATL/TSB. `LoadSportDetail['sport']`-type
  uitgebreid van `'cycling' | 'running'` naar inclusief `'rowing'`
  (was een TYPE-niveau uitsluiting, niet alleen een ternary-bug)

### Eerlijk, net als bij Running
Geen 2k-tijd ingevuld = geen Rowing-bijdrage aan het platformtotaal —
geen gegokte drempelsnelheid, liever eerlijk niets dan schijnprecisie.

**Gevalideerd:**
- Drempelsnelheid geverifieerd tegen de eigen definitie: 2k-tijd 7:30
  → 266,7 m/min (2000m/7,5min) — exacte match
- TSS-formule getest tegen het fundamentele controlepunt van de
  metric zelf: exact 1 uur op drempelsnelheid = exact 100 TSS (per
  definitie) — komt precies uit
- Randgevallen (geen snelheid bekend, geen baseline) geven correct 0

`npx next build` — compileert zonder fouten.

**Test-instructie:** vul een 2.000m-testtijd in bij Rowing Profiel,
sla op, open dan Performance — CTL/ATL/TSB zouden nu ook je
Concept2-sessies moeten meetellen (was voorheen altijd 0 bijdrage van
Rowing).

## v2.4.251 — Systematische controle: "rowing vergeten"-patroon
**Gevraagd na meermaals dezelfde soort bug: "toch merk ik dat er veel
foutjes gevonden worden, kunnen we alles nog eens checken." Terecht —
dit patroon is vandaag al minstens 5 keer apart gevonden.**

### Methode
De HELE codebase doorzocht op elke plek die `'cycling'` én
`'running'` als quoted string bevat (15 bestanden gevonden), elk
gecontroleerd op de aanwezigheid van `'rowing'`.

### Gevonden en gefixt — 3 echte gaten
1. **`api/action-plan/route.ts`** — exact dezelfde bronlabel-ternary-
   bug als net gefixt in `coach/route.ts` (v2.4.250) — een Rowing-
   sessie zou als "Rust" in de Trainer AI-prompt terechtkomen
2. **`api/specialists/[type]/data/route.ts`** — generieke fallback-
   route mist Rowing in `DATA_FETCHERS`. Laag praktisch risico (de
   specifieke `rowing/data`-route heeft bij Next.js altijd voorrang),
   maar voor consistentie gefixt
3. **`app/goals/page.tsx`** — Rowing stond nog hardcoded op
   `beschikbaar: false` in de doeltype-lijst — een aanname van vóór
   Rowing's activatie (v2.4.216) die nooit werd bijgewerkt.
   **Gebruikers konden dus geen Rowing-specifieke doelen instellen.**
   Gefixt naar `true`

### Gevonden, bewust NIET gefixt in deze sweep — te groot
**`core/performance/engines/load-engine.ts`** — de CTL/ATL/TSB-
berekening (het Performance-scherm) is een wrapper rond alleen
Cycling+Running (`sport: 'cycling' | 'running'` — type-niveau
uitsluiting, niet alleen een ternary). Rowing-training telt daar
structureel niet mee. Vergt een eigen TSS-berekening voor Rowing, wat
op zijn beurt een intensiteits-baseline vergt (hetzelfde 2k-testtijd-
gat als eerder genoemd bij Rowing Profiel). **Toegevoegd aan het
"Openstaande Punten"-overzicht** bovenaan README — een aparte,
grotere klus, geen quick-fix.

### Overige bestanden gecontroleerd, bevestigd in orde
`smart-actions/route.ts`, `home/page.tsx`, `today-engine.ts`,
`utils/equipment.ts`, `archief/page.tsx`, `training/page.tsx`,
`training/session/[module]/page.tsx`, `progressie/page.tsx`,
`types/training-engine.ts` — allemaal al correct.

`npx next build` — compileert zonder fouten na alle fixes.

## v2.4.250 — Coach Intelligence: kruis-sport-aanpassingen proactief uitgelegd
**Stap 2 van het zelf voorgestelde kruis-sport-plan: eerst zichtbaar
maken in de trainingsplan-detail (v2.4.247, Stap 1), nu de Coach het
proactief laten uitleggen op Home.**

### Nieuw
`api/coach/route.ts` — als de Today Engine een specialist-sessie
teruggeeft die door een kruis-sport-signaal is aangepast, haalt de
route nu de concrete workout op (`kruisSportBron`/`adaptations`) en
geeft die als expliciete instructie mee aan de AI-prompt: proactief
uitleggen, met de daadwerkelijke aanpassingen erbij. Matcht exact het
overleg-voorbeeld: "Je zware roeitraining van gisteren heeft veel
belasting gegeven, daarom is de training vandaag iets lichter."

### Ondersteunend
`today-engine.ts`'s `TodayPlan` kreeg een nieuw `sessieId`-veld —
nodig om de Coach-route de juiste workout te laten opzoeken. Alle vier
de plekken die een `TodayPlan` samenstellen bijgewerkt.

### Bijvangst: nóg een instantie van hetzelfde bug-patroon
`api/coach/route.ts`'s bronlabel-ternary (voor de AI-prompt-context)
miste `'rowing'` — zou een Rowing-sessie als **"Rust"** in de AI-prompt
hebben aangemerkt (viel door naar de laatste else-tak). Dit is de
zoveelste instantie van exact hetzelfde patroon dat vandaag al
meermaals gevonden is (Training Plan Engine, Smart Actions, Today
Engine's reden-tekst). Gefixt, getest tegen alle vier de mogelijke
bronnen (cycling/running/rowing/trainer).

`npx next build` — compileert zonder fouten.

**Test-instructie:** zorg dat er een actieve kruis-sport-aanpassing is
(bijv. na een zware Rowing-sessie, open Running's Today-advies) — de
Coach-tekst op Home zou nu proactief de andere sport moeten noemen als
reden voor de aanpassing.

## v2.4.249 — FIX: rolling horizon-verlenging nu écht automatisch
**Gemeld: "de coach fix werkte niet". Uitgezocht met screenshots +
directe vragen — v2.4.248 werkte wel, maar alleen per sport, en
alleen ná het bezoeken van DIE sport se eigen trainingsplan-pagina.**

### Bevestigd scenario
- Gebruiker bezocht Rowing's Trainingsplan-pagina → Rowing's venster
  verlengd → Rowing kreeg terecht een sessie voor vandaag (maandag)
- Running bleef leeg, ondanks dat maandag een geldige Running-
  trainingsdag is — pas ná het expliciet openen van Running's eigen
  pagina verscheen de sessie (bevestigd met screenshot: 🏃 Easy Run,
  42 min, Running Coach, inclusief een kruis-sport-aanpassing naar
  30 min)

### Root cause
`verlengRollingHorizonIndienNodigCore()` (v2.4.248) werd alleen
aangeroepen vanuit elke sport se EIGEN `training-plan`-GET-route —
geen enkele plek riep het voor ALLE sporten tegelijk aan.

### Fix
Verlengingsaanroep verplaatst naar `today-engine.ts`'s
`bepaalTodayPlan()` — draait nu automatisch voor alle actieve plannen
tegelijk (`training_plans` waar `status='active'`), bij elke Today
Engine-aanroep — dus ook simpelweg bij het openen van Home. Geen
specifieke pagina-bezoeken meer nodig. Per sport in een eigen
try/catch. De losse aanroepen in de sport-specifieke routes (v2.4.248)
blijven staan — idempotent, dubbel aanroepen is onschadelijk.

### Bonus: tiebreak-vraag beantwoord
Gebruiker vroeg: hoe zit het als Rowing én Cycling dezelfde dag een
sessie hebben? Antwoord, bevestigd in de code: de al-bestaande
Decision Engine kiest op basis van doel-importance → urgentie →
naaste deadline. Zonder doeldata: vaste volgorde (cycling → running →
rowing), nooit willekeurig.

`npx next build` — compileert zonder fouten.

**Test-instructie:** open gewoon Home (geen specifieke trainingsplan-
pagina nodig) — Smart Actions zou nu voor alle sporten met een
geldige trainingsdag vandaag moeten kunnen tonen, ook zonder eerst
die specifieke pagina bezocht te hebben.

## v2.4.248 — KRITIEKE FIX: rolling horizon-verlenging bestond helemaal niet
**Gemeld: "training schema" ontbrak weer bij Smart Actions/Home.**

### Onderzoek (met echte SQL-queries, geen gok)
- Drie actieve plannen bevestigd (Cycling/Running/Rowing)
- Voor vandaag (3 augustus, maandag — wél een Running-trainingsdag):
  **"no rows returned"** — genuinely geen sessie gepland
- Trainingsdagen gecontroleerd: Running heeft wél maandag
- Sessie-bereik per sport gecontroleerd: Running laatste sessie 1
  augustus, Cycling laatste sessie 30 juli — **beide plannen liepen
  leeg**, ondanks een `end_date` tot oktober

### Root cause
`training-plan-engine/core.ts` genereert bij het aanmaken van een plan
bewust maar ~2 weken concrete sessies (`ROLLING_HORIZON_WEKEN = 2`),
met de bedoeling dat dit venster later "doorschuift" naarmate de tijd
verstrijkt. **Dat doorschuif-mechanisme bestond nergens in de code** —
het woord "rolling" stond alleen in commentaar, nooit in werkende
logica. Dit is een **structurele leemte die alle drie de sporten
raakt** (Cycling/Running/Rowing), niet een regressie van vandaag.

### Fix
Nieuwe functie **`verlengRollingHorizonIndienNodigCore()`** in
`core.ts`:
- Reconstrueert dezelfde, deterministische mesocyclus-reeks uit de
  al-opgeslagen `plan.start_date`/`end_date` — bewust NIET opnieuw uit
  doelen afgeleid (een gewijzigd doel zou anders een andere reeks
  kunnen geven dan oorspronkelijk gegenereerd)
- Bepaalt het week-offset van de laatste bestaande sessie
- Genereert het eerstvolgende blok (`ROLLING_HORIZON_WEKEN`) zodra er
  nog maar 7 dagen aan sessies over zijn

Aangeroepen in alle drie de trainingsplan-GET-routes (`cycling/
training-plan/route.ts`, `running/training-plan/route.ts`, `rowing/
training-plan/route.ts`), vóór de Daily Adjustment Layer, in een
try/catch (een fout hier mag het ophalen van het plan zelf nooit laten
falen).

**Gevalideerd met de exacte, gerapporteerde data:**
- weekTotaal correct gereconstrueerd (12 weken) uit `start_date`/
  `end_date`
- Week-offset van de laatste sessie (1 augustus) correct bepaald
  (week 1)
- De eerste nieuw te genereren maandag valt **exact op vandaag, 3
  augustus** — precies de ontbrekende dag die gerapporteerd werd

`npx next build` — compileert zonder fouten.

**Test-instructie:** open Running Trainingsplan (of Cycling) — zou nu
automatisch nieuwe sessies moeten bijgenereren, inclusief vandaag.
Ververs daarna Home — Smart Actions zou de trainingsactie weer moeten
tonen.

## v2.4.247 — Kruis-sport-adaptaties zichtbaar gemaakt
**Bewuste architectuurkeuze: eerst transparantie tonen ("dit werkt
écht"), vóórdat de Coach het proactief gaat uitleggen (Intelligence
Platform, latere stap).**

> "Op dit moment doet jouw platform iets heel krachtigs, maar in
> stilte. [...] Juist die transparantie maakt CoachOS geloofwaardig
> en onderscheidend."

### Nieuw: bronsport-tracking door de hele keten
- **`ImpactBijdrage`** (impact-engine.ts) — nieuw verplicht
  `bronSport`-veld, ingevuld door alle drie de impact-adapters
  (rowing/running/cycling)
- **`UniverseleWaarde`** (types.ts) — nieuw `laatste_bron_sport`-veld,
  bijgehouden in `combineerWaarde()`
- **`bepaalKruisSportSignaal()`** (cross-sport-bridge.ts) — bepaalt nu
  de meest voorkomende bronsport onder de belaste dimensies
  (meerderheids-telling over de elevated dimensies, geen gok)
- **`UniversalWorkout`** (workout-builder/types.ts) — nieuw,
  gestructureerd `kruisSportBron`-veld — de UI hoeft geen tekst te
  parsen om het juiste sport-icoon te tonen

### UI
`/coach/rowing/trainingsplan` toont nu een "Workout aangepast"-kaart
(🚣/🏃/🚴 + "beïnvloed door [sport]" + de concrete aanpassingen) zodra
een workout door een andere sport is afgezwakt.

### Consistentie-fix
Rowing's eigen `training-plan/workout`-route kreeg de kruis-sport-
check erbij — ontbrak eerder (alleen Running/Cycling hadden 'm),
inconsistent nu de driehoek volledig wederzijds is.

**Gevalideerd — volledige end-to-end-test:** 90 min roeien →
`laatste_bron_sport: 'rowing'` op de belaste dimensies → kruis-sport-
signaal met `bronSport: 'rowing'` → `workout.kruisSportBron: 'rowing'`
op de uiteindelijke Running-workout. Elke schakel in de keten
bevestigd te werken.

`npx next build` — compileert zonder fouten.

**Test-instructie:** open Rowing Coach → Trainingsplan → tik op een
sessie. Als je recent zwaar hebt getraind in een andere sport, zou nu
een "Workout aangepast"-kaart moeten verschijnen met het juiste
sport-icoon.

## v2.4.246 — FIX: minimale-sessieduur-drempel tegen ruis
**Gemeld met echte data: een sessie van 1 minuut in de Concept2-
historie trok het gemiddelde onterecht mee.**

### Root cause
Gebruiker vroeg letterlijk "kun je dat zien?" — antwoord: nee, geen
live databasetoegang, dus een SQL-query gedeeld om zelf te checken.
Resultaat bevestigde: tussen de echte, langere sessies (45-60 min)
zat één sessie van precies 1 minuut — vermoedelijk een test/
kalibratie-poging, geen echte training.

### Fix
`impact-engine.ts` — nieuwe, gedeelde constante
`MINIMUM_SESSIE_DUUR_MINUTEN = 3`. Toegepast op alle drie de plekken
die sessies naar de Impact Engine sturen:
- `concept2/sync/route.ts`
- `strava-activity-processor.ts` (Running/Cycling)
- `athlete-platform-backfill/route.ts` — geeft nu ook `overgeslagen`
  mee in de respons/melding

Eén bron van waarheid — geen los, dupliceerbaar getal per aanroeper.

**Gevalideerd met de daadwerkelijke, gerapporteerde sessiedata:**
filter slaat correct exact 1 sessie over. **Eerlijke bevinding:** het
"Zeer laag"-resultaat verandert nauwelijks na filtering — de overige
recente sessies (16-25 min) zijn zelf ook al aan de korte kant. Dit
bevestigt dat het eerdere resultaat al grotendeels correct was; deze
fix verwijdert specifiek de échte ruis (de 1-minuut-uitschieter), niet
een onderliggend probleem.

`npx next build` — compileert zonder fouten.

**Test-instructie:** tik nogmaals op "Terugvullen" op `/athlete-
platform` — de melding zou nu moeten vermelden dat 1 sessie is
overgeslagen (korter dan 3 min).

## v2.4.245 — FIX: confidence kon nooit groeien + terugvul-functie
**Gemeld tijdens het testen van een terugvul-idee: na 56
gesimuleerde sessies bleef confidence op LOW staan, in tegenspraak
met de UI-tekst "hoe meer sessies, hoe hoger de confidence".**

### Root cause
`combineerWaarde()` nam altijd de láágste confidence van bestaand/
nieuw — dat kan per definitie nooit boven het startpunt uitkomen,
hoeveel sessies er ook bijkomen. Een échte, inhoudelijke bug, geen
edge case.

### Fix
- **`types.ts`** — `UniverseleWaarde` kreeg een nieuw veld
  `aantal_observaties`
- **`impact-engine.ts`**'s `combineerWaarde()` — confidence groeit nu
  daadwerkelijk met het aantal observaties (`CONFIDENCE_STARTPUNT=15`,
  `+7` per observatie), met de bijdrage's EIGEN `confidence_score` als
  eerlijk plafond. Een reeks MEDIUM-kwaliteit-observaties (alle
  huidige impact-adapters: Rowing/Running/Cycling) kan nooit tot HIGH
  oplopen, ongeacht het aantal sessies — het plafond weerspiegelt de
  kwaliteit van de individuele meting, niet het volume

### Nieuw: terugvul-functie
**`api/specialists/rowing/athlete-platform-backfill`** (POST) —
eenmalige, door de gebruiker getriggerde actie: verwerkt bestaande
Concept2-sessies (van vóór de Impact Engine-koppeling, v2.4.238)
alsnog chronologisch, zodat de staat evolueert zoals 'ie zou hebben
gedaan als de koppeling er vanaf het begin was geweest. Nieuwe knop
op `/athlete-platform` ("Terugvullen met bestaande sessies").

**Gevalideerd:**
- Confidence-groei over 56 gesimuleerde sessies: LOW (22%) na sessie
  1 → MEDIUM (50%) na sessie 5 → bereikt en blijft op het eerlijke
  plafond van 60% (Rowing's eigen MEDIUM-claim) vanaf sessie 10
- Plafond-check: gaat nooit boven de 60%-grens, ook niet na 56
  sessies
- Regressietest: het eerste-sessie-scenario (geen bestaande staat)
  blijft correct werken

`npx next build` — compileert zonder fouten, nieuwe route bevestigd
in de build-output.

**Test-instructie:** open `/athlete-platform` → tik "Terugvullen" →
zou moeten melden hoeveel sessies verwerkt zijn. Ga terug naar de
pagina — de categorieën zouden nu waarden en een gegroeide confidence
moeten tonen i.p.v. "Nog geen data".

## v2.4.244 — Cycling als derde gelijkwaardige sport
**Zelfde patroon als Running (v2.4.242). Daarmee zijn alle drie de
huidige specialisten (Rowing/Running/Cycling) gelijkwaardig op
Workout Platform-niveau, en voedt/ontvangt elke sport de Universal
Impact Engine.**

### Nieuw
- **`src/lib/specialists/cycling-workout-adapter.ts`** —
  `vertaalTarget()`. Cycling had al een gevalideerde FTP-gebaseerde
  vermogenszone-berekening (Coggan 7-zone-model, `cycling-zones.ts`)
  — vertaalt naar concrete vermogenswaarden (bijv. "228W - 263W" bij
  FTP 250W). Geen FTP bekend → eerlijk niets teruggeven
- **`api/specialists/cycling/training-plan/workout`** — mirror van
  Rowing/Running's route, inclusief het kruis-sport-signaal
- **`src/lib/specialists/cycling-impact-adapter.ts`** — Cycling voedt
  nu ook zelf de Universal Impact Engine (`Fietsen` toegevoegd aan de
  generieke dispatch-tabel in `strava-activity-processor.ts`)

### Daarmee: volledig wederzijdse driehoek
Rowing↔Running↔Cycling — elke sport kan nu elke andere sport
beïnvloeden via de Universal Athlete State.

### Kalibratie-observatie, geen bug
Bij 60 minuten (de referentiewaarde) triggert Cycling's eigen kruis-
sport-signaal nog niet — pas bij ~90 minuten (het schaal-plafond)
wordt de 'hoog'-drempel bereikt. Fysiologisch redelijk (minder
belastend dan 90 min roeien/hardlopen), bewust milder gekalibreerd
dan Rowing/Running, geen kunstmatige gelijktrekking.

**Gevalideerd:**
- Vermogenszone-vertaling: correcte Coggan-percentages (zone 2 =
  56-75% van FTP, zone 4 = 91-105%)
- Geen-FTP-scenario geeft terecht een lege vertaling
- Volledige Cycling→Rowing-keten getest: bij 60 min nog geen signaal
  (bevestigt de kalibratie-observatie), bij 90 min (plafond) wél een
  correct signaal met afgezwakte workout

`npx next build` — compileert zonder fouten, nieuwe route bevestigd
in de build-output.

## v2.4.243 — Wederzijdse cross-sport-koppeling + kritieke bugfix
**Tot nu toe voedde alleen Rowing de Universal Impact Engine — het
cross-sport-principe werkte dus maar één kant op. Nu ook Running.**

### Nieuw
- **`src/lib/specialists/running-impact-adapter.ts`** —
  `vertaalRunningSessieNaarImpact()`. Eerlijk anders dan Rowing's
  adapter: geen citaat uit een brondocument (dat bestaat niet voor
  Running), maar eigen, redelijke inschattingen op basis van bekende
  looptrainingsfysiologie. Confidence-score bewust iets lager (55 vs.
  Rowing's 60) om dit verschil te weerspiegelen
- **Generieke dispatch-tabel** in `strava-activity-processor.ts`
  (`IMPACT_ADAPTERS`) — nieuwe sporten toevoegen betekent alleen een
  regel toevoegen, geen sportlogica in de processor zelf. In een
  try/catch, zelfde voorzichtigheidsprincipe als de Concept2-koppeling

### Kritieke bug gevonden en gefixt tijdens het testen
`bepaalKruisSportSignaal()` checkte **geen beenvermoeidheid** — ondanks
dat het eigen commentaar dit al noemde. Omdat Running's belasting
primair in de benen zit (been_vermoeidheid: 70 in de nieuwe adapter),
zou het signaal voor Running-sessies zo goed als nooit zijn afgegaan.
Gevonden door de nieuwe richting (Running→Rowing) te testen — de test
gaf `null` terug ondanks hoge beenvermoeidheid, wat de bug direct
zichtbaar maakte.

**Fix:** `spieren.been_vermoeidheid` toegevoegd aan de conditiecheck.

**Gevalideerd:**
- Vóór de fix: bevestigd dat het scenario `null` gaf (de bug bestond
  echt, niet alleen in theorie)
- Ná de fix: zelfde scenario geeft correct een signaal, Rowing-workout
  wordt terecht afgezwakt
- **Regressietest**: de al-werkende Rowing→Running-richting (v2.4.241/
  242) blijft exact hetzelfde functioneren na deze wijziging

`npx next build` — compileert zonder fouten.

**Daarmee is het cross-sport-principe nu écht wederzijds**, in beide
richtingen getest en werkend: Rowing↔Running.

## v2.4.242 — Running gelijkwaardig aan Rowing op Workout Platform-niveau
**Bewuste architectuurkeuze: niet een simpele demo binnen één sport,
maar de fundering waarop het kruis-sport-principe daadwerkelijk kan
bestaan.**

> "Een simpele Rowing-demo zou technisch sneller zijn, maar
> strategisch minder sterk. Dan bewijs je alleen: 'CoachOS kan binnen
> één sport aanpassen.' Terwijl de echte visie is: 'CoachOS begrijpt
> de complete atleet, ongeacht de sport.'"

### Nieuw
**`src/lib/specialists/running-workout-adapter.ts`** —
`vertaalTarget()`. Belangrijk verschil met Rowing: Running had al een
gevalideerde persoonlijke baseline (VDOT, Daniels/Gilbert-model,
`running-zones.ts`) — de vertaling geeft daarom een **echte pace**
(bijv. "4:16/km - 4:26/km"), niet alleen een generiek zone-label. Geen
VDOT bekend → eerlijk niets teruggeven.

**`api/specialists/running/training-plan/workout`** — mirror van
Rowing's route (v2.4.229), zelfde `TRAININGTYPE_MAP`/`MESOCYCLE_MAP`-
patroon (Running's vocabulaire bleek al grotendeels te matchen:
interval/herstel/tempo zijn identiek, alleen `easy_run`→`endurance` en
`lange_duurloop`→`lange_afstand` nodig).

### Het kruis-sport-signaal, voor het eerst écht toegepast
Na het bouwen van de workout wordt de Universal Athlete State
gecheckt (`bepaalKruisSportSignaal()`, v2.4.241). Als een andere sport
het lichaam al belast heeft, wordt de Running-workout automatisch
afgezwakt via de Adaptation Engine — geen nieuwe logica, hergebruikt
wat al gebouwd en getest was. In een try/catch: een fout in deze
nieuwe laag mag het bouwen van de workout zelf nooit laten falen.

**Gevalideerd:**
- VDOT getest tegen het eigen, geverifieerde worked example (5K in
  20:00 → VDOT 49,8) — exacte match
- Pace-vertaling: concrete bereiken bij bekende VDOT, lege vertaling
  zonder VDOT
- **Volledige cross-sport-keten**, exact zoals de route 'm uitvoert:
  90 min roeien → Universal Athlete State → signaal → Running-workout
  5→4 herhalingen, met kloppende toelichting

`npx next build` — compileert zonder fouten, nieuwe route bevestigd
in de build-output.

**Test-instructie:** roep `/api/specialists/running/training-plan/
workout?sessieId=X` aan voor een Running-sessie, ná een recente
Rowing-sessie — de workout zou nu afgezwakt moeten zijn met een
toelichting die "lichaam al belast" noemt.

## v2.4.241 — Kern van de visie werkend: cross-sport-invloed
**Exact het centrale voorbeeld uit de Universal Athlete Platform
Master Vision, nu een echte, geteste keten i.p.v. theorie.**

> "90 min roeien → morgen opent de gebruiker Running. Running leest
> niet 'gisteren geroeid', maar leest de Universal Athlete State
> (Cardio hoog/Core vermoeid/Upper Body vermoeid) en kiest daarom een
> rustige duurloop — niet omdat er geroeid is, maar omdat het lichaam
> al belast is."

### Nieuw
**`src/core/athlete-platform/cross-sport-bridge.ts`** —
`bepaalKruisSportSignaal()`: leest de Universal Athlete State,
bepaalt of "lichaam al belast" van toepassing is (cardiovasculaire
belasting + core/bovenlichaam-vermoeidheid, bewust NIET mechanische
impact — dat is sport-specifiek en hoort bij een latere verfijning).
Puur signaal-aflevering, geen beslissing (Observer-grens).

### Workout Platform's Adaptation Engine gegeneraliseerd
`pasSlechteSlaapToe()` was hardcoded op de tekst "slecht geslapen" —
omgedoopt naar `pasDownscaleToe(workout, redenLabel)`, met een nieuw
`lichaamAlBelast`-signaal naast het bestaande `slechteSlaap`. **Geen
nieuwe downscale-logica verzonnen** — zelfde, al-geteste mechaniek
(korter/minder herhalingen/lager), nu met een kloppende, specifieke
reden-tekst per trigger.

**Gevalideerd — volledige end-to-end-keten:**
- 90 min roeien → Universal Athlete State → kruis-sport-signaal
  ("cardio al belast, core vermoeid, bovenlichaam vermoeid") →
  Running-workout: 5→4 herhalingen, zone 4→3, met kloppende toelichting
- Regressietest: lege staat (geen sessies) geeft terecht **geen**
  signaal — geen data betekent geen aangenomen belasting
- Regressietest: `slechteSlaap` blijft exact hetzelfde werken als
  vóór de generalisatie
- Immutability bevestigd (origineel ongewijzigd)

`npx next build` — compileert zonder fouten.

## v2.4.240 — FIX: terugknoppen gingen altijd naar Home
**Gemeld: op zowel Performance als Athlete Platform ging de terugknop
altijd naar Home, i.p.v. één stap terug naar waar je vandaan kwam.**

### Root cause
Beide pagina's hadden een hardcoded `<Link href="/home">` als
terugknop — ongeacht vanaf welke pagina de gebruiker er kwam.

### Fix
- `src/app/performance/page.tsx` — Menu-knop gebruikt nu
  `router.back()` i.p.v. `href="/home"`
- `src/app/athlete-platform/page.tsx` — terugknop gebruikt nu
  `router.back()`, ongebruikte `Link`-import opgeschoond

Beide gaan nu altijd één stap terug in de browser-navigatiehistorie —
bijv. vanuit Rowing Coach genavigeerd, dan terug naar Rowing Coach,
niet naar Home.

`npx next build` — compileert zonder fouten.

**Test-instructie:** ga vanuit Rowing Coach naar "Herstel & Coach
Score bekijken" of "Jouw digitale model", tik dan op de terugknop —
zou nu terug moeten naar Rowing Coach, niet naar Home.

## v2.4.239 — Universal Athlete Platform: eerste UI-koppeling
**Vervolg op v2.4.238's echte data-verwerking. Nu voor het eerst
zichtbaar voor de gebruiker.**

### Nieuw
- **`/athlete-platform`** (nieuwe pagina, link vanaf `/coach/rowing`)
  — toont de Universal Athlete State, exact het format uit het
  ontwerpoverleg: kwalitatieve balk (1-5) + label + confidence-
  percentage. **Geen los getal ooit zichtbaar.** Alle 8 categorieën
  (Cardiovasculair/Spieren/Mechanisch/Neurologisch/Herstel/Mentaal/
  Training/Omgeving), elk veld met een leesbaar Nederlands label
- **`api/athlete-platform/state`** — dunne route, hergebruikt
  `haalAthleteState()` rechtstreeks

### Bewuste scheiding van verantwoordelijkheid
De route geeft de volledige `UniverseleWaarde` terug, inclusief
`ruweWaarde` — de UI-laag is verantwoordelijk om dat veld nooit te
tonen (vastgelegd in commentaar), niet de route zelf. De route hoeft
niet te weten wat "veilig tonen" betekent.

`npx next build` — compileert zonder fouten, beide nieuwe routes
bevestigd in de build-output.

**Test-instructie:** sync een Rowing-sessie via Concept2, open dan
Rowing Coach → "🧬 Jouw digitale model" — zou nu balken/labels/
confidence-percentages moeten tonen voor alle 8 categorieën.

## v2.4.238 — Universal Athlete Platform: écht werkend, eerste keer
**Alle vorige Athlete Platform-bouwstappen (v2.4.234-236) waren pure
functies zonder aanroeper. Deze levering maakt het platform voor het
eerst daadwerkelijk actief.**

### Nieuw
**SQL:** `supabase/universal_athlete_state.sql` — opslag, één JSONB-rij
per gebruiker (RLS aan):
```sql
create table if not exists universal_athlete_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
alter table universal_athlete_state enable row level security;
create policy "Gebruikers zien alleen hun eigen Athlete State"
  on universal_athlete_state for all using (auth.uid() = user_id);
```

**`core/athlete-platform/storage.ts`** — `haalAthleteState()`/
`slaAthleteStateOp()`, met `legeAthleteState()` als fallback voor
nieuwe gebruikers (elk veld start op LOW-confidence, "nog geen data").

**`src/lib/specialists/rowing-impact-adapter.ts`** —
`vertaalRowingSessieNaarImpact()`. Verhoudingen **exact overgenomen**
uit het oorspronkelijke visie-voorbeeld (90 min roeien: Cardio+65/
Core+80/Upper Body+75/Legs+45/Impact+5/Fatigue+60), niet zelf
verzonnen. Duur-geschaald t.o.v. een 60-min-referentie, geklemd op
maximaal 150% (voorkomt dat een extreem lange sessie de staat
onrealistisch laat pieken). Confidence bewust op MEDIUM — eerlijk
benoemd in commentaar als "geen gevalideerde sportwetenschappelijke
formule".

### Koppeling
`concept2/sync/route.ts` — na elke nieuw geïmporteerde sessie wordt nu
de Universal Athlete State bijgewerkt (Impact Engine + opslag). Bewust
in een try/catch: een fout in deze nieuwe, experimentele laag mag de
sync zelf (de kernfunctionaliteit — data importeren) nooit laten
falen.

**Gevalideerd — 4 scenario's:**
- 90 minuten (het exacte visie-scenario): **alle** waarden matchen
  precies de originele cijfers uit het visiedocument
- 60 minuten (de referentiewaarde zelf): Cardio 43, correct
- 180 minuten (plafond-check): identieke output aan 90 minuten,
  bevestigt het 150%-plafond werkt
- Volledige integratie: lege staat + 90-min-sessie → correcte
  eindwaarden in het opslagformaat

`npx next build` — compileert zonder fouten.

## v2.4.237 — Knowledge Platform: eerste onderdeel (Trainingszones)
**Vervolg op de Universal Athlete Platform-bouwstappen. Anders dan de
vorige twee leveringen: deze koppelt DIRECT aan een bestaande,
werkende consument (de Workout Builder), dus wél zichtbaar effect op
de codebase (al is de output identiek — puur een refactor).**

### Nieuw
`src/core/knowledge-platform/trainingszones.ts` — het standaard
5-zone-trainingsmodel: `TRAININGSZONES` (percentage HFmax, RPE-
equivalent, doel, instructie per zone 1-5) + `haalTrainingszone()`.

### Refactor — builder.ts gebruikt nu deze kennisbron
`src/core/workout-builder/builder.ts` haalde instructieteksten
voorheen uit hardcoded strings, verspreid over meerdere functies (met
duplicatie — dezelfde tekst stond op 2 plekken). Nu: één bron van
waarheid via `haalTrainingszone(n)?.instructie`, met expliciete
sportwetenschappelijke herkomst (%HFmax/RPE) i.p.v. verzonnen zinnen
zonder onderbouwing.

**Bewust NIET toegepast op warmup/cooldown** — die zijn conceptueel
iets anders dan "zone volhouden" (opbouwend/afbouwend, geen sustained
effort), ook al is het target-zonenummer (1) hetzelfde. Die twee
behouden hun eigen, specifieke tekst.

### Eerlijke beperking
Dit is het algemeen aanvaarde, generieke 5-zone-model — geen
gepersonaliseerde zones (vergt een eigen FTP/HFmax-meting, bewust nog
niet gebouwd, zie Rowing Profiel-instellingen).

### Fout gevonden en gefixt tijdens het bouwen
Een typfout in het eigen commentaarblok (`%` i.p.v. `//` aan het begin
van een regel) — zou een TypeScript-syntaxfout hebben gegeven. Gevonden
en gefixt vóór de build-validatie.

**Gevalideerd — regressietest:** alle 5 trainingType-scenario's
(interval/herstel/tempo/endurance/sprint) getest — geven **exact
dezelfde instructietekst** als vóór de refactor. De centralisatie
heeft dus geen enkele gedragswijziging veroorzaakt, puur de bron is
nu gecentraliseerd. `npx next build` — compileert zonder fouten.

## v2.4.236 — Universal Athlete Platform: Learning Rules Engine
**Vervolg op typedefinities (v2.4.234) en Universal Impact Engine
(v2.4.235). Ontdekt persoonlijke patronen — bewust NIET "AI" genoemd.**

### Nieuw
`src/core/athlete-platform/learning-rules-engine.ts`:
- **`evalueerRegels()`** — evalueert `LearningRule`s tegen een
  `LearningContext` (sport/aantalSessies/recoveryTrend/RPE-stabiliteit)
- **`STANDAARD_REGELS`** — eerste regel is letterlijk het voorbeeld uit
  de Master Vision zelf: `aantalSessies > 30 AND recoveryTrend >
  baseline AND RPE stabiel → herstel_capaciteit +4%`
- Elke regel heeft een **verplichte, mens-leesbare `beschrijving`** —
  100% reproduceerbaar en uitlegbaar, geen black box

### Drempel-gate direct toegepast
Hergebruikt `bepaalPersonalisatieStatus()` uit v2.4.234 — onder de
minimum-datapunten-drempel wordt **geen enkele regel geëvalueerd**,
expliciet `population_model` in de uitkomst (geen stilzwijgende lege
lijst zonder verklaring).

### Onderscheid vastgelegd
Niet te verwarren met de al-bestaande `src/lib/specialists/
learning-engine.ts` (Coach Memory — AI-gegenereerde inzichten voor
coach-gesprekken). Dit hier: statistische, regelgebaseerde patronen op
de Universal Athlete State, geen AI-tekst, geen conversatie-geheugen.
Expliciet in commentaar vastgelegd om toekomstige verwarring te
voorkomen.

**Gevalideerd — 4 scenario's:**
- Onder de drempel (10 sessies): 0 regels geëvalueerd, expliciet
  `population_model`
- Exact het visie-scenario (35 sessies, positieve trend, stabiele
  RPE): regel vuurt, geeft het juiste `+4%`-effect
- Zelfde situatie maar instabiele RPE: regel vuurt terecht niet
- Grensgeval (31 sessies, net boven de `>30`-conditie): regel vuurt
  correct

`npx next build` — compileert zonder fouten.

**Volgende stap:** Knowledge Platform (de zijlaag met sportwetenschap,
geraadpleegd door Workout Platform/Learning Rules Engine/Specialisten).

## v2.4.235 — Universal Athlete Platform: Universal Impact Engine
**Vervolg op de typedefinities (v2.4.234). Vertaalt een voltooide
sessie naar wijzigingen in het digitale model van de sporter.**

### Nieuw
`src/core/athlete-platform/impact-engine.ts`:
- **`pasImpactToe()`** — combineert een lijst `ImpactBijdrage`s (al
  vertaald door een Specialist Adapter, deze Engine kent zelf geen
  FTP/SPM/pace) met de bestaande `UniversalAthleteState`, geeft een
  nieuw object terug
- **`combineerWaarde()`** — het kerncombinatiemodel: exponentieel
  voortschrijdend gemiddelde (30% weegt de nieuwe sessie mee, 70% de
  bestaande staat) — **eerlijk benoemd als een redelijk startpunt,
  geen sportwetenschappelijk gevalideerde formule**
- **Confidence daalt nooit kunstmatig** — resulterende confidence is
  altijd de laagste van de twee brondelen, nooit hoger dan wat de
  zwakste bijdrage rechtvaardigt

### Robuustheid
Onbekende/foutieve dot-paden worden overgeslagen met een
`console.error`, geen crash — een bug in een toekomstige Specialist
Adapter mag nooit de hele state-update voor alle andere dimensies
laten falen. Immutability gegarandeerd (diepe kopie, zelfde patroon
als de Workout Platform's Adaptation Engine).

**Gevalideerd:**
- Combinatiemodel: eerste-keer-situatie (geen bestaande staat), exact
  het visie-voorbeeld (Rowing 90 min, Cardio 30→41 met de juiste
  berekening), confidence-daalt-nooit-kunstmatig bevestigd
- Volledige integratietest op een echte `UniversalAthleteState` (alle
  8 categorieën) — inclusief een bewust onbekend pad dat netjes
  wordt overgeslagen, en immutability bevestigd (origineel blijft
  ongewijzigd)

`npx next build` — compileert zonder fouten.

**Volgende stap:** Learning Rules Engine (met de minimum-datapunten-
drempel uit v2.4.234).

## v2.4.234 — Universal Athlete Platform: eerste bouwstap (typedefinities)
**Eerste bouwstap van de nieuwe Universal Athlete Platform-laag
(vastgelegd 2 augustus 2026). Puur datamodel, nog geen logica.**

### Nieuw
`src/core/athlete-platform/types.ts`:
- **`UniversalAthleteState`** — het digitale model van de sporter, acht
  categorieën: Cardiovasculair, Spieren, Mechanisch, Neurologisch,
  Herstel, Mentaal, Training, Omgeving (rechtstreeks uit de Master
  Vision, geen sport-specifieke velden — dat hoort bij de latere
  Specialist Adapters)
- **`UniverseleWaarde`** — het kern-datatype: verplicht een kwalitatief
  `niveau` + `confidence`, geen los getal. `ruweWaarde` bestaat alleen
  voor intern engine-gebruik, expliciet gemarkeerd als "NOOIT
  rechtstreeks tonen aan de gebruiker" — implementeert de "geen
  schijnprecisie"-kernregel direct in het type zelf
- **`bepaalPersonalisatieStatus()`** — de minimum-datapunten-drempel
  (Running/Cycling/Rowing: 20 trainingen, Strength: 15) —
  `population_model` vs. `learning_enabled`

### Kernregels direct in de types verankerd
1. Universal Athlete Platform is een Observer — dit datamodel bevat
   zelf geen beslislogica, alleen beschrijving
2. Geen schijnprecisie — elke waarde is verplicht een label +
   confidence, nooit een kaal getal
3. Personalisatie pas na een bewezen datadrempel — voorkomt overtuigde,
   foute personalisatie op toeval

**Gevalideerd:** drempel-functie getest — 5 scenario's, inclusief het
exacte grensgeval (19 vs. 20 trainingen), een sport met een eigen,
lagere drempel (Strength: 15), en een fallback-drempel voor
toekomstige, nog onbekende sporten. `npx next build` — compileert
zonder fouten.

**Volgende stap:** Universal Impact Engine (vertaalt een voltooide
specialist-sessie naar wijzigingen in de Universal Athlete State).

## v2.4.233 — Rowing dashboard-verrijking
**Volgende stap in de vastgelegde volgorde.**

### Nieuw
`/coach/rowing` toont nu een "Trainingsbelasting"-kaart met week-/
maandstatistieken (aantal sessies, minuten, afstand — indien
beschikbaar via Concept2-metrics). Puur afgeleid uit de al-opgehaalde
90-dagen-activiteitendata (`haalRowingData()`) — **geen nieuwe route
of databron**.

### Bewuste keuze
Recovery/Readiness/Coach Score worden hier NIET herberekend — die zijn
platformbreed, niet sport-specifiek. Een link naar het al-bestaande
`/performance` voorkomt dubbele logica in plaats van dezelfde cijfers
op twee plekken te berekenen.

### Opgeschoond
Lege-staat- en "Binnenkort"-teksten bijgewerkt — vermeldden nog
Concept2-koppeling en Trainingsplan als toekomstige features, terwijl
beide al weken eerder in deze sessie af waren.

**Gevalideerd:** week-/maandvenster-berekening getest met een
realistische datumspreiding (sessies binnen/buiten beide vensters) —
correcte telling en correcte uitsluiting van data buiten het venster.
`npx next build` — compileert zonder fouten.

**Test-instructie:** open Rowing Coach — zou nu een "Trainingsbelasting"-
kaart moeten tonen met week-/maandcijfers, met een link naar Performance.

## v2.4.232 — Rowing Coach Memory
**Volgende stap in de logische volgorde (geen tussentijdse bevestiging
meer nodig, op verzoek).**

### Nieuw
`api/specialists/rowing/memory` — dunne wrapper, exact het patroon van
`cycling/memory`/`running/memory`. De onderliggende Learning Engine
(`verwerkKandidaatInzicht()`/`haalMemoryOp()`) bleek al volledig
sport-onafhankelijk (`specialist_type: string`, geen hardcoded
cycling/running-union) — Rowing sluit gewoon aan, geen wijziging aan
de Engine zelf nodig.

### Nog niet gebouwd
Automatische inzicht-generatie via een Rowing-coach-conversatieroute —
bij Cycling/Running is dit ook nog gemarkeerd als "tijdelijk, alleen
handmatig testbaar via POST" (de Coach Layer-koppeling is daar zelf
ook nog een aparte, latere stap). Rowing volgt dezelfde status.

`npx next build` — compileert zonder fouten, nieuwe route bevestigd
in de build-output.

## v2.4.231 — REGRESSIE-FIX: Smart Actions/Home miste actieve Rowing-sessies
**Gemeld: "bij Snelle Acties is training schema weg."**

### Root cause
`src/lib/today-engine.ts` — gebruikt door zowel Smart Actions als
Home's hoofdadvies-kaart — kende hardcoded alleen `'cycling' |
'running'`. `haalSpecialistSessieVanVandaag()` werd nooit met
`'rowing'` aangeroepen, dus een actief Rowing-trainingsplan werd
volledig genegeerd door de Today Engine.

De code was hier overigens al expliciet op voorbereid (bestaand
commentaar: "proposals[] i.p.v. losse if/else, klaar voor meer
specialisten later") — Rowing toevoegen was daardoor een kwestie van
hetzelfde patroon volgen, niet een herontwerp. Bevestigd:
`kiesTussenProposals()`/de Decision Engine werken al generiek met een
array, geen aanname van precies 2 specialisten.

### Fix
- `TodayPlan['source']` en `SpecialistProposal['sport']` uitgebreid
  met `'rowing'`
- `haalSpecialistSessieVanVandaag(userId, 'rowing', vandaag)`
  toegevoegd aan de parallelle Promise.all-aanroep
- Rowing-sessietype-labels toegevoegd aan `SPORT_LABELS` (endurance/
  recovery/lange_afstand/test — exact matchend met training-plan-
  engine/rowing-adapter.ts's vocabulaire)

### Twee extra instanties van dezelfde vocabulaire-mismatch gevonden
**Zelfde bug-klasse als eerder vandaag bij de Training Plan Engine-
koppeling (v2.4.229):**
1. Hardcoded cycling/running-ternary in de reden-tekst ("Onderdeel van
   je Cycling/Running-trainingsplan") zou bij Rowing altijd "Running"
   tonen — vervangen door generieke `SPORT_NAAM_LABEL`-mapping
2. Intensiteitsbepaling checkte alleen `'herstel'`, niet Rowing's
   `'recovery'` — een Rowing-hersteldag zou als "matig" i.p.v. "licht"
   intensiteit gemeld zijn

### UI
Rowing-icoon (🚣) toegevoegd aan zowel `api/smart-actions/route.ts`
als `home/page.tsx`'s advieskaart — vielen eerder terug op het
generieke 💪/"Trainer AI"-label.

**Gevalideerd — 4 scenario's:**
- Rowing endurance-sessie krijgt correct label "Duurtraining"
- Reden-tekst noemt correct "Rowing" (niet "Running")
- Rowing recovery-sessie krijgt correct lichte intensiteit (niet matig)
- Cycling herstel-sessie blijft ongewijzigd correct werken (regressie-
  vrij bevestigd)

`npx next build` — compileert zonder fouten.

**Test-instructie:** open Home met een actief Rowing-trainingsplan
met een sessie voor vandaag — zou nu weer moeten verschijnen bij
Smart Actions én Home's hoofdadvies-kaart, met een 🚣-icoon.

## v2.4.230 — UI voor de concrete workout (Rowing Fase 2)
**Vervolg op v2.4.229's backend-koppeling. Eerste keer dat een
gebruiker het Core Platform daadwerkelijk te zien krijgt.**

### Nieuw
`src/app/coach/rowing/trainingsplan/page.tsx`:
- Elke sessie in de lijst is nu **tikbaar** — klapt uit naar de
  concrete workout
- **`WorkoutDetail`**-component — haalt op bij `api/specialists/
  rowing/training-plan/workout`, toont per blok: type/duur/herhalingen/
  rustpauzes/instructie/SPM-bereik
- Ontbrekend materiaal wordt bovenaan getoond als waarschuwing
- Uitvoeringshints (volgorde/audio-cues) onderaan

**Voor:** "Interval, 60 min" (alleen een type-label)
**Na:** "Intervallen · 5× 9 min (2 min rust ertussen), 28-32 SPM,
gecontroleerd tempo — niet forceren in de eerste herhalingen"

`npx next build` — compileert zonder fouten.

**Test-instructie:** open Rowing Coach → Trainingsplan → tik op een
sessie — zou nu de concrete workout-opbouw moeten tonen, niet alleen
type+duur.

## v2.4.229 — Rowing Fase 2: eerste echte aansluiting op de Workout Platform
**De eerste plek waar het Core Platform (v2.4.224-228) daadwerkelijk
sportspecifieke betekenis krijgt.**

### Nieuw
- **`src/lib/specialists/rowing-workout-adapter.ts`** — vertaalt
  generieke `WorkoutTarget`s naar roeispecifieke SPM-bereiken (zone 1
  t/m 5, generieke vuistregels uit de roeiwereld, geen persoonlijke
  baseline nodig). Split/Power geven bewust `{}` terug — die vereisen
  een 2k-testtijd-referentiepunt dat nog niet bestaat
- **`api/specialists/rowing/training-plan/workout`** — bouwt een
  concrete workout voor een gegeven sessie (Builder), valideert 'm
  (Validation Engine), vertaalt targets (Rowing Adapter), geeft
  materiaal + uitvoeringshints mee

### Belangrijke inconsistentie gevonden vóór het bouwen, opgelost
De Training Plan Engine's rowing-adapter gebruikt `'recovery'` als
sessietype, de Workout Platform's `WorkoutTrainingType` verwacht
`'herstel'`. Zonder mapping zou een herstel-sessie stil verkeerd
verwerkt worden. **Fix:** expliciete `TRAININGTYPE_MAP` bij de
koppeling. Getest met expliciet bewijs dat `'recovery'` zónder de
mapping niet herkend zou worden door de Workout Platform.

### Twee fouten gevonden en gefixt tijdens het bouwen zelf
1. Aangenomen tabel `user_equipment` bestaat niet — equipment staat
   als boolean-kolommen in `profiles` (`concept2_available`),
   gecorrigeerd naar de al-bestaande structuur
2. Ongeteste Supabase-join-syntax vervangen door twee losse, simpele
   queries — bewezen patroon, consistent met eerdere routes vandaag

### Eerlijke beperking
Alleen SPM vertaalbaar (geen baseline nodig). Split/Power wachten op
het 2k-testtijd-referentiepunt — bewust nog niet gebouwd.

**Gevalideerd:**
- Type-mapping: alle 4 Training Plan Engine-types matchen correct na
  mapping, met expliciet bewijs van het probleem zonder de fix
- SPM-vertaling: zone 2→20-24 SPM, zone 4→28-32 SPM, niet-zone-targets
  geven terecht niets terug
- `npx next build` — compileert zonder fouten, route bevestigd in de
  build-output

**Test-instructie:** roep `/api/specialists/rowing/training-plan/
workout?sessieId=X` aan voor een bestaande Rowing-sessie — zou een
concrete, gevalideerde workout met SPM-targets moeten teruggeven.

## v2.4.228 — CoachOS Workout Platform: Fase 1, stap 5 — Fase 1 compleet
**Laatste drie onderdelen van het Core Platform: Equipment/Execution/
Alternative Engine.**

### Nieuw
- **`equipment.ts`** — `bepaalMateriaal()`: filtert een aangeleverde
  benodigd/optioneel-lijst tegen daadwerkelijk beschikbaar materiaal,
  geeft ook een `ontbreekt`-lijst terug voor eventuele vervolgstappen
  (bijv. de Alternative Engine inschakelen)
- **`execution.ts`** — `genereerUitvoeringsHints()`: leesbare volgorde-
  omschrijving + audio-cue-momenten, 100% afgeleid uit de bestaande
  workout-structuur
- **`alternative.ts`** — `bepaalAlternatieven()`: filtert/matcht
  aangeleverde alternatieven tegen de huidige context, met
  deduplicatie op workout_id

Alle drie bewust GEEN eigen sport- of materiaalkennis — matcht de
Kernregel die door heel Fase 1 is aangehouden: de aanroeper (later:
Specialist Adapter) levert de sportspecifieke kennis aan, de Core
Platform-laag past 'm alleen consistent toe.

**Gevalideerd:** alle drie los getest met concrete scenario's —
Equipment Engine (materiaal dat ontbreekt komt correct in de
`ontbreekt`-lijst), Execution Engine (nette volgorde inclusief
herhalings-/rust-vermelding, gebouwd op een echte Builder-output),
Alternative Engine (filtert correct op reden, geeft niets terug als
er niets aan de hand is). `npx next build` — compileert zonder
fouten.

### Fase 1 (Core Platform) is hiermee volledig compleet
Object (v2.4.224) → Builder (v2.4.225) → Validation (v2.4.226) →
Adaptation (v2.4.227) → Equipment/Execution/Alternative (v2.4.228).

**Volgende stap: Fase 2 — Rowing als referentie-implementatie.** De
Rowing Specialist gebruikt de Workout Platform als eerste, echte
aanroeper — de eerste plek waar dit Core Platform daadwerkelijk
sportspecifieke betekenis krijgt.

## v2.4.227 — CoachOS Workout Platform: Fase 1, stap 4 (Adaptation Engine)
**Vervolg op Validation Engine (v2.4.226). Past een al-gebouwde workout
automatisch aan — draait ná de Builder, vóór de Validation Engine.**

### Nieuw
`src/core/workout-builder/adaptation.ts` — `pasWorkoutAan()`, bewust
EXACT de twee voorbeelden uit de Master Vision:

**Slechte slaap:**
1. Kortere warming-up (-30%, ondergrens 3 min)
2. Minder intervallen (-1 herhaling, ondergrens 2)
3. Lagere intensiteit (-1 zone op alle hoofdblok-targets)

**Extra beschikbare tijd:**
1. Hoofdblok verlengd (50% van de extra tijd)
2. Cooling-down verlengd (30%)
3. Mobiliteitsblok toegevoegd (resterende ~20%, alleen als er nog geen
   mobility-blok bestaat)

Ook het omgekeerde afgehandeld (niet expliciet in de visie genoemd,
maar een logische tegenhanger): **minder tijd dan gepland** verkort
het hoofdblok proportioneel, met een praktische ondergrens van 5 min.

### Transparantie + veiligheid
Elke wijziging wordt vastgelegd in `workout.adaptations` — matcht het
al-bestaande principe van de Training Plan Engine's
REASON_CODE_UITLEG ("waarom ziet mijn training er zo uit"). Het
originele workout-object wordt **nooit gemuteerd** (diepe kopie vóór
elke wijziging) — de aanroeper behoudt altijd de ongewijzigde versie.

**Gevalideerd — volledige ketentest (Builder → Adaptation →
Validation):**
- Slechte slaap: warmup 360→252s (exact -30%), herhalingen 5→4, zone
  4→3 — alle drie de vision-voorbeelden bevestigd, origineel blijft
  ongewijzigd (immutability bevestigd)
- Extra tijd (+20 min): hoofdblok +10 min, cooldown +6 min,
  mobiliteitsblok van 4 min toegevoegd — alle drie bevestigd
- De aangepaste workout blijft geldig volgens de Validation Engine

`npx next build` — compileert zonder fouten.

**Daarmee is Fase 1 (Core Platform: Object/Builder/Validation/
Adaptation) compleet.** Resterende, kleinere Core-onderdelen
(Alternative/Equipment/Execution Engine) en Fase 2 (Rowing als
referentie-implementatie) volgen als losse vervolgstappen.

## v2.4.226 — CoachOS Workout Platform: Fase 1, stap 3 (Validation Engine)
**Vervolg op Builder (v2.4.225). Controleert of een gebouwde workout
compleet en veilig is.**

### Nieuw
`src/core/workout-builder/validation.ts`:
- **`valideerWorkout()`** — structurele checks (warmup/cooldown/
  hoofdblokken bestaan, elk blok heeft een geldige duur/herhalings-
  aantal) + optionele context-checks (past binnen beschikbare tijd,
  past binnen de huidige CoachPolicy-intensiteitsgrens — "veilige
  belasting")
- **`berekenWerkelijkeTotaleDuur()`** — rekent correct met `repeat`/
  `rust_na_repeat_sec`: een interval-blok van 540s met 5 herhalingen
  duurt in werkelijkheid geen 540s maar 3060s inclusief rustpauzes
- **`ValidationContext`** — bewust klein gehouden (alleen
  `beschikbareTijd_sec`/`maxIntensiteit`), geen volledige Recovery/
  Fatigue/Coach Agenda-koppeling — die volgt zodra er een concrete
  aanroeper is die deze data al heeft

### Gevalideerd
- Werkelijke-duur-berekening: interval-blok (5×540s, 90s rust) geeft
  correct 3060s, een niet-herhalend blok blijft ongewijzigd
- Tijdsvalidatie: workout die te lang duurt wordt correct gemeld,
  workout die past geeft geen probleem
- **Integratietest** (Builder + Validation samen): een gebouwde 60-
  minuten-workout klopt exact op 3600s werkelijke duur en krijgt groen
  licht; dezelfde workout wordt terecht geblokkeerd op een dag met
  `maxIntensiteit: 'low'` ("Trainingstype interval is een hoge-
  intensiteit-sessie, maar CoachPolicy staat vandaag alleen lage
  intensiteit toe")

`npx next build` — compileert zonder fouten.

**Volgende stap:** Adaptation Engine (past een workout automatisch
aan bij bijv. slechte slaap of extra beschikbare tijd).

## v2.4.225 — CoachOS Workout Platform: Fase 1, stap 2 (Workout Builder)
**Vervolg op v2.4.224's typedefinities. De daadwerkelijke assemblage-
logica die het datamodel vult.**

### Nieuw
`src/core/workout-builder/builder.ts` — `bouwWorkout()`:
- **Bewust een kleine, concrete input-set** (sport/trainingType/duur/
  mesocyclus/niveau) — niet meteen alle 18 inputs uit de Master Vision
  (Coach Policy/Weer/Terrein/Beschikbare locatie/etc.) tegelijk
  aangesloten. Die volgen als losse, latere integratiestappen, zodra
  er een concrete specialist is die ze nodig heeft.
- **100% deterministisch** — geen AI-aanroep, matcht de Kernregel uit
  de Master Vision
- Verdeelt de gevraagde totale duur: warmup (10%, geklemd tussen 5-15
  min) / hoofdblok(ken) / cooldown (5%, geklemd tussen 3-10 min)
- Interval-sessies krijgen een aantal herhalingen afhankelijk van
  mesocyclus (basis 4 / opbouw 5 / piek 6 / herstel 3) + niveau
  (beginner -1, gevorderd +1), met automatisch berekende werk/rust-
  verdeling die binnen het beschikbare hoofdblok-budget blijft
- Targets blijven generiek (`zone`-nummers, geen sportspecifieke
  waarden) — de Specialist Adapter (latere stap) vertaalt dit naar
  sportspecifieke targets

### Randgeval gevonden én gefixt tijdens het testen
Bij een extreem korte sessie (<8 min totaal) konden de vaste
ondergrenzen van warmup (min 5 min) + cooldown (min 3 min) samen de
gevraagde totale duur overschrijden — een 5-minuten-sessie werd dan
in werkelijkheid 9 minuten. **Fix:** als warmup+cooldown samen meer
dan 50% van de totale duur zouden innemen, worden ze evenredig
verkleind. Normale sessies (bijv. 60 min) blijven volledig ongewijzigd
door deze fix — alleen het randgeval wordt geraakt.

**Gevalideerd — 3 scenario's:**
- 60 minuten (normale sessie): warmup 6 min/cooldown 3 min/hoofdblok
  51 min, totaal klopt exact
- Interval-verdeling (opbouw-mesocyclus, gemiddeld niveau): 5
  herhalingen, werk/rust-tijd past exact binnen het beschikbare budget
- 5 minuten (het gevonden randgeval): vóór de fix zou dit 9 minuten
  worden, ná de fix klopt de totale duur exact (300s)

`npx next build` — compileert zonder fouten.

**Volgende stap:** Validation Engine (controleert of een gebouwde
workout wel past binnen beschikbare tijd/herstel, warmup/cooldown
aanwezig zijn, etc.).

## v2.4.224 — CoachOS Workout Platform: Fase 1, stap 1 (typedefinities)
**Eerste bouwstap van de nieuwe, vijfde platformlaag (Context/Training/
Workout/Performance/Intelligence). Puur datamodel, nog geen logica.**

### Nieuw
`src/core/workout-builder/types.ts`:
- **`UniversalWorkout`** — het sport-onafhankelijke centrale object
  (id/sport/goal/mesocycle/trainingType/duration/warmup/mainBlocks/
  cooldown/targets/coachNotes/equipment/metrics/adaptations/alternatives)
- **`WorkoutBlock`** — elk blok (warmup/hoofdblok/interval/herstel/
  techniek/cadans/mobiliteit/cooldown), met `duration_sec` (bewust
  seconden, niet minuten — voorkomt het soort eenheidsverwarring dat we
  eerder tegenkwamen bij Concept2/Strava's duration-velden)
- **`WorkoutTarget`** — universele targettypen (heart_rate/power/
  cadence/pace/speed/stroke_rate/rpm/rpe/ftp_percentage/
  critical_power_percentage/zone), geen sportspecifieke namen
- Ondersteunende types: `WorkoutTrainingType`, `WorkoutExecutionType`,
  `WorkoutMesocycle`, `WorkoutDifficulty`, `WorkoutMetrics`,
  `WorkoutEquipment`

### Bewuste architectuurkeuzes, vastgelegd in commentaar
- Geen sportlogica in dit bestand — dat hoort uitsluitend bij een
  latere Specialist Adapter (matcht de "Kernregel" uit de Master Vision)
- `coachMessage` op blok-niveau mag door AI geschreven worden, de
  `instruction` (structuur/uitvoering) nooit — zelfde AI-grens als
  overal elders in CoachOS

`npx next build` — compileert zonder fouten (puur een type-bestand,
de TypeScript-compilatie zelf is hier de validatie).

**Volgende stap:** Workout Builder (de daadwerkelijke assemblage-
logica die dit datamodel vult).

## v2.4.223 — Rowing Platform Fase 1, stap 3: Training Plan Engine
**Grote, onverwachte versnelling: de bestaande Training Plan Engine
bleek al een adapter-patroon te gebruiken — Rowing kon aansluiten
i.p.v. een hele nieuwe engine te bouwen.**

### Ontdekking
`src/lib/specialists/training-plan-engine/core.ts` is al 100% sport-
agnostisch (periodisering/mesocycli/adaptieve aanpassingen), met
Cycling en Running elk een eigen, kleine adapter (`cycling-adapter.ts`/
`running-adapter.ts`, ~55 regels elk). Rowing kon hetzelfde patroon
volgen.

### Nieuw
- **`training-plan-engine/rowing-adapter.ts`** — terminologie
  afgestemd op de al-bestaande `rowing-drills.ts` (session_type:
  recovery/endurance/interval/test), geen nieuwe, parallelle
  vocabulaire verzonnen. `lange_afstand` toegevoegd als vierde type
  (matcht de al-bestaande "Lange Afstand Row"-drill). Gebruikt de
  al-bestaande `haalRowingData()` rechtstreeks voor wekelijkse-uren-
  berekening — geen vooruitgebouwde analyse-engine
- **`api/specialists/rowing/training-plan`** (GET/POST/PATCH) — exact
  het Running-patroon (rechtstreeks `genereerTrainingsplanCore()`/
  `voerDailyAdjustmentUitCore()`, niet de Cycling-route die nog een
  legacy-wrapper gebruikt)
- **`api/specialists/rowing/profile`** + **`/settings/rowing-profile`**
  — bewust MINIMAAL: alleen trainingsdagen + beschikbare uren. Een
  2k-testtijd-gebaseerd "FTP-equivalent voor roeien" (uit de Master
  Vision) is bewust NIET meegebouwd — hoort bij een latere,
  intensiteits-gerichte verfijning
- **`/coach/rowing/trainingsplan`** — genereren/tonen/pauzeren/
  hervatten, spiegelbeeld van de Cycling-pagina, bewust compacter (nog
  geen AI-uitleglaag)
- Link vanaf `/coach/rowing` naar zowel het nieuwe trainingsplan als
  het profiel

### Bug gevonden en gefixt in de Core zelf
Eén hardcoded `cycling`/`running`-ternary in de foutmelding bij "geen
trainingsdagen ingesteld" — zou bij Rowing altijd "Running Profile"
tonen, óók voor een Rowing-gebruiker. Ironisch genoeg precies wat de
Core's eigen documentatie al zei te willen voorkomen ("geen enkele
sportnaam-check hoort in de Core"). Nu echt generiek
(`adapter.sport`-gebaseerd).

**Gevalideerd:**
- Sessietype-verdeling: 3 scenario's (normale opbouw-week met
  interval, herstelweek waarin geen enkele sessie meer 'interval' is,
  0 trainingsdagen zonder crash)
- `npx next build` — compileert zonder fouten, alle 6 nieuwe routes/
  pagina's bevestigd in de build-output

**Test-instructie:** ga naar Rowing Coach → Rowing Profiel, stel
trainingsdagen in, sla op. Ga terug, tik op "Trainingsplan" → "Genereer
trainingsplan" — zou een periodisering-gebaseerd schema moeten tonen.

## v2.4.222 — Structurele dedup-fix: geen dubbele roeisessies meer
**Gevraagd: "En Garmin?" + "structureel goed" i.p.v. alleen een
weergave-fix. Beide kanten aangepakt.**

### Prioriteitsvolgorde
Concept2 (3, het apparaat zelf — meest betrouwbaar voor roeien) >
Garmin (2) > Strava/Apple Health (1) > handmatig (0).

### Fix 1 — Concept2-sync ruimt lagere-prioriteit-duplicaten op
`api/specialists/rowing/concept2/sync/route.ts` — na een succesvolle
import wordt nu ook gecheckt of er voor diezelfde dag al een Strava/
Garmin/handmatig-record bestaat; zo ja, wordt dat verwijderd. Vangt
het geval "Strava was er eerder dan Concept2".

### Fix 2 — import-preventie bij Strava/Garmin
Drie bestanden aangepast, allemaal met exact dezelfde check (vóór het
opslaan: bestaat er al een Concept2-sessie voor deze dag?), **bewust
alleen voor `'Roeien'`**, geen invloed op andere sporten:
- `src/lib/strava-activity-processor.ts`
- `src/app/api/health/garmin-activity-tcx/route.ts`
- `src/app/api/health/garmin-activity-vision/route.ts`

Vangt het geval "Concept2 was er eerder dan Strava/Garmin".

### Fix 3 — extra vangnet op weergaveniveau
`coach/rowing/page.tsx` — `dedupliceerOpDatum()` blijft ook staan,
voor records die al vóór deze fix zijn geïmporteerd (dubbel-op-dubbel
is geen probleem, puur presentatie).

### Eerlijk benoemde beperking
Dedup werkt per **datum**, niet per exacte sessie. Twee echte,
verschillende trainingen op één dag zouden ten onrechte als duplicaat
behandeld kunnen worden. Bewuste, pragmatische keuze — een preciezere
fix (matchen op starttijd) is aanzienlijk complexer en bewust niet
stilzwijgend meegebouwd.

**Gevalideerd:** dedup-logica getest met exact het gerapporteerde
scenario (9/30 juni, dubbel via strava+concept2) — geeft correct 2
records terug, beide bron concept2. `npx next build` — compileert
zonder fouten.

**Test-instructie:** open Rowing Coach — de eerder dubbele 9/30 juni-
sessies zouden nu nog maar één keer moeten verschijnen (bron
"concept2"). Nieuwe Strava/Garmin-imports van roei-sessies die
Concept2 al heeft, zouden vanaf nu stil overgeslagen moeten worden.

## v2.4.221 — SQL-fix: root cause van de "0/0"-sync gevonden
**v2.4.220's diagnostiek werkte precies zoals bedoeld — direct de
exacte oorzaak teruggekregen: "56 gevonden bij Concept2. Fout bij
opslaan: new row for relation 'activity_sessions' violates check
constraint 'activity_sessions_source_check'".**

### Root cause
Een database-constraint op `activity_sessions.source` stond alleen
`manual`/`garmin`/`apple_health`/`strava` toe. `'concept2'` ontbrak —
alle 56 gevonden sessies werden dus gevonden, maar geen van alle kon
worden opgeslagen.

### Fix — SQL only, geen codewijziging
Vóór het schrijven van de fix eerst de huidige constraint-definitie
opgevraagd (`pg_get_constraintdef`) om zeker te weten welke waarden
al toegestaan waren — niets per ongeluk verwijderd:

```sql
alter table activity_sessions drop constraint activity_sessions_source_check;
alter table activity_sessions add constraint activity_sessions_source_check
  check (source = ANY (ARRAY['manual'::text, 'garmin'::text, 'apple_health'::text, 'strava'::text, 'concept2'::text]));
```

Geen codewijziging nodig — de sync-route (`v2.4.219`) gebruikte al
correct `source: 'concept2'`, exact matchend met de nieuwe,
uitgebreide constraint.

**Test-instructie:** voer de SQL uit, tik daarna nogmaals op "Sync nu"
bij Rowing Coach — zou nu daadwerkelijk sessies moeten importeren
(bron "concept2" i.p.v. "strava").

## v2.4.220 — Diagnose-fix: sync gaf "0/0" ondanks echte data in Concept2
**Gemeld met screenshot: 9+ echte sessies zichtbaar in het Concept2
Logbook (o.a. 5000m/25:12, 4290m), maar de sync meldde "0 nieuwe
sessie(s), 0 al bekend".**

### Het probleem met de vorige versie
`geimporteerd`/`overgeslagen` waren allebei 0, maar dat kon **twee
volledig verschillende oorzaken** hebben — en de UI liet geen
onderscheid zien:
1. Concept2's API gaf 0 resultaten terug (query/filter probleem)
2. Concept2 gaf wél resultaten terug, maar elke `insert` naar
   `activity_sessions` mislukte stil (de `continue` bij een fout
   sloeg zowel `geimporteerd` als `overgeslagen` over)

Zonder dit onderscheid was verder debuggen puur gokken.

### Fix — diagnostiek zichtbaar maken, niet de oorzaak zelf gokken
- **`totaalGevonden`** gaat nu altijd mee in de respons — laat direct
  zien of Concept2 daadwerkelijk data teruggaf
- **`eersteInsertFout`** — als opslaan mislukt, wordt de eerste
  concrete Postgres-foutmelding nu getoond i.p.v. verborgen in
  server-logs
- Ruwe eerste API-respons wordt gelogd zodra er 0 resultaten
  binnenkomen (voor server-side diagnose)
- **`Accept: application/vnd.c2logbook.v1+json`**-header toegevoegd —
  door Concept2's eigen documentatie aanbevolen ("to avoid potential
  issues"), ontbrak in de vorige versie
- UI-melding en kleur-logica bijgewerkt om deze extra info netjes te
  tonen

`npx next build` — compileert zonder fouten.

**Belangrijk, eerlijk:** de exacte root cause is hiermee nog niet
gevonden — dat kon niet zonder toegang tot de live respons. Deze
levering maakt het probleem **zichtbaar** zodat de volgende sync-
poging een concreet signaal geeft (bijv. "47 gevonden, 0 opgeslagen,
fout: ...") i.p.v. het ambigue "0/0" van daarvoor.

**Test-instructie:** tik nogmaals op "Sync nu" bij Rowing Coach — de
melding zou nu moeten laten zien hoeveel Concept2 daadwerkelijk
teruggaf, en bij een opslagfout de concrete reden.

## v2.4.219 — Concept2 data-sync
**Vervolg op v2.4.218's OAuth-koppeling, die bevestigd end-to-end
werkt in de praktijk. Nu het daadwerkelijk ophalen van resultaten.**

### Nieuw
- **`api/specialists/rowing/concept2/sync`** (POST) — haalt resultaten
  op bij Concept2 (`GET /api/users/me/results?type=rower`, laatste 2
  jaar, met paginering — max 20 pagina's per sync-aanroep), slaat ze
  op in `activity_sessions`. **Exact hetzelfde patroon als
  `strava-activity-processor.ts`** — geen nieuwe insert-logica
  verzonnen: idempotency-check via `notes ilike '%concept2:{id}%'`,
  zoek-of-maak de "Roeien"-activiteit aan, metrics als JSON
  (afstand/stroke rate/hartslag/calorieën/drag factor).
- **Token-vernieuwing** ingebouwd — als het access-token binnen 5
  minuten verloopt, wordt automatisch de `refresh_token`-grant
  gebruikt om een nieuwe te krijgen, vóór de eigenlijke data-aanroep.
- **"Sync nu"-knop** op `/coach/rowing` (vervangt "Verbind" zodra
  gekoppeld) — herlaadt de sessielijst na afloop, toont hoeveel nieuwe
  sessies geïmporteerd zijn.

### Belangrijk eenheidsverschil, bewust verwerkt
Concept2's `time`-veld is in **tienden van een seconde** (hun eigen
documentatie: "e.g. one minute would be 600"), **niet seconden** zoals
Strava's `moving_time`. Duur-berekening gebruikt daarom `/600`
i.p.v. Strava's `/60` — een simpele kopieerfout hier zou dezelfde
"0 min"-bug hebben gegeven als v2.4.217, nu bewust voorkomen.

**Gevalideerd:**
- Tijd-conversie getest tegen Concept2's eigen documentatie-voorbeeld
  (600 tienden = 1 minuut) én een realistisch scenario (25 minuten) —
  beide correct
- Token-geldigheidscheck: 3 scenario's (nog geldig/al verlopen/binnen
  de 5-min-veiligheidsmarge) — allemaal correct
- `npx next build` — compileert zonder fouten, nieuwe route bevestigd
  in de build-output

### Bewust nog niet gebouwd
Training Plan Engine, Workout Builder, Analyse-engine, Coach Memory,
Today Engine-integratie, automatische/periodieke sync (nu alleen
handmatig via "Sync nu").

**Test-instructie:** open Rowing Coach (al gekoppeld) → tik "Sync nu"
→ zou moeten melden hoeveel nieuwe sessies geïmporteerd zijn, en die
zouden in de lijst moeten verschijnen (met bron "concept2").

## v2.4.218 — Concept2 OAuth-koppeling
**Developer-sleutels aangevraagd en in Vercel gezet. Volledige
Authorization Code-flow gebouwd tegen de exacte, officiële Concept2-
documentatie.**

### SQL (uitvoeren vóór deze code)
`supabase/concept2_tokens.sql`:
```sql
create table if not exists concept2_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  concept2_user_id integer,
  scope text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table concept2_tokens enable row level security;
create policy "Gebruikers zien alleen hun eigen Concept2-token"
  on concept2_tokens for all using (auth.uid() = user_id);
```

### Nieuw — 3 routes
- **`api/specialists/rowing/concept2/authorize`** — stuurt door naar
  Concept2's inlog-/toestemmingsscherm. `GET /oauth/authorize?
  client_id=...&scope=results:read&response_type=code&redirect_uri=...`
  Scope bewust beperkt tot `results:read` (minst-nodige-rechten —
  geen schrijftoegang nodig)
- **`api/specialists/rowing/concept2/callback`** — wisselt de
  authorization code om voor een access/refresh-token via `POST
  /oauth/access_token` (form-urlencoded body). Slaat op in
  `concept2_tokens` (RLS aan). Redirect terug naar `/coach/rowing`
  met een succes- of foutmelding als query-param
- **`api/specialists/rowing/concept2/status`** — laat de UI weten of
  er al een koppeling bestaat — **geeft nooit de token zelf terug**
- **`/coach/rowing`** — "Verbind Concept2"-kaart + terugkoppeling na
  de OAuth-flow

### Bewuste architectuurkeuze
User-identiteit in de callback komt via de **sessie-cookie**
(consistent met elke andere route in CoachOS), niet via de OAuth
`state`-parameter — state zou de user_id blootgeven en is geen
betrouwbaar CSRF-mechanisme zonder een server-side opgeslagen nonce
om tegen te verifiëren.

**Gevalideerd:**
- Token-request-structuur (form-urlencoded body) getest tegen
  Concept2's eigen documentatie-voorbeeld — komt overeen
- `expires_at`-berekening getest met hun eigen voorbeeldwaarde
  (`expires_in: 604800`) — geeft correct exact 7 dagen
- `npx next build` — compileert zonder fouten, alle 3 nieuwe routes
  bevestigd in de build-output

### Bewust nog niet gebouwd
Daadwerkelijke **data-sync** (resultaten ophalen via `/api/users/me/
results` en opslaan in `activity_sessions`) — de koppeling zelf staat,
het periodiek/on-demand ophalen van resultaten is de logische
volgende stap.

**Test-instructie:** open Rowing Coach → tik "Verbind" bij Concept2
Logbook → log in bij Concept2 → zou je terug moeten sturen naar
CoachOS met "Concept2 succesvol gekoppeld!".

## v2.4.217 — Fix: Rowing-sessies toonden "0 min"
**Bevestigd via screenshot: Rowing Coach werkt — 2 echte Strava-
sessies zichtbaar (9 en 30 juni). Maar de duur toonde bij beide "0
min".**

### Root cause
`duration` in `activity_sessions` staat al opgeslagen in **minuten**
(`strava-activity-processor.ts`: `Math.round(activity.moving_time /
60)` bij import — Strava's `moving_time` is seconden, wordt dus al
naar minuten omgerekend vóór opslag). `coach/rowing/page.tsx` deelde
deze waarde nogmaals door 60 (`Math.round(a.duration / 60)`) — voor
elke normale sessie (bijv. 30 minuten: 30/60 = 0,5 → rondt af naar 0)
gaf dit "0 min".

### Fix
`src/app/coach/rowing/page.tsx` — de overbodige `/60` verwijderd,
toont nu direct `{a.duration} min`. Ter controle ook de TCX-import
nagekeken (`duration_min`, zelfde minuten-conventie) — consistent
overal in de codebase.

`npx next build` — compileert zonder fouten.

**Test-instructie:** open Rowing Coach — de 9 juni/30 juni-sessies
zouden nu hun echte duur moeten tonen, niet meer "0 min".

## v2.4.216 — Rowing Platform Fase 1, stap 1: basisstructuur
**Eerste bouwstap van de Rowing Platform Master Vision (vastgelegd
1 augustus 2026). Derde specialist naast Cycling en Running.**

### Nieuw
- **`src/lib/specialists/rowing-data.ts`** — data-layer, spiegelbeeld
  van running-data.ts. Leest bestaande `activity_sessions` gefilterd
  op activiteitnaam "Roeien" (geverifieerd tegen strava-activity-
  processor.ts en tcx-parser.ts) + `training_results` waar
  `training_type='rowing'`.
- **`bepaalRowingLifecycle()`** toegevoegd aan `lifecycle-engine.ts` —
  exact zelfde patroon als Cycling/Running, geen nieuwe logica.
- **`api/specialists/route.ts`** — rowing's status van `'development'`
  naar `'active'` gezet, nu tikbaar in Specialisten i.p.v. gedimd in
  "Binnenkort".
- **`/coach/rowing`** (nieuw dashboard) + **`api/specialists/rowing/
  data`** (dunne route, hergebruikt `haalRowingData()`) — toont een
  **eerlijke lege staat**: geen Concept2-koppeling, geen nepdata, wel
  een korte "Binnenkort"-lijst (Concept2-koppeling/trainingsplan/
  analyse).

### Bewust nog niet gebouwd (volgende stappen)
Training Plan Engine (periodisering), Workout Builder, Analyse-engine,
Concept2 OAuth-koppeling — wacht op developer-sleutels die de
gebruiker zelf moet aanvragen via `log.concept2.com/developers/
documentation/` (OAuth2, Client ID + Secret nodig) — Coach Memory,
Today Engine-integratie.

**Onderzocht tijdens deze stap:** Concept2 heeft een echte, bruikbare
API (`/api/users/me/results`, Bearer-token, OAuth2) — bevestigt dat
Fase 1's ErgData/Cloud-sync-aanpak haalbaar is zodra de sleutels er
zijn. Beperking: stroke-detail alleen voor ErgData-sessies, bulk-
download geeft alleen samenvattingen.

`npx next build` — compileert zonder fouten. Beide nieuwe routes
bevestigd in de build-output.

**Test-instructie:** open Specialisten — Rowing zou nu tikbaar moeten
zijn (niet meer gedimd). Tik erop — zou een nette lege staat moeten
tonen, geen foutmelding.

## v2.4.215 — Fix: sport-terminologie-verwarring in coach-berichten
**Gemeld met screenshot: Trainer AI noemde "je FTP gaat omhoog" bij
een hardloopsessie — FTP (Functional Threshold Power) is een
fietsspecifieke term, niet van toepassing op running.**

### Root cause
Geen hardcoded template-bug — de AI genereerde dit zelf als generieke
motiverende afsluiter, zonder te "weten" dat FTP specifiek aan fietsen
gekoppeld is. Geen enkele prompt instrueerde expliciet om sport-
specifieke metrics te vermijden bij een andere sport.

### Fix — twee niveaus
1. **`api/training/today/route.ts`** (Trainer AI, de directe bron van
   het gemelde geval): regel toegevoegd — geen fietstermen (FTP/watt/
   W-per-kg/cadans) bij running/kettlebell/rowing, geen looptermen
   (pace/tempo-per-km/VO2max) bij cycling
2. **`src/core/prompts/coach-personality.ts`** —
   `COACH_CORE_IDENTITY` uitgebreid met dezelfde regel. Dit is de
   gedeelde kern-identiteit, gebruikt door **9 plekken tegelijk**
   (`daily-coach.ts`, `coach-call-reaction.ts`, en beide Cycling- en
   Running-specialisten: coach, rit-analyse, training-plan/explain) —
   één wijziging beschermt de hele Coach-communicatielaag, niet alleen
   de plek waar het gemeld werd.

Bij twijfel: instructie is generieke, sport-neutrale taal (bijv. "je
uithoudingsvermogen groeit door slimme trainingen + slimme rest")
i.p.v. een specifieke metric te noemen.

`npx next build` — compileert zonder fouten.

**Test-instructie:** vraag een hardloop- of kettlebell-sessie aan —
het coach-bericht zou nu geen fietstermen (FTP, watt, etc.) meer
moeten bevatten.

## v2.4.214 — Performance-kaart consistent gemaakt met Week/Dagboek
**Gemeld: de vier onderste kaarten op Home pasten niet mooi bij
elkaar. Root cause: Performance had als enige een volledig gekleurde
(roze) achtergrond, terwijl Week en Dagboek altijd al neutraal waren.**

### Overweging
Twee opties besproken: (A) alles neutraal, alleen icoontjes gekleurd,
of (B) alle kaarten consistent kleuren per categorie. Gekozen voor
**A** — sluit beter aan bij de rest van Home (Smart Actions, Coach
Vooruitblik, Coach Score gebruiken ook allemaal neutrale kaarten met
gekleurde accenten, nooit een hele kaart in kleur). Optie B zou de
inconsistentie ook oplossen, maar voegt visuele ruis toe op een
pagina die juist rustiger moest worden.

### Fix
`src/app/home/page.tsx` — Performance-kaart omgezet naar exact
hetzelfde `<Card>`-patroon als Week en Dagboek: neutrale, donkere
achtergrond, alleen het hart-icoontje blijft roze (`bg-rose-500/20`
rondom het icoon, niet meer om de hele kaart).

### Nav-uitlijning — onderzocht, bewust geen wijziging
Gemeld: ruimte tussen Home en Trainer lijkt groter dan de rest. Code
opnieuw grondig gecontroleerd (`flex-1` op alle 5 kolommen — wiskundig
gegarandeerd gelijke breedte, icoon gecentreerd binnen eigen kolom).
Geen code-fout gevonden. Vermoedelijke verklaring: visueel effect van
de actieve-staat-styling (strokeWidth 2.5 vs 1.5 bij inactieve
iconen), geen structureel probleem. Bewust **niet** blind verder
aangepast — na twee eerdere regressierondes op dit component (v2.4.209/
210) is een derde ongefundeerde wijziging een groter risico dan
waarde.

`npx next build` — compileert zonder fouten.

**Test-instructie:** open Home — Performance zou er nu hetzelfde uit
moeten zien als Week en Dagboek eronder, alleen het icoontje in kleur.

## v2.4.213 — Bel-icoon verwijderd
**Op verzoek: de bel had geen functie (kale `<button>` zonder
`onClick`-handler) — weggehaald tot er een echte notificatiefunctie
is, i.p.v. een knop tonen die niets doet.**

`src/app/home/page.tsx` — bel-knop en de bijbehorende ongebruikte
`Bell`-import verwijderd. Het account-icoon ernaast (link naar
Instellingen) blijft ongewijzigd staan.

`npx next build` — compileert zonder fouten.

**Test-instructie:** open Home — rechtsboven zou alleen het account-
icoon (rond poppetje) nu nog moeten staan, geen bel meer.

## v2.4.212 — Nav-uitlijning gefixt + bel-icoon uitgezocht

### Nav-uitlijning
Gemeld met screenshot: "iets uit lijn". Root cause: v2.4.210's
`flex-1`-fix introduceerde per ongeluk `items-start` op de nav-
container (was `items-center`). **Fix:** teruggezet naar
`items-center`.

### Bel-icoon — bevestigd geen functie
Gevraagd of de bel rechtsboven op Home iets doet. Gecontroleerd: nee
— kale `<button>` zonder `onClick`-handler, puur decoratief. Het
account-icoon ernaast (rond poppetje) linkt wél door naar Instellingen.
Nog geen actie ondernomen — wacht op keuze van de gebruiker
(verwijderen tot er een echte notificatiefunctie is, of alvast een
simpele "geen nieuwe meldingen"-staat).

`npx next build` — compileert zonder fouten.

**Test-instructie:** check de bottom-nav — iconen en labels zouden nu
weer netjes verticaal gecentreerd moeten staan.

## v2.4.211 — Coach Vooruitblik: werk + medische afspraken toegevoegd
**Gemeld: het oorspronkelijke voorbeeld voor Coach Vooruitblik (🌙
Nachtdienst, 🏥 Fysio, 🔥 Build Week) bevatte ook werk en medische
afspraken — die ontbraken in de eerste versie (v2.4.201, alleen
vakantie/wedstrijd/faseovergang).**

### Nieuw
- **`src/lib/coach-planning-overzicht.ts`** — `volgendeWerkdienst` en
  `volgendeMedischeAfspraak` toegevoegd aan `OverzichtData`. Elk
  dag-voor-dag gezocht binnen 14 dagen met de bestaande
  `isEventActiefOpDag()` — zelfde, al-geteste logica als de
  werkdiensten-telling, geen nieuwe berekening.
- **Home** — de Vooruitblik-kaart toont nu alle 5 signalen
  (vakantie/wedstrijd/faseovergang/werkdienst/medische afspraak),
  elk met een passend icoon+label (🌙 Nachtdienst, 🏥 Fysio, etc.)
- **Sortering op eerstkomende datum** i.p.v. een vaste type-volgorde —
  zo staat bijv. een fysio-afspraak morgen altijd vóór een wedstrijd
  over drie weken, ongeacht welk type het is. Nog steeds maximaal 3
  items zichtbaar.

**Gevalideerd:**
- Sorteer-logica: 5 items door elkaar toegevoegd, correct gesorteerd
  op datum, top 3 toont de daadwerkelijk eerstkomende — niet de eerst-
  toegevoegde
- Eerstvolgende-werkdienst-detectie: een terugkerend "ma-do"-rooster
  vindt correct de eerstvolgende matchende dag binnen het 14-dagen-
  venster
- `npx next build` — compileert zonder fouten

**Test-instructie:** open Home — als je een werkdienst of medische
afspraak binnen 14 dagen hebt staan in Coach Planning, zou die nu ook
in de Vooruitblik-kaart moeten verschijnen.

## v2.4.210 — REGRESSIE-FIX: nav-tabs vielen alsnog van het scherm + Performance-tekst wrapte lelijk

### Nav-tabs — regressie op v2.4.209
**Gemeld met screenshot: "Voortgang" was nog steeds niet volledig
zichtbaar, ondanks v2.4.209's fix.**

Root cause: v2.4.209 verwijderde `overflow-x-auto` en vertrouwde op
`min-w-[68px]` per tab, met een berekening die uitging van "5 × 68px
= 340px, past ruim". Fout: `min-w` is een **ondergrens**, geen vaste
breedte — de daadwerkelijke breedte van "Specialisten" en
"Activiteiten" als tekst is aanzienlijk breder dan 68px, dus de rij
liep alsnog over en het laatste item ("Voortgang") viel van het
scherm.

**Definitieve fix:** `src/components/layout/index.tsx` — elke tab
krijgt nu `flex-1` (gelijk deel van de beschikbare breedte) i.p.v. een
losse pixel-ondergrens. Dit is **wiskundig gegarandeerd** correct:
vijf `flex-1`-items tellen per definitie op tot precies de
containerbreedte, ongeacht hoe lang een label is — geen berekening
meer die opnieuw fout kan gaan. Labels mogen nu wrappen naar 2 regels
i.p.v. verplicht op 1 regel te passen.

### Performance-pagina — coach-tekst wrapte lelijk
**Gemeld met screenshot: de coach-uitleg werd in een te smalle kolom
geperst naast de "Belangrijkste factoren"-pillen.**

Root cause: `flex items-start justify-between` zette de coach-tekst
(`flex-1`) en de pillen (`flex-shrink-0`) naast elkaar — op een smal
scherm bleef er te weinig breedte over voor de tekst, die daardoor
over veel regels wrapte.

**Fix:** `src/app/performance/page.tsx` — coach-tekst en pillen nu
**onder elkaar** (`flex-col`) i.p.v. naast elkaar. Tekst krijgt de
volle breedte, pillen krijgen hun eigen rij eronder.

`npx next build` — compileert zonder fouten.

**Test-instructie:** check de bottom-nav — alle 5 tabs, inclusief
"Voortgang", zouden nu volledig zichtbaar moeten zijn. Check
Performance — de coach-uitleg zou nu leesbaar over de volle breedte
moeten lopen, pillen eronder.

## v2.4.209 — Kleine fixes: "Indoor Fiets" hernoemd + bottom-nav scrollde nog

### "Indoor Fiets" → "Fietsen"
Gemeld: waarom heet het "Indoor Fiets" — moet dat niet gesplitst in
Indoor/Buiten? Onderzocht: de onderliggende oefeningen (`cycling-
drills.ts`) zijn op één na (Enkel Been Drill, expliciet "gebruik een
indoor trainer") allemaal generiek geschreven — Recovery Ride, Sweet
Spot, VO2max-intervallen, zelfs "Lange Rit" (spreekt over "langere
routes", eerder buiten-taal). De naam suggereerde dus een onderscheid
dat er niet is.

**Fix:** `src/app/settings/equipment/page.tsx` — hernoemd naar
"Fietsen" / "Indoor of buiten". Bewust **niet** gesplitst in twee
losse toggles — dat zou een schijn-onderscheid zijn zonder functioneel
verschil, aangezien dezelfde oefeningen-lijst er toch achter zit.

### Bottom-nav scrollde nog steeds
Gemeld ná v2.4.204's verwijdering van de "Coach"-tab (6→5 tabs).
Root cause: `src/components/layout/index.tsx` had `overflow-x-auto`
nog hard aanstaan — oorspronkelijk bewust ingebouwd (v2.4.111) als
vangnet voor 6 tabs, nooit verwijderd toen dat naar 5 ging.

**Fix:** `overflow-x-auto` verwijderd, nav gebruikt nu `justify-around`
voor een gelijkmatige verdeling. Gevalideerd: 5 tabs × 68px minimale
breedte = 340px, past ruim op zelfs het smalste huidige iPhone-model
(SE 2020+, 375px breed) — geen scroll-vangnet meer nodig.

`npx next build` — compileert zonder fouten.

**Test-instructie:** check de equipment-instellingen (nu "Fietsen"
i.p.v. "Indoor Fiets"), en swipe over de bottom-nav — zou nu niet meer
moeten scrollen, alle 5 tabs gelijkmatig verdeeld in beeld.

## v2.4.208 — Performance-pagina: visuele herbouw naar gedecoreerde stijl
**Gevraagd met referentie-screenshot: "alles erop en eraan". Puur
presentatie — dezelfde onderliggende data/API, geen logica-wijziging.**

### Nieuw
- **`CirkelGauge`** — herbruikbaar SVG-ring-component, gebruikt voor
  zowel Herstelscore (Vandaag-kaart) als Consistentie
- **`VoortgangsBalk`** — kleine balkjes onder Herstel/Klaar om te
  presteren en alle vier Belastbaarheid-cijfers (CTL/ATL/TSB/
  Vermoeidheid)
- **Belangrijkste factoren als losse pillen** — afgeleid van de
  bestaande `recovery.value.breakdown`-data (top 3 op
  `bijdrage_score`), geen nieuwe berekening
- **Gemiddelde/trend-paneel** naast de Herstel-30-dagen-grafiek —
  vergelijkt de laatste 7 dagen met de 7 dagen daarvoor, met
  stijgend/dalend/stabiel-indicator
- **"Focus vandaag"-tip** — afgeleid van bestaande
  `readiness.policy_maxIntensity`/`fatigue`-labels
- HIGH·90%-badge verplaatst naar rechtsboven de hele pagina (was:
  in de kaart)

### Bewuste beperking, eerlijk vermeld
De balkjes onder de Fitness-indicatoren-kaarten zijn puur decoratief
(tonen de huidige score als vulling), **geen echte historische
sparkline** — die data (per-indicator tijdreeks) bestaat niet in de
huidige API. De kale cijfers blijven de waarheid.

**Gevalideerd:**
- Trend-detectie: dalend/stijgend/stabiel correct herkend, inclusief
  het randgeval <14 dagen data (geeft `trendPct: null`, geen crash)
- Cirkel-gauge-omtrekberekening: 0%/64%/100% allemaal correct
- `npx next build` — compileert zonder fouten

**Test-instructie:** open Performance vanaf Home — zou nu de
gedecoreerde weergave moeten tonen (cirkel-gauges, balkjes, pillen)
i.p.v. de eerdere, minimalere versie.

## v2.4.207 — Definitieve fix trainingsvoorstel + Performance/Dagboek verplaatst
**Gemeld met screenshot: nog steeds geen trainingsvoorstel in Smart
Actions, ondanks v2.4.206's fix. Root cause: een race condition.**

### Root cause
v2.4.206's cache-lezing (`coach_recommendations.training_instruction`)
liep **parallel** met Home's eigen `/api/today`-aanroep, die diezelfde
cache vult. Als Smart Actions eerder klaar was dan die aanroep, las het
een nog lege cache — verscheen alsnog geen trainingsvoorstel, ondanks
dat de fix op zich correct was.

### Definitieve fix
`src/app/api/smart-actions/route.ts` — de volledige Today Engine
(`bepaalTodayPlan()`, inclusief Trainer AI) rechtstreeks aanroepen,
maar met een **harde tijdslimiet** via `Promise.race` (2,5 sec):
- **Binnen de limiet**: correct, volledig resultaat — trainingsvoorstel
  verschijnt, ongeacht of het via een specialist-plan of Trainer AI komt
- **Buiten de limiet** (trage AI-generatie): alleen het
  trainingsvoorstel wordt overgeslagen, de rest van Smart Actions
  (blessures/wedstrijd/vakantie/fallbacks) blijft snel — geen totale
  blokkade meer op één trage bron

Dit vervangt zowel v2.4.204's aanpak (geen Trainer AI, te weinig) als
v2.4.206's aanpak (cache-lezing, race condition) door een robuustere
oplossing die snelheid EN correctheid combineert.

### Ook in deze levering
**Performance en Dagboek verplaatst** naar onderaan Home, bij "Week
overzicht" — waren eerder los bovenaan Home gebundeld, gevraagd om ze
samen te groeperen bij de andere "ga ergens anders naartoe"-links.

**Gevalideerd:**
- Tijdslimiet-logica: snel resultaat (100ms) komt correct door; traag
  resultaat (3000ms, tegen een 500ms testlimiet) wordt correct na de
  limiet afgekapt zonder de rest te blokkeren
- `npx next build` — compileert zonder fouten

**Test-instructie:** open Home — Smart Actions zou nu (binnen ~2,5
sec) een trainingsvoorstel moeten tonen, ongeacht of er een actief
specialist-plan is. Performance en Dagboek staan nu onderaan, bij Week
overzicht.

## v2.4.206 — REGRESSIE-FIX: "Snelle actie naar trainingsplan is weg"
**Gemeld ná v2.4.204's snelheidsfix. Bevestigd: die fix loste de
vertraging op, maar liet een echte functie verdwijnen.**

### Root cause
v2.4.204 verving `bepaalTodayPlan()` (de volledige Today Engine,
inclusief de Trainer AI-vangnet-laag) door een snelle, directe
databasecheck op specialist-sessies — om de ~3 seconden AI-vertraging
te voorkomen. Bijwerking, destijds expliciet als tradeoff benoemd maar
nu bevestigd als ongewenst: zonder actief specialist-plan (bijv. een
rustdag binnen het schema) verscheen er helemaal geen trainingsvoorstel
meer in Smart Actions.

### Fix — snelheid én functionaliteit, beide behouden
Gevonden: Trainer AI (`api/training/today`) cachet zijn resultaat al
in `coach_recommendations.training_instruction`
(`type='training_today'`), en heeft zelfs al een eigen cache-lezende
`GET`-handler. Smart Actions leest deze cache nu **als tweede stap**
(alleen als er geen specialist-sessie is) — snelle databaselezing,
**geen nieuwe AI-call**, dus nog steeds geen vertraging. Als Trainer AI
vandaag al eerder gegenereerd is (bijv. via Home's eigen
`/api/today`-aanroep), verschijnt het voorstel alsnog; zo niet, blijft
het gewoon weg — geen crash, geen gok.

**Gevalideerd — 4 scenario's:**
- Specialist-sessie aanwezig → toont die (ongewijzigd)
- Geen specialist, wel Trainer AI-cache (het gemelde geval) → toont
  die nu ook
- Geen van beide (nog nooit gegenereerd vandaag) → correct leeg, geen
  crash
- Beide aanwezig → specialist wint, geen dubbele voorstellen

`npx next build` — compileert zonder fouten.

**Test-instructie:** open Home op een dag zonder actief specialist-
plan (of nadat je eerder vandaag al de Trainer-tab hebt bezocht) —
Smart Actions zou nu weer een trainingsvoorstel moeten tonen.

## v2.4.205 — REGRESSIE-FIX: "Om de week" werkte niet meer
**Gemeld: "Bij agenda werkt om de week niet meer" — een regressie ná
v2.4.193's fix. Gevraagd: alle opties opnieuw checken.**

### Root cause
`isHerhalendActiefOpDag`/`isEenmaligActiefVandaag` in
`coach-planning/page.tsx` gebruikten nog `event.start_time.split('T')[0]`
(ruwe string-extractie op de opgeslagen UTC-tijd) om de begindatum van
een event te bepalen. v2.4.203's `lokaleDagStr()`-fix loste dit al op
voor de kalender-grid, maar werd **niet** consistent doorgevoerd naar
deze twee kernfuncties — een inconsistentie tussen "hoe de
bewerkscherm-datum berekend wordt" en "hoe de actief/inactief-check
de datum berekent".

**Concreet bewijs:** een event met een vroege-ochtend-starttijd (bijv.
01:00 lokaal) geeft bij de ruwe string-methode een dag te vroeg terug
(2026-08-09 i.p.v. 2026-08-10) — dat verkeerde referentiepunt laat de
even/oneven-weekberekening van `weekVerschil()` (de kern van "om de
week") omslaan.

### Fix — consistent in 3 bestanden
- `src/app/coach-planning/page.tsx` — 4 voorkomens gefixt
  (`isEenmaligActiefVandaag`, `isHerhalendActiefOpDag`, lijstweergave,
  "binnenkort"-groepering)
- `src/core/utils/life-events-context.ts` — 2 voorkomens gefixt,
  inclusief precies de biweekly-berekening die de Coach rechtstreeks
  voedt
- `src/lib/coach-planning-overzicht.ts` — 3 voorkomens gefixt

Elke `start_time`-extractie gebruikt nu consistent
`lokaleDagStr(new Date(...))`, nooit meer de ruwe string-split.

### Volledige hertest, zoals gevraagd
**Alle 9 scenario's** (eenmalig + 8 herhalingsopties: workdays/
weekend/weekly/biweekly/daily/custom/yearly/monthly) opnieuw getest
met de gefixte, consistente logica — allemaal correct. Specifiek
biweekly: start zelf (week 0, actief), week later (week 1, oneven,
correct inactief), twee weken later (week 2, even, correct actief).

`npx next build` — compileert zonder fouten.

**Test-instructie:** check een bestaande "Om de week"-regel — zou nu
weer correct om de week moeten afwisselen, ongeacht op welk uur het
event oorspronkelijk is aangemaakt.

## v2.4.204 — Home-verfijningen: snelheid, navigatie, indeling
**Vijf losse, kleine wijzigingen — allemaal onafhankelijk, low-risk.**

### Snelheidsfix — Smart Actions (was: ~3 seconden vertraging)
Root cause: `api/smart-actions/route.ts` gebruikte `bepaalTodayPlan()`
(de volledige Today Engine, inclusief de Trainer AI-vangnet-laag) — die
doet bij "geen actief specialist-plan" een **echte Claude-aanroep**
(`claude-haiku-4-5`, in `api/training/today`). Smart Actions heeft voor
het "training vandaag"-signaal geen AI-gepersonaliseerde tekst nodig,
alleen een snelle ja/nee.

**Fix:** rechtstreekse databasecheck op een geplande specialist-sessie
(`training_plan_sessions`, huidige datum) — geen AI-call meer in dit
pad. Als er geen specialist-plan is, laat Smart Actions dit voorstel
gewoon weg; de volledige Today Engine (mét Trainer AI) blijft gewoon
actief op de bestaande "Vandaag van je Coach"-kaart.

### Navigatie
- **"Coach"-tab uit de bottom-nav** (6→5 tabs) — zelfde bestemming
  (`/chat`) als Smart Actions' "Vraag de Coach" al biedt, lost het
  gemelde horizontaal-scrollen op

### Home
- **"Coach Chat"-kaartje verwijderd** (naast "Week overzicht" in de
  Snelle links) — idem, dubbel met Smart Actions. "Week"-kaart is nu
  volle breedte i.p.v. een leeg gat.
- **Smart Actions verplaatst** naar direct onder Coach Score (was
  eerst na de volledige "Vandaag van je Coach"-kaart)
- **Dagplan start nu standaard ingeklapt** — tik op de header om te
  openen

### Bevestigd, geen wijziging nodig
Gevraagd: leest de Coach het dagboek? **Ja, al bevestigd aanwezig**
(`journal_entries` → `journalContext`, al in de prompt sinds eerder).

**Gevalideerd:** `npx next build` — compileert zonder fouten. Bottom-
nav bevestigd op 5 tabs. Ongebruikte `MessageCircle`-imports
opgeschoond (2 bestanden).

**Test-instructie:** open Home — Smart Actions zou nu direct moeten
verschijnen (niet na 3 sec), onder Coach Score. Dagplan begint dicht.
Bottom-nav toont 5 tabs zonder scrollen.

## v2.4.203 — KRITIEKE FIX: kalender toonde events op de verkeerde dag + werkdiensten-telling was altijd 0
**Gemeld: "Ipv maandag pakt hij dinsdag" (vakantie), "twee weken geen
werkdiensten?" (Overzicht), "kan gemaakte afspraken niet veranderen".
Alle drie onderzocht en bevestigd — twee echte, aparte bugs.**

### Bug 1 — datum-conversiefout in de Coach Planning-kalender
`dag.toISOString().split('T')[0]` op een lokaal geconstrueerde
middernacht-Date (bijv. `new Date(2026, 7, 10)` voor 10 augustus)
converteert naar UTC en springt daardoor in Nederland (UTC+2) een dag
terug: 10 aug 00:00 lokaal → 9 aug 22:00 UTC → "2026-08-09". Gevolg:
elke dag in de maandkalender-grid checkte intern de VERKEERDE datum —
een vakantie die op maandag begint, verscheen op dinsdag.

**Fix:** nieuwe `lokaleDagStr()`-helper (lokale datumcomponenten,
nooit een UTC-conversie) — vervangt alle 6 voorkomens van dit patroon
in `coach-planning/page.tsx`, plus 2 in `life-events-context.ts`
(kleinere impact, alleen fout rond middernacht lokale tijd, maar voedt
de Coach rechtstreeks) en 4 in `coach-planning-overzicht.ts`.

**Waarschijnlijke verklaring voor "kan gemaakte afspraken niet
veranderen":** een symptoom van dezelfde bug — na een wijziging bleef
de kalender het event op de (verkeerde) dag tonen, wat leek alsof de
wijziging niet werkte. De opslag-mechaniek zelf (`PATCH /api/life-
events`) bleek ongewijzigd en correct.

### Bug 2 — Overzicht's werkdiensten-telling sloot recurrente events uit
`werkEventsKomende14Dagen` filterde op `!e.recurrence` — alleen
**eenmalige** werk-events werden geteld. Werkroosters zijn vrijwel
altijd terugkerend ingesteld, dus de telling gaf stelselmatig **0**
terug, ongeacht een actief rooster.

**Fix:** `src/lib/coach-planning-overzicht.ts` volledig herschreven —
nieuwe `isEventActiefOpDag()` (dezelfde logica als `isHerhalendActiefOpDag`
in coach-planning/page.tsx, hier bewust gedupliceerd voor server-side
gebruik) checkt nu elke van de 14 dagen apart tegen zowel eenmalige als
terugkerende werk-events. Ook: `recurrence_days`/`recurrence_end_date`/
`recurrence_exceptions` toegevoegd aan de select (ontbraken volledig).

**Gevalideerd:**
- Datumfix: exact het gerapporteerde scenario (maandag 10 augustus,
  Europe/Amsterdam) — toont nu correct "2026-08-10" i.p.v. het foute
  "2026-08-09"
- Werkdiensten-telling: een terugkerend Avonddienst-rooster (ma-do,
  "Aangepast") geeft nu 8 werkdiensten in 14 dagen i.p.v. de foute 0
- `npx next build` — compileert zonder fouten

**Test-instructie:** open Coach Planning → Planning-tab — je vakantie
zou nu op de juiste dag moeten staan. Check Overzicht — werkdiensten
komende 14 dagen zou nu een reëel aantal moeten tonen, niet 0.

## v2.4.202 — Coach Planning Fase C: Smart Action Engine
**Grootste losse stap van de hele Coach Planning-visie. 100%
deterministisch — geen AI-call, zoals niet-onderhandelbaar
vastgelegd in het ontwerp.**

### Nieuw
- **`src/lib/smart-action-engine.ts`** — generieke `kiesTop3()`. Puur
  arbitrage: sorteert voorstellen op prioriteitscijfer, geen
  intelligentie.
- **`api/smart-actions/route.ts`** — verzamelt actie-voorstellen uit
  bestaande bronnen, geen nieuwe databron:
  - **98** — actieve blessure (`injuries`-tabel)
  - **95** — training vandaag gepland (Today Engine, hergebruikt
    `bepaalTodayPlan()` met de v2.4.184-fix voor de baseUrl)
  - **85** — wedstrijd binnen 7 dagen (Coach Planning-overzicht)
  - **70** — vakantie binnen 3 dagen (Coach Planning-overzicht)
  - **30/20** — altijd-beschikbaar-fallbacks (Vraag de Coach / Open
    Coach Planning) — vullen de resterende plekken
- **Home**: nieuwe "⚡ Snelle acties"-sectie, 3 tegels, tussen de
  Coach-advies-kaart en de Coach Vooruitblik-kaart (per de vastgelegde
  Home-volgorde)

### Bevestigde architectuurcorrectie (uit het ontwerpoverleg)
De bestaande Decision Engine (`beslisTussenSpecialisten()`, voor
trainingsspecialisten) is hier **niet hergebruikt** — te smal
getypeerd (velden als `load`/`risk`/`hoogsteImportance`, specifiek
voor specialist-vergelijking). Smart Actions gebruikt dezelfde
filosofie (deterministisch, geen AI), maar eigen, generieke code.

### Bijvangst
De dataverzameling van Fase A stap 3 (Overzicht) is geëxtraheerd naar
`src/lib/coach-planning-overzicht.ts` — nu gedeeld tussen de Overzicht-
route en Smart Actions, geen dubbele logica, geen kwetsbare interne
HTTP-self-call (dat patroon veroorzaakte eerder de v2.4.184-bug).

**Gevalideerd — 3 scenario's, inclusief het "wat als meerdere
situaties tegelijk gelden"-conflictgeval dat we bij het ontwerp als
risico benoemden:**
- Normale mix (blessure + training + fallbacks) → juiste top 3
- Rustige dag (alleen fallbacks) → geen crash bij minder dan 3
  voorstellen
- Alles tegelijk (blessure + training + wedstrijd + vakantie +
  fallbacks) → precies de drie hoogste, correct genegeerd wat lager
  scoort

`npx next build` — compileert zonder fouten, beide routes (nieuw +
herschreven) bevestigd in de build-output.

**Test-instructie:** open Home — zou nu een "⚡ Snelle acties"-rij met
3 tegels moeten tonen, gebaseerd op je huidige situatie (blessures,
trainingsplan, aankomende vakantie/wedstrijd).

## v2.4.201 — Coach Planning Fase B: Home — Coach Vooruitblik-kaart
**Eerste stap na Fase A. "Eerst de bestemming, dan de snelkoppeling" —
nu heeft de knop een echte bestemming (Coach Planning bestaat al).**

### Nieuw
- `src/app/home/page.tsx` — nieuwe kaart, direct na "Vandaag van je
  Coach": toont maximaal 3 items (volgende vakantie, volgende
  wedstrijd, eerstvolgende trainingsfase-overgang), puur feitelijk,
  geen voorspelling (dat blijft Fase D/Coach Forecast, bewust apart).
- **Hergebruikt exact `/api/coach-planning/overzicht`** (v2.4.200) —
  geen nieuwe backend-logica, geen dubbele databron.
- **Bewuste keuze:** als er niets relevants is (nieuwe gebruiker,
  weinig ingevuld in Coach Planning), blijft de kaart volledig weg —
  geen lege kaart tonen.
- Knop "Open Coach Planning →" — geen nieuwe navigatie-tab, zoals
  eerder vastgelegd.

### Bijvangst tijdens het bouwen
Bij het invoegen is per ongeluk de `{/* Snelle links */}`-
commentaarregel mee vervangen (puur cosmetisch, geen functionele
impact — de daadwerkelijke inhoud bleef intact). Teruggezet vóór
levering.

**Gevalideerd:**
- Zichtbaarheidslogica: 3 scenario's (alles leeg → kaart weg, 1 item,
  3 items) — correct
- Dag-labels (Vandaag/Morgen/Over X dagen) — correct
- `npx next build` — compileert zonder fouten

**Test-instructie:** open Home — als je in Coach Planning al een
vakantie/wedstrijd/trainingsfase hebt lopen, zou de nieuwe kaart nu
zichtbaar moeten zijn met een link naar Coach Planning.

## v2.4.200 — Coach Planning: Fase A, stap 3 (Overzicht) — Fase A compleet
**Laatste stap van Fase A. Vervangt de "Overzicht"-placeholder door een
echte, intelligente samenvatting.**

### Nieuw
- **`api/coach-planning/overzicht/route.ts`** — combineert bestaande
  databronnen (life_events, training_plan_sessions), geen nieuwe tabel:
  - Volgende vakantie + volgende wedstrijd/evenement (dagen-tot-telling)
  - Huidige trainingsfase + eerstvolgende faseovergang (bijv. "Build-
    week start over 5 dagen") — robuust tegen het bekende v2.4.176-
    randgeval: trainingsplannen van vóór die fix hebben geen
    mesocyclus-data, dit onderdeel toont dan gewoon niets, geen crash
  - Werkdiensten komende 14 dagen, trainingen komende week
- **`OverzichtView`** (UI) — toont deze zes signalen als lijst, met een
  hint ("hoe meer je invult, hoe rijker dit wordt") als er weinig data is

**Herbruikbaarheid, zoals gepland:** deze functie/route wordt in Fase B
hergebruikt voor de Home "Coach Vooruitblik"-kaart — één bron, geen
dubbele logica.

**Gevalideerd:**
- Dagen-tot-berekening: 3 scenario's (12 dagen, morgen, vandaag) — correct
- Fase-wisseldetectie: vindt de eerstvolgende afwijkende mesocyclus
  correct
- Robuustheid: sessies zonder mesocyclus-data geven `undefined` terug,
  geen crash
- `npx next build` — compileert zonder fouten, nieuwe route aanwezig
  in de build-output

**Fase A is hiermee volledig compleet** (Regels/Planning/Overzicht,
alle drie afgerond en getest). Volgende stap: Fase B (Home: Coach
Vooruitblik-kaart).

## v2.4.199 — Coach Planning: Fase A, stap 2 (Planning)
**Vervolg op v2.4.198. De "Planning"-placeholder vervangen door een
echte maand-/week-/lijstweergave met kleurcodering.**

### Nieuw
- **Maandweergave**: volledige weken-grid (ma-zo, ook dagen uit de
  vorige/volgende maand voor een nette grid), kleurpuntjes per
  categorie op elke dag met events, tik op een dag voor details eronder
- **Weekweergave**: hergebruikt de bestaande, al-geteste `WeekKalender`
  — geen dubbele logica
- **Lijstweergave**: chronologisch, alle aankomende eenmalige events +
  alle terugkerende regels
- **Kleurcodering** (`CATEGORIE_KLEUR`/`TYPE_KLEUR_OVERRIDE`): per
  categorie (werk=blauw, medisch/gezondheid=oranje, sport=groen,
  leven=paars, omgeving=grijs), met twee bewuste uitzonderingen op
  type-niveau — Vakantie=geel, Evenement(wedstrijd)=rood — precies
  zoals expliciet benoemd in de vastgelegde visie, los van hun
  categorie-kleur

**Gevalideerd:**
- Maandgrid-berekening: 42 dagen (6 volledige weken), begint op
  maandag, eindigt op zondag, bevat de volledige maand — getest met
  augustus 2026
- Kleurmapping: 4 scenario's, inclusief beide uitzonderingen
  (vakantie/evenement) correct afwijkend van hun categorie-kleur
- `npx next build` — compileert zonder fouten

**Test-instructie:** open Coach Planning → tab "Planning" — zou een
maandkalender moeten tonen met gekleurde puntjes op dagen met events.
Tik op een dag voor details, wissel naar "week" en "lijst" om de
andere weergaven te checken.

## v2.4.198 — Coach Planning: Fase A, stap 1 (Regels)
**Eerste bouwstap van de vastgelegde Coach Planning-visie. "Eerst de
bestemming, dan de snelkoppeling" — vandaar dat deze stap begint bij
de nieuwe module zelf, niet bij de Home-kaart.**

### Wat er gebeurd is
- `/life-events` (1441 regels) verplaatst naar `/coach-planning` —
  **verplaatsing + tab-structuur, geen herbouw**. Alle onderliggende
  functionaliteit (categorieën, Coach-properties, uitzonderingen,
  AI-invoer met verplichte bevestiging, week-navigatie) blijft exact
  zoals getest.
- **Nieuwe tab-bar**: Regels (bestaand, actief) / Planning (placeholder)
  / Overzicht (placeholder) — bewust géén "Vandaag"-tab (zou Home/
  Today Engine dupliceren, eerder afgesproken)
- Titel "Levensgebeurtenissen" → "Coach Planning"
- `/life-events` blijft bestaan als **redirect** naar `/coach-planning`
  — bestaande links/bladwijzers breken niet
- `settings/page.tsx` — link en label bijgewerkt

### Nog te bouwen (volgende stappen, per het vastgelegde plan)
- Fase A, stap 2: Planning (maand-/weekagenda, kleurcodering)
- Fase A, stap 3: Overzicht (intelligente samenvatting)
- Fase B: Home — Coach Vooruitblik-kaart
- Fase C: Smart Action Engine
- Fase D: Coach Forecast

**Gevalideerd:** `npx next build` — compileert zonder fouten. Beide
routes bevestigd in de build-output (`/coach-planning` nieuw,
`/life-events` nu een lichte 350B-redirect i.p.v. de oude ~70KB
pagina). JSX-fragment-balans (voor de tab-conditionele weergave)
bevestigd correct — 1 opening, 1 sluiting.

**Test-instructie:** open Instellingen → "Coach Planning" — zou de
vertrouwde Levensgebeurtenissen-functionaliteit moeten tonen onder een
nieuwe tab-bar. Test ook of een oude link naar `/life-events` correct
doorverwijst.

## v2.4.197 — Fix: "Jaarlijks" en "Maandelijks" ontbraken volledig
**Gemeld: verjaardag toevoegen gaf "wekelijks" i.p.v. jaarlijks.
Root cause: er was geen "jaarlijks"-optie om te kiezen — de AI koos
noodgedwongen het minst-foute alternatief. Direct ook gecontroleerd op
vergelijkbare gaten: "maandelijks" bleek ook te ontbreken.**

### Nieuw
- **"Jaarlijks"** — zelfde maand+dag, elk jaar (verjaardagen, jubilea,
  trouwdagen)
- **"Maandelijks"** — zelfde dag-van-de-maand, elke maand (eenvoudige
  versie; "elke eerste vrijdag van de maand" is bewust niet
  meegenomen, complexer patroon, niet gevraagd)
- Toegevoegd aan: `RECURRENCE_OPTIONS`/`RECURRENCE_LABELS` (UI), de
  actief/inactief-logica in zowel `life-events/page.tsx` als
  `life-events-context.ts` (backend, voedt de Coach), en de AI-parse-
  route (prompt + type + zowel `yearly` als `monthly` expliciet
  genoemd, met de instructie "kies nooit weekly voor een jaarlijkse/
  maandelijkse gebeurtenis")

**Gevalideerd — 7 scenario's:**
- Jaarlijks: zelfde dag volgend jaar (actief), andere dag (inactief),
  andere maand (inactief)
- Maandelijks: zelfde dag volgende maand (actief), andere dag
  (inactief)

Geen SQL nodig — `recurrence` bleek geen database-constraint te hebben
(vrije tekst-kolom), dus nieuwe waarden zijn direct bruikbaar.

`npx next build` — compileert zonder fouten.

**Test-instructie:** voeg "Mijn verjaardag" opnieuw toe via AI-invoer —
zou nu "Jaarlijks" moeten voorstellen, niet "Wekelijks".

## v2.4.196 — Minuten-precisie voor tijden
**Aanleiding: AI-invoer met "14:45" kon niet correct worden
opgeslagen — het systeem ondersteunde alleen hele uren.**

### Onderzoek vooraf
8 bestanden raakten `start_hour`/`end_hour`. Bij nader inzien: 4 ervan
(`weekly/route.ts`, `memory/route.ts` en gedeeltelijk overlappend)
haalden `life_events` op maar gebruikten het **nergens** (dode code) —
geen wijziging nodig. Alleen `chat/route.ts` en `predictions/route.ts`
tóónden de tijden daadwerkelijk aan de Coach.

### SQL (uitvoeren vóór deze code)
`supabase/minuten_precisie.sql`:
```sql
alter table life_events
  add column if not exists start_minute integer not null default 0
    check (start_minute >= 0 and start_minute <= 59),
  add column if not exists end_minute integer not null default 0
    check (end_minute >= 0 and end_minute <= 59);
```
Puur additief — bestaande rijen krijgen default 0, geen migratie nodig.

### Code
- `src/app/api/life-events/route.ts` — POST/PATCH slaan `start_minute`/
  `end_minute` op
- `src/app/life-events/page.tsx` — hele-uur-`<select>`-dropdowns
  (4 stuks, 2 formulieren) vervangen door native `<input type="time">`;
  `formatUur()` toont nu minuten; `start_time`-constructie in beide
  opslaan-functies neemt nu ook de minuten mee (was voorheen altijd
  `:00`, ook al koos je een ander uur correct)
- `src/app/api/life-events/parse/route.ts` — de v2.4.192-beperking
  ("rond af naar een heel uur") vervangen door echte minuten-
  ondersteuning: prompt, `ParseResultaat`-interface en de
  validatielaag (0-59) allemaal bijgewerkt
- `src/app/api/chat/route.ts` + `src/app/api/predictions/route.ts` —
  SELECT-queries en weergave bijgewerkt: tonen nu de werkelijke
  minuten i.p.v. hardcoded ":00"

**Gevalideerd:**
- Weergave met minuten (14:45) → correct
- Gedrag-behoudendheid zonder minuten (blijft "09:00") → correct
- Time-input-parsing ("14:45" → uur 14, minuut 45) → correct
- `npx next build` — compileert zonder fouten, alle 60 pagina's
  succesvol gegenereerd

**Test-instructie:** voeg een event toe met een tijd als "14:45" (via
het formulier of AI-invoer) — zou nu exact zo opgeslagen en getoond
moeten worden, niet meer afgerond naar 15:00.

## v2.4.195 — Tik-om-te-vullen suggesties bij "Vertel de Coach"
**Gevraagd: hulp bij het formuleren, met suggesties. Gekozen optie
(B van 4 voorgestelde): korte tik-knopjes die een startzin invullen,
de gebruiker vult zelf de details aan.**

### Nieuw
- **5 suggestie-chips**, dekken de patronen die vandaag in de praktijk
  voorkwamen: 🔄 Terugkerende afspraak, 🏖️ Vakantie, 🚫 Uitzondering op
  een regel, 🏥 Medische afspraak, 📅 Eenmalige gebeurtenis.
- Fijn detail: bij het tikken op een chip wordt automatisch het eerste
  `[invulblok]` geselecteerd — direct typen vervangt het, geen zelf
  hoeven slepen/selecteren.
- Puur een startpunt — geen automatische opslag, de gebruiker stuurt
  zelf de aangepaste tekst naar de AI-parser zoals gebruikelijk.

**Gevalideerd:** selectie-logica getest — vindt en selecteert correct
het eerste `[...]`-blok in een template. `npx next build` compileert
zonder fouten.

## v2.4.194 — Autogroeiend tekstveld bij "Vertel de Coach"
**Gevraagd: "kan het tekstveld niet automatisch groter worden".**

### Nieuw
`src/app/life-events/page.tsx` — de textarea past nu automatisch zijn
hoogte aan de inhoud aan (via `scrollHeight`, geen vaste 2 regels
meer). Hoogte reset netjes terug naar normaal na opslaan of "Opnieuw".

`npx next build` — compileert zonder fouten.

## v2.4.193 — BELANGRIJKE FIX: "Om de week" gedroeg zich exact als "Elke week"
**Gemeld: "Als ik om de week doe, pakt hij ook niet." Gevraagd: alle
herhalingsopties grondig controleren. Bevestigd: een derde,
significante bug — apart van de eerder gevonden begin-/einddatum-
problemen.**

### Root cause
`weekly`, `biweekly` en `custom` werden in zowel de UI
(`isHerhalendActiefOpDag`) als de backend (`relevanteHerhalend`-filter,
voedt de Context Resolver/Coach) **identiek behandeld** — er werd
alleen gecheckt of de dag-van-de-week matchte, nooit of het een even
of oneven week was ten opzichte van de startdatum. "Om de week" heeft
dus al deze hele tijd **elke week** gevuurd, niet om de week.

### Fix
- **Nieuwe helper** (`weekVerschil()`, in beide bestanden) — berekent
  het aantal volle weken tussen de startdatum en vandaag, gerekend
  vanaf de maandag van elke week (onafhankelijk van welke dag de
  startdatum zelf op valt).
- `biweekly` nu apart behandeld: dag-van-de-week moet matchen **én**
  het weekverschil moet even zijn (0, 2, 4, ... weken na de start).
- `weekly`/`custom` ongewijzigd (die waren al correct — vuren elke
  week op de matchende dag/dagen).

### Volledige audit uitgevoerd, zoals gevraagd
Alle zes herhalingsopties (workdays/weekend/weekly/biweekly/daily/
custom) apart getest. Ook de hele codebase doorzocht op andere plekken
die "biweekly" checken — één extra voorkomen gevonden
(`formatHerhaling()`), maar dat is puur een weergave-label-functie
("🔄 Om de week · Wo"), geen actief/inactief-beslissing — geen bug,
ongewijzigd gelaten.

**Gevalideerd — alle 6 opties, 12 scenario's totaal:**
- Workdays/Weekend: correct
- Weekly: elke week actief op de matchende dag — correct
- **Biweekly (het gerapporteerde probleem)**: week 0 en 2 actief, week
  1 en 3 correct inactief — exact het afwisselende patroon dat "om de
  week" hoort te zijn
- Daily: elke dag actief — correct
- Custom (meerdere dagen): alleen de geselecteerde dagen actief —
  correct

`npx next build` — compileert zonder fouten.

**Test-instructie:** stel een "Om de week"-regel in vanaf vandaag, en
check volgende week — die zou nu **niet** moeten verschijnen. De week
daarna wel weer.

## v2.4.192 — Fix: Opslaan-knop deed niets bij AI-invoer + invoerveld toonde niet de volledige tekst
**Gemeld: "De opslaan knop werkt niet" + "wil de hele tekst kunnen zien
als ik het intype".**

### Probleem 2 (invoerveld) — opgelost
Het "Vertel de Coach"-veld was een eenregelig `<input>` — lange tekst
liep buiten beeld, niet terug te lezen wat je had getypt.
- `src/app/life-events/page.tsx` — omgezet naar een meerregelige,
  uitklappende `<textarea>`. Enter maakt nu een nieuwe regel, versturen
  gaat via de knop (die nu voluit "→ Versturen" toont, ook duidelijker).

### Probleem 1 (Opslaan-knop) — waarschijnlijke oorzaak gevonden en gefixt
Het AI-voorstel in het gerapporteerde geval noemde "14:45" en "00:45"
— tijden met minuten. Het bestaande systeem ondersteunt alleen **hele
uren** (0-23). Als de AI zo'n tijd probeerde te representeren als een
decimaal getal (bijv. 14.75), gaf de daaropvolgende
`new Date(...).toISOString()`-aanroep een **Invalid Date**-crash —
vlak vóórdat de gebruiker op Opslaan drukte. De catch-blok was leeg
(ging er stilzwijgend van uit dat fouten altijd via `onSave()` kwamen),
dus er verscheen nooit een melding: de knop "deed" zichtbaar niets.

**Drievoudige fix:**
1. `api/life-events/parse/route.ts` — AI-prompt expliciet gemaakt: uren
   moeten hele getallen zijn, rond af en noem de exacte tijd apart in de
   samenvatting
2. Zelfde route — **onafhankelijke validatielaag**, niet alleen
   vertrouwen op de prompt: een niet-heel-getal-uur wordt nu al bij het
   voorstel zelf geblokkeerd met een duidelijke reden
3. `life-events/page.tsx` — client-side vangnet (valt terug op een
   veilige standaardwaarde i.p.v. te crashen) + **altijd een zichtbare
   foutmelding** in het kaartje zelf bij een probleem, ongeacht waar het
   misgaat

**Gevalideerd — 4 scenario's:**
- Geldig heel uur (15) → toegestaan
- Decimaal uur (14.75, precies het waarschijnlijke crash-scenario) →
  geblokkeerd
- Geen uur opgegeven (null) → toegestaan
- Uur buiten bereik (25) → geblokkeerd
- Client-side fallback bij een ongeldige waarde → valt terug op 9:00
  i.p.v. te crashen

`npx next build` — compileert zonder fouten.

**Test-instructie:** typ een zin met een tijd inclusief minuten (bijv.
"vanaf 14:45") — zou nu ofwel een duidelijke, afgeronde tijd in de
samenvatting moeten tonen, ofwel een nette foutmelding, nooit meer een
knop die niets zichtbaars doet.

## v2.4.191 — Fix: verwarrende "+"-knop-verwijzing bij mislukte AI-invoer
**Gemeld met screenshot: "heb ik geen plus en min knop?" — bleek een
verwarrende foutmelding, geen ontbrekende knop.**

### Root cause
Bij een mislukte AI-interpretatie (v2.4.188) verwees de foutmelding
naar *"gebruik de '+'-knop hierboven"* — die knop staat in de
**titelbalk**, bovenaan de pagina, ver van het AI-invoerkaartje en niet
zichtbaar zonder terug te scrollen. Verwarrend, geen echte bug in de
zin dat er iets ontbrak — de tekst verwees gewoon naar de verkeerde
plek.

### Fix
`src/app/life-events/page.tsx` — de vage verwijzing vervangen door een
**directe, werkende knop binnen het foutmeldingskaartje zelf**
("Probeer het preciezer, of voeg handmatig toe →"), die rechtstreeks
het handmatige toevoegformulier opent. Geen cross-page-verwijzing meer
nodig.

`npx next build` — compileert zonder fouten.

**Test-instructie:** typ iets vaags in "Vertel de Coach" (bijv. een
zin zonder duidelijk type) — de foutmelding zou nu een knop moeten
tonen die direct het handmatige formulier opent.

## v2.4.190 — Fix (2/2): einddatum via het hoofdveld werd nog steeds genegeerd
**Gemeld ná v2.4.189: begindatum werkte nu correct, maar de einddatum
"pakte hij niet". Root cause: twee aparte einddatum-velden.**

### Root cause
Er bestaan **twee verschillende "einddatum"-velden**:
- `end_date` — het hoofdveld, bovenaan het formulier ("Einddatum"),
  waar de gebruiker deze in de praktijk invult
- `recurrence_end_date` — een apart veld, alleen bereikbaar via de
  Herhaling-substap, bedoeld voor "wanneer stopt deze terugkerende
  regel volledig"

v2.4.189 checkte alleen `recurrence_end_date` als bovengrens voor
terugkerende events. Omdat de gebruiker de datum via het voor de hand
liggende hoofdveld instelde (`end_date`), werd die grens genegeerd —
de regel bleef na de ingestelde einddatum gewoon actief.

### Fix
- `src/core/utils/life-events-context.ts` + `src/app/life-events/
  page.tsx` — beide velden worden nu gecheckt (`end_date` én
  `recurrence_end_date`) als bovengrens voor terugkerende events.

**Gevalideerd — 3 scenario's, exact het gerapporteerde geval (10-13
augustus, einddatum via het hoofdveld):**
- 9 augustus (vóór begin) → correct inactief
- 13 augustus (einddatum zelf) → correct actief (grens inclusief)
- 14 augustus (ná einddatum — het gerapporteerde probleem) → correct
  inactief

`npx next build` — compileert zonder fouten.

**Test-instructie:** check "Avonddienst" nogmaals — zou nu ná 13
augustus niet meer moeten verschijnen.

## v2.4.189 — BELANGRIJKE FIX: terugkerende regels negeerden hun eigen begindatum
**Gemeld met screenshots: "Avonddienst" met begindatum 10 augustus
verscheen al vanaf 3 augustus in de kalender. Bevestigd: een echte,
significante bug — niet alleen dit ene geval.**

### Root cause
`isHerhalendActiefOpDag()` (UI) en de `relevanteHerhalend`-filter
(backend, voedt de Context Resolver/Coach) checkten wel de **einddatum**
van een terugkerende regel, maar **nooit de begindatum**. Een
terugkerende regel werd hierdoor als actief beschouwd vanaf het begin
der tijden, ongeacht de ingestelde startdatum — deze bug bestaat sinds
v2.4.173, toen deze functies voor het eerst gebouwd zijn.

**Erger dan verwacht:** de backend-query miste `recurrence_end_date`
zelfs helemaal — die kolom werd nooit opgehaald, dus ook de
**einddatum** werd door de Coach/Context Resolver nooit gerespecteerd,
alleen door de UI (die het wél ophaalde, voor de kalenderweergave).

### Impact
Elke gebruiker die ooit een terugkerende regel met een **toekomstige
startdatum** instelde ("vanaf volgende maand elke maandag..."), kreeg
die regel al **onmiddellijk** meegewogen in Coach-advies en Recovery
Score — weken of maanden te vroeg. Regels met een einddatum bleven voor
de Coach (niet de UI) voor altijd actief.

### Fix
- `src/app/life-events/page.tsx` — `isHerhalendActiefOpDag()`:
  begindatum-check toegevoegd (`dagStr < startDatum → false`)
- `src/core/utils/life-events-context.ts` — `recurrence_end_date`
  toegevoegd aan `SELECT_FIELDS` (ontbrak volledig) en het
  `LifeEventRow`-interface; begin- én einddatum-check toegevoegd aan
  `relevanteHerhalend`

**Gevalideerd — 5 scenario's, exact het gerapporteerde geval (begin 10
aug, eind 13 aug):**
- 3 augustus (vóór begindatum) → correct inactief (was het probleem)
- 10 augustus (begindatum zelf) → correct actief
- 12 augustus (binnen de periode) → correct actief
- 13 augustus (einddatum zelf) → correct actief (grens inclusief)
- 14 augustus (na einddatum) → correct inactief

`npx next build` — compileert zonder fouten.

**Test-instructie:** open Levensgebeurtenissen, bekijk "Avonddienst" —
zou nu pas vanaf 10 augustus moeten verschijnen in de weekweergave,
niet meer op 3-7 augustus.

## v2.4.188 — Coach Agenda Fase B, eerste stap: AI-invoer (tekst)
**Vervolg op Fase A. Scope voor deze levering: tekst-invoer +
verplichte bevestiging. Spraak en Quick Cards volgen apart.**

### Nieuw
- **`src/app/api/life-events/parse/route.ts`** — neemt vrije Nederlandse
  tekst, roept Claude aan met de volledige, exacte typevocabulaire (38
  types uit alle 6 categorieën, inclusief Fase A's uitbreidingen) als
  harde grens in de system-prompt. **Slaat niets op** — levert alleen
  een gestructureerd voorstel (`gelukt: true/false`, type, datum,
  herhaling, etc.) terug.
- **Niet-onderhandelbaar principe, technisch afgedwongen**: een
  onafhankelijke validatielaag (`GELDIGE_TYPES`-check) controleert het
  door de AI teruggegeven type tegen de bekende vocabulaire, los van de
  prompt-instructie zelf. Als de AI de instructie zou negeren, wordt
  een onbekend type hier alsnog geblokkeerd — geen vertrouwen op alleen
  "de AI zal het wel goed doen".
- **`AiInvoerKaart`** (UI-component op `/settings/life-events`) —
  invoerveld + verplichte bevestigingskaart ("Ik heb dit begrepen: ...")
  met ✓ Opslaan / ✏️ Opnieuw. De daadwerkelijke opslag loopt via de
  bestaande, al-geteste `slaEventOp()` — geen nieuwe opslaglogica, de
  AI levert alleen het voorstel aan.

### Architectuurprincipe herbevestigd
Zelfde filosofie als CoachOS' allereerste kernregel ("AI never creates
exercises"): AI mag nooit zelfstandig een regel opslaan.

**Gevalideerd vóór levering:**
- `npx next build` — compileert zonder fouten, nieuwe route aanwezig
  in de build-output
- Validatielaag getest: geldig type (fysiotherapeut) → doorgelaten;
  verzonnen type (kapper) → geblokkeerd; **plausibel klinkend maar
  bewust niet-ondersteund type (wedstrijd) → geblokkeerd** — bevestigt
  dat de check onafhankelijk van de AI-prompt werkt, niet alleen
  "vertrouwen op de instructie"
- 38 geldige types bevestigd, matcht de volledige Fase A-vocabulaire

**Nog niet gebouwd:** spraak (browser-eigen spraakherkenning, geen
nieuwe API nodig — kleine, aparte vervolgstap), Quick Cards, Fase C
(Coach Inbox, patroonherkenning), Fase D (externe agenda-sync).

## v2.4.187 — Week-navigatie op Levensgebeurtenissen
**Gevraagd: "verder scrollen is wel handig" — de weekstrip toonde
alleen "Deze week", zonder mogelijkheid om vooruit te bladeren. Nodig
om de v2.4.185-uitzonderingen-functie te kunnen controleren zonder een
week te hoeven wachten.**

### Nieuw
- `src/app/life-events/page.tsx` — `WeekKalender` kreeg vorige/volgende-
  weekknoppen (◀ ▶), zelfde patroon als de Cycling/Running Kalender-
  pagina's. Label wordt dynamisch: "Deze week" bij offset 0, anders
  "Week van [datum]".

**Gevalideerd:** datumberekening getest met exact het scenario uit de
gerapporteerde screenshots (vandaag 30 juli) — één klik op "volgende
week" komt correct uit op de week van 3 augustus (bevat 5 augustus,
de ingestelde uitzondering). `npx next build` compileert zonder
fouten.

**Test-instructie:** open Levensgebeurtenissen, tik op de rechter
pijl bij "Deze week" — de week met 5 augustus zou nu zichtbaar moeten
worden, met woensdag 5 augustus zonder het Fysiotherapeut-icoon
(de ingestelde uitzondering), terwijl andere woensdagen het gewoon
tonen.

## v2.4.186 — Fix: "Uitzonderingen" ontbrak in het toevoegscherm
**Gevonden tijdens het testen (met screenshot): bij het aanmaken van
een nieuwe terugkerende regel (Wekelijks + Woensdag) stond er geen
"Uitzonderingen"-veld, terwijl dat wel in v2.4.185 zou moeten zitten.**

### Root cause
De uitzonderingen-UI (v2.4.185) werd per ongeluk alleen in het
**bewerkscherm** (`EventDetail`) gebouwd, niet in het **toevoegscherm**
(`NieuwEventSheet`) — twee losse componenten met elk hun eigen
herhaling-stap, ik heb de tweede over het hoofd gezien.

### Fix
`src/app/life-events/page.tsx` — dezelfde uitzonderingen-UI (datum
toevoegen/verwijderen) nu ook in `NieuwEventSheet`'s herhaling-stap,
inclusief het meesturen bij het opslaan.

**Gevalideerd:** `npx next build` — compileert zonder fouten.
"Uitzonderingen"-tekst bevestigd op beide plekken (toevoegen én
bewerken).

**Test-instructie:** maak een nieuwe terugkerende regel aan (Wekelijks
+ een dag) — het "Uitzonderingen"-veld zou nu direct zichtbaar moeten
zijn, zonder eerst te hoeven opslaan en opnieuw te openen.

