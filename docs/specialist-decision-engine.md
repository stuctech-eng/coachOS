# CoachOS Specialist Coach Platform — Decision Engine

**Status: ONTWERPFASE — NOG GEEN CODE**

Vervolg op `docs/specialist-coaches.md`, `docs/specialist-database-design.md`,
`docs/specialist-api.md` en `docs/specialist-memory.md`. Dit document is
**verplicht** vóór implementatie (in tegenstelling tot bijvoorbeeld
Prediction/Simulation Engine, die zonder architectuurimpact later
toegevoegd kunnen worden) — het raakt direct het contract van Fase 4
(Master Coach Orchestrator) uit `specialist-api.md`.

---

## Het probleem dat dit oplost

Zodra meerdere specialisten tegelijk actief zijn, ontstaan onvermijdelijk
conflicterende adviezen. Voorbeeld:

- **Master Coach:** "Slaapscore laag, vandaag rustig."
- **Cycling Coach:** "FTP-schema zegt VO2max-intervallen."
- **Running Coach:** "Morgen lange duurloop."
- **Recovery Coach:** "HRV daalt."

**Wie wint?** Zonder een vastgelegde regel zou dit per geval willekeurig
door de Master Coach-AI worden "aangevoeld" — onvoorspelbaar, niet
uitlegbaar, en potentieel inconsistent tussen twee vergelijkbare
situaties. De Decision Engine maakt dit **deterministisch**, consistent
met het bestaande "AI rekent/beslist nooit zelf op basis van vage
afweging" principe uit `specialist-api.md`.

---

## Plek in de architectuur

```
Master Coach
      │
Decision Engine        ← NIEUW, dit document
      │
──────────────────────────
Cycling Coach
Running Coach
Rowing Coach
Strength Coach
(overige specialisten)
──────────────────────────
Knowledge Base / Confidence Engine / Learning Engine / Analysis Engine / Data Engine
   (zie specialist-memory.md)
```

De Decision Engine zit **tussen** de Master Coach en de specialisten —
niet in een specialist zelf (een specialist mag nooit voor een andere
specialist beslissen), en niet in de Master Coach-AI zelf (dat zou de
beslissing weer impliciet/onvoorspelbaar maken).

---

## Vaste prioriteitsregels

**Dit zijn vaste, deterministische regels — geen AI-afweging.** De
Decision Engine is code, geen prompt.

1. **Gezondheid gaat altijd vóór prestatie.**
   Een laag herstelsignaal (slaap, HRV, vermoeidheid) overstemt elk
   prestatiegericht specialist-advies, ongeacht hoe goed dat advies
   sport-inhoudelijk onderbouwd is.
2. **Blessures gaan vóór periodisering.**
   Een actieve blessure (bestaande `injuries`-tabel) overstemt elk
   schema-advies van een specialist, zelfs als periodisering een
   specifieke fase voorschrijft.
3. **Herstel gaat vóór trainingsbelasting.**
   Als de Recovery-signalen (bestaand, via `calculateRecoveryScore` in
   `api/coach/route.ts`) laag zijn, wint dat van een specialist die meer
   belasting adviseert.
