# CoachOS Cycling Specialist Roadmap v1.0

**Status: GOEDGEKEURD — routekaart, nog geen code voor Fase 1-3**

Definitieve versie, na overleg. Vervangt het eerdere concept
(`cycling-specialist-bouwplan.md`, TE TOETSEN). Aanpak: geen ene
gigantische oplevering, maar een reeks afgeronde fases waarbij elke fase
direct bruikbaar is.

---

## Vaste principes voor dit hele traject

1. **Elke fase eerst ontworpen, dan pas gebouwd.** Fase 2a (Adaptive
   Training Plan Engine) krijgt vóór implementatie een eigen, apart
   compact ontwerpdocument — dat is de kern van de hele roadmap en
   verdient de meeste zorgvuldigheid.
2. **Eén centrale bron van waarheid per soort data — geen duplicatie.**
   Zie de expliciete "al bestaand"-lijst in Fase 1 hieronder. Elke
   volgende fase controleert dit patroon opnieuw vóór er nieuwe velden
   bij komen.
3. **AI rekent nooit.** Elke TSS/CTL/ATL/vermogenscurve/periodiserings-
   berekening is deterministisch. TSS/CTL/ATL volgen de **publiek
   gedocumenteerde Coggan-methode** — expliciet geen namaak van
   TrainingPeaks' propriëtaire implementatie.
4. **Kleine, testbare leveringen.** Elke fase in sub-stappen, niet in
   één keer.
5. **Hergebruik bestaande patronen** (Data Layer/Analysis Engine,
   CoachPolicy, Goal Engine, Memory Engine) — geen nieuwe engines waar
   een bestaande al voldoet.

---

## Fase 1 — Cycling Foundation

**Doel:** alle basisgegevens verzamelen die de coach nodig heeft, één
keer goed, zodat latere fasen niet steeds een nieuw instellingenveldje
hoeven toe te voegen.

### Cycling Profile — definitieve, niet-dubbele veldenlijst

**Nieuw:**
- FTP
- Max hartslag (persoonlijke baseline)
- **Geboortedatum** (`birth_date`) — bewuste keuze, zie onderbouwing
  hieronder
- Vermogensmeter / hartslagmeter / cadanssensor / smarttrainer / Zwift
  (aanwezig: ja/nee, elk apart)
- Trainingsdagen (welke dagen van de week beschikbaar)
- Beschikbare uren per week

**Bewust NIET toegevoegd — bestaat al elders, hergebruiken:**
- Gewicht → `profiles.weight` / `health_metrics.weight`
- Lengte → `profiles.height`
- Rusthartslag → `health_metrics.resting_hr`
- Ervaringsniveau → `profiles.experience_level`

**Bewust NIET toegevoegd — vermijdt een derde bron van waarheid:**
- "Belangrijkste doel" — **geen apart veld.** De Cycling Coach haalt het
  actieve Cycling-doel met de hoogste `importance` rechtstreeks op uit de
  al-bestaande Goal Engine (`haalGoalsMetProgress`). Getoond in het
  Cycling Dashboard (Fase 2), wijzigbaar via de bestaande doelen-UI —
  niet via het Cycling Profile. Eén centrale bron van waarheid:
  `user_goals`.
- "Belangrijkste wedstrijd" — zelfde redenering: dit wordt een
  Cycling-scoped doel/event (Fase 3, Event Engine), geen los profielveld.

**Geboortedatum vs. leeftijd, onderbouwing:**
`profiles.age` is een getal dat handmatig veroudert — een geboortedatum
levert automatisch actuele leeftijd, leeftijdscategorieën,
leeftijdsafhankelijke hartslagzones, Masters-categorieën, en correcte
berekeningen over meerdere jaren, zonder onderhoud. **Migratiepad:**
`birth_date` wordt de nieuwe bron van waarheid; `age` blijft tijdelijk
bestaan en wordt **dynamisch berekend** voor weergave totdat een
gebruiker zijn geboortedatum invult (backwards compatible, geen
verplichte harde overgang).

### Automatisch berekend (deterministisch, uit Cycling Profile + Analysis Engine)
- Vermogenszones
- Hartslagzones
- Trainingszones
- Intensiteitszones

---

## Fase 2 — Cycling Coach Professional

**Het moment waarop de Cycling Coach verandert van analysemodule naar
volwaardige digitale wielrencoach.** Eén samenhangend leverblok,
opgesplitst in sub-stappen (2a t/m 2i), niet in losse "Centers" die
feitelijk al bestaande infrastructuur zouden dupliceren.

