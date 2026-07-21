import { haalVermogenscurve } from '@/lib/specialists/cycling-grafieken'
import type { PerformanceContext } from '../core/types'
import type { EngineResult } from '../core/engine-result'
import { berekenConfidence } from './confidence-engine'
import { clamp } from '../shared/scoring'

// ── Sprint Score ──────────────────────────────────────────────────────
// Bron: overleg 21 juli 2026, Fase 2. Master spec: "Gebaseerd op 5/10/
// 15/30 sec." Leunt volledig op de al-bestaande vermogenscurve
// (cycling_power_curve, v2.4.108) — geen nieuwe databron.
//
// Eerlijke beperking, expliciet benoemd: dit is ABSOLUTE piekvermogen,
// niet W/kg-genormaliseerd (dat zou eerlijker zijn tussen verschillende
// lichaamsgewichten, maar vergt een extra gewicht-ophaling — bewust
// simpel gehouden voor v1).

export interface SprintValue {
  score: number
  label: 'Beginnend' | 'Ontwikkelend' | 'Sterk' | 'Explosief'
  peak_watts: number | null
  duration_sec: number | null
}

function wattsNaarScore(watts: number | null): number {
  if (watts === null) return 0
  // Redelijke bandbreedte: 200W (beginnend) tot 1200W (elite sprint) —
  // geen exacte wetenschappelijke claim
  return clamp(Math.round(((watts - 200) / 1000) * 100), 0, 100)
}

function scoreNaarLabel(score: number): SprintValue['label'] {
  if (score >= 75) return 'Explosief'
  if (score >= 50) return 'Sterk'
  if (score >= 25) return 'Ontwikkelend'
  return 'Beginnend'
}

export async function berekenSprint(context: PerformanceContext): Promise<EngineResult<SprintValue>> {
  const curve = await haalVermogenscurve(context.userId).catch(() => [])
  const sprintPunten = curve.filter(p => p.duration_sec <= 30).sort((a, b) => a.duration_sec - b.duration_sec)
  // Kortste beschikbare duur binnen 30s geldt als piek-sprintvermogen
  // (5s is de standaard-referentie, maar niet iedereen heeft die)
  const beste = sprintPunten[0] || null

  const score = wattsNaarScore(beste?.watts ?? null)

  return {
    engine: 'Sprint',
    timestamp: new Date().toISOString(),
    value: { score, label: scoreNaarLabel(score), peak_watts: beste?.watts ?? null, duration_sec: beste?.duration_sec ?? null },
    confidence: berekenConfidence(context),
    metadata: {
      dataPointsUsed: sprintPunten.length,
      calculationVersion: 'sprint-engine.ts v1 (kortste-duur piekvermogen, absoluut)',
    },
  }
}
