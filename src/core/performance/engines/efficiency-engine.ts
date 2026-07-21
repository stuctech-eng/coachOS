import { getEfficiencyFactorData } from '../data/performance-data-adapter'
import type { PerformanceContext } from '../core/types'
import type { EngineResult } from '../core/engine-result'
import { berekenConfidence } from './confidence-engine'
import { clamp } from '../shared/scoring'

// ── Efficiency Score ──────────────────────────────────────────────────
// Bron: overleg 21 juli 2026, Fase 2. Master spec: "Hoe efficiënt
// iemand beweegt." Cycling: hartslag/vermogen/cadans/snelheid.
//
// v1, bewust beperkt tot Cycling — gebruikt de Efficiency Factor (EF),
// een publiek gedocumenteerd, wijdverspreid concept in de
// duursportwereld: gemiddeld vermogen ÷ gemiddelde hartslag. Hogere EF
// = meer output per hartslag = efficiënter. GEEN propriëtaire formule
// van een specifiek platform nagemaakt.
//
// Running-efficiency (pace/hartslag/cadans/verticale oscillatie/
// grondcontacttijd) is bewust NIET meegenomen in v1 — verticale
// oscillatie en grondcontacttijd worden nergens uitgelezen (geen TCX-
// veld dat CoachOS nu leest), zou een onvolledig cijfer geven.

export interface EfficiencyValue {
  score: number
  label: 'Laag' | 'Gemiddeld' | 'Goed' | 'Zeer goed'
  gemiddelde_ef: number | null
  aantal_activiteiten: number
}

function efNaarScore(ef: number | null): number {
  if (ef === null) return 0
  // Efficiency Factor ligt doorgaans tussen ~1,0 (laag getraind) en
  // ~2,0+ (zeer efficiënt) — ronde, redelijke bandbreedte
  return clamp(Math.round(((ef - 1.0) / 1.2) * 100), 0, 100)
}

function scoreNaarLabel(score: number): EfficiencyValue['label'] {
  if (score >= 75) return 'Zeer goed'
  if (score >= 50) return 'Goed'
  if (score >= 25) return 'Gemiddeld'
  return 'Laag'
}

export async function berekenEfficiency(context: PerformanceContext): Promise<EngineResult<EfficiencyValue>> {
  const activiteiten = await getEfficiencyFactorData(context.userId, 30).catch(() => [])

  const efWaarden = activiteiten.map(a => a.avg_watts / a.avg_hr)
  const gemiddeldeEf = efWaarden.length > 0
    ? Math.round((efWaarden.reduce((a, b) => a + b, 0) / efWaarden.length) * 100) / 100
    : null

  const score = efNaarScore(gemiddeldeEf)

  return {
    engine: 'Efficiency',
    timestamp: new Date().toISOString(),
    value: { score, label: scoreNaarLabel(score), gemiddelde_ef: gemiddeldeEf, aantal_activiteiten: activiteiten.length },
    confidence: berekenConfidence(context),
    metadata: {
      dataPointsUsed: activiteiten.length,
      calculationVersion: 'efficiency-engine.ts v1 (Cycling Efficiency Factor, 30 dagen)',
    },
  }
}
