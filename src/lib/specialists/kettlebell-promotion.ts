import { classificeerAtleet } from './kettlebell-classification'
import type { KettlebellDiscipline } from './kettlebell-data'
import { haalKettlebellData } from './kettlebell-data'
import { analyseerKettlebellData, type EngineResult } from './kettlebell-analysis'

// ── Kettlebell Promotion Engine — MVP2 ──────────────────────────────────
// Bouwt op de Classification Engine. Gebruikt de beste PR (uit de
// bestaande Analysis Engine, geen nieuwe PR-logica) en koppelt die aan
// een geverifieerde norm. Zonder norm: altijd 'unavailable', nooit een
// geschat percentage of gap.

export interface PromotionOutcome {
  status: 'promotion_tracked' | 'no_pr' | 'unavailable'
  current_class?: string
  next_class?: string
  best_reps?: number
  gap?: number
  progress_pct?: number
  reason: string
}

export async function bepaalPromotieStatus(
  userId: string,
  discipline: KettlebellDiscipline,
  bellWeightKg: number,
  sex: 'male' | 'female',
): Promise<EngineResult<PromotionOutcome>> {
  const data = await haalKettlebellData(userId, 365)
  const analyse = analyseerKettlebellData(data.activiteiten)
  const pr = analyse.resultaat.persoonlijke_records.find(
    p => p.discipline === discipline && p.bell_weight_kg === bellWeightKg
  )

  if (!pr) {
    return {
      resultaat: { status: 'no_pr', reason: 'Nog geen PR gelogd voor deze discipline en bell weight.' },
      reden: ['Geen kettlebell_gs_sessions-data voor deze combinatie.'],
      databronnen: ['kettlebell_gs_sessions'],
      gegenereerd_op: new Date().toISOString(),
    }
  }

  const classificatie = await classificeerAtleet({ discipline, sex, bellWeightKg, bestReps: pr.reps })

  if (classificatie.resultaat.status === 'unavailable') {
    return {
      resultaat: { status: 'unavailable', best_reps: pr.reps, reason: classificatie.resultaat.reason },
      reden: classificatie.reden,
      databronnen: classificatie.databronnen,
      gegenereerd_op: new Date().toISOString(),
    }
  }

  const required = classificatie.resultaat.required_reps_for_next
  const progress = required && required > 0 ? Math.min(100, Math.round((pr.reps / required) * 100)) : undefined

  return {
    resultaat: {
      status: 'promotion_tracked',
      current_class: classificatie.resultaat.current_class,
      next_class: classificatie.resultaat.next_class,
      best_reps: pr.reps,
      gap: classificatie.resultaat.gap,
      progress_pct: progress,
      reason: 'Promotiestatus berekend op basis van geverifieerde WKSF-classificatienorm en beste PR.',
    },
    reden: ['PR gekoppeld aan geverifieerde classificatienorm via Classification Engine.'],
    databronnen: ['kettlebell_gs_sessions', 'kettlebell_classifications'],
    gegenereerd_op: new Date().toISOString(),
  }
}
