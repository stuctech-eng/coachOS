import { createAdminClient } from '@/lib/supabase'

// ── Data Layer voor Running ─────────────────────────────────────────────
// Spiegelbeeld van cycling-data.ts (v2.4.61). Activiteitnaam geverifieerd
// in strava-activity-processor.ts (SPORT_TYPE_MAP: Run → 'Hardlopen') en
// tcx-parser.ts (ACTIVITEIT_OPTIES: 'Hardlopen', geen indoor/buiten-
// splitsing zoals bij Fietsen).

export interface RunningActiviteit {
  id: string
  date: string
  duration: number
  metrics: Record<string, number> | null
  source: string
  notes: string | null
  activities: { name: string } | { name: string }[] | null
}

export interface RunningTrainingResultaat {
  training_type: string
  actual_duration: number | null
  rating: number | null
  perceived_effort: number | null
  notes: string | null
  completed_at: string
  running_technique_rating: number | null
  running_pacing_rating: number | null
  running_fatigue_rating: number | null
  running_rpe_rating: number | null
}

export interface RunningDataResult {
  specialist_type: 'running'
  period_days: number
  activiteiten: RunningActiviteit[]
  trainingsresultaten: RunningTrainingResultaat[]
}

const RUNNING_ACTIVITEIT_NAMEN = ['Hardlopen']

export async function haalRunningData(userId: string, periodDays: number): Promise<RunningDataResult> {
  const periodeStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()
  const periodeStartDatum = periodeStart.split('T')[0]

  const supabase = createAdminClient()

  const [activiteitenRes, trainingenRes] = await Promise.all([
    supabase
      .from('activity_sessions')
      .select('id, date, duration, metrics, source, notes, activities!inner(name)')
      .eq('user_id', userId)
      .in('activities.name', RUNNING_ACTIVITEIT_NAMEN)
      .gte('date', periodeStartDatum)
      .order('date', { ascending: true }),
    supabase
      .from('training_results')
      .select('training_type, actual_duration, rating, perceived_effort, notes, completed_at, running_technique_rating, running_pacing_rating, running_fatigue_rating, running_rpe_rating')
      .eq('user_id', userId)
      .eq('training_type', 'running')
      .eq('completed', true)
      .gte('completed_at', periodeStart)
      .order('completed_at', { ascending: true }),
  ])

  if (activiteitenRes.error) throw activiteitenRes.error
  if (trainingenRes.error) throw trainingenRes.error

  return {
    specialist_type: 'running',
    period_days: periodDays,
    activiteiten: (activiteitenRes.data || []) as RunningActiviteit[],
    trainingsresultaten: (trainingenRes.data || []) as RunningTrainingResultaat[],
  }
}
