export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { processStravaActivity, type StravaActivity } from '@/lib/strava-activity-processor'

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

  console.log('[strava/sync] Token verlopen of bijna verlopen, verversen...')
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
  if (!data.access_token) {
    console.error('[strava/sync] Token refresh mislukt:', data)
    throw new Error('Token refresh mislukt')
  }

  const supabase = createAdminClient()
  await supabase.from('strava_tokens').update({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
  }).eq('user_id', token.user_id)

  console.log('[strava/sync] Token succesvol ververst')
  return data.access_token
}

// v2.4.22: REBUILD — eigen timeout op de Strava-aanroep. Voorheen had de
// fetch naar Strava's API geen enkele timeout: bij een trage response bleef
// de request oneindig hangen (of tot een Vercel platform-timeout, zonder
// duidelijke foutmelding naar de gebruiker). Dit verklaarde het "blijft
// laden zonder resultaat"-symptoom. AbortController met een expliciete
// limiet van 20 seconden — ruim genoeg voor een normale Strava-respons,
// kort genoeg om de gebruiker nooit lang te laten wachten zonder feedback.
const STRAVA_TIMEOUT_MS = 20000

async function fetchStravaActivitiesWithTimeout(accessToken: string, afterTimestamp: number): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), STRAVA_TIMEOUT_MS)
  try {
    const res = await fetch(
      'https://www.strava.com/api/v3/athlete/activities?after=' + afterTimestamp + '&per_page=50',
      { headers: { 'Authorization': 'Bearer ' + accessToken }, signal: controller.signal }
    )
    return res
  } finally {
    clearTimeout(timeoutId)
  }
}

// POST — handmatige sync (laatste 30 dagen)
export async function POST() {
  const startTime = Date.now()
  console.log('[strava/sync] Start sync')

  try {
    const user = await getUser()
    if (!user) {
      console.warn('[strava/sync] Geen ingelogde gebruiker')
      return NextResponse.json({ success: false, error: 'Niet ingelogd', message: 'Niet ingelogd' }, { status: 401 })
    }

    const supabase = createAdminClient()

    const { data: tokenData } = await supabase
      .from('strava_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!tokenData) {
      console.warn('[strava/sync] Geen Strava-token voor user', user.id)
      return NextResponse.json({ success: false, error: 'Strava niet gekoppeld', message: 'Strava niet gekoppeld' }, { status: 400 })
    }

    let accessToken: string
    try {
      accessToken = await refreshTokenIfNeeded(tokenData)
    } catch (tokenErr) {
      console.error('[strava/sync] Token-fout:', tokenErr)
      return NextResponse.json({
        success: false,
        error: 'Strava-token verversen mislukt — koppel Strava opnieuw',
        message: 'Strava-token verversen mislukt — koppel Strava opnieuw',
      }, { status: 401 })
    }

    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60)

    let activitiesResponse: Response
    try {
      console.log('[strava/sync] Ophalen activiteiten bij Strava API...')
      activitiesResponse = await fetchStravaActivitiesWithTimeout(accessToken, thirtyDaysAgo)
    } catch (fetchErr) {
      const isTimeout = (fetchErr as Error).name === 'AbortError'
      console.error('[strava/sync] Strava API fetch gefaald:', isTimeout ? 'TIMEOUT na ' + STRAVA_TIMEOUT_MS + 'ms' : fetchErr)
      return NextResponse.json({
        success: false,
        error: isTimeout ? 'Strava reageerde niet binnen 20 seconden — probeer het later opnieuw' : 'Strava API niet bereikbaar',
        message: isTimeout ? 'Strava reageerde niet binnen 20 seconden — probeer het later opnieuw' : 'Strava API niet bereikbaar',
      }, { status: 504 })
    }

    if (activitiesResponse.status === 429) {
      console.warn('[strava/sync] Strava rate limit bereikt (429)')
      return NextResponse.json({
        success: false,
        error: 'Strava rate limit bereikt — probeer over enkele minuten opnieuw',
        message: 'Strava rate limit bereikt — probeer over enkele minuten opnieuw',
      }, { status: 429 })
    }

    if (activitiesResponse.status === 401) {
      console.warn('[strava/sync] Strava token ongeldig (401) ondanks refresh')
      return NextResponse.json({
        success: false,
        error: 'Strava-koppeling verlopen — koppel Strava opnieuw via Instellingen',
        message: 'Strava-koppeling verlopen — koppel Strava opnieuw via Instellingen',
      }, { status: 401 })
    }

    if (!activitiesResponse.ok) {
      console.error('[strava/sync] Strava API gaf status', activitiesResponse.status)
      return NextResponse.json({
        success: false,
        error: 'Strava API fout (status ' + activitiesResponse.status + ')',
        message: 'Strava API fout (status ' + activitiesResponse.status + ')',
      }, { status: 500 })
    }

    const activities = await activitiesResponse.json()
    if (!Array.isArray(activities)) {
      console.error('[strava/sync] Onverwacht Strava API antwoord (geen array):', activities)
      return NextResponse.json({
        success: false,
        error: 'Onverwacht antwoord van Strava',
        message: 'Onverwacht antwoord van Strava',
      }, { status: 500 })
    }

    console.log('[strava/sync]', activities.length, 'activiteiten opgehaald van Strava, verwerken...')

    let imported = 0
    let skipped = 0
    const importedNames: string[] = []
    const errors: string[] = []

    for (const activity of activities) {
      try {
        const result = await processStravaActivity(user.id, activity as StravaActivity)
        if (result.imported) {
          imported++
          importedNames.push((activity as StravaActivity).sport_type + ' (' + (activity as StravaActivity).start_date?.split('T')[0] + ')')
        } else {
          skipped++
        }
      } catch (procErr) {
        console.error('[strava/sync] Verwerken activiteit', (activity as StravaActivity).id, 'mislukt:', procErr)
        errors.push('Activiteit ' + (activity as StravaActivity).id + ': ' + (procErr as Error).message)
      }
    }

    const duurMs = Date.now() - startTime
    console.log('[strava/sync] Klaar in', duurMs, 'ms —', imported, 'geïmporteerd,', skipped, 'al aanwezig,', errors.length, 'fouten')

    const bericht = imported + ' activiteiten geïmporteerd, ' + skipped + ' al aanwezig' +
      (errors.length > 0 ? ' (' + errors.length + ' fout(en), zie logs)' : '')

    return NextResponse.json({
      success: true,
      message: bericht,
      imported,
      skipped,
      importedNames,
      errors: errors.length > 0 ? errors : undefined,
      duurMs,
    })

  } catch (error) {
    console.error('[strava/sync] Onverwachte fout:', error)
    return NextResponse.json({
      success: false,
      error: 'Sync mislukt: ' + (error as Error).message,
      message: 'Sync mislukt: ' + (error as Error).message,
    }, { status: 500 })
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

    const now = Math.floor(Date.now() / 1000)
    if (data.expires_at <= now) {
      try {
        await refreshTokenIfNeeded(data)
      } catch {
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
