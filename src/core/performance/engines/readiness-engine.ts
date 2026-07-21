import { genereerCoachPolicy } from '@/lib/specialists/coach-policy'
import type { PerformanceContext } from '../core/types'
import type { EngineResult } from '../core/engine-result'
import type { RecoveryValue } from './recovery-engine'
import type { FatigueValue } from './fatigue-engine'
import { berekenConfidence } from './confidence-engine'
import { clamp } from '../shared/scoring'

// ── Readiness Engine ──────────────────────────────────────────────────
// Bron: overleg 21 juli 2026, Fase 1B. Onderscheid uit de master-spec:
// "Recovery = herstel. Readiness = klaar om vandaag te presteren."
// Combineert Recovery (hoe hersteld) + Fatigue (hoe vermoeid, omgekeerd
// meegewogen) tot één "vandaag klaar"-score, en toont CoachPolicy's
// max-intensiteit ernaast als context (niet als extra rekenfactor —
// CoachPolicy IS al zelf een uitkomst van Recovery, dat dubbel
// meewegen zou de score kunstmatig laten samenvallen met zichzelf).
//
// Ontwerpkeuze, expliciet benoemd: dit is de EERSTE engine die een
// bestaande, externe functie (`genereerCoachPolicy`) aanroept die zelf
// wél rechtstreeks de database raakt. Dat is een bewuste uitzondering
// op "geen engine praat met de database" — CoachPolicy is een
// bestaand, apart getest subsysteem (niet nieuw geschreven binnen de
// Performance-laag), vergelijkbaar met hoe de Recovery-wrapper
// `calculateRecoveryScore()` aanroept. Geen nieuwe databasequery
// binnen deze engine zelf.

export interface ReadinessValue {
  score: number // 0-100, hoger = meer klaar om te presteren
  label: 'Low' | 'Moderate' | 'High'
  recovery_component: number
  fatigue_component: number // al omgekeerd (100 - fatigue.score)
  policy_maxIntensity: string
  policy_reasons: string[]
}

function scoreNaarLabel(score: number): ReadinessValue['label'] {
  if (score >= 70) return 'High'
  if (score >= 45) return 'Moderate'
  return 'Low'
}

export async function berekenReadiness(
  context: PerformanceContext,
  recovery: EngineResult<RecoveryValue>,
  fatigue: EngineResult<FatigueValue>
): Promise<EngineResult<ReadinessValue>> {
  const policy = await genereerCoachPolicy(context.userId)

  const recoveryComponent = recovery.value.score
  const fatigueComponent = clamp(100 - fatigue.value.score, 0, 100)
  const score = Math.round((recoveryComponent + fatigueComponent) / 2)

  return {
    engine: 'Readiness',
    timestamp: new Date().toISOString(),
    value: {
      score,
      label: scoreNaarLabel(score),
      recovery_component: recoveryComponent,
      fatigue_component: fatigueComponent,
      policy_maxIntensity: policy.maxIntensity,
      policy_reasons: policy.reasons,
    },
    confidence: berekenConfidence(context),
    metadata: {
      dataPointsUsed: (recovery.metadata?.dataPointsUsed || 0) + (fatigue.metadata?.dataPointsUsed || 0),
      calculationVersion: 'readiness-engine.ts v1 (Recovery + inverse Fatigue, gemiddeld)',
    },
  }
}
