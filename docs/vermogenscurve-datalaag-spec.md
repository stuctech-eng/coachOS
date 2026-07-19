# Vermogenscurve-datalaag — Compacte Specificatie

**Status: TE TOETSEN — ontwerp, nog geen code**
**Fase 3-punt van `docs/cycling-specialist-roadmap-v1.md`**

---

## Twee bevindingen die dit kleiner maken dan aangenomen

**1. Garmin (TCX-import): de data stroomt al binnen, wordt alleen weggegooid.**
`src/lib/tcx-parser.ts` verzamelt tijdens het verwerken van elk TCX-
bestand al een chronologische `wattsValues`-array (seconde-voor-seconde
vermogen per trackpoint) — maar berekent daar alleen het gemiddelde en
maximum uit, en gooit de array daarna weg. **Geen nieuwe import-
uitbreiding nodig voor Garmin** — alleen een aanvullende berekening op
data die al beschikbaar is.

**2. Strava: de bestaande OAuth-scope is al voldoende.**
`src/app/api/strava/auth/route.ts` vraagt al `activity:read_all` aan —
dat is exact de scope die Strava's streams-API (`/activities/{id}/
streams`) vereist. **Geen nieuwe autorisatie nodig** bij gebruikers die
al gekoppeld zijn — wel een nieuwe API-aanroep die nu nog niet gebeurt.

**Conclusie:** dit is dus niet primair een integratie-uitbreiding, maar
vooral een **rekenkundige laag** die op beide bestaande databronnen kan
worden toegepast.

---

## 1. Gedeelde berekening — vermogenscurve uit een tijdreeks

**Input:** een chronologische array van vermogenswaarden + de sampling-
interval (voor Garmin doorgaans 1 seconde, te verifiëren; voor Strava
streams expliciet opgegeven door de API zelf).

**Output:** het beste gemiddelde vermogen over een vaste reeks
duren, via een schuivend venster (sliding window):
```
5s, 10s, 15s, 30s, 1min, 3min, 5min, 10min, 20min, 30min, 45min, 60min
```
**Bijgewerkt in v2.4.122** — oorspronkelijk 9 punten (zonder 10s/3min/
45min), uitgebreid naar de volledige klassieke power-curve-set van 12
punten op verzoek. GEEN terugwerkende kracht: activiteiten geïmporteerd
vóór v2.4.122 hebben deze drie nieuwe duren niet (de ruwe seconde-data
is na het parsen niet bewaard, dus niet met terugwerkende kracht
herberekenbaar).

Voor ritten korter dan een bepaalde duur wordt die duur simpelweg
overgeslagen (geen "beste 60 minuten" voor een rit van 40 minuten).

**Volledig deterministisch — geen AI.** Dit is precies het soort
berekening waar "AI rekent nooit" voor bedoeld is.

---

## 2. Opslag — smalle, queryable tabel

```sql
create table cycling_power_curve (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activity_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  duration_sec integer not null,  -- 5, 10, 15, 30, 60, 180, 300, 600, 1200, 1800, 2700, 3600
  watts integer not null,
  created_at timestamptz not null default now(),
  unique(activity_id, duration_sec)
);
```

**Bewust een smalle (activity × duur × watt) tabel, geen brede tabel
met een kolom per duur** — dit maakt "wat is mijn all-time beste 5
minuten, over alle ritten heen" een simpele query (`max(watts) where
duration_sec = 300`), wat precies is wat records en het toekomstige
Critical Power-model nodig hebben.

**Geen ruwe tijdreeks opgeslagen** — alleen de berekende beste-
inspanningen per duur. Voorkomt een zware, snel groeiende tabel; de
ruwe data is (voor Garmin) sowieso al weer weg na het parsen, en (voor
Strava) niet de moeite van dupliceren waard als we alleen de
samengevatte uitkomst nodig hebben.

---

## 3. Integratiepunten

**Garmin (`tcx-parser.ts`):** de berekening toevoegen direct ná het
verzamelen van `wattsValues`, vóór de return — geen aparte stap nodig,
de data is er al.

**Strava (nieuw):** een nieuwe aanroep naar `/activities/{id}/streams?
keys=watts,time&key_by_type=true`, toegevoegd aan de bestaande sync-
flow (`strava-activity-processor.ts`) — ná het ophalen van de
activiteit zelf, vóór het opslaan.

**Belangrijk, expliciet:** dit raakt **bestaande, actieve import-code**
(zowel Garmin- als Strava-sync) — vergt dezelfde zorgvuldigheid als
elke andere wijziging aan bestaande productiecode deze sessie.

---

## 4. Wat dit ontgrendelt

- **Vermogenscurve-grafiek** (Fase 2d-gat, nu dichtbaar)
- **Duur-specifieke records** ("beste 5 minuten ooit") — Fase 2e-gat,
  nu dichtbaar
- **Critical Power-model** (later, aparte stap: CP + W′ passen op de
  all-time-beste-punten via een 2-parameter-curve — vergt genoeg
  datapunten over meerdere duren om betrouwbaar te zijn, dus pas
  zinvol ná een periode van data verzamelen)

---

## 5. Wat dit NIET oplost, bewust

- **Bestaande activiteiten** (al gesynchroniseerd vóór deze wijziging)
  krijgen **geen terugwerkende vermogenscurve** — Garmin-TCX-bestanden
  worden niet opnieuw ingelezen (zouden opnieuw geüpload moeten
  worden), Strava-historie zou een aparte backfill-stap vergen (niet
  in deze eerste versie, mogelijk later)
- Critical Power-model zelf (zie punt 4, apart vervolgpunt)

---

## Bouwvolgorde, voorgesteld

1. **Gedeelde berekeningsfunctie** (`berekenVermogenscurve()`) —
   losstaand, testbaar zonder de import-code aan te raken
2. **SQL:** `cycling_power_curve`-tabel
3. **Garmin-integratie** — laagste risico, data is er al, kleinste
   wijziging aan bestaande code
4. **Strava-integratie** — nieuwe API-aanroep, iets groter, apart te
   testen
5. **UI:** vermogenscurve-grafiek + duur-specifieke records, als
   uitbreiding van het al-bestaande Grafieken/Records-scherm (Fase 2d/2e)

**Elke stap apart opgeleverd en getest**, zoals bij elke andere fase
deze sessie.
