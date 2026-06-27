// ── CoachOS Rowing Drill Library ──────────────────────────────────────────────
// Architectuur: Coach bepaalt doel → route filtert → Trainer AI assembleert.
// Trainer AI mag GEEN sessietypes verzinnen buiten deze lijst.

export type RowingDoel =
  | 'herstel'
  | 'uithoudingsvermogen'
  | 'kracht'
  | 'techniek'
  | 'snelheid'
  | 'interval'
  | 'warming_up'
  | 'cooling_down'

export type RowingNiveau = 'beginner' | 'gemiddeld' | 'gevorderd'

export type RowingCategorie =
  | 'recovery'
  | 'endurance'
  | 'tempo'
  | 'interval'
  | 'sprint'
  | 'techniek'
  | 'warming_up'
  | 'cooling_down'

export interface RowingDrill {
  id: string
  naam: string
  categorie: RowingCategorie
  doelen: RowingDoel[]
  niveau: RowingNiveau
  duur_min: number
  afstand_m?: number
  session_type: string
  uitleg: string
  beschrijving: string
  instructies: string[]
  tips: string[]
  target_spm?: number
  target_split?: string
  hartslag_zone?: string
}

export const ROWING_DRILLS: RowingDrill[] = [

  // ── RECOVERY ROWS ─────────────────────────────────────────────────────────

  {
    id: 'recovery-row',
    naam: 'Recovery Row',
    categorie: 'recovery',
    doelen: ['herstel'],
    niveau: 'beginner',
    duur_min: 20,
    session_type: 'recovery',
    uitleg: 'Zeer rustige roeisessie voor actief herstel. Lage intensiteit, focus op techniek.',
    beschrijving: 'Een recovery row is roeien op zeer lage intensiteit. Je herstelt actief terwijl je werkt aan je techniek. Ideaal de dag na een zware sessie.',
    instructies: [
      'Roei op 18-20 spm — zeer rustig',
      'Focus op lange, ontspannen haal',
      'Adem rustig — in bij de catch, uit bij de drive',
      'Geen druk op de split — alleen bewegen',
    ],
    tips: ['Als je hijgt roei je te hard', 'Focus op de techniek', 'Houd de rug rechtop bij de catch'],
    target_spm: 18,
    hartslag_zone: 'Zone 1-2',
    target_split: '2:30-2:45/500m',
  },
  {
    id: 'easy-row',
    naam: 'Easy Row',
    categorie: 'recovery',
    doelen: ['herstel', 'uithoudingsvermogen'],
    niveau: 'beginner',
    duur_min: 30,
    afstand_m: 6000,
    session_type: 'recovery',
    uitleg: 'Comfortabele roeisessie op lage intensiteit. Basisconditie opbouwen.',
    beschrijving: 'De easy row is de basis van roeitraining. Comfortabel en consistent. Je bouwt je aerobe basis op zonder overbelasting.',
    instructies: [
      'Constant tempo — 20-22 spm',
      'Regelmatige haal — benen, rug, armen',
      'Ontspannen greep — geen witte knokkels',
      'Houd de split consistent',
    ],
    tips: ['Greep ontspannen houden', 'Consistentie is belangrijker dan snelheid', 'Gebruik de voetensteun goed'],
    target_spm: 20,
    hartslag_zone: 'Zone 2',
    target_split: '2:20-2:30/500m',
  },

  // ── ENDURANCE ROWS ────────────────────────────────────────────────────────

  {
    id: 'steady-state-row',
    naam: 'Steady State Row',
    categorie: 'endurance',
    doelen: ['uithoudingsvermogen'],
    niveau: 'gemiddeld',
    duur_min: 40,
    afstand_m: 8000,
    session_type: 'endurance',
    uitleg: 'Constant tempo op aerobe drempel. Sterke basis voor langere prestaties.',
    beschrijving: 'Steady state roeien op 70-75% van maximale inspanning. Dit is de meest effectieve training voor het opbouwen van aerobe capaciteit.',
    instructies: [
      'Roei op 22 spm — constant',
      'Houd je split consistent door de hele sessie',
      'Adem 2 halen per stroke bij hogere intensiteit',
      'Geen versnelling aan het einde',
    ],
    tips: ['Monitor je split elke 500m', 'Eerste 10 min langzamer beginnen', 'Hydrateer tijdens de sessie'],
    target_spm: 22,
    hartslag_zone: 'Zone 3',
    target_split: '2:10-2:20/500m',
  },
  {
    id: 'lange-afstand',
    naam: 'Lange Afstand Row',
    categorie: 'endurance',
    doelen: ['uithoudingsvermogen'],
    niveau: 'gemiddeld',
    duur_min: 60,
    afstand_m: 12000,
    session_type: 'endurance',
    uitleg: 'Langere roeisessie op rustig tempo. Uithoudingsvermogen en mentaliteit.',
    beschrijving: 'Langere roeisessies bouwen de mentale en fysieke basis voor wedstrijdvorbereiding. Leren om te blijven roeien als het moeilijk wordt.',
    instructies: [
      'Begin langzamer dan je denkt nodig te zijn',
      'Breek de sessie op in 20-min blokken mentaal',
      'Houd techniek goed ook als het zwaar wordt',
      'Laatste 2000m mag iets harder',
    ],
    tips: ['Drink elke 15 min', 'Mentale trucs helpen — focus op de volgende 500m', 'Foam roller na afloop'],
    target_spm: 20,
    hartslag_zone: 'Zone 2-3',
    target_split: '2:15-2:25/500m',
  },

  // ── INTERVAL ROWS ─────────────────────────────────────────────────────────

  {
    id: 'interval-500m',
    naam: '500m Intervallen',
    categorie: 'interval',
    doelen: ['interval', 'snelheid'],
    niveau: 'gemiddeld',
    duur_min: 40,
    session_type: 'interval',
    uitleg: '6 × 500m hard met 1 min rust. Snelheid en kracht opbouwen.',
    beschrijving: 'De 500m interval is de klassieke roei-interval. Elk stuk roei je hard — bijna maximaal. De korte rust laat je herstellen voor de volgende.',
    instructies: [
      '10 min inroeien op easy pace',
      '6 × 500m op race pace of harder',
      '1 min rust tussen elk stuk',
      '10 min uitroeien',
    ],
    tips: ['Eerste interval nooit de snelste', 'Benen zijn de motor — gebruik ze volledig', 'Houd spm consistent per interval'],
    target_spm: 26,
    hartslag_zone: 'Zone 4-5',
    target_split: '1:55-2:05/500m',
  },
  {
    id: 'interval-2000m',
    naam: '2000m Test/Interval',
    categorie: 'interval',
    doelen: ['snelheid', 'interval'],
    niveau: 'gevorderd',
    duur_min: 35,
    afstand_m: 2000,
    session_type: 'test',
    uitleg: 'De standaard roei-test. 2000m zo snel mogelijk. Benchmark en kracht.',
    beschrijving: 'De 2000m is dé standaard roei-test wereldwijd. Het vereist maximale inspanning gedurende 6-8 minuten. Perfecte pacing is essentieel.',
    instructies: [
      '15 min grondig inroeien met sprints',
      'Start: eerste 500m iets sneller dan doeltempo',
      'Midden 1000m: constant — zo min mogelijk verliezen',
      'Laatste 500m: alles geven wat er nog is',
    ],
    tips: ['Pacing is alles bij de 2k', 'Te snel starten kost punten aan het einde', 'Maximale inspanning vereist goede voorbereiding'],
    target_spm: 30,
    hartslag_zone: 'Zone 5',
    target_split: '1:50-2:00/500m',
  },
  {
    id: 'pyramid-intervals',
    naam: 'Piramide Intervallen',
    categorie: 'interval',
    doelen: ['interval', 'uithoudingsvermogen', 'snelheid'],
    niveau: 'gevorderd',
    duur_min: 50,
    session_type: 'interval',
    uitleg: 'Oplopende en dalende intervallen. 250-500-750-500-250m. Veelzijdigheid.',
    beschrijving: 'Piramide intervallen wisselen van afstand — omhoog en dan terug omlaag. Dit traint zowel snelheid als uithoudingsvermogen in één sessie.',
    instructies: [
      '10 min inroeien',
      '250m - 500m - 750m - 500m - 250m hard',
      'Rust = helft van de roeitijd per interval',
      '10 min uitroeien',
    ],
    tips: ['Pas je tempo aan per afstand', '250m is sneller dan 750m', 'De piramide test je veelzijdigheid'],
    target_spm: 26,
    hartslag_zone: 'Zone 4-5',
  },

  // ── TECHNIEK DRILLS ───────────────────────────────────────────────────────

  {
    id: 'arms-only',
    naam: 'Arms Only Drill',
    categorie: 'techniek',
    doelen: ['techniek', 'warming_up'],
    niveau: 'beginner',
    duur_min: 10,
    session_type: 'recovery',
    uitleg: 'Alleen armen bewegen. Isoleert de armbeweging en finish positie.',
    beschrijving: 'Arms only is een basistechniekdrill. Je houdt je benen en rug stil en beweegt alleen je armen. Dit isoleert de correcte arm beweging en leert de finish positie.',
    instructies: [
      'Benen gestrekt — niet buigen',
      'Rug stabiel en opgericht',
      'Alleen armen trekken en strekken',
      'Voel de correcte finish positie',
    ],
    tips: ['Langzaam uitvoeren', 'Focus op de ellebogen langs het lichaam', 'Polsen plat bij de finish'],
    target_spm: 18,
    hartslag_zone: 'Zone 1',
  },
  {
    id: 'legs-only',
    naam: 'Legs Only Drill',
    categorie: 'techniek',
    doelen: ['techniek', 'kracht'],
    niveau: 'beginner',
    duur_min: 10,
    session_type: 'recovery',
    uitleg: 'Alleen benen gebruiken. Isoleert de beendrive — de krachtigste fase.',
    beschrijving: 'Legs only isoleert de krachtigste fase van de haal — de beendrive. Armen gestrekt houden terwijl je alleen met de benen drijft.',
    instructies: [
      'Armen volledig gestrekt houden',
      'Rug stabiel en licht voorover',
      'Drijf alleen met de benen',
      'Voel de verbinding tussen voeten en riemen',
    ],
    tips: ['Armen mogen niet buigen', 'Explosieve beendrive', 'Hielen omhoog bij de catch'],
    target_spm: 18,
    hartslag_zone: 'Zone 1-2',
  },
  {
    id: 'pick-drill',
    naam: 'Pick Drill',
    categorie: 'techniek',
    doelen: ['techniek', 'warming_up'],
    niveau: 'beginner',
    duur_min: 15,
    session_type: 'recovery',
    uitleg: 'Opbouwende techniekdrill: armen → armen+rug → volledig. Perfecte opwarming.',
    beschrijving: 'De pick drill bouwt de volledige haal op van buitenin naar binnenin. Begin met alleen armen, voeg rug toe, dan benen. Perfecte opwarming en techniektraining.',
    instructies: [
      '5 min arms only',
      '5 min arms + back (geen benen)',
      '5 min full stroke — alles gecombineerd',
      'Houd elk onderdeel bewust aan',
    ],
    tips: ['Geen haast — bewust opbouwen', 'Voelt kunstmatig maar is leerzaam', 'Ideaal als opwarming voor zware sessie'],
    target_spm: 18,
    hartslag_zone: 'Zone 1-2',
  },

  // ── WARMING UP & COOLING DOWN ─────────────────────────────────────────────

  {
    id: 'warming-up-row',
    naam: 'Warming-Up Row',
    categorie: 'warming_up',
    doelen: ['warming_up'],
    niveau: 'beginner',
    duur_min: 10,
    afstand_m: 2000,
    session_type: 'recovery',
    uitleg: 'Geleidelijk inroeien voor een zwaardere sessie. Lichaam opwarmen.',
    beschrijving: 'Een goede warming-up is essentieel voor roei-prestaties. Begin rustig en verhoog geleidelijk de intensiteit. Voeg 2-3 korte sprints toe in de laatste 2 minuten.',
    instructies: [
      '5 min easy roeien op 18-20 spm',
      '3 min tempo opbouwen naar 22 spm',
      '3 × 10 halen hard — volledig herstel ertussen',
      'Klaar voor de hoofdtraining',
    ],
    tips: ['Nooit koud starten met intervallen', 'De mini-sprints activeren het zenuwstelsel', 'Voel je klaar voor de sessie'],
    target_spm: 18,
    hartslag_zone: 'Zone 1-3',
  },
  {
    id: 'cooling-down-row',
    naam: 'Cooling Down Row',
    categorie: 'cooling_down',
    doelen: ['cooling_down', 'herstel'],
    niveau: 'beginner',
    duur_min: 10,
    afstand_m: 2000,
    session_type: 'recovery',
    uitleg: 'Rustig uitroeien na training. Hartslag laten dalen.',
    beschrijving: 'Na een zware roeisessie is uitroeien essentieel. Dit helpt de hartslag geleidelijk te verlagen en afvalstoffen af te voeren.',
    instructies: [
      'Roei 10 min op 16-18 spm',
      'Verminder de kracht geleidelijk',
      'Focus op lange, ontspannen halen',
      'Stretch na het uitroeien',
    ],
    tips: ['Niet direct stoppen na een zware sessie', 'Drink water tijdens de cooling down', 'Stretch rug en benen daarna'],
    target_spm: 18,
    hartslag_zone: 'Zone 1',
    target_split: '2:30-2:45/500m',
  },
]

// ── Hulpfuncties ──────────────────────────────────────────────────────────────

export function filterRowing(
  doel: RowingDoel,
  niveau?: RowingNiveau
): RowingDrill[] {
  const niveauRang = { beginner: 0, gemiddeld: 1, gevorderd: 2 }
  return ROWING_DRILLS.filter(d => {
    const doelMatch = d.doelen.includes(doel)
    const niveauMatch = !niveau || niveauRang[d.niveau] <= niveauRang[niveau]
    return doelMatch && niveauMatch
  })
}

export function formateerRowingVoorPrompt(drills: RowingDrill[]): string {
  return drills.map(d =>
    `- ${d.naam} (${d.niveau}, ${d.duur_min} min, session_type:"${d.session_type}"${d.target_spm ? `, ${d.target_spm} spm` : ''}${d.target_split ? `, split: ${d.target_split}` : ''}${d.hartslag_zone ? `, ${d.hartslag_zone}` : ''}): ${d.uitleg}`
  ).join('\n')
}
