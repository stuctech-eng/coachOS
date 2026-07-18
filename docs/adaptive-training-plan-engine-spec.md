# Adaptive Training Plan Engine — Compacte Specificatie

**Status: TE TOETSEN — ontwerp, nog geen code**
**Fase 2a van `docs/cycling-specialist-roadmap-v1.md`**

Geen nieuwe architectuur-tientallen-pagina's — dit legt alleen vast wat
nodig is om te kunnen bouwen: input, output, herberekenings-triggers,
rolverdeling.

---

## Kernprincipe: twee lagen, niet één

Consistent met "AI rekent nooit" — de planningsstructuur zelf is
**deterministisch**, de uitleg erover is AI:

```
Plan Generation Engine (deterministisch)
   → genereert de SKELETSTRUCTUUR: macro/meso/microcycli,
     weekbelasting-targets, welk type training op welke dag

Daily Adjustment Layer (deterministisch)
   → vergelijkt vandaag het skelet met de actuele CoachPolicy,
     vervangt deterministisch bij conflict (geen AI-gok)

Coach Layer (AI, bestaand patroon)
   → schrijft de "waarom"-uitleg in natuurlijke taal,
     BESLIST NIETS, leest alleen de al-genomen beslissing
```

Dit is dezelfde scheiding als overal elders in de architectuur
(Analysis Engine berekent, Coach Layer interpreteert) — hier toegepast
op periodisering in plaats van op losse trainingsstatistieken.

---

## 1. Input

| Bron | Wat | Al bestaand? |
|---|---|---|
| Cycling Profile | FTP, max hartslag, trainingsdagen, beschikbare uren | ✅ Fase 1 |
| CoachPolicy | Vandaags grenzen (max intensiteit, verboden types, volume-aanpassing) | ✅ v2.4.79-80 |
| Goal Engine | Doel + streefdatum + `importance` (welk Cycling-doel is leidend) | ✅ v2.4.86-88 |
| Analysis Engine | Huidige trainingsbelasting, trend, frequentie | ✅ v2.4.66 |
| Memory Engine | Bevestigde patronen (bijv. "reageert goed op duurtraining") | ✅ v2.4.82 |
| Confidence Engine | Hoe zeker is elk Memory-item | ✅ v2.4.76 |

**Alles hierboven bestaat al** — deze fase voegt geen nieuwe databron
toe, het combineert bestaande bronnen tot een plan.

---

## 2. Output

```
Macrocyclus (het hele traject naar het doel)
   └── Mesocycli (blokken van 3-6 weken: opbouw/drempel/piek/herstel)
         └── Microcycli (1 week)
               └── Dagplanning (concrete training per dag)
```

**Voorbeeld dagplanning:**
```
Vandaag
D1 duurtraining, 75 minuten, 150-175W, cadans 90-95

Waarom?
✔ Herstel voldoende
✔ Op schema richting FTP-doel
✔ Morgen staat een interval gepland
```
De "Waarom"-regels zijn Coach Layer-tekst, gebaseerd op de al-gemaakte
deterministische keuze — niet andersom.

---

## 3. Hoever vooruit plant de engine — "rolling horizon"

**Niet alles in evenveel detail.** Ver-in-de-toekomst-plannen die toch
vaak wijzigen, verdienen geen valse precisie:

- **Macrocyclus:** volledig gegenereerd, tot de streefdatum (of een
  standaard 12 weken als er geen streefdatum is)
- **Mesocycli:** volledig bepaald (welke weken zijn opbouw/drempel/
  piek/herstel)
- **Microcycli, komende 1-2 weken:** volledige dagplanning (concrete
  trainingen)
- **Microcycli, verder weg:** alleen een week-belasting-target, nog
  geen dag-voor-dag-invulling — die volgt zodra de week dichterbij komt

