# CoachOS Guardian Mode Analysis — Coach Call Trigger-verantwoordelijkheid

**Versie 1.2 — Status: Analyse, GEEN implementatie**
**Herzien: v1.1 voegde de Coach Decision Engine toe (Master Coach
beslist niet zelf). v1.2 maakt de beslisregel concreet: trigger is een
coachwaardige gebeurtenis, niet activiteit-aanwezigheid — zie de
nieuwe sectie direct hieronder Vraag 4.**
**Aanleiding:** Architectuurbesluit "Coach Call is géén evaluatiescherm"
(gebruiker, 5 augustus 2026) — *"Niet implementeren voordat
onderstaande regels zijn vastgelegd"* + expliciete instructie: eerst
uitgaan van hergebruik/consolidatie, niet van nieuwbouw.

**Methode:** vier vragen uit de opdracht, één voor één beantwoord met
code als bewijs. Geen enkele regel code gewijzigd.

---

## Vraag 1 — Alle plaatsen waar Coach Calls worden aangemaakt

**Vier plekken, niet één centrale — zelf al een bevinding, los van de
Master-Coach-vraag:**

| Plek | Voor | Bijzonderheid |
|---|---|---|
| `api/coach-calls/route.ts` (POST) | Strava-activiteiten | Enige met een expliciete drempel (afstand OF duur) |
| `api/health/garmin-activity-tcx/route.ts` | Garmin TCX-import | Geen drempel — altijd |
| `api/health/garmin-activity-vision/route.ts` | Garmin foto-import | Geen drempel — altijd, code-comment verwijst naar "dezelfde heropen-logica als v2.4.8/v2.4.12" |
| `api/training/complete/route.ts` | Bibliotheek/coach-plan-trainingen | Geen drempel — altijd, met retry-logica (v2.4.9) |

**Vier bijna-identieke, los onderhouden implementaties** van dezelfde
"zoek bestaande call voor deze datum, maak aan of voeg item toe, heropen
indien nodig"-logica — met verwijzingen naar minstens vijf eerdere
bugfixes (v2.4.3/6/8/9/11/12) verspreid over deze vier bestanden. Dit
is een consolidatie-kans op zichzelf, onafhankelijk van de vraag of de
trigger-beslissing moet verhuizen.

## Vraag 2 — Welke voorwaarden gelden nu

**Geverifieerd: geen enkele van de vier kent een planning-check.**
- Strava: alleen een activiteits-drempel (5km/20km/5km of 30 min, per
  sport) — puur "was dit substantieel genoeg", geen "hoorde dit bij het
  plan"
- Garmin (TCX/Vision) en Bibliotheek: **onvoorwaardelijk** — elke
  activiteit/afronding triggert een call

**Wat dit betekent voor de architectuurwens:** de huidige triggers
weten dus letterlijk niets over `training_plan_sessions` — geen van
de vier vergelijkt "wat er gebeurde" met "wat er gepland stond." De
gewenste functionaliteit (afwijking-detectie) bestaat op dit niveau
niet — moet sowieso ergens nieuw toegevoegd worden, ongeacht waar.

## Vraag 3 — Welke informatie is beschikbaar op dat moment

Bij alle vier: de net-geïmporteerde/afgeronde activiteit (sport, duur,
datum) en de gebruiker-id. **Niet beschikbaar op dat moment, zonder
extra query's:** het trainingsplan van die dag, CoachPolicy, recente
trainingsgeschiedenis — die worden pas elders (Master Coach) verzameld.

## Vraag 4 — Kan de bestaande Master Coach dit al, of ontbreekt de logica echt?

**Genuanceerd antwoord, met bewijs — dit is de kern van de analyse.**

`api/coach/route.ts` (746 regels, grondig gelezen) heeft **al**:
- **Het volledige TodayPlan** via `bepaalTodayPlan()` (Today Engine) —
  titel, duur, intensiteit, bron (specialist/Trainer AI/rust), reden,
  trainingsfase. Dit is precies "wat er gepland stond."
