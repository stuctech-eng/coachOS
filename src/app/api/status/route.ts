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

// Haal meest recente bevestigde Garmin import op
async function getGarminData(supabase: ReturnType<typeof createAdminClient>, userId: string) {
  const vandaagAms = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
  const { data } = await supabase
    .from('garmin_imports')
    .select('parsed_data, date')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .gte('date', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('date', { ascending: false })
    .limit(1)
    .single()
  return { data: data?.parsed_data || null, date: data?.date || null, isVandaag: data?.date === vandaagAms }
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

    const dertigDagenGeleden = new Date()
    dertigDagenGeleden.setDate(dertigDagenGeleden.getDate() - 30)
    const vanDatum = dertigDagenGeleden.toISOString().split('T')[0]

    const [
      profileRes,
      checkinRes,
      metricsVandaagRes,
      metrics30Res,
      activiteiten30Res,
      checkins30Res,
      blessuresRes,
      lifeEventsRes,
      garminRes,
    ] = await Promise.all([
      supabase.from('profiles').select('available_time').eq('user_id', user.id).single(),
      supabase.from('daily_checkins').select('*').eq('user_id', user.id).eq('date', today).single(),
      supabase.from('health_metrics').select('*').eq('user_id', user.id).eq('date', today).single(),
      supabase.from('health_metrics').select('date, hrv, resting_hr, sleep_duration, sleep_score, steps, body_battery').eq('user_id', user.id).gte('date', vanDatum).order('date'),
      supabase.from('activity_sessions').select('date, duration, metrics').eq('user_id', user.id).gte('date', vanDatum).order('date'),
      supabase.from('daily_checkins').select('date, energy_score, feeling_score').eq('user_id', user.id).gte('date', vanDatum).order('date'),
      supabase.from('injuries').select('active').eq('user_id', user.id).eq('active', true),
      supabase.from('life_events').select('type, recovery_impact, stress_load, sleep_disruption').eq('user_id', user.id).gte('start_time', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()),
      getGarminData(supabase, user.id),
    ])

    const profile = profileRes.data
    const checkin = checkinRes.data
    const heeftBlessure = (blessuresRes.data?.length || 0) > 0
    const lifeEvents = (lifeEventsRes.data || []) as Array<{ recovery_impact: number; stress_load: number; sleep_disruption: number }>
    const garmin = garminRes.data

    // Garmin data gebruiken als metrics voor herstelberekening indien aanwezig
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metricsVandaag = metricsVandaagRes.data || (garmin ? {
      hrv: garmin.hrv?.avg_7d_ms || null,
      resting_hr: garmin.resting_hr || null,
      sleep_duration: garmin.sleep?.duration_minutes ? Math.round(garmin.sleep.duration_minutes / 60) : null,
      sleep_score: garmin.sleep?.score || null,
      steps: garmin.steps?.value || null,
      body_battery: garmin.body_battery?.current || null,
    } : null)

    const lifeEventPenalty = lifeEvents.reduce((acc, e) => {
      return acc + (e.recovery_impact * 5) + (e.sleep_disruption * 3)
    }, 0)

    const recovery = calculateRecoveryScore(checkin, metricsVandaag, lifeEventPenalty)
    const training = calculateTrainingScore(activiteiten30Res.data || [], profile?.available_time || null)
    const lifestyle = calculateLifestyleScore(metrics30Res.data || [])
    const coachScore = calculateCoachScore(recovery.score, training.score, lifestyle.score)
    const risks = detectRisks(metrics30Res.data || [], checkins30Res.data || [], activiteiten30Res.data || [], heeftBlessure)

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

    const appUrlForMemory = process.env.NEXT_PUBLIC_APP_URL || 'https://coach-os-tau.vercel.app'
    fetch(appUrlForMemory + '/api/memory', { method: 'POST' }).catch(() => {})

    return NextResponse.json({
      ...saved,
      recovery,
      training,
      lifestyle,
      coachScore,
      risks,
      garmin_used: !!garmin,
    })

  } catch (error) {
    console.error('Daily status error:', error)
    return NextResponse.json({ error: 'Berekening mislukt' }, { status: 500 })
  }
}
