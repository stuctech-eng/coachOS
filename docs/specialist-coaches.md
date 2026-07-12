# CoachOS Specialist Coach Platform — Architectuur

**Status: BESLUITFASE — GEEN IMPLEMENTATIE NOG**

Dit document legt de architectuur vast voor een nieuwe laag bovenop het
bestaande CoachOS-systeem: gespecialiseerde coaches per discipline
(cycling, running, rowing, strength, etc.), georganiseerd onder één
centrale Master Coach.

**Dit is geen losse feature, maar een architectuurlaag.** De bestaande
CoachOS-functionaliteit (Master Coach, Trainer AI, bibliotheken, Coach
Call-systeem, Archief) blijft **volledig** bestaan en ongewijzigd. We
breiden uit, we vervangen niets.

**Volgorde, bewust zo vastgesteld:** dit document eerst, ter goedkeuring.
Pas daarna database-ontwerp, API-routes, UI-implementatie. Geen code
vóór dit document akkoord is.

---

## 1. Architectuurprincipe

De Master Coach blijft **altijd** de centrale intelligentie — dit
verandert niet.

Specialistische coaches worden **geen** aparte apps en **geen**
concurrerende coaches. Ze zijn **kennismodules** die de Master Coach kan
raadplegen, niet losse gesprekspartners.

**De gebruiker ervaart:**
> "Mijn coach kent mij."

**Niet:**
> "Ik praat met meerdere losse AI-coaches."

**Kernregel, leidend voor de hele architectuur:**
> **Specialisten adviseren. De Master Coach beslist.**

Voorbeeld ter illustratie:
- Cycling Coach: *"Volgens trainingsbelasting is een intensieve
  fietsinterval mogelijk."*
- Master Coach: *"Door lage slaapkwaliteit wordt dit vandaag aangepast
  naar rustig."*

De specialist levert diepe, sportspecifieke input. De uiteindelijke
beslissing over wat de gebruiker die dag te zien krijgt, ligt altijd bij
de Master Coach — nooit bij de specialist zelf.

---

## 2. Rollen

| Rol | Verantwoordelijkheid | Status |
|---|---|---|
| **Master Coach** | Algemene gezondheid, herstel, trainingsbelasting, balans tussen sporten, blessurepreventie, dagelijkse beslissingen | Bestaand, ongewijzigd (`/api/coach/route.ts`) |
| **Specialist Coach** | Diepe kennis van één discipline, sportspecifieke strategie, periodisering binnen die sport, analyse van sportspecifieke data | **Nieuw** |
| **Trainer AI** | Concrete trainingen samenstellen, kiest uitsluitend uit bestaande bibliotheken, verzint nooit zelf oefeningen | Bestaand, ongewijzigd (`/api/training/today/route.ts`) |
| **Bibliotheken** | Enige bron voor oefeningen, drills, techniek, trainingsonderdelen | Bestaand, ongewijzigd |

De Specialist Coach beslist **nooit** over algemene gezondheid — dat
blijft altijd bij de Master Coach, ongeacht hoe diep de sportspecifieke
analyse gaat.

---

## 3. Datastromen en bron van waarheid

**Eén bron van waarheid — expliciet vastgelegd om dubbele databases te
voorkomen:**

- Specialist coaches maken **geen** eigen trainingshistorie.
- Ze **lezen** bestaande CoachOS-data (`activity_sessions`,
  `exercise_records`, `training_results`, `health_metrics`, etc.).
- Nieuwe data wordt opgeslagen in de **bestaande centrale systemen**,
  tenzij er een echte, aantoonbare specialist-specifieke behoefte
  ontstaat die niet in het bestaande schema past.

**Wat een specialist wél mag hebben, apart:**
- Eigen *activeringsstatus* per gebruiker (`specialist_profiles`, zie §5)
- Eigen *doelen* en *voorkeuren* binnen zijn discipline (bijv. FTP-doel
  voor Cycling) — dit is geen trainingshistorie, maar configuratie

**Wat een specialist nooit apart bijhoudt:**
- Trainingssessies, activiteiten, hartslagdata — dit blijft in de
  bestaande centrale tabellen, ongeacht welke specialist ernaar kijkt

---

## 4. Activatiemodel

Specialisten zijn **niet** altijd actief. Activering verloopt in drie
niveaus, en is **data-driven**, geen vrije AI-inschatting.

### Niveau 1 — Activiteit herkennen
Eenmalige of incidentele activiteit. Geen specialist nodig.

> Gebruiker roeit één keer.
> Master Coach: *"Ik zie dat je geroeid hebt. Dit draagt positief bij aan
> je conditie."*

### Niveau 2 — Patroon herkennen
**Vaste, meetbare regel** (eerste versie, geen AI-interpretatie):

- Cycling: minimaal 3 activiteiten binnen 30 dagen
- Running: minimaal 3 runs binnen 30 dagen
- Rowing: minimaal 3 roeisessies binnen 30 dagen
- (Zelfde 3-in-30-regel als startpunt voor elke toekomstige discipline,
  tenzij een sport-specifieke reden om af te wijken expliciet wordt
  vastgesteld)

