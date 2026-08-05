# CoachOS Platform Design — Confidence UX (Fase 4)

**Kerncomponent: Match Review Service**
**Versie 1.1 — Status: Proposed, geen code**
**Bron: docs/workout-completion-platform-adr-v1.md, Fase 4. Ontwerp-
regels van de gebruiker, 5 augustus 2026 — v1.1 verscherpt na een
tweede overlegronde: strikte scheiding Match Review Service ↔
matching-beslissing, generiek Coach Card-component, vier logging-
gebeurtenissen i.p.v. losse booleans, gebruiker als hoogste autoriteit.**

Backend (confidence-score) bestaat al sinds Fase 1. Dit document gaat
uitsluitend over wat er gebeurt bij een lage score — de eerste keer
dat de Matching Service zich rechtstreeks tot de gebruiker richt.

---

## 1. Doel

De gebruiker alleen betrekken als CoachOS zelf onvoldoende zekerheid
heeft. Toon: *"CoachOS wil iets verifiëren"*, niet *"er is een fout"*.

## 2. Confidence-regels (ongewijzigd t.o.v. de opdracht)

| Confidence | Gedrag |
|---|---|
| ≥ 90% | Automatisch koppelen. Geen melding. |
| 70–89% | Automatisch koppelen. Klein zichtbaar ("✓ Training automatisch gekoppeld", confidence optioneel onder Details). Geen actie nodig. |
| < 70% | **Niet** automatisch koppelen. Eén eenvoudige vraag aan de gebruiker: "Was dit de geplande [sport]training van vandaag?" — twee knoppen: **Ja, koppelen** / **Nee, losse activiteit**. |

**Bestaande drempel `AUTO_MATCH_DREMPEL = 0.7`** (workout-matcher.ts)
blijft ongewijzigd de grens tussen automatisch en "vraag het". De
90%-grens is nieuw, puur voor de klein-zichtbaar-vs-stil-onderscheid —
raakt geen bestaande matchlogica, alleen presentatie.

## 3. Waar de vraag verschijnt — geen modal, een generieke Coach Card

Geen popup, en **geen matching-specifiek component** — een generiek
**Coach Card**, herbruikbaar voor elke toekomstige coach-vraag, niet
alleen matching. Andere voorbeelden die dezelfde kaart ooit zouden
moeten kunnen tonen, zonder een nieuw component te bouwen: *"Je herstel
is lager dan verwacht"*, *"Wil je het trainingsplan aanpassen?"*, *"Je
hebt drie trainingen overgeslagen"*, *"Nieuwe FTP-test aanbevolen"*.
Fase 4 bouwt dus niet "de matching-bevestigingskaart", maar de eerste
**invulling** van een generiek Coach Card-component — de kaart-shell
(titel, boodschap, 1-2 knoppen, optioneel een detail-regel zoals
confidence) is matching-agnostisch; alleen de inhoud van déze
specifieke kaart gaat over matching.

```
┌─────────────────────────────────────┐
│ Coach vraagt bevestiging             │
│                                       │
│ We vonden een hardloopsessie die     │
│ mogelijk hoort bij je geplande       │
│ training.                            │
│                                       │
│ Confidence: 63%                      │
│                                       │
│ [Ja, koppelen]  [Nee, losse activiteit] │
└─────────────────────────────────────┘
```

**Open vraag, niet dit document, wel te bevestigen vóór bouwen:** ik
heb in de code geen bestaand "Coach Card"-component gevonden om te
hergebruiken (geen treffer voor die naam in het README). Twee opties:
(a) er bestaat wel iets vergelijkbaars onder een andere naam — eerst
zoeken naar hoe Today Engine's `TodayPlan`/`actionHref` nu al als kaart
op Home getoond wordt, en dat patroon hergebruiken/generaliseren, of
(b) dit wordt het eerste, echt generieke component van dit type — dan
is het extra belangrijk om de shell breed genoeg te ontwerpen voor de
vier voorbeelden hierboven, niet alleen voor matching. **Vergt een
korte verkenning vóór implementatie, geen aanname hier.**

## 4. Geen eindeloze open vraag

Als de gebruiker niets doet: na **7 dagen** automatisch als "losse
activiteit" beschouwd (dus: blijft een gewone `activity_sessions`-rij,
wordt niet gekoppeld, de geplande sessie blijft `scheduled`/`planned`
en kan alsnog door `missed_session` opgepikt worden als de datum al
voorbij is).

**Belangrijke, eerlijke constraint — geen bevestigd cron-mechanisme
gevonden in de codebase.** Er is geen bewijs van een scheduled/cron-
job-systeem (geen `vercel.json`-cron, geen ander gevonden patroon). De
7-dagen-check moet daarom **lazy** — gecontroleerd bij eerstvolgende
relevante lezing (bijv. bij het laden van Today Engine of de
specialist-trainingsplan-pagina), niet als achtergrondtaak op de
achtergrond die vanzelf om middernacht draait. Dat is consistent met
hoe de rest van het platform lijkt te werken (bijv. de rolling-
horizon-verlenging), maar is hier expliciet benoemd zodat het geen
stille aanname wordt.

## 5. Logging — vier gebeurtenissen, geen losse booleans