- **Al werkende afwijking-detectie**, alleen op een ander niveau: kruis-
  sport-aanpassingen worden al proactief uitgelegd (*"Je zware
  roeitraining van gisteren... daarom vandaag lichter"*), en er bestaat
  al logica voor Trainer AI-parameterafwijkingen (ander kettlebell-
  gewicht/tempo dan geadviseerd) — het patroon "vergelijk verwacht vs.
  actueel, benoem het niet-veroordelend, alleen als relevant" **bestaat
  al**, alleen nog niet toegepast op "stond er sport X gepland en deed
  de sporter sport Y" of "stond er niets gepland en werd er toch
  getraind."
- **Leest** bestaande `coach_calls` (voor evaluatiecontext in de
  prompt) — **schrijft ze nooit**. Aanmaken gebeurt uitsluitend in de
  vier import-routes.

**Wat er dus concreet ontbreekt, precies afgebakend:**
1. Een vergelijking "TodayPlan vs. binnengekomen activiteit" op het
   niveau van *sport/aanwezigheid*, niet alleen parameters — bijv.
   "stond er rust gepland en er is toch getraind", "stond sport X
   gepland, er kwam sport Y binnen", "meerdere activiteiten op één
   dag." Dit patroon bestaat nog niet, ook niet in een andere vorm.
2. Een schrijf-pad van Master Coach náár `coach_calls` — bestaat
   nergens, want `api/coach/route.ts` heeft nu alleen een lees-rol.
3. **Timing:** `api/coach/route.ts` draait synchroon, op aanvraag
   (wanneer de gebruiker de Coach-pagina opent) — geen achtergrondtaak.
   Een Master-Coach-beslissing "moet ik een call starten" zou dus pas
   ontstaan de **eerstvolgende keer** dat deze route draait na een
   activiteit, niet direct bij import. Gegeven het al eerder
   vastgestelde ontbreken van cron-infrastructuur is dit waarschijnlijk
   acceptabel (consistent met hoe de rest van het platform al werkt),
   maar is een echt gedragsverschil t.o.v. nu (waar de call meteen bij
   import ontstaat) — geen instant meer, wel "bij eerstvolgende
   Coach-interactie."

**Conclusie op vraag 4, HERZIEN na overleg — Master Coach beslist
NIET zelf.** Eerste versie van dit document stelde voor dat
`api/coach/route.ts` de beslissing zelf neemt. **Fout:** dat geeft
Master Coach twee verantwoordelijkheden (coachen + workflow starten) —
exact het patroon dat dit platform overal elders vermijdt (Coach
beslist, Specialist vertaalt; Training Engine beslist, Workout Builder
bouwt; Workout Builder beslist, Workout Player voert uit).

**Correcte laagverdeling — Decision/Execution gescheiden, zoals overal
elders:**

```
Activity Import (alle bronnen, incl. Concept2 — zie hieronder)
        │
        ▼
Workout Matching → Performance Update → Context Update
        │
        ▼
Coach Decision Engine (NIEUW, klein — geen dubbele coach-rol)
        │
        ├── Coach Call nodig? (de vergelijkingsfunctie uit deze analyse)
        ├── Training aanpassen?
        ├── Specialist informeren?
        ├── Geen actie?
        ▼
Master Coach — voert uit: "start dit gesprek"
        │
        ▼
Coach Call
```

De bouwstenen die deze analyse al vond (TodayPlan, het bestaande
afwijking-detectiepatroon) verhuizen dus niet ín `api/coach/route.ts`,
maar naar een **eigen, kleine Decision Engine** — die Master Coach
vervolgens alleen een opdracht geeft ("voer dit gesprek"), zelf geen
gesprek voert of workflow start. Master Coach blijft daarmee zuiver
uitvoerend richting de gebruiker, precies zoals de rest van de
architectuur al werkt.

**Alle imports gelijk maken, i.p.v. Concept2 bijtrekken naar de
anderen.** De eerdere nevenbevinding (Concept2 maakt geen Coach Call)
zou niet opgelost moeten worden door Concept2 óók coach-call-logica te
geven — juist andersom: **alle** bronnen (Garmin/Strava/Concept2/
Apple/Bibliotheek) worden gelijk en minimaal: activiteit opslaan,
klaar. Geen enkele importroute maakt ooit nog een Coach Call aan. De
Decision Engine, die pas ná Performance/Context Update draait, heeft
dan sowieso alle informatie — inclusief Concept2-activiteiten, zonder
dat Concept2 zelf iets over Coach Call hoeft te weten.

---

## Samenvatting — impact- en regressierisico (Guardian Mode, laatste stap)

**Root cause van de huidige situatie:** Coach Call-triggers zijn
organisch, per import-route, toegevoegd (Strava eerst met een drempel,
later Garmin/Bibliotheek onvoorwaardelijk) — nooit vanuit één
ontwerp. Geen bug, wel een historisch gegroeide structuur die nu een
architectuurwens tegenkomt.

**Dependency-risico:** alle vier routes hebben al een documenteerde
geschiedenis van stille fouten (heropen-logica, retry-logica,
duplicaat-preventie) — verplaatsen van de aanmaak-beslissing raakt
code met een reëel refactor-risico, ook al is de nieuwe logica zelf
klein.

**Regressierisico, specifiek:** als de trigger van "direct bij import"
naar "bij eerstvolgende Master Coach-aanroep" verschuift, verandert de
**waargenomen snelheid** van Coach Call voor de gebruiker — dat is een
gedragswijziging die apart getest moet worden, niet alleen een
interne refactor.

**Impact als het NIET gebeurt:** vier plekken blijven onafhankelijk
van elkaar drijven, met risico dat een toekomstige vijfde bron
(bijv. Concept2, die momenteel GEEN coach_call-aanmaak heeft — apart
gevonden, niet in de oorspronkelijke opdracht genoemd) weer een eigen,
zesde kopie van dezelfde logica krijgt.

**Nevenbevinding, niet gevraagd maar relevant:** Concept2-sync
(`concept2/sync/route.ts`) maakt **helemaal geen** Coach Call aan —
noch drempel-gebaseerd, noch onvoorwaardelijk. Een Rowing-training via
Concept2 triggert dus nooit een evaluatie-call, in tegenstelling tot
Garmin/Strava/Bibliotheek. Onbekend of dit bewust is of een gemiste
plek — niet onderzocht binnen deze analyse, wel het vermelden waard
vóór er iets verplaatst wordt.

## Ontwerpregel — de trigger is een coachwaardige gebeurtenis, geen activiteit

**Toegevoegd na een laatste verscherping (gebruiker, 5 augustus
2026) — dit maakt de beslisregel van de Coach Decision Engine voor het
eerst concreet, niet alleen "bepaalt of nodig."**

> *"Coach Calls worden nooit getriggerd door een activiteit of import
> op zichzelf. Ze worden uitsluitend gestart wanneer de Coach, op
> basis van de volledige context (planning, uitvoering, herstel,
> context en belasting), vaststelt dat een gesprek toegevoegde waarde
> heeft voor coaching of herstel. Een normale, volgens verwachting
> uitgevoerde training resulteert niet automatisch in een Coach Call."*

**Fundamenteel verschil met de huidige, bestaande logica:** nu is het
`Import → Coach Call` (een evaluatieformulier bij elke kwalificerende
activiteit). De nieuwe visie is `Activiteit → Matching → Performance
→ Recovery → Context → Specialisten → Coach analyseert alles → iets
opvallends? → JA → Coach Call` — pas ná volledige analyse, niet als
directe reactie op import.

**Coach Call = JA (voorbeelden, niet uitputtend):**
rustdag gepland maar toch getraind · zware training gepland, veel
minder gedaan · lichte training gepland, extreem veel meer gedaan ·
andere sport dan gepland · twee zware trainingen op één dag ·
herstelscore laag maar toch intensief getraind · blessureprotocol
genegeerd · training meerdere keren overgeslagen · belasting sterk
hoger/lager dan verwacht · specialist heeft de training sterk
aangepast

**Coach Call = NEE:** training volgens planning, belasting binnen
verwachting, herstel normaal, geen bijzonderheden — dan geen vraag,
alles verloopt automatisch.

**Waarom dit méér is dan een trigger-verplaatsing:** dit verandert wat
Coach Call fundamenteel ís — van een automatisch evaluatieformulier
(nu) naar een echt coachinstrument (nieuw). Sluit aan bij het al
bevestigde principe elders in deze analyse: Master Coach kent als
enige het volledige plaatje (planning/uitvoering/herstel/HRV/
belasting/context/specialist-advies) — pas ná het samenbrengen daarvan
kan de Decision Engine vaststellen of er iets is om te bespreken.

**Consequentie voor de eerder in dit document voorgestelde
vergelijkingsfunctie (Vraag 4):** die was nog smal geformuleerd
("sport-aanwezigheid vs. TodayPlan"). Met deze verscherping is de
Decision Engine breder — moet ook Recovery/HRV, blessureprotocol-
naleving en cumulatieve belasting (meerdere sessies/dag, herhaald
overslaan) kunnen meewegen, niet alleen "kwam de sport overeen." Dat
raakt meer bestaande signaalbronnen (CoachPolicy, Recovery Engine,
blessure-data) dan de oorspronkelijke, kleinere versie van dit
document veronderstelde — nog steeds consolidatie (die bronnen bestaan
al), maar de Decision Engine zelf moet er meer van samenbrengen dan
eerst gedacht.

## Architectuurregel (definitief, gebruiker 5 augustus 2026)

*"Coach Calls mogen nergens meer rechtstreeks worden aangemaakt door
import-routes of trainingsroutes. Alle bronnen registreren uitsluitend
data. Daarna draait één centrale Coach Decision Engine die bepaalt of
een Coach Call nodig is. De Master Coach voert vervolgens alleen het
gesprek uit en start zelf geen workflows. Daarmee blijft de
architectuur consistent met het fundamentele CoachOS-principe:
beslissen en uitvoeren zijn altijd gescheiden verantwoordelijkheden."*

## Advies (analyse, geen besluit)

Gegeven vraag 4's herziene conclusie: dit is haalbaar als
consolidatie + één klein, nieuw component (Coach Decision Engine) —
niet als een nieuwe coach-brede beslissingslaag. Voorgestelde
volgorde, niet gestart:
1. Coach Decision Engine ontwerpen (klein: sport-aanwezigheid vs.
   TodayPlan, hergebruikt het al-bestaande afwijking-patroon uit
   `api/coach/route.ts` als voorbeeld, niet als locatie)
2. Schrijf-pad Decision Engine → `coach_calls` toevoegen
3. Master Coach aanpassen: voert uit op opdracht van de Decision
   Engine, i.p.v. zelf te beslissen
4. Pas daarna de vier (of vijf, incl. Concept2 die als vijfde bron
   nu ook uniform "alleen opslaan" wordt) bestaande aanmaak-plekken
   één voor één ontkoppelen — niet alle tegelijk, zelfde incrementele
   discipline als de rest van deze week
