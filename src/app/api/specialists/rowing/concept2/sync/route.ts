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
  haalGeldigToken,
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

// v2.4.373: haalGeldigToken verhuisd naar concept2-result-processor.ts
// (geëxporteerd) — de nieuwe intervaldata-detailcall daar heeft 'm ook
// nodig, en de webhook-route had helemaal geen tokenlogica. Zie de
// module-comment daar voor de volledige toelichting.

export async function POST() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()

    const accessToken = await haalGeldigToken(supabase, user.id)
    if (!accessToken) {
      return NextResponse.json({ error: 'Geen geldige Concept2-koppeling — verbind opnieuw' }, { status: 400 })
    }

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
