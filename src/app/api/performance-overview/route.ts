export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { isoDatum } from '@/utils'
import { haalHrvTrend } from '@/lib/specialists/health-analysis-engine'

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

// ── Performance Overview — platformniveau ───────────────────────────────
// Bron: overleg 20 juli 2026. Bewust GEEN onderdeel van Cycling of
// Running — dit zijn geen sportgegevens, ze horen bij de Master Coach.
// Specialisten en Trainer AI kijken naar dezelfde bron, geen duplicatie.
// Puur lezen + samenvoegen, geen berekening — HRV-trend komt uit de
// bestaande Health Analysis Engine.
//
// Andere naam dan het bestaande /api/performance (dat is een ander
// concept: trainingsprogressie/rating-analyse, niet gezondheidsdata) —
// om verwarring en een naamconflict te voorkomen.

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()
    const vandaag = isoDatum(new Date())

    const [hrvTrend, healthRes, perfRes] = await Promise.all([
      haalHrvTrend(user.id),
      supabase.from('morning_health_metrics').select('*').eq('user_id', user.id).eq('date', vandaag).maybeSingle(),
      supabase.from('performance_snapshots').select('*').eq('user_id', user.id).eq('date', vandaag).maybeSingle(),
    ])

    return NextResponse.json({
      datum: vandaag,
      hrv_trend: hrvTrend,
      health: healthRes.data,
      performance: perfRes.data,
    })
  } catch (err) {
    console.error('[performance-overview GET]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}
