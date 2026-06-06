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

export interface TrainingInstruction {
  training_allowed: boolean
  training_type: string | null
  intensity: 'light' | 'medium' | 'heavy' | null
  duration: number | null
  recovery_modules: RecoveryModule[]
  reason: string
  coach_message: string
}

export interface RecoveryModule {
  type: 'breathing' | 'mobility' | 'walk' | 'relaxation'
  subtype: string
  duration: number
  label: string
}

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ instruction: null })
    const supabase = createAdminClient()
    const today = new Date().toISOString().split('T')[0]

    const { data } = await supabase
      .from('coach_recommendations')
      .select('training_instruction')
      .eq('user_id', user.id)
      .eq('date', today)
      .single()

    return NextResponse.json({ instruction: data?.training_instruction || null })
  } catch {
    return NextResponse.json({ instruction: null })
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
      .select('training_instruction')
      .eq('user_id', user.id)
      .eq('date', today)
      .single()

    if (cached?.training_instruction) {
      return NextResponse.json({ instruction: cached.training_instruction })
    }

    const zeven = new Date()
    zeven.setDate(zeven.getDate() - 7)

    const [
      profileRes, statusRes, checkinRes, metricsRes,
      blessuresRes, lifeEventsRes, goalsRes,
      metrics7dRes, activiteitenRes,
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('daily_status').select('*').eq('user_id', user.id).eq('date', today).single(),
      supabase.from('daily_checkins').select('*').eq('user_id', user.id).eq('date', today).single(),
      supabase.from('health_metrics').select('*').eq('user_id', user.id).eq('date', today).single(),
      supabase.from('injuries').select('body_part, pain_score, notes').eq('user_id', user.id).eq('active', true),
      supabase.from('life_events')
        .select('type, recovery_impact, stress_load, notes')
        .eq('user_id', user.id)
        .gte('start_time', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('user_goals').select('title').eq('user_id', user.id).eq('status', 'active'),
      supabase.from('health_metrics')
        .select('date, hrv, resting_hr, sleep_duration, steps')
        .eq('user_id', user.id)
        .gte('date', zeven.toISOString().split('T')[0])
        .order('date'),
      supabase.from('activity_sessions')
        .select('date, duration')
        .eq('user_id', user.id)
        .gte('date', zeven.toISOString().split('T')[0])
        .order('date', { ascending: false }),
    ])

    const status = statusRes.data
    const checkin = checkinRes.data
    const metrics = metricsRes.data
    const blessures = blessuresRes.data || []
    const lifeEvents = lifeEventsRes.data || []
    const goals = goalsRes.data || []
    const metrics7d = metrics7dRes.data || []
    const activiteiten = activiteitenRes.data || []

    const dagNummer = new Date().getDay()
    const isWeekend = dagNummer === 0 || dagNummer === 6

    const context = [
      `Coach Score: ${status?.coach_score || '?'}/100`,
      `Herstel: ${status?.recovery_score || '?'}/100`,
      `Training: ${status?.training_score || '?'}/100`,
      status?.risk_flags?.length ? `Risico flags: ${(status.risk_flags as string[]).join(', ')}` : '',
      checkin ? `Check-in: gevoel ${checkin.feeling_score}/10, energie ${checkin.energy_score}/10, stress ${(checkin as {stress_score?: number}).stress_score || '?'}/10, spierpijn ${(checkin as {soreness_score?: number}).soreness_score || '?'}/10` : 'Geen check-in vandaag',
      metrics ? `Gezondheid: HRV ${metrics.hrv || '?'}ms, hartslag ${metrics.resting_hr || '?'}bpm, slaap ${metrics.sleep_duration || '?'}u` : '',
      blessures.length > 0 ? `Actieve blessures: ${blessures.map(b => `${b.body_part} (pijn ${b.pain_score}/10)`).join(', ')}` : '',
      lifeEvents.length > 0 ? `Life events: ${lifeEvents.map(e => e.type + (e.notes ? ` (${e.notes})` : '')).join(', ')}` : '',
      isWeekend ? 'Het is weekend — meer tijd beschikbaar voor training' : 'Het is een werkdag',
      goals.length > 0 ? `Doelen: ${goals.map(g => g.title).join(', ')}` : '',
      metrics7d.length > 0 ? `HRV trend: ${metrics7d.filter(m => m.hrv).map(m => m.hrv).join(' → ')}` : '',
      activiteiten.length > 0 ? `Trainingen afgelopen week: ${activiteiten.length} sessies, totaal ${activiteiten.reduce((s, a) => s + (a.duration || 0), 0)} min` : 'Geen trainingen afgelopen week',
    ].filter(Boolean).join('\n')

    const systemPrompt = `Je bent Coach AI van CoachOS. Je analyseert de gezondheidsdata en beslist wat de gebruiker vandaag moet doen.

DATA:
${context}

BESLISREGELS:
- Coach Score >= 75: training is mogelijk
- Coach Score 50-74: lichte training of herstel
- Coach Score < 50: alleen herstel, geen training
- Hoge spierpijn (>= 7): geen training van die spiergroepen
- Actieve blessure: training aanpassen of overslaan
- Slechte slaap (< 6u): herstel prioriteit
- Hoge stress (>= 8): ademhaling aanbevelen voor training

BESCHIKBARE TRAINING TYPES:
- kettlebell (als training_type)

BESCHIKBARE RECOVERY MODULES:
Ademhaling: box_breathing, breathing_478, coherent_breathing, stress_reset
Mobiliteit: neck_shoulders, hips, full_body
Wandeling: recovery_walk

INSTRUCTIES:
- Beslis concreet: trainen of herstellen
- Kies altijd minstens 1 recovery module
- Coach bericht is persoonlijk en motiverend (max 2 zinnen)
- Gebruik GEEN markdown

Reageer ALLEEN in dit JSON formaat:
{
  "training_allowed": true,
  "training_type": "kettlebell",
  "intensity": "medium",
  "duration": 25,
  "recovery_modules": [
    { "type": "breathing", "subtype": "box_breathing", "duration": 6, "label": "Box Breathing" },
    { "type": "mobility", "subtype": "hips", "duration": 10, "label": "Heup mobiliteit" }
  ],
  "reason": "Korte reden voor de beslissing",
  "coach_message": "Persoonlijk bericht aan de gebruiker"
}`

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://coach-os-tau.vercel.app'
    const aiRes = await fetch(appUrl + '/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Wat moet ik vandaag doen?' }],
      }),
    })

    const aiData = await aiRes.json()
    const rawText = aiData.content?.[0]?.text || ''

    let instruction: TrainingInstruction | null = null
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (jsonMatch) instruction = JSON.parse(jsonMatch[0])
    } catch {
      return NextResponse.json({ error: 'Generatie mislukt' }, { status: 500 })
    }

    if (!instruction) return NextResponse.json({ error: 'Geen instructie gegenereerd' }, { status: 500 })

    // Opslaan in coach_recommendations
    await supabase
      .from('coach_recommendations')
      .upsert({
        user_id: user.id,
        date: today,
        training_instruction: instruction,
      }, { onConflict: 'user_id,date' })

    return NextResponse.json({ instruction })

  } catch (error) {
    console.error('Training today error:', error)
    return NextResponse.json({ error: 'Generatie mislukt' }, { status: 500 })
  }
}
