# CoachOS

> Data-first training engine met AI als uitvoerende coach laag.
> De bibliotheek is altijd de bron van waarheid. AI assembleert alleen.

## ⚠️ Openstaande Punten — Gebouwd maar NIET Aangesloten

**Vastgelegd 3 augustus 2026, naar aanleiding van de rolling horizon-bug
(v2.4.248): iets ontwerpen/bouwen zonder de aansluiting te maken, en
dat dan vergeten, want het stond alleen los in commentaar. Vaste regel
vanaf nu: elk "gebouwd, nog niet aangesloten"-punt komt HIER, niet
alleen in een losse commentaarregel bij de code zelf.**

**Status (3 augustus 2026, avond): 5,5 van de 6 punten opgelost.** Het
laatste punt (Omgeving-categorie) bleek deels te snel afgeschreven —
een gecontroleerde aanname ("geen weerdata beschikbaar") klopte niet;
er bestond al een uitgebreide weer-API. 2 van de 5 velden (hitte/
koude-adaptatie) zijn alsnog gevuld. De overige 3 (hoogte/hydratatie/
energie) blijven terecht leeg — daar bestaat écht geen databron voor.

| Wat | Status | Waar | Risico als het blijft liggen |
|---|---|---|---|
| **Learning Rules Engine** (`evalueerRegels()`) | ✅ **Volledig aangesloten (v2.4.253 + v2.4.256)** — context-verzameling, evalueren, zichtbaar maken (v2.4.253), én nu ook daadwerkelijk toegepast op toekomstige Impact Engine-berekeningen (v2.4.256, `learned-adjustments.ts`) | `learning-context.ts` + `learning-rules-koppeling.ts` + `learned-adjustments.ts` | — |
| **Alternative Engine** (`bepaalAlternatieven()`) | ✅ **Aangesloten (v2.4.254)** — trigger: ontbrekend materiaal (geen Concept2 gekoppeld), alternatieven zijn ANDERE sporten waar de gebruiker al een actief plan voor heeft (geen niet-bestaande workout-catalogus), zichtbaar op Rowing's Trainingsplan-pagina met een link. Slecht-weer/blessure-triggers nog niet gebouwd (geen weer-/blessuredata gekoppeld) | `api/specialists/rowing/training-plan/workout/route.ts` | — |
| **Rowing coach-conversatieroute** (automatische inzicht-generatie) | ✅ **Gebouwd (v2.4.255)** — `rowing-analysis.ts` (bestond nog niet, eerst gebouwd) + `api/specialists/rowing/coach` (mirror van Running's route), inclusief automatische Coach Memory-vulling via dezelfde Learning Engine als Cycling/Running | `rowing-analysis.ts` + `api/specialists/rowing/coach/route.ts` | — |
| **Universal Athlete Platform — Omgeving-categorie** (hitte/koude/hoogte-adaptatie, hydratatie, energie) | ⚠️ **Gedeeltelijk opgelost (v2.4.257), indoor/buiten-fix (v2.4.258)** — hitte_adaptatie + koude_adaptatie gevuld via de al-bestaande weer-API. FIX: eerste versie paste weer toe op ELKE sessie, ook indoor (Concept2/trainer/Zwift) — nu Rowing/Concept2 volledig uitgesloten (altijd indoor), Running/Cycling alleen bij bevestigd buiten (Strava's trainer-veld + VirtualRide-check). hoogte_adaptatie/hydratatie_status/energie_beschikbaarheid blijven eerlijk leeg | `weer-impact-adapter.ts` | 3 van de 5 velden blijven "Nog geen data" — geen bug, geen bron |
| **Rolling horizon-verlenging** | ✅ **Gefixt (v2.4.248), automatisch gemaakt (v2.4.249)** — was het voorbeeld dat tot deze lijst leidde. Eerste versie was per-sport handmatig (moest de juiste pagina bezoeken); nu automatisch voor alle actieve sporten bij elke Today Engine-aanroep | `today-engine.ts` + `training-plan-engine/core.ts` | — |
| **Performance Platform CTL/ATL/TSB sluit Rowing volledig uit** | ✅ **Gefixt (v2.4.252)** — 2k-testtijd-baseline toegevoegd aan Rowing Profiel (Fase 2 uit het overleg: Population Model → Personal Baseline), `rowing-grafieken.ts` gebouwd (spiegelbeeld van running-grafieken.ts), `load-engine.ts` neemt Rowing nu volledig mee | `rowing-grafieken.ts` + `core/performance/engines/load-engine.ts` | — |
| **"Rowing vergeten"-patroon (systematisch gecheckt)** | ✅ **5 instanties gevonden en gefixt (v2.4.251)** — `api/action-plan/route.ts` (bronlabel-ternary), `api/specialists/[type]/data/route.ts` (generieke data-fetcher-tabel, laag risico want overruled door de specifieke Rowing-route), `app/goals/page.tsx` (Rowing stond nog op `beschikbaar:false`, stale sinds v2.4.216) | Meerdere bestanden | — |
| **Workout Matching Service** (`completed_activity_id` werd sinds v2.4.96 nergens gevuld — elke sessie werd na de datum als `missed_session` behandeld, ook echt uitgevoerde trainingen) | 🟡 **Fase 1 + Fase 2 afgerond (v2.4.267-271)** — generieke Core + Matchers voor Rowing/Running/Cycling (de 3 sporten mét een Training Plan Engine), in-app testbaar via `/debug/workout-matching` (sport-selector). Strength Matcher bewust geblokkeerd (Strength heeft nog geen Training Plan Engine — zie roadmap). Fase 3 (Strava/Garmin/handmatig aansluiten), Fase 4 (confidence-UX) nog niet gebouwd — zie `docs/workout-completion-platform-adr-v1.md` en de roadmap-sectie hieronder | `training-plan-engine/workout-matcher.ts` + `training-plan-engine/matchers/*` + `debug/workout-matching/` | Buiten Rowing/Concept2 blijft het oorspronkelijke gat bestaan tot Fase 3 |

**Waarom dit soort dingen gebeuren, eerlijk benoemd:** bij het bouwen
van een nieuwe engine (Learning Rules/Alternative/etc.) ligt de focus
op "werkt de logica zelf correct" (en dat wordt ook grondig getest) —
maar "wie roept dit ooit aan in de echte app" is een aparte vraag die
soms niet gesteld wordt totdat iemand het gemis merkt. Vanaf nu:
expliciet checken en hier vastleggen bij elke nieuwe engine.

## 🏛️ CoachOS Platform Final Architecture — bevroren referentie
**Vastgelegd 5 augustus 2026. Status: analysefase afgesloten,
implementatiefase gestart.**

Na de Workout Completion Platform (ADR, hierboven) volgde een bredere
architectuurronde: **Platform Audit** (classificatie van elke
platformlaag tegen de bestaande code) en een **Dataflow Audit**
(Running end-to-end gevolgd, schrijf/lees/data per stap). Beide
documenten (`docs/platform-audit-fase0-v1.md`,
`docs/dataflow-audit-running-v1.md`) zijn de bron van waarheid voor
onderstaande conclusies — niet aannames, per stap in code geverifieerd.

**Kernresultaat:** de grote architectuurvragen zijn beantwoord, met
bewijs, niet met een aanname:
- ✅ Eén Master Coach (`api/coach/route.ts`)
- ✅ Specialisten bepalen de inhoud (Training Plan Platform, A)
- ✅ **Trainer AI = Universal Training Engine** — geen twee systemen,
  één systeem. Generieke uitvoerder (Workout Player) voor sporten
  ZONDER eigen Training Plan Engine (Strength/Kettlebell/Bodyweight).
  Wordt NOOIT gebruikt zodra een specialist-trainingsplan bestaat
  (Today Engine, vaste prioriteitsvolgorde, bevestigd in code)
- ✅ Cardio (Running/Cycling/Rowing) heeft GEEN in-app Workout Player
  nodig — uitvoering gebeurt op extern apparaat (Garmin/Concept2),
  CoachOS is de coach, niet de trainingscomputer
- ✅ `activity_sessions` is de centrale waarheid voor extern
  geïmporteerde activiteiten (Source Isolation-principe, zie ADR §2b)
- ✅ Workout Matching is sport-onafhankelijk (generieke Core + Sport
  Adapters)
- ✅ Universal Athlete Platform observeert or/analyseert, beslist niet
- ✅ Learning Rules Engine is reproduceerbaar (IF-THEN, geen black box)
- ✅ Geen dubbele mutaties (ADR-007, Single Workout Mutation Principle)

**Wat dit architectonisch betekent — twee takken, niet één keten:**
```
                    Master Coach
                          │
          ┌───────────────┴───────────────┐
          │                               │
          ▼                               ▼
Cardio Specialisten              Gym Specialisten
(Running/Cycling/Rowing)      (Strength/Kettlebell/Bodyweight)
          │                               │
          ▼                               ▼
 Extern apparaat                Trainer AI / Universal
 (Garmin/Concept2)               Training Engine (Workout Player)
          │                               │
          ▼                               ▼
      activity_sessions          training_results
                │                      │
                └──────────────┬───────┘
                               ▼
                 (brug: v2.4.278 — alleen activiteitssporten)
                               ▼
                     activity_sessions (uniform)
                               ▼
                    Workout Matching Service
                               ▼
                     Performance Platform
                               ▼
                  Universal Athlete Platform
                               ▼
                     Learning Rules Engine
                               ▼
                        Master Coach
```

**Ontwikkelregels vanaf nu (bevroren, niet steeds heropenen):**
- Geen nieuwe parallelle systemen
- Geen dubbele businesslogica
- Geen sport-specifieke implementatie waar een platformoplossing
  al bestaat
- Elke laag: exact één verantwoordelijkheid
- Bronlogica stopt bij Activity Import — `activity_sessions` is en
  blijft de canonical activity
- Alleen nog nieuwe platformlagen introduceren bij een **aantoonbaar**
  probleem tijdens implementatie, niet speculatief vooruitbouwen
  (Intelligence Platform/Knowledge Platform: pas onderzoeken/bouwen
  zodra er een concrete aanleiding is, zelfde principe als waarom
  Rowing pas een specialist werd toen daar een reden voor was)

## 🎯 Actieve Roadmap — Workout Completion Platform

**Vastgelegd 4 augustus 2026, na expliciet akkoord van de gebruiker:
dit wordt stap voor stap afgemaakt, sessie na sessie, tot alles gedaan
is — "geen losse eindjes, alles moet werken zoals het hoort." Bij elke
nieuwe sessie over CoachOS: lees dit blok, ga verder bij "Volgende
stap" hieronder, vraag niet opnieuw om richting — die staat hier al
vast. Bron: `docs/workout-completion-platform-adr-v1.md`.**

### ✅❌ Openstaand, samengevat (bijgewerkt 5 augustus 2026, avond)
De losse checklist-items verderop in dit document zijn de volledige,
gedetailleerde geschiedenis — dit blok is de betrouwbare, actuele
samenvatting, hier bovenaan zodat 'ie niet tussen oudere regels
verdwaalt.

**Genuanceerd — wacht op een externe gebeurtenis, geen actie nodig:**
- Verificatie Fase 1 (Rowing/Concept2) in productie — wacht op 7/9
  augustus, een echte training
- Concept2-webhook — gebouwd (v2.4.286), **verwerkingslogica nu
  testbaar via `/debug/concept2-webhook` (v2.4.299)** — het geheime
  pad-segment zelf (CONCEPT2_WEBHOOK_SECRET) kan alleen extern getest
  worden, wacht nog op Concept2's eigen site (502 Bad Gateway, 5
  augustus, storing bij Concept2 zelf) + handmatige registratie door
  de gebruiker

**Nog niet gebouwd, geen externe blokkade:**
- **Strength als volwaardige specialist** (eigen Training Plan Engine)
  — apart traject, bewust losgehouden van het platform zelf (opdracht
  gebruiker, 5 augustus 2026 avond: "Strength kan altijd later, ik wil
  het platform af")

**Intelligence Platform / Knowledge Platform — verkenning afgerond
(5 augustus 2026, avond): bestaan al, alleen niet zo genoemd. Geen
code gewijzigd, puur bevestiging.**
- **Intelligence Platform** = `beslisTussenSpecialisten()`
  (`lib/specialists/decision-engine.ts`) + `genereerCoachPolicy()` +
  `api/coach/route.ts` samen. Volledig deterministisch (expliciet zo
  gedocumenteerd, "geen AI"), combineert meerdere specialist-
  samenvattingen (belasting/risico/doelbelangrijkheid/urgentie) tot
  één besluit, met reasoning erbij (uitlegbaarheid) — exact wat het
  oorspronkelijke Intelligence Platform-ontwerp beschreef
- **Knowledge Platform** = de zes bestaande oefeningenbibliotheken
  (`kettlebell/bodyweight/strength/mobility/recovery/running-drills-
  exercises.ts`, al ontdubbeld sinds v2.4.7, Core Architectuurregel #1
  "Libraries are the source of truth") + de master-spec-documenten
  (bijv. `docs/running-specialist-master-spec.md`) + de bestaande
  Sport Adapters
- **Geen aparte "Platform"-laag nodig** — dat zou precies de dubbele
  logica creëren die Core Architectuurregel #0 wil voorkomen. Deze
  verkenning is daarmee zelf het antwoord, geen bouwopdracht.

### Architectuurprincipe — Source Isolation
**Vastgelegd 5 augustus 2026, volledig uitgewerkt in
`docs/workout-completion-platform-adr-v1.md` §2b.**

> De importlaag is bronbewust; het platform is brononafhankelijk.
> `activity_sessions` vormt de grens tussen beide werelden.

Bronlogica (authenticatie, parser, dedup, bronprioriteit) hoort alleen
thuis in de Activity Import-laag (Concept2/Garmin TCX/Strava/handmatig).
Vanaf `activity_sessions` — het Canonical Activity Model — werkt alles
erna (Matching Service, Performance Platform, Universal Athlete
Platform, Learning Rules, Coach Memory, Today Engine, Master Coach)
uitsluitend met sport/duur/afstand/tijd/metrics, nooit met `source`.
Geverifieerd: `ActiviteitVoorMatching` bevat geen `source`-veld — dit
was al zo gebouwd, nu expliciet vastgelegd zodat het zo blijft bij
toekomstige bronnen (Polar/Suunto/COROS/Zwift/Wahoo/FIT-bestanden/
Health Connect).

### Operationele context (vastgelegd 5 augustus 2026)
**Belangrijk voor hoe Fase 3 verder gebouwd én getest wordt:**

- **Strava-koppeling is tijdelijk buiten gebruik.** Gestart toen
  Strava's API nog gratis toegankelijk was; inmiddels vereist Strava
  een betaald developer-abonnement. De gebruiker gebruikt dit voorlopig
  niet meer. **Gevolg:** de Strava-matching uit v2.4.273 is gebouwd en
  klopt qua code, maar is momenteel NIET te testen in productie — er
  komt simpelweg geen nieuwe Strava-data meer binnen. Blijft staan
  (voor de toekomst, mocht Strava weer in gebruik komen), maar reken
  er niet op als testpad.
- **Garmin loopt nu via handmatige TCX-bestand-upload**
  (`api/health/garmin-activity-tcx/route.ts`), NIET via de Garmin
  Connect API. De gebruiker wacht op Garmin API-toegang — kan nog even
  duren, geen bekende datum. **Gevolg:** wanneer Fase 3 het Garmin-punt
  bereikt, is de TCX-upload-route het punt om op aan te sluiten (dat is
  wat daadwerkelijk gebruikt en dus testbaar is), niet een
  toekomstige/hypothetische Garmin-API-route. Er is ook een
  Vision-route (`garmin-activity-vision/route.ts`, foto-import) — apart
  te checken of die ook actief gebruikt wordt.
- Bouwen mag gewoon doorgaan ook als iets (nog) niet te testen is — de
  gebruiker wil geen losse eindjes, dus liever nu bouwen en later
  bevestigen dan wachten. Bij elke stap die niet te testen is: dat
  expliciet benoemen (niet doen alsof het getest is).

### Voortgang
- [x] Fase 1 — generieke Core + Rowing Matcher (Concept2) — v2.4.267
- [x] Fase 1 — in-app debug-dashboard + handmatige testtools
      (dry-run/forceer/reset) — v2.4.268, volledig doorgetest door de
      gebruiker, alles gedroeg zich zoals ontworpen
- [x] **Verificatie Fase 1 in productie — BEVESTIGD GESLAAGD, 7 augustus
      2026.** Een echte Rowing-training (31 min) via "Sync nu" werd
      automatisch `completed`, zonder `[TEST]`-label — precies zoals
      bedoeld, geen debug-omweg meer nodig. **Bijkomende, niet eerder
      geteste bevestiging:** de Coach Decision Engine reageerde
      correct — geen Coach Call, want de sessie kwam exact overeen met
      de planning (31 min gepland, 31 min gedaan). Dit was de laatste
      resterende onzekerheid van het hele Workout Completion Platform
      — nu volledig, organisch bevestigd in productie, niet alleen via
      debug-tools.
- [x] Fase 2 — Running Matcher — v2.4.270. Zelfde eerlijke beperking
      als Rowing (geen doel-afstand-veld om tegen te toetsen — alleen
      duur). Debug-dashboard gegeneraliseerd naar meerdere sporten
      (sport-selector, `?sport=`) i.p.v. per matcher een kopie van het
      hele scherm. Nog NIET aangesloten op een ingest-route — dat is
      Fase 3, apart
- [x] Fase 2 — Cycling Matcher — v2.4.271. Beperking geverifieerd
      (niet aangenomen): `core.ts` insert in `training_plan_sessions`
      gebruikt voor alle sporten dezelfde kolommen, geen vermogen/
      afstand-target specifiek voor Cycling. Debug-scherm: registry
      uitgebreid, Cycling heeft 3 activiteit-namen i.p.v. 1 (indoor/
      buiten-varianten). Nog NIET aangesloten op een ingest-route
- [~] ~~Fase 2 — Strength Matcher~~ — **GEBLOKKEERD, ontdekt 5 augustus
      2026 vóór het bouwen (geen los eindje willen achterlaten):**
      Strength heeft geen Training Plan Engine — geen
      `strength-adapter.ts` (404), en het staat al expliciet in dit
      README als "⏳ Niet gestart" onder "Rowing/Strength/Kettlebell
      als volwaardige specialisten". Zonder Training Plan Engine
      bestaan er geen `training_plan_sessions` voor Strength om tegen
      te matchen — een matcher bouwen zou nu een matcher zijn zonder
      iets om te matchen. Pas oppakken zodra Strength een eigen
      Training Plan Engine heeft (apart, groter traject — zie sectie
      "Rowing/Strength/Kettlebell als volwaardige specialisten"
      verderop in dit README). Fase 2 is voor nu inhoudelijk klaar met
      de drie sporten die wél een Training Plan Engine hebben
      (Rowing/Running/Cycling).
- [x] Fase 3 — Strava aansluiten op de Matching Service — v2.4.273.
      `ACTIVITEIT_NAAR_SPORT_SLEUTEL` (bestond al, voor Learning Rules)
      hergebruikt om per activiteit de juiste matcher te vinden —
      Roeien toegevoegd aan die mapping (ontbrak, want geen
      impact-adapter voor Rowing-via-Strava). Matcher-registry
      geëxtraheerd naar een gedeeld bestand
      (`training-plan-engine/matcher-registry.ts`) zodat het
      debug-scherm en productie-routes dezelfde bron gebruiken, geen
      twee kopieën. **⚠️ Niet testbaar in productie** — zie
      "Operationele context" hierboven: Strava-koppeling is tijdelijk
      buiten gebruik (betaald abonnement vereist, gebruiker doet dit nu
      niet)
- [x] Fase 3 — Garmin TCX aansluiten op de Matching Service —
      v2.4.276. Twee insert-punten (nieuwe activiteit + overschrijving
      van een bestaande upload) — allebei aangesloten via een lokale
      `probeerMatching()`-helper, niet dubbel uitgeschreven. Sport-
      mapping geëxtraheerd naar `activiteit-sport-mapping.ts` (was
      lokaal in `strava-activity-processor.ts`, nu gedeeld — Strava
      hergebruikt 'm nu ook). Handmatig doorgetest via her-upload van
      een oude activiteit — geen crash, correcte "geen match"-
      beslissing bij een groot duurverschil (Δ55%, confidence 38%).
      **Dit is het daadwerkelijk actief gebruikte pad** (zie
      Operationele context).
- [x] ~~Fase 3 — Garmin Vision aansluiten op de Matching Service~~ —
      **bewust overgeslagen (niet geblokkeerd, andere reden dan
      Strength/Strava): gebruiker gebruikt uitsluitend TCX-upload, nooit
      de screenshot-import.** Vision blijft als werkende feature bestaan
      (ongewijzigd, niet verwijderd — `garmin_activity_imports` wordt
      ook door de TCX-flow gebruikt, dus sowieso niet iets om aan te
      raken), maar wordt niet aangesloten op de Matching Service zolang
      er geen actief gebruik van is. Als dat ooit verandert: alsnog
      oppakken, zelfde patroon als TCX (hergebruik
      `matcher-registry.ts` + `activiteit-sport-mapping.ts`).
- [x] ~~Fase 3 — handmatige/bibliotheek-import aansluiten op de
      Matching Service~~ — **HERZIEN 5 augustus 2026, na Datamodel- en
      Platform-analyse.** Bleek geen kwestie van "nog een ingest-route
      aansluiten" (zoals Strava/Garmin TCX) — `api/training/complete/
      route.ts` schrijft naar `training_results`, een andere tabel dan
      `activity_sessions`. Vervangen door het punt hieronder, dat het
      eigenlijke werk preciezer beschrijft. (Checkbox stond hier al
      lang ten onrechte nog op `[ ]` — puur markdown-opschoning, geen
      echt openstaand werk.)
- [x] **`training_results` → `activity_sessions`-brug** — v2.4.278.
      **Scope gecorrigeerd t.o.v. eerdere versie van dit punt** (stond
      hier omgekeerd): geldt voor **activiteitssporten zonder externe
      bron** (Running/Cycling/Rowing/Walking/Swimming — via Trainer
      AI/bibliotheek, geen Garmin-horloge om), NIET voor Strength/
      Kettlebell/Bodyweight — die blijven bewust bij `training_results`
      alleen (Final Architecture, expliciete regel, gebruiker 5
      augustus 2026). Nieuw: `activity-import/source-priority-policy.ts`
      (generieke prioriteitstabel i.p.v. losse if/else-dedup — Concept2
      100/Garmin 90/Strava 80/Apple Health 70/Trainer AI 10/Manual 0,
      uitbreidbaar zonder herontwerp) + `activity-import/
      activity-bridge.ts` (eigen verantwoordelijkheid: "moet hier een
      activiteit uit ontstaan?", gescheiden van `training/complete/
      route.ts` die alleen "training is afgerond" registreert).
      Eerlijke beperking: `metrics` blijft leeg (geen afstand/hartslag
      beschikbaar vanuit deze flow) — geen schijndata. Roept na een
      geslaagde brug ook de Workout Matching Service aan (dezelfde flow
      als elke andere bron, Source Isolation-principe). **Bestaande
      dedup-checks (Concept2/Garmin/Strava) bewust NIET gemigreerd naar
      de nieuwe policy in deze levering** — werken al correct, aparte
      latere consolidatie. **In-app testbaar via
      `/debug/activity-bridge` (v2.4.279).**
- [x] ~~Fase 4 — confidence-UX~~ / ~~Fase 4 — retrofit Cycling-
      ritanalyse~~ — **beide HERZIEN, zie de definitieve status onder
      "Opdracht 5 augustus 2026: 1 t/m 3. Go" → punt 2 hieronder in
      dit README.** (Deze twee regels stonden hier verouderd/
      tegenstrijdig — bij het doornemen van de roadmap gevonden en
      rechtgezet, niet stilzwijgend laten staan.)
- [x] **Concept2-webhook** — v2.4.286, gebouwd. Zie punt 1 uit
      "Opdracht 5 augustus 2026" hieronder voor de volledige details
      (SQL, beveiliging, eerlijke beperking bij result-deleted). Nog
      niet getest — wacht op een werkende Concept2-site (5 augustus:
      productiesite gaf 502 Bad Gateway, storing bij Concept2 zelf,
      buiten onze controle) en handmatige registratie door de gebruiker.
- [ ] **Strength als volwaardige specialist** (eigen Training Plan
      Engine) — pas dan wordt de Strength Matcher (eerder geblokkeerd)
      en Workout Matching voor Strength mogelijk. Groot, apart traject
      — zie bestaande sectie "Rowing/Strength/Kettlebell als
      volwaardige specialisten" verderop in dit README.
- [x] ~~Intelligence Platform / Knowledge Platform~~ — **verkenning
      afgerond v2.4.294, bevestigd bestaand.** Zie de volledige
      uitwerking bovenaan dit README (sectie "✅❌ Openstaand,
      samengevoegd"). Geen nieuwe code — Intelligence Platform =
      `beslisTussenSpecialisten()` + `genereerCoachPolicy()` +
      `api/coach/route.ts`, Knowledge Platform = de zes bestaande
      oefeningenbibliotheken + master-spec-documenten. (Deze regel
      stond hier nog verouderd op "niet bevestigd" — bij het doornemen
      van de roadmap gevonden en rechtgezet, zelfde soort opschoning
      als eerder bij v2.4.291.)

### Volgende stap
**Analysefase afgesloten (5 augustus 2026) — implementatiefase,
volgens de bevroren architectuur hierboven.** Verificatie Fase 1 in
productie kan nog steeds pas ná 7/9 augustus — niet te versnellen, geen
actie voor nodig. **Activity Bridge volledig doorgetest (5 augustus,
via `/debug/activity-bridge`)** — twee bugs gevonden en gefixt tijdens
het testen zelf, precies waarvoor de debugpagina bedoeld was:
- v2.4.280: `activity_sessions_source_check` stond `'trainer_ai'` niet
  toe (constraint niet geverifieerd vóór het bouwen — zelfde
  foutpatroon als eerder bij v2.4.221/24, nu een derde keer expliciet
  vastgelegd als les)
- v2.4.281: `nieuweBronWint()` gebruikte `>=` i.p.v. `>`, waardoor een
  gelijke source-prioriteit ten onrechte niet blokkeerde — de Bridge
  kon zichzelf dupliceren bij een herhaalde aanroep

Beide bevestigd gefixt (basistest + dedup-herhaaltest, beide correct).

**Opdracht 5 augustus 2026: "1 t/m 3. Go" — alle drie na elkaar
oppakken, geen tussentijdse keuze meer nodig.**

- [x] **1. Dedup-checks migreren naar de Source Priority Policy** —
      v2.4.283. Alle vier ingest-routes (Concept2/Strava/Garmin TCX/
      Garmin Vision) gemigreerd van hardcoded "check specifiek op
      Concept2, bewust alleen voor Roeien" naar de generieke policy.
      Scope bewust uitgebreid naar alle activiteitssporten (Trainer AI
      als lage-prioriteit-bron geldt nu overal, niet alleen bij
      Roeien-vs-Concept2). Eén bug gevonden en gefixt tijdens het
      bouwen zelf (Strava-check filterde eerst niet op sport) — voor
      Rowing/Concept2 blijft het gedrag identiek aan daarvoor, dat deel
      is dus al impliciet bevestigd via alle eerdere Rowing-tests deze
      week.
- [x] **2. Fase 4 — confidence-UX: HERDEFINIEERD, niet gebouwd zoals
      oorspronkelijk bedoeld.** Twee ontwerprondes doorlopen
      (`docs/confidence-ux-fase4-design-v1.md` → generiek Coach Card-
      component, `v2.md` → hergebruik bestaand Coach Call-systeem) —
      **beide definitief ingehaald door de Final Architecture Update
      (gebruiker, 5 augustus 2026, met een nuancering achteraf).**

      **De kernregel, precies:** niet "Coach Call is alleen voor
      onverwachte/in-app trainingen" (dat was een te absolute eerdere
      formulering) — Coach Call is **bron-onafhankelijk** en ontstaat
      wanneer de Coach iets wil bespreken naar aanleiding van een
      uitgevoerde activiteit, ongeacht of die van Garmin/Concept2/TCX
      of Trainer AI komt. Bevestigd tegen het al-bestaande gedrag
      (README, sectie "Coach Call Systeem"): Garmin- en Strava-
      activiteiten triggerden altijd al Coach Call, niet pas bij een
      afwijking van het plan.

      **Wat wél scherp blijft, en waarom Fase 4 alsnog is afgesloten:**
      Workout Matching ("was dit de geplande training?") is een puur
      technisch systeemproces — geen coachgesprek. Coach Call is de
      evaluatielaag van de **Master Coach** (niet van Trainer, niet van
      een Specialist): RPE, gevoel, energie, afwijkingen, stress/slaap,
      blessureklachten — subjectieve context die Garmin/Concept2 nooit
      kan meten, en die via Coach Memory/Learning Rules toekomstige
      beslissingen voedt. Matching-confidence hoort daar niet tussen:
      een technische onzekerheidsscore is geen onderwerp voor een
      coachgesprek. Confidence blijft dus volledig intern: bij <70%
      simpelweg niet koppelen, alleen loggen (bestaat al:
      `match_confidence`/`match_reden`, v2.4.267), geen enkele
      gebruikersvraag via Coach Call of elders. **Er is voor dit punt
      niets meer te bouwen** — de drie logging-events uit de eerdere
      ontwerprondes (`matched_user_confirmed`/`matched_user_rejected`)
      vervallen, want zonder gebruikersinteractie via Coach Call zijn
      die niet meer van toepassing — alleen `matched_auto` (≥70%) en
      `niet_gematcht` (<70%, stil) blijven relevant.
- [x] **Punt 17 uit de Final Architecture Update — Source Priority
      Policy-verificatie** — v2.4.284. Expliciet gecontroleerd, niet
      aangenomen: Strava en Garmin TCX blokkeerden zichzelf al correct
      bij een bestaande hogere/gelijke prioriteit (v2.4.283), maar
      ruimden een bestaande LAGERE-prioriteit-rij (bijv. een Trainer AI
      Activity Bridge-rij) nooit op na hun eigen succesvolle import —
      alleen Concept2 deed dat al. Beide routes nu uitgebreid met
      dezelfde opruim-logica. Zonder deze fix konden een Trainer AI-rij
      en een latere Strava/Garmin-rij voor dezelfde dag naast elkaar
      blijven bestaan.
- [x] **3. Concept2-webhook** — v2.4.286. Onderzoek eerst: officiële
      docs (log.concept2.com/developers/documentation/, Webhook-sectie)
      volledig doorgelezen — **geen signature-verificatie beschikbaar**
      bij Concept2 (bevestigd, geen aanname), dus twee eigen
      beveiligingslagen toegevoegd: geheim pad-segment
      (`CONCEPT2_WEBHOOK_SECRET`, 404 bij mismatch — niet 401/403, om
      het pad niet te verklappen) + validatie tegen bekende
      `concept2_tokens.concept2_user_id` (nieuw veld). Callback-route
      uitgebreid met een `GET /api/users/me`-aanroep om dat veld te
      vullen (ontbrak volledig, geverifieerd). Per-resultaat-
      verwerkingslogica geëxtraheerd naar
      `specialists/concept2-result-processor.ts` — gedeeld door zowel
      de bestaande "Sync nu"-route als de nieuwe webhook, geen
      dubbele insert-logica. **Eerlijke, niet-oplosbare beperking:**
      Concept2's `result-deleted`-payload bevat geen user_id (alleen
      `result_id`, bevestigd in de docs) — voor deletes wordt daarom
      via de bestaande `activity_sessions`-rij zelf de eigenaar
      bepaald, niet vooraf tegen `concept2_tokens` gevalideerd. Grens
      van Concept2's eigen API-ontwerp, geen CoachOS-keuze.
      **Handmatige stap voor de gebruiker, niet te automatiseren:** de
      webhook-URL zelf registreren in Concept2's developer-portal.
      **Nog niet getest** — vergt een echte Concept2-registratie.
- [ ] 4. Strength als volwaardige specialist — groot, apart traject (NIET in de "1 t/m 3"-opdracht, blijft los)
- [x] **5. Coach Decision Engine — Fase 1** — v2.4.288. Ontwerp:
      `docs/guardian-mode-coach-call-trigger-v1.md`, v1.2. **Scope,
      bewust beperkt:** dekt alleen de vergelijkingsfunctie "was er een
      geplande sessie voor deze sport op deze datum" (rustdag-toch-
      getraind, extra/onaangekondigde training, sessie geannuleerd-
      toch-uitgevoerd) — NOG NIET: andere sport dan gepland (cross-
      sport), Recovery/HRV, blessureprotocol-naleving, cumulatieve
      belasting. Die vergen bredere signaalbronnen die nog niet
      geverifieerd zijn — apart uit te breiden (Fase 2), niet nu
      aangenomen dat het al werkt.

      **Eerste, enige toepassing: Concept2** — bewust gekozen omdat dit
      de nevenbevinding uit het analysedocument in één beweging oplost:
      Concept2 had NUL bestaande Coach Call-logica om te verplaatsen of
      te vervangen, dus dit is een schone, risicoloze eerste toepassing
      (geen oude code om te ontmantelen). Garmin TCX/Strava/Bibliotheek
      behouden voorlopig hun oude, directe aanmaaklogica — bewust NIET
      in deze levering aangepast, migreren komt later, één voor één,
      zelfde incrementele discipline als de Workout Matching Service
      (eerst Rowing bewijzen, dan uitbreiden).

      Nieuw: `coach/coach-decision-engine.ts` (eigen databasequery
      i.p.v. `bepaalTodayPlan()` hergebruiken — die laatste vergt een
      request-context/cookieHeader, niet bruikbaar vanuit een
      achtergrondproces zoals Concept2-verwerking) +
      `coach/coach-call-writer.ts` (schema/aanmaakpatroon 1-op-1
      hergebruikt van de bestaande Strava-route, nieuw veld
      `deviation_reason` puur additief).

      **Nog niet getest** — geen debug-tool gebouwd deze keer (zou een
      test-training_plan_sessions-scenario vergen); vergt een echte
      Concept2-sync op een dag met/zonder geplande sessie om te zien of
      het juiste Coach Call-gedrag ontstaat.

      **Fase 2 — v2.4.289: Garmin TCX gemigreerd.** Oude,
      onvoorwaardelijke Coach Call-aanmaak (nieuwe-insert-pad) vervangen
      door dezelfde Decision Engine. Het overschrijf-pad (her-upload van
      hetzelfde bestand) is bewust ONGEWIJZIGD gelaten — dat werkt al
      correct anders (update van de duur op een bestaand item, geen
      nieuwe call), geen "moet ik hier iets aanmaken"-beslissing, dus geen
      Decision Engine nodig. **Bug gevonden en gefixt tijdens het bouwen
      zelf:** de eerste versie van de wijziging nam aan dat een
      `sportSleutel`-variabele uit de matching-aanroep hoger in het
      bestand hergebruikt kon worden — bleek lokaal gescoped binnen een
      andere functie, niet beschikbaar op de nieuwe plek. Rechtgezet
      vóór levering, niet via een latere bugfix.

      **Kritieke fix, vóór Fase 3 ontdekt — v2.4.290:**
      `evalueerCoachCallBehoefte()` gaf bij "geen actief trainingsplan"
      ten onrechte `nodig: false` terug. Dat was al een stille
      regressie voor Concept2/Garmin TCX (de oude logica maakte altijd
      een call, ongeacht plan — iemand zonder actief plan kreeg nu
      opeens niets meer), en zou Fase 3 hard gebroken hebben:
      Strength/Kettlebell/Bodyweight hebben per ontwerp NOOIT een
      Training Plan Engine, dus "geen plan" zou daar altijd gelden en
      Coach Call zou voor die sporten nooit meer afgaan. Gecorrigeerd
      naar `nodig: true` — geen plan is zelf onzekerheid, dus
      voorzichtigheidshalve wél vragen (oude, veilige gedrag behouden).
      Gevonden en gefixt vóórdat Fase 3 gebouwd werd, niet erna.

      **Fase 3 — v2.4.290: Bibliotheek (`training/complete/route.ts`)
      gemigreerd.** `coach-call-writer.ts` uitgebreid met
      `trainingResultId` als alternatief voor `activiteitId` (het
      bestaande, wederzijds-nullable twee-kolommenschema uit de
      Coach Call Systeem-sectie hieronder, nu voor het eerst door de
      Decision Engine zelf gebruikt). Oude, handmatige "bestaat de call
      al, is dit item al toegevoegd"-check verwijderd —
      `schrijfCoachCallItem()` doet die idempotency-check nu zelf al.
      **Bijkomende opschoning:** de v2.4.9 `withRetry()`-wrapper (enige
      doel was retry rond de oude coach_call-aanmaak) is nu dode code
      en verwijderd, geen dode code laten staan.

      **Alle vier bronnen gemigreerd.** Concept2 (v2.4.288) → Garmin
      TCX (v2.4.289) → Bibliotheek (v2.4.290). Strava is bewust
      overgeslagen — ligt stil (zie Operationele context), geen
      prioriteit zolang er geen nieuwe Strava-data binnenkomt.

      **Fase 2 — v2.4.292: drie nieuwe signalen, ALLEMAAL consolidatie,
      GEEN nieuwe berekening.** Verkenning bevestigde het vermoeden van
      de gebruiker (Platform Audit-patroon, opnieuw): Recovery Engine,
      blessuremodule, CoachPolicy — alles bestond al, rijp en getest.
      - **Blessure:** `injuries`-tabel (`active=true`) — exact dezelfde
        query die `genereerCoachPolicy()` zelf ook al intern doet
      - **Herstel:** `genereerCoachPolicy()`'s kant-en-klare
        `recoveryState`-veld ('low'/'moderate'/'good') — geen aparte
        `calculateRecoveryScore()`-aanroep nodig, CoachPolicy wrapt dat
        al. Alleen bij een sessie ≥20 min (drempel om ruis bij korte
        activiteiten te vermijden)
      - **Cross-sport:** nieuwe QUERY (stond er een ANDERE sport
        gepland dezelfde dag), geen nieuwe tabel of logica
      - Alle drie CONTROLEREN vóór de bestaande Fase 1-planningscheck,
        want een blessure/laag-herstel-signaal is relevanter dan "komt
        overeen met planning" — een sessie kan matchen met het plan én
        alsnog coachwaardig zijn (bijv. wél volgens schema getraind,
        ondanks een blessure)
      - **Fase 3 — v2.4.293: cumulatieve belasting alsnog toegevoegd**
        (was bewust opengehouden bij Fase 2, nu afgemaakt op verzoek
        van de gebruiker — "ik wil het platform af, geen losse
        eindjes"). Twee nieuwe signalen, allebei bestaande tabellen,
        geen nieuwe databron: **meerdere sessies dezelfde dag**
        (`activity_sessions`, simpele telling, drempel 2) en
        **herhaald overslaan** (`training_plan_sessions`,
        `status='skipped'` — exacte waarde geverifieerd in
        `adjuster-core.ts`'s `missed_session`-trigger, niet aangenomen
        — laatste 14 dagen, drempel 3×, zelfde voorbeeldgetal als de
        architectuuropdracht zelf gaf). Bij het samenvoegen ontdekt en
        rechtgezet: de eigen-sport-plan-lookup werd twee keer apart
        opgehaald (Signaal 4 en Signaal 5) — samengevoegd tot één query.
        **Fout gevonden en gefixt vóór levering, niet erna:** bij het
        herschikken van de signalen raakte de
        `export interface CoachCallBehoefte {`-declaratie zelf per
        ongeluk kwijt (een module-comment overschreef de regel in
        plaats van ervoor te komen) — bij de verplichte eindcontrole
        opgemerkt vóór dit werd geleverd.
      - **Naamgeving bewust NIET gewijzigd** (bestandsnaam blijft
        `coach-decision-engine.ts`) ondanks het voorstel voor "Decision
        Service/Layer" — een rename zou de drie al-gekoppelde
        aanroeppunten onnodig laten schuiven zonder functionele winst.
        Inhoudelijk is het wél een pure aggregator geworden, zoals
        voorgesteld: roept alleen bestaande, al-geteste functies aan.
      - Alle drie de aanroeppunten (Concept2/Garmin TCX/Bibliotheek)
        geven nu ook de sessieduur mee — nodig voor het herstel-signaal.

**Referentiedocument:** de "Final Architecture Update — v2.4.284"
(gebruiker, 5 augustus 2026, met nuancering diezelfde dag) is de
nieuwe, definitieve architectuurreferentie — vervangt eerdere aannames
over Workout Player, Match Review en Coach Call. Kernregels: Master
Coach beslist strategie, Specialisten bepalen sportinhoud, Trainer
voert alleen uit, `activity_sessions` is de enige waarheid voor
Performance, `training_results` blijft de waarheid voor gym-sporten.
**Coach Call is de evaluatielaag van de Master Coach zelf** (niet van
Trainer, niet van een Specialist) — bron-onafhankelijk (Garmin/
Concept2/TCX/Trainer AI triggeren 'm allemaal al, bevestigd tegen
bestaand gedrag), voedt Coach Memory/Learning Rules met subjectieve
context (RPE/gevoel/afwijkingen/stress/blessures) die apparaten nooit
kunnen meten — maar nooit voor interne systeemlogica zoals Workout
Matching-confidence, dat blijft een puur technisch proces zonder
gebruikersvraag.

**EINDSTATUS, bijgewerkt 7 augustus 2026 — het platform is af, en nu
ook organisch bevestigd in productie.**
Workout Completion Platform (Fase 1-4), Activity Bridge, Source
Priority Policy, Coach Decision Engine (Fase 1-3), Intelligence/
Knowledge Platform-verkenning: allemaal afgerond. **Fase 1-verificatie
is BEVESTIGD GESLAAGD** (7 augustus — echte Rowing-training,
automatisch `completed`, Coach Decision Engine reageerde correct met
"geen afwijking, dus geen Coach Call"). Dit was de laatste,
niet-via-debug-bevestigde onzekerheid — nu gesloten. **Wat resteert is
geen bouwwerk meer, maar wachten op iets extern:**
- Concept2-webhook-test — wacht op een structureel probleem bij
  Concept2's eigen API-server (niet alleen de eerdere 502 op de site
  zelf — ook `GET /api/users/me` faalt losstaand daarvan). Gebruiker
  gebruikt intussen "Sync nu" handmatig, wat prima werkt via dezelfde
  verwerkingslogica als de webhook zou gebruiken — geen blokkade voor
  dagelijks gebruik, alleen voor de automatische push
- Coach Decision Engine's nieuwere signalen (blessure/herstel/
  cumulatieve belasting) — nog nooit organisch gezien, wacht op een
  natuurlijk scenario of een bewuste test

**Bewust buiten scope, op eigen verzoek:** Strength als volwaardige
specialist (een aparte specialist, geen platformwerk — "kan altijd
later").

## Coach Inbox — Fase C, eerste signaal (v2.4.299)
**Bron: Coach Agenda-visie Fase C, letterlijke voorbeeldzin die er al
stond: "Volgende week begint je vakantie — trainingsplan pauzeren?"**
Bewust met precies dit ene signaal gebouwd, niet de volledige
patroonherkenning-visie — zelfde incrementele aanpak als de rest van
deze week.

**Signaal: vakantie-pauze-voorstel.** `lib/coach/coach-inbox.ts`,
`evalueerCoachInboxSignalen()` — hergebruikt `haalOverzichtData()`
(bestond al, gedeeld met Coach Planning, geen nieuwe query op
`life_events`). Als een vakantie binnen 7 dagen begint (nog niet
gestart — bewust hetzelfde onderscheid als de "Nu bezig"-fix,
v2.4.297) én er actieve trainingsplannen zijn: een kaart op Home,
"Ja, pauzeren" roept dezelfde databasemutatie aan als de bestaande
pauzeer-knoppen per specialist (`training_plans.status → 'paused'`),
"Niet nu" verbergt de kaart voor deze sessie (geen permanente
dismissal-opslag — bewust simpel gehouden voor een eerste versie).

**Nog niet gebouwd:** overige Coach Inbox-signalen (patroonherkenning
— "je hebt 3 weken op rij op maandag getraind", herhaald overslaan,
etc.) — dit is bewust alleen het eerste, concrete signaal.

## 🔒 Gesloten architectuurbesluiten — niet opnieuw ter discussie stellen
**Vastgelegd 8 augustus 2026**, na een extern voorstel (GPT) dat
verouderde aannames bevatte over precies deze punten — hier expliciet
vastgelegd zodat een volgende sessie (of extern voorstel) ze niet
opnieuw als "openstaand" behandelt:
- **Coach Decision Engine (Fase 1-3, v2.4.288-293) is af** — planning-
  vergelijking, blessure, herstel, cross-sport, cumulatieve belasting.
  Concept2/Garmin TCX/Bibliotheek zijn gemigreerd; Strava/Garmin Vision
  bewust nog niet (liggen stil, geen prioriteit)
- **Workout Matching-confidence blijft volledig intern** — geen
  gebruikersvraag, geen Match Review UI, geen "was dit je geplande
  training?"-scherm. Alleen loggen (`match_confidence`/`match_reden`,
  bestaan al sinds v2.4.267)
- **Matching en Coach Call zijn en blijven twee gescheiden vragen** —
  Matching: "welke geplande sessie hoort hierbij?" Coach Call: "moet
  de Coach hierover praten?" Nooit samenvoegen tot één systeem

## 🏃 Activiteiten-scherm — redesign (v2.4.305)
**Vastgelegd 8 augustus 2026. Screenshot-referentie (gebruiker) als
UX-doel, volledige verificatiefase vooraf (7 punten, geen aannames)
vóór er iets gebouwd is.**

**Bestaande architectuur behouden, uitgebreid — niet vervangen:**
`src/app/activities/page.tsx` blijft de dunne wrapper,
`src/components/ActiviteitenSectie.tsx` blijft de hoofdcomponent,
`GET /api/activities` blijft dezelfde route, `/activities/[id]` blijft
ongewijzigd (routekaart + Ritanalyse, unieke waarde).

**Belangrijke correctie tijdens de verificatiefase:** `compact={true}`
(gebruikt door `ActiviteitenSectie` binnen Voortgang) bleek **nul
consumers** te hebben — `progressie/page.tsx` importeert het
component niet meer sinds v2.4.93's terugdraai. De harde "compact mag
niet breken"-regel uit de opdracht was dus gebaseerd op een verouderd
code-commentaar, niet de actuele routing. De prop is niet verwijderd
(geen onnodig risico), maar heeft het ontwerp niet meer beperkt dan
nodig.

**API (`GET /api/activities`) uitgebreid, server-side:**
- `tss`/`intensiteit` per sessie — **geen nieuwe formule**, de drie
  bestaande, geëxporteerde pure functies (`berekenGeschatteTSS`
  Cycling/`berekenGeschatteRunningTSS` Running/`berekenGeschatteRowingTSS`
  Rowing) rechtstreeks aangeroepen met de bestaande profiel-drempel-
  waarden (`ftp`/VDOT-afgeleid/`laatste_2k_tijd_sec`). Wandelen: bewust
  altijd `null`, geen formule verzonnen
- `bronLink` per sessie — Concept2 naar de specifieke workout
  (`concept2_user_id` + result-ID uit `notes`, **nog niet handmatig
  geverifieerd** — Concept2's eigen API-instabiliteit blokkeert dit nog
  steeds, zie `/debug/concept2-webhook`), Garmin/Strava naar hun
  algemene dashboard (geen specifieke-activiteit-ID meer construeren —
  Strava's betaalmodel maakt dat onbetrouwbaar, Garmin's TCX-import
  geeft geen bruikbaar web-ID), Trainer AI/onbekend: geen link
- `weekdoelMinuten` — som van `beschikbare_uren_per_week × 60` over
  Cycling/Running/Rowing-profielen met een ingevulde waarde. Geen
  nieuw doelensysteem

**`ActiviteitenSectie.tsx` uitgebreid:**
- Nieuw "Voortgang Dashboard" (alleen op de volledige pagina, niet in
  `compact`): Week/Maand-schakelaar (rollend 7/30 dagen, zelfde
  periode-definitie als de al-bestaande week-telling — geen nieuwe
  invoeren), totaal tijd/afstand/gem. TSS, trend vs. vorige periode,
  weekdoel-voortgangsbalk (**alleen bij "week"** — er bestaat geen
  maanddoel-bron, niet zelf verzonnen door het weekdoel te
  vermenigvuldigen)
- **Bug gefixt:** bronlabel was `session.source === 'strava' ? 'Strava'
  : 'Garmin'` — Concept2 en Trainer AI-activiteiten kregen dus ten
  onrechte "Garmin". Nu een expliciete mapping, alle vier bevestigde
  source-waarden benoemd
- Trainingsbelasting-regel op de kaart (kleurcode groen/blauw/rood,
  "Suffer Score" bewust niet gebruikt — bestaande CoachOS-term
  "Trainingsbelasting"/TSS)
- `getStravaActivityId()` verwijderd — dode code na de bronLink-
  vervanging

**Nog niet handmatig getest** — vergt een blik op de echte pagina met
echte data, inclusief de Concept2-link (blijft "gebouwd, niet
geverifieerd" zolang Concept2's API instabiel is).

## ✅ Rowing Performance Center — v2.4.309
**Gat uit de vorige notitie gedicht.** Cycling/Running hadden het al —
Rowing nu ook, met exact dezelfde eerlijke aanpak (geen nieuwe
formules, alleen bestaande data samengevoegd).

**Nieuw:**
- `rowing-grafieken.ts` uitgebreid — `haalRowingDashboard()` en
  `haalWekelijkseRowingTrend()`, spiegelbeeld van Running's
  equivalenten, met roei-conventies (split per 500m i.p.v. pace/km,
  slagfrequentie i.p.v. cadans). Snelheid altijd afgeleid uit
  afstand/duur — Concept2's eigen sync slaat geen los `avg_speed`-veld
  op, dus geen veld aangenomen dat er niet is
- `api/specialists/rowing/grafieken` — nieuwe route, spiegelbeeld van
  Running's, combineert Dashboard + CTL/ATL/TSB + Wekelijkse Trend
- `/coach/rowing/performance` — nieuwe pagina, één gecombineerd scherm
  (Dashboard + Trainingsbelasting-grafiek + drie wekelijkse-trend-
  staafdiagrammen), zelfde dependency-vrije SVG/CSS-aanpak als
  Running/Cycling — geen nieuwe chart-library
- Link toegevoegd op `/coach/rowing` zelf (was nergens vindbaar zonder)

**v2.4.310 — Records/Progressie alsnog toegevoegd** (op verzoek: "niet
laten liggen"). **Herziening van de eigen eerdere inschatting:** bij
het echt uitwerken bleek de "nieuwe tabel + parser"-aanpak (zoals
Running die heeft) niet nodig te zijn voor Rowing. Running haalt
records uit **losse lap-segmenten** binnen één langere activiteit
(sub-segment-extractie, vergt parser-tijd-berekening). Roeiers doen
daarentegen typisch een **hele sessie** exact als 2k-test/5k-test —
geen sub-segment nodig, dus query-time af te leiden direct uit
`activity_sessions`, geen nieuwe tabel.

**Wel een echt gat gevonden en gedicht:** de opgeslagen duur
(`activity_sessions.duration`) is afgerond op hele minuten — te grof
voor een PR (7:32 zou 8:00 worden). Nieuw, puur additief veld:
`metrics.precieze_duur_sec` (Concept2 geeft dit al in tienden van een
seconde, nooit eerder bewaard).

**Eerlijke beperking, expliciet:** alleen Concept2-sessies — Garmin
TCX heeft hetzelfde afrondingsprobleem (`tcx-parser.ts` rondt ook af
op hele minuten), maar dat bestand is gedeeld door alle sporten, dus
bewust niet in deze levering aangepast. Garmin-TCX-Rowing-sessies
tellen dus nog niet mee in Records/Progressie. Kleiner vervolgpunt dan
eerst gedacht, maar nog steeds een apart puntje.

**v2.4.311 — Halve marathon + marathon toegevoegd aan de
testafstanden.** Gemeld: deze twee ontbraken. Bevestigd, niet
aangenomen: Concept2's eigen ranking-documentatie noemt expliciet
"500m, 1000m, 2000m, 5000m, 6000m, 10000m, 21097m, 42195m or
100,000m" als officiële standaardafstanden — 21097/42195 zijn dus
geen verzinsel, exact dezelfde waarden als Running's
`PROGRESSIE_AFSTANDEN`. `STANDAARD_TESTAFSTANDEN` in
`rowing-grafieken.ts` en de labellijst in de pagina beide aangevuld.

## ⚠️ Vereist handmatige SQL — v2.4.322: TodayPlan-cache
**Vóór het pushen van v2.4.322 uitvoeren in Supabase.**

**Correctie, 11 augustus 2026:** de oorspronkelijk gegeven SQL miste
RLS — Supabase's eigen beveiligingswaarschuwing signaleerde dit
terecht bij het uitvoeren ("Clients using anon or authenticated keys
may be able to read/write today_plan_cache"). Mijn eigen fout — had
zelf al genoteerd dat andere tabellen RLS gebruiken, maar dit niet
toegepast. Onderstaande, gecorrigeerde versie gebruiken:
```sql
create table if not exists today_plan_cache (
  user_id uuid primary key,
  plan_json jsonb not null,
  computed_at timestamptz not null default now()
);

alter table today_plan_cache enable row level security;

create policy "Gebruikers zien alleen hun eigen cache"
  on today_plan_cache for select
  using (auth.uid() = user_id);

create policy "Gebruikers schrijven alleen hun eigen cache"
  on today_plan_cache for insert
  with check (auth.uid() = user_id);

create policy "Gebruikers werken alleen hun eigen cache bij"
  on today_plan_cache for update
  using (auth.uid() = user_id);
```
Breekt niets aan de werkende code — de app gebruikt
`createAdminClient()` (service-role, omzeilt RLS sowieso) om deze
tabel te benaderen. RLS voorkomt alleen dat een gewone anon/
authenticated-sleutel rechtstreeks bij andermans cache zou kunnen.
**Kortlevende (60 sec) cache voor `bepaalTodayPlan()`.** Bevestigd:
`api/coach/route.ts`, `api/action-plan/route.ts` en
`api/smart-actions/route.ts` riepen deze functie tot nu toe alle drie
volledig onafhankelijk aan — bij één Home-bezoek dus tot 3× dezelfde,
zware berekening (CoachPolicy + workout-keten) tegelijk. Directe
aanleiding: "Open trainingsplan" verscheen vaak niet bij Snelle
Acties, ook na v2.4.320's eerdere fix (dubbele `genereerCoachPolicy()`-
aanroep binnen één functie al weggenomen) — de resterende, verspreide
verdubbeling over drie routes bleef.

**Bewust 60 seconden, niet langer:** lang genoeg om de 2-3 near-
gelijktijdige aanroepen binnen één paginabezoek te dedupliceren, kort
genoeg om nooit een verouderde REST/TRAIN/ADJUST-beslissing te tonen —
zou anders precies het soort veroudering riskeren dat de hele
CoachDecision-architectuur van vandaag (Regel 0c/0d) wil voorkomen.
Overwogen en bewust afgewezen: een langer-levende cache (te veel
risico) en simpelweg de Smart Actions-tijdslimiet verruimen (lost de
onderliggende verspilling niet op, maakt niets sneller).

**Implementatie:** `today-engine.ts`'s oorspronkelijke
`bepaalTodayPlan()`-logica hernoemd naar een interne
`bepaalTodayPlanOngecached()` — **volledig ongewijzigd**, puur
hernoemd. De geëxporteerde `bepaalTodayPlan()` is nu een dunne
wrapper: cache lezen → bij een hit (< 60 sec oud) direct teruggeven →
bij een miss vers berekenen + cache bijwerken. Bij elke storing (lezen
of schrijven): stille terugval op vers berekenen, nooit de gebruiker
blokkeren door een cache-probleem.

**Bijwerking-kanttekening:** de rolling-horizon-verlenging (Laag 2 in
de ongecachete functie) gebeurt bij een cache-hit niet opnieuw —
onschadelijk, een achtergrond-onderhoudstaak die bij de eerstvolgende
oncachete aanroep gewoon weer meeloopt.

## 🧭 CHECKPOINT — Recovery Intelligence Layer (Fase 0 afgerond, 16 augustus 2026)

**Status: alleen onderzoek + architectuurbesluit. Geen code gewijzigd.
Volgende sessie: begin direct bij Fase 1 (zie onderaan).**

### Herkomst
Uitgebreid masterplan van de gebruiker (overleg met GPT, meerdere
revisies) om CoachOS uit te breiden met een **Recovery Intelligence
Layer** — een langetermijn-leerlaag die energie, belastbaarheid,
belasting, herstel en vertraagde respons over tijd leert kennen per
persoon. Persoonlijke aanleiding van de gebruiker: eigen ervaring met
langdurige energieproblemen/Long COVID — het doel is mensen concreet
uit energie-crises helpen, niet alleen een technische uitbreiding.

### Architectuurbesluit — vastgelegd, harde regel
```
COACH               = beslist
RECOVERY SPECIALIST = kent herstel + PEM/pacing-kennis (permanente
                       expertise, geen los aan/uit-modus)
RECOVERY INTELLIGENCE = onthoudt + leert + herkent patronen
                        (NIEUWE, aparte laag — geen ombouw van
                        bestaande componenten)
TRAINER AI          = voert uit
BIBLIOTHEEK         = bepaalt wat bestaat
DATA                = bewijst wat er werkelijk gebeurde
```
**Belangrijkste ontdekking van Fase 0:** niets bestaands hoeft kapot
gemaakt te worden. Recovery Intelligence wordt een nieuwe laag
bovenop bestaande componenten, geen verbouwing ervan.

**Medische veiligheidsgrens, ongewijzigd te behouden:** geen diagnose,
geen medische behandeling, geen genezing-claims. PEM/50%-regel/
hartslag-pacing zijn **kennisdomein-input voor de Recovery
Specialist**, geen universeel af te dwingen algoritmes — verschilt
sterk per persoon, moet via het Individual Recovery Model leren wat
bij déze gebruiker past, niet hardcoded.

### Fase 0 — audit, volledig afgerond

| Component | Wat het doet | Status |
|---|---|---|
| `recovery-engine.ts` | Deterministische Recovery Score (0-100), incl. Garmin Training Readiness als input | ✅ Werkt, blijft ongewijzigd bestaan |
| `coach_memory` + `api/memory/route.ts` | AI detecteert max. 4 patronen uit de laatste 30 dagen, **overschrijft bestaande patronen volledig** bij elke run (delete + insert, geen cumulatieve historie) | ✅ Werkt (na historische fix v2.4.15 — was structureel kapot door een cookie-auth-bug bij server-naar-server-aanroepen, `.catch(() => {})` verborg dit stil) |
| `coach_recommendations` | Eén rij per gebruiker/dag/type — dagadvies + redenering + energieniveau + herstelstatus | ✅ Werkt |
| `coach_calls` + `coach_call_items` | Subjectieve respons per sessie: **rating, mood, notes** — waardevolle ruwe data, maar hoofdroute bevraagt slechts de laatste 3 dagen | ✅ Data bestaat, **lange geschiedenis wordt nergens geaggregeerd** |
| `training_results` | Voltooide trainingen: rating, werkelijke duur, notities | ✅ Werkt |
| `exercise_records` | Persoonlijke records per oefening | ✅ Werkt |
| `ai_conversations` | Ruwe chatgeschiedenis | ✅ Bestaat, ongebruikt voor patroonherkenning |
| `injuries`, `user_goals`, `life_events` | Uitgebreid vandaag al gebruikt voor CoachDecision | ✅ Werkt |
| "Readiness" | Geen apart bestand — Garmin-eigen metric, gaat als input de bestaande Recovery Score in | ✅ Geen dubbele logica |
| CoachDecision (REST/TRAIN/ADJUST) | Vandaag gebouwd, live | ✅ Blijft de beslisser — Intelligence Layer levert straks extra context, vervangt 'm niet |

**Bevestigde gaten (geen aannames):**
1. Geen cumulatieve geschiedenis — `coach_memory` overschrijft zichzelf
2. Geen vertraagde-respons-tracking (24u/48u/72u) — ruwe ingrediënten bestaan (`coach_call_items.rating/mood`, `training_results.rating`), worden nooit over tijd gekoppeld
3. Geen persoonlijke baselines — alles tegen vaste, voor-iedereen-gelijke drempels
4. Geen Energy vs. Capacity-onderscheid — één Recovery Score, geen apart model
5. Geen patroon-/hypothese-engine
6. Geen PEM/Boom-Bust-herkenning (logisch gevolg van punt 2)

**Wat NIET aangepast mag worden:** `recovery-engine.ts` zelf, `coach_memory` (blijft voor wat het al goed doet), de CoachDecision-keten, Bibliotheek-/Trainer-regels.

### Status — 16 augustus 2026: alle ontwerpfasen afgerond, migratie uitvoeringsklaar

**Twaalf fasen doorlopen, elk met gebruiker + GPT-overleg en Claude
als eindverantwoordelijke bouwer:**

| Fase | Status |
|---|---|
| 0 — Audit (bestaande componenten) | ✅ |
| 1 — Data Inventory | ✅ |
| 1A — Data Linkage & Historical Depth Verification | ✅ |
| 2 — Architecture Proposal (V1/V2-scheiding) | ✅ |
| 3 — Datamodel (eerste ontwerp) | ✅ |
| 4 — Datamodel-review + Safety-review | ✅ |
| 5 — Coach-integratie-ontwerp | ✅ |
| 6 — Evidence & Pattern Algorithm Specification | ✅ |
| 7 — Implementatieplan | ✅ |
| 7.1 — Technische afsluiting (3 openstaande gaten gedicht) | ✅ |
| 8 — Migratie-specificatie | ✅ |
| 8.1 — Migration Hardening (security_invoker, junction-tabel, SD-veld, config-versiëring) | ✅ |
| 8.2 — SQL Hardening (atomaire config-overgang, RLS-gat gedicht, uniek-index) | ✅ |
| **Database-migratie uitgevoerd + geverifieerd** | ✅ (20 augustus 2026) |
| **Fase 10 — Code: pattern-detection + Coach-integratie** | ✅ (20 augustus 2026) |

**De elf harde grenzen, definitief vastgelegd:**
1. Geen diagnose, ooit
2. Geen patroon op basis van één gebeurtenis — minimaal 3 vergelijkbare, weinig-confounded instanties
3. Vergelijkbaarheid is deterministische code, nooit een AI-oordeel
4. Geen `AdaptationSignal` — architectonisch onmogelijk gemaakt, niet alleen een vlag
5. Geen wijziging aan `today-engine.ts`, `adjuster-core.ts`, `coach-policy.ts` of `pasWorkoutAan()`
6. V1 is uitsluitend informatieve Coach-context
7. Coach ziet alleen voldoende onderbouwde, recent-bevestigde patronen
8. Alle RI-data herleidbaar naar bestaande brondata (geen dubbele waarheid)
9. Configuraties/algoritmeversies zijn reproduceerbaar (versioned, nooit stilzwijgend overschreven)
10. `enabled=false` (kill switch): functioneel alsof RI niet bestaat
11. Historische data eerst geanalyseerd + handmatig gevalideerd vóór Coach-integratie ooit geactiveerd wordt

**Volgende stap, expliciet afgebakend:** uitsluitend de database-migratie
(Fase 8.1+8.2, zie `docs/recovery-intelligence-migration.sql` in deze
levering) — **geen** `pattern-detection.ts`, **geen**
Coach-routewijzigingen, **geen** historische backfill. Die volgen pas
na een apart akkoord, ná controle van dit schema (Fase 9 — nog niet
gestart).

**Datamodel, samengevat:** 8 tabellen (`ri_algorithm_config_versions`,
`ri_analysis_runs`, `ri_calendar_day_response`, `ri_response_links`,
`ri_patterns`, `ri_pattern_evidence`, `ri_hypotheses`, `ri_baselines`,
`ri_interventions` — negen, exclusief telling hierboven) + 2 views
(`ri_load_proxy_view`, `ri_response_observations_view`), alle met RLS,
beide views met `security_invoker=true`.

## v2.4.326 — FIX: Garmin-screenshot-import kwam altijd op uploaddag
**Herbouwd na een gewiste werksessie — zelfde fix als eerder al
ontworpen, nu opnieuw correct tegen de actuele codebase toegepast.**

Screenshot-import (Garmin Vision) gebruikte altijd de uploaddag voor
het `date`-veld, ongeacht wanneer de training echt plaatsvond. Anders
dan TCX (waar de datum gegarandeerd in het bestand zelf staat) leest
de AI-prompt hier specifiek het "Statistieken"-tabblad van Garmin
Connect — dat scherm toont geen datum. AI-extractie zou hier dus
onbetrouwbaar zijn; een handmatig datumveld is eerlijker.

**Fix:**
- `garmin-activity-vision/route.ts` — nieuw, optioneel
  `activity_date`-veld bij bevestiging, gevalideerd (`YYYY-MM-DD`),
  terugval op "vandaag" indien niet meegegeven
- Coach Call blijft bewust op "vandaag" — consistent met TCX: de
  training krijgt de echte datum, het coach-gesprek erover gebeurt op
  het moment dat de Coach het ontdekt
- `garmin-activity-import/page.tsx` — nieuwe datumkeuze in de
  screenshot-preview, standaard vandaag, aanpasbaar

## v2.4.328 — Recovery Intelligence: Fase 10, code geïmplementeerd
**Het patroondetectie-script, de analyse-orchestratie, en de Coach-
integratie zijn nu gebouwd — bovenop de al bestaande, geverifieerde
database (Fase 0-9). `enabled: false` staat nog steeds aan in
`ri_algorithm_config_versions` — deze code draait dus, maar levert
nog niets op totdat die vlag bewust wordt omgezet.**

### Zes nieuwe bestanden, twee gewijzigd

**Nieuw, `src/lib/recovery-intelligence/`:**
- `types.ts` — gedeelde types, exact matchend met het DB-schema
- `config.ts` — leest de actieve, versioned configuratie
- `baseline.ts` — baseline-berekening per metric, respecteert de
  unieke-actieve-baseline-constraint (sluit oude baseline netjes af
  vóór een nieuwe wordt aangemaakt)
- `pattern-detection.ts` — het kernalgoritme. **Volledig
  deterministisch** (Fase 6, punt 7) — vergelijkbaarheid tussen
  belastingsgebeurtenissen wordt bepaald via load-magnitude-band +
  confounder-profiel (actieve blessure, hoge life-event-belasting),
  nooit via een AI-oordeel. Load Proxy-dedup volgt exact de Fase
  7.1-regel (`source != 'trainer_ai'`)
- `context-formatter.ts` — de ENIGE plek waar RI-data de Coach-prompt
  bereikt. Puur tekstopbouw, geen classificatie. Toont alleen patronen
  met confidence_tier `patroon`/`sterk_patroon`, niet ouder dan 6
  maanden onbevestigd (Fase 7.1: "geen recente bevestiging", niet
  "ongeldig")

**Nieuw, route:** `api/recovery-intelligence/analyze/route.ts` —
lazy, rate-limited (24u) background analysis, volledige audit trail
via `ri_analysis_runs`. Checkt de `enabled`-vlag als allereerste stap.

**Gewijzigd, elk met twee toevoegingen (trigger + contextblok):**
- `api/coach/route.ts` — fire-and-forget-aanroep naar de analyse-route
  (zelfde patroon als de al-bestaande `/api/memory`-aanroep), plus het
  contextblok in de finale prompt-opbouw
- `api/action-plan/route.ts` — zelfde twee toevoegingen

### Harde grens, technisch herbevestigd tijdens de bouw
Geen enkele wijziging aan `today-engine.ts`, `adjuster-core.ts`,
`coach-policy.ts`, of iets dat met `AdaptationSignal`/`pasWorkoutAan()`
te maken heeft. Het contextblok gaat uitsluitend de AI-promptopbouw
in — precies het ontwerp uit Fase 5, nu daadwerkelijk gebouwd.

### Nog niet gedaan
- **`enabled` staat nog op `false`** — bewust, wacht op een apart
  akkoord om aan te zetten
- Historische backfill is nog niet apart getriggerd — de eerste
  analyse zal vanzelf lopen zodra `enabled: true` staat én de Coach
  voor het eerst wordt aangeroepen (via de rate-limited trigger)
- Geen enkele test uitgevoerd tegen echte data — vergt eerst
  `enabled: true` + een Coach-aanroep + handmatige controle van wat
  er in `ri_patterns`/`ri_hypotheses` terechtkomt

## v2.4.329 — Recovery Intelligence zichtbaar in het Debug Panel
**Gemeld: "kunnen we dat zien in de app" — antwoord was nee, alleen via
directe database-query's. Toegevoegd, hergebruikt de bestaande
`/debug`-infrastructuur in plaats van een nieuwe pagina te bouwen.**

### Wijzigingen
- **`ALLE_TABELLEN`** in `debug/page.tsx` uitgebreid met de negen
  Recovery Intelligence-tabellen — meeliften op de bestaande
  gezondheidscheck (bestaat-de-tabel/is-die-leesbaar)
- **Nieuwe route, `api/recovery-intelligence/status/route.ts`** — puur
  lezend, toont enabled-status, laatste analyse-run, huidige
  baselines, voortgang richting de load-baseline-drempel (bijv.
  "9/10 dagen"), en eventueel gevonden patronen
- **Nieuwe sectie in `debug/page.tsx`** — knop + resultaatweergave,
  exact hetzelfde patroon als de bestaande Decision Engine-sectie

### Waarom dit waardevol bleek tijdens het eerste, echte testen
Bij de allereerste analyse-run (20 augustus 2026) waren de
respons-baselines (energie/HRV/etc.) succesvol berekend, maar de
load-baseline nog niet — 9 van de 10 vereiste dagen. Zonder deze
statusweergave was dat alleen met handmatige SQL-query's te
achterhalen. Nu in één oogopslag zichtbaar.

## v2.4.330 — /debug-pagina geordend
**Gemeld: "kun je deze pagina een beetje ordenen" — de zeven losse
links naar andere debug-pagina's en de vijf subtools in
"Specialistlaag" stonden allemaal permanent uitgeklapt, waardoor de
pagina lang en onoverzichtelijk werd.**

### Wijzigingen, puur visueel — geen enkele functie gewijzigd
- Zeven externe debug-links samengevoegd onder één inklapbare
  sectie ("Andere debug-pagina's (7)"), standaard dicht
- Vijf subtools (Memory Engine, Decision Engine, Recovery
  Intelligence, Adaptive Training Plan Engine, Coach-uitleglaag) elk
  in een eigen `<details>`-element — Recovery Intelligence staat
  standaard open (meest recent/relevant), de andere vier dicht
- Native HTML `<details>`/`<summary>` gebruikt — geen nieuwe state,
  geen extra JavaScript, geen risico op het breken van bestaande
  knoppen/fetches

### Eén bestand
`debug/page.tsx`.

## v2.4.331 — FIX: gezondheidscheck brak op ri_algorithm_config_versions
**Gemeld via de eigen diagnostiek: "column
ri_algorithm_config_versions.id does not exist".**

### Root cause, bevestigd
De generieke tabel-check in `debug/page.tsx` deed altijd
`select('id')` voor elke tabel in `ALLE_TABELLEN`.
`ri_algorithm_config_versions` heeft echter bewust `version` (tekst)
als primary key i.p.v. `id` (Fase 8.1 — een configuratietabel, geen
per-gebruiker-entiteit) — de enige tabel in de hele app met die
afwijking.

### Fix
`select('id')` → `select('*')` in de generieke loop — werkt voor
elke tabel, ongeacht welke kolom de primary key is. Robuuster dan een
losse uitzondering voor deze ene tabel.

### Kanttekening, transparant
`ri_algorithm_config_versions` heeft bewust geen RLS-policies
(server-only). Verwachting: RLS-zonder-policies filtert stilzwijgend
alle rijen weg voor een gewone gebruiker (leeg resultaat, geen fout)
— nog te bevestigen door de diagnostiek opnieuw te draaien na deze fix.

### Eén bestand
`debug/page.tsx`.

## Core Architectuurregels

0. **Consolidatie vóór nieuwbouw** (vastgelegd 5 augustus 2026, na
   herhaalde bevestiging: Recovery Engine/HRV/blessuremodule/Context
   Resolver/ACWR/Today Engine/CoachPolicy/Workout Matching/
   Specialisten — stuk voor stuk bleek al te bestaan toen er
   "nieuwe" functionaliteit gevraagd werd). **Nieuwe functionaliteit
   mag pas gebouwd worden nadat expliciet is vastgesteld dat de
   benodigde logica niet al elders in CoachOS bestaat. De
   standaardaanname is consolidatie en hergebruik, niet nieuwbouw.**
   Componenten die andere subsystemen samenbrengen (zoals de Coach
   Decision Engine) mogen uitsluitend bestaande subsystemen raadplegen
   — geen parallelle berekeningen introduceren.
0b. **AI Output Integrity Rule** (vastgelegd 11 augustus 2026, na de
   "35 vs. 50 minuten"-bevinding — gebruiker + GPT-overleg, Claude
   eindverantwoordelijk). **De AI mag geen concrete
   trainingsparameter presenteren (duur, intensiteit, afstand, sets,
   gewicht, tempo, en vergelijkbare uitvoeringsparameters) die niet
   afkomstig is uit een bestaande, gestructureerde Coach-/Adjustment-
   beslissing. De AI mag een beslissing uitleggen, maar nooit zelf
   een trainingsparameter creëren.** Concreet gevonden gat: Today
   Engine gaf de AI `todayPlan.duration` (ongewijzigd, 50 min) mee als
   "autoritatieve bron", maar niets weerhield de AI ervan om in de
   vrije advies-tekst een ander getal (35 min) te noemen zonder dat
   dit ergens in de data was vastgelegd — een kaart/tekst-mismatch die
   de gebruiker kon zien.

   **Onderzoeksvraag beantwoord, 11 augustus 2026 (bewijs, geen
   aanname):** lopen Cycling/Running/Rowing-specialistsessies door de
   bestaande Adaptation Engine? **Gedeeltelijk ja, maar niet op de
   plek waar het probleem zit.** `api/specialists/{sport}/training-
   plan/workout` (de gedetailleerde workout-weergave) roept al
   `bouwWorkout()` + `pasWorkoutAan()` aan — loopt dus al door de
   Adaptation Engine. Today Engine's `proposalNaarTodayPlan()` (de
   Home-kaart, waar de AI-tekst over praat) leest dezelfde
   `training_plan_sessions.duration`-kolom rechtstreeks, zonder ooit
   de Adaptation Engine te raadplegen. **Consequentie voor het
   toekomstige ontwerp:** geen nieuw/parallel aanpassingssysteem —
   Today Engine's kaart-logica moet aansluiten op hetzelfde,
   al-bestaande `pasWorkoutAan()`-mechanisme dat de detailpagina al
   gebruikt. Nog niet gebouwd — wacht op een apart akkoord (stap D,
   overleg 11 augustus 2026).

0c. **Coach Decision Integrity** (vastgelegd 11 augustus 2026, na
   Ontwerp-stap D — gebruiker + GPT-overleg, Claude
   eindverantwoordelijk). **Elke concrete trainingsparameter die aan
   de gebruiker wordt gepresenteerd, moet afkomstig zijn uit dezelfde
   definitieve, gestructureerde workout-beslissing die daadwerkelijk
   wordt uitgevoerd. De AI mag deze waarden niet berekenen, aanpassen,
   afronden naar eigen inzicht of vervangen door een eigen voorstel.**
   Geldt voor: duur, intensiteit, afstand, sets, herhalingen, gewicht,
   tempo, hartslagzone, rustduur. Bredere, definitieve formulering van
   Regel 0b — dezelfde bug-klasse kan zich anders bij Recovery,
   Training Load of toekomstige specialisten herhalen.

   **Ontwerp voor de implementatie (Stap D, nog NIET gebouwd — vier
   verificaties afgerond, wacht op bouw-akkoord):**
   - **Kern:** `training_plan_sessions.duration` blijft altijd
     onaangetast (de oorspronkelijke planning). Een aanpassing
     (vakantie, vermoeidheid, etc.) is een **runtime-beslissing voor
     vandaag**, nergens persistent opgeslagen — zelfde categorie als
     het al-bestaande `fatigue_detected`-signaal, geen nieuwe
     tabel/kolom nodig
   - **Eén bron voor alles:** Today Engine moet dezelfde keten
     aanroepen die de detailpagina al gebruikt
     (`bouwWorkout()` → signalen verzamelen → `pasWorkoutAan()`), en
     daaruit zelf de aangepaste totaalduur afleiden — geen tweede
     interpretatie van de aanpassing in `today-engine.ts`
   - **Idempotentie door constructie:** omdat de keten altijd start
     bij de pure, onaangetaste `duration`-kolom (nooit bij een eerder
     resultaat), levert een herhaalde aanroep exact dezelfde uitkomst
     zolang de signalen niet veranderen — geen cascade (50→35→24,5)
     mogelijk. Herstel is vanzelf: morgen zonder vakantie-signaal
     → automatisch weer 50, niets terug te schrijven
   - **Meerdere signalen tegelijk:** bevestigd, geen optelling —
     `pasWorkoutAan()` past de downscale-mechaniek precies één keer
     toe, ongeacht het aantal actieve signalen, met een gecombineerde
     redentekst
   - **Belangrijke, extra bevinding tijdens verificatie:** het
     topniveau `UniversalWorkout.duration_sec` wordt door
     `pasWorkoutAan()` nooit herberekend na een aanpassing (alleen
     losse blok-`duration_sec`-waarden veranderen) — een eventuele
     "totaalduur"-aflezing moet dus altijd vers uit de blokken
     gesommeerd worden (incl. `repeat`-vermenigvuldiging), nooit uit
     dit veld
   - **Vier verificaties, alle vier bevestigd vóór dit ontwerp:**
     1. Rowing's `training-plan/workout`-route volgt exact hetzelfde
        signalenpatroon als Running (geverifieerd, geen aanname)
     2. `WorkoutBlock.duration_sec` is de enige betrouwbare bron per
        blok — zie hierboven
     3. Vakantie-detectie kan de bestaande `isEventActiefOpDag()` +
        `life_events`-query (`type: 'vakantie'`) hergebruiken — bestaat
        al letterlijk als patroon in `coach-planning-overzicht.ts`
     4. Signaalcombinatie is bevestigd niet-optellend (zie hierboven)
   - **✅ Geïmplementeerd — v2.4.314** (bouw-akkoord, gebruiker + GPT,
     11 augustus 2026). Acht bestanden, van klein naar groot:
     1. `coach-planning-overzicht.ts` — `LifeEventRij`/
        `isEventActiefOpDag()` geëxporteerd (waren lokaal)
     2. `adaptation.ts` — `'vacation'` toegevoegd aan
        `AdaptationSignal['source']`; nieuwe `totaalDuurVanWorkout()` —
        sommeert blok-duraties (incl. `repeat`), nooit het verouderde
        topniveau `duration_sec`
     3. `adjuster-core.ts` — Trigger 5 (vacation_mode), hergebruikt
        stap 1, geen database-mutatie (zelfde categorie als
        `fatigue_detected`)
     4-6. Cycling/Running/Rowing `training-plan/workout`-routes — elk
        één regel, `vacationSignaal` meegenomen in de signalenlijst
     7. `today-engine.ts` — `proposalNaarTodayPlan()` nu async, bouwt
        dezelfde workout als de detailpagina
        (`bouwWorkout()`→signalen→`pasWorkoutAan()`→
        `totaalDuurVanWorkout()`), met terugval op de originele duur
        bij een fout. `TodayPlan` uitgebreid met `originalDuration`/
        `adjustmentReason`
     8. `api/coach/route.ts` — AI-prompt toont expliciet origineel vs.
        definitief + reden wanneer die verschillen, met een harde
        instructie om nooit een ander getal te noemen
   - **Getest tijdens implementatie:** balans-check op alle acht
     bestanden, elke import expliciet tegen de bijbehorende export
     gelegd (na de eerdere v2.4.305/306-importfout, extra zorgvuldig).
     **Nog niet getest:** een echt vakantie-scenario in de draaiende
     app (vergt een actieve vakantie-`life_event` + een geplande
     specialist-sessie dezelfde dag)

   - **v2.4.317 — Vervolgbevinding: "84 / 75 / 76 minuten" tegelijk.**
     Gemeld met screenshot: kaart toonde 84 min (correct — geen
     signaal vuurde), maar het hoofdadvies noemde "75 minuten" en het
     Dagplan "76 minuten (-10%, HRV ongebalanceerd)" — de AI had dit
     **zelf berekend** uit rauwe Garmin/HRV-data die los in haar
     prompt-context beschikbaar was, volledig langs het gestructureerde
     signalensysteem heen. Dit was geen herhaling van de v2.4.314-bug
     (kaart/tekst-dezelfde-bron), maar een dieper gat: Regel 0c was tot
     dan toe alleen een prompt-*instructie*, geen technische garantie.

     **Root cause van waarom er structureel geen signaal vuurde:**
     `adjuster-core.ts`'s `fatigueSignaal` was beperkt tot
     `vandaagSessie.type === adapter.hoogIntensiteitsType` (alleen
     intervallen) — nooit toegepast op duurtrainingen. Onderzocht vóór
     wijzigen (overleg gebruiker + GPT): het oorspronkelijke contract
     (`docs/adaptive-training-plan-decision-contract-v1.md`) omschrijft
     `fatigue_detected` juist breder ("microcyclus verzwakt"), en er is
     geen enkele ADR/changelog-regel gevonden die de intervallen-only-
     beperking als bewuste, fysiologisch onderbouwde keuze vastlegt —
     behandeld als onvolledige scope, niet als bewijs-gedekte grens.

     **Twee samenhangende fixes, beide geïmplementeerd (niet los van
     elkaar, zoals GPT terecht aangaf):**
     1. **`adjuster-core.ts`:** de sessietype-restrictie verwijderd —
        `fatigueSignaal` geldt nu voor élke geplande sessie van
        vandaag bij laag herstel, niet alleen intervallen.
        **Drempelwaarde ongewijzigd** (`policy.recoveryState ===
        'low'`, confidence 65) — alleen de type-check is weg
     2. **`api/coach/route.ts` + `api/action-plan/route.ts`:** Regel
        0c technisch verstevigd, niet alleen als instructie. Nieuwe,
        expliciete "GEEN AANPASSING"-tak in de Today Engine-context:
        als er geen signaal vuurde, wordt de AI letterlijk verboden om
        zelf een kortere duur voor te stellen — mag het wél *benoemen*
        in de uitleg, nooit de sessie zelf wijzigen. De
        Garmin/HRV-rauwe-databron kreeg een expliciete kopregel:
        "ALLEEN voor context/uitleg... NOOIT gebruiken om zelf een
        trainingsduur te berekenen." `api/action-plan/route.ts` had de
        aanpassings-/geen-aanpassings-tekst nog helemaal niet (alleen
        `api/coach/route.ts` had 'm sinds v2.4.314) — nu in beide
        identiek

     **Bewust niet gedaan:** geen database-migratie, geen tweede
     Adjustment Engine, geen nieuwe drempelwaarden. Cycling's route
     bleek een dunne wrapper (`training-plan-adjuster.ts` →
     `voerDailyAdjustmentUitCore()`) — profiteert automatisch mee,
     geen aparte wijziging nodig.

     **Getest in productie, 11 augustus 2026 — bevestigd, twee vervolg-
     bevindingen gevonden en gefixt in v2.4.318:**

     1. **Getallen kloppen nu** (84 overal — kaart, Dagplan, hoofdadvies
        — geen 75/76-mix meer). Regel 0c's numerieke garantie werkt.
     2. **Maar de AI verzon een vals verhaal:** *"De -10% aanpassing is
        al meegenomen in de sessie, dus de 84 minuten is al het
        gecorrigeerde advies"* — feitelijk onjuist, er was geen enkele
        aanpassing toegepast (`fatigueSignaal` vuurde niet,
        `recoveryState` was kennelijk niet `'low'`). De instructie liet
        te veel ruimte om zo'n verzonnen verklaring op te hangen. Fix:
        `geenAanpassingContext` expliciet uitgebreid — verbiedt nu ook
        letterlijk de claim "al gecorrigeerd"/"al meegenomen", niet
        alleen een nieuw getal.
     3. **Los daarvan gemeld:** Dagplan plande "ga op tijd slapen" om
        23:30, terwijl de avonddienst pas om 00:45 eindigt — 75 minuten
        te vroeg. Root cause: de bestaande "plan niets tijdens
        werktijd"-instructie gebruikte een voorbeeld met een normale
        dagdienst (06:00-15:00); bij een dienst die na middernacht
        eindigt viel de AI kennelijk terug op generiek bedtijd-advies
        (~23:00) i.p.v. de echte eindtijd. Fix: expliciete instructie
        toegevoegd dat ook avond/slaap-gerelateerde acties na de
        daadwerkelijke, exacte eindtijd moeten vallen, met het
        00:45-scenario als concreet voorbeeld.

     **Nog te testen:** een scenario waarbij `fatigueSignaal` wél
     vuurt (écht laag herstel + duurtraining) — nog niet organisch
     gezien, alleen het "geen aanpassing"-pad is nu bevestigd getest.

0d. **CoachDecision-contract** (vastgelegd + geïmplementeerd 11
   augustus 2026, v2.4.319 — gebruiker + GPT-overleg, na de "rustdag
   geadviseerd, training toch aangemaakt"-feedback die de gebruiker
   zelf van de in-app Coach kreeg). **De belangrijkste architectuur-
   uitbreiding van vandaag:** een nieuwe, hogere-orde beslissing die
   vóór elke workout-opbouw wordt genomen — geen prompt-instructie,
   technisch afgedwongen.

   **Aanleiding, kort:** Regel 0c (Coach Decision Integrity) loste op
   dat verschillende schermen niet meer een ander GETAL konden tonen
   voor dezelfde sessie. Maar er bleef een groter gat: niets voorkwam
   dat de AI zelfstandig **"vandaag geen training"** kon adviseren
   terwijl het systeem daarnaast gewoon een training aanmaakte — geen
   getalverschil, maar een tegenstrijdige **beslissing**. Guardian-
   onderzoek bevestigde: nergens in CoachOS bestond een structurele
   REST-uitkomst — `genereerCoachPolicy()` kende alleen gradaties van
   "wel trainen" (`allowedTrainingTypes` bleef zelfs bij `recoveryState:
   'low'` gevuld).

   **Semantiek, letterlijk uit het contract:**
   | Decision | Betekenis | Workout |
   |---|---|---|
   | **REST** | Actieve blessure OF ziekte — bestaande `-100%`-blokkade in `context-resolver.ts`'s `MODIFIERS`, geen nieuwe regel | Geen workout |
   | **TRAIN** | Geen REST, geen bestaande aanpassing nodig | Originele workout |
   | **ADJUST** | Geen REST, bestaande context (herstel/vakantie/cross-sport/belasting) vereist aanpassing | Originele workout → `pasWorkoutAan()` → aangepaste workout |

   **Expliciet NIET gedaan:** ACWR > 1,7 wordt **geen** REST — geen
   bestaand contract voor volledige blokkade op basis van ACWR alleen
   gevonden, blijft binnen ADJUST. **Geen `confidence`-veld** —
   consistent met het eerdere besluit dat een technische
   onzekerheidsscore geen rol speelt in een gebruikersgerichte
   beslissing.

   **Prioriteit — ongewijzigd hergebruikt** uit `context-resolver.ts`'s
   `CONTEXT_PRIORITY`: blessure > ziekte > vakantie > herstel >
   wedstrijd > werk > training > vrije_tijd. Een wedstrijd morgen
   overrulet dus geen actieve blessure.

   **Producent, bevestigd vóór bouwen (niet aangenomen):**
   `genereerCoachPolicy()` haalde tot dan toe géén `life_events` op —
   kon dus geen ziekte/vakantie/wedstrijd/werk zien, alleen blessures.
   Uitgebreid met `fetchTodaysLifeEvents()` + `bepaalDagContext()` —
   **beide al bestaande, ongewijzigde functies, geen duplicatie, geen
   tweede engine.**

   **Zeven gewijzigde bestanden:**
   1. **`coach-policy.ts`** — kern. Nieuw `decision`-veld,
      `CoachDecision`-type, haalt nu ook `life_events` op en roept
      `bepaalDagContext()` aan. De bestaande, mildere blessure-
      intensiteitsverlaging (`verlaagIntensiteit()`) blijft ongewijzigd
      voor `maxIntensity` — mag de nieuwe REST-blokkade niet
      "verzachten" (expliciet zo besloten in het contract-overleg)
   2. **`today-engine.ts`** — `TodayPlan` krijgt `trainingDecision`.
      `proposalNaarTodayPlan()` roept `genereerCoachPolicy()` nu als
      ALLEREERSTE stap aan — bij REST: direct terug, `bouwWorkout()`/
      `pasWorkoutAan()` worden **nooit** aangeroepen. Bij een fout in
      de policy-check: terugval op gewoon doorgaan (nooit blokkeren
      door een eigen bug)
   3-5. **Cycling/Running/Rowing `training-plan/workout`-routes** —
      dezelfde REST-check vóór `bouwWorkout()`, zodat ook de
      detailpagina (niet alleen Today Engine) een workout weigert te
      bouwen bij REST — integratietest-eis, zie hieronder
   6-7. **`api/coach/route.ts` + `api/action-plan/route.ts`** —
      nieuwe, harde REST-instructie: bij REST mag de AI geen enkele
      training voorstellen, ook geen "lichte duurtraining" of "wandeling
      als training". **Bug gevonden en gefixt tijdens eindcontrole:**
      de bestaande `geenAanpassingContext` (v2.4.318) zou bij REST ook
      afvuren met `todayPlan.duration = null`, wat onzin-tekst zou
      opleveren ("null min is de originele duur") — nu expliciet
      uitgesloten bij `trainingDecision === 'REST'`

   **Integratietest-eis, letterlijk uit het overleg — de belangrijkste
   regressietest van deze wijziging:** als CoachDecision = REST, mag
   **geen enkele** downstream-route alsnog TRAIN/ADJUST produceren.
   Niet alleen `CoachPolicy geeft REST` en `TodayPlan toont REST`
   los testen, maar de **volledige keten**: REST → TodayPlan → Home →
   Dagplan → Coach → Workout-endpoint — nergens mag een workout
   ontstaan. **Nog niet end-to-end getest in de draaiende app** — vergt
   een scenario met een actieve blessure of ziekte-levensgebeurtenis.

   **v2.4.320 — Gemelde performance-regressie, direct veroorzaakt door
   v2.4.319, gevonden en gefixt.** "Open trainingsplan" verscheen vaak
   niet meer bij Snelle Acties. Root cause: `api/smart-actions/route.ts`
   heeft al sinds v2.4.207 een harde 2,5-seconden-tijdslimiet op Today
   Engine (bij overschrijding: trainingsvoorstel stil overgeslagen,
   bewuste, eerder al goedgekeurde keuze). v2.4.319's nieuwe REST-check
   riep `genereerCoachPolicy()` aan vóór de bestaande, interne aanroep
   binnen `voerDailyAdjustmentUitCore()` — **twee keer dezelfde,
   meerdere-queries-kostende berekening binnen één Today Engine-
   aanroep**, genoeg extra latency om de bestaande tijdslimiet te
   overschrijden.

   **Fix, geen tijdslimiet-verhoging (geen bewijs dat dat de juiste
   correctie zou zijn) — de daadwerkelijke dubbele berekening
   weggenomen:** `voerDailyAdjustmentUitCore()` accepteert nu een
   optioneel, vierde parameter (`vooraf_berekend_recoveryState`) —
   backward-compatible, de drie workout-detailroutes (die dit dubbel-
   probleem nooit hadden) blijven ongewijzigd. `today-engine.ts` geeft
   zijn al-berekende `policy.recoveryState` nu door, dus binnen één
   Today Engine-aanroep wordt `genereerCoachPolicy()` weer maar één
   keer aangeroepen — precies zoals vóór v2.4.319.
1. **Libraries are the source of truth** — oefeningen komen altijd uit de bibliotheek
2. **AI never creates exercises** — AI verzint geen oefeningen buiten de gefilterde lijst
3. **Filter first, assemble second** — route filtert → AI assembleert
4. **Equipment is a hard constraint** — geen dumbbell in profiel = geen dumbbell oefeningen
5. **Progression is data-driven** — niveau en volume zijn data, geen AI-inschatting
6. **Explanations come from libraries** — uitlegpagina = bibliotheek, AI is fallback
7. **AI provides coaching cues only** — AI geeft één tip per oefening
8. **Trainer Rule** — AI mag UITSLUITEND kiezen uit oefeningen die in een CoachOS-bibliotheek bestaan

📖 Volledige architectuurspec: [docs/architecture.md](docs/architecture.md)
📐 **ADR-007 (v2.4.265): Single Workout Mutation Principle** —
[docs/adr/ADR-007-single-workout-mutation-principle.md](docs/adr/ADR-007-single-workout-mutation-principle.md).
Slechts één component mag een workout daadwerkelijk wijzigen (de
Adaptation Engine) — alle andere componenten leveren uitsluitend
signalen (`AdaptationSignal`). Voorkomt cumulatieve, niet-uitlegbare
dubbele aanpassingen.
🗺️ Roadmap: [docs/roadmap.md](docs/roadmap.md)
📋 Changelog & beslissingen: [docs/changelog.md](docs/changelog.md)

## Huidige Status — Bibliotheken

| Module | Status | Oefeningen/Modules |
|--------|--------|--------------------|
| Bodyweight | ✅ Volledig | 120 |
| Strength | ✅ Volledig | 100 |
| Kettlebell | ✅ Volledig | 102 |
| Mobility | ✅ Volledig | 20 |
| Recovery | ✅ Volledig | 12 |
| Running drills | ✅ Volledig | 13 |
| Cycling drills | ✅ Volledig | 11 |
| Rowing drills | ✅ Volledig | 12 |
| **Totaal** | | **390** |

## Context Intelligence Architecture (vastgelegd juli 2026)

**Vast principe: documentatie beschrijft wat de software nú doet, niet
wat zij ooit zou kunnen doen.** Dat voorkomt dat het README ongemerkt
een roadmap wordt. Daarom hieronder twee strikt gescheiden blokken:
huidige architectuur, en toekomstige uitbreidingen.

De Coach Agenda is geen vervanger van Apple/Google Calendar — het is
het (nu deels, straks volledig) centrale systeem waarin alle planbare
gebeurtenissen samenkomen die invloed kunnen hebben op de Coach. Drie
lagen, elk met precies één verantwoordelijkheid:

```
Coach Agenda            "Welke gebeurtenissen bestaan er?"
      │
      ▼
Context Resolver        "Welke context is vandaag relevant?"
      │
      ▼
Today Engine             "Wat betekent dat concreet voor vandaag?"
      │
      ▼
   TodayPlan
      │
      ▼
Master Coach / Trainer AI / Specialisten
```

Geen enkele laag neemt de verantwoordelijkheid van een andere laag
over. De Context Resolver bepaalt geen training — hij beschrijft
uitsluitend de situatie. De Today Engine beslist niet over de
seizoensopbouw — dat blijft bij de Training Plan Engine per specialist.

### Huidige architectuur (v2.4.176+) — wat er daadwerkelijk gebeurt

**Coach Agenda** — bevat op dit moment levensgebeurtenissen (werk/
vakantie/ziekte/etc., via `life_events`) en feestdagen. Nog niet:
trainingssessies/wedstrijden/reizen/medische afspraken als aparte
agenda-items (die bestaan wel als data — training_plan_sessions,
Goal Engine's target_date — maar zijn nog niet samengevoegd tot één
overzicht).

**Context Resolver** (`src/core/utils/context-resolver.ts`) — huidige
databronnen: **Life Events, Blessures, Feestdagen**. Resultaat: één
uniforme `ResolvedContext` (mode/prioriteit/trainingImpact/
suppressedEvents). Niets meer, niets minder dan dat.

**Today Engine** (`src/lib/today-engine.ts`) — huidige databronnen:
**`coach_recommendations.actie_type`** (indirect signaal, al elders
door CoachPolicy/Recovery bepaald), **`training_plan_sessions`**
(specialist-schema), **Trainer AI** (vangnet, alleen als er geen
specialist-plan is). Resultaat: `TodayPlan`. **Niet** (nog):
Performance Platform rechtstreeks, weer rechtstreeks.

**Master Coach** (`api/coach/route.ts`) — leest: TodayPlan, de
Context Resolver-uitkomst, trainingsgeschiedenis, specialist-
samenvattingen, en de overige bestaande contextbronnen (Garmin/
Morning Health/weer/dagboek/blessures/etc., rechtstreeks, niet via de
Context Resolver). Gebruikt dezelfde TodayPlan-waarheid als de
Today-kaart op Home (v2.4.174) — geen tegenstrijdige adviezen meer.

**TodayPlan-principe:** niet elk scherm gebruikt TodayPlan — dat zou
verkeerd zijn. **Onderdelen die de situatie van vandaag tonen**
(Home, Today-kaart, Master Coach, dagplanning, Trainer AI) lezen
TodayPlan. **Specialistische schermen houden bewust hun eigen domein-
API's** (Cycling/Running-trainingsschema, grafieken, analyse, records;
Performance-trends/historie) — TodayPlan vervangt die niet, en zou dat
ook niet moeten.

### Toekomstige uitbreidingen (Roadmap — bewust nog niet gebouwd)

- **Performance Platform + weer rechtstreeks in de Today Engine** —
  nu nog niet gecombineerd, wel al elders bruikbaar (Performance-
  pagina, Coach-prompt los)
- Schoolvakanties, externe agenda-sync (Apple/Google/Outlook) — zie
  Coach Agenda-visie hieronder, Fase D
- Multi-sport Orchestrator (`TodaySchedule`) — pas zinvol met
  meerdere volwassen specialisten

#### Kleine fixes — v2.4.215

**Sport-terminologie-verwarring in coach-berichten.** Gemeld met
screenshot: Trainer AI noemde "je FTP gaat omhoog" bij een
**hardloop**sessie — FTP is een fietsspecifieke term (Functional
Threshold Power), niet toepasbaar op running. Geen hardcoded bug,
de AI verzon dit zelf als generieke motiverende taal, zonder te
beseffen dat het sport-specifiek is.

**Fix, op twee niveaus:**
1. `api/training/today/route.ts` — expliciete regel toegevoegd: geen
   fietstermen (FTP/watt/W-per-kg/cadans) bij running/kettlebell/
   rowing, geen looptermen (pace/tempo-per-km/VO2max) bij cycling
2. **`COACH_CORE_IDENTITY`** (`coach-personality.ts`) — dezelfde regel
   toegevoegd aan de gedeelde kern-identiteit die **9 plekken**
   tegelijk gebruiken, inclusief de Cycling- en Running-specialisten
   zelf. Bij twijfel: generieke, sport-neutrale taal i.p.v. een
   specifieke metric noemen.

`npx next build` — compileert zonder fouten.

**Test-instructie:** vraag een hardloop- of kettlebell-sessie aan —
het coach-bericht zou nu geen fietstermen meer moeten bevatten.

#### Kleine fixes — v2.4.214

**Performance-kaart consistent gemaakt met Week/Dagboek.** Gemeld:
de vier onderste kaarten op Home pasten niet mooi bij elkaar —
Performance had als enige een volledig gekleurde (roze) achtergrond.
Overwogen: alles kleuren vs. alles neutraal. Gekozen voor neutraal —
sluit beter aan bij de rest van Home (Smart Actions, Coach
Vooruitblik, Coach Score gebruiken ook allemaal neutrale kaarten met
gekleurde accenten, nooit een hele kaart in kleur). Performance
gebruikt nu hetzelfde Card-patroon als Week en Dagboek — alleen het
icoontje blijft roze.

**Nav-uitlijning — onderzocht, geen code-fout gevonden.** Gemeld: de
ruimte tussen Home en Trainer lijkt groter dan de rest. Code
gecontroleerd: alle 5 kolommen zijn met `flex-1` wiskundig exact
gelijk breed, elk icoon gecentreerd binnen zijn eigen kolom. Geen
verdere wijziging doorgevoerd — vermoedelijk een visueel effect van
de actieve-staat-styling (dikkere lijnen bij het actieve icoon), geen
structurele fout. Blind verder sleutelen zonder concrete code-oorzaak
zou eerder een nieuwe regressie riskeren dan een echte verbetering
opleveren.

#### Kleine fixes — v2.4.213

**Bel-icoon verwijderd** (Home, rechtsboven) — had geen functie (kale
`<button>` zonder `onClick`), op verzoek weggehaald tot er een echte
notificatiefunctie is, i.p.v. een knop tonen die niets doet.

#### Kleine fixes — v2.4.212

**Nav-uitlijning.** Gemeld met screenshot: "iets uit lijn". Root
cause: v2.4.210's fix introduceerde per ongeluk `items-start` op de
nav-container (was `items-center`). Teruggezet.

**Bel-icoon rechtsboven op Home — bevestigd geen functie.** Gevraagd
of die iets doet: nee, kale `<button>` zonder `onClick`-handler, puur
decoratief. Nog geen actie ondernomen — wacht op keuze (verwijderen,
of alvast een "geen nieuwe meldingen"-staat).

#### Kleine fixes — v2.4.210

**Regressie op v2.4.209's nav-fix.** Gemeld met screenshot: "Voortgang"
viel nog steeds van het scherm af. Root cause: `min-w-[68px]` was
alleen een ondergrens, geen vaste breedte — lange labels
("Specialisten", "Activiteiten") zijn als tekst breder dan 68px, dus
de rij liep alsnog over. **Fix:** elke tab krijgt nu `flex-1` — een
gegarandeerd gelijk deel van de beschikbare breedte, kan per definitie
nooit meer overlopen, ongeacht labellengte (in tegenstelling tot een
losse pixel-berekening die opnieuw fout kon gaan).

**Performance-pagina — coach-tekst wrapte lelijk.** Gemeld met
screenshot: de coach-uitleg ("Gematigd trainen is...") stond naast de
"Belangrijkste factoren"-pillen, werd daardoor in een te smalle kolom
geperst en wrapte over veel regels. **Fix:** coach-tekst en pillen nu
onder elkaar i.p.v. naast elkaar — tekst krijgt de volle breedte.

#### Kleine fixes — v2.4.209

- **"Indoor Fiets" hernoemd naar "Fietsen"** (equipment-instellingen):
  de onderliggende oefeningen (Recovery Ride, Sweet Spot, VO2max-
  intervallen, etc.) zijn op één na allemaal generiek geschreven, niet
  indoor-specifiek — de oude naam suggereerde een onderscheid dat er
  niet is. Bewust hernoemd i.p.v. gesplitst in Indoor/Buiten — dat zou
  een schijn-onderscheid zijn zonder functioneel verschil.
- **Bottom-nav scrollde nog steeds**, ook na v2.4.204's verwijdering
  van de Coach-tab (6→5 tabs). Root cause: `overflow-x-auto` stond nog
  hard aan, oorspronkelijk bedoeld als vangnet voor 6 items — met 5
  tabs (340px minimale breedte) is dat niet meer nodig, past ruim op
  zelfs het smalste huidige iPhone-model (375px). Verwijderd, nav
  gebruikt nu `justify-around` voor een nette, gelijkmatige verdeling.

#### Performance-pagina — visuele herbouw (v2.4.208)

Op verzoek: de weergave (`/performance`) omgezet naar een meer
gedecoreerde stijl — cirkel-gauges (Herstelscore, Consistentie),
voortgangsbalken onder Belastbaarheid-cijfers, "Belangrijkste
factoren" als losse pillen (afgeleid van de bestaande
`recovery.breakdown`-data, top 3 op bijdrage_score), een gemiddelde/
trend-paneel naast de 30-dagen-grafiek, en een "Focus vandaag"-tip
(afgeleid van bestaande readiness/fatigue-labels). **Puur presentatie
— dezelfde onderliggende data/API (`/api/performance-engine`), geen
logica-wijziging.** Gevalideerd: trend-detectie (dalend/stijgend/
stabiel, met randgeval <14 dagen data) en de cirkel-gauge-wiskunde
(omtrek-berekening bij 0%/64%/100%) — beide correct.

#### Coach Planning, Coach Vooruitblik, Smart Actions & Coach Forecast

**Fase A, stap 1 (Regels) afgerond — v2.4.198.** `/life-events` is
verplaatst naar `/coach-planning` (nieuwe module met 3 tabs: Regels/
Planning/Overzicht). De "Regels"-tab bevat exact de bestaande, al-
geteste functionaliteit (categorieën, uitzonderingen, AI-invoer,
week-navigatie) — een verplaatsing + tab-structuur, geen herbouw.
Oude `/life-events`-route blijft werken als redirect, bestaande
links breken niet.

**Fase A, stap 2 (Planning) afgerond — v2.4.199.** Drie weergaven:
maand (grid met kleurpuntjes per categorie, tik op een dag voor
details), week (hergebruikt de bestaande WeekKalender), lijst
(chronologisch). Kleurcodering per categorie, met twee bewuste
uitzonderingen (Vakantie=geel, Evenement/wedstrijd=rood — losstaand
van hun categorie-kleur, expliciet zo genoemd in de visie).

**Fase A, stap 3 (Overzicht) afgerond — v2.4.200. Daarmee is Fase A
volledig compleet.** `api/coach-planning/overzicht/route.ts` —
intelligente samenvatting uit bestaande databronnen (life_events,
training_plan_sessions), geen nieuwe tabel: volgende vakantie,
volgende wedstrijd, huidige trainingsfase, eerstvolgende faseovergang,
werkdiensten komende 14 dagen, trainingen komende week. Deze functie
voedt straks ook de Home "Coach Vooruitblik"-kaart (Fase B) — één
bron, geen dubbele logica. Robuust tegen het bekende v2.4.176-
randgeval (oude trainingsplannen zonder mesocyclus-data — geen crash,
toont dat onderdeel gewoon niet).

**Fase B (Home: Coach Vooruitblik-kaart) afgerond — v2.4.201.**
Hergebruikt exact dezelfde `/api/coach-planning/overzicht`-route als
Fase A stap 3 — één bron, geen dubbele logica. Toont maximaal 3 items
(vakantie/wedstrijd/faseovergang), puur feitelijk, geen voorspelling.
**Bewuste keuze:** als er niets relevants is (nieuwe gebruiker, weinig
ingevuld), blijft de kaart volledig weg — geen lege kaart tonen.
Knop "Open Coach Planning →" onderaan, geen nieuwe navigatie-tab
(zoals eerder vastgelegd).

**Uitbreiding — v2.4.211: werk + medische afspraken toegevoegd.**
Gemeld: het oorspronkelijke voorbeeld voor Coach Vooruitblik (🌙
Nachtdienst, 🏥 Fysio, 🔥 Build Week) bevatte ook werk en medische
afspraken — die ontbraken in de eerste versie (alleen vakantie/
wedstrijd/faseovergang). Nu toegevoegd: eerstvolgende werkdienst en
eerstvolgende medische afspraak, elk dag-voor-dag gezocht binnen 14
dagen met dezelfde `isEventActiefOpDag()` als de bestaande
werkdiensten-telling — geen nieuwe, losse logica. **Alle 5 signalen
worden nu gesorteerd op eerstkomende datum** (niet een vaste
type-volgorde) — zo staat bijv. een fysio-afspraak morgen altijd vóór
een wedstrijd over drie weken, ongeacht welk type het is.

**Fase C (Smart Action Engine) afgerond — v2.4.202.** 100%
deterministisch, **geen AI-call** — zoals niet-onderhandelbaar
vastgelegd. `src/lib/smart-action-engine.ts` (generieke `kiesTop3()`)
+ `api/smart-actions/route.ts` (verzamelt voorstellen uit Injuries,
Today Engine, Coach Planning-overzicht — dezelfde bronnen als Fase A/B,
geen nieuwe databron). Vaste prioriteitstabel: blessure (98) > training
vandaag (95) > wedstrijd binnen 7 dagen (85) > vakantie binnen 3 dagen
(70) > altijd-beschikbaar-fallbacks (30/20). **Bevestigde correctie
uit het ontwerp:** de bestaande Decision Engine (voor trainings-
specialisten) is hier NIET hergebruikt — te smal getypeerd voor
generieke actie-voorstellen; wel dezelfde filosofie (deterministisch),
eigen nieuwe code. Bijvangst: de dataverzameling van Fase A stap 3 is
geëxtraheerd naar `src/lib/coach-planning-overzicht.ts`, nu gedeeld
tussen Overzicht en Smart Actions — geen dubbele logica.

**Fase D (Coach Forecast) blijft visie**, zoals hieronder vastgelegd.

**Kritieke fix — v2.4.203.** Gemeld: kalender toonde events een dag te
laat (maandag → dinsdag), Overzicht toonde altijd 0 werkdiensten.
Root cause 1: `.toISOString().split('T')[0]` op een lokaal
geconstrueerde middernacht-Date springt in Nederland (UTC+2) een dag
terug — elke dag in de maandkalender checkte intern de verkeerde
datum. Root cause 2: de werkdiensten-telling sloot terugkerende events
volledig uit (`!e.recurrence`), terwijl werkroosters vrijwel altijd
terugkerend zijn. Beide gefixt en getest met het exacte gerapporteerde
scenario. **Bredere bevinding, bewust NIET nu meegenomen:** hetzelfde
`.toISOString().split('T')[0]`-patroon komt voor in 20 bestanden
door de codebase — de ernstige variant (fout voor élke dag) zat alleen
in de nu-gefixte bestanden; de overige 18 hebben de mildere variant
(`new Date()`, alleen fout in een venster van enkele uren rond
middernacht lokale tijd) — een reëel, lager-prioriteit vervolgpunt.

**Home-verfijningen — v2.4.204.**
- **Snelheidsfix Smart Actions**: gebruikte `bepaalTodayPlan()` (de
  volledige Today Engine, inclusief de Trainer AI-vangnet-laag), die
  bij "geen actief specialist-plan" een échte Claude-aanroep deed
  (~3 sec vertraging, gemeld). Nu: rechtstreekse databasecheck op een
  geplande specialist-sessie, geen AI-call meer in dit pad.
- **Navigatie**: "Coach"-tab uit de bottom-nav (6→5 tabs, geen
  horizontaal scrollen meer) — zelfde bestemming als Smart Actions'
  "Vraag de Coach" al biedt
- **Home**: het losse "Coach Chat"-kaartje verwijderd (idem, dubbel
  met Smart Actions); Smart Actions verplaatst naar direct onder
  Coach Score; Dagplan start nu standaard ingeklapt

**Regressie-fix — v2.4.205: "Om de week" werkte niet meer.** Root
cause: een inconsistentie tussen twee manieren om een event-begindatum
te lezen. `isHerhalendActiefOpDag`/`isEenmaligActiefVandaag` gebruikten
nog `event.start_time.split('T')[0]` (ruwe string-extractie op de
opgeslagen UTC-tijd) — terwijl v2.4.203's `lokaleDagStr()`-fix daar
NIET was toegepast. Bij een event met een vroege-ochtend-starttijd
(bijv. 01:00 lokaal) gaf de ruwe string-methode een dag te vroeg terug,
wat de even/oneven-weekberekening van "om de week" liet omslaan.
**Fix, consistent in 3 bestanden** (`coach-planning/page.tsx`,
`life-events-context.ts`, `coach-planning-overzicht.ts`): elke
`start_time`-extractie gebruikt nu `lokaleDagStr(new Date(...))`, nooit
meer de ruwe string-split. Alle 9 scenario's (eenmalig + 8
herhalingsopties) opnieuw getest, zoals gevraagd — allemaal correct.

**Regressie-fix — v2.4.206: "Snelle actie naar trainingsplan is
weg".** v2.4.204's snelheidsfix (geen `bepaalTodayPlan()`/Today Engine
meer in Smart Actions, om de ~3-sec AI-vertraging te voorkomen) liet
de Trainer AI-vangnet-laag volledig weg — zonder actief specialist-plan
verscheen er dus geen trainingsvoorstel meer, waar dat eerder via de
volledige Today Engine wél kwam. **Fix:** als er geen specialist-
sessie is, leest Smart Actions nu de **cache** van Trainer AI
(`coach_recommendations.training_instruction`, al bestaand sinds eerder
— gevuld zodra Home's eigen `/api/today`-aanroep al gedraaid heeft) —
snelle databaselezing, geen nieuwe AI-call, dus nog steeds geen
vertraging. 4 scenario's getest (specialist/cache/geen van beide/beide
tegelijk) — allemaal correct, geen dubbele voorstellen.

**Definitieve fix — v2.4.207: v2.4.206's cache-lezing bleek een race
condition te hebben.** Home's eigen `/api/today`-aanroep (die de cache
vult) en Smart Actions' cache-lezing liepen parallel — als Smart
Actions eerder klaar was, las die een nog lege cache, dus verscheen
er alsnog geen trainingsvoorstel (opnieuw gemeld, met screenshot).
**Definitieve oplossing:** de volledige Today Engine rechtstreeks
aanroepen (inclusief Trainer AI), maar met een **harde tijdslimiet**
(`Promise.race`, 2,5 sec) — binnen de limiet een correct, volledig
resultaat; erbuiten wordt alleen het trainingsvoorstel overgeslagen,
de rest van Smart Actions (blessures/wedstrijd/vakantie/fallbacks)
blijft snel. Geen race condition meer, en nooit meer een totale
blokkade op een trage AI-generatie. Ook: **Performance en Dagboek
verplaatst** naar onderaan Home, bij "Week overzicht" (waren eerder
los bovenaan gebundeld).

**Aanleiding:** Levensgebeurtenissen werkt goed (Fase A/B hierboven),
maar is een eindstation — je moet er zelf naartoe om te zien wat eraan
komt. Deze visie maakt dezelfde data zichtbaar op de plek waar de
gebruiker daadwerkelijk kijkt (Home, ~10x/dag), niet alleen op de plek
waar hij 1x/week beheert (de agenda-pagina).

**Belangrijke correctie tijdens het ontwerp:** de bestaande Decision
Engine (`beslisTussenSpecialisten()`) is **niet** direct herbruikbaar
voor Smart Actions — die is smal gebouwd voor het vergelijken van
trainingsspecialisten (velden als `load`/`risk`/`hoogsteImportance`),
niet voor generieke "actie-voorstellen met een prioriteitscijfer" van
willekeurige modules. De **filosofie** (deterministisch, geen AI-call)
is herbruikbaar, de **code** niet — Smart Actions vergt een eigen,
generieke prioriteit-arbitrage.

##### Coach Planning (nieuwe module, vervangt Levensgebeurtenissen)

```
Coach Planning
├── Planning   (agenda: maand/week/lijst, kleurcodering per categorie)
├── Regels     (= huidige Levensgebeurtenissen-functionaliteit, hernoemd)
└── Overzicht  (intelligente samenvatting: "komende 14 dagen: 2 trainingen,
                1 fysio, Build Week, wedstrijd over 11 dagen")
```

**Bewust géén "Vandaag"-tab** — die informatie staat al op Home en in
de Today Engine; een tweede "Vandaag"-scherm zou hetzelfde onderhouden
op twee plekken betekenen, een bekend risico.

##### Coach Vooruitblik (nieuwe Home-kaart)

Toont de eerstvolgende 3-5 relevante gebeurtenissen — **puur feitelijk**,
geen voorspelling. Bijv. "Morgen: 🌙 Nachtdienst · Woensdag: 🏥 Fysio ·
Vrijdag: 🔥 Build Week start". Knop "Open Coach Planning" onderaan.
Gebruikt dezelfde onderliggende data-functie als Tab "Overzicht" —
één bron, geen dubbele logica.

##### Smart Action Engine (apart, na Coach Planning)

Top 3 context-afhankelijke acties op Home i.p.v. een vast menu —
**100% deterministisch, geen AI-call**. Elke module (Coach Agenda,
Performance, Training Platform, Blessures) mag actie-voorstellen met
een prioriteitscijfer aanleveren; een nieuwe, generieke arbitrage-laag
(zie correctie hierboven) kiest de top 3. De Master Coach (AI) legt
vervolgens uit *waarom* — AI interpreteert/verklaart, beslist niet
zelf welke knoppen verschijnen (zelfde principe als CoachOS' eerste
kernregel: "AI never creates exercises").

Fase 2 (veel later): een lerend systeem dat prioriteiten licht bijstelt
op basis van gebruikspatronen (bijv. "je bekijkt na elke fietstraining
altijd de Ritanalyse" → prioriteit +15) — een kleine correctie op de
vaste regels, geen vervanging ervan.

##### Coach Forecast (Fase D, ver weg — apart platform)

Een echte voorspeller: "Today Engine laat de komende dagen draaien".
Bijv. "Overmorgen nachtdienst → verplaats training naar 14:00,
verwachte Coach Score 82→87". Dit is *simulatie*, geen overzicht meer
— een compleet nieuwe engine, expliciet losgekoppeld van Coach
Vooruitblik (die blijft puur feitelijk) om te voorkomen dat er te
vroeg een complexe voorspeller gebouwd wordt.

##### Definitieve bouwvolgorde (bestemming eerst, dan de snelkoppeling)

```
Fase A — Coach Planning
  1. Regels     (bestaande functionaliteit, verplaatst/hernoemd — kleinste stap)
  2. Planning   (agenda: maand/week/lijst — grootste losse UI-klus)
  3. Overzicht  (hergebruikt de Fase A.1-databron, andere weergave)
        ↓
Fase B — Home: Coach Vooruitblik-kaart
  (nu heeft "Open Coach Planning" een echte bestemming)
        ↓
Fase C — Smart Action Engine
  (vergt Coach Planning als databron)
        ↓
Fase D — Coach Forecast
  (ver weg, apart platform)
```

**Navigatie:** geen nieuwe bottom-nav-tab. Coach Planning bereikbaar
via de Home-kaart (net als vandaag al besloten voor de eerdere Coach
Agenda-visie). Rolverdeling wordt dan: Home = cockpit ("wat moet ik nu
weten/doen"), Coach Planning = beheren/vooruitkijken, Specialisten =
sportinhoud, Trainer = uitvoering, Coach = gesprek met de Master Coach.

**Wanneer dit gebouwd wordt, gebeurt dat stap voor stap volgens
bovenstaande volgorde — niet als één grote levering.**



**Fase B, eerste stap (v2.4.188) — tekst-invoer, verplichte
bevestiging:**
- **`api/life-events/parse/route.ts`** — neemt vrije tekst, roept
  Claude aan met de **volledige, exacte typevocabulaire** (38 types
  uit alle 6 categorieën) als harde grens. Slaat NIETS op — levert
  alleen een gestructureerd voorstel.
- **Niet-onderhandelbaar principe, technisch afgedwongen, niet alleen
  in de prompt**: een **onafhankelijke validatielaag** controleert het
  door de AI teruggegeven type tegen de bekende vocabulaire — als de AI
  de instructie zou negeren en toch iets verzint, wordt dat hier alsnog
  geblokkeerd. Getest: zelfs een plausibel klinkend, maar niet-bestaand
  type ("wedstrijd") wordt correct afgewezen.
- **UI: `AiInvoerKaart`** — "Vertel de Coach..." invoerveld,
  bevestigingskaart ("Ik heb dit begrepen: ...") met ✓ Opslaan /
  ✏️ Opnieuw. Opslaan loopt via de bestaande, al-geteste
  `slaEventOp()` — geen nieuwe opslaglogica.

**Nog niet gebouwd:** spraak (aparte, kleinere stap — browser-eigen
spraakherkenning, geen nieuwe API nodig), Quick Cards (AI-
geïnterpreteerde bevestigingskaarten — niet te verwarren met "Snel
instellen" hieronder, dat is iets anders), Fase C (Coach Inbox,
patroonherkenning), Fase D (externe sync).

**Ook gebouwd, tot nu toe niet gedocumenteerd — gevonden 5 augustus
2026 bij een screenshot-check:** `SnelInstellenRij` (`coach-planning/
page.tsx`) — drie knoppen (🏖️ Vakantie, 🤒 Ziek, 🩹 Blessure) onder
"Snel instellen". Geen AI, geen aparte logica: Vakantie/Ziek zetten
`snelType` en openen dezelfde bottom-sheet als een handmatige
toevoeging (voorgevuld type, gebruiker kiest nog wel de datums) —
Blessure linkt gewoon door naar de bestaande `/injuries`-module. Puur
een UI-snelkoppeling naar bestaande, al-geteste opslaglogica, geen
nieuw systeem.

#### Coach Agenda — Fase A + B (tekst) afgerond, spraak/Quick Cards/C/D nog visie

**Fase A (v2.4.185) — volledig additief, geen bestaande engines
gewijzigd:**
- Nieuwe categorieën: Medisch (huisarts/fysiotherapeut/sportarts/
  specialist/massage/medisch onderzoek/vaccinatie), Sport
  (trainingskamp/testdag/clubrit/evenement), uitgebreid Leven
  (verjaardag/bruiloft/begrafenis/weekend weg/zakenreis/lange
  autorit/vlucht/hotel), Werk (consignatie)
- Nieuwe Coach-properties: `available_time_minutes`, `priority`,
  `location_type`, `energy_expectation`, `travel_distance_km`,
  `coach_note` (kolom aanwezig, nog niet in de UI gekoppeld — bewust,
  om een dubbel notitieveld naast de bestaande `notes` te voorkomen)
- **Uitzonderingen op terugkerende regels** — "iedere maandag
  dagdienst, BEHALVE 17 augustus" zonder de regel te hoeven aanpassen
  of stoppen. Nieuw: `recurrence_exceptions` (date-array)
- **Besluit vastgelegd:** bestaande 0-3-schaal (`recovery_impact`/
  `stress_load`/`sleep_disruption`) blijft ongewijzigd — voedt nog
  steeds de Recovery Score. Nieuwe velden zijn puur additief, geen
  parallelle schaal.
- **Besluit vastgelegd:** DELETE blijft een echte verwijdering — soft-
  delete/status-lifecycle (Actief/Gepauzeerd/Beëindigd) is bewust
  uitgesteld naar Fase C/D, niet meegenomen in Fase A
- SQL: `supabase/coach_agenda_fase_a.sql` — puur additieve kolommen

**Wat van Fase B-D nog puur visie is, niets gebouwd:** spraak-invoer,
Quick Cards, Rule Engine, virtuele gebeurtenissen automatisch tonen,
Fase C (Coach Inbox), Fase D (externe agenda-sync). **Wel al gebouwd**
(zie hierboven en de Coach Vooruitblik-sectie elders in dit README):
tekst-invoer met verplichte bevestiging (v2.4.188), de Coach
Vooruitblik-kaart op Home (v2.4.201), en "Snel instellen" — deze regel
zei eerder ten onrechte "niets gebouwd", rechtgezet 5 augustus 2026.

**Filosofie:** een gewone agenda vraagt "welke afspraak wil je
toevoegen?". CoachOS vraagt "waar moet ik als coach rekening mee
houden?" — CoachOS verzamelt geen afspraken, het verzamelt context.

**Herziene architectuur** (Coach Agenda is niet de enige contextbron,
wel eigenaar van *planbare* gebeurtenissen — Injuries/Performance/
Goal Engine/Weather blijven eigen, gelijkwaardige bronnen ernaast):

```
              AI Invoer (spraak/tekst)
                       │
                       ▼
                 Rule Engine
                       │
                       ▼
             Coach Agenda (Actieve Regels)
                       │
    ┌──────────────────┼──────────────────┐
    │                  │                  │
Injuries          Performance         Goal Engine
    │                  │                  │
    └──────────────────┼──────────────────┘
                       │
                Weather / Locatie
                       │
                       ▼
               Context Resolver
                       │
                       ▼
                 Today Engine
                       │
                       ▼
                 Master Coach
                       │
                       ▼
                 Specialisten
```

**Rule Engine** (nieuwe, expliciete component): natuurlijke taal
interpreteren, regels valideren, conflicten detecteren, uitzonderingen
verwerken, herhalingen genereren, regels pauzeren/hervatten/
overschrijven. **Niet-onderhandelbaar principe, zelfde filosofie als
CoachOS' allereerste kernregel** ("AI never creates exercises"):
**AI mag nooit zelfstandig een regel opslaan.** Elke AI-geïnterpreteerde
regel vereist expliciete bevestiging van de gestructureerde uitkomst
vóór opslag — bijv. "Ik heb dit begrepen: Werk, Nachtdienst, start 3
augustus, elke 2 weken, geen einddatum. ✓ Opslaan ✏️ Wijzigen."

**Actieve Regels** i.p.v. losse afspraken — bouwt voort op bestaande
`recurrence`-functionaliteit (`life_events` heeft dit al); de
innovatie zit in de AI-laag die vrije tekst omzet naar een
gevalideerde, terugkerende regel.

**Virtuele gebeurtenissen** — wedstrijden (Goal Engine's `target_date`),
Build/Recovery/Peak Week (Training Plan Engine's mesocyclus) worden
automatisch getoond in Coach Agenda, niet handmatig ingevoerd en niet
dubbel opgeslagen. Coach Agenda blijft daarvan alleen de weergave, de
brondata blijft bij Goal Engine/Training Plan Engine.

**Navigatie — géén nieuwe tab.** De bestaande 6-tabs bottom-navigatie
(Home/Coach/Trainer/Specialisten/Activiteiten/Voortgang) is al logisch
opgebouwd en blijft ongewijzigd. Coach Agenda wordt bereikbaar via:
een nieuwe kaart op Home ("🗓️ Coach Agenda — vandaag/morgen/volgende
week, met een link naar het volledige scherm"), vanuit Coach, en
eventueel via Instellingen. Redenering: de Agenda is geen dagelijkse
bestemming — de meeste gebruikers openen 'm alleen als er iets
verandert (nieuw rooster, vakantie invoeren), de AI doet de rest. Home
blijft de dagelijkse cockpit ("90% van de tijd opent de gebruiker
alleen Home").

**Fasering (bewust, niet als één groot geheel bouwen):**
- **Fase A** — bredere categorieën (medische afspraken, familie
  expliciet), Coach-properties per event (uitbreiding van het
  bestaande v2.4.173-patroon), Actieve Regels (bouwt voort op
  bestaande recurrence)
- **Fase B** — AI-invoer (spraak/tekst), Quick Cards, **verplichte
  bevestigingsstap** (zie hierboven, niet-onderhandelbaar)
- **Fase C** — Coach Inbox (proactieve meldingen op Home:
  "Volgende week begint je vakantie — trainingsplan pauzeren?"),
  patroonherkenning ("Je werkt al 8 weken om de week nachtdienst —
  hiervan een vaste regel maken?")
- **Fase D** — Apple/Google/Outlook-sync (alleen sync-bron, nooit
  hoofdbron — CoachOS blijft eigenaar van de context), schoolvakanties

**Wanneer deze worden toegevoegd, gebeurt dat als nieuwe
architectuurstappen — niet als correcties op deze documentatie.**

## Huidige Status — Systemen

### VIER-IN-ÉÉN FIX — v2.4.259 (4 augustus 2026)
Vier gemelde problemen tegelijk uitgezocht en gefixt, elk met een
eigen root cause:

**1. Rowing-activatie deed niks.** `specialisten/page.tsx` — de
"Beschikbaar"-kaart was een kale `<Link>` die rechtstreeks naar
`/coach/rowing` navigeerde; de al-bestaande `activeer()`-functie (POST
met `active:true`) werd hier nooit aangeroepen. Nu: eerst activeren
(inclusief de navigatie, die zit al in `activeer()` zelf), dan pas
verhuist de kaart naar "Actief" met het icoontje in kleur.

**2. Geen Cycling-training in Smart Actions** (screenshot: Coach
adviseerde fietsen, maar Snelle Acties toonde niks) — bleek hetzelfde
root cause als punt 3: **twee identieke sessies voor dezelfde dag**,
veroorzaakt door de rolling horizon-verlenging (v2.4.248/249) die
vanuit meerdere plekken tegelijk kan draaien (rechtstreeks via de
trainingsplan-pagina, én automatisch via Today Engine bij elke
Home-load) — bij bijna-gelijktijdige aanroepen zag de tweede nog niet
dat de eerste al iets had aangemaakt.

**3. "Om de week" sloeg niet op.** Root cause, bevestigd door de
POST- en PATCH-route van `life-events` naast elkaar te leggen: de
PATCH-route (bewerken van een bestaand item) miste `start_time`
volledig — en de "om de week"-berekening (`weekVerschil()`) leunt
rechtstreeks op dat veld. Bij het bewerken van een bestaande dienst
bleef het oorspronkelijke, mogelijk verouderde `start_time` staan.

**4. Herstel/stress-impact bij avonddienst sloeg niet op.** Zelfde
PATCH-route, zelfde soort gat: `recovery_impact`/`stress_load`/
`sleep_disruption` ontbraken volledig — het formulier stuurde ze wél
mee (bevestigd in `coach-planning/page.tsx`'s `opslaan()`-functie),
maar de route negeerde ze stilzwijgend.

**Fixes:**
- `src/app/specialisten/page.tsx` — kaart roept nu `activeer()` aan
- `src/lib/specialists/training-plan-engine/core.ts` — idempotency-
  check vóór elke sessie-insert (checkt of er al een sessie voor die
  exacte datum bestaat)
- `supabase/fix_duplicate_sessions.sql` — **tweede beveiligingslaag**:
  ruimt bestaande duplicaten op, voegt een `unique(plan_id, date)`-
  constraint toe (de applicatie-check alleen is niet 100%
  race-condition-vrij bij écht gelijktijdige aanroepen)
- `src/app/api/life-events/route.ts` — 4 ontbrekende velden toegevoegd
  aan de PATCH-route (`start_time`/`recovery_impact`/`stress_load`/
  `sleep_disruption`)

`npx next build` — compileert zonder fouten na alle vier de fixes.

### VERVOLG-FIX — v2.4.260: "om de week" nog steeds fout, echte oorzaak
Gemeld met een screenshot: v2.4.259's fix (PATCH miste `start_time`)
loste het probleem niet volledig op. Grondiger uitgezocht:
`needsDay`/`needsDays` (metadata bij de herhaling-opties) bleken **dode
metadata** — nergens daadwerkelijk gebruikt. De dag-selector zelf
bestond wél al (in zowel het aanmaak- als bewerk-formulier, "Op welke
dag?"), maar **`kiesHerhaling()` zette geen standaard-dag voor
weekly/biweekly** — workdays/weekend kregen al een automatische
standaard, "Om de week" niet. Wie meteen opsloeg zonder zelf een dag
aan te tikken, kreeg dus `recurrence_days: null`, wat de
berekeningslogica liet interpreteren als "elke dag" — precies het
gemelde, kapotte gedrag.

**Fix:** `kiesHerhaling()` (beide identieke instanties, aanmaken en
bewerken) zet nu automatisch de dag van de huidige startdatum als
standaard voor weekly/biweekly, zodat de dag-selector meteen een
zinnige keuze toont.

**Gevalideerd:** volledige simulatie over 4 weken met 17 augustus 2026
(een maandag) als startdatum en `recurrence_days: [1]` — actief op 17
aug, niet op 24 aug, weer actief op 31 aug. Exact het juiste "om de
week"-patroon. `npx next build` — compileert zonder fouten.

**Belangrijk voor bestaande items:** deze fix werkt alleen voor
NIEUWE dag-keuzes vanaf nu. Het bestaande "Vroege dienst"-item uit de
screenshot heeft waarschijnlijk nog `recurrence_days: null` — open
het, tik "Herhaling" opnieuw aan (of tik een dag aan in de selector),
en sla op om het te repareren.

### DERDE EN DEFINITIEVE FIX — v2.4.261: de échte, echte oorzaak
Gemeld met TWEE screenshots (de Herhaling-selector zag er al goed uit
— "Ma" stond al automatisch aangevinkt, dus v2.4.260 werkte) en het
resultaat: "Slaat 1 week maandag op. Dan niets meer." Grondig
uitgezocht met de tweede screenshot (het hoofdscherm van het event):
**BEGINDATUM 17 aug 2026, EINDDATUM 21 aug 2026** — twee aparte
datumvelden bovenaan het scherm, los van de Herhaling-instelling.

**Root cause, eindelijk de juiste:** er bestaan TWEE aparte
"einddatum"-concepten in het datamodel: het bovenste `end_date`-veld
(bedoeld voor een eenmalig event van dag X t/m dag Y) en een tweede,
eigen `recurrence_end_date`-veld ÍN het Herhaling-scherm (bedoeld om
een herhalende reeks te laten stoppen). `isHerhalendActiefOpDag()`
checkt BEIDE velden en stopt zodra ÉÉN van de twee overschreden wordt.
Met Einddatum op 21 augustus (4 dagen na Begindatum) stopte de HELE
"om de week"-reeks na de eerste maandag — ver vóór de volgende
biweekly-maandag (31 augustus) ooit bereikt zou worden. Geen bug in de
herhalingsberekening zelf, maar een verwarrend datamodel: twee
overlappende velden die door elkaar liepen.

**Fix, in beide schermen (aanmaken én bewerken):**
- Het bovenste "Einddatum"-veld wordt nu verborgen/uitgeschakeld
  zodra er een herhaling actief is, met een verwijzende tekst ("Zie
  Herhaling →") en een toelichting eronder
- Bij het opslaan wordt `end_date` altijd expliciet op `null` gezet
  zodra er een herhaling actief is (`recurrence ? null : (endDate ||
  null)`) — **ook als er nog een oude waarde in de formulier-state
  hangt**. Dit repareert automatisch bestaande, kapotte items: gewoon
  het item openen en op Opslaan tikken (zonder verder iets te
  wijzigen) is genoeg, want de herhaling staat al ingesteld

**Gevalideerd — volledige simulatie, exact het gerapporteerde
scenario:** met de fix (`end_date: null`) loopt de reeks correct door:
17 aug actief, 24 aug niet, 31 aug actief, 7 sep niet, 14 sep actief.
Zonder de fix (de oude situatie, `end_date: '2026-08-21'`) stopt het
na de eerste maandag, exact het gemelde gedrag. `npx next build` —
compileert zonder fouten.

### UITBREIDING — v2.4.262: meerdere dagen bij Wekelijks/Om de week
Gemeld: "Ik kan niet meerdere dagen selecteren." Bevestigd: bij
"Aangepast" werkte multi-select al, bij "Wekelijks"/"Om de week"
niet — daar verving elke tik de hele selectie (`setRecurrenceDays(
[dag.nummer])`) i.p.v. toe te voegen. **Geen bug in de
berekeningslogica** — `isHerhalendActiefOpDag()` ondersteunde
`recurrence_days` als array voor weekly/biweekly al gewoon, alleen de
knoppen zelf niet.

**Fix:** dezelfde toggle-logica als "Aangepast" nu ook toegepast op
Wekelijks/Om de week (in beide schermen), met een vangnet dat
voorkomt dat de laatste overgebleven dag uitgezet kan worden (altijd
minimaal 1 dag actief). Labels bijgewerkt ("Op welke dag?" →
"Op welke dag(en)?"), en de samenvattingstekst (`formatHerhaling()`)
toont nu alle geselecteerde dagen i.p.v. alleen de eerste.

**Gevalideerd:** toevoegen/verwijderen van dagen getest, inclusief het
vangnet — een poging om de laatste dag te verwijderen wordt genegeerd,
blijft op 1 dag staan. `npx next build` — compileert zonder fouten.

### FIX — v2.4.263: "Trainingen komende week" negeerde vakantie
Gemeld tijdens het samen doorlopen van Coach Planning: Overzicht toonde
"8 trainingen komende week", terwijl de Week-weergave (die vakantie wél
respecteert) 0 trainingsactiviteiten toonde voor diezelfde periode —
gebruiker zat middenin een vakantieweek (20 juli t/m 9 augustus).

**Root cause 1:** `trainingenKomendeWeek` in
`coach-planning-overzicht.ts` telde gewoon alle `training_plan_sessions`-
rijen in de komende 7 dagen, zonder enige vakantie-check. De rijen
zelf bestaan nog (al gegenereerd door de rolling horizon, los van
vakantie), maar niets in deze specifieke teller wist dat een deel van
die dagen vakantie was.

**Root cause 2, gevonden tijdens het bouwen van de fix:** de query
voor eenmalige life-events (waar 'vakantie' onder valt) had nog een
`gte('start_time', vandaag)`-filter — exact hetzelfde patroon dat al
in v2.4.203 gefixt werd voor HERHALENDE events, maar hier nooit
toegepast. Een vakantie die vóór vandaag begon maar nog doorloopt
(20 juli → 9 augustus, vandaag er middenin) werd hierdoor structureel
gemist — niet alleen in deze teller, maar overal waar `eenmaligeEvents`
gebruikt wordt (ook `volgendeVakantie`).

**Fix:**
- `gte('start_time', vandaag)` verwijderd uit de eenmalige-events-
  query — zelfde patroon als de herhalende-events-query al had
- `trainingenKomendeWeek` sluit nu sessies uit die op een dag vallen
  waarop een actieve 'vakantie'-event geldt (hergebruikt
  `isEventActiefOpDag()`, geen nieuwe logica)

**Gevalideerd — exact het gerapporteerde scenario:** vakantie 20 jul
t/m 9 aug, vandaag 4 aug, sessies gepland 4 t/m 11 aug. Met de fix:
2 (alleen 10 en 11 aug vallen buiten vakantie). Zonder de fix: 8 — de
exacte, misleidende waarde die gerapporteerd werd. `npx next build` —
compileert zonder fouten. **Bevestigd werkend na deployment** —
screenshot toonde 2 i.p.v. 8, exact zoals berekend.

### BIJVANGST-FIX — v2.4.264: "Over -15 dagen"
Direct gevonden bij het testen van v2.4.263: door de query-fix
(gte-filter verwijderd) vond `volgendeVakantie` nu voor het eerst
correct een AL-LOPENDE vakantie — maar de weergave-berekening
(`dagenTot()`, in `coach-planning/page.tsx`) berekent dagen tot de
STARTDATUM, en hield geen rekening met een vakantie die al begonnen
is. Resultaat: "Over -15 dagen" — rekenkundig correct, maar onbruikbaar.

**Fix:** als de startdatum al voorbij is maar de einddatum nog niet,
toont het scherm nu "Nu bezig" i.p.v. het negatieve getal. Is de hele
vakantie al voorbij, dan "Voorbij" (in plaats van een steeds groter
wordend negatief getal).

**Gevalideerd — 4 scenario's:** al-lopende vakantie ("Nu bezig"),
al-voorbije vakantie ("Voorbij"), toekomstige vakantie ("Over 5
dagen", ongewijzigd gedrag), vakantie die vandaag begint ("Vandaag").
`npx next build` — compileert zonder fouten.

### ADR-007 — v2.4.265: "Gebruikt elke specialist dezelfde weg?"
Gevraagd tijdens een architectuur-review: "Alles gebruikt nu de
builder? Elke specialist gebruikt dezelfde weg?" Bij het uitzoeken
kwam een reëel, ernstig risico naar boven, geen ja/nee-antwoord.

**Het gevonden risico:** de Workout Platform's Adaptation Engine
(nieuw) en de al-bestaande Daily Adjustment Layer (ouder, sinds
v2.4.97) konden **onafhankelijk van elkaar** dezelfde workout
verkleinen — de oude laag bij laag herstel (-40%, database-niveau),
de nieuwe laag bij een kruis-sport-signaal (-30% warmup/-1 herhaling/
-1 zone, in-memory). Bij een gebruiker met beide tegelijk werd
dezelfde training **twee keer** verkleind, cumulatief en niet meer
uitlegbaar — recht tegen CoachOS' kernprincipe van explainable AI in.

**Doorgerekend en bevestigd** (zie transcript): een simulatie met een
al-halveerde workout die daarna nogmaals door de kruis-sport-check
ging, liet de warmup nog een keer krimpen (300→210 sec) bovenop de
al-gehalveerde sessie.

**Architectuurbeslissing — vastgelegd in [ADR-007](docs/adr/ADR-007-single-workout-mutation-principle.md):**
slechts één component mag een workout daadwerkelijk wijzigen (de
Adaptation Engine). Alle andere componenten leveren uitsluitend
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

**Fase 1 (deze levering), bewust afgebakend:**
- `adjuster-core.ts`'s `fatigue_detected`-trigger muteert de database
  niet meer — levert een `AdaptationSignal` op
- `cross-sport-bridge.ts`'s `bepaalKruisSportSignaal()` spreekt nu
  hetzelfde contract (severity o.b.v. aantal belaste dimensies,
  confidence o.b.v. de bijdragende UAP-velden)
- `pasWorkoutAan()` herschreven — ontvangt een array van signalen,
  past de downscale hooguit ÉÉN keer toe, combineert alle redenen in
  één toelichting
- Alle drie de Workout Builder-routes (Rowing/Running/Cycling)
  bijgewerkt om beide signalen te verzamelen vóór één aanroep

**Bewust NIET in deze fase:** `missed_session`/`injury_protection`/
`goal_change` blijven database-mutaties (planning-beslissingen, geen
intensiteit-downscale, overlapten niet met het risico). De volledige
Intelligence Platform-combinatielaag (die ooit ALLE signaalbronnen
zou moeten samenvoegen) — dit contract bereidt die stap voor, bouwt
'm nog niet.

**Gevalideerd — exact het gevonden risico:** fatigue-signaal +
cross-sport-signaal tegelijk aangeboden geeft **exact dezelfde
magnitude** als één signaal alleen (herhalingen 4→3, warmup
onveranderd t.o.v. het enkele-signaal-scenario) — bevestigd met een
directe vergelijking. Toelichting combineert beide redenen correct in
één zin. `npx next build` — compileert zonder fouten.

**Wat hierdoor niet verandert:** Rowing/Running/Cycling behouden al
hun bestaande kennis, analyses en policies. De downscale-magnitude
zelf is ongewijzigd — alleen de garantie dat 'ie hooguit één keer
afgaat, is nieuw.

### v2.4.266 — UI-gat gedicht: "kan de trainingen zien, alleen bij Rowing kan ik ze openen"
Gemeld direct na het testen van ADR-007: de backend-koppeling voor
Cycling/Running werkte al (bevestigd via de ADR-007-test), maar er
was **geen UI** om een sessie open te tikken en de concrete workout te
zien — dat bestond alleen bij Rowing. Geen nieuwe bug, het eerder al
gevonden, nog niet opgeloste gat ("gebruikt Cycling/Running de
`/workout`-route? Technisch ja, in de praktijk nooit aangeroepen").

**Fix:** `WorkoutDetail`-component toegevoegd aan zowel
`coach/cycling/trainingsplan/page.tsx` als `coach/running/
trainingsplan/page.tsx` — mirror van Rowing's versie, aangepast per
sport (vermogen_watt voor Cycling, pace voor Running i.p.v. SPM).
Zowel de "Vandaag"-kaart als elke "Komende trainingen"-kaart is nu
klikbaar/uitklapbaar, exact zoals Rowing al werkte.

**Kleine extra, sport-specifiek:** als er nog geen FTP (Cycling) of
recente wedstrijdprestatie (Running) is ingevuld, toont het scherm nu
een duidelijke hint ("vul je FTP in voor concrete vermogenswaarden")
in plaats van stilzwijgend geen pace/vermogen te tonen.

`npx next build` — compileert zonder fouten, beide pagina's.

**Daarmee gebruiken Rowing, Running en Cycling nu écht dezelfde weg —
niet alleen op API-niveau, ook zichtbaar in de app.**

| Systeem | Status |
|---------|--------|
| Optie C Filter Layer | ✅ |
| AI Assembly Layer | ✅ |
| Coaching Cirkel | ✅ |
| Coach Compliance | ✅ |
| Coach Call Systeem (interne + Strava) | ✅ |
| Uitlegpagina Bibliotheek | ✅ |
| Drill Libraries (Running/Rowing/Cycling) | ✅ |
| Mobility Bibliotheek | ✅ |
| Recovery Bibliotheek | ✅ |
| Relaxation Pagina | ✅ |
| Herstelbibliotheek (inklapbaar) | ✅ |
| Progressie Tracking (exercise_records) | ✅ |
| Persoonlijke Records | ✅ |
| Coach Trendanalyse (Fase 3A) | ✅ |
| Coach Rapport op aanvraag (Fase 3B) | ✅ |
| Life-events Module | ✅ |
| Trainer Rule (alle modules) | ✅ |
| Weerbericht (Open-Meteo) | ✅ |
| Archief (354 oefeningen los) | ✅ |
| Exercise Illustraties Systeem | ✅ |
| Countdown + Timer (alle modules) | ✅ |

### Aanvulling (juli 2026) — Coach Context Engine, Performance Platform, Specialist-pariteit

*Deze tabel hierboven is ouder dan de sessie van juli 2026. Onderstaande
rijen zijn de aanvulling met alles wat sinds die tijd gebouwd is — samen
vormen ze de volledige, actuele status.*

| Systeem | Status | Toelichting |
|---------|--------|-------------|
| **Today Engine** | ✅ Bevestigd in de praktijk | Enige bron voor "wat moet ik vandaag doen" — kiest tussen Specialist-trainingsplan en Trainer AI, nooit beide tegelijk. `src/lib/today-engine.ts` |
| Master Coach ↔ Today Engine | ✅ | Coach-tekst en Today-kaart gebruiken nu dezelfde bron, geen tegenstrijdige adviezen meer mogelijk |
| **Context Resolver** (Coach Context Engine Fase 1) | ✅ Bevestigd | Vaste prioriteit blessure→ziekte→vakantie→herstel→wedstrijd→werk→training→vrije_tijd. `src/core/utils/context-resolver.ts` |
| Coach Agenda Fase 2 | 🔄 Deels | Feestdagen ✅, periodiserings-context (mesocyclus) ✅. Schoolvakanties/Apple/Google/Outlook-sync: ⏳ nog niet gestart |
| **Performance Intelligence Platform** | ✅ Fase 1A/1B/2 compleet | Recovery/Load/Fatigue/Readiness/Consistency/History/Endurance/Sprint/Efficiency/Climbing/Progress. Fase 3 (Race Predictor e.d.) bewust nog niet — vergt maanden data |
| **Cycling ↔ Running specialist-pariteit** | ✅ Compleet | Dashboard/Records/Grafieken/Trainingsplan/Ritanalyse/Progress — beide op hetzelfde niveau |
| Pauzeer/Hervat trainingsplan | ✅ | Beide specialisten, hergebruikt bestaande `'abandoned'`-status |
| Weer — uitgebreide gegevens | ✅ | Gevoelstemperatuur/luchtvochtigheid/windstoten/UV-index/neerslagkans, tik-om-uit-te-klappen op Home |
| GPS-locatie (i.p.v. IP-only) | ✅ Bevestigd | `/debug/weer` permanent beschikbaar voor diagnose |
| Rowing/Strength/Kettlebell als volwaardige specialisten | ⏳ Niet gestart | Elk net zo groot als de Cycling/Running-pariteitsronde — vergt concrete aanleiding |
| Multi-sport Orchestrator (`TodaySchedule`) | ⏳ Niet gestart | Pas zinvol zodra er meerdere volwassen specialisten zijn |

#### CoachOS Universal Athlete Platform — Definitieve Referentie-Architectuur (vastgelegd 2 augustus 2026)

**Kernvraag die tot deze visie leidde:** trainen we sporten, of trainen
we één mens? Antwoord: **CoachOS denkt niet in sporten, niet in
trainingen, zelfs niet in workouts — CoachOS denkt in de ontwikkeling
van de sporter.** Sporten/trainingen/workouts zijn allemaal middelen;
het échte product is de ontwikkeling van de mens erachter.

**Geen Multi Sport Specialist.** Bewust afgewogen en verworpen — dat
zou zelf weer een specialist worden (extra logica/beslissingen/
complexiteit). De Master Coach **is al** de multisport-regisseur; wat
ontbrak was één gezamenlijke, sport-onafhankelijke taal tussen de
specialisten.

**De hoofdlijn — een beslissings- en ontwikkelingsketen:**

```
Coach Agenda
      │
      ▼
Context Platform
      │
      ▼
Training Plan Platform      — "Wat moet ik trainen?"
      │
      ▼
Workout Platform             — "Hoe ziet die training eruit?" (al gebouwd, v2.4.224-230)
      │
      ▼
Performance Platform         — analyseert uitgevoerde training + fysieke toestand
      │
      ▼
Universal Athlete Platform   — het digitale model van de sporter (NIEUW)
      │
      ▼
Learning Rules Engine        — persoonlijke patronen, 100% uitlegbaar (NIEUW)
      │
      ▼
Intelligence Platform        — interpretatie, welke actie volgt hieruit
      │
      ▼
Master Coach                 — menselijke vertaling/communicatie
      │
 ┌────┼────────┬────────┐
 ▼    ▼        ▼        ▼
Running Cycling Rowing Strength
```

**Daarnaast, als zijlaag — géén stap in de ketting, een raadpleegbare
bron:**

```
              Knowledge Platform          — bron van waarheid, geen proces-stap
                     │
       ┌─────────────┼─────────────┐
       ▼             ▼             ▼
Workout        Learning       Specialisten
Platform       Rules Engine
```

**Bewuste architectuurcorrectie tijdens het ontwerp:** Knowledge
Platform stond oorspronkelijk als sequentiële stap tussen Intelligence
Platform en Master Coach getekend. Aangescherpt: het is een gedeelde
kennisbron (sportwetenschap/herstelkennis/voedingskennis) die door
meerdere lagen tegelijk geraadpleegd wordt (Workout Platform, Learning
Rules Engine, Specialisten) — een lineaire pijl ernaartoe zou
suggereren dat elke beslissing er letterlijk doorheen stroomt, terwijl
het eerder werkt als een naslagwerk.

**Niet-onderhandelbare rolverdeling — geen enkele laag beslist buiten
zijn verantwoordelijkheid:**
- **Universal Athlete Platform** → uitsluitend Observer: verzamelt,
  analyseert, observeert. **Neemt nooit zelf beslissingen.**
- **Knowledge Platform** → levert wetenschappelijke context
- **Learning Rules Engine** → ontdekt patronen (ontdekking, geen besluit)
- **Intelligence Platform** → maakt voorstellen/beslissingen
- **Master Coach** → geeft richting en communiceert naar de sporter

**Universal Athlete State — het digitale lichaam van de sporter, niet
van de sport:**

```
Cardiovascular: Aerobic Load, Anaerobic Load, VO₂ Adaptation, Cardio Fatigue
Muscular: Leg/Core/Upper Body/Lower Back/Grip Fatigue
Mechanical: Joint Impact, Tendon Load, Bone Stress, Muscle Damage
Neurological: Neuromuscular Fatigue, Coordination, Motor Control, Explosiveness
Recovery: Recovery, Sleep Debt, HRV Trend, Resting HR, Body Battery, Recovery Capacity
Mental: Stress, Motivation, Focus, Cognitive Fatigue
Training: Acute/Chronic Load, ACWR, Consistency, Training Monotony, Training Strain
Environment: Heat/Cold/Altitude Adaptation, Hydration Status, Energy Availability
```

**Kritieke correctie tijdens het ontwerp — geen schijnprecisie:** ruwe
getallen zoals "Rowing → Cardio +65, Core +80" worden **nooit** aan de
gebruiker getoond. Intern mogen ze bestaan; zichtbaar wordt altijd een
kwalitatief label + expliciete confidence, matchend het al-bestaande
Performance Platform-patroon (HIGH/MEDIUM/LOW):

```
Cardio: Hoog · Confidence 96%
Leg fatigue: Gemiddeld · Confidence 71%
Hydration: Laag · Confidence 28% (onvoldoende data)
```

**Confidence op élk universeel getal, niet alleen Recovery** — anders
erft de hele Universal Athlete State hetzelfde nepprecisie-risico.

**Learning Rules Engine — bewust NIET "AI" genoemd, geen black box:**
100% reproduceerbaar en uitlegbaar, exact dezelfde filosofie als elke
engine die vandaag al gebouwd is (Training Plan Engine, Workout
Platform — allebei 100% deterministisch). Voorbeeld:

```
if runningSessions > 30 AND recoveryTrend > baseline AND RPE stable
then Recovery Factor Running +4%
```

**Minimum-datapunten vóór personalisatie geactiveerd wordt — bewust
vastgelegd, niet impliciet:**

```
Running: 20 trainingen | Cycling: 20 | Rowing: 20 | Strength: 15
```

Tot die drempel: **Population Model** ("CoachOS weet nog niets van
JOU, gebruikt algemene sportwetenschap"). Daarna: **Learning Enabled**
("CoachOS kent JOU"). Voorkomt overtuigde, foute personalisatie op
basis van toeval bij te weinig data.

**Workflow — hoe een training het digitale model verandert:**

```
Training voltooid → Sport Specialist → Universal Impact Engine →
Universal Athlete State → Universal Adaptation Engine → Master Coach →
Today Engine → Volgende Specialist
```

Concreet voorbeeld uit de visie: na 90 minuten roeien schrijft Rowing
Specialist `Cardio +65, Core +80, Upper Body +75, Legs +45, Impact +5`.
Als de gebruiker morgen Running opent, leest Running **niet** "gisteren
geroeid" — het leest de Universal Athlete State direct (Cardio hoog,
Core/Upper Body vermoeid, Legs matig belast) en kiest een rustige
duurloop, niet omdat er geroeid is, maar omdat het lichaam al belast is.

**Workout Builder wordt universeel** (grotendeels al gebouwd,
v2.4.224-230) — Training Plan bepaalt WAT (bijv. "VO₂max Training"),
elke Specialist Adapter vertaalt naar zijn eigen sport (Running: 5×1000m,
Cycling: 5×4min @110% FTP, Rowing: 5×1000m @2k Pace) — zelfde
trainingsdoel, andere uitvoering.

**Device Adapter Layer + CoachOS Connect** — apparaten worden nooit
onderdeel van specialisten, altijd een aparte laag. Live hardware-
communicatie (Bluetooth/PM5/Garmin/Wahoo) hoort bij een toekomstige
**native companion-app** ("CoachOS Connect"), niet bij de PWA — sluit
aan bij de al-vastgelegde Web Bluetooth/iOS-beperking uit de Rowing
Platform-visie (zie hieronder).

**Coach Agenda blijft het centrale contextplatform** — niet alleen
afspraken, alle gebeurtenissen met invloed op training (werk/vakantie/
medisch/reizen/herstel/periodisering/wedstrijden/weer). Externe
agenda's (Apple/Google/Outlook) worden uitsluitend synchronisatie-
bronnen — CoachOS blijft eigenaar van de context.

**Bewuste, expliciet vastgelegde eerste scope:** het Universal Athlete
Platform begint klein (Running, Cycling, Rowing) en breidt geleidelijk
uit — ambitieuze architectuur, beheersbare implementatie.

**Eerste bouwstap afgerond — v2.4.234.**
`src/core/athlete-platform/types.ts` — `UniversalAthleteState` en de
acht categorieën (Cardiovasculair/Spieren/Mechanisch/Neurologisch/
Herstel/Mentaal/Training/Omgeving). Puur datamodel, nog geen logica
(Universal Impact Engine/Learning Rules Engine volgen als aparte,
latere stappen). **Beide kernregels uit het ontwerpoverleg direct in
de types verankerd:** (1) `UniverseleWaarde` bevat verplicht een
`niveau` (kwalitatief label) + `confidence` — een los getal
(`ruweWaarde`) is uitsluitend intern, expliciet gemarkeerd als "NOOIT
rechtstreeks tonen aan de gebruiker"; (2) `bepaalPersonalisatieStatus()`
implementeert de minimum-datapunten-drempel (Running/Cycling/Rowing:
20, Strength: 15) — `population_model` vs. `learning_enabled`,
getest inclusief het exacte grensgeval (19 vs. 20 trainingen) en een
fallback-drempel voor toekomstige, nog onbekende sporten.

**Tweede bouwstap afgerond — v2.4.235: Universal Impact Engine.**
`src/core/athlete-platform/impact-engine.ts` — `pasImpactToe()`,
combineert een Specialist Adapter's al-vertaalde impact-bijdragen
(bijv. exact het visie-voorbeeld: Rowing 90 min → Cardio +65/Core
+80/Upper Body +75) met de bestaande Universal Athlete State. **Bewust
GEEN sportlogica** — de Engine kent zelf geen FTP/SPM/pace, alleen
generieke dot-pad-adressering ('cardiovasculair.aerobic_load').

**Combinatiemodel, eerlijk benoemd als startpunt, geen wetenschappelijke
claim:** exponentieel voortschrijdend gemiddelde (30% nieuwe sessie,
70% bestaande staat) — voorkomt dat één sessie de hele staat omgooit.
**Confidence daalt nooit kunstmatig** — de resulterende confidence is
altijd de laagste van bestaande staat en nieuwe bijdrage, nooit
hoger. Onbekende/foutieve paden worden overgeslagen met een
console.error i.p.v. een crash — een adapter-bug mag nooit de hele
state-update laten falen. Immutability gegarandeerd (zelfde patroon
als de Workout Platform's Adaptation Engine).

**Gevalideerd:** combinatiemodel getest (eerste-keer-situatie, exact
het visie-voorbeeld met de juiste berekening, confidence-daalt-nooit-
kunstmatig-garantie) + volledige integratietest op een echte
`UniversalAthleteState` (alle 8 categorieën, inclusief een bewust
onbekend pad dat netjes wordt overgeslagen, en de immutability-
garantie bevestigd). `npx next build` — compileert zonder fouten.

**Derde bouwstap afgerond — v2.4.236: Learning Rules Engine.**
`src/core/athlete-platform/learning-rules-engine.ts` — `evalueerRegels()`,
bewust NIET "AI" genoemd: expliciete if-conditie → effect-regels,
100% reproduceerbaar en uitlegbaar (elke regel heeft een verplichte,
mens-leesbare `beschrijving`). Eerste regel is letterlijk het
visie-voorbeeld: `aantalSessies > 30 AND recoveryTrend > baseline AND
RPE stabiel → herstel_capaciteit +4%`. **Drempel-gate uit v2.4.234
direct toegepast** — onder de personalisatie-drempel wordt géén
enkele regel geëvalueerd (expliciet `population_model` in de uitkomst,
geen stilzwijgende lege lijst zonder verklaring).

**Onderscheid vastgelegd in commentaar:** niet te verwarren met de
al-bestaande `src/lib/specialists/learning-engine.ts` (Coach Memory —
AI-gegenereerde inzichten voor coach-gesprekken) — dit hier is iets
anders: statistische, regelgebaseerde patronen op de Universal Athlete
State, geen AI-tekst.

**Gevalideerd — 4 scenario's:** onder de drempel (0 regels
geëvalueerd, expliciet population_model), exact het visie-scenario
(regel vuurt, geeft het juiste +4%-effect), dezelfde situatie maar met
instabiele RPE (regel vuurt terecht niet), en het exacte grensgeval
(31 sessies, net boven de `>30`-conditie). `npx next build` —
compileert zonder fouten.

**Daadwerkelijk aangesloten — v2.4.253.** Gebouwd na "toch merk ik dat
er veel foutjes gevonden worden, kunnen we alles nog eens checken" —
de systematische sweep (v2.4.251) legde bloot dat deze Engine, ondanks
volledig gebouwd en getest, door niets werd aangeroepen.

**`src/lib/specialists/learning-context.ts`** — verzamelt de échte
`LearningContext` uit al-bestaande tabellen, geen nieuwe databron:
- `aantalSessies`: telling uit `activity_sessions`
- `recoveryTrendVsBaseline`: vergelijkt `daily_status.recovery_score`
  op de dag ná een sessie van deze sport, tegen het algehele
  gemiddelde — eerlijk benoemd als een simpele, uitlegbare proxy, geen
  gecontroleerde vergelijking
- `rpeStabiel`: vergt minimaal 5 metingen (`training_results.
  perceived_effort`) — Concept2-sessies hebben zelden een RPE (komen
  automatisch binnen, niet via de "voltooi training"-flow), bij
  onvoldoende data conservatief `false` (claimt geen stabiliteit
  zonder bewijs)

**`src/lib/specialists/learning-rules-koppeling.ts`** —
`evalueerEnBewaarLeerpatronenIndienNodig()`, aangeroepen na elke
Concept2-sync (Rowing, één keer ná de hele lus, niet per sessie) en
Strava-import (Running/Cycling). Nieuwe SQL-tabel `learned_patterns`
(uniek per gebruiker+sport+regel — een al-ontdekt patroon wordt niet
telkens opnieuw als "nieuw" opgeslagen).

**Zichtbaar gemaakt** — `/athlete-platform` toont nu een "🧠 Geleerde
patronen"-kaart, matcht de "eerst zichtbaar maken"-aanpak die ook bij
kruis-sport-aanpassingen werkte.

**Scope, eerlijk begrensd:** deze levering evalueert en **toont**
gevuurde regels. Wat 'ie NIET doet: het gevonden patroon automatisch
laten meewegen in toekomstige Impact Engine-berekeningen (zou
`combineerWaarde()` moeten uitbreiden) — een bewust aparte, latere
stap, niet overhaast meegenomen.

**Gevalideerd:** RPE-stabiliteit getest (te weinig data → conservatief
`false`, stabiele reeks → `true`, instabiele reeks → `false`).
Volledige keten getest met een realistische context (35 sessies,
positieve trend, stabiele RPE) — regel vuurt correct met het juiste
effect; onder de drempel (10 sessies) → terecht `population_model`,
geen enkele regel geëvalueerd. `npx next build` — compileert zonder
fouten (na het fixen van een verkeerd importpad, gevonden tijdens
deze validatie).

**Daadwerkelijk toegepast — v2.4.256.** De bewust opengelaten stap uit
v2.4.253 nu afgemaakt: een geleerd patroon wordt niet meer alleen
getoond, maar past ook echt de opgeslagen state aan.

**`src/core/athlete-platform/learned-adjustments.ts`** —
`pasGeleerdeAanpassingenToe()`: past de ruwe waarde aan met het
geleerde percentage (bijv. het visie-effect zelf: +4% op
`herstel_capaciteit`), herberekent het bijbehorende kwalitatieve
niveau, geklemd tussen 0-100. **Confidence blijft bewust ongewijzigd**
— een geleerde correctie zegt iets over de verwachte waarde, niet over
hoeveel data er is; dat blijft een eigen, aparte berekening
(`aantal_observaties`). Aangeroepen ná `pasImpactToe()`, vóór het
opslaan — in beide sync-routes (Concept2 voor Rowing, Strava-processor
voor Running/Cycling), met een prestatie-bewuste optimalisatie
(geleerde patronen één keer per sync-batch opgehaald, niet per
sessie).

**Gevalideerd — 5 scenario's:**
- Exact het visie-effect (+4%) op een echte, door de Impact Engine
  berekende waarde — komt precies uit
- Confidence blijft aantoonbaar ongewijzigd door de aanpassing
- Immutability bevestigd (origineel blijft ongewijzigd)
- Plafond-check: 98 + 20% zou 117,6 zijn, wordt correct geklemd op 100
- Onbekend pad: netjes overgeslagen met een foutmelding, geen crash

`npx next build` — compileert zonder fouten.

**Knowledge Platform, eerste onderdeel — v2.4.237: Trainingszones.**
`src/core/knowledge-platform/trainingszones.ts` — het standaard
5-zone-trainingsmodel (%HFmax-gebaseerd, RPE-equivalent, doel per
zone), **direct gekoppeld aan een echte consument**: `workout-builder/
builder.ts` haalt instructies nu op uit deze kennisbron i.p.v. ze
hardcoded te herhalen — één bron van waarheid, met expliciete
sportwetenschappelijke herkomst i.p.v. verzonnen tekst zonder
onderbouwing. **Bewust NIET toegepast op warmup/cooldown** — die zijn
conceptueel iets anders dan "zone volhouden" (opbouwend/afbouwend,
geen sustained effort), ook al is het target-zonenummer hetzelfde.
**Eerlijke beperking:** dit is het algemeen aanvaarde, generieke
model — geen gepersonaliseerde zones (vergt een eigen FTP/HFmax-
meting, bewust nog niet gebouwd).

**Gevalideerd — regressietest:** alle 5 trainingType-scenario's
(interval/herstel/tempo/endurance/sprint) geven **exact dezelfde
instructietekst** als vóór de refactor — de centralisatie heeft geen
enkele gedragswijziging veroorzaakt, alleen de bron is nu
gecentraliseerd. `npx next build` — compileert zonder fouten.

**Universal Athlete Platform écht werkend — v2.4.238.** Eerste keer
dat het platform daadwerkelijk data verwerkt, niet alleen pure
functies zonder aanroeper.

- **`supabase/universal_athlete_state.sql`** — opslag, één JSONB-rij
  per gebruiker (RLS aan)
- **`core/athlete-platform/storage.ts`** — `haalAthleteState()`/
  `slaAthleteStateOp()`, met `legeAthleteState()` als fallback voor
  nieuwe gebruikers (elk veld LOW-confidence, "nog geen data")
- **`src/lib/specialists/rowing-impact-adapter.ts`** —
  `vertaalRowingSessieNaarImpact()`, EXACT de verhoudingen uit het
  oorspronkelijke visie-voorbeeld overgenomen (niet zelf verzonnen),
  duur-geschaald met een plafond op 150% (voorkomt dat een extreem
  lange sessie de staat onrealistisch laat pieken). Confidence bewust
  op MEDIUM (geen gevalideerde formule, eerlijk zo benoemd in
  commentaar)
- **Koppeling in `concept2/sync/route.ts`** — na elke nieuw
  geïmporteerde sessie wordt de Universal Athlete State bijgewerkt.
  **Bewust in een try/catch** — een fout in deze nieuwe, experimentele
  laag mag de sync zelf (de kernfunctionaliteit) nooit laten falen

**Gevalideerd — 4 scenario's:** bij exact 90 minuten matchen **alle**
waarden precies de originele visie-cijfers (Cardio 65/Core 80/Upper
Body 75/Legs 45/Impact 5/Fatigue 60), de 60-min-referentiewaarde klopt
(43), het 150%-plafond werkt (180 min geeft identieke output aan 90
min), en de volledige keten (adapter → Impact Engine → opslagformaat)
sluit naadloos aan. `npx next build` — compileert zonder fouten.

**Eerste UI-koppeling — v2.4.239.** `/athlete-platform` (link vanaf
`/coach/rowing`) — toont de Universal Athlete State voor het eerst
daadwerkelijk aan de gebruiker, exact het format uit het
ontwerpoverleg zelf: kwalitatieve balk + label + confidence-percentage,
**nooit een los getal**. Alle 8 categorieën, elk veld met een Nederlands
label. `api/athlete-platform/state` — dunne route, hergebruikt
`haalAthleteState()` rechtstreeks; geeft de volledige waarde inclusief
`ruweWaarde` terug, met expliciete afspraak in commentaar dat de
UI-laag verantwoordelijk is om dat veld nooit te tonen (niet de route
zelf — bewuste scheiding van verantwoordelijkheid).

**FIX — v2.4.240: terugknoppen gingen altijd naar Home i.p.v. één stap
terug.** Gemeld: op zowel `/performance` als `/athlete-platform` was de
terugknop hardcoded naar `/home` — vervelend als je er bijv. vanuit
Rowing Coach naartoe navigeerde. Beide pagina's gebruiken nu
`router.back()` (browser-navigatiehistorie) i.p.v. een vaste
bestemming — gaat altijd één stap terug naar waar je vandaan kwam.
Ongebruikte `Link`-import opgeschoond in `athlete-platform/page.tsx`
(niet meer nodig na deze wijziging).

**Kern van de visie zelf werkend gemaakt — v2.4.241.** Exact het
centrale cross-sport-voorbeeld uit de Master Vision: "90 min roeien →
morgen Running leest niet 'gisteren geroeid', maar leest de Universal
Athlete State (Cardio hoog/Core vermoeid) en kiest een rustige
duurloop." Dit is nu een echte, geteste keten, geen theorie meer.

**`core/athlete-platform/cross-sport-bridge.ts`** —
`bepaalKruisSportSignaal()`: leest de Universal Athlete State, bepaalt
of "lichaam al belast" van toepassing is (cardiovasculaire belasting +
core/bovenlichaam-vermoeidheid). Puur signaal-aflevering — de functie
beslist zelf niets, de aanroeper bepaalt wat ermee gebeurt (Observer-
grens, zelfde principe als de rest van het platform).

**Workout Platform's Adaptation Engine gegeneraliseerd, geen nieuwe
logica verzonnen:** `pasSlechteSlaapToe()` was hardcoded op de tekst
"slecht geslapen" — omgedoopt naar `pasDownscaleToe(workout,
redenLabel)`, met een nieuw `lichaamAlBelast`-signaal naast het
bestaande `slechteSlaap`. Zelfde, al-geteste downscale-mechaniek
(korter/minder herhalingen/lager), nu met een kloppende, specifieke
reden-tekst per trigger i.p.v. altijd "slecht geslapen" te zeggen ook
als de ware oorzaak een andere sport was.

**Gevalideerd — volledige end-to-end-keten:** 90 min roeien →
Universal Athlete State → kruis-sport-signaal ("cardio al belast, core
vermoeid, bovenlichaam vermoeid") → Running-workout gaat van 5 naar 4
herhalingen, zone 4 naar zone 3, met een kloppende toelichting.
Regressietests: lege staat geeft terecht geen signaal (geen data, geen
belasting aangenomen), en `slechteSlaap` blijft exact hetzelfde
werken als vóór de generalisatie. Immutability bevestigd. `npx next
build` — compileert zonder fouten.

**Running gelijkwaardig aan Rowing — v2.4.242.** Bewuste
architectuurkeuze uit het overleg: eerst Running gelijkwaardig maken
op Workout Platform-niveau, vóórdat het kruis-sport-voorbeeld "echte
waarde" heeft ("Dan bewijs je alleen: CoachOS kan binnen één sport
aanpassen. Terwijl de echte visie is: CoachOS begrijpt de complete
atleet, ongeacht de sport").

`api/specialists/running/training-plan/workout` — mirror van Rowing's
route, met twee verschillen:
1. **Echte pace i.p.v. een generiek zone-label** — Running had al een
   gevalideerde persoonlijke baseline (VDOT, Daniels/Gilbert-model,
   `running-zones.ts`, geverifieerd tegen een onafhankelijke bron)
   die Rowing nog mist. `src/lib/specialists/running-workout-adapter.ts`
   vertaalt zone-targets naar concrete pace-bereiken (bijv. "4:16/km -
   4:26/km"). Geen VDOT bekend → eerlijk niets teruggeven, geen gegokte
   pace
2. **Het kruis-sport-signaal wordt hier voor het eerst ECHT
   toegepast** — na het bouwen van de workout wordt de Universal
   Athlete State gecheckt; als een andere sport (bijv. Rowing) het
   lichaam al belast heeft, wordt de Running-workout automatisch
   afgezwakt via de al-bestaande Adaptation Engine. In een try/catch —
   een fout hier mag het bouwen van de workout zelf nooit laten falen

**Gevalideerd:**
- VDOT-berekening getest tegen het eigen, geverifieerde worked
  example uit `running-zones.ts`'s documentatie (5K in 20:00 → VDOT
  49,8) — exacte match
- Pace-vertaling geeft concrete, realistische bereiken; geen VDOT
  bekend geeft terecht een lege vertaling
- **Volledige cross-sport-keten** exact zoals de route 'm uitvoert:
  90 min roeien → Universal Athlete State → kruis-sport-signaal →
  Running-workout gaat van 5 naar 4 herhalingen, met kloppende
  toelichting

`npx next build` — compileert zonder fouten, nieuwe route bevestigd
in de build-output.

**Wederzijdse koppeling — v2.4.243.** Tot nu toe voedde alleen Rowing
(via Concept2) de Universal Impact Engine — het cross-sport-principe
werkte dus maar één kant op. Nu ook Running.

**`src/lib/specialists/running-impact-adapter.ts`** —
`vertaalRunningSessieNaarImpact()`. **Eerlijk, anders dan Rowing's
adapter:** voor Rowing kon de Master Vision letterlijk geciteerd
worden (exacte cijfers stonden al in het document); voor Running
bestaat zo'n vastgelegd voorbeeld niet — dit zijn eigen, redelijke
inschattingen op basis van bekende looptrainingsfysiologie (hoge
cardio/beenbelasting, lage bovenlichaam/core-belasting vergeleken met
roeien, hogere mechanische impact door grondcontact), expliciet GEEN
citaat. Confidence-score bewust iets lager gezet dan Rowing's (55 t.o.v.
60) om dit verschil te weerspiegelen.

**Generieke dispatch-tabel in `strava-activity-processor.ts`** —
`IMPACT_ADAPTERS: Record<string, ...>` i.p.v. sportlogica in de
processor zelf; nieuwe sporten toevoegen betekent alleen een regel
toevoegen aan de tabel. In een try/catch — een fout hier mag de
Strava-import zelf nooit laten falen.

**Bug gevonden en gefixt tijdens het testen van de nieuwe richting:**
`bepaalKruisSportSignaal()` checkte **geen beenvermoeidheid** — ondanks
dat het eigen commentaar dit al noemde ("core/bovenlichaam/benen").
Omdat Running's belasting primair in de benen zit, zou het signaal
voor Running-sessies zo goed als nooit zijn afgegaan. Gefixt: benen
nu ook gecheckt.

**Gevalideerd:**
- Vóór de fix: 60 min hardlopen gaf `null` als signaal ondanks hoge
  beenvermoeidheid — bevestigt de bug bestond
- Ná de fix: zelfde scenario geeft correct een signaal, Rowing-workout
  wordt terecht afgezwakt (5→4 herhalingen)
- **Regressietest**: de al-werkende Rowing→Running-richting blijft
  exact hetzelfde functioneren na deze wijziging

`npx next build` — compileert zonder fouten.

**Cycling als derde gelijkwaardige sport — v2.4.244.** Zelfde patroon
als Running (v2.4.242). `src/lib/specialists/cycling-workout-adapter.ts`
— Cycling had al een gevalideerde FTP-gebaseerde vermogenszone-
berekening (Coggan 7-zone-model, `cycling-zones.ts`) — net als
Running's VDOT, een échte persoonlijke baseline. Vertaalt naar
concrete vermogenswaarden (bijv. "228W - 263W" bij FTP 250W). Geen
FTP bekend → eerlijk niets teruggeven.

`api/specialists/cycling/training-plan/workout` — mirror van Rowing/
Running's route, inclusief het kruis-sport-signaal.

**`src/lib/specialists/cycling-impact-adapter.ts`** — Cycling voedt nu
ook ZELF de Universal Impact Engine (via de generieke dispatch-tabel
in `strava-activity-processor.ts`, `Fietsen` toegevoegd naast
`Hardlopen`) — niet alleen ontvangen, ook leveren. Daarmee is de
driehoek Rowing↔Running↔Cycling voor het eerst volledig wederzijds.

**Kalibratie-observatie, geen bug:** bij 60 minuten (de referentiewaarde)
triggert Cycling's eigen kruis-sport-signaal nog niet (blijft net onder
de 'hoog'-drempel) — pas bij ~90 minuten (het schaal-plafond) wordt
'hoog'/'zeer_hoog' bereikt. Fysiologisch redelijk (een gemiddelde
uurtje fietsen is minder belastend dan 90 min roeien/hardlopen), maar
wel merkbaar milder gekalibreerd dan Rowing/Running's adapters —
bewust zo gelaten, geen kunstmatige gelijktrekking.

**Gevalideerd:** vermogenszone-vertaling getest (correcte Coggan-
percentages: zone 2 = 56-75% van FTP, zone 4 = 91-105%), geen-FTP-
scenario geeft terecht een lege vertaling, volledige Cycling→Rowing-
keten getest (bevestigt bij 90 min wél een correct signaal + afgezwakte
workout). `npx next build` — compileert zonder fouten, nieuwe route
bevestigd in de build-output.

**FIX — v2.4.245: confidence kon nooit groeien, plus een terugvul-
functie.** Gemeld tijdens het testen van een terugvul-idee voor
bestaande sessies: na 56 gesimuleerde sessies bleef confidence op LOW
staan — in tegenspraak met de UI-tekst "hoe meer sessies, hoe hoger de
confidence". **Root cause:** de oorspronkelijke logica nam altijd de
láágste confidence van bestaand/nieuw — dat kan per definitie nooit
boven het startpunt uitkomen, hoeveel sessies er ook bijkomen.

**Fix:** `UniverseleWaarde` kreeg een nieuw veld `aantal_observaties`
(types.ts). `impact-engine.ts`'s `combineerWaarde()` laat confidence nu
daadwerkelijk groeien met het aantal observaties, met de bijdrage's
EIGEN confidence_score als eerlijk plafond — een reeks MEDIUM-
kwaliteit-observaties (alle huidige impact-adapters) kan nooit tot
HIGH oplopen, ongeacht het aantal sessies. Dat plafond weerspiegelt de
kwaliteit van de individuele meting, niet het volume.

**Nieuw: `api/specialists/rowing/athlete-platform-backfill`** —
eenmalige, door de gebruiker getriggerde actie (knop op `/athlete-
platform`) die bestaande Concept2-sessies (van vóór de Impact Engine-
koppeling, v2.4.238) alsnog chronologisch verwerkt, zodat de staat
evolueert zoals 'ie zou hebben gedaan als de koppeling er vanaf het
begin was geweest.

**Gevalideerd:** confidence-groei getest over 56 sessies — LOW (22%)
na 1 sessie → MEDIUM (50%) na 5 → bereikt en blijft op het eerlijke
plafond van 60% (Rowing's eigen MEDIUM-claim) vanaf sessie 10,
gaat nooit erover heen. Regressietest: het eerste-sessie-scenario
(geen bestaande staat) blijft correct werken. `npx next build` —
compileert zonder fouten.

**FIX — v2.4.246: minimale-sessieduur-drempel tegen ruis.** Gemeld met
echte data (SQL-query op eigen verzoek): een sessie van **1 minuut**
in de Concept2-historie (vermoedelijk een test/kalibratie, geen echte
training) trok het gemiddelde onterecht mee. `impact-engine.ts` kreeg
een gedeelde `MINIMUM_SESSIE_DUUR_MINUTEN = 3`-constante — één bron
van waarheid, toegepast op alle drie de plekken die sessies naar de
Impact Engine sturen: Concept2-sync, Strava-import (Running/Cycling),
en de terugvul-functie.

**Gevalideerd met de daadwerkelijke, gerapporteerde sessiedata:**
filter slaat correct exact 1 sessie over (de 1-minuut-uitschieter).
Opvallende, eerlijke bevinding: het "Zeer laag"-resultaat verandert
nauwelijks na filtering — de overige recente sessies (16-25 min) zijn
zelf ook al aan de korte kant, dus het eerdere resultaat was al
grotendeels correct; deze fix verwijdert specifiek de échte ruis,
niet een onderliggend probleem. `npx next build` — compileert zonder
fouten.

**Kruis-sport-adaptaties zichtbaar gemaakt — v2.4.247.** Bewuste
architectuurkeuze uit het overleg: eerst transparantie tonen ("dit
werkt écht"), vóórdat de Coach het proactief gaat uitleggen
(Intelligence Platform, latere stap). Advies letterlijk overgenomen:
"Bouw eerst route 1 [...] Dat levert direct veel meer vertrouwen op."

**Nieuw: bronsport-tracking door de hele keten.** `ImpactBijdrage`
kreeg een verplicht `bronSport`-veld (alle drie de impact-adapters
bijgewerkt), `UniverseleWaarde` onthoudt nu `laatste_bron_sport`,
`bepaalKruisSportSignaal()` bepaalt de meest voorkomende bronsport
onder de belaste dimensies (meerderheids-telling, geen gok), en
`UniversalWorkout` kreeg een nieuw, gestructureerd `kruisSportBron`-
veld — de UI hoeft dus geen tekst te parsen om het juiste sport-
icoon te tonen.

**UI**: `/coach/rowing/trainingsplan` toont nu een "Workout aangepast"-
kaart (🚣/🏃/🚴 + "beïnvloed door [sport]" + de concrete aanpassingen)
zodra een workout door een andere sport is afgezwakt. Ook Rowing's
eigen route kreeg de kruis-sport-check erbij (ontbrak eerder — alleen
Running/Cycling hadden 'm) voor consistentie in de driehoek.

**Gevalideerd:** volledige end-to-end-test — 90 min roeien →
`laatste_bron_sport: 'rowing'` op de belaste dimensies → kruis-sport-
signaal met `bronSport: 'rowing'` → `workout.kruisSportBron: 'rowing'`
op de uiteindelijke Running-workout. Elke schakel in de keten
bevestigd. `npx next build` — compileert zonder fouten.

**KRITIEKE FIX — v2.4.248: rolling horizon-verlenging bestond
helemaal niet.** Gemeld: "training schema" ontbrak weer bij Smart
Actions/Home. Grondig uitgezocht met echte SQL-queries (op eigen
verzoek, geen live databasetoegang): drie actieve plannen (Cycling/
Running/Rowing), maar **"no rows returned"** voor vandaag (3 augustus,
maandag — wél een Running-trainingsdag). Root cause: `training-plan-
engine/core.ts` genereert bij het aanmaken van een plan bewust maar
~2 weken concrete sessies (`ROLLING_HORIZON_WEKEN`), met de bedoeling
dat dit venster later "doorschuift". **Dat doorschuif-mechanisme
bestond echter nergens in de code** — het woord "rolling" stond alleen
in commentaar. Running's laatste sessie was 1 augustus, Cycling's 30
juli — beide plannen liepen letterlijk leeg, ondanks een `end_date`
tot oktober. Dit is een **structurele leemte die alle drie de sporten
raakt**, niet iets van vandaag kapotgemaakt.

**Fix:** nieuwe `verlengRollingHorizonIndienNodigCore()` in `core.ts`
— reconstrueert dezelfde, deterministische mesocyclus-reeks uit de
al-opgeslagen `plan.start_date`/`end_date` (bewust NIET opnieuw uit
doelen afgeleid — dat zou bij een gewijzigd doel een andere reeks
kunnen geven dan oorspronkelijk gegenereerd), bepaalt het week-offset
van de laatste bestaande sessie, en genereert het eerstvolgende blok
zodra er nog maar 7 dagen aan sessies over zijn. Aangeroepen in alle
drie de trainingsplan-GET-routes (Cycling/Running/Rowing), vóór de
Daily Adjustment Layer, in een try/catch (een fout hier mag het
ophalen van het plan zelf nooit laten falen).

**Gevalideerd met de exacte, gerapporteerde data:** weekTotaal
correct gereconstrueerd (12 weken), week-offset van de laatste sessie
correct bepaald (week 1), en de eerste nieuw te genereren maandag valt
**exact op vandaag (3 augustus)** — precies de ontbrekende dag.

**FIX — v2.4.249: verlenging was per-sport handmatig, nu automatisch
voor alle drie tegelijk.** Na v2.4.248 bleek de fix in de praktijk
onvolledig: `verlengRollingHorizonIndienNodigCore()` werd alleen
aangeroepen vanuit elke sport se EIGEN trainingsplan-GET-route — je
moest dus letterlijk de Running-pagina bezoeken om Running's venster
te verlengen, de Cycling-pagina voor Cycling, etc. Bevestigd met een
echt scenario: gebruiker bezocht alleen Rowing's pagina, waardoor
Running leeg bleef ondanks dat maandag een geldige Running-
trainingsdag is — pas na het expliciet openen van Running's pagina
verscheen de sessie.

**Fix:** de verlengingsaanroep is verplaatst naar `today-engine.ts`'s
`bepaalTodayPlan()` zelf — draait nu automatisch voor **alle actieve
plannen tegelijk** (query op `training_plans` waar `status='active'`),
bij elke Today Engine-aanroep, dus ook simpelweg bij het openen van
Home. Geen specifieke pagina-bezoeken meer nodig. Per sport in een
eigen try/catch — één mislukte verlenging blokkeert nooit de andere
twee, en nooit de rest van Today Engine. De losse aanroepen in de
sport-specifieke routes (v2.4.248) blijven ook staan — de functie is
idempotent (doet niets als er al genoeg sessies zijn), dus dubbel
aanroepen is onschadelijk, eerder extra robuust.

**Tiebreak bij meerdere sporten dezelfde dag** (bijv. Rowing én
Cycling beide een sessie voor vandaag): de al-bestaande Decision
Engine kiest op basis van doel-importance → urgentie → naaste
deadline. Zonder doeldata: de eerste in een vaste volgorde (cycling →
running → rowing), nooit willekeurig.

`npx next build` — compileert zonder fouten.

**Coach Intelligence — Stap 2 van het kruis-sport-plan — v2.4.250.**
Volgens de zelf voorgestelde volgorde: eerst zichtbaar maken in de
trainingsplan-detail (v2.4.247), nu de Coach het proactief laten
uitleggen op Home, exact het voorbeeld uit het overleg zelf: "Je zware
roeitraining van gisteren heeft veel belasting gegeven, daarom is de
training vandaag iets lichter."

**Bijvangst — nóg een instantie van hetzelfde, al meermaals gevonden
bug-patroon:** `api/coach/route.ts`'s bronlabel-ternary miste
`'rowing'` — een Rowing-sessie zou in de Coach-AI-prompt als **"Rust"**
zijn aangemerkt (viel door alle voorwaarden heen naar de laatste
else-tak). Gefixt, getest tegen alle vier de mogelijke bronnen.

**`TodayPlan` kreeg een nieuw `sessieId`-veld** (today-engine.ts) —
nodig om de Coach-route de concrete workout (met `kruisSportBron`) te
kunnen laten ophalen. Alle vier de plekken die een `TodayPlan`
samenstellen bijgewerkt (TypeScript zou een ontbrekend veld sowieso
hebben geblokkeerd — bevestigd doordat de build zonder fouten
compileerde).

**`api/coach/route.ts`** haalt nu, als er een kruis-sport-aanpassing is,
de concrete workout op en geeft die context aan de AI-prompt mee —
expliciete instructie om dit proactief te noemen, met de daadwerkelijke
aanpassingen erbij. Eigen try/catch, mag het advies zelf nooit
blokkeren.

**Systematische controle op het "rowing vergeten"-patroon — v2.4.251.**
Gevraagd na meermaals dezelfde soort bug: de HELE codebase doorzocht
op elke plek die `'cycling'` én `'running'` als quoted string bevat,
gecontroleerd of `'rowing'` daar ook bij staat. 15 bestanden gevonden
met beide, 3 daarvan bleken écht een gat te hebben:

1. **`api/action-plan/route.ts`** — exact dezelfde bronlabel-ternary-
   bug als net gefixt in `coach/route.ts` — een Rowing-sessie zou als
   "Rust" in de Trainer AI-prompt terechtkomen. Gefixt
2. **`api/specialists/[type]/data/route.ts`** — generieke fallback-
   route mist Rowing in de fetcher-tabel. Laag risico in de praktijk
   (mijn eigen specifieke `rowing/data`-route heeft altijd voorrang
   bij Next.js-routing), maar voor consistentie toch gefixt
3. **`app/goals/page.tsx`** — Rowing stond nog hardcoded op
   `beschikbaar: false` in de doeltype-lijst, een aanname van vóór
   Rowing's activatie (v2.4.216) die nooit is bijgewerkt. Gebruikers
   konden dus geen Rowing-specifieke doelen instellen. Gefixt

**Eén groter, apart gat gevonden en bewust NIET in deze sweep
opgelost** (te groot voor een quick-fix, zie het "Openstaande
Punten"-overzicht bovenaan dit document): `core/performance/engines/
load-engine.ts`'s CTL/ATL/TSB-berekening (het Performance-scherm) is
een wrapper rond alleen Cycling+Running — Rowing-training telt daar
structureel niet mee. Vergt een TSS-berekening voor Rowing, wat op
zijn beurt een intensiteits-baseline vergt.

`npx next build` — compileert zonder fouten na alle fixes.




**Fase 1, stap 1 (fundamentele typedefinities) afgerond — v2.4.224.**
`src/core/workout-builder/types.ts` — `UniversalWorkout`/`WorkoutBlock`/
`WorkoutTarget` en bijbehorende types. Puur datamodel, nog geen logica
(Builder/Validation/Adaptation-Engines volgen als aparte, latere
stappen).

**Fase 1, stap 2 (Workout Builder — de assemblagelogica) afgerond —
v2.4.225.** `src/core/workout-builder/builder.ts` — `bouwWorkout()`,
bewust met een KLEINE, concrete input-set (sport/trainingType/duur/
mesocyclus/niveau) — niet meteen alle 18 inputs uit de visie (Coach
Policy/Weer/Terrein/etc.) tegelijk aangesloten, die volgen als latere,
losse integratiestappen. 100% deterministisch, geen AI-aanroep.
Verdeelt de gevraagde duur in warmup (10%, 5-15 min)/hoofdblok(ken)/
cooldown (5%, 3-10 min); intervallen krijgen een aantal-herhalingen
afhankelijk van mesocyclus + niveau. **Randgeval gevonden én gefixt
tijdens het testen:** bij een extreem korte sessie (<8 min) konden de
vaste ondergrenzen van warmup+cooldown samen de gevraagde totale duur
overschrijden — nu worden ze evenredig verkleind zodat de totale duur
altijd exact klopt, ook bij zulke randgevallen. Normale sessies (bijv.
60 min) blijven volledig ongewijzigd door deze fix.

**Fase 1, stap 3 (Validation Engine) afgerond — v2.4.226.**
`src/core/workout-builder/validation.ts` — `valideerWorkout()`:
controleert of warmup/cooldown/hoofdblokken bestaan, of elk blok een
geldige duur/herhalingsaantal heeft, en (optioneel, via `ValidationContext`)
of de workout past binnen de beschikbare tijd en de huidige
CoachPolicy-intensiteitsgrens ("veilige belasting" — blokkeert bijv.
een interval-sessie op een dag met `maxIntensiteit: 'low'`).
`berekenWerkelijkeTotaleDuur()` rekent correct met `repeat`/
`rust_na_repeat_sec` (een interval-blok van 540s met 5 herhalingen
duurt in werkelijkheid geen 540s maar 3060s inclusief rust). **Bewust
klein gehouden:** context is nu alleen `beschikbareTijd_sec`/
`maxIntensiteit` — geen volledige Recovery/Fatigue/Coach Agenda-
koppeling, die volgt zodra er een concrete aanroeper is die deze data
al heeft. Integratietest bevestigt: Builder + Validation Engine werken
samen correct (een gebouwde 60-minuten-workout klopt exact op 3600s,
en wordt terecht geblokkeerd bij een lage-intensiteit-CoachPolicy-dag).

**Fase 1, stap 4 (Adaptation Engine) afgerond — v2.4.227.**
`src/core/workout-builder/adaptation.ts` — `pasWorkoutAan()`, bewust
EXACT de twee voorbeelden uit de Master Vision, niet meer: (1)
**slechte slaap** → kortere warming-up (-30%, ondergrens 3 min) →
minder intervallen (-1 herhaling, ondergrens 2) → lagere intensiteit
(-1 zone); (2) **extra beschikbare tijd** → hoofdblok verlengd (50%
van de extra tijd) → cooling-down verlengd (30%) → mobiliteitsblok
toegevoegd (resterende ~20%, alleen als er nog geen mobility-blok is).
Ook het omgekeerde afgehandeld: minder tijd dan gepland verkort het
hoofdblok proportioneel (ondergrens 5 min). Elke wijziging wordt
vastgelegd in `workout.adaptations` (transparantie, zelfde principe
als de Training Plan Engine's REASON_CODE_UITLEG). **Immutability
gegarandeerd** — het originele workout-object wordt nooit gemuteerd,
bevestigd in de integratietest. Volledige keten getest (Builder →
Adaptation → Validation): beide scenario's geven exact de verwachte
aanpassingen, en de aangepaste workout blijft geldig volgens de
Validation Engine.

**Fase 1, stap 5 (Equipment/Execution/Alternative Engine) afgerond —
v2.4.228. Daarmee is Fase 1 (Core Platform) volledig compleet.**

- **`equipment.ts`** — `bepaalMateriaal()`: filtert een aangeleverde
  benodigd/optioneel-materiaallijst tegen wat de gebruiker
  daadwerkelijk beschikbaar heeft, geeft ook een `ontbreekt`-lijst
  terug. Geen hardcoded sport-materiaalkennis — de aanroeper levert de
  mapping aan
- **`execution.ts`** — `genereerUitvoeringsHints()`: leesbare volgorde-
  omschrijving + audio-cue-momenten, 100% afgeleid uit de workout-
  structuur zelf (geen AI, geen sportlogica)
- **`alternative.ts`** — `bepaalAlternatieven()`: filtert/matcht een
  aangeleverde lijst mogelijke alternatieven tegen de huidige context
  (materiaal ontbreekt/slecht weer/locatie onbeschikbaar), met
  deduplicatie. Bewust geen eigen kennis over WELKE alternatieven er
  zijn — dat levert de Specialist Adapter aan, matcht de Kernregel
  (geen sportlogica in de Core)

**Gevalideerd:** alle drie los getest — Equipment Engine matcht
correct (materiaal dat ontbreekt komt in de juiste lijst terecht),
Execution Engine geeft een nette, leesbare volgorde inclusief correcte
herhalings-/rust-vermelding, Alternative Engine filtert correct op de
gegeven reden en geeft niets terug als er niets aan de hand is.
`npx next build` — compileert zonder fouten.

**Alternative Engine daadwerkelijk aangesloten — v2.4.254.** Gevonden
in de systematische sweep (v2.4.251): volledig gebouwd, door niets
aangeroepen. Eerste, concrete trigger: ontbrekend materiaal (geen
Concept2 gekoppeld). **Pragmatische keuze:** `workout_id` wijst niet
naar een niet-bestaande "workout-catalogus" (die bestaat niet in
CoachOS), maar wordt gebruikt als sport-sleutel — de mogelijke
alternatieven zijn de ANDERE sporten waar de gebruiker daadwerkelijk
een actief trainingsplan voor heeft (query op `training_plans`), geen
gok naar irrelevante sporten. Zichtbaar op Rowing's Trainingsplan-
pagina, met een directe link naar de alternatieve sport. Slecht-weer/
blessure-triggers (ook onderdeel van de `AlternativeContext`) nog niet
gebouwd — geen weer-/blessuredata op dit moment aan deze route
gekoppeld.

**Gevalideerd:** realistisch scenario (gebruiker heeft Running+Cycling
actief, geen Concept2) geeft correct beide als alternatief; geen
probleem-context geeft terecht niets terug; geen andere actieve
plannen geeft een lege lijst zonder crash. `npx next build` —
compileert zonder fouten.

**Fase 2 (Rowing als referentie-implementatie) — eerste stap afgerond
— v2.4.229.** `api/specialists/rowing/training-plan/workout` — de
eerste plek waar het Core Platform daadwerkelijk sportspecifieke
betekenis krijgt: bouwt een concrete workout voor een gegeven
trainingsplan-sessie (Builder), valideert 'm (Validation Engine),
vertaalt targets naar SPM (nieuwe `src/lib/specialists/rowing-
workout-adapter.ts`).

**Belangrijke inconsistentie gevonden vóór het bouwen, opgelost:** de
Training Plan Engine's rowing-adapter gebruikt `'recovery'` als
sessietype (matcht de al-bestaande `rowing-drills.ts`), maar de
Workout Platform's `WorkoutTrainingType` verwacht `'herstel'`. Zonder
mapping zou een herstel-sessie stil in de verkeerde tak van
`bouwHoofdblokken()` terechtkomen. Opgelost met een expliciete
`TRAININGTYPE_MAP` bij de koppeling zelf — bevestigd met een test die
expliciet aantoont dat `'recovery'` zónder de mapping niet herkend
zou worden.

**Twee fouten gevonden en gefixt tijdens het bouwen zelf (vóór
oplevering):**
1. Aangenomen tabel `user_equipment` bestaat niet — equipment staat
   als boolean-kolommen in `profiles` (bijv. `concept2_available`),
   hergebruikt de al-bestaande structuur uit `api/equipment/route.ts`
2. Ongeteste Supabase-join-syntax (`training_plans!inner(...)`)
   vervangen door twee losse, simpele queries — hetzelfde bewezen
   patroon dat vandaag al vaker succesvol gebruikt is (bijv. bij de
   Concept2-sync)

**Eerlijke beperking, bewust zo gehouden:** alleen SPM (stroke rate)
kan vertaald worden — dat vergt geen persoonlijke baseline. Split en
Power vereisen een 2k-testtijd-referentiepunt ("FTP-equivalent voor
roeien"), dat bewust nog niet gebouwd is (zie Rowing Profiel-
instellingen, ook bewust minimaal). Die targettypen geven nu netjes
niets terug in plaats van een verzonnen waarde.

**Gevalideerd:** type-mapping getest (alle 4 Training Plan Engine-
types matchen correct na mapping, met expliciet bewijs dat het zonder
de fix fout zou gaan), SPM-vertaling getest (zone 2→20-24 SPM, zone
4→28-32 SPM, niet-zone-targets geven bewust niets terug). `npx next
build` — compileert zonder fouten, route bevestigd in de build-output.

**UI voor de concrete workout — v2.4.230.** `/coach/rowing/
trainingsplan` — elke sessie is nu tikbaar, klapt uit naar de
daadwerkelijke, concrete workout (blokken/SPM-targets/uitvoerings-
hints/ontbrekend materiaal) i.p.v. alleen "Interval, 60 min". Eerste
keer dat een gebruiker het Core Platform daadwerkelijk te zien krijgt.

**REGRESSIE-FIX — v2.4.231: Smart Actions/Home miste actieve Rowing-
sessies.** Gemeld: "bij Snelle Acties is training schema weg." Root
cause: `today-engine.ts` (gebruikt door zowel Smart Actions als Home's
hoofdadvies-kaart) kende hardcoded alleen `'cycling' | 'running'` —
`haalSpecialistSessieVanVandaag()` werd nooit met `'rowing'`
aangeroepen, dus een actief Rowing-trainingsplan werd volledig
genegeerd. Code was hier overigens al expliciet op voorbereid
("proposals[] i.p.v. losse if/else, klaar voor meer specialisten
later") — Rowing sluit nu gewoon aan op hetzelfde patroon, bevestigd
dat `kiesTussenProposals()`/de Decision Engine al generiek met een
array werken (geen aanname van precies 2).

**Twee extra instanties van dezelfde vocabulaire-mismatch gevonden en
gefixt** (zelfde bug-klasse als eerder vandaag bij de Training Plan
Engine-koppeling): (1) een hardcoded cycling/running-ternary in de
reden-tekst zou bij Rowing altijd "Running" tonen — nu generiek via
`SPORT_NAAM_LABEL`; (2) de intensiteitsbepaling checkte alleen
`'herstel'`, niet Rowing's `'recovery'` — zou een Rowing-hersteldag
als "matig" i.p.v. "licht" intensiteit gemeld hebben. Ook: rowing-
icoon (🚣) toegevoegd aan zowel Smart Actions als Home's advieskaart
(vielen eerder terug op het generieke 💪/"Trainer AI"-label).

**Coach Memory — v2.4.232.** `api/specialists/rowing/memory` — dunne
wrapper, exact het patroon van Cycling/Running. De onderliggende
Learning Engine (`verwerkKandidaatInzicht()`/`haalMemoryOp()`) bleek
al volledig sport-onafhankelijk (`specialist_type: string`, geen
hardcoded union) — Rowing sluit aan zonder wijziging aan de Engine
zelf. **Nog niet gebouwd:** automatische inzicht-generatie via een
Rowing-coach-conversatieroute (bij Cycling/Running ook nog als
"tijdelijk, handmatig testbaar" gemarkeerd) — apart, later traject.

**Dashboard-verrijking — v2.4.233.** `/coach/rowing` toont nu
week-/maandtrainingsbelasting (sessies/minuten/afstand), puur afgeleid
uit de al-opgehaalde 90-dagen-activiteitendata — geen nieuwe route of
databron. **Bewuste keuze:** Recovery/Readiness/Coach Score NIET hier
herberekend — die zijn platformbreed (niet sport-specifiek), een link
naar het al-bestaande `/performance` voorkomt dubbele logica. Lege-
staat- en "Binnenkort"-teksten bijgewerkt (Concept2-koppeling en
Trainingsplan waren daar nog vermeld als toekomstig, terwijl beide al
weken eerder af waren). Gevalideerd: week-/maandvenster-berekening
getest met een realistische datumspreiding, inclusief correcte
uitsluiting van data buiten het venster.

**Gevalideerd:** 4 scenario's — Rowing-label correct, reden-tekst
noemt correct "Rowing" (niet "Running"), Rowing-recovery-sessie krijgt
correct lichte intensiteit, Cycling/Running-gedrag blijft ongewijzigd.
`npx next build` — compileert zonder fouten.

**Filosofie:** Master Coach bepaalt WAT, Training Plan Engine bepaalt
WANNEER/WAAROM, de **Workout Platform** bepaalt HOE. Bouwt voort op
het bewezen Adapter-patroon van de Training Plan Engine (`core.ts`
sport-agnostisch + per-sport adapters) — één laag dieper doorgetrokken.
Sluit CoachOS' vijf-platformen-architectuur:

```
1. Context Platform      — bepaalt de context van de gebruiker
2. Training Platform     — bepaalt wanneer/waarom een training plaatsvindt
3. Workout Platform      — bouwt de training zelf op (NIEUW)
4. Performance Platform  — analyseert uitgevoerde training + fysieke toestand
5. Intelligence Platform — neemt beslissingen, stuurt de gebruiker aan
```

**Onderdelen van de Workout Platform** (`src/core/workout-builder/`,
plugin-architectuur voor Specialist Adapters — nieuwe sporten toevoegen
zonder de kern aan te passen):

```
CoachOS Workout Platform
│
├── Workout Builder            (bouwt het Universal Workout Object)
├── Workout Object              (sport-onafhankelijk: blocks/targets/metrics/etc.) ✅ v2.4.224
├── Workout Block Engine        (Warm-up/Hoofdblok/Interval/Herstel/Cooldown/...)
├── Target Engine                (HR/Power/Cadence/Pace/SPM/RPE/Zone — geen sportnamen)
├── Adaptation Engine            (slechte slaap → korter/lichter; extra tijd → langer)
├── Validation Engine            (warming-up/cooling-down aanwezig, past binnen tijd/herstel)
├── Alternative Engine           (fietsen→roeien bij slecht weer, etc.)
├── Equipment Engine              (PM5/Concept2/Racefiets/Kettlebell/geen materiaal)
├── Execution Engine              (volgorde/rust/timer/audio cues)
└── Specialist Adapter Framework  (elke sport vertaalt naar zijn eigen taal)
```

**Kernregel, niet-onderhandelbaar (matcht CoachOS' bestaande AI-principe):**
de Builder zelf bevat NOOIT sportlogica (geen FTP/SPM/pace-kennis) — dat
zit uitsluitend in de Specialist Adapter. AI schrijft alleen coachnotes/
motivatie/uitleg, bouwt NOOIT zelfstandig een workout — de opbouw blijft
volledig deterministisch en reproduceerbaar, zelfde filosofie als overal
elders in CoachOS.

**Roadmap — migratie is een KEUZE, geen verplicht eindpunt:**

```
Fase 1 — Core Platform bouwen (Builder/Object/Block/Target/Validation/Adaptation-Engine)
Fase 2 — Rowing als referentie-implementatie (nieuw, geen bestaande code geraakt)
Fase 3 — Evaluatie: levert migratie van Cycling/Running aantoonbaar
          minder code, betere onderhoudbaarheid, meer functionaliteit
          op, bij gelijke of betere performance?
Fase 4 — Gecontroleerde migratie (ALLEEN als Fase 3 "ja" zegt — Cycling/
          Running blijven tot die tijd ongewijzigd functioneren)
Fase 5 — Nieuwe specialisten (Strength/Kettlebell/Swimming/Hyrox/etc.)
          bouwen altijd direct op de Workout Platform
```

**Bewuste correctie tijdens het ontwerp:** de oorspronkelijke visie
plande Cycling/Running-migratie als vaststaand vervolg (Fase 3/4) —
dat raakt bestaande, stabiele productiecode zonder concrete noodzaak.
Aangescherpt: migratie gebeurt uitsluitend na bewezen praktijkwaarde
bij Rowing, per specialist apart beoordeeld — nooit automatisch.

#### Rowing Platform — Master Vision, Fase 1 stap 1-3 afgerond (v2.4.216-223)

**Personal Baseline (2k-testtijd) toegevoegd — v2.4.252.** Gebouwd na
een systematische controle (v2.4.251) die blootlegde dat Rowing
volledig ontbrak in het Performance-scherm (CTL/ATL/TSB). Bewust
uitgesteld toen ("Fase 1, stap 3": trainingsdagen + beschikbare uren,
géén 2k-testtijd — "hoort bij een latere, intensiteits-gerichte
verfijning"), nu die latere stap.

**Architectuurprincipe, letterlijk uit het overleg overgenomen:**
"Geen schijnprecisie. Geen verborgen aannames. Alles moet uitlegbaar
zijn. Een persoonlijke baseline voordat je personaliseert." Exact
hetzelfde principe dat al voor Running gold (VDOT uit een
wedstrijdprestatie) — nu ook voor Rowing (2.000m-testtijd).

**Drie fasen, zoals voorgesteld:**
1. **Population Model** — geen baseline, algemene trainingslogica,
   geen individuele TSS-claim (was de situatie tot v2.4.252)
2. **Personal Baseline** — 2k-testtijd ingevoerd, persoonlijke zones/
   belasting berekenbaar (deze levering)
3. **Continuous Learning** — later, zodra de Learning Rules Engine
   (al gebouwd, v2.4.236, nog niet aangesloten — zie Openstaande
   Punten) de 2k-baseline gaat verfijnen op basis van werkelijke
   trainingen

**Nieuw:**
- **`/settings/rowing-profile`** — 2.000m-testtijd-invoerveld
  (min:sec), optioneel, met uitleg dat zonder deze test alleen het
  Population Model geldt
- **`src/lib/specialists/rowing-grafieken.ts`** — `haalRowingCTLATLTSB()`,
  spiegelbeeld van `running-grafieken.ts` (exact dezelfde EWMA-
  wiskunde, exact dezelfde intensity-factor-in-het-kwadraat-TSS-
  formule — geen nieuwe berekening verzonnen). 2k-tijd → drempel-
  snelheid (m/min), zonder extra fysiologische correctiestap (in
  tegenstelling tot Running's VDOT→%VO2max-omrekening) — 2k-tijd is in
  de roeiwereld zelf al de gangbare, direct bruikbare referentie
  (Concept2/British Rowing-conventie)
- **`load-engine.ts`** — Rowing nu volledig meegeteld in het
  platformbrede CTL/ATL/TSB, `LoadSportDetail['sport']`-type
  uitgebreid van `'cycling' | 'running'` naar inclusief `'rowing'`

**Eerlijk, net als bij Running:** geen 2k-tijd ingevuld = geen
Rowing-bijdrage aan het platformtotaal — geen gegokte drempelsnelheid,
liever eerlijk niets dan schijnprecisie.

**Gevalideerd:** drempelsnelheid-berekening geverifieerd tegen de
eigen definitie (2000m/7.5min = 266,7 m/min, exacte match). TSS-
formule getest tegen het fundamentele controlepunt van de metric zelf
(exact 1 uur op drempelsnelheid = exact 100 TSS, per definitie) — komt
precies uit. Randgevallen (geen snelheid/geen baseline) geven correct
0. `npx next build` — compileert zonder fouten.

**Stap 3 (Training Plan Engine) afgerond — v2.4.223.** Grote,
onverwachte versnelling: de bestaande Training Plan Engine bleek al
een **adapter-patroon** te gebruiken (`core.ts` volledig sport-
agnostisch, Cycling/Running elk een eigen kleine adapter) — Rowing kon
daarom aansluiten met een nieuwe adapter i.p.v. een hele nieuwe engine.

- **`training-plan-engine/rowing-adapter.ts`** — terminologie afgestemd
  op de al-bestaande `rowing-drills.ts` (session_type: recovery/
  endurance/interval/test), geen nieuwe parallelle vocabulaire.
  `haalHuidigeWekelijkseUren()` hergebruikt de al-bestaande
  `haalRowingData()` rechtstreeks — geen aparte analyse-functie
  vooruitgebouwd (die hoort bij een latere stap)
- **Bug gevonden en gefixt in de Core zelf**: één hardcoded cycling/
  running-ternary in de foutmelding (`core.ts`) zou bij Rowing altijd
  "Running Profile" tonen, ook voor een Rowing-gebruiker — nu echt
  generiek, ondanks de Core's eigen documentatie die dit al beloofde
- **`api/specialists/rowing/training-plan`** (GET/POST/PATCH) — exact
  hetzelfde patroon als de Running-route (niet de Cycling-route, die
  gebruikt nog een legacy-wrapper)
- **`api/specialists/rowing/profile`** + **`/settings/rowing-profile`**
  — bewust MINIMAAL (alleen trainingsdagen + beschikbare uren, geen
  2k-testtijd/zones-berekening — dat hoort bij een latere,
  intensiteits-gerichte verfijning)
- **`/coach/rowing/trainingsplan`** — genereren/tonen/pauzeren/hervatten,
  spiegelbeeld van de Cycling-pagina, bewust compacter (geen AI-
  uitleglaag hier nog)

**Gevalideerd:** sessietype-verdeling getest (3 scenario's: normale
opbouw-week, herstelweek met correct geen interval-sessies, 0
trainingsdagen zonder crash). `npx next build` — compileert zonder
fouten, alle 6 nieuwe routes/pagina's bevestigd in de build-output.

**Wat er nu staat:** `rowing` geactiveerd als derde specialist
(`status: 'active'` in `api/specialists/route.ts`, bereikbaar via
Specialisten → tikbaar i.p.v. gedimd in "Binnenkort"). Nieuwe
`src/lib/specialists/rowing-data.ts` (spiegelbeeld van running-data.ts,
leest bestaande `activity_sessions` met naam "Roeien") en
`bepaalRowingLifecycle()` toegevoegd aan de lifecycle-engine — zelfde
patroon als Cycling/Running. `/coach/rowing` toont een **eerlijke lege
staat** (geen Concept2-koppeling nog, geen nepdata) met een korte
"Binnenkort"-lijst.

**Bevestigd werkend in de praktijk** — screenshot toont 2 echte Strava-
sessies (9 en 30 juni). **Fix v2.4.217:** duur toonde "0 min" voor
elke sessie — `duration` staat al in minuten opgeslagen (zie
`strava-activity-processor.ts`: `moving_time / 60` bij import), de
pagina deelde per ongeluk nogmaals door 60. Gefixt, en ter
bevestiging ook de TCX-import gecontroleerd (zelfde conventie,
minuten overal consistent).

**Concept2 OAuth-koppeling afgerond — v2.4.218.** Developer-sleutels
aangevraagd en in Vercel gezet (`CONCEPT2_CLIENT_ID`/
`CONCEPT2_CLIENT_SECRET`). Volledige Authorization Code-flow gebouwd
tegen de exacte, officiële documentatie
(`log.concept2.com/developers/documentation/`):
- **`api/specialists/rowing/concept2/authorize`** — stuurt door naar
  Concept2's inlog-/toestemmingsscherm (`GET /oauth/authorize`,
  scope `results:read` — minst-nodige-rechten, geen schrijftoegang)
- **`api/specialists/rowing/concept2/callback`** — wisselt de
  authorization code om voor een access/refresh-token (`POST /oauth/
  access_token`, form-urlencoded), slaat op in nieuwe tabel
  `concept2_tokens` (RLS aan, alleen de eigen rij zichtbaar)
- **`api/specialists/rowing/concept2/status`** — laat de UI weten of
  er al een koppeling bestaat, **geeft nooit de token zelf terug**
- **`/coach/rowing`** — "Verbind Concept2"-kaart, met terugkoppeling
  na de OAuth-flow (succes/foutmelding)

**Bewuste architectuurkeuze:** user-identiteit in de callback komt via
de sessie-cookie (consistent met elke andere route in CoachOS), niet
via de OAuth `state`-parameter — state zou de user_id blootgeven en
is geen betrouwbaar CSRF-mechanisme zonder een server-side opgeslagen
nonce.

**Gevalideerd:** token-request-structuur getest tegen Concept2's eigen
documentatie-voorbeeld (klopt), `expires_at`-berekening getest met hun
eigen voorbeeldwaarde (604800 sec = exact 7 dagen). `npx next build`
— compileert zonder fouten, alle 3 routes bevestigd in de build-output.

**Data-sync afgerond — v2.4.219.** Bevestigd end-to-end werkend in de
praktijk (screenshot: "Concept2 succesvol gekoppeld!", sessies tonen
correcte duur). **`api/specialists/rowing/concept2/sync`** — haalt
resultaten op (`GET /api/users/me/results?type=rower`, met paginering,
max 20 pagina's), slaat op in `activity_sessions` via exact hetzelfde
patroon als `strava-activity-processor.ts` (idempotency-check via
`notes ilike '%concept2:{id}%'`, activities-koppeling, metrics als
JSON). **Belangrijk eenheidsverschil met Strava, bewust verwerkt:**
Concept2's `time`-veld is in **tienden van een seconde** (600 = 1
minuut), niet seconden zoals Strava's `moving_time` — `/600` i.p.v.
`/60`. Token-vernieuwing ingebouwd (`refresh_token`-grant, 5 minuten
veiligheidsmarge vóór expiry). "Sync nu"-knop op `/coach/rowing`,
herlaadt de sessielijst na afloop.

**Gevalideerd:** tijd-conversie getest tegen Concept2's eigen
documentatie-voorbeeld (600 tienden = 1 minuut, correct) én een
realistisch scenario (25 minuten, correct). Token-geldigheidscheck
getest — 3 scenario's (geldig/verlopen/binnen-veiligheidsmarge),
allemaal correct.

**Workout Matching Service, Fase 1 — v2.4.267.** Vastgesteld tijdens
een architectuurgesprek: `completed_activity_id` (aanwezig sinds
v2.4.96) werd door geen enkele ingest-route ooit gevuld — elke
geplande sessie werd na de datum als `missed_session` behandeld, ook
als de training daadwerkelijk was uitgevoerd. Vastgelegd als platform-
ontwerp, niet als losse Rowing-fix: `docs/workout-completion-platform-
adr-v1.md`. Deze sync-route is nu de eerste die de nieuwe generieke
Workout Matching Service (`training-plan-engine/workout-matcher.ts`)
aanroept — via een Rowing Matcher (`matchers/rowing-matcher.ts`,
datum+duur, confidence-gebaseerd, drempel 0,7). Bij voldoende
confidence: `training_plan_sessions.status → 'completed'`,
`completed_activity_id` gevuld. Bewust in try/catch, zelfde discipline
als de Universal Athlete State-koppeling. In-app testbaar zonder een
nieuwe ErgData-sessie via `/debug/workout-matching` (gelinkt vanaf
`/debug`) — draait dezelfde matchfunctie handmatig tegen een
al-geïmporteerde activiteit, toont confidence/reden direct in de UI.
Running/Cycling/Strength-matchers en de overige ingest-routes (Strava/
Garmin/handmatig) volgen in latere fases — zie Openstaande Punten
bovenaan dit README.

**Bewust NOG NIET gebouwd** (volgende stappen): Training Plan Engine,
Workout Builder, Analyse-engine, Coach Memory, Today Engine-integratie,
automatische/periodieke sync (nu alleen handmatig via "Sync nu").

**Diagnose-fix — v2.4.220: sync gaf "0/0" terwijl er wél data in
Concept2 stond.** Bevestigd met screenshot: 9+ echte sessies zichtbaar
in het Concept2 Logbook, maar de sync meldde "0 nieuwe sessie(s), 0 al
bekend". Root cause nog niet met zekerheid vastgesteld — de vorige
respons **verborg** het verschil tussen "Concept2 gaf niets terug" en
"wel gevonden, maar opslaan mislukte" (beide zagen er als "0/0" uit).
**Fix:** `totaalGevonden` en de eerste opslag-foutmelding gaan nu mee
in de respons/UI-melding, en de ruwe eerste API-respons wordt gelogd
zodra er 0 resultaten binnenkomen. Ook: `Accept: application/
vnd.c2logbook.v1+json`-header toegevoegd (door Concept2's documentatie
aanbevolen, "om potentiële problemen te voorkomen"). Volgende sync-
poging zou nu een concreet, bruikbaar signaal moeten geven i.p.v. een
ambigue "0/0".

**Root cause gevonden — v2.4.221.** De diagnostiek werkte precies
zoals bedoeld: "56 gevonden bij Concept2. Fout bij opslaan: new row
for relation 'activity_sessions' violates check constraint
'activity_sessions_source_check'". Een database-constraint stond
alleen `manual`/`garmin`/`apple_health`/`strava` toe als `source` —
`'concept2'` ontbrak. **SQL-fix** (`supabase/
fix_source_check_concept2.sql`): huidige toegestane waarden bevestigd
via `pg_get_constraintdef` vóór het schrijven van de fix (niets per
ongeluk verwijderd), constraint uitgebreid met `'concept2'`. Geen
codewijziging nodig — de sync-route gebruikte al correct
`source: 'concept2'`, exact matchend met de nieuwe constraint.

**Structurele dedup-fix — v2.4.222.** Na de eerste succesvolle sync
bleek dezelfde training dubbel te verschijnen (9/30 juni: zowel via
Strava als Concept2 — verwacht, want twee losse bronnen). Gevraagd:
structureel voorkomen, niet alleen verbergen. **Prioriteitsvolgorde**
vastgelegd: Concept2 (3, het apparaat zelf) > Garmin (2) > Strava/
Apple Health (1) > handmatig (0).

**Twee-kanten-fix, bewust op BEIDE momenten:**
1. **Concept2-sync** (`concept2/sync/route.ts`) — na een succesvolle
   import, worden bestaande lagere-prioriteit-records voor diezelfde
   dag (Strava/Garmin/handmatig) verwijderd. Vangt "Strava was er
   eerder dan Concept2".
2. **Import-preventie** — `strava-activity-processor.ts`,
   `garmin-activity-tcx/route.ts` en `garmin-activity-vision/route.ts`
   checken nu vóór het opslaan of Concept2 die dag al een sessie heeft;
   zo ja, wordt de import overgeslagen. Vangt "Concept2 was er eerder
   dan Strava/Garmin". **Bewust ALLEEN voor `'Roeien'`** — geen enkele
   invloed op de import van andere sporten.
3. **Extra vangnet op weergaveniveau** (`coach/rowing/page.tsx`,
   `dedupliceerOpDatum()`) — blijft ook staan, voor records die al vóór
   deze fix zijn geïmporteerd.

**Eerlijk benoemde beperking:** dedup werkt per **datum**, niet per
exacte sessie. Twee echte, verschillende trainingen op één dag (bijv.
ochtend + avond) zouden ten onrechte als duplicaat behandeld kunnen
worden. Bewuste, pragmatische keuze — dekt de overgrote meerderheid
van gevallen (één sessie per dag). Een preciezere fix (matchen op
starttijd i.p.v. alleen datum) is aanzienlijk complexer en bewust niet
stilzwijgend meegebouwd.

`npx next build` — compileert zonder fouten. Dedup-logica getest met
exact het gerapporteerde scenario (9/30 juni) — geeft correct 2
records terug, beide bron Concept2.

**Filosofie:** CoachOS krijgt geen "PM5-ondersteuning" — het krijgt een
volledig Rowing Platform. De Rowing Specialist blijft altijd eigenaar
van trainingsplanning, coaching, analyse en progressie; apparaten
(PM5, WaterRower, Technogym, etc.) zijn uitsluitend uitvoerders, nooit
de bron van intelligentie. Communicatie verloopt altijd via een
**Device Adapter Layer** — de specialist praat nooit rechtstreeks met
hardware.

**Kritieke technische beperking, ontdekt tijdens het ontwerp:** Safari
op iOS ondersteunt **geen Web Bluetooth** (bevestigd: "not supported
and no plan to support it in the near future" — geldt voor alle iOS-
versies). Een PWA kan dus niet rechtstreeks live met een PM5 praten
via BLE. Dit betekent niet dat de architectuur fout is — het betekent
dat de Device Adapter per platform verschilt:

```
                 Rowing Specialist
                        │
                 Device Adapter Layer
                        │
        ┌───────────────┼────────────────┐
        │               │                │
     PWA Adapter    Native Adapter   Cloud Adapter
        │               │                │
 ErgData Sync      PM5 via BLE      Concept2 Cloud/API
```

**Fase 1 — CoachOS PWA (het platform van vandaag):**
- Rowing Specialist: volwaardig, net zo groot als Cycling/Running
- Training Plan Engine: volledige periodisering (Base/Build/Peak/
  Recovery/Deload/Race/Testweken), FTP-equivalent voor roeien
- Workout Builder: automatisch trainingen samenstellen (intervallen,
  piramides, etc.)
- Analyse ná de training (niet live): pacing, cadans-stabiliteit,
  techniek- en vermogensontwikkeling
- Synchronisatie via **ErgData of Concept2 Cloud/API** — geen live
  verbinding, wel volledige nasynchronisatie (zelfde patroon als de
  bestaande "Concept2 Roeimachine"-koppeling in Equipment)
- Dashboard/records/progressie — net als Cycling/Running
- **Geen** live BLE naar de PM5, **geen** live coaching tijdens de
  sessie — technisch niet haalbaar binnen een iOS-PWA

**Fase 2 — CoachOS Native (toekomst, apart traject):**
- Rechtstreekse BLE-verbinding met de PM5 (en later andere apparaten)
- Live metrics elke seconde (tijd/afstand/split/stroke rate/power/
  hartslag)
- Live coaching tijdens de sessie ("Stroke rate iets lager", "Nog 3
  intervallen") — rustige, niet-schreeuwerige toon
- Workout-object rechtstreeks naar het apparaat sturen

**Waarom dit toekomstbestendig is:** de Rowing Specialist zelf hoeft
bij een latere native app **niet aangepast** te worden — alleen de
Device Adapter verandert (PWA Adapter → Native Adapter). Dat is exact
het voordeel van deze architectuurkeuze.

**Coach Memory voor Rowing** (net als bij Cycling/Running): favoriete
trainingen, sterke/zwakke punten, technische aandachtspunten,
blessuregevoeligheid, doelwedstrijden, records, voorkeuren.

**Today Engine ontvangt** bij een voltooide sessie alleen een
samenvatting (voltooid/execution score/recovery impact/coach-advies),
nooit ruwe data — zelfde principe als de rest van CoachOS.

**Nog niet in de praktijk bevestigd** (wel gebouwd en getest in code):
ACWR-correctie in de Recovery Score bij een echt hoge belastingsverhouding
— wacht op een natuurlijke gelegenheid, geen bekend probleem.

## Werkinstructies aan Claude — vaste regels deze sessie

Deze regels gelden vanaf nu en altijd, in elke sessie over dit project:

1. **Bestandsverzoeken altijd in een apart copy-blok.** Als Claude een bestand
   nodig heeft, wordt het exacte pad in een losse code-blok gegeven — niet in
   lopende tekst — zodat het direct te kopiëren is.
2. **STOP bij ontbrekende informatie** (Kernregel, zie Start Prompt hieronder)
   — nooit aannemen welk bestand relevant is; zie sectie Troubleshooting voor
   bekende bestand-per-probleemtype lijsten.

---

## Versienummer — één bron van waarheid (vastgelegd juli 2026)

**`package.json` is het enige, leidende versienummer van CoachOS.** Er
bestond lang verwarring doordat drie plekken losstaande nummers toonden
(`package.json` bleef op `1.8.0` steken, `hoe-werkt-het/page.tsx` toonde een
hardcoded `"v1.8.6"`, en README/changelog liepen apart op naar 2.4.x). Dat is
sinds v2.4.14 opgelost:

- **Bij elke wijziging: `package.json`, README en `docs/changelog.md` gaan
  altijd samen omhoog, in dezelfde beweging.** Nooit één van de drie
  vergeten — dat is precies hoe de verwarring ontstond.
- **`src/app/api/version/route.ts`** leest het nummer rechtstreeks uit
  `package.json` en dient als enige runtime-bron voor de app zelf. Andere
  schermen (zoals `hoe-werkt-het/page.tsx`) tonen het versienummer via een
  `fetch('/api/version')`-call — nooit een eigen hardcoded string.
- **Automatische update-detectie:** `src/app/home/page.tsx` vergelijkt bij
  elk bezoek het huidige versienummer met `localStorage`
  (`coachos_laatst_geziene_versie`). Bij een verschil draait een lichte
  gezondheidscheck (kerntabellen + kernroutes, puur lezend) op de
  achtergrond; bij gevonden problemen verschijnt een banner die naar
  `/debug` verwijst voor de volledige diagnose (inclusief de schrijftest
  uit Laag 3, zie sectie hieronder). Dit is de "onderdelen tester die
  waarschuwt als een update de code breekt" die tijdens deze sessie werd
  gevraagd — met de kanttekening dat dit een update **detecteert na
  deploy**, niet **voorkomt vóór** deploy (dat vereist een CI/CD-pipeline,
  die nu niet bestaat).
- **Als je ooit een nieuw versienummer-achtig veld tegenkomt** (een tweede
  `VERSION`-constante, een ander hardcoded getal ergens), behandel dat met
  dezelfde argwaan als de vorige twee dubbele-databron-gevallen deze sessie
  (oefening-databronnen, zie verderop): eerst navragen of het een bewuste
  losse waarde is, niet aannemen dat het hetzelfde hoort te zijn als
  `package.json`.

---

## Gezondheidscheck — Debug Panel (`/debug`)

Sinds v2.4.13 is `/debug` uitgebreid van een kleine diagnostiek naar een
volledige gezondheidscheck, in drie lagen:

| Laag | Wat | Risico | Wanneer |
|------|-----|--------|---------|
| **1 — Tabellen** | Alle 29 tabellen uit het schema, `select id limit 1` | Geen (puur lezend) | Handmatig (`/debug`) én automatisch-licht (Home, subset van 5 tabellen) |
| **2 — Routes** | 17 kern-GET-routes | Geen (puur lezend, geen schrijfroutes aangeroepen) | Handmatig én automatisch-licht (Home, subset van 3 routes) |
| **3 — Schrijftest** | Tijdelijke testrij in `coach_calls`/`coach_call_items`, direct weer opgeruimd | Laag — herkenbaar gemarkeerd (`__SELFTEST__`, datum 1900-01-01), opruiming via `finally`-blok + cleanup van oude testrijen | **Alleen handmatig** via `/debug` — nooit automatisch op de achtergrond |

Laag 3 is bewust beperkt tot `coach_calls`/`coach_call_items` — de twee
tabellen die in juli 2026 daadwerkelijk een probleem gaven (zie Coach Call
Systeem-sectie, v2.4.12). Uitbreiden naar andere tabellen kan, maar vraagt
per tabel eigen zorgvuldige opruim-logica (bijv. foreign-key-afhankelijkheden
checken) — niet in één keer voor alle tabellen doen, dat verhoogt het risico
op precies het soort fout die deze gezondheidscheck juist moet voorkomen.

---

## Illustratie Workflow — WebP vanaf #16

**Besloten (overleg juli 2026, herzien):**

- **Geen Dropbox.** Overwogen als centraal archief, maar afgeschaft — GitHub
  zelf is al een archief (volledige versiegeschiedenis van elk bestand), en
  een extra opslaglaag voegt alleen frictie toe zonder functioneel voordeel
  bij één beheerder die rechtstreeks naar de repo werkt.
- **`public/exercises/` blijft de enige locatie** waaruit de app illustraties
  laadt tijdens runtime. Architectuur ongewijzigd.
- **PNG t/m #15, WebP vanaf #16 (Box Squat).** De eerste 18 kettlebell-
  illustraties (de oorspronkelijke 6 + de 12 die deze sessie zijn gegenereerd
  en al in Working Copy stonden toen WebP werd afgesproken) blijven PNG —
  geen herwerk van reeds voltooide illustraties (Kernregel: geen quick fixes
  die technische schuld verhogen, stabiliteit boven netheid). Alle **nieuwe**
  illustraties vanaf #16 worden WebP.
- Bevestigd zonder enige codewijziging nodig: `src/app/archief/oefening/[id]/page.tsx`
  (de enige plek die illustraties toont, zie sectie "Oefening-databron"
  hieronder) gebruikt een kale `<img src=...>` zonder formaat-afhankelijke
  logica — een `.webp`-bestand werkt daar identiek aan `.png`. iOS Safari
  16.4+ (al vereist, zie §13) ondersteunt WebP volledig.

**Bijgewerkte workflow (vanaf #16):**
```
Claude genereert illustratie-prompt (bestaand sjabloon, ongewijzigd)
    ↓
Genereren via GPT (vaak PNG)
    ↓
Als PNG: Claude converteert naar WebP (PIL/Pillow, quality=90) — vangnet
voor het geval de externe generator geen WebP oplevert, of de bestandsgrootte
boven de 100-300 KB-richtlijn uitkomt
    ↓
Kopiëren naar public/exercises/[naam].webp via Working Copy
    ↓
illustratie-veld koppelen in de betreffende bibliotheek
    ↓
Commit + push → Vercel deploy
```

**Exportvereisten (nieuwe illustraties, vanaf #16):**
- Formaat: WebP (voorkeur), PNG alleen bij noodzakelijke transparantie
- Doelgrootte: ~100-300 KB per illustratie
- Resolutie: 1024×1024px (of hoger), sRGB, geen onnodige metadata
- Scherpe lijnen en professionele uitstraling behouden

---

## Oefening-databron — historie en huidige staat (opgelost v2.4.7)

**Dit is nu de enige waarheid:** de acht bibliotheekbestanden in `src/lib/`
(`kettlebell-exercises.ts`, `bodyweight-exercises.ts`, `strength-exercises.ts`,
`mobility-exercises.ts`, `recovery-exercises.ts`, `running-drills.ts`,
`rowing-drills.ts`, `cycling-drills.ts` — samen 390 oefeningen) zijn de
**enige** bron voor oefeningdata in de hele app. Er bestaat geen alternatieve
of parallelle lijst meer.

**Toegang tot een losse oefening met uitleg/illustratie loopt altijd via:**
```
/archief → /archief/oefening/[id]
```
Bestand: `src/app/archief/oefening/[id]/page.tsx`, functie `vindOefening()`
zoekt op `id` door alle acht bibliotheken heen. Het `illustratie`-veld
(alleen bestandsnaam, bv. `goblet-squat.png` of `sumo-deadlift.webp`) wordt
gecombineerd met `public/exercises/` om het pad te vormen.

**Wat er eerder was en waarom het weg is (context voor toekomstige sessies):**
Tot v2.4.7 bestond er ook `src/lib/exercises.ts` — een kleine, losse lijst
met 5 hardcoded oefeningen en een ander ID-formaat (`two-hand-swing` i.p.v.
`kb-swing`), gerenderd door `src/app/oefening/[id]/page.tsx`. Onderzoek wees
uit dat **niets in de app** naar die route linkte (niet vanuit Archief,
Trainingsbibliotheek, bottom nav, of de Trainer AI-output) — het was dode
code, waarschijnlijk een vroege implementatie van vóór het Archief-systeem
(v2.4.0) die nooit werd opgeruimd. Beide bestanden zijn in v2.4.7 verwijderd.
Zie `docs/changelog.md` v2.4.7 voor het volledige onderzoek dat hieraan
voorafging.

**Als je dit leest als nieuwe sessie:** ga er niet vanuit dat er ooit weer
een aparte `exercises.ts` of `/oefening/[id]`-route nodig is. Als iemand
vraagt om "de oefeningpagina" te wijzigen, is dat vrijwel zeker
`src/app/archief/oefening/[id]/page.tsx` — controleer dat expliciet voordat
je een nieuw bestand aanmaakt, om deze duplicatie niet opnieuw te
introduceren (Kernregel: geen dubbele modules, eerst uitbreiden dan
vervangen).

---

## Vaste afspraken

- **`src/app/settings/hoe-werkt-het/page.tsx`** wordt bijgewerkt zodra
  er gebruikersgerichte functionaliteit verandert (nieuwe features,
  gewijzigd gedrag) — niet bij interne refactors/debug-toevoegingen die
  voor de gebruiker onzichtbaar zijn. Warme, toegankelijke taal, geen
  technisch jargon — dat hoort in `docs/`.

## Nieuwe Claude-sessie starten

Deze repo is openbaar — een nieuwe Claude-sessie kan bestanden
rechtstreeks ophalen van GitHub, zonder handmatige upload:

```
curl -sL -o /home/claude/<naam> "https://raw.githubusercontent.com/stuctech-eng/coachOS/main/<pad-in-repo>"
```

Werkt voor elk bestand (code, `.md`, `.webp`/`.png`), met deze
kanttekeningen:
- Repo moet publiek blijven — anders werkt dit niet meer
- Alleen gecommitte **én** gepushte wijzigingen zijn zichtbaar
- Pad moet kloppen — bij een 404: ander pad proberen, niet per se afwezig
- Geen live-verbinding — elke fetch is een eenmalige snapshot

**Lees bij elke nieuwe sessie eerst:**
1. `README.md` (dit bestand) — actuele status, versiegeschiedenis, openstaand
2. `docs/changelog.md` — volledige wijzigingsgeschiedenis
3. Eventuele andere `docs/*.md` die relevant blijken voor de huidige vraag

**ZIP-naamconventie** bij het leveren van wijzigingen — zie de
uitgebreide regels verderop in dit document.

---

## Specialist Coach Platform — architectuurtraject (Cycling-referentie compleet)

**Status: architectuur ✅, database-ontwerp ✅ (SQL v2.4.59), API/Engine/AI/
Hub-UI ✅ — Cycling-referentie-implementatie volledig afgerond (v2.4.68).
Memory Engine 5/5 sub-stappen ✅ VOLLEDIG AFGEROND. Coach Policy-contract
volledig gesloten ✅ (v2.4.79-80). Running toegevoegd als tweede
specialist ✅ (v2.4.83). **Running Fase 1 (Foundation) + Fase 2
(Performance Center/Trainingsbelasting/Progressie) volledig afgerond
(v2.4.126-131).** **Training Plan Engine gerefactored naar een
Core+Adapter-platformcomponent (v2.4.132-133)** — Cycling en Running
delen nu dezelfde periodiserings-/mesocyclus-/adaptieve-aanpassingen-
logica, bewezen gedrag-behoudend voor Cycling (108+28 test-combinaties
identiek vóór/na de refactor). Fase 3 (UI) van het Running-trainingsplan
nog open.**

Uitbreiding van CoachOS van één brede coach naar een platform met
gespecialiseerde coaches (Cycling, Running, Rowing, Strength, ...) onder
één centrale Master Coach.

**Kernbeslissing:** specialisten *adviseren*, de Master Coach *beslist* —
geen losse AI-coaches, één coachervaring voor de gebruiker.

**Ontwerpfase (7 documenten, allemaal afgerond):**
`specialist-coaches.md`, `specialist-database-design.md`,
`specialist-api.md`, `specialist-memory.md`,
`specialist-decision-engine.md`, `specialist-engine-architecture.md`,
`specialist-coach-policy.md` (nieuw, v2.4.78 — CoachPolicy/
SpecialistSummary-contract tussen Master Coach en één specialist).

**Implementatie — twee specialisten actief:**

**Cycling (referentie-implementatie), 5/5 stappen compleet:**
1. ✅ Identity Layer/Registry (`/api/specialists`, v2.4.60)
2. ✅ Data Layer (`/api/specialists/cycling/data`, v2.4.61)
3. ✅ Cycling Analysis Engine (`/api/specialists/cycling/engine`, v2.4.66)
4. ✅ Coach Layer/AI (`/api/specialists/cycling/coach`, v2.4.67)
5. ✅ Capability Registry + Hub-UI (`/coach/cycling`, v2.4.68)

**Running (tweede specialist, v2.4.83), 5/5 stappen compleet:**
1-5. ✅ Alles hierboven, gespiegeld — bevestigt de herbruikbaarheid van
de architectuur. `genereerCoachPolicy()`, Learning/Confidence Engine,
en `api/coach/route.ts` **volledig hergebruikt zonder wijziging**. Enige
sport-specifieke werk: `running-data.ts`, `running-analysis.ts` (snelheid
i.p.v. vermogen), de Coach Layer-prompt-tekst, en de Hub-UI.

**Beide bereikbaar via de Coach-tab** (v2.4.69/83, "Mijn Coaches"-rij,
nu met per-specialist icoon) én rechtstreekse URL (`/coach/cycling`,
`/coach/running`).

**Lifecycle Engine** (v2.4.70, geherstructureerd v2.4.83) — SUGGESTED/
DORMANT/RETURNING-banners voor beide specialisten, geen opgeslagen
status. Sinds v2.4.83: één generieke kernfunctie + dunne per-sport-
wrappers, in plaats van gedupliceerde logica.

**Memory Engine — 5/5 sub-stappen compleet, VOLLEDIG AFGEROND, generiek
voor beide specialisten:**
1. ✅ SQL `specialist_memory` (v2.4.73)
2. ✅ Learning Engine — candidate→active promotie (v2.4.74)
3. ✅ Coach Layer stelt kandidaat-inzichten voor (v2.4.75)
4. ✅ Confidence Engine — stijging/decay/auto-deprecate (v2.4.76)
5. ✅ Terugkoppeling naar Coach Layer (v2.4.82)

**Coach Policy & Specialist Summary** (document v2.4.78, geïmplementeerd
v2.4.79-80) — volledig gesloten contract, **werkt voor beide
specialisten zonder wijziging** aan `genereerCoachPolicy()` of
`api/coach/route.ts` (die laatste bleek al generiek over alle actieve
specialisten te lopen, niet hardcoded op cycling).

**Decision Engine — VOLLEDIG COMPLEET (v2.4.84 + v2.4.86).** Regels 2-5
allemaal geïmplementeerd (regel 1, gezondheid > prestatie, zat al
structureel geborgd via CoachPolicy). Lost op wanneer meerdere
specialisten elk afzonderlijk "meer volume" adviseren maar de optelsom
te veel wordt (regel 3), en gebruikt doelurgentie als tiebreaker bij
gelijke belasting (regel 4-5).

**Goal Engine — geïmplementeerd (v2.4.86, gecorrigeerd v2.4.87).**
`user_goals` uitgebreid met `goal_scope`/`specialist_type`/`importance`
(nieuwe kolommen, `priority` — het bestaande weergavevolgorde-veld —
ongewijzigd). **Belangrijk onderscheid:** `importance` is een
gebruikerskeuze (stabiel, opgeslagen), `calculated_urgency` wordt elke
keer opnieuw berekend door de Goal Engine (dynamisch, gebaseerd op
deadline-nabijheid, NOOIT opgeslagen) — deze twee waren in v2.4.86 ten
onrechte vermengd tot één veld, in v2.4.87 rechtgezet. Berekent
deterministisch dagen-tot-deadline en waarde-kloof, bewust zonder een
"op schema"-claim die niet uit de data te herleiden is (vergt een
vastgelegde startwaarde, bestaat nog niet).

**Doelen-UI — geïmplementeerd (v2.4.88).** 3-staps-flow, schaalbaar
ontworpen voor toekomstige specialisten.

**De volledige keten is nu voor het eerst end-to-end bruikbaar voor de
gebruiker** (niet alleen via API/debug): Database → API → Goal Engine →
Decision Engine → Cycling/Running Coach → Doelen-UI.

**Volgende, besproken prioriteitsvolgorde (focus op verdieping, niet
breedte):**
1. ✅ Doelen-UI
2. Trainingsplan (automatisch meerweeks schema) — Cycling
3. Trainingskalender
4. Uitgebreide grafieken (Strava/Garmin/TrainingPeaks-niveau)
5. Memory & Knowledge Engine — verdere verdieping (huidige implementatie
   is functioneel maar basaal)
6. Fase 4 — volledige Master Coach ↔ Specialist-koppeling verder
   uitbouwen (basis staat sinds v2.4.80, kan dieper)

**Bewust uitgesteld:** Rowing/Strength als 3e/4e specialist — eerst
Cycling van "goede specialist" naar "compleet trainingsplatform" maken,
daarna is hergebruik voor andere sporten eenvoudiger.

---

## 🚴 Actieve roadmap: Cycling Specialist v1.0

**Zie `docs/cycling-specialist-roadmap-v1.md` voor het volledige,
goedgekeurde bouwplan.** ✅ **Fase 1-2 VOLLEDIG AFGEROND** (v2.4.91-108).
✅ **Vermogenscurve, Garmin-pad AFGEROND** (v2.4.108-115) — actief in
gebruik, uitgebreid naar 12 duurpunten (v2.4.122). ✅ **Critical Power-
model** (v2.4.121). ⚠️ **Vermogenscurve, Strava-pad: code klaar
(v2.4.118) maar extern geblokkeerd** — zie "Strava API-toegang"
hieronder, geen code-probleem.

## 🏃 Actieve roadmap: Running Specialist v1.0

**Zie `docs/running-specialist-roadmap-v1.md` (gefaseerd bouwplan) en
`docs/running-specialist-master-spec.md` (volledig eindbeeld) voor de
details.**

✅ **Fase 1 (Foundation) VOLLEDIG AFGEROND** (v2.4.126-128): Running
Profile (race-resultaat-invoer, geen los VDOT-getal), Pace Zones
(Daniels/Gilbert VDOT-model — publiek gepubliceerde formules, extern
geverifieerd tegen een onafhankelijke bron), Hartslagzones (hergebruikt
Cycling's `berekenHartslagZones()`, geen dubbele implementatie),
Dashboard (week/maand/jaar-km, gem. pace/hartslag/cadans), automatische
Records (nieuw afstand-gebaseerd curve-algoritme, spiegelbeeld van de
tijd-gebaseerde vermogenscurve — `afstandscurve.ts`).

✅ **Fase 2 (Professional) grotendeels afgerond** (v2.4.129-131):
Performance Center (VDOT, Pace Curve-grafiek, records, zones — zelfde
opzet als Cycling's Power Center), Trainingsbelasting (TSS/CTL/ATL/TSB,
snelheid-gebaseerde Intensity Factor i.p.v. vermogen-gebaseerd),
Progressie (race-afstand-trends + wekelijkse pace-trend).

✅ **Adaptief Trainingsplan, Fase 1+2 van 3 afgerond** (v2.4.132-133):
Plan Generator + Daily Adjustment Layer + Coach-uitleglaag, gebouwd
als **Running Adapter bovenop de gedeelde Training Plan Engine Core**
(zie `src/lib/specialists/training-plan-engine/`) — geen tweede,
losstaande engine. Sessietypen: Easy Run/Interval/Herstel/Tempo/Lange
duurloop.

### Running Specialist Fase 2 (Professional) — pariteitsronde met Cycling (v2.4.159-166)

**Compleet:** Kalender, Ritanalyse (Pace-zone/hartslagzone/cadans/
Negative-Positive-Split/pacing-consistentie/Running Power/TSS/
CoachPolicy-conclusie, met automatische sport-herkenning in het
activiteitenscherm — geen aparte knop meer), Progress Center, Grafieken
(CTL/ATL/TSB, wekelijkse trends, volledige records-lijst, progressie
per kernafstand). Goal Engine/Memory Engine bleken al generiek —
Running's routes zijn dunne wrappers, net als Cycling s.

**Bewust nog niet gebouwd:** Verticale oscillatie, grondcontacttijd,
paslengte — geen TCX-parsing hiervoor beschikbaar, geen gok-
implementatie zonder een echt bestand om tegen te testen.
Wedstrijdplanning, extra duurpunten (10s/3min/45min bestaan al bij
Cycling, nog niet bij Running's afstandscurve — andere set
doelafstanden, geen directe 1-op-1-vertaling). VDOT-ontwikkeling
(trend over tijd) — geen VDOT-geschiedenis bijgehouden, zelfde reden
als Cycling's FTP-trend vóór v2.4.108.

## 💚 Morning Health & Performance Repository (v2.4.137-140)

**Platformbrede uitbreiding, niet Cycling/Running-specifiek.** Op
verzoek gebouwd na uitgebreid architectuuroverleg — twee gescheiden
domeinen, geen afgeleide waarden opgeslagen, generieke Vision Engine.

- **`morning_health_metrics`** — HRV (ochtendwaarde + Garmin 7d-gem.
  apart), rusthartslag, Body Battery, slaap, stress, ademhaling. Eén
  rij per dag, `source_type`/`import_method` voor toekomstige bronnen
  (apple_health/whoop/polar/fitbit/coros/suunto/future_api).
- **`performance_snapshots`** — Training Readiness, trainingslast
  (acuut/chronisch + verhouding), trainingsstatus, focus lading,
  VO2max, Endurance Score. `hill_score`/`recovery_time_hours`/
  `race_predictor` alvast aanwezig (NULL-baar) voor toekomstige
  Garmin-widgets.
- **Bewust GEEN baseline/trend/status-kolommen** — afgeleide waarden,
  berekend live door de **Health Analysis Engine**
  (`src/lib/specialists/health-analysis-engine.ts`), nooit opgeslagen.
  Voorkomt migraties als de trend-regel (nu 7 dagen) ooit verandert.
- **Vision Engine** (`src/lib/vision-engine/`) — generiek contract
  + gedeelde comprimeer/AI-call/parse-Core, losse parsers per scherm
  (`garmin-health-parser.ts`, `garmin-performance-parser.ts`). AI doet
  uitsluitend OCR, nooit interpretatie. Twee screenshots in één
  upload (`/api/health/vision-import`) — bestaande `garmin_imports`
  (15+ lezers: Coach AI, Trends, Predictions, Status, Memory, Home,
  Insights, Training-flows) blijft ONGEWIJZIGD gevoed, dit is een
  aanvulling, geen vervanging.
- **HRV-veld in de Check-in**, optioneel met expliciete Overslaan-knop
  — schrijft naar dezelfde tabel, merget met een eventuele
  screenshot-import van diezelfde dag.
- **Coach-integratie (v2.4.140-141):** HRV-trend (baseline-relatief) +
  Performance Snapshot-kerncijfers zijn nu extra INPUT voor het
  dagelijkse Coach-advies (`src/app/api/coach/route.ts`) **én voor
  beide specialist-coaches** (`api/specialists/cycling/coach/route.ts`,
  `api/specialists/running/coach/route.ts`) — additief context-blok,
  zelfde patroon als de bestaande Garmin-context/memoryContext/
  doelenContext. **CoachPolicy en `buildDailyCoachPrompt` blijven
  ongewijzigd**, dit is bewust geen nieuwe beslissingslogica.

**Nog niet gebouwd:** Apple Health/WHOOP/Polar-parsers (geen
screenshot-voorbeeld om tegen te testen — komt bij concrete
aanleiding), Coach Recovery Engine/Coach Performance Engine als
losse, uitgebreidere modules (het huidige context-blok is een eerste,
lichte integratie).

### CoachOS Performance Intelligence Platform — Fase 1A (v2.4.149)

**Nieuw platformonderdeel** (`src/core/performance/`), gebouwd op een
goedgekeurde master-spec voor een compleet analyseplatform (18 engines
uiteindelijk: Endurance/Recovery/Fatigue/Progress/Climbing/Sprint/
Prediction/Efficiency/Consistency/Load/Readiness + Athlete Profile/
Confidence/Explainability/History). Fase 1A legt de fundering:

- **Kernprincipe:** `Supabase → data adapter → engines → Dashboard/Coach`
  — geen enkele engine raakt de database rechtstreeks aan. De
  `performance-data-adapter.ts` is de ENIGE plek die dat doet.
- **`core/engine-result.ts`** — uniform `EngineResult<T>`-contract voor
  elke huidige en toekomstige engine (Recovery nu, Load/Fatigue/
  Readiness/Consistency later)
- **`core/types.ts`** — `PerformanceContext`, één rijk object per
  gebruiker (activiteiten-telling, sensor-beschikbaarheid, historie,
  ruwe data van vandaag) — engines bepalen zelf wat ze gebruiken, geen
  losse `getRecoveryData()`/`getLoadData()`-functies
- **Confidence Engine** — de "poortwachter": elke score bestaat vanaf
  dag 1, altijd met een eerlijke betrouwbaarheidsindicatie erbij
  (LOW/MEDIUM/HIGH + concrete beperkingen), i.p.v. "nog niet
  beschikbaar". Gevalideerd met 3 scenario's: nieuwe gebruiker (LOW),
  ervaren gebruiker (HIGH), data-ontbreekt/alleen-trainingen (MEDIUM)
  — alle drie exact zoals verwacht.
- **Recovery Engine — WRAPPER, geen herbouw.** Roept de bestaande,
  vandaag uitgebreid geteste `calculateRecoveryScore()` aan
  (`@/core/ai-engine/recovery-engine.ts`, Niveau 1+2). Bewezen
  identieke uitkomst t.o.v. de directe aanroep.
- **Explainability Engine — bewust regelgebaseerd, geen AI-aanroep.**
  Gecentraliseerd, zodat niet elke engine zijn eigen uitleglogica
  krijgt. Genereert titel/samenvatting/coach-boodschap uit de
  breakdown-factoren, met een aparte melding bij lage Confidence.
- **`core/engine-registry.ts`** — overzicht van alle 15 geplande
  engines met fase en status, klaar voor het toekomstige Dashboard
- **Debug-scherm:** `/debug/performance-engine` toont de volledige
  keten (context → confidence → recovery → uitleg) met echte data

**Gevalideerd vóór levering:**
- `npx next build` — compileert zonder fouten of warnings
- Recovery-wrapper bewezen identiek aan de directe `calculateRecoveryScore()`-aanroep
- Confidence Engine: 3 scenario's (nieuw/ervaren/data-ontbreekt), alle
  drie exact de verwachte score/level/beperkingen

**Fase 1B (v2.4.150-155) — VOLLEDIG AFGEROND:**
- **Load Engine** — wrapper, telt bestaande per-sport CTL/ATL/TSB op
  (EWMA is lineair, wiskundig bewezen — verschil ~10⁻¹⁵)
- **Fatigue Engine** — nieuwe logica, afgeleid van Load's TSB + ACWR
  (zelfde drempelwaarden als Recovery's ACWR-correctie)
- **Readiness Engine** — combineert Recovery + inverse Fatigue,
  CoachPolicy's max-intensiteit als context. Eerste engine die een
  bestaande, database-rakende functie (`genereerCoachPolicy`)
  hergebruikt — bewuste, benoemde uitzondering.
- **Consistency Engine** — wekelijks activiteitenpatroon (8 weken),
  streaks, langste onderbreking
- **History Engine** — bewaart dagelijkse scores
  (`performance_engine_history`, expliciete update-of-insert i.p.v.
  upsert-met-onConflict — les uit v2.4.145 toegepast)

Elke nieuwe (niet-wrapper) engine is los getest met meerdere
scenario's vóór levering: Fatigue (4 scenario's), Readiness (3,
inclusief een bewust tegenstrijdig geval), Consistency (4). Alle
wiskundige aannames (EWMA-lineariteit) vooraf numeriek geverifieerd,
niet als aanname de code in.

**Bewust nog niet gebouwd** (volgt later): Dashboard-UI,
CoachPolicy-koppeling van de nieuwe laag zelf (CoachPolicy gebruikt
nog steeds rechtstreeks de oude `recovery-engine.ts`, niet de nieuwe
wrapper — na onderzoek (21 juli 2026) bewust definitief NIET
alsnog gekoppeld: CoachPolicy gebruikt al dezelfde onderliggende
`calculateRecoveryScore()`-berekening als de wrapper, die alleen
Confidence-scoring/EngineResult-opmaak toevoegt die CoachPolicy niet
gebruikt. Overschakelen zou alleen overbodige databasequeries
toevoegen aan een veelgebruikt pad, zonder gedragsverandering). Levensgebeurtenis-penalty zit nog niet in de data-adapter
(`lifeEventPenalty: 0` hardcoded, expliciet benoemd in de code).

### Fase 2 (v2.4.156-157) — VOLLEDIG AFGEROND

Geen "nog niet beschikbaar totdat er 90 dagen data is" — elke score
bestaat vanaf dag 1, met een eerlijke Confidence erbij:

- **Endurance Index** — VO2max + CTL + Consistency, gelijk gewogen.
  Ontbrekende VO2max trekt het gemiddelde niet omlaag (geen 0 invullen).
- **Sprint Score** — leunt volledig op de al-bestaande vermogenscurve,
  geen nieuwe databron. Absoluut vermogen, niet W/kg-genormaliseerd
  (v1-beperking, expliciet benoemd).
- **Efficiency Score** — Efficiency Factor (vermogen÷hartslag), publiek
  gedocumenteerd concept, geen propriëtaire namaak. Bewust Cycling-only
  in v1.
- **Climbing Score** — hoogtemeters + W/kg. Klim-segmentatie
  (stijgingspercentage/klimduur) bestaat nergens in CoachOS, zelfde
  beperking als eerder bij Running's "beste klim" (v2.4.128).
- **Progress Score** — vergelijkt laatste 14 dagen met de 14 daarvoor
  via de History Engine. Detecteert zelf wanneer er nog te weinig
  geschiedenis is en verlaagt dan actief de Confidence, i.p.v. een
  misleidend cijfer te tonen.

Elke engine los getest vóór levering (zie changelog v2.4.156-157 voor
de exacte scenario's). Resterend: **Fase 3** (Race Predictor, Athlete
Profile, e.d.) — vergt écht maanden historie, blijft bewust liggen.



**Bevinding:** de foto-import-flow schreef helemaal niets naar
`health_metrics` (zelfs HRV niet) — `calculateRecoveryScore()` kende
rusthartslag/Body Battery/slaapscore/slaapduur al als factoren, maar
kreeg ze zelden te zien. Gefixt: beide routes (`vision-import`, `hrv`)
schrijven nu alle relevante velden door, met merge-logica zodat ze
elkaar niet overschrijven.

**Bewust GEEN wijziging aan de scoreformule zelf** — `recovery-engine.ts`
kreeg alleen een additieve `breakdown`-array (welke factor droeg
hoeveel bij), bewezen gedrag-behoudend over 5 testcases. Het
**Recovery Debug Dashboard** (`/debug/recovery`) toont deze breakdown
+ de complete CoachPolicy-uitkomst, met dezelfde functies als de echte
Coach-routes — geen kans op afwijking tussen dashboard en werkelijkheid.

**Niveau 2 (v2.4.148) — nu ook afgerond:** Training Readiness telt mee
als gewone factor in het gemiddelde, met een **bescheiden gewicht
(0,5×)** — Garmin's eigen samengestelde herstelindicator overlapt deels
met HRV/slaap die al apart meetellen. **Belastingsverhouding (ACWR)**
is bewust GEEN gemiddelde-factor (zegt niets over herstel, wel over
blessurerisico) — een oplopende correctie ná het gemiddelde (≤1,3 geen
correctie, 1,3-1,5 −5, 1,5-1,7 −10, >1,7 −15), net als de bestaande
levensgebeurtenis-correctie. Bewust geen correctie bij een lage ACWR
(<0,8) — dat is een fitness-/trainingsplan-vraag, geen herstelvraag.
Alle vier aanroeppunten van `calculateRecoveryScore()` bijgewerkt
(CoachPolicy, dagadvies, de zichtbare Coach Score op Home, en het
Recovery Debug Dashboard zelf) — gevalideerd met 4 testcategorieën
(gedrag-behoudendheid zonder Performance-data, gewogen gemiddelde,
elke ACWR-drempelwaarde apart, lage-ACWR-uitzondering).

### Performance-pagina (v2.4.142) — platformniveau, geen specialist

**Bewust NIET onder Cycling of Running** — dit zijn geen sportgegevens,
ze horen bij de Master Coach. `src/app/performance/page.tsx` +
`src/app/api/performance-overview/route.ts` (andere naam dan het
bestaande `/api/performance`, dat is een ander concept —
trainingsprogressie/rating-analyse, geen gezondheidsdata — bewust niet
overschreven om verwarring te voorkomen).

Toont Herstel (HRV-trend, Garmin HRV 7d, Body Battery, rusthartslag,
slaapscore, stress), Belastbaarheid (Training Readiness,
belastingsverhouding) en Conditie (VO2max, Endurance Score, Hill
Score) met kleurcodering en een korte uitleg per metric, plus
**trendgrafieken over 30 dagen** (v2.4.143) voor HRV/rusthartslag/
Body Battery/slaapscore/Training Readiness/VO2max/Endurance Score.
Link vanaf Home, altijd zichtbaar. **Exact dezelfde data die Coach AI
en beide specialist-coaches al kregen (v2.4.140-141)** — deze pagina
maakt dat voor het eerst ook zichtbaar voor de gebruiker.


## 🧭 Navigatie-architectuur v1.0 (GEÏMPLEMENTEERD, herzien v2.4.111)

**Zie `docs/navigation-architecture-v1.md`.** Definitieve **6-tabs**-
structuur (Home/Coach/Trainer/Specialisten/Activiteiten/Voortgang) live
— Activiteiten in v2.4.111 teruggezet als eigen tab (was sectie binnen
Voortgang sinds v2.4.93, op verzoek herzien: balk is al horizontaal
scrollbaar).

## Openstaand

**Opgeschoond 21 juli 2026** — twee oude blokkerende items geverifieerd
en bevestigd achterhaald: `injuries.ended_at` wordt nergens in de
live code gebruikt (de app werkt via een simpeler `active`-boolean-veld
dat dit kennelijk verving), `garmin_activity_imports` wordt actief en
zonder problemen gebruikt in meerdere routes (`garmin-activity-tcx`,
`garmin-activity-vision`, `activities/[id]`) — de tabel bestaat en
werkt al lang. Beide dus uit de lijst.

De overige oude items hieronder (v2.4.23-72-tijdperk) zijn niet stuk
voor stuk opnieuw geverifieerd — vermoedelijk grotendeels achterhaald,
maar dat is een aanname, geen bevestiging. Bij twijfel: navragen
i.p.v. aannemen dat het nog relevant is.

| Item | Prioriteit |
|------|-----------|
| **GitHub tags aanmaken v2.0.4 t/m v2.4.119** — vergt git-push-rechten die Claude niet heeft, moet handmatig of door de gebruiker | 🟡 |
| Life-events pagina testen | 🟡 |
| Kettlebell illustraties: 30/102 live, #28 volgende | 🔄 In progress |
| Service worker-reset-probleem (v2.4.63-65) — nooit 100% bevestigd opgelost, niet opnieuw opgetreden voor zover bekend | ℹ️ Vermoedelijk stabiel |
| Coach Call: POST-trigger alleen vanaf home-pagina (bekend gedrag, geen bug) | ℹ️ Info |

---

# CoachOS - Project Geheugen

## Project
- App naam: CoachOS
- Versie: 2.4.119
- App URL: https://coach-os-tau.vercel.app
- GitHub: https://github.com/stuctech-eng/coachOS
- Stack: Next.js 14.2.29, TypeScript, Supabase, Vercel, Claude API

## Supabase Tabellen (relevant)
- `training_results` — sessielaag (duur, RPE, type)
- `exercise_records` — detaillaag (oefening, gewicht, reps, sets, module) — v2.3.1
- `progress_analyses` — coach rapporten op aanvraag — v2.3.5
- `coach_recommendations` — dagadvies + compliance
- `coach_calls` — evaluatie na training (zie sectie Coach Call Systeem)
- `coach_call_items` — losse activiteiten/trainingen binnen één Coach Call
- `activity_sessions` — Strava/Garmin activiteiten

---

## Strava API-toegang — externe beleidswijziging (juli 2026)

**Dit is geen CoachOS-bug — vastgelegd zodat een volgende sessie hier geen
tijd aan verspilt met code-fixes.**

Strava heeft aangekondigd dat **Standard-tier API-ontwikkelaars** (waar
CoachOS onder valt) per **30 juni 2026** een actief, betaald
Strava-abonnement (~€/$11,99/maand) nodig hebben op het account waarmee de
API-applicatie geregistreerd staat, om de API te mogen blijven gebruiken.
Reden volgens Strava: misbruik door AI-bedrijven die de API/website
scrapen voor trainingsdata.

**Symptoom:** `403`-fout bij elke Strava-sync-poging, **ondanks** een
volledig verse, correcte OAuth-autorisatie met de juiste scope
(`activity:read_all`). Dit onderscheidt het van een normaal token-probleem
— een 403 na een geldige herautorisatie wijst op dit account-niveau-slot,
niet op een scope- of tokenfout.

**Bevestigd in de praktijk (19 juli 2026):** Strava API Settings toonde
`reikwijdte: read` i.p.v. de gevraagde `activity:read_all` — en
`/api/strava/sync` gaf daadwerkelijk 403, zónder dat er iets aan de code
gewijzigd was. Bevestigt dat dit het account-niveau-slot is, niet een
scope- of code-probleem.

**Oplossingsrichtingen (geen van beide een code-fix):**
1. Een Strava-abonnement afsluiten op het account achter de API-registratie
2. **Garmin-activiteit-import gebruiken als primaire databron** — inmiddels
   een volwaardige TCX-bestand-import (niet meer alleen een screenshot-
   route): route-kaart, hoogtemeters, vermogen/hartslag/cadans, én sinds
   v2.4.110 ook de vermogenscurve (zie Cycling Specialist Roadmap v1.0).
   **Dit is nu de praktisch gebruikte weg** — de gebruiker is hier zelf al
   op overgestapt vanwege de Strava-blokkade

**Status van de Strava-vermogenscurve-code (v2.4.118):** de code zelf is
correct en klaar (streams-API-aanroep, opslag in `cycling_power_curve`,
zelfde patroon als Garmin) — maar **kan niet getest of gebruikt worden
zolang de Strava API 403 geeft.** Geen reden om de code terug te draaien
(hij is onschadelijk en klaar zodra Strava-toegang ooit hersteld wordt),
wel een reden om er nu geen verdere tijd in te steken.

**Zie ook:** `strava.com/settings/api` toont de huidige scope/status van
het *developer-testtoken* — dat is **niet** hetzelfde token als wat
gebruikers via de OAuth-flow krijgen (die staan in `strava_tokens` in onze
eigen database). Verwar deze twee niet bij toekomstig troubleshooten.

---

## Coach Call Systeem

**Wat het is:**
De Coach Call is de evaluatiestap in de Coaching Cirkel (zie `docs/architecture.md` §4). Coach AI wil altijd weten wanneer er getraind is — via Strava, Garmin-activiteit-import, Archief of Trainingsbibliotheek — zodat dit meeweegt in het herstel-/belastingadvies van de volgende dag (zie `coachCallContext` in `src/app/api/coach/route.ts`).

Er zijn drie bronnen die een Coach Call kunnen triggeren, met elk een andere reden (zie tabel):

| Bron | Reden voor Coach Call | Wanneer triggert het? |
|---|---|---|
| **Strava-activiteit** | Enige manier om evaluatiedata (RPE/mood) binnen te krijgen — een Strava-rit heeft zelf geen evaluatiescherm en de belasting telt zonder Coach Call niet mee in de herstel-berekening | Alleen als een drempelwaarde gehaald wordt (zie hieronder). **Sinds 30 juni 2026 vereist Strava-sync een betaald Strava-abonnement op het API-account, zie sectie hieronder.** |
| **Garmin-activiteit-import** (`source: garmin`, onderscheiden via `notes`-prefix `garmin_activity_import:`, sinds v2.4.23/24) | Bewuste, eenmalige handmatige upload — vergelijkbaar met een Trainingsbibliotheek-sessie starten, geen automatische bulk-sync | **Altijd**, ongeacht duur/afstand — zelfde redenering als Archief/Trainingsbibliotheek |
| **Archief / Trainingsbibliotheek** (`training_source: library`) | De evaluatie (RPE, energie, techniek) zit al in de sessie zelf vóór opslag — de Coach Call meldt hier dát er buiten het coach-advies om getraind is | **Altijd**, ongeacht welk advies die dag gold of zelfs als er geen advies was (sinds v2.4.6) |

**Strava-drempelwaarden (hardcoded in `route.ts`, sinds v2.4.6):**
```
Hardlopen: 5km OF 30 min
Fietsen:   20km OF 30 min
Roeien:    5km OF 30 min
```
Afstand **of** duur is voldoende — niet beide tegelijk nodig (vóór v2.4.6 was dit een AND-voorwaarde met 45 min). Reden: in herstelfases is afstand soms niet haalbaar maar duur wel een reëel belastingssignaal. Andere sporttypes (Wandelen, Yoga, Krachttraining, etc.) triggeren geen Coach Call via Strava.

**Betrokken bestanden:**

| Bestand | Rol |
|---------|-----|
| `src/app/api/coach-calls/route.ts` | **Kern (Strava-tak).** `POST` maakt/heropent `coach_calls` + `coach_call_items` op basis van kwalificerende Strava-activiteiten (OR-drempel). `GET` haalt de actieve (pending/partial) call op, inclusief 24u-expiry check. |
| `src/app/api/training/complete/route.ts` | **Kern (bibliotheek-tak).** Stap 3 maakt altijd een Coach Call aan bij `training_source: 'library'`, ongeacht coach-advies (sinds v2.4.6), heropent completed/expired calls (v2.4.8), met retry op de insert (v2.4.9). Slaat ook `training_results` en `exercise_records` op. |
| `src/app/api/coach-calls/rate/route.ts` | Verwerkt de evaluatie (rating/mood/notes) per item, genereert een AI coach-reactie per item, herberekent de call-status (pending → partial → completed). |
| `src/app/home/page.tsx` | Roept bij laden `POST` aan (Strava-trigger), daarna `GET` (ophalen), en toont de Coach Call-banner als `pending_count > 0`. **Belangrijk:** de Strava-trigger draait dus alleen als de home-pagina geladen wordt. |
| `src/app/coach-call/page.tsx` | De evaluatiepagina zelf waar de gebruiker rating/mood/notities invult. |
| `src/app/activities/page.tsx` | Toont Strava/Garmin-activiteiten; bron van de data die `coach-calls/route.ts` filtert. |
| `src/lib/strava-activity-processor.ts` | Verwerkt de ruwe Strava-sync naar `activity_sessions` (sporttype-mapping, metrics). Draait vóór de Coach Call-logica, niet erin. |
| `src/app/settings/hoe-werkt-het/page.tsx` | In-app uitleg voor de gebruiker (sectie "Coach Call") — houd dit synchroon met wijzigingen aan de trigger-logica. |
| `src/app/debug/page.tsx` | Bevat sinds v2.4.9 de sectie "Coach Call Integriteit" — vergelijkt recente `training_results` (library-bron) tegen `coach_call_items` en meldt ontbrekende koppelingen. Eerste stap bij een "geen Coach Call"-melding: laat de gebruiker hier "Start diagnostiek" draaien. |

**Statusmachine van een `coach_call`:**
`pending` → (items deels beoordeeld) → `partial` → (alle items beoordeeld) → `completed`
Een call die 24 uur oud is zonder voltooiing wordt automatisch `expired`.

**Bekende fixes:**
- **v2.4.3:** als er op een datum al een `completed`/`expired` call bestond en er kwam een nieuwe kwalificerende Strava-activiteit bij, bleef die call onzichtbaar (GET filtert op `pending`/`partial`). De `POST`-route (`coach-calls/route.ts`) heropent zo'n call nu automatisch.
- **v2.4.6:** de bibliotheek-tak (`training/complete/route.ts`) triggerde voorheen alleen een Coach Call als het coach-advies die dag `herstel` of `rust` was. Dat miste gevallen zonder advies of met advies `trainen`. Nu triggert elke Archief/Trainingsbibliotheek-training altijd een Coach Call. Tegelijk is de Strava-drempel verruimd naar OR-logica (afstand of duur) met 30 min i.p.v. 45 min.
- **v2.4.8:** dezelfde "onzichtbaar na completed/expired"-bug als v2.4.3, maar dan in de bibliotheek-tak — `training/complete/route.ts` had de heropen-logica nog niet.
- **v2.4.9-v2.4.11:** een reeks pogingen om een aanhoudend "geen Coach Call na bibliotheek-training"-probleem op te lossen. v2.4.9 vermoedde een kortstondige Supabase pooler-timeout en voegde retry-logica toe — **dit was een verkeerd spoor**, de timeout in de Postgres Logs bleek een eenmalig, ongerelateerd voorval. v2.4.11 bracht de echte doorbraak: de retry-logica checkte nooit het `.error`-veld van Supabase-responses (Supabase gooit geen JS-exception bij een DB-fout), waardoor de werkelijke foutmelding nooit gelogd werd. Zodra dat gefixt was, bleek de oorzaak in één test duidelijk (zie v2.4.12).
- **v2.4.12 — DEFINITIEVE FIX:** `coach_call_items.activity_session_id` had een `NOT NULL`-constraint uit de tijd dat deze tabel alleen voor Strava-items bestond. Bibliotheek-trainingen vullen die kolom nooit (ze gebruiken `training_result_id`), dus elke insert vanuit de bibliotheek-tak faalde met Postgres-foutcode `23502`. Opgelost met `alter table coach_call_items alter column activity_session_id drop not null;` in Supabase SQL Editor — geen codewijziging nodig. **Les:** bij een stil falende Supabase-insert altijd eerst checken of `.error` daadwerkelijk gelogd wordt, vóór tijd te steken in RLS/policy-onderzoek.

**Databaseschema — belangrijk voor toekomstige wijzigingen:**
`coach_call_items` bedient nu twee verschillende bronnen met verschillende
verplichte velden:
- Strava-items: `activity_session_id` ingevuld, `training_result_id` NULL
- Bibliotheek-items (Archief/Trainingsbibliotheek): `training_result_id`
  ingevuld, `activity_session_id` NULL
Beide kolommen zijn dus terecht **nullable** (sinds v2.4.12) — dat is geen
datakwaliteitsprobleem, maar een bewuste consequentie van één tabel die
twee brontypes bedient. Voeg bij een nieuwe Coach Call-bron altijd expliciet
een `CHECK`- of applicatie-validatie toe die garandeert dat minstens één
van de twee kolommen gevuld is, in plaats van te vertrouwen op `NOT NULL`
op één specifieke kolom.

**Bekend gedrag (geen bug):** de Strava-`POST`-trigger draait alleen wanneer `home/page.tsx` geladen wordt. Na een Strava-sync moet de gebruiker dus naar de home-pagina navigeren voordat een nieuwe Coach Call verschijnt.

---

## Troubleshooting — bestanden per probleemtype

Bij een bugmelding vraagt een nieuwe sessie STOP (punt 1, Kernregels) om het
juiste bestand, in plaats van te gokken. Onderstaande lijst versnelt dat:
plak het genoemde kopy-blok zodra het probleemtype herkenbaar is.

### "Genereer advies" / Coach dagadvies werkt niet, hangt, of blijft spinnen
```
src/app/api/coach/route.ts
src/hooks/useCoach.ts
src/app/api/weather/route.ts
```
Bekend risico (opgelost in v2.4.4, maar relevant bij vergelijkbare klachten):
externe fetches zonder timeout (Open-Meteo, ipapi.co, of andere derde
partijen) kunnen de hele serverless function laten vastlopen tot de
platform-timeout — dat verschijnt als een onafgevangen 500, ook al staat er
een `.catch()` in de code. Vraag bij twijfel ook om de Vercel Logs-screenshot
(rode 500-regels, tijdstip + volledig pad) en, indien beschikbaar, de
uitgeklapte error-tekst.

### Coach Call (Strava of bibliotheek-training) verschijnt niet
**Eerste stap, vóórdat je bestanden opvraagt:** vraag de gebruiker "Start
diagnostiek" te draaien op `/debug` en te kijken naar de sectie "Coach Call
Integriteit (laatste 24u)". Die check (sinds v2.4.9) vergelijkt recente
bibliotheek-trainingen met hun Coach Call-item en meldt direct een mismatch
— dat scheelt het hele traject van Vercel-logs + Supabase Postgres Logs
doorzoeken dat nodig was om deze check te bouwen.
```
src/app/api/coach-calls/route.ts
src/app/api/training/complete/route.ts
src/app/api/coach-calls/rate/route.ts
src/app/home/page.tsx
src/lib/strava-activity-processor.ts
src/app/debug/page.tsx
```
Let op onderscheid: `/api/coach` (enkelvoud) = dagelijks coach-advies.
`/api/coach-calls` (meervoud) = evaluatie van trainingen/activiteiten. Dit
zijn twee losse routes met eigen bugs — niet aannemen dat een fix in de één
de ander raakt.

**Bekend patroon (v2.4.8/v2.4.9):** als een `training_results`-rij wél
bestaat maar het bijbehorende `coach_call_item` niet, controleer eerst
Supabase → Logs → Postgres Logs op "Warp server error: Thread killed by
timeout manager" rond het tijdstip van de training. Dat is een kortstondige
infrastructuur-timeout, geen logicafout — de retry in Stap 3 zou dit sinds
v2.4.9 grotendeels moeten opvangen, maar bij herhaling is een hogere
Supabase compute-tier het te onderzoeken vervolgspoor.

### Exercise illustraties tonen niet in UitlegScherm
```
src/lib/kettlebell-exercises.ts (of de betreffende bibliotheek)
```
Check: staat `illustratie: '[bestandsnaam].png'` op de juiste entry, en staat
het bestand daadwerkelijk in `public/exercises/`?

### Training-sessie / Trainer AI kiest verkeerde of geen oefeningen
```
src/app/api/training/today/route.ts
src/lib/[betreffende]-exercises.ts
```

### Progressie / exercise_records tonen niet correct
```
src/app/progressie/page.tsx
src/app/api/training/complete/route.ts
```

### Navigatie/terugknop gedraagt zich vreemd (swipe-terug, verkeerde bestemming)
```
[betreffende page.tsx bestand]
```
**Bekend patroon (v2.4.17):** zoek naar `router.push('/...')` op plekken die
bedoeld zijn als "terug"-navigatie (bijv. een terugknop, of een automatische
redirect na het voltooien van een actie). `push` voegt altijd een NIEUWE
entry toe aan de browsergeschiedenis — bij herhaald gebruik (bijv. meerdere
keren een detail-pagina bekijken en terugkeren) stapelen zich duplicaten op.
Dat is onzichtbaar in de UI zelf (de in-app knop lijkt te werken), maar
swipe-terug (iOS systeem-navigatie, buiten React's routing om) volgt de
werkelijke, vervuilde geschiedenis-stack — wat zich uit als: meerdere stappen
tegelijk terug, "hangen en terugspringen", of uitkomen op een oude,
ongerelateerde pagina.
**Fix-patroon:** gebruik `router.back()` voor knoppen die simpelweg "één
stap terug" moeten doen, en `router.replace()` (niet `push()`) voor
automatische redirects na het voltooien van een flow (voorkomt dat de
gebruiker per ongeluk terugkomt op een net-afgeronde actie).

**Let op — ander probleem met hetzelfde symptoom, definitief opgelost in
v2.4.20:** "terugknop gaat niet goed" kan ook betekenen dat de navigatie
zelf correct is (juiste pagina), maar de **scrollpositie** reset naar
boven. **Controleer eerst welk element daadwerkelijk scrolt** — in
CoachOS is dat het `<main>`-element binnen `AppShell`
(`src/components/layout/index.tsx`, class `scroll-area`), NIET `window`
(de buitenste wrapper heeft `overflow-hidden`). Browser- en Next.js-
scrollherstel werken alleen op `window.scrollTo` en hebben dus **geen**
effect op dit soort binnenste scroll-containers, ongeacht `push`/`back`/
`replace` of synchrone/asynchrone data-loading.
**Fix-patroon (al geïmplementeerd sinds v2.4.20):** `AppShell` bewaart de
`scrollTop` van het `<main>`-element in `sessionStorage`, per pathname, en
herstelt die bij hermount. Dit werkt app-breed. Als een scroll-probleem
zich toch weer voordoet, check eerst of deze `AppShell`-logica nog intact
is vóór je een nieuwe fix bouwt.

### Algemeen (bij twijfel over welk bestand)
Vraag altijd eerst om:
1. Het Debug Panel (`/debug`) — zie punt 15, architectuurregel
2. Vercel Logs (rode 500-regels, uitgeklapt voor volledig pad + error-tekst)
3. Het exacte symptoom: hangt het, geeft het een foutmelding, of gebeurt er
   zichtbaar niets?

---

## Exercise Illustraties — Voortgang

Mannequin-stijl illustraties per oefening, gegenereerd via GPT, opgeslagen in
`public/exercises/[id].png` (t/m #15) of `.webp` (vanaf #16). Gekoppeld via
`illustratie` veld op de BibliotheekOefening interfaces. Eerste categorie:
Kettlebell (102 oefeningen).

Volgorde: array-volgorde in `src/lib/kettlebell-exercises.ts`, met reeds
voltooide oefeningen overgeslagen (niet chronologisch op array-index).
Zie sectie "Illustratie Workflow" voor de PNG→WebP-knip vanaf #16.

| Oefening | Status |
|----------|--------|
| Kettlebell Deadlift | ✅ Live (PNG) |
| Sumo Deadlift | ✅ Live (PNG) |
| Single Arm Deadlift | ✅ Live (PNG) |
| Romanian Deadlift | ✅ Live (PNG) |
| Staggered Stance Deadlift | ✅ Live (PNG) |
| Kettlebell Swing | ✅ Live (PNG) |
| Russian Swing | ✅ Live (PNG) |
| American Swing | ✅ Live (PNG) |
| One Arm Swing | ✅ Live (PNG) |
| Hand-to-Hand Swing | ✅ Live (PNG) |
| Double Swing | ✅ Live (PNG) |
| Alternating Swing | ✅ Live (PNG) |
| Goblet Squat | ✅ Live (PNG) |
| Front Squat | ✅ Live (PNG) |
| Double Front Squat | ✅ Live (PNG) |
| Strict Press | ✅ Live (PNG) |
| Clean | ✅ Live (PNG) |
| Farmer Carry | ✅ Live (PNG) |
| Box Squat | ✅ Live (WebP) |
| Tempo Goblet Squat | ✅ Live (WebP) |
| Pause Squat | ✅ Live (WebP) |
| Split Squat | ✅ Live (WebP) |
| Bulgaarse Split Squat | ✅ Live (WebP) |
| Reverse Lunge | ✅ Live (WebP) |
| Forward Lunge | ✅ Live (WebP) |
| Walking Lunge | ✅ Live (WebP) |
| Lateral Lunge | ✅ Live (WebP) |
| Cossack Squat | ✅ Live (WebP) |
| Thruster | ✅ Live (WebP) |
| Push Press | ✅ Live (WebP) |
| Strict Press | 🔄 Volgende (#28, WebP) — eerdere sessie-aanname dat dit al gekoppeld was, klopte niet, gecontroleerd en gecorrigeerd |

**Volgende:** vraag "volgende" voor de eerstvolgende oefening zonder illustratie
(array-volgorde in `kettlebell-exercises.ts`, reeds voltooide overgeslagen).
Prompt-sjabloon (stijl, layout, kwaliteitseisen) blijft hetzelfde — alleen
oefeningnaam, 5 fasenamen en bestandsformaat (WebP vanaf #16) wijzigen per
oefening.

## Bibliotheek Totaal
- Bodyweight: 120 oefeningen (`src/lib/bodyweight-exercises.ts`)
- Strength: 100 oefeningen (`src/lib/strength-exercises.ts`)
- Kettlebell: 102 oefeningen (`src/lib/kettlebell-exercises.ts`)
- Mobility: 20 oefeningen (`src/lib/mobility-exercises.ts`)
- Recovery: 12 modules (`src/lib/recovery-exercises.ts`)
- Running drills: 13 (`src/lib/running-drills.ts`)
- Rowing drills: 12 (`src/lib/rowing-drills.ts`)
- Cycling drills: 11 (`src/lib/cycling-drills.ts`)
- **Totaal: 390 modules**

## 🧭 Today Engine — platformprincipe (v2.4.169)

**Vastgelegd op verzoek als vaste architectuurregel voor heel CoachOS,
niet alleen voor Cycling/Running.**

**Aanleiding:** bij onderzoek bleek dat `api/training/today` (Trainer AI)
onafhankelijk van het Specialist-trainingsplan óók zelf Cycling/Running-
sessies kon voorstellen — twee systemen die elkaar konden tegenspreken
zonder van elkaars bestaan te weten.

**Kernprincipe: de Today Engine maakt zelf nooit trainingen — hij kiest
alleen welke bestaande bron vandaag de waarheid is.**

```
Morning Health / Performance / Weer / CoachPolicy
                    ↓
              Master Coach
                    ↓
              Today Engine
                    │
    ┌───────────────┴───────────────┐
    │                               │
Actief specialist-plan          Geen actief plan
voor vandaag?                   voor vandaag?
    │                               │
    ▼                               ▼
Specialist-sessie wint       Trainer AI maakt sessie
(Trainer AI niet gebruikt)   (Universal Training Engine)
```

**Vaste prioriteitsvolgorde, voor élke huidige en toekomstige
specialist:**
1. **Veiligheid** — CoachPolicy/blessures/herstel (elders al bepaald,
   Today Engine herberekent dit niet, leest alleen `actie_type`)
2. **Specialist-trainingsplan** — Cycling/Running nu, later Rowing/
   Kettlebell/etc. zodra die specialisten bestaan
3. **Trainer AI** — uitsluitend als er geen actief specialist-plan is
4. **Handmatige bibliotheekkeuze** — buiten de Today Engine om

- **`src/lib/today-engine.ts`** — `bepaalTodayPlan()`, de enige plek
  die deze keuze maakt. Roept de bestaande, al-geteste
  `api/training/today` intern aan als vangnet (server-naar-server, met
  doorgegeven sessie-cookie) — géén duplicatie van die complexe
  module-keuze/AI-generatielogica.
- **`api/today/route.ts`** — de ENIGE ingang voor "wat moet ik vandaag
  doen?". Home roept voortaan dit aan, nooit meer rechtstreeks
  `api/training/today` voor dit doel (dat endpoint blijft wél bestaan
  voor de Trainer-tab zelf en het daadwerkelijk starten van een
  sessie).
- Home toont nu een zichtbare "Vandaag"-kaart (titel, duur, intensiteit,
  bron) i.p.v. alleen een generieke "Start Training"-knop die niet liet
  zien wát er gepland stond.

**Gevalideerd:** 5 scenario's getest (rust wint altijd, specialist wint
van Trainer AI, Trainer AI als vangnet, nette lege staat zonder gok,
en het edge-case van twee gelijktijdige specialist-sessies) — allemaal
correct.

**Toekomstbestendig:** zodra Rowing/Kettlebell/etc. ooit een eigen
Training Plan Engine krijgen (zie het platformprincipe hieronder), hoeft
alleen `bepaalTodayPlan()` een extra sport toegevoegd te krijgen — Home
en de rest van de architectuur veranderen niet.

### Today Engine — multi-sport, gefaseerd (v2.4.171)

**Vastgelegd op verzoek: de Today Engine is de plek waar multi-sport
samenkomt, maar bewust gefaseerd — niet alles tegelijk bouwen.**

**Fase 1 (nu, af):** Today Engine levert altijd precies ÉÉN `TodayPlan`
— nooit twee trainingen op Home. Intern al wel een `proposals[]`-
structuur (ook al bevat die nu max. 2 items, cycling/running) — de
engine hoeft later niet opnieuw ontworpen te worden, alleen uitgebreid.

**Bij meerdere gelijktijdige specialist-voorstellen (zeldzaam: Cycling
én Running allebei een sessie dezelfde dag) beslist nu de bestaande
Decision Engine** (`beslisTussenSpecialisten`) — importance
(Goal Engine) → calculated_urgency als tiebreaker. Vervangt de vorige,
arbitraire "Cycling wint altijd van Running"-regel. **Bewezen middels
test:** Running kan nu daadwerkelijk winnen als het belangrijker is
(kon met de oude volgorde-gebaseerde regel nooit).

**Eerlijke beperking, bewust niet geïmplementeerd:** "Regel 4 —
Planfase (Build > Base > Recovery)" uit het overleg — er wordt nergens
een mesocyclus-type per plan opgeslagen om op te beslissen. Geen gok
zonder databron.

**Fase 2 (later, zodra Rowing/Kettlebell/etc. echte specialisten
worden):** `TodaySchedule` — meerdere voorstellen tegelijk, een echte
dagplanning i.p.v. één sessie. Nu bewust NIET gebouwd — het datamodel
(`training_plan_sessions`) ondersteunt ook nog geen meerdere sessies
per dag, en er bestaan nog geen specialisten die om deze functionaliteit
vragen.



**Vastgelegd op verzoek: elke huidige en toekomstige specialist volgt
exact dezelfde basisarchitectuur — "niet Cycling is speciaal, elke
specialist volgt hetzelfde model".**

Elke specialist krijgt (Cycling en Running hebben dit nu allebei,
volledig):
1. **Eigen profiel** — instellingen, niveau, zones, doelen
2. **Eigen Training Plan Engine** — periodisering, adaptief, herstelweken
3. **Eigen Dashboard** — vandaag/week/maand, kerncijfers
4. **Eigen Grafieken** — sport-specifiek (vermogen bij Cycling, pace bij
   Running — bij een toekomstige Rowing-specialist bijv. split/stroke
   rate)
5. **Eigen Records** — sport-specifieke afstanden/duren
6. **Eigen Analyse** — na elke sessie, objectief bepaald vóór de AI
   erop reageert
7. **Eigen Memory Engine** — leert alleen over die ene sport

**Bewust NIET nu gebouwd voor Rowing/Kettlebell/etc.** — Trainer AI
(de Universal Training Engine) blijft voorlopig de generieke uitvoerder
voor deze disciplines. Ze worden pas een volwaardige "specialist"
zodra daar een concrete aanleiding voor is — zelfde principe als overal
vandaag: bouwen met een reden, niet speculatief vooruit.

## 🧭 Coach Context Engine — Fase 1 afgerond (v2.4.172)

**Aanleiding:** een gemelde bug — een terugkerend werk-event ("Dagdienst")
bleef naast een eenmalige "Vakantie" in de Coach-context staan, omdat de
oude dedupliceer-logica alleen op exact hetzelfde `type` matchte, niet
op logisch conflict. De Coach dacht daardoor tijdens vakantie nog dat
er gewerkt werd.

### Context Resolver — pure functie
`src/core/utils/context-resolver.ts` — `bepaalDagContext()`. **Volledig
puur:** geen database, geen API-calls, geen AI. Neemt ruwe levensevents
(+ optioneel actieve blessures) en levert één opgeloste werkelijkheid:

```ts
{
  mode: 'vakantie',
  priorityReason: 'vakantie overschrijft dagdienst',
  trainingModifier: -30,      // %
  recoveryModifier: 20,       // %
  stressModifier: -40,        // %
  coachInstruction: 'Focus op onderhoud en plezier.',
  suppressedEvents: [{ type: 'dagdienst', status: 'suppressed', reason: 'overschreven door vakantie' }],
  lifeEventPenalty: 3,        // zelfde formule als voorheen, nu op één plek
}
```

**Vaste prioriteitsvolgorde, expliciete configuratie**
(`CONTEXT_PRIORITY`, niet verstopt in logica):
`blessure → ziekte → vakantie → herstel → wedstrijd → werk → training → vrije_tijd`

**Events verdwijnen nooit stilzwijgend** — een onderdrukt event krijgt
een zichtbare `status: 'suppressed'` + reden, nodig voor debugging,
gebruikersvertrouwen, en latere agenda-integratie ("Waarom staat mijn
werk niet in mijn planning?").

### Eén gedeelde bron — vijf plekken die eerder elk hun eigen versie hadden
`api/coach/route.ts`, `api/action-plan/route.ts`, `api/status/route.ts`
(Coach Score) en de Performance-data-adapter riepen voorheen elk hun
eigen `lifeEventPenalty`-berekening of ruwe events-lijst aan — nu
allemaal via `haalDagContext()` (de "onzuivere" wrapper die data ophaalt
en de pure resolver aanroept). **Bijvangst:** de Performance-adapter had
`lifeEventPenalty` nog hardcoded op `0` staan — de eerder aangekondigde
v2.4.158-fix bleek nooit daadwerkelijk gecommit, ontdekt en nu pas
écht gefixt.

**Geen databasewijziging** — `life_events` blijft ongewijzigd, de
Resolver is een intelligente laag erboven.

**Gevalideerd — 5 scenario's, allemaal correct:** het exacte gerapporteerde
probleem (vakantie onderdrukt terugkerende dagdienst), lifeEventPenalty-
formule ongewijzigd, blessure wint zelfs van vakantie, neutrale staat
zonder events, onbekend event-type crasht niet (valt terug op laagste
prioriteit).

### Periodiserings-context: Today Engine weet nu in welke trainingsfase je zit (v2.4.176)

**Eerste échte databasewijziging sinds de hele Coach Context Engine-
reeks begon — klein, nullable, backwards compatible.**
`bepaalMesocycli()` in de Training Plan Engine berekende al sinds het
begin `basis`/`opbouw`/`piek`/`herstel` per week — maar gebruikte dat
alleen om het sessietype te kiezen (interval vs herstel), en gooide het
daarna weg. De Training Plan Engine wist het, de Coach niet, de Today
Engine niet, de Specialist moest het later opnieuw afleiden.

- **`supabase/mesocycle_type_kolom.sql`** — nieuwe nullable kolom op
  `training_plan_sessions`
- `training-plan-engine/core.ts` — slaat het al-berekende type nu op
  (geen nieuwe berekening)
- `training-plan-engine/adjuster-core.ts` — **bijvangst:** alle drie de
  aanpassings-triggers (gemiste training/blessure/vermoeidheid)
  maakten een vervangende sessie aan zonder het mesocyclus-type van het
  origineel over te nemen — zou de trainingsfase alsnog kwijtraken bij
  elke aanpassing. Nu gefixt op alle drie de plekken.
- `today-engine.ts` — `TodayPlan` kreeg een `trainingPhase`-veld,
  bewust uitbreidbaar ontworpen (matcht het "Training Phase"-blok uit
  het overleg) maar NIET vooruitgebouwd met week-binnen-blok/dagen-tot-
  wedstrijd — die data bestaat nergens om op te baseren
- `coach/route.ts` + `action-plan/route.ts` — de Coach-prompt krijgt nu
  een expliciete instructie om de trainingsfase te gebruiken in de
  uitleg (bijv. "omdat je in een opbouwweek zit, hoort deze hogere
  belasting bij de opbouw")

**Architectuurkeuze:** dit zit NIET in de Context Resolver's
prioriteitensysteem (dat is voor levensgebeurtenissen die met elkaar
concurreren) — trainingsfase is beschrijvende informatie over de
sessie van vandaag, en hoort dus bij de Today Engine's TodayPlan, waar
die sessie-info al leeft.

**Gevalideerd:** sessie met mesocyclus-fase (reason bevat "(Build-
week)", trainingPhase gevuld) en een oude sessie zonder dit veld (geen
crash, `trainingPhase: null`, ongewijzigd gedrag) — beide correct.
`npx next build` compileert zonder fouten.

**Bijgewerkte prioriteitenvolgorde:**
1. ✅ Master Coach ↔ Today Engine (v2.4.174)
2. ✅ Periodiserings-context (v2.4.176, dit)
3. ✅ Feestdagen (v2.4.175)
4. Coach Agenda uitbreiden (schoolvakanties, extern)
5. Apple/Google/Outlook-sync
6. Rowing Specialist
7. Strength Specialist
8. Kettlebell Specialist
9. Multi-sport Orchestrator

### Coach Agenda Fase 2, eerste stap: feestdagen in de Context Resolver (v2.4.175)

**Kleinste, veiligste stukje van Fase 2 — geen externe API, geen nieuw
datamodel.** Nederlandse feestdagen werden al berekend (Gauss'
paasformule) sinds v2.4.173, maar **uitsluitend als visuele decoratie**
in de kalender-UI — de Coach wist er niets van.

- **Nieuw:** `src/lib/feestdagen.ts` — de berekening verplaatst naar
  een gedeeld bestand (was verdubbeld tussen UI en... nergens anders,
  maar nu klaar om ook server-side gebruikt te worden). `life-events/
  page.tsx` importeert dezelfde functie, geen twee losse
  implementaties meer.
- `context-resolver.ts` — `DagContextInput` kreeg een optioneel
  `holiday`-veld. Puur informatief, **laagste prioriteit**
  (`vrije_tijd`) — een feestdag overschrijft nooit iets belangrijkers
  (vakantie, ziekte, werk blijven gewoon leidend als ze er zijn), maar
  wordt wél zichtbaar als er verder niets speelt.
- `haalDagContext()` — berekent nu ook of vandaag een feestdag is
  (geen extra databron, dezelfde wiskundige functie) en geeft dat door.

**Bewuste keuze:** een feestdag overschrijft géén werk-event. CoachOS
kan niet weten of een ingeroosterde dienst op een feestdag verplicht is
— dat blijft aan de gebruiker om zelf aan te geven (bijv. door op die
dag "Vrije dag" i.p.v. "Dagdienst" te registreren).

**Gevalideerd — 4 scenario's:** feestdag alleen (zichtbaar, bij naam
genoemd), feestdag + vakantie (vakantie wint, ongewijzigd), feestdag +
werk (werk wint, feestdag overschrijft niet), geen feestdag/geen events
(normale staat, gedrag-behoudendheid bevestigd).

**Bijgewerkte prioriteitenvolgorde:**
1. ✅ Master Coach leest Today Engine — afgerond (v2.4.174)
2. 🔄 Coach Agenda Fase 2 — **feestdagen afgerond (v2.4.175)**, externe agenda-sync/schoolvakanties/periodiserings-events blijven aparte, grotere projecten
3. Rowing Specialist
4. Strength Specialist
5. Kettlebell Specialist
6. Multi-sport Orchestrator

### Minuten-precisie voor tijden (v2.4.196)

**Aanleiding:** AI-invoer met "14:45" kon niet correct worden opgeslagen
— het systeem ondersteunde alleen hele uren. Onderzocht: 8 bestanden
raakten `start_hour`/`end_hour`, waarvan er bij nader inzien maar 2
(`chat/route.ts`, `predictions/route.ts`) de tijden daadwerkelijk
tóónden — de andere 4 (`weekly`/`predictions` haalden `life_events` op
zonder het ooit te gebruiken — dode code) hadden geen wijziging nodig.

- **SQL**: `start_minute`/`end_minute`, puur additief, default 0 —
  bestaande rijen ongewijzigd
- **Formulieren**: hele-uur-dropdowns vervangen door native
  `<input type="time">` — betere mobiele UX, ondersteunt nu minuten
- **AI-invoer**: de v2.4.192-beperking ("rond af naar een heel uur")
  is niet meer nodig — prompt, validatie en opslag ondersteunen nu
  echte minuten-precisie
- **Weergave**: `formatUur()` en de twee echte consumenten tonen nu
  de werkelijke minuten i.p.v. hardcoded ":00"

**Gevalideerd:** weergave met minuten (14:45), gedrag-behoudendheid
zonder minuten (blijft :00), en de time-input-parsing — alle drie
correct. `npx next build` compileert zonder fouten.

### Weer, Pauzeer/Hervat, en een echte Today Engine-bugfix (v2.4.182-184)

**v2.4.182 — Meer weergegevens.** Gevoelstemperatuur, luchtvochtigheid,
windstoten, UV-index, neerslagkans (%) toegevoegd — allemaal al
beschikbaar bij Open-Meteo. Op verzoek: tik-om-uit-te-klappen op het
bestaande weerblok op Home, geen apart scherm.

**v2.4.183 — Pauzeer/Hervat-knop voor trainingsplannen.** Ontstaan uit
een testbehoefte (Today Engine Scenario A forceren zonder SQL), bleek
een genuine, blijvende functie — ook nuttig bij een blessure of
prioriteitswissel. Hergebruikt de bestaande `'abandoned'`-status, geen
nieuw datamodel. Beide specialisten (Cycling + Running), consistent.

**v2.4.184 — Today Engine's Trainer AI-vangnet bevestigd gefixt.**
Root cause: `VERCEL_URL` (gebruikt voor de interne server-naar-server-
aanroep naar Trainer AI) wijst naar een deployment-specifieke URL die
kan afwijken van het domein waar de gebruiker daadwerkelijk op inlogt
— cookie-domain-mismatch maakte de sessie-cookie ongeldig bij die
interne aanroep. Fix: `baseUrl` nu afgeleid van het daadwerkelijke
inkomende verzoek (`req.nextUrl.origin`) i.p.v. gegokt. **Bevestigd
werkend in de praktijk** (niet alleen in code) — Scenario A (Trainer
AI-vangnet) toont nu een echte, persoonlijke sessie i.p.v. de eerdere
foutmelding.

**Alle drie de Today Engine-acceptatietesten nu bevestigd:**
1. ✅ Trainer AI-vangnet (v2.4.184-fix, bevestigd in de praktijk)
2. ✅ Coach Score verversen na check-in/import/activiteit (v2.4.178, bevestigd)
3. ⏳ ACWR-correctie bij een echt hoge belastingsverhouding — wacht nog op een natuurlijke gelegenheid, geen actie nodig

### Eén bron van waarheid: Coach-tekst leest nu ook de Today Engine (v2.4.174)

**Gevonden architectuurprobleem:** de Today Engine-kaart op Home
(`api/today`) en de AI-gegenereerde Coach-tekst (`api/coach`,
`api/action-plan`) gebruikten tot nu toe **twee verschillende bronnen**
om te bepalen wat er vandaag getraind wordt. De kaart las
`training_plan_sessions` rechtstreeks (correct, getest). De Coach-tekst
leidde het af uit trainingsgeschiedenis + de specialist-samenvatting —
geen directe koppeling aan het exacte schema van vandaag. In
uitzonderlijke gevallen hadden kaart en tekst dus kunnen afwijken.

**Chirurgische fix, geen herontwerp van de hele context-opbouw:**
`api/coach/route.ts` en `api/action-plan/route.ts` roepen nu ook
`bepaalTodayPlan()` aan (dezelfde Today Engine-functie als de kaart) en
voegen het resultaat toe als een expliciet, gezaghebbend contextblok —
"gebruik dit, verzin geen ander sessietype". De bestaande, werkende
context-bronnen (Garmin/Morning Health/weer/dagboek/etc.) blijven
ongewijzigd — dit is één extra, prioritair blok, geen vervanging van
de hele pijplijn.

**Vastgelegde prioriteitenvolgorde voor de rest van de Coach Context
Engine** (op verzoek, zodat elke laag op een stabiele onderliggende
architectuur steunt):
1. ✅ Master Coach leest de Today Engine — **afgerond, v2.4.174**
2. Coach Agenda afronden als centrale contextbron (Fase 2, groter — externe agenda's/schoolvakanties, nog niet gebouwd)
3. Rowing Specialist bouwen (grote klus — vergelijkbaar met de hele Running-pariteitsronde)
4. Strength Specialist
5. Kettlebell Specialist
6. Multi-sport Orchestrator (`TodaySchedule`) — pas zinvol zodra er daadwerkelijk meerdere specialisten zijn om tussen te kiezen

**Gevalideerd:** conditielogica getest (toont het blok bij een echte
sessie of rustdag, niet bij de lege fallback-staat), `npx next build`
compileert zonder fouten.

### Coach Context UI — v2.4.173

**De Levensgebeurtenissen-pagina volledig herbouwd** — niet langer
alleen een registratiescherm, maar een venster naar de Context
Resolver. Statuskaart bovenaan toont letterlijk wat de Coach ziet
("Vakantiemodus actief — Dagdienst tijdelijk gepauzeerd"), i.p.v. dat
je losse events zelf moest interpreteren.

**Twee écht kapotte functies gevonden en gefixt tijdens het bouwen:**
1. `end_date` bestond al in het datamodel en werd al verzonden vanuit
   het formulier, maar er stond **nergens een invoerveld** voor —
   altijd `null`. De kalenderweergave gebruikte `end_date` bovendien
   alleen bij `type === 'vakantie'`, hardcoded voor andere types.
2. **`fetchTodaysLifeEvents()`** (de query die de Coach-context voedt)
   filterde eenmalige events op "laatste 2 dagen sinds aanmaken" —
   niet op de echte periode. Een vakantie van 20 juli–3 augustus zou
   daardoor na een paar dagen automatisch uit de Coach-context
   verdwijnen. Nu een echte periode-check (`start_date <= vandaag <=
   end_date`).

**Architectuurregel bewust bewaakt:** het formulier bepaalt nooit de
intelligentie (trainingModifier/-30% etc. blijft exclusief bij de
Resolver, afgeleid van de modus) — de gebruiker stelt alleen de ruwe
impact-scores in (herstel/stress/slaap, 0-3), in vriendelijke taal
(Geen/Licht/Matig/Zwaar), niet als kale cijfers.

**Snelknoppen:** Vakantie/Ziek blijven `life_events` (levenscontext),
Blessure linkt door naar `/injuries` (eigen, rijkere module — geen
dubbele registratie), Wedstrijd bewust niet toegevoegd (hoort bij Goal
Engine's `target_date`, geen nieuw datamodel-eiland).

**Gevalideerd:** periode-logica getest met de exacte grens (dag na
`end_date` correct inactief), plus de 4 eerder afgesproken
Resolver-scenario's opnieuw bevestigd na de output-herstructurering
(`lifeContext`/`healthContext`/`trainingImpact`).

### Toekomstvisie — Coach Context Engine (vastgelegd, nog niet gebouwd)

**Bewust NIET "Coach Agenda" genoemd** — dat klinkt als kalender, maar
de visie is groter: de Coach begrijpt tijd, verplichtingen, gezondheid,
training en omgeving samen.

```
Coach Context Engine (visie)
Toekomstige inputs:
- Apple Calendar / Google Calendar / Outlook (optioneel, aanvullend — CoachOS blijft leidend)
- Schoolvakanties per regio
- Nationale feestdagen (automatisch)
- Automatisch-gegenereerde periodiserings-events (Build/Recovery/Peak Week)
- Wedstrijden/evenementen als eigen categorie
Allemaal opgelost tot: Athlete Daily Context
```

**Bewust nog niet gebouwd:** externe agenda-sync (OAuth), schoolvakantie-
API, een eigen Agenda-UI, nieuwe database-tabellen. Elk daarvan is een
apart project, geen uitbreiding van vandaag.


```
Coach (bepaalt doel + beperkingen)
    ↓
Bibliotheek (levert beschikbare oefeningen)
    ↓
Trainer AI (assembleert beste sessie uit bibliotheek)
    ↓
Workout (wordt uitgevoerd)
    ↓
Evaluatie (RPE + mood → exercise_records)
    ↓
Coach (leert van data → past advies aan)
```

## Versiehistorie (recent)
- v2.4.119 — Documentatie: Strava API-blokkade bevestigd in de praktijk (403 op bestaande sync) — Garmin-alternatief geactualiseerd, geen code-wijziging
- v2.4.118 — Vermogenscurve-datalaag: Strava-integratie (nog te committen — code klaar, maar extern geblokkeerd door Strava's beleidswijziging, zie v2.4.119)
- v2.4.117 — Roadmap-document bijgewerkt: vermogenscurve Garmin-pad ✅ afgerond, was nog als "niet gestart" vermeld
- v2.4.115 — Vermogenscurve-datalaag: UI afgerond (grafiek op Grafieken-scherm) — Garmin-pad volledig compleet, Strava nog open
- v2.4.114 — Fix: Coach Call reageerde niet meer — gevolg van v2.4.112's coach_call_items-opruiming, expliciete lege-staat + auto-expire toegevoegd
- v2.4.113 — Fix: "Wissen mislukt" — tweede gemiste FK (garmin_activity_imports), foutmelding nu specifiek i.p.v. generiek
- v2.4.112 — Fix: Garmin-import gebruikte altijd vandaag als datum i.p.v. de datum uit het TCX-bestand + activiteiten wissen (met bevestiging)
- v2.4.111 — Herziening: Activiteiten weer eigen navigatietab (was sectie binnen Voortgang sinds v2.4.93), balk nu 6 tabs
- v2.4.110 — Vermogenscurve-datalaag: Garmin-integratie (berekening + SQL + tcx-parser + import-route), raakt bestaande import-code, Strava/UI volgen apart
- v2.4.109 — Nieuw: vermogenscurve-datalaag-spec.md (TE TOETSEN) — Garmin-data blijkt al beschikbaar, Strava-scope al voldoende, kleiner dan aangenomen
- v2.4.108 — Roadmap volledig bijgewerkt (Fase 1-2 afgerond) + FTP-geschiedenis (bewust vroeg toegevoegd) + Fase 3 uitgebreid met vermogenscurve-datalaag-plan
- v2.4.107 — Cycling Roadmap Fase 2i: Progress Center ("het hart van de Hub") — consolideert doelvoortgang/records/Memory/W-kg, geen nieuwe berekeningen
- v2.4.106 — Cycling Roadmap Fase 2f: Ritanalyse (vermogens-/hartslagzone, cadans, schema-vergelijking op datum) — AI legt uit, beslist niets
- v2.4.105 — Cycling Roadmap Fase 2e: Records (langste rit, hoogtemeters, vermogen, snelheid, grootste week) — onderdeel van Grafieken, geen los Records Center
- v2.4.104 — Fix: staafdiagram wekelijks volume onzichtbaar (CSS percentage-hoogte in geneste flex → pixel-hoogte)
- v2.4.103 — Cycling Roadmap Fase 2d: Grafieken (volume, geschatte CTL/ATL/TSB via Coggan-methode, geen nieuwe dependency)
- v2.4.102 — Cycling Roadmap Fase 2c: Dashboard (Vandaag-training + doelvoortgang op de Cycling Hub)
- v2.4.101 — Fix: tijdzone-bug in 8 datum-berekeningen (5 bestanden), gedeelde isoDatum() in @/utils — bestaand plan aanbevolen opnieuw te genereren
- v2.4.100 — Cycling Roadmap Fase 2b: Trainingskalender (maandgrid, kleur-gecodeerd, eerlijk over rolling horizon)
- v2.4.99 — Adaptive Training Plan Engine sub-stap 3/3 (UI): planningsscherm met Vandaag+uitleg en komende sessies — Fase 2a hiermee volledig afgerond
- v2.4.98 — Fix: prompttoon Coach-uitleglaag, "stiekem"-woordkeuze verwijderd, neutrale/feitelijke instructie
- v2.4.97 — Adaptive Training Plan Engine Fase 2 (Coach-uitleglaag): AI legt uit, beslist niets — stille volume-reductie nu expliciet benoemd
- v2.4.96 — Adaptive Training Plan Engine Fase 1 (Engine zonder AI): Plan Generator + Daily Adjustment Layer, rolling horizon, prioriteitsketen afgedwongen in code
- v2.4.95 — Nieuw: adaptive-training-plan-decision-contract-v1.md (TE TOETSEN) — prioriteitsketen afdwingbaar, 5 reason codes, sessie-levenscyclus, volledige tabelvelden
- v2.4.94 — Fix: 4 verouderde route-verwijzingen na navigatie-herstructurering (Cycling/Running Hub-terugknop, activiteit-detail, na-Garmin-import-knop)
- v2.4.93 — Navigatie-architectuur v1.0 volledig geïmplementeerd (alle 5 stappen incl. Stap 5, want balk had 6 items niet 5) — Specialisten-tab nieuw, Activiteiten in Voortgang, Instellingen via Home
- v2.4.92 — Nieuw: adaptive-training-plan-engine-spec.md (Fase 2a compacte spec, TE TOETSEN) — rolling horizon, 5 triggers, rolverdeling Master Coach/Specialist
- v2.4.91 — Cycling Roadmap Fase 1 (Cycling Foundation): Cycling Profile + deterministische zone-berekening (Coggan-methode), geen nieuwe tabel, birth_date op algemeen profiel
- v2.4.90 — Navigatie-architectuur v1.0 GOEDGEKEURD (navigation-architecture-v1.md) — 5-tabs-structuur (Home/Coach/Trainer/Specialisten/Voortgang), implementatie nog niet gestart
- v2.4.89 — CoachOS Cycling Specialist Roadmap v1.0 GOEDGEKEURD (cycling-specialist-roadmap-v1.md) — Fase 1-3 vastgelegd, volgende stap: Fase 1 Cycling Foundation
- v2.4.88 — Doelen-UI voor de Goal Engine: 3-staps-flow (doeltype → preset/eigen → belangrijkheid), specialist-schaalbaar ontworpen
- v2.4.87 — Rechtzetting: importance (gebruiker, stabiel) vs. calculated_urgency (Goal Engine, dynamisch) — waren in v2.4.86 ten onrechte vermengd
- v2.4.86 — Goal Engine (Global vs. Specialist Goals) + Decision Engine regels 4-5, raakt api/coach/route.ts (additief) — Decision Engine nu compleet
- v2.4.85 — Decision Engine: directe testroute, echte data, geen wijziging aan bestaand gedrag
- v2.4.84 — Decision Engine geïmplementeerd, raakt api/coach/route.ts (additief) — lost op wanneer meerdere specialisten samen te veel volume adviseren
- v2.4.83 — Running: tweede specialist, bewijst herbruikbaarheid — grotendeels invuloefening, api/coach/route.ts bleek al generiek
- v2.4.82 — Memory Engine sub-stap 5/5 LAATSTE: terugkoppeling naar Coach Layer — Memory Engine hiermee volledig afgerond
- v2.4.81 — Fix: specialist_summary kwam soms null binnen (max_tokens 800→1200, veld naar voren in JSON-schema)
- v2.4.80 — CoachPolicy/SpecialistSummary: Master Coach-kant, raakt api/coach/route.ts (additief, eigen try/catch, contract nu volledig gesloten)
- v2.4.79 — CoachPolicy/SpecialistSummary: specialist-kant geïmplementeerd (deterministische policy-generator + Cycling Coach respecteert grenzen)
- v2.4.78 — Nieuw: specialist-coach-policy.md (CoachPolicy/SpecialistSummary-contract) + up-to-date sweep van specialist-api.md, specialist-decision-engine.md, README
- v2.4.77 — "Hoe werkt CoachOS": nieuwe sectie over Specialisten, vaste afspraak om dit voortaan bij te houden bij gebruikersgerichte wijzigingen
- v2.4.76 — Memory Engine sub-stap 4/5: Confidence Engine (stijging bij bevestiging, geleidelijke decay, auto-deprecate)
- v2.4.75 — Memory Engine sub-stap 3/5: Coach Layer voorstelt kandidaat-inzichten, gaat verplicht door Learning Engine
- v2.4.74 — Memory Engine sub-stap 2/5: Learning Engine (candidate→active promotie, deterministisch)
- v2.4.73 — Memory Engine sub-stap 1/5: SQL specialist_memory (opslagstructuur, nog geen Learning/Confidence-logica)
- v2.4.72 — specialist-api.md: 5 aanscherpingen na review (AI-nuance, rekenbibliotheek, Global/Specialist Goals, Capability-Hub, Decision Engine in Fase 4-flow) — versieclaims geverifieerd (HTTP 200 + live tests)
- v2.4.71 — Herstel: docs/specialist-api.md gereconstrueerd (goede-trouw, controle aanbevolen) — alle 6 ontwerpdocumenten nu daadwerkelijk in de repo
- v2.4.70 — Specialist Lifecycle Engine (SUGGESTED/DORMANT/RETURNING-banners) + herstel ontbrekend specialist-memory.md (v3, Maturity Engine toegevoegd)
- v2.4.69 — Navigatie-integratie: "Mijn Coaches"-rij in de Coach-tab, /coach/cycling nu bereikbaar zonder handmatige URL
- v2.4.68 — Capability Registry + Cycling Hub-UI (Cycling-referentie, stap 5/5, LAATSTE STAP — referentie-implementatie compleet)
- v2.4.67 — Fase 3 Cycling Coach Layer, eerste AI-call (Cycling-referentie, stap 4/5), personality volledig hergebruikt
- v2.4.66 — Fase 2b Cycling Analysis Engine (Cycling-referentie, stap 3/5), volledig deterministisch
- v2.4.65 — Specialistlaag-tests verplaatst naar bestaande /debug-pagina (AppShell, geen navigatie-problemen), losse pagina overbodig
- v2.4.64 — Testpagina herbouwd: ingebouwd inlogformulier, geen navigatie meer (isoleert of navigatie zelf de trigger was)
- v2.4.63 — Service worker TIJDELIJK volledig uitgeschakeld (disable: true) — v2.4.62 loste het probleem niet volledig op
- v2.4.62 — Fix: pagina reset zichzelf willekeurig (skipWaiting: true → false in service-worker-config)
- v2.4.61 — Fase 2a Data Layer (Cycling-referentie, stap 2/5)
- v2.4.60 — Fase 1 Specialist Registry (Cycling-referentie, stap 1/5) + tijdelijk testschermpje
- v2.4.59 — SQL: specialist_profiles + specialist_analyses (eerste code van het specialistlaag-traject)
- v2.4.58 — 6 nieuwe illustraties (#22-27) + alle 24 bestaande retroactief gecomprimeerd (23,5MB → 1,5MB)
- v2.4.57 — Gewicht nu ook live bijstelbaar tijdens de actieve set (was alleen tempo, v2.4.56)
- v2.4.56 — Tempo-keuze (Slow/Normaal/Fast) nu ook in Archief, consistent met Trainer AI/Bibliotheek
- v2.4.55 — NIEUW: "Ververs schema"-knop, doorbreekt dubbele (server+client) cache
- v2.4.54 — Gewicht + tempo nu ook instelbaar in trainingsoverzicht (vóór starten), plus highlight-consistentie-fix
- v2.4.53 — Tempo-afwijking nu ook zichtbaar voor coach (vereist 2 nieuwe kolommen)
- v2.4.52 — Fix: gewicht-advies-bug in exercise_records + coach geeft nu commentaar op afwijking (vereist nieuwe kolom)
- v2.4.51 — NIEUW: Coach adviseert kettlebell-gewicht + tempo, gebruiker kan afwijken (advies + gebruikt naar coach)
- v2.4.50 — Tempo (Slow/Normaal/Fast) nu meegestuurd naar coach bij Trainer AI/Bibliotheek
- v2.4.49 — Kettlebell-gewichten uitgebreid: 14-16-20 → 14-16-20-24-28-32 (3-koloms grid)
- v2.4.48 — Fix: Slow/Normaal/Fast-tempoknoppen leken niet te reageren (visuele highlight-bug)
- v2.4.47 — Build-fix: SessionStatus-type-fout in Finish Tone-effect
- v2.4.46 — Professionele soundset (Polar/Garmin-stijl) + nieuwe Finish Tone bij volledige training-afronding
- v2.4.45 — Fix: eindsignaal ontbrak bij Trainer AI/Bibliotheek (geluid nu via losse useEffect i.p.v. in setState-updater)
- v2.4.44 — TCX-bestand nu links en standaard geselecteerd bij Garmin-activiteit-import
- v2.4.43 — Activiteiten in bottom-nav (6e tab, horizontaal scrollbaar) + Strava-consolidatie naar /activities
- v2.4.42 — TCX-import overschrijft nu i.p.v. te weigeren bij duplicaat (geen nieuwe Coach Call)
- v2.4.41 — NIEUW: Route-kaart bij activiteiten (Leaflet + OpenStreetMap), nieuwe detailpagina /activities/[id]
- v2.4.40 — Consolidatie: 3 importwegen → 1, kapotte oude GPX/TCX-route (lap-bug) verwijderd
- v2.4.39 — Snelheid, cadans en watts nu ook zichtbaar op Activiteiten-kaartjes
- v2.4.38 — Bekijk activiteiten-knop bij Garmin-import + hoogtemeters-veldnaam-fix
- v2.4.37 — TCX-import: extra velden (max cadans/watts/snelheid, hoogtemeters) voor rijkere coach-analyses
- v2.4.36 — Fix: Garmin-activiteit-import-pagina kon niet scrollen (geen AppShell, geen eigen scroll-container)
- v2.4.35 — Fix: TCX-import gaf 413 bij lange activiteiten (parsen nu client-side, geen payload-limiet meer)
- v2.4.34 — NIEUW: Audio (Tick/Eindsignaal/Starttoon) voor beide trainingssystemen, gedeelde workout-sound.ts
- v2.4.33 — Kleurprincipe consistent: Trainer AI/Bibliotheek volgt nu hetzelfde rood-principe als Archief
- v2.4.32 — Fix: pauze in Archief bevroor het cijfer niet (weergave-bug sinds v2.4.30)
- v2.4.31 — Fix: Archief-timer werd niet rood bij laatste 3 seconden (rust/countdown)
- v2.4.30 — Workout Engine REBUILD ook toegepast op Archief (eigen flowregels: 5s alleen 1e set, dan direct door)
- v2.4.29 — Workout Engine REBUILD Fase 1+2: drift-vrije timer-engine + vereenvoudigde flow (geen sound nog)
- v2.4.28 — Fix: idempotency-check toegevoegd aan TCX-import (voorkomt duplicaten)
- v2.4.27 — Build-fix: ongeldige export verwijderd uit garmin-activity-tcx/route.ts
- v2.4.26 — NIEUW: Blessures-archief met volledige historie (vereist nieuwe kolom, zie changelog)
- v2.4.25 — NIEUW: TCX-import (bewezen sportherkenning) gecombineerd met screenshot in één pagina
- v2.4.24 — Fix: Garmin-activiteit-import faalde op check constraint (source-waarde gecorrigeerd)
- v2.4.23 — NIEUW: Garmin-activiteit-import als alternatief voor Strava (vereist nieuwe tabel, zie changelog)
- v2.4.22 — REBUILD: Strava sync timeout + duidelijke feedback, v1.8.5 versienummer gefixt
- v2.4.21 — Verfijning: Training blijft bovenaan vanuit Home, herstelt scroll vanuit Archief
- v2.4.20 — DEFINITIEVE FIX: scrollpositie-herstel in AppShell zelf (v2.4.19 loste het verkeerde probleem op)
- v2.4.19 — Fix: scroll-positie reset bij terugkeer naar Training (INCORRECTE analyse, zie v2.4.20)
- v2.4.18 — Navigatie-fix uitgebreid: Archief-overzicht + Trainingsbibliotheek-sessie (3 extra plekken)
- v2.4.17 — Fix: navigatie Archief-oefening bouwde dubbele geschiedenis op (router.back/replace i.p.v. push)
- v2.4.16 — Illustratie-koppeling: 6 nieuwe WebP-oefeningen (#16-21), totaal 24/102
- v2.4.15 — Fix: coach-geheugen/patroonherkenning werkte nooit (userId nu meegegeven aan /api/memory)
- v2.4.14 — Eén versienummer (package.json leidend) + automatische update-detectie met lichte gezondheidscheck op Home
- v2.4.13 — Debug Panel uitgebreid tot volledige gezondheidscheck (29 tabellen, 17 routes, schrijftest)
- v2.4.12 — DEFINITIEVE FIX: NOT NULL constraint activity_session_id opgeheven (SQL, geen code) — hele Coach Call-traject afgesloten
- v2.4.11 — Fix: retry checkte nooit het .error-veld — echte Postgres-foutmelding nu zichtbaar in logs
- v2.4.10 — Build-fix: TypeScript-fout in withRetry-helper (v2.4.9 deployde niet)
- v2.4.9 — Retry-logica Stap 3 + nieuwe debug-check "Coach Call Integriteit"
- v2.4.8 — Fix: bibliotheek-Coach Call onzichtbaar na eerdere afgeronde call (zelfde bug als v2.4.3, andere tak) + gevonden root cause Supabase pooler-timeout
- v2.4.7 — Opruiming: dubbele oefening-databron verwijderd (exercises.ts + oefening/[id]/page.tsx)
- v2.4.6 — Coach Call: OR-drempel Strava (30 min of afstand) + altijd triggeren bij bibliotheek-training
- v2.4.5 — Illustratie-koppeling 12 kettlebell-oefeningen + Dropbox afgeschaft, WebP vanaf #16
- v2.4.4 — Fix: "Genereer advies" hangt bij trage/onbereikbare Open-Meteo (timeout toegevoegd)
- v2.4.3 — Fix: Strava Coach Call niet zichtbaar na voltooide call (zie sectie Coach Call Systeem + changelog)
- v2.4.2 — Timer + countdown fix Archief losse-oefening flow
- v2.4.1 — Archief standalone losse oefening flow
- v2.4.0 — Exercise Illustraties + Archief
- v2.3.6 — Weerbericht
- v2.3.5 — Coach Rapport op aanvraag (Fase 3B)
- v2.3.4 — Coach Trendanalyse Fase 3A
- v2.3.3 — Progressie Fase 2
- v2.3.2 — Persoonlijke Records
- v2.3.1 — Exercise Records
- v2.3.0 — Drill Libraries Running/Rowing/Cycling
- v2.2.2 — Scroll en navigatie fixes
- v2.2.1 — Relaxation pagina + categorische herstelbibliotheek
- v2.2.0 — Recovery Bibliotheek
- v2.1.2 — Alle mobility schemas in herstelbibliotheek
- v2.1.1 — Mobility filter in route
- v2.1.0 — Mobility Bibliotheek
- v2.0.4 — Mobility bug fix

Volledige details per versie: zie [docs/changelog.md](docs/changelog.md)

## Coach-routes — geverifieerde architectuur
Alle filters actief in `src/app/api/training/today/route.ts`:
- filterKettlebell() → kettlebellContext
- filterStrength() → strengthContext
- filterOpCoachDoel() → bodyweightContext
- filterMobility() → mobilityContext
- filterRecovery() → recoveryContext
- filterRunning() → runningContext
- filterRowing() → rowingContext
- filterCycling() → cyclingContext

Trainer AI mag ALLEEN kiezen uit de gefilterde lijst.

---

## Start Prompt — MASTER SYSTEM v7.3

Je bent een senior software engineer, software architect, systems designer en iPhone-first applicatiespecialist.

Dit systeem is volledig ontworpen voor iPhone-first ontwikkeling. Desktop-workflows zijn optioneel en nooit verplicht.

**Kernregels:**
- Geen aannames, geen gokken, geen verzonnen bestanden/API's/routes
- Ontbrekende informatie → STOP, stel exact één gerichte vraag
- Nooit implementeren vóór analyse, tenzij expliciet gevraagd
- Stabiliteit boven snelheid
- Bestaande functionaliteit beschermen
- Eerst uitbreiden, daarna vervangen

**Volgorde van waarheid:**
1. README.md
2. docs/architecture.md
3. docs/roadmap.md
4. docs/changelog.md
5. Bestaande broncode

**Implementatieregels:**
- Volledige bestanden, geen gedeeltelijke implementaties
- Bestaande stijl en naamgeving behouden
- Geen dubbele code, geen dode code, geen placeholders
- ZIP naam: volgt het formaat `<project-slug>-<type>.zip` (project-slug =
  `coachos`, altijd kleine letters, geen spaties/streepjes-varianten)

  **Type-opties:**
  - `fix` / `hotfix` / `patch` → kleine correctie (geen auto-tag)
  - `update` / `feature` / `refactor` → grote wijziging (auto-tag)
  - `docs` / `config` → documentatie/configuratie (geen auto-tag)

  **Illustraties/assets vallen onder `update` of `feature`, geen apart
  "assets"-type** — bijvoorbeeld:
  - `coachos-update.zip` → een paar nieuwe illustraties toevoegen aan `public/`
  - `coachos-feature.zip` → grote hoeveelheid nieuwe assets als onderdeel
    van een feature

  **Ongeacht het type bestand:** naam begint altijd met de exacte
  project-slug, paden in de ZIP beginnen bij de repo root (dus
  `public/exercises/naam.webp`, niet `coachos/public/exercises/naam.webp`
  en niet met een omvattende prefix-map), geen spaties/hoofdletters in de
  bestandsnaam zelf.
- Paden beginnen bij repo root: `src/app/page.tsx` niet `coachOS/src/app/page.tsx`

**iPhone-first workflow:**
- iPhone + Working Copy + GitHub + Vercel + Supabase
- Oplossingen uitvoerbaar vanaf iPhone
- Git-oplossingen compatibel met Working Copy
- Deployments geschikt voor Vercel

**Beslissingsprioriteit:** Stabiliteit → Architectuur → Onderhoudbaarheid → Schaalbaarheid → Prestaties → Functionaliteit → Snelheid

---

## Illustratie Prompt Sjabloon

Voor het genereren van oefening-illustraties via GPT. Vaste tekst — pas alleen **[OEFENINGNAAM]** en de **5 fasen** aan per oefening.

---

Maak een spritesheet-afbeelding voor een trainingsapp die de oefening **[OEFENINGNAAM]** uitlegt in 5 stappen, naast elkaar in één afbeelding.

**Stijl:**
- Mannequinpop / 3D-skeletfiguur stijl: ovaal hoofd, ronde gewrichtsbollen, dikke cilindrische ledematen met zachte gradient-belichting (licht-naar-donker) voor een ruimtelijk, "draaibaar 3D-model" effect
- Lichte, neutrale achtergrond (wit of zeer lichtgrijs, geen scène of decor)
- Donkere lijnkleur voor de contouren (slate/navy, geen zwart)
- Subtiele slagschaduw onder de voeten van elke pose
- Een groene gestippelde lijn die de hoofd-naar-schouder houding aangeeft
- Het gewicht (kettlebell/dumbbell) duidelijk zichtbaar in de juiste positie per stap, donkergrijs/zwart metaal kleur

**Layout:**
- 5 poses naast elkaar in een horizontale rij, gelijke afstand
- Onder elke pose: een nummer (1-5) en een korte titel (max 2 woorden)
- Geen extra decoratie, geen logo's, geen tekst behalve stapnummers en titels
- Consistente schaal en oriëntatie — zelfde personage, zijaanzicht

**Functioneel:**
- De 5 poses moeten de daadwerkelijke beweging duidelijk laten zien
- Zichtbare verandering in gewrichtshoeken tussen elke stap
- Geen anatomische fouten, realistische proporties

**De 5 fasen zijn:** [FASE 1 — FASE 2 — FASE 3 — FASE 4 — FASE 5]

**Bestandsnaam:** `[oefening-id].webp`
**Bestandsformaat:** WebP (voorkeur), witte achtergrond, minimaal 1200px breed.
Levert GPT een PNG op (gebruikelijk): Claude converteert deze naar WebP
(PIL/Pillow, quality=90) vóór levering — geen aparte vraag nodig, dit is
een vaste stap in de workflow (zie sectie "Illustratie Workflow" hierboven).

---

Bestandsnaam-conventie: `[oefening-id].png` in `/public/exercises/`.
Naamgeving: kebab-case van de oefeningnaam, **zonder** `kb-` prefix en zonder
categorie-prefix (bijv. "Sumo Deadlift" → `sumo-deadlift.png`). De eerste vier
bestanden (`kettlebell-deadlift.png`, `kettlebell-swing.png`,
`kettlebell-press.png`, `kettlebell-clean.png`) zijn legacy-namen van vóór
deze conventie — die blijven ongewijzigd.

Voorbeeld: Kettlebell Swing → `kettlebell-swing.png` (legacy)
Voorbeeld: Sumo Deadlift → `sumo-deadlift.png` (huidige conventie)
