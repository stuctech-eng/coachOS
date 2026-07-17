# CoachOS Specialist Coach Platform — API-architectuur

**Status: ONTWERPFASE — NOG GEEN CODE (op het moment van origineel
schrijven — inmiddels ingehaald door de werkelijkheid: Fase 1-3 zijn
gebouwd in de Cycling-referentie-implementatie, v2.4.60-69)**

**⚠️ Reconstructie-notitie (v2.4.71, aangescherpt v2.4.72):** dit
document bleek nooit daadwerkelijk gecommit in de repository, ondanks
eerdere levering en goedkeuring — gereconstrueerd vanuit de
conversatiegeschiedenis. **Versieclaims (v2.4.60 etc.) hieronder zijn
geverifieerd** — rechtstreeks gecontroleerd tegen de GitHub-repo
(HTTP 200 op elk genoemd bestand) en bevestigd door live tests tijdens
de sessie zelf, niet slechts beweerd. Na reconstructie volgde een
inhoudelijke review met vijf aanscherpingen (v2.4.72): nuancering van
"AI berekent nooit", generieke rekenbibliotheek, Global vs. Specialist
Goals, Capability-gedreven Hub in plaats van vaste modulelijst, en de
Decision Engine expliciet in de Fase 4-flow.

Vervolg op `docs/specialist-coaches.md` (architectuurprincipe) en
`docs/specialist-database-design.md` (database-ontwerp, uitgevoerd als
SQL, v2.4.59).

**Kernprincipe, leidend voor de hele API-structuur:**
> **Data is de bron van waarheid. AI interpreteert, maar rekent nooit.**

Dit is een directe uitbreiding van het bestaande CoachOS-principe
("Bibliotheken zijn de bron van waarheid, AI verzint geen oefeningen")
naar de analyse-kant.

**Het kernprincipe, preciezer geformuleerd (v2.4.72-aanscherping):**
> Alle bedrijfskritische berekeningen, trends, scores en beslislogica
> worden deterministisch uitgevoerd. AI mag deze niet vervangen.

**Waarom deze nuance:** de eerdere formulering "AI berekent nooit" was
architectonisch bedoeld als harde grens tegen AI die zelf trends/cijfers
verzint — maar in de praktijk kan AI best eenvoudige afleidingen of
samenvattingen maken (bijv. "dit is drie weken op rij hoger" als
observatie in lopende tekst). Het punt is niet dat AI nooit iets
telt of vergelijkt in zijn formuleringen — het punt is dat AI nooit de
**bron van waarheid** wordt voor een cijfer, trend, score of beslissing
die het systeem daadwerkelijk gebruikt. Die blijven altijd
deterministisch. Deze nuance voorkomt dat de regel later onnodig
beperkend blijkt voor legitieme, kleine interpretatieve stappen binnen
de Coach Layer.

**Concreet, wat nog steeds altijd deterministisch blijft (ongewijzigd):**
- Trends
- Grafieken
- FTP
- TSS (Training Stress Score)
- Periodisering
- Vermogenscurves
- Trainingsbelasting

Al deze berekeningen komen **uitsluitend** uit de Data Engine of
Specialist Engine — nooit uit een AI-prompt die zelf cijfers moet
interpreteren of afleiden uit ruwe data.

---

## Overzicht — vijf lagen

```
Fase 1: Specialist Registry     → wie is actief, welke doelen/voorkeuren
Fase 2a: Data Engine             → verzamelt data, GEEN berekening
Fase 2b: Specialist Engine       → sport-specifieke berekeningen
Fase 3: Specialist AI (Coach Layer) → interpreteert, rekent nooit
Fase 4: Master Coach Orchestrator → vraagt specialisten om een samenvatting
```

Plus twee **cross-cutting** concepten die niet in deze lineaire keten
passen, maar wel bij elke specialist horen: **Goal Engine** (hieronder)
en **Specialist Memory** (apart uitgewerkt in `specialist-memory.md`,
inclusief de Confidence Engine en — als toekomstig concept — de
Maturity Engine).

---

## Fase 1 — Specialist Registry ✅ Gebouwd (v2.4.60)

**Route:** `src/app/api/specialists/route.ts`

**Verantwoordelijk voor:** puur beheer, **geen AI, geen berekeningen.**
- Welke specialisten zijn actief voor deze gebruiker
- Activeren/deactiveren
- Doelen (via bestaande `user_goals`, geen apart veld hier — zie
  `specialist-database-design.md` §3.2)
- Voorkeuren (`specialist_profiles.preferences`)
- Status

**Endpoints:**

