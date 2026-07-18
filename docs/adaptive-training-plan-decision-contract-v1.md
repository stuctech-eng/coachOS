# Adaptive Training Plan Engine — Decision Contract v1.0

**Status: TE TOETSEN — ontwerp, nog geen code**
**Aanvulling op `docs/adaptive-training-plan-engine-spec.md` (Fase 2a).
Vergt goedkeuring vóór implementatie start.**

Waar de compacte spec (v2.4.92) vastlegt *wat* de engine doet, legt dit
document vast *hoe beslissingen afdwingbaar worden in code* — niet als
intentie, maar als regel die niet omzeild kan worden.

---

## 1. Prioriteitsketen — afdwingbaar, niet alleen documentatie

```
Master Coach Policy  >  Cycling Specialist  >  Plan Generator
     (harde grens)         (optimalisatie)        (basisplan)
```

**De regel:** een `CoachPolicy`-grens is een **harde constraint**, geen
suggestie. De Cycling Specialist mag binnen die grens vrij optimaliseren,
maar kan 'm nooit overschrijven.

**Concreet voorbeeld:**
```
CoachPolicy:
  max_week_load: 650
  herstel_required: true
  injury_flag: knee

Cycling Specialist MAG:
  ✔ interval vervangen door duurtraining
  ✔ duur aanpassen
  ✔ intensiteit binnen de grens aanpassen

Cycling Specialist MAG NOOIT:
  ✘ toch zware intervals plannen ondanks injury_flag/herstel_required
  ✘ de week-load boven max_week_load laten uitkomen
```

