// ── Performance Intelligence Platform — Engine Registry ─────────────────
// Bron: overleg 21 juli 2026. Centraal overzicht van welke engines
// bestaan en hun status — voor het Debug Dashboard en toekomstige
// Dashboard-UI, zodat die niet hoeven te "weten" welke engines er zijn.

export type EngineStatus = 'actief' | 'gepland'

export interface EngineRegistryEntry {
  naam: string
  key: string
  status: EngineStatus
  fase: '1A' | '1B' | '2' | '3'
  omschrijving: string
}

export const ENGINE_REGISTRY: EngineRegistryEntry[] = [
  { naam: 'Confidence Engine', key: 'confidence', status: 'actief', fase: '1A', omschrijving: 'Bepaalt betrouwbaarheid van elke score op basis van databeschikbaarheid' },
  { naam: 'Recovery Engine', key: 'recovery', status: 'actief', fase: '1A', omschrijving: 'Wrapper om de bestaande recovery-engine.ts (HRV, slaap, Training Readiness, ACWR)' },
  { naam: 'Explainability Engine', key: 'explainability', status: 'actief', fase: '1A', omschrijving: 'Regelgebaseerde, gestandaardiseerde uitleg per engine-resultaat' },
  { naam: 'Load Engine', key: 'load', status: 'actief', fase: '1B', omschrijving: 'TSS/CTL/ATL/TSB, platformniveau (hergebruikt bestaande Cycling/Running-berekeningen)' },
  { naam: 'Readiness Engine', key: 'readiness', status: 'gepland', fase: '1B', omschrijving: 'Recovery + vandaag\'s trainingsplan + CoachPolicy samengevat' },
  { naam: 'Fatigue Engine', key: 'fatigue', status: 'gepland', fase: '1B', omschrijving: 'Afgeleid van ACWR/CTL/ATL/TSB' },
  { naam: 'Consistency Engine', key: 'consistency', status: 'gepland', fase: '1B', omschrijving: 'Trainingsritme, streaks, gemiste trainingen' },
  { naam: 'History Engine', key: 'history', status: 'gepland', fase: '1B', omschrijving: 'Bewaart score-geschiedenis voor trends' },
  { naam: 'Endurance Index', key: 'endurance', status: 'gepland', fase: '2', omschrijving: 'Met Confidence vanaf dag 1, groeit mee met meer data' },
  { naam: 'Progress Score', key: 'progress', status: 'gepland', fase: '2', omschrijving: '' },
  { naam: 'Climbing Score', key: 'climbing', status: 'gepland', fase: '2', omschrijving: '' },
  { naam: 'Sprint Score', key: 'sprint', status: 'gepland', fase: '2', omschrijving: '' },
  { naam: 'Efficiency Score', key: 'efficiency', status: 'gepland', fase: '2', omschrijving: '' },
  { naam: 'Race Predictor', key: 'race-predictor', status: 'gepland', fase: '3', omschrijving: 'Vergt maanden historie' },
  { naam: 'Athlete Profile', key: 'athlete-profile', status: 'gepland', fase: '3', omschrijving: 'Vergt maanden historie' },
]
