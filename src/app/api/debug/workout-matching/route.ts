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
// concept2/sync-route. Wat je hier ziet/test is dus gegarandeerd
// hetzelfde gedrag als in de productieflow.
//
// Bedoeld om het in-app te kunnen testen zonder een nieuwe ErgData-
// sessie te hoeven doen: GET toont geplande sessies + al-geïmporteerde
// Rowing-activiteiten naast elkaar, POST draait de matcher opnieuw voor
// een gekozen, al-bestaande activiteit (retroactief testbaar).

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
        .gte('date', vanaf)
        .order('date', { ascending: true }),
    ])

    return NextResponse.json({
      heeftActiefPlan: !!plan,
      geplandeSessies: sessiesRes.data || [],
      activiteiten: activiteitenRes.data || [],
    })
  } catch (err) {
    console.error('[debug/workout-matching GET]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()

    const body = await request.json().catch(() => null) as { activiteitId?: string } | null
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
  } catch (err) {
    console.error('[debug/workout-matching POST]', err)
    return NextResponse.json({ error: 'Matching-test mislukt' }, { status: 500 })
  }
}
