# CoachOS Cycling Specialist Roadmap v1.0

**Status: FASE 1-2 VOLLEDIG AFGEROND (v2.4.91-107) — Fase 3 gestart: vermogenscurve Garmin-pad afgerond (v2.4.108-115), Strava-pad + overige uitbreidingen nog open**

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
training").

### 2b. Trainingskalender ✅ v2.4.100
Dag/week/maand-weergave: gepland, uitgevoerd, gemist, automatisch
verplaatst, rustdagen, taper, herstelweek, wedstrijden. Afhankelijk van
2a.

### 2c. Cycling Dashboard ✅ v2.4.102
Vandaag (coachadvies, herstel, belasting, volgende training,
doelvoortgang — dat laatste rechtstreeks uit de Goal Engine, zie Fase 1)
+ deze week/maand (uren, km, hoogtemeters, vermogen).

### 2d. Grafieken ✅ v2.4.103-104
FTP-ontwikkeling, vermogenscurve (5s/15s/30s/1min/5min/10min/20min/
30min/60min), CTL/ATL/TSB (Coggan-methode), Training Load, HR, cadans,
snelheid, hoogtemeters, consistency.

### 2e. Records ✅ v2.4.105
Automatisch: beste inspanningen per duur (5s t/m 60min), langste rit,
meeste hoogtemeters, snelste klim, grootste week/maand/jaar. **Geen los
"Records Center"** — onderdeel van Dashboard/Grafieken.

### 2f. Ritanalyse ✅ v2.4.106
Na elke rit: wat ging goed, wat kan beter, pacing, cadans, hartslag,
vermogen, was het volgens schema, is extra herstel nodig, wordt het plan
aangepast.

### 2g. Coach-verdieping ✅ FORMEEL BEVESTIGD (geen nieuwe code)
Gebruikt **uitsluitend bestaande infrastructuur** — Memory Engine,
Goal Engine, CoachPolicy, SpecialistSummary. Geen nieuwe engine, wel
rijkere toepassing ervan in de dagelijkse coaching.

### 2h. Master Coach-integratie ✅ FORMEEL BEVESTIGD (geen nieuwe code)
Bevestiging/verdieping van het bestaande contract (sinds v2.4.80) — geen
nieuwe architectuur, wel volledige benutting ervan binnen Fase 2a-2g.

