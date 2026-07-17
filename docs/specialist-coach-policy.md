# CoachOS Specialist Coach Platform — Coach Policy & Specialist Summary

**Status: ONTWERPFASE — NOG GEEN CODE**

Vervolg op `docs/specialist-api.md` (Fase 4) en `docs/specialist-decision-engine.md`.
Dit document legt een concept vast dat expliciet **geen** onderdeel is
van de Decision Engine, maar er wel nauw mee samenhangt — vandaar een
eigen document in plaats van een sectie ergens anders in geplakt.

---

## Het onderscheid, meteen scherp

**Coach Policy / Specialist Summary is géén Decision Engine.**

- **Decision Engine** (`specialist-decision-engine.md`) lost conflicten
  op **tussen meerdere specialisten** — relevant zodra er 2+ tegelijk
  actief zijn.
- **Coach Policy / Specialist Summary** is het contract **tussen de
  Master Coach en één specialist** — geldt al bij precies één actieve
  specialist, en blijft ongewijzigd van vorm als er later meer bijkomen.

De Decision Engine **gebruikt** straks meerdere Specialist Summaries
(één per actieve specialist) als input voor zijn prioriteitsregels — dus
dit document is een bouwsteen ónder de Decision Engine, niet een
vervanging ervan.

---

## Kernprincipe: beleid, geen ruwe data

**Fout, wat we niet doen:** de Master Coach stuurt ruwe cijfers door.
```
"Herstelscore = 62."
```

**Goed, wat we wel doen:** de Master Coach stuurt een **conclusie**,
vertaald naar speelruimte.
```
"Vandaag is maximale trainingsintensiteit: matig."
```

**Waarom dit belangrijk is:** de Cycling Coach hoeft dan niet zelf te
interpreteren wat "HRV was 45ms" betekent voor vandaag — dat heeft de
Master Coach al gedaan. De specialist krijgt een **kader**, geen
huiswerk. Dit voorkomt ook dat een specialist "per ongeluk" een zware
training adviseert bij een slechte herstelstatus, simpelweg omdat hij
de ruimte daarvoor nooit kreeg.

---

## CoachPolicy is GEEN AI-aanroep

**Cruciaal, expliciet vastgelegd:** het genereren van een `CoachPolicy`
is **volledig deterministisch** — geen Claude-call, geen interpretatie.
Het is een vertaalslag van bestaande, al-werkende berekeningen naar een
gestructureerd beleidsobject.

**Bevestigd hergebruik van bestaande code:** `calculateRecoveryScore()`
(`src/core/ai-engine/recovery-engine.ts`, al in gebruik in
`api/coach/route.ts`) berekent al deterministisch een
`{ score, status, color }` uit checkin- en Garmin-data. `CoachPolicy`
bouwt **hierop voort** — geen nieuwe berekening, een vertaling van een
bestaande naar een specialist-bruikbare vorm.

---

## Volledige flow

```
Garmin / Strava / CoachOS data
            │
            ▼
Master Coach Engine (deterministisch — calculateRecoveryScore + blessures)
            │
            ├── CoachPolicy
            │
            └── eigen context (slaap, HRV, stress — blijft bij Master Coach)
                    │
                    ▼
            Cycling Coach (AI) — interpreteert binnen de policy-grenzen
                    │
                    ▼
          SpecialistSummary
                    │
                    ▼
             Master Coach (AI) — verwerkt tot eindadvies
                    │
                    ▼
          Eindadvies aan gebruiker
```

**Twee AI-aanroepen in deze keten** (Cycling Coach + Master Coach-
verwoording), **twee deterministische stappen ervoor/ertussen**
(CoachPolicy-generatie, en straks evt. Decision Engine bij meerdere
specialisten).

---

## CoachPolicy — interface

```ts
interface CoachPolicy {
  recoveryState: 'low' | 'moderate' | 'good'
  maxIntensity: 'low' | 'moderate' | 'high'
  volumeAdjustmentPct: number        // 0 = geen aanpassing, -20 = 20% minder volume
  priority: 'recovery' | 'performance' | 'balance'
  allowedTrainingTypes: string[]
  forbiddenTrainingTypes: string[]
  reasons: string[]                   // Explainability-eis, zoals overal in de architectuur
}
```

