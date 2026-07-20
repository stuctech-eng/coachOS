# CoachOS — Changelog

## v2.4.138 — Fix: Garmin Import scrolde niet + Focus lading niet zichtbaar
**Gemeld met screenshot: "kan niet opslaan" bleek een scroll-bug — de
body heeft app-breed `overflow-hidden` staan, en deze nieuwe pagina
(v2.4.137) miste de vereiste scrollbare wrapper. Met twee kaarten +
bevestiging + knoppen paste de inhoud niet meer op één scherm, dus de
"Opgeslagen"-melding en de knoppen waren onbereikbaar — het leek
alsof opslaan niet werkte, maar dat deed het waarschijnlijk wel.**

- `src/app/settings/garmin-import/page.tsx`:
  - `min-h-screen` → `h-screen overflow-y-auto scroll-area` op de
    buitenste wrapper — zelfde patroon als elders in de app
  - `safe-bottom` toegevoegd zodat de laatste knop niet achter de
    home-indicator verdwijnt
  - **Focus lading** was al geparsed en opgeslagen (`performance_snapshots`),
    maar stond niet in de resultatenlijst — toegevoegd (laag/gemiddeld/
    hoog)

**Test-instructies:**
1. Garmin Import → beide foto's → Verwerken → resultatenscherm moet nu
   scrollbaar zijn, "Opgeslagen"-melding en knoppen moeten bereikbaar zijn
2. Focus lading moet nu in de Performance-kaart staan

## v2.4.137 — Morning Health + Performance Repository, Vision Engine
**Vervangt het ontwerp van v2.4.136 (die niet gepusht was) volledig.
Grote, meerdelige levering na uitgebreid architectuuroverleg: geen
afgeleide waarden opslaan, generieke Vision Engine i.p.v. Garmin-
specifieke code, twee screenshots in één upload.**

**⚠️ ACTIE VEREIST VÓÓR DEPLOY — zie `supabase/morning_health_and_performance.sql`
voor de volledige SQL (twee tabellen + RLS-policies).**

### Architectuurkeuzes, zoals besproken
- **Geen baseline/trend/status-kolommen** — afgeleide waarden, berekend
  live door de nieuwe Health Analysis Engine
  (`src/lib/specialists/health-analysis-engine.ts`), nooit opgeslagen.
  Verandert de trend-regel ooit (bijv. 7→14 dagen), dan is er geen
  historische migratie nodig.
- **Generieke Vision Engine** (`src/lib/vision-engine/`) i.p.v.
  Garmin-specifieke code in de route zelf — `types.ts` (contract),
  `core.ts` (gedeelde comprimeer/AI-call/parse-logica), losse parsers
  per scherm. Nu twee parsers: `garmin-health-parser.ts` en
  `garmin-performance-parser.ts`. Apple Health/WHOOP/Polar-parsers
  bewust NIET gebouwd — geen screenshot-voorbeeld om tegen te testen,
  komt later bij een concrete aanleiding.
- **AI doet alleen OCR** — de prompts vragen uitsluitend om de kale
  cijfers, nooit om interpretatie. Die interpretatie zit in de Health
  Analysis Engine en straks de Coach, niet in de Vision-laag.
- **`source_type`/`import_method`** uitgebreid zoals gevraagd:
  garmin_connect/apple_health/manual/whoop/polar/fitbit/coros/suunto/
  future_api, resp. vision/api/manual/sync.
- **`performance_snapshots` alvast breed opgezet** — hill_score,
  recovery_time_hours, race_predictor zijn NULL-baar en aanwezig, ook al
  stonden ze niet op het aangeleverde screenshot. Voorkomt een latere
  tabelwijziging zodra een screenshot met die widgets beschikbaar komt.
- **CoachPolicy/recovery-engine.ts ongewijzigd** — nieuwe data is input,
  geen policy-wijziging.

### Twee foto's, één upload
- **Nieuw:** `src/app/api/health/vision-import/route.ts` — accepteert
  Health- en Performance-foto in één multipart POST, twee losse Vision-
  calls (niet één alles-in-één-prompt — hogere herkenningsbetrouwbaarheid
  per scherm)
- Health-foto blijft ALTIJD ook `garmin_imports` vullen (ongewijzigd,
  15+ bestaande lezers: Coach AI, Trends, Predictions, Status, Memory,
  Home, Insights, Training-flows) + nieuw naar `morning_health_metrics`
- Performance-foto is uitsluitend nieuw → `performance_snapshots`
- **Vereenvoudiging t.o.v. de oude garmin-vision-route:** geen apart
  "bevestig eerst"-stapje — direct opslaan na parsen
- `src/app/settings/garmin-import/page.tsx` — herschreven: twee foto-
  vakken, één "Verwerken"-knop. Oude route (`/api/health/garmin-vision`)
  blijft ongewijzigd bestaan, geen risico voor wat al werkte

### HRV-veld in de Check-in (herzien t.o.v. v2.4.136)
- `src/app/api/hrv/route.ts` — schrijft nu naar `morning_health_metrics`
  i.p.v. het vervangen `hrv_measurements`, merget met een eventueel
  al-bestaande rij van vandaag (bijv. al een Health-screenshot
  geüpload) i.p.v. blind te overschrijven
- `src/app/checkin/page.tsx` — HRV-veld met **expliciete
  "Overslaan"-knop** (op verzoek — was eerst impliciet leeg-laten)

**Bewuste beperking, benoemd in de code:** bij gemengde bronnen op
dezelfde dag (bijv. eerst handmatig HRV, later een Health-screenshot)
weerspiegelt `source_type` de laatste schrijfactie voor de hele rij,
niet per veld afzonderlijk — voor een eerste versie een aanvaardbare
vereenvoudiging.

**Gevalideerd vóór levering:**
- `npx next build` — compileert zonder fouten of warnings
- Health Analysis Engine-trendlogica los getest, inclusief correcte
  filtering van ontbrekende (null) metingen uit het gemiddelde

**Test-instructies:**
1. **Eerst de SQL uitvoeren**
2. Garmin Import → beide foto's kiezen → Verwerken → beide resultaten
   moeten verschijnen
3. Check-in → HRV invullen → Overslaan-knop test → "Toch invullen"
   moet het veld weer tonen
4. Bevestig dat `garmin_imports` nog steeds gevuld wordt (bestaande
   Coach AI-functionaliteit mag niet breken)

## v2.4.135 — HERSTEL: ontbrekende Training Plan Engine-bestanden
**Oorzaak van de "The string did not match the expected pattern"-fout
op het Running Trainingsplan-scherm: `src/app/api/specialists/running/
training-plan/route.ts` — het bestand dat de pagina als EERSTE aanroept
— bleek niet live te staan. Bij controle bleken meerdere bestanden uit
v2.4.132 (Training Plan Engine Core + Adapters) nooit gecommit te zijn.**

**Root cause (bij mezelf, niet bij de gebruiker):** in latere sessies
herstelde ik mijn werkstaat door de repo opnieuw te clonen + alleen de
láátst-geleverde zip terug te zetten. Als een eerdere levering (zoals
v2.4.132) op dat moment nog niet gecommit was door de gebruiker, ging
die cumulatief verloren — elke volgende levering bouwde zonder het te
weten voort op een onvolledige basis. Dit is nu volledig gereconstrueerd
en opnieuw gevalideerd.

### Ontbrekende bestanden hersteld
- `src/lib/specialists/training-plan-engine/core.ts`
- `src/lib/specialists/training-plan-engine/adjuster-core.ts`
- `src/lib/specialists/training-plan-engine/cycling-adapter.ts`
- `src/lib/specialists/training-plan-engine/running-adapter.ts`
- `src/app/api/specialists/running/training-plan/route.ts` (**de
  daadwerkelijke oorzaak van de fout in de screenshot** — ontbrak
  volledig, dus `/coach/running/trainingsplan` kreeg een 404 in plaats
  van JSON terug op zijn eerste fetch-aanroep)
- `supabase/training_plans_sport_kolom.sql`

### Extra gat gevonden en gedicht tijdens de controle
`src/app/api/specialists/cycling/training-plan/route.ts` miste ook nog
de `sport`-filter (was blijven staan op de oude, ongepatchte versie).
Toegevoegd aan zowel de GET-query als de "sluit bestaand plan af"-POST-
stap — zelfde fix als eerder al bij de Running-route en
`cycling-rit-analyse.ts` was doorgevoerd.

### Refactor nu écht afgerond
`training-plan-generator.ts` en `training-plan-adjuster.ts` stonden nog
als hun OUDE, zelfstandige versie (nog werkend, maar gebruikte de
nieuwe Core niet). Nu alsnog omgezet naar de dunne wrappers zoals
bedoeld — Cycling gebruikt vanaf nu ook daadwerkelijk dezelfde
Core+Adapter als Running, geen tweede parallelle implementatie meer.

**Gevalideerd vóór levering:**
- `npx next build` — compileert zonder fouten, alle vier training-plan-
  routes (cycling + running, elk met hun explain-variant) aanwezig in
  de build-output
- Gedrag-behoudendheid Cycling **opnieuw bevestigd** na de reconstructie:
  108 mesocyclus-combinaties + 28 sessieverdeling-combinaties, nog
  steeds allemaal byte-voor-byte identiek aan de oorspronkelijke
  implementatie

**⚠️ Controleer of je de SQL al eerder hebt uitgevoerd** (bij de
v2.4.132-melding) — het commando hieronder is veilig om opnieuw te
draaien (`IF NOT EXISTS`), dus twijfel je, voer 'm gerust nogmaals uit:

```sql
alter table training_plans add column if not exists sport text not null default 'cycling';

create index if not exists idx_training_plans_athlete_sport
  on training_plans(athlete_id, sport, status);

comment on column training_plans.sport is
  'Welke specialist dit plan beheert (cycling/running/...). Bestaande rijen krijgen automatisch cycling als default.';
```

**Test-instructies:**
1. **Eerst de SQL controleren/uitvoeren**
2. Running Hub → Trainingsplan → moet nu laden zonder foutmelding
   (leeg-staat met "Genereer je trainingsplan"-knop als er nog geen
   plan is)
3. Cycling: trainingsplan moet zich nog steeds identiek gedragen als
   vóór v2.4.132 — genereer een nieuw plan en vergelijk desgewenst met
   een eerder gegenereerd plan
4. **Belangrijkste check:** dit hele bestandenpakket in één keer
   committen en pushen, niet gedeeltelijk — dat voorkomt precies dit
   soort ontbrekend-bestand-problemen

## v2.4.134 — Running Trainingsplan UI (Fase 3, laatste stap) + documentatie bijgewerkt
**Laatste van de drie afgesproken fasen (Engine ✅ → Coach-uitleglaag ✅
→ UI ✅). Hiermee is het Running Adaptive Training Plan volledig
afgerond, op dezelfde Core+Adapter-architectuur als Cycling. Daarnaast,
op verzoek: README en de in-app "Hoe werkt CoachOS"-pagina bijgewerkt
zodat de documentatie de huidige staat weerspiegelt.**

### UI
- **Nieuw:** `src/app/coach/running/trainingsplan/page.tsx` —
  spiegelbeeld van `coach/cycling/trainingsplan` (v2.4.99): "Vandaag"
  prominent met AI-uitleg, komende trainingen met status-iconen,
  eerlijke uitleg dat verder dan de rolling horizon nog geen concrete
  dagen gepland zijn
- **Bewust géén Kalender-knop** (in tegenstelling tot de Cycling-versie)
  — die pagina bestaat nog niet voor Running, geen dode link naar iets
  dat niet werkt
- `src/app/coach/running/page.tsx` — Trainingsplan-link toegevoegd,
  direct na Performance Center, altijd zichtbaar

### Documentatie bijgewerkt
- **`README.md`**: Specialist Coach Platform-status bijgewerkt (Running
  Fase 1+2 afgerond, Training Plan Engine Core+Adapter-refactor
  vermeld), nieuwe "🏃 Actieve roadmap: Running Specialist v1.0"-sectie
  toegevoegd (spiegelt de bestaande Cycling-sectie), Openstaand-tabel
  bijgewerkt met het laatste resterende punt (Running Kalender)
- **`src/app/settings/hoe-werkt-het/page.tsx`**: de Specialisten-sectie
  zei nog letterlijk *"Op dit moment bestaat de Cycling Coach"* — dat
  klopte niet meer sinds v2.4.83 (Running) en zeker niet meer na
  vandaag's uitbreidingen. Bijgewerkt: noemt nu beide coaches, legt
  Performance Center en het adaptieve trainingsplan uit op
  sport-neutrale wijze (vermogen/Power Zones bij Cycling, tempo/Pace
  Zones bij Running)

**Gevalideerd vóór levering:** `npx next build` — compileert zonder
fouten of warnings, nieuwe route aanwezig in de build-output.

**Hiermee is de Running Specialist Roadmap Fase 1 + Fase 2 (grotendeels)
+ het volledige Adaptive Training Plan (Fase 1-3) afgerond.** Nog open:
Running Kalender, uitgebreide Grafieken-pagina, Wedstrijdplanning.

**Test-instructies:**
1. Running Hub → Trainingsplan-knop (primaire kleur, na Performance
   Center)
2. Zonder trainingsdagen ingesteld: nette foutmelding die naar Running
   Profile verwijst
3. Met trainingsdagen: "Genereer je trainingsplan"-knop → plan met
   Easy Run/Interval/Herstel/Tempo/Lange duurloop-sessies
4. Instellingen → Hoe werkt CoachOS → Specialisten-sectie noemt nu
   beide coaches

## v2.4.133 — Coach-uitleglaag (Running Fase 2) + derde sport-filter-gat gedicht
**Tweede stap van de drie afgesproken fasen (Engine ✅ → Coach-uitleglaag
✅ → UI). Spiegelbeeld van Cycling's v2.4.97.**

### Coach-uitleglaag
- **Nieuw:** `src/app/api/specialists/running/training-plan/explain/route.ts`
  — leest de sessie van vandaag + actuele CoachPolicy, AI zet dit om in
  een korte menselijke uitleg. **AI beslist niets** — type, duur en
  reden liggen al vast (Decision Contract, sectie 5), de AI vertaalt
  alleen naar natuurlijke taal.
- Leesbare Nederlandse labels voor de Running-sessietypen in de
  fallback-tekst (`easy_run` → "rustige duurloop", `lange_duurloop` →
  "lange duurloop", etc.) — de ruwe underscore-namen zijn niet
  gebruikersvriendelijk als er geen AI-respons komt.
- `REASON_CODE_UITLEG` **verplaatst naar de gedeelde Core**
  (`training-plan-engine/types.ts`) — beschrijft de beslissingsmechaniek
  (waarom een sessie is aangepast), niet iets sportspecifieks, dus geen
  reden voor duplicatie tussen de Cycling- en Running-uitleglaag.
  Cycling's route hergebruikt nu dezelfde constante.

### Derde sport-filter-gat gevonden en gedicht
Bij het doorzoeken van alle plekken die `training_plans` bevragen bleek
**`cycling-rit-analyse.ts`** ook zonder sport-filter te werken — een
fietsrit werd vergeleken met "de geplande sessie van vandaag" uit **elk**
actief plan van de gebruiker, ongeacht sport. Met een actief Running-
plan ernaast had dit een fietsrit tegen een hardloop-sessie kunnen
afzetten (bijv. "volgens schema"-check tegen een `interval`-hardloop-
sessie i.p.v. de bedoelde cycling-sessie). Sport-filter toegevoegd.

**Alle plekken die `training_plans` bevragen zijn nu gecontroleerd en
sport-gefilterd:** beide `training-plan/route.ts`, beide
`training-plan/explain/route.ts`, `training-plan-engine/core.ts` +
`adjuster-core.ts` (al plan-id-scoped, dus impliciet veilig), en nu ook
`cycling-rit-analyse.ts`.

**Gevalideerd vóór levering:** `npx next build` — compileert zonder
fouten of warnings, beide explain-routes aanwezig in de build-output.

**Rijtje resterend:** UI (Fase 3) — kalenderweergave, weekoverzicht,
Coach-uitleg prominent getoond, zelfde patroon als Cycling's
trainingsplan-scherm (v2.4.99).

## v2.4.132 — Training Plan Engine: Core + Adapter-architectuur (Fase 1/3)
**Grootste en meest risicovolle levering van vandaag: een REFACTOR van
de bestaande, live, werkende Cycling Adaptive Training Plan Engine —
niet zomaar een nieuwe feature. Op uitdrukkelijk verzoek: in plaats van
een tweede, bijna-identieke `running-training-plan-generator.ts` te
dupliceren, is de gedeelde logica nu een platformcomponent geworden.**

### Architectuur
```
src/lib/specialists/training-plan-engine/
├── types.ts            — TrainingPlanSportAdapter-contract
├── core.ts              — Plan Generator (periodisering, mesocycli, rolling horizon)
├── adjuster-core.ts     — Daily Adjustment Layer (5 triggers)
├── cycling-adapter.ts   — FTP-profiel, duurtraining/interval/herstel/lange_duurtraining
└── running-adapter.ts   — VDOT-profiel, easy_run/interval/herstel/tempo/lange_duurloop
```
**Ontwerpregel, letterlijk vastgelegd in de code-comments:** de Training
Plan Engine is een platformcomponent, geen Cycling-component. Alle
periodisering/mesocycli/deload/adaptieve-aanpassingen-logica hoort in
de Core; sportverschillen komen uitsluitend via een adapter.

### Bevinding die de aanpak vereenvoudigde
`training_plan_sessions.sport` bestond al, met de commentaar "voor
toekomstige multi-sport-plannen" — de tabellen waren dus al zo
ontworpen. **Eén gat gevonden en gedicht:** `training_plans` zelf had
GEEN sport-kolom, waardoor het aanmaken van een Running-plan een actief
Cycling-plan had kunnen afsluiten (en andersom) — de "sluit bestaand
actief plan af"-query filterde alleen op `athlete_id`+`status`. SQL
hieronder lost dit op.

### ⚠️ ACTIE VEREIST VÓÓR DEPLOY
```sql
alter table training_plans add column if not exists sport text not null default 'cycling';

create index if not exists idx_training_plans_athlete_sport
  on training_plans(athlete_id, sport, status);

comment on column training_plans.sport is
  'Welke specialist dit plan beheert (cycling/running/...). Bestaande rijen krijgen automatisch cycling als default.';
```
Bestaande Cycling-plannen krijgen automatisch `sport='cycling'` via de
DEFAULT — geen dataverlies, geen handmatige migratie nodig.

### Cycling: ONGEWIJZIGD gedrag, bewezen
`src/lib/specialists/training-plan-generator.ts` en
`training-plan-adjuster.ts` zijn nu dunne wrappers rond de Core met de
Cycling Adapter — **zelfde functienamen, zelfde signatuur**, dus
`api/specialists/cycling/training-plan/route.ts` hoefde alleen een
sport-filter te krijgen (zie hierboven), verder ongewijzigd.

**Vóór levering bewezen gedrag-behoudend:** de pure kernfuncties
(`bepaalMesocycli`, sessietype-verdeling) los getest, oude
implementatie tegen de daadwerkelijke nieuwe gecompileerde code, over
**108 mesocyclus-combinaties** (12 weekwaarden × 9 uurwaarden) **+ 28
sessieverdeling-combinaties** (7 dagaantallen × 4 mesocyclus-typen) —
elke combinatie gaf byte-voor-byte identieke JSON-output.

### Running: nieuw, bovenop dezelfde Core
- **Nieuw:** `src/app/api/specialists/running/training-plan/route.ts`
  — spiegelbeeld van de Cycling-route, gebruikt `runningAdapter`
- Sessietypen uit de Master Spec: Easy Run, Interval, Herstel, Tempo,
  Lange duurloop — zelfde verdeel-structuur als Cycling (aantal
  trainingsdagen → vaste volgorde), andere vocabulaire
- Profiel/analyse-databronnen: Running Profile
  (`specialist_type='running'`) + `analyseerRunning()` i.p.v. de
  Cycling-equivalenten

**Gevalideerd vóór levering:**
- `npx next build` — compileert zonder fouten of warnings
- Gedrag-behoudendheid Cycling: zie hierboven (108+28 combinaties)
- Beide nieuwe/aangepaste routes aanwezig in de build-output

**Nog niet in deze levering (Fase 2/3, zoals afgesproken):** Coach-
uitleglaag (waarom dit schema, waarom rust/interval) en de UI
(kalender, weekoverzicht, versleepbare trainingen) — die volgen apart,
zelfde volgorde als destijds bij Cycling.

**Test-instructies:**
1. **Eerst de SQL hierboven uitvoeren in Supabase**
2. Cycling: genereer een trainingsplan zoals altijd — moet zich exact
   hetzelfde gedragen als vóór deze update
3. Running: `POST /api/specialists/running/training-plan` — moet een
   plan aanmaken met Running-sessietypen (easy_run/interval/herstel/
   tempo/lange_duurloop)
4. Beide tegelijk: genereer eerst een Cycling-plan, dan een Running-
   plan — controleer dat het Cycling-plan `status='active'` blijft
   (niet per ongeluk afgesloten)

## v2.4.131 — Running Progressie (Fase 2, derde levering)
**Derde stap van "rijtje af": Progressie. Twee soorten trends, allebei
zonder nieuwe SQL.**

### Race-afstand-trends (5K/10K/Halve/Marathon)
**Bevinding:** `running_distance_records` (v2.4.128) bevat al élke
poging per activiteit, niet alleen het all-time record — een
chronologische trend kost dus geen nieuwe query-vorm, alleen een
andere manier van groeperen (per activiteit i.p.v. het minimum).

- **Nieuw:** `haalAfstandTrends()` in `running-grafieken.ts` — alle
  pogingen per afstand, chronologisch gesorteerd
- UI: alleen afstanden met 2+ pogingen getoond (anders geen trend te
  bepalen), trend-pijltje (sneller/gelijk/langzamer dan de vorige
  poging), zelfde `TrendIcoon`-patroon als de Cycling Hub

### Wekelijkse pace/hartslag/cadans-trend
- **Nieuw:** `haalWekelijkseRunningTrend()` — zelfde aggregatiepatroon
  als `haalWekelijkseVolumes()` (Cycling), nu voor snelheid/hartslag/
  cadans i.p.v. kilometers
- UI: staafdiagram laatste 12 weken, hogere balk = sneller gemiddeld
  tempo die week

**Bewust niet meegenomen:** Running Power-trend (alleen relevant met
sensor, te weinig gebruikers om nu te bouwen) en Herstel-trend (dat IS
al de TSB-lijn uit de Trainingsbelasting-kaart van v2.4.130 — geen
aparte sectie nodig voor dezelfde data).

- `src/app/api/specialists/running/dashboard/route.ts` —
  `afstand_trends` en `wekelijkse_trend` toegevoegd aan de response
- `src/app/coach/running/performance/page.tsx` — twee nieuwe kaarten,
  direct na Trainingsbelasting

**Gevalideerd vóór levering:**
- `npx next build` — compileert zonder fouten
- Wekelijkse aggregatielogica los getest met synthetische activiteiten
  (2 runs dezelfde week) → correct gemiddelde en pace-omrekening

**Rijtje resterend:** Adaptief Trainingsplan, Kalender, Grafieken.

## v2.4.130 — Running Trainingsbelasting (Fase 2, tweede levering)
**Tweede stap van "rijtje af": Trainingsbelasting. Zelfde publiek
gedocumenteerde Coggan-methode als Cycling (CTL 42-dagen/ATL 7-dagen
EWMA) — enige verschil is een snelheid-gebaseerde Intensity Factor
i.p.v. vermogen-gebaseerd. Geen nieuwe SQL.**

- **Nieuw in `running-grafieken.ts`:**
  - `berekenDrempelsnelheidKmh(vdot)` — drempelsnelheid afgeleid uit
    VDOT, midden van de al-bestaande Threshold Pace Zone-band (84-88%
    VO2max). Geverifieerd: bij VDOT 49,8 komt dit uit op 13,8 km/u,
    exact binnen de eerder (v2.4.126) geverifieerde Threshold-pace-
    range van 4:16-4:26/km.
  - `berekenGeschatteRunningTSS()` — `IF = gem_snelheid/drempelsnelheid`,
    `TSS = uren × IF² × 100`. Los getest: 60 minuten op precies
    drempeltempo geeft exact TSS 100 (de definiërende eigenschap van
    deze formule — bevestigt dat de implementatie klopt).
  - `haalRunningCTLATLTSB()` — spiegelbeeld van de Cycling-versie,
    zelfde 42/7-dagen-vensters. Geeft eerlijk een lege lijst terug als
    er geen VDOT is (geen gegokte drempelsnelheid).
- `src/app/api/specialists/running/dashboard/route.ts` —
  `belasting`-array toegevoegd aan de response
- `src/app/coach/running/performance/page.tsx` — Trainingsbelasting-
  kaart toegevoegd (lijndiagram CTL/ATL + Vorm-indicator (TSB), zelfde
  `LijnGrafiek`-component als het Cycling Grafieken-scherm)

**Eerlijke beperking, expliciet in de UI:** schatting op basis van
gemiddelde snelheid — minder nauwkeurig bij heuvelachtig terrein
(langzamer bergop zonder dat dit meer "belasting" betekent) of
intervaltraining (gemiddelde mist de pieken), zelfde soort beperking
als bij Cycling's TSS-schatting.

**Gevalideerd vóór levering:**
- `npx next build` — compileert zonder fouten
- Drempelsnelheid-formule getest tegen de al eerder geverifieerde VDOT-
  waarde (49,8 → 13,8 km/u, consistent met eerdere Threshold-zone-berekening)
- TSS-formule getest tegen de wiskundige referentie-eigenschap
  (1 uur op drempeltempo = TSS 100, per definitie)

**Rijtje resterend:** Progressie, Adaptief Trainingsplan, Kalender,
Grafieken.

## v2.4.129 — Running Performance Center (Fase 2, eerste levering)
**Eerste bouw-stap van Running Fase 2 (Professional). Zelfde aanpak als
Cycling's Power Center (v2.4.118): een nieuw analysecentrum dat
uitsluitend al-bestaande data samenvoegt — GEEN nieuwe SQL, GEEN
nieuwe berekeningen.**

- **Nieuw:** `src/app/coach/running/performance/page.tsx` — haalt in
  parallel op:
  - `/api/specialists/running/profile` → VDOT, Pace Zones, Hartslagzones
  - `/api/specialists/running/dashboard` → Dashboard-kengetallen + Records
- **Pace Curve is geen nieuwe data** — de Records-data (afstandscurve,
  v2.4.128) nu ook als grafiek getoond (staafdiagram, zelfde visuele
  taal als de Cycling-vermogenscurve), naast de bestaande lijstweergave.
  "Persoonlijke records" en "Pace Curve" uit de Master Spec zijn
  inhoudelijk dezelfde onderliggende data, twee weergaven ervan.
- Indeling: Overzicht (VDOT + gem. pace) → Pace Curve (grafiek) →
  Persoonlijke records (lijst) → Pace Zones → Hartslagzones → Cadans
  &amp; hoogte (hergebruikt uit het Dashboard)
- `src/app/coach/running/page.tsx` — Performance Center-link
  toegevoegd, **bewust vóór de AI-advies-sectie geplaatst** (niet
  verstopt achter een mogelijk-lege staat) — direct leerpunt van
  eerdere feedback dat een nieuwe functie meteen zichtbaar moet zijn

**Gevalideerd vóór levering:** `npx next build` — compileert zonder
fouten, nieuwe route aanwezig in de build-output.

**Ontwerp-principe, zelfde als bij Cycling:** dit is een fundament,
geen eindpunt — Trainingsbelasting, Progressie en andere Fase 2/3-
onderdelen krijgen later een eigen sectie hier, geen nieuwe
navigatie-ingang.

**Test-instructies:**
1. Running Hub → Performance Center-knop (geel, na de Records-kaart)
2. Zonder race-resultaat/data: lege staat met knop naar Running Profile
3. Met data: Pace Curve-grafiek toont dezelfde afstanden als de
   Records-kaart op de Hub, nu als staafdiagram

## v2.4.128 — Running Foundation deel 3 (laatste): Automatische Records
**Derde en laatste bouw-levering van Running Fase 1. Grootste stuk van
de drie — nieuw stuk wiskunde (afstand-gebaseerd i.p.v. tijd-gebaseerd),
plus een parser-uitbreiding en een nieuwe tabel.**

**⚠️ ACTIE VEREIST VÓÓR DEPLOY: voer eerst de SQL hieronder uit in
Supabase.** Zonder de tabel faalt het opslaan van records stil (eigen
try/catch, breekt de import zelf niet) — records blijven dan leeg.

```sql
create table if not exists running_distance_records (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activity_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  distance_m integer not null,
  tijd_sec integer not null,
  created_at timestamptz not null default now(),
  unique(activity_id, distance_m)
);

create index if not exists idx_running_distance_records_user_distance
  on running_distance_records(user_id, distance_m, tijd_sec asc);

comment on table running_distance_records is
  'Snelste tijd per doelafstand, per activiteit. Smal (activity x afstand -> tijd), geen ruwe tijdreeks. "All-time snelste 5km" = min(tijd_sec) where distance_m=5000 for user. Zie docs/running-specialist-roadmap-v1.md.';

alter table running_distance_records enable row level security;

drop policy if exists "Gebruiker kan eigen records lezen" on running_distance_records;
create policy "Gebruiker kan eigen records lezen"
  on running_distance_records for select using (auth.uid() = user_id);
-- Geen insert/update/delete-policy voor gewone gebruikers — wordt
-- uitsluitend server-side gevuld, zelfde patroon als cycling_power_curve.
```
Ook vastgelegd als los bestand: `supabase/running_distance_records.sql`
(zelfde conventie als `supabase/cycling_power_curve.sql`).

