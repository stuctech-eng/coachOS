// ── CoachOS Recovery Bibliotheek ─────────────────────────────────────────────
// Architectuur identiek aan mobility-exercises.ts en bodyweight-exercises.ts:
// Coach bepaalt doel → route filtert → Trainer AI assembleert.
// Trainer AI mag GEEN nieuwe modules verzinnen buiten de gefilterde lijst.

export type RecoveryDoel =
  | 'ademhaling'
  | 'ontspanning'
  | 'herstel'
  | 'slaap'
  | 'stress'
  | 'focus'
  | 'warmup'

export type RecoveryNiveau = 'beginner' | 'gemiddeld' | 'gevorderd'

export type RecoveryCategorie =
  | 'ademhaling'
  | 'wandelen'
  | 'ontspanning'
  | 'meditatie'
  | 'visualisatie'

export interface RecoveryModule {
  id: string
  naam: string
  categorie: RecoveryCategorie
  doelen: RecoveryDoel[]
  niveau: RecoveryNiveau
  duur: number // minuten
  uitleg: string
  beschrijving: string
  instructies: string[]
  tips: string[]
  subtype: string // koppelt aan breathing/walk/mobility page subtype
  type: 'breathing' | 'walk' | 'relaxation'
}

export const RECOVERY_MODULES: RecoveryModule[] = [

  // ── ADEMHALING ────────────────────────────────────────────────────────────

  {
    id: 'box-breathing',
    naam: 'Box Breathing',
    categorie: 'ademhaling',
    doelen: ['stress', 'focus', 'herstel'],
    niveau: 'beginner',
    duur: 6,
    subtype: 'box_breathing',
    type: 'breathing',
    uitleg: '4-4-4-4 ritme voor kalmte en focus. Geadviseerd door militairen en topsporters.',
    beschrijving: 'Box breathing is een eenvoudige maar krachtige ademhalingstechniek. Je ademt 4 seconden in, houdt 4 seconden vast, ademt 4 seconden uit en houdt weer 4 seconden vast. Dit patroon kalmeert het zenuwstelsel snel.',
    instructies: [
      'Zit rechtop in een comfortabele positie',
      'Adem 4 seconden lang langzaam in door de neus',
      'Houd 4 seconden vast — ontspan de schouders',
      'Adem 4 seconden lang langzaam uit door de mond',
      'Houd 4 seconden vast voor je opnieuw inademt',
      'Herhaal dit patroon gedurende de sessie',
    ],
    tips: ['Focus op de telling — dit houdt de geest stil', 'Adem in vanuit de buik, niet de borst', 'Ontspan je schouders volledig', 'Sluit je ogen als dat helpt'],
  },
  {
    id: 'ademhaling-478',
    naam: '4-7-8 Ademhaling',
    categorie: 'ademhaling',
    doelen: ['slaap', 'stress', 'ontspanning'],
    niveau: 'beginner',
    duur: 8,
    subtype: 'breathing_478',
    type: 'breathing',
    uitleg: 'Diepe ontspanning en slaapvoorbereiding. 4 seconden in, 7 vasthouden, 8 uitademen.',
    beschrijving: 'De 4-7-8 techniek is ontwikkeld door Dr. Andrew Weil als een natuurlijk kalmeringsmiddel. De verlengde uitademing activeert het parasympathische zenuwstelsel en verlaagt de hartslag snel.',
    instructies: [
      'Zit of lig comfortabel',
      'Adem volledig uit door de mond met een zuchtend geluid',
      'Sluit je mond en adem 4 seconden in door de neus',
      'Houd je adem 7 seconden vast',
      'Adem volledig uit door de mond in 8 seconden',
      'Herhaal de cyclus 4 keer',
    ],
    tips: ['Leg het puntje van je tong achter je boventanden', 'De uitademing is twee keer zo lang als de inademing', 'Begin rustig — de eerste keer kan licht gevoel geven', 'Gebruik voor het slapengaan'],
  },
  {
    id: 'coherent-breathing',
    naam: 'Coherent Breathing',
    categorie: 'ademhaling',
    doelen: ['herstel', 'focus', 'stress'],
    niveau: 'beginner',
    duur: 10,
    subtype: 'coherent_breathing',
    type: 'breathing',
    uitleg: 'HRV verbetering via 5 seconden in, 5 seconden uit. Synchroniseert hart en ademhaling.',
    beschrijving: 'Coherent breathing — ook bekend als resonante ademhaling — brengt je hart en ademhaling in synchronisatie. 6 ademhalingen per minuut is de optimale frequentie voor HRV verbetering en stressreductie.',
    instructies: [
      'Zit rechtop met rechte rug',
      'Adem 5 seconden langzaam in door de neus',
      'Adem 5 seconden langzaam uit door de neus',
      'Houd een vloeiend, gelijkmatig ritme aan',
      'Geen pauze tussen in- en uitademing',
      'Herhaal gedurende de volledige sessie',
    ],
    tips: ['Geen pauze tussen in en uitademing — vloeiende cirkel', 'Adem vanuit de buik', 'Ideaal voor na intensieve training', 'Gebruik een timer voor consistentie'],
  },
  {
    id: 'stress-reset',
    naam: 'Stress Reset',
    categorie: 'ademhaling',
    doelen: ['stress', 'herstel', 'focus'],
    niveau: 'beginner',
    duur: 5,
    subtype: 'stress_reset',
    type: 'breathing',
    uitleg: 'Snel kalmeren via verlengde uitademing. 4 seconden in, 8 seconden uit.',
    beschrijving: 'De stress reset techniek gebruikt een verlengde uitademing om het parasympathische zenuwstelsel snel te activeren. Ideaal voor een snelle reset tussen trainingen of na een stressvolle situatie.',
    instructies: [
      'Sta, zit of lig — maakt niet uit',
      'Adem 4 seconden in door de neus',
      'Adem langzaam 8 seconden uit door de mond',
      'Maak de uitademing zo lang en volledig mogelijk',
      'Herhaal 5-10 keer',
      'Voel hoe je lichaam ontspant bij elke uitademing',
    ],
    tips: ['De uitademing is twee keer zo lang als de inademing', 'Concentreer je op een volledige uitademing', 'Kan staand worden gedaan', 'Gebruik na een zware set of een stressmoment'],
  },
  {
    id: 'diafragma-ademhaling',
    naam: 'Diafragma Ademhaling',
    categorie: 'ademhaling',
    doelen: ['herstel', 'ontspanning', 'warmup'],
    niveau: 'beginner',
    duur: 6,
    subtype: 'box_breathing',
    type: 'breathing',
    uitleg: 'Buikademhaling voor optimale zuurstofopname en ontspanning van de romp.',
    beschrijving: 'Diafragmatische ademhaling is de meest efficiënte manier van ademen. Door bewust vanuit de buik te ademen in plaats van de borst, vergroot je de longcapaciteit en ontspan je de rompspieren.',
    instructies: [
      'Lig op je rug of zit comfortabel',
      'Leg één hand op je borst en één op je buik',
      'Adem in — alleen de buikhand mag omhoog komen',
      'De borsthand blijft zo stil mogelijk',
      'Adem volledig uit — voel je buik zakken',
      'Herhaal gedurende de sessie',
    ],
    tips: ['De buik beweegt — niet de borst', 'Begin met langzame, diepe ademhalingen', 'Goede oefening voor de warming-up', 'Helpt ook bij rugpijn'],
  },

  // ── WANDELEN ─────────────────────────────────────────────────────────────

  {
    id: 'herstelwandeling',
    naam: 'Herstelwandeling',
    categorie: 'wandelen',
    doelen: ['herstel', 'ontspanning'],
    niveau: 'beginner',
    duur: 20,
    subtype: 'recovery_walk',
    type: 'walk',
    uitleg: 'Lage intensiteit wandeling voor actief herstel. Bevordert doorbloeding zonder extra belasting.',
    beschrijving: 'Een herstelwandeling op lage intensiteit bevordert de doorbloeding, helpt afvalstoffen af te voeren en versnelt het herstel zonder extra trainingsbelasting te geven. Tempo waarbij je moeiteloos kunt praten.',
    instructies: [
      'Loop op een rustig, comfortabel tempo',
      'Je moet moeiteloos kunnen praten',
      'Houd een rechte houding',
      'Adem rustig en diep',
      'Vermijd heuvelachtig terrein',
      'Geniet van de omgeving',
    ],
    tips: ['Hartslag moet laag blijven — Zone 1', 'Geen muziek nodig — gebruik de rust', 'Buiten wandelen heeft extra voordeel', 'Combineer met bewust ademen'],
  },
  {
    id: 'wandeling-natuur',
    naam: 'Wandeling in de Natuur',
    categorie: 'wandelen',
    doelen: ['ontspanning', 'stress', 'herstel'],
    niveau: 'beginner',
    duur: 30,
    subtype: 'recovery_walk',
    type: 'walk',
    uitleg: 'Langere wandeling in de natuur voor mentaal herstel en stressreductie.',
    beschrijving: 'Wandelen in de natuur (forest bathing of shinrin-yoku) heeft bewezen effecten op stressreductie, bloeddruk en mentale gezondheid. Meer dan 20 minuten buiten verlaagt cortisol significant.',
    instructies: [
      'Kies een rustige groene omgeving — park, bos of water',
      'Laat je telefoon in de zak of thuis',
      'Loop rustig en bewust',
      'Let op wat je ziet, hoort en voelt',
      'Adem diep de buitenlucht in',
      'Geen doelstelling — alleen aanwezig zijn',
    ],
    tips: ['Telefoon wegleggen maakt het effectiever', 'Geen tempo — zolang je wilt', 'Ideaal op een rustdag', 'Combineer met bewuste ademhaling'],
  },

  // ── ONTSPANNING ───────────────────────────────────────────────────────────

  {
    id: 'progressieve-spierontspanning',
    naam: 'Progressieve Spierontspanning',
    categorie: 'ontspanning',
    doelen: ['ontspanning', 'slaap', 'stress'],
    niveau: 'beginner',
    duur: 15,
    subtype: 'box_breathing',
    type: 'relaxation',
    uitleg: 'Systematisch aanspannen en ontspannen van spiergroepen. Diepe lichamelijke ontspanning.',
    beschrijving: 'Progressieve spierontspanning (PMR) is een techniek waarbij je systematisch elke spiergroep aanspant en dan loslaat. Dit traint het lichaam om het verschil tussen spanning en ontspanning te voelen en helpt bij slaap en stressreductie.',
    instructies: [
      'Lig op je rug in een comfortabele positie',
      'Sluit je ogen en adem rustig',
      'Begin bij je voeten — span ze 5 seconden aan',
      'Laat los en voel het verschil — 10 seconden',
      'Ga omhoog door alle spiergroepen: kuiten, dijen, billen, buik, handen, armen, schouders, gezicht',
      'Eindig met je gehele lichaam ontspannen',
    ],
    tips: ['Doe dit liggend op een mat of in bed', 'Adem rustig door tijdens het aanspannen', 'Voel het verschil tussen spanning en ontspanning bewust', 'Ideaal voor het slapengaan'],
  },
  {
    id: 'body-scan',
    naam: 'Body Scan',
    categorie: 'meditatie',
    doelen: ['ontspanning', 'herstel', 'slaap'],
    niveau: 'beginner',
    duur: 10,
    subtype: 'box_breathing',
    type: 'relaxation',
    uitleg: 'Bewust je aandacht door het lichaam bewegen. Spanning opsporen en loslaten.',
    beschrijving: 'Een body scan is een mindfulness oefening waarbij je je aandacht systematisch door je lichaam beweegt. Je observeert sensaties zonder te oordelen en leert spanning bewust los te laten.',
    instructies: [
      'Lig comfortabel op je rug',
      'Sluit je ogen en adem rustig',
      'Begin bij je voeten — wat voel je daar?',
      'Beweeg je aandacht langzaam omhoog door je lichaam',
      'Observeer sensaties — spanning, warmte, tintelingen',
      'Adem richting de spanning en laat los bij de uitademing',
    ],
    tips: ['Er is geen goede of foute manier', 'Dwaal je aandacht af — breng hem rustig terug', 'Doe dit in een stille ruimte', 'Gebruik voor of na training'],
  },
  {
    id: 'visualisatie-herstel',
    naam: 'Visualisatie Herstel',
    categorie: 'visualisatie',
    doelen: ['herstel', 'focus', 'ontspanning'],
    niveau: 'gemiddeld',
    duur: 8,
    subtype: 'box_breathing',
    type: 'relaxation',
    uitleg: 'Visualiseer hoe je lichaam herstelt. Mentale techniek die ook fysiek herstel bevordert.',
    beschrijving: 'Herstelvisualisatie gebruikt het vermogen van de geest om fysiek herstel te beïnvloeden. Topatleten gebruiken deze techniek om herstelprocessen te versnellen en prestaties te verbeteren.',
    instructies: [
      'Lig comfortabel en sluit je ogen',
      'Adem 3 keer diep in en uit',
      'Stel je voor hoe fris bloed door je spieren stroomt',
      'Visualiseer hoe afvalstoffen worden afgevoerd',
      'Zie je spieren ontspannen en herstellen',
      'Voel hoe energie terugkeert in je lichaam',
    ],
    tips: ['Maak de visualisatie zo levendig mogelijk', 'Gebruik alle zintuigen — voel, zie, hoor', 'Combineer met rustige ademhaling', 'Ideaal direct na een training'],
  },
  {
    id: 'savasana-recovery',
    naam: 'Savasana',
    categorie: 'ontspanning',
    doelen: ['herstel', 'ontspanning', 'slaap'],
    niveau: 'beginner',
    duur: 10,
    subtype: 'box_breathing',
    type: 'relaxation',
    uitleg: 'Volledig ontspannen liggen. Integreert de training en bevordert het herstelproces.',
    beschrijving: 'Savasana (lijkhouding uit yoga) is de kunst van bewust niets doen. Het lichaam en geest krijgen de kans om te integreren en te herstellen. Wetenschappelijk bewezen effectief voor fysiek en mentaal herstel.',
    instructies: [
      'Lig op je rug met armen naast je lichaam, handpalmen omhoog',
      'Voeten iets uiteen — laat ze naar buiten vallen',
      'Sluit je ogen',
      'Adem rustig en diep — laat het lichaam zwaar worden',
      'Ontspan elk lichaamsdeel bewust bij elke uitademing',
      'Blijf volledig stil gedurende de sessie',
    ],
    tips: ['Gebruik een deken als je het koud krijgt', 'Laat gedachten langskomen zonder erop te reageren', 'Geen moeite doen — loslaten', 'Kom langzaam omhoog na afloop'],
  },
  {
    id: 'koude-warming-down',
    naam: 'Cooling Down Protocol',
    categorie: 'ontspanning',
    doelen: ['herstel', 'ontspanning'],
    niveau: 'beginner',
    duur: 8,
    subtype: 'box_breathing',
    type: 'relaxation',
    uitleg: 'Gestructureerde afkoeling na training. Combinatie van wandelen, rekken en ademen.',
    beschrijving: 'Een gestructureerde cooling down helpt de hartslag geleidelijk te verlagen, afvalstoffen af te voeren en het lichaam voor te bereiden op herstel. Minstens 5-10 minuten na elke intensieve training.',
    instructies: [
      'Loop 2-3 minuten rustig door na de training',
      'Doe 3 minuten lichte rek oefeningen voor de gebruikte spiergroepen',
      'Eindig met 3 minuten bewuste ademhaling',
      'Adem langzaam in door de neus, uit door de mond',
      'Voel hoe je hartslag daalt',
      'Drink water gedurende de cooling down',
    ],
    tips: ['Niet direct stilzitten na intensieve training', 'Minimaal 5 minuten nemen', 'Combineer met hydratatie', 'Ideaal moment voor stretching'],
  },
]

// ── Hulpfuncties voor de route ─────────────────────────────────────────────

/**
 * Filtert recovery modules op doel.
 * Wordt gebruikt in training/today/route.ts — Optie C architectuur.
 */
export function filterRecovery(
  doel: RecoveryDoel,
  type?: 'breathing' | 'walk' | 'relaxation'
): RecoveryModule[] {
  return RECOVERY_MODULES.filter(m => {
    const doelMatch = m.doelen.includes(doel)
    const typeMatch = !type || m.type === type
    return doelMatch && typeMatch
  })
}

/**
 * Geeft een korte prompt-vriendelijke lijst van recovery modules terug.
 * Wordt direct in de Trainer AI prompt geplakt.
 */
export function formateerRecoveryVoorPrompt(modules: RecoveryModule[]): string {
  return modules.map(m =>
    `- ${m.naam} (${m.type}, ${m.duur} min, subtype: ${m.subtype}): ${m.uitleg}`
  ).join('\n')
}
