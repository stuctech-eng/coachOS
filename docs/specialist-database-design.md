# CoachOS Specialist Coach Platform — Database-ontwerp (Impactanalyse)

**Status: ONTWERPFASE — NOG GEEN SQL**

Dit document analyseert welke bestaande CoachOS-tabellen de
specialistlaag (zie `docs/specialist-coaches.md`) al kunnen bedienen,
en welke nieuwe tabellen daadwerkelijk noodzakelijk zijn. Doel: geen
dubbele opslag van trainingsdata, nieuwe tabellen alleen waar echt nodig.

**Belangrijke kanttekening vooraf, transparant:** de analyse hieronder is
gebaseerd op tabelstructuren die daadwerkelijk in code zijn gezien tijdens
deze ontwikkelsessie (via `SELECT`/`INSERT`-aanroepen in bestaande
routes). Voor `progress_analyses` is dat niet het geval — die tabel is
niet voorbijgekomen in enige route die deze sessie is geïnspecteerd. Deze
wordt daarom **niet** aangenomen, maar apart gemarkeerd als "te
verifiëren" (zie §1.8).

---

## 1. Huidige situatie — bestaande tabellen en hun daadwerkelijke velden

*(Gebaseerd op geziene `SELECT`/`INSERT`-aanroepen in bestaande routes,
niet op aannames.)*

### 1.1 `training_results`
Bron: `api/training/complete/route.ts`

Velden gezien: `user_id`, `session_id`, `date`, `training_type`,
`training_source`, `completed`, `actual_duration`, `rating`, `notes`,
`perceived_effort`, `fatigue_after`, `soreness`, `completed_at`, plus
sport-specifieke ratingvelden (`rowing_technique_rating`,
`rowing_pacing_rating`, `rowing_fatigue_rating`,
`running_technique_rating`, `running_pacing_rating`,
`running_fatigue_rating`, `running_rpe_rating`,
`cycling_technique_rating`, `cycling_pacing_rating`,
`cycling_fatigue_rating`, `cycling_rpe_rating`).

**Observatie:** deze tabel heeft al **per-sport ratingvelden voor
rowing/running/cycling** — precies de disciplines die als eerste
specialisten genoemd worden in `specialist-coaches.md`. Dit is sterk
herbruikbaar.

### 1.2 `exercise_records`
Bron: `api/training/complete/route.ts`, uitgebreid in v2.4.51-53

Velden gezien: `user_id`, `training_result_id`, `exercise_id`,
`exercise_name`, `exercise_type`, `module`, `weight_kg`,
`advised_weight_kg`, `tempo`, `advised_tempo`, `reps`, `duration_sec`,
`distance_m`, `sets`, `rpe`, `performed_at`.

**Observatie:** bevat al advies-vs-gebruikt-vergelijking (relevant
patroon voor specialist-adviezen in het algemeen, niet alleen kettlebell-
gewicht/tempo).

### 1.3 `activity_sessions`
Bron: Strava-processor, Garmin TCX/screenshot-routes, `api/coach/route.ts`

Velden gezien: `id`, `user_id`, `activity_id` (koppeling naar
`activities`), `date`, `duration`, `metrics` (JSONB — bevat o.a.
`distance`, `avg_hr`, `max_hr`, `avg_speed`, `max_speed`, `avg_cadence`,
`max_cadence`, `avg_watts`, `max_watts`, `elevation_gain`,
`elevation_loss`, `route`), `source`, `notes`.

**Observatie:** dit is de belangrijkste bevinding voor de specialistlaag.
**Sportspecifieke performancedata (vermogen, cadans, hartslagzones,
snelheid, hoogtemeters, GPS-route) staat hier al**, via het flexibele
`metrics`-JSONB-veld. Een Cycling Coach die FTP-trends of
vermogensontwikkeling wil analyseren, kan dat **direct uit deze tabel
lezen** — geen nieuwe opslag nodig voor ruwe performancedata.

### 1.4 `coach_calls` / `coach_call_items`
Bron: meerdere routes (`training/complete`, `garmin-activity-tcx`, etc.)

