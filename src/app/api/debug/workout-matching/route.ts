export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { matchActiviteitAanPlan } from '@/lib/specialists/training-plan-engine/workout-matcher'
import { rowingMatcher } from '@/lib/specialists/training-plan-engine/matchers/rowing-matcher'

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

// ── Workout Matching Debug Dashboard — API ───────────────────────────────
// Bron: docs/workout-completion-platform-adr-v1.md, Fase 1. Zelfde
// opzet als debug/recovery — puur uitlezen, GEEN eigen berekening, en
// gebruikt exact dezelfde functie (matchActiviteitAanPlan) als de echte
// concept2/sync-route voor de 'automatisch'-actie.
//
// v2.4.269: drie extra, expliciet HANDMATIGE test-acties toegevoegd —
// gemeld dat er met de bestaande (historische) data geen enkele
// geslaagde match te produceren was, omdat alle sessies met een
// koppelbare status (scheduled/planned) nog in de toekomst liggen.
// 'handmatig-test' en 'handmatig-forceer' matchen NIET op datum — de
// gebruiker kiest zelf een sessie, ongeacht datum, puur om de
// matcher-logica (confidence-berekening) te kunnen zien werken zonder
// te hoeven wachten. Alle drie de nieuwe acties zijn duidelijk als test
// gelabeld (match_reden krijgt een "[TEST]"-prefix) zodat ze nooit met
// een echte, automatische match verward kunnen worden — en 'reset'
// weigert expliciet iets te resetten dat niet zo gelabeld is, zodat een
// echte koppeling nooit per ongeluk via dit scherm ongedaan gemaakt kan
// worden.

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()

    const { data: plan } = await supabase
      .from('training_plans')
      .select('id')
      .eq('athlete_id', user.id).eq('sport', 'rowing').eq('status', 'active')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()

    const vanaf = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const tot = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const [sessiesRes, activiteitenRes] = await Promise.all([
      plan
        ? supabase.from('training_plan_sessions')
            .select('id, date, type, duration, status, completed_activity_id, match_confidence, match_reden')
            .eq('plan_id', plan.id)
            .gte('date', vanaf).lte('date', tot)
            .order('date', { ascending: true })
        : Promise.resolve({ data: [] }),
      supabase.from('activity_sessions')
        .select('id, date, duration, source, notes, activities!inner(name)')
        .eq('user_id', user.id)
        .in('activities.name', ['Roeien'])
        .order('date', { ascending: false })
        .limit(30),
    ])

    return NextResponse.json({
      heeftActiefPlan: !!plan,
      geplandeSessies: sessiesRes.data || [],
      activiteiten: (activiteitenRes.data || []).slice().reverse(),
    })
  } catch (err) {
    console.error('[debug/workout-matching GET]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}

const TEST_PREFIX = '[TEST]'

export async function POST(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()

    const body = await request.json().catch(() => null) as {
      actie?: 'automatisch' | 'handmatig-test' | 'handmatig-forceer' | 'reset'
      activiteitId?: string
      planSessieId?: string
    } | null
    const actie = body?.actie || 'automatisch'

    // ── actie: automatisch — ongewijzigd, de originele, echte flow ──────
    if (actie === 'automatisch') {
      if (!body?.activiteitId) return NextResponse.json({ error: 'activiteitId ontbreekt' }, { status: 400 })
      const { data: activiteit } = await supabase
        .from('activity_sessions')
        .select('id, date, duration, metrics, user_id')
        .eq('id', body.activiteitId).eq('user_id', user.id)
        .maybeSingle()
      if (!activiteit) return NextResponse.json({ error: 'Activiteit niet gevonden' }, { status: 404 })

      const resultaat = await matchActiviteitAanPlan(
        { id: activiteit.id, userId: user.id, sport: 'rowing', date: activiteit.date, durationMinutes: activiteit.duration, metrics: activiteit.metrics },
        rowingMatcher,
      )
      return NextResponse.json({ resultaat })
    }

    // ── de drie handmatige testacties werken allemaal op een expliciet
    //    gekozen (activiteit, planSessie)-paar, ongeacht datum ──────────
    if (actie === 'handmatig-test' || actie === 'handmatig-forceer') {
      if (!body?.activiteitId || !body?.planSessieId) {
        return NextResponse.json({ error: 'activiteitId en planSessieId zijn beide verplicht' }, { status: 400 })
      }
      const [{ data: activiteit }, { data: planSessie }] = await Promise.all([
        supabase.from('activity_sessions').select('id, date, duration, metrics, user_id')
          .eq('id', body.activiteitId).eq('user_id', user.id).maybeSingle(),
        supabase.from('training_plan_sessions').select('id, plan_id, date, type, duration, load_target, training_plans!inner(athlete_id)')
          .eq('id', body.planSessieId).maybeSingle(),
      ])
      if (!activiteit) return NextResponse.json({ error: 'Activiteit niet gevonden' }, { status: 404 })
      if (!planSessie) return NextResponse.json({ error: 'Sessie niet gevonden' }, { status: 404 })
      // @ts-expect-error training_plans komt als array terug via de join
      if (planSessie.training_plans?.athlete_id !== user.id) {
        return NextResponse.json({ error: 'Sessie hoort niet bij deze gebruiker' }, { status: 403 })
      }

      const { confidence, reden } = rowingMatcher.berekenConfidence(
        { id: activiteit.id, userId: user.id, sport: 'rowing', date: activiteit.date, durationMinutes: activiteit.duration, metrics: activiteit.metrics },
        { id: planSessie.id, planId: planSessie.plan_id, date: planSessie.date, type: planSessie.type, durationMinutes: planSessie.duration, loadTarget: planSessie.load_target },
      )
      const gelabeldeReden = `${TEST_PREFIX} handmatig gekozen paar (datum activiteit ${activiteit.date} ≠ datum sessie ${planSessie.date}, alleen mogelijk via dit debug-scherm) — ${reden}`

      if (actie === 'handmatig-test') {
        // Dry-run — GEEN database-schrijving, puur laten zien wat de
        // matcher zou berekenen.
        return NextResponse.json({ resultaat: { gematcht: false, planSessieId: planSessie.id, confidence, reden: gelabeldeReden, dryRun: true } })
      }

      // actie === 'handmatig-forceer' — schrijft WEL, ongeacht drempel,
      // met expliciete test-labeling zodat dit nooit voor een echte
      // match kan worden aangezien.
      await supabase.from('training_plan_sessions').update({
        status: 'completed',
        completed_activity_id: activiteit.id,
        match_confidence: confidence,
        match_reden: gelabeldeReden,
      }).eq('id', planSessie.id)

      return NextResponse.json({ resultaat: { gematcht: true, planSessieId: planSessie.id, confidence, reden: gelabeldeReden, dryRun: false } })
    }

    // ── actie: reset — alleen toegestaan op sessies die zelf met dit
    //    debug-scherm zijn dichtgezet (herkenbaar aan de TEST_PREFIX in
    //    match_reden). Weigert expliciet bij een echte, automatische
    //    match — voorkomt dat dit scherm ooit per ongeluk productiedata
    //    ongedaan maakt.
    if (actie === 'reset') {
      if (!body?.planSessieId) return NextResponse.json({ error: 'planSessieId ontbreekt' }, { status: 400 })
      const { data: planSessie } = await supabase
        .from('training_plan_sessions').select('id, match_reden, training_plans!inner(athlete_id)')
        .eq('id', body.planSessieId).maybeSingle()
      if (!planSessie) return NextResponse.json({ error: 'Sessie niet gevonden' }, { status: 404 })
      // @ts-expect-error training_plans komt als array terug via de join
      if (planSessie.training_plans?.athlete_id !== user.id) {
        return NextResponse.json({ error: 'Sessie hoort niet bij deze gebruiker' }, { status: 403 })
      }
      if (!planSessie.match_reden?.startsWith(TEST_PREFIX)) {
        return NextResponse.json({ error: 'Deze sessie is niet via een test gekoppeld — reset hier bewust geweigerd, om productiedata te beschermen' }, { status: 400 })
      }

      await supabase.from('training_plan_sessions').update({
        status: 'scheduled',
        completed_activity_id: null,
        match_confidence: null,
        match_reden: null,
      }).eq('id', planSessie.id)

      return NextResponse.json({ resultaat: { gereset: true } })
    }

    return NextResponse.json({ error: `Onbekende actie: ${actie}` }, { status: 400 })
  } catch (err) {
    console.error('[debug/workout-matching POST]', err)
    return NextResponse.json({ error: 'Matching-test mislukt' }, { status: 500 })
  }
}