Ná het bereiken van deze drempel mag de Master Coach aanvullende context
gebruiken (stijgende frequentie, progressie, aanwezigheid van een doel,
past het bij de gebruiker) — maar de **drempel zelf** is vast en
data-driven, niet AI-bepaald.

**Aanscherping: frequentie alleen is niet de enige geldige trigger.**
Iemand die één keer per maand een lange fietstocht doet, hoeft geen
Cycling Hub voorgesteld te krijgen — dat is geen opkomend patroon. Maar
andersom moet het systeem ook niet star vasthouden aan "exact 3 keer" als
er al eerder een duidelijk opkomend patroon zichtbaar is (bijvoorbeeld
toenemende frequentie binnen een kortere periode). Concreet betekent dit
twee geldige, evenwaardige triggers voor een voorstel:
1. **Drempel bereikt** (3-in-30, zoals hierboven) — het "harde" signaal
2. **Opkomend patroon herkend** — bijv. duidelijk toenemende frequentie,
   ook vóór de volle drempel — het "zachte" signaal

Beide leiden tot **exact hetzelfde vervolg**, nooit tot automatische
activatie (zie hieronder) — het verschil zit alleen in *wanneer* het
systeem het gesprek durft te openen, niet in *wat* er gebeurt als dat
gesprek wordt geopend.

**Belangrijk, ongeacht welke trigger: het bereiken van een signaal
activeert nooit automatisch een specialist.** Het systeem mag alleen
**voorstellen**:

> "Je doet dit regelmatig. Wil je deze coach activeren?"

Of, bij het zachtere signaal:

> "Ik zie dat fietsen onderdeel wordt van jouw patroon. Wil je een
> Cycling Coach activeren?"

**De gebruiker beslist altijd zelf over activatie.** Samengevat, de vaste
volgorde: **data-signaal → voorstel → gebruiker akkoord → specialist
wordt actief.** CoachOS begeleidt, maar neemt niet ongemerkt de regie
over.

### Niveau 3 — Specialist activeren
Gebruiker bevestigt → specialist wordt actief → bijbehorende Hub ontstaat
(zie §6).

---

## 5. Specialist Registry

**Hybride model — niet alles dynamisch, niet alles vast.**

### Vaste configuratie (code)
Welke specialisten *kunnen bestaan* binnen CoachOS — platformbreed,
niet per gebruiker:

```
Cycling Coach
Running Coach
Rowing Coach
Strength Coach
(uitbreidbaar)
```

**Versiebeheer, expliciet onderdeel van deze registry:**
- `specialist_version` — bijv. Cycling Coach v1, v2, v3 kunnen naast
  elkaar bestaan zonder de architectuur te breken
- `status` — `active` / `development` / `disabled`
- Beschikbaarheid — welke specialisten zijn daadwerkelijk live voor
  gebruikers, welke staan nog in ontwikkeling

Dit voorkomt dat een toekomstige verbetering aan bijvoorbeeld de Cycling
Coach een breaking change wordt voor gebruikers die nog op een oudere
versie "zitten" (voor zover dat relevant wordt — vooralsnog een
architecturale voorbereiding, geen acute behoefte).

### Gebruikersspecifieke activatie (Supabase)
Nieuwe tabel `specialist_profiles`:

| Veld | Betekenis |
|---|---|
| `id` | Primary key |
| `user_id` | Koppeling naar de gebruiker |
| `specialist_type` | Welke specialist (bijv. `cycling`) |
| `active` | Is deze specialist momenteel actief voor deze gebruiker |
| `activated_at` | Wanneer geactiveerd |
| `goals` | Specialist-specifieke doelen (bijv. FTP-target) |
| `preferences` | Specialist-specifieke voorkeuren |

**Waarom deze scheiding:** de kennis van een specialist is
platformbreed (code/config) — de activatie en persoonlijke ontwikkeling
zijn gebruikersspecifiek (database).

*(Exacte kolomtypen en SQL-migratie volgen in de database-ontwerpfase,
ná goedkeuring van dit document — hier alleen het veldontwerp.)*

---

## 6. Hub-structuur

**Geen nieuwe bottom-navigation-tabs.** De bestaande structuur blijft
ongewijzigd:

```
Home · Training · Activiteiten · Coach · Instellingen
```

**Binnen de Coach-pagina** komt een nieuw onderdeel: **"Mijn Coaches"**.

Voorbeeldindeling:

```
─────────────────────────
Master Coach
Vandaag: Je herstel is goed.
─────────────────────────
Actieve coaches:

🚴 Cycling Coach
   FTP ontwikkeling
   [Schema bekijken]

🚣 Rowing Coach
   Conditie opbouw
─────────────────────────
Beschikbare coaches:

🏃 Running Coach
   [Activeren]
─────────────────────────
```

