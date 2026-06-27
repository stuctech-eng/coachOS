// ── CoachOS Mobility Bibliotheek ─────────────────────────────────────────────
// Architectuur identiek aan bodyweight-exercises.ts en strength-exercises.ts:
// Coach bepaalt doel + lichaamsdeel → route filtert → Trainer AI assembleert.
// Trainer AI mag GEEN nieuwe oefeningen verzinnen buiten de gefilterde lijst.

export type MobilityDoel =
  | 'mobiliteit'
  | 'herstel'
  | 'warmup'
  | 'cooling_down'

export type MobilityNiveau = 'beginner' | 'gemiddeld' | 'gevorderd'

export type MobilityLichaamsdeel =
  | 'nek'
  | 'schouders'
  | 'borst'
  | 'rug'
  | 'onderrug'
  | 'heupen'
  | 'benen'
  | 'hamstrings'
  | 'kuiten'
  | 'enkels'
  | 'fullbody'

export type MobilityCategorie =
  | 'stretch'
  | 'mobilisatie'
  | 'rotatie'
  | 'herstel'
  | 'warmup'

export interface MobilityOefening {
  id: string
  naam: string
  categorie: MobilityCategorie
  lichaamsdelen: MobilityLichaamsdeel[]
  doelen: MobilityDoel[]
  niveau: MobilityNiveau
  duur: number // seconden
  uitleg: string
  beschrijving: string
  tips: string[]
  fouten: string[]
  primaireSpieren: string[]
  secundaireSpieren: string[]
  herstel: boolean
  beide_zijden: boolean // true = links én rechts uitvoeren
}

