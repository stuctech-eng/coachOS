# CoachOS Running Specialist Roadmap v1.0

**Status: FASE 0 — ontwerp, nog geen code. Vervangt/vult aan op
`docs/running-specialist-master-spec.md` (het volledige eindbeeld,
aangeleverd 19 juli 2026). Aanpak identiek aan de Cycling-roadmap: geen
ene gigantische oplevering, een reeks afgeronde fases, elke fase direct
bruikbaar.**

---

## Vaste principes voor dit hele traject

Identiek aan de Cycling-roadmap, hier herbevestigd:

1. **Elke fase eerst ontworpen, dan pas gebouwd.**
2. **Eén centrale bron van waarheid per soort data — geen duplicatie.**
   Zie de "al bestaand"-lijst hieronder — dit is bij Running extra
   belangrijk omdat de Master Spec losstaand is opgesteld, dus expliciet
   gecontroleerd tegen de bestaande code.
3. **AI rekent nooit.** Elke pace-curve/zones/trainingsbelasting-
   berekening is deterministisch, net als bij Cycling.
4. **Kleine, testbare leveringen** — elke fase in sub-stappen.
5. **Hergebruik bestaande patronen én bestaande code.** Running deelt
   de architectuur met Cycling (Goal/Memory/Confidence/Lifecycle/
   Decision Engine, CoachPolicy) — dat werk is al gedaan (v2.4.83
   bewees de herbruikbaarheid). Waar mogelijk wordt Cycling-code
   **generiek gemaakt** in plaats van gedupliceerd (bijv.
   `vermogenscurve.ts` werkt al op elke `{tijdSec, waarde}`-reeks, niet
   per se watts — dat is direct herbruikbaar voor een pace-curve).

---

## Wat al bestaat — geverifieerd in de code (19 juli 2026)

**Data Layer + Analysis Engine (v2.4.83):**
- `src/lib/specialists/running-data.ts`, `running-analysis.ts`
- `src/app/api/specialists/running/engine`, `.../running/coach`
- Running Hub-UI (`src/app/coach/running/page.tsx`) — advies,
  kengetallen, trend-iconen. Spiegelbeeld van de vroege Cycling Hub.

**TCX-parser verzamelt al, per activiteit (`tcx-parser.ts`):**
- `avg_hr`, `max_hr` — hartslag
- `avg_cadence`, `max_cadence` — cadans
- `avg_watts` — Running Power, **indien de sensor aanwezig is**
- `avg_speed_kmh` — snelheid (basis voor pace)
- `elevation_gain_m`, `elevation_loss_m` — hoogte
- `distance_m`, `duration`
- Momentane seconde-voor-seconde reeks tijdens het parsen (nu alleen
  gebruikt voor de vermogenscurve — herbruikbaar voor een pace-curve,
  zie Fase 2)

**Nog niet aanwezig — vergt nieuw werk:**
- Running Profile (drempeltempo, max hartslag als baseline, sensoren)
- Pace Zones / Hartslagzones-berekening voor Running (Cycling heeft dit
  al in `cycling-zones.ts` — grotendeels hergebruikbaar, HR-zones zijn
  zelfs sport-onafhankelijk)
- Records, Pace Curve, Progress Center, Grafieken, Trainingsplan,
  Kalender — allemaal Cycling-only op dit moment

---

## Fase 1 — Running Foundation

**Doel:** dezelfde rol als Cycling Fase 1 — eenmalig alle basisgegevens
verzamelen zodat latere fasen niet steeds een nieuw instellingenveldje
hoeven toe te voegen.

### Running Profile — nieuwe velden
- **Drempeltempo** (threshold pace, min/km) — equivalent van FTP,
  basis voor Pace Zones
- Max hartslag — **hergebruikt** het Cycling-profielveld niet 1-op-1
  (aparte sport, aparte baseline mogelijk) — apart veld, zelfde patroon
- Sensoren aanwezig: hartslagmeter / cadanssensor / hardloop-
  vermogensmeter (ja/nee, elk apart)
- Trainingsdagen, beschikbare uren per week — **zelfde velden als
  Cycling, mogelijk zelfs hergebruikbaar** (iemand traint niet apart
  "dagen voor fietsen" vs "dagen voor hardlopen") — TE BESLISSEN bij
  start van deze fase, geen aanname vooraf

**Bewust niet toegevoegd — bestaat al elders:**
- Gewicht, lengte, rusthartslag, ervaringsniveau — `profiles`/
  `health_metrics`, zelfde als Cycling

