export const dynamic = 'force-dynamic'

// ─── Strava Webhook ───────────────────────────────────────────────────────────
// GET  — Strava verificatie-handshake (hub.challenge)
// POST — Inkomende activiteits-events (create/update/delete)
//
// ARCHITECTUURREGELS (per spec):
// - Webhook mag NIET Coach AI of Trainer AI aanroepen
// - Webhook mag NIET zware berekeningen doen
// - Webhook moet <1s reageren (Strava retry bij timeout)
// - Alleen: event ontvangen → valideren → activiteit opslaan
// - Follow-up detectie gebeurt later via /api/coach

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { processStravaActivity, fetchStravaActivity } from '@/lib/strava-activity-processor'

// GET — Strava subscription verificatie (eenmalig bij registratie)
// Strava stuurt: ?hub.mode=subscribe&hub.challenge=xxx&hub.verify_token=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const challenge = searchParams.get('hub.challenge')
  const verifyToken = searchParams.get('hub.verify_token')

  const expectedToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN

  if (mode === 'subscribe' && verifyToken === expectedToken && challenge) {
    // Strava verwacht exact dit JSON-formaat terug
    return NextResponse.json({ 'hub.challenge': challenge })
  }

  return NextResponse.json({ error: 'Verificatie mislukt' }, { status: 403 })
}

// POST — Inkomend activiteits-event van Strava
// Payload: { object_type, aspect_type, owner_id, object_id, ... }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { object_type, aspect_type, owner_id, object_id } = body

    // Alleen activiteits-create events verwerken
    // Updates en deletes negeren (niet kritisch voor V5.x)
    if (object_type !== 'activity' || aspect_type !== 'create') {
      return NextResponse.json({ status: 'ignored' })
    }

    if (!owner_id || !object_id) {
      return NextResponse.json({ status: 'ignored', reason: 'missing_ids' })
    }

    const supabase = createAdminClient()

    // Zoek de CoachOS-gebruiker op basis van Strava athlete_id (owner_id)
    const { data: tokenData } = await supabase
      .from('strava_tokens')
      .select('user_id, access_token, refresh_token, expires_at')
      .eq('athlete_id', owner_id)
      .single()

    if (!tokenData) {
      // Geen gekoppelde gebruiker — event negeren
      return NextResponse.json({ status: 'ignored', reason: 'no_user_found' })
    }

    // Token verversen indien nodig
    let accessToken = tokenData.access_token
    const now = Math.floor(Date.now() / 1000)
    if (tokenData.expires_at <= now + 300) {
      const refreshRes = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.STRAVA_CLIENT_ID,
          client_secret: process.env.STRAVA_CLIENT_SECRET,
          refresh_token: tokenData.refresh_token,
          grant_type: 'refresh_token',
        }),
      })
      const refreshData = await refreshRes.json()
      if (refreshData.access_token) {
        accessToken = refreshData.access_token
        await supabase.from('strava_tokens').update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token,
          expires_at: refreshData.expires_at,
        }).eq('user_id', tokenData.user_id)
      }
    }

    // Activiteitsdetails ophalen via Strava API
    const activity = await fetchStravaActivity(object_id, accessToken)
    if (!activity) {
      return NextResponse.json({ status: 'error', reason: 'activity_fetch_failed' })
    }

    // Activiteit opslaan (idempotent — dubbele events worden overgeslagen)
    const result = await processStravaActivity(tokenData.user_id, activity)

    return NextResponse.json({
      status: result.imported ? 'imported' : 'skipped',
      reason: result.reason,
    })

  } catch (error) {
    console.error('[strava/webhook]', error)
    // Altijd 200 teruggeven — Strava retried bij non-200 responses
    return NextResponse.json({ status: 'error' })
  }
}
