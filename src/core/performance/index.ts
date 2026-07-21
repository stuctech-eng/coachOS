// ── CoachOS Performance Intelligence Platform — public API ──────────────
// Bron: overleg 21 juli 2026, Fase 1A. Alles wat buiten deze map gebruikt
// mag worden loopt via dit bestand — houdt de interne structuur vrij om
// te wijzigen zonder externe imports te breken.

export type { PerformanceContext } from './core/types'
export type { EngineResult, ConfidenceResult, ConfidenceLevel, ExplanationResult } from './core/engine-result'
export { ENGINE_REGISTRY } from './core/engine-registry'

export { getPerformanceContext } from './data/performance-data-adapter'
export { berekenConfidence } from './engines/confidence-engine'
export { berekenRecovery, type RecoveryValue } from './engines/recovery-engine'
export { berekenLoad, type LoadValue, type LoadSportDetail } from './engines/load-engine'
export { berekenFatigue, type FatigueValue } from './engines/fatigue-engine'
export { berekenReadiness, type ReadinessValue } from './engines/readiness-engine'
export { berekenConsistency, type ConsistencyValue } from './engines/consistency-engine'
export { bewaarSnapshot, haalHistorie, type HistoriePunt } from './engines/history-engine'
export { berekenEndurance, type EnduranceValue } from './engines/endurance-engine'
export { getVo2max } from './data/performance-data-adapter'
export { verklaarRecovery } from './engines/explainability-engine'
