export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

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

// ── Fase 2a — Data Layer ────────────────────────────────────────────────
// Bron: docs/specialist-api.md Fase 2a, docs/specialist-engine-architecture.md.
// UITSLUITEND verzamelen en filteren — GEEN berekening, GEEN AI, GEEN
// interpretatie. De Cycling Analysis Engine (Fase 2b, volgende stap)
// neemt deze ruwe output en rekent daar pas mee.
//
// Twee bronnen voor cycling-data, beide bestaand, ongewijzigd:
// - activity_sessions: losse ritten (Strava-sync, Garmin TCX/screenshot,
//   handmatige import) — gefilterd via de gekoppelde activities.name
// - training_results: AI-gecoachte cycling-trainingen (Trainer AI/
//   Bibliotheek, training_type='cycling')
//
// LET OP, eerlijk vastgelegd: de lijst met cycling-gerelateerde
// activity-namen hieronder is gebaseerd op wat deze sessie daadwerkelijk
// is gezien (Strava-processor, Garmin ACTIVITEIT_OPTIES) — mogelijk niet
// uitputtend als er ooit andere naamvarianten worden geïmporteerd.
const CYCLING_ACTIVITEIT_NAMEN = ['Fietsen', 'Fietsen (buiten)', 'Indoor Fietsen']

export async function GET(req: NextRequest, { params }: { params: { type: string } }) {
  try {
    if (params.type !== 'cycling') {
      return NextResponse.json({ error: `Data Layer voor '${params.type}' bestaat nog niet — alleen 'cycling' is geïmplementeerd (referentie-specialist)` }, { status: 501 })
    }

    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const url = new URL(req.url)
    const periodDays = parseInt(url.searchParams.get('period_days') || '30', 10)
    const periodeStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()
    const periodeStartDatum = periodeStart.split('T')[0]

    const supabase = createAdminClient()

    const [activiteitenRes, trainingenRes] = await Promise.all([
      supabase
        .from('activity_sessions')
        .select('id, date, duration, metrics, source, notes, activities!inner(name)')
        .eq('user_id', user.id)
        .in('activities.name', CYCLING_ACTIVITEIT_NAMEN)
        .gte('date', periodeStartDatum)
        .order('date', { ascending: true }),
      supabase
        .from('training_results')
        .select('training_type, actual_duration, rating, perceived_effort, notes, completed_at, cycling_technique_rating, cycling_pacing_rating, cycling_fatigue_rating, cycling_rpe_rating')
        .eq('user_id', user.id)
        .eq('training_type', 'cycling')
        .eq('completed', true)
        .gte('completed_at', periodeStart)
        .order('completed_at', { ascending: true }),
    ])

    if (activiteitenRes.error) throw activiteitenRes.error
    if (trainingenRes.error) throw trainingenRes.error

    // Puur doorgeven, geen interpretatie — dat is de taak van Fase 2b
    return NextResponse.json({
      specialist_type: 'cycling',
      period_days: periodDays,
      activiteiten: activiteitenRes.data || [],
      trainingsresultaten: trainingenRes.data || [],
      aantal_activiteiten: (activiteitenRes.data || []).length,
      aantal_trainingsresultaten: (trainingenRes.data || []).length,
    })
  } catch (err) {
    console.error('[specialists/cycling/data]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}