| Methode | Doel |
|---|---|
| `GET` | Lijst specialisten voor de gebruiker: actief + beschikbaar-maar-niet-actief (uit vaste code-config) — sinds v2.4.70 ook uitgebreid met Lifecycle-state per specialist |
| `POST` | Activeer/deactiveer een specialist. Body: `{ specialist_type, active }`. Schrijft naar `specialist_profiles` (upsert, unieke constraint `user_id + specialist_type`) |

**Roept nooit een AI aan.**

---

## Fase 2a — Data Engine ✅ Gebouwd (v2.4.61, Cycling)

**Route:** `src/app/api/specialists/[type]/data/route.ts`

**Verantwoordelijk voor:** uitsluitend **verzamelen en filteren.** Geen
sport-specifieke berekeningen — dat is de taak van Fase 2b.

- Ruwe data ophalen uit bestaande tabellen (`activity_sessions`,
  `training_results`), gefilterd op sport en periode
- Geen interpretatie, geen trends, geen afgeleide metrics

**Roept nooit een AI aan, berekent zelf niets.**

---

## Fase 2b — Specialist Engine ✅ Gebouwd (v2.4.66, Cycling)

**Verantwoordelijk voor:** alle sport-specifieke berekeningen —
**volledig deterministisch, geen AI.** Eén losse engine per sport, niet
één generieke engine voor alles.

**Belangrijke kanttekening, herbevestigd:** geavanceerde metrics als
**FTP, TSS, CTL** vereisen een expliciet ingesteld FTP-getal per
gebruiker — niet bevestigd aanwezig in CoachOS op het moment van
schrijven. Eenvoudigere metrics (frequentie, gemiddeld/max vermogen,
trend, afstand, trainingsbelasting) zijn wel direct mogelijk — en zijn
exact wat in de Cycling Analysis Engine is gebouwd.

**Waarom volledig los van Fase 2a:** maakt de sport-specifieke
rekenlogica **volledig testbaar zonder AI en zonder database.**

**Generieke rekenbibliotheek, aanvulling (v2.4.72):** "één losse engine
per sport" betekent niet dat elke sport-engine alles opnieuw uitvindt.
Terugkerende berekeningen — trendberekening, voortschrijdend gemiddelde
(moving average), rolling windows, basisperiodisering-logica — horen
thuis in een **gedeelde, generieke rekenbibliotheek**, die elke
sport-specifieke engine aanroept. De Cycling Analysis Engine (v2.4.66)
heeft dit onderscheid nog niet expliciet doorgevoerd (de trend- en
gemiddelde-berekeningen staan nu inline in `cycling-analysis.ts`) —
bij de bouw van een tweede specialist is dit het moment om deze
generieke stukken te extraheren naar bijvoorbeeld
`src/lib/specialists/rekenbibliotheek.ts`, zodat Running/Rowing/Strength
niet dezelfde trendlogica opnieuw hoeven te schrijven. Onderscheid dus:
- **Generieke rekenbibliotheek** — sport-onafhankelijk (trend, moving
  average, rolling window)
- **Sport-specifieke implementatie** — welke velden, welke drempels,
  welke metrics relevant zijn per discipline

**Roept nooit een AI aan.**

---

## Fase 3 — Specialist AI / Coach Layer ✅ Gebouwd (v2.4.67, Cycling)

**Route:** `src/app/api/specialists/[type]/coach/route.ts`

**Pas hier komt Claude erbij.** Roept intern Fase 2a + 2b aan en
**interpreteert** de al-berekende cijfers — voert zelf nooit een
berekening uit.

**Input:**
- Specialist Engine-output (Fase 2b)
- Doelen + voortgang (`user_goals` + Goal Engine-output, zie hieronder)
- Voorkeuren (`specialist_profiles.preferences`)
- Specialist Memory (zodra gebouwd, zie `specialist-memory.md`)
- Coach Personality — hergebruikt uit de bestaande
  `coach-personality.ts` (`COACH_CORE_IDENTITY`, `CORE_SAFETY_RULE`,
  `getCoachTone`), geen nieuwe stem
- Optioneel: Master Coach-context — precieze doorgifte-vorm bij Fase 4

**Output:** coaching, advies, motivatie, uitleg, planning.

**Endpoints:**

| Methode | Doel |
|---|---|
| `GET` | Meest recente specialist-analyse ophalen (`specialist_analyses`) |
| `POST` | Nieuwe analyse genereren — cache-patroon zoals `progress-analysis/route.ts`, roept intern Fase 2a+2b aan, dan de AI, slaat op |

**Schrijft:** `specialist_analyses`.

---

## Goal Engine — cross-cutting, deterministisch

