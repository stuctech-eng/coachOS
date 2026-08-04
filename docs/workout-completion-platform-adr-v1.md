# CoachOS Platform Design — Workout Completion Platform

**Kerncomponent: Workout Matching Service**
**Versie 1.0**
**Status: Proposed — ontwerp, nog geen code**

Dit document is een platformontwerp, geen featurespec voor één specialist.
Het legt vast *waarom* dit een ontbrekende laag is, *wat* elke laag wel en
niet mag doen, en *hoe* matching sport-onafhankelijk werkt zonder
schijnprecisie. Vergt goedkeuring vóór implementatie start — zelfde
procedure als `adaptive-training-plan-decision-contract-v1.md`.

---

## 0. Aanleiding

Onderzocht op 4 augustus 2026, naar aanleiding van een vraag over de
Rowing-activiteitenflow. Bevestigd in de code (niet aangenomen):

- `training_plan_sessions.completed_activity_id` bestaat sinds v2.4.96,
  met exact het doel om een uitgevoerde activiteit aan een geplande
  sessie te koppelen.
- **Geen van de vier ingest-routes vult dit veld ooit:**
  `concept2/sync/route.ts`, `strava-activity-processor.ts`,
  `garmin-activity-tcx/route.ts`, `garmin-activity-vision/route.ts`,
  noch `training/complete/route.ts` (handmatig/bibliotheek).
- `training-plan-engine/adjuster-core.ts`, Trigger 1 (`missed_session`)
  filtert op `status = 'scheduled' AND date < vandaag AND
  completed_activity_id IS NULL`. Omdat het veld nooit gevuld wordt, is
  deze voorwaarde voor **elke** sessie van **elke** specialist altijd
  waar zodra de datum verstrijkt —ongeacht of de training daadwerkelijk
  is uitgevoerd.
