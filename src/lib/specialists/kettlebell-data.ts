import { createAdminClient } from '@/lib/supabase'

// ── Data Layer voor Kettlebell (Girevoy Sport) ─────────────────────────────
// Spiegelbeeld van rowing-data.ts/cycling-data.ts qua patroon, maar met een
// eigen bron: Girevoy Sport heeft geen natuurlijke GPS/Strava/Garmin-import
// (geen afstand, geen route) — sessies komen uit de nieuwe, aparte tabel
// kettlebell_gs_sessions (handmatige invoer via api/specialists/kettlebell/
// sessions). Dit is bewust GEEN uitbreiding van activity_sessions: GS-sets
// hebben andere kernvelden (discipline, RPM, no-counts) dan wat
// activity_sessions.metrics tot nu toe opslaat voor andere sporten.
//
// Zie docs/kettlebell-specialist-architectuurvoorstel-v1.md §1.5/§3 voor de
// onderbouwing van deze keuze.

export type KettlebellDiscipline = 'jerk' | 'snatch' | 'long_cycle' | 'biathlon'

export interface KettlebellGsSessie {
  id: string
  discipline: KettlebellDiscipline
  bell_weight_kg: number
  duration_sec: number
  reps: number
  rpm_avg: number | null
  hr_avg: number | null
  hr_max: number | null
  rpe: number | null
  technique_score: number | null
  no_counts: number
  federation_id: string | null
  notes: string | null
  performed_at: string
}

export interface KettlebellDataResult {
  specialist_type: 'kettlebell'
  period_days: number
  // Zelfde veldnaam ('activiteiten') als de andere Data Engines, zodat
  // deze functie zonder aanpassing in de generieke
  // api/specialists/[type]/data/route.ts geregistreerd kan worden (die
  // route verwacht { activiteiten, trainingsresultaten }).
  activiteiten: KettlebellGsSessie[]
  // Kettlebell heeft (nog) geen apart "trainingsresultaten"-concept
  // (geen completed-boolean/rating-flow zoals training_results) —
  // bewust lege array i.p.v. een verzonnen structuur.
  trainingsresultaten: []
}

export async function haalKettlebellData(userId: string, periodDays: number): Promise<KettlebellDataResult> {
  const periodeStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('kettlebell_gs_sessions')
    .select('id, discipline, bell_weight_kg, duration_sec, reps, rpm_avg, hr_avg, hr_max, rpe, technique_score, no_counts, federation_id, notes, performed_at')
    .eq('user_id', userId)
    .gte('performed_at', periodeStart)
    .order('performed_at', { ascending: true })

  if (error) throw error

  return {
    specialist_type: 'kettlebell',
    period_days: periodDays,
    activiteiten: (data || []) as KettlebellGsSessie[],
    trainingsresultaten: [],
  }
}
