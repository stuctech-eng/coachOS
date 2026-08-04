# CoachOS — Changelog

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

## v2.4.185 — Coach Agenda Fase A (Master Foundation)
**Eerste bouwstap van de Coach Agenda-visie. Volledig additief, zoals
afgesproken: geen bestaande engines (Recovery/CoachPolicy/Today
Engine/Decision Engine) gewijzigd.**

### SQL (uitvoeren vóór deze code)
`supabase/coach_agenda_fase_a.sql` — puur additieve kolommen op
`life_events`: `available_time_minutes`, `priority`, `coach_note`,
`location_type`, `energy_expectation`, `travel_distance_km`,
`recurrence_exceptions` (date-array).

### Twee besluiten vooraf, expliciet vastgelegd
1. **Recovery Score onaangeroerd** — bestaande 0-3-schaal
   (`recovery_impact`/`stress_load`/`sleep_disruption`) blijft de
   operationele velden voor de Recovery Engine. Nieuwe velden zijn
   puur aanvullende context voor Context Resolver/Today Engine/Master
   Coach, geen parallelle schaal.
2. **Soft-delete pas in een latere fase** — DELETE blijft een echte
   verwijdering. Status-lifecycle (Actief/Gepauzeerd/Beëindigd) is
   bewust uitgesteld naar Fase C/D.

### Nieuw
- **Categorieën uitgebreid**: Medisch (nieuwe categorie — huisarts/
  fysiotherapeut/sportarts/specialist/massage/medisch onderzoek/
  vaccinatie), Sport (nieuwe categorie — trainingskamp/testdag/
  clubrit/evenement), Leven uitgebreid (verjaardag/bruiloft/
  begrafenis/weekend weg/zakenreis/lange autorit/vlucht/hotel), Werk
  (consignatie)
- **Coach-properties**: beschikbare tijd (minuten) en prioriteit
  (laag/normaal/hoog) toegevoegd aan zowel het toevoeg- als
  bewerkformulier
- **Uitzonderingen op terugkerende regels** — "iedere maandag
  dagdienst, BEHALVE 17 augustus" zonder de regel aan te passen of te
  stoppen. Toegevoegd aan `fetchTodaysLifeEvents()` (backend, voedt de
  Context Resolver) én `isHerhalendActiefOpDag()` (UI, weekweergave/
  groepering) — beide consistent
- **Actieve regels duidelijker**: 🔄-icoon prominenter bij terugkerende
  events in de lijstweergave, prioriteit zichtbaar als badge,
  beschikbare tijd zichtbaar

### Bewust niet gedaan
`coach_note` (kolom bestaat, nog niet aan de UI gekoppeld) — zou een
verwarrend tweede notitieveld naast de bestaande `notes` opleveren.
Blijft beschikbaar voor Fase B (AI-gegenereerde notities specifiek).

### Bug gevonden en gefixt tijdens het bouwen
Per ongeluk `recovery_impact: -1` gegeven aan "Massage" — de bestaande
schaal is 0-3 (`IMPACT_NIVEAUS[value]` zou crashen bij een negatieve
index, en de formule gaat uit van alleen-positieve belasting).
Gecorrigeerd naar 0 vóór levering. Alle waarden nogmaals gecontroleerd
op geldig bereik.

**Gevalideerd vóór levering:**
- `npx next build` — compileert zonder fouten
- Uitzonderingen-logica, 4 scenario's: normale dag (actief), exacte
  uitzonderingsdag (correct inactief), week erna (regel blijft
  bestaan), bestaande regels zonder uitzonderingen (ongewijzigd
  gedrag) — allemaal correct
- Alle impact-waarden in de nieuwe categorieën handmatig gecontroleerd
  op 0-3-bereik, geen negatieven

## v2.4.184 — Fix: Today Engine's Trainer AI-vangnet faalde stil (Scenario A-bug)
**Gevonden tijdens het testen van Stap 1 (Today Engine-vangnet): met
het Running-plan gepauzeerd toonde `/debug/today` "Geen actief
trainingsplan en Trainer AI kon geen sessie bepalen" — terwijl de
Trainer-tab zelf in de browser prima een sessie liet zien (Fietsen
training, 75 min). Bevestigd: de interne server-naar-server-aanroep
faalde, niet het ontbreken van data.**

### Root cause (sterk vermoeden, gebaseerd op het exacte symptoom-patroon)
`bepaalTodayPlan()` bouwde de interne aanroep-URL met `VERCEL_URL` —
die wijst naar een **deployment-specifieke** URL, die kan afwijken van
het custom domain/production-alias waar de gebruiker daadwerkelijk op
inlogt. Cookie-domain-mismatch tussen die twee URLs kan de doorgegeven
sessie-cookie ongeldig maken bij de interne aanroep — precies het
patroon dat bevestigd werd (browser werkt, interne aanroep niet).

### Fix
- `src/lib/today-engine.ts` — `bepaalTodayPlan()` accepteert nu een
  expliciete `baseUrl`-parameter i.p.v. zelf te gokken met
  `VERCEL_URL`. Ook diagnostische logging toegevoegd (HTTP-status,
  foutmelding, gebruikte baseUrl) voor het geval het probleem toch
  ergens anders zit.
- **Alle drie de aanroepers bijgewerkt** (`api/today/route.ts`,
  `api/coach/route.ts`, `api/action-plan/route.ts` — de laatste twee
  sinds v2.4.174 ook kwetsbaar voor hetzelfde probleem, nooit apart
  getest) — geven nu `req.nextUrl.origin` door: de host van het
  daadwerkelijke inkomende verzoek, gegarandeerd hetzelfde domein als
  waar de sessie-cookie voor geldig is.

`npx next build` — compileert zonder fouten.

**Belangrijk, eerlijk:** dit is mijn beste diagnose op basis van het
exacte symptoom (browser werkt, interne aanroep niet — een klassiek
cookie-domain-mismatch-patroon), maar zonder toegang tot de
serverlogs kan ik het niet met 100% zekerheid bevestigen. De nieuwe
logging maakt een eventuele volgende poging in elk geval diagnosticeerbaar
i.p.v. weer te moeten gokken.

**Test-instructie:** met het Running-plan nog steeds gepauzeerd, open
`/debug/today` opnieuw — `source` zou nu `trainer` moeten zijn met de
Fietsen-sessie uit de Trainer-tab.

## v2.4.183 — Pauzeer/Hervat-knop voor trainingsplannen (Cycling + Running)
**Aanleiding: Today Engine Scenario A (Trainer AI-vangnet) testen
vergde tijdelijk handmatig SQL uitvoeren. Bleek een genuine, blijvende
functie te zijn — niet alleen voor testen, ook nuttig bij een blessure
of prioriteitswissel zonder het hele plan te moeten verwijderen.**

### Nieuw
- **`PATCH /api/specialists/{cycling,running}/training-plan`** —
  `action: 'pause' | 'resume'`. Hergebruikt de al-bestaande
  `'abandoned'`-status (dezelfde die de bestaande POST-route al
  gebruikt bij het vervangen van een plan) — geen nieuw datamodel
  nodig.
  - `pause`: zoekt het actieve plan, zet op `abandoned`
  - `resume`: **veiligheidscheck eerst** — weigert als er om wat voor
    reden dan ook al een ander actief plan bestaat (zou twee actieve
    plannen opleveren), anders wordt het meest recent gepauzeerde plan
    weer actief gezet
- **GET-route uitgebreid**: retourneert nu ook `heeftGepauzeerdPlan`,
  zodat de UI onderscheid kan maken tussen "nooit een plan gehad" en
  "plan staat gepauzeerd" — anders zou bij een gepauzeerd plan alleen
  "Genereer nieuw plan" te zien zijn, geen "Hervat"
- **UI**: "Pauzeer plan"-knop (met bevestiging, want impactvol —
  Trainer AI neemt het over totdat je hervat) op beide
  Trainingsplan-pagina's. Bij geen actief plan: "Hervat trainingsplan"
  i.p.v. "Genereer" als er een gepauzeerd plan gevonden wordt.

**Geen SQL nodig** — hergebruikt een bestaande statuswaarde
(`'abandoned'`, al onderdeel van de tabel-constraint sinds het begin).

`npx next build` — compileert zonder fouten of warnings.

**Test-instructie:** pauzeer je Running-trainingsplan via de nieuwe
knop, check `/debug/today` — `source` zou nu `trainer` of `rust`
moeten zijn i.p.v. `running`. Hervat daarna weer via dezelfde knop.

## v2.4.182 — Meer weergegevens: gevoelstemperatuur, luchtvochtigheid, windstoten, UV-index, neerslagkans
**Gevraagd: meer weergegevens (o.a. neerslag). Neerslag (mm) bestond al
per dagdeel — uitgebreid met vijf nieuwe, trainingsrelevante velden,
allemaal al beschikbaar bij Open-Meteo (gratis, geen nieuwe sleutel).**

### Backend
`src/app/api/weather/route.ts`:
- Open-Meteo-aanroep uitgebreid: `apparent_temperature`,
  `relative_humidity_2m`, `wind_gusts_10m`, `uv_index`,
  `precipitation_probability`
- `weerAdvies()` gebruikt nu gevoelstemperatuur i.p.v. kale temperatuur
  (relevanter voor inspanningsadvies), weegt luchtvochtigheid mee bij
  hitte-advies, windstoten i.p.v. alleen gemiddelde wind, en UV-index
  bij lange buitentraining
- Neerslagkans (%) per dagdeel toegevoegd naast de bestaande mm
- `coach_context` (gebruikt door de Coach-prompt) bevat nu alle nieuwe
  velden — de Coach "ziet" dus ook de rijkere data

### UI — tik-om-uit-te-klappen, geen apart scherm
Op verzoek: geen navigatie naar een nieuwe pagina, gewoon het bestaande
weerblok op Home tikbaar gemaakt. Standaard compact (zoals nu), tik
erop voor gevoelstemperatuur/luchtvochtigheid/windstoten/UV-index +
neerslagkans per dagdeel + het volledige weeradvies.

**Gevalideerd — 3 scenario's:**
- Warm + vochtig + hoge UV → alle drie de relevante meldingen
- Rustige, koele dag → "Goede weersomstandigheden", geen ruis
- Windstoten → onderdrukt terecht de overbodige "harde wind"-melding
  (voorkomt dubbele info)

`npx next build` — compileert zonder fouten.

## v2.4.181 — Fix: "Ashburn, Virginia" i.p.v. Riva del Garda — GPS viel terug op zwakke IP-locatie
**Gemeld: Coach dacht dat de gebruiker in Ashburn, Virginia zat, terwijl
die daadwerkelijk aan het Gardameer (Italië) was. "Ashburn" is een
bekend AWS/Vercel-datacenter — een klassiek signaal dat er een server-
IP werd opgepikt i.p.v. de echte locatie.**

### Twee waarschijnlijke oorzaken gevonden en beide gefixt

**1. GPS-aanvraag was te zwak ingesteld**
- `enableHighAccuracy` stond niet aan (standaard `false`) — de browser
  gebruikt dan WiFi/zendmast-positiebepaling i.p.v. echte GPS-
  satellieten. Op reis, in een onbekend buitenlands netwerk, kan dat
  onbetrouwbaarder zijn dan een echte GPS-fix.
- Timeout stond op 5 seconden — te kort voor een "koude" GPS-fix,
  helemaal met minder goed zicht op de hemel (bijv. tussen bergen bij
  het Gardameer).
- **Fix:** `enableHighAccuracy: true`, timeout naar 15 seconden.
- **Bijvangst:** de foutreden bij een mislukte GPS-aanvraag werd
  stilzwijgend weggegooid (`() => haalWeerOp()`) — nu gelogd naar de
  console (permissie geweigerd/timeout/positie niet beschikbaar), zodat
  een volgend probleem niet meer geraden hoeft te worden.

**2. IP-vangnet gebruikte niet Vercel's eigen, betrouwbaardere geo-headers**
- Vercel's edge-netwerk berekent zelf al `x-vercel-ip-latitude`/
  `-longitude`/`-city` op basis van het daadwerkelijke client-IP — dit
  werd nergens gebruikt. In plaats daarvan deed de app een eigen
  ipapi.co-lookup op basis van `x-forwarded-for`, die soms een proxy-/
  server-IP oplevert (vandaar mogelijk Ashburn).
- **Fix:** `src/app/api/weather/route.ts` — Vercel's geo-headers nu als
  eerste, betere vangnet vóór de ipapi.co-lookup.

### Permanente diagnosemogelijkheid (niet meer verwijderen)
De vorige debug-indicator (v2.4.168) werd na bevestiging weer
verwijderd — bleek te vroeg, want dit probleem kwam terug zonder dat we
het konden diagnosticeren. Nu anders aangepakt:
- **Nieuw:** `/debug/weer` — permanent beschikbaar (vanaf `/debug`),
  toont welke locatiebron daadwerkelijk gebruikt is (`gps`/
  `vercel-headers`/`ipapi`/`fallback`), met een eigen GPS-testknop.
  Niet meer op Home zelf — geen visuele rommel voor dagelijks gebruik,
  wel altijd beschikbaar bij een volgend rapport.
- `_locatie_debug`-veld in de `/api/weather`-respons, permanent
  (i.t.t. de vorige, tijdelijke versie).

`npx next build` — compileert zonder fouten, `/debug/weer` aanwezig in
de build-output.

**Test-instructie:** open `/debug/weer`, tik op "GPS opvragen" — de
gebruikte bron zou `gps` moeten worden met de juiste coördinaten. Mocht
er ooit weer een verkeerde locatie gemeld worden: check eerst dit
scherm vóór er verder gegokt wordt.

## v2.4.180 — Fix (2/2): ververs-knop gaf nog steeds dezelfde fallback-tekst terug
**Gemeld: v2.4.179 loste het niet op, zelfde tekst na een klik op de
ververs-knop. Diepere oorzaak gevonden — v2.4.179 was een terechte
fix, maar loste niet de échte hoofdoorzaak op.**

### Root cause
`POST /api/coach` — de route die de ververs-knop en "Genereer advies"-
knop aanroepen — bevatte zélf een kortsluiting: als er al een rij voor
vandaag bestond met zowel `recommendation` als `advice_bullets`
gevuld, werd die meteen teruggegeven **zonder opnieuw te genereren**.

Een eerder aangemaakte fallback-rij (uit de v2.4.179-race-condition,
vóór die fix) heeft toevallig beide velden gevuld
(`recommendation: 'Bekijk je dagplan hieronder'`, `advice_bullets:
'[]'` — een lege array, maar een niet-lege string). Deze kortsluiting
zag dat dus als "al klaar" en sloeg regeneratie over — **ook bij een
expliciete klik op ververs**. Bevestigd: `POST /api/coach` wordt
uitsluitend via directe knopklikken aangeroepen (geen achtergrond-
aanroeper die van deze cache profiteert), en de knop is al `disabled`
tijdens het genereren — deze kortsluiting had dus geen nuttig doel.

### Fix
- `src/app/api/coach/route.ts` — de "geef bestaande rij terug"-
  kortsluiting uit `POST` verwijderd. POST betekent nu altijd: écht
  opnieuw genereren. GET blijft de cache-lezende variant voor stille
  achtergrond-weergave.
- `src/app/home/page.tsx` — de check in `genereerDagplan()` (v2.4.179)
  verscherpt: keek alleen of er *iets* stond, niet of het de fallback-
  tekst zelf was. Herkent nu expliciet de fallback-markering
  ("Gegenereerd via dagplan...") i.p.v. alleen op leegte te controleren.

**Gevalideerd — 3 scenario's, allemaal correct:**
- Geen recommendation → regenereren
- Fallback-tekst (het gerapporteerde geval) → regenereren
- Echt, persoonlijk advies → niet onnodig opnieuw genereren

`npx next build` — compileert zonder fouten.

**Test-instructie:** tik nogmaals op de ververs-knop (rond pijltje) bij
"Vandaag van je Coach" — deze keer zou er een écht, persoonlijk advies
moeten verschijnen, niet de "Gegenereerd via dagplan"-tekst.

## v2.4.179 — Fix: "Gegenereerd via dagplan — nog geen apart coach advies" (race condition)
**Gevraagd: waarom staat er soms een generieke fallback-tekst i.p.v.
het echte, persoonlijke Coach-advies? Root cause: een race condition
tussen twee API-aanroepen die niet op elkaar wachtten.**

### Root cause
De ververs-knop bij "Vandaag van je Coach" riep
`generateAdvice()` (→ `/api/coach` POST, genereert het echte advies met
AI) en `genereerDagplan()` (→ `/api/action-plan` POST, genereert het
dagplan) **tegelijk** aan, zonder op elkaar te wachten:
```js
onClick={() => { generateAdvice(); genereerDagplan() }}
```
`api/action-plan/route.ts` verwacht dat er al een
`coach_recommendations`-rij voor vandaag bestaat (geschreven door
`api/coach`) om die bij te werken met het dagplan. Bestaat die nog
niet — omdat `/api/coach` trager is (echte AI-call) en het raakte —
dan maakt `api/action-plan` zelf een rij aan met generieke
fallback-tekst: *"Gegenereerd via dagplan — nog geen apart coach advies
voor vandaag."* Het echte advies van `generateAdvice()` komt daarna
alsnog binnen, maar te laat — de fallback stond er al.

**Tweede aanroeppunt gevonden:** de aparte "Maak dagplan"-knop riep
`genereerDagplan` rechtstreeks aan, zónder ooit `generateAdvice()` te
hebben gedaan — zelfde probleem, ander pad.

### Fix
- `src/app/home/page.tsx` — ververs-knop wacht nu expliciet op
  `generateAdvice()` vóór `genereerDagplan()` wordt aangeroepen
- **Robuustere fix binnen `genereerDagplan()` zelf**, ongeacht welke
  knop het triggert: als er nog geen `recommendation` bestaat, wordt
  eerst `generateAdvice()` afgewacht — dekt beide aanroeppunten met één
  wijziging, i.p.v. per-knop losse fixes die later weer uit de pas
  kunnen lopen

**Gevalideerd:** `npx next build` — compileert zonder fouten of
warnings. `recommendation` bevestigd in scope vóór `genereerDagplan`'s
definitie (regel 88 vs 315).

**Test-instructie:** tik op de ververs-knop bij "Vandaag van je Coach"
— het dagplan zou nu pas moeten verschijnen nadat het echte advies er
ook is, niet met de generieke fallback-tekst.

## v2.4.178 — Fix: Coach Score bleef de hele dag verouderd na check-in/Garmin-import/activiteit
**Gevraagd: ververst de Coach Score na check-in, foto-import en na een
activiteit? Antwoord na onderzoek: nee — echte bug, geen verkeerde
perceptie.**

### Root cause
Home cachet de Coach Score in localStorage, gesleuteld op datum
(`coach_status_datum`). Zodra er **op welk moment dan ook** vandaag een
score is opgehaald — ook een onvolledige, van vóór check-in/Garmin-
import — blijft die cache de rest van de dag staan. Geen van de drie
invoerpunten wiste deze cache:

- **Check-in**: wiste nooit iets — vertrouwde volledig op
  `herberekenIndienCompleet()` in Home, die zelf een logica-fout heeft
  (`if (scoreDatum === vandaagAms) return` — stopt zodra er ooit een
  cache voor vandaag bestaat, ongeacht of die compleet was)
- **Garmin foto-import**: riep al wél `/api/status` aan na een
  geslaagde import, maar dat ververste alleen de **server**-cache
  (`daily_status`-tabel) — niet de **localStorage**-cache die Home
  daadwerkelijk leest. Halve fix, nooit afgemaakt.
- **Garmin activiteit-import (TCX)**: deed **helemaal niets** — geen
  server-herberekening, geen cache-clear. Grootste gat van de drie.

### Fix
Alle drie de pagina's wissen nu bij een geslaagde actie expliciet
`coach_status_datum`/`coach_status_data`/`dagplan_datum`/`dagplan_data`
uit localStorage, zodat Home bij terugkeer gegarandeerd vers ophaalt
(geen wijziging aan Home's eigen caching-logica nodig — die valt
vanzelf terug op een verse fetch zodra de cache leeg is):
- `src/app/checkin/page.tsx`
- `src/app/settings/garmin-import/page.tsx`
- `src/app/settings/garmin-activity-import/page.tsx`

**Bekende, resterende beperking:** `herberekenIndienCompleet()`'s eigen
interne logica-fout in `home/page.tsx` is niet aangepakt — die blijft
theoretisch een edge-case (bijv. Home al open in een ander tabblad
terwijl elders check-in/Garmin gebeurt). De drie directe fixes dekken
het gerapporteerde, praktische probleem volledig af.

`npx next build` — compileert zonder fouten of warnings.

**Test-instructie:** open Home, laat de score even zien, doe daarna een
check-in of Garmin-import, ga terug naar Home — de score zou nu direct
vers moeten zijn, niet pas na een handmatige refresh of de volgende dag.

## v2.4.177 — Fix: Ritanalyse noemde een 3u43m rit "korter" dan gepland (moest langer zijn)
**Gemeld met screenshot: een rit van 3u43m (223 min) werd door de
Ritanalyse-AI beschreven als "korter dan de geplande 90 minuten" — dat
is duidelijk fout, 223 > 90 is langer.**

### Root cause
De AI-prompt gaf wel de GEPLANDE duur (90 min) door, maar **nergens de
werkelijke duur van de rit zelf** — de AI moest zelf "korter" of
"langer" verzinnen zonder de vergelijking expliciet te krijgen, en deed
dat in dit geval aantoonbaar verkeerd. Exact hetzelfde patroon dat we
vandaag steeds vermeden: de AI moet interpreteren, nooit zelf een
feitelijke vergelijking berekenen.

**Bug zat in zowel Cycling als Running** (zelfde prompt-patroon,
apart gebouwd, apart bevestigd).

### Fix
- `cycling-rit-analyse.ts` + `running-rit-analyse.ts` —
  `RitAnalyseResultaat`/interface kreeg `werkelijke_duur_minuten` +
  `afwijking_richting` ('korter'/'langer'/null), deterministisch
  bepaald (`werkelijkeDuur > geplandeDuur`)
- `api/specialists/cycling/rit-analyse/route.ts` +
  `api/specialists/running/rit-analyse/route.ts` — de prompt geeft nu
  expliciet beide getallen én de vastgestelde richting door: "Dit is
  LANGER dan gepland (223 t.o.v. 90 minuten) — gebruik deze richting
  exact, verzin geen andere."

**Gevalideerd — 3 scenario's:**
- Exact het gerapporteerde geval (223 min werkelijk, 90 gepland) →
  `langer` (was ten onrechte "korter" in de AI-tekst)
- Omgekeerd (45 min werkelijk, 90 gepland) → `korter`
- Binnen de marge (95 min werkelijk, 90 gepland) → `null`, geen
  noemenswaardige afwijking

`npx next build` — compileert zonder fouten.

**Test-instructie:** vraag een nieuwe ritanalyse aan op een rit die
duidelijk afwijkt van het geplande schema — de tekst zou nu de juiste
richting (langer/korter) moeten noemen.

## v2.4.176 — Periodiserings-context: Today Engine weet nu in welke trainingsfase je zit
**Eerste échte databasewijziging sinds de hele Coach Context Engine-
reeks begon — klein, nullable, backwards compatible. `bepaalMesocycli()`
berekende dit al sinds het begin van de Training Plan Engine, maar
gooide het na gebruik weg.**

### SQL (uitvoeren vóór deze code)
`supabase/mesocycle_type_kolom.sql`:
```sql
alter table training_plan_sessions
  add column if not exists mesocycle_type text
  check (mesocycle_type is null or mesocycle_type in ('basis', 'opbouw', 'piek', 'herstel'));
```

### Code
- `training-plan-engine/core.ts` — slaat het al-berekende
  `mesocyclusWeek.type` nu op bij elke sessie (geen nieuwe berekening)
- `training-plan-engine/adjuster-core.ts` — **bijvangst tijdens het
  bouwen:** alle drie de aanpassings-triggers (missed_session/
  injury_protection/fatigue_detected) maakten een vervangende sessie
  aan zonder het mesocyclus-type van het origineel over te nemen — zou
  de trainingsfase alsnog kwijtraken bij elke aanpassing. Nu gefixt op
  alle drie de plekken (`select('*')` bevat het veld al, alleen de
  insert miste het).
- `today-engine.ts` — `TodayPlan.trainingPhase`, bewust uitbreidbaar
  ontworpen maar niet vooruitgebouwd met week-binnen-blok/dagen-tot-
  wedstrijd (bestaat nergens om op te baseren)
- `coach/route.ts` + `action-plan/route.ts` — expliciete AI-instructie
  om de trainingsfase te gebruiken in de uitleg
- `home/page.tsx`, `debug/today/page.tsx` — trainingsfase zichtbaar
  gemaakt (Vandaag-kaart en debugscherm)

### Architectuurkeuze
Bewust NIET in de Context Resolver's prioriteitensysteem (dat is voor
concurrerende levensgebeurtenissen) — trainingsfase is beschrijvende
informatie over de sessie van vandaag, hoort dus bij de Today Engine's
TodayPlan.

**Gevalideerd:** sessie met fase (reason bevat "(Build-week)",
trainingPhase gevuld) en oude sessie zonder dit veld (geen crash,
`trainingPhase: null`) — beide correct. `npx next build` compileert
zonder fouten.

### README: prioriteitenvolgorde bijgewerkt
1. ✅ Master Coach ↔ Today Engine
2. ✅ Periodiserings-context (dit)
3. ✅ Feestdagen
4. Coach Agenda uitbreiden (schoolvakanties, extern)
5. Apple/Google/Outlook-sync
6. Rowing Specialist
7. Strength Specialist
8. Kettlebell Specialist
9. Multi-sport Orchestrator

**Let op:** nieuwe trainingsplannen die vanaf nu gegenereerd worden
krijgen dit veld automatisch. Bestaande, al-gegenereerde sessies blijven
`mesocycle_type: null` totdat er een nieuw plan wordt aangemaakt — geen
achteraf-invullen van historische data.

## v2.4.175 — Coach Agenda Fase 2, eerste stap: feestdagen in de Context Resolver
**Kleinste, veiligste stukje van Fase 2 — geen externe API, geen nieuw
datamodel. Nederlandse feestdagen (Gauss' paasformule, sinds v2.4.173)
waren tot nu toe puur visuele decoratie in de kalender-UI — de Coach
wist er niets van.**

### Nieuw
- **`src/lib/feestdagen.ts`** — de berekening verplaatst naar een
  gedeeld bestand. `life-events/page.tsx` importeert nu dezelfde
  functie i.p.v. een eigen lokale kopie.
- `context-resolver.ts` — `DagContextInput` kreeg een optioneel
  `holiday`-veld. Puur informatief, laagste prioriteit (`vrije_tijd`)
  — overschrijft nooit iets belangrijkers (vakantie/ziekte/werk blijven
  leidend), maar wordt zichtbaar als er verder niets speelt.
- `haalDagContext()` — berekent nu ook of vandaag een feestdag is
  (geen extra databron, dezelfde wiskundige functie).

### Bewuste keuze
Een feestdag overschrijft géén werk-event — CoachOS kan niet weten of
een ingeroosterde dienst op een feestdag verplicht is. Dat blijft aan
de gebruiker (bijv. zelf "Vrije dag" registreren i.p.v. "Dagdienst").

**Gevalideerd — 4 scenario's, allemaal correct:**
- Feestdag alleen → zichtbaar, bij naam genoemd in de Coach-context
- Feestdag + vakantie → vakantie wint, ongewijzigd
- Feestdag + werk → werk wint, feestdag overschrijft niet
- Geen feestdag/geen events → normale staat (gedrag-behoudendheid
  bevestigd)

`npx next build` — compileert zonder fouten of warnings.

### README: prioriteitenvolgorde bijgewerkt
1. ✅ Master Coach ↔ Today Engine — afgerond (v2.4.174)
2. 🔄 Coach Agenda Fase 2 — feestdagen afgerond (dit), externe
   agenda-sync/schoolvakanties/periodiserings-events blijven aparte,
   grotere projecten
3. Rowing Specialist
4. Strength Specialist
5. Kettlebell Specialist
6. Multi-sport Orchestrator

## v2.4.174 — Eén bron van waarheid: Coach-tekst leest nu ook de Today Engine
**Prioriteit 1 van de vastgelegde Coach Context Engine-roadmap.
Opgelost: de Today-kaart op Home en de AI-gegenereerde Coach-tekst
gebruikten twee verschillende bronnen om te bepalen wat er vandaag
getraind wordt — konden in uitzonderlijke gevallen iets anders zeggen.**

### Root cause
`api/today/route.ts` (de kaart) las `training_plan_sessions`
rechtstreeks via `bepaalTodayPlan()` — correct, al getest.
`api/coach/route.ts` en `api/action-plan/route.ts` (de AI-tekst)
leidden het af uit trainingsgeschiedenis + specialist-samenvatting,
geen directe koppeling aan het exacte schema van vandaag.

### Fix — chirurgisch, geen herontwerp
Beide routes roepen nu ook `bepaalTodayPlan()` aan (dezelfde functie
als de kaart) en voegen het resultaat toe als een expliciet,
gezaghebbend contextblok: "VANDAAG STAAT GEPLAND (bepaald door de
Today Engine — dit is de autoritatieve bron, verzin geen ander
sessietype)". De bestaande context-bronnen (Garmin/Morning Health/
weer/dagboek/blessures/etc.) blijven ongewijzigd — dit is één extra,
prioritair blok, geen vervanging van de hele pijplijn.