Velden gezien: `coach_calls`: `id`, `user_id`, `date`, `status`.
`coach_call_items`: `coach_call_id`, `activity_session_id` **of**
`training_result_id`, `sport_type`, `duration_min`, `rating`, `mood`,
`notes`, `status`.

**Observatie:** al sport-gelabeld (`sport_type`) en gekoppeld aan zowel
activiteiten als trainingsresultaten. Bruikbaar als bron voor "hoe vaak
en hoe zwaar heeft de gebruiker sport X recent gedaan" — exact de data
die de Activatiemodel-drempel (§4 in `specialist-coaches.md`, 3-in-30-
dagen) nodig heeft.

### 1.5 `coach_recommendations`
Bron: `api/coach/route.ts`, `api/training/today/route.ts`

Velden gezien: `user_id`, `date`, `type` (bijv. `'coach'`,
`'training_today'`, `library_${module}`), `recommendation`, `reasoning`,
`actie_type`, `advice_bullets`, `trainer_instructies`,
`recovery_status`, `energy_level`, `training_instruction` (JSONB).

**Observatie:** het `type`-veld is al een flexibel onderscheidingsveld.
Een specialist-advies zou hier in theorie ook als eigen `type`
(bijv. `specialist_cycling`) kunnen landen — te overwegen bij de
Orchestrator-implementatie (buiten scope van dit document).

### 1.6 `profiles`
Bron: `api/training/today/route.ts`, `api/coach/route.ts`

Velden gezien: `user_id`, `first_name`, `experience_level`,
`available_time`, en per-equipment-beschikbaarheid (`kettlebell_available`,
`concept2_available`, `cycling_available`, `running_available`,
`dumbbell_available`, `barbell_available`, `ab_wheel_available`,
`bodyweight_available`).

**Observatie:** één rij per gebruiker — niet geschikt voor "meerdere
specialisten, elk met eigen status" zonder de tabel onnatuurlijk breed te
maken (zou per specialist een setje kolommen vergen). Dit pleit juist
vóór een aparte `specialist_profiles`-tabel (zie §3) in plaats van
uitbreiding van `profiles` zelf — consistent met hoe `injuries` en
`user_goals` (zie hieronder) ook al apart staan i.p.v. in `profiles`
zelf.

### 1.7 `injuries`, `user_goals`, `activities`/`activity_templates`
Bronnen: eerdere Archief-sectie, `api/coach/route.ts`,
Garmin-activiteit-import.

**Observatie:** bevestigt het bestaande patroon in dit schema:
één-rij-per-item-per-gebruiker-tabellen (`injuries`: één rij per
blessure; `user_goals`: één rij per doel) zijn de gangbare aanpak voor
dit soort "meerdere items per gebruiker"-data, niet brede kolommen in
`profiles`. Een `specialist_profiles`-tabel (één rij per
specialist-per-gebruiker) past bij dit bestaande patroon.

### 1.8 `progress_analyses` — bevestigd, structuur ontvangen

**Kolommen (bevestigd door gebruiker via `information_schema.columns`):**

| Kolom | Type |
|---|---|
| `id` | uuid |
| `user_id` | uuid |
| `period_days` | integer |
| `analysis` | jsonb |
| `generated_at` | timestamp with time zone |

**Observatie:** dit is een generieke "berekende analyse opslaan"-tabel —
één rij per analyse, met de periode (`period_days`, bijv. 7/30/90 dagen)
en de inhoud in een flexibel `analysis`-JSONB-veld. **Geen
`type`-of specialist-onderscheidend veld aanwezig.**

**Belangrijke implicatie voor de specialistlaag:** dit maakt een nóg
lichtere ingreep mogelijk dan een volledig nieuwe tabel. Als een
specialist-analyse (bijv. Cycling FTP-trend over 30 dagen) qua vorm past
bij wat deze tabel al doet (periodieke, JSONB-opgeslagen analyse), zou
**één extra nullable kolom** (bijv. `specialist_type`, `NULL` = algemene
analyse zoals nu, `'cycling'` = specialist-analyse) kunnen volstaan —
in plaats van een nieuwe tabel ernaast.

