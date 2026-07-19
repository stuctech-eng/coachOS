# CoachOS — Navigatie-architectuur v1.0

**Status: GOEDGEKEURD (ontwerp) — implementatie nog niet gestart**

Definitieve, principiële herstructurering van de hoofdnavigatie — niet
als tijdelijke oplossing voor Cycling, maar als architectuurkeuze die
de drie kernpijlers van CoachOS weerspiegelt.

---

## De drie niveaus, ieder met een eigen vraag

| Niveau | Vraag | Scope |
|---|---|---|
| **Trainer** | "Wat doe ik vandaag?" | Uitvoering van de huidige training |
| **Specialist** | "Hoe word ik een betere [sport]-er?" | Vakinhoudelijke expertise, langetermijnontwikkeling, één sport |
| **Voortgang** | "Hoe ontwikkel ik me over alle sporten heen?" | Historie, trends, records — sport-overstijgend |

Dit voorkomt dubbele schermen: geen activiteitenlijst bij Home, Coach,
én Cycling apart — één plek per soort informatie.

---

## Herbevestiging vóór implementatie (v2.4.93)

Op het moment dat de bouw daadwerkelijk start (vlak vóór Fase 2a/2b van
de Cycling Roadmap), nog een keer expliciet onderbouwd waarom dit de
juiste timing is: bij het eerste ontwerp van deze navigatie leek een
aparte Specialisten-tab misschien vroeg. Inmiddels is de specialistlaag
uitgegroeid tot een volwaardig onderdeel van de architectuur — Specialist
Engines, Decision Engine, Goal Engine, Memory Engine, CoachPolicy, en nu
ook de Adaptive Training Plan Engine (Fase 2a-spec, v2.4.92). Specialisten
zijn niet langer "een extra coach naast de hoofdcoach", maar een eigen
laag met evenveel architecturaal gewicht als Trainer en Coach. Dat
rechtvaardigt een eigen, gelijkwaardige plek in de hoofdnavigatie.

## Definitieve navigatie (6 tabs) — herzien v2.4.111

```
🏠 Home        — ongewijzigd
🧠 Coach        — was 'Coach', route /chat, ongewijzigde route
💪 Trainer      — was 'Training', route /training, naam + icoon gewijzigd
🚴 Specialisten — NIEUW, eigen overzichtspagina
📊 Activiteiten — teruggezet als eigen tab (zie herziening hieronder)
📈 Voortgang    — was 'Progressie', route /progressie, naam gewijzigd
```

**Profiel/Instellingen:** geen aparte tab — bereikbaar via een
account-icoon/menu vanuit Home.

**Herziening (v2.4.111): Activiteiten weer een eigen tab.** Oorspronkelijk
(v2.4.93) verplaatst naar een sectie binnen Voortgang — op verzoek
teruggedraaid: de balk is al horizontaal scrollbaar (`overflow-x-auto`
in `BottomNav`), dus een 6e tab is geen probleem, en een eigen tab werkt
prettiger dan een sectie binnen een andere pagina. Voortgang toont
Activiteiten niet meer.

---

## Uitwerking: Voortgang

Sport-overstijgend, historie-gericht:
- **Activiteiten** (chronologische lijst — dit is de huidige
  `/activities`-pagina, verplaatst)
- Kalender (alle sporten gecombineerd)
- Statistieken
- Records (algemeen/gecombineerd — sport-specifieke records leven
  daarnaast ook bij de betreffende Specialist, zie hieronder)
- Trends
- Alle sporten gecombineerd-overzicht

---

## Uitwerking: Specialisten

Vakinhoudelijk, één sport per keer — **geen** historie-overzicht,
dat hoort bij Voortgang:

```
Specialisten-overzicht
🚴 Cycling      (actief)
🏃 Running       (actief)
🚣 Rowing         (in ontwikkeling)
🏋️ Strength        (in ontwikkeling)
🥗 Nutrition (later)
🏊 Swimming (later)
🏔️ Trail Running (later)
```

Tikken op een specialist → volledige Hub met (voor Cycling, zie
`cycling-specialist-roadmap-v1.md` Fase 2): Dashboard, Trainingsplan,
Coach, Kalender (sport-specifiek), Analyse, Grafieken, FTP/zones,
Records (sport-specifiek), Doelen (sport-specifiek), Wedstrijden.

**Bewuste dubbeling, geen probleem:** Records en Kalender bestaan zowel
bij Voortgang (gecombineerd, alle sporten) als bij een Specialist
(sport-specifiek, verdiept) — dat is geen architecturale inconsistentie,
het zijn twee verschillende vragen ("hoe doe ik het over alles heen" vs.
"hoe doe ik het specifiek bij het fietsen").

---

## Relatie tot bestaande architectuur

- **"Mijn Coaches"-chip-rij in de Coach-tab** (v2.4.69/83) — deze
  functie verhuist logisch naar de nieuwe Specialisten-tab. De
  Coach-tab (Master Coach-gesprek) hoeft de chips niet meer te tonen
  zodra Specialisten bestaat.
- **CoachPolicy/SpecialistSummary/Decision Engine** — ongewijzigd, dit
  is puur een navigatie-/UI-herstructurering, geen wijziging aan de
  onderliggende data-architectuur.
- **Cycling Specialist Roadmap v1.0** — Fase 2 (Cycling Coach
  Professional) krijgt hiermee zijn definitieve "thuis": de Cycling Hub
  onder de nieuwe Specialisten-tab, in plaats van bereikbaar via
  `/coach/cycling` zonder duidelijke navigatie-ingang.

---

## Implementatie — gefaseerd, NIET in één keer

Dit raakt te veel schermen om in één stap te doen. Voorgestelde
volgorde:

1. **Labels/iconen wijzigen** (laag risico): Training → Trainer,
   Progressie → Voortgang. Routes blijven ongewijzigd, puur cosmetisch.
2. **Activiteiten verhuizen** naar een sectie binnen Voortgang, oude
   `/activities`-tab uit de navigatiebalk verwijderen (route zelf kan
   blijven bestaan, alleen niet meer als tab).
3. **Specialisten-overzichtspagina bouwen** (`/specialisten`) — nieuwe
   pagina, hergebruikt de bestaande `/api/specialists`-data.
4. **Specialisten-tab toevoegen** aan de navigatiebalk, "Mijn Coaches"-
   chips uit de Coach-tab verwijderen (functie verplaatst, niet
   verdubbeld).
5. **Profiel/account-menu** vanuit Home, in plaats van de huidige
   plek — laatst, want dit is de minst kritieke wijziging.

**Elke stap apart test baar en op te leveren**, zoals bij elke andere
wijziging deze sessie.
