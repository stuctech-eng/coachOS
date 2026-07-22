export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { haalWekelijkseRunningTrend, haalRunningCTLATLTSB, haalRunningRecords, haalAfstandTrends } from '@/lib/specialists/running-grafieken'

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

// ── Running grafieken-route — Fase 2 (Professional) ─────────────────────
// Bron: overleg 22 juli 2026. Spiegelt api/specialists/cycling/grafieken,
// maar met Running's eigen bestaande functies (pace i.p.v. vermogen).
// Geen nieuwe berekeningen — alles bestond al in running-grafieken.ts,
// alleen nooit samengevoegd achter één route.

export async function GET(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const url = new URL(req.url)
    const weken = parseInt(url.searchParams.get('weken') || '12', 10)

    const [wekelijkseTrend, ctlAtlTsb, records, afstandTrends] = await Promise.all([
      haalWekelijkseRunningTrend(user.id, weken),
      haalRunningCTLATLTSB(user.id, weken * 7),
      haalRunningRecords(user.id),
      haalAfstandTrends(user.id),
    ])

    return NextResponse.json({
      wekelijkse_trend: wekelijkseTrend,
      ctl_atl_tsb: ctlAtlTsb,
      records,
      afstand_trends: afstandTrends,
      tss_is_schatting: true, // expliciet in de respons — geen NP-achtig gegeven beschikbaar
    })
  } catch (err) {
    console.error('[specialists/running/grafieken]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}
