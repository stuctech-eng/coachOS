// ─── Gedeelde Strava activiteitsverwerking ────────────────────────────────────
// Gebruikt door zowel handmatige sync (/api/strava/sync) als webhook
// (/api/strava/webhook). Idempotent — dubbele activiteiten worden overgeslagen.

import { createAdminClient } from '@/lib/supabase'
import { haalAthleteState, slaAthleteStateOp } from '@/core/athlete-platform/storage'
import { pasImpactToe, type ImpactBijdrage } from '@/core/athlete-platform/impact-engine'
import { vertaalRunningSessieNaarImpact } from './specialists/running-impact-adapter'
import { vertaalCyclingSessieNaarImpact } from './specialists/cycling-impact-adapter'

// v2.4.244: Cycling toegevoegd — derde sport in de dispatch-tabel,
// zelfde generieke patroon, geen wijziging aan de processor zelf nodig
const IMPACT_ADAPTERS: Record<string, (duurMinuten: number) => ImpactBijdrage[]> = {
  Hardlopen: vertaalRunningSessieNaarImpact,
  Fietsen: vertaalCyclingSessieNaarImpact,
}

const SPORT_TYPE_MAP: Record<string, string> = {
  Run: 'Hardlopen',
  Ride: 'Fietsen',
  Walk: 'Wandelen',
  Swim: 'Zwemmen',
  Hike: 'Wandelen',
  WeightTraining: 'Krachttraining',
  Yoga: 'Yoga',
  Rowing: 'Roeien',
  Padel: 'Padel',
  Tennis: 'Tennis',
  Crossfit: 'CrossFit',
  Kettlebell: 'Kettlebell',
  VirtualRide: 'Fietsen',
  EBikeRide: 'Fietsen',
  NordicSki: 'Nordic Ski',
}

export interface StravaActivity {
  id: number
  sport_type: string
  start_date: string
  moving_time: number
  distance?: number
  average_heartrate?: number
  max_heartrate?: number
  total_elevation_gain?: number
  average_speed?: number
  kilojoules?: number
  average_watts?: number
  weighted_average_watts?: number
  average_cadence?: number
}

export interface ProcessResult {
  imported: boolean
  skipped: boolean
  activity_session_id?: string
  reason?: string
}

/**
 * Verwerkt één Strava-activiteit voor een gebruiker.
 * Idempotent: als de activiteit al bestaat (strava:ID in notes) wordt
 * hij overgeslagen. Geen AI-calls — alleen data opslaan.
 */
export async function processStravaActivity(
  userId: string,
  activity: StravaActivity
): Promise<ProcessResult> {
  const supabase = createAdminClient()
  const activityName = SPORT_TYPE_MAP[activity.sport_type] || activity.sport_type || 'Anders'
  const date = activity.start_date.split('T')[0]

  // Idempotency check — bestaande activiteit via strava:ID in notes
  const { data: existing } = await supabase
    .from('activity_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('source', 'strava')
    .ilike('notes', '%strava:' + activity.id + '%')
    .single()

  if (existing) {
    return { imported: false, skipped: true, reason: 'already_exists' }
  }

  // v2.4.222 (structurele dedup-fix): Concept2 is de meest betrouwbare
  // bron voor roeien (het apparaat zelf, met stroke rate/drag factor).
  // Als er voor dezelfde dag al een Concept2-sessie bestaat, slaat
  // Strava's import over — voorkomt de dubbele "9 juni: strava 25 min
  // + concept2 25 min"-situatie structureel, i.p.v. achteraf op te
  // ruimen. Bewust ALLEEN voor 'Roeien' — geen enkele invloed op de
  // import van andere sporten (Cycling/Running/etc.).
  if (activityName === 'Roeien') {
    const { data: concept2Bestaat } = await supabase
      .from('activity_sessions').select('id')
      .eq('user_id', userId).eq('date', date).eq('source', 'concept2')
      .maybeSingle()
    if (concept2Bestaat) {
      return { imported: false, skipped: true, reason: 'concept2_heeft_voorrang' }
    }
  }

  // Zoek of gebruiker deze activiteitssoort al heeft
  let { data: userActivity } = await supabase
    .from('activities')
    .select('id')
    .eq('user_id', userId)
    .eq('name', activityName)
    .single()

  if (!userActivity) {
    const { data: template } = await supabase
      .from('activity_templates')
      .select('id')
      .eq('name', activityName)
      .single()

    const { data: newActivity } = await supabase
      .from('activities')
      .insert({ user_id: userId, template_id: template?.id || null, name: activityName })
      .select()
      .single()
    userActivity = newActivity
  }

  // Metrics opbouwen
  const metrics: Record<string, unknown> = {}
  if (activity.distance) metrics.distance = Math.round(activity.distance)
  if (activity.average_heartrate) metrics.avg_hr = Math.round(activity.average_heartrate)
  if (activity.max_heartrate) metrics.max_hr = Math.round(activity.max_heartrate)
  if (activity.total_elevation_gain) metrics.elevation = Math.round(activity.total_elevation_gain)
  if (activity.average_speed) metrics.avg_speed = Math.round(activity.average_speed * 3.6 * 10) / 10
  if (activity.kilojoules) metrics.calories = Math.round(activity.kilojoules * 0.239)
  if (activity.average_watts) metrics.avg_watts = Math.round(activity.average_watts)
  if (activity.weighted_average_watts) metrics.weighted_avg_watts = Math.round(activity.weighted_average_watts)
  if (activity.average_cadence) metrics.avg_cadence = Math.round(activity.average_cadence)

  const { data: session, error } = await supabase
    .from('activity_sessions')
    .insert({
      user_id: userId,
      activity_id: userActivity?.id || null,
      date,
      duration: Math.round(activity.moving_time / 60),
      metrics,
      source: 'strava',
      notes: 'strava:' + activity.id,
    })
    .select('id')
    .single()

  if (error) throw error

  // Hartslag opslaan in health_metrics indien beschikbaar
  if (activity.average_heartrate) {
    await supabase.from('health_metrics').upsert({
      user_id: userId,
      date,
      resting_hr: null,
      source: 'strava',
    }, { onConflict: 'user_id,date', ignoreDuplicates: true })
  }

  // v2.4.243 (Universal Athlete Platform): als deze sport een impact-
  // adapter heeft, wordt de Universal Athlete State bijgewerkt. Bewust
  // in een try/catch — een fout hier mag de Strava-import zelf (de
  // kernfunctionaliteit) nooit laten falen, zelfde voorzichtigheids-
  // principe als bij de Concept2-sync-koppeling.
  const impactAdapter = IMPACT_ADAPTERS[activityName]
  if (impactAdapter) {
    try {
      const duurMinuten = Math.round(activity.moving_time / 60)
      const huidigeState = await haalAthleteState(supabase, userId)
      const bijdragen = impactAdapter(duurMinuten)
      const nieuweState = pasImpactToe(huidigeState, bijdragen)
      await slaAthleteStateOp(supabase, userId, nieuweState)
    } catch (athleteStateErr) {
      console.error('[strava-activity-processor] Universal Athlete State bijwerken mislukt (import zelf blijft werken):', athleteStateErr)
    }
  }

  return { imported: true, skipped: false, activity_session_id: session?.id }
}

/**
 * Haalt een Strava-activiteit op via de API met een bestaand access token.
 */
export async function fetchStravaActivity(
  activityId: number,
  accessToken: string
): Promise<StravaActivity | null> {
  const res = await fetch(
    `https://www.strava.com/api/v3/activities/${activityId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) return null
  return res.json()
}

export { SPORT_TYPE_MAP }