**Nog niet bevestigd, dus nog geen definitieve aanbeveling:** welke
route of achtergrondproces deze tabel op dit moment vult, en hoe de
huidige `analysis`-JSONB-inhoud eruitziet. Zonder dat te weten, kan ik
niet met zekerheid zeggen of specialist-analyses hier zomaar naast
kunnen bestaan zonder de bestaande (vermoedelijk algemene
Coach-rapport/trendanalyse-)logica te verstoren. **Verzoek:** kun je
delen welk bestand deze tabel schrijft, of een voorbeeld van de
`analysis`-JSONB-inhoud van één bestaande rij?

---

## 2. Onderscheid: bestaand vs. nieuw

### Bestaande data — geen nieuwe opslag nodig
| Databehoefte | Bestaande bron |
|---|---|
| Trainingshistorie (welke training, wanneer, hoe zwaar ervaren) | `training_results` |
| Losse oefeningen, gewicht/tempo, advies-vs-gebruikt | `exercise_records` |
| Ruwe sportprestatiedata (vermogen, cadans, snelheid, hoogtemeters, GPS) | `activity_sessions.metrics` |
| Herstel, HRV, slaap | `health_metrics` (gezien in `coach/route.ts`, niet in detail geanalyseerd hier — buiten scope specialistlaag) |
| Coachgesprekken/adviezen-geschiedenis | `coach_recommendations` |
| Patroonherkenning-brondata (frequentie per sport) | `coach_call_items.sport_type` + `activity_sessions` gecombineerd |

### Nieuwe specialistische data — waar het niet logisch past
| Databehoefte | Reden waarom bestaand schema niet volstaat |
|---|---|
| Welke specialist is actief voor welke gebruiker | Geen bestaande tabel met dit doel; `profiles` is één-rij-per-gebruiker, niet geschikt voor meerdere specialisten met status per stuk |
| Specialist-specifieke doelen (bijv. FTP-target) | `user_goals` bestaat al voor algemene doelen, maar heeft — voor zover gezien — geen sport-specifiek gestructureerd veld (bijv. een numeriek FTP-doel apart van vrije tekst). Te bevestigen of `user_goals` uitgebreid kan worden i.p.v. een nieuw veld in `specialist_profiles` (zie §3, open vraag) |
| Specialist-versiebeheer (welke versie, actief/development/disabled) | Dit is platformconfiguratie, geen gebruikersdata — hoort in code/config, niet in een gebruikerstabel (zie `specialist-coaches.md` §5) |

---

## 3. Voorgestelde tabellen

### 3.1 `specialist_profiles` — enige voorgestelde nieuwe tabel

**Waarom nodig:** geen bestaande tabel houdt bij welke specialisten voor
welke gebruiker actief zijn, sinds wanneer, en met welke
specialist-specifieke voorkeuren. Dit past bij het bestaande patroon van
aparte, "één-rij-per-item"-tabellen (§1.7), niet bij uitbreiding van
`profiles`.

**Voorgestelde velden** (namen indicatief, definitieve typen bij de
SQL-fase):
- `id` — primary key
- `user_id` — koppeling naar de gebruiker
- `specialist_type` — welke specialist (bijv. `'cycling'`)
- `active` — is deze specialist momenteel actief
- `activated_at` — wanneer geactiveerd
- `preferences` — specialist-specifieke voorkeuren (JSONB)

**Geen `goals`-veld** — specialist-doelen leven in de bestaande
`user_goals`-tabel (via een eigen `goal_type`-waarde), definitief
besloten in §3.2. Dit houdt `specialist_profiles` puur gericht op
identity/activatie, conform het onderscheid uit §4.5.

**Relatie:** `user_id` → bestaande gebruikerstabel (zelfde patroon als
`injuries.user_id`, `user_goals.user_id`).

### 3.2 `goals`-veld — definitief opgelost: hergebruik `user_goals`

**Bevestigd via `src/app/api/goals/route.ts` en `src/app/goals/page.tsx`:**

