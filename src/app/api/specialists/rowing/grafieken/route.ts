export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { haalRowingDashboard, haalRowingCTLATLTSB, haalWekelijkseRowingTrend, haalRowingRecords, haalRowingAfstandTrends } from '@/lib/specialists/rowing-grafieken'

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

// ── Rowing grafieken-route — Performance Center, 8 augustus 2026 ────────
// Bron: bevestigd gat ("Rowing Performance Center ontbreekt", Cycling/
// Running hebben het al) — Activiteiten-scherm-verificatiefase.
//
// v2.4.310: records/afstand_trends toegevoegd — bewust ZONDER nieuwe
// tabel (zie module-comment in rowing-grafieken.ts voor de volledige
// toelichting: roeiers doen typisch hele sessies als testafstand,
// query-time af te leiden uit activity_sessions, geen Running-achtige
// lap-extractie nodig). Eerlijke beperking: alleen Concept2-sessies
// (metrics.precieze_duur_sec), Garmin TCX-Rowing nog niet.

export async function GET(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const url = new URL(req.url)
    const weken = parseInt(url.searchParams.get('weken') || '12', 10)

    const [dashboard, ctlAtlTsb, wekelijkseTrend, records, afstandTrends] = await Promise.all([
      haalRowingDashboard(user.id),
      haalRowingCTLATLTSB(user.id, weken * 7),
      haalWekelijkseRowingTrend(user.id, weken),
      haalRowingRecords(user.id),
      haalRowingAfstandTrends(user.id),
    ])

    return NextResponse.json({
      dashboard,
      ctl_atl_tsb: ctlAtlTsb,
      wekelijkse_trend: wekelijkseTrend,
      records,
      afstand_trends: afstandTrends,
      tss_is_schatting: true, // expliciet in de respons — geen NP-achtig gegeven beschikbaar, zelfde als Running
    })
  } catch (err) {
    console.error('[specialists/rowing/grafieken]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}
