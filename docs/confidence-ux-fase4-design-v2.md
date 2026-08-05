# CoachOS Platform Design — Confidence UX (Fase 4)

**Versie 2.0 — Status: Proposed, geen code**
**Bron: docs/workout-completion-platform-adr-v1.md, Fase 4. Vervangt
v1.1 volledig — fundamentele koerswijziging: geen nieuw "Coach Card"-
component, maar hergebruik van het bestaande Coach Call-systeem
(gebruiker, 5 augustus 2026: "Coach Call is de enige gebruikers-
interface").**

**Wat v1.1 fout had, expliciet benoemd:** v1.1 stelde een generiek,
nog-te-bouwen "Coach Card"-component voor, met een open vraag of
zoiets al bestond. Het antwoord is: er bestaat iets veel rijkers en
al-werkends — **Coach Call** (`coach_calls`/`coach_call_items`,
statusmachine, home-banner, evaluatiepagina, drie bestaande triggers).
Een nieuw component bouwen zou exact de fout zijn geweest die dit
platform overal probeert te vermijden: een tweede, parallelle
communicatielaag naast een al-bestaande.

---

## 1. Architectuurregel — één communicatielaag

**Er bestaat maar één plek waar CoachOS met de gebruiker praat: Coach
Call.** Niet Workout Matcher, niet een aparte popup, niet een nieuw
"Match Review"-scherm. Een lage-confidence-match wordt een **vierde
trigger-bron** voor Coach Call, naast de drie die al bestaan
(Strava-activiteit, Garmin-activiteit-import, Archief/
Trainingsbibliotheek).

```
Workout Matcher → berekent confidence (ongewijzigd)
        │
        ▼
Match Review Service → beslist ALLEEN of dit een Coach Call-item wordt
        │
        ▼
Coach Call (bestaand systeem, NIET nieuw) → toont de vraag
        │
        ▼
Gebruiker → bevestigt of wijst af, via de bestaande evaluatiepagina
        │
        ▼
Definitieve koppeling + logging
```

De Match Review Service (zie §5) blijft bestaan als concept, maar zijn
uitvoer is nu: **een nieuw item in `coach_call_items`**, niet een eigen
UI.

## 2. Confidence-regels — ongewijzigd

| Confidence | Gedrag |
|---|---|
| ≥ 90% | Automatisch koppelen. Geen Coach Call-item. |
| 70–89% | Automatisch koppelen. Klein zichtbaar (voorstel: als losse regel in de bestaande Coach Call-evaluatie van die dag, niet als aparte melding — nog te bevestigen, zie §7). |
| < 70% | **Niet** automatisch koppelen. Nieuw Coach Call-item: "Was dit de geplande [sport]training van vandaag?" — Ja/Nee. |

## 3. Databaseschema — de kern van de integratie, en de kern van het risico

**`coach_call_items` bedient nu al twee brontypes met wederzijds
nullable foreign keys** (geverifieerd, README, sectie Coach Call
Systeem):
- Strava/Garmin-items: `activity_session_id` gevuld, `training_result_id` NULL
- Bibliotheek-items: `training_result_id` gevuld, `activity_session_id` NULL

Een match-confirmation-item is **een derde vorm**: gaat over een
bestaande `activity_sessions`-rij (dus `activity_session_id` zou
gevuld kunnen worden — hij bestaat al, komt uit Concept2/Garmin/Strava/
Trainer AI Bridge) **en** moet weten welke `training_plan_sessions`-rij
de kandidaat is om aan te koppelen (geen van beide bestaande kolommen
dekt dat).

**Voorstel, ter beoordeling:**
- Hergebruik `activity_session_id` (bestaat al, nullable, precies het
  juiste concept — "over welke activiteit gaat dit")
- **Nieuw:** `training_plan_session_id` (nullable) — de matching-
  kandidaat. Alleen gevuld bij dit derde brontype.
- **Nieuw:** `item_type` (of vergelijkbaar) — `'evaluatie'` (bestaand
  gedrag: rating/mood/notes) vs. `'match_bevestiging'` (nieuw: Ja/Nee-
  vraag, geen rating). **Dit is niet optioneel** — zonder dit
  onderscheid weet `coach-call/page.tsx` niet welke UI te tonen per
  item, en zou een match-vraag per ongeluk als evaluatie-formulier
  gerenderd kunnen worden.

**Herhaling van de eigen, al-bestaande waarschuwing in het README**
(sectie Coach Call Systeem, expliciet zo genoteerd bij de vorige nieuwe
bron): *"Voeg bij een nieuwe Coach Call-bron altijd expliciet een
CHECK- of applicatie-validatie toe die garandeert dat minstens één van
de kolommen gevuld is, in plaats van te vertrouwen op NOT NULL op één
specifieke kolom."* — geldt hier onverkort, nu voor drie kolommen i.p.v.
twee.

## 4. Het vervaltermijn-conflict — 24 uur vs. 7 dagen, niet stilzwijgend gekozen

**v1.1 stelde 7 dagen voor. Het bestaande Coach Call-systeem gebruikt
al 24 uur** (bevestigd: *"Een call die 24 uur oud is zonder voltooiing
wordt automatisch expired"*). Dit is een echt conflict, geen
formaliteit:

- **Optie A — 24 uur, consistent met het bestaande systeem.** Simpelst,
  geen nieuwe uitzondering in de statusmachine. Risico: een lage-
  confidence-match die je pas na een lang weekend zonder telefoon ziet,
  verloopt voordat je 'm kan bevestigen.
- **Optie B — 7 dagen, alleen voor dit itemtype.** Vergt een
  itemtype-afhankelijke expiry-check in plaats van één vaste 24u-regel
  voor de hele `coach_call`. Grotere wijziging aan de bestaande
  statusmachine dan Optie A.
- **Niet onderzocht binnen dit document:** of een hele `coach_call`
  (met meerdere items, mogelijk gemengde typen) één vervaltermijn moet
  hebben, of dat items individueel kunnen verlopen los van de call
  waar ze bij horen. De huidige statusmachine (`pending → partial →
  completed`/`expired`) redeneert op het niveau van de hele call, niet
  per item — een itemtype met een eigen termijn past daar niet
  vanzelfsprekend in.

**Dit document kiest hier bewust niet voor — vergt een beslissing vóór
implementatie**, want het raakt de kern van een systeem met een lange,
pijnlijke bug-geschiedenis (v2.4.3/8/9/11/12, alle vier rond exact
deze statusmachine).

## 5. Match Review Service — verantwoordelijkheid, ongewijzigd t.o.v. v1.1

- **Doet:** op basis van de confidence bepalen of er een Coach Call-
  item aangemaakt moet worden (< 70%), en met welke inhoud; de
  logging-gebeurtenis (§6) bijwerken zodra de gebruiker via de
  bestaande Coach Call-flow reageert
- **Doet NOOIT:** confidence zelf berekenen/herberekenen, opnieuw
  matchen, de matcher aanpassen, **een eigen UI tonen** (nieuw
  t.o.v. v1.1 — dat was precies de fout)

**Confidence bepaalt nog steeds alleen "hoeveel vertrouwen", nooit
"wat gebeurt er"** — ongewijzigd t.o.v. v1.1.

**Gebruiker als hoogste autoriteit — ongewijzigd, nu met een concrete
technische garantie:** een "Nee" op een match-confirmation-item is
een normale Coach Call-item-afronding (zelfde patroon als een
ingevulde evaluatie) — er is geen apart mechanisme dat dit later zou
kunnen overschrijven, want er is maar één communicatielaag.

## 6. Logging — vier gebeurtenissen, ongewijzigd t.o.v. v1.1

`matched_auto` / `matched_user_confirmed` / `matched_user_rejected` /
`expired`, op `training_plan_sessions` naast `match_confidence`/
`match_reden` (bestaan al). Geen wijziging — dit deel van v1.1 was al
correct en wordt niet geraakt door de Coach Call-integratie.

## 7. Wat dit document NIET vastlegt — vergt beslissing/verkenning

1. **24u vs. 7 dagen (§4)** — belangrijkste open punt
2. **Exacte schema-wijziging** (§3) — welke kolomnamen, wel/geen
   `CHECK`-constraint, hoe `coach-call/page.tsx` het `item_type`-
   onderscheid rendert
3. **De 70-89%-"kleine melding"** — wordt dat ook een Coach Call-item
   (zwaarder dan nodig voor iets waar geen actie bij hoort), of een
   lichtere, elders al bestaande notificatie-vorm? Niet onderzocht.
4. **Wat er met de `activity_sessions`-rij gebeurt bij "Nee"** — blijft
   ongewijzigd een normale, ongekoppelde activiteit (zelfde aanname
   als v1.1, nog niet expliciet bevestigd)

## Volgende stap

Eerst §4 (vervaltermijn) en §3 (schema) beslissen — dat zijn de twee
punten die daadwerkelijk in de bestaande, kwetsbare Coach Call-
statusmachine snijden. Pas daarna implementatie, en dan het liefst in
kleine stappen met tussentijds testen (zelfde discipline als de rest
van deze week), gezien de bekende geschiedenis van stille fouten in
precies dit systeem (v2.4.9-12).
