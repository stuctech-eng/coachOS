export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
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
      .eq('sport', 'cycling')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!plan) {
      const { data: gepauzeerdPlan } = await supabase
        .from('training_plans')
        .select('id')
        .eq('athlete_id', user.id).eq('sport', 'cycling').eq('status', 'abandoned')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return NextResponse.json({ plan: null, sessies: [], aanpassingen: [], heeftGepauzeerdPlan: !!gepauzeerdPlan })
    }

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
    // nooit twee actieve plannen tegelijk. Sport-filter voorkomt dat dit
    // per ongeluk een actief Running-plan afsluit.
    await supabase.from('training_plans').update({ status: 'abandoned' }).eq('athlete_id', user.id).eq('sport', 'cycling').eq('status', 'active')

    const resultaat = await genereerTrainingsplan(user.id)
    return NextResponse.json(resultaat)
  } catch (err) {
    console.error('[training-plan POST]', err)
    return NextResponse.json({ error: (err as Error).message || 'Genereren mislukt' }, { status: 500 })
  }
}

// v2.4.183: Pauzeer/Hervat — zie toelichting in de Running-versie van
// deze route, exact hetzelfde patroon, hergebruikt de al-bestaande
// 'abandoned'-status.
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
        .eq('athlete_id', user.id).eq('sport', 'cycling').eq('status', 'active')
        .maybeSingle()
      if (!plan) return NextResponse.json({ error: 'Geen actief plan om te pauzeren' }, { status: 400 })

      await supabase.from('training_plans').update({ status: 'abandoned' }).eq('id', plan.id)
      return NextResponse.json({ success: true, status: 'paused' })
    }

    if (action === 'resume') {
      const { data: actiefPlan } = await supabase
        .from('training_plans')
        .select('id')
        .eq('athlete_id', user.id).eq('sport', 'cycling').eq('status', 'active')
        .maybeSingle()
      if (actiefPlan) return NextResponse.json({ error: 'Er is al een ander actief plan — hervatten zou twee actieve plannen opleveren' }, { status: 400 })

      const { data: gepauzeerdPlan } = await supabase
        .from('training_plans')
        .select('id')
        .eq('athlete_id', user.id).eq('sport', 'cycling').eq('status', 'abandoned')
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
