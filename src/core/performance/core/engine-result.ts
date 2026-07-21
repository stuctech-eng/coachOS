// ── Performance Intelligence Platform — Engine Result-contract ─────────
// Bron: overleg 21 juli 2026. Apart bestand van types.ts (op verzoek —
// met 9+ engines wordt één verzamelbestand snel onoverzichtelijk). Elke
// engine geeft dit exacte contract terug, ongeacht wat voor score het is.

export type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export interface ConfidenceFactors {
  dataAmount: number // 0-100 — hoeveelheid data
  dataFreshness: number // 0-100 — hoe recent
  sensorCoverage: number // 0-100 — welke sensoren beschikbaar (HRV/slaap/etc.)
  trainingHistory: number // 0-100 — hoeveel trainingshistorie
}

export interface ConfidenceResult {
  score: number // 0-100
  level: ConfidenceLevel
  factors: ConfidenceFactors
  limitations: string[] // menselijk leesbare tekst — "HRV-data ontbreekt" etc.
}

export interface ExplanationResult {
  title: string
  summary: string
  coachMessage: string
}

/**
 * Uniform resultaat-contract — elke engine (Recovery, straks Load/
 * Fatigue/Readiness/Consistency/etc.) geeft exact dit terug, met een
 * eigen `T` voor de specifieke waarde.
 */
export interface EngineResult<T> {
  engine: string
  // ISO-timestamp (string, geen Date-object) — voorkomt
  // serialisatieverrassingen zodra dit over een API-grens gaat
  timestamp: string
  value: T
  confidence: ConfidenceResult
  explanation?: ExplanationResult
  metadata?: {
    dataPointsUsed: number
    calculationVersion: string
  }
}
