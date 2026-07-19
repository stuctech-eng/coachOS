# CoachOS Cycling Specialist Roadmap v1.0

**Status: FASE 1-2 VOLLEDIG AFGEROND (v2.4.91-107) — Fase 3 nog niet gestart**

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

## Fase 1 — Cycling Foundation ✅ v2.4.91

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

### 2a. Adaptive Training Plan Engine ⭐ kern ✅ v2.4.92-99
**Vergt eerst een eigen, apart ontwerpdocument.** Input: CoachPolicy,
Recovery/HRV/Body Battery/Stress/Slaap, beschikbare tijd, weer,
historische trainingen, Goal Engine, Memory Engine, Confidence Engine.
Output: automatisch meerweeks trainingsplan (macro → meso → micro →
week → dag), met expliciete uitleg per aanpassing ("waarom vandaag deze
training"). **Gerealiseerd:** spec + Decision Contract, Plan Generator +
Daily Adjustment Layer (deterministisch), Coach-uitleglaag (AI), UI.

### 2b. Trainingskalender ✅ v2.4.100
Dag/week/maand-weergave: gepland, uitgevoerd, gemist, automatisch
verplaatst, rustdagen, taper, herstelweek, wedstrijden. Afhankelijk van
2a. **Nog niet gebouwd binnen 2b:** taper/herstelweek/wedstrijden-
weergave specifiek — de kalender toont wel alle sessies, maar nog geen
aparte visuele markering voor taper-weken of wedstrijddagen (die laatste
vergt Fase 3, Event Engine).

### 2c. Cycling Dashboard ✅ v2.4.102
Vandaag (coachadvies, herstel, belasting, volgende training,
doelvoortgang — dat laatste rechtstreeks uit de Goal Engine, zie Fase 1)
+ deze week/maand (uren, km, hoogtemeters, vermogen). **Gerealiseerd:**
"volgende training" + "doelvoortgang" als nieuwe kaarten; belasting/
vermogen/km bestonden al sinds de oorspronkelijke Cycling Hub (v2.4.68).

### 2d. Grafieken ✅ v2.4.103-104
FTP-ontwikkeling, vermogenscurve (5s/15s/30s/1min/5min/10min/20min/
30min/60min), CTL/ATL/TSB (Coggan-methode), Training Load, HR, cadans,
snelheid, hoogtemeters, consistency.

**Eerlijk, wat NIET gerealiseerd is uit deze oorspronkelijke lijst:**
- **Vermogenscurve** (5s t/m 60min) — vergt seconde-voor-seconde
  vermogensdata, die niet wordt opgeslagen. Niet gebouwd.
- **FTP-ontwikkeling over tijd** — er wordt alleen een huidig FTP-getal
  bijgehouden, geen geschiedenis. Niet gebouwd (zie ook 2i).
- **HR/cadans-grafieken als aparte trends** — niet gebouwd; HR/cadans
  worden wel per rit getoond (bestaande activiteiten-detail), niet als
  trendgrafiek.

**Wel gerealiseerd:** wekelijks volume, CTL/ATL/TSB (als gedocumenteerde
schatting op basis van gemiddeld vermogen i.p.v. NP — expliciet zichtbaar
in de UI), Training Load via die schatting.

### 2e. Records ✅ v2.4.105
Automatisch: beste inspanningen per duur (5s t/m 60min), langste rit,
meeste hoogtemeters, snelste klim, grootste week/maand/jaar. **Geen los
"Records Center"** — onderdeel van Dashboard/Grafieken.

**Eerlijk, wat NIET gerealiseerd is:** "beste inspanning per duur"
(5s/30s/1min/5min/20min/60min) — zelfde beperking als de vermogenscurve
bij 2d, vergt data die niet bestaat. **Wel gerealiseerd:** langste rit
(km + tijd apart), meeste hoogtemeters, hoogste vermogen (max_watts,
wél beschikbaar per rit), hoogste gemiddelde snelheid, grootste week.

### 2f. Ritanalyse ✅ v2.4.106
Na elke rit: wat ging goed, wat kan beter, pacing, cadans, hartslag,
vermogen, was het volgens schema, is extra herstel nodig, wordt het plan
aangepast. **Eerlijke beperking:** "volgens schema" matcht op datum, geen
expliciete activiteit-koppeling.

### 2g. Coach-verdieping ✅ FORMEEL BEVESTIGD (geen nieuwe code)
Gebruikt **uitsluitend bestaande infrastructuur** — Memory Engine
(v2.4.73-82), Goal Engine (v2.4.86-88), CoachPolicy (v2.4.79-80),
SpecialistSummary (v2.4.79-80). Geen nieuwe engine nodig — deze fase was
al voltooid vóórdat de roadmap zelf werd geschreven, hier alleen formeel
als zodanig vastgelegd. Rijkere toepassing zichtbaar in de Coach-
uitleglaag (v2.4.97-98) en Ritanalyse (v2.4.106), die deze infrastructuur
allebei rechtstreeks hergebruiken.

### 2h. Master Coach-integratie ✅ FORMEEL BEVESTIGD (geen nieuwe code)
Bevestiging van het bestaande contract (`api/coach/route.ts` leest
`SpecialistSummary`, sinds v2.4.80) — geen nieuwe architectuur nodig.
Getest en bevestigd werkend deze sessie (FTP-doel kwam zichtbaar terug
in het dagelijkse Master Coach-advies, zie changelog rond v2.4.86-88).

### 2i. Progress Center ✅ v2.4.107
Eén centrale plek waar alles samenkomt: FTP, W/kg, doelvoortgang,
persoonlijke records, Memory-inzichten, coach-samenvatting. **Eerlijke
beperking:** FTP-ontwikkeling over tijd wordt niet getoond — er bestaat
geen FTP-geschiedenis, alleen een huidig getal.

---

## 🎉 Fase 2 volledig afgerond

Alle negen sub-fasen (2a t/m 2i) zijn nu bevestigd — hetzij door nieuwe
code (2a-2f, 2i), hetzij door formele bevestiging dat bestaande
infrastructuur de behoefte al dekte (2g, 2h). De Cycling Coach is
hiermee, zoals beoogd, veranderd van analysemodule naar volwaardige
digitale wielrencoach.

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

| Fase | Onderdeel | Status | Versie |
|---|---|---|---|
| 1 | Cycling Foundation | ✅ Afgerond | v2.4.91 |
| 2a | Adaptive Training Plan Engine | ✅ Afgerond | v2.4.92-99 |
| 2b | Trainingskalender | ✅ Afgerond | v2.4.100 |
| 2c | Cycling Dashboard | ✅ Afgerond | v2.4.102 |
| 2d | Grafieken | ✅ Afgerond (met gaten, zie sectie 2d) | v2.4.103-104 |
| 2e | Records | ✅ Afgerond (met gaten, zie sectie 2e) | v2.4.105 |
| 2f | Ritanalyse | ✅ Afgerond | v2.4.106 |
| 2g | Coach-verdieping | ✅ Formeel bevestigd (bestaande infrastructuur) | — |
| 2h | Master Coach-integratie | ✅ Formeel bevestigd (bestaat sinds v2.4.80) | v2.4.80 |
| 2i | Progress Center | ✅ Afgerond (zonder FTP-trend, zie sectie 2i) | v2.4.107 |
| 3 | Uitbreidingen | Bewust nog niet gestart | — |

**Fase 1 en Fase 2 zijn hiermee volledig afgerond.** Drie bewuste,
eerlijk gevlagde gaten staan open (vermogenscurve, FTP-geschiedenis,
duur-specifieke records) — alle drie vergen data die nu niet wordt
opgeslagen, geen bouwfout maar een bewuste, uitgestelde keuze.

**Volgende stap, indien gewenst:** Fase 3 (Uitbreidingen) — Event
Engine, Zwift/Wahoo/Hammerhead-integraties, of de drie eerlijk-gevlagde
gaten alsnog dichten (vergt eerst nieuwe datastructuur, bijv. FTP-
geschiedenis bijhouden of seconde-voor-seconde vermogensdata opslaan).
