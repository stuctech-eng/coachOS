export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { matchActiviteitAanPlan } from '@/lib/specialists/training-plan-engine/workout-matcher'
import type { SportMatcher } from '@/lib/specialists/training-plan-engine/workout-matcher-types'
import { rowingMatcher } from '@/lib/specialists/training-plan-engine/matchers/rowing-matcher'
import { runningMatcher } from '@/lib/specialists/training-plan-engine/matchers/running-matcher'

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
// Bron: docs/workout-completion-platform-adr-v1.md.
//
// v2.4.270 (Fase 2 — Running Matcher): dit scherm was tot nu toe
// hardcoded op Rowing. Zodra Fase 2 een tweede Sport Matcher opleverde,
// zou hardcoding hier per matcher een aparte kopie van dit hele bestand
// betekenen — tegen de architectuurregel "dubbele utilities vermijden".
// In plaats daarvan: een kleine registry (SPORT_MATCHERS +
// ACTIVITEIT_NAMEN_PER_SPORT), aangestuurd via een ?sport=-query-param.
// Nieuwe matchers (Cycling/Strength, Fase 2 vervolg) hoeven straks
// alleen deze twee objecten uit te breiden, niets anders in dit bestand.

const SPORT_MATCHERS: Record<string, SportMatcher> = {
  rowing: rowingMatcher,
  running: runningMatcher,
}

// Bron voor de activiteit-namen: rowing-data.ts (['Roeien']) en
// running-data.ts (RUNNING_ACTIVITEIT_NAMEN = ['Hardlopen']) — hier
// bewust hergebruikt/gespiegeld, niet zelf verzonnen.
const ACTIVITEIT_NAMEN_PER_SPORT: Record<string, string[]> = {
  rowing: ['Roeien'],
  running: ['Hardlopen'],
}

function geldigeSport(sport: string | null): sport is keyof typeof SPORT_MATCHERS {
  return !!sport && sport in SPORT_MATCHERS
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const sportParam = request.nextUrl.searchParams.get('sport')
    const sport = geldigeSport(sportParam) ? sportParam : 'rowing'

    const supabase = createAdminClient()

    const { data: plan } = await supabase
      .from('training_plans')
      .select('id')
      .eq('athlete_id', user.id).eq('sport', sport).eq('status', 'active')
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
        .in('activities.name', ACTIVITEIT_NAMEN_PER_SPORT[sport])
        .order('date', { ascending: false })
        .limit(30),
    ])

    return NextResponse.json({
      sport,
      beschikbareSporten: Object.keys(SPORT_MATCHERS),
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
      sport?: string
      activiteitId?: string
      planSessieId?: string
    } | null
    const actie = body?.actie || 'automatisch'
    const sport = geldigeSport(body?.sport || null) ? (body!.sport as string) : 'rowing'
    const matcher = SPORT_MATCHERS[sport]

    // ── actie: automatisch — ongewijzigd qua gedrag, nu sport-generiek ───
    if (actie === 'automatisch') {
      if (!body?.activiteitId) return NextResponse.json({ error: 'activiteitId ontbreekt' }, { status: 400 })
      const { data: activiteit } = await supabase
        .from('activity_sessions')
        .select('id, date, duration, metrics, user_id')
        .eq('id', body.activiteitId).eq('user_id', user.id)
        .maybeSingle()
      if (!activiteit) return NextResponse.json({ error: 'Activiteit niet gevonden' }, { status: 404 })

      const resultaat = await matchActiviteitAanPlan(
        { id: activiteit.id, userId: user.id, sport, date: activiteit.date, durationMinutes: activiteit.duration, metrics: activiteit.metrics },
        matcher,
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

      const { confidence, reden } = matcher.berekenConfidence(
        { id: activiteit.id, userId: user.id, sport, date: activiteit.date, durationMinutes: activiteit.duration, metrics: activiteit.metrics },
        { id: planSessie.id, planId: planSessie.plan_id, date: planSessie.date, type: planSessie.type, durationMinutes: planSessie.duration, loadTarget: planSessie.load_target },
      )
      const gelabeldeReden = `${TEST_PREFIX} handmatig gekozen paar (datum activiteit ${activiteit.date} ≠ datum sessie ${planSessie.date}, alleen mogelijk via dit debug-scherm) — ${reden}`

      if (actie === 'handmatig-test') {
        return NextResponse.json({ resultaat: { gematcht: false, planSessieId: planSessie.id, confidence, reden: gelabeldeReden, dryRun: true } })
      }

      await supabase.from('training_plan_sessions').update({
        status: 'completed',
        completed_activity_id: activiteit.id,
        match_confidence: confidence,
        match_reden: gelabeldeReden,
      }).eq('id', planSessie.id)

      return NextResponse.json({ resultaat: { gematcht: true, planSessieId: planSessie.id, confidence, reden: gelabeldeReden, dryRun: false } })
    }

    // ── actie: reset — alleen toegestaan op sessies met een [TEST]-label ─
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