**Concept:** niet alleen doelen *opslaan* (dat doet `user_goals` al),
maar actief *berekenen*:
- Ligt de gebruiker op schema?
- Hoeveel weken nog tot de streefdatum?
- Moet periodisering worden aangepast?
- Moet belasting omhoog of omlaag?

**Aanscherping (v2.4.72): onderscheid Global Goals vs. Specialist
Goals.** De oorspronkelijke opzet koppelde de Goal Engine uitsluitend
aan specialisten — maar niet elk doel is sportspecifiek. De Master
Coach heeft óók doelen nodig die geen enkele specialist "bezit":
- **Global Goals** (Master Coach-niveau) — bijv. minder stress, beter
  slapen, algeheel fitter worden, afvallen (dat laatste kán aan een
  specialist raken, maar is niet per se sport-gebonden)
- **Specialist Goals** (specialist-niveau) — bijv. FTP-target, 5km-PR,
  een specifiek wedstrijddoel

Beide leven in dezelfde `user_goals`-tabel (geen aparte tabel nodig,
zie `specialist-database-design.md` §3.2) — het onderscheid zit in
**wie de voortgang berekent en gebruikt**, niet in de opslag zelf.
Global Goals worden gelezen/berekend richting de Master Coach
(toekomstige Fase 4-integratie), Specialist Goals richting de
betreffende specialist (Fase 3, Coach Layer). Exacte
onderscheidingslogica (bijv. via `goal_type`-conventie) nog niet
uitgewerkt — vergt bevestiging bij implementatie.

**Plek in de architectuur:** volledig deterministisch — geen AI. Leest
`user_goals` (gefilterd op specialist óf op "algemeen") + Specialist
Engine-output (Fase 2b) voor de specialist-variant.

**Status:** ontworpen, **nog niet gebouwd** — de Cycling-referentie-
implementatie (v2.4.60-69) nam alleen doelen als lichte, ruwe context
mee in de Coach Layer-prompt, geen aparte deterministische
voortgangsberekening, en nog geen Global/Specialist-onderscheid.

**Roept nooit een AI aan.**

---

## Fase 4 — Master Coach Orchestrator ⏳ Nog niet gebouwd

**Raakt:** `src/app/api/coach/route.ts` (bestaand, **bewust nog niet
gewijzigd** — vereist expliciete, aparte afstemming vóórdat hieraan
begonnen wordt, aangezien dit bestaande, actieve productiecode raakt).

**Principe, verder aangescherpt (v2.4.78) — het contract is nu
tweerichtings en expliciet vastgelegd in een eigen document,
`specialist-coach-policy.md`:**

```
Master Coach Engine (deterministisch)
   ↓
CoachPolicy               ← beleid, geen ruwe data ("max intensiteit: matig",
   ↓                          niet "HRV = 45ms")
Specialist(en) (AI)        ← optimaliseert binnen de policy-grenzen
   ↓
SpecialistSummary           ← gestructureerde terugkoppeling
   ↓
Decision Engine              ← ALLEEN relevant bij 2+ gelijktijdig actieve
   ↓                            specialisten, kiest tussen hun summaries
Master Coach (AI)             ← integreert tot één coherent advies
```

**Belangrijk onderscheid, verduidelijkt (v2.4.78):** `CoachPolicy`/
`SpecialistSummary` is **niet** de Decision Engine. Het is het contract
tussen de Master Coach en **één** specialist, en geldt al bij precies
één actieve specialist (de huidige situatie). De Decision Engine
gebruikt straks meerdere `SpecialistSummary`'s als input zodra er
meerdere specialisten tegelijk actief zijn — een laag bovenop dit
contract, geen vervanging ervan. Zie `specialist-coach-policy.md` voor
de volledige uitwerking, inclusief de exacte interfaces en de
bevestiging dat `CoachPolicy`-generatie **volledig deterministisch** is
(bouwt voort op de bestaande `calculateRecoveryScore()`,
géén AI-aanroep).

**Kostenbewuste routing:** de Master Coach roept bij een dagelijks
advies nooit Fase 3 opnieuw aan — hij leest de laatst gegenereerde,
al-opgeslagen samenvatting uit `specialist_analyses`.

**Zie ook:**
- `specialist-coach-policy.md` — het volledige CoachPolicy/
  SpecialistSummary-contract, met interfaces en implementatievolgorde
- `specialist-decision-engine.md` — de `DecisionResult`-structuur voor
  wanneer meerdere specialisten conflicteren, en de precisering dat de
  Master Coach de geselecteerde uitkomsten *integreert*, niet slechts
  verwoordt

---

## Hub-structuur — capabilities, geen vaste modulelijst

