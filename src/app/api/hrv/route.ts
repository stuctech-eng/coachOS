export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { isoDatum } from '@/utils'
import { berekenHrvTrend, haalHrvTrend } from '@/lib/specialists/health-analysis-engine'

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

// ── HRV — handmatige ochtendwaarde ───────────────────────────────────────
// Bron: overleg 20 juli 2026. Schrijft naar morning_health_metrics
// (gemerged met een eventuele bestaande rij van vandaag, bijv. al een
// Health-screenshot geüpload) i.p.v. het inmiddels vervangen
// hrv_measurements (v2.4.136). Trend wordt LIVE berekend door de Health
// Analysis Engine — niets afgeleids wordt hier opgeslagen.
//
// Ook nog steeds naar health_metrics.hrv (ongewijzigd gedrag t.o.v.
// v2.4.136) — laat de bestaande calculateRecoveryScore() dit
// automatisch meenemen.

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const trend = await haalHrvTrend(user.id)
    return NextResponse.json({ vandaag: trend })
  } catch (err) {
    console.error('[hrv GET]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const body = await req.json()

    if (typeof body.hrv_ms !== 'number' || body.hrv_ms <= 0 || body.hrv_ms > 300) {
      return NextResponse.json({ error: 'HRV moet een getal tussen 1 en 300 ms zijn' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const vandaag = isoDatum(new Date())

    // Merge met een eventueel al-bestaande rij van vandaag (bijv. al een
    // Health-screenshot geüpload) — niet blind overschrijven
    const { data: bestaand } = await supabase
      .from('morning_health_metrics')
      .select('*')
      .eq('user_id', user.id).eq('date', vandaag).maybeSingle()

    const { error: hrvError } = await supabase
      .from('morning_health_metrics')
      .upsert({
        ...(bestaand || {}),
        user_id: user.id, date: vandaag,
        hrv_ms: body.hrv_ms,
        source_type: bestaand ? bestaand.source_type : 'manual',
        import_method: 'manual',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,date' })
    if (hrvError) throw hrvError

    // Ook naar health_metrics.hrv — zie bestandskop, laat de bestaande
    // recovery-score dit automatisch meenemen. v2.4.144: gemerged met
    // een eventueel al-bestaande rij (bijv. rusthartslag/Body Battery
    // van een eerdere foto-upload die dag) — niet blind overschrijven.
    const { data: bestaandeHealthMetrics } = await supabase
      .from('health_metrics')
      .select('*')
      .eq('user_id', user.id).eq('date', vandaag).maybeSingle()

    await supabase.from('health_metrics').upsert({
      ...(bestaandeHealthMetrics || {}),
      user_id: user.id, date: vandaag, hrv: body.hrv_ms,
    }, { onConflict: 'user_id,date' })

    const { data: historie } = await supabase
      .from('morning_health_metrics')
      .select('date, hrv_ms')
      .eq('user_id', user.id)
      .neq('date', vandaag)
      .gte('date', isoDatum(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))

    return NextResponse.json(berekenHrvTrend(body.hrv_ms, historie || []))
  } catch (err) {
    console.error('[hrv POST]', err)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }
}
