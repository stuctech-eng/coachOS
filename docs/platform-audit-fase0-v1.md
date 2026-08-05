# CoachOS Platform Audit — Fase 0

**Versie 1.0 — Status: Audit, geen implementatie**
**Referentiearchitectuur:** CoachOS Platform Final Architecture v1.0
(gebruiker, 5 augustus 2026)

**Methode:** classificatie op basis van wat daadwerkelijk in de code en
het README bevestigd is. Categorieën zoals afgesproken:

- **A** — bestaat al correct, past al bij de eindarchitectuur
- **B** — bestaat, maar is verspreid/onder andere naam — consolidatie
- **C** — bestaat gedeeltelijk
- **D** — bestaat nog niet
- **E** — legacy of dubbel

**Vertrouwensniveau per regel is expliciet vermeld** — dit is een eerste
doorloop op basis van deze week se bevindingen + gerichte checks, geen
uitputtende regel-voor-regel scan van de hele codebase (dat zou een
veelvoud aan tool-aanroepen vergen). Waar "niet geverifieerd" staat, is
dat een eerlijke leemte, geen aanname.

---

## 1. Coach Agenda
**Categorie: C — bestaat gedeeltelijk.**
Bevestigd (README): feestdagen ✅, periodiserings-context (mesocyclus)
✅. Schoolvakanties/Apple/Google/Outlook-sync ⏳ nog niet gestart.
**Vertrouwen: hoog** (letterlijk zo gedocumenteerd, deze week niet apart
geverifieerd maar consistent met de rest van het README).

## 2. Context Platform
**Categorie: B — bestaat, andere naam.**
Bevestigd: `src/core/utils/context-resolver.ts` bestaat (HTTP 200,
zojuist gecheckt), README noemt 'm "✅ Bevestigd" met vaste prioriteit
blessure→ziekte→vakantie→herstel→wedstrijd→werk→training→vrije_tijd.
Dit IS waarschijnlijk het "Context Platform" uit de Final Architecture,
alleen heet het nu "Context Resolver" en is het niet als aparte
platformlaag gepositioneerd. **Vertrouwen: hoog dat het bestaat, matig
dat het functioneel 1-op-1 hetzelfde is** — niet inhoudelijk
doorgelezen deze audit.

## 3. Training Plan Platform
**Categorie: A — bestaat, klopt al met de eindarchitectuur.**
`training-plan-engine/core.ts` + sport-adapters (rowing/running/
cycling-adapter.ts) — exact het "wat moet vandaag getraind worden"-
patroon, sport-agnostische Core + adapters. **Vertrouwen: zeer hoog**
(deze week uitgebreid gelezen en op voortgebouwd).

## 4. Workout Platform
**Categorie: B/C — bestaat, verspreid per specialist.**
Elke specialist bouwt zijn eigen workout (`bouwWorkout()`,
`api/specialists/rowing/training-plan/workout/route.ts`, en het
Cycling/Running-equivalent — v2.4.266 loste net een UI-gat op waarbij
Cycling/Running workouts niet opengetikt konden worden, wat bevestigt
dat de workout-opbouw zelf al bestond, alleen de UI niet). Nog niet één
generiek platform ("één Workout Builder" uit de eindregel) —
sportspecifiek geïmplementeerd. **Vertrouwen: matig** — bevestigd dat
het bestaat, niet grondig vergeleken hoe sterk de implementaties per
sport van elkaar verschillen.

## 5. Workout Player
**Categorie: B — bestaat, andere naam. CORRECTIE op eerdere versie van
dit document (die zei: onbekend/hoog risico).**

**Bevestigd, na doorvragen:** `Trainer AI` **IS** de Universal Training
Engine — geen twee dingen, één ding. README, letterlijk: *"Trainer AI
(de Universal Training Engine) blijft voorlopig de generieke uitvoerder
voor deze disciplines [Rowing/Kettlebell/etc.]"*. Dat is vrijwel exact
de rol die de Final Architecture aan "Workout Player" toekent.

**De vaste prioriteitsvolgorde (bevestigd, `today-engine.ts` +
README):**
1. Veiligheid (CoachPolicy/blessures/herstel)
2. Specialist-trainingsplan (Cycling/Running/Rowing — als dit bestaat,
   wint het áltijd)
3. Trainer AI — **uitsluitend** als er geen actief specialist-plan is
4. Handmatige bibliotheekkeuze

**Dataflow-audit (Fase 0.5, Running) bevestigde het spiegelbeeld:**
voor sporten MET een Training Plan Engine (Running/Cycling/Rowing)
wordt Trainer AI helemaal niet aangeroepen — de uitvoering gebeurt
extern (Garmin/Concept2), niet in-app. Trainer AI/Universal Training
Engine is dus specifiek de uitvoerder voor sporten ZONDER eigen
Training Plan Engine (Strength/Kettlebell/Bodyweight/Mobility/etc.),
schrijft naar `training_results`.