**Een Hub = een aparte route** (bijv. `/coach/cycling`, `/coach/rowing`),
toegankelijk via de Coach-pagina, geen eigen plek in de hoofdnavigatie.

**Reden:** dit houdt de hoofdnavigatie rustig en overzichtelijk, ook
naarmate er meer specialisten bijkomen.

**Inhoud van een Hub** (volledige omgeving, geen aparte app):
- Dashboard
- Doelen
- Schema's
- Periodisering
- Grafieken
- Records
- Historie
- Analyses
- Coachadviezen

De data binnen een Hub komt **uit dezelfde centrale CoachOS-database**
(zie §3) — een Hub is een gespecialiseerde *weergave/analyse*, geen
aparte opslag.

---

## 7. AI-samenwerking en Orchestrator

**Coach Orchestrator** — nieuwe verbindingslaag tussen Master Coach en
specialisten. Verantwoordelijk voor:

- Bepalen welke specialist relevant is voor de huidige situatie
- Bepalen welke data naar die specialist toe gaat
- Verzamelen van de specialist-analyse
- Samenvoegen tot het uiteindelijke advies dat de Master Coach geeft

**Flow:**
```
Gebruiker
   ↓
Master Coach
   ↓
Coach Orchestrator
   ↓
Specialistische Coach
   ↓
Master Coach
   ↓
Advies aan gebruiker
```

---

## 8. Kostenbewuste AI-routing

**Niet één gigantische prompt. Ook niet altijd meerdere AI-calls.**
Hybride, expliciet geregeld — de Orchestrator mag **niet automatisch**
alle actieve specialisten oproepen bij elke aanvraag.

| Situatie | AI-aanroep(en) |
|---|---|
| **Geen specialist relevant** | Master Coach alleen (huidige situatie, ongewijzigd) |
| **Specialist relevant, dagelijks advies** | Master Coach, met specialist-context erin meegenomen (géén aparte specialist-AI-call) |
| **Gebruiker opent een specialist-Hub, vraagt diepe analyse** | Aparte specialist-AI-call (bijv. Cycling Coach analyseert FTP, vermogen, trainingsbelasting, wielrendata, doelen) |

**Waarom deze verdeling:** voorkomt onnodig hoge kosten bij elk
dagelijks advies, voorkomt te grote/langzame prompts, en voorkomt
onnodige specialistberekeningen wanneer daar geen aanleiding voor is.

**Concreet voorbeeld:** als Cycling Coach actief is voor een gebruiker,
krijgt de Master Coach bij het **dagelijkse** advies alleen verdichte
Cycling-context mee (bijv. "trainingsbelasting fietsen deze week: hoog")
— niet een volledige, aparte Cycling-analyse. Die volledige analyse
gebeurt pas wanneer de gebruiker zelf de Cycling Hub opent.

---

## 9. Toekomstige uitbreidingen

**Genoemd als richting, bewust NIET uitgewerkt in dit document — volgt in
latere fases, elk met eigen goedkeuring vooraf:**

- **Specialist Memory** — elke coach leert binnen zijn eigen domein
  (reactie op trainingsblokken, ontwikkeling, herstelreactie, voorkeuren)
- **Goal Engine** — doelen per specialist (bijv. Cycling: FTP verbeteren,
  tijdrit, Gran Fondo, wedstrijd)
- **Periodization Engine** — centrale trainingsopbouw (Base → Build →
  Peak → Taper → Recovery), afgeleid van doel + niveau + beschikbare
  tijd + trainingsbelasting
- **Benchmark Engine** — groei zichtbaar maken (FTP-stijging, sneller
  tempo bij lagere hartslag, meer gewicht/herhalingen)
- **Event Planning** — doelgericht trainen richting een specifieke datum
  (bijv. "over 4 maanden een Gran Fondo"), met terugplanning en taper
- **Sportprofielen** — persoonlijk profiel per discipline (FTP, ervaring,
  beschikbare trainingsdagen, sterke/zwakke punten)

---

## Eindmodel

```
Eén gebruiker.
Eén Master Coach.
Een team van gespecialiseerde coaches achter de schermen.

Master Coach
   ↓
Coach Orchestrator
   ↓
Specialistische Coaches
   ↓
Specialist Hubs
   ↓
Data + Bibliotheken + Trainer AI
```

CoachOS wordt hiermee een persoonlijke digitale coachorganisatie — de
gebruiker ervaart één coach die hem kent, terwijl er achter de schermen
een team van experts samenwerkt.

---

## Volgende stap

**Dit document eerst ter goedkeuring.** Na akkoord, in deze volgorde:
1. Database-ontwerp (`specialist_profiles`-tabel, exacte SQL)
2. API-ontwerp (Orchestrator-route, specialist-route(s))
3. UI-implementatie ("Mijn Coaches"-sectie, eerste Hub)

**Geen rebuild.** Stap voor stap uitbreiden bovenop de bestaande
CoachOS-architectuur, met behoud van alle bestaande functionaliteit.
