export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { genereerTrainingsplanCore, verlengRollingHorizonIndienNodigCore } from '@/lib/specialists/training-plan-engine/core'
import { voerDailyAdjustmentUitCore } from '@/lib/specialists/training-plan-engine/adjuster-core'
import { runningAdapter } from '@/lib/specialists/training-plan-engine/running-adapter'
// v2.4.315: hergebruikt voor de "84 vs. 83 minuten"-fix — dezelfde
// berekening als Today Engine gebruikt, niet opnieuw geschreven.
import { berekenDefinitieveDuur, type SpecialistProposal } from '@/lib/today-engine'

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

// ── Adaptive Training Plan Engine (Running) — Fase 1, API-laag ─────────
// Bron: overleg 19 juli 2026 — Running Adapter bovenop de gedeelde
// Training Plan Engine Core (zie training-plan-engine/).
// GET: haalt het actuele actieve Running-plan op — voert EERST de Daily
// Adjustment Layer uit (5 triggers, zie training-plan-engine/adjuster-core.ts),
// dan pas de actuele sessies teruggeven.
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
      .eq('sport', 'running')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!plan) {
      // v2.4.183: onderscheid maken tussen "nooit een plan gehad" en
      // "plan is gepauzeerd" — anders zou de UI bij een gepauzeerd plan
      // alleen "Genereer nieuw plan" kunnen tonen, geen "Hervat"
      const { data: gepauzeerdPlan } = await supabase
        .from('training_plans')
        .select('id')
        .eq('athlete_id', user.id).eq('sport', 'running').eq('status', 'abandoned')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return NextResponse.json({ plan: null, sessies: [], aanpassingen: [], heeftGepauzeerdPlan: !!gepauzeerdPlan })
    }

    // v2.4.248-FIX: rolling horizon-verlenging — vóór de Daily
    // Adjustment Layer, zodat een net-verlengde sessie voor vandaag
    // ook meteen door de adjustment-check kan lopen. Bewust in een
    // try/catch — een fout hier mag het ophalen van het plan zelf
    // nooit laten falen.
    try {
      await verlengRollingHorizonIndienNodigCore(user.id, plan.id, runningAdapter)
    } catch (verlengErr) {
      console.error('[training-plan GET] Rolling horizon-verlenging mislukt:', verlengErr)
    }

    let aanpassingen: import('@/lib/specialists/training-plan-engine/types').AanpassingResultaat[] = []
    try {
      // v2.4.265 (ADR-007): fatigueSignaal wordt hier bewust genegeerd —
      // zelfde reden als bij Rowing's route
      const resultaat = await voerDailyAdjustmentUitCore(user.id, plan.id, runningAdapter)
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

    // v2.4.315-FIX: zelfde fix als Cycling — zie module-comment daar
    // voor de volledige toelichting.
    const vandaag = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
    const vandaagRij = (sessies || []).find(s => s.date === vandaag)
    let sessiesMetDefinitieveDuur = sessies || []
    if (vandaagRij) {
      try {
        const proposal: SpecialistProposal = { sport: 'running', sessie: vandaagRij }
        const { duur, reden } = await berekenDefinitieveDuur(user.id, proposal)
        sessiesMetDefinitieveDuur = (sessies || []).map(s =>
          s.id === vandaagRij.id ? { ...s, definitieveDuur: duur, definitieveDuurReden: reden } : s
        )
      } catch (duurErr) {
        console.error('[training-plan GET] Definitieve duur berekenen mislukt:', duurErr)
      }
    }

    return NextResponse.json({ plan, sessies: sessiesMetDefinitieveDuur, aanpassingen })
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
    // per ongeluk een actief Cycling-plan afsluit.
    await supabase.from('training_plans').update({ status: 'abandoned' }).eq('athlete_id', user.id).eq('sport', 'running').eq('status', 'active')

    const resultaat = await genereerTrainingsplanCore(user.id, runningAdapter)
    return NextResponse.json(resultaat)
  } catch (err) {
    console.error('[training-plan POST]', err)
    return NextResponse.json({ error: (err as Error).message || 'Genereren mislukt' }, { status: 500 })
  }
}

// v2.4.183: Pauzeer/Hervat — hergebruikt de al-bestaande 'abandoned'-
// status (dezelfde die POST hierboven al gebruikt bij het vervangen van
// een plan). Gebouwd na een testbehoefte (Today Engine Scenario A
// forceren) die bleek een genuine, blijvende functie te zijn — niet
// alleen voor testen: ook nuttig bij een blessure of prioriteitswissel
// zonder het hele plan te moeten verwijderen.
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
        .eq('athlete_id', user.id).eq('sport', 'running').eq('status', 'active')
        .maybeSingle()
      if (!plan) return NextResponse.json({ error: 'Geen actief plan om te pauzeren' }, { status: 400 })

      await supabase.from('training_plans').update({ status: 'abandoned' }).eq('id', plan.id)
      return NextResponse.json({ success: true, status: 'paused' })
    }

    if (action === 'resume') {
      // Veiligheidscheck: nooit hervatten als er (om wat voor reden dan
      // ook) alsnog een ander actief plan bestaat — zou twee actieve
      // plannen tegelijk opleveren
      const { data: actiefPlan } = await supabase
        .from('training_plans')
        .select('id')
        .eq('athlete_id', user.id).eq('sport', 'running').eq('status', 'active')
        .maybeSingle()
      if (actiefPlan) return NextResponse.json({ error: 'Er is al een ander actief plan — hervatten zou twee actieve plannen opleveren' }, { status: 400 })

      const { data: gepauzeerdPlan } = await supabase
        .from('training_plans')
        .select('id')
        .eq('athlete_id', user.id).eq('sport', 'running').eq('status', 'abandoned')
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