### Pace Zones + Hartslagzones
- `src/lib/specialists/running-zones.ts` — `berekenPaceZones()` op
  basis van drempeltempo (Recovery/Easy/Steady/Marathon/Threshold/
  10K/5K/3K/VO2max/Sprint — 10 zones, publiek gedocumenteerd model,
  bijv. Jack Daniels' VDOT of Pfitzinger — **nog te kiezen welk
  publiek model, geen namaak van een propriëtair platform**)
- Hartslagzones: **hergebruik `berekenHartslagZones()` uit
  `cycling-zones.ts`** — dat model is al sport-onafhankelijk
  (%-van-max-hartslag), geen dubbele implementatie nodig

### Dashboard (basis)
- Weekafstand, maandafstand, jaarafstand, totale kilometers
- Trainingen deze week, gemiddelde pace, gemiddelde hartslag,
  gemiddelde cadans, hoogtemeters, trainingstijd
- Langste duurloop, snelste training
- **Alles hierboven is al beschikbaar uit bestaande `activity_sessions`-
  data** — puur aggregatie, geen nieuwe databron

**Uitdrukkelijk NIET in Fase 1** (zie Fase 2/3): Records, Pace Curve,
Progress Center, Grafieken, Trainingsplan, Kalender, Running Power-
analyse, per-run analyse (splits/pacing), Running Goals-uitbreiding.

---

## Fase 2 — Running Professional

**Doel:** het niveau dat Cycling nu heeft (Power Center-equivalent).

- **Performance Center**: Records (100m t/m Ultramarathon — alleen de
  afstanden die daadwerkelijk in de data voorkomen, geen lege records
  tonen), Pace Curve (equivalent van de vermogenscurve — hergebruikt
  dezelfde sliding-window-wiskunde uit `vermogenscurve.ts`, toegepast
  op snelheid i.p.v. watts), Hartslaganalyse, Pace Zones-weergave,
  Cadansanalyse, Hoogteprofiel, Running Power (alleen tonen als de
  gebruiker een sensor heeft — zelfde eerlijkheidsprincipe als Cycling)
- **Trainingsbelasting** — eigen CoachOS-berekening, **zelfde
  Coggan-achtige aanpak als Cycling (TSS-schatting/CTL/ATL/TSB)**, dus
  hergebruik van `berekenGeschatteTSS()` e.d. waar het model overdraagt
  (pace i.p.v. watt vergt een aangepaste intensiteitsfactor-formule —
  apart uit te werken, geen kopieerwerk)
- **Progressie**: 5km/10km/halve/marathon-trends, pace-trend,
  cadans-trend, hartslagtrend, herstel-trend
- **Adaptief Trainingsplan** — Trainer AI vult training in, Specialist
  bouwt de planning (zelfde Plan Generator + Daily Adjustment-patroon
  als Cycling)
- **Kalender**, **Grafieken** — zelfde patroon als Cycling
  (`cycling-grafieken.ts` grotendeels als sjabloon)

---

## Fase 3 — Running Intelligence

- Wedstrijdplanning (5km/10km/halve/marathon/trail/ultra) — specialist
  bouwt automatisch naar een evenement toe
- Marathon-opbouw, Trail Running-specifieke analyse
- Intervalanalyse (per-run: negatieve/positieve split, pacing, snelste/
  zwaarste kilometer, constantie, efficiency — "AI interpreteert
  uitsluitend", de cijfers zelf blijven deterministisch)
- Running Economy
- Blessurepreventie-signalen
- Advanced Coach Memory
- **Garmin API-uitbreidingen** (Body Battery, Training Readiness, HRV
  Status, VO2Max-historie, Race Predictor, Endurance/Hill Score,
  Training Status, Acute Load, Sleep Score, Stress) — **expliciet
  vergt dit nieuwe Garmin API-toegang** (niet TCX-bestand-import), dus
  losstaand van de rest van Fase 3, pas oppakken als die toegang er is

---

## Openstaande ontwerpbeslissingen (bij start van elke fase opnieuw checken)

1. Welk publiek pace-zone-model (Daniels VDOT / Pfitzinger / anders) —
   nog niet gekozen, moet vóór Pace Zones-implementatie vastliggen
2. Trainingsdagen/beschikbare uren: gedeeld tussen Cycling en Running,
   of per specialist apart? Beïnvloedt of dit een nieuw profielveld
   wordt of hergebruik van het bestaande Cycling-veld
3. Records-lijst (100m t/m Ultramarathon uit de Master Spec) — welke
   afstanden slaan we automatisch op vs. alleen tonen als data het
   toelaat? Voorkomt een schijn-volledige lijst met louter lege rijen
