import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

async function refreshTokenIfNeeded(token: {
  access_token: string
  refresh_token: string
  expires_at: number
  user_id: string
}) {
  const now = Math.floor(Date.now() / 1000)
  if (token.expires_at > now + 300) return token.access_token

  // Token verversen
  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  const data = await response.json()
  if (!data.access_token) throw new Error('Token refresh mislukt')

  const supabase = createAdminClient()
  await supabase.from('strava_tokens').update({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
  }).eq('user_id', token.user_id)

  return data.access_token
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
}

export async function POST() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()

    // Haal Strava token op
    const { data: tokenData } = await supabase
      .from('strava_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!tokenData) {
      return NextResponse.json({ error: 'Strava niet gekoppeld' }, { status: 400 })
    }

    const accessToken = await refreshTokenIfNeeded(tokenData)

    // Haal activiteiten op van laatste 30 dagen
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60)
    const activitiesResponse = await fetch(
      'https://www.strava.com/api/v3/athlete/activities?after=' + thirtyDaysAgo + '&per_page=50',
      { headers: { 'Authorization': 'Bearer ' + accessToken } }
    )

    const activities = await activitiesResponse.json()
    if (!Array.isArray(activities)) {
      return NextResponse.json({ error: 'Strava API fout' }, { status: 500 })
    }

    let imported = 0
    let skipped = 0

    for (const activity of activities) {
      const activityName = SPORT_TYPE_MAP[activity.sport_type] || activity.sport_type || 'Anders'
      const date = activity.start_date.split('T')[0]

      // Zoek bijpassende activity template
      const { data: template } = await supabase
        .from('activity_templates')
        .select('id')
        .eq('name', activityName)
        .single()

      // Zoek of gebruiker deze activiteit al heeft
      let { data: userActivity } = await supabase
        .from('activities')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', activityName)
        .single()

      // Maak activiteit aan als die niet bestaat
      if (!userActivity) {
        const { data: newActivity } = await supabase
          .from('activities')
          .insert({
            user_id: user.id,
            template_id: template?.id || null,
            name: activityName,
          })
          .select()
          .single()
        userActivity = newActivity
      }

      // Check of session al bestaat (op basis van strava ID in notes)
      const { data: existing } = await supabase
        .from('activity_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', date)
        .eq('source', 'strava')
        .ilike('notes', '%strava:' + activity.id + '%')
        .single()

      if (existing) {
        skipped++
        continue
      }

      // Sla activiteit sessie op
      const metrics: Record<string, unknown> = {}
      if (activity.distance) metrics.distance = Math.round(activity.distance)
      if (activity.average_heartrate) metrics.avg_hr = Math.round(activity.average_heartrate)
      if (activity.max_heartrate) metrics.max_hr = Math.round(activity.max_heartrate)
      if (activity.total_elevation_gain) metrics.elevation = Math.round(activity.total_elevation_gain)
      if (activity.average_speed) metrics.avg_speed = Math.round(activity.average_speed * 3.6 * 10) / 10
      if (activity.kilojoules) metrics.calories = Math.round(activity.kilojoules * 0.239)
      // V5.7.1 — vermogen + cadans voor cycling, running en rowing
      if (activity.average_watts) metrics.avg_watts = Math.round(activity.average_watts)
      if (activity.weighted_average_watts) metrics.weighted_avg_watts = Math.round(activity.weighted_average_watts)
      if (activity.average_cadence) metrics.avg_cadence = Math.round(activity.average_cadence)

      await supabase.from('activity_sessions').insert({
        user_id: user.id,
        activity_id: userActivity?.id || null,
        date,
        duration: Math.round(activity.moving_time / 60),
        metrics,
        source: 'strava',
        notes: 'strava:' + activity.id,
      })

      // Sla hartslag op in health_metrics als beschikbaar
      if (activity.average_heartrate) {
        await supabase.from('health_metrics').upsert({
          user_id: user.id,
          date,
          resting_hr: null,
          source: 'strava',
        }, { onConflict: 'user_id,date', ignoreDuplicates: true })
      }

      imported++
    }

    return NextResponse.json({
      message: imported + ' activiteiten geimporteerd, ' + skipped + ' al aanwezig',
      imported,
      skipped,
    })

  } catch (error) {
    console.error('Strava sync error:', error)
    return NextResponse.json({ error: 'Sync mislukt' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ connected: false })

    const supabase = createAdminClient()
    const { data } = await supabase
      .from('strava_tokens')
      .select('athlete_name, updated_at')
      .eq('user_id', user.id)
      .single()

    return NextResponse.json({
      connected: !!data,
      athlete_name: data?.athlete_name || null,
      last_sync: data?.updated_at || null,
    })
  } catch {
    return NextResponse.json({ connected: false })
  }
}
