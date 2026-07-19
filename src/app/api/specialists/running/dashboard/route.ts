export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { haalRunningDashboard, haalRunningRecords, haalRunningCTLATLTSB, haalAfstandTrends, haalWekelijkseRunningTrend } from '@/lib/specialists/running-grafieken'

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

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const [dashboard, records, belasting, afstandTrends, wekelijkseTrend] = await Promise.all([
      haalRunningDashboard(user.id),
      haalRunningRecords(user.id),
      haalRunningCTLATLTSB(user.id, 90),
      haalAfstandTrends(user.id),
      haalWekelijkseRunningTrend(user.id, 12),
    ])
    return NextResponse.json({ dashboard, records, belasting, afstand_trends: afstandTrends, wekelijkse_trend: wekelijkseTrend, tss_is_schatting: true })
  } catch (err) {
    console.error('[specialists/running/dashboard]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}
