# CoachOS Specialist Coach Platform — Engine-architectuur

**Status: ONTWERPFASE — NOG GEEN CODE**
**Laatste ontwerpdocument vóór de ontwerpstop — zie slot van dit document.**

Vervolg op alle vier voorgaande documenten. Dit document legt vast hoe de
losse engines (Data, Analysis, Learning, Confidence, Decision) een
**herbruikbaar patroon** vormen, zodat een nieuwe specialist (Nutrition,
Swimming, Triathlon, ...) later kan worden toegevoegd door dat patroon
in te vullen, niet door de architectuur opnieuw te ontwerpen.

---

## Het herbruikbare patroon — één interface, veel invullingen

Elke sport-specifieke engine (Cycling Engine, Running Engine, Rowing
Engine, ...) implementeert **dezelfde structuur**, alleen met andere
sport-specifieke logica erin. Dit is vergelijkbaar met hoe de bestaande
bibliotheken (`kettlebell-exercises.ts`, `running-drills.ts`,
`rowing-drills.ts`) allemaal hetzelfde soort `filter`/`formateerVoorPrompt`-
patroon volgen, elk met hun eigen inhoud.

**Verplichte, uniforme output-vorm voor elke engine-laag**, ongeacht
sport (dit is de Explainability-ontwerpregel uit
`specialist-decision-engine.md`, hier geconcretiseerd als een vast
datacontract):

```ts
interface EngineResult<T> {
  resultaat: T                    // het eigenlijke, sport-specifieke resultaat
  confidence?: number             // waar van toepassing (Confidence Engine-laag)
  reden: string[]                 // waarom deze conclusie — altijd verplicht
  databronnen: string[]           // welke tabellen/velden zijn gebruikt
  gegenereerd_op: string          // ISO-timestamp
}
```

Elke engine in de pijplijn (Data → Analysis → Learning → Confidence →
Decision) geeft dit vorm terug, ook als `resultaat` zelf sterk verschilt
per sport. Dit maakt elke laag **testbaar met een vaste verwachting**,
ongeacht welke specialist er "achter" zit.

---

## Hoe de vijf engines samenwerken — herbevestiging + concretisering

```
Data Engine        → ruwe, gefilterde data (geen berekening)
   ↓
Analysis Engine     → sport-specifieke berekeningen (trends, belasting)
   ↓
Learning Engine     → herkent kandidaat-patronen voor het geheugen
   ↓
Confidence Engine   → weegt hoe zeker een patroon is, over tijd
   ↓
(Coach Layer / AI)  → interpreteert, verwoordt, stelt samenvatting op
   ↓
Decision Engine     → bij meerdere specialisten: bepaalt wie voorrang krijgt
   ↓
Master Coach        → verwoordt eindresultaat richting gebruiker
```

**Waar elke engine wel/niet AI gebruikt** (herbevestiging, nu in één
overzicht):

| Engine | AI? | Reden |
|---|---|---|
| Data Engine | Nee | Puur verzamelen/filteren |
| Analysis Engine | Nee | Deterministische berekening (trends, TSS, etc.) |
| Learning Engine | Nee | Regelgebaseerde kandidaat-drempel |
| Confidence Engine | Nee | Regelgebaseerde weging/decay |
| Coach Layer | **Ja** | Enige plek waar AI daadwerkelijk genereert/interpreteert |
| Decision Engine | Nee | Vaste prioriteitsregels (zie vorig document) |
| Master Coach | **Ja** (bestaand) | Verwoordt eindresultaat, herroept Decision Engine-uitkomst niet |

**Slechts twee van de zeven lagen gebruiken AI.** De rest is bewust
volledig deterministisch — dit is de kern van "data is bron van
waarheid, AI rekent nooit", nu zichtbaar in de volledige keten.

---

## Coach Personality — hergebruik, geen nieuwe laag

**Bevestigd via `src/core/prompts/coach-personality.ts` (bestaand,
opgehaald en gelezen):** CoachOS heeft al een doordacht,
niveau-gebaseerd personality-systeem (`COACH_CORE_IDENTITY`,
`CORE_SAFETY_RULE`, drie toonniveaus, een deterministisch
`mayUsePlayfulHumor`-filter).

**Vaste regel voor de Coach Layer (Fase 3) van elke specialist:**
- Importeert en gebruikt **dezelfde** `COACH_CORE_IDENTITY` +
  `CORE_SAFETY_RULE` als de Master Coach
- Krijgt **geen eigen persoonlijkheid** — een specialist voegt
  vakkennis toe, geen andere stem
- Toonniveau (waarschijnlijk Niveau 2, "Coach" — te bevestigen bij
  implementatie, afhankelijk van de context waarin een specialist-advies
  wordt getoond)