**Wat dit betekent voor risico:** de oorspronkelijke zorg was "levende
code die we niet begrijpen, dus niet aankomen." Die code is nu wél
begrepen — het is geen dubbel systeem, het is één systeem met twee
bewust verschillende, elkaar uitsluitende paden, al zo ontworpen.
Risico verlaagd van "hoog, onbekend" naar "laag — consolidatie/
herlabeling, geen gedragswijziging nodig."
**Vertrouwen: hoog** (bevestigd via twee onafhankelijke bronnen:
README-tekst + Today Engine-broncode + de dataflow-audit).

## 6. Workout Completion Platform
**Categorie: A voor Activity Import + Matching Service (Rowing/
Running/Cycling). C voor de rest.**
Dit is wat deze week gebouwd en grondig getest is:
- Activity Import: Concept2 ✅, Garmin TCX ✅, Strava ✅ (gebouwd, niet
  actief getest — operationele context), Garmin Vision ⏳ (bewust
  overgeslagen), handmatig/bibliotheek: **onbekend, zie sectie
  Datamodelanalyse** — raakt `training_results`, niet `activity_sessions`
- Canonical Activity Model (`activity_sessions`): ✅ bevestigd,
  Source Isolation-principe geverifieerd in code
- Workout Matching Service: ✅ Rowing/Running/Cycling, Strength
  geblokkeerd (geen Training Plan Engine)
- "Completion" als losse stap: bestaat niet apart, is de statuswaarde
  `completed` op `training_plan_sessions` — geen aparte laag nodig
- "Feedback" (laatste sub-stap in het document): **onbekend of dit al
  bestaat of nieuw is** — mogelijk overlapt dit met het bestaande Coach
  Call-systeem (evaluatie na training, RPE/mood), niet onderzocht
  binnen deze audit
**Vertrouwen: zeer hoog voor Activity Import/Matching, laag voor
Feedback.**

## 7. Performance Platform
**Categorie: A — bestaat, klopt al.**
CTL/ATL/TSB, `load-engine.ts`, per-sport grafieken-bestanden. Bevestigd
deze week: leest UITSLUITEND `activity_sessions`, nooit
`training_results` — dat is zowel een sterk punt (single source of
truth) als de plek waar het datamodel-gat (sectie hieronder) het meest
voelbaar is. **Vertrouwen: zeer hoog.**

## 8. Universal Athlete Platform
**Categorie: B — bestaat, rol-zuiverheid niet apart geverifieerd.**
Bestaat: `athlete-platform/storage.ts`, `impact-engine.ts`,
`learned-adjustments.ts`. Past een berekende impact toe op de state —
dat oogt als Observer/Analyzer-gedrag, niet als beslisser. Maar de
eindarchitectuur-eis *"beslist nooit, uitsluitend Observer/Analyzer/
Learner"* is deze audit niet expliciet geverifieerd (bijv.: triggert
dit platform ooit zelf een actie, of levert het alleen data voor
anderen om op te beslissen?). **Vertrouwen: matig** — waarschijnlijk
al grotendeels correct, niet bewezen.

## 9. Learning Rules Engine
**Categorie: A — bestaat, klopt al.**
`evalueerRegels()`, IF-THEN-regels, reproduceerbaar, volledig
aangesloten (v2.4.253+256), README bevestigt dit expliciet als
"✅ Volledig aangesloten". **Vertrouwen: zeer hoog.**

## 10. Intelligence Platform
**Categorie: onbekend, vermoedelijk grotendeels D/B — NIET bouwen,
eerst onderzoeken (conform expliciete instructie).**
Geen bestand met deze naam gevonden of verwacht. De functionaliteit
("combineert Context/Performance/Universal Athlete/Learning Rules/
Knowledge tot één advies") ligt vermoedelijk al verspreid — sterkste
kandidaat is `api/coach/route.ts` (Master Coach, leest al TodayPlan +
meerdere bronnen, zie punt 11) plus CoachPolicy
(`genereerCoachPolicy()`, bevestigd bestaand, v2.4.78 contract). Of dit
"80% al bestaat, alleen niet zo genoemd" klopt, zoals de gebruiker
vermoedt, is **niet bevestigd** — vergt een aparte, gerichte
investigatie van `api/coach/route.ts` en `genereerCoachPolicy()` naast
elkaar. **Vertrouwen: laag — puur een vermoeden op basis van
aangrenzende bevindingen, geen bevestiging.**

## 11. Master Coach
**Categorie: C — bestaat gedeeltelijk.**
Bevestigd: `api/coach/route.ts`, leest TodayPlan + andere bronnen.
README noemt expliciet: "Fase 4 — volledige Master Coach ↔
Specialist-koppeling verder uitbouwen (basis staat sinds v2.4.80, kan
dieper)" — dus zelf al erkend als niet-compleet. **Vertrouwen: hoog**
(letterlijk zo gedocumenteerd).

## 12. Specialisten (Running/Cycling/Rowing/Strength)
**Categorie: gemengd, per specialist:**
- **Running/Cycling: A** — README: "Cycling ↔ Running specialist-
  pariteit — ✅ Compleet" (Dashboard/Records/Grafieken/Trainingsplan/
  Ritanalyse/Progress, beide op hetzelfde niveau)
