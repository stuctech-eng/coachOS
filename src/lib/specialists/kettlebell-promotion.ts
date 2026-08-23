import { classificeerAtleet, type RankingBlock } from './kettlebell-classification'
import { haalKettlebellData, type KettlebellDiscipline } from './kettlebell-data'
import { analyseerKettlebellData, type EngineResult } from './kettlebell-analysis'

// ── Kettlebell Promotion Engine — v2 ────────────────────────────────────
// promotion_status is ALTIJD 'pending_source_verification' zolang de
// blok→bell-weight-koppeling niet bevestigd is — nooit "You promoted to
// Rank I" als definitieve claim, exact zoals gevraagd. De cijfers (gap,
// huidige klasse) worden wél getoond — ze zijn correct berekend, alleen
// de praktische toepasbaarheid (welk blok bij welke kettlebell hoort)
// staat nog niet vast.

export interface PromotionOutcome {
  promotion_status: 'pending_source_verification' | 'no_pr' | 'unavailable'
  current_class?: string
  next_class?: string
  best_reps?: number
  gap?: number
  progress_pct?: number
  reason: string
  bell_weight_note?: string
}

export async function bepaalPromotieStatus(
  userId: string,
  discipline: string,
  bodyweightClass: string,
  rankingBlock: RankingBlock,
  sex: 'male' | 'female',
  kettlebellDiscipline: KettlebellDiscipline,
  bellWeightKg: number,
): Promise<EngineResult<PromotionOutcome>> {
  const data = await haalKettlebellData(userId, 365)
  const analyse = analyseerKettlebellData(data.activiteiten)
  const pr = analyse.resultaat.persoonlijke_records.find(
    p => p.discipline === kettlebellDiscipline && p.bell_weight_kg === bellWeightKg
  )

  if (!pr) {
    return {
      resultaat: { promotion_status: 'no_pr', reason: 'Nog geen PR gelogd voor deze discipline en bell weight.' },
      reden: ['Geen kettlebell_gs_sessions-data voor deze combinatie.'],
      databronnen: ['kettlebell_gs_sessions'],
      gegenereerd_op: new Date().toISOString(),
    }
  }

  const classificatie = await classificeerAtleet({ discipline, sex, bodyweightClass, rankingBlock, bestReps: pr.reps })

  if (classificatie.resultaat.status === 'unavailable') {
    return {
      resultaat: { promotion_status: 'unavailable', best_reps: pr.reps, reason: classificatie.resultaat.reason },
      reden: classificatie.reden,
      databronnen: classificatie.databronnen,
      gegenereerd_op: new Date().toISOString(),
    }
  }

  const required = classificatie.resultaat.required_reps_for_next
  const progress = required && required > 0 ? Math.min(100, Math.round((pr.reps / required) * 100)) : undefined

  return {
    resultaat: {
      // Altijd pending_source_verification — nooit een definitieve
      // promotieclaim zolang bell_weight_kg NULL is op alle onderliggende rijen.
      promotion_status: 'pending_source_verification',
      current_class: classificatie.resultaat.current_class,
      next_class: classificatie.resultaat.next_class,
      best_reps: pr.reps,
      gap: classificatie.resultaat.gap,
      progress_pct: progress,
      reason: classificatie.resultaat.reason,
      bell_weight_note: classificatie.resultaat.bell_weight_note,
    },
    reden: ['PR gekoppeld aan voorlopige WKSF-classificatie (blok expliciet gekozen door gebruiker, geen bell-weight-afleiding).'],
    databronnen: ['kettlebell_gs_sessions', 'kettlebell_classifications'],
    gegenereerd_op: new Date().toISOString(),
  }
}
