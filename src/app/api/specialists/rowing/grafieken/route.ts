export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { haalRowingDashboard, haalRowingCTLATLTSB, haalWekelijkseRowingTrend } from '@/lib/specialists/rowing-grafieken'

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
// Running hebben het al) — Activiteiten-scherm-verificatiefase. Spiegelt
// api/specialists/running/grafieken, maar bewust ZONDER records/
// afstand_trends.
//
// Reden, expliciet: Running's haalRunningRecords()/haalAfstandTrends()
// lezen uit `running_distance_records` — een tabel die alleen gevuld
// wordt door parser-logica tijdens TCX-import (tcx-parser.ts +
// afstandscurve.ts). Voor Rowing bestaat geen equivalente tabel, geen
// equivalente import-tijd-berekening. Dat toevoegen is een eigen,
// grotere uitbreiding (nieuwe tabel + parser-wijziging), niet iets wat
// hier stilzwijgend meegenomen kan worden — apart vervolgpunt, expliciet
// vastgelegd in het README, niet nu gebouwd.

export async function GET(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const url = new URL(req.url)
    const weken = parseInt(url.searchParams.get('weken') || '12', 10)

    const [dashboard, ctlAtlTsb, wekelijkseTrend] = await Promise.all([
      haalRowingDashboard(user.id),
      haalRowingCTLATLTSB(user.id, weken * 7),
      haalWekelijkseRowingTrend(user.id, weken),
    ])

    return NextResponse.json({
      dashboard,
      ctl_atl_tsb: ctlAtlTsb,
      wekelijkse_trend: wekelijkseTrend,
      tss_is_schatting: true, // expliciet in de respons — geen NP-achtig gegeven beschikbaar, zelfde als Running
    })
  } catch (err) {
    console.error('[specialists/rowing/grafieken]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}
