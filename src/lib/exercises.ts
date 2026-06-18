export interface Oefening {
  id: string
  naam: string
  categorie: string
  type: string
  niveau: string
  equipment: string
  primaireSpieven: string[]
  secondaireSpieven: string[]
  afbeelding: string
  fases: { label: string }[]
  beschrijving: string
  beschrijvingVolledig: string
  tips: string[]
  fouten: string[]
}

export const OEFENINGEN: Record<string, Oefening> = {
  'two-hand-swing': {
    id: 'two-hand-swing',
    naam: 'Two Hand Swing',
    categorie: 'Kettlebell',
    type: 'Compound',
    niveau: 'Beginner',
    equipment: 'Kettlebell',
    primaireSpieven: ['Heup', 'Bilspieren', 'Hamstrings'],
    secondaireSpieven: ['Core', 'Rug'],
    afbeelding: '/exercises/kettlebell-swing.png',
    fases: [
      { label: 'Heup naar achter' },
      { label: 'Kettlebell tussen benen' },
      { label: 'Explosieve heupstrekking' },
      { label: 'Kettlebell omhoog' },
      { label: 'Terug naar start' },
    ],
    beschrijving: 'Sta met je voeten op heupbreedte. Hinge in je heupen en laat de kettlebell tussen je benen zakken. Strek explosief je heupen en breng de kettlebell omhoog tot schouderhoogte.',
    beschrijvingVolledig: 'Sta met je voeten op heupbreedte. Hinge in je heupen en laat de kettlebell tussen je benen zakken. Strek explosief je heupen en breng de kettlebell omhoog tot schouderhoogte. Laat gecontroleerd zakken en herhaal. De kracht komt vanuit de heupen, niet de armen.',
    tips: [
      'Houd je rug neutraal en je core aangespannen',
      'Gebruik je heupen, niet je armen',
      'Laat de kettlebell zweven, geen harde stop bovenin',
      'Adem uit bij de strekking, in bij het zakken',
      'Houd je schouders naar beneden en achteren',
    ],
    fouten: [
      'Armen gebruiken om te tillen',
      'Rug bol trekken tijdens de hinge',
      'Squatten in plaats van hip hinge',
      'Kettlebell te hoog trekken boven het hoofd',
    ],
  },

  'goblet-squat': {
    id: 'goblet-squat',
    naam: 'Goblet Squat',
    categorie: 'Kettlebell',
    type: 'Compound',
    niveau: 'Beginner',
    equipment: 'Kettlebell',
    primaireSpieven: ['Quadriceps', 'Bilspieren'],
    secondaireSpieven: ['Core', 'Hamstrings'],
    afbeelding: '/exercises/goblet-squat.png',
    fases: [
      { label: 'Startpositie' },
      { label: 'Begin squat' },
      { label: 'Diep squat' },
      { label: 'Omhoog drijven' },
      { label: 'Terugkeren' },
    ],
    beschrijving: 'Houd de kettlebell voor je borst met beide handen. Voeten op schouderbreedte, tenen licht naar buiten. Zak diep door de knieën terwijl je borst omhoog blijft.',
    beschrijvingVolledig: 'Houd de kettlebell voor je borst met beide handen op de horns. Voeten op schouderbreedte, tenen licht naar buiten gedraaid. Zak diep door de knieën terwijl je borst omhoog en rug recht blijft. Ellebogen duwen de knieën naar buiten in de diepste positie. Drijf omhoog via de hielen.',
    tips: [
      'Houd de kettlebell dicht tegen de borst',
      'Borst omhoog, rug recht door de hele beweging',
      'Ellebogen duwen knieën naar buiten onderaan',
      'Drijf omhoog via de hielen',
      'Adem in bij het zakken, uit bij het omhoog komen',
    ],
    fouten: [
      'Hielen lichten op van de grond',
      'Borst valt naar voren',
      'Knieën zakken naar binnen',
      'Onvoldoende diepte in de squat',
    ],
  },

  'kettlebell-clean': {
    id: 'kettlebell-clean',
    naam: 'Kettlebell Clean',
    categorie: 'Kettlebell',
    type: 'Compound',
    niveau: 'Gevorderd',
    equipment: 'Kettlebell',
    primaireSpieven: ['Heupen', 'Schouders'],
    secondaireSpieven: ['Core', 'Biceps', 'Rug'],
    afbeelding: '/exercises/kettlebell-clean.png',
    fases: [
      { label: 'Setup' },
      { label: 'Hinge en grip' },
      { label: 'Explosieve drive' },
      { label: 'Rack positie' },
      { label: 'Terug naar start' },
    ],
    beschrijving: 'Start met de kettlebell op de grond tussen je voeten. Hinge vanuit de heupen, pak de kettlebell en drijf explosief omhoog. Vang de kettlebell in de rack positie op je schouder.',
    beschrijvingVolledig: 'Start met de kettlebell op de grond tussen je voeten. Hinge vanuit de heupen en pak de kettlebell. Drijf explosief vanuit de heupen omhoog. Leid de kettlebell dicht langs het lichaam omhoog. Vang de kettlebell zacht in de rack positie — elleboog naar beneden, kettlebell rustend op de onderarm. Laat gecontroleerd zakken en herhaal.',
    tips: [
      'Houd de kettlebell dicht langs het lichaam',
      'De kracht komt vanuit de heupen, niet de arm',
      'Vang de kettlebell zacht — geen harde landing',
      'Elleboog naar beneden in de rack positie',
      'Pols recht houden bij het vangen',
    ],
    fouten: [
      'Kettlebell te ver van het lichaam laten zwaaien',
      'Arm gebruiken om te trekken',
      'Harde landing op de pols',
      'Elleboog omhoog in de rack positie',
    ],
  },

  'kettlebell-press': {
    id: 'kettlebell-press',
    naam: 'Kettlebell Press',
    categorie: 'Kettlebell',
    type: 'Isolatie',
    niveau: 'Gevorderd',
    equipment: 'Kettlebell',
    primaireSpieven: ['Schouders', 'Triceps'],
    secondaireSpieven: ['Core', 'Bovenrug'],
    afbeelding: '/exercises/kettlebell-press.png',
    fases: [
      { label: 'Rack positie' },
      { label: 'Begin press' },
      { label: 'Halverwege' },
      { label: 'Volledige lockout' },
      { label: 'Gecontroleerd zakken' },
    ],
    beschrijving: 'Start met de kettlebell in de rack positie op je schouder. Span je core aan en druk de kettlebell explosief overhead. Vergrendel de elleboog volledig bovenin.',
    beschrijvingVolledig: 'Start met de kettlebell in de rack positie — elleboog naar beneden, kettlebell op de onderarm. Span je core en billen aan voor stabiliteit. Druk de kettlebell overhead terwijl de elleboog naar buiten draait. Vergrendel de elleboog volledig bovenin met schouder actief. Laat gecontroleerd zakken terug naar rack positie.',
    tips: [
      'Span core en billen aan voor stabiliteit',
      'Elleboog draait naar buiten tijdens de press',
      'Volledige lockout bovenin — vergrendel de elleboog',
      'Schouder actief houden, niet optrekken',
      'Pols recht houden door de hele beweging',
    ],
    fouten: [
      'Core niet aanspannen — rug holt door',
      'Elleboog niet volledig vergrendelen',
      'Schouder optrekken bij de lockout',
      'Pols achteroverbuigen',
    ],
  },

  'farmer-carry': {
    id: 'farmer-carry',
    naam: 'Farmer Carry',
    categorie: 'Kettlebell',
    type: 'Functioneel',
    niveau: 'Beginner',
    equipment: 'Kettlebell',
    primaireSpieven: ['Onderarmen', 'Trapezius', 'Core'],
    secondaireSpieven: ['Benen', 'Schouders'],
    afbeelding: '/exercises/farmer-carry.png',
    fases: [
      { label: 'Oppakken' },
      { label: 'Eerste stap' },
      { label: 'Loopbeweging' },
      { label: 'Doorgaan' },
      { label: 'Neerzetten' },
    ],
    beschrijving: 'Pak de kettlebell op vanuit een heupscharnierbeweging. Loop rechtop met schouders naar achteren en core aangespen. Geen zijwaartse kanteling van de romp.',
    beschrijvingVolledig: 'Pak de kettlebell op vanuit een gecontroleerde hip hinge. Sta volledig rechtop — schouders naar beneden en achteren, borst omhoog. Loop met korte, gecontroleerde stappen. Houd de core actief en voorkom zijwaartse kanteling van de romp. Zet de kettlebell gecontroleerd neer via een hip hinge.',
    tips: [
      'Sta volledig rechtop — geen vooroverbuigen',
      'Schouders naar beneden en achteren houden',
      'Core actief — geen zijwaartse kanteling',
      'Korte, gecontroleerde stappen',
      'Blik recht vooruit houden',
    ],
    fouten: [
      'Romp naar de zijkant kantelen',
      'Schouder optrekken aan de kant van de kettlebell',
      'Te grote stappen nemen',
      'Kettlebell laten zwaaien',
    ],
  },
}

// Zoek oefening op naam (voor koppeling vanuit training sessie)
export function zoekOefeningOpNaam(naam: string): Oefening | null {
  const naamLower = naam.toLowerCase().replace(/\s+/g, '-')
  // Directe match op ID
  if (OEFENINGEN[naamLower]) return OEFENINGEN[naamLower]
  // Fuzzy match op naam
  return Object.values(OEFENINGEN).find(o =>
    o.naam.toLowerCase() === naam.toLowerCase() ||
    naam.toLowerCase().includes(o.naam.toLowerCase().split(' ')[0])
  ) || null
}
