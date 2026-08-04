export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { genereerTrainingsplanCore, verlengRollingHorizonIndienNodigCore } from '@/lib/specialists/training-plan-engine/core'
import { voerDailyAdjustmentUitCore } from '@/lib/specialists/training-plan-engine/adjuster-core'
import { rowingAdapter } from '@/lib/specialists/training-plan-engine/rowing-adapter'

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

// ── Adaptive Training Plan Engine (Rowing) — Fase 1, stap 3 ─────────────
// Bron: Rowing Platform Master Vision (1 augustus 2026) — Rowing Adapter
// bovenop de gedeelde Training Plan Engine Core (zie training-plan-engine/).
// Exact hetzelfde patroon als de Running-route — zelfde functienamen,
// zelfde structuur, alleen de adapter en sport-filter verschillen.
// GET: haalt het actuele actieve Rowing-plan op — voert eerst de Daily
// Adjustment Layer uit, dan pas de actuele sessies teruggeven.
// POST: genereert een volledig nieuw plan.

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()

    const { data: plan } = await supabase
      .from('training_plans')
      .select('*')
      .eq('athlete_id', user.id)
      .eq('sport', 'rowing')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!plan) {
      const { data: gepauzeerdPlan } = await supabase
        .from('training_plans')
        .select('id')
        .eq('athlete_id', user.id).eq('sport', 'rowing').eq('status', 'abandoned')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return NextResponse.json({ plan: null, sessies: [], aanpassingen: [], heeftGepauzeerdPlan: !!gepauzeerdPlan })
    }

    // v2.4.248-FIX: rolling horizon-verlenging, zelfde patroon als Running
    try {
      await verlengRollingHorizonIndienNodigCore(user.id, plan.id, rowingAdapter)
    } catch (verlengErr) {
      console.error('[training-plan GET] Rolling horizon-verlenging mislukt:', verlengErr)
    }

    let aanpassingen: import('@/lib/specialists/training-plan-engine/types').AanpassingResultaat[] = []
    try {
      // v2.4.265 (ADR-007): fatigueSignaal wordt hier bewust genegeerd —
      // deze route toont alleen het PLAN + welke sessies er staan, de
      // daadwerkelijke workout-aanpassing (incl. fatigue-signaal)
      // gebeurt pas in de /workout-sub-route, samen met het kruis-
      // sport-signaal, in ÉÉN gecombineerde aanroep.
      const resultaat = await voerDailyAdjustmentUitCore(user.id, plan.id, rowingAdapter)
      aanpassingen = resultaat.aanpassingen
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
    // nooit twee actieve plannen tegelijk. Sport-filter voorkomt dat dit
    // per ongeluk een actief Cycling/Running-plan afsluit.
    await supabase.from('training_plans').update({ status: 'abandoned' }).eq('athlete_id', user.id).eq('sport', 'rowing').eq('status', 'active')

    const resultaat = await genereerTrainingsplanCore(user.id, rowingAdapter)
    return NextResponse.json(resultaat)
  } catch (err) {
    console.error('[training-plan POST]', err)
    return NextResponse.json({ error: (err as Error).message || 'Genereren mislukt' }, { status: 500 })
  }
}

// v2.4.223: Pauzeer/Hervat — hergebruikt de al-bestaande 'abandoned'-
// status, zelfde patroon als Cycling/Running.
export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()
    const { action } = await req.json()

    if (action === 'pause') {
      const { data: plan } = await supabase
        .from('training_plans')
        .select('id')
        .eq('athlete_id', user.id).eq('sport', 'rowing').eq('status', 'active')
        .maybeSingle()
      if (!plan) return NextResponse.json({ error: 'Geen actief plan om te pauzeren' }, { status: 400 })

      await supabase.from('training_plans').update({ status: 'abandoned' }).eq('id', plan.id)
      return NextResponse.json({ success: true, status: 'paused' })
    }

    if (action === 'resume') {
      const { data: actiefPlan } = await supabase
        .from('training_plans')
        .select('id')
        .eq('athlete_id', user.id).eq('sport', 'rowing').eq('status', 'active')
        .maybeSingle()
      if (actiefPlan) return NextResponse.json({ error: 'Er is al een ander actief plan — hervatten zou twee actieve plannen opleveren' }, { status: 400 })

      const { data: gepauzeerdPlan } = await supabase
        .from('training_plans')
        .select('id')
        .eq('athlete_id', user.id).eq('sport', 'rowing').eq('status', 'abandoned')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!gepauzeerdPlan) return NextResponse.json({ error: 'Geen gepauzeerd plan gevonden' }, { status: 400 })

      await supabase.from('training_plans').update({ status: 'active' }).eq('id', gepauzeerdPlan.id)
      return NextResponse.json({ success: true, status: 'resumed' })
    }

    return NextResponse.json({ error: 'Onbekende actie' }, { status: 400 })
  } catch (err) {
    console.error('[training-plan PATCH]', err)
    return NextResponse.json({ error: (err as Error).message || 'Actie mislukt' }, { status: 500 })
  }
}