export const MOBILITY_OEFENINGEN: MobilityOefening[] = [

  // ── NEK & SCHOUDERS ──────────────────────────────────────────────────────

  {
    id: 'nek-kantelen',
    naam: 'Nek Kantelen',
    categorie: 'stretch',
    lichaamsdelen: ['nek'],
    doelen: ['mobiliteit', 'herstel', 'warmup'],
    niveau: 'beginner',
    duur: 30,
    uitleg: 'Laat je oor naar je schouder zakken. Rek de zijkant van je nek.',
    beschrijving: 'Sta of zit rechtop. Laat je linkeroor langzaam naar je linkerschouder zakken. Houd je rechterschouder omlaag. Voel de rek aan de rechterkant van je nek. Adem rustig door. Wissel van kant.',
    tips: ['Houd de tegenovergestelde schouder omlaag', 'Forceer nooit de nek', 'Adem rustig in de stretch', 'Beweeg langzaam'],
    fouten: ['Schouder optrekken naar het oor', 'Te ver forceren', 'Adem inhouden'],
    primaireSpieren: ['Sternocleidomastoideus', 'Scaleni'],
    secundaireSpieren: ['Trapezius'],
    herstel: true,
    beide_zijden: true,
  },
  {
    id: 'nek-draaien',
    naam: 'Nek Draaien',
    categorie: 'mobilisatie',
    lichaamsdelen: ['nek'],
    doelen: ['mobiliteit', 'warmup'],
    niveau: 'beginner',
    duur: 30,
    uitleg: 'Draai je hoofd langzaam van links naar rechts. Mobiliseert de nekwervels.',
    beschrijving: 'Draai je hoofd langzaam naar links totdat je over je schouder kijkt. Houd 3 seconden vast. Draai terug naar het midden en dan naar rechts. Herhaal rustig. Geen snelle of rukkende bewegingen.',
    tips: ['Beweeg langzaam en gecontroleerd', 'Stop bij pijn of ongemak', 'Houd je schouders stil', 'Adem rustig door'],
    fouten: ['Te snel draaien', 'Schouders meebewegen', 'Pijn negeren'],
    primaireSpieren: ['Sternocleidomastoideus', 'Nekspieren'],
    secundaireSpieren: ['Trapezius'],
    herstel: true,
    beide_zijden: false,
  },
  {
    id: 'schouder-cirkels',
    naam: 'Schouder Cirkels',
    categorie: 'mobilisatie',
    lichaamsdelen: ['schouders'],
    doelen: ['mobiliteit', 'warmup'],
    niveau: 'beginner',
    duur: 35,
    uitleg: 'Grote cirkels met de schouders. Mobiliseert het schoudergewricht volledig.',
    beschrijving: 'Maak grote cirkels met beide schouders — eerst naar achteren, dan naar voren. Beweeg langzaam en volledig door het hele bewegingsbereik. Voel elk deel van de cirkel.',
    tips: ['Maak zo groot mogelijke cirkels', 'Beweeg bewust en langzaam', 'Wissel van richting', 'Ontspan de nek'],
    fouten: ['Te kleine cirkels', 'Te snel bewegen', 'Nek mee laten bewegen'],
    primaireSpieren: ['Deltoideus', 'Rotatorenmanchet'],
    secundaireSpieren: ['Trapezius', 'Rhomboids'],
    herstel: true,
    beide_zijden: false,
  },
  {
    id: 'dwarslingse-armrek',
    naam: 'Dwarslingse Armrek',
    categorie: 'stretch',
    lichaamsdelen: ['schouders'],
    doelen: ['mobiliteit', 'herstel'],
    niveau: 'beginner',
    duur: 35,
    uitleg: 'Trek je arm horizontaal over je borst. Rek de achterkant van de schouder.',
    beschrijving: 'Trek je linkerarm horizontaal over je borst. Gebruik je rechterarm om de linkerarm tegen je borst te trekken. Voel de rek in je linkerschouder en bovenrug. Houd vast en wissel van arm.',
    tips: ['Houd de arm op schouderhoogte', 'Trek zacht — geen ruk', 'Houd je schouders omlaag', 'Adem rustig'],
    fouten: ['Arm te hoog of te laag', 'Te hard trekken', 'Schouder optrekken'],
    primaireSpieren: ['Achterste deltoideus', 'Infraspinatus'],
    secundaireSpieren: ['Rhomboids', 'Trapezius'],
    herstel: true,
    beide_zijden: true,
  },
  {
    id: 'borst-opener',
    naam: 'Borst Opener',
    categorie: 'stretch',
    lichaamsdelen: ['borst', 'schouders'],
    doelen: ['mobiliteit', 'herstel', 'warmup'],
    niveau: 'beginner',
    duur: 35,
    uitleg: 'Handen achter de rug, borst omhoog. Opent de borst en schouders.',
    beschrijving: 'Klap je handen achter je rug ineen of grijp je polsen. Hef je borst omhoog en trek je schouderbladen naar elkaar. Kijk licht omhoog. Houd de positie vast en adem diep in.',
    tips: ['Trek schouderbladen actief samen', 'Hef de borst — niet de kin', 'Adem diep in de rek', 'Ontspan de nek'],
    fouten: ['Rug hol trekken', 'Kin omhoog in plaats van borst', 'Schouders optrekken'],
    primaireSpieren: ['Pectoralis major', 'Voorste deltoideus'],
    secundaireSpieren: ['Biceps', 'Intercostalen'],
    herstel: true,
    beide_zijden: false,
  },

  // ── RUG & WERVELKOLOM ─────────────────────────────────────────────────────

  {
    id: 'cat-cow',
    naam: 'Cat-Cow',
    categorie: 'mobilisatie',
    lichaamsdelen: ['rug', 'onderrug'],
    doelen: ['mobiliteit', 'herstel', 'warmup'],
    niveau: 'beginner',
    duur: 45,
    uitleg: 'Afwisselend rug hol en rug rond op handen en knieën. Mobiliseert de hele wervelkolom.',
    beschrijving: 'Op handen en knieën. Adem in: laat je buik zakken naar de grond, hef je hoofd en staartbeen omhoog (Cow). Adem uit: rond je rug omhoog naar het plafond, laat je hoofd zakken (Cat). Beweeg langzaam mee met je ademhaling.',
    tips: ['Synchroniseer de beweging met je adem', 'Beweeg wervel voor wervel', 'Neem de tijd voor elke positie', 'Ontspan je nek volledig'],
    fouten: ['Adem loskoppelen van de beweging', 'Te snel bewegen', 'Alleen de heupen bewegen'],
    primaireSpieren: ['Rugspieren', 'Buikspieren'],
    secundaireSpieren: ['Nekspieren', 'Heupflexoren'],
    herstel: true,
    beide_zijden: false,
  },
  {
    id: 'kind-houding',
    naam: 'Kind Houding',
    categorie: 'herstel',
    lichaamsdelen: ['rug', 'heupen'],
    doelen: ['herstel', 'mobiliteit', 'cooling_down'],
    niveau: 'beginner',
    duur: 50,
    uitleg: 'Zit terug op je hielen, armen gestrekt. Diepe rug- en heupstretch.',
    beschrijving: 'Begin op handen en knieën. Zit langzaam terug op je hielen. Strek je armen voor je uit op de grond. Laat je voorhoofd zakken naar de mat. Adem diep in je onderrug. Ontspan volledig bij elke uitademing.',
    tips: ['Laat je heupen volledig zakken', 'Adem diep in je onderrug', 'Ontspan bij elke uitademing', 'Armen actief uitrekken voor meer stretch'],
    fouten: ['Heupen niet volledig laten zakken', 'Spanning vasthouden', 'Oppervlakkig ademen'],
    primaireSpieren: ['Rugspieren', 'Bilspieren'],
    secundaireSpieren: ['Schouders', 'Quadriceps'],
    herstel: true,
    beide_zijden: false,
  },
  {
    id: 'thoracale-rotatie',
    naam: 'Thoracale Rotatie',
    categorie: 'rotatie',
    lichaamsdelen: ['rug'],
    doelen: ['mobiliteit', 'herstel'],
    niveau: 'beginner',
    duur: 40,
    uitleg: 'Op de zij, knieën gestapeld, bovenlichaam roteren. Borstwervelkolom mobiliseren.',
    beschrijving: 'Lig op je zij met knieën op elkaar gestapeld in 90 graden. Houd je knieën op de grond. Roteer je bovenlichaam weg van de knieën — volg je hand met je blik. Kom terug en herhaal. Wissel van kant.',
    tips: ['Houd knieën op de grond', 'Volg je hand met je blik', 'Beweeg langzaam', 'Adem uit bij de rotatie'],
    fouten: ['Knieën optillen van de grond', 'Te snel draaien', 'Roteren vanuit de heupen'],
    primaireSpieren: ['Thoracale wervelkolom rotators', 'Obliques'],
    secundaireSpieren: ['Rhomboids', 'Rug'],
    herstel: true,
    beide_zijden: true,
  },
  {
    id: 'liggende-wervelrotatie',
    naam: 'Liggende Wervelrotatie',
    categorie: 'rotatie',
    lichaamsdelen: ['onderrug', 'rug'],
    doelen: ['herstel', 'mobiliteit', 'cooling_down'],
    niveau: 'beginner',
    duur: 40,
    uitleg: 'Op de rug, knieën naar één kant laten zakken. Wervelkolom decompressie.',
    beschrijving: 'Lig op je rug met armen gespreid. Breng knieën omhoog in 90 graden. Laat beide knieën langzaam naar links zakken. Kijk naar rechts. Voel de rotatie in je wervelkolom. Kom terug naar het midden en wissel.',
    tips: ['Houd schouders op de grond', 'Beweeg langzaam en gecontroleerd', 'Adem diep in de rotatie', 'Ontspan bij elke uitademing'],
    fouten: ['Schouders optillen van de grond', 'Te ver forceren', 'Te snel wisselen'],
    primaireSpieren: ['Wervelkolom rotatoren', 'Obliques'],
    secundaireSpieren: ['Heupflexoren', 'Bilspieren'],
    herstel: true,
    beide_zijden: true,
  },

  // ── HEUPEN ───────────────────────────────────────────────────────────────

  {
    id: 'heupbuiger-stretch',
    naam: 'Heupbuiger Stretch',
    categorie: 'stretch',
    lichaamsdelen: ['heupen'],
    doelen: ['mobiliteit', 'herstel'],
    niveau: 'beginner',
    duur: 45,
    uitleg: 'Diepe uitvalspositie. Rek de heupbuiger van het achterste been.',
    beschrijving: 'Stap met je linkerbeen naar voren in een grote stap. Laat je rechterknee zakken naar de grond. Duw je heupen naar voren en omlaag. Houd je bovenlichaam rechtop. Voel de diepe rek voor in de rechterheup. Wissel van kant.',
    tips: ['Duw heupen actief naar voren', 'Houd bovenlichaam rechtop', 'Voorste knie boven de enkel', 'Adem diep in de stretch'],
    fouten: ['Heupen niet naar voren duwen', 'Voorste knie over de teen', 'Bovenlichaam naar voren leunen'],
    primaireSpieren: ['Iliopsoas', 'Rectus femoris'],
    secundaireSpieren: ['Quadriceps', 'Bilspieren'],
    herstel: true,
    beide_zijden: true,
  },
  {
    id: 'heup-cirkels',
    naam: 'Heup Cirkels',
    categorie: 'mobilisatie',
    lichaamsdelen: ['heupen'],
    doelen: ['mobiliteit', 'warmup'],
    niveau: 'beginner',
    duur: 40,
    uitleg: 'Grote cirkels met het bekken. Mobiliseert het heupgewricht in alle richtingen.',
    beschrijving: 'Sta met voeten heupbreed. Zet je handen op je heupen. Maak grote cirkels met je bekken — eerst 5 rondjes naar links, dan 5 naar rechts. Beweeg langzaam en volledig.',
    tips: ['Maak zo groot mogelijke cirkels', 'Houd knieën licht gebogen', 'Ontspan de bovenrug', 'Beweeg bewust'],
    fouten: ['Te kleine cirkels', 'Knieën gestrekt', 'Bovenlichaam meebewegen'],
    primaireSpieren: ['Heupabductoren', 'Heupflexoren'],
    secundaireSpieren: ['Bilspieren', 'Core'],
    herstel: false,
    beide_zijden: false,
  },
  {
    id: 'piriformis-stretch',
    naam: 'Piriformis Stretch',
    categorie: 'stretch',
    lichaamsdelen: ['heupen'],
    doelen: ['herstel', 'mobiliteit'],
    niveau: 'beginner',
    duur: 45,
    uitleg: 'Knie over het andere been leggen. Rek de diepe bilspier en piriformis.',
    beschrijving: 'Lig op je rug. Trek je linkerknie naar je borst. Leg je linkerenkel over je rechterknie. Duw je linkerknie zachtjes van je af. Voel de rek diep in je linkerbil. Wissel van kant.',
    tips: ['Duw de knie actief van je af', 'Houd je onderrug op de mat', 'Adem rustig', 'Voel de diepe bilspier'],
    fouten: ['Onderrug van de mat tillen', 'Te hard duwen', 'Spanning vasthouden'],
    primaireSpieren: ['Piriformis', 'Bilspieren'],
    secundaireSpieren: ['Heupabductoren', 'IT-band'],
    herstel: true,
    beide_zijden: true,
  },
  {
    id: 'liggende-vlinder',
    naam: 'Liggende Vlinder',
    categorie: 'herstel',
    lichaamsdelen: ['heupen'],
    doelen: ['herstel', 'mobiliteit', 'cooling_down'],
    niveau: 'beginner',
    duur: 50,
    uitleg: 'Op de rug, voetzolen tegen elkaar. Heupen openen en ontspannen.',
    beschrijving: 'Lig op je rug. Breng je voetzolen tegen elkaar. Laat je knieën naar buiten zakken naar de grond. Ontspan je heupen volledig. Adem diep en laat je heupen bij elke uitademing iets verder zakken.',
    tips: ['Forceer de knieën nooit naar beneden', 'Laat de zwaartekracht werken', 'Adem diep en ontspan', 'Elke uitademing verder loslaten'],
    fouten: ['Knieën naar beneden duwen', 'Spanning vasthouden', 'Oppervlakkig ademen'],
    primaireSpieren: ['Heupabductoren', 'Binnenkant dij'],
    secundaireSpieren: ['Heupflexoren', 'Bilspieren'],
    herstel: true,
    beide_zijden: false,
  },

  // ── HAMSTRINGS & BENEN ───────────────────────────────────────────────────

  {
    id: 'hamstring-stretch-liggend',
    naam: 'Hamstring Stretch Liggend',
    categorie: 'stretch',
    lichaamsdelen: ['hamstrings', 'benen'],
    doelen: ['herstel', 'mobiliteit'],
    niveau: 'beginner',
    duur: 40,
    uitleg: 'Op de rug één been omhoog trekken. Isoleert de hamstring stretch.',
    beschrijving: 'Lig op je rug. Trek je linkerbeen omhoog met beide handen achter de knie. Strek het been zo ver als comfortabel is. Houd je onderrug op de mat. Voel de rek achter je been. Wissel van kant.',
    tips: ['Houd de andere knie gebogen op de grond', 'Forceer het been nooit', 'Houd je onderrug op de mat', 'Adem rustig in de stretch'],
    fouten: ['Onderrug optillen', 'Been te ver forceren', 'Knie buigen van het stretchbeen'],
    primaireSpieren: ['Hamstrings'],
    secundaireSpieren: ['Kuitspieren', 'Bilspieren'],
    herstel: true,
    beide_zijden: true,
  },
  {
    id: 'zittende-voorwaartse-buiging',
    naam: 'Zittende Voorwaartse Buiging',
    categorie: 'stretch',
    lichaamsdelen: ['hamstrings', 'onderrug'],
    doelen: ['mobiliteit', 'herstel', 'cooling_down'],
    niveau: 'beginner',
    duur: 50,
    uitleg: 'Zit met gestrekte benen en buig naar voren. Hamstrings en onderrug.',
    beschrijving: 'Zit op de grond met gestrekte benen voor je. Houd je rug recht en buig langzaam naar voren vanuit de heupen. Reik naar je voeten of enkels. Houd de positie vast en adem diep uit bij elke uitademing.',
    tips: ['Buig vanuit de heupen — niet de rug', 'Houd de rug zo recht mogelijk', 'Gebruik een riem als je de voeten niet bereikt', 'Adem uit bij voorover buigen'],
    fouten: ['Vanuit de rug buigen', 'Knieën buigen', 'Te ver forceren'],
    primaireSpieren: ['Hamstrings', 'Rugspieren'],
    secundaireSpieren: ['Kuitspieren', 'Bilspieren'],
    herstel: true,
    beide_zijden: false,
  },

  // ── KUITEN & ENKELS ──────────────────────────────────────────────────────

  {
    id: 'kuit-stretch',
    naam: 'Kuit Stretch',
    categorie: 'stretch',
    lichaamsdelen: ['kuiten', 'enkels'],
    doelen: ['herstel', 'mobiliteit'],
    niveau: 'beginner',
    duur: 40,
    uitleg: 'Handen tegen de muur, been naar achteren. Rek de kuitspier.',
    beschrijving: 'Zet je handen tegen de muur. Stap met je linkerbeen naar achteren. Houd je linkerhiel op de grond. Leun naar de muur. Voel de rek in je linkerkuit. Wissel van kant.',
    tips: ['Houd de hiel op de grond', 'Houd het been gestrekt', 'Leun langzaam naar voren', 'Adem rustig'],
    fouten: ['Hiel optillen', 'Knie buigen', 'Te hard duwen'],
    primaireSpieren: ['Gastrocnemius', 'Soleus'],
    secundaireSpieren: ['Achillespees', 'Plantaire fascia'],
    herstel: true,
    beide_zijden: true,
  },
  {
    id: 'enkel-cirkels',
    naam: 'Enkel Cirkels',
    categorie: 'mobilisatie',
    lichaamsdelen: ['enkels'],
    doelen: ['mobiliteit', 'warmup'],
    niveau: 'beginner',
    duur: 35,
    uitleg: 'Grote cirkels met de enkel. Mobiliseert het enkelgewricht.',
    beschrijving: 'Til je linkervoet iets op. Maak grote cirkels met je enkel — 10 keer naar links, 10 keer naar rechts. Beweeg langzaam en volledig door het hele bewegingsbereik. Wissel van voet.',
    tips: ['Maak zo groot mogelijke cirkels', 'Beweeg langzaam', 'Houd het been ontspannen', 'Voel elk deel van de cirkel'],
    fouten: ['Te kleine cirkels', 'Te snel bewegen', 'Knie meebewegen'],
    primaireSpieren: ['Peronei', 'Tibialis anterior'],
    secundaireSpieren: ['Kuitspieren', 'Voetspieren'],
    herstel: true,
    beide_zijden: true,
  },

  // ── FULL BODY ─────────────────────────────────────────────────────────────

  {
    id: 'wereld-grootste-stretch',
    naam: 'World\'s Greatest Stretch',
    categorie: 'mobilisatie',
    lichaamsdelen: ['heupen', 'rug', 'schouders'],
    doelen: ['mobiliteit', 'warmup'],
    niveau: 'gemiddeld',
    duur: 35,
    uitleg: 'Uitval met rotatie overhead. Mobiliseert heupen, rug en schouders tegelijk.',
    beschrijving: 'Stap met je linkerbeen naar voren in een grote uitval. Zet je linkerhand naast je linkervoet op de grond. Draai je linkerarm omhoog naar het plafond. Volg je hand met je blik. Kom terug en wissel van kant.',
    tips: ['Houd je achterste been gestrekt', 'Roteer volledig — volg de hand', 'Houd de borstkas open', 'Beweeg langzaam en bewust'],
    fouten: ['Achterste knie buigen', 'Onvoldoende rotatie', 'Te snel bewegen'],
    primaireSpieren: ['Heupflexoren', 'Thoracale rotators', 'Schouders'],
    secundaireSpieren: ['Hamstrings', 'Bilspieren', 'Core'],
    herstel: false,
    beide_zijden: true,
  },
  {
    id: 'deep-squat-hold',
    naam: 'Deep Squat Hold',
    categorie: 'mobilisatie',
    lichaamsdelen: ['heupen', 'enkels', 'rug'],
    doelen: ['mobiliteit', 'warmup'],
    niveau: 'beginner',
    duur: 45,
    uitleg: 'Diepe squat positie vasthouden. Mobiliseert heupen, enkels en onderrug.',
    beschrijving: 'Zak in een diepe squat met voeten iets breder dan schouderbreedte. Gebruik je ellebogen om je knieën actief naar buiten te duwen. Houd je borst omhoog. Gebruik een steun als je de positie niet kunt houden. Adem diep en ontspan.',
    tips: ['Gebruik ellebogen om knieën naar buiten te duwen', 'Borst omhoog houden', 'Hielen op de grond', 'Gebruik een steun als nodig'],
    fouten: ['Hielen optillen', 'Borst naar voren vallen', 'Knieën naar binnen zakken'],
    primaireSpieren: ['Heupen', 'Enkels', 'Onderrug'],
    secundaireSpieren: ['Quadriceps', 'Bilspieren', 'Core'],
    herstel: false,
    beide_zijden: false,
  },
  {
    id: 'savasana',
    naam: 'Savasana',
    categorie: 'herstel',
    lichaamsdelen: ['fullbody'],
    doelen: ['herstel', 'cooling_down'],
    niveau: 'beginner',
    duur: 60,
    uitleg: 'Volledig ontspannen liggen. Integreert de training en bevordert herstel.',
    beschrijving: 'Lig op je rug met armen naast je lichaam, handpalmen omhoog. Voeten iets uiteen. Sluit je ogen. Adem rustig en diep. Laat elke spier in je lichaam ontspannen bij elke uitademing. Blijf volledig stil.',
    tips: ['Laat elke spiergroep bewust ontspannen', 'Adem diep en rustig', 'Houd de geest stil', 'Blijf volledig stil'],
    fouten: ['Bewegen of friemelen', 'Oppervlakkig ademen', 'Te snel opstaan na afloop'],
    primaireSpieren: ['Volledig lichaam'],
    secundaireSpieren: ['Zenuwstelsel', 'Cardiovasculair systeem'],
    herstel: true,
    beide_zijden: false,
  },
]