4. **Lange termijn gaat vóór korte termijn.**
   Een structureel doel (bijv. een wedstrijd over 3 maanden) weegt
   zwaarder dan een kortetermijnkans (bijv. "vandaag toevallig goed
   weer voor een lange rit").
5. **Gebruikersdoel bepaalt prioriteit bij meerdere geldige opties.**
   Als geen van de regels 1-4 een duidelijke winnaar aanwijst (bijv. twee
   specialisten stellen allebei een lichte sessie voor, beide gezond om
   te doen), bepaalt het actieve doel van de gebruiker (`user_goals`)
   welke voorrang krijgt.

**Volgorde is expliciet 1 → 5** — regel 1 wordt altijd eerst getoetst,
pas als die geen uitsluitsel geeft (bijv. geen gezondheidsrisico
aanwezig) wordt regel 2 getoetst, enzovoort.

---

## DecisionResult — gestructureerde uitkomst, niet alleen een winnaar

**Aanscherping:** de Decision Engine geeft niet alleen terug "welk
advies wint", maar een volledig, herbruikbaar resultaat-object:

```ts
interface DecisionResult {
  selectedCoach: string           // bijv. 'recovery'
  rejectedCoaches: string[]       // bijv. ['cycling', 'running']
  appliedRule: string             // bijv. 'regel_1_gezondheid_voor_prestatie'
  priorityScore: number           // relatieve sterkte van de beslissing
  reasoning: string[]             // menselijk leesbare onderbouwing
}
```

**Waarom dit meer is dan een technisch detail:** hiermee kan een Hub
later transparant tonen *waarom* een specialist vandaag niet aan het
woord komt, bijvoorbeeld:

> "Running-advies is vandaag onderdrukt omdat Recovery prioriteit
> kreeg."

Dat is direct herleidbaar uit `rejectedCoaches` + `appliedRule` +
`reasoning`, zonder dat de Hub zelf opnieuw hoeft te redeneren over
waarom. Dit maakt debugging én gebruikersuitleg beide eenvoudiger, met
dezelfde data.

---

## Contract met Fase 4 (Master Coach Orchestrator)

**Concrete wijziging op het eerder vastgelegde contract in
`specialist-api.md`:** de Master Coach ontvangt niet zomaar een lijst
specialist-samenvattingen om zelf te wegen — hij ontvangt het resultaat
**ná** de Decision Engine.

**Bijgewerkte flow:**
```
1. Elke actieve specialist levert zijn samenvatting
   (Coach Layer-output, zie specialist-memory.md)
2. Decision Engine ontvangt alle samenvattingen + gezondheid/herstel/
   blessure-context (bestaande data, ongewijzigd)
3. Decision Engine past regels 1-5 toe, deterministisch, levert een
   DecisionResult per betrokken specialist (zie hierboven)
4. Master Coach (AI) integreert de door de Decision Engine
   geselecteerde uitkomsten tot één samenhangend dagadvies
```

**Aanscherping van de Master Coach-rol, preciezer dan "verwoordt":** de
Master Coach doet meer dan alleen de winnende specialist herformuleren.
Als bijvoorbeeld Recovery rust adviseert, Nutrition extra koolhydraten,
Sleep eerder-naar-bed, en Running geen intervallen — dan **integreert**
de Master Coach dat tot één coherent verhaal, niet vier losse
zinnetjes achter elkaar.

**Preciezere formulering van zijn rol:**
> De Master Coach integreert de door de Decision Engine geselecteerde
> uitkomsten tot één coherent coachgesprek, zonder de
> prioriteitsbeslissingen van de Decision Engine te wijzigen.

**Belangrijk, ongewijzigd principe:** de Master Coach mag **welke**
adviezen wint niet overrulen (dat blijft bij de Decision Engine) — hij
mag wel **hoe** dat gecombineerd wordt tot natuurlijke taal volledig
zelf bepalen. Beslissen ≠ integreren.

---

## Explainability — ontwerpregel, geen aparte engine

**Besluit uit overleg:** dit wordt **geen** eigen Explainability Engine,
maar een **kwaliteitseis** die voor élke engine in de hele
specialistlaag geldt (Data, Analysis, Learning, Confidence, en nu
Decision Engine).

**Elke engine levert, naast zijn resultaat, altijd mee:**
- **Conclusie** — wat is het resultaat
- **Confidence** — hoe zeker (waar van toepassing, zie
  `specialist-memory.md`)
- **Reden(en)** — waarom deze conclusie
- **Gebruikte databronnen** — waarop is dit gebaseerd

**Voorbeeld, voor de Decision Engine specifiek:**
```
Vandaag geen intervaltraining.

Reden:
- HRV 18% lager dan gemiddeld
- Slechte slaap afgelopen nacht
- Gisteren zware training
- Recovery-score laag
→ Regel 1 (gezondheid > prestatie) toegepast
```

Dit wordt meegenomen als **vaste ontwerpregel** bij de
Engine-architectuur-stap (volgend document) — geen apart contract, geen
aparte tabel, gewoon een verplicht veld/structuur in elke
engine-response.

---

## Wat dit NIET oplost, bewust nog open

- **Exacte gewichtsverdeling binnen regel 5** ("gebruikersdoel bepaalt
  prioriteit") — als een gebruiker meerdere actieve doelen heeft
  (bijv. zowel een cycling- als een running-doel), welk doel weegt dan
  zwaarder? Dit vergt een eigen kleine regel, niet nu uitgewerkt —
  redelijk startpunt: meest recent aangemaakte actieve doel, of
  expliciete gebruikersvoorkeur, te bepalen bij implementatie van de
  Rowing/Cycling-referentie-implementatie (zie volgende stap in het
  algehele traject).
- **Wat als twee regels tegelijk van toepassing zijn en tegenstrijdig
  uitpakken** (zeldzaam bij een strikte 1→5-volgorde, maar theoretisch
  mogelijk bijv. bij gelijktijdige blessure + doel-conflict) — de
  1→5-volgorde lost dit in de praktijk op (eerste toepasselijke regel
  wint), dus dit is eerder een edge-case om te testen tijdens de
  referentie-implementatie dan een onopgeloste ontwerpvraag.

---

## Bijgewerkte volgorde

1. ✅ Architectuur (`specialist-coaches.md`)
2. ✅ Database (`specialist-database-design.md`, SQL v2.4.59)
3. ✅ API-structuur (`specialist-api.md`)
4. ✅ Memory & Learning, incl. Confidence Engine (`specialist-memory.md`)
5. ✅ Decision Engine (dit document)
6. **Volgende, laatste ontwerpdocument:** Engine-architectuur — hoe Data/
   Analysis/Learning/Confidence/Decision-engines samen een herbruikbaar
   patroon vormen, inclusief de Explainability-ontwerpregel hierboven en
   de bevestiging dat Coach Personality (`coach-personality.ts`,
   bestaand) hergebruikt wordt, niet vervangen
7. **Daarna: ontwerpstop.** Start implementatie van één
   referentie-specialist (Rowing of Cycling), verticaal van database tot
   Hub. Architectuur alleen bijstellen waar de praktijk daar aanleiding
   toe geeft — niet vooraf verder uitbreiden.

**Dit document eerst ter goedkeuring.**