`user_goals` bevat al: `user_id`, `goal_type`, `title`, `priority`,
`status`, `target_value`, `target_date`, `current_value`. Het
`goal_type`-veld is een **vrij tekstveld**, nergens hard gecodeerd in een
vaste lijst toegestane waarden in de UI (alleen één plek die `'custom'`
als standaardwaarde meegeeft bij het aanmaken van een algemeen doel via
het bestaande formulier).

**Conclusie, in lijn met dezelfde zorgvuldigheid als bij
`progress_analyses` (§4.5), maar met een ander resultaat:**
- `user_goals`' `GET` haalt **alle** doelen van de gebruiker op, geen
  enkele/meest-recente-rij-aanname zoals bij `progress_analyses` — een
  specialist-doel ertussen breekt dus niets
- Geen vaste, getypeerde JSONB-vorm — gewoon losse kolommen, generiek
  genoeg voor zowel algemene als specialist-doelen
- Geen verborgen aannames in de UI over welke `goal_type`-waarden mogen
  voorkomen

**Definitieve keuze: Optie B (hergebruik `user_goals`).** Specialist-
doelen krijgen een eigen `goal_type`-waarde (bijv. `specialist_cycling`
of specifieker, exacte naamgeving bij de SQL-fase), geen nieuwe kolom,
geen nieuwe tabel.

**Gevolg voor `specialist_profiles` (§3.1):** het `goals`-veld
**vervalt** uit die tabel — doelen leven volledig in `user_goals`.
`specialist_profiles` blijft daarmee kleiner en puur gericht op
identity/activatie: `user_id`, `specialist_type`, `active`,
`activated_at`, `preferences`.

---

## 4. Relaties — overzicht

```
auth.users (bestaand)
    │
    ├── specialist_profiles (NIEUW)
    │     user_id, specialist_type, active, ...
    │
    ├── activity_sessions (bestaand, ongewijzigd)
    │     bron voor ruwe performancedata, gelezen door specialisten
    │
    ├── training_results (bestaand, ongewijzigd)
    │     bron voor evaluatiedata, gelezen door specialisten
    │
    ├── exercise_records (bestaand, ongewijzigd)
    │
    ├── coach_call_items (bestaand, ongewijzigd)
    │     bron voor patroonherkenning (frequentie per sport_type)
    │
    └── coach_recommendations (bestaand, ongewijzigd)
          mogelijk nieuw 'type' voor specialist-adviezen (nader te bepalen)
```

**Geen nieuwe foreign keys nodig richting bestaande trainingsdata** — de
specialistlaag **leest** `activity_sessions`/`training_results`/
`exercise_records` op basis van bestaande velden (`user_id`, `module`/
`training_type`/`sport_type`), zonder dat die tabellen zelf gewijzigd
hoeven te worden.

---

## 4.5 Conceptueel onderscheid: Identity/Activatie vs. Analyse

**Correctie op de eerdere, te snelle conclusie:** de ontdekking van
`progress_analyses` (§1.8) is waardevol, maar rechtvaardigt niet
automatisch dat specialist-data daar zomaar bij kan. Er zitten namelijk
**twee fundamenteel verschillende soorten data** achter de
specialistlaag, met een andere levensduur en aard:

### Laag 1 — Specialist Identity / Activatie
*Voorbeeld:* gebruiker heeft Cycling Coach geactiveerd sinds 12 juni,
doel "tijdrit verbeteren", specifieke voorkeuren.

**Aard:** gebruikers**configuratie**. Verandert **traag** — een
activatie blijft typisch maanden ongewijzigd staan, een doel wordt
misschien een paar keer per jaar bijgesteld.

### Laag 2 — Specialist Analyse
*Voorbeeld:* Cycling-analyse van de laatste 30 dagen — FTP-trend,
vermogensontwikkeling, trainingsbelasting, cadansanalyse.

**Aard:** berekende **output**. Verandert **regelmatig** — elke week (of
vaker) opnieuw gegenereerd, oude analyses zijn in feite historische
snapshots, geen "levende" staat.

**Deze twee mogen niet door elkaar lopen** — een tabel die primair voor
snel-veranderende, wegwerpbare analyse-output is bedoeld (zoals
`progress_analyses` lijkt te zijn, gezien `generated_at` en de
JSONB-vorm), is qua *aard* ongeschikt om ook langzaam-veranderende
identiteits-/configuratiedata in te bewaren, ook al zou het technisch
kunnen.

