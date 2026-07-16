# CoachOS Specialist Coach Platform — Memory & Learning Engine

**Status: ONTWERPFASE — NOG GEEN CODE, NOG GEEN SQL**
**v3 — Maturity Engine toegevoegd als toekomstig concept, na de bouw van
de Lifecycle Engine (v2.4.70). v2 bevatte al: Confidence Engine,
Hard/Soft Knowledge, zelfcorrigerend geheugen.**

**Herstel-notitie:** dit document ontbrak in de repository (nooit
daadwerkelijk gecommit, ondanks eerdere levering) — hersteld vanuit de
volledige tekst die eerder in de chat is gedeeld, nu aangevuld.

Vervolg op `docs/specialist-coaches.md`, `docs/specialist-database-design.md`
en `docs/specialist-api.md`.

**Waarom dit vóór implementatie hoort, niet erna:** geheugen is een
fundamenteel architectuuronderdeel. Als dit pas achteraf wordt bedacht,
moeten API's en Hubs er later omheen verbouwd worden. Eerst de volledige
architectuur "af" maken, dan pas code.

---

## Eerste, belangrijkste uitgangspunt

> **Memory is geen chatgeheugen. Het is ook geen logboek. Het is een
> Knowledge Base.**

**Niet dit:**
> "Gebruiker fietste gisteren 42 km."

**Wel dit:**
> "Gebruiker presteert beter met twee rustdagen vóór een lange rit."

Het verschil: het eerste is een **feit uit één moment** (hoort al thuis
in `activity_sessions`). Het tweede is een **duurzaam, over tijd
gevalideerd inzicht** — pas waardevol ná herhaalde bevestiging.

Het is niet genoeg om te weten *wat* er onthouden wordt — de Knowledge
Base moet ook weten **hoe zeker** het systeem daarvan is. Zonder dat
onderscheid behandelt de AI een eenmalige toevalstreffer even zwaar als
een jarenlang bevestigd patroon.

---

## Vier gescheiden engines, elk met een eigen vraag

Verduidelijking, na het vervolgoverleg dat leidde tot de Lifecycle
Engine (v2.4.70):

| Engine | Vraag die hij beantwoordt | Status |
|---|---|---|
| **Lifecycle Engine** | "Wat doet de gebruiker?" (ontdekken/activeren/actief/slapend/terugkerend) | ✅ Gebouwd (v2.4.70) |
| **Memory Engine** | "Wat heeft de specialist geleerd?" | Ontworpen, nog niet gebouwd |
| **Confidence Engine** | "Hoe zeker is die kennis?" | Ontworpen, nog niet gebouwd |
| **Maturity Engine** | "Hoe volwassen is deze specialist voor déze gebruiker?" | Toekomstig concept, zie onderaan dit document |

Deze vier zijn **bewust gescheiden** — elk beantwoordt een andere vraag,
en vermenging zou (net als bij `progress_analyses` vs. specialist-data,
zie `specialist-database-design.md` §4.5) tot een onduidelijk, moeilijk
te onderhouden geheel leiden.

---

## Herziene lagenstructuur — pipeline

```
Data Layer
   ↓
Analysis Engine
   ↓
Learning Engine       ← bepaalt of een patroon kandidaat wordt
   ↓
Confidence Engine       ← bepaalt hoe zeker we zijn, en herweegt over tijd
   ↓
Knowledge Base
   ↓
Specialist Coach         ← bouwt de compacte samenvatting
   ↓
Master Coach
```

Koppeling naar `specialist-api.md`'s fasenummering: Identity Layer =
Fase 1, Data Layer = Fase 2a, Knowledge Layer = dit document, Analysis
Layer = Fase 2b + Goal Engine, Coach Layer = Fase 3.

---

## Learning Engine — de kern van dit ontwerp

**Principe:** de AI schrijft **nooit direct** naar Memory. Er zit een
deterministische poortwachter tussen: de Learning Engine.

**Waarom dit nodig is:** zonder poortwachter zou het geheugen vollopen
met toevalligheden.
- Eén keer slechte slaap → **niets opslaan**
- Acht weken herhaald patroon → **wel opslaan**

### Hoe de Coach Layer (AI) en de Learning Engine samenwerken

1. **De Specialist AI (Coach Layer) mag kandidaat-inzichten voorstellen**
   als onderdeel van zijn normale interpretatie-taak. Dit is
   **interpretatie**, geen berekening — geen inbreuk op het
   AI-nooit-rekenen-principe.
