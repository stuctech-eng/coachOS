// ── CoachOS Cycling Drill Library ─────────────────────────────────────────────
// Architectuur: Coach bepaalt doel → route filtert → Trainer AI assembleert.
// Trainer AI mag GEEN sessietypes verzinnen buiten deze lijst.

export type CyclingDoel =
  | 'herstel'
  | 'uithoudingsvermogen'
  | 'kracht'
  | 'snelheid'
  | 'interval'
  | 'techniek'
  | 'warming_up'
  | 'cooling_down'

export type CyclingNiveau = 'beginner' | 'gemiddeld' | 'gevorderd'

export type CyclingCategorie =
  | 'recovery'
  | 'endurance'
  | 'tempo'
  | 'interval'
  | 'sprint'
  | 'techniek'
  | 'warming_up'
  | 'cooling_down'

export interface CyclingDrill {
  id: string
  naam: string
  categorie: CyclingCategorie
  doelen: CyclingDoel[]
  niveau: CyclingNiveau
  duur_min: number
  afstand_km?: number
  session_type: string
  uitleg: string
  beschrijving: string
  instructies: string[]
  tips: string[]
  target_cadence_rpm?: number
  target_power_pct?: string // percentage van FTP
  hartslag_zone?: string
}

export const CYCLING_DRILLS: CyclingDrill[] = [

  // ── RECOVERY RIDES ────────────────────────────────────────────────────────

  {
    id: 'recovery-ride',
    naam: 'Recovery Ride',
    categorie: 'recovery',
    doelen: ['herstel'],
    niveau: 'beginner',
    duur_min: 30,
    afstand_km: 15,
    session_type: 'recovery',
    uitleg: 'Zeer rustige rit voor actief herstel. Onder 55% FTP.',
    beschrijving: 'Een recovery ride is fietsen op heel lage intensiteit. Je lichaam herstelt actief terwijl je beweegt. De bloedcirculatie verbetert zonder extra trainingsbelasting.',
    instructies: [
      'Fietsen op < 55% FTP of hartslag Zone 1',
      'Hoge cadans — 90-100 rpm',
      'Ontspannen in het zadel',
      'Geen druk op de pedalen — laat het draaien',
    ],
    tips: ['Als je moeite doet fiets je te hard', 'Hoge cadans is belangrijker dan kracht', 'Ideaal de dag na een zware rit'],
    target_cadence_rpm: 90,
    hartslag_zone: 'Zone 1',
    target_power_pct: '<55% FTP',
  },
  {
    id: 'easy-ride',
    naam: 'Easy Ride',
    categorie: 'recovery',
    doelen: ['herstel', 'uithoudingsvermogen'],
    niveau: 'beginner',
    duur_min: 45,
    afstand_km: 20,
    session_type: 'recovery',
    uitleg: 'Comfortabele rit op lage intensiteit. Basisconditie opbouwen.',
    beschrijving: 'De easy ride is de basis van fietsconditie. Comfortabel en consistent. Je bouwt je aerobe basis op zonder vermoeidheid op te stapelen.',
    instructies: [
      'Fietsen op 56-75% FTP',
      'Cadans 85-95 rpm',
      'Adem rustig en gecontroleerd',
      'Houd het gevoel comfortabel',
    ],
    tips: ['Zou zich niet zwaar moeten voelen', 'Cadans hoog houden', 'Goed voor dagelijkse trainingen'],
    target_cadence_rpm: 90,
    hartslag_zone: 'Zone 2',
    target_power_pct: '56-75% FTP',
  },

  // ── ENDURANCE RIDES ───────────────────────────────────────────────────────

  {
    id: 'endurance-ride',
    naam: 'Endurance Ride',
    categorie: 'endurance',
    doelen: ['uithoudingsvermogen'],
    niveau: 'gemiddeld',
    duur_min: 60,
    afstand_km: 30,
    session_type: 'endurance',
    uitleg: 'Langere rit op aerobe zone. Vetverbranding en uithoudingsvermogen.',
    beschrijving: 'De endurance ride is de kern van fietsconditie. Langere tijd op matige intensiteit verbetert je vetverbranding, spieruithoudingsvermogen en mentale kracht.',
    instructies: [
      'Fietsen op 75-80% FTP consistent',
      'Cadans 85-95 rpm',
      'Drink elke 20 min',
      'Geen grote vermogenspikken',
    ],
    tips: ['Eet als de sessie langer dan 90 min is', 'Monitor je gemiddeld vermogen', 'De laatste 20 min zijn het belangrijkst'],
    target_cadence_rpm: 88,
    hartslag_zone: 'Zone 3',
    target_power_pct: '75-80% FTP',
  },
  {
    id: 'lange-rit',
    naam: 'Lange Rit',
    categorie: 'endurance',
    doelen: ['uithoudingsvermogen'],
    niveau: 'gemiddeld',
    duur_min: 120,
    afstand_km: 60,
    session_type: 'endurance',
    uitleg: 'Lange rit op rustig tempo. De basis voor serieuze fietsers.',
    beschrijving: 'De lange rit bouwt de specifieke uithoudingsvermogen die je nodig hebt voor langere routes en wedstrijden. Mentale kracht is net zo belangrijk als fysiek.',
    instructies: [
      'Begin langzamer dan je denkt nodig te zijn',
      'Eet en drink consistent — niet als je honger hebt',
      'Varieer je positie op de fiets',
      'Laatste uur mag iets harder',
    ],
    tips: ['Voeding planning is essentieel', '60g koolhydraten per uur bij hoge intensiteit', 'Zonnebrand en water meenemen'],
    target_cadence_rpm: 85,
    hartslag_zone: 'Zone 2-3',
    target_power_pct: '65-75% FTP',
  },

  // ── INTERVAL RIDES ────────────────────────────────────────────────────────

  {
    id: 'sweetspot',
    naam: 'Sweet Spot Training',
    categorie: 'tempo',
    doelen: ['uithoudingsvermogen', 'kracht'],
    niveau: 'gemiddeld',
    duur_min: 60,
    session_type: 'tempo',
    uitleg: '88-93% FTP voor 20-30 min blokken. Meest efficiënte FTP training.',
    beschrijving: 'Sweet spot training is de meest efficiënte manier om je FTP te verbeteren. Je rijdt op 88-93% FTP — zwaar genoeg om te verbeteren, niet zo zwaar dat je niet kunt herstellen.',
    instructies: [
      '10 min inrijden',
      '2-3 × 15-20 min op 88-93% FTP',
      '5 min herstel tussen blokken',
      '10 min uitrijden',
    ],
    tips: ['Consistent vermogen is het doel', 'Niet boven 93% gaan', 'Cadans 85-95 rpm'],
    target_cadence_rpm: 88,
    hartslag_zone: 'Zone 3-4',
    target_power_pct: '88-93% FTP',
  },
  {
    id: 'vo2max-intervals',
    naam: 'VO2max Intervallen',
    categorie: 'interval',
    doelen: ['interval', 'snelheid'],
    niveau: 'gevorderd',
    duur_min: 55,
    session_type: 'interval',
    uitleg: '5 × 3-5 min op 106-120% FTP. VO2max en piek vermogen verbeteren.',
    beschrijving: 'VO2max intervallen zijn de zwaarste maar meest effectieve training voor het verbeteren van je maximale zuurstofopname. Kort maar intens.',
    instructies: [
      '15 min grondig inrijden',
      '5 × 3 min op 110-120% FTP',
      '3 min herstel per interval',
      '10 min uitrijden',
    ],
    tips: ['Maximale inspanning per interval', 'Volledig herstel tussen intervallen', 'Maximaal 2× per week'],
    target_cadence_rpm: 95,
    hartslag_zone: 'Zone 5',
    target_power_pct: '106-120% FTP',
  },
  {
    id: 'tempo-intervals',
    naam: 'Tempo Intervallen',
    categorie: 'tempo',
    doelen: ['uithoudingsvermogen', 'interval'],
    niveau: 'gemiddeld',
    duur_min: 60,
    session_type: 'tempo',
    uitleg: '2-3 × 10-15 min op FTP. Drempelkracht verbeteren.',
    beschrijving: 'Tempo intervallen op je FTP zijn de klassieke drempeltraining. Je leert langer op hogere intensiteit te rijden.',
    instructies: [
      '10 min inrijden',
      '2-3 × 10-15 min op 95-105% FTP',
      '5 min herstel tussen blokken',
      '10 min uitrijden',
    ],
    tips: ['FTP kennen is essentieel', 'Cadans 88-95 rpm', 'Consistent vermogen per blok'],
    target_cadence_rpm: 90,
    hartslag_zone: 'Zone 4',
    target_power_pct: '95-105% FTP',
  },

  // ── TECHNIEK DRILLS ───────────────────────────────────────────────────────

  {
    id: 'cadans-drill',
    naam: 'Cadans Drill',
    categorie: 'techniek',
    doelen: ['techniek', 'warming_up'],
    niveau: 'beginner',
    duur_min: 20,
    session_type: 'recovery',
    uitleg: 'Afwisselend hoge en normale cadans. Efficiëntere trapbeweging.',
    beschrijving: 'Cadanstraining verbetert je rijefficiëntie. Door te leren op hoge cadans te rijden gebruik je meer spiervezels en verbrand je minder energie per kilometer.',
    instructies: [
      '5 min easy rijden op 85-90 rpm',
      '3 × 3 min op 100-110 rpm — licht verzet',
      '2 min herstel op 85 rpm',
      '5 min uitrijden',
    ],
    tips: ['Hoge cadans voelt onnatuurlijk in het begin', 'Lichter verzet voor hoge cadans', 'Houd het bovenlichaam stil'],
    target_cadence_rpm: 105,
    hartslag_zone: 'Zone 2',
    target_power_pct: '50-65% FTP',
  },
  {
    id: 'single-leg-drill',
    naam: 'Enkel Been Drill',
    categorie: 'techniek',
    doelen: ['techniek', 'kracht'],
    niveau: 'gemiddeld',
    duur_min: 15,
    session_type: 'recovery',
    uitleg: 'Één been pedalen. Verbetert de ronding van de trapbeweging en balans.',
    beschrijving: 'Single leg drills onthullen zwakke plekken in je trapbeweging. Elk been werkt onafhankelijk — je leert de volledige cirkel te belasten in plaats van alleen naar beneden te duwen.',
    instructies: [
      'Gebruik een indoor trainer',
      'Één voet loslaten of op de fietssteun',
      '30 sec per been — 5-10 herhalingen',
      'Focus op ronde, vloeiende beweging',
    ],
    tips: ['Lager verzet', 'Voel de kracht ook bij het optrekken', 'Begin met 20 sec en bouw op'],
    target_cadence_rpm: 80,
    hartslag_zone: 'Zone 1-2',
    target_power_pct: '40-55% FTP',
  },

  // ── WARMING UP & COOLING DOWN ─────────────────────────────────────────────

  {
    id: 'warming-up-ride',
    naam: 'Warming-Up Ride',
    categorie: 'warming_up',
    doelen: ['warming_up'],
    niveau: 'beginner',
    duur_min: 15,
    session_type: 'recovery',
    uitleg: 'Geleidelijk opbouwen voor een zwaardere training. Spieren opwarmen.',
    beschrijving: 'Een goede warming-up is essentieel voor fietsperformance en blessurepreventie. Bouw geleidelijk op en voeg een paar activatiesprintjes toe.',
    instructies: [
      '5 min easy — lage weerstand',
      '5 min geleidelijk opbouwen naar werkintensiteit',
      '3 × 10 sec sprints — volledig herstel ertussen',
      'Klaar voor de hoofdtraining',
    ],
    tips: ['Nooit koud starten met intervallen', 'De sprintjes activeren het zenuwstelsel', 'Voel je klaar voor de sessie'],
    target_cadence_rpm: 85,
    hartslag_zone: 'Zone 1-3',
    target_power_pct: '50-75% FTP oplopend',
  },
  {
    id: 'cooling-down-ride',
    naam: 'Cooling Down Ride',
    categorie: 'cooling_down',
    doelen: ['cooling_down', 'herstel'],
    niveau: 'beginner',
    duur_min: 10,
    session_type: 'recovery',
    uitleg: 'Rustig uitrijden na training. Hartslag laten dalen.',
    beschrijving: 'Na een zware ritsessie is uitrijden essentieel. Dit helpt de hartslag geleidelijk te verlagen, lactaat af te voeren en herstel te starten.',
    instructies: [
      'Rij 10 min op minimal weerstand',
      'Hoge cadans — 90-100 rpm',
      'Verminder de kracht geleidelijk',
      'Stretch rug, benen en heupbuigers daarna',
    ],
    tips: ['Niet direct stoppen na een zware rit', 'Drink water tijdens de cooling down', 'Foam roller na afloop'],
    target_cadence_rpm: 90,
    hartslag_zone: 'Zone 1',
    target_power_pct: '<50% FTP',
  },
]

// ── Hulpfuncties ──────────────────────────────────────────────────────────────

export function filterCycling(
  doel: CyclingDoel,
  niveau?: CyclingNiveau
): CyclingDrill[] {
  const niveauRang = { beginner: 0, gemiddeld: 1, gevorderd: 2 }
  return CYCLING_DRILLS.filter(d => {
    const doelMatch = d.doelen.includes(doel)
    const niveauMatch = !niveau || niveauRang[d.niveau] <= niveauRang[niveau]
    return doelMatch && niveauMatch
  })
}

export function formateerCyclingVoorPrompt(drills: CyclingDrill[]): string {
  return drills.map(d =>
    `- ${d.naam} (${d.niveau}, ${d.duur_min} min, session_type:"${d.session_type}"${d.target_cadence_rpm ? `, ${d.target_cadence_rpm} rpm` : ''}${d.target_power_pct ? `, ${d.target_power_pct}` : ''}${d.hartslag_zone ? `, ${d.hartslag_zone}` : ''}): ${d.uitleg}`
  ).join('\n')
}