---

### Optie A — Alles in bestaande tabellen

Zowel activatie/identity als analyse proberen onder te brengen in
bestaande tabellen (bijv. activatie in `profiles` als JSONB-veld,
analyse in `progress_analyses` met `specialist_type`).

| | |
|---|---|
| **Voordelen** | Geen enkele nieuwe tabel; minimale migratie-oppervlakte |
| **Nadelen** | Vermengt configuratie (traag) met output (snel) in dezelfde tabel-filosofie; `profiles` is één-rij-per-gebruiker, ongeschikt voor meerdere specialisten per gebruiker (zie §1.6) zonder de tabel onnatuurlijk te verbreden |
| **Impact op bestaande architectuur** | Risico dat bestaande, algemene logica (Coach-rapport/trendanalyse in `progress_analyses`) per ongeluk geraakt wordt door specialist-specifieke query's die er niet los van staan |
| **Onderhoudbaarheid lange termijn** | Laag — twee conceptueel verschillende databehoeftes gedwongen in dezelfde structuur maakt toekomstige uitbreiding (bijv. Specialist Memory, §9 van `specialist-coaches.md`) lastiger te plaatsen |

### Optie B — `progress_analyses` uitbreiden + `specialist_profiles` toevoegen
*(De nu voorgestelde, waarschijnlijke richting)*

Analyse-laag hergebruikt `progress_analyses` (met een extra nullable
`specialist_type`-kolom: `NULL` = algemene Coach-analyse, `'cycling'` =
Cycling-analyse, etc.). Identity/activatie-laag krijgt een **eigen,
nieuwe** tabel `specialist_profiles`.

| | |
|---|---|
| **Voordelen** | Elk concept in een structuur die bij zijn aard past — snel-veranderende output in de al-bestaande analyse-tabel, traag-veranderende configuratie in een eigen, kleine tabel. Slechts 1 nieuwe tabel + 1 nieuwe kolom, geen bestaande kolommen gewijzigd |
| **Nadelen** | Vereist wel bevestiging (zie openstaande punten) hoe `progress_analyses` nu precies gevuld/gelezen wordt, om zeker te weten dat een extra kolom de bestaande algemene-analyse-logica niet verstoort |
| **Impact op bestaande architectuur** | Minimaal — 1 nullable kolom (backwards compatible, bestaande rijen krijgen gewoon `NULL`), 1 nieuwe losstaande tabel |
| **Onderhoudbaarheid lange termijn** | Hoog — sluit aan bij het bestaande patroon (§1.7: aparte tabellen voor "meerdere items per gebruiker" zoals `injuries`/`user_goals`), en houdt analyse/configuratie conceptueel gescheiden zoals hierboven beargumenteerd |

### Optie C — Volledig nieuwe specialistlaag

Zowel activatie/identity als analyse krijgen eigen, nieuwe tabellen
(`specialist_profiles` én bijv. `specialist_analyses`), losstaand van
`progress_analyses`.

| | |
|---|---|
| **Voordelen** | Volledige conceptuele scheiding, geen enkel risico op interferentie met bestaande `progress_analyses`-logica, meest "schone" oplossing |
| **Nadelen** | 2 nieuwe tabellen in plaats van 1 nieuwe + 1 kolom; enige mate van gestructureerde overlap met `progress_analyses` (beide zijn immers "periodieke JSONB-analyse, gegenereerd op tijdstip X") — mogelijk onnodige duplicatie van eenzelfde patroon |
| **Impact op bestaande architectuur** | Nul — raakt `progress_analyses` op geen enkele manier |
| **Onderhoudbaarheid lange termijn** | Gemiddeld — schoon, maar mogelijk twee bijna-identieke opslagpatronen naast elkaar (`progress_analyses` voor algemeen, `specialist_analyses` voor specialistisch) die later alsnog samengevoegd hadden kunnen worden |

### Definitieve keuze: Optie C

**Bevestigd via de daadwerkelijke inhoud van
`src/app/api/progress-analysis/route.ts`** (niet langer een aanname):

