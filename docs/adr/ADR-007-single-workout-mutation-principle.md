# ADR-007 — Single Workout Mutation Principle

**Status:** Geaccepteerd
**Datum:** 4 augustus 2026
**Versie geïntroduceerd:** v2.4.265

## Context

Tijdens een architectuur-review (4 augustus 2026) werd de vraag gesteld
of Rowing, Running en Cycling nu allemaal "dezelfde weg" gebruiken. Dat
onderzoek legde een reëel risico bloot: de Workout Platform's
Adaptation Engine (nieuw, v2.4.227+) en de al-bestaande Daily
Adjustment Layer (ouder, v2.4.97+) konden **onafhankelijk van elkaar**
dezelfde workout verkleinen:

- Daily Adjustment Layer, trigger `fatigue_detected`: bij laag herstel
  werd een geplande sessie op databaseniveau vervangen door een
  lichtere variant, duur `× 0.6`.
- Adaptation Engine, kruis-sport-signaal: bij belasting door een
  andere sport werd de (mogelijk al door de eerste laag verkleinde)
  workout ALSNOG verkleind — kortere warming-up, minder herhalingen,
  lagere intensiteit.

Bij een gebruiker die zowel laag herstel als een actief kruis-sport-
signaal had, werd dezelfde training dus **twee keer** verkleind, met
een cumulatief effect dat niet meer herleidbaar was tot een enkele,
uitlegbare reden. Dit gaat rechtstreeks in tegen CoachOS' kernprincipe
van *explainable AI* — een gebruiker moet altijd kunnen zien waaróm
een training is zoals hij is.

## Beslissing

**Binnen CoachOS mag slechts één component de uiteindelijke workout
daadwerkelijk wijzigen: de Adaptation Engine binnen het Workout
Platform.** Alle overige componenten — de Daily Adjustment Layer,
Universal Athlete Platform, en toekomstige bronnen (weer, slaap,
blessures, voeding) — leveren uitsluitend **signalen**, nooit een
directe mutatie van een workout.

Elke signaalbron spreekt hetzelfde, gedeelde contract:

```typescript
interface AdaptationSignal {
  source: 'fatigue' | 'cross_sport' | 'sleep' | 'weather'
  severity: 'low' | 'medium' | 'high'
  confidence: number       // 0-100
  reden: string             // mens-leesbare toelichting
  metadata?: Record<string, unknown>
}
```

De Adaptation Engine ontvangt een **array** van deze signalen, en past
de downscale-mechaniek (kortere warming-up, minder herhalingen, lagere
intensiteit) hooguit **één keer** toe, ongeacht hoeveel signalen er
tegelijk binnenkomen. De toelichting combineert alle bijdragende
redenen in één, samenhangende tekst.

## Gevolgen

**Daily Adjustment Layer (`adjuster-core.ts`) — trigger
`fatigue_detected` gewijzigd:**
- Muteert de database niet meer.
- Retourneert voortaan een `AdaptationSignal` (`fatigueSignaal`) naast
  de bestaande `aanpassingen`-array.

**Daily Adjustment Layer — triggers `missed_session`,
`injury_protection`, `goal_change` — ONGEWIJZIGD:**
Deze blijven database-mutaties. Ze zijn *planning*-beslissingen
(welke sessie staat er, welk type) — geen intensiteit-downscale, en
overlapten niet met het gevonden risico. Ze passen niet 1-op-1 in het
AdaptationSignal-contract zonder een grotere, aparte herziening
(bijv. hoe representeer je "vervang deze sessie volledig door een
ander type" als signaal, i.p.v. als concrete database-actie).

**Workout Builder-routes (Rowing/Running/Cycling `/training-plan/
workout`) — allemaal bijgewerkt:**
Verzamelen nu zowel het kruis-sport-signaal (Universal Athlete
Platform) als het fatigue-signaal (Daily Adjustment Layer) in één
array, vóór één enkele aanroep van `pasWorkoutAan()`.

**Cross-Sport Bridge (`cross-sport-bridge.ts`):**
`bepaalKruisSportSignaal()` retourneert nu een `AdaptationSignal`
(`source: 'cross_sport'`) i.p.v. een eigen ad-hoc vorm. Severity wordt
bepaald door het aantal belaste dimensies (1=low, 2=medium, 3+=high),
confidence door het gemiddelde van de bijdragende Universal Athlete
State-velden.

## Wat hierdoor NIET verandert

- Rowing, Running en Cycling behouden al hun bestaande kennis,
  analyses, policies en triggers (missed_session/injury_protection/
  goal_change functioneren exact zoals voorheen).
- De downscale-*magnitude* zelf (-30% warmup, -1 herhaling, -1 zone)
  is ongewijzigd — geen nieuwe wiskunde, alleen een garantie dat het
  hooguit één keer wordt toegepast.
- Rowing blijft de referentie-implementatie voor de Workout Platform-
  koppeling; Running en Cycling volgen hetzelfde patroon.

## Wat bewust NIET in deze fase zit

- **Intelligence Platform** — de bredere visie waarin ALLE
  signaalbronnen (inclusief toekomstige: slaap, weer, blessures,
  voeding) worden samengevoegd tot één "Overall Adaptation Level" vóór
  de Adaptation Engine ze ziet. Deze ADR legt het CONTRACT vast
  (`AdaptationSignal`) waarmee die laag later gebouwd kan worden,
  zonder de bestaande aanroepers te hoeven wijzigen — maar de laag
  zelf bestaat nog niet.
- **Learning Rules Engine-signalen** als eigen `source`-type — nog
  niet aangesloten op dit contract.
- Missed_session/injury_protection/goal_change omzetten naar signalen
  — apart, groter traject, geen onderdeel van dit gevonden risico.

## Alternatieven overwogen

**Optie A — "Als laag 1 iets deed, mag laag 2 niets meer doen":**
Verworpen. Creëert een impliciete afhankelijkheid tussen twee losse
systemen (wie heeft voorrang, waarom is een signaal genegeerd, hoe
test je dat, wat gebeurt er bij een vierde specialist).

**Optie B — "Laat beide lagen gewoon onafhankelijk aanpassen":**
Verworpen. Dit is exact het gevonden probleem — leidt tot
niet-uitlegbare, cumulatieve verlagingen.

**Optie C (gekozen) — signalen-only, één centrale mutator:** Sluit
aan bij de al-bestaande platformfilosofie (Context Platform/
Performance Platform/Universal Athlete Platform verzamelen allemaal
alleen, ze beslissen niet) en houdt de architectuur schaalbaar voor
toekomstige specialisten en signaalbronnen.