2. **De Learning Engine beslist, deterministisch, of een kandidaat wordt
   gepromoveerd** tot een blijvend Memory-inzicht. Regelgebaseerd:
   bijvoorbeeld "dezelfde/vergelijkbare kandidaat moet in minimaal N
   opeenvolgende Analysis-cycli terugkomen" (exacte drempel per
   inzicht-categorie, niet nu al vastgelegd als hard getal).
3. **De AI leest Memory wel**, maar **schrijft er nooit rechtstreeks
   naartoe.**

---

## Confidence Engine

**Taak, strikt gescheiden van de Learning Engine:**
- **Learning Engine** beslist: is dit patroon overhaupt kandidaat?
- **Confidence Engine** beslist: **hoe sterk** is dit inzicht, en blijft
  dat sterk over tijd?

**Elk Memory-item krijgt een confidence-score:**

| Inzicht | Confidence |
|---|---|
| Houdt van duurtraining | 97% |
| Reageert goed op intervallen | 42% |
| Vermijdt hoge cadans | 91% |
| Traint graag vroeg | 58% |

### Zelfcorrigerend: confidence verandert over tijd

Een gebruiker verandert. Oude inzichten mogen **verzwakken**, nieuwe
patronen mogen **sterker worden**.

```
2026  ★★★★★  Houdt van intervallen
2027  ★★☆☆☆  (patroon minder bevestigd, nieuwe data wijst anders)
2028  ★☆☆☆☆  → onder een ondergrens: automatisch naar 'deprecated'
```

**Mechanisme, op hoofdlijnen** (exacte formule hoort bij de
Engine-architectuur-uitwerking):
- Elke Analysis-cyclus die een bestaand Memory-item **opnieuw
  bevestigt** → confidence stijgt (of blijft hoog)
- Elke cyclus die een item **tegenspreekt of niet meer bevestigt** →
  confidence daalt geleidelijk
- Onder een vaste ondergrens → status automatisch naar `deprecated`

---

## Master Coach krijgt geen losse Memory-items

De **Specialist Coach (Coach Layer)** bouwt eerst een **compacte
samenvatting**, gefilterd op confidence en gegroepeerd:

```
Cycling Knowledge
Sterke voorkeur:      duurtraining
Bewezen effectief:    pyramideschema
Let op:                hoge belasting na 3 intensieve sessies
Confidence:            hoog
```

Dit is zelf een interpretatie-taak, passend bij de Coach Layer — geen
inbreuk op "AI rekent nooit", want de confidence-scores zelf komen
kant-en-klaar uit de Confidence Engine.

---

## Hard Knowledge vs. Soft Knowledge

### Hard Knowledge — objectief bewezen
Maximale hartslag, FTP, 5km PR, beste cadans, VO₂max. Confidence in
principe altijd hoog/vast (100%). Ontstaat sneller dan Soft Knowledge —
één geldige test volstaat.

### Soft Knowledge — waarschijnlijkheden
Houdt van ochtendtraining, lange warming-up, reageert goed op positieve
coaching. Ontstaat via de volledige pijplijn (Learning → Confidence).

**Beide in dezelfde tabel** (`specialist_memory`, voorgesteld), met een
`knowledge_type`-veld (`hard`/`soft`) — geen aparte tabel, structuur is
identiek, alleen het ontstaansproces verschilt.

---

## Database-implicatie — voorgestelde tabeldefinitie

| Veld | Betekenis |
|---|---|
| `id` | Primary key |
| `user_id` | Koppeling naar de gebruiker |
| `specialist_type` | Welke specialist |
| `knowledge_type` | `hard` of `soft` |
| `insight` | Het inzicht zelf, natuurlijke taal |
| `category` | Optioneel, bijv. `training_response`, `preference`, `risk_pattern` |
| `confidence` | Numeriek (0-100) |
| `status` | `candidate` → `active` → `deprecated` |
| `confirmation_count` | Hoe vaak bevestigd |
| `first_observed_at` | Wanneer voor het eerst gezien |
| `last_confirmed_at` | Wanneer voor het laatst bevestigd |

**Nog open:** exacte drempelwaarden, confidence-daalformule,
ondergrens voor `deprecated`, Hard Knowledge-validatiecriteria per
sport. Horen bij de Engine-architectuur-uitwerking, niet bij dit
document.

---

