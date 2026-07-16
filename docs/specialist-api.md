# CoachOS Specialist Coach Platform — API-architectuur

**Status: ONTWERPFASE — NOG GEEN CODE (op het moment van origineel
schrijven — inmiddels ingehaald door de werkelijkheid: Fase 1-3 zijn
gebouwd in de Cycling-referentie-implementatie, v2.4.60-69)**

**⚠️ Reconstructie-notitie (v2.4.71):** dit document bleek nooit
daadwerkelijk gecommit in de repository, ondanks eerdere levering en
goedkeuring. Onderstaande is een **goede-trouw-reconstructie** vanuit de
conversatiegeschiedenis — geen byte-perfecte kopie van het origineel.
Structuur en inhoud zijn zo getrouw mogelijk gereconstrueerd; kleine
formuleringsverschillen ten opzichte van wat oorspronkelijk is
goedgekeurd zijn mogelijk.

Vervolg op `docs/specialist-coaches.md` (architectuurprincipe) en
`docs/specialist-database-design.md` (database-ontwerp, uitgevoerd als
SQL, v2.4.59).

**Kernprincipe, leidend voor de hele API-structuur:**
> **Data is de bron van waarheid. AI interpreteert, maar rekent nooit.**

Dit is een directe uitbreiding van het bestaande CoachOS-principe
("Bibliotheken zijn de bron van waarheid, AI verzint geen oefeningen")
naar de analyse-kant.

**Expliciet, om geen ruimte voor interpretatie te laten — AI berekent
nooit:**
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

**Plek in de architectuur:** volledig deterministisch — geen AI. Hoort
logisch bij de specialist, niet bij de Master Coach. Leest `user_goals`
(gefilterd op deze specialist) + Specialist Engine-output (Fase 2b).

**Status:** ontworpen, **nog niet gebouwd** — de Cycling-referentie-
implementatie (v2.4.60-69) nam alleen doelen als lichte, ruwe context
mee in de Coach Layer-prompt, geen aparte deterministische
voortgangsberekening. Vergt een eigen implementatiestap.

**Roept nooit een AI aan.**

---

## Fase 4 — Master Coach Orchestrator ⏳ Nog niet gebouwd

**Raakt:** `src/app/api/coach/route.ts` (bestaand, **bewust nog niet
gewijzigd** — vereist expliciete, aparte afstemming vóórdat hieraan
begonnen wordt, aangezien dit bestaande, actieve productiecode raakt).

**Principe:** de Master Coach vraagt **nooit rechtstreeks de database
uit** voor specialistische kennis. Hij vraagt een specialist om een
**samenvatting**, geen ruwe data.

```
Cycling Coach-samenvatting:
  Belasting: hoog
  Progressie: +8%
  Herstel: voldoende
  FTP: +12 watt
  Aanbeveling: geen intensieve intervallen vandaag
```

**Kostenbewuste routing:** de Master Coach roept bij een dagelijks
advies nooit Fase 3 opnieuw aan — hij leest de laatst gegenereerde,
al-opgeslagen samenvatting uit `specialist_analyses`.

**Zie ook:** `specialist-decision-engine.md` voor hoe conflicten tussen
meerdere gelijktijdig actieve specialisten worden opgelost (relevant
zodra een 2e specialist naast Cycling actief kan zijn) — inclusief de
`DecisionResult`-structuur en de precisering dat de Master Coach de
geselecteerde uitkomsten *integreert* tot één coherent advies, niet
slechts verwoordt.

---

## Hub-structuur — standaardisatie per specialist

**Aanvulling op `specialist-coaches.md` §6.** Elke Hub krijgt uiteindelijk
dezelfde vaste structuur, opgebouwd uit **modules** (niet vaste,
hardgecodeerde pagina's — een specialist *activeert* modules):

- Dashboard
- Training Plan
- Periodisering
- Grafieken
- Wedstrijden (Event Engine, toekomstig)
- Persoonlijke inzichten (Memory, zodra gebouwd)
- Coach
- Bibliotheek (discipline-specifieke oefeningen/drills)
- Records
- Doelen
- Instellingen

**Status:** de Cycling Hub (v2.4.68) implementeert een eerste, beperkte
versie — Dashboard + Coach-advies + basisstatistieken. De overige
modules zijn nog niet gebouwd, welke een specialist toont wordt bepaald
door de **Capability Registry** (zie `specialist-engine-architecture.md`
— daar verder uitgewerkt met concrete velden als `supportsPeriodization`
etc.).

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
- **`specialist-decision-engine.md`** — conflictresolutie tussen
  meerdere specialisten, raakt het Fase 4-contract hierboven.
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
