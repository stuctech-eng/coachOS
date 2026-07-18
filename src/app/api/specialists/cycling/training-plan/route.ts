export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { genereerTrainingsplan } from '@/lib/specialists/training-plan-generator'
import { voerDailyAdjustmentUit } from '@/lib/specialists/training-plan-adjuster'

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

// ── Adaptive Training Plan Engine — Fase 1, API-laag ────────────────────
// GET: haalt het actuele actieve plan op — voert EERST de Daily
// Adjustment Layer uit (5 triggers, zie training-plan-adjuster.ts), dan
// pas de actuele sessies teruggeven. Zo is elke keer dat de gebruiker
// zijn plan bekijkt, het al up-to-date.
// POST: genereert een volledig nieuw plan (Plan Generator).

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()

    const { data: plan } = await supabase
      .from('training_plans')
      .select('*')
      .eq('athlete_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!plan) return NextResponse.json({ plan: null, sessies: [], aanpassingen: [] })

    let aanpassingen: Awaited<ReturnType<typeof voerDailyAdjustmentUit>> = []
    try {
      aanpassingen = await voerDailyAdjustmentUit(user.id, plan.id)
    } catch (adjustErr) {
      console.error('[training-plan GET] Daily Adjustment Layer mislukt:', adjustErr)
    }

    const { data: sessies } = await supabase
      .from('training_plan_sessions')
      .select('*')
      .eq('plan_id', plan.id)
      .neq('status', 'cancelled')
      .order('date', { ascending: true })

    return NextResponse.json({ plan, sessies: sessies || [], aanpassingen })
  } catch (err) {
    console.error('[training-plan GET]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}

export async function POST() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()

    // Bestaand actief plan afsluiten vóór een nieuw plan wordt gemaakt —
    // nooit twee actieve plannen tegelijk
    await supabase.from('training_plans').update({ status: 'abandoned' }).eq('athlete_id', user.id).eq('status', 'active')

    const resultaat = await genereerTrainingsplan(user.id)
    return NextResponse.json(resultaat)
  } catch (err) {
    console.error('[training-plan POST]', err)
    return NextResponse.json({ error: (err as Error).message || 'Genereren mislukt' }, { status: 500 })
  }
}