Dit voorkomt dat het systeem een gedetailleerd plan voor over 10 weken
belooft, dat toch moet wijken zodra de realiteit (herstel, gemiste
trainingen) anders uitpakt.

---

## 4. Herberekenings-triggers — expliciet, geen "AI beslist maar wat"

| Trigger | Wat gebeurt er |
|---|---|
| **Gemiste training** (niet gelogd binnen X uur na geplande tijd) | Training verplaatst naar eerstvolgende geschikte dag, of overgeslagen als week-belasting het toelaat |
| **Overbelasting-signaal** (Analysis Engine-trend of CoachPolicy `recoveryState: low` meerdere dagen op rij) | Huidige microcyclus verzwakt, evt. extra hersteldag ingevoegd |
| **Nieuwe actieve blessure** | Direct herberekend — CoachPolicy `forbiddenTrainingTypes` wordt toegepast op de resterende macrocyclus, niet alleen vandaag |
| **Vakantie/onbeschikbare dagen** (handmatige gebruikersinvoer) | Microcyclus rond die dagen herverdeeld, macrocyclus evt. verlengd als het doel dat vergt |
| **Doelwijziging** (via de bestaande Goal Engine/doelen-UI) | Volledige macrocyclus opnieuw gegenereerd vanaf nu |

**Exacte drempelwaarden** (hoeveel dagen "meerdere dagen op rij" is,
hoeveel uur "gemist" betekent) — vastgesteld bij implementatie, niet in
dit document, want dat vergt afstemming op de eerste praktijkervaring.

---

## 5. Rolverdeling — Master Coach vs. Cycling Specialist

**Master Coach beslist nooit de planstructuur.** Hij levert alleen de
CoachPolicy-grens (zoals al vastgelegd in `specialist-coach-policy.md`)
— "vandaag maximaal matige intensiteit". De **Cycling Specialist**
beslist vervolgens **hoe** hij daarbinnen het plan aanpast (welke
training vervangt welke, of een dag naar volgende week verschuift).

```
Master Coach → CoachPolicy (grens, geen planbeslissing)
   → Cycling Specialist → past het plan aan BINNEN die grens
      → SpecialistSummary terug naar Master Coach (al-bestaand contract)
```

**Consistent met wat al gebouwd is** — geen nieuwe communicatielaag
nodig, dit hergebruikt het CoachPolicy/SpecialistSummary-contract
(v2.4.79-80) letterlijk, nu ook voor planbeslissingen in plaats van
alleen voor losse dagadviezen.

---

## 6. Database — op hoofdlijnen, exacte schema bij implementatie

Twee nieuwe tabellen, geen wijziging aan bestaande:

- **`training_plans`** — één rij per macrocyclus: doel, streefdatum,
  start/eind, huidige mesocyclus-type
- **`training_plan_sessions`** — één rij per geplande training: datum,
  type, doelbelasting (bijv. wattage-range), status
  (gepland/afgerond/verplaatst/overgeslagen), reden bij afwijking

Geen wijziging aan `specialist_analyses`, `specialist_memory`,
`user_goals` — dit is een nieuwe laag die de bestaande lagen als input
gebruikt, niet vervangt.

---

## 7. Wat dit document NIET vastlegt (bewust, vergt praktijkervaring)

- Exacte periodiseringsalgoritme (welk % opbouw/drempel/piek/herstel —
  gangbare sportwetenschappelijke modellen bestaan, keuze bij
  implementatie)
- Exacte drempelwaarden voor triggers (zie punt 4)
- Hoe een verlengd macrocyclus er precies uitziet bij vakantie/ziekte

---

## Volgende stap na goedkeuring

Implementatie van Fase 2a, in sub-stappen (zelfde patroon als de rest
van deze sessie): eerst de Plan Generation Engine (deterministisch),
dan de Daily Adjustment Layer, dan de Coach Layer-uitbreiding, dan de
Kalender-UI (Fase 2b) die dit zichtbaar maakt.
