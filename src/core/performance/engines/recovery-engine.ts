import { calculateRecoveryScore } from '@/core/ai-engine/recovery-engine'
import type { PerformanceContext } from '../core/types'
import type { EngineResult } from '../core/engine-result'
import { berekenConfidence } from './confidence-engine'

// ── Recovery Engine (Performance-laag) ───────────────────────────────────
// Bron: overleg 21 juli 2026. Dit is een WRAPPER — de daadwerkelijke
// berekening staat nog steeds in @/core/ai-engine/recovery-engine.ts
// (vandaag nog uitgebreid en getest met Niveau 1+2). Geen dubbele
// logica, geen regressierisico: dezelfde functie, alleen vertaald naar
// het nieuwe EngineResult<T>-contract.

export interface RecoveryValue {
  score: number
  status: string
  color: 'green' | 'orange' | 'red'
  breakdown: { factor: string; ruwe_waarde: string; bijdrage_score: number }[]
}

export function berekenRecovery(context: PerformanceContext): EngineResult<RecoveryValue> {
  const recovery = calculateRecoveryScore(
    context.raw.checkin,
    context.raw.healthMetrics,
    context.raw.lifeEventPenalty,
    context.raw.performanceSnapshot
  )

  const confidence = berekenConfidence(context)

  return {
    engine: 'Recovery',
    timestamp: new Date().toISOString(),
    value: {
      score: recovery.score,
      status: recovery.status,
      color: recovery.color,
      breakdown: recovery.breakdown,
    },
    confidence,
    metadata: {
      dataPointsUsed: recovery.breakdown.length,
      calculationVersion: 'recovery-engine.ts v2.4.148',
    },
  }
}
