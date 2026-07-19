import { createAdminClient } from '@/lib/supabase'
import { analyseerCycling } from '../cycling-analysis'
import type { MesocycleType, TrainingPlanSportAdapter } from './types'

// ── Cycling Adapter ──────────────────────────────────────────────────────
// Bron: overleg 19 juli 2026. Exact de sport-specifieke logica die
// voorheen rechtstreeks in training-plan-generator.ts/-adjuster.ts stond
// — hier verplaatst, NIET gewijzigd van gedrag.

function verdeelSessieTypen(trainingsdagen: string[], mesocycleType: MesocycleType): Array<{ dag: string; type: string }> {
  const aantal = trainingsdagen.length
  if (aantal === 0) return []

  const typesBijAantal: Record<number, string[]> = {
    1: ['duurtraining'],
    2: ['duurtraining', 'duurtraining'],
    3: ['duurtraining', mesocycleType === 'herstel' ? 'herstel' : 'interval', 'lange_duurtraining'],
    4: ['duurtraining', mesocycleType === 'herstel' ? 'herstel' : 'interval', 'herstel', 'lange_duurtraining'],
    5: ['duurtraining', mesocycleType === 'herstel' ? 'herstel' : 'interval', 'herstel', 'duurtraining', 'lange_duurtraining'],
  }
  const types = typesBijAantal[Math.min(aantal, 5)] || typesBijAantal[5]

  const finaleTypes = mesocycleType === 'herstel'
    ? types.map(t => t === 'interval' ? 'duurtraining' : t)
    : types

  return trainingsdagen.slice(0, aantal).map((dag, i) => ({ dag, type: finaleTypes[i] || 'duurtraining' }))
}

export const cyclingAdapter: TrainingPlanSportAdapter = {
  sport: 'cycling',
  specialistType: 'cycling',
  hoogIntensiteitsType: 'interval',
  vervangingBijBeperking: 'duurtraining',
  vervangingBijVermoeidheid: 'herstel',

  async haalProfiel(userId: string) {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('specialist_profiles')
      .select('preferences')
      .eq('user_id', userId)
      .eq('specialist_type', 'cycling')
      .maybeSingle()
    const prefs = (data?.preferences || {}) as { trainingsdagen?: string[]; beschikbare_uren_per_week?: number }
    return { trainingsdagen: prefs.trainingsdagen || [], beschikbare_uren_per_week: prefs.beschikbare_uren_per_week || 4 }
  },

  async haalHuidigeWekelijkseUren(userId: string) {
    const analyse = await analyseerCycling(userId, 90)
    return analyse.resultaat.trainingsbelasting.totale_minuten / 90 * 7 / 60
  },

  verdeelSessieTypen,
}
