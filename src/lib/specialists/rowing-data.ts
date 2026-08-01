import { createAdminClient } from '@/lib/supabase'

// ── Data Layer voor Rowing ────────────────────────────────────────────────
// Spiegelbeeld van running-data.ts/cycling-data.ts. Activiteitnaam
// geverifieerd in strava-activity-processor.ts (Rowing → 'Roeien') en
// tcx-parser.ts (ACTIVITEIT_OPTIES: 'Roeien').
//
// v2.4.216 (Rowing Platform Fase 1, stap 1 — basisstructuur): geen
// Concept2-koppeling nog — deze data-layer leest wat al binnenkomt via
// bestaande paden (handmatige invoer, Strava, TCX-import). Zodra de
// Concept2 OAuth-koppeling er is (aparte stap, wacht op API-sleutels),
// komt daar een extra bron bij — deze functie hoeft dan niet te
// wijzigen, alleen de sync-laag die 'm vult.

export interface RowingActiviteit {
  id: string
  date: string
  duration: number
  metrics: Record<string, number> | null
  source: string
  notes: string | null
  activities: { name: string } | { name: string }[] | null
}

export interface RowingTrainingResultaat {
  training_type: string
  actual_duration: number | null
  rating: number | null
  perceived_effort: number | null
  notes: string | null
  completed_at: string
}

export interface RowingDataResult {
  specialist_type: 'rowing'
  period_days: number
  activiteiten: RowingActiviteit[]
  trainingsresultaten: RowingTrainingResultaat[]
}

const ROWING_ACTIVITEIT_NAMEN = ['Roeien']

export async function haalRowingData(userId: string, periodDays: number): Promise<RowingDataResult> {
  const periodeStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()
  const periodeStartDatum = periodeStart.split('T')[0]

  const supabase = createAdminClient()

  const [activiteitenRes, trainingenRes] = await Promise.all([
    supabase
      .from('activity_sessions')
      .select('id, date, duration, metrics, source, notes, activities!inner(name)')
      .eq('user_id', userId)
      .in('activities.name', ROWING_ACTIVITEIT_NAMEN)
      .gte('date', periodeStartDatum)
      .order('date', { ascending: true }),
    supabase
      .from('training_results')
      .select('training_type, actual_duration, rating, perceived_effort, notes, completed_at')
      .eq('user_id', userId)
      .eq('training_type', 'rowing')
      .eq('completed', true)
      .gte('completed_at', periodeStart)
      .order('completed_at', { ascending: true }),
  ])

  if (activiteitenRes.error) throw activiteitenRes.error
  if (trainingenRes.error) throw trainingenRes.error

  return {
    specialist_type: 'rowing',
    period_days: periodDays,
    activiteiten: (activiteitenRes.data || []) as RowingActiviteit[],
    trainingsresultaten: (trainingenRes.data || []) as RowingTrainingResultaat[],
  }
}