### 2i. Progress Center ✅ v2.4.107
**Toevoeging uit het overleg.** Eén centrale plek waar alles samenkomt
wat een wielrenner regelmatig wil bekijken: FTP-ontwikkeling, gewicht,
W/kg, trainingsbelasting, doelvoortgang, persoonlijke records,
consistency, streaks, Memory-inzichten ("je reageert goed op
bloktraining"), coach-samenvattingen. Dit wordt het feitelijke "hart"
van de Cycling Hub — niet losse grafieken, maar één ontwikkelingsoverzicht.

**Update (v2.4.108):** FTP-ontwikkeling wordt nu wél bijgehouden —
`cycling_ftp_geschiedenis` logt vanaf nu elke FTP-wijziging. Bij 2+
datapunten toont het Progress Center een echte trend; bij minder wordt
eerlijk aangegeven dat de geschiedenis nog opgebouwd wordt.

---

## Fase 3 — Uitbreidingen (pas daarna)

Expliciet later, geen onderdeel van v1.0-scope:
- Event Engine (Gran Fondo, toertochten, tijdritten, taper, piekweek)
- Zwift-, Wahoo-, Hammerhead-integraties
- Nutrition Specialist
- Triathlon Specialist
- Race Planner
- Live Coaching

### Vermogenscurve & duur-specifieke records — eigen datalaag, bewust losgekoppeld van de Adaptive Training Engine ✅ Garmin-pad afgerond (v2.4.110/115), 🔜 Strava resteert

**Vastgelegd na vervolgoverleg (v2.4.108):** dit is niet alleen een
opslagvraagstuk, maar een **nieuwe datalaag** — de Adaptive Training
Engine (Fase 2a) blijft er volledig onafhankelijk van en hoeft niet te
wachten. Zodra deze laag er wel is, kan de engine 'm direct gebruiken
zonder dat de basisarchitectuur wijzigt.

**Update (v2.4.109-115):** twee haalbaarheidsbevindingen maakten dit
kleiner dan hierboven aangenomen — Garmin-data (TCX) bleek al
beschikbaar via de bestaande parser, alleen weggegooid; Strava's
bestaande OAuth-scope bleek al voldoende voor de streams-API. **Het
Garmin-pad is inmiddels volledig afgerond:** berekening
(`src/lib/vermogenscurve.ts`), SQL (`cycling_power_curve`), parser-
integratie (`tcx-parser.ts`), opslag bij zowel nieuwe als overschreven
imports, én de UI-grafiek op het Grafieken-scherm (v2.4.115).

**Wat dit al ontgrendelt, voor Garmin-imports sinds v2.4.110:**
- ✅ Vermogenscurve (5s t/m 60min) — zichtbaar op het Grafieken-scherm
- 🔜 Duur-specifieke records (bijv. "beste 5 minuten" apart getoond in
  de Records-kaart) — data bestaat nu, UI-koppeling nog niet gemaakt
- 🔜 Critical Power, W′-modellen — apart vervolgpunt, vergt genoeg
  datapunten over meerdere duren

**Nog te doen:**
- 🔜 **Strava-integratie** — nieuwe streams-API-aanroep in
  `strava-activity-processor.ts`, dezelfde berekening/opslag hergebruikt
- 🔜 Geen terugwerkende kracht voor activiteiten van vóór v2.4.110 (bewust,
  zie de spec)
- 🔜 Critical Power-model (apart vervolgpunt)

**Nu al wel gebouwd, ter voorbereiding (v2.4.108):** FTP-geschiedenis
(`cycling_ftp_geschiedenis`) — bewust vroeg toegevoegd, zodat er vanaf nu
data verzameld wordt, in plaats van pas wanneer deze hele datalaag
gebouwd wordt.

---

## Samenvattend overzicht

| Fase | Onderdeel | Status | Versie |
|---|---|---|---|
| 1 | Cycling Foundation | ✅ Afgerond | v2.4.91 |
| 2a | Adaptive Training Plan Engine | ✅ Afgerond | v2.4.92-99 |
| 2b | Trainingskalender | ✅ Afgerond | v2.4.100 |
| 2c | Cycling Dashboard | ✅ Afgerond | v2.4.102 |
| 2d | Grafieken | ✅ Afgerond (vermogenscurve uitgesteld, zie Fase 3) | v2.4.103-104 |
| 2e | Records | ✅ Afgerond (duur-specifieke records uitgesteld, zie Fase 3) | v2.4.105 |
| 2f | Ritanalyse | ✅ Afgerond | v2.4.106 |
| 2g | Coach-verdieping | ✅ Formeel bevestigd (bestaande infrastructuur) | — |
| 2h | Master Coach-integratie | ✅ Formeel bevestigd (bestaat sinds v2.4.80) | v2.4.80 |
| 2i | Progress Center | ✅ Afgerond, incl. FTP-geschiedenis | v2.4.107, v2.4.108 |
| 3 | Uitbreidingen — vermogenscurve (Garmin) | ✅ Afgerond | v2.4.108-115 |
| 3 | Uitbreidingen — vermogenscurve (Strava) | 🔜 Nog open | — |
| 3 | Uitbreidingen — Event Engine, Zwift/Wahoo, etc. | Bewust nog niet gestart | — |

**Fase 1 en Fase 2 zijn volledig afgerond.** Binnen Fase 3 is het
vermogenscurve-punt deels afgerond: het Garmin-pad (berekening, opslag,
UI) staat live sinds v2.4.115. Duur-specifieke records in de Records-
kaart en het Strava-pad zijn de directe vervolgstappen als dit
opgepakt wordt.

**Volgende stap, indien gewenst:** Strava-vermogenscurve (zelfde
berekening, nieuwe databron), duur-specifieke records afmaken, of een
van de overige Fase 3-uitbreidingen (Event Engine, Zwift/Wahoo/
Hammerhead, tweede specialist verdiepen).