// ── Hulpfuncties voor de route ─────────────────────────────────────────────

/**
 * Filtert oefeningen op mobilityDoel.
 * Wordt gebruikt in training/today/route.ts — Optie C architectuur.
 */
export function filterMobility(
  doel: MobilityDoel,
  lichaamsdeel?: MobilityLichaamsdeel,
  niveau?: MobilityNiveau
): MobilityOefening[] {
  return MOBILITY_OEFENINGEN.filter(o => {
    const doelMatch = o.doelen.includes(doel)
    const lichaamMatch = !lichaamsdeel || o.lichaamsdelen.includes(lichaamsdeel) || o.lichaamsdelen.includes('fullbody')
    const niveauRang = { beginner: 0, gemiddeld: 1, gevorderd: 2 }
    const niveauMatch = !niveau || niveauRang[o.niveau] <= niveauRang[niveau]
    return doelMatch && lichaamMatch && niveauMatch
  })
}

/**
 * Geeft een korte prompt-vriendelijke lijst van oefeningen terug.
 * Wordt direct in de Trainer AI prompt geplakt.
 */
export function formateerMobilityVoorPrompt(oefeningen: MobilityOefening[]): string {
  return oefeningen.map(o =>
    `- ${o.naam} (${o.niveau}, ${o.duur}s${o.beide_zijden ? ', beide zijden' : ''}): ${o.uitleg}`
  ).join('\n')
}