**Correctie t.o.v. de eerste versie van deze changelog-entry (gemeld
via Supabase's eigen SQL-editor-waarschuwing):** RLS ontbrak in de
oorspronkelijke SQL. Bij het corrigeren bleek `cycling_power_curve`
zelf al een preciezer patroon te hanteren dan mijn eerste RLS-poging
(alleen een SELECT-policy, want schrijven gebeurt uitsluitend
server-side via de admin-client die RLS toch al omzeilt — een bredere
insert/update-policy voor gewone gebruikers was overbodig). Nu
consistent gelijkgetrokken met dat bestaande patroon.

### Nieuwe wiskunde: afstandscurve (spiegelbeeld van de vermogenscurve)
Vermogenscurve zoekt "beste GEMIDDELDE over een vaste TIJD". Records-
per-afstand vergt het omgekeerde: "snelste TIJD over een vaste AFSTAND"
— vast en variabel zijn omgedraaid, dus een nieuw (maar verwant)
schuivend-venster-algoritme.

- **Nieuw:** `src/lib/afstandscurve.ts` — `berekenAfstandscurve()`,
  isomorf, O(n) two-pointer-sliding-window. Standaard-doelafstanden:
  100m t/m marathon (15 afstanden, Master Spec-lijst minus de dubbele
  "1 km"-rij). "Ultra" heeft geen vaste afstand, blijft "langste
  duurloop" op het Dashboard.
- `src/lib/tcx-parser.ts` — trackpoint-loop uitgebreid met
  `tp.DistanceMeters` + `tp.Time` (cumulatieve afstand sinds start,
  verplicht TCX-veld) → `afstandscurve` toegevoegd aan `TcxParsed`
- `src/app/api/health/garmin-activity-tcx/route.ts` — afstandscurve
  opslaan bij zowel nieuwe import als overschrijving, **bewust alleen
  voor `activityLabel === 'Hardlopen'`** (distance-records zijn een
  Running-specifiek concept, geen zin voor Fietsen)
- **Nieuw:** `haalRunningRecords()` in `running-grafieken.ts` — all-time
  snelste tijd per afstand, over alle activiteiten heen
- **Nieuw:** records toegevoegd aan `/api/specialists/running/dashboard`
- `src/app/coach/running/page.tsx` — Records-kaart, direct na Dashboard.
  **Alleen afstanden tonen waar data voor is** — geen lege rijen voor
  100m/200m/400m, die realistisch alleen verschijnen bij baan-precisie
  GPS of een footpod (expliciet zo benoemd in de UI, geen overclaiming)

**Gevalideerd vóór levering — drie lagen:**
1. `npx next build` — compileert zonder fouten
2. Het afstandscurve-algoritme los getest: constant tempo (5 m/s) gaf
   exact de verwachte tijden; een variabele inspanning (snel-dan-
   langzaam) vond correct het snelste venster
3. **Volledige integratietest**: de daadwerkelijke productie-
   `parseTcx()` (via `tsc` gecompileerd, geen losse kopie) gedraaid
   tegen een synthetisch TCX-bestand — 2400m bij constant 4 m/s gaf
   exact de juiste tijd per afstand (100m in 25s t/m 1609m in 403s),
   én liet correct 3km+ weg omdat de testrit daarvoor te kort was

**Hiermee is Running Fase 1 (Foundation) volledig afgerond:** Profile,
Pace Zones (Daniels VDOT), Hartslagzones, Dashboard, automatische
Records. Fase 2 (Professional — Pace Curve-weergave, Progress Center,
Trainingsbelasting, Adaptief Trainingsplan, Kalender, Grafieken) volgt
als aparte roadmap-stap.

**Test-instructies:**
1. **Eerst de SQL hierboven uitvoeren in Supabase**
2. Een hardloopactiviteit importeren (nieuw, na deze deploy)
3. Running Hub → Records-kaart moet verschijnen met tijden per afstand
   die daadwerkelijk in de rit voorkwamen
4. Kortere afstanden dan de rit zelf: geen record (bijv. bij een
   3km-rit geen 5km-record)
5. Dezelfde activiteit opnieuw importeren (overschrijven) → records
   moeten bijwerken, niet dupliceren (upsert-gedrag)

## v2.4.127 — Running Foundation deel 2: Dashboard
**Tweede bouw-levering van Running Fase 1. Puur aggregatie van
al-bestaande `activity_sessions`-data — geen nieuwe SQL, geen nieuwe
databron.**

**Geleerd van de vorige levering:** het Dashboard staat nu direct
zichtbaar op de Running Hub zelf, los van het AI-advies (dat kan leeg
zijn als er nog geen analyse gegenereerd is) — vorige keer was het
enige zichtbare een instellingen-icoontje, wat verwarrend bleek.

- **Nieuw:** `src/lib/specialists/running-grafieken.ts` —
  `haalRunningDashboard()`: week/maand/jaar-kilometers, trainingen deze
  week, gemiddelde pace/hartslag/cadans, hoogtemeters, trainingstijd,
  langste duurloop, snelste training
- **Nieuw:** `src/app/api/specialists/running/dashboard/route.ts`
- `src/app/coach/running/page.tsx` — Dashboard-kaart toegevoegd, direct
  onder de header (vóór het AI-advies), met een eigen leeg-staat-check
  (verschijnt pas als er daadwerkelijk data is)

**Eerlijke beperking, expliciet in code-comment vastgelegd:** "jaar"
en "totaal" zijn in Fase 1 dezelfde periode (jaar-tot-nu) — een
écht all-time totaal (over alle jaren heen) vergt een aparte,
ongefilterde query, bewust niet nu toegevoegd om geen verwarring
tussen twee bijna-gelijke getallen te veroorzaken.

**Gevalideerd vóór levering:**
- `npx next build` — compileert zonder fouten
- Aggregatielogica los getest met synthetische activiteiten
  (2 activiteiten deze week, 1 vorige maand) → week/maand/jaar-kilometers
  en trainingen-deze-week-telling allemaal correct

**Volgende, laatste stap van Running Fase 1:** automatische Records.
Vergt een NIEUW stuk logica — niet de tijd-gebaseerde vermogenscurve-
wiskunde hergebruikt, maar een afstand-gebaseerd algoritme (snelste
tijd over een vaste afstand i.p.v. beste gemiddelde over een vaste
tijd). Vergt ook een parser-uitbreiding: `tp.DistanceMeters` per
trackpoint wordt nu nog niet vastgelegd (alleen lap-totalen), nodig
voor een cumulatieve afstand-tijd-reeks.

## v2.4.126 — Running Foundation deel 1: Profile + Pace Zones + Hartslagzones
**Eerste bouw-levering van de Running Specialist Roadmap Fase 1. Drie
ontwerpbeslissingen vooraf vastgelegd (overleg 19 juli 2026): Daniels
VDOT voor Pace Zones, trainingsdagen apart van Cycling, records straks
volledig automatisch (aparte levering).**

**Bevinding vooraf: Goal Engine, Memory Engine en Coach Policy waren
al generiek** — `running/coach/route.ts` gebruikte al dezelfde
`learning-engine.ts`/`coach-policy.ts`/`goal-engine.ts` als Cycling,
gewoon met `specialist_type='running'`. Punten 6-8 van de oorspronkelijke
Fase 1-lijst (koppeling Goal/Memory/Master Coach) bleken dus al klaar —
geen nieuw werk nodig.

### Daniels VDOT — geverifieerd vóór implementatie
De VO2/%VO2max-formules (Daniels &amp; Gilbert, 1979, publiek
gepubliceerd — niet de propriëtaire commerciële VDOT-tabellen) zijn
vóór het bouwen extern geverifieerd tegen een onafhankelijke bron met
dezelfde worked example: 5K in 20:00 → VDOT 49,8, exacte match. Zone-
percentages (Easy 59-74%, Marathon ~84%, Threshold ~88%, Interval
~98%, Repetition >100%) komen uit meerdere onafhankelijke, elkaar
bevestigende bronnen.

- **Nieuw:** `src/lib/specialists/running-zones.ts` —
  `berekenVDOT(afstandM, tijdSec)`, `berekenPaceZones(vdot)`,
  `formatteerPace()`. Volledig deterministisch, geen AI.
- **Nieuw:** `src/app/api/specialists/running/profile/route.ts` —
  GET/PUT, spiegelbeeld van cycling/profile. Slaat geen los VDOT-getal
  op maar een recent race-resultaat (afstand + tijd + datum) — zo werkt
  de Daniels-methode ook echt (VDOT hoort uit een prestatie te komen,
  niet losstaand geschat)
- **Nieuw:** `src/app/settings/running-profile/page.tsx` —
  race-resultaat-invoer (voorkeuzeknoppen 5K/10K/Halve/Marathon + vrije
  tijd-invoer), max hartslag, sensoren (hartslagmeter/cadanssensor/
  hardloop-vermogensmeter), **eigen trainingsdagen/beschikbare uren**
  (bewust los van Cycling, zoals afgesproken), live VDOT + Pace Zones-
  preview (client-side, exact dezelfde functies als de server)
- **Hartslagzones: hergebruikt `berekenHartslagZones()` uit
  `cycling-zones.ts`** — geen dubbele implementatie, dat model was al
  sport-onafhankelijk
- `src/app/coach/running/page.tsx` — instellingen-icoon toegevoegd in
  de header, zelfde patroon als de Cycling Hub

**Gevalideerd vóór levering:**
- `npx next build` — compileert zonder fouten, nieuwe route en pagina
  beide aanwezig in de build-output
- VDOT-formule extern geverifieerd tegen een onafhankelijke bron (zie
  boven) vóórdat er code geschreven werd
- De daadwerkelijke productiecode (niet een losse test-kopie) los
  uitgevoerd: `berekenVDOT(5000, 1200)` → 49,8, bevestigt dat er geen
  overtypfout is geslopen bij het overzetten naar TypeScript

**Uitdrukkelijk nog niet in deze levering** (volgt apart): Dashboard,
automatische Records (nieuw afstand-gebaseerd curve-algoritme, andere
wiskunde dan de tijd-gebaseerde vermogenscurve), Pace Curve, Progress
Center, Grafieken, Trainingsplan, Kalender.

**Test-instructies:**
1. Running Hub → instellingen-icoon → Running Profile
2. Race-resultaat invullen (bijv. 5K in 20:00) → VDOT en Pace Zones
   moeten direct live verschijnen, zonder op te slaan
3. Opslaan → herladen → gegevens moeten behouden blijven
4. Max hartslag invullen → Hartslagzones moeten verschijnen
5. Trainingsdagen instellen → controleren dat dit **niet** de Cycling-
   trainingsdagen overschrijft (aparte specialist_profiles-rij)

## v2.4.125 — Running Specialist: Master Spec + Roadmap vastgelegd
**Puur documentatie, geen code. Voorbereiding op het bouwen van
Running naar het niveau van Cycling — "overleg voor bouwen", zoals
altijd bij grote features.**

- **Nieuw:** `docs/running-specialist-master-spec.md` — het volledige
  eindbeeld, door de gebruiker aangeleverd (Dashboard, Performance
  Center, Records, Pace Curve, Pace Zones, Trainingsbelasting,
  Progressie, Trainingsplan, Kalender, Wedstrijden, toekomstige Garmin
  API-uitbreidingen)
- **Nieuw:** `docs/running-specialist-roadmap-v1.md` — gefaseerde
  uitvoering (Fase 1 Foundation / Fase 2 Professional / Fase 3
  Intelligence), zelfde aanpak als de Cycling-roadmap: geen ene
  gigantische levering, kleine testbare stappen

**Bevindingen bij het opstellen van de roadmap — wat al bestaat vs.
wat nieuw is:**
- Data Layer + Analysis Engine + Hub-UI bestaan al sinds v2.4.83
- `tcx-parser.ts` verzamelt al: hartslag, cadans, Running Power
  (indien sensor aanwezig), snelheid, hoogte, afstand — voor Running-
  activiteiten net zo goed als voor Cycling
- **Herbruikbaar in plaats van te dupliceren:** `vermogenscurve.ts` se
  sliding-window-wiskunde werkt op elke `{tijdSec, waarde}`-reeks, dus
  rechtstreeks toepasbaar op snelheid voor een Pace Curve; Cycling's
  hartslagzones-berekening (`berekenHartslagZones()`) is al sport-
  onafhankelijk en direct herbruikbaar voor Running
- **Nog niet aanwezig, moet nieuw:** Running Profile (drempeltempo),
  Pace Zones-berekening, Records, Pace Curve, Progress Center,
  Grafieken, Trainingsplan, Kalender

**Openstaande ontwerpbeslissingen** (vastgelegd in de roadmap, bij
start van Fase 1 te beslissen): welk publiek pace-zone-model (Daniels
VDOT / Pfitzinger), of trainingsdagen/beschikbare uren gedeeld worden
tussen Cycling en Running of apart blijven, en welke recordsafstanden
automatisch worden opgeslagen vs. alleen getoond als data het toelaat.

**Vervolg:** Fase 1 (Running Foundation — Profile, Pace Zones,
Hartslagzones, Dashboard) bouwen zodra akkoord.

## v2.4.124 — Z4-zonenaam verkort (bleef wrappen ondanks v2.4.123)
**Gemeld met screenshot: Z4 wrapte nog steeds naar 2 regels, óók na
volledig sluiten/heropenen van de PWA. De v2.4.123-layoutfix
(`whitespace-nowrap`/`flex-shrink-0`) staat bevestigd correct in de
live code — het probleem zit dieper dan alleen CSS.**

- `src/lib/specialists/cycling-zones.ts` — Z4-naam verkort van
  `'Drempel (Lactate Threshold)'` naar `'Drempel'`. De Engelse
  toevoeging was inhoudelijk overbodig (Drempel dekt de betekenis al)
  en was precies de reden dat de regel te lang werd om op één regel te
  passen — dit is dus zowel een leesbaarheids- als een layoutfix.
- Geen andere zonenamen aangepast — Z7 ("Neuromusculair vermogen") is
  korter en past al op één regel, bevestigd in eerdere screenshots.

**Nog niet opgelost, apart aandachtspunt:** de gebruiker meldde dat de
v2.4.123-fix niet zichtbaar was ondanks een volledige app-herstart —
mogelijk hardnekkigere PWA/Safari-caching dan verwacht
(`skipWaiting: false` in `next.config.js`). Gevraagd om ter controle
de pagina één keer in gewone Safari (niet de PWA) te openen, om cache
en code-probleem uit elkaar te trekken. Als dat inderdaad caching
blijkt te zijn, is dat een apart vervolgpunt (bijv. `skipWaiting: true`
overwegen, met de bijbehorende trade-offs).

**Test-instructies:**
1. Power Center → Power Zones → Z4 moet nu "Z4 — Drempel" tonen,
   228–263 W op één regel
2. Settings → Cycling Profile → zelfde check

## v2.4.123 — Fix: Power Zones-weergave brak bij lange zonenamen
**Gemeld met screenshot: Z4 ("Drempel (Lactate Threshold)") wrapte naar
2 regels, waardoor ook de wattwaarde rechts ("228–263 W") uiteenviel in
"228–263" en "W" op aparte regels — lelijk en onduidelijk.**

- `src/app/coach/cycling/power/page.tsx` — Power Zones-rij: `items-center`
  → `items-start` (voorkomt scheve verticale uitlijning als de naam
  wrapt), zonenaam krijgt `flex-1 min-w-0` (mag nu netjes zelf wrappen),
  wattwaarde krijgt `whitespace-nowrap flex-shrink-0` (breekt nooit meer
  middenin, blijft altijd op één regel rechts uitgelijnd)
- `src/app/settings/cycling-profile/page.tsx` — zelfde fix toegepast op
  zowel Vermogenszones als Hartslagzones (identiek patroon, zelfde
  risico — proactief meegenomen al was dit niet expliciet gemeld)

**Test-instructies:**
1. Power Center → Power Zones-kaart → Z4 ("Drempel (Lactate
   Threshold)") — naam mag over 2 regels lopen, wattwaarde rechts moet
   altijd op één regel blijven staan
2. Settings → Cycling Profile — zelfde check voor zowel Vermogenszones
   als Hartslagzones

## v2.4.122 — Vermogenscurve uitgebreid naar 12 duurpunten
**10s, 3min en 45min toegevoegd aan de vermogenscurve — de volledige
klassieke power-curve-set. Kleine, geïsoleerde wijziging: alleen de
duur-lijst in de al-bestaande berekening, geen nieuwe SQL (geen
CHECK-constraint op `duration_sec`), geen nieuwe API-route.**

- `src/lib/vermogenscurve.ts` — `CURVE_DUREN` uitgebreid van 9 naar 12
  punten: `5, 10, 15, 30, 60, 180, 300, 600, 1200, 1800, 2700, 3600`
  (was: `5, 15, 30, 60, 300, 600, 1200, 1800, 3600`)
- `docs/vermogenscurve-datalaag-spec.md` — bijgewerkt als bron van
  waarheid (duur-lijst + SQL-commentaar)
- Geen wijziging nodig aan `labelVoorDuur()` op Power Center of het
  Grafieken-scherm — beide formatteren al correct voor 10s (< 60s-tak)
  en 45min (< 3600s-tak)

**⚠️ Bewuste beperking, zoals eerder afgesproken (v2.4.118-overleg):
GEEN terugwerkende kracht.** Activiteiten geïmporteerd vóór v2.4.122
krijgen deze drie nieuwe duurpunten niet — de ruwe seconde-voor-seconde
vermogensdata is na het parsen niet bewaard (bewuste keuze, zie spec),
dus niet met terugwerkende kracht herberekenbaar. Nieuwe Garmin-imports
vanaf nu krijgen wel alle 12 punten. Gevolg: gebruikers kunnen tijdelijk
een mix van 9- en 12-punten-curves zien totdat oudere activiteiten uit
de geschiedenis rollen of opnieuw geïmporteerd worden.

**Ook relevant voor Critical Power (v2.4.121):** het CP-model gebruikt
alleen punten tussen 2-30 minuten (120-1800s). Het nieuwe 45min-punt
(2700s) valt daarbuiten en wordt dus NIET meegenomen in de CP-
berekening — dat is bewust, het model is fysiologisch alleen geldig in
dat bereik. Het 3min-punt (180s) valt er wél binnen en kan de CP-fit
verbeteren zodra er nieuwe data mee binnenkomt.

**Gevalideerd vóór levering:**
- `npx next build` — compileert zonder fouten
- Rekenkern los getest met een synthetische 90-minuten-tijdreeks → alle
  12 duurpunten correct berekend, met de verwachte afname in vermogen
  bij langere duren
- Rand-test met een korte 4-minuten-rit → curve stopt terecht bij 3min,
  5min+ correct weggelaten (rit te kort)

**Test-instructies:**
1. Nieuwe Garmin-activiteit importeren (na deze deploy) → Power Center
   → Vermogenscurve moet 12 balken tonen (was 9), inclusief 10s, 3min
   en 45min (bij een rit lang genoeg voor 45min)
2. Bestaande, al-geïmporteerde activiteiten: curve blijft ongewijzigd
   op de oude 9 punten — dat is verwacht, geen bug
3. Critical Power-sectie: 45min-punt verschijnt niet in "gebruikte
   punten" (bewust, buiten het 2-30 min-bereik)

## v2.4.121 — Critical Power-model op Power Center
**Op verzoek gebouwd vooruitlopend op voldoende datapunten — testen
volgt later zodra er genoeg 5-20 minuten-inspanningen in de
vermogenscurve zitten. Puur een nieuwe berekening, geen nieuwe SQL,
geen nieuwe API-call.**

- **Nieuw:** `src/lib/specialists/cycling-critical-power.ts` —
  `berekenCriticalPower()`, klassiek 2-parameter Critical Power-model
  (Monod &amp; Scherrer, publiek gedocumenteerd): `P(t) = CP + W'/t`,
  via lineaire regressie op vermogen tegen 1/duur. Client-safe (geen
  Supabase-import), werkt op vermogenscurve-data die al op Power
  Center wordt opgehaald — geen nieuwe fetch nodig.
- Alleen punten in het fysiologisch geldige bereik **2-30 minuten**
  worden gebruikt (kortere inspanningen zitten te veel in anaerobe
  capaciteit, langere onderschatten CP door vermoeidheid)
- `src/app/coach/cycling/power/page.tsx` — nieuwe sectie "Critical
  Power" tussen Power Zones en Ontwikkeling: toont CP (watt) en W′
  (kJ), plus **expliciet hoeveel punten gebruikt zijn en welke**
- **Eerlijke betrouwbaarheidsindicatie, bewust ingebouwd:** bij minder
  dan 3 punten of een R² onder 0,9 verschijnt een duidelijke
  amber-melding — geen quasi-precies getal tonen dat meer zekerheid
  suggereert dan de data rechtvaardigt. Bij minder dan 2 punten in het
  geldige bereik: nette lege staat, geen berekening geforceerd.

**Gevalideerd vóór levering:**
- `npx next build` — compileert zonder fouten
- Rekenkern los getest met synthetische data (CP=250W, W'=20000J
  ingebouwd) → model gaf CP=250W, W′≈20057J, R²=1.0 terug — bevestigt
  dat de regressie correct is geïmplementeerd

**Test-instructies (later, zoals afgesproken):**
1. Met minder dan 2 punten in het 2-30 min-bereik: lege staat met
   uitleg, geen berekening
2. Met 2 punten: berekening verschijnt, amber-waarschuwing "minder dan
   3 punten"
3. Met 3+ punten en goede fit (R²≥0,9): geen waarschuwing, CP/W′ direct
   zichtbaar
4. Met 3+ punten maar slechte fit (bijv. een niet-maximale inspanning
   ertussen): amber-waarschuwing met R²-waarde

## v2.4.120 — Vercel Speed Insights toegevoegd
**Voorbereidend op het opstartsnelheid-onderzoek dat bewust is uitgesteld
in v2.4.119 ("geen gok-en-bouw, eerst meten"). Deze levering meet alleen
— lost nog niets op.**

- `package.json` — `@vercel/speed-insights` toegevoegd (^2.0.0)
- `src/app/layout.tsx` — `<SpeedInsights />`-component toegevoegd in de
  root layout, na `{children}` in de `<body>`

**Wat dit oplevert:** zodra dit live staat op Vercel, verzamelt Vercel
automatisch real-world performance-metrics (Core Web Vitals, laadtijden
per pagina) van echt gebruik — zichtbaar in het Vercel-dashboard onder
"Speed Insights". Geen dashboard-configuratie nodig; Vercel detecteert
de component automatisch na deploy.

**Vervolg:** zodra er een paar dagen echte data binnen is, kunnen we
gericht kijken of de eerdere hypothese klopt (meerdere parallelle
Supabase-auth-checks per scherm) of dat er iets anders speelt — dan pas
een fix bouwen, op basis van meting in plaats van aanname.

**Test-instructies:** n.v.t. voor functionaliteit — puur monitoring,
geen zichtbare wijziging in de app zelf. Bevestig na deploy in het
Vercel-dashboard dat Speed Insights data begint te verzamelen.

## v2.4.119 — Zoom hersteld + app-brede navigatie-modernisering
**Twee losstaande fixes op verzoek: pinch-to-zoom werkte nergens meer, en
navigatie "tussen schermen" voelde traag. Geen backend-wijzigingen.**

### 1. Zoom hersteld
`src/app/layout.tsx` — `maximumScale: 1` en `userScalable: false`
verwijderd uit de viewport-config. Deze blokkeerden pinch-to-zoom in de
hele app. Vermoedelijk ooit bedoeld om de iOS-auto-zoom-bug op
inputvelden te voorkomen — die bug is al apart gefixt via een globale
CSS font-size-fix (input font-size ≥16px), dus deze instelling was
overbodig geworden én kostte legitieme pinch-zoom (ook een
toegankelijkheidsprobleem).

### 2. Navigatie gemoderniseerd — router.push() → Link
**Root cause gevonden:** bijna alle interne navigatie gebruikte
`<button onClick={() => router.push(...)}>` in plaats van Next.js'
`<Link href="...">`. Dat verschil is groot: `<Link>` laat Next.js de
doelpagina vooraf laden (prefetch) zodra hij in beeld komt — een tik
voelt dan instant. `router.push()` op een kale button doet dat niet;
elke navigatie laadt pas op het moment van de tik.

**Aanpak:** elke navigatie-knop die ZUIVER navigeert (geen logica
ervoor) is omgezet naar `<Link>`. Knoppen die eerst een actie
uitvoeren — formulier opslaan, activiteit verwijderen, inloggen/
registreren, dan pas navigeren — zijn bewust ONGEWIJZIGD gebleven als
`router.push()`, want `<Link>` kan geen actie vóór de navigatie
uitvoeren.

**31 bestanden gewijzigd, ~46 navigatie-knoppen omgezet naar `<Link>`:**
- Alle Cycling Hub-schermen (Hub, Power Center, Progress Center,
  Grafieken, Kalender, Trainingsplan), Running Hub
- Home, Settings (incl. `Row`-component uitgebreid met een `href`-prop),
  Profiel, Goals, Injuries, Insights, Life Events
- Specialisten-overzicht (incl. 2 kaarten met een `key`-prop die het
  eerste geautomatiseerde patroon misten — apart afgehandeld)
- Archief (`startOefening`-tussenfunctie was overbodig geworden,
  vervangen door een directe `Link` met dynamische route)
- Settings-subpagina's (Garmin Import, Garmin Activity Import,
  Equipment, Hoe werkt CoachOS), Debug, Reset-password, Dagboek,
  Coach Call, Training (recovery: breathing/mobility/relaxation/walk),
  ActiviteitenSectie-component

**Bewust ongewijzigd (behouden als `router.push`)** — allemaal
side-effect-navigatie: login/register/onboarding (formulier→submit→
navigeer), activiteit verwijderen, profiel/equipment opslaan,
checkin, Coach Call-afronding, `home/page.tsx`'s dynamische
snelkoppeling (ruimt eerst scroll-state op), `training/page.tsx`'s
starttraining-knoppen (schrijven eerst naar localStorage), en de
`<Button>`-componentknoppen in reset-password (custom component,
geen kale `<button>`).

**Nog niet aangepakt — bewust:** de opstartsnelheid (app laadt traag
bij openen) is een ANDER probleem met een andere, nog onbevestigde
oorzaak (mogelijk meerdere parallelle Supabase-auth-checks per scherm).
Dat vergt eerst meting (Vercel Speed Insights/Lighthouse), geen
gok-en-bouw — apart vervolgpunt, geen onderdeel van deze levering.

**Validatie:** `npm install` + `npx next build` lokaal gedraaid vóór
levering — compileert zonder fouten of warnings, alle 49 pagina's,
inclusief TypeScript-typechecking en ESLint.

**Test-instructies:**
1. Pinch-to-zoom testen op een willekeurig scherm — moet weer werken
2. Navigeer via Cycling Hub → Power Center / Progress Center /
   Grafieken / Trainingsplan — moet merkbaar sneller aanvoelen
   (prefetch bij in-beeld-komen van de knop)
3. Formulieren nog steeds testen: inloggen, registreren, profiel
   opslaan, activiteit verwijderen — moeten nog steeds normaal werken
   (deze zijn bewust NIET aangepast)
4. Settings-pagina: alle rijen (Profiel, Doelen, Blessures, etc.)
   moeten nog steeds naar de juiste pagina navigeren

## v2.4.118 — Power Center (Fase 1, Cycling Specialist Roadmap)
**Nieuw analysecentrum dat FTP, vermogenscurve, persoonlijke records en
Power Zones samenvoegt tot één professioneel geheel — GEEN nieuwe SQL,
GEEN nieuwe API-routes, GEEN nieuwe berekeningen, GEEN wijzigingen aan
de parser. Puur samenvoeging van vier al-bestaande endpoints.**

- **Nieuw:** `src/app/coach/cycling/power/page.tsx` — haalt in parallel op:
  - `/api/specialists/cycling/grafieken` → vermogenscurve (9 duurpunten:
    5s/15s/30s/1min/5min/10min/20min/30min/60min) + overige records
    (afstand/hoogte/snelheid/grootste week)
  - `/api/specialists/cycling/profile` → FTP + Power Zones (Z1-Z7,
    Coggan-model)
  - `/api/specialists/cycling/ftp-geschiedenis` → FTP-trend over tijd
  - `/api/profile` → gewicht, voor W/kg (FTP ÷ gewicht)
- Indeling: Power-overzicht (FTP + W/kg) → Vermogenscurve (grafiek) →
  Persoonlijke records per duur (elk vermogenscurve-punt IS het
  all-time record voor die duur) → Overige records → Power Zones →
  Ontwikkeling (FTP-historie)
- `src/app/coach/cycling/page.tsx` — Power Center-knop toegevoegd,
  direct onder Progress Center

**⚠️ Bewust NIET in Fase 1 (voorkomt schijndata — alleen all-time-beste
per duur wordt bijgehouden, geen tijdreeks van records):**
- Records door de tijd, beste maand, beste seizoen
- Normalized Power (NP), Intensity Factor (IF), Variability Index (VI)
- TSS/CTL/ATL/TSB-integratie op deze pagina (staat al apart op
  Grafieken-scherm, geschat op gemiddeld vermogen)
- Extra duurpunten 10s/3min/45min (vergt parser-wijziging, geldt dan
  alleen voor nieuwe imports — zie `docs/vermogenscurve-datalaag-spec.md`)
- Klimanalyse, sprintanalyse

**Ontwerp-principe:** het Power Center is een fundament, geen eindpunt
— toekomstige vermogensanalyses (bovenstaande lijst) krijgen later een
extra sectie op déze pagina, niet een nieuwe navigatie-ingang.

**Test-instructies:**
1. Ga naar Cycling Hub → Power Center
2. Zonder FTP ingesteld: lege staat met knop naar Cycling Profile
3. Met FTP maar zonder gewicht: W/kg toont "gewicht ontbreekt"
4. Met FTP + gewicht: W/kg correct berekend
5. Vermogenscurve leeg (geen Garmin-import sinds v2.4.110): sectie
   verborgen, geen lege grafiek
6. FTP-historie met 1 punt: geen trend-pijltje, wel de melding dat een
   trend zichtbaar wordt bij een volgende meting
7. FTP-historie met 2+ punten: trend-pijltje (stijgend/dalend/stabiel)
   naast het FTP-getal in Power-overzicht

## v2.4.117 — Roadmap-document bijgewerkt: vermogenscurve Garmin-pad afgerond
**Puur documentatie. Bevinding: het document stond nog op "🔜 Uitbreiding
van de Garmin/Strava-import" alsof beide nog moesten gebeuren, terwijl
het Garmin-pad al sinds v2.4.115 volledig live staat.**

- Status-header bijgewerkt: Fase 3 vermogenscurve Garmin-pad ✅, Strava
  + overige uitbreidingen nog open
- Vermogenscurve-sectie herschreven: wat al werkt (berekening, opslag,
  UI-grafiek) vs. wat nog resteert (Strava-streams-integratie, duur-
  specifieke records in de Records-kaart, Critical Power-model)
- Samenvattende tabel: Fase 3 opgesplitst in losse, traceerbare rijen
  i.p.v. één "bewust nog niet gestart"-rij die niet meer klopte

**Test-instructies:** n.v.t. — documentatie-only.

## v2.4.115 — Vermogenscurve-datalaag: UI (afronding van Fase 3-punt)
**Laatste stap van de spec (`vermogenscurve-datalaag-spec.md`) — de
data wordt sinds v2.4.110 verzameld, nu ook zichtbaar.**

- `src/lib/specialists/cycling-grafieken.ts` — `haalVermogenscurve()`:
  all-time beste vermogen per duur, `max(watts)` per `duration_sec`
  over alle activiteiten heen. Puur een query, geen nieuwe berekening
- `src/app/api/specialists/cycling/grafieken/route.ts` —
  `vermogenscurve` toegevoegd aan de bestaande response
- `src/app/coach/cycling/grafieken/page.tsx` — nieuwe grafiek-kaart,
  vóór Records. Staafdiagram met pixel-hoogtes (niet CSS-percentages —
  zelfde patroon als de v2.4.104-fix), leesbare duur-labels
  (5s/15s/30s/1m/5m/10m/20m/30m/1u). **Expliciet vermeld in de UI:**
  geen terugwerkende kracht voor activiteiten van vóór v2.4.110

**Hiermee is het Fase 3-punt "vermogenscurve-datalaag" (spec → SQL →
Garmin-integratie → UI) volledig afgerond voor het Garmin-pad.**
Strava-integratie (zelfde onderliggende berekening, andere databron)
staat nog open als los vervolgpunt.

**Test-instructies:** zie bericht bij levering.

## v2.4.114 — Fix: Coach Call reageert niet meer (gevolg van v2.4.112)
**Gemeld: "kan niet meer reageren" bij Coach Call. Root cause: het
wissen van coach_call_items (v2.4.112) liet een Coach Call soms volledig
leeg achter — `call.coach_call_items.every()` op een lege lijst is
"vacuously true", dus de pagina toonde alleen een "Klaar"-knop zonder
enig item om op te reageren. Geen crash, wel een verwarrende lege staat.**

