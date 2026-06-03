export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { calculateRecoveryScore } from '@/core/ai-engine/recovery-engine'
import { calculateTrainingScore } from '@/core/engines/training-engine'
import { calculateLifestyleScore } from '@/core/engines/lifestyle-engine'
import { calculateCoachScore } from '@/core/engines/coach-score-engine'
import { detectRisks } from '@/core/engines/risk-engine'

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

// GET — haal huidige daily status op
export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()
    const today = new Date().toISOString().split('T')[0]

    const { data } = await supabase
      .from('daily_status')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .single()

    return NextResponse.json(data || null)
  } catch {
    return NextResponse.json(null)
  }
}

// POST — bereken en sla daily status op
export async function POST() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()
    const today = new Date().toISOString().split('T')[0]

    // 30 dagen geleden
    const dertigDagenGeleden = new Date()
    dertigDagenGeleden.setDate(dertigDagenGeleden.getDate() - 30)
    const vanDatum = dertigDagenGeleden.toISOString().split('T')[0]

    // Haal alle data op
    const [
      profileRes,
      checkinRes,
      metricsVandaagRes,
      metrics30Res,
      activiteiten30Res,
      checkins30Res,
      blessuresRes,
      lifeEventsRes,
    ] = await Promise.all([
      supabase.from('profiles').select('available_time').eq('user_id', user.id).single(),
      supabase.from('daily_checkins').select('*').eq('user_id', user.id).eq('date', today).single(),
      supabase.from('health_metrics').select('*').eq('user_id', user.id).eq('date', today).single(),
      supabase.from('health_metrics').select('date, hrv, resting_hr, sleep_duration, sleep_score, steps, body_battery').eq('user_id', user.id).gte('date', vanDatum).order('date'),
      supabase.from('activity_sessions').select('date, duration, metrics').eq('user_id', user.id).gte('date', vanDatum).order('date'),
      supabase.from('daily_checkins').select('date, energy_score, feeling_score').eq('user_id', user.id).gte('date', vanDatum).order('date'),
      supabase.from('injuries').select('active').eq('user_id', user.id).eq('active', true),
      supabase.from('life_events').select('type, recovery_impact, stress_load, sleep_disruption').eq('user_id', user.id).gte('start_time', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()),
    ])

    const profile = profileRes.data
    const checkin = checkinRes.data
    const metricsVandaag = metricsVandaagRes.data
    const metrics30 = metrics30Res.data || []
    const activiteiten30 = activiteiten30Res.data || []
    const checkins30 = checkins30Res.data || []
    const heeftBlessure = (blessuresRes.data?.length || 0) > 0
    const lifeEvents = (lifeEventsRes.data || []) as Array<{ recovery_impact: number; stress_load: number; sleep_disruption: number }>

    // Life event penalty berekenen
    const lifeEventPenalty = lifeEvents.reduce((acc, e) => {
      return acc + (e.recovery_impact * 5) + (e.sleep_disruption * 3)
    }, 0)

    // Bereken scores
    const recovery = calculateRecoveryScore(checkin, metricsVandaag, lifeEventPenalty)
    const training = calculateTrainingScore(activiteiten30, profile?.available_time || null)
    const lifestyle = calculateLifestyleScore(metrics30)
    const coachScore = calculateCoachScore(recovery.score, training.score, lifestyle.score)
    const risks = detectRisks(metrics30, checkins30, activiteiten30, heeftBlessure)

    // Sla op in daily_status
    const { data: saved, error } = await supabase
      .from('daily_status')
      .upsert({
        user_id: user.id,
        date: today,
        recovery_score: recovery.score,
        training_score: training.score,
        lifestyle_score: lifestyle.score,
        coach_score: coachScore.coachScore,
        energy_score: checkin?.energy_score ? checkin.energy_score * 10 : null,
        status_color: coachScore.kleur,
        risk_flags: risks.flags,
      }, { onConflict: 'user_id,date' })
      .select()
      .single()

    if (error) throw error

    // Trigger memory analyse op achtergrond
    const appUrlForMemory = process.env.NEXT_PUBLIC_APP_URL || 'https://coach-os-tau.vercel.app'
    fetch(appUrlForMemory + '/api/memory', { method: 'POST' }).catch(() => {})

    return NextResponse.json({
      ...saved,
      recovery,
      training,
      lifestyle,
      coachScore,
      risks,
    })

  } catch (error) {
    console.error('Daily status error:', error)
    return NextResponse.json({ error: 'Berekening mislukt' }, { status: 500 })
  }
}