**`allowedTrainingTypes`/`forbiddenTrainingTypes`, belangrijke
kanttekening:** deze labels zijn generiek (bijv. `'hoge_intensiteit'`,
`'duurtraining'`, `'kracht'`) — **niet** sport-specifieke termen zoals
"VO2max" of "sprint". De specialist vertaalt deze generieke labels naar
zijn eigen vakvocabulaire. Dit houdt `CoachPolicy` herbruikbaar voor elke
toekomstige specialist (Nutrition heeft geen "trainingstype" in de
sportieve zin, maar wel een vergelijkbaar "wat mag wel/niet"-concept).

### Voorgestelde vertaaltabel (recovery-score → policy), concreet

| `calculateRecoveryScore()`-uitkomst | `recoveryState` | `maxIntensity` | `volumeAdjustmentPct` | `priority` |
|---|---|---|---|---|
| `color: 'green'` (score ≥75) | `good` | `high` | `0` | `performance` |
| `color: 'orange'` (score 50-74) | `moderate` | `moderate` | `-20` | `balance` |
| `color: 'red'` (score <50) | `low` | `low` | `-40` | `recovery` |

**Extra regel, bovenop de score:** een **actieve blessure** (bestaande
`injuries`-tabel) verlaagt `maxIntensity` met minimaal één stap, ongeacht
de herstelscore — consistent met Decision Engine-regel 2
("blessures gaan vóór periodisering").

**Nog niet definitief, bewust open:** de exacte generieke
`allowedTrainingTypes`/`forbiddenTrainingTypes`-waardenlijst per
`maxIntensity`-niveau — vergt afstemming bij implementatie, wanneer ook
duidelijk wordt welke labels de Cycling Coach praktisch bruikbaar vindt.

---

## SpecialistSummary — interface

```ts
interface SpecialistSummary {
  specialist: string                  // bijv. 'cycling'
  load: 'low' | 'moderate' | 'high'
  progress: 'improving' | 'stable' | 'declining'
  risk: 'none' | 'low' | 'high'
  recommendation: string
  confidence: number
  reasons: string[]
}
```

**Rijker dan het eerdere, illustratieve voorbeeld in
`specialist-decision-engine.md`** — met `confidence` en gestructureerde
`load`/`progress`/`risk`-velden in plaats van vrije tekst, zodat de
Master Coach (en straks de Decision Engine, bij meerdere specialisten)
dit **programmatisch** kan vergelijken tussen specialisten, niet alleen
kan voorlezen. Dit sluit aan bij het bestaande `EngineResult`-patroon
uit `specialist-engine-architecture.md`.

---

## Verantwoordelijkheden, samengevat

- **Master Coach Engine (deterministisch):** bepaalt `CoachPolicy` —
  de speelruimte
- **Specialist Coach (AI):** optimaliseert binnen die speelruimte,
  gebruikt zijn eigen vakkennis
- **Specialist Summary:** rapporteert de uitkomst terug, gestructureerd
- **Decision Engine** (apart document): kiest tussen meerdere
  Specialist Summaries zodra er meerdere specialisten tegelijk actief
  zijn — gebruikt dus wat hier wordt gedefinieerd, is er geen vervanging
  van
- **Master Coach (AI):** communiceert één samenhangend eindadvies

**Schaalbaarheid:** dit contract verandert niet als er straks tien
specialisten actief zijn in plaats van één — elke specialist krijgt
dezelfde `CoachPolicy`-vorm, levert dezelfde `SpecialistSummary`-vorm.

---

## Relatie tot bestaande documenten

- **`specialist-api.md` Fase 4** — wordt bijgewerkt: de Master Coach
  Orchestrator-sectie krijgt CoachPolicy/SpecialistSummary als het
  daadwerkelijke contract, in plaats van het losse illustratieve
  voorbeeld dat er nu staat
- **`specialist-decision-engine.md`** — wordt bijgewerkt: expliciete
  verduidelijking dat Decision Engine **SpecialistSummary's gebruikt**
  (van meerdere specialisten tegelijk), niet hetzelfde is als dit
  contract

## Volgende stap

Na goedkeuring van dit document: implementatie. Concreet, in volgorde:
1. `CoachPolicy`-generator (deterministisch, in `api/coach/route.ts` of
   een nieuwe gedeelde functie) — bouwt voort op `calculateRecoveryScore()`
2. Cycling Coach Layer-prompt uitbreiden: ontvangt `CoachPolicy`,
   respecteert de grenzen
3. Cycling Coach Layer retourneert `SpecialistSummary`
4. Master Coach-prompt uitbreiden: neemt `SpecialistSummary` mee in het
   eindadvies

**Raakt bestaande productie-code** (`api/coach/route.ts`) — implementatie
vergt dezelfde zorgvuldigheid als eerder afgesproken bij Fase 4.
