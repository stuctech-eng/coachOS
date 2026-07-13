import { createAdminClient } from '@/lib/supabase'

// ── Gedeelde Data Layer-functie voor Cycling ────────────────────────────
// Geëxtraheerd uit api/specialists/[type]/data/route.ts (v2.4.61) zodat
// de Cycling Analysis Engine (Fase 2b) dit intern kan aanroepen, zonder
// aparte HTTP-roundtrip binnen dezelfde server — zoals vastgelegd in
// docs/specialist-api.md Fase 3 ("roept zelf Fase 2 aan, intern").

export interface CyclingActiviteit {
  id: string
  date: string
  duration: number
  metrics: Record<string, number> | null
  source: string
  notes: string | null
  activities: { name: string } | { name: string }[] | null
}

export interface CyclingTrainingResultaat {
  training_type: string
  actual_duration: number | null
  rating: number | null
  perceived_effort: number | null
  notes: string | null
  completed_at: string
  cycling_technique_rating: number | null
  cycling_pacing_rating: number | null
  cycling_fatigue_rating: number | null
  cycling_rpe_rating: number | null
}

export interface CyclingDataResult {
  specialist_type: 'cycling'
  period_days: number
  activiteiten: CyclingActiviteit[]
  trainingsresultaten: CyclingTrainingResultaat[]
}

const CYCLING_ACTIVITEIT_NAMEN = ['Fietsen', 'Fietsen (buiten)', 'Indoor Fietsen']

export async function haalCyclingData(userId: string, periodDays: number): Promise<CyclingDataResult> {
  const periodeStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()
  const periodeStartDatum = periodeStart.split('T')[0]

  const supabase = createAdminClient()

  const [activiteitenRes, trainingenRes] = await Promise.all([
    supabase
      .from('activity_sessions')
      .select('id, date, duration, metrics, source, notes, activities!inner(name)')
      .eq('user_id', userId)
      .in('activities.name', CYCLING_ACTIVITEIT_NAMEN)
      .gte('date', periodeStartDatum)
      .order('date', { ascending: true }),
    supabase
      .from('training_results')
      .select('training_type, actual_duration, rating, perceived_effort, notes, completed_at, cycling_technique_rating, cycling_pacing_rating, cycling_fatigue_rating, cycling_rpe_rating')
      .eq('user_id', userId)
      .eq('training_type', 'cycling')
      .eq('completed', true)
      .gte('completed_at', periodeStart)
      .order('completed_at', { ascending: true }),
  ])

  if (activiteitenRes.error) throw activiteitenRes.error
  if (trainingenRes.error) throw trainingenRes.error

  return {
    specialist_type: 'cycling',
    period_days: periodDays,
    activiteiten: (activiteitenRes.data || []) as CyclingActiviteit[],
    trainingsresultaten: (trainingenRes.data || []) as CyclingTrainingResultaat[],
  }
}
