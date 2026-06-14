export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { processStravaActivity, type StravaActivity, SPORT_TYPE_MAP } from '@/lib/strava-activity-processor'

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

// POST — handmatige sync (laatste 30 dagen)
export async function POST() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()

    const { data: tokenData } = await supabase
      .from('strava_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!tokenData) {
      return NextResponse.json({ error: 'Strava niet gekoppeld' }, { status: 400 })
    }

    const accessToken = await refreshTokenIfNeeded(tokenData)

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
      const result = await processStravaActivity(user.id, activity as StravaActivity)
      if (result.imported) imported++
      else skipped++
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
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!data) return NextResponse.json({ connected: false })

    // Verifieer dat de token nog geldig is (of refreshable)
    // Als de token verlopen is, probeer te verversen
    const now = Math.floor(Date.now() / 1000)
    if (data.expires_at <= now) {
      try {
        await refreshTokenIfNeeded(data)
      } catch {
        // Refresh mislukt — token ongeldig, als niet-gekoppeld beschouwen
        return NextResponse.json({ connected: false })
      }
    }

    return NextResponse.json({
      connected: true,
      athlete_name: data?.athlete_name || null,
      athlete: data || null,
    })
  } catch {
    return NextResponse.json({ connected: false })
  }
}