## Maturity Engine — toekomstig concept (NIEUW, v3)

**Toegevoegd na het bouwen van de Lifecycle Engine (v2.4.70), bewust
NIET nu geïmplementeerd.**

**Wat het zou beantwoorden:** niet *wat* de specialist weet (Memory) of
*hoe zeker* (Confidence), maar **hoe volwassen de begeleiding is** voor
déze specifieke gebruiker. Een Cycling Coach die iemand twee weken kent,
geeft andere begeleiding dan dezelfde coach die al twee jaar iemands
trainingen, voorkeuren, reacties en progressie kent.

**Waarom dit expliciet NIET nu gebouwd wordt:** Maturity moet
gebaseerd zijn op de **kwaliteit van de opgebouwde kennis in de Memory-
en Confidence Engine** — beide bestaan nog niet. Een maturity-level nu
bouwen zou noodgedwongen een schijnwaarde worden (bijv. simpelweg "aantal
dagen actief"), die doet alsof het over kennis-kwaliteit gaat terwijl
dat niet zo is. Dat is precies het soort overclaiming dat dit hele
architectuurtraject steeds heeft vermeden.

**Voorlopige niveaus, ter illustratie, niet definitief:**
- Level 0 — Nog niet ontdekt
- Level 1 — Kennismaking
- Level 2 — Actieve begeleiding
- Level 3 — Langetermijncoach
- Level 4 — Expertmodus

**Niet handmatig ingesteld — zou moeten groeien uit, zodra Memory/
Confidence bestaan:**
- Hoeveelheid gevalideerde kennis (aantal `active`-status Memory-items)
- Gemiddelde confidence van actieve inzichten
- Spreiding van trainingsdata over tijd (niet alleen recent, ook
  langjarig)
- Stabiliteit van patronen (hoe vaak wordt een inzicht *niet*
  tegengesproken)
- Diversiteit van bevestigde gedrags- én prestatiepatronen (niet één
  enkel inzicht dat toevallig hoge confidence heeft)

**Niet zichtbaar voor de gebruiker** — dit is interne context voor hoe
de Coach Layer zijn toon/diepgang aanpast, geen cijfer dat de gebruiker
te zien krijgt.

**Bouwvolgorde, vastgelegd:** Maturity Engine wordt pas ontworpen zodra
Memory Engine én Confidence Engine daadwerkelijk operationeel zijn —
niet eerder, om te voorkomen dat het later moet worden herbouwd op
basis van data die er dan pas echt is.

---

## Wat dit betekent voor eerdere documenten

- **`specialist-database-design.md`** — krijgt bij de SQL-fase een derde
  tabel (`specialist_memory`) naast de twee bestaande. Geen wijziging
  aan bestaande tabellen.
- **`specialist-api.md`** — Coach Layer (Fase 3) krijgt Memory als extra
  input zodra gebouwd.
- **Lifecycle Engine (v2.4.70, `lifecycle-engine.ts`)** — bewust
  **losstaand** van Memory/Confidence gehouden: Lifecycle gaat over
  *gedrag* (doet de gebruiker de sport wel/niet), Memory gaat over
  *geleerde kennis over hoe iemand traint*. Beide zijn "engines", maar
  beantwoorden fundamenteel andere vragen — vandaar ook apart gebouwd
  (`lifecycle-engine.ts` vs. het nog te bouwen `memory-engine.ts`).

---

## Bijgewerkte volgorde

1. ✅ Architectuur (`specialist-coaches.md`)
2. ✅ Database (`specialist-database-design.md`, SQL v2.4.59)
3. ✅ API-structuur (`specialist-api.md`)
4. ✅ Memory & Learning-ontwerp, incl. Confidence Engine (dit document)
5. ✅ Decision Engine (`specialist-decision-engine.md`)
6. ✅ Engine-architectuur (`specialist-engine-architecture.md`)
7. ✅ Cycling-referentie-implementatie (v2.4.60-69)
8. ✅ Lifecycle Engine (v2.4.70)
9. ⏳ Memory Engine — volgende in de rij
10. ⏳ Confidence Engine
11. ⏳ Maturity Engine — pas ná 9 en 10

**Dit document, v3, is een aanvulling op eerder al inhoudelijk
goedgekeurd werk (v1/v2) — de Maturity Engine-sectie is nieuw en behoeft
bevestiging, de rest is ongewijzigd t.o.v. de eerder gedeelde versie.**
