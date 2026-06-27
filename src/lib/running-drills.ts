// ── CoachOS Running Drill Library ────────────────────────────────────────────
// Architectuur: Coach bepaalt doel → route filtert → Trainer AI assembleert.
// Trainer AI mag GEEN sessietypes verzinnen buiten deze lijst.

export type RunningDoel =
  | 'herstel'
  | 'uithoudingsvermogen'
  | 'snelheid'
  | 'tempo'
  | 'intervaltraining'
  | 'warming_up'
  | 'cooling_down'

export type RunningNiveau = 'beginner' | 'gemiddeld' | 'gevorderd'

export type RunningCategorie =
  | 'recovery'
  | 'endurance'
  | 'tempo'
  | 'interval'
  | 'sprint'
  | 'warming_up'
  | 'cooling_down'
  | 'techniek'

export interface RunningDrill {
  id: string
  naam: string
  categorie: RunningCategorie
  doelen: RunningDoel[]
  niveau: RunningNiveau
  duur_min: number
  afstand_km?: number
  uitleg: string
  beschrijving: string
  instructies: string[]
  tips: string[]
  hartslag_zone?: string
  doeltempo?: string
  session_type: string // wordt direct gebruikt in de AI prompt
}

export const RUNNING_DRILLS: RunningDrill[] = [

  // ── RECOVERY RUNS ─────────────────────────────────────────────────────────

  {
    id: 'recovery-run',
    naam: 'Recovery Run',
    categorie: 'recovery',
    doelen: ['herstel'],
    niveau: 'beginner',
    duur_min: 25,
    afstand_km: 4,
    session_type: 'recovery',
    uitleg: 'Zeer rustige loopsessie voor actief herstel. Hartslag blijft laag.',
    beschrijving: 'Een recovery run is een van de belangrijkste tools voor lopers. Je loopt op een tempo waarbij je moeiteloos kunt praten. Dit bevordert de doorbloeding en versnelt het herstel zonder extra trainingsbelasting.',
    instructies: [
      'Loop op een tempo waarbij je een gesprek kunt voeren',
      'Hartslag maximaal Zone 2 — rustig en ontspannen',
      'Geen tempo druk — alleen bewegen',
      'Focus op ontspannen looptechniek',
    ],
    tips: ['Als je buiten adem raakt loop je te snel', 'Platte route — geen heuvels', 'Ideaal de dag na een zware training'],
    hartslag_zone: 'Zone 1-2',
    doeltempo: '6:30-7:30/km',
  },
  {
    id: 'easy-run',
    naam: 'Easy Run',
    categorie: 'recovery',
    doelen: ['herstel', 'uithoudingsvermogen'],
    niveau: 'beginner',
    duur_min: 30,
    afstand_km: 5,
    session_type: 'recovery',
    uitleg: 'Comfortabele duurloop op lage intensiteit. Basisconditie opbouwen.',
    beschrijving: 'De easy run is de basis van elk loopschema. 80% van je trainingen zou easy moeten zijn. Je loopt op een comfortabel tempo waarbij je adem gecontroleerd blijft.',
    instructies: [
      'Kies een rustig, consistent tempo',
      'Adem door de neus als dat lukt',
      'Houd je schouders ontspannen',
      'Kleine, frequente passen — geen grote stappen',
    ],
    tips: ['Praten moet moeiteloos gaan', 'Consistentie is belangrijker dan snelheid', 'Ideaal voor beginners en herstel'],
    hartslag_zone: 'Zone 2',
    doeltempo: '6:00-7:00/km',
  },

  // ── ENDURANCE RUNS ────────────────────────────────────────────────────────

  {
    id: 'steady-state-run',
    naam: 'Steady State Run',
    categorie: 'endurance',
    doelen: ['uithoudingsvermogen', 'tempo'],
    niveau: 'gemiddeld',
    duur_min: 35,
    afstand_km: 6,
    session_type: 'endurance',
    uitleg: 'Constante snelheid op comfortabel-uitdagend tempo. Aerobe basis versterken.',
    beschrijving: 'Een steady state run is harder dan easy maar makkelijker dan tempo. Je kunt nog praten maar het is niet meer moeiteloos. Ideaal voor het verbeteren van je aerobe capaciteit.',
    instructies: [
      'Houd een constant tempo van begin tot eind',
      'Comfortabel maar uitdagend — 70-75% van max',
      'Regelmatige ademhaling — ritmisch',
      'Focus op consistente cadans',
    ],
    tips: ['Gebruik een GPS-horloge voor consistentie', 'Het laatste km moet voelbaar zijn', 'Geen sprinten aan het einde'],
    hartslag_zone: 'Zone 3',
    doeltempo: '5:30-6:00/km',
  },
  {
    id: 'lange-duurloop',
    naam: 'Lange Duurloop',
    categorie: 'endurance',
    doelen: ['uithoudingsvermogen'],
    niveau: 'gemiddeld',
    duur_min: 60,
    afstand_km: 10,
    session_type: 'endurance',
    uitleg: 'Langere loopsessie op rustig tempo. Uithoudingsvermogen en vetverbranding.',
    beschrijving: 'De lange duurloop is de hoeksteen van looptraining. Door langer te lopen verbeter je je uithoudingsvermogen, leer je vetverbranding en maak je je spieren en pezen sterker.',
    instructies: [
      'Begin rustig — eerste 20% langzaam',
      'Houd een conversatietempo aan',
      'Drink elke 20-30 minuten',
      'Loop de laatste km even snel als de eerste',
    ],
    tips: ['Neem water mee', 'Begin altijd te langzaam', 'Eet een uur voor de loop'],
    hartslag_zone: 'Zone 2-3',
    doeltempo: '6:00-6:30/km',
  },

  // ── TEMPO RUNS ────────────────────────────────────────────────────────────

  {
    id: 'tempo-run',
    naam: 'Tempo Run',
    categorie: 'tempo',
    doelen: ['tempo', 'snelheid'],
    niveau: 'gemiddeld',
    duur_min: 35,
    afstand_km: 6,
    session_type: 'tempo',
    uitleg: 'Hardlopen op lactaatdrempel tempo. Versnelt je looptempo op alle afstanden.',
    beschrijving: 'Een tempo run is misschien wel de effectiefste training voor het verbeteren van je race tempo. Je loopt op je lactaatdrempel — het tempo waarbij je nog net kunt praten maar liever niet wilt.',
    instructies: [
      '10 min inlopen op easy tempo',
      '20 min tempo — comfortabel-hard',
      '5 min uitlopen op easy tempo',
      'Tempo: je kunt praten maar liever niet',
    ],
    tips: ['Warmlopen is essentieel', 'Houd het tempo consistent', 'Niet te hard starten'],
    hartslag_zone: 'Zone 4',
    doeltempo: '5:00-5:30/km',
  },
  {
    id: 'progression-run',
    naam: 'Progression Run',
    categorie: 'tempo',
    doelen: ['tempo', 'uithoudingsvermogen'],
    niveau: 'gemiddeld',
    duur_min: 40,
    afstand_km: 7,
    session_type: 'tempo',
    uitleg: 'Elke km iets sneller. Leert pacing en eindsprint.',
    beschrijving: 'Een progression run begint rustig en wordt elke kilometer iets sneller. Dit traint het vermogen om vermoeid nog te versnellen — essentieel voor races.',
    instructies: [
      'Begin op easy pace',
      'Verhoog het tempo elke 2 kilometer',
      'De laatste km is op race pace of harder',
      'Houd elke fase consistent',
    ],
    tips: ['GPS horloge is handig', 'Niet te snel beginnen', 'De progressie voelt klein maar telt op'],
    hartslag_zone: 'Zone 2-4',
    doeltempo: 'oplopend van 6:30 naar 5:00/km',
  },

  // ── INTERVAL RUNS ─────────────────────────────────────────────────────────

  {
    id: 'interval-400m',
    naam: '400m Intervallen',
    categorie: 'interval',
    doelen: ['snelheid', 'intervaltraining'],
    niveau: 'gemiddeld',
    duur_min: 40,
    session_type: 'interval',
    uitleg: '6-10 × 400m hard met rust ertussen. Snelheid en VO2max verbeteren.',
    beschrijving: '400m intervallen zijn een klassiek snelheidstraining onderdeel. Elke herhaling loop je hard — bijna maximaal. De rust ertussen laat je herstellen voor de volgende.',
    instructies: [
      '10 min inlopen',
      '6-10 × 400m hard (85-95% van max)',
      '90 sec rust tussen elke interval',
      '10 min uitlopen',
    ],
    tips: ['Eerste interval nooit de snelste', 'Consistentie over alle intervallen', 'Loop elke 400m in hetzelfde tempo'],
    hartslag_zone: 'Zone 4-5',
    doeltempo: '4:30-5:00/km per interval',
  },
  {
    id: 'interval-1km',
    naam: '1km Intervallen',
    categorie: 'interval',
    doelen: ['snelheid', 'uithoudingsvermogen', 'intervaltraining'],
    niveau: 'gevorderd',
    duur_min: 50,
    session_type: 'interval',
    uitleg: '5-6 × 1km hard met 2 min rust. VO2max en race tempo verbeteren.',
    beschrijving: '1km intervallen zijn zwaarder dan 400m maar bouwen meer uithoudingsvermogen op. Ideaal voor 5km en 10km racevoorbereiding.',
    instructies: [
      '10 min inlopen',
      '5-6 × 1000m op 5km race tempo',
      '2 min rust tussen elke interval',
      '10 min uitlopen',
    ],
    tips: ['Race tempo kennen is essentieel', 'Begin conservatief', 'Mentaal sterk blijven bij de laatste intervallen'],
    hartslag_zone: 'Zone 4-5',
    doeltempo: '4:45-5:15/km per interval',
  },
  {
    id: 'fartlek',
    naam: 'Fartlek',
    categorie: 'interval',
    doelen: ['snelheid', 'uithoudingsvermogen', 'intervaltraining'],
    niveau: 'beginner',
    duur_min: 30,
    session_type: 'interval',
    uitleg: 'Zweedse methode — afwisselend hard en rustig op gevoel. Speels en effectief.',
    beschrijving: 'Fartlek (Zweeds voor "snelheidsspel") is ongestructureerde intervaltraining. Je versnelt naar een boom, lamp of kruispunt en loopt dan rustig tot je hersteld bent. Perfect voor beginners met intervaltraining.',
    instructies: [
      'Loop 5 min inlopen',
      'Kies willekeurige markeringen als doel',
      'Sprint naar je doel, dan rustig tot herstel',
      'Herhaal 8-12 keer naar gevoel',
    ],
    tips: ['Geen structuur nodig — op gevoel', 'Ideaal op een route met veel landmarks', 'Beginners beginnen met korte sprints'],
    hartslag_zone: 'wisselend Zone 2-5',
  },

  // ── WARMING UP & COOLING DOWN ─────────────────────────────────────────────

  {
    id: 'warming-up-run',
    naam: 'Warming-Up Run',
    categorie: 'warming_up',
    doelen: ['warming_up'],
    niveau: 'beginner',
    duur_min: 10,
    afstand_km: 1.5,
    session_type: 'recovery',
    uitleg: 'Rustig inlopen voor een zwaardere training. Spieren en gewrichten voorbereiden.',
    beschrijving: 'Een goede warming-up voorkomt blessures en verbetert je prestaties. Altijd beginnen met 10 minuten rustig lopen voor interval- of tempoduur.',
    instructies: [
      'Begin wandeltempo, bouw op naar easy run',
      'Voer 4-6 beenstrekken uit na 5 min',
      'Laatste 2 min iets sneller',
      'Klaar voor de hoofdtraining',
    ],
    tips: ['Nooit koud starten met intervallen', '10 min is minimum', 'Dynamisch stretchen na het inlopen'],
    hartslag_zone: 'Zone 1-2',
    doeltempo: '6:30-7:00/km',
  },
  {
    id: 'cooling-down-run',
    naam: 'Cooling Down Run',
    categorie: 'cooling_down',
    doelen: ['cooling_down', 'herstel'],
    niveau: 'beginner',
    duur_min: 10,
    afstand_km: 1.5,
    session_type: 'recovery',
    uitleg: 'Rustig uitlopen na training. Hartslag laten dalen en herstel starten.',
    beschrijving: 'Een cooling down na je training helpt de hartslag geleidelijk te verlagen, afvalstoffen af te voeren en blessures te voorkomen. Altijd uitlopen na zware sessies.',
    instructies: [
      'Loop de laatste 10 min langzaam',
      'Bouw af van je trainstempo naar wandeltempo',
      'Adem diep en regelmatig',
      'Stretch daarna de grote spiergroepen',
    ],
    tips: ['Niet direct stoppen na een zware sessie', 'Drink water tijdens de cooling down', 'Goed moment voor statisch stretchen'],
    hartslag_zone: 'Zone 1',
    doeltempo: '7:00-8:00/km',
  },

  // ── TECHNIEK DRILLS ───────────────────────────────────────────────────────

  {
    id: 'cadans-drill',
    naam: 'Cadans Drill',
    categorie: 'techniek',
    doelen: ['snelheid', 'warming_up'],
    niveau: 'beginner',
    duur_min: 20,
    session_type: 'recovery',
    uitleg: 'Lopen op hoge cadans (180 stappen/min). Looptechniek en efficiency verbeteren.',
    beschrijving: 'Cadans is het aantal stappen per minuut. De ideale cadans is rond 180 spm. Door bewust op hogere cadans te lopen verbeter je je techniek en verlaag je het blessurerisico.',
    instructies: [
      'Gebruik een metronoom app op 170-180 bpm',
      'Kleine, snelle stappen — niet grote stappen',
      'Loop 5 min op hoge cadans, 2 min rustig',
      'Herhaal 4-5 keer',
    ],
    tips: ['Kleine stappen zijn beter dan grote', 'Houd bovenlichaam rechtop', 'Arms 90 graden en compact'],
    hartslag_zone: 'Zone 2-3',
  },
  {
    id: 'hill-repeats',
    naam: 'Heuvelherhalingen',
    categorie: 'interval',
    doelen: ['snelheid', 'intervaltraining'],
    niveau: 'gevorderd',
    duur_min: 40,
    session_type: 'interval',
    uitleg: 'Heuvel omhoog hard, rustig omlaag. Kracht en snelheid verbeteren.',
    beschrijving: 'Heuvelherhalingen zijn een van de beste trainingen voor kracht en snelheid. Omhoog lopen traint je beenspieren zwaar, omlaag lopen is de rust.',
    instructies: [
      '10 min inlopen op vlak terrein',
      'Zoek een heuvel van 100-200m',
      '8-10 × hard omhoog, rustig omlaag',
      '10 min uitlopen',
    ],
    tips: ['Voorover leunen bij het klimmen', 'Drive met de armen omhoog', 'Nooit maximaal — 85-90%'],
    hartslag_zone: 'Zone 4-5',
  },
]

// ── Hulpfuncties ──────────────────────────────────────────────────────────────

export function filterRunning(
  doel: RunningDoel,
  niveau?: RunningNiveau
): RunningDrill[] {
  const niveauRang = { beginner: 0, gemiddeld: 1, gevorderd: 2 }
  return RUNNING_DRILLS.filter(d => {
    const doelMatch = d.doelen.includes(doel)
    const niveauMatch = !niveau || niveauRang[d.niveau] <= niveauRang[niveau]
    return doelMatch && niveauMatch
  })
}

export function formateerRunningVoorPrompt(drills: RunningDrill[]): string {
  return drills.map(d =>
    `- ${d.naam} (${d.niveau}, ${d.duur_min} min, session_type:"${d.session_type}"${d.doeltempo ? `, tempo: ${d.doeltempo}` : ''}${d.hartslag_zone ? `, ${d.hartslag_zone}` : ''}): ${d.uitleg}`
  ).join('\n')
}
