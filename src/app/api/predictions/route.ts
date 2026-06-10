export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
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

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ predictions: null })
    const supabase = createAdminClient()
    const today = new Date().toISOString().split('T')[0]

    const { data } = await supabase
      .from('coach_recommendations')
      .select('predictions')
      .eq('user_id', user.id)
      .eq('date', today)
      .eq('type', 'predictions')
      .single()

    return NextResponse.json({ predictions: data?.predictions || null })
  } catch {
    return NextResponse.json({ predictions: null })
  }
}

export async function POST() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()
    const today = new Date().toISOString().split('T')[0]

    // Check cache
    const { data: cached } = await supabase
      .from('coach_recommendations')
      .select('predictions')
      .eq('user_id', user.id)
      .eq('date', today)
      .eq('type', 'predictions')
      .single()

    if (cached?.predictions) {
      return NextResponse.json({ predictions: cached.predictions })
    }

    const zeven = new Date()
    zeven.setDate(zeven.getDate() - 7)
    const zevenDagenGeleden = zeven.toISOString().split('T')[0]

    const dertig = new Date()
    dertig.setDate(dertig.getDate() - 30)
    const dertigDagenGeleden = dertig.toISOString().split('T')[0]

    const [
      statusRes,
      status7dRes,
      metricsRes,
      metrics7dRes,
      checkinRes,
      activiteitenRes,
      blessuresRes,
      lifeEventsRes,
      garminRes,
      trainingsRes,
      goalsRes,
    ] = await Promise.all([
      supabase.from('daily_status').select('*').eq('user_id', user.id).eq('date', today).single(),
      supabase.from('daily_status').select('date, coach_score, recovery_score, training_score').eq('user_id', user.id).gte('date', zevenDagenGeleden).order('date'),
      supabase.from('health_metrics').select('*').eq('user_id', user.id).eq('date', today).single(),
      supabase.from('health_metrics').select('date, hrv, resting_hr, sleep_duration, steps').eq('user_id', user.id).gte('date', zevenDagenGeleden).order('date'),
      supabase.from('daily_checkins').select('*').eq('user_id', user.id).eq('date', today).single(),
      supabase.from('activity_sessions').select('date, duration, metrics').eq('user_id', user.id).gte('date', dertigDagenGeleden).order('date', { ascending: false }).limit(10),
      supabase.from('injuries').select('body_part, pain_score').eq('user_id', user.id).eq('active', true),
      supabase.from('life_events').select('type, start_time, recovery_impact, start_hour, end_hour').eq('user_id', user.id).gte('start_time', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('garmin_imports').select('parsed_data, date').eq('user_id', user.id).eq('status', 'confirmed').order('date', { ascending: false }).limit(1).single(),
      supabase.from('training_results').select('rating, actual_duration, completed_at').eq('user_id', user.id).eq('completed', true).order('completed_at', { ascending: false }).limit(5),
      supabase.from('user_goals').select('title').eq('user_id', user.id).eq('status', 'active'),
    ])

    const status = statusRes.data
    const status7d = status7dRes.data || []
    const metrics = metricsRes.data
    const metrics7d = metrics7dRes.data || []
    const checkin = checkinRes.data
    const activiteiten = activiteitenRes.data || []
    const blessures = blessuresRes.data || []
    const lifeEvents = lifeEventsRes.data || []
    const goals = goalsRes.data || []
    const garminLatest = garminRes.data?.parsed_data || null
    const trainingen = trainingsRes.data || []

    // Bereken trends
    const scores = status7d.filter(s => s.coach_score).map(s => s.coach_score as number)
    const herstelScores = status7d.filter(s => s.recovery_score).map(s => s.recovery_score as number)
    const hrv7 = metrics7d.filter(m => m.hrv).map(m => m.hrv as number)
    const slaap7 = metrics7d.filter(m => m.sleep_duration).map(m => m.sleep_duration as number)
    const rhr7 = metrics7d.filter(m => m.resting_hr).map(m => m.resting_hr as number)

    // Bereken trainingsbelasting (laatste 7 dagen)
    const totaalTraining = activiteiten
      .filter(a => {
        const d = new Date(a.date)
        const week = new Date()
        week.setDate(week.getDate() - 7)
        return d >= week
      })
      .reduce((sum, a) => sum + (a.duration || 0), 0)

    const context = [
      `VANDAAG:`,
      status ? `Coach Score: ${status.coach_score}/100, Herstel: ${status.recovery_score}/100, Training: ${status.training_score}/100` : 'Geen score vandaag',
      checkin ? `Gevoel: ${checkin.feeling_score}/10, Energie: ${checkin.energy_score}/10, Stress: ${(checkin as {stress_score?: number}).stress_score || '?'}/10` : 'Geen check-in',
      metrics ? `HRV: ${metrics.hrv || '?'}ms, Hartslag: ${metrics.resting_hr || '?'}bpm, Slaap: ${metrics.sleep_duration || '?'}u` : '',
      ``,
      `TRENDS 7 DAGEN:`,
      scores.length >= 3 ? `Coach Score: ${scores.join(' → ')} (${scores[scores.length-1] > scores[0] ? 'stijgend' : scores[scores.length-1] < scores[0] ? 'dalend' : 'stabiel'})` : 'Onvoldoende data',
      herstelScores.length >= 3 ? `Herstel: ${herstelScores.join(' → ')}` : '',
      hrv7.length >= 3 ? `HRV: ${hrv7.join(' → ')}ms` : '',
      slaap7.length >= 3 ? `Slaap: ${slaap7.join(' → ')}u` : '',
      rhr7.length >= 3 ? `Rusthartslag: ${rhr7.join(' → ')}bpm` : '',
      ``,
      `TRAININGSBELASTING (7 dagen): ${totaalTraining} minuten totaal`,
      blessures.length > 0 ? `Actieve blessures: ${blessures.map(b => b.body_part).join(', ')}` : '',
      lifeEvents.length > 0 ? `Life events: ${lifeEvents.map((e: {type: string; start_hour?: number|null; end_hour?: number|null}) => {
        const tijd = e.start_hour !== null && e.start_hour !== undefined ? ` ${String(e.start_hour).padStart(2,'0')}:00-${String(e.end_hour).padStart(2,'0')}:00` : ''
        return e.type + tijd
      }).join(', ')}` : '',
      garminLatest ? `Garmin: BB ${garminLatest.body_battery?.current || '?'}, slaap ${garminLatest.sleep?.score || '?'}/100, HRV ${garminLatest.hrv?.avg_7d_ms || '?'}ms, stress ${garminLatest.stress || '?'}` : '',
      trainingen.length > 0 ? `Trainingen: ${trainingen.length} sessies` : '',
      goals.length > 0 ? `Doelen: ${goals.map((g: {title: string}) => g.title).join(', ')}` : '',
    ].filter(Boolean).join('\n')

    const systemPrompt = `Je bent een data-gedreven sport coach die op basis van trends en patronen concrete voorspellingen maakt.

DATA:
${context}

INSTRUCTIES:
- Voorspel wat er de komende 1-3 dagen waarschijnlijk gaat gebeuren
- Baseer voorspellingen ALLEEN op aantoonbare trends in de data
- Wees eerlijk over onzekerheid — geen data = geen voorspelling
- Maak 2-4 voorspellingen, elk met een percentage kans
- Geef bij elke voorspelling een concrete actie om het te beïnvloeden
- Gebruik GEEN markdown, geen bold, geen bullets
- Schrijf in het Nederlands

Reageer ALLEEN in dit JSON formaat:
{
  "predictions": [
    {
      "titel": "Korte titel (max 5 woorden)",
      "voorspelling": "Wat er waarschijnlijk gaat gebeuren (1 zin)",
      "kans": 75,
      "actie": "Wat je nu kunt doen om dit te beïnvloeden (1 zin)",
      "type": "positief of waarschuwing"
    }
  ]
}`

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://coach-os-tau.vercel.app'
    const aiRes = await fetch(appUrl + '/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Maak voorspellingen op basis van mijn data.' }],
      }),
    })

    const aiData = await aiRes.json()
    const rawText = aiData.content?.[0]?.text || ''

    let predictions: Array<{ titel: string; voorspelling: string; kans: number; actie: string; type: string }> = []
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        predictions = parsed.predictions || []
      }
    } catch {
      return NextResponse.json({ error: 'Generatie mislukt' }, { status: 500 })
    }

    if (predictions.length === 0) {
      return NextResponse.json({ error: 'Geen voorspellingen gegenereerd' }, { status: 500 })
    }

    // Sla op in coach_recommendations
    await supabase
      .from('coach_recommendations')
      .upsert({
        user_id: user.id,
        date: today,
        type: 'predictions',
        predictions,
      }, { onConflict: 'user_id,type,date' })

    return NextResponse.json({ predictions })

  } catch (error) {
    console.error('Predictions error:', error)
    return NextResponse.json({ error: 'Generatie mislukt' }, { status: 500 })
  }
}