1. **De `analysis`-JSONB heeft een vaste, getypeerde vorm**
   (`ProgressAnalysis`-interface: `kracht`, `conditie`, `herstel`,
   `compliance`, `risicos`, `focus`, `samenvatting`, `generated_at`) —
   dit zijn **algemene coach-rapportvelden**, conceptueel iets anders dan
   wat een specialist-analyse (bijv. FTP-trend, vermogen, cadans) nodig
   heeft. Ze zouden niet natuurlijk in dezelfde velden passen.
2. **`GET` haalt altijd domweg de meest recente rij op**
   (`order by generated_at desc limit 1`), **zonder** filter op type. Een
   tussen-geplaatste specialist-analyse zou per ongeluk teruggegeven
   worden aan de algemene Progress-pagina, die de vaste
   `ProgressAnalysis`-velden verwacht — dat zou zichtbaar breken.
3. **De 24-uur-cache-check in `POST`** filtert ook niet op type — zou een
   specialist-analyse ten onrechte kunnen aanzien voor een recente
   algemene analyse en de generatie overslaan.
4. **`period_days` staat hardcoded op 60** in deze route — bevestigt dat
   deze tabel op dit moment feitelijk single-purpose is, geen generiek,
   flexibel analyse-opslagsysteem zoals de kolomnamen aanvankelijk deden
   vermoeden.

**Conclusie: Optie B is aantoonbaar risicovol**, niet slechts theoretisch.
Er zou méér nodig zijn dan één kolom (ook `GET` en de cache-check zouden
moeten worden aangepast) om het veilig te maken — op dat punt is een
volledig gescheiden tabel eenvoudiger én veiliger.

**Optie C is hiermee de definitieve keuze**, niet langer als
"conservatief alternatief," maar als de aantoonbaar juiste architectuur:
- `progress_analyses` blijft **volledig ongewijzigd**, geen enkel risico
  op interferentie met de bestaande algemene coach-rapportage
- Specialist-analyses krijgen een eigen, nieuwe tabel — voorlopige naam
  `specialist_analyses`, exacte vorm bij de SQL-fase



**Nul wijzigingen aan bestaande tabellen.** Deze analyse resulteert in:
- **1 nieuwe tabel** (`specialist_profiles`)
- **0 aanpassingen** aan `training_results`, `exercise_records`,
  `activity_sessions`, `coach_calls`, `coach_call_items`
- **Mogelijk** een nieuwe waarde in het bestaande `coach_recommendations.type`-
  veld (geen schema-wijziging, gewoon een nieuwe string-waarde binnen een
  al flexibel veld) — nader te bepalen bij de Orchestrator-implementatie

Dit bevestigt de verwachting waarmee dit document werd aangevraagd: het
bestaande CoachOS-fundament (`activity_sessions`, `exercise_records`,
`coach_calls`, `training_results`) is inderdaad grotendeels herbruikbaar.
De specialistlaag voegt vooral **interpretatie en activatiestatus** toe,
niet nieuwe opslag van sportdata zelf.

---

## Openstaande punten — alle drie opgelost

1. ~~`progress_analyses`~~ — **opgelost.** Structuur én gebruik bevestigd
   via `src/app/api/progress-analysis/route.ts`. Definitieve keuze:
   Optie C, `progress_analyses` blijft ongewijzigd, nieuwe
   `specialist_analyses`-tabel voor specialist-analyses (§4.5).
2. ~~`user_goals`~~ — **opgelost.** Structuur én gebruik bevestigd via
   `src/app/api/goals/route.ts` en `src/app/goals/page.tsx`. Definitieve
   keuze: hergebruik via nieuwe `goal_type`-waarden, geen nieuwe kolom
   (§3.2).
3. ~~`goals`-veld in `specialist_profiles`~~ — **opgelost**, gevolg van
   punt 2: het veld vervalt, doelen leven volledig in `user_goals`
   (§3.1/3.2).

**Alle drie fundamentele ontwerpvragen zijn nu beantwoord, elk met
bewijs uit de daadwerkelijke code, niet op aanname.** Klaar voor de
SQL-fase.