- `src/app/api/activities/[id]/route.ts` (DELETE) — legt vóór het
  wissen van `coach_call_items` de betrokken `coach_call_id`('s) vast;
  ná het wissen wordt gecheckt of een Coach Call daardoor leeg is
  geworden, en zo ja op `status: 'expired'` gezet — dezelfde status die
  elders al gebruikt wordt voor niet-meer-relevante Coach Calls
  (`coach-calls/route.ts`)
- `src/app/coach-call/page.tsx` — expliciete lege-staat toegevoegd
  (`heeftItems`-check), i.p.v. te vertrouwen op het "vacuous truth"-
  gedrag van `every()` op een lege lijst. Nette boodschap + knop terug
  naar Home, in plaats van een lege pagina

**Voor de al-bestaande, al-vastzittende Coach Call** (van vóór deze
fix) — eenmalige opschoon-SQL:
```sql
update coach_calls
set status = 'expired'
where status in ('pending', 'partial')
  and id not in (select distinct coach_call_id from coach_call_items);
```

**Test-instructies:** zie bericht bij levering.

## v2.4.113 — Fix: "Wissen mislukt" — tweede, gemiste foreign-key
**Gevonden bij test: v2.4.112 ruimde alleen `coach_call_items` op vóór
het wissen, maar dat bleek niet de (enige) blokkade.**

- `src/app/api/activities/[id]/route.ts` (DELETE)
  - **Tweede gekoppelde tabel gevonden:** `garmin_activity_imports.
    activity_session_id` verwijst ook naar `activity_sessions` (gezet
    bij een bevestigde import, zie `garmin-activity-tcx/route.ts`).
    Wordt nu losgekoppeld (`activity_session_id: null`) vóór het
    wissen — het import-record zelf blijft bestaan (historische
    waarde: wanneer/hoe geïmporteerd), alleen de verwijzing naar de
    nu-te-wissen activiteit verdwijnt
  - **Foutmelding nu specifiek** i.p.v. het generieke "Wissen mislukt"
    zonder reden — geeft voortaan de daadwerkelijke database-foutmelding
    terug, zodat een volgend probleem (als dat zich voordoet) meteen
    zichtbaar is zonder serverlogs nodig te hebben

**Test-instructies:** zie bericht bij levering.

## v2.4.112 — Fix: Garmin-import gebruikte altijd vandaag als datum + activiteiten wissen
**Gemeld: twee oude (historische) activiteiten geïmporteerd, maar
kwamen op de datum van vandaag te staan i.p.v. hun eigen datum.**

### Bug gevonden en gefixt
`src/app/api/health/garmin-activity-tcx/route.ts` — `activity_sessions.date`
werd altijd op `today` gezet, ongeacht de daadwerkelijke datum in het
TCX-bestand. `parsed.start_date` (het `<Id>`-element, ISO-tijdstip) werd
al gebruikt in `notes` voor duplicaat-detectie, maar nooit voor het
daadwerkelijke `date`-veld. **Nu:** de activiteitsdatum wordt afgeleid
uit het bestand zelf (`activiteitDatum`), `today` blijft alleen een
noodgreep als het bestand geen bruikbare datum bevat.

**Bewust ongewijzigd:** `coach_calls.date` blijft `today` — een
coach-evaluatie die vandaag wordt aangemaakt voor een net-geïmporteerde
historische rit hoort logischerwijs op vandaag te staan (dat is wanneer
de gebruiker gevraagd wordt 'm te evalueren), niet op de historische
datum.

### Activiteiten wissen — nieuw
Om de twee verkeerd-gedateerde imports (en toekomstige fouten) op te
kunnen ruimen zonder tussenkomst.
- `src/app/api/activities/[id]/route.ts` — nieuwe `DELETE`-methode.
  Bevestigt eerst ownership (`user_id`) vóór het wissen. Ruimt
  gekoppelde `coach_call_items` eerst op (voorkomt een mogelijke
  foreign-key-fout, ongeacht hoe die koppeling in het schema staat).
  `cycling_power_curve` wordt automatisch meegewist via de al-bestaande
  `on delete cascade`
- `src/app/activities/[id]/page.tsx` — wis-knop (prullenbak-icoon)
  naast de titel, met verplichte bevestigingsstap ("dit kan niet
  ongedaan worden gemaakt") vóór het definitief wissen

**Test-instructies:** zie bericht bij levering.

## v2.4.111 — Herziening: Activiteiten weer een eigen navigatietab
**Op verzoek teruggedraaid t.o.v. v2.4.93 — de balk is al horizontaal
scrollbaar, dus 6 tabs is geen probleem, en een eigen tab werkt
prettiger dan een sectie binnen Voortgang.**

- `src/components/layout/index.tsx` — Activiteiten terug in
  `navItems`, tussen Specialisten en Voortgang (nu 6 tabs)
- `src/app/progressie/page.tsx` — Activiteiten-sectie verwijderd
  (stond bovenaan sinds v2.4.93), ongebruikte import opgeruimd
- `src/app/activities/page.tsx` — terugknop verwijderd, is nu een
  primaire tab zoals de andere hoofdschermen (geen "terug", net als
  Home/Coach/Trainer/Specialisten/Voortgang)
- `src/app/activities/[id]/page.tsx` — terugknop weer naar
  `/activities` (was `/progressie` sinds de v2.4.94-fix)
- `src/app/settings/garmin-activity-import/page.tsx` — "Bekijk
  activiteiten"-knop na een import weer naar `/activities`
- `docs/navigation-architecture-v1.md` — herziening vastgelegd,
  document bijgewerkt naar 6 tabs

**Test-instructies:** zie bericht bij levering.

## v2.4.110 — Vermogenscurve-datalaag: Garmin-integratie ⚠️ RAAKT BESTAANDE IMPORT-CODE
**Stap 1-3 van de spec (`vermogenscurve-datalaag-spec.md`): berekening +
SQL + Garmin-integratie. Strava-integratie en UI volgen apart.**

**Aanvullende bevinding tijdens het bouwen:** het parsen gebeurt
**client-side** in de browser (isomorfe `tcx-parser.ts`) — de server
ontvangt alleen het al-samengevatte JSON-resultaat, nooit het ruwe
bestand. De berekening moest daarom in de parser zelf, niet in de
server-route. Daarnaast bleek er **geen tijdstempel per trackpoint**
geparsed te worden — toegevoegd (`tp.Time`, verplicht TCX-veld), zodat
de vermogenscurve een **tijd-gebaseerd** schuivend venster gebruikt in
plaats van een aanname dat elk punt exact 1 seconde is (TCX-devices
samplen niet altijd regelmatig).

- **Nieuw:** `src/lib/vermogenscurve.ts`
  - `berekenVermogenscurve()` — two-pointer schuivend venster over
    daadwerkelijke tijdstempels, standaard duren
    5s/15s/30s/1min/5min/10min/20min/30min/60min
  - Isomorf (geen server-only imports) — herbruikbaar voor de latere
    Strava-integratie
- **Nieuw:** `supabase/cycling_power_curve.sql` — smalle tabel
  (activity × duur → watt), exact zoals in de spec
- `src/lib/tcx-parser.ts`
  - `tp.Time` nu meegelezen per trackpoint
  - Vermogen-met-tijdstempel apart verzameld (`vermogenMetTijd`), naast
    de bestaande `wattsValues` (die blijft voor gemiddelde/max)
  - `TcxParsed`-type uitgebreid met `vermogenscurve`
- `src/app/api/health/garmin-activity-tcx/route.ts`
  - Vermogenscurve opgeslagen in **beide** paden: nieuwe activiteit
    (insert) én overschrijving van een bestaande (upsert, i.v.m. de
    unique-constraint bij een tweede upload van dezelfde rit)
  - Eigen try/catch op beide plekken — een probleem met de
    curve-opslag mag de import zelf nooit laten falen

**Bewust nog niet gedaan:** Strava-integratie (nieuwe streams-API-
aanroep), UI (vermogenscurve-grafiek, duur-specifieke records).

**Test-instructies:** zie bericht bij levering — dit raakt de bestaande
Garmin-importflow, extra zorgvuldig testen aanbevolen.

## v2.4.109 — Nieuw document: Vermogenscurve-datalaag (compacte spec)
**Status: TE TOETSEN. Fase 3-punt van de Cycling Specialist Roadmap.**

**Twee haalbaarheidsbevindingen die de scope kleiner maken dan
aangenomen in de roadmap:**
1. **Garmin:** `tcx-parser.ts` verzamelt al een chronologische
   seconde-voor-seconde `wattsValues`-array per trackpoint — berekent
   daar alleen gemiddelde/max uit en gooit de rest weg. **Geen nieuwe
   import-uitbreiding nodig**, alleen een aanvullende berekening
2. **Strava:** bestaande OAuth-scope (`activity:read_all`,
   `strava/auth/route.ts`) is al voldoende voor de streams-API. **Geen
   nieuwe autorisatie nodig** bij al-gekoppelde gebruikers

- **Nieuw:** `docs/vermogenscurve-datalaag-spec.md`
  - Gedeelde, deterministische berekening: schuivend venster over
    5s/15s/30s/1min/5min/10min/20min/30min/60min
  - **Opslag:** smalle `cycling_power_curve`-tabel (activity × duur →
    watt), niet breed — maakt "all-time beste 5 minuten" een simpele
    query, precies wat records en het toekomstige Critical Power-model
    nodig hebben. Geen ruwe tijdreeks opgeslagen, alleen de
    samengevatte beste-inspanningen
  - Integratiepunten: `tcx-parser.ts` (Garmin, kleinste wijziging) +
    nieuwe streams-aanroep in `strava-activity-processor.ts`
  - **Eerlijk benoemd wat dit niet oplost:** geen terugwerkende
    vermogenscurve voor al-gesynchroniseerde activiteiten, Critical
    Power-model zelf is een apart vervolgpunt
  - Bouwvolgorde: berekeningsfunctie → SQL → Garmin-integratie (laagste
    risico) → Strava-integratie → UI

**⚠️ Raakt bij implementatie bestaande, actieve import-code** (Garmin-
en Strava-sync) — vergt dezelfde zorgvuldigheid als elke andere
wijziging aan bestaande productiecode.

**Volgende stap, na goedkeuring:** implementatie, startend met de
Garmin-integratie (laagste risico, data al beschikbaar).

## v2.4.108 — Roadmap volledig bijgewerkt + FTP-geschiedenis toegevoegd
**Twee wijzigingssets samengevoegd in één levering: de eerder aangekondigde
roadmap-statusupdate (die nog niet gecommit bleek) én FTP-geschiedenis,
zodat er geen inconsistente tussentoestand ontstaat ongeacht commit-volgorde.**

### Roadmap-document bijgewerkt naar de daadwerkelijke, geteste status
`cycling-specialist-roadmap-v1.md` gaf tot nu toe overal "Niet gestart"
— dat klopte al sinds v2.4.91 niet meer.
- Status-header: "Fase 1-2 volledig afgerond (v2.4.91-107)"
- Elke sub-fase (2a t/m 2i) krijgt een status-markering + versienummer
- 2g/2h formeel bevestigd als afgerond via bestaande infrastructuur
  (Memory Engine, Goal Engine, CoachPolicy, SpecialistSummary)
- Samenvattend overzicht volledig herschreven

### FTP-geschiedenis — bewust vroeg toegevoegd
**Strategische keuze uit vervolgoverleg:** niet pas bouwen wanneer de
vermogenscurve-datalaag (Fase 3) er is, maar nu al — elke dag later is
historische data die nooit meer wordt ingehaald.

- **Nieuw:** `supabase/cycling_ftp_geschiedenis.sql` — één rij per keer
  dat FTP is opgeslagen, met datum
- `src/app/api/specialists/cycling/profile/route.ts` (PUT) — logt
  automatisch naar de geschiedenis zodra FTP onderdeel is van een update
  (niet bij elke opslag — alleen als FTP daadwerkelijk is meegestuurd).
  Eigen try/catch: falen van de logging blokkeert nooit de kernopslag
- **Nieuw:** `src/app/api/specialists/cycling/ftp-geschiedenis/route.ts`
  — GET, geeft de volledige geschiedenis terug
- `src/app/coach/cycling/progress/page.tsx` — toont nu een echte
  FTP-trend (eenvoudig staafdiagram) zodra er 2+ punten zijn. Bij 0-1
  punten: eerlijke tekst dat de geschiedenis wordt opgebouwd, geen lege
  belofte

### Fase 3 uitgebreid met een concreet, apart punt: vermogenscurve-datalaag
Vastgelegd, volgens het vervolgoverleg: dit is een **nieuwe datalaag**
(gedetailleerde Garmin/Strava-vermogensdata, nieuwe tabellen, een eigen
analyse-engine) — bewust **losgekoppeld** van de Adaptive Training
Engine, die blijft er volledig onafhankelijk van. Ontgrendelt bij
realisatie: vermogenscurve, beste 30/60/90/180 min, Critical Power,
W′-modellen.

**Test-instructies:** zie bericht bij levering.

## v2.4.107 — Cycling Specialist Roadmap Fase 2i: Progress Center
**"Het feitelijke hart van de Cycling Hub" — consolideert bestaande data
uit al-gebouwde bronnen tot één overzicht. Geen nieuwe berekeningen,
puur hergebruik.**

**⚠️ Eerlijk niet gebouwd:** FTP-ontwikkeling over tijd — er wordt alleen
een huidig FTP-getal opgeslagen, geen geschiedenis. Een grafiek zou dus
één punt tonen, geen trend. Dit vergt eerst FTP-historie bijhouden
(nieuwe kolom/tabel) — bewust niet nu toegevoegd om geen schijngrafiek
te tonen. Expliciet zichtbaar in de UI zelf.

- **Nieuw:** `src/app/coach/cycling/progress/page.tsx` — haalt in
  parallel op:
  - FTP + W/kg (FTP uit Cycling Profile ÷ gewicht uit `/api/profile`,
    dat laatste bestond al en werd hier alleen hergebruikt)
  - Doelvoortgang (`/api/specialists/cycling/doelvoortgang`, Fase 2c)
  - Records-samenvatting (`/api/specialists/cycling/grafieken`, Fase 2e)
  - Memory-inzichten — alleen `status: active`-items, max 3
  - Coach-samenvatting (laatst gegenereerde advies)
  - Nette leeg-staat als er nog helemaal geen data is
- `src/app/coach/cycling/page.tsx` — Progress Center-knop toegevoegd,
  **bovenaan** de snelkoppelingen (belangrijkste plek, consistent met
  "het hart van de Hub")

**Fase 2i hiermee afgerond.** Resterend van de oorspronkelijke Fase 2-
lijst: 2g (Coach-verdieping) en 2h (Master Coach-integratie) — beide
grotendeels al impliciet aanwezig (Memory/Goal Engine/CoachPolicy/
SpecialistSummary bestaan en werken al sinds eerdere fasen), eerder een
bevestigingsronde dan nieuwe bouw.

**Test-instructies:** zie bericht bij levering.

## v2.4.106 — Cycling Specialist Roadmap Fase 2f: Ritanalyse
**Zelfde patroon als de Coach-uitleglaag (Fase 2a): eerst volledig
deterministische analyse, dan pas AI die dat omzet in leesbare
feedback — AI beslist niets.**

**⚠️ Eerlijk gevlagde beperking:** "volgens schema"-vergelijking matcht
op **datum**, niet op een expliciete koppeling — `completed_activity_id`
(al aanwezig sinds v2.4.96) wordt nergens automatisch ingevuld. Bij
meerdere fietsritten op één dag kan dit dus de verkeerde geplande sessie
raken. Bekende, geaccepteerde beperking van deze eerste versie, expliciet
in code-comments vastgelegd.

- **Nieuw:** `src/lib/specialists/cycling-rit-analyse.ts` — deterministisch:
  - Vermogenszone (hergebruikt `berekenVermogensZones()` uit Fase 1)
  - Hartslagzone (hergebruikt `berekenHartslagZones()`)
  - Cadans-beoordeling (gangbare, publieke richtlijn: <70 laag, 70-95
    normaal, >95 hoog)
  - "Volgens schema": duur binnen 20% van het geplande — een ruwe
    indicatie, geen exacte match-eis
- **Nieuw:** `src/app/api/specialists/cycling/rit-analyse/route.ts` —
  AI ontvangt de al-vastgestelde feiten, produceert alleen de
  natuurlijke-taal-evaluatie
- `src/app/activities/[id]/page.tsx` — nieuwe sectie, **alleen zichtbaar
  bij fietsritten** (`activities.name` in de bekende Cycling-namen) —
  "Laat je Cycling Coach deze rit analyseren"-knop, toont de evaluatie
  na een tik

**Fase 2f hiermee afgerond.** Volgende, per de roadmap: Fase 2g
(Coach-verdieping) of Fase 2h (Master Coach-integratie, bevestiging/
verdieping van het bestaande contract).

**Test-instructies:** zie bericht bij levering.

## v2.4.105 — Cycling Specialist Roadmap Fase 2e: Records
**Bewust GEEN los "Records Center" — onderdeel van het bestaande
Grafieken-scherm, precies zoals de roadmap voorschrijft.**

**⚠️ Eerlijke beperking, vooraf:** "beste inspanning per duur"
(5s/30s/1min/5min/20min/60min) vergt een vermogenscurve uit seconde-
voor-seconde data — die wordt niet opgeslagen (zelfde beperking als NP
voor TSS, zie v2.4.103). Gebouwd is uitsluitend wat eerlijk berekenbaar
is uit wat per rit al is opgeslagen.

- `src/lib/specialists/cycling-grafieken.ts` — `haalRecords()`:
  - Langste rit (km + apart: langste tijd in minuten)
  - Meeste hoogtemeters
  - Hoogste vermogen (max_watts — dit IS beschikbaar per rit, ook zonder
    NP-curve)
  - Hoogste gemiddelde snelheid
  - Grootste week — hergebruikt de al-bestaande wekelijkse-volumes-
    berekening, geen nieuwe query
- `src/app/api/specialists/cycling/grafieken/route.ts` — `records`
  toegevoegd aan de bestaande response
- `src/app/coach/cycling/grafieken/page.tsx` — nieuwe Records-kaart,
  tussen Trainingsbelasting en de FTP-ontbreekt-melding. Toont alleen
  records waarvoor daadwerkelijk data bestaat (geen lege/kapotte
  velden), met de beperking zichtbaar in de kaart zelf

**Fase 2e hiermee afgerond.** Volgende, per de roadmap: Fase 2f
(Ritanalyse) of Fase 2g (Coach-verdieping).

**Test-instructies:** zie bericht bij levering.

## v2.4.104 — Fix: staafdiagram wekelijks volume onzichtbaar
**Gevonden bij test: week-labels toonden correct (bevestigt dat de data
er wel was), maar de staafjes zelf waren onzichtbaar — een CSS-bug, geen
data-bug. CTL/ATL-grafiek (SVG, geen percentage-hoogtes) werkte al wel
correct, wat de root cause bevestigde.**

- `src/app/coach/cycling/grafieken/page.tsx` — staafhoogtes worden nu in
  **pixels** berekend (`Math.round((v.totaal_km / maxKm) * 128)`) i.p.v.
  CSS-percentages. Root cause: percentage-hoogte in een geneste flex-
  kolom-container resolveert niet betrouwbaar zonder een expliciete
  hoogte op de directe ouder — die ontbrak

**Geen wijziging aan de databerekening zelf** (`cycling-grafieken.ts`
blijft ongewijzigd) — dit was zuiver een weergaveprobleem.

**Test-instructies:** zie bericht bij levering.

## v2.4.103 — Cycling Specialist Roadmap Fase 2d: Grafieken
**Wekelijks volume + CTL/ATL/TSB (Coggan-methode). Geen nieuwe npm-
dependency — CSS-staafdiagram + native SVG-lijndiagram.**

**⚠️ Belangrijke, eerlijk gedocumenteerde beperking:** TSS vereist
normaliter Normalized Power (NP), berekend uit een seconde-voor-seconde
vermogensreeks — die wordt niet opgeslagen (alleen avg_watts/max_watts
per rit). Wat hier berekend wordt is een **schatting** op basis van
gemiddeld vermogen (`IF ≈ avg_watts/FTP`, `TSS_geschat = uren × IF² ×
100`) — nauwkeurig bij gelijkmatige ritten, minder bij intervaltraining.
Dit wordt overal expliciet "geschat" genoemd, nooit als exacte TSS
gepresenteerd — zowel in code-comments, de API-respons
(`tss_is_schatting: true`), als een zichtbare waarschuwing in de UI.

- **Nieuw:** `src/lib/specialists/cycling-grafieken.ts`
  - `berekenGeschatteTSS()` — de schattingsformule hierboven
  - `haalWekelijkseVolumes()` — km/minuten/gem. vermogen per week
  - `haalCTLATLTSB()` — publiek gedocumenteerde EWMA-formules (CTL:
    42-dagen-venster, ATL: 7-dagen-venster, TSB: CTL-ATL), **geen FTP
    ingesteld → eerlijk lege array, geen gegokte waarden**
  - Historie wordt 42 dagen ruimer opgehaald dan gevraagd, zodat CTL al
    "ingegroeid" is vóór de weergegeven periode
- **Nieuw:** `src/app/api/specialists/cycling/grafieken/route.ts`
- **Nieuw:** `src/app/coach/cycling/grafieken/page.tsx`
  - Staafdiagram wekelijks volume (CSS, geen dependency)
  - Lijndiagram CTL (fitness, blauw) + ATL (vermoeidheid, amber) — eigen
    lichte SVG-component, geen chart-library nodig
  - "Vorm" (TSB) prominent getoond, kleur-gecodeerd
  - Nette leeg-staat + doorverwijzing naar Cycling Profile als er geen
    FTP is ingesteld
- `src/app/coach/cycling/page.tsx` — link naar Grafieken toegevoegd

**Fase 2d hiermee afgerond.** Volgende, per de roadmap: Fase 2e
(Records) of Fase 2f (Ritanalyse).

**Test-instructies:** zie bericht bij levering.

## v2.4.102 — Cycling Specialist Roadmap Fase 2c: Dashboard
**Voegt de twee dingen toe die de roadmap noemt en die nog ontbraken op
de Cycling Hub: "volgende training" en "doelvoortgang". De bestaande
statistieken (vermogen/afstand/belasting) bestonden al sinds v2.4.68.**

- **Nieuw:** `src/app/api/specialists/cycling/doelvoortgang/route.ts` —
  dunne laag over de al-bestaande Goal Engine, geen nieuwe berekening.
  Geeft het leidende (hoogste `importance`) specialist-scoped
  Cycling-doel terug
- `src/app/coach/cycling/page.tsx` — nieuwe "Vandaag"-sectie, bovenaan
  vóór de AI-samenvatting:
  - **Vandaag-kaart:** haalt de sessie van vandaag op uit de al-bestaande
    training-plan-API, tikken gaat naar het Trainingsplan-scherm
  - **Doel-kaart:** toont het leidende doel + dagen tot deadline, tikken
    gaat naar de bestaande doelen-UI
  - Beide zijn verrijkingen — falen hiervan blokkeert de rest van de Hub
    nooit (eigen try/catch, stille fallback)
  - Gebruikt de gedeelde, tijdzone-veilige `isoDatum()` (v2.4.101) voor
    de vandaag-vergelijking — geen nieuwe datum-bug geïntroduceerd

**Fase 2c hiermee afgerond.** Volgende, per de roadmap: Fase 2d
(Grafieken, incl. CTL/ATL/TSB via de Coggan-methode).

**Test-instructies:** zie bericht bij levering.

## v2.4.101 — Fix: tijdzone-bug in alle datum-berekeningen van de Training Plan Engine ⚠️ BESTAAND PLAN HEEFT MOGELIJK VERKEERDE DATUMS
**Gevonden bij test: de Trainingskalender toonde "zaterdag 18 juli" bij
een geselecteerde dag 19. Root cause: `d.toISOString().split('T')[0]`
converteert naar UTC — voor gebruikers in een tijdzone vóór op UTC
(Nederland, UTC+2 in de zomer) verschuift dit lokale-middernacht-datums
een dag terug. Zat op 8 plekken in 5 bestanden, niet alleen de kalender.**

- **Nieuw:** `isoDatum()` in `src/utils/index.ts` — bouwt de YYYY-MM-DD-
  string uit lokale datumcomponenten (`getFullYear`/`getMonth`/
  `getDate`), nooit een UTC-conversie. Geen tijdzone-afhankelijke
  verschuiving meer, ongeacht waar de gebruiker zich bevindt
- **Alle 8 voorkomens vervangen**, in 5 bestanden:
  - `src/lib/specialists/training-plan-generator.ts` (3x — `start_date`,
    `end_date`, en elke sessie-datum)
  - `src/lib/specialists/training-plan-adjuster.ts` (1x — "vandaag" voor
    de Daily Adjustment Layer-triggers)
  - `src/app/coach/cycling/trainingsplan/page.tsx` (3x)
  - `src/app/coach/cycling/kalender/page.tsx` (1x — de lokale, foute
    functie is verwijderd, importeert nu de gedeelde, correcte versie)
  - `src/app/api/specialists/cycling/training-plan/explain/route.ts`
    (1x)

**⚠️ BELANGRIJK — het al gegenereerde trainingsplan in de database is
met de foute functie berekend, dus de opgeslagen datums kunnen één dag
verschoven zijn t.o.v. wat bedoeld was.** Aanbevolen: genereer het plan
opnieuw (POST /api/specialists/cycling/training-plan) ná het uitrollen
van deze fix, zodat alle datums vanaf nu correct berekend worden. Het
oude plan wordt daarbij automatisch op `abandoned` gezet (bestaand
gedrag, geen dataverlies, alleen niet meer actief).

**Geen SQL nodig voor deze fix** — puur een rekenfout in de applicatie-
laag, geen schemawijziging.

## v2.4.100 — Cycling Specialist Roadmap Fase 2b: Trainingskalender
**Maandweergave van het adaptieve trainingsplan. Hergebruikt dezelfde
GET /api/specialists/cycling/training-plan als het planningsscherm —
geen nieuwe API, andere weergave van dezelfde data.**

- **Nieuw:** `src/app/coach/cycling/kalender/page.tsx`
  - Maandgrid, weken beginnen op maandag, kleur-gecodeerd per
    trainingstype (duurtraining/interval/herstel/tempo/lange
    duurtraining)
  - Status zichtbaar via transparantie: afgerond (vol), gepland
    (gedempt), overgeslagen (zeer licht)
  - Tik op een dag → detail-kaart met type/duur/status/aanpassingsreden
  - Maand-navigatie (vorige/volgende)
  - **Bewust eerlijk over de rolling horizon:** dagen buiten de komende
    1-2 weken tonen gewoon leeg, met de tekst *"Nog geen concrete
    training gepland — dit volgt zodra deze week dichterbij komt"* —
    geen nepdata, geen suggestie van een volledig ingevulde maand
- `src/app/coach/cycling/trainingsplan/page.tsx` — knop naar de
  kalender toegevoegd, naast de bestaande Ververs-knop

**Fase 2b hiermee afgerond.** Volgende, per de roadmap: Fase 2c
(Dashboard) of Fase 2d (Grafieken) — beide bouwen voort op dezelfde,
al-bestaande data.

**Test-instructies:** zie bericht bij levering.

## v2.4.99 — Adaptive Training Plan Engine, sub-stap 3/3: UI
**Laatste sub-stap van Fase 2a — het planningsscherm. Toont wat de Plan
Generator + Daily Adjustment Layer (deterministisch) bepaalden, met de
Coach-uitleglaag-tekst voor vandaag prominent.**

- **Nieuw:** `src/app/coach/cycling/trainingsplan/page.tsx`
  - **Vandaag**, prominent bovenaan: type, duur, en de AI-uitleg (haalt
    automatisch `/training-plan/explain` op) — inclusief een badge als
    de sessie is aangepast (reason code vertaald naar leesbare tekst,
    bijv. "Aangepast — laag herstel")
  - **Komende trainingen**: rolling-horizon-sessies, met status-iconen
    (afgerond/overgeslagen/aangepast)
  - Expliciete uitleg in de UI zelf: *"Verder dan [datum] plant de coach
    nog geen concrete dagen — dat volgt automatisch zodra die week
    dichterbij komt"* — geen valse indruk van een volledig ingevuld
    lange-termijn-schema
  - Leeg-staat met een "Genereer je trainingsplan"-knop als er nog geen
    plan bestaat
- `src/app/coach/cycling/page.tsx` — prominente knop naar het nieuwe
  Trainingsplan-scherm toegevoegd, tussen de statistieken-grid en de
  tekstuele advies-kaarten

**Fase 2a (Adaptive Training Plan Engine) hiermee volledig afgerond:**
spec ✅, Decision Contract ✅, Engine zonder AI ✅, Coach-uitleglaag ✅, UI ✅.

**Volgende stap volgens de roadmap:** Fase 2b (Trainingskalender) — een
bredere, sport-overstijgende kalenderweergave, of verdere verdieping
binnen Fase 2 (bijv. Fase 2c Dashboard, Fase 2d Grafieken).

**Test-instructies:** zie bericht bij levering.

## v2.4.98 — Fix: prompttoon Coach-uitleglaag ("stiekem"-woordkeuze)
**Gevonden bij test: de instructie "dit was eerder onzichtbaar, dat mag
niet meer" duwde de AI naar dramatische taal ("ik heb de sessie stiekem
al teruggebracht... dat is iets wat je verdiend recht hebt om te
weten"). Geen architectuurprobleem — de data-doorstroming werkte
correct — puur een promptkwaliteitsfix.**

- `src/app/api/specialists/cycling/training-plan/explain/route.ts` —
  instructie herschreven naar neutraal/feitelijk: *"noem dit gewoon als
  een normale, verstandige coachbeslissing... geen dramatische taal,
  geen suggestie dat dit een geheim was"*

**⚠️ Cache-kanttekening voor het testen:** de sessie van vandaag heeft
al een gecachte (foute) uitleg staan van de vorige test —
`explained_at >= updated_at` zorgt dat die zonder ingrijpen opnieuw
teruggegeven wordt. Zie test-instructies bij levering voor de SQL om
dit te wissen.

## v2.4.97 — Adaptive Training Plan Engine, Fase 2: Coach-uitleglaag
**Bron: Decision Contract sectie 5. AI ontvangt decision + reason code +
context, produceert de menselijke uitleg, beslist NIETS.**

**Directe verbetering op de test-bevinding bij Fase 1:** de stille
volume-reductie (CoachPolicy `volumeAdjustmentPct`, die al werd toegepast
maar niet werd uitgelegd) wordt nu **expliciet** als context aan de AI
meegegeven — het verschil tussen `load_target` (baseline-uren) en
`duration` (na-aanpassing-minuten) wordt berekend en, indien relevant,
verplicht benoemd in de uitleg.

- **Nieuw:** `supabase/training_plan_uitleg.sql` — `explanation` +
  `explained_at` direct op `training_plan_sessions`, geen nieuwe tabel
- **Nieuw:**
  `src/app/api/specialists/cycling/training-plan/explain/route.ts`
  - Leest de sessie van vandaag + reason code (indien aangepast) +
    actuele CoachPolicy
  - Berekent expliciet of er een stille volume-reductie was, en
    forceert de AI om dat te benoemen als dat het geval is
  - Prompt: *"de beslissing staat al vast... jij verzint niets en
    wijzigt niets, je zet de al-genomen beslissing om in menselijke
    uitleg"* — reason codes worden vertaald naar gewone taal (bijv.
    `fatigue_detected` → "de herstelwaarden van vandaag waren laag")
  - Cache op de sessie zelf: alleen opnieuw genereren als de sessie
    sindsdien is gewijzigd (`explained_at` vs. `updated_at`)
  - Nette fallback-tekst als de AI-call faalt — geen crash
- `src/app/debug/page.tsx` — testsectie toegevoegd

**Volgende stap:** Fase 3 — UI (planningsscherm, aanpassen,
coachgesprek, historie).

**Test-instructies:** zie bericht bij levering.

## v2.4.96 — Adaptive Training Plan Engine, Fase 1: Engine zonder AI
**Eerste implementatiestap, volgens `adaptive-training-plan-engine-spec.md`
+ `adaptive-training-plan-decision-contract-v1.md` (beide goedgekeurd).
Volledig deterministisch — geen AI-aanroep in deze hele fase.**

- **Nieuw:** `supabase/training_plan_engine.sql`
  - `training_plans` + `training_plan_sessions`, exact de velden uit het
    Decision Contract
  - **Database-constraint, niet alleen documentatie:**
    `adjustment_reason` is verplicht zodra `status='adjusted'` — een
    check-constraint, geen sessiewijziging kan zonder reason code
    opgeslagen worden
  - RLS: alleen server-side schrijven (Plan Generator/Daily Adjustment),
    zelfde patroon als eerdere specialistlaag-tabellen
- **Nieuw:** `src/lib/specialists/training-plan-generator.ts` (Plan
  Generator)
  - Mesocyclus-verdeling: basis (40%) → opbouw (35%, met 3:1-herstelweek-
    patroon) → piek (15%) → herstel/taper (10%) bij een streefdatum;
    standaard 12-weken-macrocyclus zonder streefdatum
  - **Rolling horizon, zoals vastgelegd:** volledige dagplanning alleen
    voor de komende 2 weken, verder weg geen sessie-rijen — alleen de
    mesocyclus-week-targets bestaan al
  - **Prioriteitsketen afgedwongen, niet alleen gedocumenteerd:** elke
    voorgestelde sessie wordt vóór opslag getoetst aan `CoachPolicy` —
    een interval bij `forbiddenTrainingTypes` bevat "hoge_intensiteit"
    wordt automatisch teruggebracht naar duurtraining, volume wordt
    verlaagd bij een negatieve `volumeAdjustmentPct`
  - Analysis Engine-data daadwerkelijk gebruikt: eerste basisweek wordt
    verzacht als de huidige trainingsbelasting fors onder het
    streefvolume ligt — voorkomt een te agressieve sprong in week 1
  - Leidend doel: specialist-scoped Cycling-doel met hoogste
    `importance` uit de bestaande Goal Engine
- **Nieuw:** `src/lib/specialists/training-plan-adjuster.ts` (Daily
  Adjustment Layer)
  - **Eerlijke dekking, expliciet in de code gedocumenteerd:**
    `missed_session`/`injury_protection`/`goal_change` volledig
    geïmplementeerd. `fatigue_detected` gedeeltelijk (alleen huidige dag,
    nog niet "meerdere dagen op rij" — vergt historische CoachPolicy-
    snapshots die nog niet bijgehouden worden). `vacation_mode` nog niet
    (vergt eerst een UI voor onbeschikbare dagen)
  - Bij elke aanpassing: origineel blijft bewaard (`original_session_id`
    + `cancelled`-status), nieuwe sessie krijgt de verplichte reason code
- **Nieuw:** `src/app/api/specialists/cycling/training-plan/route.ts`
  - `POST` — genereert een nieuw plan (sluit eerst een eventueel
    bestaand actief plan af, nooit twee actieve plannen tegelijk)
  - `GET` — voert eerst de Daily Adjustment Layer uit, dan pas de
    actuele sessies teruggeven — altijd up-to-date bij het bekijken
- `src/app/debug/page.tsx` — testsectie toegevoegd

**Bewust nog niet gebouwd (volgt in Fase 2-3):** Coach-uitleglaag (AI
zet reason codes om in menselijke uitleg), Kalender-UI, `vacation_mode`-
trigger, volledige `fatigue_detected`-dekking.

**Test-instructies:** zie bericht bij levering.

## v2.4.95 — Nieuw document: Adaptive Training Plan Engine — Decision Contract v1.0
**Status: TE TOETSEN. Aanvulling op `adaptive-training-plan-engine-spec.md`
(v2.4.92) — drie aanscherpingen na review, vóór de eerste code.**

- **Nieuw:** `docs/adaptive-training-plan-decision-contract-v1.md`
  - **Prioriteitsketen afdwingbaar in code:** `CoachPolicy > Cycling
    Specialist > Plan Generator` — geen documentatie-intentie, maar een
    échte validatiestap: elk sessievoorstel wordt vóór opslag getoetst
    aan de actuele CoachPolicy, overschrijdingen worden automatisch
    teruggebracht binnen de grens vóórdat de gebruiker het ziet
  - **5 verplichte reason codes**, niet optioneel: `missed_session`,
    `fatigue_detected`, `injury_protection`, `vacation_mode`,
    `goal_change` — elke sessiewijziging moet er één krijgen, maakt
    specifieke Coach-uitleg mogelijk i.p.v. "je plan is aangepast"
  - **Sessie-levenscyclus vastgelegd:** `planned → scheduled →
    completed/skipped/adjusted/cancelled`. Bij `adjusted` blijft de
    oorspronkelijke sessie bewaard (`original_session_id`), geen
    verloren historie
  - **Database-velden uitgebreid** t.o.v. de "op hoofdlijnen"-versie in
    de hoofdspec: volledige kolomdefinities voor `training_plans` en
    `training_plan_sessions`, inclusief `adjustment_reason` (verplicht
    bij `adjusted`) en `completed_activity_id`
  - Bouwvolgorde herbevestigd: Fase 1 (Engine zonder AI) → Fase 2
    (Coach-uitleglaag, AI beslist niets) → Fase 3 (UI)

**Volgende stap, na goedkeuring van dit document:** implementatie start
bij de Plan Generator — volledig deterministisch, testbaar zonder AI.

## v2.4.94 — Fix: 4 verouderde route-verwijzingen na navigatie-herstructurering
**Gevonden na test-feedback: de Cycling Hub-terugknop ging naar /chat
i.p.v. /specialisten. Bredere sweep uitgevoerd, drie soortgelijke
plekken extra gevonden — zelfde bug-patroon, telkens een hardcoded
verwijzing naar een route die vóór v2.4.93 de juiste "vorige plek" was,
maar dat nu niet meer is.**

- `src/app/coach/cycling/page.tsx` — terugknop: `/chat` → `/specialisten`
- `src/app/coach/running/page.tsx` — terugknop: `/chat` → `/specialisten`
- `src/app/activities/[id]/page.tsx` — terugknop: `/activities` →
  `/progressie` (waar Activiteiten nu daadwerkelijk woont)
- `src/app/settings/garmin-activity-import/page.tsx` — "Bekijk
  activiteiten"-knop na een succesvolle import: `/activities` →
  `/progressie`

**Bewust NIET gewijzigd:** de `/activities`-route zelf blijft bestaan
en werkt — deze fixes gaan alleen over waar knoppen *naartoe* wijzen,
niet over welke routes bestaan.

**Test-instructies:** zie bericht bij levering.

## v2.4.93 — Navigatie-architectuur v1.0: volledige implementatie ⚠️ RAAKT VEEL SCHERMEN
**Alle 5 stappen uit `navigation-architecture-v1.md` in één levering,
inclusief Stap 5 — die bleek NIET uitstelbaar: de balk had in
werkelijkheid 6 items (Activiteiten én Instellingen), niet 5 zoals
aangenomen. Zonder Stap 5 nu al mee te bouwen was Instellingen straks
onbereikbaar geworden.**

- **`src/components/layout/index.tsx`** — definitieve 5-tabs-structuur:
  🏠 Home · 🧠 Coach (`/chat`) · 💪 Trainer (`/training`, was
  "Training") · ⭐ Specialisten (`/specialisten`, NIEUW) · 📈 Voortgang
  (`/progressie`, was "Progressie")
- **Nieuw:** `src/components/ActiviteitenSectie.tsx` — geëxtraheerd uit
  de voormalige losse `/activities`-pagina, herbruikt nu op twee plekken
  (geen logica gedupliceerd). `compact`-prop voor gebruik als sectie
  i.p.v. volledige pagina
- `src/app/activities/page.tsx` — dunne wrapper geworden, blijft bestaan
  voor eventuele diepe links, **niet meer in de navigatiebalk**
- `src/app/progressie/page.tsx` — titel "Progressie" → "Voortgang",
  `ActiviteitenSectie` als eerste sectie ingevoegd (compact-modus,
  max. 5 activiteiten zichtbaar + doorklik naar volledig overzicht)
- **Nieuw:** `src/app/specialisten/page.tsx` — overzichtspagina, drie
  secties (Actief/Beschikbaar/Binnenkort). **Vervangt functioneel** de
  "Mijn Coaches"-chips én de SUGGESTED/RETURNING-lifecycle-banners die
  voorheen in de Coach-tab stonden — geen dubbele ingang
- `src/app/chat/page.tsx` — alle specialist-gerelateerde state/UI
  verwijderd (chips, banners, activatie-logica) — deze tab gaat nu
  uitsluitend over het Master Coach-gesprek, consistent met de nieuwe
  driedeling (Coach/Trainer/Specialisten)
- `src/app/home/page.tsx` — account-icoon toegevoegd naast het
  bel-icoontje, opent `/settings` — dit is nu de enige ingang naar
  Instellingen, nu die geen eigen tab meer heeft

**Bewust NIET aangepast:** `src/app/settings/page.tsx` zelf — alleen de
ingang ernaartoe veranderde, de pagina-inhoud is ongewijzigd.

**Test-instructies:** zie bericht bij levering — dit raakt veel
schermen, extra zorgvuldig testen aanbevolen.

## v2.4.92 — Nieuw document: Adaptive Training Plan Engine (compacte spec)
**Status: TE TOETSEN. Fase 2a van de Cycling Specialist Roadmap v1.0 —
vergt goedkeuring vóór implementatie, zoals bij Fase 1 ook gedaan.**

- **Nieuw:** `docs/adaptive-training-plan-engine-spec.md`
  - **Kernprincipe:** twee lagen — Plan Generation Engine (deterministisch,
    genereert macro/meso/microcycli) + Daily Adjustment Layer
    (deterministisch, vervangt bij CoachPolicy-conflict) + Coach Layer
    (AI, schrijft alleen de uitleg, beslist niets)
  - **Input:** volledig hergebruik van bestaande bronnen (Cycling
    Profile, CoachPolicy, Goal Engine, Analysis Engine, Memory Engine,
    Confidence Engine) — geen nieuwe databron nodig
  - **"Rolling horizon"-planning:** volledige dagplanning voor komende
    1-2 weken, verder weg alleen een week-belasting-target — voorkomt
    valse precisie voor plannen die toch nog wijzigen
  - **5 expliciete herberekenings-triggers:** gemiste training,
    overbelasting-signaal, nieuwe blessure, vakantie/onbeschikbare
    dagen, doelwijziging — elk met concreet gevolg
  - **Rolverdeling herbevestigd:** Master Coach levert alleen
    CoachPolicy-grenzen, nooit planbeslissingen; Cycling Specialist
    beslist de planaanpassing binnen die grenzen — hergebruikt het
    bestaande CoachPolicy/SpecialistSummary-contract, geen nieuwe
    communicatielaag
  - **Database, op hoofdlijnen:** twee nieuwe tabellen
    (`training_plans`, `training_plan_sessions`), geen wijziging aan
    bestaande tabellen — exact schema volgt bij implementatie
  - **Expliciet NIET vastgelegd** (vergt praktijkervaring): exact
    periodiseringsalgoritme, exacte trigger-drempelwaarden

**Volgende stap, na goedkeuring:** implementatie in sub-stappen — eerst
Plan Generation Engine, dan Daily Adjustment Layer, dan Coach Layer-
uitbreiding, dan Kalender-UI (Fase 2b).

## v2.4.91 — Cycling Specialist Roadmap Fase 1: Cycling Foundation
**Eerste implementatiestap van de goedgekeurde v1.0-roadmap
(`docs/cycling-specialist-roadmap-v1.md`). Geen afhankelijkheden, laagste
risico van de hele roadmap.**

**Ontwerpkeuze, zelf gemaakt binnen het al goedgekeurde plan:**
`birth_date` op het **algemene** profiel (`profiles`), niet als
Cycling-specifiek veld — de onderbouwing (leeftijdscategorieën, Masters-
categorieën, leeftijdsafhankelijke zones) is sport-overstijgend, dus ook
bruikbaar voor Running en toekomstige specialisten.

- **Nieuw:** `supabase/fase1_cycling_foundation.sql`
  - `profiles.birth_date` (date, nullable) — nieuwe bron van waarheid
    voor leeftijd, `age` blijft tijdelijk bestaan
  - **Geen nieuwe tabel voor cycling-specifieke velden** — hergebruikt
    de al-bestaande `specialist_profiles.preferences` (jsonb), die al
    door de Coach Layer-routes wordt gelezen
- **Nieuw:** `src/lib/specialists/cycling-zones.ts`
  - `berekenVermogensZones()` — Andrew Coggan's publiek gedocumenteerde
    7-zone-model, **niet** een namaak van een propriëtair platform-model
  - `berekenHartslagZones()` — gangbaar 5-zone-%-van-max-hartslag-model
  - `berekenLeeftijd()` — hulpfunctie voor weergave uit `birth_date`
  - Volledig deterministisch, geen AI
- **Nieuw:** `src/app/api/specialists/cycling/profile/route.ts`
  - `GET`/`PUT` voor het Cycling Profile: FTP, max hartslag, sensoren
    (vermogensmeter/hartslagmeter/cadanssensor/smarttrainer/Zwift),
    trainingsdagen, beschikbare uren per week
  - **Bewust NIET opgeslagen:** gewicht, lengte, rusthartslag,
    ervaringsniveau — bestaan al elders, geen duplicatie
  - Validatie op alle velden (bijv. FTP 1-600W, max hartslag 1-250bpm)
  - Zones worden direct meeberekend en meegegeven in de response, alleen
    als de bijbehorende brondata daadwerkelijk is ingevuld
- **Nieuw:** `src/app/settings/cycling-profile/page.tsx`
  - Volledig instellingenscherm, toont berekende zones live na opslaan
  - Toelichting in de UI zelf: *"Gewicht, lengte en rusthartslag beheer
    je via je algemene profiel"* — voorkomt verwarring over waar iets
    hoort
- `src/app/settings/page.tsx` — link naar Cycling Profile toegevoegd
- `src/app/coach/cycling/page.tsx` — instellingen-icoontje toegevoegd
  naast de titel, snelle toegang vanuit de context waar het relevant is

**Bewust buiten scope van Fase 1** (volgt in Fase 2, Adaptive Training
Plan Engine): FTP/zones nog niet meegenomen in de Coach Layer-prompt of
CoachPolicy — dat gebeurt zodra de Training Plan Engine daadwerkelijk
gebouwd wordt en dit als input nodig heeft.

**Test-instructies:** zie bericht bij levering.

## v2.4.90 — Nieuw document: Navigatie-architectuur v1.0 (GOEDGEKEURD, ontwerp)
**Definitieve herstructurering van de hoofdnavigatie, principieel
vastgelegd — niet als tijdelijke Cycling-oplossing. Implementatie
bewust NIET in deze levering — dit raakt te veel schermen om in één
stap te doen, zie het 5-stappen-implementatieplan in het document zelf.**

- **Nieuw:** `docs/navigation-architecture-v1.md`
  - Drie niveaus, ieder een eigen vraag: **Trainer** ("wat doe ik
    vandaag") / **Specialist** ("hoe word ik beter in [sport]") /
    **Voortgang** ("hoe ontwikkel ik me over alle sporten heen")
  - Definitieve navigatie: 🏠 Home · 🧠 Coach · 💪 Trainer ·
    🚴 Specialisten (nieuw) · 📈 Voortgang — 5 tabs, binnen de gangbare
    grens voor duim-bereik
  - **Activiteiten** verhuist van eigen tab naar eerste sectie binnen
    Voortgang — "een activiteit is geen doel, maar een gebeurtenis die
    bijdraagt aan 'ga ik vooruit'"
  - Profiel/Instellingen: geen 6e tab, via account-icoon vanuit Home
  - **Bewuste, uitgelegde dubbeling:** Records/Kalender bestaan zowel
    bij Voortgang (gecombineerd) als bij een Specialist (sport-
    specifiek) — twee verschillende vragen, geen inconsistentie
  - "Mijn Coaches"-chips (Coach-tab, sinds v2.4.69/83) migreren logisch
    naar de nieuwe Specialisten-tab
  - **5-staps-implementatieplan**, elke stap apart testbaar: (1)
    labels/iconen wijzigen, (2) Activiteiten verhuizen naar Voortgang,
    (3) Specialisten-overzichtspagina bouwen, (4) Specialisten-tab
    toevoegen + chips verwijderen uit Coach, (5) Profiel-menu

**Volgende stap, bij akkoord:** implementatiestap 1 (labels/iconen) —
laagste risico, puur cosmetisch, routes ongewijzigd.

## v2.4.89 — CoachOS Cycling Specialist Roadmap v1.0 (GOEDGEKEURD)
**Definitieve versie na overleg. Bestandsnaam gewijzigd t.o.v. het
eerdere concept: `cycling-specialist-roadmap-v1.md` (niet
`cycling-specialist-bouwplan.md` — dat concept is nooit gecommit,
vervangen vóór het live ging).**

- **Nieuw:** `docs/cycling-specialist-roadmap-v1.md`
  - **Fase 1 — Cycling Foundation:** Cycling Profile + automatische
    zone-berekening. Definitieve, niet-dubbele veldenlijst na twee
    duplicatie-checks tijdens het overleg:
    - Bevestigd al bestaand, niet toegevoegd: gewicht, lengte,
      rusthartslag, ervaringsniveau
    - **Beslist: geboortedatum (`birth_date`) i.p.v. leeftijd** —
      `profiles.age` veroudert handmatig, geboortedatum levert
      leeftijd/leeftijdscategorieën/Masters-categorieën automatisch.
      Migratiepad: `age` blijft tijdelijk bestaan, dynamisch berekend,
      totdat gebruikers hun geboortedatum invullen
    - **Beslist: geen apart "belangrijkste doel"-veld** — zou een derde
      bron van waarheid worden naast `user_goals`/Goal Engine. Cycling
      Coach haalt het hoogst-`importance`-Cycling-doel rechtstreeks uit
      de bestaande Goal Engine, getoond in Dashboard, wijzigbaar via de
      bestaande doelen-UI
  - **Fase 2 — Cycling Coach Professional:** één samenhangend leverblok
    (2a-2i), geen losse "Centers" die bestaande infrastructuur zouden
    dupliceren:
    - 2a Adaptive Training Plan Engine (kern, eigen spec-document eerst)
    - 2b Trainingskalender, 2c Cycling Dashboard, 2d Grafieken
      (incl. CTL/ATL/TSB, Coggan-methode), 2e Records, 2f Ritanalyse
    - 2g Coach-verdieping — gebruikt uitsluitend bestaande Memory/Goal
      Engine/CoachPolicy/SpecialistSummary, geen nieuwe engine
    - 2h Master Coach-integratie (bevestiging/verdieping van bestaand
      contract sinds v2.4.80)
    - **2i Progress Center (nieuw, uit het overleg)** — centrale plek
      voor FTP-ontwikkeling, W/kg, doelvoortgang, records, Memory-
      inzichten, coach-samenvattingen. Het feitelijke "hart" van de
      Cycling Hub
  - **Fase 3 — Uitbreidingen, expliciet later:** Event Engine, Zwift/
    Wahoo/Hammerhead, Nutrition Specialist, Triathlon Specialist, Race
    Planner, Live Coaching

**Volgende stap:** Fase 1 (Cycling Foundation) implementeren.

## v2.4.88 — Doelen-UI voor de Goal Engine
**Maakt de Goal Engine (v2.4.86-87) voor het eerst normaal bruikbaar —
tot nu toe alleen bereikbaar via een directe API-call. Ontworpen om
schaalbaar te zijn: een toekomstige specialist toevoegen betekent alleen
een nieuwe `DOELTYPES`-regel + `PRESETS`-entry, geen structuurwijziging.**

- `src/app/goals/page.tsx` — nieuw-doel-flow herbouwd in drie stappen:
  1. **Doeltype** — 🌍 Algemeen, 🚴 Wielrennen, 🏃 Hardlopen (actief),
     🚣 Roeien, 🏋️ Krachttraining (zichtbaar maar uitgeschakeld — status
     'development' in `specialist_config`, geen overclaiming)
  2. **Doel** — preset-chips per specialist (Cycling: FTP verhogen,
     Kilometerdoel, Hoogtemeters, Gran Fondo, Tijdrit, Klimprestatie.
     Running: 5/10km, halve/hele marathon, Weekkilometers, Tempo) of een
     eigen omschrijving
  3. **Belangrijkheid** (Hoog/Normaal/Laag → `importance`) + de
     velden die voor dat specifieke preset relevant zijn (bijv. "Streef-
     FTP (watt)" bij FTP verhogen, "Wedstrijddatum" bij Gran Fondo) —
     niet elk doel toont dezelfde generieke velden
  - Bestaande doelen-lijst toont nu een specialist-icoon i.p.v. altijd
    hetzelfde generieke doel-icoon, plus een MUST/hoog-badge bij
    `importance`
  - `voegToe()` stuurt nu `goal_scope`/`specialist_type`/`importance`
    mee — volledig aangesloten op de API die dit sinds v2.4.86-87 al
    ondersteunt

**Test-instructies:** zie bericht bij levering.

## v2.4.87 — Rechtzetting: importance (gebruiker) vs. calculated_urgency (Goal Engine) ⚠️ RAAKT PRODUCTIECODE

**⚠️ Build-fix, ontdekt via een mislukte Vercel-deploy op de eerste
v2.4.87-levering:** `src/app/api/specialists/decision-test/route.ts`
gebruikte `let hoogsteImportance: string | undefined` — te generiek
getypeerd. De Decision Engine verwacht specifiek
`'must' | 'high' | 'normal' | 'low' | undefined`
(`GoalImportance | undefined`), en TypeScript's strict typecheck
weigerde terecht een gewone `string` daarvoor te accepteren. Gecorrigeerd
door `GoalImportance`/`CalculatedUrgency` (uit `goal-engine.ts`) te
importeren en te gebruiken i.p.v. generieke `string`-types. **Dit is de
enige plek waar deze fout zat** — `api/coach/route.ts` leunt op
typeninferentie vanuit de Goal Engine zelf en compileert correct.
**Correctie op v2.4.86. Daar was `urgency` een door de gebruiker
ingevuld, statisch veld — dat vermengt twee verschillende concepten die
apart moeten blijven, en zou de Decision Engine kunnen laten sturen door
een gebruikersinschatting in plaats van de werkelijkheid (bijv. "FTP
280W" als "critical" markeren terwijl de wedstrijd nog 9 maanden weg is).**

- **`supabase/goal_engine_importance_rechtzetting.sql`**
  - Hernoemt `urgency` → `importance` (veilig ongeacht of v2.4.86 al
    gedraaid was — gebruikt een conditionele check)
  - Nieuwe waardenschaal: `must`/`high`/`normal`/`low` (was
    `critical`/`high`/`normal`/`low`) — bestaande `critical`-waarden
    gemigreerd naar `must`
- **`src/lib/specialists/goal-engine.ts`** — volledig herbouwd:
  - `importance` — **opgeslagen**, door de gebruiker ingesteld, stabiel
  - `calculated_urgency` — **NOOIT opgeslagen**, elke keer opnieuw
    berekend door `berekenCalculatedUrgency()`, puur op basis van
    deadline-nabijheid (≤7 dagen: critical, ≤30: high, ≤90: normal,
    anders/geen deadline: low)
  - **Eerlijk vastgelegde beperking, ongewijzigd:** nog geen "op schema"-
    beoordeling op basis van voortgang — vergt een vastgelegde
    startwaarde/-datum die nu niet bestaat, expliciet als toekomstige
    uitbreiding genoteerd in de code zelf
- **`src/lib/specialists/decision-engine.ts`** — regel 4/5 herschreven:
  regel 4 beslist eerst op `importance` (gebruikerskeuze), **alleen bij
  een gelijke stand** wordt regel 5 (`calculated_urgency`) geraadpleegd
  als secundaire tiebreaker — niet meer één vermengd veld
- `src/app/api/goals/route.ts` — `POST`/`PATCH` accepteren nu
  `importance` (niet meer `urgency`), met de nieuwe waardenschaal
- `src/app/api/specialists/cycling/coach/route.ts`,
  `.../running/coach/route.ts` — prompt toont nu `importance` en
  `calculated_urgency` als twee aparte regels, niet meer samengevoegd
- `src/app/api/coach/route.ts` — haalt nu apart de hoogste `importance`
  én de hoogste `calculated_urgency` per specialist op, geeft beide door
  aan de Decision Engine
- `src/app/api/specialists/decision-test/route.ts` — testroute toont nu
  ook `hoogsteImportance` naast `hoogsteUrgentie`

**Test-instructies:** zie bericht bij levering.

## v2.4.86 — Goal Engine + Decision Engine regels 4-5 ⚠️ RAAKT PRODUCTIECODE
**Global vs. Specialist Goals-onderscheid, zoals vastgelegd in
specialist-api.md v2.4.72, nu daadwerkelijk gebouwd. Ontgrendelt ook
Decision Engine-regels 4-5 (lange termijn, gebruikersdoel als
tiebreaker).**

- **Nieuw:** `supabase/goal_engine_kolommen.sql`
  - `user_goals.goal_scope` ('global'/'specialist', default 'global' —
    backwards compatible)
  - `user_goals.specialist_type` (nullable, alleen gevuld bij
    scope='specialist')
  - `user_goals.urgency` ('critical'/'high'/'normal'/'low', default
    'normal')
  - **Belangrijk, expliciet gecheckt:** `priority` bestond al
    (integer, weergavevolgorde, auto-opgehoogd) — **niet hergebruikt/
    overschreven**, `urgency` is een nieuwe, aparte kolom
- **Nieuw:** `src/lib/specialists/goal-engine.ts`
  - `berekenGoalProgress()` — deterministisch: dagen tot deadline,
    ruwe waarde-kloof (`target_value - current_value`)
  - **Bewust eerlijk begrensd:** claimt NIET te weten of de gebruiker
    "op schema" ligt volgens een verwachte voortgangscurve (geen
    vastgelegde startwaarde/-datum om dat op te baseren), en
    interpreteert NIET welke richting (omhoog/omlaag) "goed" is voor
    een doel — dat blijft aan de AI, die de doeltitel in natuurlijke
    taal leest
  - `haalGoalsMetProgress(userId, specialistType?)` — met
    `specialistType`: global-doelen + specialist-specifieke doelen van
    díe specialist. Zonder: alle doelen (Master Coach-gebruik)
- `src/app/api/goals/route.ts` — `POST`/`PATCH` accepteren nu
  `goal_scope`/`specialist_type`/`urgency`, met validatie
  (specialist_type verplicht bij scope='specialist')
- `src/app/api/specialists/cycling/coach/route.ts`,
  `.../running/coach/route.ts` — lichte doelen-fetch vervangen door
  `haalGoalsMetProgress()`, prompt toont nu scope + urgentie + kloof +
  deadline per doel
- **`src/lib/specialists/decision-engine.ts`** — regels 4-5 toegevoegd:
  bij gelijke belasting/risico tussen specialisten (dus geen winnaar via
  regel 2/3) beslist de hoogste doelurgentie + naaste deadline welke
  specialist vandaag de hoofdfocus krijgt. Retourneert nog steeds `null`
  als er geen aanwijsbaar verschil is
- **`src/app/api/coach/route.ts`** — haalt nu per actieve specialist ook
  de hoogste doelurgentie op (via Goal Engine) en geeft dat door aan de
  Decision Engine — **additief, eigen try/catch behouden**
- `src/app/api/specialists/decision-test/route.ts` — testroute
  bijgewerkt, toont nu ook `hoogsteUrgentie`/`naasteDeadlineDagen` per
  specialist

**Decision Engine nu compleet: regels 2, 3, 4, 5 geïmplementeerd.**
(Regel 1, gezondheid > prestatie, zat al structureel geborgd via
CoachPolicy, geen aparte Decision Engine-logica voor nodig.)

**Test-instructies:** zie bericht bij levering.

## v2.4.85 — Decision Engine: directe testroute
**Los van het dagadvies zelf testbaar — gebruikt echte, actuele
`specialist_summary`'s van je actieve specialisten, geen nepdata. Geen
wijziging aan bestaand gedrag, puur inzicht.**

- **Nieuw:** `src/app/api/specialists/decision-test/route.ts` — haalt
  `CoachPolicy` + de meest recente `specialist_summary` van elke actieve
  specialist op (exact dezelfde ophaal-logica als `api/coach/route.ts`,
  v2.4.84), roept `beslisTussenSpecialisten()` aan, en geeft het volledige
  resultaat terug: welke summaries zijn gebruikt, wat de policy-prioriteit
  was, en de `DecisionResult` (of `null` bij geen conflict)
- `src/app/debug/page.tsx` — testsectie toegevoegd

**Vergt voor een zinvolle test:** 2+ actieve specialisten, elk met een
recente `specialist_summary` (dus eerst bij elke specialist een analyse
gegenereerd hebben).

## v2.4.84 — Decision Engine geïmplementeerd ⚠️ RAAKT PRODUCTIECODE
**Nu voor het eerst zinvol te testen, met Cycling + Running beide actief.
Raakt `api/coach/route.ts` — additief, eigen try/catch, geen bestaand
gedrag verwijderd.**

**Belangrijke precisering vóór implementatie:** regels 1-3 uit
`specialist-decision-engine.md` (gezondheid > prestatie, blessures >
periodisering, herstel > belasting) zitten al **gedeeltelijk** geborgd
via `CoachPolicy` — elke specialist krijgt dezelfde, deterministisch
bepaalde grenzen, dus kan al geen zware training adviseren bij laag
herstel. **Het conflict dat déze Decision Engine daadwerkelijk oplost:**
als meerdere specialisten elk afzonderlijk, binnen hun eigen grenzen,
"meer volume" adviseren, ziet geen van beide dat de **optelsom**
alsnog te veel wordt.

- **Nieuw:** `src/lib/specialists/decision-engine.ts`
  - `beslisTussenSpecialisten()` — volledig deterministisch, geen AI
  - **Regel 2 (blessures/verhoogd risico):** een specialist met
    `risk: 'high'` krijgt altijd voorrang, ongeacht wat anderen
    adviseren
  - **Regel 3 (herstel > belasting):** bij `coachPriority` "recovery" of
    "balance" (dus niet bij een goede hersteldag) — als 2+ specialisten
    tegelijk niet-lage belasting tonen, krijgt alleen degene met de
    hoogste belasting vandaag de hoofdfocus, de rest wordt getemperd
  - Retourneert `null` bij 0-1 specialist of geen conflict — bestaand
    gedrag (alle specialisten gelijkwaardig genoemd) blijft dan intact
  - `DecisionResult`: `selectedCoach`, `rejectedCoaches[]`,
    `appliedRule`, `priorityScore`, `reasoning[]` — exact zoals
    vastgelegd in `specialist-decision-engine.md`
- `src/app/api/coach/route.ts`
  - `genereerCoachPolicy()` nu ook hier aangeroepen (was alleen in de
    specialist-routes) — nodig als input voor de Decision Engine.
    Zelfde deterministische functie, zelfde dag, dus consistente
    uitkomst met wat de specialist-routes al gebruikten
  - Decision Engine aangeroepen tussen het ophalen van de
    SpecialistSummary's en het opbouwen van de prompt-tekst
  - Bij een conflict: getemperde specialisten krijgen een markering
    `[vandaag getemperd — zie Decision Engine-toelichting]` in de
    prompt, plus een aparte toelichting-regel met de reden
  - **Eigen try/catch, additief:** faalt de Decision Engine, dan
    blijven specialisten gewoon gelijkwaardig getoond — geen crash-risico

**Test-instructies:** zie bericht bij levering. Vergt beide specialisten
(Cycling + Running) actief én met een niet-lage belasting om het
conflict-scenario daadwerkelijk te triggeren.

## v2.4.83 — Running: tweede specialist, bewijst herbruikbaarheid van de architectuur
**De belangrijkste test van de hele specialistlaag-architectuur: kan een
tweede specialist gebouwd worden zonder de bestaande architectuur
opnieuw te ontwerpen? Antwoord: ja — grotendeels een invuloefening,
exact zoals voorspeld in `specialist-engine-architecture.md`.**

**Wat volledig hergebruikt is, ZONDER wijziging:**
- `genereerCoachPolicy()` (`coach-policy.ts`) — sport-onafhankelijk,
  geen enkele regel aangepast
- `verwerkKandidaatInzicht()`, `haalMemoryOp()` (`learning-engine.ts`) —
  al generiek via `specialist_type`-parameter, geen wijziging
- Confidence Engine (`confidence-engine.ts`) — ongewijzigd
- `api/coach/route.ts` (Master Coach-integratie) — bleek al generiek
  gebouwd (v2.4.80 loopte al over ALLE actieve specialisten, niet
  hardcoded op cycling) — **geen wijziging nodig**
- Coach Personality (`coach-personality.ts`) — ongewijzigd, zelfde stem

**Wat per sport uniek werk was (zoals voorspeld):**
- **Nieuw:** `src/lib/specialists/running-data.ts` — Data Layer.
  Activiteitnaam geverifieerd (niet aangenomen): Strava
  `SPORT_TYPE_MAP.Run → 'Hardlopen'`, Garmin `ACTIVITEIT_OPTIES`
  bevestigt dezelfde naam, geen indoor/buiten-splitsing zoals bij Fietsen
- **Nieuw:** `src/lib/specialists/running-analysis.ts` — Analysis Engine.
  Belangrijkste inhoudelijke verschil met Cycling: **snelheid**
  (`avg_speed`) i.p.v. **vermogen** (`avg_watts`) — running heeft
  doorgaans geen vermogensmeter
- **Nieuw:** `src/app/api/specialists/running/engine/route.ts`,
  `src/app/api/specialists/running/coach/route.ts` (Coach Layer,
  spiegelbeeld van cycling met "hardlopen"-vakkennis i.p.v. "wielrennen")
- **Nieuw:** `src/app/coach/running/page.tsx` — Hub-UI, spiegelbeeld van
  de Cycling Hub

**Refactor tijdens het bouwen — generieke rekenbibliotheek:**
- `src/lib/specialists/lifecycle-engine.ts` — geherstructureerd naar één
  generieke `berekenLifecycle()`-kernfunctie + dunne per-sport-wrappers
  (`bepaalCyclingLifecycle`, `bepaalRunningLifecycle`), in plaats van
  gedupliceerde logica. Toepassing van de aanscherping uit
  `specialist-api.md` (v2.4.72: "generieke rekenbibliotheek, sport-
  specifieke implementatie") — nu voor het eerst concreet toegepast.

**Generaliseringen aan bestaande, gedeelde bestanden:**
- `src/app/api/specialists/[type]/data/route.ts` — was hardcoded op
  alleen `'cycling'`, nu een `DATA_FETCHERS`-lookup die beide sporten
  ondersteunt
- `src/app/api/specialists/route.ts` — `running` status `development` →
  `active`; `LIFECYCLE_ONDERSTEUND` van een `Set` naar een lookup-map
  (generieker, makkelijker uit te breiden voor een 3e specialist later)
- `src/lib/specialists/capability-registry.ts` — `running`-entry
  toegevoegd, exact dezelfde capability-set als cycling op dit moment
- `src/app/chat/page.tsx` — icoon was hardcoded op `Bike` voor **alle**
  actieve specialisten (klopte toevallig toen er maar één was) — nu een
  `SPECIALIST_ICOON`-lookup (`Bike`/`Footprints`). Zelfde voor de
  SUGGESTED-bannertekst ("je fietst" was hardcoded, nu een
  `SPECIALIST_WERKWOORD`-lookup)

**Bewust NIET aangepast:** `api/coach/route.ts` — bleek al generiek.

**Test-instructies:** zie bericht bij levering.

## v2.4.82 — Memory Engine, sub-stap 5/5 (LAATSTE): terugkoppeling naar Coach Layer
**De Memory Engine is hiermee volledig afgerond — alle 5 sub-stappen.
De Cycling Coach leest voortaan zijn eigen bevestigde geheugen terug bij
elk nieuw advies.**

- `src/app/api/specialists/cycling/coach/route.ts`
  - `haalMemoryOp(userId, 'cycling', true)` opgehaald vóór de prompt
    gebouwd wordt — **alleen `active`-items**, dus al meermaals bevestigd
    door de Learning Engine, geen eenmalige AI-gok
  - Confidence is al actueel dankzij `haalMemoryOp()`'s ingebouwde
    decay-toepassing (Confidence Engine, sub-stap 4) — geen aparte
    herberekening hier nodig
  - Maximaal 5 inzichten meegegeven, gesorteerd op confidence (hoogste
    eerst), expliciet als *"achtergrondkennis, niet als nieuw te
    herhalen conclusie"* — voorkomt dat de AI het als nieuwe ontdekking
    presenteert
  - Eigen try/catch: als Memory ophalen faalt, gaat het advies gewoon
    door zonder die context — geen crash-risico

## 🎉 Memory Engine volledig afgerond — alle 5 sub-stappen

1. ✅ SQL `specialist_memory` (v2.4.73)
2. ✅ Learning Engine — candidate→active promotie (v2.4.74)
3. ✅ Coach Layer stelt kandidaat-inzichten voor (v2.4.75)
4. ✅ Confidence Engine — stijging/decay/auto-deprecate (v2.4.76)
5. ✅ Terugkoppeling naar Coach Layer (v2.4.82)

**Volledige cyclus, nu gesloten:** AI stelt een patroon voor → Learning
Engine bevestigt het pas na meermaals terugkeren → Confidence Engine
onderhoudt het vertrouwen over tijd → Coach Layer leest het terug bij
elk nieuw advies → AI gebruikt het als achtergrondkennis, niet als
losse aanname.

**Test-instructies:** zie bericht bij levering.

## v2.4.81 — Fix: specialist_summary kwam soms null binnen (afkapping)
**Gevonden tijdens Master Coach-integratietest: een verse Cycling-
analyse had `specialist_summary: null`, ondanks de verplichte
prompt-instructie. Waarschijnlijke oorzaak: `max_tokens: 800` was te
krap geworden sinds v2.4.79 het JSON-schema uitbreidde met
`kandidaat_inzichten` + `specialist_summary` — bij uitgebreide
tekstvelden (samenvatting/sterke_punten/aandachtspunten) kon de AI-
respons afkappen vóórdat het bij die laatste twee velden kwam.**

- `src/app/api/specialists/cycling/coach/route.ts`
  - `max_tokens: 800` → `1200` — meer ruimte voor het volledige,
    uitgebreidere schema
  - **Extra vangnet:** `specialist_summary` staat nu **eerst** in het
    JSON-schema-voorbeeld in de prompt (was laatst) — mocht de respons
    ooit alsnog afkappen, is dit veld dan al binnen vóórdat dat gebeurt

**Nog niet met zekerheid bevestigd of dit de enige/volledige oorzaak
was** — eerlijk gezegd, geen 100% garantie tot een volgende test dit
bevestigt. Als het probleem terugkeert, is de volgende stap: het
JSON-schema zelf verkleinen (kortere tekstvelden), of `specialist_summary`
en het advies als twee aparte AI-calls behandelen.

**Test-instructies:** zie bericht bij levering.

## v2.4.80 — CoachPolicy/SpecialistSummary: Master Coach leest terug ⚠️ RAAKT PRODUCTIECODE
**Laatste etappe van het contract uit `specialist-coach-policy.md`. Dit
raakt `api/coach/route.ts` — het bestaande, dagelijkse coach-advies dat
voor iedereen al actief is. Zorgvuldig, additief gebouwd: nieuwe context
wordt toegevoegd, niets bestaands verwijderd of gewijzigd. Faalt de
nieuwe stap, dan gaat het dagadvies gewoon door zonder specialist-context
(eigen try/catch, geen crash-risico).**

- **Rechtzetting op v2.4.79:** `specialist_summary` werd daar bewust
  alleen in de API-response gezet, niet opgeslagen — dat betekende dat
  de Master Coach het nergens kon lezen. Nu gecorrigeerd:
  - **Nieuw:** `supabase/specialist_summary_kolom.sql` — één nullable
    JSONB-kolom op `specialist_analyses`, backwards compatible, geen
    wijziging aan bestaande data/rijen
  - `src/app/api/specialists/cycling/coach/route.ts` — slaat
    `specialist_summary` nu daadwerkelijk op bij de insert
- **`src/app/api/coach/route.ts`:**
  - Nieuwe query in de bestaande Promise.all: welke specialisten zijn
    actief (`specialist_profiles`)
  - Ná de Promise.all, in een **eigen try/catch**: voor elke actieve
    specialist de meest recente `specialist_summary` ophalen uit
    `specialist_analyses`
  - `specialistContext` toegevoegd aan de prompt-samenstelling, **exact
    hetzelfde patroon** als de bestaande context-blokken
    (`garminContext`, `trainingsCoachContext`, etc.) — geen nieuwe
    aanpak geïntroduceerd, aangesloten bij wat er al was
  - Prompt-instructie: *"niet zelf herberekenen, dit is al hun eigen
    analyse"* + *"jij blijft eindverantwoordelijk voor de gezondheids-
    en herstelbeslissing"* — Master Coach neemt specialist-input mee,
    maar behoudt het laatste woord, consistent met de architectuur

**Resultaat:** de twee systemen "praten" nu daadwerkelijk met elkaar —
de vraag die deze hele stap in gang zette. Master Coach → CoachPolicy →
Cycling Coach → SpecialistSummary → Master Coach, volledig gesloten.

**Test-instructies:** zie bericht bij levering. **Extra voorzichtig
testen** aangezien dit het dagelijkse coach-advies raakt.

## v2.4.79 — CoachPolicy/SpecialistSummary: specialist-kant geïmplementeerd
**Eerste etappe van het contract uit `specialist-coach-policy.md`.
Raakt UITSLUITEND de specialist-route, NIET `api/coach/route.ts` —
die kant (Master Coach leest SpecialistSummary terug) is een aparte,
apart af te stemmen stap.**

- **Nieuw:** `src/lib/specialists/coach-policy.ts`
  - `genereerCoachPolicy()` — volledig deterministisch, **geen
    AI-aanroep**. Hergebruikt de bestaande `calculateRecoveryScore()`
    (`src/core/ai-engine/recovery-engine.ts`), vertaalt naar
    `CoachPolicy` volgens de vertaaltabel uit
    `specialist-coach-policy.md` (green→good/high, orange→moderate/
    moderate, red→low/low)
  - Blessure-regel: actieve blessure verlaagt `maxIntensity` met
    minimaal één stap, consistent met Decision Engine-regel 2
- `src/app/api/specialists/cycling/coach/route.ts`
  - `CoachPolicy` wordt opgehaald vóór de prompt gebouwd wordt, als
    **harde grenzen** in de prompt gezet ("beleid, geen ruwe data" —
    de AI ziet nooit HRV-waarden, alleen "max intensiteit: matig")
  - Prompt expliciet: *"je advies mag NOOIT een verboden trainingstype
    aanraden, ongeacht wat de cijfers suggereren"*
  - AI retourneert nu ook `specialist_summary` (load/progress/risk/
    recommendation/confidence) — apart geëxtraheerd, **niet** opgeslagen
    in `specialist_analyses.analysis` (dat blijft exact
    `CyclingCoachAdvies`, ongewijzigd), alleen in de API-response
  - Validatie op de AI-output: ongeldige enum-waarden vallen terug op
    een veilige default, geen crash bij onverwachte AI-output

**Bewust NIET gedaan in deze stap, volgende etappe:** de Master
Coach (`api/coach/route.ts`) leest deze `SpecialistSummary` nog niet —
dat vereist expliciete, aparte afstemming (bestaande productiecode).

**Test-instructies:** zie bericht bij levering.

## v2.4.78 — Nieuw document: Coach Policy & Specialist Summary + up-to-date sweep
**Naar aanleiding van de vraag "praten Master Coach en specialist met
elkaar" — antwoord bleek nee, en dat leidde tot een belangrijk nieuw
architectuurstuk: een deterministisch beleids-contract tussen Master
Coach en specialist, los van de Decision Engine.**

- **Nieuw:** `docs/specialist-coach-policy.md`
  - `CoachPolicy` (Master → Specialist): `recoveryState`, `maxIntensity`,
    `volumeAdjustmentPct`, `priority`, `allowedTrainingTypes`,
    `forbiddenTrainingTypes`, `reasons` — **beleid, geen ruwe data**
    ("max intensiteit: matig", niet "HRV = 45ms")
  - **Bevestigd, geen AI-aanroep:** CoachPolicy-generatie is volledig
    deterministisch, bouwt voort op de al-bestaande
    `calculateRecoveryScore()` (`src/core/ai-engine/recovery-engine.ts`,
    al in gebruik in `api/coach/route.ts`) — concrete vertaaltabel
    score→policy opgenomen
  - `SpecialistSummary` (Specialist → Master): `load`, `progress`,
    `risk`, `recommendation`, `confidence`, `reasons` — rijker dan het
    eerdere illustratieve voorbeeld, sluit aan bij het bestaande
    `EngineResult`-patroon
  - **Expliciet onderscheid van de Decision Engine:** dit contract geldt
    al bij 1 specialist; Decision Engine gebruikt straks meerdere
    `SpecialistSummary`'s als input zodra er 2+ specialisten tegelijk
    actief zijn — een laag erboven, geen vervanging

**Up-to-date sweep, zoals gevraagd — bijgewerkt waar verouderd:**
- `docs/specialist-api.md` — Fase 4-sectie herschreven: het generieke
  "specialist levert samenvatting"-voorbeeld vervangen door een
  verwijzing naar het nu concrete CoachPolicy/SpecialistSummary-contract
- `docs/specialist-decision-engine.md` — "Contract met Fase 4"-sectie
  bijgewerkt: `SpecialistSummary` expliciet gekoppeld aan
  `specialist-coach-policy.md` als bron, niet meer een los begrip
- `README.md` — Specialist-sectie grondig geactualiseerd:
  - 7 ontwerpdocumenten i.p.v. 6
  - **Correctie:** "Specialist Memory (apart ontworpen, nog niet
    gebouwd)" was verouderd — Memory Engine staat inmiddels op 4/5
    sub-stappen, nu correct weergegeven
  - Nieuwe Coach Policy-status toegevoegd

## v2.4.77 — "Hoe werkt CoachOS": nieuwe sectie over Specialisten
**Gebruikersgerichte uitleg, geen technische documentatie — dat blijft
in `docs/specialist-*.md`. Nieuwe vaste afspraak: deze pagina wordt
voortaan bijgewerkt zodra er gebruikersgerichte functionaliteit
verandert (nieuwe features, gewijzigd gedrag) — niet bij interne
refactors of debug-toevoegingen die voor de gebruiker onzichtbaar zijn.**

- `src/app/settings/hoe-werkt-het/page.tsx` — nieuwe sectie
  **"Specialisten — verdieping per sport"**, geplaatst na de bestaande
  "Coach AI"-sectie (logisch vervolg)
  - In warme, toegankelijke taal — geen technische termen als "Learning
    Engine" of "confirmation_count", wel de onderliggende concepten in
    gewone woorden: hoe activeer je, wat zie je in de Hub, hoe "leert"
    de coach patronen (met de meermaals-bevestiging-drempel uitgelegd
    zonder het als getal te noemen), hoe vertrouwen kan wegzakken, wat
    er gebeurt als je een tijd niet sport
  - Zelfde stijl/structuur/toon als bestaande secties (intro + meerdere
    alinea's, uitklapbare kaart)

**Overwogen en bewust niet gedaan:** hernoemen naar "Handleiding" — de
inhoud (bestaand en nieuw) is overwegend conceptuele uitleg ("waarom
werkt het zo"), geen taakgerichte instructies ("hoe doe ik X"). Naam
blijft "Hoe werkt CoachOS", tenzij hier later op teruggekomen wordt.

## v2.4.76 — Memory Engine, sub-stap 4/5: Confidence Engine
**Volledig deterministisch. Confidence stijgt bij elke bevestiging
(+15, max 100), daalt geleidelijk zonder bevestiging (-3 per volle week),
en zet `active`-items onder de ondergrens (15) automatisch naar
`deprecated`. Decay wordt LAZY berekend — bij het lezen van Memory, geen
achtergrond-cronjob nodig.**

- **Nieuw:** `src/lib/specialists/confidence-engine.ts`
  - `berekenNieuweConfidenceBijBevestiging()` — +15 per bevestiging,
    begrensd op 100
  - `berekenGedecayedeConfidence()` — -3 per volle week zonder
    herbevestiging, begrensd op 0
  - `herwaardeerMemory()` — herberekent alle `active`-items van een
    specialist, schrijft alleen weg wat daadwerkelijk verandert, zet
    items onder de ondergrens naar `deprecated`
- `src/lib/specialists/learning-engine.ts`
  - `verwerkKandidaatInzicht()` verhoogt nu ook confidence bij elke
    bevestiging (naast de bestaande `confirmation_count`-logica)
  - `haalMemoryOp()` roept `herwaardeerMemory()` aan vóór het lezen —
    decay is dus altijd actueel op het moment dat iets de Memory
    daadwerkelijk raadpleegt (bijv. straks de Coach Layer, sub-stap 5)

**Test-kanttekening:** de confidence-**stijging** is vandaag al
testbaar (via de bestaande sub-stap 2-testknop, herhaald indienen). De
confidence-**daling** vergt per ontwerp minimaal een week zonder
bevestiging om zichtbaar te worden — niet vandaag al te forceren zonder
de `last_confirmed_at`-waarde handmatig in het verleden te zetten.

**Volgende sub-stap (5/5, laatste):** terugkoppeling naar de Coach
Layer — bij het genereren van een nieuw advies leest de AI voortaan ook
`active`-Memory-items met hoge confidence, als extra context.

## v2.4.75 — Memory Engine, sub-stap 3/5: Coach Layer voorstelt kandidaat-inzichten
**De AI mag voortaan zelf kandidaat-inzichten voorstellen — schrijft
NOOIT rechtstreeks naar het geheugen. Elke kandidaat gaat verplicht door
de Learning Engine (sub-stap 2), die deterministisch beslist over
bevestiging/promotie. Exact zoals vastgelegd in
`specialist-memory.md`.**

- `src/app/api/specialists/cycling/coach/route.ts`
  - Prompt uitgebreid: AI mag max. 2 kandidaat-inzichten per keer
    voorstellen, alleen bij een **duurzaam patroon** (niet een eenmalige
    observatie), verplicht binnen één van drie vaste categorieën
    (`training_response`/`preference`/`risk_pattern`) — expliciet
    benadrukt in de prompt dat dit een *voorstel* is, geen vastgestelde
    waarheid
    - Lege array is de normale, verwachte situatie bij weinig data —
      geen druk om altijd iets te vinden
  - `kandidaat_inzichten` wordt **verwijderd** vóór opslag in
    `specialist_analyses.analysis` — dat blijft exact `CyclingCoachAdvies`,
    ongewijzigd. Kandidaten gaan uitsluitend naar de Learning Engine
  - Elke kandidaat: `knowledge_type` altijd `'soft'` (AI-voorgestelde
    inzichten zijn per definitie nooit hard knowledge — dat komt uit
    directe meting, niet AI-interpretatie, zie `specialist-memory.md`)
  - Ongeldige/lege kandidaten worden genegeerd, niet de hele call laten
    falen — AI-output is nooit 100% gegarandeerd correct gevormd
  - `leer_resultaten` toegevoegd aan de API-response (niet aan het
    opgeslagen record) — puur voor testbaarheid van deze stap

**⚠️ Test-kanttekening:** de bestaande 24-uur-cache (v2.4.67) betekent
dat een herhaalde test binnen 24 uur de **oude, gecachte** analyse
teruggeeft, zonder nieuwe AI-call en dus zonder nieuwe
`leer_resultaten`. Voor een schone test: wacht tot de cache verloopt, of
wijzig tijdelijk de cache-drempel voor testdoeleinden.

**Volgende sub-stap (4/5):** Confidence Engine — herweegt confidence over
tijd, zet `active`-items onder een ondergrens automatisch naar
`deprecated`.

## v2.4.74 — Memory Engine, sub-stap 2/5: Learning Engine
**Volledig deterministisch, geen AI. Bepaalt of een kandidaat-inzicht een
bevestiging is van een bestaand item, en promoveert `candidate` naar
`active` bij het bereiken van de drempel (3 bevestigingen).**

- **Nieuw:** `src/lib/specialists/learning-engine.ts`
  - `verwerkKandidaatInzicht()` — matcht op `user_id + specialist_type +
    category` (niet op de inzicht-tekst zelf, dat zou niet-
    deterministisch worden). Bestaand item → `confirmation_count` +1,
    meest recente formulering overschrijft de oudere, promotie naar
    `active` bij drempel. Geen bestaand item → nieuw `candidate`-item
    (of direct `active` bij `knowledge_type: 'hard'`, zoals vastgelegd
    in `specialist-memory.md`: één geldige observatie volstaat voor
    objectief bewezen feiten)
  - **Eerlijk gevlagde beperking:** category-based matching behandelt
    twee écht verschillende inzichten binnen dezelfde category als
    hetzelfde (nieuwste overschrijft oudste). Redelijk startpunt voor nu
    (categorieën zijn bewust grof), maar geen perfecte oplossing
  - `haalMemoryOp()` — leeshelper, gebruikt door de nieuwe route en later
    door sub-stap 5 (terugkoppeling naar Coach Layer)
- **Nieuw:** `src/app/api/specialists/cycling/memory/route.ts`
  - `GET` — huidige Memory-staat
  - `POST` — **tijdelijk**, handmatig een kandidaat-inzicht indienen,
    totdat sub-stap 3 de Coach Layer koppelt zodat de AI dit automatisch
    doet
- `src/app/debug/page.tsx` — testsectie: kandidaat indienen (met vaste
  velden, 3x hetzelfde `category` indienen laat de promotie zien) +
  Memory ophalen

**Volgende sub-stap (3/5):** Cycling Coach Layer uitbreiden zodat de AI
zelf kandidaat-inzichten voorstelt, apart van het gewone advies.

## v2.4.73 — Memory Engine, sub-stap 1/5: SQL specialist_memory
**Eerste stap van de Memory Engine, zoals vastgelegd in
`specialist-memory.md`. Alleen de opslagstructuur — nog geen Learning-
of Confidence-logica (sub-stappen 2 en 4), nog geen AI-integratie
(sub-stap 3), nog geen terugkoppeling naar de Coach Layer (sub-stap 5).**

- **Nieuw:** `supabase/specialist_memory.sql`
  - Exact het veldontwerp uit `specialist-memory.md`: `id`, `user_id`,
    `specialist_type`, `knowledge_type` (hard/soft, met check-constraint),
    `insight`, `category`, `confidence` (0-100), `status`
    (candidate/active/deprecated, met check-constraint),
    `confirmation_count`, `first_observed_at`, `last_confirmed_at`
  - Bewust **geen** wijziging aan `specialist_profiles` of
    `specialist_analyses` — derde, losstaande tabel, zoals onderbouwd
    in `specialist-database-design.md` §4.5 / `specialist-memory.md`
  - `updated_at`-trigger, indexen, RLS — zelfde patroon als
    `specialist_layer.sql` (v2.4.59)

**Volgende sub-stap (2/5):** Learning Engine — deterministische logica
die bepaalt of een kandidaat-inzicht gepromoveerd wordt van `candidate`
naar `active`.

## v2.4.72 — specialist-api.md: vijf inhoudelijke aanscherpingen na review
**Reactie op een externe review van de v2.4.71-reconstructie. Eerst
geverifieerd (niet aangenomen) dat alle versieclaims kloppen — alle zes
`specialist-*.md`-documenten + kerncode gaven HTTP 200 op GitHub, plus
bevestigd door live tests eerder in de sessie. Daarna vijf inhoudelijke
verbeteringen doorgevoerd:**

1. **"AI berekent nooit" genuanceerd** — te absoluut voor de praktijk.
   Nieuwe formulering: *"Alle bedrijfskritische berekeningen, trends,
   scores en beslislogica worden deterministisch uitgevoerd. AI mag
   deze niet vervangen."* AI mag nog steeds geen bron van waarheid
   worden voor een cijfer — kleine interpretatieve stappen in lopende
   tekst blijven toegestaan.
2. **Generieke rekenbibliotheek benoemd** — trendberekening, moving
   average, rolling windows horen niet per sport opnieuw geschreven te
   worden. Cycling Analysis Engine (v2.4.66) heeft dit nog inline staan
   — bij een tweede specialist is dit het moment om te extraheren naar
   een gedeelde bibliotheek.
3. **Goal Engine: Global Goals vs. Specialist Goals** — niet elk doel is
   sportspecifiek (bijv. "minder stress", "beter slapen" horen bij de
   Master Coach, niet bij een specialist). Beide blijven in `user_goals`,
   onderscheid zit in wie de voortgang berekent/gebruikt.
4. **Hub-structuur herzien: capabilities i.p.v. vaste modulelijst** — een
   specialist publiceert zijn eigen capability-set (bijv. Cycling:
   Dashboard/Records/Grafieken/FTP/Wedstrijden, Nutrition: Maaltijden/
   Macro's/Recepten), geen gedeelde lijst waar elke specialist uit put.
   Capability Registry is hierin leidend.
5. **Decision Engine expliciet in de Fase 4-flow** — was eerder alleen
   een verwijzing ("zie ook"), nu een expliciete stap in het
   flow-diagram: `Specialist(en) → Decision Engine → Master Coach`.

**Alle vijf punten waren gerichte verbeteringen op een al goed
beoordeeld document (9,5/10 review) — geen fundamentele koerswijziging.**

## v2.4.71 — Herstel: docs/specialist-api.md gereconstrueerd
**`docs/specialist-api.md` bleek nooit gecommit (ontdekt in v2.4.70) —
gereconstrueerd vanuit de conversatiegeschiedenis. GOEDE-TROUW-
RECONSTRUCTIE, geen byte-perfecte kopie van het origineel — controleer
bij twijfel of de inhoud overeenkomt met wat destijds is goedgekeurd.**

- **Hersteld:** `docs/specialist-api.md` — Fase 1-4, Goal Engine,
  Hub-structuur (modules), Event Engine (toekomstig), endpoints-
  overzicht, relatie tot overige documenten
- **Bijgewerkt t.o.v. het origineel:** elke Fase-sectie geeft nu ook de
  daadwerkelijke gebouwd-status aan (✅ v2.4.60-67 voor Fase 1-3, ⏳ voor
  Fase 4/Goal Engine) — het origineel was een zuiver ontwerpdocument
  zonder deze latere realisatiestatus
- **Alle zes documenten nu daadwerkelijk in de repo:**
  `specialist-coaches.md`, `specialist-database-design.md`,
  `specialist-api.md` (hersteld), `specialist-memory.md` (hersteld,
  v2.4.70), `specialist-decision-engine.md`,
  `specialist-engine-architecture.md`

**Aanbeveling:** commit dit, en doe een korte controle-leesbeurt van
beide herstelde documenten (`specialist-api.md`,
`specialist-memory.md`) om te bevestigen dat de reconstructie voldoet.

## v2.4.70 — Specialist Lifecycle Engine + herstel ontbrekende documenten
**⚠️ Belangrijke bevinding tijdens deze stap: `docs/specialist-api.md` en
`docs/specialist-memory.md` bleken nooit daadwerkelijk gecommit, ondanks
eerdere levering als zip. `specialist-memory.md` is hersteld (volledige
tekst was nog beschikbaar). `specialist-api.md` volgt apart, moet
zorgvuldiger gereconstrueerd worden.**

- **Nieuw:** `src/lib/specialists/lifecycle-engine.ts` — volledig
  deterministisch, **geen opgeslagen status-veld**. Berekent de
  levenscyclus-toestand (`DISCOVERABLE`/`SUGGESTED`/`ACTIVE`/`DORMANT`/
  `RETURNING`) elke keer opnieuw uit `specialist_profiles.active` +
  `activity_sessions` — businesslogica, geen data, dus geen SQL-migratie
  nodig.
  - `SUGGESTED`: ≥3 activiteiten in 30 dagen, nog niet actief
  - `DORMANT`: actief, maar ≥60 dagen geen activiteit
  - `RETURNING`: actief, hervat binnen 14 dagen na een gap van ≥60 dagen
    — inclusief `vorige_actieve_periode` (start/eind) voor persoonlijkere
    context in het Coach Layer-advies
- `src/app/api/specialists/route.ts` — `GET` uitgebreid met
  `lifecycle`-veld per specialist (alleen berekend voor cycling, de
  enige specialist met een werkende data-fetcher)
- `src/app/chat/page.tsx` — twee nieuwe banners, **beide met expliciete
  gebruikerskeuze, nooit automatische activatie**:
  - `SUGGESTED` → "Je fietst regelmatig. Wil je de Cycling Coach
    activeren?" met Activeren/Niet nu
  - `RETURNING` → "Welkom terug!" met vorige-periode-context indien
    bekend
- `src/app/coach/cycling/page.tsx` — `DORMANT`-melding toegevoegd; Hub
  blijft **volledig zichtbaar** (kennis/geschiedenis gaat nooit
  verloren, alleen een informatieve melding erbij)
- **Hersteld:** `docs/specialist-memory.md` (v3) — volledige v1/v2-inhoud
  teruggezet, plus nieuwe sectie **Maturity Engine** (toekomstig
  concept, bewust NIET nu gebouwd — vereist eerst een operationele
  Memory + Confidence Engine, anders wordt het een schijnwaarde)

**Vier gescheiden engines nu expliciet onderscheiden:** Lifecycle
("wat doet de gebruiker") ✅ gebouwd, Memory ("wat is geleerd") ⏳,
Confidence ("hoe zeker") ⏳, Maturity ("hoe volwassen is de begeleiding")
toekomstig, in die volgorde.

**Test-instructies:** zie bericht bij levering.

## v2.4.69 — Navigatie-integratie: "Mijn Coaches" in de Coach-tab
**Kleine, gerichte toevoeging aan de bestaande, productie-actieve
`/chat`-pagina (de Coach-tab). Maakt `/coach/cycling` (v2.4.68)
bereikbaar zonder handmatige URL — de laagdrempelige helft van
navigatie-integratie. Raakt NIET `api/coach/route.ts` zelf (Fase 4
Master Coach-integratie) — dat blijft een aparte, expliciet af te
stemmen stap.**

- `src/app/chat/page.tsx` — nieuwe **"Mijn Coaches"-rij** direct onder de
  header, vóór de chat-berichten. Toont alleen specialisten die de
  gebruiker daadwerkelijk heeft geactiveerd (`GET /api/specialists`,
  gefilterd op `actief: true`) — **geen lege sectie** als er niets actief
  is, geen overclaiming van functionaliteit die er niet is.
- Elke chip navigeert naar `/coach/${specialist_type}` — voor Cycling dus
  naar de in v2.4.68 gebouwde Hub.
- Ophalen van specialisten faalt bewust **stil** (geen foutmelding aan de
  gebruiker) — dit is een secundaire, niet-kritieke functie, mag de
  hoofdfunctionaliteit van de Coach-chat nooit verstoren.
- Bewust géén wijziging aan de bestaande chat-logica, berichten-opslag,
  of `/api/chat`-aanroep — puur een toevoeging, geen refactor.

**Resultaat:** vanaf nu, zodra Cycling Coach actief staat, is de Hub
rechtstreeks vanuit de normale Coach-tab bereikbaar.

**Nog steeds bewust niet gedaan (ongewijzigd t.o.v. v2.4.68):** Fase 4 —
Master Coach Orchestrator-integratie in `api/coach/route.ts` zelf. Dat
raakt bestaande, actieve productiecode (het dagelijkse coach-advies) en
vereist expliciete, aparte afstemming voordat daaraan begonnen wordt.

## v2.4.68 — Capability Registry + Cycling Hub-UI (Cycling-referentie, stap 5/5 — LAATSTE STAP)
**De vijfde en laatste stap van de Cycling-referentie-implementatie.
Eerste echte, gebruikersgerichte UI in de specialistlaag — geen
debug-testknop meer, maar een daadwerkelijk bruikbaar scherm.**

- **Nieuw:** `src/lib/specialists/capability-registry.ts`
  - Centrale registratie van wat elke specialist daadwerkelijk
    ondersteunt — voorkomt if-specialist-constructies in de UI
  - **Bewust eerlijk:** Cycling heeft `hasDataLayer`/`hasAnalysisEngine`/
    `hasCoachLayer` op `true` (stappen 1-4, daadwerkelijk gebouwd), maar
    `supportsPeriodization`/`supportsEvents`/`supportsPredictions`/
    `supportsBenchmarks` staan op `false` — niet omdat ze onmogelijk
    zijn, maar omdat ze nog niet bestaan. Geen overclaiming.
- **Nieuw:** `src/app/coach/cycling/page.tsx` — de Cycling Hub zelf
  - Aparte route (`/coach/cycling`), zoals vastgelegd in
    `specialist-coaches.md` §6
  - Toont het Coach Layer-advies (Fase 3) leesbaar geformatteerd —
    samenvatting, sterke punten, aandachtspunten, advies — in plaats
    van ruwe JSON
  - Toont de onderliggende Analysis Engine-cijfers (Fase 2b) als
    overzichtelijke statistiek-kaarten (frequentie met trend-icoon,
    vermogen, afstand, trainingsbelasting)
  - "Ververs analyse"-knop, respecteert de bestaande 24-uur-cache
  - **Geen grijze/uitgeschakelde placeholders** voor niet-bestaande
    modules (Periodisering, Wedstrijden, etc.) — die worden simpelweg
    niet getoond, in lijn met "geen overclaiming"

**Bewust nog niet meegenomen, buiten scope van de 5-stappen-referentie:**
- Integratie in de hoofdnavigatie (een link vanuit de Coach-tab/"Mijn
  Coaches"-sectie, zoals `specialist-coaches.md` §6 beschrijft) —
  `/coach/cycling` is nu alleen bereikbaar via directe URL
- Fase 4 (Master Coach Orchestrator-integratie in `api/coach/route.ts`)
- Decision Engine (pas relevant zodra een 2e specialist actief kan zijn)
- Goal Engine, Specialist Memory — apart ontworpen, nog niet gebouwd

**Test-instructies:** zie bericht bij levering.

---

## 🎉 Cycling-referentie-implementatie compleet — alle 5 stappen

1. ✅ Identity Layer/Registry (v2.4.60)
2. ✅ Data Layer (v2.4.61)
3. ✅ Cycling Analysis Engine (v2.4.66)
4. ✅ Coach Layer/AI (v2.4.67)
5. ✅ Capability Registry + Hub-UI (v2.4.68)

**Zoals vastgelegd in de ontwerpfase:** Running, Rowing en Strength zijn
nu grotendeels een invuloefening binnen dezelfde architectuur — Data
Layer en Analysis Engine zijn per sport uniek werk, maar Identity Layer,
Learning/Confidence/Decision Engine-patronen en de Hub-structuur zijn al
generiek herbruikbaar (zie `specialist-engine-architecture.md`,
Herbruikbaarheid-sectie).

## v2.4.67 — Fase 3: Cycling Coach Layer — eerste AI-call (Cycling-referentie, stap 4/5)
**Eerste daadwerkelijke AI-aanroep in de specialistlaag. Personality
volledig hergebruikt uit de bestaande `coach-personality.ts` — geen
nieuwe stem, dezelfde coach met extra vakkennis.**

- **Nieuw:** `src/app/api/specialists/cycling/coach/route.ts`
  - `GET` — meest recente cycling-analyse ophalen (`specialist_analyses`)
  - `POST` — nieuwe analyse genereren: cache-check (max 1x/24u, zelfde
    patroon als `progress-analysis/route.ts`), roept intern Fase 2b aan
    (`analyseerCycling`), haalt lichte context op (`user_goals`,
    `specialist_profiles.preferences`), bouwt de prompt, roept Claude
    aan, valideert/parseert, slaat op in `specialist_analyses`
  - **Personality-hergebruik, expliciet:** `COACH_CORE_IDENTITY` +
    `CORE_SAFETY_RULE` + `getCoachTone(2)` — allemaal geïmporteerd uit de
    bestaande `@/core/prompts/coach-personality.ts`, niets nieuws
    geschreven. Niveau 2 gekozen (niet 3) — dit is periodiek advies
    genereren, geen reactie op een zojuist afgeronde evaluatie
  - **"AI rekent nooit"-principe, hard afgedwongen in de prompt:** de
    prompt bevat expliciet *"onderstaande cijfers zijn AL BEREKEND (...)
    jij rekent zelf NIETS opnieuw uit"* — de AI krijgt de Fase 2b-
    `resultaat` én `reden[]` kant-en-klaar aangeleverd, mag alleen
    interpreteren
  - Output vaste vorm: `samenvatting`/`sterke_punten`/`aandachtspunten`/
    `advies` — bewust een eigen vorm, niet gedeeld met de
    `ProgressAnalysis`-interface van `progress_analyses` (zie eerdere
    onderbouwing in `specialist-database-design.md` §4.5 waarom die twee
    gescheiden zijn)
  - **Fallback bij AI-storing:** nette Nederlandse standaardtekst, geen
    crash — zelfde patroon als andere AI-routes in dit project
- `src/app/debug/page.tsx` — testsectie uitgebreid met de Coach Layer-test

**Bewust nog niet meegenomen:** Goal Engine-berekening (voortgang t.o.v.
doel) — doelen worden nu alleen als ruwe context meegegeven, geen
deterministische "ligt op schema"-berekening. Specialist Memory — nog
niet gebouwd (apart ontwerp, `specialist-memory.md`, geen
geïmplementeerde tabel). Master Coach-context — Fase 4 Orchestrator-
integratie is een aparte, latere stap.

**Test-instructies:** zie bericht bij levering.

**Volgende stap (5/5, laatste):** Capability Registry-entry voor Cycling
+ eerste Hub-UI-element.

## v2.4.66 — Fase 2b: Cycling Analysis Engine (Cycling-referentie, stap 3/5)
**Volledig deterministisch, geen AI — precies zoals vastgelegd in
`docs/specialist-engine-architecture.md`. Berekent frequentie, vermogen-
trend, afstand, trainingsbelasting uit de Data Layer-output (v2.4.61).**

- **Nieuw:** `src/lib/specialists/cycling-data.ts` — Data Layer-logica
  geëxtraheerd uit `[type]/data/route.ts` naar een herbruikbare functie
  (`haalCyclingData`), zodat de Analysis Engine dit intern kan aanroepen
  zonder aparte HTTP-roundtrip (zoals vastgelegd in `specialist-api.md`
  Fase 3). `[type]/data/route.ts` is nu een dunne wrapper hieromheen,
  gedrag ongewijzigd.
- **Nieuw:** `src/lib/specialists/cycling-analysis.ts` — de eigenlijke
  Engine. Berekent:
  - **Trainingsfrequentie:** huidige vs. vorige periode (evenlang),
    trend bij ≥15% verschil
  - **Vermogen:** gemiddeld/max watt, trend t.o.v. vorige periode.
    **Eerlijk gevlagd:** `max_watts` is tot nu toe alleen bevestigd
    aanwezig bij Garmin-imports, niet bij Strava — expliciete null-checks
    overal, geen aanname dat het veld altijd bestaat
  - **Afstand:** totaal + gemiddeld per activiteit
  - **Trainingsbelasting:** duur-gebaseerd (bewust géén RPE-weging zoals
    de bestaande `trainingsCoachContext` in `api/coach/route.ts` doet —
    losse `activity_sessions` hebben doorgaans geen RPE, dus dat zou een
    onvolledig beeld geven; hier puur transparant duur-gebaseerd)
  - **Output-vorm:** volgt het `EngineResult`-patroon uit
    `specialist-engine-architecture.md` — `resultaat` + `reden[]`
    (Explainability-verplichting) + `databronnen[]` + `gegenereerd_op`,
    plus `engine_version`/`algorithm_version` (versionering,
    vastgelegd in hetzelfde document)
- **Nieuw:** `src/app/api/specialists/cycling/engine/route.ts` — GET-
  endpoint die de Engine blootgeeft, testbaar zoals de vorige stappen
- `src/app/debug/page.tsx` — testsectie uitgebreid met de Engine-test

**Bewust nog niet meegenomen, zoals vastgelegd in `specialist-api.md`:**
FTP/TSS/CTL — vereist een FTP-referentiewaarde die nergens bevestigd
aanwezig is. `herstel_indicatie` uit het architectuurdocument-voorbeeld
is bewust weggelaten — dat vermengt Recovery-domein (Master Coach) met
Cycling-domein, in strijd met de scheiding uit
`specialist-decision-engine.md`.

**Test-instructies:** zie bericht bij levering.

**Volgende stap (4/5):** Coach Layer (AI) — de eerste daadwerkelijke
AI-call in de specialistlaag, met `coach-personality.ts` hergebruikt.

## v2.4.65 — Specialistlaag-tests verplaatst naar bestaande /debug-pagina
**Gebruiker stelde terecht de vraag: kon dit niet in de app zelf? Ja —
en dat is een betere oplossing dan de losse `/debug/specialists`-pagina
die deze sessie twee losse problemen had (geen scroll, v2.4.36-patroon
gemist; en een nooit-volledig-verklaarde paginaherlaad tijdens
navigatie). De bestaande `/debug`-pagina gebruikt al `AppShell`
(werkende scroll) en wordt al bereikt via normale, al-ingelogde
app-navigatie — geen van beide problemen is daar van toepassing.**

- `src/app/debug/page.tsx` — nieuwe sectie **"Specialistlaag — Fase 1 +
  2a"** toegevoegd: dezelfde activeer/deactiveer-knoppen en Data
  Layer-test die op de losse pagina stonden, nu hier ingebed
- **Bijkomstige bug gevonden en gefixt:** `specialist_profiles` en
  `specialist_analyses` (SQL v2.4.59) ontbraken in `ALLE_TABELLEN` — de
  algemene diagnostiek testte deze twee nieuwe tabellen dus nooit mee.
  Toegevoegd.
- `/api/specialists` toegevoegd aan `KERN_ROUTES_GET` — wordt nu ook
  meegenomen in de "Start diagnostiek"-algehele-health-check
- **Verwijderd** (handmatig te verwijderen in Working Copy):
  `src/app/debug/specialists/page.tsx` — overbodig, en de bron van de
  twee problemen hierboven
- `next.config.js` — `skipWaiting` teruggezet naar `false` (van
  volledig `disable: true` in v2.4.63). Nu we terugvallen op een
  bestaande, al-werkende pagina zonder navigatie-gevoelige flow, is
  volledige uitschakeling waarschijnlijk niet meer nodig. **Als het
  reset-probleem hier ook optreedt, is dat een sterk signaal dat de
  service worker alsnog (mede)oorzaak was — meld dat direct.**

## v2.4.64 — Testpagina herbouwd: ingebouwd inlogformulier, geen navigatie
**Gebruiker meldde dat het reset-probleem óók optrad met de service
worker volledig uit (v2.4.63) — dus de service worker was waarschijnlijk
niet (de enige) oorzaak. Nieuwe hypothese: het probleem hangt samen met
de paginanavigatie zelf (van /login naar /debug/specialists), niet met
een achtergrondmechanisme. Test hiervoor gebouwd, geen definitieve
conclusie getrokken zonder bevestiging.**

- `src/app/debug/specialists/page.tsx` — volledig herbouwd met een
  **ingebouwd inlogformulier** (`browserClient.auth.signInWithPassword`)
  direct op dezelfde pagina. **Nooit meer `router.push('/login')`** — in-
  en uitloggen en alle Fase 1/2a-tests gebeuren nu op exact één pagina,
  zonder enige client-side route-wissel.
- **Doel:** isoleren of het probleem specifiek aan navigatie gekoppeld
  is. Als dit stabiel blijft waar de oude versie (met navigatie naar
  /login) niet stabiel bleef, bevestigt dat de hypothese. Zo niet, dan
  ligt de oorzaak elders en moet verder gezocht worden.

## v2.4.63 — Service worker TIJDELIJK volledig uitgeschakeld
**v2.4.62 (`skipWaiting: false`) loste het probleem niet volledig op —
gebruiker meldde nog steeds "even blijft staan, dan springt terug",
resterende service-worker-interferentie. Ik kon de daadwerkelijk
gedraaide, live service worker niet inspecteren (geen tool-toegang tot
het Vercel-domein, alleen naar bijv. GitHub) — in plaats van verder te
gokken naar de exacte resterende oorzaak: de service worker staat nu
volledig uit.**

- `next.config.js` — `disable: true` toegevoegd aan de `next-pwa`-config
- **Gevolg:** geen enkele service-worker-registratie meer, dus ook geen
  enkele mogelijkheid tot een onverwachte automatische paginaherlaad
  vanuit dat mechanisme — dit zou het probleem definitief moeten
  wegnemen, ongeacht de exacte resterende oorzaak binnen de SW zelf
- **Bijwerking:** dit schakelt ook PWA-offline-functionaliteit uit
  (geen app-installatie-prompt, geen offline-toegang) — geaccepteerd
  compromis tijdens de specialistlaag-testfase, niet bedoeld als
  permanente staat
- **Volgende stap, expliciet vastgelegd:** zodra alle 5
  implementatiestappen van de Cycling-referentie-specialist getest en
  stabiel zijn, `disable: true` weer verwijderen/terugzetten naar
  `false` — PWA-functionaliteit is nodig voor productiegebruik

## v2.4.62 — Fix: pagina reset zichzelf willekeurig (service-worker-config)
**Gemeld tijdens het testen van de Fase 2a Data Layer (v2.4.61) —
`/debug/specialists` "sprong terug" naar een initiële laadstatus,
schijnbaar willekeurig. Root cause gevonden, niet aangenomen.**

- `next.config.js` — `skipWaiting: true` → `skipWaiting: false`
- **Root cause:** `skipWaiting: true` laat een nieuwe service-worker-
  versie **onmiddellijk** overnemen zodra hij beschikbaar is — ook
  midden in een actieve sessie, ook potentieel bij een gewone
  paginalading zonder dat er per se net een nieuwe deploy was. Dit
  triggert doorgaans een geforceerde paginaherlaad, wat zich voordeed
  als "de hele pagina reset zichzelf naar de initiële staat" —
  reproduceerbaar bevestigd via screenshots (Fase 1 én Fase 2a beide
  terug naar "Laden.../nog niets opgehaald" op hetzelfde tijdstip).
- **Fix:** `skipWaiting: false` laat een nieuwe service-worker-versie
  netjes wachten totdat alle open tabbladen/instanties van de oude
  versie gesloten zijn, vóórdat hij overneemt — geen onderbreking meer
  van een actieve sessie.
- **Reikwijdte:** dit is een bestaand configuratiebestand, niet iets
  wat vandaag is geïntroduceerd — de fix raakt de **hele app**, niet
  alleen de nieuwe specialist-testpagina's.

## v2.4.61 — Fase 2a: Data Layer (Cycling-referentie, stap 2/5)
**Puur verzamelen/filteren — geen berekening, geen AI, geen
interpretatie. De Cycling Analysis Engine (Fase 2b, volgende stap) rekent
met deze ruwe output.**

- **Nieuw:** `src/app/api/specialists/[type]/data/route.ts`
  - `GET /api/specialists/cycling/data?period_days=30` — combineert twee
    bestaande bronnen: `activity_sessions` (Strava/Garmin-ritten,
    gefilterd via gekoppelde `activities.name`) en `training_results`
    (AI-gecoachte cycling-trainingen, `training_type='cycling'`)
  - `period_days` optioneel via query-param, standaard 30
  - Andere `[type]`-waarden dan `cycling` geven bewust een `501 Not
    Implemented` — geen stille lege response die verwarring zou geven
  - **Eerlijk gevlagd:** de lijst cycling-gerelateerde activity-namen
    (`Fietsen`, `Fietsen (buiten)`, `Indoor Fietsen`) is gebaseerd op wat
    deze sessie is gezien, mogelijk niet uitputtend
- `src/app/debug/specialists/page.tsx` — testsectie toegevoegd voor deze
  route, naast de bestaande Fase 1-tests

**Test-instructies:** zie bericht bij levering.

**Volgende stap (3/5):** Cycling Analysis Engine (Fase 2b) — sport-
specifieke berekeningen op deze ruwe data (frequentie, vermogen-trend,
trainingsbelasting). FTP/TSS/CTL blijven uitgeschakeld totdat een
FTP-referentiewaarde-bron is bevestigd (zie `specialist-api.md`).

## v2.4.60 — Fase 1: Specialist Registry (Cycling-referentie-implementatie, stap 1/5)
**Eerste code na de ontwerpstop (6 architectuurdocumenten, zie
`docs/specialist-*.md`). Cycling gekozen als referentie-specialist.
Deze stap: alleen Fase 1 (Identity Layer/Registry) — geen AI, geen
berekeningen, puur activatie-beheer.**

- **Nieuw:** `src/app/api/specialists/route.ts`
  - `GET` — lijst specialisten voor de gebruiker (actief/beschikbaar/
    in-ontwikkeling), combineert vaste code-config met
    `specialist_profiles` (SQL v2.4.59)
  - `POST` — activeer/deactiveer, body `{ specialist_type, active }`,
    upsert naar `specialist_profiles`
  - **Vaste config:** alleen `cycling` heeft status `active` — overige
    specialisten (`running`, `rowing`, `strength`) staan op
    `development`, bewust niet activeerbaar totdat ze daadwerkelijk
    gebouwd zijn (geen overclaiming van functionaliteit die nog niet
    bestaat)
- **Nieuw, tijdelijk:** `src/app/debug/specialists/page.tsx` — testscherm
  om Fase 1 te kunnen testen zonder curl/Postman, direct op de telefoon.
  **Geen onderdeel van de uiteindelijke architectuur** — wordt vervangen
  zodra de echte Hub-UI gebouwd wordt (zie
  `specialist-engine-architecture.md`, Hub-modules-sectie).

**Test-instructies:** zie bericht bij levering.

**Volgende stap (2/5):** Data Layer (Fase 2a) —
`/api/specialists/cycling/data`, ruwe data verzamelen uit
`activity_sessions`/`training_results`, nog geen berekeningen.

## v2.4.59 — SQL: specialist_profiles + specialist_analyses
**Eerste daadwerkelijke code van het specialistlaag-traject — exact de
twee tabellen die in `docs/specialist-database-design.md` zijn besloten,
niets extra's. Nog geen API-routes, nog geen UI (volgende stappen).**

- **Nieuw:** `supabase/specialist_layer.sql`
  - `specialist_profiles` — identity/activatie-laag. `user_id`,
    `specialist_type`, `active`, `activated_at`, `preferences` (JSONB).
    **Geen `goals`-veld** — doelen leven in de bestaande `user_goals`,
    zoals besloten. Unieke constraint op `(user_id, specialist_type)` —
    voorkomt duplicaten bij dubbel activeren. `updated_at` automatisch
    bijgewerkt via trigger.
  - `specialist_analyses` — analyse-laag, bewust **losstaand** van
    `progress_analyses` (onderbouwing: zie changelog-entry
    "Specialist Coach Platform" hierboven, en §4.5 van
    `specialist-database-design.md`). `user_id`, `specialist_type`,
    `period_days`, `analysis` (JSONB, vrije vorm), `generated_at`.
  - RLS ingeschakeld op beide tabellen, standaard Supabase-patroon
    (`auth.uid() = user_id`). **Aanname, niet geverifieerd tegen
    bestaande RLS-policies elders in dit project** — routes gebruiken tot
    nu toe vrijwel overal `createAdminClient()` (service-role, omzeilt
    RLS toch al), dus dit is vooral een vangnet. Pas aan indien dit
    project een ander RLS-patroon hanteert.
  - **Geen wijzigingen aan bestaande tabellen** — `activity_sessions`,
    `training_results`, `exercise_records`, `coach_calls`,
    `progress_analyses`, `user_goals` blijven allemaal ongewijzigd,
    exact zoals in het goedgekeurde ontwerp vastgelegd.

**Volgende stap (nog niet gestart):** API-ontwerp (Orchestrator-route,
specialist-activatie-endpoint), daarna pas UI ("Mijn Coaches"-sectie).

## [docs] Specialist Coach Platform — architectuur + database-ontwerp
**Geen versie-ophoging — puur documentatie, geen code/SQL gewijzigd.**

- **Nieuw:** `docs/specialist-coaches.md` — architectuur voor een
  uitbreiding van CoachOS naar een platform met gespecialiseerde coaches
  (Cycling, Running, Rowing, Strength, ...) onder één Master Coach.
  Kernprincipe: specialisten adviseren, Master Coach beslist. Bevat
  rollen, data-driven activatiemodel (3-in-30-dagen-drempel + "opkomend
  patroon"-signaal, gebruiker beslist altijd zelf over activatie),
  Hub-structuur (geen nieuwe bottom-nav, aparte routes binnen Coach),
  kostenbewuste AI-routing (niet elke dagelijkse call raadpleegt alle
  actieve specialisten).
- **Nieuw:** `docs/specialist-database-design.md` — impactanalyse vóór
  enige SQL geschreven wordt. Conclusie: bestaand fundament
  (`activity_sessions`, `training_results`, `exercise_records`,
  `coach_calls`, `user_goals`) is grotendeels herbruikbaar. Slechts **2
  nieuwe tabellen** nodig (`specialist_profiles`, `specialist_analyses`),
  **0 wijzigingen** aan bestaande tabellen. Elke keuze onderbouwd met
  daadwerkelijk opgehaalde code (`api/progress-analysis/route.ts`,
  `api/goals/route.ts`) — niet op aanname, na een expliciete correctie
  onderweg toen een eerste "voeg een kolom toe aan progress_analyses"-
  aanname bij nader onderzoek risicovol bleek (vaste JSONB-vorm,
  ongefilterde cache-/ophaal-logica).
- `README.md` — nieuwe sectie "Specialist Coach Platform" toegevoegd,
  verwijst naar beide documenten en de huidige status.

**Volgende stap (nog niet gestart):** exacte SQL voor de twee nieuwe
tabellen, daarna API, dan pas UI.

## v2.4.58 — 6 nieuwe illustraties (#22-27) + alle 24 bestaande retroactief gecomprimeerd
**Ontdekking: de 100-300 KB-richtlijn uit de Illustratie Workflow-sectie is
nooit daadwerkelijk gehaald, ook niet bij eerdere illustraties — alle 24
al-gekoppelde bestanden (18 "PNG", 6 "WebP") bleken in werkelijkheid
allemaal ~0,8-1,3 MB, ongeacht bestandsextensie. Bevestigd door de
bestanden rechtstreeks van GitHub op te halen en te meten, niet aangenomen.**

**6 nieuwe illustraties gekoppeld:**
- Forward Lunge (#22), Walking Lunge (#23), Lateral Lunge (#24),
  Cossack Squat (#25), Thruster (#26), Push Press (#27)
- **Totaal nu 30/102 kettlebell-oefeningen met illustratie.**

**Alle 24 bestaande illustraties retroactief gecomprimeerd:**
- Opgehaald van GitHub (commit `0b8f5a9`), geconverteerd met PIL/Pillow
  (quality=85, method=6), teruggezet als `.webp`.
- **Totale reductie: 23,5 MB → 1,5 MB (94%)** voor de 24 bestaande, plus
  de 6 nieuwe (~450 KB samen) — **totaal pakket nu ~2,0 MB voor 30
  illustraties**, was ~29,5 MB.
- **18 bestanden die eerder `.png` waren, zijn nu `.webp`** —
  `kettlebell-exercises.ts` is bijgewerkt: alle `illustratie`-velden
  wijzen nu naar `.webp`, geen `.png`-referenties meer over.
- Visueel gecontroleerd (2 steekproeven, waaronder een voormalig PNG-
  bestand): geen zichtbaar kwaliteitsverlies bij quality=85.

**Belangrijke correctie op de eerdere v2.4.57-aanname:** bestandsgrootte
was **geen** technisch blokkerend probleem voor GitHub/Vercel (beide
kunnen dit probleemloos aan) — puur een laadtijd-optimalisatie voor
eindgebruikers op mobiel. De gebruiker had gelijk dat dit niet per se
nodig was om te "werken", maar koos ervoor het alsnog te doen zodra
bleek dat de bestaande richtlijn nooit werd gehaald.

**Bijwerking nodig in Working Copy:** de oude `.png`-bestanden
(kettlebell-deadlift.png, sumo-deadlift.png, etc.) blijven ongebruikt in
de repo staan — kunnen op een gewenst moment handmatig verwijderd worden,
niet urgent (geen functionele impact, alleen overbodige opslag).

## v2.4.57 — Gewicht nu ook live bijstelbaar tijdens de actieve set (Archief)
**Gemist bij v2.4.56: tempo werd toen wel live bijstelbaar gemaakt tijdens
de actieve set, gewicht bleef alleen statische tekst (`· 16kg`) — een
inconsistentie die de gebruiker meteen opmerkte.**

- `src/app/archief/oefening/[id]/page.tsx` — gewicht-keuzeknoppen
  (6, 14-32kg) toegevoegd aan de actieve set, direct boven de al
  bestaande tempo-knoppen. Zelfde patroon als in het instelscherm.
- Geen aanpassing aan de timer nodig bij een gewichtswijziging (in
  tegenstelling tot tempo, dat de resterende tijd herberekent) — gewicht
  heeft geen invloed op de duur van een set.

## v2.4.56 — Tempo-keuze (Slow/Normaal/Fast) nu ook in Archief
**Laatste stap van de gewicht/tempo-consistentie tussen Trainer AI/
Bibliotheek en Archief. Archief had al gewicht (v2.4.49), tempo ontbrak
nog volledig — vaste 3 sec/rep, niet instelbaar.**

- `src/app/archief/oefening/[id]/page.tsx` — nieuw tempo-systeem, zelfde
  concept als Trainer AI/Bibliotheek (`localStorage`-voorkeur per
  oefeningnaam, 4/3/2 sec-per-rep voor slow/normal/fast). **Geen
  advies-vergelijking** — Archief heeft geen coach-schema om van af te
  wijken, dus dat deel (v2.4.52/53) is hier niet van toepassing, puur een
  persoonlijke instelling.
- Tempo-knoppen op **twee plekken**, consistent met hoe gewicht/tempo in
  Trainer AI werken sinds v2.4.54:
  - **Instelscherm** (vóór starten): tempo instelbaar, naast de
    bestaande gewicht-knoppen — alleen zichtbaar bij rep-gebaseerde
    oefeningen.
  - **Actieve set**: tempo live bijstelbaar, past de resterende tijd
    direct aan (`phase_end_at` herberekend op basis van het nieuwe tempo).
- Bij opslaan wordt het gebruikte tempo meegestuurd (`segment.tempo`) —
  komt via de al bestaande `training/complete/route.ts`-logica (v2.4.53)
  terecht in `exercise_records.tempo`, zonder dat dat bestand aangepast
  hoefde te worden (de fallback las al `seg.tempo` als er geen
  `actual_tempo` aanwezig was).

**Resultaat: Trainer AI/Bibliotheek en Archief bieden nu identieke
gewicht- en tempo-functionaliteit**, met als enige verschil dat Trainer
AI een coach-advies als startpunt heeft (en de coach ziet afwijkingen),
terwijl Archief een pure, geheugen-gebaseerde persoonlijke voorkeur
gebruikt (geen advies om van af te wijken).

## v2.4.55 — NIEUW: "Ververs schema"-knop — doorbreekt dubbele cache
**Directe aanleiding: gebruiker zag geen gewicht/tempo-knoppen (v2.4.51/54)
bij een Kettlebell-schema dat die dag al eerder was geopend. Root cause:
twee losse caches, beide op datum, allebei ongevoelig voor nieuwe
code-deploys diezelfde dag.**

- **Server-side cache** (`coach_recommendations`-tabel, `training/today/
  route.ts`): gaf bij elke aanvraag dezelfde dag altijd de eerder
  gegenereerde versie terug, zelfs na een nieuwe deploy met nieuwe velden.
- **Client-side cache** (`localStorage`, `session/[module]/page.tsx`):
  checkte zelfs vóórdat de server ooit benaderd werd — dus zelfs een
  server-side fix zou nooit zichtbaar worden zonder deze ook te doorbreken.

**Fix:**
- `src/app/api/training/today/route.ts` — nieuwe `force: true`-optie in
  de POST-body omzeilt de server-side cache-check volledig.
- `src/app/training/session/[module]/page.tsx` — nieuwe **ververs-knop**
  (rond-pijltjes-icoon) naast de titel op het schema-overzichtsscherm.
  Wist bij een tik zowel de relevante `localStorage`-sleutels als de
  server-cache (via `force: true`), haalt een écht vers schema op, en
  herbouwt de sessie daarmee.
- Werkt voor zowel Trainingsbibliotheek-schema's (`training_lib_*`-sleutels)
  als het normale coach-gegenereerde dagschema (`training_instructie_data`).

**Nuttig, niet alleen voor dit specifieke geval:** dit soort dubbele
cache-problemen kan bij elke toekomstige schema-gerelateerde codewijziging
opnieuw optreden — de knop is een permanente uitweg, niet een eenmalige
patch.

## v2.4.54 — Gewicht + tempo nu ook instelbaar in het trainingsoverzicht
**Besluit (overleg): gewicht is een eenmalige, vooraf-te-bepalen keuze per
oefening (hoort in het overzicht) — tempo is bedoeld om ook TIJDENS het
sporten bij te stellen (blijft daarom op beide plekken: overzicht én
actieve set).**

- `src/app/training/session/[module]/page.tsx` (`SchemaLayer`, het scherm
  vóór "Training Starten") — elke kettlebell-oefening met coach-advies
  toont nu compacte gewicht- (6 knoppen, 14-32kg) en tempo-knoppen
  (Slow/Normaal/Fast), voorgeselecteerd op het advies, aanpasbaar vóór je
  start.
- Bij "Training Starten" worden deze keuzes vastgelegd in
  `session.gebruikt_gewicht`/`gebruikt_tempo` (per segment-index) — het
  originele advies in het schema zelf blijft ongewijzigd, nodig voor de
  advies-vs-gebruikt-vergelijking die de coach ziet (v2.4.52/53).
- De bestaande per-segment-initialisatie (v2.4.51) ziet deze waarden dan
  al ingevuld staan en overschrijft ze niet opnieuw met het kale advies —
  de overzicht-keuze blijft dus behouden tot in de actieve set.
- **Consistentie-bug gevonden en gefixt tijdens het bouwen:** de tempo-
  knop-highlight in de actieve set las nog steeds alleen het ruwe advies
  (`seg.target_tempo`), niet een eventuele overzicht-aanpassing — de
  highlight zou dus de verkeerde knop hebben getoond ondanks dat de
  juiste waarde intern al correct was vastgelegd. Nu leest de highlight
  eerst `session.gebruikt_tempo`, dan pas het advies.

## v2.4.53 — Tempo-afwijking nu ook zichtbaar voor de coach (naast gewicht)

**⚠️ VEREIST VÓÓR DEPLOY — nieuwe kolommen in Supabase SQL Editor:**
```sql
alter table exercise_records add column tempo text;
alter table exercise_records add column advised_tempo text;
```

**Bonus-fix, ontdekt tijdens het bouwen:** het generieke `tempo`-veld dat
v2.4.50 al meestuurde voor rep-gebaseerde niet-kettlebell-oefeningen
(bodyweight/strength) werd tot nu toe **nergens opgeslagen** —
`training/complete/route.ts` las dat veld nooit uit bij het samenstellen
van `exercise_records`. Sinds deze versie wordt het wél vastgelegd (in de
nieuwe `tempo`-kolom), voor alle rep-gebaseerde oefeningen, niet alleen
kettlebell.

**Wijzigingen, exact hetzelfde patroon als v2.4.52 (gewicht):**
- `src/app/api/training/complete/route.ts` — `exercise_records`-insert
  slaat nu ook `tempo` (gebruikt) en `advised_tempo` (coach-advies, alleen
  bij kettlebell) op.
- `src/app/api/coach/route.ts` — progressie-analyse uitgebreid: als het
  laatst geadviseerde tempo afwijkt van het laatst gebruikte, wordt dat
  vermeld: `[tempo-advies: normal, gebruiker deed: slow]`, met een eigen
  instructie aan de coach (niet elke afwijking is een probleem — een
  bewust langzamer tempo bij een explosieve oefening kan juist positief
  zijn; een sneller tempo bij een gecontroleerde oefening kan op haast/
  vermoeidheid wijzen).

**Resultaat:** de coach ziet nu zowel gewicht- als tempo-afwijkingen bij
kettlebell-training, en tempo-tracking voor alle rep-oefeningen in het
algemeen (niet eerder het geval, ook niet vóór v2.4.51).

## v2.4.52 — Fix: gewicht-advies-bug + coach geeft nu commentaar op afwijking

**⚠️ VEREIST VÓÓR DEPLOY — nieuwe kolom in Supabase SQL Editor:**
```sql
alter table exercise_records add column advised_weight_kg integer;
```
Zonder deze kolom faalt de `exercise_records`-insert bij elke kettlebell-
training (poging tot schrijven naar een niet-bestaande kolom).

**Gevonden bug (bij het bouwen van deze koppeling, vóór uitlevering):**
in v2.4.51 werd `actual_weight_kg` als NIEUW veld toegevoegd náást het
bestaande `weight_kg`-veld op een segment — maar `exercise_records` (de
tabel die de progressie-trends van de coach voedt) las nog steeds het
oorspronkelijke `weight_kg` (= altijd het coach-ADVIES), nooit het
daadwerkelijk gebruikte gewicht. Bij elke afwijking van het advies zou de
progressie-tracking dus het verkeerde getal hebben vastgelegd.

**Fixes en uitbreiding:**
- `src/app/api/training/complete/route.ts` — `exercise_records`-insert
  gebruikt nu `seg.actual_weight_kg` (met terugval op `seg.weight_kg` voor
  niet-kettlebell-segmenten, ongewijzigd gedrag daar). Nieuwe kolom
  `advised_weight_kg` wordt apart opgeslagen.
- `src/app/api/coach/route.ts` — de bestaande progressie-analyse
  (`exercise_records` → trend per oefening) leest nu ook
  `advised_weight_kg`. Als het laatst geadviseerde gewicht afwijkt van het
  laatst gebruikte, wordt dat expliciet in de prompt vermeld:
  `[Trainer AI adviseerde Xkg, gebruiker deed Ykg]`, met een instructie aan
  de coach om dit kort en niet-veroordelend te kunnen benoemen — alleen
  bij een daadwerkelijke afwijking, geen ruis bij een exacte match.
- Tempo wordt in deze stap **niet** meegenomen in de coach-vergelijking —
  `exercise_records` heeft geen tempo-kolom, en dat zou een aparte
  schema-uitbreiding vergen. Bewust uitgesteld; kan later alsnog als
  gewenst.

## v2.4.51 — NIEUW: Coach adviseert kettlebell-gewicht + tempo, gebruiker kan afwijken
**Bevestigd via `training/today/route.ts`: kettlebell-segmenten bevatten
géén gewicht- of tempo-informatie, niet in de AI-prompt-instructie, niet
in de fallback-data. Volledig gat, geen aanname.**

**Besluit (overleg met gebruiker):** de coach geeft een advies (gewicht +
tempo), de gebruiker kan er tijdens de training van afwijken via
dezelfde soort keuzeknoppen, en bij opslaan gaat zowel het advies als de
daadwerkelijk gebruikte waarde naar de coach — zodat die bij een
volgende sessie kan reageren op eventuele afwijking. **Alleen van
toepassing op kettlebell** (rowing/running/cycling hebben al eigen
doelwaarden zoals `target_pace`/`target_power_w`).

**`src/app/api/training/today/route.ts`:**
- Prompt-instructie voor KETTLEBELL uitgebreid: elk segment krijgt nu ook
  `weight_kg` (advies, uit 14/16/20/24/28/32) en `target_tempo`
  (advies: `slow`/`normal`/`fast`, gebaseerd op het type beweging —
  explosief zoals swings = fast, gecontroleerd zoals squats = normal/slow).
- `kettlebellFallback`-segmenten kregen dezelfde velden, zodat een
  mislukte AI-call ook advies bevat.

**`src/app/training/session/[module]/page.tsx`:**
- `DisplaySegment` uitgebreid met `weight_kg`/`target_tempo` (advies,
  uitgelezen in `asDisplay()`).
- `ExtendedSessionState` uitgebreid met `gebruikt_gewicht`/`gebruikt_tempo`
  (`Record<number, ...>`, per segment-index) — legt de daadwerkelijk
  gebruikte waarde vast, apart van het advies.
- Nieuw `useEffect`: initialiseert deze op het coach-advies zodra een
  kettlebell-segment voor het eerst actief wordt (dus ook als de
  gebruiker nooit een knop aanraakt, staat het advies alsnog als
  "gebruikte waarde" vast — correct, want dan volgde hij het advies).
- Nieuwe gewicht-keuzeknoppen (6, 14-32kg) in `WorkoutEngine`'s actief-
  scherm, alleen zichtbaar bij kettlebell mét advies. Bestaande tempo-
  knoppen hergebruikt, nu ook gekoppeld aan `gebruikt_tempo` voor
  kettlebell (naast de bestaande localStorage-koppeling die voor alle
  rep-oefeningen blijft werken).
- `handleSave`: voor kettlebell-segmenten worden nu **vier** velden
  meegestuurd — `advised_weight_kg`, `advised_tempo`, `actual_weight_kg`,
  `actual_tempo` — in plaats van alleen het generieke `tempo`-veld dat
  v2.4.50 voor andere rep-oefeningen toevoegde.

**Geen wijziging in Archief** — die heeft geen coach-gegenereerd advies
om van af te wijken (gebruiker kiest daar zelf, buiten de coach om), dus
het "advies vs. afwijking"-concept is daar niet van toepassing.

## v2.4.50 — Tempo (Slow/Normaal/Fast) nu zichtbaar voor de coach
**Correctie op eerste poging: ik nam eerst ten onrechte aan dat Archief
ook een tempo-concept had (met een `getTempo()`-aanroep die daar niet
bestaat) — teruggedraaid vóór uitlevering. Tempo bestaat uitsluitend bij
Trainer AI/Bibliotheek.**

- `src/app/training/session/[module]/page.tsx` (`handleSave`) — elk
  rep-gebaseerd segment (reps gezet, geen vaste `duration_sec`) krijgt nu
  een `tempo`-veld (`slow`/`normal`/`fast`) toegevoegd vóór het opslaan
  naar `/api/training/complete`.
- **Root cause van het gemis:** het tempo werd al sinds de invoering van
  de Slow/Normaal/Fast-knoppen alleen lokaal opgeslagen (`localStorage`,
  puur voor timer-kalibratie) — nooit meegestuurd in de opslag-payload,
  dus nooit zichtbaar voor Coach AI bij de evaluatie.
- Segmenten zonder reps (tijd-gebaseerd) of zonder herkenbare
  oefeningnaam blijven ongewijzigd — tempo is daar begripsmatig niet van
  toepassing.
- **Geen wijziging in Archief** — die heeft geen tempo-concept.

## v2.4.49 — Kettlebell-gewichten uitgebreid: 14-16-20 → 14-16-20-24-28-32
- `src/app/archief/oefening/[id]/page.tsx` — `KETTLEBELL_GEWICHTEN`
  uitgebreid van `[14, 16, 20]` naar `[14, 16, 20, 24, 28, 32]`. Deze
  uitbreiding stond al voorbereid als uitgecommentarieerde regel sinds
  het begin van de sessie — nu geactiveerd.
- Weergave omgezet van een enkele flex-rij naar een **3-koloms grid**
  (2 rijen van 3 knoppen) — met 6 gewichten zou een enkele rij te smalle
  knoppen hebben gegeven op een telefoonscherm.
- Alleen Archief heeft een gewichtselectie — Trainer AI/Bibliotheek
  (`training/session/[module]/page.tsx`) heeft geen vergelijkbare UI,
  daar hoefde dus niets aangepast te worden.

## v2.4.48 — Fix: Slow/Normaal/Fast-tempoknoppen leken niet te reageren
- `src/app/training/session/[module]/page.tsx` (`WorkoutEngine`) —
  tempo-knop-`onClick` werkt lokale `currentTempo`-state nu direct bij,
  naast de bestaande `onTempoChange()`-aanroep naar de ouder.
- **Root cause:** de gekozen tempo werd wél correct opgeslagen
  (`localStorage` via `setTempo()`) en de timer werd wél correct
  aangepast (`phase_end_at` in de ouder-component) — maar de visuele
  highlight van welke knop actief is (`currentTempo`) ververste alleen via
  een `useEffect` die op `seg.exercise` reageert. Omdat het tikken op een
  andere tempo-knop de oefening zelf niet verandert, vuurde die `useEffect`
  niet af, en bleef de knop-highlight op de oude waarde staan — het leek
  daardoor alsof de knoppen niet reageerden, terwijl de onderliggende
  functionaliteit wél werkte.
- Gemeld door gebruiker: "Ik kan ze niet veranderen" — bevestigt het
  visuele, niet-functionele karakter van dit probleem.

## v2.4.47 — Build-fix: SessionStatus-type-fout in Finish Tone-effect
- `src/app/training/session/[module]/page.tsx` — build-fout: *"This
  comparison appears to be unintentional because the types 'SessionStatus'
  and '\"voltooid\"' have no overlap"*.
- **Root cause:** `'voltooid'` zit niet in de officiële `SessionStatus`-
  type-definitie (`@/types/training-engine`) — de rest van het bestand
  gebruikt hiervoor consequent een expliciete cast
  (`(session.status as string) === 'voltooid'`, zie bestaande code rond
  regel 1303), maar dat patroon was niet toegepast in het nieuwe
  Finish Tone-effect (v2.4.46).
- Fix: `vorigeStatusRef` getypeerd als `string | null` in plaats van
  `SessionStatus | null`, en `session.status` gecast naar `string` vóór
  vergelijking — consistent met de bestaande stijl in dit bestand.
  Functioneel geen wijziging.

## v2.4.46 — Professionele soundset (Polar/Garmin/Concept2-stijl) + nieuwe Finish Tone
**Herontwerp op basis van gedetailleerde gebruikersspecificatie — geen
schelle piepjes (irritant bij 30-60 min training), maar korte, relatief
hoge tonen (~1-2 kHz) die door achtergrondmuziek heen blijven snijden.**

**Belangrijke, niet-technisch-oplosbare kanttekening:** een website/PWA
heeft geen toegang tot het systeem-audiokanaal van iOS en kan dus het
volume van andere apps (Spotify, Apple Music) niet dempen ("ducking") —
een bewuste iOS-beperking, niet iets wat met code te omzeilen is. De
enige hefboom is dat onze eigen tonen duidelijk genoeg zijn.

- `src/lib/workout-sound.ts` — volledig herontworpen:
  - **Start Tone:** was één toon, nu een dubbele oplopende toon ("DI-DIT",
    ±180ms) — energiek zonder agressief.
  - **Tick:** frequentie verhoogd (880Hz → 1568Hz) voor beter doorsnijden
    door muziek, blijft kort/droog, geen oplopend volume over de 3 tikken.
  - **Rest Tone** (hernoemd vanuit "Eindsignaal", zelfde functienaam
    `speelEindsignaal` behouden voor compatibiliteit): één zachte
    bevestigingstoon i.p.v. een simpele lage toon.
  - **Finish Tone (NIEUW):** `speelFinishToon()` — twee rustige oplopende
    tonen ("DI—DING"), specifiek voor het einde van de VOLLEDIGE training,
    niet per set/oefening. Bestond nog niet — er was voorheen geen enkel
    geluid bij volledige trainingsafronding.
  - Basisvolume verhoogd (0.15 → 0.28) voor betere hoorbaarheid naast
    zachte achtergrondmuziek, met behoud van de zachte in/uit-fade
    (voorkomt een schel/hard karakter).
- `src/app/training/session/[module]/page.tsx` — nieuw `useEffect` dat
  `session.status` volgt en `speelFinishToon()` afspeelt bij de overgang
  naar `'voltooid'`. Apart van het bestaande fase-luister-effect (v2.4.45),
  omdat `workout_phase` zelf niet verandert op het moment dat de volledige
  training als voltooid wordt gemarkeerd — alleen `status` doet dat.
- `src/app/archief/oefening/[id]/page.tsx` — volledige geluidskoppeling
  toegevoegd (was nog nooit definitief uitgeleverd voor dit bestand — een
  eerdere poging werd halverwege gestopt op verzoek). Inclusief tick-
  effect voor de laatste 3 sec van countdown/rust, en `speelFinishToon()`
  bij de laatste set in plaats van de gewone Rest Tone.

## v2.4.45 — Fix: eindsignaal ontbrak bij Trainer AI/Bibliotheek (actief → rust)
**Gemeld: bij Archief werkte het eindsignaal (lage toon bij einde set)
correct, bij Trainer AI/Bibliotheek niet — starttoon en tick werkten daar
wel.**

- `src/app/training/session/[module]/page.tsx` — `speelStarttoon()`/
  `speelEindsignaal()` stonden als directe aanroepen **binnen** de
  `setSession()`-functionele-updater (`advancePhase()`). Dat is geen
  zuivere state-berekening — React state-updaters horen vrij te zijn van
  side effects zoals geluid afspelen, en zo'n aanroep kan in bepaalde
  situaties onbetrouwbaar worden uitgevoerd (bijv. als React de updater
  aanroept voor een berekening die uiteindelijk niet gecommit wordt).
- **Fix:** geluidsaanroepen volledig verwijderd uit `advancePhase()`. In
  plaats daarvan een nieuwe, losse `useEffect` die reageert op de
  daadwerkelijk gecommitte `session.workout_phase`-verandering (bewaart de
  vorige fase in een ref, vergelijkt bij elke wijziging) — exact hetzelfde
  betrouwbare patroon dat het tick-geluid al gebruikte sinds v2.4.34.
- **Bijkomend voordeel:** dit is preciezer in lijn met de architectuurregel
  "geluid luistert alleen naar de timer, bestuurt nooit de workout" — de
  geluidslogica zat voorheen inhoudelijk verweven in de state-berekening
  zelf, nu is het een pure, losstaande "luisteraar".
- Archief (`archief/oefening/[id]/page.tsx`) had dit probleem niet — daar
  stonden de geluidsaanroepen al buiten de `setFase`-aanroepen, in gewone
  functie-body's, niet in een React state-updater.

## v2.4.44 — TCX-bestand nu links en standaard geselecteerd (was Screenshot)
- `src/app/settings/garmin-activity-import/page.tsx` — tabblad-volgorde
  omgedraaid (TCX-bestand links, Screenshot rechts) en de standaard
  geselecteerde methode gewijzigd van `'screenshot'` naar `'tcx'`.
- Reden: gebruiker geeft aan Garmin/TCX vaker te gebruiken dan de
  screenshot-methode — dit bespaart een extra tik bij elke import.

## v2.4.43 — Activiteiten in bottom-nav + Strava-consolidatie (zelfde principe als v2.4.40)
**Vervolg op v2.4.40 (Garmin-consolidatie) — nu Strava's "Synchroniseren"
en "Bekijk activiteiten" ook verplaatst naar `/activities`. Ontdekking
tijdens overleg: `/activities` had geen permanente ingang in de app (geen
bottom-nav-tab) — opgelost door een 6e tab toe te voegen.**

- `src/components/layout/index.tsx` (`BottomNav`) — nieuwe **"Activiteiten"**-
  tab toegevoegd (6e item). De balk is nu horizontaal scrollbaar
  (`overflow-x-auto` i.p.v. `justify-around`, elk item met vaste
  `min-w-[68px]`) zodat 6 tabs niet knijpen op kleinere schermen.
- `src/app/settings/page.tsx` — `StravaSection` sterk vereenvoudigd: toont
  nu alleen de koppelingsstatus (verbonden/niet, "Verbind Strava"). De
  "Activiteiten synchroniseren"- en "Bekijk activiteiten"-knoppen
  (inclusief alle bijbehorende sync-state en -logica) zijn verwijderd —
  verplaatst naar `/activities`. Ongebruikte imports opgeschoond
  (`RefreshCw`, `BarChart2`, `AlertTriangle`, `useRef`, `SyncResult`-type).
- `src/app/activities/page.tsx` — nieuwe **"Synchroniseer Strava"**-knop,
  direct onder de bestaande "Activiteit toevoegen" (Garmin). Bewuste
  volgorde: Garmin bovenaan, want naar verwachting vaker gebruikt dan
  Strava. Sync-logica (inclusief de v2.4.22-timeout- en
  duidelijke-foutafhandeling) hergebruikt, nu hier in plaats van in
  Instellingen.

**Resultaat — alle activiteiten-gerelateerde acties nu op één plek:**
- `/activities` → "Activiteit toevoegen" (Garmin screenshot/TCX)
- `/activities` → "Synchroniseer Strava"
- `/activities` → activiteitenlijst zelf, klikbaar voor detail+route (v2.4.41)
- Instellingen → Strava-kaart: alleen nog koppeling zelf (echte instelling)

## v2.4.42 — TCX-import overschrijft nu i.p.v. te weigeren bij duplicaat
**Directe aanleiding: route-data (v2.4.41) ontbrak bij al eerder
geïmporteerde activiteiten (geüpload vóór die functie bestond). Opnieuw
uploaden werd geblokkeerd door de idempotency-check (v2.4.28) — nu wordt
de bestaande activiteit ververst in plaats van geweigerd.**

- `src/app/api/health/garmin-activity-tcx/route.ts` — bij een duplicaat
  (zelfde TCX-starttijd) wordt de bestaande `activity_sessions`-rij nu
  **overschreven** met de opnieuw geparste `metrics` (inclusief route,
  en eventuele andere velden die sindsdien zijn toegevoegd aan de
  parser) — in plaats van een 409-foutmelding te geven.
- **Bewust GEEN nieuwe Coach Call** bij overschrijven — dat zou een
  mogelijk al-geëvalueerde training opnieuw om RPE/mood vragen, verwarrend
  voor wat feitelijk dezelfde training is. Wel wordt
  `coach_call_items.duration_min` bijgewerkt als de duur is veranderd
  (bijv. door een verbeterde parser), zodat een nog-niet-ingevulde
  evaluatie de juiste duur toont.
- `src/app/settings/garmin-activity-import/page.tsx` — toont nu
  **"Bijgewerkt"** met een duidelijke uitleg in plaats van "Opgeslagen"
  wanneer het om een overschrijving ging, zodat de gebruiker weet dat het
  geen nieuwe activiteit betreft.
- **Praktisch gebruik:** activiteiten die vóór v2.4.41 zijn geïmporteerd
  (dus zonder route) kunnen nu alsnog van een route worden voorzien door
  hetzelfde TCX-bestand simpelweg opnieuw te uploaden — geen handmatige
  database-opschoning nodig.

## v2.4.41 — NIEUW: Route-kaart bij activiteiten (Leaflet + OpenStreetMap)
**Ontdekking: TCX-bestanden bevatten al de volledige GPS-route (lat/lon per
trackpoint) — we gebruikten dat tot nu toe alleen om `has_gps` te bepalen
en gooiden de coördinaten daarna weg. Geen Garmin API nodig, puur gebruik
van data die al binnenkomt.**

**Nieuwe dependency:** `leaflet` (^1.9.4) + `@types/leaflet` (^1.9.12).
Gratis kaarttegels via OpenStreetMap, geen API-key nodig.

**Nieuwe bestanden:**
- `src/components/ActivityRouteMap.tsx` — kaart-component. Puur
  client-side (Leaflet gebruikt `window`, kan niet server-side gerenderd
  worden) — altijd via `next/dynamic` met `ssr: false` laden. Tekent de
  route als lijn, met start/eind-markers, kaart past zich automatisch aan
  op de route (`fitBounds`).
- `src/app/api/activities/[id]/route.ts` — nieuwe route om één activiteit
  op te halen (nodig voor de detailpagina, i.p.v. de hele lijst van max.
  100 activiteiten opnieuw te laden).
- `src/app/activities/[id]/page.tsx` — nieuwe detailpagina: route-kaart
  bovenaan, daaronder alle metrics als stat-blokken (duur, afstand,
  hartslag, calorieën, snelheid, cadans, watts, hoogtemeters).

**Gewijzigde bestanden:**
- `src/lib/tcx-parser.ts` — `TcxParsed` uitgebreid met `route: {lat, lng}[]
  | null`. GPS-coördinaten worden nu verzameld tijdens de bestaande
  trackpoint-loop (geen aparte doorloop) en **gedownsampled naar max ~300
  punten** — ruim voldoende voor een vloeiende lijn op een kaart, houdt de
  opslag klein ongeacht activiteitsduur (getest: 1250 ruwe punten → 250,
  ~12,5KB JSON).
- `src/app/api/health/garmin-activity-tcx/route.ts` — `route` toegevoegd
  aan de opgeslagen `metrics`.
- `src/app/activities/page.tsx` — niet-Strava-activiteitenkaartjes zijn nu
  klikbaar, linken naar de nieuwe detailpagina. Strava-kaartjes
  ongewijzigd (blijven extern linken naar strava.com).

**Bewust niet meegenomen:** screenshot-geïmporteerde activiteiten hebben
geen route (een foto bevat geen GPS-data) — voor die activiteiten toont de
detailpagina een duidelijke melding ("Geen GPS-route beschikbaar") in
plaats van een lege/kapotte kaart.

## v2.4.40 — Consolidatie: één importweg voor losse activiteiten (was 3)
**Gebruiker merkte op dat de "Importeer"-knop op `/activities` een ouder,
apart systeem gebruikte naast de nieuwe Garmin-activiteit-import. Bij
onderzoek bleek dit oude systeem daadwerkelijk kapot te zijn.**

**Gevonden bugs in de verwijderde route (`POST /api/activities`):**
- **Lap-bug:** regex `content.match(/<TotalTimeSeconds>.../)` pakte alleen
  de EERSTE match in het bestand — bij een TCX met meerdere laps (bijna
  elk bestand, zie v2.4.25-onderzoek) werd dus alleen lap 1 gebruikt in
  plaats van het totaal. Een activiteit van 1u44m/54,74km zou hierdoor een
  veel te lage waarde hebben opgeleverd.
- **Geen Coach Call-trigger:** activiteiten via deze route telden nooit
  mee in de herstelberekening — stil, onopgemerkt gemis.
- **Zwakke duplicaatcheck:** alleen op datum + afgeronde duur (geen
  starttijd-ID zoals v2.4.28's fix).
- Zelfde 413-payload-risico dat v2.4.35 al oploste voor de nieuwe route
  (uploadde het volledige bestand naar de server).

**Wijzigingen:**
- `src/app/api/activities/route.ts` — `POST` volledig verwijderd. `GET`
  (activiteitenlijst laden) blijft ongewijzigd.
- `src/app/activities/page.tsx` — de kapotte "Garmin importeren"-upload-
  kaart vervangen door één simpele knop **"Activiteit toevoegen"**, die
  naar `/settings/garmin-activity-import` linkt (de geteste flow met
  screenshot + TCX-keuze, v2.4.23-39). Overbodige state
  (`importing`/`importResult`/`fileInputRef`) en de oude
  `importeerGarmin()`-functie verwijderd.
- `src/app/settings/page.tsx` — de losse "Garmin Activiteit"-kaart
  verwijderd (was dubbelop met de nieuwe knop op `/activities`, beide
  linkten naar dezelfde pagina).

**Resultaat: van 3 knoppen/systemen naar 1.**
- ~~Instellingen → "Garmin Activiteit"~~ (verwijderd, was duplicaat)
- ~~/activities → "Importeer" (.gpx/.tcx upload)~~ (verwijderd, was kapot)
- **/activities → "Activiteit toevoegen"** (nieuw, enige overgebleven weg,
  linkt naar de geteste screenshot+TCX-pagina)

De dagelijkse "Garmin Import" (Body Battery/slaap) in Instellingen blijft
ongewijzigd — dat is een apart, dagelijks terugkerend proces.

**Bekend gat, niet in scope van deze consolidatie:** GPX-ondersteuning
ging verloren met de verwijderde route (de nieuwe flow ondersteunt alleen
TCX). Kan bij gelegenheid apart toegevoegd worden aan de nieuwe flow als
gewenst.

## v2.4.39 — Snelheid, cadans en watts nu ook zichtbaar op Activiteiten-kaartjes
- `src/app/activities/page.tsx` — drie nieuwe metric-blokken toegevoegd
  aan elk activiteitenkaartje (naast de bestaande Duur/Afstand/Hartslag/
  Calorieën/Hoogte): **Snelheid**, **Cadans**, **Watts** — elk met de
  max-waarde als subtekst indien beschikbaar.
- Werkt voor zowel Strava- als Garmin-activiteiten, aangezien beide
  bronnen dezelfde veldnamen gebruiken in `metrics`
  (`avg_speed`/`avg_cadence`/`avg_watts`, plus `max_*`-varianten sinds de
  TCX-uitbreiding in v2.4.37). Strava levert doorgaans geen max-waarden
  (alleen gemiddelden) — die subtekst verschijnt dan simpelweg niet, geen
  probleem.
- Elk blok verschijnt alleen als de betreffende data daadwerkelijk
  aanwezig is (zelfde patroon als het bestaande hoogte-blok) — geen lege
  "–"-velden die de kaartjes onnodig vol maken.

## v2.4.38 — Garmin-activiteiten zichtbaar in Activiteiten-overzicht + hoogtemeters-fix
**Bevestigd: Garmin-activiteiten (screenshot én TCX) verschenen al
automatisch op `/activities` met een "Garmin"-badge — de pagina filtert
nergens op `source: 'strava'`. Geen wijziging nodig om ze zichtbaar te
maken. Wel twee kleine verbeteringen gevonden en gefixt.**

- `src/app/settings/garmin-activity-import/page.tsx` — nieuwe **"Bekijk
  activiteiten"**-knop op het bevestigingsscherm, naast "Naar Home".
  Zelfde patroon als de bestaande knop bij Strava.
- `src/app/activities/page.tsx` — **echte bug gefixt:** hoogtemeters
  werden niet getoond voor Garmin-activiteiten. Root cause: deze pagina
  las `session.metrics.elevation` (Strava's veldnaam), maar de
  TCX-import (v2.4.37) slaat hoogtemeters op als `metrics.elevation_gain`
  — een andere sleutelnaam, dus geen match. Nu leest de pagina beide
  (`metrics.elevation ?? metrics.elevation_gain`), zodat hoogtemeters
  correct tonen ongeacht de bron.
- **Nog niet meegenomen:** de overige nieuwe TCX-velden (max cadans, max
  watts, snelheid) worden nog niet getoond in de kaartjes op deze
  lijstpagina — alleen duur, afstand, hartslag, calorieën en hoogte. Kan
  bij gelegenheid uitgebreid worden als gewenst.

## v2.4.37 — TCX-import: extra velden voor rijkere coach-analyses
**Op verzoek uitgebreid — deze data zat al in het TCX-bestand maar werd
niet gebruikt. Alles berekend binnen de bestaande trackpoint-loop, geen
nieuwe parsing-structuur nodig.**

- `src/lib/tcx-parser.ts` — `TcxParsed` uitgebreid met:
  - `max_cadence`, `max_watts`, `avg_speed_kmh`, `max_speed_kmh`
  - `elevation_gain_m`, `elevation_loss_m` — berekend als de som van
    positieve/negatieve hoogteverschillen tussen opeenvolgende
    trackpoints (`AltitudeMeters`), met een ruisdrempel van 0,5m per stap
    om GPS-hoogtetrilling niet als valse stijging/daling te tellen.
  - Snelheid wordt omgerekend van m/s (TCX-eenheid) naar km/u.
  - **Getest tegen alle 5 eerder gebruikte voorbeeldbestanden** — waarden
    zijn plausibel (bv. wandeling: 30m stijging/29m daling; indoor
    fietsen: geen hoogtedata, zoals verwacht).
- `src/app/api/health/garmin-activity-tcx/route.ts` — `metrics`-object bij
  het opslaan in `activity_sessions` uitgebreid met alle nieuwe velden.
- `src/app/settings/garmin-activity-import/page.tsx` — preview toont nu
  ook max-cadans, max-watts, snelheid (gem./max) en hoogtemeters
  (stijging/daling). Lokale, verouderde `TcxParsed`-interface verwijderd
  — gebruikt nu de gedeelde definitie uit `tcx-parser.ts` (voorkomt drift
  tussen de twee).
- **Bewust NIET toegevoegd:** Training Effect/Exercise Load-achtige
  duiding voor deze extra cijfers (bv. "hoog voor jouw niveau") — dat zou
  een aparte analyselaag vereisen die buiten de scope van deze
  parser-uitbreiding valt. De ruwe cijfers zijn nu beschikbaar in
  `activity_sessions.metrics`; interpretatie is aan Coach AI zelf, via de
  bestaande promptlogica die deze tabel al leest.

## v2.4.36 — Fix: Garmin-activiteit-import-pagina kon niet scrollen
- `src/app/settings/garmin-activity-import/page.tsx` — root-`<div>`
  gewijzigd van `min-h-screen` naar `h-screen overflow-y-auto`.
- **Root cause:** deze pagina gebruikt bewust geen `AppShell` (geen
  bottom-navigatie gewenst tijdens de import-flow), maar de globale
  app-stijl schakelt scrollen op `body`/`html` doorgaans uit — een
  aanname die klopt zolang een pagina `AppShell`'s eigen `scroll-area`
  gebruikt (zie v2.4.20), maar niet als een pagina daar bewust buiten
  valt. Deze pagina had dus **nergens** een scrollbare container.
  Bij content die de schermhoogte overschreed (bijvoorbeeld een lange
  TCX-preview met alle datavelden + 8 keuzeknoppen + melding + knop,
  zoals bij een fietsactiviteit van 54km/1u44m) kon de gebruiker niet bij
  de knoppen onderaan komen — leek op "niet kunnen opslaan", maar was
  eigenlijk "niet kunnen scrollen om bij de knop te komen".
  `h-screen` + `overflow-y-auto` geeft de pagina een eigen, onafhankelijke
  scroll-context, los van het AppShell-mechanisme.
- **Vergelijkbaar risico elders:** dit is de enige pagina in het project
  die bewust buiten `AppShell` valt (voor zover deze sessie onderzocht) —
  mocht een toekomstige pagina ook `AppShell` overslaan, geef die dan
  vanaf het begin een eigen `overflow-y-auto`-container.

## v2.4.35 — Fix: TCX-import gaf 413 (payload te groot) bij lange activiteiten
- **Nieuw:** `src/lib/tcx-parser.ts` — de TCX-XML-parslogica (`parseTcx`,
  `bepaalKeuzeNodig`, `suggereerType`, `ACTIVITEIT_OPTIES`) is verplaatst
  naar een isomorfe, gedeelde module die zowel in de browser als
  server-side werkt.
- `src/app/settings/garmin-activity-import/page.tsx` — parseert het
  TCX-bestand nu **in de browser** (`file.text()` + `parseTcx()`) in
  plaats van het volledige bestand naar de server te uploaden. Alleen het
  kleine, samengevatte resultaat (JSON, enkele KB) gaat naar de server.
- `src/app/api/health/garmin-activity-tcx/route.ts` — de extract-flow
  accepteert nu JSON (`{ parsed }`) in plaats van `multipart/form-data`
  met het volledige bestand. Confirm-flow ongewijzigd (blijft FormData,
  was toch al klein).
- **Root cause:** Vercel serverless functions hebben een payload-limiet
  van ~4,5MB. Langere activiteiten genereren TCX-bestanden met veel meer
  trackpoints (per-seconde GPS/hartslag/cadans-data) — bij een lange
  activiteit overschreed het bestand die limiet, wat resulteerde in
  `413 FUNCTION_PAYLOAD_TOO_LARGE` vóórdat de request onze route-code
  ooit bereikte (vandaar dat er geen `[garmin-activity-tcx]`-logregel
  verscheen — Vercel blokkeerde het al op platformniveau).
  **Waarom dit pas nu opviel:** de 5 testbestanden waarmee de TCX-import
  in v2.4.25 gebouwd en getest is, waren allemaal relatief kort
  (20-60 minuten) — geen van allen kwam in de buurt van de limiet.
- **Waarom dit de definitieve fix is, niet een tijdelijke workaround:**
  parsen in de browser heeft principieel geen bestandsgrootte-limiet zoals
  een serverless function die heeft — dit lost het probleem op voor
  activiteiten van elke lengte, niet alleen de iets grotere bestanden die
  net onder een verhoogde limiet zouden passen.

## v2.4.34 — NIEUW: Audio (Fase 2) voor beide trainingssystemen
**Gebouwd volgens de afgesproken architectuurregels: geluid is uitsluitend
een luisterlaag, nooit sturend. Eén gedeelde module, tegelijk gekoppeld
aan Archief én Trainer AI/Bibliotheek om divergentie tussen de twee
systemen te voorkomen.**

**Nieuw bestand:**
- `src/lib/workout-sound.ts` — gedeelde audio-module, geïmporteerd door
  beide `page.tsx`-bestanden. Bevat:
  - `ontgrendelAudio()` — ontgrendelt de gedeelde `AudioContext` voor de
    rest van de sessie. Moet aangeroepen worden vanuit een ECHTE
    gebruikersinteractie (iOS Safari-vereiste); nooit automatisch.
  - `speelTick()` — kort/droog/hoog, laatste 3 sec van countdown/rust.
  - `speelEindsignaal()` — lager/langer, einde van een actieve set.
  - `speelStarttoon()` — hoger/helder, start van een nieuwe set/oefening.
  - Synthetische tonen via Web Audio API (`OscillatorNode` +
    `GainNode`-envelope) — geen externe geluidsbestanden, laadt niets.
  - Elke functie faalt volledig stil (try/catch) — een geblokkeerde of
    falende `AudioContext` kan de workout nooit onderbreken.

**Koppeling — Archief (`archief/oefening/[id]/page.tsx`):**
- `ontgrendelAudio()` in `startWorkout()` (de "Start oefening"-knop)
- `speelStarttoon()`: countdown→actief (1e set), rust→actief (vervolgset)
- `speelEindsignaal()`: actief→rust (einde set)
- `speelTick()`: losse `useEffect`, laatste 3 sec van countdown/rust

**Koppeling — Trainer AI/Bibliotheek (`training/session/[module]/page.tsx`):**
- `ontgrendelAudio()` in `handleReadyFromUitleg()` (de "Ready"-knop die de
  eerste countdown start)
- `speelStarttoon()`: countdown→active (elke set/oefening-start),
  rest→active (vervolgset zonder countdown)
- `speelEindsignaal()`: active→rest/last_rest (einde set)
- `speelTick()`: losse `useEffect`, laatste 3 sec van countdown/rest/last_rest

**Bewust nog niet in deze versie:**
- Geen aan/uit-instelling — geluid staat standaard aan, toggle volgt in
  Fase 3.
- Trilfunctie/vibratie — niet gevraagd voor deze fase.

**Test-aandachtspunten:** i) eerste start (audio moet daadwerkelijk
hoorbaar zijn, niet stilzwijgend geblokkeerd door iOS), ii) einde van een
set, iii) laatste 3 sec van rust (3 losse ticks), iv) countdown bij nieuwe
oefening (Trainer AI/Bibliotheek), v) pauzeren/hervatten (geen geluid
tijdens pauze, geen dubbel geluid bij hervatten), vi) lockscreen/
achtergrond-herstel (geluid moet niet "inhalen" met meerdere gemiste
ticks tegelijk).

## v2.4.33 — Kleurprincipe consistent: rood = "maak je klaar", niet "tijd loopt af"
**Bevestigd principe (gebruiker): rood betekent uitsluitend "je moet zo
beginnen" (rust/countdown), nooit "je huidige oefening loopt bijna af"
(actief). Archief volgde dit al sinds v2.4.31/32; Trainer AI/Bibliotheek
volgde het gedeeltelijk niet.**

- `src/app/training/session/[module]/page.tsx` — twee wijzigingen in
  `WorkoutEngine`/`CountdownScherm`:
  1. **`actief`-fase:** cijfer is nu altijd wit, wordt niet meer rood bij
     de laatste 3 seconden (was: `remaining <= 3 ? 'text-red-400' :
     'text-white'`, nu: altijd `text-white`).
  2. **`countdown`-fase** (bij elke nieuwe oefening, 3 of 5 sec): cijfer
     wordt nu rood bij de laatste 3 seconden (was: altijd wit, geen
     rood-signaal). Dit ontbrak nog volledig — een gemiste kans om het
     principe consistent toe te passen, niet alleen "geen onterecht rood
     weghalen" maar ook "terecht rood toevoegen".
  3. **`rust`/`last_rest`-fase:** ongewijzigd — was al rood bij de laatste
     3 seconden, en dat is precies correct volgens het principe.
- **Resultaat:** Archief en Trainer AI/Bibliotheek volgen nu exact
  hetzelfde kleurprincipe: rood verschijnt uitsluitend vlak vóór een
  moment waarop de gebruiker in actie moet komen (rust-einde,
  countdown-einde), nooit tijdens de uitvoering van een oefening zelf.

## v2.4.32 — Fix: pauze in Archief bevroor het cijfer niet (bug sinds v2.4.30)
- `src/app/archief/oefening/[id]/page.tsx` — `remaining` komt tijdens
  pauze nu uit de bevroren `paused_remaining_ms`, niet meer uit een live
  herberekening op basis van `phase_end_at`.
- **Root cause:** `phase_end_at` verandert bewust niet tijdens pauze (dat
  was al correct — nodig om de fase-overgang tegen te houden via de
  `gepauzeerd`-guard in de ticking-`useEffect`). Maar `remaining` werd bij
  elke render nog steeds live herberekend als
  `phase_end_at - Date.now()`, en `Date.now()` loopt gewoon door tijdens
  pauze — dus het GETOONDE cijfer bleef doortellen naar 0 en bleef daar
  hangen, ook al werd de daadwerkelijke fase-overgang terecht
  tegengehouden. Dit zag eruit als "pauze doet niets", terwijl de
  onderliggende logica (geen ongewenste fase-overgang) wel klopte —
  een zuiver weergave-probleem, geen logica-probleem.
- Aanwezig sinds v2.4.30 (de Archief-timer-herbouw), pas nu opgemerkt
  omdat v2.4.31 (kleur-fix) toevallig de aandacht op het rust-scherm
  vestigde.

## v2.4.31 — Fix: Archief-timer werd niet rood bij laatste 3 seconden
- `src/app/archief/oefening/[id]/page.tsx` — het cijfer tijdens `rust` en
  `countdown` kleurt nu rood zodra `remaining <= 3`, consistent met hoe de
  `actief`-fase dat al deed (`WorkoutEngine` in de Coach AI-trainingen had
  dit gedrag ook al).
- **Root cause:** bij de v2.4.30-timer-herbouw is dit visuele detail
  gemist — het cijfer bleef altijd amber (`rust`) of wit (`countdown`),
  ongeacht hoeveel seconden er nog over waren. Functioneel klopte de timer
  zelf (telde correct af), maar het ontbrekende visuele signaal bij de
  laatste 3 seconden viel op ten opzichte van de rest van de app.

## v2.4.30 — Workout Engine REBUILD toegepast op Archief (eigen flowregels)
**Vervolg op v2.4.29 — die herbouw raakte alleen Coach AI/Trainingsbibliotheek
(`training/session/[module]/page.tsx`). Archief gebruikt een volledig los
bestand met eigen timer-logica, die nog niet was meegenomen.**

- `src/app/archief/oefening/[id]/page.tsx` — zelfde onderliggende
  `phase_end_at`-engine als v2.4.29 (vast eindtijdstip i.p.v. los
  `tellerSec`-getal, centrale 250ms-ticking-loop, `visibilitychange`-
  herstel, drift-vrij), maar met **bewust andere flowregels** dan Coach
  AI-trainingen — beargumenteerd door de gebruiker: Archief is één losse
  oefening met herhaalde sets (ritme/herhaling gewenst), geen opeenvolging
  van verschillende oefeningen (geen "omschakel-moment" nodig).

**Archief-flow (nieuw, vervangt "elke set opnieuw 5 sec countdown"):**
- 5 sec countdown **alleen vóór de allereerste set**
- Bij elke volgende set: **geen countdown** — rust loopt af, dan direct
  door naar de volgende set (de rust zelf is de voorbereiding)

Ter vergelijking, Coach AI-trainingen (v2.4.29, ongewijzigd):
- 5 sec bij de allereerste oefening van de hele sessie
- 3 sec bij elke overgang naar een NIEUWE oefening (wél een
  omschakel-moment, andere beweging/spiergroep)
- Geen countdown tussen sets binnen dezelfde oefening

- Pauzeren/hervatten volgt hetzelfde `paused_remaining_ms`-patroon als
  v2.4.29 — geen verloren/gewonnen tijd door de pauzeduur.
- De v2.4.17-navigatiefix (`router.back()` i.p.v. `router.push('/archief')`)
  blijft behouden in deze herbouwde versie.
- "Volgende set" / "Skip countdown" / "Skip rust"-knoppen forceren nu
  `phase_end_at = Date.now()` in plaats van een eigen aparte
  transitielogica — dezelfde aanpak als v2.4.29's `handleNext()`, voorkomt
  twee losse plekken die weten hoe overgangen werken.

**Nog steeds niet in deze versie:** geluid (Fase 3) — volgt voor beide
systemen (Coach AI én Archief) tegelijk, zodra deze timer-basis in de
praktijk bevestigd is.

## v2.4.29 — Workout Engine REBUILD: Fase 1 (timer-engine) + Fase 2 (flow)
**Volgens de CoachOS Workout Engine Master Architecture — bewust in deze
volgorde gebouwd (eerst fundament, dan flow, geluid volgt in een latere
stap als Fase 3).**

- `src/app/training/session/[module]/page.tsx` — volledig herbouwd rond
  één centrale timer-engine.

**FASE 1 — Drift-vrije timer-engine:**
- Elke getimede fase (`countdown`/`active`/`rest`/`last_rest`) krijgt een
  vast `phase_end_at`-tijdstip (`Date.now() + duur`) in plaats van een los
  aftellend getal (`countdown_seconds`/`active_seconds_left`/`rest_seconds`
  zijn verwijderd uit de state).
- Resterende tijd wordt **elke render herberekend** uit `phase_end_at` —
  nooit opgeslagen als eigen state die kan gaan driften.
- Eén centrale `setInterval(250ms)` + `visibilitychange`-listener in
  `SessionPage` forceert herberekening, ook direct bij terugkeer uit de
  achtergrond/lockscreen — lost het probleem op dat `setInterval` op iOS
  vertraagt zodra het scherm uitgaat.
- `WorkoutEngine` is nu **puur presentationeel** — geen eigen
  `setInterval`-effecten meer (voorheen 3 aparte intervals voor
  countdown/active/rest). Ontvangt `remaining` als prop.
- Pauzeren bewaart de resterende tijd in `paused_remaining_ms` (ms);
  hervatten berekent een nieuw `phase_end_at` vanaf dat punt — de
  pauzeduur zelf telt niet mee.

**FASE 2 — Vereenvoudigde flow:**
- **Geen countdown meer tussen sets** van dezelfde oefening — na `rest`
  gaat het direct door naar `active` (volgende set).
- **5 sec countdown** alleen bij de allereerste oefening van de sessie
  (`current_segment === 0 && completed_segments.length === 0`).
- **3 sec countdown** bij elke overgang naar een nieuwe oefening (na
  `last_rest`).
- Nieuwe flow: `uitleg → countdown(5s, 1x) → active → rest → active →
  rest → active → last_rest → [nieuwe oefening] → countdown(3s) → active
  → ... → voltooid`.
- De "Next"-knop (`handleNext`) forceert nu `phase_end_at = Date.now()` in
  plaats van een eigen, aparte transitielogica te hebben — de centrale
  ticking-loop pikt dit binnen 250ms op en roept dezelfde `advancePhase()`
  aan die ook bij natuurlijk verlopen van de tijd gebruikt wordt. Voorkomt
  dat er twee losse plekken zijn die weten hoe fase-overgangen werken.

**Nog niet in deze versie (bewust, volgende stap):**
- Fase 3 (geluid: Tick + Beep) — bouwen zodra deze timer-basis in de
  praktijk bevestigd is als 100% betrouwbaar.
- Fase 4 (instellingen geluid aan/uit).
- Trillingen, Apple Watch, Live Activities, Dynamic Island — genoemd in
  het architectuurdocument als toekomstige uitbreidingen, vandaar de keuze
  voor één centrale state (`phase`, `phase_end_at`) waar dit later op kan
  aanhaken zonder de kern opnieuw te hoeven bouwen.

**Test-aandachtspunten voor deze release:** i) eerste oefening start met
5 sec countdown, ii) geen countdown tussen sets binnen dezelfde oefening,
iii) elke volgende oefening start met 3 sec countdown, iv) timer blijft
correct na scherm-uit/achtergrond (val niet stil, geen drift), v) pauzeren
en hervatten geeft geen verloren/extra seconden.

## v2.4.28 — Fix: geen duplicaatcheck bij TCX-import (idempotency ontbrak)

**Mogelijk relevant vóór deploy — check of je al een duplicaat hebt
aangemaakt:** als je hetzelfde TCX-bestand meerdere keren hebt bevestigd
vóór deze fix, staan er nu waarschijnlijk dubbele `activity_sessions`-
rijen (en dubbele Coach Call-items). Check met:
```sql
select id, date, duration, notes, created_at
from activity_sessions
where user_id = 'JOUW_USER_ID' and source = 'garmin'
order by created_at desc;
```
Verwijder handmatig de duplicaat-rij(en) indien aanwezig (en het
bijbehorende `coach_call_items`-record) — dit gebeurt niet automatisch.

**Wat er is gefixt:**
- `src/app/api/health/garmin-activity-tcx/route.ts` — vóór het opslaan
  wordt nu gecontroleerd of er al een `activity_sessions`-rij bestaat met
  dezelfde TCX-starttijd (`garmin_tcx_start:[Id]` in `notes`). Zo ja: de
  confirm wordt geweigerd met status 409 en een duidelijke melding,
  in plaats van een duplicaat aan te maken.
- **Root cause:** deze idempotency-check bestond al voor Strava-sync (via
  `strava:ID` in `notes`, zie `strava-activity-processor.ts`), maar was
  niet meegenomen bij het bouwen van de TCX-route (v2.4.25) — een gemiste
  parallel tussen twee vergelijkbare importwegen.
- `src/app/settings/garmin-activity-import/page.tsx` — toont nu de
  specifieke "al eerder geïmporteerd"-melding bij een 409-response, in
  plaats van een generieke foutmelding.
- **Bewuste keuze — screenshot-import (v2.4.23/24) heeft dit nog niet.**
  Een screenshot heeft geen betrouwbaar uniek kenmerk zoals een TCX-
  starttijd om op te dedupliceren; dat zou een aparte oplossing vergen
  (bijv. datum + tijd + activiteitstype als samengestelde sleutel). Nog
  niet gebouwd — laag risico, want een screenshot opnieuw uploaden is een
  bewustere, minder toevallige handeling dan een TCX-bestand dat je
  mogelijk per ongeluk twee keer aanklikt.

## v2.4.27 — Build-fix: ongeldige export in garmin-activity-tcx/route.ts
- `src/app/api/health/garmin-activity-tcx/route.ts` — `export const
  ACTIVITEIT_OPTIES = [...]` gaf een Vercel build-fout: *"ACTIVITEIT_OPTIES
  is not a valid Route export field"*.
- **Root cause:** Next.js App Router staat in `route.ts`-bestanden
  uitsluitend specifieke exports toe (`GET`, `POST`, `dynamic`,
  `revalidate`, etc.) — een losse geëxporteerde constante wordt door
  Next.js' eigen type-validatie geweigerd, ongeacht of hij ergens
  daadwerkelijk wordt geïmporteerd. In dit geval werd de constante alleen
  intern in hetzelfde bestand gebruikt, dus de `export` was sowieso
  overbodig.
- Fix: `export` weggehaald, functioneel geen enkele wijziging.
  **Les:** in `route.ts`-bestanden nooit hulpconstantes/functies
  exporteren tenzij écht nodig vanuit een ander bestand — anders eerst
  overwegen of het naar een apart `lib/`-bestand hoort.

## v2.4.26 — NIEUW: Blessures-archief met volledige historie

**⚠️ VEREIST VÓÓR DEPLOY — nieuwe kolom in Supabase SQL Editor:**
```sql
alter table injuries add column ended_at timestamptz;
```
Zonder deze kolom slaagt de PATCH in `injuries/route.ts` niet meer bij het
markeren van een blessure als hersteld (poging tot schrijven naar een
niet-bestaande kolom).

**Wat er is veranderd:**
- `src/app/api/injuries/route.ts` — `PATCH` zet nu `ended_at` op het huidige
  tijdstip zodra een blessure op `active: false` wordt gezet (hersteld), en
  maakt het weer leeg als een blessure ooit heropend zou worden
  (`active: true`). Nodig om duur en hersteldatum te kunnen tonen.
- `src/app/injuries/page.tsx` — de kleine "Hersteld"-sectie onderaan
  (toonde alleen de naam, doorgestreept, geen historie) is verwijderd.
  Herstelde blessures verdwijnen nu uit dit scherm en verhuizen naar het
  nieuwe archief. Een "Archief"-kaart onderaan linkt daarnaartoe.
- **Nieuw:** `src/app/injuries/archief/page.tsx` — toont elke herstelde
  blessure als uitklapbare kaart met lichaamsdeel, start-/hersteldatum,
  berekende duur (dagen/weken/maanden, leesbaar geformatteerd), en bij het
  uitklappen de **volledige pijnscore-historie** (hergebruikt de bestaande
  `injury-updates`-data via `GET /api/injury-updates`, alleen-lezen).
- Geen nieuwe API-route nodig voor het archief zelf — hergebruikt de
  bestaande `GET /api/injuries` en filtert client-side op `!active`,
  consistent met hoe de hoofdpagina dat al deed voor actieve blessures.

## v2.4.25 — NIEUW: TCX-import gecombineerd met screenshot-import (één pagina)
**Gebouwd na onderzoek van 5 echte Garmin TCX-exports (Hardlopen, Wandelen,
Fietsen buiten, Fietsen indoor, Roeien, Zwift) — het ontwerp is direct op
bewijs gebaseerd, niet op aannames over hoe Garmin activiteiten labelt.**

**Nieuwe dependency:** `fast-xml-parser` (^4.5.0) toegevoegd aan `package.json`.

**Onderzoeksbevindingen (bepalend voor het ontwerp):**
- `Sport="Running"` is 100% betrouwbaar → automatisch "Hardlopen"
- `Sport="Biking"` geldt voor ZOWEL buiten als indoor fietsen — **Zwift
  genereert zelfs nep-GPS-coördinaten die op een buitenrit lijken**, dus
  GPS-aanwezigheid is geen betrouwbaar onderscheid
- `Sport="Other"` dekt wandelen, roeien, kracht, kettlebell — geen enkel
  TCX-veld onderscheidt deze onderling
- Conclusie: alleen `Running` mag automatisch worden aangenomen; voor al het
  overige toont de UI een keuzemenu met een voorgestelde default

**Nieuwe bestanden:**
- `src/app/api/health/garmin-activity-tcx/route.ts` — parseert TCX-XML met
  `fast-xml-parser` (geen AI nodig, exacte cijfers). Let op een subtiele
  parser-eigenaardigheid, gevonden door te testen tegen echte bestanden:
  `fast-xml-parser` behoudt de `ns3:`-naamruimte-prefix OOK op
  onderliggende veldnamen (bv. `Extensions['ns3:TPX']['ns3:Watts']`, niet
  `Extensions.TPX.Watts`). Cadans staat top-level als `Cadence` bij fietsen,
  maar als `ns3:RunCadence` binnen `ns3:TPX` bij hardlopen — beide worden
  gecombineerd.
- `src/app/settings/garmin-activity-import/page.tsx` — **volledig herbouwd**
  als gecombineerde pagina met tabblad-keuze (Screenshot/TCX-bestand) in
  plaats van een aparte derde knop in Instellingen. Bij TCX met
  `keuze_nodig: true` toont de pagina een keuzemenu (Hardlopen, Fietsen
  buiten, Indoor Fietsen, Wandelen, Roeien, Krachttraining, Kettlebell,
  Anders), voorgevuld met een suggestie.
- Hergebruikt de bestaande `garmin_activity_imports`-tabel (v2.4.23) —
  geen nieuwe tabel nodig, `parsed_data` is generiek genoeg voor beide
  brontypes.
- Zelfde vervolgpad als v2.4.23/24: opslag in `activity_sessions`
  (`source: 'garmin'`) + altijd een Coach Call, ongeacht duur/afstand.

**Bewust ontbrekend bij TCX (eerlijk, geen verzonnen waarde):** Training
Effect en Exercise Load staan niet in het ruwe TCX-bestand — dat is
Garmin's eigen berekende duiding, alleen zichtbaar op het Statistieken-
scherm. TCX-imports missen dit veld; screenshot-imports hebben het wel.
Beide methodes blijven daarom naast elkaar bestaan, geen vervanging.

## v2.4.24 — Fix: Garmin-activiteit-import faalde op check constraint (source)
- `src/app/api/health/garmin-activity-vision/route.ts` — `source`-waarde
  bij de insert in `activity_sessions` gecorrigeerd van `'garmin_manual'`
  naar **`'garmin'`**.
- **Root cause:** `activity_sessions` heeft een check constraint
  (`activity_sessions_source_check`) die `source` beperkt tot
  `manual`/`garmin`/`apple_health`/`strava`. `'garmin_manual'` (verzonnen
  bij het bouwen van v2.4.23, niet geverifieerd tegen het bestaande schema)
  bestond niet in die lijst — Postgres-foutcode `23514`, direct zichtbaar
  via de `console.error('[garmin-activity-vision]', err)`-log.
  **Les:** bij een nieuwe insert in een bestaande tabel altijd eerst de
  check constraints verifiëren (`select conname, pg_get_constraintdef(oid)
  from pg_constraint where conname = '...'`), niet aannemen welke waarden
  zijn toegestaan — exact de fout die v2.4.12 (NOT NULL constraint) ook al
  had blootgelegd, hier herhaald bij een nieuwe feature.
- Onderscheid tussen de dagelijkse Garmin-import en deze nieuwe
  activiteit-import blijft behouden via de `notes`-prefix
  (`garmin_activity_import:[id]`) in plaats van via een eigen
  `source`-waarde — functioneel gelijk, past binnen het bestaande schema.
- README-tabel (Coach Call Systeem) bijgewerkt met de gecorrigeerde waarde.

## v2.4.23 — NIEUW: Garmin-activiteit-import (alternatief voor Strava)
**Context: Strava heeft per 30 juni 2026 API-toegang voor bestaande
Standard-tier ontwikkelaars afhankelijk gemaakt van een betaald abonnement
(zie sectie "Strava API-toegang" hieronder). Dit is een externe
beleidswijziging van Strava, geen bug in CoachOS. Deze nieuwe feature is
een parallel, handmatig alternatief — geen vervanging van Strava-sync zelf.**

**⚠️ VEREIST VÓÓR DEPLOY — nieuwe tabel in Supabase SQL Editor:**
```sql
create table garmin_activity_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  activity_session_id uuid references activity_sessions(id),
  raw_vision_response jsonb,
  parsed_data jsonb,
  validation_flags jsonb,
  confidence_score int,
  status text default 'pending',
  created_at timestamptz default now()
);

alter table garmin_activity_imports enable row level security;

create policy "Users manage own garmin_activity_imports"
  on garmin_activity_imports for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```
Zonder deze tabel geeft `/api/health/garmin-activity-vision` een 500-fout
bij elke poging.

**Nieuwe bestanden:**
- `src/app/api/health/garmin-activity-vision/route.ts` — leest het
  "Statistieken"-tabblad van een Garmin-activiteit uit via Claude Vision
  (zelfde patroon als de bestaande dagelijkse Garmin-import:
  `sharp`-compressie, `claude-opus-4-5`, extract → preview → confirm-flow).
  Bij bevestigen: slaat op in `activity_sessions` (`source: 'garmin_manual'`
  — dezelfde tabel als Strava, dus telt automatisch mee in bestaande
  trainingsbelasting-berekeningen) én maakt **altijd** een Coach Call aan.
- `src/app/settings/garmin-activity-import/page.tsx` — UI voor upload/
  preview/bevestigen, zelfde stijl als `garmin-import/page.tsx`.
- `src/app/settings/page.tsx` — nieuwe kaart "Garmin Activiteit" toegevoegd
  naast de bestaande "Garmin Import"-kaart.

**Belangrijk architectuurbesluit — waarom GEEN drempel zoals Strava:**
Strava-activiteiten triggeren een Coach Call alleen bij een kwalificerende
duur/afstand (OR-drempel, v2.4.6), omdat dat een **automatische bulk-sync**
is met mogelijk veel triviale activiteiten. Een Garmin-screenshot-upload is
daarentegen een **bewuste, eenmalige handeling** — vergelijkbaar met het
starten van een Trainingsbibliotheek-sessie (die ook altijd triggert, zie
v2.4.6). Daarom triggert deze route altijd een Coach Call, ongeacht duur.
Bevat ook de v2.4.8/v2.4.12-heropen-logica voor een reeds
completed/expired call van diezelfde dag.

**Wat nog niet is gedaan:**
- Geen retry-logica (v2.4.9/v2.4.11) toegevoegd aan de Coach Call-insert in
  deze nieuwe route — dat kan bij gelegenheid alsnog toegevoegd worden als
  hier ooit hetzelfde stille-faal-patroon optreedt als bij
  `training/complete/route.ts`.
- Sportnaam-mapping (`ACTIVITY_LABEL_MAP`) dekt de meest voorkomende
  activiteiten maar is niet zo uitgebreid als Strava's `SPORT_TYPE_MAP` —
  uit te breiden indien nodig.

## v2.4.22 — REBUILD: Strava sync (timeout + duidelijke feedback) + v1.8.5 versienummer gefixt
**Op verzoek herbouwd in plaats van opnieuw gepatcht, na een reeks
symptomen (geen resultaatbericht meer, knop bleef "laden") die niet met
gerichte fixes op te lossen bleken.**

- `src/app/api/strava/sync/route.ts` — volledig herbouwd:
  - **Eigen timeout (20 sec, `AbortController`)** op de fetch naar Strava's
    API. Dit was de root cause: de aanroep had voorheen géén timeout, dus
    bij een trage Strava-respons bleef de request oneindig hangen (of tot
    een onduidelijke platform-timeout) zonder ooit een bericht naar de
    gebruiker te sturen — precies het "blijft laden, geen resultaat meer"
    -symptoom.
  - Expliciete afhandeling van Strava-statuscodes: `401` (token ongeldig
    ondanks refresh — vraagt om opnieuw te koppelen), `429` (rate limit),
    overige non-200 statussen.
  - Elke stap gelogd (`console.log`/`console.error` met `[strava/sync]`
    prefix) — token-refresh, aantal opgehaalde activiteiten, per-activiteit
    verwerkingsfouten, totale duur. Een volgend probleem is nu direct
    zichtbaar in Vercel logs zonder eerst code te hoeven doorpluizen.
  - Response bevat nu altijd `success`, `message`, en bij succes ook
    `importedNames` (welke activiteiten precies) en eventuele
    per-activiteit `errors` — nooit meer een stille, betekenisloze
    "Sync klaar".
- `src/app/settings/page.tsx` (`StravaSection`) — volledig herbouwd:
  - Resultaatbericht **blijft zichtbaar** tot de volgende sync-poging
    (was: kon verdwijnen/overschreven worden zonder duidelijke reden).
  - Na **10 seconden zonder resultaat**: expliciete "dit duurt langer dan
    gebruikelijk"-melding in plaats van een spinner die niets zegt.
  - Toont bij succes de namen van geïmporteerde activiteiten; toont bij
    fouten een duidelijke foutmelding in plaats van een generieke tekst.
  - **Bonus, zelfde bestand:** het hardcoded `"v1.8.5"`-versienummer
    (derde losstaande versie naast `package.json` en de al in v2.4.14
    gefixte hoe-werkt-het-pagina) is nu ook dynamisch via `/api/version`.
- **Nog te bevestigen:** of de eerder gemelde ontbrekende wandelactiviteit
  nu wél verschijnt bij een nieuwe sync-poging — dat hangt af van of
  Strava de activiteit inmiddels heeft verwerkt (buiten onze controle),
  maar met deze rebuild krijgt de gebruiker in elk geval altijd een
  duidelijk, waarheidsgetrouw resultaat te zien, ongeacht de uitkomst.

## v2.4.21 — Verfijning v2.4.20: Training blijft bovenaan vanuit Home, herstelt scroll vanuit Archief
**Verduidelijking na terugkoppeling: de v2.4.20 scroll-herstel-fix in
`AppShell` werkt technisch correct, maar het "probleem" bleek deels een
bewuste keuze te zijn — Training-pagina opent bewust bovenaan bij
`Start Training`/`Start Herstel` vanuit Home. Deze wijziging maakt het
onderscheid expliciet in plaats van dat beide paden hetzelfde
scroll-herstel-gedrag delen.**

- `src/app/home/page.tsx` — de `Start Training`/`Start Herstel`-knop wist nu
  expliciet de opgeslagen scrollpositie voor `/training`
  (`sessionStorage` key `coachos_scroll_/training`, uit v2.4.20) vlak vóór
  het navigeren.
- **Resultaat:**
  - Vanuit **Home** → Start Training/Herstel → Training opent **bovenaan**
    (ongewijzigd t.o.v. voor deze hele fix-reeks — dit was en blijft
    gewenst gedrag).
  - Vanuit **Archief** → terug (via `router.back()`, v2.4.17/18) → Training
    **herstelt de scrollpositie** van vóór het bezoek aan Archief (via
    v2.4.20's `AppShell`-logica, die hier niet gewist wordt).
- **Geen wijziging nodig in `AppShell` zelf** — de v2.4.20-logica was
  inhoudelijk correct, alleen ontbrak er een manier om "vergeet de vorige
  positie, dit is een verse start" aan te geven voor het Home-pad. Dat is
  wat deze wijziging toevoegt.

## v2.4.20 — DEFINITIEVE FIX: scrollpositie-herstel in AppShell (v2.4.19 was onjuist)
**Correctie: de analyse in v2.4.19 was fout. Dit lost het daadwerkelijke
probleem op, in het juiste bestand.**

- `src/components/layout/index.tsx` (`AppShell`) — scrollpositie van het
  binnenste `<main>`-element wordt nu bijgehouden in `sessionStorage`, per
  pathname, en hersteld bij het opnieuw mounten van diezelfde route.
- **De echte root cause, gemist in v2.4.17-v2.4.19:** `AppShell` rendert een
  buitenste `<div className="h-screen ... overflow-hidden">` met daarbinnen
  een `<main className="flex-1 scroll-area ...">`. **Het binnenste `<main>`
  scrolt, niet `window`.** Browser-native scrollherstel en Next.js'
  ingebouwde scroll-restoration werken uitsluitend op `window.scrollTo` —
  die hebben dus **nooit** invloed gehad op dit element, ongeacht of de
  navigatie via `router.push()`, `router.back()` of `router.replace()`
  gebeurde, en ongeacht of data synchroon of asynchroon geladen werd. Bij
  elke hermount van een route begint dit `<main>`-element simpelweg weer op
  `scrollTop: 0` — dat is standaard DOM-gedrag, geen bug in onze routing.
- **Waarom v2.4.17/v2.4.18 gedeeltelijk hielpen, maar niet genoeg:** die
  fixes losten een écht apart probleem op (dubbele geschiedenis-entries die
  naar de verkeerde PAGINA navigeerden). Dat probleem bestond naast dit
  scrollprobleem, met een deels overlappend symptoom ("terug gaat niet
  goed"). Beide moesten apart gefixt worden.
- **Waarom v2.4.19 niet hielp:** de analyse ging uit van een layout-shift
  die *window*-scrollherstel zou breken — maar er was helemaal geen
  window-scrollherstel actief om te breken, dus die fix raakte de
  daadwerkelijke oorzaak nooit. Nuttige les: verifieer welk element
  daadwerkelijk scrolt (`window` vs. een inner container met
  `overflow-y`) vóórdat je scroll-herstel-gedrag probeert te fixen.
- **Waarom deze fix wél moet werken:** hij grijpt rechtstreeks in op het
  element dat daadwerkelijk scrolt (`mainRef.current.scrollTop`), volledig
  onafhankelijk van hoe Next.js of de browser navigatie/scroll intern
  afhandelen. Zit in `AppShell` — werkt hierdoor voor élke pagina in de
  app, niet alleen Training/Archief.
- **Dubbele herstelpoging** (direct bij mount + na 150ms) omdat sommige
  pagina's (zoals Training, met de v2.4.19 cache-fix) een fractie van een
  seconde na mount nog van hoogte kunnen veranderen.

## v2.4.19 — Fix: scroll-positie reset bij terugkeer naar Training (INCORRECTE ANALYSE, zie v2.4.20)
**Belangrijk: dit is een ANDER probleem dan de dubbele-geschiedenis-bug uit
v2.4.17/v2.4.18, ook al leek het symptoom in eerste instantie identiek
("terugknop gaat verkeerd").**

- `src/app/training/page.tsx` — `instruction` en `laden` state worden nu
  synchroon geïnitialiseerd vanuit de `localStorage`-cache via een lazy
  `useState`-initializer (`leesGecachteInstructie()`), in plaats van pas in
  een `useEffect` na de eerste render.
- **Root cause:** deze pagina toonde bij elke (her)mount altijd eerst de
  `TrainingSkeleton` (`laden` start op `true`), zelfs als er al geldige
  cache-data in `localStorage` stond — de cache werd pas in een `useEffect`
  gecontroleerd, die pas ná de eerste render draait. De skeleton heeft een
  andere (kortere) hoogte dan de uiteindelijke pagina-inhoud. Wanneer de
  gebruiker teruggnavigeerde (bv. vanuit Archief) via `router.back()` of
  swipe, probeerde de browser de scrollpositie te herstellen op het moment
  dat de pagina nog de korte skeleton toonde — waardoor de herstelde
  positie niet meer klopte zodra de volledige content (met de al bezochte
  categorieën, Trainingsbibliotheek, etc.) een fractie van een seconde later
  verscheen. Dit voelde aan als "terugknop gaat 2 stappen terug" of "reset
  naar boven", terwijl de navigatie zelf (welke pagina) wel degelijk correct
  was.
- **Onderscheid met v2.4.17/v2.4.18:** die fixes losten een echte
  dubbele-`push()`-geschiedenis op (verkeerde bestemmingspagina). Deze fix
  lost een layout-shift op die scroll-herstel breekt binnen de juiste
  pagina. Beide konden hetzelfde voelen voor de gebruiker ("terug gaat
  niet goed"), maar hadden compleet losstaande oorzaken en fixes — een
  les voor toekomstig soortgelijk onderzoek: bevestig altijd expliciet of
  het probleem "verkeerde pagina" of "verkeerde scrollpositie op de juiste
  pagina" is, met screenshots van vóór/na indien mogelijk.

## v2.4.18 — Navigatie-fix uitgebreid: Archief-overzicht + Trainingsbibliotheek-sessie
**Vervolg op v2.4.17 — dezelfde root cause bleek breder aanwezig dan alleen
de losse Archief-oefeningpagina.**

- `src/app/archief/page.tsx` — terugknop gebruikte `router.push('/training')`,
  nu `router.back()`.
- `src/app/training/session/[module]/page.tsx` — drie plekken gefixt:
  1. `handleHeaderBack()`, fallback zonder actieve sessie:
     `router.push('/training')` → `router.back()`
  2. `handleHeaderBack()`, laatste "verlaat sessie helemaal"-tak:
     `router.push('/training')` → `router.back()`
  3. `handleSave()`, redirect na voltooide evaluatie:
     `router.push('/training')` → `router.replace('/training')`
- **Root cause (zelfde als v2.4.17):** `router.push()` voegt bij elk gebruik
  een NIEUWE entry toe aan de browsergeschiedenis. Bij herhaald gebruik van
  Archief of Trainingsbibliotheek (oefening bekijken → terug → andere
  oefening bekijken, of training starten → afbreken → opnieuw starten)
  stapelen duplicaten zich op. Swipe-terug (systeem-navigatie, buiten
  React's routing) volgt die vervuilde geschiedenis, wat zich uit als
  meerdere stappen tegelijk terug, "hangen en terugspringen", of
  terechtkomen op een oude, ongerelateerde pagina.
- **Waarom dit gevonden werd:** gebruiker meldde dat swipe-terug vanuit een
  Archief-oefeningpagina uitkwam op een kettlebell-trainingssessie van
  eerder die dag. Doorvragen naar het exacte navigatiepad
  (Archief → oefening → terug → andere oefening) bevestigde het patroon.
  Vervolgvraag "geldt dit voor het hele Archief?" bracht de bredere scope
  aan het licht — de fix in v2.4.17 dekte slechts één van de vier
  betrokken plekken.
- **Suggestie voor toekomstig onderzoek:** dit `push` vs. `back`/`replace`-
  patroon kan mogelijk ook in andere delen van de app voorkomen die niet
  deze sessie zijn gecontroleerd (bv. Coach Call-pagina, Checkin-pagina,
  Settings-subpagina's). Zie README sectie Troubleshooting voor het
  algemene fix-patroon, mocht een vergelijkbaar probleem zich elders
  voordoen.

## v2.4.17 — Fix: navigatie Archief-oefening bouwde dubbele geschiedenis op
- `src/app/archief/oefening/[id]/page.tsx` — twee wijzigingen:
  1. Terugknop gebruikt nu `router.back()` in plaats van
     `router.push('/archief')` (alleen in de `instellen`-fase — andere
     fases blijven state-only teruggaan via `setFase('instellen')`,
     ongewijzigd).
  2. De automatische redirect na een voltooide evaluatie gebruikt nu
     `router.replace('/archief')` in plaats van `router.push()`.
- **Root cause:** `router.push('/archief')` voegt bij elk gebruik een
  NIEUWE entry toe aan de browsergeschiedenis, ook als je al eerder op
  Archief was. Bij de flow "oefening bekijken → terug → andere oefening
  bekijken → terug → ..." stapelden zich dubbele `/archief`-entries op.
  De in-app terugknop leek daardoor te werken (het scherm zag er correct
  uit), maar de browsergeschiedenis raakte vervuild. Swipe-terug (echte
  browser-navigatie, buiten React's routing om) volgt die vervuilde
  geschiedenis letterlijk, wat zich uitte als: soms 2 stappen tegelijk
  terug, soms "hangen en terugspringen", en in het ergste geval
  terechtkomen op een compleet ongerelateerde eerdere pagina (bijv. een
  kettlebell-trainingssessie van eerder die dag).
  Gevonden via reproductie: Archief → oefening bekijken → terug →
  andere oefening bekijken → swipe-terug gedraagt zich inconsistent.
- `router.back()` navigeert altijd naar de daadwerkelijk vorige pagina in
  de bestaande stack, zonder duplicaten toe te voegen — dit synchroniseert
  het gedrag van de in-app knop met swipe-navigatie.

## v2.4.16 — Illustratie-koppeling: 6 nieuwe WebP-oefeningen (#16-21)
- `src/lib/kettlebell-exercises.ts` — `illustratie`-veld toegevoegd aan 6
  entries: kb-box-squat, kb-tempo-goblet-squat, kb-pause-squat,
  kb-split-squat, kb-bulgarian-split-squat, kb-reverse-lunge.
  Eerste WebP-illustraties sinds de workflow-herziening in v2.4.5 (PNG
  t/m #15, WebP vanaf #16) — bevestigt dat de eerder vastgestelde
  formaat-knip in de praktijk werkt zonder verdere codewijziging nodig.
  Totaal nu 24/102 kettlebell-oefeningen met live illustratie (18 PNG
  legacy + 6 WebP nieuw).

## v2.4.15 — Fix: coach-geheugen/patroonherkenning heeft nooit gewerkt
**Gevonden via de nieuwe gezondheidscheck (v2.4.14): een 401-fout op
`POST /api/memory` met `User Agent: node`, dus een server-naar-server
aanroep — geen gebruikersactie.**

- `src/app/api/coach/route.ts` — de fire-and-forget call naar `/api/memory`
  aan het einde van de POST geeft nu `userId` mee in de request-body:
  ```js
  fetch('https://coach-os-tau.vercel.app/api/memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.id }),
  }).catch(() => {})
  ```
- `src/app/api/memory/route.ts` — `POST` accepteert nu optioneel een
  `userId` in de body; valt terug op cookie-gebaseerde `getUser()` als die
  ontbreekt (voor eventuele toekomstige directe client-aanroepen).
- **Root cause:** deze server-naar-server fetch stuurde nooit cookies mee.
  `getUser()` (cookie-gebaseerd) kon de gebruiker daardoor nooit
  identificeren, en de route gaf sinds de eerste implementatie altijd 401
  terug. De aanroeper ving dit stil af met `.catch(() => {})`, dus dit was
  nooit zichtbaar in normaal gebruik.
- **Impact:** de coach-geheugen/patroonherkenning-feature — beschreven in
  `hoe-werkt-het/page.tsx` ("Coach AI heeft een geheugen... na een week
  begint hij patronen te herkennen") — heeft dus **nog nooit gedraaid**
  sinds de eerste implementatie. `coach_memory` bevatte hierdoor nooit
  automatisch gegenereerde patronen.
  **Besluit:** geen eenmalige achterstand-inhaaltrigger. Vanaf nu bouwt de
  patroonherkenning organisch op bij elke nieuwe coach-advies-generatie —
  rustig, zonder een geforceerde eenmalige analyse over oude data.

## v2.4.14 — Eén versienummer: package.json leidend, automatische update-detectie
**Definitieve oplossing voor drie los van elkaar lopende versienummers
(package.json 1.8.0, hoe-werkt-het-pagina "v1.8.6" hardcoded, README
2.4.13) — vastgesteld tijdens de gezondheidscheck-discussie.**

- `package.json` — versienummer bijgewerkt naar `2.4.14`. **Dit is vanaf
  nu de enige bron van waarheid voor het app-versienummer.** Bij elke
  toekomstige wijziging: `package.json`, README en changelog gaan altijd
  samen omhoog, in dezelfde beweging.
- **Nieuw:** `src/app/api/version/route.ts` — leest het versienummer
  rechtstreeks uit `package.json` en geeft het terug als JSON. Geen
  wijziging aan `next.config.js` nodig (geen build-time env-injectie) —
  een simpele runtime-route volstaat en is minder risicovol.
- `src/app/settings/hoe-werkt-het/page.tsx` — de hardcoded `"CoachOS
  v1.8.6"`-tekst is vervangen door een `fetch('/api/version')`-call. Kan
  nooit meer los gaan lopen van de werkelijke versie.
- `src/app/home/page.tsx` — **automatische update-detectie toegevoegd.**
  Bij elke keer dat de app opent, vergelijkt een nieuwe `useEffect` het
  versienummer (via `/api/version`) met wat in `localStorage`
  (`coachos_laatst_geziene_versie`) stond bij het vorige bezoek. Bij een
  verschil draait een **lichte** gezondheidscheck op de achtergrond (5
  kerntabellen + 3 kernroutes, puur lezend — bewust géén Laag 3
  schrijftest op de achtergrond, dat blijft voorbehouden aan een bewuste
  handmatige `/debug`-run). Bij gevonden problemen verschijnt een rode
  banner bovenaan Home die doorlinkt naar `/debug` voor de volledige
  diagnose. Faalt de check zelf (netwerk e.d.), dan gebeurt er stil niets
  — geen storende fout-banner voor een probleem dat er niet is.
- **Wat dit oplost:** de oorspronkelijke wens ("waarschuwen als een update
  de code breekt") is nu functioneel — niet volledig automatisch vóóraf
  (dat kan niet zonder CI/CD-pipeline, zie eerdere overleg), maar wel
  automatisch **gedetecteerd bij het eerstvolgende bezoek na een update**,
  zonder dat de gebruiker zelf naar `/debug` hoeft te navigeren.

## v2.4.13 — Debug Panel uitgebreid tot volledige gezondheidscheck
- `src/app/debug/page.tsx` — drie lagen toegevoegd/uitgebreid:
  - **Laag 1 — alle tabellen:** bereikbaarheidscheck uitgebreid van 4 naar
    alle 29 tabellen uit het schema (`select id limit 1`, puur lezend).
    Toont nooit inhoud van gevoelige tabellen (`strava_tokens`,
    `health_api_keys`) — alleen bereikbaar/niet.
  - **Laag 2 — kernroutes:** uitgebreid van 2 naar 17 veilig-te-testen
    GET-routes. Schrijfroutes (training/complete, coach-calls/rate,
    strava/sync, etc.) worden bewust NIET aangeroepen — dat zou echte data
    aanmaken/wijzigen.
  - **Laag 3 — schrijftest coach_calls/coach_call_items:** maakt een
    tijdelijke, herkenbare testrij aan (`sport_type: '__SELFTEST__'`,
    datum `1900-01-01`, status `__selftest_pending__`/`__selftest__` — kan
    nooit met echte data clashen), test de insert, en ruimt direct op via
    een `finally`-blok (ook bij een fout onderweg). Ruimt bij elke run ook
    oude testrijen op (ouder dan 5 min) mocht een eerdere run gecrasht
    zijn vóór opruiming. Dit is precies de test die de v2.4.12
    NOT NULL-constraint-bug **direct** had gevangen, in plaats van het
    uren durende onderzoekstraject dat nu nodig was.
  - Kleine bugfix: de bestaande localStorage-check gaf een false-positive
    "GEEN geldige JSON" voor `*_datum`-keys (die bewust kale datumstrings
    bevatten, geen JSON) — nu correct herkend als verwacht gedrag.
- **Nog niet gebouwd:** automatisch draaien na een update (zoals
  besproken). Vereist een betrouwbaar versienummer-mechanisme in de app
  (bv. `NEXT_PUBLIC_APP_VERSION` env-variabele vergeleken met een
  `localStorage`-waarde) — dat bestaat momenteel niet. De
  "hoe-werkt-het"-pagina toont een hardcoded "v1.8.6", losstaand van het
  README-versienummer; dit moet eerst rechtgetrokken worden voordat
  automatische update-detectie zinvol gebouwd kan worden. Zie Openstaand.

## v2.4.12 — DEFINITIEVE FIX: NOT NULL constraint op activity_session_id
**Root cause van het volledige "geen Coach Call na bibliotheek-training"-
traject (v2.4.6 t/m v2.4.11), eindelijk gevonden en opgelost.**

- **Databasewijziging (uitgevoerd in Supabase SQL Editor, geen code):**
  ```sql
  alter table coach_call_items
  alter column activity_session_id drop not null;
  ```
- **Wat er mis was:** `coach_call_items` is oorspronkelijk ontworpen voor
  uitsluitend Strava-items, met `activity_session_id` als verplichte
  (`NOT NULL`) kolom. Toen v2.4.6 bibliotheek-trainingen dezelfde tabel
  liet gebruiken (met `training_result_id` in plaats van
  `activity_session_id`, dat laatste dus leeg), is het databaseschema zelf
  nooit aangepast. Elke insert vanuit de bibliotheek-tak faalde daardoor
  met Postgres-foutcode `23502` ("null value in column
  activity_session_id... violates not-null constraint") — 100% consistent,
  geen toeval, geen RLS-probleem.
- **Waarom dit zo lang duurde om te vinden:** de fout was van meet af aan
  onzichtbaar. `training/complete/route.ts` had de insert in een
  `try/catch` die alleen logde, en de retry-helper (v2.4.9) checkte het
  `.error`-veld van de Supabase-response niet — Supabase gooit standaard
  geen JS-exception bij een DB-fout. Pas v2.4.11 (expliciete
  `.error`-check + eigen Error met volledige Postgres-details) maakte de
  echte foutmelding zichtbaar in Vercel logs, waarna de oorzaak in één
  oogopslag duidelijk werd.
- **Onderzoekspad ter referentie (voor vergelijkbare toekomstige gevallen):**
  1. v2.4.8 loste een écht ander probleem op (completed/expired call niet
     heropend) — nodig maar niet voldoende
  2. Vercel function trace liet zien dat de POST naar `coach_call_items`
     wél plaatsvond, met 200-status op de hele route
  3. SQL-onderzoek naar RLS-policies (`pg_policies`, `rolbypassrls`) bleek
     achteraf een verkeerd spoor — alle policies waren consistent en
     correct; dit kostte de meeste tijd
  4. Pas expliciete `.error`-logging (v2.4.11) gaf het echte antwoord:
     een constraint-violation, geen RLS-probleem
- **Les voor toekomstige Supabase-debugging:** controleer bij een "stil
  falende" insert altijd eerst of de code het `.error`-veld daadwerkelijk
  checkt, vóórdat er tijd gestoken wordt in RLS/policy-onderzoek. Supabase
  se client-bibliotheek gooit geen exceptions bij databasefouten.
- **Bevestigd werkend:** test via Trainingsbibliotheek (kettlebell, 3 juli
  21:37) — Coach Call verscheen, evaluatie (rating + mood verplicht) kon
  verstuurd worden, AI coach-reactie werd correct gegenereerd.

## v2.4.11 — Fix: retry checkte nooit het .error-veld van Supabase-responses
- `src/app/api/training/complete/route.ts` — root cause van het aanhoudende
  "geen Coach Call na bibliotheek-training"-probleem (ook na v2.4.9/v2.4.10):
  Supabase-queries gooien standaard GEEN JavaScript-exception bij een
  database-fout (RLS-blokkade, constraint-violation, etc.) — ze retourneren
  gewoon `{ data: null, error: {...} }`. De `withRetry()`-helper uit v2.4.9
  checkte dit `.error`-veld nergens, ving alleen echte JS-exceptions
  (netwerkfouten) op. Een mislukte insert werd dus stil als "succesvol"
  behandeld: geen retry, geen log, geen enkele indicatie — precies wat het
  onderzoek deze sessie liet zien (4 van 4 bibliotheek-trainingen misten
  hun coach_call_item, zonder een enkele foutmelding in Vercel logs).
  Fix: `withRetry()` checkt nu expliciet `result.error` en gooit zelf een
  `Error` met de volledige Postgres-foutdetails (code/message/details/hint).
  Dit maakt retry en logging voor het eerst daadwerkelijk functioneel voor
  deze Supabase-call-patronen.
  **Nog open:** de exacte onderliggende oorzaak (waarom de insert faalt —
  RLS, key-configuratie, of iets anders) is nog niet bevestigd. RLS-policies
  op `training_results`, `coach_calls` en `exercise_records` bleken bij
  onderzoek vergelijkbaar met die van `coach_call_items` (allemaal
  `auth.uid() = user_id`), wat de eenvoudige "verkeerde key"-hypothese
  weerlegt aangezien `training_results` wél altijd slaagt. Met deze fix
  live wordt de eerstvolgende mislukking eindelijk met exacte Postgres-
  foutcode gelogd — dat is de volgende stap om de echte oorzaak te vinden.

## v2.4.10 — Build-fix: TypeScript-fout in withRetry-helper (v2.4.9)
- `src/app/api/training/complete/route.ts` — de `withRetry()`-helper uit
  v2.4.9 gaf een Vercel build-fout: `Property 'data' does not exist on
  type 'unknown'`. Oorzaak: de signatuur `fn: () => Promise<T>` liet
  TypeScript het generic type `T` niet correct afleiden, omdat Supabase's
  query builders een `PromiseLike` (thenable) zijn, geen echte `Promise`-
  instantie — daardoor viel `T` terug op `unknown`.
  Fix: signatuur aangepast naar `F extends () => PromiseLike<unknown>` met
  `Promise<Awaited<ReturnType<F>>>` als retourtype. Lokaal geverifieerd met
  `tsc --strict` tegen een gesimuleerde thenable query builder — compileert
  zonder fouten. Functioneel identiek gedrag aan v2.4.9, alleen de types
  gecorrigeerd.

## v2.4.9 — Retry-logica Stap 3 + nieuwe debug-check "Coach Call Integriteit"
- `src/app/api/training/complete/route.ts` — Stap 3 (Coach Call aanmaken/
  heropenen) krijgt nu een retry: bij falen wordt na 400ms één keer
  opnieuw geprobeerd, via een kleine `withRetry()`-helper. Vangt
  kortstondige Supabase pooler-timeouts op (zie v2.4.8 root cause —
  "Warp server error: Thread killed by timeout manager" in Postgres Logs).
  Een structureel probleem faalt ook na de retry en wordt gelogd zoals
  voorheen; dit lost dus specifiek het "eenmalige hik"-scenario op, niet
  een aanhoudende infrastructuurstoring.
- `src/app/debug/page.tsx` — nieuwe diagnostiek-sectie "Coach Call
  Integriteit (laatste 24u)". Vergelijkt alle `training_results` met
  `training_source: 'library'` van de afgelopen 24 uur tegen
  `coach_call_items`, en meldt expliciet welke trainingen geen
  bijbehorend Coach Call-item hebben — dat is precies het probleem dat
  leidde tot deze toevoeging (een training werd opgeslagen, maar het
  Coach Call-item niet, door een tijdelijke Supabase-storing). Voorheen
  was dit alleen op te sporen via Vercel function traces + Supabase
  Postgres Logs (zie sessie juli 2026, coach_call_id 85e5b7d6...). Nu
  zichtbaar met één druk op "Start diagnostiek" in de app zelf, conform
  Kernregel §15 (fouten moeten zichtbaar zijn zonder externe tools).

## v2.4.8 — Fix: bibliotheek-Coach Call onzichtbaar na eerdere afgeronde call
- `src/app/api/training/complete/route.ts` — Stap 3 heropent nu een bestaande
  `coach_call` als die al `completed`/`expired` was, vóórdat het nieuwe item
  wordt toegevoegd. Zelfde root cause en fix als v2.4.3 (`coach-calls/route.ts`),
  hier ontbrak de heropen-logica nog in de bibliotheek-tak.
  Bevestigd via test + Vercel function trace: de POST naar `/api/training/complete`
  gaf 200, `coach_call_items` werd wel degelijk aangemaakt (zichtbaar in de
  external API calls: GET coach_calls → POST coach_call_items), maar de
  bijbehorende `coach_calls`-rij bleef op status `completed` staan van een
  eerder die dag afgeronde evaluatie. `GET /api/coach-calls` filtert op
  `pending`/`partial`, dus de banner op Home verscheen niet — ondanks dat de
  data correct was opgeslagen.
  Reproductiestap die dit aan het licht bracht: Coach Call afronden (bv. via
  Strava), daarna dezelfde dag een training uit de Trainingsbibliotheek
  doorlopen en evalueren — geen nieuwe Coach Call zichtbaar op Home.
  **Vervolgonderzoek (zelfde sessie):** een tweede test, ná deze fix, liet
  alsnog geen Coach Call zien. Onderzoek via Vercel function trace + Supabase
  Postgres Logs bracht de échte oorzaak van dié herhaling aan het licht: een
  kortstondige Supabase-pooler-timeout ("Warp server error: Thread killed by
  timeout manager") liet de `coach_call_items`-insert stil mislukken, terwijl
  de hoofdroute alsnog 200 teruggaf. Dit is geen logicafout in deze fix, maar
  een infrastructuur-timing-probleem — opgelost in v2.4.9 met retry-logica.

## v2.4.7 — Opruiming: dubbele oefening-databron verwijderd

**Wat er weg is:**
- `src/app/oefening/[id]/page.tsx` — verwijderd
- `src/lib/exercises.ts` — verwijderd

**Waarom dit bestond en waarom het weg kon:**
Naast de acht bibliotheekbestanden (`kettlebell-exercises.ts`, `bodyweight-exercises.ts`, etc. — samen 390 oefeningen, bron van waarheid volgens `docs/architecture.md` §2) bestond er een tweede, kleinere, op zichzelf staande oefeningenlijst in `src/lib/exercises.ts` met slechts 5 hardcoded oefeningen (Two Hand Swing, Goblet Squat, Kettlebell Clean, Kettlebell Press, Farmer Carry). Deze gebruikte een ander ID-formaat (`two-hand-swing` i.p.v. `kb-swing`) en een ander veld voor de illustratie (`afbeelding`, volledig pad, i.p.v. `illustratie`, alleen bestandsnaam).

Dit werd gerenderd door `src/app/oefening/[id]/page.tsx`, een apart UitlegScherm dat losstond van het eigenlijke Archief-systeem (`src/app/archief/oefening/[id]/page.tsx`), dat wél uit de acht echte bibliotheken put via `vindOefening()`.

**Onderzoek (deze sessie) — is dit ooit gebruikt?**
Voordat verwijderd werd, is expliciet gecontroleerd of er ergens in de app naar `/oefening/[id]` gelinkt wordt:
- `src/app/archief/page.tsx` — linkt naar `/archief/oefening/${id}` (niet naar `/oefening/`)
- `src/app/training/page.tsx` — alle routes gaan naar `/training/session/[module]` of `/training/recovery/...`
- `src/components/layout/index.tsx` (bottom nav) — alleen `/home`, `/training`, `/progressie`, `/chat`, `/settings`
- `src/app/api/training/today/route.ts` — genereert alleen oefening-**namen** in `segments`, nooit een ID-link naar `/oefening/`
- `src/store/index.ts`, `src/types/index.ts` — geen state of type die naar `exercises.ts` of `/oefening/[id]` verwijst

Conclusie: geen enkele plek in de app linkte naar deze route. Het was dode code, vermoedelijk een eerdere, kleinere implementatie van vóór het Archief-systeem (v2.4.0) die nooit is opgeruimd.

**Impact van de verwijdering:**
- Geen — er was geen actieve link naar deze route, dus er is niets in de UI dat nu een 404 geeft.
- Lost de architectuur-inconsistentie volledig op die eerder alleen was gedocumenteerd (zie v2.4.5-notitie in README, sectie "Bekende architectuur-inconsistentie" — die sectie is nu verwijderd omdat het probleem is opgelost, niet langer alleen gemeld).
- `public/exercises/` blijft ongewijzigd — alle illustraties (legacy PNG én nieuwe WebP) blijven exact zoals ze waren, gekoppeld via de acht bibliotheekbestanden.

**Wat een volgende sessie moet weten:**
Er is nu nog maar **één** manier waarop een gebruiker een losse oefening met uitleg/illustratie te zien krijgt: via het Archief (`/archief` → `/archief/oefening/[id]`), dat leest uit de acht bibliotheekbestanden in `src/lib/`. Er bestaat geen aparte of alternatieve oefeningenlijst meer. Als er ooit weer een `Oefening`-achtig type of `exercises.ts`-achtig bestand opduikt, is dat een nieuwe toevoeging, geen herstel van iets bestaands — behandel dat met dezelfde argwaan (Kernregel: geen dubbele modules) als deze opruiming zelf.

## v2.4.6 — Coach Call: OR-drempel Strava + altijd triggeren bij bibliotheek
- `src/app/api/coach-calls/route.ts` — Strava-kwalificatie gewijzigd van
  AND naar OR: een activiteit kwalificeert nu als afstand ÓF duur voldoet,
  niet beide tegelijk. `MIN_DURATION_MIN` verlaagd van 45 naar 30 minuten.
  Afstandsdrempels ongewijzigd (Hardlopen 5km, Fietsen 20km, Roeien 5km).
  Reden: in herstelfases is afstand soms niet haalbaar maar duur wel een
  reëel belastingssignaal — dat moet de coach kunnen zien.
- `src/app/api/training/complete/route.ts` — Coach Call wordt nu ALTIJD
  aangemaakt bij `training_source: 'library'` (Archief + Trainingsbibliotheek),
  ongeacht welk coach-advies die dag gold. Voorheen alleen bij advies
  'herstel' of 'rust' — dat miste gevallen zonder advies of met advies
  'trainen'. De evaluatie zelf zat al in de sessie (EvaluatieLayer); dit
  triggert nu consistent de melding aan de coach dat er buiten zijn advies
  om getraind is, voor de herstelinschatting van de volgende dag.
- `src/app/settings/hoe-werkt-het/page.tsx` — sectie "Coach Call" herschreven:
  legt nu het onderscheid uit tussen Strava (OR-drempel, enige bron van
  evaluatiedata) en Archief/Trainingsbibliotheek (altijd triggeren, evaluatie
  zit al in de sessie zelf). Trainer AI-sectie kreeg een verwijzing naar
  dezelfde Coach Call-trigger voor Trainingsbibliotheek.
  Noot: deze pagina toont onderaan "CoachOS v1.8.6" — een apart, niet met
  de hoofdversie gesynchroniseerd versienummer. Niet gewijzigd, want de
  juiste waarde is niet vastgesteld (geen aanname gemaakt).

## v2.4.5 — Illustratie-koppeling 12 kettlebell-oefeningen + workflow-herziening
- `src/lib/kettlebell-exercises.ts` — `illustratie`-veld toegevoegd aan 12
  entries: kb-sumo-deadlift, kb-single-arm-deadlift, kb-romanian-deadlift,
  kb-staggered-deadlift, kb-russian-swing, kb-american-swing,
  kb-one-arm-swing, kb-hand-to-hand-swing, kb-double-swing,
  kb-alternating-swing, kb-front-squat, kb-double-front-squat.
  Bestanden waren al als PNG geüpload naar `public/exercises/` in Working
  Copy; deze wijziging koppelt ze aan de bibliotheek-entries.
  Totaal nu 18/102 kettlebell-oefeningen met live illustratie.
- Workflow-besluit: Dropbox als centraal archief overwogen en weer
  afgeschaft — GitHub zelf is al voldoende archief/backup. WebP als
  standaardformaat blijft staan, maar alleen vanaf illustratie #16 (Box
  Squat) — de 18 hierboven blijven PNG (geen herwerk van reeds voltooide
  illustraties). Zie README sectie "Illustratie Workflow" voor details.

## v2.4.4 — Fix: "Genereer advies" hangt bij trage/onbereikbare Open-Meteo
- Nieuw: `src/lib/fetch-with-timeout.ts` — gedeelde helper die `fetch` wrapt
  met een `AbortController`-timeout. Voorkomt dat een trage externe API een
  serverless function laat vastlopen tot de platform-timeout (die als
  onafgevangen 500 naar buiten komt — een `.catch()` in de eigen code helpt
  dan niet, want de hele function wordt door het platform afgebroken).
- `src/app/api/weather/route.ts` — beide externe fetches (`ipapi.co` en
  `api.open-meteo.com`) krijgen nu een timeout (3s / 4s).
- `src/app/api/coach/route.ts` — de interne fetch naar `/api/weather` binnen
  de `Promise.all` krijgt een timeout (3s) i.p.v. onbeperkt wachten.
  Root cause: Vercel logs toonden `ConnectTimeoutError` naar
  `api.open-meteo.com:443` (10s). Doordat deze fetch zonder timeout in een
  `Promise.all` met 16 andere calls zat, liep de hele `/api/coach` POST vast
  tot de Vercel function-timeout — zichtbaar als "spint, maar geeft niets"
  op de "Genereer advies"-knop, en als POST 500 / GET 500 in de logs.
  `useCoach.ts` toonde deze fout niet aan de gebruiker (silent catch) — dat
  blijft een bekend aandachtspunt, zie README sectie Troubleshooting.

## v2.4.3 — Fix: Strava Coach Call niet zichtbaar na voltooide call
- `src/app/api/coach-calls/route.ts` — POST heropent een bestaande `coach_call`
  (status `completed` of `expired`) wanneer er nieuwe kwalificerende Strava-
  activiteiten voor diezelfde datum bijkomen. Voorheen werden nieuwe
  `coach_call_items` wel toegevoegd aan de bestaande call, maar bleef de
  `coach_calls.status` op `completed`/`expired` staan — waardoor de GET-route
  (die filtert op `status in (pending, partial)`) de call nooit meer teruggaf
  en de banner op de home-pagina niet verscheen.
  Root cause: als een gebruiker die dag al één Coach Call had afgerond en
  daarna een nieuwe kwalificerende activiteit synchroniseerde (bv. een
  Strava-fietsrit), werd die activiteit stil toegevoegd aan een call die al
  als voltooid gemarkeerd stond.
  Fix: bij het toevoegen van nieuwe items aan een bestaande call wordt nu ook
  gecontroleerd of die call `completed`/`expired` is — zo ja, dan wordt de
  status teruggezet naar `pending` en `completed_at` naar `null`.
  Geen wijziging aan drempelwaarden, database-schema of overige flows.

## v2.4.2 — Timer + Countdown Fix Archief
- `src/app/archief/oefening/[id]/page.tsx` — 5 seconden countdown toegevoegd
  vóór elke set (cirkel-voortgang, skip-knop). Reps omgezet naar tijdseenheid
  (3 sec/rep) zodat altijd een aftellende timer zichtbaar is, ook bij
  rep-gebaseerde oefeningen zoals Kettlebell Swing.
  Consistent met sessie-engine, mobility en relaxation pagina's.

## v2.4.1 — Archief Standalone Flow
- Nieuw: `src/app/archief/oefening/[id]/page.tsx`
  Instelpaneel: sets/reps/duur/rust instelbaar, kettlebell gewicht
  keuzemenu (14/16/20kg, uitbreidbaar tot 32kg in stappen van 4).
  Toont vorige sessie uit exercise_records als referentie.
  Geen Trainer AI call — eigen mini workout-engine voor 1 oefening.
  training_source: library triggert bestaande Coach Call logica.

## v2.4.0 — Exercise Illustraties + Archief
- `illustratie` veld toegevoegd aan BibliotheekOefening interfaces
- Kettlebell Swing eerste oefening met mannequin-stijl illustratie
  (public/exercises/kettlebell-swing.png), GPT-gegenereerd
- UitlegScherm toont illustratie boven Doelwaarden als beschikbaar
- Nieuw: `/archief` pagina — alle 354 oefeningen doorbladerbaar per
  categorie, los van coach advies. Zoekfunctie.

## v2.3.6 — Weerbericht
- `src/app/api/weather/route.ts` — nieuw. IP → locatie → Open-Meteo.
  Uurlijkse data voor ochtend/middag/avond regen. Geen API key.
- `src/app/home/page.tsx` — weerbericht onder de datum (emoji, stad, temp, dagdelen)
- `src/app/api/coach/route.ts` — weercontext toegevoegd aan dagadvies

## v2.3.5 — Coach Rapport op aanvraag (Fase 3B)
- `src/app/api/progress-analysis/route.ts` — nieuw. 60 dagen data → Claude Sonnet
  → kracht/conditie/herstel/compliance/risicos/focus/samenvatting.
  Cache: max 1 analyse per 24 uur in `progress_analyses` tabel.
- `src/app/progressie/page.tsx` — "Analyseer mijn ontwikkeling" knop.
  Toont 6 secties met persoonlijk maandrapport. Opnieuw analyseren knop.

## v2.3.4 — Coach Trendanalyse (Fase 3A)
- `src/app/api/coach/route.ts` — progressie trendanalyse toegevoegd.
  Eerste vs laatste uitvoering per oefening, % verandering, trend richting.
  Gemiddelde RPE laatste 7 dagen. Belastingtrend t.o.v. vorige week.
  Coach ziet: "Goblet Squat 16kg → 20kg (+25%) ↑"

## v2.3.3 — Progressie Fase 2
- `src/app/progressie/page.tsx` — grafiek per oefening (tik op PR).
  Volume per week grafiek (8 weken). OefeningGeschiedenis berekend uit exercise_records.

## v2.3.2 — Persoonlijke Records
- `src/app/progressie/page.tsx` — PR sectie met module filter.
  Toont max gewicht/reps/duur per oefening. Sortering op meest uitgevoerd.

## v2.3.1 — Exercise Records
- Supabase tabel `exercise_records` aangemaakt (id, user_id, training_result_id,
  exercise_id, exercise_name, exercise_type, module, weight_kg, reps,
  duration_sec, distance_m, sets, rpe, performed_at)
- `src/app/api/training/complete/route.ts` — segments worden opgeslagen als exercise_records
- `src/app/training/session/[module]/page.tsx` — segments meegegeven bij opslaan

## v2.3.0 — Drill Libraries Running/Rowing/Cycling
- `src/lib/running-drills.ts` — 13 drills (recovery, endurance, tempo, interval, techniek)
- `src/lib/rowing-drills.ts` — 12 drills (recovery, endurance, interval, techniek)
- `src/lib/cycling-drills.ts` — 11 drills (recovery, endurance, tempo, interval, techniek)
- `src/app/api/training/today/route.ts` — runningContext, rowingContext, cyclingContext
- Trainer Rule volledig van kracht voor ALLE modules

## v2.2.2 — Scroll en Navigatie Fixes
- Alle recovery pagina's: terug → `/training?herstel=1&terug=[categorie]`
- `training/page.tsx` — herstelbibliotheek opent op juiste categorie bij terugkeren
- Categorieën standaard ingeklapt, scroll naar categorie bij openen
- Suspense wrapper voor useSearchParams (build fix)

## v2.2.1 — Relaxation Pagina + Categorische Herstelbibliotheek
- `src/app/training/recovery/relaxation/page.tsx` — nieuw. 6 schemas:
  Progressieve Spierontspanning, Body Scan, Visualisatie Herstel,
  Savasana, Cooling Down Protocol, Diafragma Ademhaling
- `src/app/training/page.tsx` — herstelbibliotheek inklapbaar per categorie:
  Ademhaling (5), Mobiliteit (11), Ontspanning (5), Wandelen (2)

## v2.2.0 — Recovery Bibliotheek
- `src/lib/recovery-exercises.ts` — 12 modules:
  Ademhaling (5), Wandelen (2), Ontspanning (4), Visualisatie (1)
- `filterRecovery()` en `formateerRecoveryVoorPrompt()` toegevoegd aan route
- Herstelbibliotheek uitgebreid met 7 nieuwe modules

## v2.1.2 — Alle Mobility Schemas in Herstelbibliotheek
- `src/app/training/page.tsx` — alle 11 mobility schemas zichtbaar in herstelbibliotheek
- Trainer Rule gedocumenteerd in docs/architecture.md

## v2.1.1 — Mobility Filter in Route
- `src/app/api/training/today/route.ts` — filterMobility() geïmporteerd
- Blessure-gebaseerde lichaamsdeel focus
- mobilityContext toegevoegd aan bibliotheekContext

## v2.1.0 — Mobility Bibliotheek
- `src/lib/mobility-exercises.ts` — 20 oefeningen
- Types: MobilityDoel, MobilityNiveau, MobilityLichaamsdeel, MobilityCategorie
- filterMobility() en formateerMobilityVoorPrompt()

## v2.0.4 — Mobility Bug Fix
- `src/app/training/recovery/mobility/page.tsx` — 11 schemas toegevoegd
- Fallback van neck_shoulders → full_body
- Route prompt: AI mag alleen bekende mobility subtypes gebruiken

## v2.0.3 en eerder — Zie eerdere sessies
- Coach Call Stap 1+2+3
- Bodyweight bibliotheek (120 oefeningen)
- Strength bibliotheek (100 oefeningen)
- Kettlebell bibliotheek (102 oefeningen)
- Uitlegpagina bibliotheek-koppeling
- Naam matching met aliassen
- Strava integratie
- Garmin integratie
- Life-events module