### 2a. Adaptive Training Plan Engine ⭐ kern
**Vergt eerst een eigen, apart ontwerpdocument.** Input: CoachPolicy,
Recovery/HRV/Body Battery/Stress/Slaap, beschikbare tijd, weer,
historische trainingen, Goal Engine, Memory Engine, Confidence Engine.
Output: automatisch meerweeks trainingsplan (macro → meso → micro →
week → dag), met expliciete uitleg per aanpassing ("waarom vandaag deze
training").

### 2b. Trainingskalender
Dag/week/maand-weergave: gepland, uitgevoerd, gemist, automatisch
verplaatst, rustdagen, taper, herstelweek, wedstrijden. Afhankelijk van
2a.

### 2c. Cycling Dashboard
Vandaag (coachadvies, herstel, belasting, volgende training,
doelvoortgang — dat laatste rechtstreeks uit de Goal Engine, zie Fase 1)
+ deze week/maand (uren, km, hoogtemeters, vermogen).

### 2d. Grafieken
FTP-ontwikkeling, vermogenscurve (5s/15s/30s/1min/5min/10min/20min/
30min/60min), CTL/ATL/TSB (Coggan-methode), Training Load, HR, cadans,
snelheid, hoogtemeters, consistency.

### 2e. Records
Automatisch: beste inspanningen per duur (5s t/m 60min), langste rit,
meeste hoogtemeters, snelste klim, grootste week/maand/jaar. **Geen los
"Records Center"** — onderdeel van Dashboard/Grafieken.

### 2f. Ritanalyse
Na elke rit: wat ging goed, wat kan beter, pacing, cadans, hartslag,
vermogen, was het volgens schema, is extra herstel nodig, wordt het plan
aangepast.

### 2g. Coach-verdieping
Gebruikt **uitsluitend bestaande infrastructuur** — Memory Engine,
Goal Engine, CoachPolicy, SpecialistSummary. Geen nieuwe engine, wel
rijkere toepassing ervan in de dagelijkse coaching.

### 2h. Master Coach-integratie
Bevestiging/verdieping van het bestaande contract (sinds v2.4.80) — geen
nieuwe architectuur, wel volledige benutting ervan binnen Fase 2a-2g.

### 2i. Progress Center
**Toevoeging uit het overleg.** Eén centrale plek waar alles samenkomt
wat een wielrenner regelmatig wil bekijken: FTP-ontwikkeling, gewicht,
W/kg, trainingsbelasting, doelvoortgang, persoonlijke records,
consistency, streaks, Memory-inzichten ("je reageert goed op
bloktraining"), coach-samenvattingen. Dit wordt het feitelijke "hart"
van de Cycling Hub — niet losse grafieken, maar één ontwikkelingsoverzicht.

---

## Fase 3 — Uitbreidingen (pas daarna)

Expliciet later, geen onderdeel van v1.0-scope:
- Event Engine (Gran Fondo, toertochten, tijdritten, taper, piekweek)
- Zwift-, Wahoo-, Hammerhead-integraties
- Nutrition Specialist
- Triathlon Specialist
- Race Planner
- Live Coaching

---

## Samenvattend overzicht

| Fase | Onderdeel | Status | Afhankelijk van |
|---|---|---|---|
| 1 | Cycling Foundation | Niet gestart | — |
| 2a | Adaptive Training Plan Engine | Niet gestart (eerst spec-document) | Fase 1 |
| 2b | Trainingskalender | Niet gestart | 2a |
| 2c | Cycling Dashboard | Niet gestart | 2a, Goal Engine (bestaat al) |
| 2d | Grafieken | Niet gestart | 2a-2b, bestaande Analysis Engine |
| 2e | Records | Niet gestart | 2d |
| 2f | Ritanalyse | Niet gestart | 2a |
| 2g | Coach-verdieping | Niet gestart | Memory/Goal Engine (bestaan al) |
| 2h | Master Coach-integratie | Deels bestaat al (v2.4.80) | 2a-2g |
| 2i | Progress Center | Niet gestart | 2a-2h |
| 3 | Uitbreidingen | Bewust niet gepland | Fase 1-2 |

**Volgende stap:** Fase 1 (Cycling Foundation) implementeren — kleinste,
laagste-risico fase, geen afhankelijkheden.