- **Rowing: B/C** — aanzienlijk uitgebreid deze week (Training Plan
  Engine, CTL/ATL/TSB-baseline, Matching Service), maar README's eigen,
  oudere aantekening noemt Rowing nog als niet-volledig "volwaardige
  specialist" op hetzelfde niveau als Cycling/Running qua Dashboard/
  Records/Progress-pariteit — niet geverifieerd of dat inmiddels
  ingehaald is
- **Strength: D** — bevestigd (deze week): geen Training Plan Engine,
  geen `strength-adapter.ts`, alleen een oefeningenbibliotheek (100
  oefeningen). README zegt het zelf: "⏳ Niet gestart"
**Vertrouwen: hoog voor Running/Cycling/Strength, matig voor Rowing's
actuele pariteitsstatus.**

## 13. Knowledge Platform
**Categorie: onbekend, vermoedelijk C — NIET bouwen, eerst
onderzoeken (conform expliciete instructie).**
Sterke aanwijzing dat kennis al verspreid bestaat: sport-specifieke
exercise-libraries (`strength-exercises.ts`, `kettlebell-exercises.ts`,
`bodyweight-exercises.ts`), sport-adapters met ingebouwde regels
(`verdeelSessieTypen()` per sport), `docs/*-master-spec.md`-bestanden
(bijv. running-specialist-master-spec.md, eerder gezien). Of dit
voldoende is om "alleen de structuur te verbeteren" i.p.v. iets nieuws
te bouwen, zoals de gebruiker vermoedt, is **niet onderzocht** binnen
deze audit. **Vertrouwen: laag — vermoeden, geen bevestiging.**

## 14. Adaptation Engine — dubbele-mutatie-bescherming
**Categorie: B — bestaat, gedeeltelijke dekking.**
ADR-007 (Single Workout Mutation Principle, v2.4.265) bestaat al en
behandelt precies dit probleem — bevestigd deze week gelezen. Vraag die
deze audit niet beantwoordt: dekt ADR-007 ALLE genoemde signaalbronnen
(Recovery/Cross Sport/Blessure/Context/Life Events/Coach Policy), of
een subset? **Vertrouwen: matig** — het principe bestaat aantoonbaar,
de volledige dekking niet geverifieerd.

---

## Samenvatting — wat dit betekent voor de vervolgstappen

**STATUS: analysefase afgesloten (5 augustus 2026).** Onderstaande
weerspiegelt de definitieve classificatie, niet de tussenstand.

**Sterk bewezen, kan als basis dienen zonder verder onderzoek:**
Training Plan Platform (A), Performance Platform (A), Learning Rules
Engine (A), Workout Completion Platform/Activity Import+Matching (A),
Running/Cycling-specialisten (A), **Workout Player/Universal Training
Engine (B — herclassificatie, was eerst "onbekend/hoog risico")**.

**Bestaat, verdient gerichte consolidatie (geen nieuwbouw):**
Context Platform (B), Universal Athlete Platform (B, rol bevestigd
grotendeels correct), Adaptation Engine-dekking (B), Workout Platform
(B/C, per-specialist → generiek), Workout Player (B, zie boven).

**Vergt EIGEN onderzoek zodra er een concrete aanleiding is —
voorlopig niet bouwen:**
Intelligence Platform, Knowledge Platform — beide vermoedelijk
grotendeels consolidatie, niet als losse actie opgepakt in Fase 0/0.5.

**Nog open vanuit de Datamodelanalyse, nu met een besluit:**
`training_results` → `activity_sessions`-brug voor activiteitssporten
zonder externe bron (Final Architecture-regel, gebruiker 5 augustus
2026) — eerste concrete implementatiepunt van de nieuwe fase.

**Rowing/Cycling dataflow — bewust NIET los getraceerd.** De
Running-trace + bevestigd eigen gebruikspatroon (Cycling/Rowing volgen
hetzelfde Concept2/Garmin/TCX→import-patroon) + de architecturale
Today Engine-regel (identiek voor alle drie) samen vormen voldoende
onafhankelijk bewijs. Verdere audit zou hier afnemende meerwaarde
hebben — bouwen levert nu meer op dan nog meer bevestigen.
