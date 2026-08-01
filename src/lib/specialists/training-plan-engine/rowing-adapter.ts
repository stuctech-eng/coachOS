import { createAdminClient } from '@/lib/supabase'
import { haalRowingData } from '../rowing-data'
import type { MesocycleType, TrainingPlanSportAdapter } from './types'

// ── Rowing Adapter ────────────────────────────────────────────────────────
// Bron: Rowing Platform Master Vision (1 augustus 2026), Fase 1 stap 3.
// Zelfde structuur als cycling-adapter.ts/running-adapter.ts — de Core
// (periodisering/mesocycli/adaptieve aanpassingen) is al 100%
// sport-agnostisch, deze adapter levert alleen de roei-specifieke
// verschillen.
//
// Terminologie afgestemd op de al-bestaande rowing-drills.ts
// (session_type: 'recovery'/'endurance'/'interval'/'test') — geen
// nieuwe, parallelle vocabulaire verzonnen. 'lange_afstand' is nieuw
// (net als cycling/running een apart "lange" type heeft naast de
// basis-duurtraining), matcht de al-bestaande "Lange Afstand Row"-drill.
//
// v2.4.223: haalHuidigeWekelijkseUren gebruikt haalRowingData()
// rechtstreeks (geen aparte analyseerRowing()-functie — die hoort bij
// de latere "Analyse-engine"-stap, hier bewust niet vooruit gebouwd).

function verdeelSessieTypen(trainingsdagen: string[], mesocycleType: MesocycleType): Array<{ dag: string; type: string }> {
  const aantal = trainingsdagen.length
  if (aantal === 0) return []

  const typesBijAantal: Record<number, string[]> = {
    1: ['endurance'],
    2: ['endurance', 'endurance'],
    3: ['endurance', mesocycleType === 'herstel' ? 'recovery' : 'interval', 'lange_afstand'],
    4: ['endurance', mesocycleType === 'herstel' ? 'recovery' : 'interval', 'recovery', 'lange_afstand'],
    5: ['endurance', mesocycleType === 'herstel' ? 'recovery' : 'interval', 'recovery', 'endurance', 'lange_afstand'],
  }
  const types = typesBijAantal[Math.min(aantal, 5)] || typesBijAantal[5]

  const finaleTypes = mesocycleType === 'herstel'
    ? types.map(t => t === 'interval' ? 'endurance' : t)
    : types

  return trainingsdagen.slice(0, aantal).map((dag, i) => ({ dag, type: finaleTypes[i] || 'endurance' }))
}

export const rowingAdapter: TrainingPlanSportAdapter = {
  sport: 'rowing',
  specialistType: 'rowing',
  hoogIntensiteitsType: 'interval',
  vervangingBijBeperking: 'endurance',
  vervangingBijVermoeidheid: 'recovery',

  async haalProfiel(userId: string) {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('specialist_profiles')
      .select('preferences')
      .eq('user_id', userId)
      .eq('specialist_type', 'rowing')
      .maybeSingle()
    const prefs = (data?.preferences || {}) as { trainingsdagen?: string[]; beschikbare_uren_per_week?: number }
    return { trainingsdagen: prefs.trainingsdagen || [], beschikbare_uren_per_week: prefs.beschikbare_uren_per_week || 3 }
  },

  async haalHuidigeWekelijkseUren(userId: string) {
    const data = await haalRowingData(userId, 90)
    const totaalMinuten = data.activiteiten.reduce((som, a) => som + a.duration, 0)
    return totaalMinuten / 90 * 7 / 60
  },

  verdeelSessieTypen,
}
