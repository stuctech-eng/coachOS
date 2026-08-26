export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import {
  haalRowingDashboard, haalRowingCTLATLTSB, haalWekelijkseRowingTrend, haalRowingRecords, haalRowingAfstandTrends,
  haalRowingRecenteSessies, haalRowingPeriodeVergelijking,
} from '@/lib/specialists/rowing-grafieken'

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
//
// v2.4.369 (Roeiprestaties-uitbreiding, Fase 2-live-gevalideerd,
// 25 augustus 2026): periodeselector §18 (?periode=7D/30D/3M/6M/1J).
// ?weken= blijft ondersteund als fallback — geen breaking change voor
// eventuele andere aanroepers. recente_sessies (§30) en
// periode_vergelijking (§24) toegevoegd, beide via nieuwe, losse
// functies in rowing-grafieken.ts — dashboard/ctl_atl_tsb/
// wekelijkse_trend/records/afstand_trends hierboven zijn niet
// aangeraakt.

const PERIODE_NAAR_DAGEN: Record<string, number> = {
  '7D': 7, '30D': 30, '3M': 90, '6M': 180, '1J': 365,
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const url = new URL(req.url)
    const periodeParam = url.searchParams.get('periode')
    const wekenParam = url.searchParams.get('weken')
    const dagen = (periodeParam && PERIODE_NAAR_DAGEN[periodeParam])
      || (wekenParam ? parseInt(wekenParam, 10) * 7 : 30)
    const weken = Math.ceil(dagen / 7)

    const [dashboard, ctlAtlTsb, wekelijkseTrend, records, afstandTrends, recenteSessies, periodeVergelijking] = await Promise.all([
      haalRowingDashboard(user.id),
      haalRowingCTLATLTSB(user.id, dagen),
      haalWekelijkseRowingTrend(user.id, weken),
      haalRowingRecords(user.id),
      haalRowingAfstandTrends(user.id),
      haalRowingRecenteSessies(user.id, 10),
      haalRowingPeriodeVergelijking(user.id, dagen),
    ])

    return NextResponse.json({
      dashboard,
      ctl_atl_tsb: ctlAtlTsb,
      wekelijkse_trend: wekelijkseTrend,
      records,
      afstand_trends: afstandTrends,
      recente_sessies: recenteSessies,
      periode_vergelijking: periodeVergelijking,
      periode_dagen: dagen,
      tss_is_schatting: true, // expliciet in de respons — geen NP-achtig gegeven beschikbaar, zelfde als Running
    })
  } catch (err) {
    console.error('[specialists/rowing/grafieken]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}