**Aanvulling op `specialist-coaches.md` §6, herzien (v2.4.72).** De
oorspronkelijke formulering hierboven beschreef één vaste lijst modules
die "elke Hub uiteindelijk krijgt" — dat suggereert ten onrechte dat
elke specialist naar dezelfde eindvorm toegroeit. In werkelijkheid
verschillen specialisten fundamenteel in wat relevant is:

**Preciezere formulering: een specialist publiceert zijn eigen
capabilities, geen vaste lijst.** Voorbeelden, illustratief:

```
Cycling:
  Dashboard, Records, Grafieken, FTP, Wedstrijden

Nutrition (toekomstig):
  Maaltijden, Macro's, Recepten

Recovery (toekomstig):
  Slaap, HRV, Herstel
```

**De Capability Registry (zie `specialist-engine-architecture.md`) is
hierin leidend** — niet een gedeelde modulelijst waar elke specialist
uit put, maar per specialist een eigen, expliciete set. Terugkerende
bouwstenen (Dashboard, Coach, Instellingen) komen in de praktijk
waarschijnlijk bij de meeste specialisten voor, maar dat is een
**toevallig gevolg** van gedeelde behoeften, geen architecturale eis dat
elke specialist ze allemaal moet hebben.

**Status:** de Cycling Hub (v2.4.68) implementeert een eerste, beperkte
capability-set — Dashboard + Coach-advies + basisstatistieken. De
Capability Registry (`capability-registry.ts`) legt op dit moment al
eerlijk vast welke geavanceerde capabilities (periodisering, events,
predictions, benchmarks) nog `false` staan voor Cycling — consistent met
dit herziene principe.

---

## Event Engine — toekomstige uitbreiding, NIET nu

Elke specialist kan uiteindelijk wedstrijden/evenementen beheren
(marathon, triathlon, tijdrit, Gran Fondo, Hyrox, 10km) en automatisch
naartoe bouwen. Al genoemd als "Event Planning" in `specialist-coaches.md`
§9 (Toekomstige uitbreidingen) — deze sectie bevestigt alleen dat het
daar blijft, geen onderdeel van de huidige implementatiestappen.

---

## Endpoints — overzicht (bijgewerkt met gebouwde status)

| Endpoint | Fase | AI? | Status |
|---|---|---|---|
| `GET/POST /api/specialists` | 1 — Registry | Nee | ✅ v2.4.60, uitgebreid v2.4.70 (Lifecycle) |
| `GET /api/specialists/cycling/data` | 2a — Data Engine | Nee | ✅ v2.4.61 |
| `GET /api/specialists/cycling/engine` | 2b — Specialist Engine | Nee | ✅ v2.4.66 |
| *(cross-cutting)* Goal Engine | — | Nee | ⏳ Ontworpen, niet gebouwd |
| `GET/POST /api/specialists/cycling/coach` | 3 — Specialist AI | Ja | ✅ v2.4.67 |
| *(later)* `api/coach/route.ts` | 4 — Orchestrator | Ja (bestaand) | ⏳ Vereist aparte afstemming |

---

## Relatie tot eerder goedgekeurde documenten

- **`specialist-coaches.md`** — rollen blijven ongewijzigd. Hub-structuur
  hierboven is een concretisering van §6.
- **`specialist-database-design.md`** — de twee tabellen worden gebruikt
  zoals ontworpen.
- **`specialist-memory.md`** — bevat de volledige uitwerking van
  Specialist Memory, Learning Engine, Confidence Engine, en (als
  toekomstig concept) de Maturity Engine — destijds als open punt
  vanuit dit document doorverwezen, inmiddels apart volledig uitgewerkt.
- **`specialist-coach-policy.md`** (nieuw, v2.4.78) — het deterministische
  CoachPolicy/SpecialistSummary-contract tussen Master Coach en één
  specialist, het daadwerkelijke Fase 4-mechanisme.
- **`specialist-decision-engine.md`** — conflictresolutie tussen
  meerdere specialisten, gebruikt de SpecialistSummary's uit
  `specialist-coach-policy.md` als input, raakt het Fase 4-contract
  hierboven.
- **`specialist-engine-architecture.md`** — het herbruikbare
  engine-patroon (uniform `EngineResult`-datacontract), Capability
  Registry, en de bevestiging dat Coach Personality wordt hergebruikt.

---

## Status sinds origineel schrijven

Dit document beschreef oorspronkelijk een **ontwerp**. Sindsdien is de
Cycling-referentie-implementatie volledig doorlopen (v2.4.60-70):
Fase 1, 2a, 2b en 3 zijn gebouwd en getest; Fase 4, Goal Engine, en de
volledige Hub-modules-set zijn dat nog niet. Zie `README.md` voor de
actuele, altijd bijgewerkte voortgangsstatus.