**Afdwingbaarheid in code — niet optioneel:** elke sessie die de Plan
Generator of Daily Adjustment Layer voorstelt, wordt **vóór opslag**
gevalideerd tegen de actuele `CoachPolicy`. Een voorstel dat de grens
overschrijdt wordt **nooit** opgeslagen als `planned`/`scheduled` — het
wordt automatisch teruggebracht binnen de grens (bijv. interval → lagere
intensiteit-variant) vóórdat het de gebruiker bereikt. Dit is dezelfde
soort validatie als al bestaat in de Coach Layer-prompt-instructie ("je
advies mag nooit een verboden trainingstype aanraden") — hier alleen
niet als prompt-instructie, maar als een échte, deterministische check
die niet van AI-gehoorzaamheid afhangt.

---

## 2. Triggers + acties — met verplichte reason codes

Elke wijziging aan een sessie **moet** een reason code krijgen — nooit
alleen "sessie gewijzigd". Dit is wat de Coach Layer later in staat
stelt om specifiek uit te leggen *waarom*, in plaats van vaag te blijven.

| Trigger | Reason code | Actie |
|---|---|---|
| Gemiste training | `missed_session` | Verplaatst naar eerstvolgende geschikte dag, of overgeslagen als week-belasting het toelaat |
| Overbelasting-signaal | `fatigue_detected` | Microcyclus verzwakt, evt. extra hersteldag ingevoegd |
| Nieuwe actieve blessure | `injury_protection` | `forbiddenTrainingTypes` toegepast op resterende macrocyclus |
| Vakantie/onbeschikbare dagen | `vacation_mode` | Microcyclus herverdeeld, macrocyclus evt. verlengd |
| Doelwijziging | `goal_change` | Macrocyclus opnieuw gegenereerd vanaf nu |

**Reason code is een verplicht veld** op elke aangepaste sessie — geen
enkele wijziging wordt opgeslagen zonder een van deze vijf waarden.

**Waarom dit ertoe doet, concreet:** dit is het verschil tussen de Coach
Layer die kan zeggen *"ik heb je dinsdagtraining aangepast omdat je
herstelwaarden drie dagen laag waren"* versus alleen *"je plan is
aangepast"* — de eerste is bruikbare coaching, de tweede is ruis.

---

## 3. Sessie-levenscyclus — statusmodel

```
planned → scheduled → completed
                    ↘ skipped
                    ↘ adjusted   (nieuwe sessie ontstaat, oude blijft bewaard)
                    ↘ cancelled
```

| Status | Betekenis |
|---|---|
| `planned` | Onderdeel van het gegenereerde plan, nog niet bevestigd voor een concrete datum (verder-weg-microcycli, zie "rolling horizon" in de hoofdspec) |
| `scheduled` | Concreet ingepland voor een specifieke dag (komende 1-2 weken) |
| `completed` | Uitgevoerd — gekoppeld aan een `completed_activity_id` |
| `skipped` | Bewust of onbewust niet uitgevoerd, geen vervanging gepland |
| `adjusted` | Vervangen door een andere sessie — **origineel blijft bewaard**, niet overschreven |
| `cancelled` | Volledig geannuleerd, geen vervanging (bijv. bij macrocyclus-herberekening) |

**Historische waarheid blijft bewaard:** bij `adjusted` wordt de
oorspronkelijke sessie **niet overschreven** — een nieuwe sessie-rij
verwijst terug naar `original_session_id`. Dit maakt het mogelijk om
later te tonen: *"oorspronkelijk stond een VO2max-training gepland,
maar is door vermoeidheid een rustige duurtraining geworden."* Zonder
dit zou die geschiedenis verloren gaan.

---

## 4. Database — uitgebreide velden (was op hoofdlijnen, nu vastgelegd)

### `training_plans`
| Veld | Type | Betekenis |
|---|---|---|
| `id` | uuid | |
| `athlete_id` | uuid | Verwijst naar de gebruiker |
| `goal` | text/jsonb | Verwijzing naar het leidende Goal Engine-doel (niet gedupliceerd, zie `specialist-database-design.md`-principe) |
| `start_date` | date | |
| `end_date` | date | Streefdatum, of berekend (start + standaard 12 weken) |
| `status` | text | bijv. `active`, `completed`, `abandoned` |
| `created_by` | text | `generator` of `specialist` — welke laag dit plan initieel aanmaakte |
| `created_at` | timestamptz | |

### `training_plan_sessions`
| Veld | Type | Betekenis |
|---|---|---|
| `id` | uuid | |
| `plan_id` | uuid | Verwijst naar `training_plans` |
| `date` | date | |
| `sport` | text | Voor toekomstige multi-sport-plannen (nu altijd `cycling`) |
| `type` | text | Trainingstype (bijv. `duurtraining`, `interval`, `herstel`) |
| `duration` | integer | Minuten |
| `intensity` | text/jsonb | Bijv. wattage-range |
| `load_target` | numeric | Verwachte belastingsbijdrage |
| `status` | text | Zie sectie 3 hierboven |
| `original_session_id` | uuid, nullable | Alleen gevuld bij `adjusted` — verwijst naar de vervangen sessie |
| `adjustment_reason` | text, nullable | Eén van de vijf reason codes uit sectie 2 — **verplicht** zodra `status = adjusted` |
| `completed_activity_id` | uuid, nullable | Verwijst naar `activity_sessions` zodra `status = completed` |

---

## 5. Bouwvolgorde, herbevestigd

```
Fase 1 — Engine zonder AI
  Plan Generator, Daily Adjustment, triggers, database, tests
  (dit document is de basis hiervoor)

Fase 2 — Coach-uitleglaag
  AI ontvangt: decision + reason code + context
  AI produceert: de menselijke uitleg
  AI beslist NIETS

Fase 3 — UI
  Planningsscherm, aanpassen, coachgesprek, historie
```

---

## Wat dit document NIET vastlegt (bewust, ongewijzigd t.o.v. de hoofdspec)

- Exacte periodiseringsalgoritme
- Exacte drempelwaarden (hoeveel dagen "fatigue_detected" triggert,
  hoeveel uur "missed_session" betekent)
- Hoe een verlengde macrocyclus er precies uitziet bij `vacation_mode`

Deze vergen praktijkervaring, niet een documentbeslissing — zoals ook al
in de hoofdspec vastgelegd.

---

## Volgende stap na goedkeuring

Implementatie start bij Fase 1 hierboven — Plan Generator eerst, volledig
deterministisch en testbaar zonder AI, zoals in beide documenten nu
vastligt.
