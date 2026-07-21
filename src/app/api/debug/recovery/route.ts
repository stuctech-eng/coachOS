export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { calculateRecoveryScore } from '@/core/ai-engine/recovery-engine'
import { genereerCoachPolicy } from '@/lib/specialists/coach-policy'

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

// ── Recovery Debug Dashboard — API ───────────────────────────────────────
// Bron: overleg 20 juli 2026. Toont exact welke factoren CoachPolicy
// gebruikt en wat elk bijdraagt — puur uitlezen, GEEN eigen berekening.
// Gebruikt dezelfde functies als de echte Coach-routes
// (calculateRecoveryScore + genereerCoachPolicy), dus wat je hier ziet
// is gegarandeerd wat de Coach ook daadwerkelijk gebruikt — geen kans
// dat het dashboard iets anders toont dan de werkelijkheid.

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()
    const vandaag = new Date().toISOString().split('T')[0]

    const [checkinRes, metricsRes, policy] = await Promise.all([
      supabase.from('daily_checkins').select('*').eq('user_id', user.id).eq('date', vandaag).maybeSingle(),
      supabase.from('health_metrics').select('*').eq('user_id', user.id).eq('date', vandaag).maybeSingle(),
      genereerCoachPolicy(user.id),
    ])

    const recovery = calculateRecoveryScore(checkinRes.data || null, metricsRes.data || null)

    return NextResponse.json({
      datum: vandaag,
      heeft_checkin: !!checkinRes.data,
      heeft_health_metrics: !!metricsRes.data,
      recovery,
      policy,
    })
  } catch (err) {
    console.error('[debug/recovery GET]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}
