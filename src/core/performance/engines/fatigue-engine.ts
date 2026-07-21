import type { PerformanceContext } from '../core/types'
import type { EngineResult } from '../core/engine-result'
import type { LoadValue } from './load-engine'
import { berekenConfidence } from './confidence-engine'
import { clamp } from '../shared/scoring'

// ── Fatigue Engine ────────────────────────────────────────────────────
// Bron: overleg 21 juli 2026, Fase 1B. In tegenstelling tot Recovery en
// Load is dit GEEN wrapper — nieuwe logica, dus expliciet los getest
// vóór levering (zie changelog). VOLLEDIG DETERMINISTISCH, geen AI.
//
// Meet opgebouwde vermoeidheid, hoger = méér vermoeid (tegenovergesteld
// aan Recovery, waar hoger = beter). Twee componenten:
// - TSB (Training Stress Balance) — het hoofdsignaal. Hergebruikt de
//   platform-TSB uit de Load Engine, geen eigen CTL/ATL-berekening.
// - ACWR-risico — een aanvullende, secundaire component. Zelfde
//   drempelwaarden als de Recovery Engine's ACWR-correctie
//   (v2.4.148), voor consistentie tussen de twee engines.

export interface FatigueValue {
  score: number // 0-100, HOGER = meer vermoeid
  label: 'Low' | 'Moderate' | 'High' | 'Very High'
  tsb_component: number
  acwr_component: number
}

/** TSB=0 -> 50 (basislijn), TSB=-50 -> 100 (zeer vermoeid), TSB=+50 -> 0 (fris). */
function tsbNaarVermoeidheidscomponent(tsb: number): number {
  return clamp(Math.round(50 - tsb), 0, 100)
}

/** Zelfde drempelwaarden als recovery-engine.ts se ACWR-correctie, voor consistentie. */
function acwrNaarVermoeidheidscomponent(loadRatio: number | null): number {
  if (loadRatio === null || loadRatio === undefined) return 0
  if (loadRatio > 1.7) return 30
  if (loadRatio > 1.5) return 20
  if (loadRatio > 1.3) return 10
  return 0
}

function scoreNaarLabel(score: number): FatigueValue['label'] {
  if (score < 30) return 'Low'
  if (score < 55) return 'Moderate'
  if (score < 80) return 'High'
  return 'Very High'
}

export function berekenFatigue(context: PerformanceContext, load: EngineResult<LoadValue>): EngineResult<FatigueValue> {
  const tsbComponent = tsbNaarVermoeidheidscomponent(load.value.tsb)
  const acwrComponent = acwrNaarVermoeidheidscomponent(context.raw.performanceSnapshot?.load_ratio ?? null)

  // TSB is het hoofdsignaal (gewicht 0,7), ACWR een aanvulling — zelfde
  // "vult aan, domineert niet"-principe als Training Readiness in de
  // Recovery Engine (v2.4.148)
  const score = clamp(Math.round(tsbComponent * 0.7 + acwrComponent), 0, 100)

  return {
    engine: 'Fatigue',
    timestamp: new Date().toISOString(),
    value: { score, label: scoreNaarLabel(score), tsb_component: tsbComponent, acwr_component: acwrComponent },
    confidence: berekenConfidence(context),
    metadata: {
      dataPointsUsed: load.metadata?.dataPointsUsed || 0,
      calculationVersion: 'fatigue-engine.ts v1 (afgeleid van Load Engine TSB + ACWR)',
    },
  }
}
