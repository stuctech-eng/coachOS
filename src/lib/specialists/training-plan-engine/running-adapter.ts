import { createAdminClient } from '@/lib/supabase'
import { analyseerRunning } from '../running-analysis'
import type { MesocycleType, TrainingPlanSportAdapter } from './types'

// ── Running Adapter ──────────────────────────────────────────────────────
// Bron: overleg 19 juli 2026. Sessietype-vocabulaire uit
// docs/running-specialist-master-spec.md ("Ma Rust / Di Interval /
// Wo Herstel / Do Tempo / Vr Rust / Za Lange duurloop / Zo Easy Run").
// Zelfde verdeel-structuur als de Cycling Adapter (aantal trainingsdagen
// → vaste volgorde van typen), alleen de typenamen verschillen.

function verdeelSessieTypen(trainingsdagen: string[], mesocycleType: MesocycleType): Array<{ dag: string; type: string }> {
  const aantal = trainingsdagen.length
  if (aantal === 0) return []

  const typesBijAantal: Record<number, string[]> = {
    1: ['easy_run'],
    2: ['easy_run', 'easy_run'],
    3: ['easy_run', mesocycleType === 'herstel' ? 'herstel' : 'interval', 'lange_duurloop'],
    4: ['easy_run', mesocycleType === 'herstel' ? 'herstel' : 'interval', 'herstel', 'lange_duurloop'],
    5: ['easy_run', mesocycleType === 'herstel' ? 'herstel' : 'interval', 'herstel', 'tempo', 'lange_duurloop'],
  }
  const types = typesBijAantal[Math.min(aantal, 5)] || typesBijAantal[5]

  const finaleTypes = mesocycleType === 'herstel'
    ? types.map(t => t === 'interval' ? 'easy_run' : t)
    : types

  return trainingsdagen.slice(0, aantal).map((dag, i) => ({ dag, type: finaleTypes[i] || 'easy_run' }))
}

export const runningAdapter: TrainingPlanSportAdapter = {
  sport: 'running',
  specialistType: 'running',
  hoogIntensiteitsType: 'interval',
  vervangingBijBeperking: 'easy_run',
  vervangingBijVermoeidheid: 'herstel',

  async haalProfiel(userId: string) {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('specialist_profiles')
      .select('preferences')
      .eq('user_id', userId)
      .eq('specialist_type', 'running')
      .maybeSingle()
    const prefs = (data?.preferences || {}) as { trainingsdagen?: string[]; beschikbare_uren_per_week?: number }
    return { trainingsdagen: prefs.trainingsdagen || [], beschikbare_uren_per_week: prefs.beschikbare_uren_per_week || 3 }
  },

  async haalHuidigeWekelijkseUren(userId: string) {
    const analyse = await analyseerRunning(userId, 90)
    return analyse.resultaat.trainingsbelasting.totale_minuten / 90 * 7 / 60
  },

  verdeelSessieTypen,
}