Dit voorkomt exact het risico dat de gebruiker "tien verschillende AI's"
ervaart in plaats van één coach met specialistische kennis — het
kernprincipe uit `specialist-coaches.md` §1, nu technisch geborgd door
letterlijk dezelfde personality-module te hergebruiken.

---

## Herbruikbaarheid voor toekomstige specialisten

**Wat een nieuwe specialist (bijv. Nutrition Coach) moet invullen om
toegevoegd te worden, gegeven dit patroon:**

1. Een `NutritionDataEngine` — welke tabellen/velden zijn relevant
   (waarschijnlijk voedingslogboek, indien dat al bestaat — niet
   geverifieerd, buiten scope van dit document)
2. Een `NutritionAnalysisEngine` — welke berekeningen zijn
   voedingsspecifiek (bijv. calorieën-trend, macro-verdeling)
3. Learning/Confidence Engine — **generiek herbruikbaar**, geen
   nieuwe implementatie nodig (dezelfde drempel-/decay-logica werkt
   voor elk type patroon, ongeacht sport/discipline)
4. Coach Layer-prompt — nieuwe, voedingsspecifieke system-prompt, met
   `COACH_CORE_IDENTITY` als basis (hergebruikt, niet herschreven)
5. Decision Engine — **geen wijziging nodig**, de vijf prioriteitsregels
   zijn al generiek geformuleerd (gezondheid, blessures, herstel,
   lange termijn, gebruikersdoel) — een Nutrition-advies wordt door
   dezelfde regels gewogen als een Cycling-advies

**Concreet: stappen 3 en 5 zijn al "af" voor elke toekomstige
specialist** — alleen stappen 1, 2 en 4 zijn per specialist uniek werk.
Dat is precies de schaalbaarheid die met dit ontwerp werd beoogd.

---

## Capability Registry — voorkomt eindeloze if-specialist-constructies

**Probleem dat dit oplost:** niet elke specialist ondersteunt dezelfde
functies. Cycling heeft periodisering, FTP, wedstrijden, pacing.
Nutrition heeft periodisering en macro's, maar geen FTP. Zonder
centrale registratie zou de Hub-code vol komen te staan met
`if (specialist === 'cycling') { toon FTP-kaart }`-constructies, per
functie, per specialist.

**Oplossing — centraal vastgelegde capabilities per specialist:**

```
cycling:
  supportsPeriodization: true
  supportsEvents: true
  supportsPredictions: true
  supportsBenchmarks: true

running:
  supportsPeriodization: true
  supportsEvents: true
  supportsPredictions: false   // nog niet geïmplementeerd voor deze sport
  supportsBenchmarks: true

nutrition:
  supportsPeriodization: true
  supportsEvents: false
  supportsPredictions: false
  supportsBenchmarks: false
```

**Gevolg:** de Hub kan simpelweg vragen "ondersteunt deze specialist
periodisering?" en automatisch de juiste kaarten tonen — geen
sport-specifieke logica in de UI-laag, alleen een lookup in deze
registry. Leeft naast de vaste code-config uit Fase 1 (Specialist
Registry, `specialist-api.md`) — die zegt *welke* specialisten bestaan,
dit zegt *wat elke specialist kan*.

---

## Hub als verzameling modules, niet vaste pagina's

**Aanscherping op de Hub-structuur uit `specialist-coaches.md` §6:** een
Hub bestaat uit **modules**, en een specialist **activeert** modules —
niet losse, hardgecodeerde pagina's.

```
Cycling Hub, mogelijke modules:
  Dashboard
  Training Plan
  Periodisering
  Grafieken
  Wedstrijden
  Persoonlijke inzichten
  Coach
  Instellingen
```

Welke modules daadwerkelijk verschijnen voor een specifieke specialist
volgt rechtstreeks uit de Capability Registry hierboven — een
specialist zonder `supportsEvents` toont simpelweg geen
"Wedstrijden"-module. Dit maakt de Hub-UI **flexibel** in plaats van
per-specialist-hardgecodeerd.

---

## Event sourcing — ontwerpregel voor later, niet nu bouwen

**Belangrijk: dit is een architectuurprincipe om nu al rekening mee te
houden in hoe engines met elkaar communiceren, niet iets dat in de
eerste implementatie al volledig gebouwd wordt.**

**Regel:** geen engine schrijft ooit direct in het werkgeheugen van een
andere engine, en roept een andere engine nooit rechtstreeks aan om iets
te laten *gebeuren*. In plaats daarvan **publiceert** elke engine een
gebeurtenis; andere engines die geïnteresseerd zijn, luisteren
daarnaar.

**Voorbeeld-events:**
```
ActivityImported    → een nieuwe activiteit is binnengekomen
AnalysisUpdated      → de Analysis Engine heeft een nieuwe berekening klaar
MemoryUpdated         → de Knowledge Base heeft een inzicht bijgewerkt
GoalReached            → een doel is behaald
RecoveryChanged          → het herstelsignaal is veranderd
```