- Al één keer eerlijk benoemd als lokale beperking (v2.4.106, Cycling-
  ritanalyse: *"'volgens schema' matcht op datum, niet op een expliciete
  koppeling — `completed_activity_id` wordt nergens automatisch
  ingevuld"*), maar nooit herkend als het bredere platformprobleem dat
  het is.

**Conclusie:** dit is geen bug in Rowing en geen bug in Running. Het is
een laag die in de architectuur al voorzien was (het veld bestaat, de
sessie-levenscyclus in `decision-contract-v1.md` §3 noemt `completed`
expliciet) maar nooit gebouwd is.

---

## 1. De volledige keten

```
Training Plan
      │
      ▼
Workout Platform            "Wat moet er vandaag gebeuren?"
      │
      ▼
Workout uitgevoerd          (buiten CoachOS — PM5/ErgData, Strava, Garmin, handmatig)
      │
      ▼
Activity Import             "Wat is er binnengekomen?"
      │
      ▼
Workout Matching Service    "Hoort dit bij een geplande sessie?"
      │
      ▼
Workout Completion          "De sessie is voltooid — of niet."
      │
      ▼
Performance Platform        "Wat betekent dit voor belasting?"
      │
      ▼
Universal Athlete Platform
      │
      ▼
Learning Rules Engine
      │
      ▼
Coach Memory
      │
      ▼
Master Coach
```

Elke laag hierboven bestaat al in CoachOS, behalve twee:
**Workout Matching Service** en **Workout Completion** als expliciete
stap. Zonder die twee blijft er een gat tussen "iets is geïmporteerd" en
"het plan weet dat het is uitgevoerd" — precies het gat dat vandaag
bevestigd is.

---

## 2. Eén verantwoordelijkheid per laag

Dezelfde discipline als de rest van CoachOS (Coach Agenda → Context
Resolver → Today Engine, sectie "Context Intelligence Architecture" in
het README): geen laag neemt de taak van een andere over.

### Activity Import
**Doet:** importeren, dedupliceren (bestaande prioriteitsketen: Concept2
> Garmin > Strava/Apple Health > handmatig), valideren tegen bekende
`source`-waarden.
**Mag nooit:** een trainingsplan wijzigen, een sessie als voltooid
markeren, oordelen of iets "volgens plan" was.
**Ongewijzigd:** dit is exact wat de vier bestaande ingest-routes al
doen — deze laag verandert niet, hij krijgt alleen een vaste
vervolgstap.

### Workout Matching Service *(nieuw)*
**Doet:** na elke succesvolle import — bepalen of de nieuwe
`activity_session` bij een geplande `training_plan_session` hoort,
confidence berekenen, bij voldoende zekerheid `completed_activity_id`
vullen en `status → 'completed'` zetten.
**Mag nooit:** trainingsbelasting berekenen, prestaties beoordelen, of
zelf beslissen wat de consequentie van een gemiste training is (dat
blijft bij de bestaande `adjuster-core.ts`-triggers, ongewijzigd).

### Workout Completion *(status, geen nieuwe laag)*
Het resultaat van de Matching Service — geen aparte engine, gewoon de
sessie-status zoals die al in `decision-contract-v1.md` §3 stond:
`completed`, met `completed_activity_id` gevuld.

### Performance Platform
**Doet:** trainingsbelasting, CTL/ATL/TSB — ongewijzigd, blijft precies
zoals het nu werkt. Dit document verandert er niets aan; Completion is
een noodzakelijke voorwaarde die er nu simpelweg (onbedoeld) altijd is
in plaats van soms.

### Learning Rules Engine / Coach Memory / Master Coach
Ongewijzigd. Leren en communiceren — dit document raakt alleen de vraag
die eraan voorafgaat: "is er iets gebeurd om over te leren/communiceren."

---

## 3. Matching — generiek platform, sport-specifieke criteria

**Niet hardcoded** (bijv. "duur ±20% voor alles"). In plaats daarvan:
dezelfde adapter-structuur die de Training Plan Engine al gebruikt
(`TrainingPlanSportAdapter`, zie `training-plan-engine/core.ts`) —
Core blijft generiek, elke specialist levert een eigen adapter.

```
Workout Matching Service (generiek — datum, sport, confidence-optelling)
      │
      ├── Running Matcher    (datum, afstand, duur)
      ├── Cycling Matcher    (datum, duur, afstand)
      ├── Rowing Matcher     (datum, meters, tijd)
      ├── Strength Matcher   (datum, oefening, volume)
      └── ... elke toekomstige specialist levert zijn eigen matcher
```

**Contract per Sport Matcher** (analoog aan hoe `TrainingPlanSportAdapter`
nu al `sport`, `hoogIntensiteitsType`, `verdeelSessieTypen()` etc.
levert): elke matcher krijgt de kandidaat-`activity_session` en de
kandidaat-`training_plan_session` binnen, en geeft een confidence-score
+ onderbouwing terug. De Core Service kent geen sportspecifieke velden
(geen "afstand" of "meters" in de generieke laag) — die logica hoort
volledig bij de matcher.

**Waarom niet hardcoded:** exact het argument dat vandaag al gold bij de
Rowing-baseline (2k-testtijd i.p.v. VDOT) — elke sport heeft zijn eigen,
betrouwbaarste signalen. Duur alleen is bij Strength bijna betekenisloos
(een krachttraining van 45 vs. 50 minuten zegt weinig), terwijl bij
Rowing "meters" een sterker signaal is dan tijd alleen.

---

## 4. Confidence — geen automatische harde ja/nee

Consistent met het bestaande principe ("geen schijnprecisie", al
toegepast bij de Rowing 2k-baseline en bij de Omgeving-categorie die
eerlijk leeg blijft waar geen databron bestaat).

```
Activity binnengekomen
      │
      ▼
Sport Matcher berekent confidence
      │
      ├── Hoge confidence (bijv. ≥ drempelwaarde)
      │        → automatisch gekoppeld, status = completed
      │
      └── Lage/matige confidence
               → geen automatische koppeling
               → zichtbaar als open vraag ("Was dit je geplande
                 training van vandaag?"), geen stille aanname
```

**Bewust NIET in dit document vastgelegd** (zie sectie 6): de exacte
drempelwaarde en de exacte gewichten per sport — dat is precies het
soort beslissing dat, net als bij de Adaptive Training Plan Engine,
praktijkervaring vergt in plaats van een documentkeuze vooraf.

**Precedent in de codebase:** `garmin_activity_imports.confidence_score`
bestaat al als patroon (Claude Vision-import) — dit voorstel hergebruikt
hetzelfde concept, niet een nieuw idee.

---

## 5. Database — minimale wijziging

Geen nieuwe tabel nodig voor de kernkoppeling — het veld bestaat al:

### `training_plan_sessions` (uitbreiding, niet vervanging)
| Veld | Type | Betekenis |
|---|---|---|
| `completed_activity_id` | uuid, nullable | **Bestaat al (v2.4.96).** Wordt met dit ontwerp voor het eerst daadwerkelijk gevuld. |
| `match_confidence` | numeric, nullable | *Nieuw.* Score die tot de koppeling leidde — uitlegbaarheid, geen black box. |
| `match_reden` | text, nullable | *Nieuw.* Welke matcher, welke criteria sloegen aan (bijv. `"rowing: datum+meters (Δ2%)"`). |

**Open vraag, bewust niet hier beslist:** of lage-confidence-kandidaten
ergens moeten blijven staan voor audit/debug (een lichte
`workout_match_candidates`-tabel), of dat dit voor v1 overbodige
complexiteit is. Voorstel: v1 zonder die tabel, toevoegen zodra er
concrete behoefte blijkt (zelfde pragmatiek als bij de dedup-beperking
"per datum, niet per exacte sessie" — eerst het meest voorkomende geval
dekken).

**Geen wijziging nodig** aan `adjuster-core.ts` Trigger 1
(`missed_session`) — die query is al correct geschreven tegen
`completed_activity_id IS NULL`. Hij kreeg tot nu toe alleen nooit
gevulde data te zien.

---

## 6. Wat dit document NIET vastlegt

- Exacte confidence-drempelwaarde (auto-match vs. vraag aan gebruiker)
- Exacte matchingcriteria-gewichten per sport (bijv. hoe zwaar afstand
  weegt t.o.v. duur bij Running)
- UX van de "was dit je geplande training?"-bevestigingsvraag
- Of bestaande, al-geïmporteerde historische activiteiten met
  terugwerkende kracht gematcht worden (backfill) — apart traject, geen
  onderdeel van de kernservice
- Of een audit-tabel voor lage-confidence-kandidaten nodig is (zie
  sectie 5)

Deze vergen praktijkervaring en een expliciete losse afweging, niet een
aanname vooraf — zelfde reden waarom de Adaptive Training Plan Engine
destijds drempelwaarden ook bewust buiten het contract hield.

---

## 7. Bouwvolgorde (voorstel)

```
Fase 1 — Matching Service Core, zonder AI
  Generieke service + Sport Matcher-contract + eerste matcher
  (voorstel: Rowing als referentie-implementatie — kleinste,
  meest overzichtelijke databron, Concept2 alleen)
  Volledig deterministisch, testbaar zonder AI-aanroep

Fase 2 — Overige matchers
  Running/Cycling/Strength — elk een eigen matcher-implementatie
  tegen hetzelfde generieke contract

Fase 3 — Alle vier ingest-routes aansluiten
  Concept2, Strava, Garmin (TCX + Vision), handmatig — elk roept
  na een succesvolle import de Matching Service aan

Fase 4 — Confidence-UX
  Lage-confidence-bevestigingsvraag in de UI, retrofit van
  Cycling-ritanalyse naar de expliciete koppeling i.p.v. datum-gok
```

Dit volgt dezelfde volgorde-logica als de Adaptive Training Plan Engine
destijds: eerst de deterministische kern bewijzen op één, klein
oppervlak, dan pas breed uitrollen.

---

## 8. Prioriteit t.o.v. lopend werk

Zoals besproken: dit gaat vóór verdere uitbreiding van Learning Rules/
Intelligence Platform-features, omdat die lagen straks bouwen op een
"is de sessie voltooid"-signaal dat vandaag structureel onbetrouwbaar
is. Eerst de keten sluiten, dan verder verdiepen.

---

## Volgende stap na goedkeuring

Dit document eerst toetsen (klopt de laagverdeling, klopt de
adapter-aanpak, is de confidence-aanpak akkoord) — pas daarna Fase 1
hierboven starten.