**Verscherpt t.o.v. de eerdere versie van dit document** (was: drie
losse boolean-velden). Vier expliciete gebeurtenissen i.p.v. booleans
die samen een toestand vormen — voorkomt onmogelijke combinaties
(bijv. "bevestigd" én "afgewezen" allebei `true`, wat met losse
booleans per ongeluk mogelijk was):

- `matched_auto` — confidence ≥ 70%, automatisch gekoppeld, gebruiker
  nooit iets gevraagd
- `matched_user_confirmed` — confidence < 70%, gebruiker tikte "Ja"
- `matched_user_rejected` — confidence < 70%, gebruiker tikte "Nee"
- `expired` — confidence < 70%, 7 dagen verstreken zonder reactie

Elke sessie krijgt precies één van deze vier, nooit meer dan één.
Naast `match_confidence`/`match_reden` (bestaan al, v2.4.267).

## 6. Learning Rules — NIET automatisch aanpassen

**Expliciete regel, letterlijk overgenomen:** een bevestiging/
afwijzing verandert de matcher **niet** direct. Eerst data verzamelen.
Pas bij voldoende volume (het voorbeeld noemt 200 bevestigingen) een
aparte, bewuste analyse of de drempel/tolerantie bijgesteld moet
worden — dat is een toekomstig, apart besluit, geen onderdeel van Fase
4 zelf. Fase 4 bouwt alleen de **logging** die zo'n analyse ooit
mogelijk maakt, niet de analyse zelf.

## 7. Architectuur — Match Review Service als eigen component

```
Workout Matcher → berekent confidence
        │
        ▼
Match Review Service → beslist ALLEEN of de gebruiker iets moet zien
        │
        ▼
Gebruiker (Coach Card) → bevestigt of wijst af
        │
        ▼
Definitieve koppeling
        │
        ▼
Learning → pas veel later, apart besluit (§6)
```

**Verantwoordelijkheid, precies afgebakend — verscherpt na overleg:**
- **Doet:** op basis van de al-berekende confidence bepalen of de
  gebruiker iets te zien krijgt (stil bij ≥90%, kleine melding bij
  70-89%, Coach Card bij <70%); de 7-dagen-vervaltermijn bewaken; één
  van de vier gebeurtenissen (§5) loggen bij een gebruikersactie of
  het verstrijken van de termijn
- **Doet NOOIT:** confidence zelf berekenen of herberekenen, opnieuw
  matchen, de matcher of diens drempels/tolerantie aanpassen. **De
  Match Review Service mag alleen om een oordeel vragen — nooit zelf
  een matching-beslissing nemen of terugdraaien.** Zou dat wel zo zijn,
  ontstaan er twee lagen die hetzelfde proberen te doen (confidence
  bepalen), precies het soort dubbele logica die dit platform overal
  elders vermijdt.

**Confidence bepaalt uitsluitend "hoeveel vertrouwen heeft het
systeem" — nooit "wat gebeurt er met de training."** Dat onderscheid
is bewust scherp: 95% en 55% doorlopen exact hetzelfde
matching-algoritme (`workout-matcher.ts`, ongewijzigd); confidence
verandert alleen de presentatielaag eromheen (stil/melding/vraag), niet
de matchlogica zelf.

**Architectuurregel — de gebruiker is de hoogste autoriteit.** Een
handmatige bevestiging of afwijzing overschrijft de automatische
matching en is definitief. Matcher, Match Review Service en (straks)
Learning Engine mogen die beslissing nooit zelfstandig terugdraaien —
ook niet als een latere hercalculatie een andere uitkomst zou geven.
De werkelijkheid van wat de sporter heeft gedaan staat boven elk
berekend cijfer.

**Waarom een eigen component, niet inline in `workout-matcher.ts`:**
zelfde reden als overal elders dit platform — Core blijft
"bepaal een confidence, koppel of koppel niet", de vraag "wat doen we
MET een lage confidence richting de gebruiker" is een aparte
verantwoordelijkheid met een eigen levenscyclus (aanmaken, tonen,
laten verlopen, loggen).

## 8. Wat dit document NIET vastlegt

- Het exacte Coach Card-component/pad (zie §3, open vraag)
- Exacte UI-copy per sport (het voorbeeld toont Running, andere
  sporten volgen dezelfde structuur, geen aparte teksten per sport
  nodig — de matcher levert al een sport-neutrale `reden`-string)
- Of de 7-dagen-termijn instelbaar moet worden, of een vaste constante
  blijft (voorstel: vaste constante, net als `AUTO_MATCH_DREMPEL` en
  `DUUR_TOLERANTIE_PCT` — pas instelbaar maken als daar ooit een
  concrete reden voor blijkt)
- Wat er met een `activity_sessions`-rij gebeurt die **wél** bevestigd
  wordt als "Nee, losse activiteit" — blijft die gewoon een normale,
  ongekoppelde activiteit (aanname: ja, dat is de meest voor de hand
  liggende default, maar niet expliciet bevestigd in de opdracht)

## Volgende stap

Dit document eerst beoordelen — klopt de Coach Card-aanpak, klopt de
7-dagen-termijn, klopt de scope-afbakening van de Match Review Service
— pas daarna de korte verkenning van §3 (bestaand kaart-patroon vinden
of niet) en de implementatie zelf.