- `src/app/api/coach/route.ts` — `POST` kreeg toegang tot de
  request (`req: NextRequest`, nodig voor de cookie-doorgifte aan
  Today Engine's interne aanroep), `todayEngineContext`-blok
  toegevoegd vooraan in de prompt-samenstelling
- `src/app/api/action-plan/route.ts` — zelfde patroon, voor het
  gedetailleerde dagplan
- Eigen try/catch op beide plekken: een mislukte Today Engine-aanroep
  mag het Coach-advies nooit blokkeren

### README: prioriteitenvolgorde vastgelegd
1. ✅ Master Coach leest Today Engine — afgerond (dit)
2. Coach Agenda Fase 2 (extern)
3. Rowing Specialist
4. Strength Specialist
5. Kettlebell Specialist
6. Multi-sport Orchestrator — pas zinvol met meerdere specialisten

**Gevalideerd:** conditielogica getest (4 gevallen: specialist-sessie,
Trainer AI-sessie, echte rustdag, lege fallback — toont correct/niet
correct), `npx next build` compileert zonder fouten.

**Test-instructie:** vraag een nieuw Coach-advies aan op een dag met
een actief specialist-trainingsplan — de tekst zou nu consistent moeten
zijn met wat de Today-kaart op Home toont.

## v2.4.173 — Coach Context UI: Levensgebeurtenissen volledig herbouwd
**Vervolg op v2.4.172 (Context Resolver). De pagina zelf herbouwd —
niet langer een registratiescherm, maar een venster naar de Resolver.**

### Context Resolver: output herstructureerd
`src/core/utils/context-resolver.ts` — `ResolvedContext` genest naar
`lifeContext`/`healthContext`/`trainingImpact` (was plat). Zelfde
beslislogica, puur een output-herindeling: "Life Events = leven,
Injuries = gezondheid, Training = uitvoering — de Resolver brengt ze
samen, de bronnen blijven gescheiden." `formatResolvedContext()` en de
4 consumenten (coach/action-plan/status/performance-adapter)
bijgewerkt naar de nieuwe vorm — geen directe veldtoegang buiten deze
functie om, dus verder geen wijzigingen nodig.

### Twee écht kapotte functies gevonden en gefixt
1. **`end_date` had nergens een invoerveld** — bestond al in het
   datamodel en werd al verzonden (altijd `null`), en de
   kalenderweergave gebruikte het alleen bij `type === 'vakantie'`,
   hardcoded. Nu: een echt periode-invoerveld (begin+einddatum) voor
   ELK type, generieke `isEenmaligActiefVandaag()`-check i.p.v. de
   type-specifieke regel.
2. **`fetchTodaysLifeEvents()` filterde op "laatste 2 dagen sinds
   aanmaken"**, niet op de echte periode — een vakantie van 20 juli–3
   augustus zou na een paar dagen automatisch uit de Coach-context
   verdwijnen. Nu een echte periode-check
   (`start_date <= vandaag <= end_date`). Ook `/api/life-events` GET
   (de lijst-query) had een soortgelijk probleem: filterde ALLE
   events op "laatste 14 dagen", waardoor een 3 maanden geleden
   ingesteld terugkerend event uit het overzicht verdween ondanks nog
   actief te zijn. Nu: terugkerende events altijd meegenomen
   (tijdsonafhankelijk), eenmalige events op een 90-dagen-venster.

### Nieuwe UI
- **Statuskaart** — toont de opgeloste Resolver-werkelijkheid:
  modus, waarom, trainingsinvloed in leesbare taal, wat er tijdelijk
  gepauzeerd is (met reden), Coach-advies
- **Snelknoppen**: Vakantie/Ziek (blijven `life_events`), Blessure
  (linkt door naar `/injuries` — eigen, rijkere module, geen dubbele
  registratie), Wedstrijd bewust niet toegevoegd (hoort bij Goal
  Engine's `target_date`)
- **Weekstrip met labels** i.p.v. alleen emoji's
- **Gegroepeerd**: Nu actief / Binnenkort / Terugkerend (één regel per
  terugkerend event, geen expansie — sowieso gegarandeerd doordat elke
  rij al maar één keer is opgeslagen)
- **Formulier uitgebreid**: periode (begin+eind) voor elk type,
  invloed-stap met vriendelijke labels (Geen/Licht/Matig/Zwaar i.p.v.
  kale 0-3-cijfers), vooraf ingevuld vanuit het type maar aanpasbaar
- **Nieuw:** `api/life-events/context/route.ts` — levert de opgeloste
  context aan de UI, zelfde bron als de Coach-prompt

**Architectuurregel bewust bewaakt:** het formulier bepaalt nooit de
intelligentie — trainingModifier/-30% etc. blijft exclusief bij de
Resolver (afgeleid van de modus), niet per event instelbaar. De
gebruiker stelt alleen de ruwe impact-scores in.

**Gevalideerd vóór levering:**
- `npx next build` — compileert zonder fouten of warnings
- Periode-logica getest op de exacte grens (dag ná `end_date` correct
  inactief, start- en einddag zelf correct actief)
- De 4 eerder afgesproken Resolver-scenario's opnieuw bevestigd na de
  output-herstructurering

## v2.4.172 — Coach Context Engine Fase 1: Context Resolver
**Gemeld: de Coach dacht tijdens vakantie nog dat er gewerkt werd.
Root cause: dedupliceer-logica matchte alleen op exact hetzelfde
`type`, niet op logisch conflict — een terugkerende "Dagdienst" en een
eenmalige "Vakantie" stonden gewoon allebei tegelijk in de Coach-
context.**

### Context Resolver — pure functie
- **Nieuw:** `src/core/utils/context-resolver.ts` — `bepaalDagContext()`.
  Volledig puur: geen database, API-calls of AI. Vaste, expliciete
  prioriteitsvolgorde (`CONTEXT_PRIORITY`): blessure → ziekte →
  vakantie → herstel → wedstrijd → werk → training → vrije_tijd.
  Levert één opgeloste dagcontext (mode/modifiers/coachInstruction/
  suppressedEvents/lifeEventPenalty) i.p.v. een ruwe eventlijst.
- **Events verdwijnen nooit stilzwijgend** — onderdrukte events krijgen
  een zichtbare `status: 'suppressed'` + reden.
- Vakantie krijgt nu echte impact (trainingModifier -30%,
  recoveryModifier +20%, stressModifier -40%) — was bijna 0.

### Eén gedeelde bron — was voorheen 5x los geïmplementeerd
- **Nieuw:** `haalDagContext()` + `formatResolvedContext()` in
  `life-events-context.ts` — de gedeelde "onzuivere" wrapper (haalt
  data op, roept de pure resolver aan)
- `api/coach/route.ts`, `api/action-plan/route.ts`,
  `api/status/route.ts` (Coach Score), `core/performance/data/
  performance-data-adapter.ts` — allemaal omgezet naar deze ene bron

### Bijvangst: de v2.4.158-fix bleek nooit gecommit
De Performance-adapter had `lifeEventPenalty` nog letterlijk hardcoded
op `0` staan — de eerder aangekondigde fix uit v2.4.158 is blijkbaar
nooit daadwerkelijk toegepast. Nu (eindelijk) echt gefixt, via de
nieuwe gedeelde bron.

**Geen databasewijziging** — `life_events` blijft ongewijzigd.

### README: Coach Context Engine als toekomstvisie vastgelegd
Bewust NIET "Coach Agenda" genoemd (klinkt als kalender, de visie is
groter). Toekomstige inputs (externe agenda's, schoolvakanties,
automatische periodiserings-events) gedocumenteerd, bewust niet
gebouwd.

**Gevalideerd vóór levering — 5 scenario's, allemaal correct:**
- **Het exacte gerapporteerde probleem:** vakantie + terugkerende
  dagdienst → dagdienst correct onderdrukt, zichtbaar met reden
- lifeEventPenalty-formule ongewijzigd (gedrag-behoudendheid bevestigd)
- Blessure wint zelfs van vakantie
- Neutrale staat zonder events werkt correct
- Onbekend event-type crasht niet, valt terug op laagste prioriteit

`npx next build` — compileert zonder fouten of warnings.

**Test-instructies:**
1. Met je huidige vakantie-instelling → Coach-advies opvragen → mag nu
   niet meer verwijzen naar een werkdag
2. `/debug` → check of de Coach Score niet onverwacht springt (de
   formule zelf is ongewijzigd, alleen de bron is opgeschoond)

## v2.4.171 — Today Engine: proposals[]-structuur + echte tie-break i.p.v. arbitraire volgorde
**Multi-sport-voorbereiding, gefaseerd zoals afgesproken: Fase 1 nu
(intern al schaalbaar, naar buiten toe nog steeds precies één
TodayPlan), Fase 2 (TodaySchedule) bewust pas zodra er echte extra
specialisten zijn.**

### De arbitraire regel is weg
De vorige tie-break — "Cycling wint altijd van Running" bij een
gelijktijdig geplande sessie — was puur toeval van codevolgorde, geen
inhoudelijke beslissing. Vervangen door de **bestaande Decision Engine**
(`beslisTussenSpecialisten`, al gebouwd voor specialist-conflicten):
importance (Goal Engine) → calculated_urgency als tiebreaker.

- `src/lib/today-engine.ts` — herbouwd rond een `proposals[]`-array
  (`SpecialistProposal[]`) i.p.v. losse `cyclingSessie`/`runningSessie`-
  variabelen met if/else. Nieuwe `kiesTussenProposals()`-functie haalt
  bij 2+ voorstellen echte Goal Engine-data op (importance/
  calculated_urgency/dagen_resterend) en geeft die door aan de
  bestaande Decision Engine.
- **Eerlijke vereenvoudiging, benoemd in de code:** `load`/`risk` voor
  de Decision Engine-aanroep zijn hier `'moderate'`/`'none'` — een
  sessie staat al gepland, echte blessure-/belastingsrisico's zijn al
  door Laag 1 (CoachPolicy) afgehandeld vóórdat dit punt bereikt wordt.

### Eerlijke beperking, bewust niet gebouwd
"Regel 4 — Planfase (Build > Base > Recovery)" uit het overleg: geen
mesocyclus-type wordt per plan opgeslagen, dus geen databron om op te
beslissen. Geen gok.

**Gevalideerd vóór levering — 4 scenario's, allemaal correct:**
- Cycling `must` vs Running `normal` → Cycling wint
- **Running `must` vs Cycling `normal` → Running wint** — bewijst dat
  de fix werkt: dit kon met de oude "Cycling wint altijd"-regel
  NOOIT gebeuren
- Gelijke importance, Cycling hogere urgentie → Cycling wint via de
  tiebreaker
- Geen doeldata bij geen van beide → geen winnaar, valt terug op het
  eerste voorstel (stabiel, geen willekeur)

`npx next build` — compileert zonder fouten of warnings.

### Architectuur vastgelegd in README
Fase 1 (nu)/Fase 2 (later, TodaySchedule) expliciet gedocumenteerd,
inclusief waarom Fase 2 nu bewust niet gebouwd wordt (datamodel
ondersteunt nog geen meerdere sessies per dag, geen specialisten die
erom vragen).

## v2.4.170 — Today Engine Debug-scherm + weer-debug opgeruimd
**Twee dingen tegelijk: een debugscherm om Scenario A/C van de Today
Engine te kunnen verifiëren zonder de echte planning te hoeven
aanpassen, en het opruimen van de tijdelijke weer-locatie-debug
(v2.4.168) — bevestigd werkend, zoals afgesproken bij de volgende
update verwijderd.**

### Nieuw: Today Engine Debug
- `src/app/debug/today/page.tsx` — toont de ruwe `/api/today`-respons
  (geformatteerd én als ruwe JSON), los van hoe Home 'm weergeeft.
  Bevestigt of de Today Engine (incl. de interne server-naar-server-
  aanroep naar `api/training/today` met doorgegeven sessie-cookie)
  technisch werkt, ongeacht welk scenario zich vandaag toevallig
  voordoet.
- Link toegevoegd vanaf `/debug`

### Opgeruimd: weer-locatie-debug (v2.4.168)
- `src/app/api/weather/route.ts` — `_debug_locatie`-veld en de
  bijbehorende `bron`-variabele verwijderd. De GPS-vóór-IP-logica zelf
  blijft ongewijzigd, alleen de tijdelijke zichtbaarheid is weg.
- `src/app/home/page.tsx` — amber debugregel, `console.log`-regels en
  het `_debug_locatie`-veld uit het `WeerData`-type verwijderd.

**Gevalideerd:** `npx next build` — compileert zonder fouten of
warnings, `/debug/today` aanwezig in de build-output.

## v2.4.169 — Today Engine: één orkestrator voor "wat moet ik vandaag doen"
**Nieuw platformprincipe, vastgelegd na overleg. Losten een echt
architectuurprobleem op: `api/training/today` (Trainer AI) kon
onafhankelijk van het Specialist-trainingsplan óók zelf Cycling/
Running-sessies voorstellen — twee systemen die elkaar konden
tegenspreken.**

### Kernprincipe
De Today Engine maakt zelf nooit trainingen — hij kiest alleen welke
bestaande bron vandaag de waarheid is. Vaste prioriteit: Veiligheid
(CoachPolicy) → Specialist-trainingsplan → Trainer AI (alleen als
vangnet) → Handmatige bibliotheekkeuze.

### Nieuw
- **`src/lib/today-engine.ts`** — `bepaalTodayPlan()`. Checkt eerst
  `actie_type` (rust/herstel/trainen, al bepaald door CoachPolicy),
  dan `training_plan_sessions` voor Cycling/Running van vandaag, en
  roept pas als laatste stap de bestaande `api/training/today` intern
  aan (server-naar-server, met doorgegeven sessie-cookie) — geen
  duplicatie van die complexe module-keuze/AI-generatielogica.
- **`api/today/route.ts`** — de ENIGE ingang voor "wat moet ik vandaag
  doen?". `api/training/today` blijft bestaan voor de Trainer-tab zelf
  en het starten van een sessie, maar wordt niet langer rechtstreeks
  door Home gebruikt voor deze beslissing.
- `src/app/home/page.tsx` — nieuwe zichtbare "Vandaag"-kaart (titel,
  duur, intensiteit, bron: Cycling/Running Coach of Trainer AI) i.p.v.
  alleen een generieke knop. De actieknop linkt nu naar de juiste plek
  (specialist-trainingsplan óf Trainer AI) i.p.v. altijd blind naar
  Training te sturen.

### Fix onderweg gevonden
Mijn eerste opzet gebruikte een niet-bestaande env-variabele
(`NEXT_PUBLIC_SITE_URL`, zelf verzonnen) en een lege cookie voor de
interne server-naar-server-aanroep — zou nooit hebben gewerkt in
productie. Gefixt naar `VERCEL_URL` (automatisch door Vercel gezet) en
de echte, doorgegeven sessie-cookie.

### Architectuurprincipes vastgelegd in README
1. **Today Engine-hiërarchie** — geldt voor élke huidige en
   toekomstige specialist, niet alleen Cycling/Running
2. **Specialist-sjabloon** — elke specialist krijgt dezelfde 7
   bouwstenen (Profiel/Training Plan Engine/Dashboard/Grafieken/
   Records/Analyse/Memory). Bewust NIET nu gebouwd voor Rowing/
   Kettlebell — Trainer AI blijft daar voorlopig de generieke
   uitvoerder, tot er een concrete aanleiding is.

**Gevalideerd vóór levering:**
- `npx next build` — compileert zonder fouten of warnings, `/api/today`
  aanwezig in de build-output
- **5 scenario's los getest:** rust wint altijd (veiligheid), specialist
  wint van Trainer AI, Trainer AI als vangnet zonder specialist-plan,
  nette lege staat zonder gok, en het edge-case van gelijktijdige
  Cycling+Running-sessies (geen crash, eerste in prioriteitsvolgorde
  wint) — allemaal correct

**Test-instructies:**
1. Met een actief Cycling- of Running-trainingsplan én "trainen" als
   Coach-advies → Home moet de specialist-sessie tonen, knop moet naar
   het trainingsplan linken (niet naar Trainer AI)
2. Zonder actief specialist-plan → Home moet een Trainer AI-sessie
   tonen zoals voorheen
3. Bij "rust" als Coach-advies → geen Vandaag-kaart, gewoon het
   bestaande rust-gedrag

## v2.4.168 — Fix: weer toonde verkeerde locatie tijdens reizen (Venlo i.p.v. Garmisch-Partenkirchen)
**Root cause bevestigd: de app gebruikte helemaal geen GPS — locatie
werd bepaald via IP-adres (`ipapi.co`). Mobiele providers routeren
vaak via een vast regionaal internet-knooppunt (zoals Venlo), waardoor
je IP-adres daar geregistreerd staat, ook duizenden kilometers
verderop. Precies zoals gerapporteerd.**

### Fix — GPS krijgt voorrang, IP-locatie wordt het vangnet
- `src/app/api/weather/route.ts` — accepteert nu optionele `lat`/`lon`-
  query-parameters. Zijn die aanwezig (van GPS), dan worden ze direct
  gebruikt — geen IP-lookup meer nodig. Zonder GPS-coördinaten: exact
  hetzelfde IP-gebaseerde vangnet als voorheen (ongewijzigd gedrag voor
  wie geen locatiepermissie geeft).
- `src/app/home/page.tsx` — vraagt nu eerst `navigator.geolocation.
  getCurrentPosition()` op vóór de weer-API wordt aangeroepen. Bij een
  geweigerde/mislukte GPS-permissie: automatische fallback naar de oude
  IP-route, geen crash. **Extra: haalt het weer opnieuw op zodra de app
  weer op de voorgrond komt** (`visibilitychange`) — belangrijk juist
  tijdens reizen, wanneer je van locatie verandert terwijl de app op de
  achtergrond stond.

### Tijdelijke debug-zichtbaarheid (op verzoek)
Een amber debugregel onder het weerbericht op Home toont welke bron
(`gps`/`ip`/`fallback`) en welke exacte coördinaten daadwerkelijk zijn
gebruikt — zodat je zelf kunt bevestigen dat het nu klopt, zonder in de
devtools te hoeven kijken. **Tijdelijk** — verwijderen zodra bevestigd
dat GPS consistent werkt.

**Gevalideerd vóór levering:**
- `npx next build` — compileert zonder fouten of warnings
- Query-parameter-verwerking los getest: geldige GPS-coördinaten,
  ontbrekende parameters, lege strings, en een ongeldige waarde —
  allemaal correct afgehandeld (val terug op IP/fallback zodra iets
  niet klopt, crasht nooit)

**Test-instructies:**
1. Home openen (met locatiepermissie toegestaan) → debugregel moet
   `bron=gps` tonen met coördinaten die overeenkomen met je
   daadwerkelijke locatie
2. Locatiepermissie weigeren → debugregel moet `bron=ip` of
   `bron=fallback` tonen, weer moet nog steeds gewoon laden (geen
   crash)
3. App naar de achtergrond en weer terug → weer moet opnieuw ophalen

## v2.4.167 — Hoe werkt CoachOS bijgewerkt: Ritanalyse + Progress Center + Grafieken
**Gevraagd: is alles bijgewerkt, ook "Hoe werkt CoachOS"? Antwoord:
nee — en de ritanalyse-functie ontbrak daar zelfs voor Cycling, ook al
bestaat die al sinds v2.4.106.**

- `src/app/settings/hoe-werkt-het/page.tsx` — twee nieuwe regels in de
  Specialisten-sectie:
  1. Automatische ritanalyse (herkent zelf Cycling vs Running, legt uit
     wat er objectief bepaald wordt vóór de coach erop reageert)
  2. Progress Center + Grafieken als aparte schermen

`npx next build` — compileert zonder fouten of warnings.

Hiermee is de documentatie van de hele Running/Cycling-pariteitsronde
(v2.4.159-167) compleet: README, changelog, én de in-app uitlegpagina.

## v2.4.166 — Running Specialist Fase 2 (Professional), afgerond: Progress + Grafieken
**Laatste stap van de Running/Cycling-pariteitsronde. Progress Center
en Grafieken-pagina, spiegelend aan Cycling.**

### Bevinding vooraf: Goal Engine en Memory Engine waren al generiek
`api/specialists/cycling/doelvoortgang` en `.../memory` bleken dunne
wrappers om de al-generieke Goal Engine (`haalGoalsMetProgress`) en
Memory Engine (`haalMemoryOp`/`verwerkKandidaatInzicht`) — hardcoded op
`'cycling'`. De Running-equivalenten waren daardoor bijna letterlijke
kopieën, geen nieuwe logica.

### Nieuw
- `src/app/api/specialists/running/doelvoortgang/route.ts` — spiegelt
  Cycling exact
- `src/app/api/specialists/running/memory/route.ts` — spiegelt Cycling
  exact
- `src/app/api/specialists/running/grafieken/route.ts` — gebruikt
  Running's eigen bestaande functies (`haalWekelijkseRunningTrend`,
  `haalRunningCTLATLTSB`, `haalRunningRecords`, `haalAfstandTrends`) —
  geen nieuwe berekeningen, alleen nooit eerder samengevoegd
- `src/app/coach/running/progress/page.tsx` — VDOT, doelvoortgang,
  kern-records (5K/10K/Halve/Marathon), Memory-inzichten,
  Coach-samenvatting
- `src/app/coach/running/grafieken/page.tsx` — CTL/ATL/TSB-grafiek,
  wekelijkse pace/hartslag/cadans-trends, progressie per kernafstand,
  volledige records-lijst (100m t/m marathon)
- `src/app/coach/running/page.tsx` — links naar beide nieuwe pagina's

**Eerlijk niet gebouwd, zelfde reden als Cycling vóór v2.4.108:**
"VDOT-ontwikkeling" (trend over tijd) — er wordt alleen het huidige
race-resultaat opgeslagen, geen VDOT-geschiedenis. Een grafiek zou één
punt tonen — geen schijngrafiek.

**Gevalideerd:** `npx next build` — compileert zonder fouten of
warnings, alle 5 nieuwe routes/pagina's aanwezig in de build-output.

## 🎉 Running/Cycling-pariteitsronde compleet
Dashboard, Trainingsplan, Ritanalyse, Progress, Grafieken, Records,
Coach, Performance Engine, Goal Engine, Memory Engine, Decision Engine
— beide specialisten nu op hetzelfde architectuurniveau. Toekomstige
uitbreidingen (zoals de Performance Intelligence Engines) werken
voortaan direct voor beide, zonder aparte uitzonderingen.

## v2.4.165 — Running Specialist Fase 2 (Professional), stap 1: Ritanalyse
**Eerste, belangrijkste stap van de uitgebreide Running-pariteitsronde.
Prestatie/Techniek/Belasting-categorieën, zoals besproken — Running
begint hiermee direct op hetzelfde niveau als Cycling, i.p.v. later te
moeten bijbouwen.**

### Nieuw: split-analyse (Negative/Positive Split + pacing-consistentie)
- **Nieuw:** `src/lib/split-analyse.ts` — hergebruikt de
  `afstandMetTijd`-reeks die al werd verzameld voor de afstandscurve
  (v2.4.128), geen wijziging aan de trackpoint-loop nodig. Negative/
  positive split (publiek, wijdverspreid concept) + pacing-consistentie
  (variatiecoëfficiënt over 4 kwart-segmenten).
- `src/lib/tcx-parser.ts` — nieuw `split_analyse`-veld op `TcxParsed`
- `src/app/api/health/garmin-activity-tcx/route.ts` — wordt nu ook
  daadwerkelijk opgeslagen in `metrics.split_analyse`

### Nieuw: Running Ritanalyse
- **Nieuw:** `src/lib/specialists/running-rit-analyse.ts` — Pace-zone,
  hartslagzone, cadans (met hardloop-specifieke drempelwaarden 160/185
  spm, niet dezelfde als fietsen), Prestatie (gem./beste pace, split,
  hoogtemeters, hartslag), Techniek (cadans-score, Running Power indien
  aanwezig), Belasting (TSS/IF, CoachPolicy-conclusie), "volgens schema"
- **Nieuw:** `src/app/api/specialists/running/rit-analyse/route.ts` —
  zelfde patroon als Cycling: AI interpreteert alleen, beslist niets
- `src/app/activities/[id]/page.tsx` — **automatische sport-herkenning**,
  geen aparte knop meer nodig: Cycling-activiteit toont "Cycling Coach"-
  knop, Running-activiteit toont "Running Coach"-knop, zelfde scherm

### Eerlijke beperking, bewust NIET gebouwd
Verticale oscillatie, grondcontacttijd, paslengte — deze velden worden
nergens uit TCX geparsed. Geen gok-implementatie zonder een echt
bestand om de exacte Garmin-tagnamen tegen te testen — zelfde
voorzichtigheid als bij Hill Score/Race Predictor eerder.

**Gevalideerd vóór levering:**
- `npx next build` — compileert zonder fouten of warnings
- **Split-analyse, 4 scenario's:** negative split (-16,7%), positive
  split (+20%), gelijkmatig (96/100 consistentie), te kort (<500m →
  terecht null)
- **Cadans-score, 4 scenario's:** 175spm (ideaal midden, score 100),
  150spm (laag, score 38), 195spm (hoog, score 50), 167spm (normaal,
  score 80) — allemaal exact zoals berekend

**Resterend uit de pariteitsronde:** Running Progress-pagina, Running
Grafieken-pagina (Records/Dashboard/Trainer AI-integratie zijn al
grotendeels op niveau, zie eerdere vergelijking).

## v2.4.164 — BELANGRIJKE FIX: Running-veldnamen kwamen niet overeen met wat de TCX-importer schrijft
**Gemeld met screenshot: Running Coach-dashboard toonde 0km voor week/
maand/jaar en geen pace, terwijl de coach-tekst eronder correct "vijf
runs, 16,3 kilometer" noemde. Twee verschillende bronnen, verschillende
uitkomst — dat hoorde niet.**

### Root cause
`garmin-activity-tcx/route.ts` schrijft naar `metrics.distance`,
`metrics.avg_speed`, `metrics.elevation_gain` (bevestigd: Cycling's
eigen `cycling-grafieken.ts` gebruikte deze namen al correct). Mijn
`running-grafieken.ts` — geschreven in een eerdere sessie — gebruikte
overal de verkeerde namen: `distance_m`, `avg_speed_kmh`,
`elevation_gain_m`. Die velden bestaan simpelweg niet op de opgeslagen
data, dus elke berekening die ervan afhing gaf stil 0 terug — geen
foutmelding, want `?? 0`/`|| 0`-fallbacks vingen het op.

**`running-analysis.ts` (bron van de coach-tekst) gebruikte wél de
juiste naam (`'distance'`) — vandaar de discrepantie in het
screenshot.**

### Impact — groter dan alleen het dashboard
Dit veldnaam-verschil raakte alles wat `running-grafieken.ts`
aanlevert:
- Running Dashboard: week/maand/jaar-km, gemiddelde pace — altijd 0/leeg
- **Running TSS-berekening** (`berekenGeschatteRunningTSS` gebruikt
  `avg_speed`) — dus ook **CTL/ATL/TSB voor Running altijd 0**
- **Load Engine (Performance Platform, v2.4.150)** — verklaart waarom
  eerder vandaag getest werd met "Running: CTL 0 · ATL 0 · TSB 0",
  wat ik toen aanzag voor "nog geen data" terwijl het deze bug was
- Wekelijkse pace-trend (Progressie-pagina)
- **Climbing Score** (`performance-data-adapter.ts`, `getHoogtemeters()`)
  — zelfde `elevation_gain_m`-fout, dus ook Cycling-hoogtemeters
  stonden altijd op 0

### Fix
- `src/lib/specialists/running-grafieken.ts` — alle 6 voorkomens
  gecorrigeerd naar `distance`/`avg_speed`/`elevation_gain`.
  `running_distance_records`-verwijzingen (een aparte tabel, terecht
  met een eigen `distance_m`-kolom) NIET aangeraakt — die klopten al.
- `src/core/performance/data/performance-data-adapter.ts` —
  `getHoogtemeters()` idem gefixt

**Gevalideerd:** `npx next build` — compileert zonder fouten of
warnings. Volledige her-grep van het bestand bevestigt: geen
verkeerde veldnamen meer over op de juiste plekken, de
`running_distance_records`-kolomverwijzingen (terecht `distance_m`)
ongewijzigd gelaten.

**Test-instructies:**
1. Running Hub → Dashboard moet nu echte week/maand/jaar-km en pace
   tonen
2. `/performance` → Load Engine → Running-regel moet nu een echte
   CTL/ATL/TSB tonen i.p.v. 0/0/0
3. `/performance` → Climbing-kaart → hoogtemeters moet nu een echt
   getal tonen (als er Cycling-activiteiten met hoogtedata zijn)

## v2.4.163 — Fix: Running Profile onvindbaar in Instellingen + volledige live-inventarisatie
**Gevraagd: "is Running nu compleet?" — het Running-profielscherm
bleek al sinds v2.4.126 te bestaan en te werken, maar stond nergens
gelinkt vanuit Instellingen. Alleen Cycling Profile had een regel.**

- `src/app/settings/page.tsx` — "Running Profile"-regel toegevoegd,
  direct naast Cycling Profile

### Volledige live-inventarisatie uitgevoerd (op verzoek, voortaan standaard)
Alle bestanden gecontroleerd die vandaag zijn geleverd — niet alleen
aanwezigheid (HTTP 200), maar ook inhoud (bevat het bestand daadwerkelijk
de laatste logica, niet een oudere versie):

- **Running Specialist** (8 bestanden): alle aanwezig
- **Training Plan Engine** (6 bestanden): alle aanwezig
- **Morning Health / Vision Engine** (9 bestanden): alle aanwezig
- **Performance Intelligence Platform** (21 bestanden — Fase 1A/1B/2
  compleet): alle aanwezig
- **Inhoudelijke steekproeven**: recovery-engine.ts (Niveau 2-logica),
  coach-policy.ts (Performance-koppeling), checkin-pagina
  (HRV-Overslaan-knop), home-pagina (Performance-link), alle drie
  coach-routes (morningHealthContext) — allemaal bevestigd correct

**Enige gevonden gat:** de Running Profile-link, nu gefixt in deze
levering.

**Gevalideerd:** `npx next build` — compileert zonder fouten of
warnings.

**Antwoord op de vraag "is Running nu compleet?":** functioneel ja —
Profile, Pace Zones, Dashboard, Records, Performance Center,
Trainingsbelasting, Progressie, volledig Adaptief Trainingsplan
(inclusief Kalender sinds v2.4.159/162), en nu ook vindbaar in
Instellingen. Nog open: uitgebreide Grafieken-pagina (los scherm zoals
Cycling heeft), Wedstrijdplanning — bewust nog niet gebouwd, geen
concrete aanleiding tot nu toe.

## v2.4.162 — HERSTEL: v2.4.159 (Running Kalender) was nooit gecommit
**Gebruiker vroeg "is alles gecommit" — controle wees uit dat de
volledige v2.4.159-levering (2 bestanden) nooit is toegepast, ondanks
dat `package.json` al doorliep naar v2.4.161. Beide bestanden opnieuw
geleverd, exact zoals ze hoorden te zijn.**

- `src/app/coach/running/kalender/page.tsx` — ontbrak volledig (404
  live)
- `src/app/coach/running/trainingsplan/page.tsx` — stond nog in de
  oude vorm (zonder Kalender-knop, met de comment die zei dat de
  pagina nog niet bestond)

**Belangrijk:** commit en push dit hele pakket in één keer. Controleer
na het toepassen of `src/app/coach/running/kalender/page.tsx`
daadwerkelijk in Working Copy staat vóórdat je commit — dat is precies
waar het eerder misging.

**Gevalideerd:** `npx next build` — compileert zonder fouten, nieuwe
route aanwezig in de build-output.

## v2.4.161 — "Schoon schip", deel 4: Hoe werkt CoachOS bijgewerkt
**Vierde stap van de opschoonronde.**

- `src/app/settings/hoe-werkt-het/page.tsx` — de regel over de
  Performance-pagina beschreef nog de oude, eenvoudigere inhoud
  (HRV-trend/Body Battery/Training Readiness/VO2max). Bijgewerkt naar
  wat er sinds v2.4.160 daadwerkelijk staat: Herstel, Readiness,
  belastbaarheid (CTL/ATL/TSB), vermoeidheid, consistentie, en de
  fitness-indicatoren met hun Confidence-scores.

`npx next build` — compileert zonder fouten of warnings.

**Laatste stap van de opschoonronde: CoachPolicy-koppeling.** Bij
onderzoek bleek dit geen zinvolle wijziging — zie de toelichting in de
chat. CoachPolicy gebruikt al dezelfde onderliggende berekening
(`calculateRecoveryScore()`) als de nieuwe Recovery-wrapper; die
wrapper voegt alleen Confidence-scoring en EngineResult-opmaak toe die
CoachPolicy niet gebruikt. Overschakelen zou alleen overbodige
databasequeries toevoegen aan een veelgebruikt pad (elke Coach-
aanroep), zonder enige gedragsverandering. Bewust NIET doorgevoerd.

## v2.4.160 — "Schoon schip", deel 3: Performance Dashboard-UI
**De grootste stap van de opschoonronde: de Performance Engine-laag
(Fase 1A/1B/2, 12 engines) is nu voor het eerst zichtbaar voor de
gebruiker in een echt scherm, niet alleen in het debug-scherm.**

- **Nieuw:** `src/app/api/performance-engine/route.ts` — productie-
  route, zelfde keten als `/api/debug/performance-engine` maar geeft
  bewust geen ruwe context terug (geen checkin/health-details), alleen
  wat het Dashboard nodig heeft
- **Herbouwd:** `src/app/performance/page.tsx` — gebruikt nu de nieuwe
  Performance Intelligence Platform-laag i.p.v. de oorspronkelijke,
  eenvoudigere berekening direct op ruwe data (v2.4.142/143). **Eén
  bron van waarheid**, geen twee verschillende versies van dezelfde
  cijfers meer.
- Indeling: Vandaag (Herstel + Readiness, met uitleg en CoachPolicy's
  max-intensiteit) → Belastbaarheid (CTL/ATL/TSB + Vermoeidheid) →
  Herstel-trend (30 dagen) → Consistentie → Fitness-indicatoren
  (Endurance/Sprint/Efficiency/Climbing) → Progressie (indien
  beschikbaar)
- **`api/performance-overview/route.ts` (v2.4.142) gemarkeerd als
  vervangen** — nergens meer aangeroepen, dode code. Kan handmatig
  verwijderd worden (zips verwijderen geen bestanden), geen haast.

**Gevalideerd vóór levering:** `npx next build` — compileert zonder
fouten of warnings, beide routes (`/api/performance-engine`,
`/performance`) aanwezig in de build-output.

**Vervolgens, laatste twee stappen van de opschoonronde:** Hoe werkt
CoachOS bijwerken (nu er een echt Dashboard is), CoachPolicy-koppeling
van de Recovery-wrapper.

## v2.4.159 — "Schoon schip", deel 2: Running Kalender
**Laatste openstaande punt van de Running Adaptive Training Plan-
roadmap. Exact spiegelbeeld van Cycling's kalenderscherm.**

- **Nieuw:** `src/app/coach/running/kalender/page.tsx` — maandweergave,
  hergebruikt dezelfde `GET /api/specialists/running/training-plan`
  als het planningsscherm, geen nieuwe API. Running-sessietypen/-kleuren
  (Easy Run/Interval/Herstel/Tempo/Lange duurloop).
- `src/app/coach/running/trainingsplan/page.tsx` — Kalender-knop
  toegevoegd (was bewust weggelaten in v2.4.134 omdat de pagina toen
  nog niet bestond)

`npx next build` — compileert zonder fouten of warnings, nieuwe route
aanwezig in de build-output.

**Vervolgens, in dezelfde opschoonronde:** Dashboard-UI voor de
Performance Engine, Hoe werkt CoachOS bijwerken, CoachPolicy-koppeling
van de Recovery-wrapper.

## v2.4.158 — "Schoon schip", deel 1: README-opschoning + levensgebeurtenis-penalty
**Eerste twee stappen van een grotere opschoonronde (zie het overzicht
in de chat van 21 juli 2026).**

### README opgeschoond
Twee oude 🔴-blokkerende items geverifieerd en bevestigd achterhaald:
`injuries.ended_at` wordt nergens in de live code gebruikt (de app
werkt via een simpeler `active`-boolean-veld), `garmin_activity_imports`
wordt actief en zonder problemen gebruikt in meerdere routes. Beide uit
de Openstaand-lijst. Overige oude items (v2.4.23-72-tijdperk) niet
stuk voor stuk herverifieerd — expliciet benoemd als aanname, niet als
bevestiging.

### Levensgebeurtenis-penalty in de Performance-data-adapter
- `src/core/performance/data/performance-data-adapter.ts` — niet
  langer hardcoded `0`. Zelfde query + formule als het al-werkende
  `api/status/route.ts` (`recovery_impact×5 + sleep_disruption×3`,
  levensgebeurtenissen van de laatste 2 dagen) — geen nieuwe
  berekening, hergebruik van bestaande, geteste logica.
- `core/types.ts` — verouderde comment bijgewerkt

**Gevalideerd:** `npx next build` — compileert zonder fouten of
warnings.

**Vervolgens, in dezelfde opschoonronde:** Running Kalender-pagina,
Dashboard-UI voor de Performance Engine, Hoe werkt CoachOS bijwerken,
CoachPolicy-koppeling van de Recovery-wrapper.

## v2.4.157 — Performance Platform Fase 2 compleet: Sprint, Efficiency, Climbing, Progress
**Op verzoek in één levering: de resterende vier Fase 2-engines.
Hiermee is heel Fase 2 afgerond.**

### Sprint Score
`sprint-engine.ts` — leunt volledig op de al-bestaande vermogenscurve
(`cycling_power_curve`, geen nieuwe databron). Kortste beschikbare duur
≤30s geldt als piek-sprintvermogen. **Eerlijke beperking:** absoluut
vermogen, niet W/kg-genormaliseerd (bewust simpel voor v1).

### Efficiency Score
`efficiency-engine.ts` — Efficiency Factor (gemiddeld vermogen ÷
gemiddelde hartslag), een publiek gedocumenteerd, wijdverspreid
concept in de duursportwereld, geen propriëtaire formule nagemaakt.
**Bewust alleen Cycling in v1** — Running-efficiency (verticale
oscillatie, grondcontacttijd) wordt nergens uitgelezen uit TCX, zou een
onvolledig cijfer geven.

### Climbing Score
`climbing-engine.ts` — hoogtemeters (30 dagen) + W/kg (uit FTP +
gewicht, al bestaande data). **Eerlijke beperking:** stijgingspercentage/
klimduur/klimfrequentie vergen klim-segmentatie per activiteit — bestaat
nergens in CoachOS (zelfde beperking als eerder bij Running's "beste
klim", v2.4.128).

### Progress Score
`progress-engine.ts` — vergelijkt laatste 14 dagen met de 14 dagen
daarvoor, via de History Engine (v2.4.155). **Belangrijke, eerlijk
ingebouwde beperking:** de History Engine is pas net live, dus bij de
meeste gebruikers is er nu nauwelijks geschiedenis. De engine detecteert
dit zelf (`eerderePunten.length < 3`) en verlaagt dan actief de
Confidence-score, i.p.v. een misleidend cijfer te tonen.

- **Nieuwe adapter-helpers:** `getEfficiencyFactorData()`,
  `getHoogtemeters()`, `getFtpEnGewicht()` — elk klein en specifiek,
  zelfde principe als eerder (`getVo2max()`, `getWekelijkseActiviteitPatroon()`)
- `core/engine-registry.ts` — alle vijf Fase 2-engines op 'actief'
- `/debug/performance-engine` — vier compacte kaarten (Sprint/Efficiency/
  Climbing/Progress) toegevoegd

### Kleine bug gevonden en gefixt tijdens het bouwen
In `progress-engine.ts` werd `confidence.score` handmatig verlaagd bij
weinig historie, maar `confidence.level` werd niet opnieuw berekend —
zou dan niet meer bij het aangepaste getal passen. Gefixt vóórdat het
ooit live kwam.

**Gevalideerd vóór levering — elk apart getest:**
- Sprint: 700W → score 50, geen data → score 0
- Efficiency: EF-waarden (1,43/1,52) → gemiddelde 1,47 → score 39
- Climbing: 2500m + 4,0 W/kg → beide componenten 50, gecombineerd 50
- Progress: duidelijke verbetering (50→68) → +35%, stijgend; amper
  historie → terecht `null`/`onbekend` i.p.v. een verzonnen cijfer

`npx next build` — compileert zonder fouten of warnings.

## 🎉 Fase 2 volledig afgerond
Endurance, Sprint, Efficiency, Climbing, Progress — alle vijf actief,
elk met een eerlijke Confidence-score i.p.v. te wachten op maanden
data. Resterend: Fase 3 (Race Predictor, Athlete Profile e.d.) — vergt
écht maanden historie en blijft bewust nog even liggen.

## v2.4.156 — Performance Platform Fase 2, eerste engine: Endurance Index
**Eerste stap van Fase 2. Zoals afgesproken: geen "nog niet beschikbaar
totdat er 90 dagen data is" — vanaf dag 1 een score, met een eerlijke
Confidence erbij (bestaat al sinds Fase 1A).**

- **Nieuw:** `src/core/performance/engines/endurance-engine.ts` —
  `berekenEndurance()`. v1, bewust eenvoudig: drie indicatoren gelijk
  gewogen — VO2max (indien beschikbaar), CTL uit de Load Engine
  (fitness/chronische belasting), Consistency-percentage. Geen
  wetenschappelijke definitieve claim, een eerlijke eerste versie.
- **Belangrijk ontwerpdetail:** ontbrekende VO2max trekt het gemiddelde
  NIET omlaag (geen 0 invullen) — het gemiddelde wordt berekend over
  alleen de beschikbare componenten. Los getest en bevestigd: met
  VO2max ontbrekend gaf het systeem 63 (gemiddelde van 2 componenten),
  niet 42 (wat je zou krijgen als ontbrekende data als 0 telt).
- **Nieuw:** `getVo2max()` in de data-adapter — klein, apart van
  `haalPerformanceVoorRecovery()` (die bewust smal blijft voor
  Recovery's eigen doel)
- `core/engine-registry.ts` — Endurance Index op 'actief', eerste
  Fase 2-engine
- `/debug/performance-engine` — nieuwe kaart met score, label, de drie
  componenten, en Confidence-niveau zichtbaar

**Gevalideerd vóór levering — 3 scenario's, allemaal exact zoals
berekend:**
- Alle drie componenten beschikbaar → score 58, Goed
- VO2max ontbreekt → score 63 (niet omlaag getrokken door ontbrekende data)
- Beginnende gebruiker (weinig CTL/consistency) → score 18, Beginnend

`npx next build` — compileert zonder fouten of warnings.

**Resterend in Fase 2:** Progress Score, Climbing Score, Sprint Score,
Efficiency Score, Confidence Engine-verfijning.

## v2.4.155 — Performance Platform Fase 1B, laatste stap: History Engine
**Sluit Fase 1B volledig af. "Bewaart niet alleen de actuele score,
maar ook de volledige geschiedenis."**

**⚠️ ACTIE VEREIST VÓÓR DEPLOY:**
```sql
create table if not exists performance_engine_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  engine text not null,
  score numeric not null,
  payload jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, date, engine)
);

create index if not exists idx_performance_engine_history_user_engine_date
  on performance_engine_history(user_id, engine, date desc);

alter table performance_engine_history enable row level security;

drop policy if exists "Gebruiker kan eigen performance engine history lezen" on performance_engine_history;
create policy "Gebruiker kan eigen performance engine history lezen"
  on performance_engine_history for select using (auth.uid() = user_id);
```

- **Nieuw:** `src/core/performance/engines/history-engine.ts` —
  `bewaarSnapshot()` + `haalHistorie()`. **Les uit v2.4.145 direct
  toegepast:** geen `upsert`-met-`onConflict` (dat faalde daar stil op
  een niet-matchende sleutel) — expliciet update-of-insert.
- **Bewuste uitzondering, benoemd:** dit is de tweede engine (na
  Readiness) die de database aanraakt — bewaren van scores IS de
  kernfunctie van deze engine, geen ad-hoc databasetoegang.
- `/debug/performance-engine` — elke berekende engine (Recovery/Load/
  Fatigue/Readiness/Consistency) wordt nu bewaard bij elk bezoek, plus
  een nieuwe kaart die Recovery's 30-dagen-historie toont

**Gevalideerd vóór levering:**
- `npx next build` — compileert zonder fouten of warnings
- Update-of-insert-idempotentie los getest: herhaald opslaan dezelfde
  dag/engine → update, geen dubbele rij; andere engine/dag → apart
  ingevoegd. Geen duplicaten, laatste update wint — bevestigd met een
  in-memory simulatie van de exacte productielogica.

## 🎉 Fase 1B volledig afgerond
Load, Fatigue, Readiness, Consistency, History — alle vijf actief.
Samen met Fase 1A (Confidence, Recovery, Explainability) staat nu het
volledige fundament van de CoachOS Performance Intelligence Platform.
Fase 2 (Endurance Index, Progress Score, Climbing Score, Sprint Score,
Efficiency Score — elk met een Confidence-score vanaf dag 1) is de
volgende stap, zodra gewenst.

## v2.4.154 — Performance Platform Fase 1B, stap 4: Consistency Engine
**Vierde stap van Fase 1B. "Niet: hoe goed ben je. Maar: hoe consequent
train je." Kijkt naar de laatste 8 weken, over alle sporten heen.**

- **Nieuw:** `getWekelijkseActiviteitPatroon()` in
  `performance-data-adapter.ts` — apart van de rijke `PerformanceContext`
  (fijnmaziger, per-week over meerdere weken, past niet in één plat
  object), maar blijft wel in de `data/`-map, zelfde principe: enige
  plek die de database aanraakt. Vult ontbrekende weken expliciet met 0
  op — anders geen onderscheid mogelijk tussen "geen data" en "bewust
  geen activiteit".
- **Nieuw:** `src/core/performance/engines/consistency-engine.ts` —
  percentage actieve weken, huidige streak (vanaf nu teruggeteld),
  langste onderbreking (ergens in de periode)
- `core/engine-registry.ts` — Consistency Engine op 'actief'
- `/debug/performance-engine` — nieuwe kaart met percentage, streak en
  langste onderbreking

**Gevalideerd vóór levering — 4 scenario's, allemaal correct:**
- Elke week actief → 100%, streak 8, onderbreking 0
- Gat van 2 weken in het midden, nu weer actief → 75%, streak 4 (vanaf
  nu), langste onderbreking 2
- Laatste 3 weken niets → 63%, huidige streak 0 (want de laatste week
  telt), langste onderbreking 3
- Helemaal niets → 0%, streak 0, onderbreking 8

`npx next build` — compileert zonder fouten of warnings.

**Resterend in Fase 1B: alleen nog History Engine.** Daarna is Fase 1B
compleet.

## v2.4.153 — Performance Platform Fase 1B, stap 3: Readiness Engine
**Derde stap van Fase 1B. Onderscheid uit de master-spec: "Recovery =
herstel. Readiness = klaar om vandaag te presteren." Combineert
Recovery + Fatigue (omgekeerd) tot één "vandaag klaar"-score.**

- **Nieuw:** `src/core/performance/engines/readiness-engine.ts` —
  `berekenReadiness()`: `(recovery.score + (100 - fatigue.score)) / 2`,
  plus CoachPolicy's max-intensiteit als context ernaast (niet
  dubbel meegewogen — CoachPolicy is zelf al een uitkomst van Recovery)
- **Bewuste, expliciet benoemde uitzondering:** dit is de eerste engine
  die een bestaande externe functie (`genereerCoachPolicy`) aanroept
  die zelf rechtstreeks de database raakt — vergelijkbaar met hoe de
  Recovery-wrapper `calculateRecoveryScore()` aanroept, geen nieuwe
  databasequery binnen de engine zelf
- `core/engine-registry.ts` — Readiness Engine op 'actief'
- `/debug/performance-engine` — nieuwe kaart met score/label, de twee
  componenten, en CoachPolicy's max-intensiteit

**Gevalideerd vóór levering — 3 scenario's, allemaal exact zoals
berekend:**
- Goed hersteld (75) + laag vermoeid (36) → score 70, High
- Slecht hersteld (30) + zeer vermoeid (85) → score 23, Low
- **Tegenstrijdig geval:** goed hersteld (80) maar wél vermoeid (70) →
  score 55, Moderate — laat precies zien waarom Readiness meerwaarde
  heeft t.o.v. Recovery alleen (Recovery alleen zou "goed hersteld"
  zeggen, Readiness temperert dat terecht door opgebouwde vermoeidheid)

`npx next build` — compileert zonder fouten of warnings.

**Resterend in Fase 1B:** Consistency Engine, History Engine.

## v2.4.152 — Performance Platform Fase 1B, stap 2: Fatigue Engine
**Tweede stap van Fase 1B. In tegenstelling tot Recovery en Load is dit
GEEN wrapper — nieuwe logica, dus expliciet los getest met 4
scenario's vóór levering.**

- **Nieuw:** `src/core/performance/engines/fatigue-engine.ts` —
  `berekenFatigue()`. Hoger = méér vermoeid (tegenovergesteld aan
  Recovery). Twee componenten: TSB (hoofdsignaal, hergebruikt Load
  Engine's platform-TSB, gewicht 0,7) + ACWR-risico (aanvullend, zelfde
  drempelwaarden als Recovery Engine's ACWR-correctie uit v2.4.148 —
  consistent tussen de twee engines).
- `core/engine-registry.ts` — Fatigue Engine op 'actief'
- `/debug/performance-engine` — nieuwe kaart met score/label + de twee
  componenten apart zichtbaar

**Gevalideerd vóór levering — 4 scenario's:**
- Fris (TSB=20, ACWR=1,0) → score 21, Low
- Vermoeid (TSB=-30, ACWR=1,1) → score 56, High
- Vermoeid + hoog blessurerisico (TSB=-40, ACWR=1,8) → score 93, Very High
- Geen ACWR-data beschikbaar → ACWR-component correct 0 (geen straf bij
  ontbrekende data)

Drie van de vier exact zoals berekend; het vierde week 1 punt af door
een floating-point-afrondingsverschil (45×0,7 is in JavaScript niet
precies 31,5) — geen logicafout, puur binaire representatie van
decimalen.

`npx next build` — compileert zonder fouten of warnings.

**Resterend in Fase 1B:** Readiness Engine, Consistency Engine,
History Engine.

## v2.4.151 — Fix: platform-TSB klopte niet met de som van per-sport-TSB's
**Gemeld met de echte test-output: Cycling toonde CTL 7,2 · ATL 7,6 ·
TSB −1,5 — maar 7,2−7,6 = −0,4, niet −1,5. Geen bug in de weergave: de
bestaande per-sport-functies (`haalCTLATLTSB`/`haalRunningCTLATLTSB`)
slaan TSB bewust op als de waarde bij de START van vandaag (vóór de
training van vandaag meetelt — standaard TSB-semantiek, zodat je 's
ochtends kunt beslissen hoe zwaar te trainen), terwijl CTL/ATL de
waarde NÁ vandaag zijn. Mijn Load Engine berekende platform-TSB
ten onrechte als `ctl - atl` (na-vandaag), i.p.v. de per-sport-TSB's
(bij-start-van-vandaag) op te tellen.**

- `src/core/performance/engines/load-engine.ts` — platform-TSB is nu
  de som van de per-sport-TSB's, niet `ctl - atl`
- `/debug/performance-engine` — korte toelichting toegevoegd waarom
  TSB ≠ CTL−ATL, met opzet (voorkomt dat dit later weer als bug
  oogt)

**Gevalideerd vóór levering:** de EWMA-lineariteit opnieuw numeriek
bevestigd, nu specifiek voor de "entering-today"-TSB-semantiek (niet
alleen CTL/ATL zoals bij de vorige levering) — verschil tussen
optellen en opnieuw berekenen: 3,5×10⁻¹⁵, verwaarloosbaar. `npx next
build` — compileert zonder fouten of warnings.

## v2.4.150 — Performance Platform Fase 1B, stap 1: Load Engine
**Eerste stap van Fase 1B. Wrapper, zoals Recovery — combineert de
bestaande, al-geteste per-sport CTL/ATL/TSB-berekeningen tot één
platformniveau-cijfer.**

### Wiskundige onderbouwing, geverifieerd vóór implementatie
De EWMA-formule (`ctl = ctl + (tss-ctl)/42`) is een lineaire,
tijdsinvariante recursie. Dat betekent `CTL_totaal = CTL_cycling +
CTL_running`, **exact** — geverifieerd met synthetische data (60 dagen,
twee verschillende TSS-patronen): verschil tussen apart-berekenen-en-
optellen versus direct-op-gecombineerde-data was 7×10⁻¹⁵, pure
afrondingsruis. Dit betekent: gewoon optellen van de laatste per-sport-
waarden is wiskundig equivalent aan een nieuwe EWMA-berekening, maar
zonder de bestaande formule te dupliceren.

- **Nieuw:** `src/core/performance/engines/load-engine.ts` —
  `berekenLoad()`, roept `haalCTLATLTSB()` (Cycling) en
  `haalRunningCTLATLTSB()` (Running) aan, telt CTL/ATL op, TSB volgt
  daaruit. Geeft ook de per-sport-breakdown mee (niet alleen het
  platformtotaal).
- `core/engine-registry.ts` — Load Engine op 'actief' gezet
- `/debug/performance-engine` — nieuwe kaart met platform-CTL/ATL/TSB +
  per-sport-detail

**Gevalideerd vóór levering:**
- `npx next build` — compileert zonder fouten of warnings
- EWMA-lineariteit numeriek bewezen (zie hierboven) vóórdat de
  optel-aanpak als productiecode werd geschreven — geen aanname
  ongetest laten staan

**Resterend in Fase 1B:** Readiness/Fatigue/Consistency/History Engine.

## v2.4.149 — CoachOS Performance Intelligence Platform, Fase 1A (fundering)
**Nieuw platformonderdeel op basis van een goedgekeurde master-spec:
een compleet analyseplatform met uiteindelijk 18 engines. Deze
levering legt alleen de fundering — Confidence + Recovery-wrapper +
Explainability + de architectuur eromheen. Load/Readiness/Fatigue/
Consistency/History volgen in Fase 1B.**

### Architectuur, exact zoals besproken
```
src/core/performance/
├── index.ts                    — public exports
├── core/
│   ├── types.ts                — PerformanceContext
│   ├── engine-result.ts        — EngineResult<T>-contract (apart van types.ts, op verzoek)
│   ├── constants.ts
│   └── engine-registry.ts      — overzicht van alle 15 geplande engines
├── data/
│   └── performance-data-adapter.ts  — ENIGE plek die Supabase aanraakt
├── engines/
│   ├── confidence-engine.ts    — NIEUW
│   ├── recovery-engine.ts      — WRAPPER om de bestaande recovery-engine.ts
│   └── explainability-engine.ts — NIEUW, regelgebaseerd
└── shared/
    ├── scoring.ts, dates.ts, validation.ts
```

**Kernprincipe:** `Supabase → data adapter → engines → Dashboard/Coach`.
Geen enkele engine krijgt directe databasetoegang.

### Confidence Engine
Elke score bestaat vanaf dag 1, MET een eerlijke betrouwbaarheids-
indicatie — nooit "nog niet beschikbaar". Vier factoren (dataomvang,
versheid, sensordekking, trainingshistorie), gelijk gewogen, plus
concrete `limitations`-teksten ("HRV-data ontbreekt", "Slechts 4
activiteiten bekend").

### Recovery Engine — bewust een WRAPPER
Roept de bestaande, vandaag al uitgebreid geteste
`calculateRecoveryScore()` aan (Niveau 1+2, v2.4.144/148) — geen
dubbele logica, geen regressierisico.

### Explainability Engine — bewust regelgebaseerd
Geen AI-aanroep voor de basisuitleg — voorspelbaar, goedkoop,
testbaar. Gecentraliseerd zodat niet elke toekomstige engine zijn
eigen uitleglogica krijgt.

### Kleine bijvangst
`haalPerformanceVoorRecovery()` in `health-analysis-engine.ts` had een
anonieme inline return-type — nu benoemd en geëxporteerd als
`PerformanceVoorRecovery` (nodig om 'm elders te kunnen hergebruiken;
brak de build totdat dit gefixt was).

**Gevalideerd vóór levering — drie testlagen:**
1. `npx next build` — compileert zonder fouten of warnings
2. **Confidence Engine, 3 scenario's, allemaal exact zoals verwacht:**
   - Nieuwe gebruiker (4 activiteiten, geen sensoren) → score 31, LOW
   - Ervaren gebruiker (245 activiteiten, alle sensoren) → score 100, HIGH
   - Data ontbreekt (32 trainingen, geen Garmin/HRV) → score 62, MEDIUM,
     met expliciete HRV/slaap-beperkingen
3. **Recovery-wrapper bewezen identiek** aan de directe
   `calculateRecoveryScore()`-aanroep (zelfde 4 parameters doorgegeven,
   zelfde uitkomst)

**Bewust nog niet gedaan:** CoachPolicy zelf gebruikt nog de oude,
directe `recovery-engine.ts` — niet omgezet naar de nieuwe wrapper.
Levensgebeurtenis-penalty ontbreekt nog in de adapter
(`lifeEventPenalty: 0`, expliciet benoemd in de code — vergt nog de
bestaande berekening uit `api/status/route.ts` overnemen).

**Test-instructies:**
1. `/debug` → "⚙️ Performance Engine Debug (Fase 1A)"
2. Controleer dat de PerformanceContext realistische cijfers toont
   (activiteiten-aantal, sensor-beschikbaarheid)
3. Recovery-score + Confidence-niveau + uitleg moeten allemaal
   verschijnen, consistent met wat `/debug/recovery` al liet zien

## v2.4.148 — CoachPolicy Niveau 2: Training Readiness + ACWR-correctie
**Verandert daadwerkelijk het gedrag van de Recovery Score voor alle
gebruikers met Performance-data — precies de reden waarom dit een
aparte, zorgvuldig geteste stap was (Niveau 1, v2.4.144-147, raakte
alleen de datastroom; dit raakt de formule zelf).**

### Ontwerp, zoals besproken
- **Training Readiness** → gewone factor in het gemiddelde, maar met
  een **bescheiden gewicht (0,5×)** — het is Garmin's eigen
  samengestelde herstelindicator en overlapt daardoor deels met HRV/
  slaap die al apart meetellen. Vult aan, domineert niet.
- **Belastingsverhouding (ACWR)** → GEEN gemiddelde-factor (zegt niets
  over hoe goed iemand hersteld is, wel over blessurerisico van de
  huidige belasting) — een **oplopende correctie ná het gemiddelde**,
  net als de bestaande levensgebeurtenis-correctie:
  - ≤1,3 → geen correctie
  - 1,3–1,5 → −5
  - 1,5–1,7 → −10
  - \\>1,7 → −15
- **Bewust geen correctie bij een lage ACWR (<0,8)** — te weinig
  belasting is een fitness-/trainingsplan-vraag, geen herstelvraag.
  Hoort bij de Goal Engine/specialist, niet bij de Recovery Score.

### Wijzigingen
- `src/core/ai-engine/recovery-engine.ts` — nieuwe optionele 4e
  parameter `performance: PerformanceVoorRecovery | null`, met de
  weging/correctie hierboven
- **Nieuw:** `haalPerformanceVoorRecovery()` in
  `health-analysis-engine.ts` — gedeelde helper, voorkomt duplicatie
  over de vier aanroeppunten
- **Alle vier aanroeppunten bijgewerkt:** `coach-policy.ts` (stuurt de
  Daily Adjustment Layer aan — de belangrijkste), `api/coach/route.ts`
  (dagadvies), `api/status/route.ts` (de zichtbare Coach Score op
  Home), `api/debug/recovery/route.ts` (het dashboard zelf)

**Gevalideerd vóór levering — twee lagen:**
1. `npx next build` — compileert zonder fouten of warnings
2. **Vier testcategorieën, allemaal geslaagd:**
   - Gedrag-behoudendheid: zónder Performance-data exact hetzelfde
     resultaat als vóór deze wijziging (4 testcases, ongewijzigd t.o.v.
     de eerdere validatie)
   - Training Readiness-weging: HRV(75) + Readiness(90, gewicht 0,5×)
     → gewogen gemiddelde 80, exact zoals berekend
   - ACWR-correctie: 1,2→geen, 1,4→−5, 1,6→−10, 1,8→−15, elke
     drempelwaarde apart getest en correct
   - Lage ACWR (0,5): terecht geen correctie

**Test-instructies:**
1. `/debug/recovery` op een dag met Performance-data → "Training
   Readiness (gewicht 0,5×)" moet in de breakdown-tabel staan
2. Bij een belastingsverhouding boven 1,3 → een aparte
   "Belastingsverhouding-risico"-regel met negatieve bijdrage
3. Coach Score op Home mag niet raar springen bij normale (ACWR ≤1,3)
   waarden — pas bij een hoge verhouding een merkbaar effect

## v2.4.147 — Definitieve fix: sleep_duration was een decimaal op een integer-kolom
**De v2.4.146-debug-zichtbaarheid werkte precies zoals bedoeld: de
gebruiker zag direct de exacte oorzaak. `health_metrics.sleep_duration`
is een INTEGER-kolom in de database, maar de code stuurde een
decimaal (`10.4`) — vandaar dat de UPDATE al die tijd stil (later:
zichtbaar) mislukte, terwijl rusthartslag/Body Battery/slaapscore in
dezelfde payload zaten en dus ook nooit aankwamen (één mislukte query,
alle velden in die query raakten niet opgeslagen).**

- `src/app/api/health/vision-import/route.ts` — `sleep_duration`
  berekening aangepast van `Math.round((minuten/60)*10)/10` (één
  decimaal) naar `Math.round(minuten/60)` (heel getal) — past nu bij
  de daadwerkelijke kolomtype
- **Tijdelijke debug-zichtbaarheid uit v2.4.146 weer verwijderd** —
  oorzaak gevonden en opgelost, geen reden meer om 'm te laten staan
  (route + `garmin-import/page.tsx` weer terug naar de schone versie,
  alleen `console.error`-logging blijft staan voor toekomstige gevallen)

**Gevalideerd vóór levering:**
- `npx next build` — compileert zonder fouten of warnings
- Fix los getest met de exacte waarde uit de foutmelding: 10u 26m
  (626 minuten) → oude berekening gaf 10,4 (brak op integer-kolom),
  nieuwe berekening geeft 10 (correct)

**Test-instructie:** upload nogmaals de Health-screenshot →
`/debug/recovery` → rusthartslag/Body Battery/slaapscore moeten nu
eindelijk wél in de breakdown-tabel staan, geen amber-waarschuwing
meer op het Garmin Import-scherm.

## v2.4.146 — TIJDELIJK: foutmelding zichtbaar maken in de app
**v2.4.145 loste het probleem niet op — rusthartslag/Body Battery/
slaapscore kwamen na een nieuwe upload nog steeds niet aan in
`health_metrics`. Ik heb geen toegang tot Vercel-functielogs vanuit
deze omgeving, dus kan de exacte databasefout niet zien. Deze levering
maakt die fout zichtbaar in de app zelf, zodat we 'm samen kunnen
lezen.**

- `src/app/api/health/vision-import/route.ts` — de `.error` van de
  UPDATE/INSERT-poging naar `health_metrics` wordt nu meegegeven in de
  API-response (`_health_metrics_debug`), inclusief Postgres-foutcode
- `src/app/settings/garmin-import/page.tsx` — toont deze foutmelding
  als amber-waarschuwing op het resultatenscherm, direct boven de
  "Opgeslagen"-bevestiging

**Dit is bewust tijdelijk** — zodra de echte oorzaak duidelijk is
(waarschijnlijk een ontbrekende/verkeerde constraint op
`health_metrics`, of iets anders dat nu eindelijk zichtbaar wordt),
wordt dit weer verwijderd en de onderliggende fout structureel
opgelost.

**Test-instructie:** upload nogmaals de Health-screenshot. Verschijnt
er een amber-waarschuwing? Stuur een screenshot van de exacte tekst —
dat geeft de Postgres-foutmelding + foutcode, waarmee ik de echte
oorzaak kan vinden in plaats van verder te gokken.

## v2.4.145 — Fix: rusthartslag/Body Battery/slaapscore kwamen nooit aan in health_metrics
**Gemeld, drie keer getest met screenshots: Garmin Import toonde steeds
"Opgeslagen ✓" (100% betrouwbaarheid), maar in `health_metrics` bleef
alleen `hrv` staan — rusthartslag/Body Battery/slaapscore ontbraken,
ondanks de v2.4.144-fix.**

### Root cause
`await supabase.from('health_metrics').upsert({...}, { onConflict: 'user_id,date' })`
werd nergens op `.error` gecontroleerd. Supabase-js **gooit geen
exception** bij een databasefout (bijv. een `onConflict`-kolomcombinatie
die niet bij een bestaande unieke sleutel past) — die fout komt terug
als een `{error}`-veld, dat mijn code negeerde. Resultaat: de opslag
kon stil mislukken terwijl de rest van de request (garmin_imports +
morning_health_metrics, die wél hun eigen kloppende constraint hebben)
gewoon slaagde — vandaar de misleidende groene bevestiging.

### Fix — robuust, ongeacht de exacte databaseoorzaak
- `src/app/api/health/vision-import/route.ts` +
  `src/app/api/hrv/route.ts` — **geen `upsert`-met-`onConflict` meer**
  voor `health_metrics`. In plaats daarvan expliciet: eerst ophalen
  (stond al in de code), dan **UPDATE op `id`** als er een rij bestaat,
  anders **INSERT**. Dit kan niet meer stil mislukken op een
  sleutel-mismatch, want er wordt geen conflict-resolutie meer aan de
  database overgelaten. Fouten worden nu ook expliciet gelogd
  (`console.error`) i.p.v. genegeerd.

**Waarom dit eerder niet opviel:** `morning_health_metrics` en
`performance_snapshots` zijn tabellen die ik zelf heb aangemaakt, mét
een correcte `unique(user_id, date)`-constraint vanaf het begin — daar
werkte `upsert`-met-`onConflict` dus wel gewoon. `health_metrics` is
een oudere, niet in dit project-SQL gedocumenteerde tabel — de aanname
dat die dezelfde constraint had, bleek onterecht (of de constraint mist
domweg).

**Gevalideerd vóór levering:** `npx next build` — compileert zonder
fouten of warnings. Kon dit keer niet los getest worden tegen een
database (geen directe Supabase-toegang vanuit deze omgeving) — vandaar
extra nadruk op de test-instructies hieronder.

**Test-instructies (belangrijk, graag echt narennen):**
1. Garmin Health-screenshot opnieuw uploaden
2. `/debug/recovery` openen → rusthartslag/Body Battery/slaapscore
   moeten nu wél in de breakdown-tabel staan
3. Mocht het nog steeds niet werken: kijk in de Vercel-functielogs naar
   `[vision-import] health_metrics UPDATE mislukt:` of `INSERT mislukt:`
   — die geven nu de exacte databasefout, waar ik eerder blind was

## v2.4.144 — CoachPolicy Niveau 1 (datastroom-fix) + Recovery Debug Dashboard
**Stap 3 van het vervolgplan, exact zoals afgesproken in de chat:
alleen de datastroom repareren, GEEN wijziging aan de bestaande
scoreformule. Plus het Recovery Debug Dashboard, op voorstel van de
gebruiker.**

### Bevinding: de foto-flow schreef helemaal niets naar `health_metrics`
Zelfs HRV niet — alleen de handmatige Check-in-invoer (`/api/hrv`)
deed dat. `calculateRecoveryScore()` kent rusthartslag/Body Battery/
slaapscore/slaapduur/HRV allemaal al als factoren, maar kreeg ze in de
praktijk zelden te zien als iemand alleen screenshots gebruikte.

- `src/app/api/health/vision-import/route.ts` — schrijft nu ALLE
  relevante velden (HRV, rusthartslag, Body Battery, slaapscore,
  slaapduur) door naar `health_metrics`, gemerged met een eventuele
  al-bestaande rij van vandaag (bijv. een eerdere handmatige HRV-
  invoer heeft voorrang boven Garmin's 7d-gemiddelde)
- `src/app/api/hrv/route.ts` — fix: schreef voorheen blind een nieuwe
  `health_metrics`-rij met alleen `hrv`, wat rusthartslag/Body Battery
  van een eerdere foto-upload die dag zou hebben gewist. Nu ook
  gemerged.
- `src/core/ai-engine/recovery-engine.ts` — **GEEN wijziging aan de
  score/status/color-berekening.** Uitsluitend een nieuwe, additieve
  `breakdown`-array toegevoegd aan de return-waarde (welke factor droeg
  hoeveel bij) — voor het Recovery Debug Dashboard hieronder.

### Recovery Debug Dashboard
- **Nieuw:** `src/app/debug/recovery/page.tsx` +
  `src/app/api/debug/recovery/route.ts` — toont een tabel met elke
  factor, de ruwe waarde en de bijdrage aan de score, plus de complete
  CoachPolicy-uitkomst eronder. Gebruikt dezelfde functies als de
  echte Coach-routes (`calculateRecoveryScore`/`genereerCoachPolicy`)
  — geen kans dat het dashboard iets anders toont dan de werkelijkheid.
- Link toegevoegd vanaf de bestaande `/debug`-pagina

**Gevalideerd vóór levering — twee lagen:**
1. `npx next build` — compileert zonder fouten of warnings
2. **Gedrag-behoudendheid bewezen:** oude en nieuwe `calculateRecoveryScore()`
   vergeleken over 5 testcases (volledige data, extreme lage waarden,
   alleen check-in, helemaal geen data, pijn gemeld) — score/status/
   color **allemaal exact identiek**, de breakdown is aantoonbaar puur
   additief

**Niveau 2 (nieuwe factoren zoals Training Readiness/belastingsverhouding
in de formule zelf) blijft bewust een aparte, latere stap** — dat
verandert wél het gedrag voor alle gebruikers en verdient eigen
validatie, zoals afgesproken.

**Test-instructies:**
1. Garmin-screenshot uploaden → `/debug/recovery` → controleer dat
   rusthartslag/Body Battery/slaapscore nu in de breakdown-tabel staan
2. Check-in met HRV invullen ná een screenshot diezelfde dag →
   controleer dat rusthartslag/Body Battery niet verdwenen zijn
3. Coach Score op Home moet zich normaal blijven gedragen (geen
   sprongen door deze update — de formule is ongewijzigd)

## v2.4.143 — Trends over tijd (stap 2 van het vervolgplan)
**Tweede stap van de afgesproken volgorde: HRV/Rusthartslag/Body
Battery/Slaapscore/Training Readiness/VO2max/Endurance Score als
grafiek over 30 dagen, op de Performance-pagina.**

- `src/app/api/performance-overview/route.ts` — 30-dagen-historie
  toegevoegd aan de response (los van de "vandaag"-data), twee losse
  queries (health + performance), geen nieuwe berekening — puur lezen
- `src/app/performance/page.tsx` — nieuwe `TrendGrafiek`-component:
  generieke, kleine SVG-lijngrafiek die op elke numerieke reeks werkt
  (zelfde visuele stijl als elders in de app), twee nieuwe kaarten
  ("Trends — Herstel" en "Trends — Belastbaarheid &amp; Conditie")

**Eerlijke leeg-staat:** minder dan 2 datapunten toont een duidelijke
melding ("nog te weinig data") in plaats van een lege of misleidende
grafiek. Ontbrekende dagen (null) worden uit de reeks gefilterd, niet
als 0 getekend.

**Gevalideerd vóór levering:**
- `npx next build` — compileert zonder fouten of warnings
- Grafiek-schaallogica los getest met een reeks die een null-waarde
  bevat — correct gefilterd, min/max en puntposities kloppen

**Vervolgens, zoals afgesproken:** stap 3, CoachPolicy uitbreiden met
Training Readiness/HRV-trend/Body Battery/Slaapscore — vergt apart
overleg, raakt de Daily Adjustment Layer.

## v2.4.142 — Performance-pagina (platformniveau, stap 1 van het vervolgplan)
**Eerste stap van de afgesproken volgorde: UI voor Performance Metrics.
Bewust NIET onder Cycling of Running — dit zijn geen sportgegevens, ze
horen bij de Master Coach. Specialisten en Trainer AI kijken naar
dezelfde bron, geen duplicatie.**

- **Nieuw:** `src/app/performance/page.tsx` — toont Herstel (HRV-trend,
  Garmin HRV 7d, Body Battery, rusthartslag, slaapscore, stress),
  Belastbaarheid (Training Readiness, belastingsverhouding) en Conditie
  (VO2max, Endurance Score, Hill Score), met kleurcodering (groen/amber/
  rood/neutraal) en een korte uitleg per metric
- **Nieuw:** `src/app/api/performance-overview/route.ts` — verzamelt
  HRV-trend (Health Analysis Engine) + `morning_health_metrics` +
  `performance_snapshots` van vandaag. **Andere naam dan het bestaande
  `/api/performance`** (dat is een ander concept — trainingsprogressie/
  rating-analyse — bewust niet overschreven, geen naamconflict)
- `src/app/home/page.tsx` — Performance-link toegevoegd, altijd
  zichtbaar (niet afhankelijk van de Garmin-import-status van vandaag)

**Belangrijk:** dit toont exact dezelfde data die Coach AI en beide
specialist-coaches al kregen (v2.4.140-141) — geen nieuwe berekening,
puur voor het eerst zichtbaar gemaakt voor de gebruiker zelf.

**Documentatie bijgewerkt:** README (nieuwe sectie) + hoe-werkt-het
(Garmin Import-sectie verwijst nu naar de Performance-pagina).

**Gevalideerd vóór levering:** `npx next build` — compileert zonder
fouten of warnings.

**Vervolgens, zoals afgesproken:** stap 2 (trends over tijd — HRV/
Training Readiness/VO2max/Endurance Score als grafiek), dan pas stap 3
(CoachPolicy uitbreiden — vergt apart overleg, raakt de Daily
Adjustment Layer).

## v2.4.141 — Morning Health-context ook naar de specialist-coaches
**Direct meegepakt zodat het niet vergeten wordt: Cycling Coach en
Running Coach krijgen nu dezelfde HRV-trend/Performance-context als de
Master Coach (v2.4.140) — daarvoor kregen alleen het algemene
dagadvies dit te zien, niet de specialisten.**

- `src/app/api/specialists/running/coach/route.ts` +
  `src/app/api/specialists/cycling/coach/route.ts` — nieuw
  `morningHealthContext`-blok, zelfde additief-patroon als het
  bestaande `memoryContext`/`doelenContext` in diezelfde bestanden
- **CoachPolicy blijft ongewijzigd** — `genereerCoachPolicy()` is al
  sport-onafhankelijk en wordt hier niet aangeraakt, dit is puur extra
  tekst in de prompt
- README bijgewerkt: Coach-integratie-regel vermeldt nu ook de
  specialist-coaches

**Gevalideerd vóór levering:** `npx next build` — compileert zonder
fouten of warnings.

**Test-instructies:**
1. Cycling Hub / Running Hub → advies opvragen op een dag met HRV-trend
   en/of Performance-data → context moet meegestuurd zijn
2. Zonder die data → specialist-advies moet nog gewoon normaal werken

## v2.4.140 — Coach-integratie Morning Health/Performance + documentatie bijgewerkt
**Maakt het Morning Health/Performance-blok af: de nieuwe data wordt nu
daadwerkelijk gebruikt in het dagelijkse Coach-advies, en README + de
in-app uitlegpagina zijn bijgewerkt. Vanaf nu standaard onderdeel van
elke feature-levering (vastgelegd als geheugen-regel), niet pas na een
apart verzoek.**

### Coach-integratie
- `src/app/api/coach/route.ts` — nieuw `morningHealthContext`-blok,
  **zelfde additief-patroon als de bestaande `garminContext`** (losse
  string die aan de system-prompt wordt geplakt). Bevat: HRV-trend
  (baseline-relatief, via de Health Analysis Engine) + Training
  Readiness, Trainingsstatus, Belastingsverhouding, VO2max uit
  `performance_snapshots` van vandaag.
- **CoachPolicy en `buildDailyCoachPrompt` blijven volledig
  ongewijzigd** — dit is extra input voor de AI, geen nieuwe
  beslissingslogica. Eigen try/catch — een probleem hier mag het
  dagadvies nooit laten falen.

### Documentatie bijgewerkt
- **README.md** — nieuwe sectie "💚 Morning Health &amp; Performance
  Repository" met de volledige architectuur (twee tabellen, Vision
  Engine, Health Analysis Engine, Coach-integratie), wat bewust nog
  niet gebouwd is (Apple Health/WHOOP/Polar-parsers)
- **`hoe-werkt-het/page.tsx`** — de Garmin Import-sectie beschreef nog
  het oude één-foto-met-bevestigstap-model; bijgewerkt naar de huidige
  twee-foto's-direct-opslaan-flow, inclusief het handmatige HRV-veld in
  de Check-in en de nieuwe Coach-integratie. Coach AI-sectie genoemd
  dat HRV-trend en Performance-cijfers nu ook meetellen.

**Geheugen-regel toegevoegd:** README.md en "Hoe werkt CoachOS" voortaan
altijd bijwerken bij een feature-update, standaard onderdeel van de
levering.

**Gevalideerd vóór levering:** `npx next build` — compileert zonder
fouten of warnings.

**Test-instructies:**
1. Een dag met HRV-trend en/of Performance-data → Coach-advies opvragen
   → controleer (evt. via logging) dat het context-blok is meegestuurd
2. Zonder HRV-trend/Performance-data → Coach-advies moet nog steeds
   normaal werken (geen lege/kapotte context)
3. Instellingen → Hoe werkt CoachOS → Garmin Import-sectie moet de
   nieuwe twee-foto-flow beschrijven

## v2.4.139 — Fix: "Garmin data importeren"-kaart verdween niet na upload
**Gemeld: na het invullen van beide screenshots bleef de reminder-kaart
op Home staan, alsof er niets geïmporteerd was.**

**Oorzaak:** Home checkt of er een `garmin_imports`-rij bestaat met
`status='confirmed'` om de kaart te verbergen (bestaande logica,
ongewijzigd). De nieuwe Vision Import-route (v2.4.137) slaat bewust
direct op zonder apart bevestigstapje, maar zette de status nog op
`'pending'`/`'flagged'` — nooit `'confirmed'`. Daardoor verdween de
kaart nooit.

- `src/app/api/health/vision-import/route.ts` — status altijd
  `'confirmed'` bij een geslaagde Health-import. `validation_flags`
  blijft gewoon apart opgeslagen voor wie afwijkende waarden wil
  nakijken — dat hoeft de reminder-kaart niet te blokkeren.

**Bevestigd gedrag na deze fix:** kaart verdwijnt zodra je vandaag een
Health-screenshot hebt geüpload, en verschijnt de volgende ochtend
automatisch weer (bestaande datumcheck op Home, ongewijzigd).

**Gevalideerd:** `npx next build` met schone cache — compileert zonder
fouten of warnings.

**Test-instructies:**
1. Garmin Import → Health-foto uploaden → Verwerken
2. Terug naar Home → kaart "Garmin data importeren" moet weg zijn

## v2.4.138 — Fix: Garmin Import scrolde niet + Focus lading niet zichtbaar
**Gemeld met screenshot: "kan niet opslaan" bleek een scroll-bug — de
body heeft app-breed `overflow-hidden` staan, en deze nieuwe pagina
(v2.4.137) miste de vereiste scrollbare wrapper. Met twee kaarten +
bevestiging + knoppen paste de inhoud niet meer op één scherm, dus de
"Opgeslagen"-melding en de knoppen waren onbereikbaar — het leek
alsof opslaan niet werkte, maar dat deed het waarschijnlijk wel.**

- `src/app/settings/garmin-import/page.tsx`:
  - `min-h-screen` → `h-screen overflow-y-auto scroll-area` op de
    buitenste wrapper — zelfde patroon als elders in de app
  - `safe-bottom` toegevoegd zodat de laatste knop niet achter de
    home-indicator verdwijnt
  - **Focus lading** was al geparsed en opgeslagen (`performance_snapshots`),
    maar stond niet in de resultatenlijst — toegevoegd (laag/gemiddeld/
    hoog)

**Test-instructies:**
1. Garmin Import → beide foto's → Verwerken → resultatenscherm moet nu
   scrollbaar zijn, "Opgeslagen"-melding en knoppen moeten bereikbaar zijn
2. Focus lading moet nu in de Performance-kaart staan

## v2.4.137 — Morning Health + Performance Repository, Vision Engine
**Vervangt het ontwerp van v2.4.136 (die niet gepusht was) volledig.
Grote, meerdelige levering na uitgebreid architectuuroverleg: geen
afgeleide waarden opslaan, generieke Vision Engine i.p.v. Garmin-
specifieke code, twee screenshots in één upload.**

**⚠️ ACTIE VEREIST VÓÓR DEPLOY — zie `supabase/morning_health_and_performance.sql`
voor de volledige SQL (twee tabellen + RLS-policies).**

### Architectuurkeuzes, zoals besproken
- **Geen baseline/trend/status-kolommen** — afgeleide waarden, berekend
  live door de nieuwe Health Analysis Engine
  (`src/lib/specialists/health-analysis-engine.ts`), nooit opgeslagen.
  Verandert de trend-regel ooit (bijv. 7→14 dagen), dan is er geen
  historische migratie nodig.
- **Generieke Vision Engine** (`src/lib/vision-engine/`) i.p.v.
  Garmin-specifieke code in de route zelf — `types.ts` (contract),
  `core.ts` (gedeelde comprimeer/AI-call/parse-logica), losse parsers
  per scherm. Nu twee parsers: `garmin-health-parser.ts` en
  `garmin-performance-parser.ts`. Apple Health/WHOOP/Polar-parsers
  bewust NIET gebouwd — geen screenshot-voorbeeld om tegen te testen,
  komt later bij een concrete aanleiding.
- **AI doet alleen OCR** — de prompts vragen uitsluitend om de kale
  cijfers, nooit om interpretatie. Die interpretatie zit in de Health
  Analysis Engine en straks de Coach, niet in de Vision-laag.
- **`source_type`/`import_method`** uitgebreid zoals gevraagd:
  garmin_connect/apple_health/manual/whoop/polar/fitbit/coros/suunto/
  future_api, resp. vision/api/manual/sync.
- **`performance_snapshots` alvast breed opgezet** — hill_score,
  recovery_time_hours, race_predictor zijn NULL-baar en aanwezig, ook al
  stonden ze niet op het aangeleverde screenshot. Voorkomt een latere
  tabelwijziging zodra een screenshot met die widgets beschikbaar komt.
- **CoachPolicy/recovery-engine.ts ongewijzigd** — nieuwe data is input,
  geen policy-wijziging.

### Twee foto's, één upload
- **Nieuw:** `src/app/api/health/vision-import/route.ts` — accepteert
  Health- en Performance-foto in één multipart POST, twee losse Vision-
  calls (niet één alles-in-één-prompt — hogere herkenningsbetrouwbaarheid
  per scherm)
- Health-foto blijft ALTIJD ook `garmin_imports` vullen (ongewijzigd,
  15+ bestaande lezers: Coach AI, Trends, Predictions, Status, Memory,
  Home, Insights, Training-flows) + nieuw naar `morning_health_metrics`
- Performance-foto is uitsluitend nieuw → `performance_snapshots`
- **Vereenvoudiging t.o.v. de oude garmin-vision-route:** geen apart
  "bevestig eerst"-stapje — direct opslaan na parsen
- `src/app/settings/garmin-import/page.tsx` — herschreven: twee foto-
  vakken, één "Verwerken"-knop. Oude route (`/api/health/garmin-vision`)
  blijft ongewijzigd bestaan, geen risico voor wat al werkte

### HRV-veld in de Check-in (herzien t.o.v. v2.4.136)
- `src/app/api/hrv/route.ts` — schrijft nu naar `morning_health_metrics`
  i.p.v. het vervangen `hrv_measurements`, merget met een eventueel
  al-bestaande rij van vandaag (bijv. al een Health-screenshot
  geüpload) i.p.v. blind te overschrijven
- `src/app/checkin/page.tsx` — HRV-veld met **expliciete
  "Overslaan"-knop** (op verzoek — was eerst impliciet leeg-laten)

**Bewuste beperking, benoemd in de code:** bij gemengde bronnen op
dezelfde dag (bijv. eerst handmatig HRV, later een Health-screenshot)
weerspiegelt `source_type` de laatste schrijfactie voor de hele rij,
niet per veld afzonderlijk — voor een eerste versie een aanvaardbare
vereenvoudiging.

**Gevalideerd vóór levering:**
- `npx next build` — compileert zonder fouten of warnings
- Health Analysis Engine-trendlogica los getest, inclusief correcte
  filtering van ontbrekende (null) metingen uit het gemiddelde

**Test-instructies:**
1. **Eerst de SQL uitvoeren**
2. Garmin Import → beide foto's kiezen → Verwerken → beide resultaten
   moeten verschijnen
3. Check-in → HRV invullen → Overslaan-knop test → "Toch invullen"
   moet het veld weer tonen
4. Bevestig dat `garmin_imports` nog steeds gevuld wordt (bestaande
   Coach AI-functionaliteit mag niet breken)

## v2.4.135 — HERSTEL: ontbrekende Training Plan Engine-bestanden
**Oorzaak van de "The string did not match the expected pattern"-fout
op het Running Trainingsplan-scherm: `src/app/api/specialists/running/
training-plan/route.ts` — het bestand dat de pagina als EERSTE aanroept
— bleek niet live te staan. Bij controle bleken meerdere bestanden uit
v2.4.132 (Training Plan Engine Core + Adapters) nooit gecommit te zijn.**

**Root cause (bij mezelf, niet bij de gebruiker):** in latere sessies
herstelde ik mijn werkstaat door de repo opnieuw te clonen + alleen de
láátst-geleverde zip terug te zetten. Als een eerdere levering (zoals
v2.4.132) op dat moment nog niet gecommit was door de gebruiker, ging
die cumulatief verloren — elke volgende levering bouwde zonder het te
weten voort op een onvolledige basis. Dit is nu volledig gereconstrueerd
en opnieuw gevalideerd.

### Ontbrekende bestanden hersteld
- `src/lib/specialists/training-plan-engine/core.ts`
- `src/lib/specialists/training-plan-engine/adjuster-core.ts`
- `src/lib/specialists/training-plan-engine/cycling-adapter.ts`
- `src/lib/specialists/training-plan-engine/running-adapter.ts`
- `src/app/api/specialists/running/training-plan/route.ts` (**de
  daadwerkelijke oorzaak van de fout in de screenshot** — ontbrak
  volledig, dus `/coach/running/trainingsplan` kreeg een 404 in plaats
  van JSON terug op zijn eerste fetch-aanroep)
- `supabase/training_plans_sport_kolom.sql`

### Extra gat gevonden en gedicht tijdens de controle
`src/app/api/specialists/cycling/training-plan/route.ts` miste ook nog
de `sport`-filter (was blijven staan op de oude, ongepatchte versie).
Toegevoegd aan zowel de GET-query als de "sluit bestaand plan af"-POST-
stap — zelfde fix als eerder al bij de Running-route en
`cycling-rit-analyse.ts` was doorgevoerd.

### Refactor nu écht afgerond
`training-plan-generator.ts` en `training-plan-adjuster.ts` stonden nog
als hun OUDE, zelfstandige versie (nog werkend, maar gebruikte de
nieuwe Core niet). Nu alsnog omgezet naar de dunne wrappers zoals
bedoeld — Cycling gebruikt vanaf nu ook daadwerkelijk dezelfde
Core+Adapter als Running, geen tweede parallelle implementatie meer.

**Gevalideerd vóór levering:**
- `npx next build` — compileert zonder fouten, alle vier training-plan-
  routes (cycling + running, elk met hun explain-variant) aanwezig in
  de build-output
- Gedrag-behoudendheid Cycling **opnieuw bevestigd** na de reconstructie:
  108 mesocyclus-combinaties + 28 sessieverdeling-combinaties, nog
  steeds allemaal byte-voor-byte identiek aan de oorspronkelijke
  implementatie

**⚠️ Controleer of je de SQL al eerder hebt uitgevoerd** (bij de
v2.4.132-melding) — het commando hieronder is veilig om opnieuw te
draaien (`IF NOT EXISTS`), dus twijfel je, voer 'm gerust nogmaals uit:

```sql
alter table training_plans add column if not exists sport text not null default 'cycling';

create index if not exists idx_training_plans_athlete_sport
  on training_plans(athlete_id, sport, status);

comment on column training_plans.sport is
  'Welke specialist dit plan beheert (cycling/running/...). Bestaande rijen krijgen automatisch cycling als default.';
```

**Test-instructies:**
1. **Eerst de SQL controleren/uitvoeren**
2. Running Hub → Trainingsplan → moet nu laden zonder foutmelding
   (leeg-staat met "Genereer je trainingsplan"-knop als er nog geen
   plan is)
3. Cycling: trainingsplan moet zich nog steeds identiek gedragen als
   vóór v2.4.132 — genereer een nieuw plan en vergelijk desgewenst met
   een eerder gegenereerd plan
4. **Belangrijkste check:** dit hele bestandenpakket in één keer
   committen en pushen, niet gedeeltelijk — dat voorkomt precies dit
   soort ontbrekend-bestand-problemen

## v2.4.134 — Running Trainingsplan UI (Fase 3, laatste stap) + documentatie bijgewerkt
**Laatste van de drie afgesproken fasen (Engine ✅ → Coach-uitleglaag ✅
→ UI ✅). Hiermee is het Running Adaptive Training Plan volledig
afgerond, op dezelfde Core+Adapter-architectuur als Cycling. Daarnaast,
op verzoek: README en de in-app "Hoe werkt CoachOS"-pagina bijgewerkt
zodat de documentatie de huidige staat weerspiegelt.**

### UI
- **Nieuw:** `src/app/coach/running/trainingsplan/page.tsx` —
  spiegelbeeld van `coach/cycling/trainingsplan` (v2.4.99): "Vandaag"
  prominent met AI-uitleg, komende trainingen met status-iconen,
  eerlijke uitleg dat verder dan de rolling horizon nog geen concrete
  dagen gepland zijn
- **Bewust géén Kalender-knop** (in tegenstelling tot de Cycling-versie)
  — die pagina bestaat nog niet voor Running, geen dode link naar iets
  dat niet werkt
- `src/app/coach/running/page.tsx` — Trainingsplan-link toegevoegd,
  direct na Performance Center, altijd zichtbaar

### Documentatie bijgewerkt
- **`README.md`**: Specialist Coach Platform-status bijgewerkt (Running
  Fase 1+2 afgerond, Training Plan Engine Core+Adapter-refactor
  vermeld), nieuwe "🏃 Actieve roadmap: Running Specialist v1.0"-sectie
  toegevoegd (spiegelt de bestaande Cycling-sectie), Openstaand-tabel
  bijgewerkt met het laatste resterende punt (Running Kalender)
- **`src/app/settings/hoe-werkt-het/page.tsx`**: de Specialisten-sectie
  zei nog letterlijk *"Op dit moment bestaat de Cycling Coach"* — dat
  klopte niet meer sinds v2.4.83 (Running) en zeker niet meer na
  vandaag's uitbreidingen. Bijgewerkt: noemt nu beide coaches, legt
  Performance Center en het adaptieve trainingsplan uit op
  sport-neutrale wijze (vermogen/Power Zones bij Cycling, tempo/Pace
  Zones bij Running)

**Gevalideerd vóór levering:** `npx next build` — compileert zonder
fouten of warnings, nieuwe route aanwezig in de build-output.

**Hiermee is de Running Specialist Roadmap Fase 1 + Fase 2 (grotendeels)
+ het volledige Adaptive Training Plan (Fase 1-3) afgerond.** Nog open:
Running Kalender, uitgebreide Grafieken-pagina, Wedstrijdplanning.

**Test-instructies:**
1. Running Hub → Trainingsplan-knop (primaire kleur, na Performance
   Center)
2. Zonder trainingsdagen ingesteld: nette foutmelding die naar Running
   Profile verwijst
3. Met trainingsdagen: "Genereer je trainingsplan"-knop → plan met
   Easy Run/Interval/Herstel/Tempo/Lange duurloop-sessies
4. Instellingen → Hoe werkt CoachOS → Specialisten-sectie noemt nu
   beide coaches

## v2.4.133 — Coach-uitleglaag (Running Fase 2) + derde sport-filter-gat gedicht
**Tweede stap van de drie afgesproken fasen (Engine ✅ → Coach-uitleglaag
✅ → UI). Spiegelbeeld van Cycling's v2.4.97.**

### Coach-uitleglaag
- **Nieuw:** `src/app/api/specialists/running/training-plan/explain/route.ts`
  — leest de sessie van vandaag + actuele CoachPolicy, AI zet dit om in
  een korte menselijke uitleg. **AI beslist niets** — type, duur en
  reden liggen al vast (Decision Contract, sectie 5), de AI vertaalt
  alleen naar natuurlijke taal.
- Leesbare Nederlandse labels voor de Running-sessietypen in de
  fallback-tekst (`easy_run` → "rustige duurloop", `lange_duurloop` →
  "lange duurloop", etc.) — de ruwe underscore-namen zijn niet
  gebruikersvriendelijk als er geen AI-respons komt.
- `REASON_CODE_UITLEG` **verplaatst naar de gedeelde Core**
  (`training-plan-engine/types.ts`) — beschrijft de beslissingsmechaniek
  (waarom een sessie is aangepast), niet iets sportspecifieks, dus geen
  reden voor duplicatie tussen de Cycling- en Running-uitleglaag.
  Cycling's route hergebruikt nu dezelfde constante.

### Derde sport-filter-gat gevonden en gedicht
Bij het doorzoeken van alle plekken die `training_plans` bevragen bleek
**`cycling-rit-analyse.ts`** ook zonder sport-filter te werken — een
fietsrit werd vergeleken met "de geplande sessie van vandaag" uit **elk**
actief plan van de gebruiker, ongeacht sport. Met een actief Running-
plan ernaast had dit een fietsrit tegen een hardloop-sessie kunnen
afzetten (bijv. "volgens schema"-check tegen een `interval`-hardloop-
sessie i.p.v. de bedoelde cycling-sessie). Sport-filter toegevoegd.

**Alle plekken die `training_plans` bevragen zijn nu gecontroleerd en
sport-gefilterd:** beide `training-plan/route.ts`, beide
`training-plan/explain/route.ts`, `training-plan-engine/core.ts` +
`adjuster-core.ts` (al plan-id-scoped, dus impliciet veilig), en nu ook
`cycling-rit-analyse.ts`.

**Gevalideerd vóór levering:** `npx next build` — compileert zonder
fouten of warnings, beide explain-routes aanwezig in de build-output.

**Rijtje resterend:** UI (Fase 3) — kalenderweergave, weekoverzicht,
Coach-uitleg prominent getoond, zelfde patroon als Cycling's
trainingsplan-scherm (v2.4.99).

## v2.4.132 — Training Plan Engine: Core + Adapter-architectuur (Fase 1/3)
**Grootste en meest risicovolle levering van vandaag: een REFACTOR van
de bestaande, live, werkende Cycling Adaptive Training Plan Engine —
niet zomaar een nieuwe feature. Op uitdrukkelijk verzoek: in plaats van
een tweede, bijna-identieke `running-training-plan-generator.ts` te
dupliceren, is de gedeelde logica nu een platformcomponent geworden.**

### Architectuur
```
src/lib/specialists/training-plan-engine/
├── types.ts            — TrainingPlanSportAdapter-contract
├── core.ts              — Plan Generator (periodisering, mesocycli, rolling horizon)
├── adjuster-core.ts     — Daily Adjustment Layer (5 triggers)
├── cycling-adapter.ts   — FTP-profiel, duurtraining/interval/herstel/lange_duurtraining
└── running-adapter.ts   — VDOT-profiel, easy_run/interval/herstel/tempo/lange_duurloop
```
**Ontwerpregel, letterlijk vastgelegd in de code-comments:** de Training
Plan Engine is een platformcomponent, geen Cycling-component. Alle
periodisering/mesocycli/deload/adaptieve-aanpassingen-logica hoort in
de Core; sportverschillen komen uitsluitend via een adapter.

### Bevinding die de aanpak vereenvoudigde
`training_plan_sessions.sport` bestond al, met de commentaar "voor
toekomstige multi-sport-plannen" — de tabellen waren dus al zo
ontworpen. **Eén gat gevonden en gedicht:** `training_plans` zelf had
GEEN sport-kolom, waardoor het aanmaken van een Running-plan een actief
Cycling-plan had kunnen afsluiten (en andersom) — de "sluit bestaand
actief plan af"-query filterde alleen op `athlete_id`+`status`. SQL
hieronder lost dit op.

### ⚠️ ACTIE VEREIST VÓÓR DEPLOY
```sql
alter table training_plans add column if not exists sport text not null default 'cycling';

create index if not exists idx_training_plans_athlete_sport
  on training_plans(athlete_id, sport, status);

comment on column training_plans.sport is
  'Welke specialist dit plan beheert (cycling/running/...). Bestaande rijen krijgen automatisch cycling als default.';
```
Bestaande Cycling-plannen krijgen automatisch `sport='cycling'` via de
DEFAULT — geen dataverlies, geen handmatige migratie nodig.

### Cycling: ONGEWIJZIGD gedrag, bewezen
`src/lib/specialists/training-plan-generator.ts` en
`training-plan-adjuster.ts` zijn nu dunne wrappers rond de Core met de
Cycling Adapter — **zelfde functienamen, zelfde signatuur**, dus
`api/specialists/cycling/training-plan/route.ts` hoefde alleen een
sport-filter te krijgen (zie hierboven), verder ongewijzigd.

**Vóór levering bewezen gedrag-behoudend:** de pure kernfuncties
(`bepaalMesocycli`, sessietype-verdeling) los getest, oude
implementatie tegen de daadwerkelijke nieuwe gecompileerde code, over
**108 mesocyclus-combinaties** (12 weekwaarden × 9 uurwaarden) **+ 28
sessieverdeling-combinaties** (7 dagaantallen × 4 mesocyclus-typen) —
elke combinatie gaf byte-voor-byte identieke JSON-output.

### Running: nieuw, bovenop dezelfde Core
- **Nieuw:** `src/app/api/specialists/running/training-plan/route.ts`
  — spiegelbeeld van de Cycling-route, gebruikt `runningAdapter`
- Sessietypen uit de Master Spec: Easy Run, Interval, Herstel, Tempo,
  Lange duurloop — zelfde verdeel-structuur als Cycling (aantal
  trainingsdagen → vaste volgorde), andere vocabulaire
- Profiel/analyse-databronnen: Running Profile
  (`specialist_type='running'`) + `analyseerRunning()` i.p.v. de
  Cycling-equivalenten

**Gevalideerd vóór levering:**
- `npx next build` — compileert zonder fouten of warnings
- Gedrag-behoudendheid Cycling: zie hierboven (108+28 combinaties)
- Beide nieuwe/aangepaste routes aanwezig in de build-output

**Nog niet in deze levering (Fase 2/3, zoals afgesproken):** Coach-
uitleglaag (waarom dit schema, waarom rust/interval) en de UI
(kalender, weekoverzicht, versleepbare trainingen) — die volgen apart,
zelfde volgorde als destijds bij Cycling.

**Test-instructies:**
1. **Eerst de SQL hierboven uitvoeren in Supabase**
2. Cycling: genereer een trainingsplan zoals altijd — moet zich exact
   hetzelfde gedragen als vóór deze update
3. Running: `POST /api/specialists/running/training-plan` — moet een
   plan aanmaken met Running-sessietypen (easy_run/interval/herstel/
   tempo/lange_duurloop)
4. Beide tegelijk: genereer eerst een Cycling-plan, dan een Running-
   plan — controleer dat het Cycling-plan `status='active'` blijft
   (niet per ongeluk afgesloten)

## v2.4.131 — Running Progressie (Fase 2, derde levering)
**Derde stap van "rijtje af": Progressie. Twee soorten trends, allebei
zonder nieuwe SQL.**

### Race-afstand-trends (5K/10K/Halve/Marathon)
**Bevinding:** `running_distance_records` (v2.4.128) bevat al élke
poging per activiteit, niet alleen het all-time record — een
chronologische trend kost dus geen nieuwe query-vorm, alleen een
andere manier van groeperen (per activiteit i.p.v. het minimum).

- **Nieuw:** `haalAfstandTrends()` in `running-grafieken.ts` — alle
  pogingen per afstand, chronologisch gesorteerd
- UI: alleen afstanden met 2+ pogingen getoond (anders geen trend te
  bepalen), trend-pijltje (sneller/gelijk/langzamer dan de vorige
  poging), zelfde `TrendIcoon`-patroon als de Cycling Hub

### Wekelijkse pace/hartslag/cadans-trend
- **Nieuw:** `haalWekelijkseRunningTrend()` — zelfde aggregatiepatroon
  als `haalWekelijkseVolumes()` (Cycling), nu voor snelheid/hartslag/
  cadans i.p.v. kilometers
- UI: staafdiagram laatste 12 weken, hogere balk = sneller gemiddeld
  tempo die week

**Bewust niet meegenomen:** Running Power-trend (alleen relevant met
sensor, te weinig gebruikers om nu te bouwen) en Herstel-trend (dat IS
al de TSB-lijn uit de Trainingsbelasting-kaart van v2.4.130 — geen
aparte sectie nodig voor dezelfde data).

- `src/app/api/specialists/running/dashboard/route.ts` —
  `afstand_trends` en `wekelijkse_trend` toegevoegd aan de response
- `src/app/coach/running/performance/page.tsx` — twee nieuwe kaarten,
  direct na Trainingsbelasting

**Gevalideerd vóór levering:**
- `npx next build` — compileert zonder fouten
- Wekelijkse aggregatielogica los getest met synthetische activiteiten
  (2 runs dezelfde week) → correct gemiddelde en pace-omrekening

**Rijtje resterend:** Adaptief Trainingsplan, Kalender, Grafieken.

## v2.4.130 — Running Trainingsbelasting (Fase 2, tweede levering)
**Tweede stap van "rijtje af": Trainingsbelasting. Zelfde publiek
gedocumenteerde Coggan-methode als Cycling (CTL 42-dagen/ATL 7-dagen
EWMA) — enige verschil is een snelheid-gebaseerde Intensity Factor
i.p.v. vermogen-gebaseerd. Geen nieuwe SQL.**

- **Nieuw in `running-grafieken.ts`:**
  - `berekenDrempelsnelheidKmh(vdot)` — drempelsnelheid afgeleid uit
    VDOT, midden van de al-bestaande Threshold Pace Zone-band (84-88%
    VO2max). Geverifieerd: bij VDOT 49,8 komt dit uit op 13,8 km/u,
    exact binnen de eerder (v2.4.126) geverifieerde Threshold-pace-
    range van 4:16-4:26/km.
  - `berekenGeschatteRunningTSS()` — `IF = gem_snelheid/drempelsnelheid`,
    `TSS = uren × IF² × 100`. Los getest: 60 minuten op precies
    drempeltempo geeft exact TSS 100 (de definiërende eigenschap van
    deze formule — bevestigt dat de implementatie klopt).
  - `haalRunningCTLATLTSB()` — spiegelbeeld van de Cycling-versie,
    zelfde 42/7-dagen-vensters. Geeft eerlijk een lege lijst terug als
    er geen VDOT is (geen gegokte drempelsnelheid).
- `src/app/api/specialists/running/dashboard/route.ts` —
  `belasting`-array toegevoegd aan de response
- `src/app/coach/running/performance/page.tsx` — Trainingsbelasting-
  kaart toegevoegd (lijndiagram CTL/ATL + Vorm-indicator (TSB), zelfde
  `LijnGrafiek`-component als het Cycling Grafieken-scherm)

**Eerlijke beperking, expliciet in de UI:** schatting op basis van
gemiddelde snelheid — minder nauwkeurig bij heuvelachtig terrein
(langzamer bergop zonder dat dit meer "belasting" betekent) of
intervaltraining (gemiddelde mist de pieken), zelfde soort beperking
als bij Cycling's TSS-schatting.

**Gevalideerd vóór levering:**
- `npx next build` — compileert zonder fouten
- Drempelsnelheid-formule getest tegen de al eerder geverifieerde VDOT-
  waarde (49,8 → 13,8 km/u, consistent met eerdere Threshold-zone-berekening)
- TSS-formule getest tegen de wiskundige referentie-eigenschap
  (1 uur op drempeltempo = TSS 100, per definitie)

**Rijtje resterend:** Progressie, Adaptief Trainingsplan, Kalender,
Grafieken.

## v2.4.129 — Running Performance Center (Fase 2, eerste levering)
**Eerste bouw-stap van Running Fase 2 (Professional). Zelfde aanpak als
Cycling's Power Center (v2.4.118): een nieuw analysecentrum dat
uitsluitend al-bestaande data samenvoegt — GEEN nieuwe SQL, GEEN
nieuwe berekeningen.**

- **Nieuw:** `src/app/coach/running/performance/page.tsx` — haalt in
  parallel op:
  - `/api/specialists/running/profile` → VDOT, Pace Zones, Hartslagzones
  - `/api/specialists/running/dashboard` → Dashboard-kengetallen + Records
- **Pace Curve is geen nieuwe data** — de Records-data (afstandscurve,
  v2.4.128) nu ook als grafiek getoond (staafdiagram, zelfde visuele
  taal als de Cycling-vermogenscurve), naast de bestaande lijstweergave.
  "Persoonlijke records" en "Pace Curve" uit de Master Spec zijn
  inhoudelijk dezelfde onderliggende data, twee weergaven ervan.
- Indeling: Overzicht (VDOT + gem. pace) → Pace Curve (grafiek) →
  Persoonlijke records (lijst) → Pace Zones → Hartslagzones → Cadans
  &amp; hoogte (hergebruikt uit het Dashboard)
- `src/app/coach/running/page.tsx` — Performance Center-link
  toegevoegd, **bewust vóór de AI-advies-sectie geplaatst** (niet
  verstopt achter een mogelijk-lege staat) — direct leerpunt van
  eerdere feedback dat een nieuwe functie meteen zichtbaar moet zijn

**Gevalideerd vóór levering:** `npx next build` — compileert zonder
fouten, nieuwe route aanwezig in de build-output.

**Ontwerp-principe, zelfde als bij Cycling:** dit is een fundament,
geen eindpunt — Trainingsbelasting, Progressie en andere Fase 2/3-
onderdelen krijgen later een eigen sectie hier, geen nieuwe
navigatie-ingang.

**Test-instructies:**
1. Running Hub → Performance Center-knop (geel, na de Records-kaart)
2. Zonder race-resultaat/data: lege staat met knop naar Running Profile
3. Met data: Pace Curve-grafiek toont dezelfde afstanden als de
   Records-kaart op de Hub, nu als staafdiagram

## v2.4.128 — Running Foundation deel 3 (laatste): Automatische Records
**Derde en laatste bouw-levering van Running Fase 1. Grootste stuk van
de drie — nieuw stuk wiskunde (afstand-gebaseerd i.p.v. tijd-gebaseerd),
plus een parser-uitbreiding en een nieuwe tabel.**

**⚠️ ACTIE VEREIST VÓÓR DEPLOY: voer eerst de SQL hieronder uit in
Supabase.** Zonder de tabel faalt het opslaan van records stil (eigen
try/catch, breekt de import zelf niet) — records blijven dan leeg.

```sql
create table if not exists running_distance_records (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activity_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  distance_m integer not null,
  tijd_sec integer not null,
  created_at timestamptz not null default now(),
  unique(activity_id, distance_m)
);

create index if not exists idx_running_distance_records_user_distance
  on running_distance_records(user_id, distance_m, tijd_sec asc);

comment on table running_distance_records is
  'Snelste tijd per doelafstand, per activiteit. Smal (activity x afstand -> tijd), geen ruwe tijdreeks. "All-time snelste 5km" = min(tijd_sec) where distance_m=5000 for user. Zie docs/running-specialist-roadmap-v1.md.';

alter table running_distance_records enable row level security;

drop policy if exists "Gebruiker kan eigen records lezen" on running_distance_records;
create policy "Gebruiker kan eigen records lezen"
  on running_distance_records for select using (auth.uid() = user_id);
-- Geen insert/update/delete-policy voor gewone gebruikers — wordt
-- uitsluitend server-side gevuld, zelfde patroon als cycling_power_curve.
```
Ook vastgelegd als los bestand: `supabase/running_distance_records.sql`
(zelfde conventie als `supabase/cycling_power_curve.sql`).

**Correctie t.o.v. de eerste versie van deze changelog-entry (gemeld
via Supabase's eigen SQL-editor-waarschuwing):** RLS ontbrak in de
oorspronkelijke SQL. Bij het corrigeren bleek `cycling_power_curve`
zelf al een preciezer patroon te hanteren dan mijn eerste RLS-poging
(alleen een SELECT-policy, want schrijven gebeurt uitsluitend
server-side via de admin-client die RLS toch al omzeilt — een bredere
insert/update-policy voor gewone gebruikers was overbodig). Nu
consistent gelijkgetrokken met dat bestaande patroon.

### Nieuwe wiskunde: afstandscurve (spiegelbeeld van de vermogenscurve)
Vermogenscurve zoekt "beste GEMIDDELDE over een vaste TIJD". Records-
per-afstand vergt het omgekeerde: "snelste TIJD over een vaste AFSTAND"
— vast en variabel zijn omgedraaid, dus een nieuw (maar verwant)
schuivend-venster-algoritme.

- **Nieuw:** `src/lib/afstandscurve.ts` — `berekenAfstandscurve()`,
  isomorf, O(n) two-pointer-sliding-window. Standaard-doelafstanden:
  100m t/m marathon (15 afstanden, Master Spec-lijst minus de dubbele
  "1 km"-rij). "Ultra" heeft geen vaste afstand, blijft "langste
  duurloop" op het Dashboard.
- `src/lib/tcx-parser.ts` — trackpoint-loop uitgebreid met
  `tp.DistanceMeters` + `tp.Time` (cumulatieve afstand sinds start,
  verplicht TCX-veld) → `afstandscurve` toegevoegd aan `TcxParsed`
- `src/app/api/health/garmin-activity-tcx/route.ts` — afstandscurve
  opslaan bij zowel nieuwe import als overschrijving, **bewust alleen
  voor `activityLabel === 'Hardlopen'`** (distance-records zijn een
  Running-specifiek concept, geen zin voor Fietsen)
- **Nieuw:** `haalRunningRecords()` in `running-grafieken.ts` — all-time
  snelste tijd per afstand, over alle activiteiten heen
- **Nieuw:** records toegevoegd aan `/api/specialists/running/dashboard`
- `src/app/coach/running/page.tsx` — Records-kaart, direct na Dashboard.
  **Alleen afstanden tonen waar data voor is** — geen lege rijen voor
  100m/200m/400m, die realistisch alleen verschijnen bij baan-precisie
  GPS of een footpod (expliciet zo benoemd in de UI, geen overclaiming)

**Gevalideerd vóór levering — drie lagen:**
1. `npx next build` — compileert zonder fouten
2. Het afstandscurve-algoritme los getest: constant tempo (5 m/s) gaf
   exact de verwachte tijden; een variabele inspanning (snel-dan-
   langzaam) vond correct het snelste venster
3. **Volledige integratietest**: de daadwerkelijke productie-
   `parseTcx()` (via `tsc` gecompileerd, geen losse kopie) gedraaid
   tegen een synthetisch TCX-bestand — 2400m bij constant 4 m/s gaf
   exact de juiste tijd per afstand (100m in 25s t/m 1609m in 403s),
   én liet correct 3km+ weg omdat de testrit daarvoor te kort was

**Hiermee is Running Fase 1 (Foundation) volledig afgerond:** Profile,
Pace Zones (Daniels VDOT), Hartslagzones, Dashboard, automatische
Records. Fase 2 (Professional — Pace Curve-weergave, Progress Center,
Trainingsbelasting, Adaptief Trainingsplan, Kalender, Grafieken) volgt
als aparte roadmap-stap.

**Test-instructies:**
1. **Eerst de SQL hierboven uitvoeren in Supabase**
2. Een hardloopactiviteit importeren (nieuw, na deze deploy)
3. Running Hub → Records-kaart moet verschijnen met tijden per afstand
   die daadwerkelijk in de rit voorkwamen
4. Kortere afstanden dan de rit zelf: geen record (bijv. bij een
   3km-rit geen 5km-record)
5. Dezelfde activiteit opnieuw importeren (overschrijven) → records
   moeten bijwerken, niet dupliceren (upsert-gedrag)

## v2.4.127 — Running Foundation deel 2: Dashboard
**Tweede bouw-levering van Running Fase 1. Puur aggregatie van
al-bestaande `activity_sessions`-data — geen nieuwe SQL, geen nieuwe
databron.**

**Geleerd van de vorige levering:** het Dashboard staat nu direct
zichtbaar op de Running Hub zelf, los van het AI-advies (dat kan leeg
zijn als er nog geen analyse gegenereerd is) — vorige keer was het
enige zichtbare een instellingen-icoontje, wat verwarrend bleek.

- **Nieuw:** `src/lib/specialists/running-grafieken.ts` —
  `haalRunningDashboard()`: week/maand/jaar-kilometers, trainingen deze
  week, gemiddelde pace/hartslag/cadans, hoogtemeters, trainingstijd,
  langste duurloop, snelste training
- **Nieuw:** `src/app/api/specialists/running/dashboard/route.ts`
- `src/app/coach/running/page.tsx` — Dashboard-kaart toegevoegd, direct
  onder de header (vóór het AI-advies), met een eigen leeg-staat-check
  (verschijnt pas als er daadwerkelijk data is)

**Eerlijke beperking, expliciet in code-comment vastgelegd:** "jaar"
en "totaal" zijn in Fase 1 dezelfde periode (jaar-tot-nu) — een
écht all-time totaal (over alle jaren heen) vergt een aparte,
ongefilterde query, bewust niet nu toegevoegd om geen verwarring
tussen twee bijna-gelijke getallen te veroorzaken.

**Gevalideerd vóór levering:**
- `npx next build` — compileert zonder fouten
- Aggregatielogica los getest met synthetische activiteiten
  (2 activiteiten deze week, 1 vorige maand) → week/maand/jaar-kilometers
  en trainingen-deze-week-telling allemaal correct

**Volgende, laatste stap van Running Fase 1:** automatische Records.
Vergt een NIEUW stuk logica — niet de tijd-gebaseerde vermogenscurve-
wiskunde hergebruikt, maar een afstand-gebaseerd algoritme (snelste
tijd over een vaste afstand i.p.v. beste gemiddelde over een vaste
tijd). Vergt ook een parser-uitbreiding: `tp.DistanceMeters` per
trackpoint wordt nu nog niet vastgelegd (alleen lap-totalen), nodig
voor een cumulatieve afstand-tijd-reeks.

## v2.4.126 — Running Foundation deel 1: Profile + Pace Zones + Hartslagzones
**Eerste bouw-levering van de Running Specialist Roadmap Fase 1. Drie
ontwerpbeslissingen vooraf vastgelegd (overleg 19 juli 2026): Daniels
VDOT voor Pace Zones, trainingsdagen apart van Cycling, records straks
volledig automatisch (aparte levering).**

**Bevinding vooraf: Goal Engine, Memory Engine en Coach Policy waren
al generiek** — `running/coach/route.ts` gebruikte al dezelfde
`learning-engine.ts`/`coach-policy.ts`/`goal-engine.ts` als Cycling,
gewoon met `specialist_type='running'`. Punten 6-8 van de oorspronkelijke
Fase 1-lijst (koppeling Goal/Memory/Master Coach) bleken dus al klaar —
geen nieuw werk nodig.

### Daniels VDOT — geverifieerd vóór implementatie
De VO2/%VO2max-formules (Daniels &amp; Gilbert, 1979, publiek
gepubliceerd — niet de propriëtaire commerciële VDOT-tabellen) zijn
vóór het bouwen extern geverifieerd tegen een onafhankelijke bron met
dezelfde worked example: 5K in 20:00 → VDOT 49,8, exacte match. Zone-
percentages (Easy 59-74%, Marathon ~84%, Threshold ~88%, Interval
~98%, Repetition >100%) komen uit meerdere onafhankelijke, elkaar
bevestigende bronnen.

- **Nieuw:** `src/lib/specialists/running-zones.ts` —
  `berekenVDOT(afstandM, tijdSec)`, `berekenPaceZones(vdot)`,
  `formatteerPace()`. Volledig deterministisch, geen AI.
- **Nieuw:** `src/app/api/specialists/running/profile/route.ts` —
  GET/PUT, spiegelbeeld van cycling/profile. Slaat geen los VDOT-getal
  op maar een recent race-resultaat (afstand + tijd + datum) — zo werkt
  de Daniels-methode ook echt (VDOT hoort uit een prestatie te komen,
  niet losstaand geschat)
- **Nieuw:** `src/app/settings/running-profile/page.tsx` —
  race-resultaat-invoer (voorkeuzeknoppen 5K/10K/Halve/Marathon + vrije
  tijd-invoer), max hartslag, sensoren (hartslagmeter/cadanssensor/
  hardloop-vermogensmeter), **eigen trainingsdagen/beschikbare uren**
  (bewust los van Cycling, zoals afgesproken), live VDOT + Pace Zones-
  preview (client-side, exact dezelfde functies als de server)
- **Hartslagzones: hergebruikt `berekenHartslagZones()` uit
  `cycling-zones.ts`** — geen dubbele implementatie, dat model was al
  sport-onafhankelijk
- `src/app/coach/running/page.tsx` — instellingen-icoon toegevoegd in
  de header, zelfde patroon als de Cycling Hub

**Gevalideerd vóór levering:**
- `npx next build` — compileert zonder fouten, nieuwe route en pagina
  beide aanwezig in de build-output
- VDOT-formule extern geverifieerd tegen een onafhankelijke bron (zie
  boven) vóórdat er code geschreven werd
- De daadwerkelijke productiecode (niet een losse test-kopie) los
  uitgevoerd: `berekenVDOT(5000, 1200)` → 49,8, bevestigt dat er geen
  overtypfout is geslopen bij het overzetten naar TypeScript

**Uitdrukkelijk nog niet in deze levering** (volgt apart): Dashboard,
automatische Records (nieuw afstand-gebaseerd curve-algoritme, andere
wiskunde dan de tijd-gebaseerde vermogenscurve), Pace Curve, Progress
Center, Grafieken, Trainingsplan, Kalender.

**Test-instructies:**
1. Running Hub → instellingen-icoon → Running Profile
2. Race-resultaat invullen (bijv. 5K in 20:00) → VDOT en Pace Zones
   moeten direct live verschijnen, zonder op te slaan
3. Opslaan → herladen → gegevens moeten behouden blijven
4. Max hartslag invullen → Hartslagzones moeten verschijnen
5. Trainingsdagen instellen → controleren dat dit **niet** de Cycling-
   trainingsdagen overschrijft (aparte specialist_profiles-rij)

## v2.4.125 — Running Specialist: Master Spec + Roadmap vastgelegd
**Puur documentatie, geen code. Voorbereiding op het bouwen van
Running naar het niveau van Cycling — "overleg voor bouwen", zoals
altijd bij grote features.**

- **Nieuw:** `docs/running-specialist-master-spec.md` — het volledige
  eindbeeld, door de gebruiker aangeleverd (Dashboard, Performance
  Center, Records, Pace Curve, Pace Zones, Trainingsbelasting,
  Progressie, Trainingsplan, Kalender, Wedstrijden, toekomstige Garmin
  API-uitbreidingen)
- **Nieuw:** `docs/running-specialist-roadmap-v1.md` — gefaseerde
  uitvoering (Fase 1 Foundation / Fase 2 Professional / Fase 3
  Intelligence), zelfde aanpak als de Cycling-roadmap: geen ene
  gigantische levering, kleine testbare stappen

**Bevindingen bij het opstellen van de roadmap — wat al bestaat vs.
wat nieuw is:**
- Data Layer + Analysis Engine + Hub-UI bestaan al sinds v2.4.83
- `tcx-parser.ts` verzamelt al: hartslag, cadans, Running Power
  (indien sensor aanwezig), snelheid, hoogte, afstand — voor Running-
  activiteiten net zo goed als voor Cycling
- **Herbruikbaar in plaats van te dupliceren:** `vermogenscurve.ts` se
  sliding-window-wiskunde werkt op elke `{tijdSec, waarde}`-reeks, dus
  rechtstreeks toepasbaar op snelheid voor een Pace Curve; Cycling's
  hartslagzones-berekening (`berekenHartslagZones()`) is al sport-
  onafhankelijk en direct herbruikbaar voor Running
- **Nog niet aanwezig, moet nieuw:** Running Profile (drempeltempo),
  Pace Zones-berekening, Records, Pace Curve, Progress Center,
  Grafieken, Trainingsplan, Kalender

**Openstaande ontwerpbeslissingen** (vastgelegd in de roadmap, bij
start van Fase 1 te beslissen): welk publiek pace-zone-model (Daniels
VDOT / Pfitzinger), of trainingsdagen/beschikbare uren gedeeld worden
tussen Cycling en Running of apart blijven, en welke recordsafstanden
automatisch worden opgeslagen vs. alleen getoond als data het toelaat.

**Vervolg:** Fase 1 (Running Foundation — Profile, Pace Zones,
Hartslagzones, Dashboard) bouwen zodra akkoord.

## v2.4.124 — Z4-zonenaam verkort (bleef wrappen ondanks v2.4.123)
**Gemeld met screenshot: Z4 wrapte nog steeds naar 2 regels, óók na
volledig sluiten/heropenen van de PWA. De v2.4.123-layoutfix
(`whitespace-nowrap`/`flex-shrink-0`) staat bevestigd correct in de
live code — het probleem zit dieper dan alleen CSS.**

- `src/lib/specialists/cycling-zones.ts` — Z4-naam verkort van
  `'Drempel (Lactate Threshold)'` naar `'Drempel'`. De Engelse
  toevoeging was inhoudelijk overbodig (Drempel dekt de betekenis al)
  en was precies de reden dat de regel te lang werd om op één regel te
  passen — dit is dus zowel een leesbaarheids- als een layoutfix.
- Geen andere zonenamen aangepast — Z7 ("Neuromusculair vermogen") is
  korter en past al op één regel, bevestigd in eerdere screenshots.

**Nog niet opgelost, apart aandachtspunt:** de gebruiker meldde dat de
v2.4.123-fix niet zichtbaar was ondanks een volledige app-herstart —
mogelijk hardnekkigere PWA/Safari-caching dan verwacht
(`skipWaiting: false` in `next.config.js`). Gevraagd om ter controle
de pagina één keer in gewone Safari (niet de PWA) te openen, om cache
en code-probleem uit elkaar te trekken. Als dat inderdaad caching
blijkt te zijn, is dat een apart vervolgpunt (bijv. `skipWaiting: true`
overwegen, met de bijbehorende trade-offs).

**Test-instructies:**
1. Power Center → Power Zones → Z4 moet nu "Z4 — Drempel" tonen,
   228–263 W op één regel
2. Settings → Cycling Profile → zelfde check

## v2.4.123 — Fix: Power Zones-weergave brak bij lange zonenamen
**Gemeld met screenshot: Z4 ("Drempel (Lactate Threshold)") wrapte naar
2 regels, waardoor ook de wattwaarde rechts ("228–263 W") uiteenviel in
"228–263" en "W" op aparte regels — lelijk en onduidelijk.**

- `src/app/coach/cycling/power/page.tsx` — Power Zones-rij: `items-center`
  → `items-start` (voorkomt scheve verticale uitlijning als de naam
  wrapt), zonenaam krijgt `flex-1 min-w-0` (mag nu netjes zelf wrappen),
  wattwaarde krijgt `whitespace-nowrap flex-shrink-0` (breekt nooit meer
  middenin, blijft altijd op één regel rechts uitgelijnd)
- `src/app/settings/cycling-profile/page.tsx` — zelfde fix toegepast op
  zowel Vermogenszones als Hartslagzones (identiek patroon, zelfde
  risico — proactief meegenomen al was dit niet expliciet gemeld)

**Test-instructies:**
1. Power Center → Power Zones-kaart → Z4 ("Drempel (Lactate
   Threshold)") — naam mag over 2 regels lopen, wattwaarde rechts moet
   altijd op één regel blijven staan
2. Settings → Cycling Profile — zelfde check voor zowel Vermogenszones
   als Hartslagzones

## v2.4.122 — Vermogenscurve uitgebreid naar 12 duurpunten
**10s, 3min en 45min toegevoegd aan de vermogenscurve — de volledige
klassieke power-curve-set. Kleine, geïsoleerde wijziging: alleen de
duur-lijst in de al-bestaande berekening, geen nieuwe SQL (geen
CHECK-constraint op `duration_sec`), geen nieuwe API-route.**

- `src/lib/vermogenscurve.ts` — `CURVE_DUREN` uitgebreid van 9 naar 12
  punten: `5, 10, 15, 30, 60, 180, 300, 600, 1200, 1800, 2700, 3600`
  (was: `5, 15, 30, 60, 300, 600, 1200, 1800, 3600`)
- `docs/vermogenscurve-datalaag-spec.md` — bijgewerkt als bron van
  waarheid (duur-lijst + SQL-commentaar)
- Geen wijziging nodig aan `labelVoorDuur()` op Power Center of het
  Grafieken-scherm — beide formatteren al correct voor 10s (< 60s-tak)
  en 45min (< 3600s-tak)

**⚠️ Bewuste beperking, zoals eerder afgesproken (v2.4.118-overleg):
GEEN terugwerkende kracht.** Activiteiten geïmporteerd vóór v2.4.122
krijgen deze drie nieuwe duurpunten niet — de ruwe seconde-voor-seconde
vermogensdata is na het parsen niet bewaard (bewuste keuze, zie spec),
dus niet met terugwerkende kracht herberekenbaar. Nieuwe Garmin-imports
vanaf nu krijgen wel alle 12 punten. Gevolg: gebruikers kunnen tijdelijk
een mix van 9- en 12-punten-curves zien totdat oudere activiteiten uit
de geschiedenis rollen of opnieuw geïmporteerd worden.

**Ook relevant voor Critical Power (v2.4.121):** het CP-model gebruikt
alleen punten tussen 2-30 minuten (120-1800s). Het nieuwe 45min-punt
(2700s) valt daarbuiten en wordt dus NIET meegenomen in de CP-
berekening — dat is bewust, het model is fysiologisch alleen geldig in
dat bereik. Het 3min-punt (180s) valt er wél binnen en kan de CP-fit
verbeteren zodra er nieuwe data mee binnenkomt.

**Gevalideerd vóór levering:**
- `npx next build` — compileert zonder fouten
- Rekenkern los getest met een synthetische 90-minuten-tijdreeks → alle
  12 duurpunten correct berekend, met de verwachte afname in vermogen
  bij langere duren
- Rand-test met een korte 4-minuten-rit → curve stopt terecht bij 3min,
  5min+ correct weggelaten (rit te kort)

**Test-instructies:**
1. Nieuwe Garmin-activiteit importeren (na deze deploy) → Power Center
   → Vermogenscurve moet 12 balken tonen (was 9), inclusief 10s, 3min
   en 45min (bij een rit lang genoeg voor 45min)
2. Bestaande, al-geïmporteerde activiteiten: curve blijft ongewijzigd
   op de oude 9 punten — dat is verwacht, geen bug
3. Critical Power-sectie: 45min-punt verschijnt niet in "gebruikte
   punten" (bewust, buiten het 2-30 min-bereik)

## v2.4.121 — Critical Power-model op Power Center
**Op verzoek gebouwd vooruitlopend op voldoende datapunten — testen
volgt later zodra er genoeg 5-20 minuten-inspanningen in de
vermogenscurve zitten. Puur een nieuwe berekening, geen nieuwe SQL,
geen nieuwe API-call.**

- **Nieuw:** `src/lib/specialists/cycling-critical-power.ts` —
  `berekenCriticalPower()`, klassiek 2-parameter Critical Power-model
  (Monod &amp; Scherrer, publiek gedocumenteerd): `P(t) = CP + W'/t`,
  via lineaire regressie op vermogen tegen 1/duur. Client-safe (geen
  Supabase-import), werkt op vermogenscurve-data die al op Power
  Center wordt opgehaald — geen nieuwe fetch nodig.
- Alleen punten in het fysiologisch geldige bereik **2-30 minuten**
  worden gebruikt (kortere inspanningen zitten te veel in anaerobe
  capaciteit, langere onderschatten CP door vermoeidheid)
- `src/app/coach/cycling/power/page.tsx` — nieuwe sectie "Critical
  Power" tussen Power Zones en Ontwikkeling: toont CP (watt) en W′
  (kJ), plus **expliciet hoeveel punten gebruikt zijn en welke**
- **Eerlijke betrouwbaarheidsindicatie, bewust ingebouwd:** bij minder
  dan 3 punten of een R² onder 0,9 verschijnt een duidelijke
  amber-melding — geen quasi-precies getal tonen dat meer zekerheid
  suggereert dan de data rechtvaardigt. Bij minder dan 2 punten in het
  geldige bereik: nette lege staat, geen berekening geforceerd.

**Gevalideerd vóór levering:**
- `npx next build` — compileert zonder fouten
- Rekenkern los getest met synthetische data (CP=250W, W'=20000J
  ingebouwd) → model gaf CP=250W, W′≈20057J, R²=1.0 terug — bevestigt
  dat de regressie correct is geïmplementeerd

**Test-instructies (later, zoals afgesproken):**
1. Met minder dan 2 punten in het 2-30 min-bereik: lege staat met
   uitleg, geen berekening
2. Met 2 punten: berekening verschijnt, amber-waarschuwing "minder dan
   3 punten"
3. Met 3+ punten en goede fit (R²≥0,9): geen waarschuwing, CP/W′ direct
   zichtbaar
4. Met 3+ punten maar slechte fit (bijv. een niet-maximale inspanning
   ertussen): amber-waarschuwing met R²-waarde

## v2.4.120 — Vercel Speed Insights toegevoegd
**Voorbereidend op het opstartsnelheid-onderzoek dat bewust is uitgesteld
in v2.4.119 ("geen gok-en-bouw, eerst meten"). Deze levering meet alleen
— lost nog niets op.**

- `package.json` — `@vercel/speed-insights` toegevoegd (^2.0.0)
- `src/app/layout.tsx` — `<SpeedInsights />`-component toegevoegd in de
  root layout, na `{children}` in de `<body>`

**Wat dit oplevert:** zodra dit live staat op Vercel, verzamelt Vercel
automatisch real-world performance-metrics (Core Web Vitals, laadtijden
per pagina) van echt gebruik — zichtbaar in het Vercel-dashboard onder
"Speed Insights". Geen dashboard-configuratie nodig; Vercel detecteert
de component automatisch na deploy.

**Vervolg:** zodra er een paar dagen echte data binnen is, kunnen we
gericht kijken of de eerdere hypothese klopt (meerdere parallelle
Supabase-auth-checks per scherm) of dat er iets anders speelt — dan pas
een fix bouwen, op basis van meting in plaats van aanname.

**Test-instructies:** n.v.t. voor functionaliteit — puur monitoring,
geen zichtbare wijziging in de app zelf. Bevestig na deploy in het
Vercel-dashboard dat Speed Insights data begint te verzamelen.

## v2.4.119 — Zoom hersteld + app-brede navigatie-modernisering
**Twee losstaande fixes op verzoek: pinch-to-zoom werkte nergens meer, en
navigatie "tussen schermen" voelde traag. Geen backend-wijzigingen.**

### 1. Zoom hersteld
`src/app/layout.tsx` — `maximumScale: 1` en `userScalable: false`
verwijderd uit de viewport-config. Deze blokkeerden pinch-to-zoom in de
hele app. Vermoedelijk ooit bedoeld om de iOS-auto-zoom-bug op
inputvelden te voorkomen — die bug is al apart gefixt via een globale
CSS font-size-fix (input font-size ≥16px), dus deze instelling was
overbodig geworden én kostte legitieme pinch-zoom (ook een
toegankelijkheidsprobleem).

### 2. Navigatie gemoderniseerd — router.push() → Link
**Root cause gevonden:** bijna alle interne navigatie gebruikte
`<button onClick={() => router.push(...)}>` in plaats van Next.js'
`<Link href="...">`. Dat verschil is groot: `<Link>` laat Next.js de
doelpagina vooraf laden (prefetch) zodra hij in beeld komt — een tik
voelt dan instant. `router.push()` op een kale button doet dat niet;
elke navigatie laadt pas op het moment van de tik.

**Aanpak:** elke navigatie-knop die ZUIVER navigeert (geen logica
ervoor) is omgezet naar `<Link>`. Knoppen die eerst een actie
uitvoeren — formulier opslaan, activiteit verwijderen, inloggen/
registreren, dan pas navigeren — zijn bewust ONGEWIJZIGD gebleven als
`router.push()`, want `<Link>` kan geen actie vóór de navigatie
uitvoeren.

**31 bestanden gewijzigd, ~46 navigatie-knoppen omgezet naar `<Link>`:**
- Alle Cycling Hub-schermen (Hub, Power Center, Progress Center,
  Grafieken, Kalender, Trainingsplan), Running Hub
- Home, Settings (incl. `Row`-component uitgebreid met een `href`-prop),
  Profiel, Goals, Injuries, Insights, Life Events
- Specialisten-overzicht (incl. 2 kaarten met een `key`-prop die het
  eerste geautomatiseerde patroon misten — apart afgehandeld)
- Archief (`startOefening`-tussenfunctie was overbodig geworden,
  vervangen door een directe `Link` met dynamische route)
- Settings-subpagina's (Garmin Import, Garmin Activity Import,
  Equipment, Hoe werkt CoachOS), Debug, Reset-password, Dagboek,
  Coach Call, Training (recovery: breathing/mobility/relaxation/walk),
  ActiviteitenSectie-component

**Bewust ongewijzigd (behouden als `router.push`)** — allemaal
side-effect-navigatie: login/register/onboarding (formulier→submit→
navigeer), activiteit verwijderen, profiel/equipment opslaan,
checkin, Coach Call-afronding, `home/page.tsx`'s dynamische
snelkoppeling (ruimt eerst scroll-state op), `training/page.tsx`'s
starttraining-knoppen (schrijven eerst naar localStorage), en de
`<Button>`-componentknoppen in reset-password (custom component,
geen kale `<button>`).

**Nog niet aangepakt — bewust:** de opstartsnelheid (app laadt traag
bij openen) is een ANDER probleem met een andere, nog onbevestigde
oorzaak (mogelijk meerdere parallelle Supabase-auth-checks per scherm).
Dat vergt eerst meting (Vercel Speed Insights/Lighthouse), geen
gok-en-bouw — apart vervolgpunt, geen onderdeel van deze levering.

**Validatie:** `npm install` + `npx next build` lokaal gedraaid vóór
levering — compileert zonder fouten of warnings, alle 49 pagina's,
inclusief TypeScript-typechecking en ESLint.

**Test-instructies:**
1. Pinch-to-zoom testen op een willekeurig scherm — moet weer werken
2. Navigeer via Cycling Hub → Power Center / Progress Center /
   Grafieken / Trainingsplan — moet merkbaar sneller aanvoelen
   (prefetch bij in-beeld-komen van de knop)
3. Formulieren nog steeds testen: inloggen, registreren, profiel
   opslaan, activiteit verwijderen — moeten nog steeds normaal werken
   (deze zijn bewust NIET aangepast)
4. Settings-pagina: alle rijen (Profiel, Doelen, Blessures, etc.)
   moeten nog steeds naar de juiste pagina navigeren

## v2.4.118 — Power Center (Fase 1, Cycling Specialist Roadmap)
**Nieuw analysecentrum dat FTP, vermogenscurve, persoonlijke records en
Power Zones samenvoegt tot één professioneel geheel — GEEN nieuwe SQL,
GEEN nieuwe API-routes, GEEN nieuwe berekeningen, GEEN wijzigingen aan
de parser. Puur samenvoeging van vier al-bestaande endpoints.**

- **Nieuw:** `src/app/coach/cycling/power/page.tsx` — haalt in parallel op:
  - `/api/specialists/cycling/grafieken` → vermogenscurve (9 duurpunten:
    5s/15s/30s/1min/5min/10min/20min/30min/60min) + overige records
    (afstand/hoogte/snelheid/grootste week)
  - `/api/specialists/cycling/profile` → FTP + Power Zones (Z1-Z7,
    Coggan-model)
  - `/api/specialists/cycling/ftp-geschiedenis` → FTP-trend over tijd
  - `/api/profile` → gewicht, voor W/kg (FTP ÷ gewicht)
- Indeling: Power-overzicht (FTP + W/kg) → Vermogenscurve (grafiek) →
  Persoonlijke records per duur (elk vermogenscurve-punt IS het
  all-time record voor die duur) → Overige records → Power Zones →
  Ontwikkeling (FTP-historie)
- `src/app/coach/cycling/page.tsx` — Power Center-knop toegevoegd,
  direct onder Progress Center

**⚠️ Bewust NIET in Fase 1 (voorkomt schijndata — alleen all-time-beste
per duur wordt bijgehouden, geen tijdreeks van records):**
- Records door de tijd, beste maand, beste seizoen
- Normalized Power (NP), Intensity Factor (IF), Variability Index (VI)
- TSS/CTL/ATL/TSB-integratie op deze pagina (staat al apart op
  Grafieken-scherm, geschat op gemiddeld vermogen)
- Extra duurpunten 10s/3min/45min (vergt parser-wijziging, geldt dan
  alleen voor nieuwe imports — zie `docs/vermogenscurve-datalaag-spec.md`)
- Klimanalyse, sprintanalyse

**Ontwerp-principe:** het Power Center is een fundament, geen eindpunt
— toekomstige vermogensanalyses (bovenstaande lijst) krijgen later een
extra sectie op déze pagina, niet een nieuwe navigatie-ingang.

**Test-instructies:**
1. Ga naar Cycling Hub → Power Center
2. Zonder FTP ingesteld: lege staat met knop naar Cycling Profile
3. Met FTP maar zonder gewicht: W/kg toont "gewicht ontbreekt"
4. Met FTP + gewicht: W/kg correct berekend
5. Vermogenscurve leeg (geen Garmin-import sinds v2.4.110): sectie
   verborgen, geen lege grafiek
6. FTP-historie met 1 punt: geen trend-pijltje, wel de melding dat een
   trend zichtbaar wordt bij een volgende meting
7. FTP-historie met 2+ punten: trend-pijltje (stijgend/dalend/stabiel)
   naast het FTP-getal in Power-overzicht

## v2.4.117 — Roadmap-document bijgewerkt: vermogenscurve Garmin-pad afgerond
**Puur documentatie. Bevinding: het document stond nog op "🔜 Uitbreiding
van de Garmin/Strava-import" alsof beide nog moesten gebeuren, terwijl
het Garmin-pad al sinds v2.4.115 volledig live staat.**

- Status-header bijgewerkt: Fase 3 vermogenscurve Garmin-pad ✅, Strava
  + overige uitbreidingen nog open
- Vermogenscurve-sectie herschreven: wat al werkt (berekening, opslag,
  UI-grafiek) vs. wat nog resteert (Strava-streams-integratie, duur-
  specifieke records in de Records-kaart, Critical Power-model)
- Samenvattende tabel: Fase 3 opgesplitst in losse, traceerbare rijen
  i.p.v. één "bewust nog niet gestart"-rij die niet meer klopte

**Test-instructies:** n.v.t. — documentatie-only.

## v2.4.115 — Vermogenscurve-datalaag: UI (afronding van Fase 3-punt)
**Laatste stap van de spec (`vermogenscurve-datalaag-spec.md`) — de
data wordt sinds v2.4.110 verzameld, nu ook zichtbaar.**

- `src/lib/specialists/cycling-grafieken.ts` — `haalVermogenscurve()`:
  all-time beste vermogen per duur, `max(watts)` per `duration_sec`
  over alle activiteiten heen. Puur een query, geen nieuwe berekening
- `src/app/api/specialists/cycling/grafieken/route.ts` —
  `vermogenscurve` toegevoegd aan de bestaande response
- `src/app/coach/cycling/grafieken/page.tsx` — nieuwe grafiek-kaart,
  vóór Records. Staafdiagram met pixel-hoogtes (niet CSS-percentages —
  zelfde patroon als de v2.4.104-fix), leesbare duur-labels
  (5s/15s/30s/1m/5m/10m/20m/30m/1u). **Expliciet vermeld in de UI:**
  geen terugwerkende kracht voor activiteiten van vóór v2.4.110

**Hiermee is het Fase 3-punt "vermogenscurve-datalaag" (spec → SQL →
Garmin-integratie → UI) volledig afgerond voor het Garmin-pad.**
Strava-integratie (zelfde onderliggende berekening, andere databron)
staat nog open als los vervolgpunt.

**Test-instructies:** zie bericht bij levering.

## v2.4.114 — Fix: Coach Call reageert niet meer (gevolg van v2.4.112)
**Gemeld: "kan niet meer reageren" bij Coach Call. Root cause: het
wissen van coach_call_items (v2.4.112) liet een Coach Call soms volledig
leeg achter — `call.coach_call_items.every()` op een lege lijst is
"vacuously true", dus de pagina toonde alleen een "Klaar"-knop zonder
enig item om op te reageren. Geen crash, wel een verwarrende lege staat.**

- `src/app/api/activities/[id]/route.ts` (DELETE) — legt vóór het
  wissen van `coach_call_items` de betrokken `coach_call_id`('s) vast;
  ná het wissen wordt gecheckt of een Coach Call daardoor leeg is
  geworden, en zo ja op `status: 'expired'` gezet — dezelfde status die
  elders al gebruikt wordt voor niet-meer-relevante Coach Calls
  (`coach-calls/route.ts`)
- `src/app/coach-call/page.tsx` — expliciete lege-staat toegevoegd
  (`heeftItems`-check), i.p.v. te vertrouwen op het "vacuous truth"-
  gedrag van `every()` op een lege lijst. Nette boodschap + knop terug
  naar Home, in plaats van een lege pagina

**Voor de al-bestaande, al-vastzittende Coach Call** (van vóór deze
fix) — eenmalige opschoon-SQL:
```sql
update coach_calls
set status = 'expired'
where status in ('pending', 'partial')
  and id not in (select distinct coach_call_id from coach_call_items);
```

**Test-instructies:** zie bericht bij levering.

## v2.4.113 — Fix: "Wissen mislukt" — tweede, gemiste foreign-key
**Gevonden bij test: v2.4.112 ruimde alleen `coach_call_items` op vóór
het wissen, maar dat bleek niet de (enige) blokkade.**

- `src/app/api/activities/[id]/route.ts` (DELETE)
  - **Tweede gekoppelde tabel gevonden:** `garmin_activity_imports.
    activity_session_id` verwijst ook naar `activity_sessions` (gezet
    bij een bevestigde import, zie `garmin-activity-tcx/route.ts`).
    Wordt nu losgekoppeld (`activity_session_id: null`) vóór het
    wissen — het import-record zelf blijft bestaan (historische
    waarde: wanneer/hoe geïmporteerd), alleen de verwijzing naar de
    nu-te-wissen activiteit verdwijnt
  - **Foutmelding nu specifiek** i.p.v. het generieke "Wissen mislukt"
    zonder reden — geeft voortaan de daadwerkelijke database-foutmelding
    terug, zodat een volgend probleem (als dat zich voordoet) meteen
    zichtbaar is zonder serverlogs nodig te hebben

**Test-instructies:** zie bericht bij levering.

## v2.4.112 — Fix: Garmin-import gebruikte altijd vandaag als datum + activiteiten wissen
**Gemeld: twee oude (historische) activiteiten geïmporteerd, maar
kwamen op de datum van vandaag te staan i.p.v. hun eigen datum.**

### Bug gevonden en gefixt
`src/app/api/health/garmin-activity-tcx/route.ts` — `activity_sessions.date`
werd altijd op `today` gezet, ongeacht de daadwerkelijke datum in het
TCX-bestand. `parsed.start_date` (het `<Id>`-element, ISO-tijdstip) werd
al gebruikt in `notes` voor duplicaat-detectie, maar nooit voor het
daadwerkelijke `date`-veld. **Nu:** de activiteitsdatum wordt afgeleid
uit het bestand zelf (`activiteitDatum`), `today` blijft alleen een
noodgreep als het bestand geen bruikbare datum bevat.

**Bewust ongewijzigd:** `coach_calls.date` blijft `today` — een
coach-evaluatie die vandaag wordt aangemaakt voor een net-geïmporteerde
historische rit hoort logischerwijs op vandaag te staan (dat is wanneer
de gebruiker gevraagd wordt 'm te evalueren), niet op de historische
datum.

### Activiteiten wissen — nieuw
Om de twee verkeerd-gedateerde imports (en toekomstige fouten) op te
kunnen ruimen zonder tussenkomst.
- `src/app/api/activities/[id]/route.ts` — nieuwe `DELETE`-methode.
  Bevestigt eerst ownership (`user_id`) vóór het wissen. Ruimt
  gekoppelde `coach_call_items` eerst op (voorkomt een mogelijke
  foreign-key-fout, ongeacht hoe die koppeling in het schema staat).
  `cycling_power_curve` wordt automatisch meegewist via de al-bestaande
  `on delete cascade`
- `src/app/activities/[id]/page.tsx` — wis-knop (prullenbak-icoon)
  naast de titel, met verplichte bevestigingsstap ("dit kan niet
  ongedaan worden gemaakt") vóór het definitief wissen

**Test-instructies:** zie bericht bij levering.

## v2.4.111 — Herziening: Activiteiten weer een eigen navigatietab
**Op verzoek teruggedraaid t.o.v. v2.4.93 — de balk is al horizontaal
scrollbaar, dus 6 tabs is geen probleem, en een eigen tab werkt
prettiger dan een sectie binnen Voortgang.**

- `src/components/layout/index.tsx` — Activiteiten terug in
  `navItems`, tussen Specialisten en Voortgang (nu 6 tabs)
- `src/app/progressie/page.tsx` — Activiteiten-sectie verwijderd
  (stond bovenaan sinds v2.4.93), ongebruikte import opgeruimd
- `src/app/activities/page.tsx` — terugknop verwijderd, is nu een
  primaire tab zoals de andere hoofdschermen (geen "terug", net als
  Home/Coach/Trainer/Specialisten/Voortgang)
- `src/app/activities/[id]/page.tsx` — terugknop weer naar
  `/activities` (was `/progressie` sinds de v2.4.94-fix)
- `src/app/settings/garmin-activity-import/page.tsx` — "Bekijk
  activiteiten"-knop na een import weer naar `/activities`
- `docs/navigation-architecture-v1.md` — herziening vastgelegd,
  document bijgewerkt naar 6 tabs

**Test-instructies:** zie bericht bij levering.

## v2.4.110 — Vermogenscurve-datalaag: Garmin-integratie ⚠️ RAAKT BESTAANDE IMPORT-CODE
**Stap 1-3 van de spec (`vermogenscurve-datalaag-spec.md`): berekening +
SQL + Garmin-integratie. Strava-integratie en UI volgen apart.**

**Aanvullende bevinding tijdens het bouwen:** het parsen gebeurt
**client-side** in de browser (isomorfe `tcx-parser.ts`) — de server
ontvangt alleen het al-samengevatte JSON-resultaat, nooit het ruwe
bestand. De berekening moest daarom in de parser zelf, niet in de
server-route. Daarnaast bleek er **geen tijdstempel per trackpoint**
geparsed te worden — toegevoegd (`tp.Time`, verplicht TCX-veld), zodat
de vermogenscurve een **tijd-gebaseerd** schuivend venster gebruikt in
plaats van een aanname dat elk punt exact 1 seconde is (TCX-devices
samplen niet altijd regelmatig).

- **Nieuw:** `src/lib/vermogenscurve.ts`
  - `berekenVermogenscurve()` — two-pointer schuivend venster over
    daadwerkelijke tijdstempels, standaard duren
    5s/15s/30s/1min/5min/10min/20min/30min/60min
  - Isomorf (geen server-only imports) — herbruikbaar voor de latere
    Strava-integratie
- **Nieuw:** `supabase/cycling_power_curve.sql` — smalle tabel
  (activity × duur → watt), exact zoals in de spec
- `src/lib/tcx-parser.ts`
  - `tp.Time` nu meegelezen per trackpoint
  - Vermogen-met-tijdstempel apart verzameld (`vermogenMetTijd`), naast
    de bestaande `wattsValues` (die blijft voor gemiddelde/max)
  - `TcxParsed`-type uitgebreid met `vermogenscurve`
- `src/app/api/health/garmin-activity-tcx/route.ts`
  - Vermogenscurve opgeslagen in **beide** paden: nieuwe activiteit
    (insert) én overschrijving van een bestaande (upsert, i.v.m. de
    unique-constraint bij een tweede upload van dezelfde rit)
  - Eigen try/catch op beide plekken — een probleem met de
    curve-opslag mag de import zelf nooit laten falen

**Bewust nog niet gedaan:** Strava-integratie (nieuwe streams-API-
aanroep), UI (vermogenscurve-grafiek, duur-specifieke records).

**Test-instructies:** zie bericht bij levering — dit raakt de bestaande
Garmin-importflow, extra zorgvuldig testen aanbevolen.

## v2.4.109 — Nieuw document: Vermogenscurve-datalaag (compacte spec)
**Status: TE TOETSEN. Fase 3-punt van de Cycling Specialist Roadmap.**

**Twee haalbaarheidsbevindingen die de scope kleiner maken dan
aangenomen in de roadmap:**
1. **Garmin:** `tcx-parser.ts` verzamelt al een chronologische
   seconde-voor-seconde `wattsValues`-array per trackpoint — berekent
   daar alleen gemiddelde/max uit en gooit de rest weg. **Geen nieuwe
   import-uitbreiding nodig**, alleen een aanvullende berekening
2. **Strava:** bestaande OAuth-scope (`activity:read_all`,
   `strava/auth/route.ts`) is al voldoende voor de streams-API. **Geen
   nieuwe autorisatie nodig** bij al-gekoppelde gebruikers

- **Nieuw:** `docs/vermogenscurve-datalaag-spec.md`
  - Gedeelde, deterministische berekening: schuivend venster over
    5s/15s/30s/1min/5min/10min/20min/30min/60min
  - **Opslag:** smalle `cycling_power_curve`-tabel (activity × duur →
    watt), niet breed — maakt "all-time beste 5 minuten" een simpele
    query, precies wat records en het toekomstige Critical Power-model
    nodig hebben. Geen ruwe tijdreeks opgeslagen, alleen de
    samengevatte beste-inspanningen
  - Integratiepunten: `tcx-parser.ts` (Garmin, kleinste wijziging) +
    nieuwe streams-aanroep in `strava-activity-processor.ts`
  - **Eerlijk benoemd wat dit niet oplost:** geen terugwerkende
    vermogenscurve voor al-gesynchroniseerde activiteiten, Critical
    Power-model zelf is een apart vervolgpunt
  - Bouwvolgorde: berekeningsfunctie → SQL → Garmin-integratie (laagste
    risico) → Strava-integratie → UI

**⚠️ Raakt bij implementatie bestaande, actieve import-code** (Garmin-
en Strava-sync) — vergt dezelfde zorgvuldigheid als elke andere
wijziging aan bestaande productiecode.

**Volgende stap, na goedkeuring:** implementatie, startend met de
Garmin-integratie (laagste risico, data al beschikbaar).

## v2.4.108 — Roadmap volledig bijgewerkt + FTP-geschiedenis toegevoegd
**Twee wijzigingssets samengevoegd in één levering: de eerder aangekondigde
roadmap-statusupdate (die nog niet gecommit bleek) én FTP-geschiedenis,
zodat er geen inconsistente tussentoestand ontstaat ongeacht commit-volgorde.**

### Roadmap-document bijgewerkt naar de daadwerkelijke, geteste status
`cycling-specialist-roadmap-v1.md` gaf tot nu toe overal "Niet gestart"
— dat klopte al sinds v2.4.91 niet meer.
- Status-header: "Fase 1-2 volledig afgerond (v2.4.91-107)"
- Elke sub-fase (2a t/m 2i) krijgt een status-markering + versienummer
- 2g/2h formeel bevestigd als afgerond via bestaande infrastructuur
  (Memory Engine, Goal Engine, CoachPolicy, SpecialistSummary)
- Samenvattend overzicht volledig herschreven

### FTP-geschiedenis — bewust vroeg toegevoegd
**Strategische keuze uit vervolgoverleg:** niet pas bouwen wanneer de
vermogenscurve-datalaag (Fase 3) er is, maar nu al — elke dag later is
historische data die nooit meer wordt ingehaald.

- **Nieuw:** `supabase/cycling_ftp_geschiedenis.sql` — één rij per keer
  dat FTP is opgeslagen, met datum
- `src/app/api/specialists/cycling/profile/route.ts` (PUT) — logt
  automatisch naar de geschiedenis zodra FTP onderdeel is van een update
  (niet bij elke opslag — alleen als FTP daadwerkelijk is meegestuurd).
  Eigen try/catch: falen van de logging blokkeert nooit de kernopslag
- **Nieuw:** `src/app/api/specialists/cycling/ftp-geschiedenis/route.ts`
  — GET, geeft de volledige geschiedenis terug
- `src/app/coach/cycling/progress/page.tsx` — toont nu een echte
  FTP-trend (eenvoudig staafdiagram) zodra er 2+ punten zijn. Bij 0-1
  punten: eerlijke tekst dat de geschiedenis wordt opgebouwd, geen lege
  belofte

### Fase 3 uitgebreid met een concreet, apart punt: vermogenscurve-datalaag
Vastgelegd, volgens het vervolgoverleg: dit is een **nieuwe datalaag**
(gedetailleerde Garmin/Strava-vermogensdata, nieuwe tabellen, een eigen
analyse-engine) — bewust **losgekoppeld** van de Adaptive Training
Engine, die blijft er volledig onafhankelijk van. Ontgrendelt bij
realisatie: vermogenscurve, beste 30/60/90/180 min, Critical Power,
W′-modellen.

**Test-instructies:** zie bericht bij levering.

## v2.4.107 — Cycling Specialist Roadmap Fase 2i: Progress Center
**"Het feitelijke hart van de Cycling Hub" — consolideert bestaande data
uit al-gebouwde bronnen tot één overzicht. Geen nieuwe berekeningen,
puur hergebruik.**

**⚠️ Eerlijk niet gebouwd:** FTP-ontwikkeling over tijd — er wordt alleen
een huidig FTP-getal opgeslagen, geen geschiedenis. Een grafiek zou dus
één punt tonen, geen trend. Dit vergt eerst FTP-historie bijhouden
(nieuwe kolom/tabel) — bewust niet nu toegevoegd om geen schijngrafiek
te tonen. Expliciet zichtbaar in de UI zelf.

- **Nieuw:** `src/app/coach/cycling/progress/page.tsx` — haalt in
  parallel op:
  - FTP + W/kg (FTP uit Cycling Profile ÷ gewicht uit `/api/profile`,
    dat laatste bestond al en werd hier alleen hergebruikt)
  - Doelvoortgang (`/api/specialists/cycling/doelvoortgang`, Fase 2c)
  - Records-samenvatting (`/api/specialists/cycling/grafieken`, Fase 2e)
  - Memory-inzichten — alleen `status: active`-items, max 3
  - Coach-samenvatting (laatst gegenereerde advies)
  - Nette leeg-staat als er nog helemaal geen data is
- `src/app/coach/cycling/page.tsx` — Progress Center-knop toegevoegd,
  **bovenaan** de snelkoppelingen (belangrijkste plek, consistent met
  "het hart van de Hub")

**Fase 2i hiermee afgerond.** Resterend van de oorspronkelijke Fase 2-
lijst: 2g (Coach-verdieping) en 2h (Master Coach-integratie) — beide
grotendeels al impliciet aanwezig (Memory/Goal Engine/CoachPolicy/
SpecialistSummary bestaan en werken al sinds eerdere fasen), eerder een
bevestigingsronde dan nieuwe bouw.

**Test-instructies:** zie bericht bij levering.

## v2.4.106 — Cycling Specialist Roadmap Fase 2f: Ritanalyse
**Zelfde patroon als de Coach-uitleglaag (Fase 2a): eerst volledig
deterministische analyse, dan pas AI die dat omzet in leesbare
feedback — AI beslist niets.**

**⚠️ Eerlijk gevlagde beperking:** "volgens schema"-vergelijking matcht
op **datum**, niet op een expliciete koppeling — `completed_activity_id`
(al aanwezig sinds v2.4.96) wordt nergens automatisch ingevuld. Bij
meerdere fietsritten op één dag kan dit dus de verkeerde geplande sessie
raken. Bekende, geaccepteerde beperking van deze eerste versie, expliciet
in code-comments vastgelegd.

- **Nieuw:** `src/lib/specialists/cycling-rit-analyse.ts` — deterministisch:
  - Vermogenszone (hergebruikt `berekenVermogensZones()` uit Fase 1)
  - Hartslagzone (hergebruikt `berekenHartslagZones()`)
  - Cadans-beoordeling (gangbare, publieke richtlijn: <70 laag, 70-95
    normaal, >95 hoog)
  - "Volgens schema": duur binnen 20% van het geplande — een ruwe
    indicatie, geen exacte match-eis
- **Nieuw:** `src/app/api/specialists/cycling/rit-analyse/route.ts` —
  AI ontvangt de al-vastgestelde feiten, produceert alleen de
  natuurlijke-taal-evaluatie
- `src/app/activities/[id]/page.tsx` — nieuwe sectie, **alleen zichtbaar
  bij fietsritten** (`activities.name` in de bekende Cycling-namen) —
  "Laat je Cycling Coach deze rit analyseren"-knop, toont de evaluatie
  na een tik

**Fase 2f hiermee afgerond.** Volgende, per de roadmap: Fase 2g
(Coach-verdieping) of Fase 2h (Master Coach-integratie, bevestiging/
verdieping van het bestaande contract).

**Test-instructies:** zie bericht bij levering.

## v2.4.105 — Cycling Specialist Roadmap Fase 2e: Records
**Bewust GEEN los "Records Center" — onderdeel van het bestaande
Grafieken-scherm, precies zoals de roadmap voorschrijft.**

**⚠️ Eerlijke beperking, vooraf:** "beste inspanning per duur"
(5s/30s/1min/5min/20min/60min) vergt een vermogenscurve uit seconde-
voor-seconde data — die wordt niet opgeslagen (zelfde beperking als NP
voor TSS, zie v2.4.103). Gebouwd is uitsluitend wat eerlijk berekenbaar
is uit wat per rit al is opgeslagen.

- `src/lib/specialists/cycling-grafieken.ts` — `haalRecords()`:
  - Langste rit (km + apart: langste tijd in minuten)
  - Meeste hoogtemeters
  - Hoogste vermogen (max_watts — dit IS beschikbaar per rit, ook zonder
    NP-curve)
  - Hoogste gemiddelde snelheid
  - Grootste week — hergebruikt de al-bestaande wekelijkse-volumes-
    berekening, geen nieuwe query
- `src/app/api/specialists/cycling/grafieken/route.ts` — `records`
  toegevoegd aan de bestaande response
- `src/app/coach/cycling/grafieken/page.tsx` — nieuwe Records-kaart,
  tussen Trainingsbelasting en de FTP-ontbreekt-melding. Toont alleen
  records waarvoor daadwerkelijk data bestaat (geen lege/kapotte
  velden), met de beperking zichtbaar in de kaart zelf

**Fase 2e hiermee afgerond.** Volgende, per de roadmap: Fase 2f
(Ritanalyse) of Fase 2g (Coach-verdieping).

**Test-instructies:** zie bericht bij levering.

## v2.4.104 — Fix: staafdiagram wekelijks volume onzichtbaar
**Gevonden bij test: week-labels toonden correct (bevestigt dat de data
er wel was), maar de staafjes zelf waren onzichtbaar — een CSS-bug, geen
data-bug. CTL/ATL-grafiek (SVG, geen percentage-hoogtes) werkte al wel
correct, wat de root cause bevestigde.**

- `src/app/coach/cycling/grafieken/page.tsx` — staafhoogtes worden nu in
  **pixels** berekend (`Math.round((v.totaal_km / maxKm) * 128)`) i.p.v.
  CSS-percentages. Root cause: percentage-hoogte in een geneste flex-
  kolom-container resolveert niet betrouwbaar zonder een expliciete
  hoogte op de directe ouder — die ontbrak

**Geen wijziging aan de databerekening zelf** (`cycling-grafieken.ts`
blijft ongewijzigd) — dit was zuiver een weergaveprobleem.

**Test-instructies:** zie bericht bij levering.

## v2.4.103 — Cycling Specialist Roadmap Fase 2d: Grafieken
**Wekelijks volume + CTL/ATL/TSB (Coggan-methode). Geen nieuwe npm-
dependency — CSS-staafdiagram + native SVG-lijndiagram.**

**⚠️ Belangrijke, eerlijk gedocumenteerde beperking:** TSS vereist
normaliter Normalized Power (NP), berekend uit een seconde-voor-seconde
vermogensreeks — die wordt niet opgeslagen (alleen avg_watts/max_watts
per rit). Wat hier berekend wordt is een **schatting** op basis van
gemiddeld vermogen (`IF ≈ avg_watts/FTP`, `TSS_geschat = uren × IF² ×
100`) — nauwkeurig bij gelijkmatige ritten, minder bij intervaltraining.
Dit wordt overal expliciet "geschat" genoemd, nooit als exacte TSS
gepresenteerd — zowel in code-comments, de API-respons
(`tss_is_schatting: true`), als een zichtbare waarschuwing in de UI.

- **Nieuw:** `src/lib/specialists/cycling-grafieken.ts`
  - `berekenGeschatteTSS()` — de schattingsformule hierboven
  - `haalWekelijkseVolumes()` — km/minuten/gem. vermogen per week
  - `haalCTLATLTSB()` — publiek gedocumenteerde EWMA-formules (CTL:
    42-dagen-venster, ATL: 7-dagen-venster, TSB: CTL-ATL), **geen FTP
    ingesteld → eerlijk lege array, geen gegokte waarden**
  - Historie wordt 42 dagen ruimer opgehaald dan gevraagd, zodat CTL al
    "ingegroeid" is vóór de weergegeven periode
- **Nieuw:** `src/app/api/specialists/cycling/grafieken/route.ts`
- **Nieuw:** `src/app/coach/cycling/grafieken/page.tsx`
  - Staafdiagram wekelijks volume (CSS, geen dependency)
  - Lijndiagram CTL (fitness, blauw) + ATL (vermoeidheid, amber) — eigen
    lichte SVG-component, geen chart-library nodig
  - "Vorm" (TSB) prominent getoond, kleur-gecodeerd
  - Nette leeg-staat + doorverwijzing naar Cycling Profile als er geen
    FTP is ingesteld
- `src/app/coach/cycling/page.tsx` — link naar Grafieken toegevoegd

**Fase 2d hiermee afgerond.** Volgende, per de roadmap: Fase 2e
(Records) of Fase 2f (Ritanalyse).

**Test-instructies:** zie bericht bij levering.

## v2.4.102 — Cycling Specialist Roadmap Fase 2c: Dashboard
**Voegt de twee dingen toe die de roadmap noemt en die nog ontbraken op
de Cycling Hub: "volgende training" en "doelvoortgang". De bestaande
statistieken (vermogen/afstand/belasting) bestonden al sinds v2.4.68.**

- **Nieuw:** `src/app/api/specialists/cycling/doelvoortgang/route.ts` —
  dunne laag over de al-bestaande Goal Engine, geen nieuwe berekening.
  Geeft het leidende (hoogste `importance`) specialist-scoped
  Cycling-doel terug
- `src/app/coach/cycling/page.tsx` — nieuwe "Vandaag"-sectie, bovenaan
  vóór de AI-samenvatting:
  - **Vandaag-kaart:** haalt de sessie van vandaag op uit de al-bestaande
    training-plan-API, tikken gaat naar het Trainingsplan-scherm
  - **Doel-kaart:** toont het leidende doel + dagen tot deadline, tikken
    gaat naar de bestaande doelen-UI
  - Beide zijn verrijkingen — falen hiervan blokkeert de rest van de Hub
    nooit (eigen try/catch, stille fallback)
  - Gebruikt de gedeelde, tijdzone-veilige `isoDatum()` (v2.4.101) voor
    de vandaag-vergelijking — geen nieuwe datum-bug geïntroduceerd

**Fase 2c hiermee afgerond.** Volgende, per de roadmap: Fase 2d
(Grafieken, incl. CTL/ATL/TSB via de Coggan-methode).

**Test-instructies:** zie bericht bij levering.

## v2.4.101 — Fix: tijdzone-bug in alle datum-berekeningen van de Training Plan Engine ⚠️ BESTAAND PLAN HEEFT MOGELIJK VERKEERDE DATUMS
**Gevonden bij test: de Trainingskalender toonde "zaterdag 18 juli" bij
een geselecteerde dag 19. Root cause: `d.toISOString().split('T')[0]`
converteert naar UTC — voor gebruikers in een tijdzone vóór op UTC
(Nederland, UTC+2 in de zomer) verschuift dit lokale-middernacht-datums
een dag terug. Zat op 8 plekken in 5 bestanden, niet alleen de kalender.**

- **Nieuw:** `isoDatum()` in `src/utils/index.ts` — bouwt de YYYY-MM-DD-
  string uit lokale datumcomponenten (`getFullYear`/`getMonth`/
  `getDate`), nooit een UTC-conversie. Geen tijdzone-afhankelijke
  verschuiving meer, ongeacht waar de gebruiker zich bevindt
- **Alle 8 voorkomens vervangen**, in 5 bestanden:
  - `src/lib/specialists/training-plan-generator.ts` (3x — `start_date`,
    `end_date`, en elke sessie-datum)
  - `src/lib/specialists/training-plan-adjuster.ts` (1x — "vandaag" voor
    de Daily Adjustment Layer-triggers)
  - `src/app/coach/cycling/trainingsplan/page.tsx` (3x)
  - `src/app/coach/cycling/kalender/page.tsx` (1x — de lokale, foute
    functie is verwijderd, importeert nu de gedeelde, correcte versie)
  - `src/app/api/specialists/cycling/training-plan/explain/route.ts`
    (1x)

**⚠️ BELANGRIJK — het al gegenereerde trainingsplan in de database is
met de foute functie berekend, dus de opgeslagen datums kunnen één dag
verschoven zijn t.o.v. wat bedoeld was.** Aanbevolen: genereer het plan
opnieuw (POST /api/specialists/cycling/training-plan) ná het uitrollen
van deze fix, zodat alle datums vanaf nu correct berekend worden. Het
oude plan wordt daarbij automatisch op `abandoned` gezet (bestaand
gedrag, geen dataverlies, alleen niet meer actief).

**Geen SQL nodig voor deze fix** — puur een rekenfout in de applicatie-
laag, geen schemawijziging.

## v2.4.100 — Cycling Specialist Roadmap Fase 2b: Trainingskalender
**Maandweergave van het adaptieve trainingsplan. Hergebruikt dezelfde
GET /api/specialists/cycling/training-plan als het planningsscherm —
geen nieuwe API, andere weergave van dezelfde data.**

- **Nieuw:** `src/app/coach/cycling/kalender/page.tsx`
  - Maandgrid, weken beginnen op maandag, kleur-gecodeerd per
    trainingstype (duurtraining/interval/herstel/tempo/lange
    duurtraining)
  - Status zichtbaar via transparantie: afgerond (vol), gepland
    (gedempt), overgeslagen (zeer licht)
  - Tik op een dag → detail-kaart met type/duur/status/aanpassingsreden
  - Maand-navigatie (vorige/volgende)
  - **Bewust eerlijk over de rolling horizon:** dagen buiten de komende
    1-2 weken tonen gewoon leeg, met de tekst *"Nog geen concrete
    training gepland — dit volgt zodra deze week dichterbij komt"* —
    geen nepdata, geen suggestie van een volledig ingevulde maand
- `src/app/coach/cycling/trainingsplan/page.tsx` — knop naar de
  kalender toegevoegd, naast de bestaande Ververs-knop

**Fase 2b hiermee afgerond.** Volgende, per de roadmap: Fase 2c
(Dashboard) of Fase 2d (Grafieken) — beide bouwen voort op dezelfde,
al-bestaande data.

**Test-instructies:** zie bericht bij levering.

## v2.4.99 — Adaptive Training Plan Engine, sub-stap 3/3: UI
**Laatste sub-stap van Fase 2a — het planningsscherm. Toont wat de Plan
Generator + Daily Adjustment Layer (deterministisch) bepaalden, met de
Coach-uitleglaag-tekst voor vandaag prominent.**

- **Nieuw:** `src/app/coach/cycling/trainingsplan/page.tsx`
  - **Vandaag**, prominent bovenaan: type, duur, en de AI-uitleg (haalt
    automatisch `/training-plan/explain` op) — inclusief een badge als
    de sessie is aangepast (reason code vertaald naar leesbare tekst,
    bijv. "Aangepast — laag herstel")
  - **Komende trainingen**: rolling-horizon-sessies, met status-iconen
    (afgerond/overgeslagen/aangepast)
  - Expliciete uitleg in de UI zelf: *"Verder dan [datum] plant de coach
    nog geen concrete dagen — dat volgt automatisch zodra die week
    dichterbij komt"* — geen valse indruk van een volledig ingevuld
    lange-termijn-schema
  - Leeg-staat met een "Genereer je trainingsplan"-knop als er nog geen
    plan bestaat
- `src/app/coach/cycling/page.tsx` — prominente knop naar het nieuwe
  Trainingsplan-scherm toegevoegd, tussen de statistieken-grid en de
  tekstuele advies-kaarten

**Fase 2a (Adaptive Training Plan Engine) hiermee volledig afgerond:**
spec ✅, Decision Contract ✅, Engine zonder AI ✅, Coach-uitleglaag ✅, UI ✅.

**Volgende stap volgens de roadmap:** Fase 2b (Trainingskalender) — een
bredere, sport-overstijgende kalenderweergave, of verdere verdieping
binnen Fase 2 (bijv. Fase 2c Dashboard, Fase 2d Grafieken).

**Test-instructies:** zie bericht bij levering.

## v2.4.98 — Fix: prompttoon Coach-uitleglaag ("stiekem"-woordkeuze)
**Gevonden bij test: de instructie "dit was eerder onzichtbaar, dat mag
niet meer" duwde de AI naar dramatische taal ("ik heb de sessie stiekem
al teruggebracht... dat is iets wat je verdiend recht hebt om te
weten"). Geen architectuurprobleem — de data-doorstroming werkte
correct — puur een promptkwaliteitsfix.**

- `src/app/api/specialists/cycling/training-plan/explain/route.ts` —
  instructie herschreven naar neutraal/feitelijk: *"noem dit gewoon als
  een normale, verstandige coachbeslissing... geen dramatische taal,
  geen suggestie dat dit een geheim was"*

**⚠️ Cache-kanttekening voor het testen:** de sessie van vandaag heeft
al een gecachte (foute) uitleg staan van de vorige test —
`explained_at >= updated_at` zorgt dat die zonder ingrijpen opnieuw
teruggegeven wordt. Zie test-instructies bij levering voor de SQL om
dit te wissen.

## v2.4.97 — Adaptive Training Plan Engine, Fase 2: Coach-uitleglaag
**Bron: Decision Contract sectie 5. AI ontvangt decision + reason code +
context, produceert de menselijke uitleg, beslist NIETS.**

**Directe verbetering op de test-bevinding bij Fase 1:** de stille
volume-reductie (CoachPolicy `volumeAdjustmentPct`, die al werd toegepast
maar niet werd uitgelegd) wordt nu **expliciet** als context aan de AI
meegegeven — het verschil tussen `load_target` (baseline-uren) en
`duration` (na-aanpassing-minuten) wordt berekend en, indien relevant,
verplicht benoemd in de uitleg.

- **Nieuw:** `supabase/training_plan_uitleg.sql` — `explanation` +
  `explained_at` direct op `training_plan_sessions`, geen nieuwe tabel
- **Nieuw:**
  `src/app/api/specialists/cycling/training-plan/explain/route.ts`
  - Leest de sessie van vandaag + reason code (indien aangepast) +
    actuele CoachPolicy
  - Berekent expliciet of er een stille volume-reductie was, en
    forceert de AI om dat te benoemen als dat het geval is
  - Prompt: *"de beslissing staat al vast... jij verzint niets en
    wijzigt niets, je zet de al-genomen beslissing om in menselijke
    uitleg"* — reason codes worden vertaald naar gewone taal (bijv.
    `fatigue_detected` → "de herstelwaarden van vandaag waren laag")
  - Cache op de sessie zelf: alleen opnieuw genereren als de sessie
    sindsdien is gewijzigd (`explained_at` vs. `updated_at`)
  - Nette fallback-tekst als de AI-call faalt — geen crash
- `src/app/debug/page.tsx` — testsectie toegevoegd

**Volgende stap:** Fase 3 — UI (planningsscherm, aanpassen,
coachgesprek, historie).

**Test-instructies:** zie bericht bij levering.

## v2.4.96 — Adaptive Training Plan Engine, Fase 1: Engine zonder AI
**Eerste implementatiestap, volgens `adaptive-training-plan-engine-spec.md`
+ `adaptive-training-plan-decision-contract-v1.md` (beide goedgekeurd).
Volledig deterministisch — geen AI-aanroep in deze hele fase.**

- **Nieuw:** `supabase/training_plan_engine.sql`
  - `training_plans` + `training_plan_sessions`, exact de velden uit het
    Decision Contract
  - **Database-constraint, niet alleen documentatie:**
    `adjustment_reason` is verplicht zodra `status='adjusted'` — een
    check-constraint, geen sessiewijziging kan zonder reason code
    opgeslagen worden
  - RLS: alleen server-side schrijven (Plan Generator/Daily Adjustment),
    zelfde patroon als eerdere specialistlaag-tabellen
- **Nieuw:** `src/lib/specialists/training-plan-generator.ts` (Plan
  Generator)
  - Mesocyclus-verdeling: basis (40%) → opbouw (35%, met 3:1-herstelweek-
    patroon) → piek (15%) → herstel/taper (10%) bij een streefdatum;
    standaard 12-weken-macrocyclus zonder streefdatum
  - **Rolling horizon, zoals vastgelegd:** volledige dagplanning alleen
    voor de komende 2 weken, verder weg geen sessie-rijen — alleen de
    mesocyclus-week-targets bestaan al
  - **Prioriteitsketen afgedwongen, niet alleen gedocumenteerd:** elke
    voorgestelde sessie wordt vóór opslag getoetst aan `CoachPolicy` —
    een interval bij `forbiddenTrainingTypes` bevat "hoge_intensiteit"
    wordt automatisch teruggebracht naar duurtraining, volume wordt
    verlaagd bij een negatieve `volumeAdjustmentPct`
  - Analysis Engine-data daadwerkelijk gebruikt: eerste basisweek wordt
    verzacht als de huidige trainingsbelasting fors onder het
    streefvolume ligt — voorkomt een te agressieve sprong in week 1
  - Leidend doel: specialist-scoped Cycling-doel met hoogste
    `importance` uit de bestaande Goal Engine
- **Nieuw:** `src/lib/specialists/training-plan-adjuster.ts` (Daily
  Adjustment Layer)
  - **Eerlijke dekking, expliciet in de code gedocumenteerd:**
    `missed_session`/`injury_protection`/`goal_change` volledig
    geïmplementeerd. `fatigue_detected` gedeeltelijk (alleen huidige dag,
    nog niet "meerdere dagen op rij" — vergt historische CoachPolicy-
    snapshots die nog niet bijgehouden worden). `vacation_mode` nog niet
    (vergt eerst een UI voor onbeschikbare dagen)
  - Bij elke aanpassing: origineel blijft bewaard (`original_session_id`
    + `cancelled`-status), nieuwe sessie krijgt de verplichte reason code
- **Nieuw:** `src/app/api/specialists/cycling/training-plan/route.ts`
  - `POST` — genereert een nieuw plan (sluit eerst een eventueel
    bestaand actief plan af, nooit twee actieve plannen tegelijk)
  - `GET` — voert eerst de Daily Adjustment Layer uit, dan pas de
    actuele sessies teruggeven — altijd up-to-date bij het bekijken
- `src/app/debug/page.tsx` — testsectie toegevoegd

**Bewust nog niet gebouwd (volgt in Fase 2-3):** Coach-uitleglaag (AI
zet reason codes om in menselijke uitleg), Kalender-UI, `vacation_mode`-
trigger, volledige `fatigue_detected`-dekking.

**Test-instructies:** zie bericht bij levering.

## v2.4.95 — Nieuw document: Adaptive Training Plan Engine — Decision Contract v1.0
**Status: TE TOETSEN. Aanvulling op `adaptive-training-plan-engine-spec.md`
(v2.4.92) — drie aanscherpingen na review, vóór de eerste code.**

- **Nieuw:** `docs/adaptive-training-plan-decision-contract-v1.md`
  - **Prioriteitsketen afdwingbaar in code:** `CoachPolicy > Cycling
    Specialist > Plan Generator` — geen documentatie-intentie, maar een
    échte validatiestap: elk sessievoorstel wordt vóór opslag getoetst
    aan de actuele CoachPolicy, overschrijdingen worden automatisch
    teruggebracht binnen de grens vóórdat de gebruiker het ziet
  - **5 verplichte reason codes**, niet optioneel: `missed_session`,
    `fatigue_detected`, `injury_protection`, `vacation_mode`,
    `goal_change` — elke sessiewijziging moet er één krijgen, maakt
    specifieke Coach-uitleg mogelijk i.p.v. "je plan is aangepast"
  - **Sessie-levenscyclus vastgelegd:** `planned → scheduled →
    completed/skipped/adjusted/cancelled`. Bij `adjusted` blijft de
    oorspronkelijke sessie bewaard (`original_session_id`), geen
    verloren historie
  - **Database-velden uitgebreid** t.o.v. de "op hoofdlijnen"-versie in
    de hoofdspec: volledige kolomdefinities voor `training_plans` en
    `training_plan_sessions`, inclusief `adjustment_reason` (verplicht
    bij `adjusted`) en `completed_activity_id`
  - Bouwvolgorde herbevestigd: Fase 1 (Engine zonder AI) → Fase 2
    (Coach-uitleglaag, AI beslist niets) → Fase 3 (UI)

**Volgende stap, na goedkeuring van dit document:** implementatie start
bij de Plan Generator — volledig deterministisch, testbaar zonder AI.

## v2.4.94 — Fix: 4 verouderde route-verwijzingen na navigatie-herstructurering
**Gevonden na test-feedback: de Cycling Hub-terugknop ging naar /chat
i.p.v. /specialisten. Bredere sweep uitgevoerd, drie soortgelijke
plekken extra gevonden — zelfde bug-patroon, telkens een hardcoded
verwijzing naar een route die vóór v2.4.93 de juiste "vorige plek" was,
maar dat nu niet meer is.**

- `src/app/coach/cycling/page.tsx` — terugknop: `/chat` → `/specialisten`
- `src/app/coach/running/page.tsx` — terugknop: `/chat` → `/specialisten`
- `src/app/activities/[id]/page.tsx` — terugknop: `/activities` →
  `/progressie` (waar Activiteiten nu daadwerkelijk woont)
- `src/app/settings/garmin-activity-import/page.tsx` — "Bekijk
  activiteiten"-knop na een succesvolle import: `/activities` →
  `/progressie`

**Bewust NIET gewijzigd:** de `/activities`-route zelf blijft bestaan
en werkt — deze fixes gaan alleen over waar knoppen *naartoe* wijzen,
niet over welke routes bestaan.

**Test-instructies:** zie bericht bij levering.

## v2.4.93 — Navigatie-architectuur v1.0: volledige implementatie ⚠️ RAAKT VEEL SCHERMEN
**Alle 5 stappen uit `navigation-architecture-v1.md` in één levering,
inclusief Stap 5 — die bleek NIET uitstelbaar: de balk had in
werkelijkheid 6 items (Activiteiten én Instellingen), niet 5 zoals
aangenomen. Zonder Stap 5 nu al mee te bouwen was Instellingen straks
onbereikbaar geworden.**

- **`src/components/layout/index.tsx`** — definitieve 5-tabs-structuur:
  🏠 Home · 🧠 Coach (`/chat`) · 💪 Trainer (`/training`, was
  "Training") · ⭐ Specialisten (`/specialisten`, NIEUW) · 📈 Voortgang
  (`/progressie`, was "Progressie")
- **Nieuw:** `src/components/ActiviteitenSectie.tsx` — geëxtraheerd uit
  de voormalige losse `/activities`-pagina, herbruikt nu op twee plekken
  (geen logica gedupliceerd). `compact`-prop voor gebruik als sectie
  i.p.v. volledige pagina
- `src/app/activities/page.tsx` — dunne wrapper geworden, blijft bestaan
  voor eventuele diepe links, **niet meer in de navigatiebalk**
- `src/app/progressie/page.tsx` — titel "Progressie" → "Voortgang",
  `ActiviteitenSectie` als eerste sectie ingevoegd (compact-modus,
  max. 5 activiteiten zichtbaar + doorklik naar volledig overzicht)
- **Nieuw:** `src/app/specialisten/page.tsx` — overzichtspagina, drie
  secties (Actief/Beschikbaar/Binnenkort). **Vervangt functioneel** de
  "Mijn Coaches"-chips én de SUGGESTED/RETURNING-lifecycle-banners die
  voorheen in de Coach-tab stonden — geen dubbele ingang
- `src/app/chat/page.tsx` — alle specialist-gerelateerde state/UI
  verwijderd (chips, banners, activatie-logica) — deze tab gaat nu
  uitsluitend over het Master Coach-gesprek, consistent met de nieuwe
  driedeling (Coach/Trainer/Specialisten)
- `src/app/home/page.tsx` — account-icoon toegevoegd naast het
  bel-icoontje, opent `/settings` — dit is nu de enige ingang naar
  Instellingen, nu die geen eigen tab meer heeft

**Bewust NIET aangepast:** `src/app/settings/page.tsx` zelf — alleen de
ingang ernaartoe veranderde, de pagina-inhoud is ongewijzigd.

**Test-instructies:** zie bericht bij levering — dit raakt veel
schermen, extra zorgvuldig testen aanbevolen.

## v2.4.92 — Nieuw document: Adaptive Training Plan Engine (compacte spec)
**Status: TE TOETSEN. Fase 2a van de Cycling Specialist Roadmap v1.0 —
vergt goedkeuring vóór implementatie, zoals bij Fase 1 ook gedaan.**

- **Nieuw:** `docs/adaptive-training-plan-engine-spec.md`
  - **Kernprincipe:** twee lagen — Plan Generation Engine (deterministisch,
    genereert macro/meso/microcycli) + Daily Adjustment Layer
    (deterministisch, vervangt bij CoachPolicy-conflict) + Coach Layer
    (AI, schrijft alleen de uitleg, beslist niets)
  - **Input:** volledig hergebruik van bestaande bronnen (Cycling
    Profile, CoachPolicy, Goal Engine, Analysis Engine, Memory Engine,
    Confidence Engine) — geen nieuwe databron nodig
  - **"Rolling horizon"-planning:** volledige dagplanning voor komende
    1-2 weken, verder weg alleen een week-belasting-target — voorkomt
    valse precisie voor plannen die toch nog wijzigen
  - **5 expliciete herberekenings-triggers:** gemiste training,
    overbelasting-signaal, nieuwe blessure, vakantie/onbeschikbare
    dagen, doelwijziging — elk met concreet gevolg
  - **Rolverdeling herbevestigd:** Master Coach levert alleen
    CoachPolicy-grenzen, nooit planbeslissingen; Cycling Specialist
    beslist de planaanpassing binnen die grenzen — hergebruikt het
    bestaande CoachPolicy/SpecialistSummary-contract, geen nieuwe
    communicatielaag
  - **Database, op hoofdlijnen:** twee nieuwe tabellen
    (`training_plans`, `training_plan_sessions`), geen wijziging aan
    bestaande tabellen — exact schema volgt bij implementatie
  - **Expliciet NIET vastgelegd** (vergt praktijkervaring): exact
    periodiseringsalgoritme, exacte trigger-drempelwaarden

**Volgende stap, na goedkeuring:** implementatie in sub-stappen — eerst
Plan Generation Engine, dan Daily Adjustment Layer, dan Coach Layer-
uitbreiding, dan Kalender-UI (Fase 2b).

## v2.4.91 — Cycling Specialist Roadmap Fase 1: Cycling Foundation
**Eerste implementatiestap van de goedgekeurde v1.0-roadmap
(`docs/cycling-specialist-roadmap-v1.md`). Geen afhankelijkheden, laagste
risico van de hele roadmap.**

**Ontwerpkeuze, zelf gemaakt binnen het al goedgekeurde plan:**
`birth_date` op het **algemene** profiel (`profiles`), niet als
Cycling-specifiek veld — de onderbouwing (leeftijdscategorieën, Masters-
categorieën, leeftijdsafhankelijke zones) is sport-overstijgend, dus ook
bruikbaar voor Running en toekomstige specialisten.

- **Nieuw:** `supabase/fase1_cycling_foundation.sql`
  - `profiles.birth_date` (date, nullable) — nieuwe bron van waarheid
    voor leeftijd, `age` blijft tijdelijk bestaan
  - **Geen nieuwe tabel voor cycling-specifieke velden** — hergebruikt
    de al-bestaande `specialist_profiles.preferences` (jsonb), die al
    door de Coach Layer-routes wordt gelezen
- **Nieuw:** `src/lib/specialists/cycling-zones.ts`
  - `berekenVermogensZones()` — Andrew Coggan's publiek gedocumenteerde
    7-zone-model, **niet** een namaak van een propriëtair platform-model
  - `berekenHartslagZones()` — gangbaar 5-zone-%-van-max-hartslag-model
  - `berekenLeeftijd()` — hulpfunctie voor weergave uit `birth_date`
  - Volledig deterministisch, geen AI
- **Nieuw:** `src/app/api/specialists/cycling/profile/route.ts`
  - `GET`/`PUT` voor het Cycling Profile: FTP, max hartslag, sensoren
    (vermogensmeter/hartslagmeter/cadanssensor/smarttrainer/Zwift),
    trainingsdagen, beschikbare uren per week
  - **Bewust NIET opgeslagen:** gewicht, lengte, rusthartslag,
    ervaringsniveau — bestaan al elders, geen duplicatie
  - Validatie op alle velden (bijv. FTP 1-600W, max hartslag 1-250bpm)
  - Zones worden direct meeberekend en meegegeven in de response, alleen
    als de bijbehorende brondata daadwerkelijk is ingevuld
- **Nieuw:** `src/app/settings/cycling-profile/page.tsx`
  - Volledig instellingenscherm, toont berekende zones live na opslaan
  - Toelichting in de UI zelf: *"Gewicht, lengte en rusthartslag beheer
    je via je algemene profiel"* — voorkomt verwarring over waar iets
    hoort
- `src/app/settings/page.tsx` — link naar Cycling Profile toegevoegd
- `src/app/coach/cycling/page.tsx` — instellingen-icoontje toegevoegd
  naast de titel, snelle toegang vanuit de context waar het relevant is

**Bewust buiten scope van Fase 1** (volgt in Fase 2, Adaptive Training
Plan Engine): FTP/zones nog niet meegenomen in de Coach Layer-prompt of
CoachPolicy — dat gebeurt zodra de Training Plan Engine daadwerkelijk
gebouwd wordt en dit als input nodig heeft.

**Test-instructies:** zie bericht bij levering.

## v2.4.90 — Nieuw document: Navigatie-architectuur v1.0 (GOEDGEKEURD, ontwerp)
**Definitieve herstructurering van de hoofdnavigatie, principieel
vastgelegd — niet als tijdelijke Cycling-oplossing. Implementatie
bewust NIET in deze levering — dit raakt te veel schermen om in één
stap te doen, zie het 5-stappen-implementatieplan in het document zelf.**

- **Nieuw:** `docs/navigation-architecture-v1.md`
  - Drie niveaus, ieder een eigen vraag: **Trainer** ("wat doe ik
    vandaag") / **Specialist** ("hoe word ik beter in [sport]") /
    **Voortgang** ("hoe ontwikkel ik me over alle sporten heen")
  - Definitieve navigatie: 🏠 Home · 🧠 Coach · 💪 Trainer ·
    🚴 Specialisten (nieuw) · 📈 Voortgang — 5 tabs, binnen de gangbare
    grens voor duim-bereik
  - **Activiteiten** verhuist van eigen tab naar eerste sectie binnen
    Voortgang — "een activiteit is geen doel, maar een gebeurtenis die
    bijdraagt aan 'ga ik vooruit'"
  - Profiel/Instellingen: geen 6e tab, via account-icoon vanuit Home
  - **Bewuste, uitgelegde dubbeling:** Records/Kalender bestaan zowel
    bij Voortgang (gecombineerd) als bij een Specialist (sport-
    specifiek) — twee verschillende vragen, geen inconsistentie
  - "Mijn Coaches"-chips (Coach-tab, sinds v2.4.69/83) migreren logisch
    naar de nieuwe Specialisten-tab
  - **5-staps-implementatieplan**, elke stap apart testbaar: (1)
    labels/iconen wijzigen, (2) Activiteiten verhuizen naar Voortgang,
    (3) Specialisten-overzichtspagina bouwen, (4) Specialisten-tab
    toevoegen + chips verwijderen uit Coach, (5) Profiel-menu

**Volgende stap, bij akkoord:** implementatiestap 1 (labels/iconen) —
laagste risico, puur cosmetisch, routes ongewijzigd.

## v2.4.89 — CoachOS Cycling Specialist Roadmap v1.0 (GOEDGEKEURD)
**Definitieve versie na overleg. Bestandsnaam gewijzigd t.o.v. het
eerdere concept: `cycling-specialist-roadmap-v1.md` (niet
`cycling-specialist-bouwplan.md` — dat concept is nooit gecommit,
vervangen vóór het live ging).**

- **Nieuw:** `docs/cycling-specialist-roadmap-v1.md`
  - **Fase 1 — Cycling Foundation:** Cycling Profile + automatische
    zone-berekening. Definitieve, niet-dubbele veldenlijst na twee
    duplicatie-checks tijdens het overleg:
    - Bevestigd al bestaand, niet toegevoegd: gewicht, lengte,
      rusthartslag, ervaringsniveau
    - **Beslist: geboortedatum (`birth_date`) i.p.v. leeftijd** —
      `profiles.age` veroudert handmatig, geboortedatum levert
      leeftijd/leeftijdscategorieën/Masters-categorieën automatisch.
      Migratiepad: `age` blijft tijdelijk bestaan, dynamisch berekend,
      totdat gebruikers hun geboortedatum invullen
    - **Beslist: geen apart "belangrijkste doel"-veld** — zou een derde
      bron van waarheid worden naast `user_goals`/Goal Engine. Cycling
      Coach haalt het hoogst-`importance`-Cycling-doel rechtstreeks uit
      de bestaande Goal Engine, getoond in Dashboard, wijzigbaar via de
      bestaande doelen-UI
  - **Fase 2 — Cycling Coach Professional:** één samenhangend leverblok
    (2a-2i), geen losse "Centers" die bestaande infrastructuur zouden
    dupliceren:
    - 2a Adaptive Training Plan Engine (kern, eigen spec-document eerst)
    - 2b Trainingskalender, 2c Cycling Dashboard, 2d Grafieken
      (incl. CTL/ATL/TSB, Coggan-methode), 2e Records, 2f Ritanalyse
    - 2g Coach-verdieping — gebruikt uitsluitend bestaande Memory/Goal
      Engine/CoachPolicy/SpecialistSummary, geen nieuwe engine
    - 2h Master Coach-integratie (bevestiging/verdieping van bestaand
      contract sinds v2.4.80)
    - **2i Progress Center (nieuw, uit het overleg)** — centrale plek
      voor FTP-ontwikkeling, W/kg, doelvoortgang, records, Memory-
      inzichten, coach-samenvattingen. Het feitelijke "hart" van de
      Cycling Hub
  - **Fase 3 — Uitbreidingen, expliciet later:** Event Engine, Zwift/
    Wahoo/Hammerhead, Nutrition Specialist, Triathlon Specialist, Race
    Planner, Live Coaching

**Volgende stap:** Fase 1 (Cycling Foundation) implementeren.

## v2.4.88 — Doelen-UI voor de Goal Engine
**Maakt de Goal Engine (v2.4.86-87) voor het eerst normaal bruikbaar —
tot nu toe alleen bereikbaar via een directe API-call. Ontworpen om
schaalbaar te zijn: een toekomstige specialist toevoegen betekent alleen
een nieuwe `DOELTYPES`-regel + `PRESETS`-entry, geen structuurwijziging.**

- `src/app/goals/page.tsx` — nieuw-doel-flow herbouwd in drie stappen:
  1. **Doeltype** — 🌍 Algemeen, 🚴 Wielrennen, 🏃 Hardlopen (actief),
     🚣 Roeien, 🏋️ Krachttraining (zichtbaar maar uitgeschakeld — status
     'development' in `specialist_config`, geen overclaiming)
  2. **Doel** — preset-chips per specialist (Cycling: FTP verhogen,
     Kilometerdoel, Hoogtemeters, Gran Fondo, Tijdrit, Klimprestatie.
     Running: 5/10km, halve/hele marathon, Weekkilometers, Tempo) of een
     eigen omschrijving
  3. **Belangrijkheid** (Hoog/Normaal/Laag → `importance`) + de
     velden die voor dat specifieke preset relevant zijn (bijv. "Streef-
     FTP (watt)" bij FTP verhogen, "Wedstrijddatum" bij Gran Fondo) —
     niet elk doel toont dezelfde generieke velden
  - Bestaande doelen-lijst toont nu een specialist-icoon i.p.v. altijd
    hetzelfde generieke doel-icoon, plus een MUST/hoog-badge bij
    `importance`
  - `voegToe()` stuurt nu `goal_scope`/`specialist_type`/`importance`
    mee — volledig aangesloten op de API die dit sinds v2.4.86-87 al
    ondersteunt

**Test-instructies:** zie bericht bij levering.

## v2.4.87 — Rechtzetting: importance (gebruiker) vs. calculated_urgency (Goal Engine) ⚠️ RAAKT PRODUCTIECODE

**⚠️ Build-fix, ontdekt via een mislukte Vercel-deploy op de eerste
v2.4.87-levering:** `src/app/api/specialists/decision-test/route.ts`
gebruikte `let hoogsteImportance: string | undefined` — te generiek
getypeerd. De Decision Engine verwacht specifiek
`'must' | 'high' | 'normal' | 'low' | undefined`
(`GoalImportance | undefined`), en TypeScript's strict typecheck
weigerde terecht een gewone `string` daarvoor te accepteren. Gecorrigeerd
door `GoalImportance`/`CalculatedUrgency` (uit `goal-engine.ts`) te
importeren en te gebruiken i.p.v. generieke `string`-types. **Dit is de
enige plek waar deze fout zat** — `api/coach/route.ts` leunt op
typeninferentie vanuit de Goal Engine zelf en compileert correct.
**Correctie op v2.4.86. Daar was `urgency` een door de gebruiker
ingevuld, statisch veld — dat vermengt twee verschillende concepten die
apart moeten blijven, en zou de Decision Engine kunnen laten sturen door
een gebruikersinschatting in plaats van de werkelijkheid (bijv. "FTP
280W" als "critical" markeren terwijl de wedstrijd nog 9 maanden weg is).**

- **`supabase/goal_engine_importance_rechtzetting.sql`**
  - Hernoemt `urgency` → `importance` (veilig ongeacht of v2.4.86 al
    gedraaid was — gebruikt een conditionele check)
  - Nieuwe waardenschaal: `must`/`high`/`normal`/`low` (was
    `critical`/`high`/`normal`/`low`) — bestaande `critical`-waarden
    gemigreerd naar `must`
- **`src/lib/specialists/goal-engine.ts`** — volledig herbouwd:
  - `importance` — **opgeslagen**, door de gebruiker ingesteld, stabiel
  - `calculated_urgency` — **NOOIT opgeslagen**, elke keer opnieuw
    berekend door `berekenCalculatedUrgency()`, puur op basis van
    deadline-nabijheid (≤7 dagen: critical, ≤30: high, ≤90: normal,
    anders/geen deadline: low)
  - **Eerlijk vastgelegde beperking, ongewijzigd:** nog geen "op schema"-
    beoordeling op basis van voortgang — vergt een vastgelegde
    startwaarde/-datum die nu niet bestaat, expliciet als toekomstige
    uitbreiding genoteerd in de code zelf
- **`src/lib/specialists/decision-engine.ts`** — regel 4/5 herschreven:
  regel 4 beslist eerst op `importance` (gebruikerskeuze), **alleen bij
  een gelijke stand** wordt regel 5 (`calculated_urgency`) geraadpleegd
  als secundaire tiebreaker — niet meer één vermengd veld
- `src/app/api/goals/route.ts` — `POST`/`PATCH` accepteren nu
  `importance` (niet meer `urgency`), met de nieuwe waardenschaal
- `src/app/api/specialists/cycling/coach/route.ts`,
  `.../running/coach/route.ts` — prompt toont nu `importance` en
  `calculated_urgency` als twee aparte regels, niet meer samengevoegd
- `src/app/api/coach/route.ts` — haalt nu apart de hoogste `importance`
  én de hoogste `calculated_urgency` per specialist op, geeft beide door
  aan de Decision Engine
- `src/app/api/specialists/decision-test/route.ts` — testroute toont nu
  ook `hoogsteImportance` naast `hoogsteUrgentie`

**Test-instructies:** zie bericht bij levering.

## v2.4.86 — Goal Engine + Decision Engine regels 4-5 ⚠️ RAAKT PRODUCTIECODE
**Global vs. Specialist Goals-onderscheid, zoals vastgelegd in
specialist-api.md v2.4.72, nu daadwerkelijk gebouwd. Ontgrendelt ook
Decision Engine-regels 4-5 (lange termijn, gebruikersdoel als
tiebreaker).**

- **Nieuw:** `supabase/goal_engine_kolommen.sql`
  - `user_goals.goal_scope` ('global'/'specialist', default 'global' —
    backwards compatible)
  - `user_goals.specialist_type` (nullable, alleen gevuld bij
    scope='specialist')
  - `user_goals.urgency` ('critical'/'high'/'normal'/'low', default
    'normal')
  - **Belangrijk, expliciet gecheckt:** `priority` bestond al
    (integer, weergavevolgorde, auto-opgehoogd) — **niet hergebruikt/
    overschreven**, `urgency` is een nieuwe, aparte kolom
- **Nieuw:** `src/lib/specialists/goal-engine.ts`
  - `berekenGoalProgress()` — deterministisch: dagen tot deadline,
    ruwe waarde-kloof (`target_value - current_value`)
  - **Bewust eerlijk begrensd:** claimt NIET te weten of de gebruiker
    "op schema" ligt volgens een verwachte voortgangscurve (geen
    vastgelegde startwaarde/-datum om dat op te baseren), en
    interpreteert NIET welke richting (omhoog/omlaag) "goed" is voor
    een doel — dat blijft aan de AI, die de doeltitel in natuurlijke
    taal leest
  - `haalGoalsMetProgress(userId, specialistType?)` — met
    `specialistType`: global-doelen + specialist-specifieke doelen van
    díe specialist. Zonder: alle doelen (Master Coach-gebruik)
- `src/app/api/goals/route.ts` — `POST`/`PATCH` accepteren nu
  `goal_scope`/`specialist_type`/`urgency`, met validatie
  (specialist_type verplicht bij scope='specialist')
- `src/app/api/specialists/cycling/coach/route.ts`,
  `.../running/coach/route.ts` — lichte doelen-fetch vervangen door
  `haalGoalsMetProgress()`, prompt toont nu scope + urgentie + kloof +
  deadline per doel
- **`src/lib/specialists/decision-engine.ts`** — regels 4-5 toegevoegd:
  bij gelijke belasting/risico tussen specialisten (dus geen winnaar via
  regel 2/3) beslist de hoogste doelurgentie + naaste deadline welke
  specialist vandaag de hoofdfocus krijgt. Retourneert nog steeds `null`
  als er geen aanwijsbaar verschil is
- **`src/app/api/coach/route.ts`** — haalt nu per actieve specialist ook
  de hoogste doelurgentie op (via Goal Engine) en geeft dat door aan de
  Decision Engine — **additief, eigen try/catch behouden**
- `src/app/api/specialists/decision-test/route.ts` — testroute
  bijgewerkt, toont nu ook `hoogsteUrgentie`/`naasteDeadlineDagen` per
  specialist

**Decision Engine nu compleet: regels 2, 3, 4, 5 geïmplementeerd.**
(Regel 1, gezondheid > prestatie, zat al structureel geborgd via
CoachPolicy, geen aparte Decision Engine-logica voor nodig.)

**Test-instructies:** zie bericht bij levering.

## v2.4.85 — Decision Engine: directe testroute
**Los van het dagadvies zelf testbaar — gebruikt echte, actuele
`specialist_summary`'s van je actieve specialisten, geen nepdata. Geen
wijziging aan bestaand gedrag, puur inzicht.**

- **Nieuw:** `src/app/api/specialists/decision-test/route.ts` — haalt
  `CoachPolicy` + de meest recente `specialist_summary` van elke actieve
  specialist op (exact dezelfde ophaal-logica als `api/coach/route.ts`,
  v2.4.84), roept `beslisTussenSpecialisten()` aan, en geeft het volledige
  resultaat terug: welke summaries zijn gebruikt, wat de policy-prioriteit
  was, en de `DecisionResult` (of `null` bij geen conflict)
- `src/app/debug/page.tsx` — testsectie toegevoegd

**Vergt voor een zinvolle test:** 2+ actieve specialisten, elk met een
recente `specialist_summary` (dus eerst bij elke specialist een analyse
gegenereerd hebben).

## v2.4.84 — Decision Engine geïmplementeerd ⚠️ RAAKT PRODUCTIECODE
**Nu voor het eerst zinvol te testen, met Cycling + Running beide actief.
Raakt `api/coach/route.ts` — additief, eigen try/catch, geen bestaand
gedrag verwijderd.**

**Belangrijke precisering vóór implementatie:** regels 1-3 uit
`specialist-decision-engine.md` (gezondheid > prestatie, blessures >
periodisering, herstel > belasting) zitten al **gedeeltelijk** geborgd
via `CoachPolicy` — elke specialist krijgt dezelfde, deterministisch
bepaalde grenzen, dus kan al geen zware training adviseren bij laag
herstel. **Het conflict dat déze Decision Engine daadwerkelijk oplost:**
als meerdere specialisten elk afzonderlijk, binnen hun eigen grenzen,
"meer volume" adviseren, ziet geen van beide dat de **optelsom**
alsnog te veel wordt.

- **Nieuw:** `src/lib/specialists/decision-engine.ts`
  - `beslisTussenSpecialisten()` — volledig deterministisch, geen AI
  - **Regel 2 (blessures/verhoogd risico):** een specialist met
    `risk: 'high'` krijgt altijd voorrang, ongeacht wat anderen
    adviseren
  - **Regel 3 (herstel > belasting):** bij `coachPriority` "recovery" of
    "balance" (dus niet bij een goede hersteldag) — als 2+ specialisten
    tegelijk niet-lage belasting tonen, krijgt alleen degene met de
    hoogste belasting vandaag de hoofdfocus, de rest wordt getemperd
  - Retourneert `null` bij 0-1 specialist of geen conflict — bestaand
    gedrag (alle specialisten gelijkwaardig genoemd) blijft dan intact
  - `DecisionResult`: `selectedCoach`, `rejectedCoaches[]`,
    `appliedRule`, `priorityScore`, `reasoning[]` — exact zoals
    vastgelegd in `specialist-decision-engine.md`
- `src/app/api/coach/route.ts`
  - `genereerCoachPolicy()` nu ook hier aangeroepen (was alleen in de
    specialist-routes) — nodig als input voor de Decision Engine.
    Zelfde deterministische functie, zelfde dag, dus consistente
    uitkomst met wat de specialist-routes al gebruikten
  - Decision Engine aangeroepen tussen het ophalen van de
    SpecialistSummary's en het opbouwen van de prompt-tekst
  - Bij een conflict: getemperde specialisten krijgen een markering
    `[vandaag getemperd — zie Decision Engine-toelichting]` in de
    prompt, plus een aparte toelichting-regel met de reden
  - **Eigen try/catch, additief:** faalt de Decision Engine, dan
    blijven specialisten gewoon gelijkwaardig getoond — geen crash-risico

**Test-instructies:** zie bericht bij levering. Vergt beide specialisten
(Cycling + Running) actief én met een niet-lage belasting om het
conflict-scenario daadwerkelijk te triggeren.

## v2.4.83 — Running: tweede specialist, bewijst herbruikbaarheid van de architectuur
**De belangrijkste test van de hele specialistlaag-architectuur: kan een
tweede specialist gebouwd worden zonder de bestaande architectuur
opnieuw te ontwerpen? Antwoord: ja — grotendeels een invuloefening,
exact zoals voorspeld in `specialist-engine-architecture.md`.**

**Wat volledig hergebruikt is, ZONDER wijziging:**
- `genereerCoachPolicy()` (`coach-policy.ts`) — sport-onafhankelijk,
  geen enkele regel aangepast
- `verwerkKandidaatInzicht()`, `haalMemoryOp()` (`learning-engine.ts`) —
  al generiek via `specialist_type`-parameter, geen wijziging
- Confidence Engine (`confidence-engine.ts`) — ongewijzigd
- `api/coach/route.ts` (Master Coach-integratie) — bleek al generiek
  gebouwd (v2.4.80 loopte al over ALLE actieve specialisten, niet
  hardcoded op cycling) — **geen wijziging nodig**
- Coach Personality (`coach-personality.ts`) — ongewijzigd, zelfde stem

**Wat per sport uniek werk was (zoals voorspeld):**
- **Nieuw:** `src/lib/specialists/running-data.ts` — Data Layer.
  Activiteitnaam geverifieerd (niet aangenomen): Strava
  `SPORT_TYPE_MAP.Run → 'Hardlopen'`, Garmin `ACTIVITEIT_OPTIES`
  bevestigt dezelfde naam, geen indoor/buiten-splitsing zoals bij Fietsen
- **Nieuw:** `src/lib/specialists/running-analysis.ts` — Analysis Engine.
  Belangrijkste inhoudelijke verschil met Cycling: **snelheid**
  (`avg_speed`) i.p.v. **vermogen** (`avg_watts`) — running heeft
  doorgaans geen vermogensmeter
- **Nieuw:** `src/app/api/specialists/running/engine/route.ts`,
  `src/app/api/specialists/running/coach/route.ts` (Coach Layer,
  spiegelbeeld van cycling met "hardlopen"-vakkennis i.p.v. "wielrennen")
- **Nieuw:** `src/app/coach/running/page.tsx` — Hub-UI, spiegelbeeld van
  de Cycling Hub

**Refactor tijdens het bouwen — generieke rekenbibliotheek:**
- `src/lib/specialists/lifecycle-engine.ts` — geherstructureerd naar één
  generieke `berekenLifecycle()`-kernfunctie + dunne per-sport-wrappers
  (`bepaalCyclingLifecycle`, `bepaalRunningLifecycle`), in plaats van
  gedupliceerde logica. Toepassing van de aanscherping uit
  `specialist-api.md` (v2.4.72: "generieke rekenbibliotheek, sport-
  specifieke implementatie") — nu voor het eerst concreet toegepast.

**Generaliseringen aan bestaande, gedeelde bestanden:**
- `src/app/api/specialists/[type]/data/route.ts` — was hardcoded op
  alleen `'cycling'`, nu een `DATA_FETCHERS`-lookup die beide sporten
  ondersteunt
- `src/app/api/specialists/route.ts` — `running` status `development` →
  `active`; `LIFECYCLE_ONDERSTEUND` van een `Set` naar een lookup-map
  (generieker, makkelijker uit te breiden voor een 3e specialist later)
- `src/lib/specialists/capability-registry.ts` — `running`-entry
  toegevoegd, exact dezelfde capability-set als cycling op dit moment
- `src/app/chat/page.tsx` — icoon was hardcoded op `Bike` voor **alle**
  actieve specialisten (klopte toevallig toen er maar één was) — nu een
  `SPECIALIST_ICOON`-lookup (`Bike`/`Footprints`). Zelfde voor de
  SUGGESTED-bannertekst ("je fietst" was hardcoded, nu een
  `SPECIALIST_WERKWOORD`-lookup)

**Bewust NIET aangepast:** `api/coach/route.ts` — bleek al generiek.

**Test-instructies:** zie bericht bij levering.

## v2.4.82 — Memory Engine, sub-stap 5/5 (LAATSTE): terugkoppeling naar Coach Layer
**De Memory Engine is hiermee volledig afgerond — alle 5 sub-stappen.
De Cycling Coach leest voortaan zijn eigen bevestigde geheugen terug bij
elk nieuw advies.**

- `src/app/api/specialists/cycling/coach/route.ts`
  - `haalMemoryOp(userId, 'cycling', true)` opgehaald vóór de prompt
    gebouwd wordt — **alleen `active`-items**, dus al meermaals bevestigd
    door de Learning Engine, geen eenmalige AI-gok
  - Confidence is al actueel dankzij `haalMemoryOp()`'s ingebouwde
    decay-toepassing (Confidence Engine, sub-stap 4) — geen aparte
    herberekening hier nodig
  - Maximaal 5 inzichten meegegeven, gesorteerd op confidence (hoogste
    eerst), expliciet als *"achtergrondkennis, niet als nieuw te
    herhalen conclusie"* — voorkomt dat de AI het als nieuwe ontdekking
    presenteert
  - Eigen try/catch: als Memory ophalen faalt, gaat het advies gewoon
    door zonder die context — geen crash-risico

## 🎉 Memory Engine volledig afgerond — alle 5 sub-stappen

1. ✅ SQL `specialist_memory` (v2.4.73)
2. ✅ Learning Engine — candidate→active promotie (v2.4.74)
3. ✅ Coach Layer stelt kandidaat-inzichten voor (v2.4.75)
4. ✅ Confidence Engine — stijging/decay/auto-deprecate (v2.4.76)
5. ✅ Terugkoppeling naar Coach Layer (v2.4.82)

**Volledige cyclus, nu gesloten:** AI stelt een patroon voor → Learning
Engine bevestigt het pas na meermaals terugkeren → Confidence Engine
onderhoudt het vertrouwen over tijd → Coach Layer leest het terug bij
elk nieuw advies → AI gebruikt het als achtergrondkennis, niet als
losse aanname.

**Test-instructies:** zie bericht bij levering.

## v2.4.81 — Fix: specialist_summary kwam soms null binnen (afkapping)
**Gevonden tijdens Master Coach-integratietest: een verse Cycling-
analyse had `specialist_summary: null`, ondanks de verplichte
prompt-instructie. Waarschijnlijke oorzaak: `max_tokens: 800` was te
krap geworden sinds v2.4.79 het JSON-schema uitbreidde met
`kandidaat_inzichten` + `specialist_summary` — bij uitgebreide
tekstvelden (samenvatting/sterke_punten/aandachtspunten) kon de AI-
respons afkappen vóórdat het bij die laatste twee velden kwam.**

- `src/app/api/specialists/cycling/coach/route.ts`
  - `max_tokens: 800` → `1200` — meer ruimte voor het volledige,
    uitgebreidere schema
  - **Extra vangnet:** `specialist_summary` staat nu **eerst** in het
    JSON-schema-voorbeeld in de prompt (was laatst) — mocht de respons
    ooit alsnog afkappen, is dit veld dan al binnen vóórdat dat gebeurt

**Nog niet met zekerheid bevestigd of dit de enige/volledige oorzaak
was** — eerlijk gezegd, geen 100% garantie tot een volgende test dit
bevestigt. Als het probleem terugkeert, is de volgende stap: het
JSON-schema zelf verkleinen (kortere tekstvelden), of `specialist_summary`
en het advies als twee aparte AI-calls behandelen.

**Test-instructies:** zie bericht bij levering.

## v2.4.80 — CoachPolicy/SpecialistSummary: Master Coach leest terug ⚠️ RAAKT PRODUCTIECODE
**Laatste etappe van het contract uit `specialist-coach-policy.md`. Dit
raakt `api/coach/route.ts` — het bestaande, dagelijkse coach-advies dat
voor iedereen al actief is. Zorgvuldig, additief gebouwd: nieuwe context
wordt toegevoegd, niets bestaands verwijderd of gewijzigd. Faalt de
nieuwe stap, dan gaat het dagadvies gewoon door zonder specialist-context
(eigen try/catch, geen crash-risico).**

- **Rechtzetting op v2.4.79:** `specialist_summary` werd daar bewust
  alleen in de API-response gezet, niet opgeslagen — dat betekende dat
  de Master Coach het nergens kon lezen. Nu gecorrigeerd:
  - **Nieuw:** `supabase/specialist_summary_kolom.sql` — één nullable
    JSONB-kolom op `specialist_analyses`, backwards compatible, geen
    wijziging aan bestaande data/rijen
  - `src/app/api/specialists/cycling/coach/route.ts` — slaat
    `specialist_summary` nu daadwerkelijk op bij de insert
- **`src/app/api/coach/route.ts`:**
  - Nieuwe query in de bestaande Promise.all: welke specialisten zijn
    actief (`specialist_profiles`)
  - Ná de Promise.all, in een **eigen try/catch**: voor elke actieve
    specialist de meest recente `specialist_summary` ophalen uit
    `specialist_analyses`
  - `specialistContext` toegevoegd aan de prompt-samenstelling, **exact
    hetzelfde patroon** als de bestaande context-blokken
    (`garminContext`, `trainingsCoachContext`, etc.) — geen nieuwe
    aanpak geïntroduceerd, aangesloten bij wat er al was
  - Prompt-instructie: *"niet zelf herberekenen, dit is al hun eigen
    analyse"* + *"jij blijft eindverantwoordelijk voor de gezondheids-
    en herstelbeslissing"* — Master Coach neemt specialist-input mee,
    maar behoudt het laatste woord, consistent met de architectuur

**Resultaat:** de twee systemen "praten" nu daadwerkelijk met elkaar —
de vraag die deze hele stap in gang zette. Master Coach → CoachPolicy →
Cycling Coach → SpecialistSummary → Master Coach, volledig gesloten.

**Test-instructies:** zie bericht bij levering. **Extra voorzichtig
testen** aangezien dit het dagelijkse coach-advies raakt.

## v2.4.79 — CoachPolicy/SpecialistSummary: specialist-kant geïmplementeerd
**Eerste etappe van het contract uit `specialist-coach-policy.md`.
Raakt UITSLUITEND de specialist-route, NIET `api/coach/route.ts` —
die kant (Master Coach leest SpecialistSummary terug) is een aparte,
apart af te stemmen stap.**

- **Nieuw:** `src/lib/specialists/coach-policy.ts`
  - `genereerCoachPolicy()` — volledig deterministisch, **geen
    AI-aanroep**. Hergebruikt de bestaande `calculateRecoveryScore()`
    (`src/core/ai-engine/recovery-engine.ts`), vertaalt naar
    `CoachPolicy` volgens de vertaaltabel uit
    `specialist-coach-policy.md` (green→good/high, orange→moderate/
    moderate, red→low/low)
  - Blessure-regel: actieve blessure verlaagt `maxIntensity` met
    minimaal één stap, consistent met Decision Engine-regel 2
- `src/app/api/specialists/cycling/coach/route.ts`
  - `CoachPolicy` wordt opgehaald vóór de prompt gebouwd wordt, als
    **harde grenzen** in de prompt gezet ("beleid, geen ruwe data" —
    de AI ziet nooit HRV-waarden, alleen "max intensiteit: matig")
  - Prompt expliciet: *"je advies mag NOOIT een verboden trainingstype
    aanraden, ongeacht wat de cijfers suggereren"*
  - AI retourneert nu ook `specialist_summary` (load/progress/risk/
    recommendation/confidence) — apart geëxtraheerd, **niet** opgeslagen
    in `specialist_analyses.analysis` (dat blijft exact
    `CyclingCoachAdvies`, ongewijzigd), alleen in de API-response
  - Validatie op de AI-output: ongeldige enum-waarden vallen terug op
    een veilige default, geen crash bij onverwachte AI-output

**Bewust NIET gedaan in deze stap, volgende etappe:** de Master
Coach (`api/coach/route.ts`) leest deze `SpecialistSummary` nog niet —
dat vereist expliciete, aparte afstemming (bestaande productiecode).

**Test-instructies:** zie bericht bij levering.

## v2.4.78 — Nieuw document: Coach Policy & Specialist Summary + up-to-date sweep
**Naar aanleiding van de vraag "praten Master Coach en specialist met
elkaar" — antwoord bleek nee, en dat leidde tot een belangrijk nieuw
architectuurstuk: een deterministisch beleids-contract tussen Master
Coach en specialist, los van de Decision Engine.**

- **Nieuw:** `docs/specialist-coach-policy.md`
  - `CoachPolicy` (Master → Specialist): `recoveryState`, `maxIntensity`,
    `volumeAdjustmentPct`, `priority`, `allowedTrainingTypes`,
    `forbiddenTrainingTypes`, `reasons` — **beleid, geen ruwe data**
    ("max intensiteit: matig", niet "HRV = 45ms")
  - **Bevestigd, geen AI-aanroep:** CoachPolicy-generatie is volledig
    deterministisch, bouwt voort op de al-bestaande
    `calculateRecoveryScore()` (`src/core/ai-engine/recovery-engine.ts`,
    al in gebruik in `api/coach/route.ts`) — concrete vertaaltabel
    score→policy opgenomen
  - `SpecialistSummary` (Specialist → Master): `load`, `progress`,
    `risk`, `recommendation`, `confidence`, `reasons` — rijker dan het
    eerdere illustratieve voorbeeld, sluit aan bij het bestaande
    `EngineResult`-patroon
  - **Expliciet onderscheid van de Decision Engine:** dit contract geldt
    al bij 1 specialist; Decision Engine gebruikt straks meerdere
    `SpecialistSummary`'s als input zodra er 2+ specialisten tegelijk
    actief zijn — een laag erboven, geen vervanging

**Up-to-date sweep, zoals gevraagd — bijgewerkt waar verouderd:**
- `docs/specialist-api.md` — Fase 4-sectie herschreven: het generieke
  "specialist levert samenvatting"-voorbeeld vervangen door een
  verwijzing naar het nu concrete CoachPolicy/SpecialistSummary-contract
- `docs/specialist-decision-engine.md` — "Contract met Fase 4"-sectie
  bijgewerkt: `SpecialistSummary` expliciet gekoppeld aan
  `specialist-coach-policy.md` als bron, niet meer een los begrip
- `README.md` — Specialist-sectie grondig geactualiseerd:
  - 7 ontwerpdocumenten i.p.v. 6
  - **Correctie:** "Specialist Memory (apart ontworpen, nog niet
    gebouwd)" was verouderd — Memory Engine staat inmiddels op 4/5
    sub-stappen, nu correct weergegeven
  - Nieuwe Coach Policy-status toegevoegd

## v2.4.77 — "Hoe werkt CoachOS": nieuwe sectie over Specialisten
**Gebruikersgerichte uitleg, geen technische documentatie — dat blijft
in `docs/specialist-*.md`. Nieuwe vaste afspraak: deze pagina wordt
voortaan bijgewerkt zodra er gebruikersgerichte functionaliteit
verandert (nieuwe features, gewijzigd gedrag) — niet bij interne
refactors of debug-toevoegingen die voor de gebruiker onzichtbaar zijn.**

- `src/app/settings/hoe-werkt-het/page.tsx` — nieuwe sectie
  **"Specialisten — verdieping per sport"**, geplaatst na de bestaande
  "Coach AI"-sectie (logisch vervolg)
  - In warme, toegankelijke taal — geen technische termen als "Learning
    Engine" of "confirmation_count", wel de onderliggende concepten in
    gewone woorden: hoe activeer je, wat zie je in de Hub, hoe "leert"
    de coach patronen (met de meermaals-bevestiging-drempel uitgelegd
    zonder het als getal te noemen), hoe vertrouwen kan wegzakken, wat
    er gebeurt als je een tijd niet sport
  - Zelfde stijl/structuur/toon als bestaande secties (intro + meerdere
    alinea's, uitklapbare kaart)

**Overwogen en bewust niet gedaan:** hernoemen naar "Handleiding" — de
inhoud (bestaand en nieuw) is overwegend conceptuele uitleg ("waarom
werkt het zo"), geen taakgerichte instructies ("hoe doe ik X"). Naam
blijft "Hoe werkt CoachOS", tenzij hier later op teruggekomen wordt.

## v2.4.76 — Memory Engine, sub-stap 4/5: Confidence Engine
**Volledig deterministisch. Confidence stijgt bij elke bevestiging
(+15, max 100), daalt geleidelijk zonder bevestiging (-3 per volle week),
en zet `active`-items onder de ondergrens (15) automatisch naar
`deprecated`. Decay wordt LAZY berekend — bij het lezen van Memory, geen
achtergrond-cronjob nodig.**

- **Nieuw:** `src/lib/specialists/confidence-engine.ts`
  - `berekenNieuweConfidenceBijBevestiging()` — +15 per bevestiging,
    begrensd op 100
  - `berekenGedecayedeConfidence()` — -3 per volle week zonder
    herbevestiging, begrensd op 0
  - `herwaardeerMemory()` — herberekent alle `active`-items van een
    specialist, schrijft alleen weg wat daadwerkelijk verandert, zet
    items onder de ondergrens naar `deprecated`
- `src/lib/specialists/learning-engine.ts`
  - `verwerkKandidaatInzicht()` verhoogt nu ook confidence bij elke
    bevestiging (naast de bestaande `confirmation_count`-logica)
  - `haalMemoryOp()` roept `herwaardeerMemory()` aan vóór het lezen —
    decay is dus altijd actueel op het moment dat iets de Memory
    daadwerkelijk raadpleegt (bijv. straks de Coach Layer, sub-stap 5)

**Test-kanttekening:** de confidence-**stijging** is vandaag al
testbaar (via de bestaande sub-stap 2-testknop, herhaald indienen). De
confidence-**daling** vergt per ontwerp minimaal een week zonder
bevestiging om zichtbaar te worden — niet vandaag al te forceren zonder
de `last_confirmed_at`-waarde handmatig in het verleden te zetten.

**Volgende sub-stap (5/5, laatste):** terugkoppeling naar de Coach
Layer — bij het genereren van een nieuw advies leest de AI voortaan ook
`active`-Memory-items met hoge confidence, als extra context.

## v2.4.75 — Memory Engine, sub-stap 3/5: Coach Layer voorstelt kandidaat-inzichten
**De AI mag voortaan zelf kandidaat-inzichten voorstellen — schrijft
NOOIT rechtstreeks naar het geheugen. Elke kandidaat gaat verplicht door
de Learning Engine (sub-stap 2), die deterministisch beslist over
bevestiging/promotie. Exact zoals vastgelegd in
`specialist-memory.md`.**

- `src/app/api/specialists/cycling/coach/route.ts`
  - Prompt uitgebreid: AI mag max. 2 kandidaat-inzichten per keer
    voorstellen, alleen bij een **duurzaam patroon** (niet een eenmalige
    observatie), verplicht binnen één van drie vaste categorieën
    (`training_response`/`preference`/`risk_pattern`) — expliciet
    benadrukt in de prompt dat dit een *voorstel* is, geen vastgestelde
    waarheid
    - Lege array is de normale, verwachte situatie bij weinig data —
      geen druk om altijd iets te vinden
  - `kandidaat_inzichten` wordt **verwijderd** vóór opslag in
    `specialist_analyses.analysis` — dat blijft exact `CyclingCoachAdvies`,
    ongewijzigd. Kandidaten gaan uitsluitend naar de Learning Engine
  - Elke kandidaat: `knowledge_type` altijd `'soft'` (AI-voorgestelde
    inzichten zijn per definitie nooit hard knowledge — dat komt uit
    directe meting, niet AI-interpretatie, zie `specialist-memory.md`)
  - Ongeldige/lege kandidaten worden genegeerd, niet de hele call laten
    falen — AI-output is nooit 100% gegarandeerd correct gevormd
  - `leer_resultaten` toegevoegd aan de API-response (niet aan het
    opgeslagen record) — puur voor testbaarheid van deze stap

**⚠️ Test-kanttekening:** de bestaande 24-uur-cache (v2.4.67) betekent
dat een herhaalde test binnen 24 uur de **oude, gecachte** analyse
teruggeeft, zonder nieuwe AI-call en dus zonder nieuwe
`leer_resultaten`. Voor een schone test: wacht tot de cache verloopt, of
wijzig tijdelijk de cache-drempel voor testdoeleinden.

**Volgende sub-stap (4/5):** Confidence Engine — herweegt confidence over
tijd, zet `active`-items onder een ondergrens automatisch naar
`deprecated`.

## v2.4.74 — Memory Engine, sub-stap 2/5: Learning Engine
**Volledig deterministisch, geen AI. Bepaalt of een kandidaat-inzicht een
bevestiging is van een bestaand item, en promoveert `candidate` naar
`active` bij het bereiken van de drempel (3 bevestigingen).**

- **Nieuw:** `src/lib/specialists/learning-engine.ts`
  - `verwerkKandidaatInzicht()` — matcht op `user_id + specialist_type +
    category` (niet op de inzicht-tekst zelf, dat zou niet-
    deterministisch worden). Bestaand item → `confirmation_count` +1,
    meest recente formulering overschrijft de oudere, promotie naar
    `active` bij drempel. Geen bestaand item → nieuw `candidate`-item
    (of direct `active` bij `knowledge_type: 'hard'`, zoals vastgelegd
    in `specialist-memory.md`: één geldige observatie volstaat voor
    objectief bewezen feiten)
  - **Eerlijk gevlagde beperking:** category-based matching behandelt
    twee écht verschillende inzichten binnen dezelfde category als
    hetzelfde (nieuwste overschrijft oudste). Redelijk startpunt voor nu
    (categorieën zijn bewust grof), maar geen perfecte oplossing
  - `haalMemoryOp()` — leeshelper, gebruikt door de nieuwe route en later
    door sub-stap 5 (terugkoppeling naar Coach Layer)
- **Nieuw:** `src/app/api/specialists/cycling/memory/route.ts`
  - `GET` — huidige Memory-staat
  - `POST` — **tijdelijk**, handmatig een kandidaat-inzicht indienen,
    totdat sub-stap 3 de Coach Layer koppelt zodat de AI dit automatisch
    doet
- `src/app/debug/page.tsx` — testsectie: kandidaat indienen (met vaste
  velden, 3x hetzelfde `category` indienen laat de promotie zien) +
  Memory ophalen

**Volgende sub-stap (3/5):** Cycling Coach Layer uitbreiden zodat de AI
zelf kandidaat-inzichten voorstelt, apart van het gewone advies.

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
