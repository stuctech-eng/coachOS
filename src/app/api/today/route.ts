export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth/getAuthenticatedUser'
import { bepaalTodayPlan } from '@/lib/today-engine'

// ── api/today — de enige ingang voor "wat moet ik vandaag doen?" ────────
// Bron: overleg 22 juli 2026. "Dan is er nog maar één ingang." Home
// (en later elk ander scherm dat dit nodig heeft) roept UITSLUITEND
// deze route aan — nooit meer rechtstreeks api/training/today of de
// specialist-trainingsplan-routes voor dit doel.
//
// v2.4.xxx (CoachOS Connect-contract, 28 augustus 2026): gemigreerd van
// een lokale, cookie-only getUser() naar de gedeelde
// getAuthenticatedUser() — accepteert nu ook een native
// Authorization: Bearer-token, naast de bestaande cookie-sessie. Geen
// gedragswijziging voor de PWA: het cookie-pad is exact hetzelfde
// gebleven.

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req)
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const cookieHeader = req.headers.get('cookie') || ''
    const authorizationHeader = req.headers.get('authorization') || req.headers.get('Authorization') || undefined
    // v2.4.184-FIX: baseUrl van het eigen inkomende verzoek i.p.v.
    // VERCEL_URL — garandeert hetzelfde domein als waar de sessie-
    // cookie voor geldig is
    const plan = await bepaalTodayPlan(user.id, cookieHeader, req.nextUrl.origin, authorizationHeader)

    return NextResponse.json({ plan })
  } catch (err) {
    console.error('[api/today]', err)
    return NextResponse.json({ error: 'Kon vandaag niet bepalen' }, { status: 500 })
  }
}
