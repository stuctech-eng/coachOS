export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { evalueerEnBewaarLeerpatronenIndienNodig } from '@/lib/specialists/learning-rules-koppeling'
import type { GeleerdPatroon } from '@/core/athlete-platform/learned-adjustments'
import {
  type Concept2Result,
  haalOfMaakRoeiActiviteit,
  verwerkConcept2Resultaat,
} from '@/lib/specialists/concept2-result-processor'

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

// v2.4.219 (Rowing Platform Fase 1, stap 2 — data-sync): haalt
// resultaten op bij Concept2 (GET /api/users/me/results?type=rower) en
// slaat ze op in activity_sessions.
//
// v2.4.286 (Concept2-webhook): de per-resultaat-verwerking (idempotency/
// metrics/matching/dedup) is verhuisd naar
// specialists/concept2-result-processor.ts — deze route roept die functie
// nu aan i.p.v. de logica zelf te bevatten. Gedrag ongewijzigd (pure
// extractie), nodig omdat de nieuwe webhook-route exact dezelfde stappen
// nodig heeft voor telkens één resultaat i.p.v. een hele lijst.

async function haalGeldigToken(userId: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data: tokenRij } = await supabase
    .from('concept2_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (!tokenRij) return null

  if (new Date(tokenRij.expires_at).getTime() > Date.now() + 5 * 60 * 1000) {
    return tokenRij.access_token
  }

  const clientId = process.env.CONCEPT2_CLIENT_ID
  const clientSecret = process.env.CONCEPT2_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  const refreshRes = await fetch('https://log.concept2.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: tokenRij.refresh_token,
      scope: 'results:read',
    }),
  })
  if (!refreshRes.ok) {
    console.error('[concept2/sync] Token-vernieuwing mislukt:', refreshRes.status, await refreshRes.text())
    return null
  }
  const nieuweTokens = await refreshRes.json() as { access_token: string; refresh_token: string; expires_in: number }
  const nieuweExpiresAt = new Date(Date.now() + nieuweTokens.expires_in * 1000).toISOString()

  await supabase.from('concept2_tokens').update({
    access_token: nieuweTokens.access_token,
    refresh_token: nieuweTokens.refresh_token,
    expires_at: nieuweExpiresAt,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId)

  return nieuweTokens.access_token
}

export async function POST() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const accessToken = await haalGeldigToken(user.id)
    if (!accessToken) {
      return NextResponse.json({ error: 'Geen geldige Concept2-koppeling — verbind opnieuw' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const van = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    let alleResultaten: Concept2Result[] = []
    let volgendeUrl: string | null =
      `https://log.concept2.com/api/users/me/results?type=rower&from=${van}&number=100`

    let ruweEersteRespons: unknown = null
    let paginas = 0
    while (volgendeUrl && paginas < 20) {
      const res: Response = await fetch(volgendeUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.c2logbook.v1+json',
        },
      })
      if (!res.ok) {
        const tekst = await res.text()
        console.error('[concept2/sync] Ophalen resultaten mislukt:', res.status, tekst)
        return NextResponse.json({ error: `Ophalen bij Concept2 mislukt (${res.status}): ${tekst.slice(0, 200)}` }, { status: 502 })
      }
      const json = await res.json() as { data: Concept2Result[]; meta?: { pagination?: { links?: { next?: string } } } }
      if (paginas === 0) ruweEersteRespons = json
      alleResultaten = alleResultaten.concat(json.data || [])
      volgendeUrl = json.meta?.pagination?.links?.next || null
      paginas++
    }

    if (alleResultaten.length === 0) {
      console.error('[concept2/sync] 0 resultaten van Concept2 — ruwe respons:', JSON.stringify(ruweEersteRespons).slice(0, 1000))
    }

    const activiteitId = await haalOfMaakRoeiActiviteit(supabase, user.id)

    let geimporteerd = 0
    let overgeslagen = 0
    let eersteInsertFout: string | null = null

    const { data: geleerdePatronenData } = await supabase
      .from('learned_patterns').select('effect_pad, aanpassing_percentage').eq('user_id', user.id).eq('sport', 'rowing')
    const geleerdePatronen: GeleerdPatroon[] = geleerdePatronenData || []

    for (const resultaat of alleResultaten) {
      const uitkomst = await verwerkConcept2Resultaat(supabase, user.id, activiteitId, resultaat, geleerdePatronen)
      if (uitkomst.status === 'geimporteerd') geimporteerd++
      else if (uitkomst.status === 'overgeslagen') overgeslagen++
      else if (!eersteInsertFout) eersteInsertFout = uitkomst.foutmelding
    }

    if (geimporteerd > 0) {
      await evalueerEnBewaarLeerpatronenIndienNodig(user.id, 'rowing')
    }

    return NextResponse.json({
      geimporteerd, overgeslagen, totaalGevonden: alleResultaten.length,
      eersteInsertFout,
    })
  } catch (err) {
    console.error('[concept2/sync]', err)
    return NextResponse.json({ error: 'Sync mislukt' }, { status: 500 })
  }
}