**Waarom dit een ontwerpregel is, geen bouwstap:** de eerste
referentie-implementatie (Cycling) kan **prima beginnen met directe
functieaanroepen** tussen de engines (Data Engine → Analysis Engine →
etc., zoals in de rest van dit document beschreven) — dat is eenvoudiger
en sneller te bouwen. Event-gebaseerde ontkoppeling wordt pas waardevol
zodra er **meerdere specialisten tegelijk** actief zijn en op elkaars
gebeurtenissen moeten reageren (bijv. Recovery Engine die luistert naar
`ActivityImported` van Cycling). **Vastgelegd nu als richting, niet als
vereiste voor de eerste implementatie** — voorkomt dat een latere
overstap naar event-gebaseerde communicatie een herontwerp vereist,
zonder dat de eerste, simpelere implementatie daar nu al onder gebukt
hoeft te gaan.

---

## Versionering van analyses

**Ontbrekend stuk, nu toegevoegd:** elke analyse (Analysis Engine-
output, uiteindelijk opgeslagen in `specialist_analyses`) krijgt
versie-metadata:

```ts
interface AnalysisVersioning {
  engineVersion: string     // bijv. 'cycling-engine-1.0'
  promptVersion: string     // welke AI-prompt-versie (Coach Layer)
  algorithmVersion: string  // welke berekeningsformule (Analysis Engine)
  generatedAt: string       // ISO-timestamp
}
```

**Waarom dit belangrijk is:** als de Analysis Engine over een jaar
verbetert (bijv. een nauwkeurigere TSS-formule), kun je exact zien met
welke versie een historisch advies tot stand kwam — waardevol voor
reproduceerbaarheid, debugging, en om te begrijpen waarom een oud advies
misschien niet meer overeenkomt met hoe het systeem nu zou rekenen.

**Praktische implicatie voor het datamodel:** dit voegt drie velden toe
aan `specialist_analyses` (`engine_version`, `prompt_version`,
`algorithm_version`) — geen nieuwe tabel, een kleine uitbreiding bij de
uiteindelijke SQL-implementatie van de referentie-specialist.

---

## Wat hier bewust NIET wordt vastgelegd

- **Exacte TypeScript-interfaces/bestandsnamen** — dat is
  implementatiedetail, hoort bij de daadwerkelijke code, niet bij dit
  ontwerpdocument
- **Prediction Engine, Simulation Engine** — bevestigd als toekomstige
  uitbreidingen zonder architectuurimpact nu, blijven in
  `specialist-coaches.md` §9 genoemd, niet hier uitgewerkt
- **Concrete formules** (confidence-decay, TSS-berekening) — horen bij
  de implementatie van de referentie-specialist (volgende stap), waar ze
  tegen echte data getest kunnen worden — vastleggen vóór die toets zou
  gokken zijn

---

## Ontwerpstop

**Dit is het laatste ontwerpdocument vóór implementatie**, inclusief een
laatste aanscherpingsronde (`DecisionResult`-structuur, de integrerende
rol van de Master Coach, Capability Registry, Hub-modules, Event
sourcing als toekomstige ontwerpregel, analyse-versionering) — allemaal
generieke infrastructuur die weinig complexiteit toevoegt maar later
waardevol is. Zes documenten liggen nu vast:

1. ✅ `specialist-coaches.md` — architectuur, rollen, activatiemodel
2. ✅ `specialist-database-design.md` — database (SQL uitgevoerd, v2.4.59)
3. ✅ `specialist-api.md` — API-lagen, endpoints
4. ✅ `specialist-memory.md` — geheugen, Learning + Confidence Engine
5. ✅ `specialist-decision-engine.md` — conflictresolutie, DecisionResult, Master Coach-integratierol
6. ✅ Dit document — herbruikbaar engine-patroon, Capability Registry, Hub-modules, Event sourcing, versionering

**Vanaf hier: bouwen, niet meer ontwerpen.** Volgende stap:
**Cycling** als referentie-specialist volledig implementeren, verticaal
van database tot Hub — gekozen omdat deze discipline de rijkste
combinatie heeft van data, grafieken, periodisering en specialistische
logica, waardoor eventuele architectuur-hiaten hier het snelst zichtbaar
worden. Als Cycling goed werkt, zijn Running, Rowing en overige
specialisten grotendeels een invuloefening binnen dezelfde architectuur
— zoals de Herbruikbaarheid-sectie hierboven al concreet maakte (Data/
Analysis Engine + Coach-prompt zijn per specialist uniek werk; Learning/
Confidence/Decision Engine zijn al generiek herbruikbaar). Architectuur
wordt daarna alleen bijgesteld waar de praktijk daar concrete aanleiding
vooraf verder uitbreiden.
