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
    if (!user) return NextResponse.json({ plan: null })
    const supabase = createAdminClient()
    const today = new Date().toISOString().split('T')[0]

    const { data } = await supabase
      .from('coach_recommendations')
      .select('action_plan')
      .eq('user_id', user.id)
      .eq('date', today)
      .single()

    return NextResponse.json({ plan: data?.action_plan || null })
  } catch {
    return NextResponse.json({ plan: null })
  }
}

export async function POST() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()
    const today = new Date().toISOString().split('T')[0]

    const zeven = new Date()
    zeven.setDate(zeven.getDate() - 7)

    const [profileRes, checkinRes, metricsRes, statusRes, blessuresRes, lifeEventsRes, goalsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('daily_checkins').select('*').eq('user_id', user.id).eq('date', today).single(),
      supabase.from('health_metrics').select('*').eq('user_id', user.id).eq('date', today).single(),
      supabase.from('daily_status').select('*').eq('user_id', user.id).eq('date', today).single(),
      supabase.from('injuries').select('body_part, pain_score').eq('user_id', user.id).eq('active', true),
      supabase.from('life_events').select('type, start_hour, end_hour').eq('user_id', user.id).gte('start_time', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('user_goals').select('title').eq('user_id', user.id).eq('status', 'active'),
    ])

    const profile = profileRes.data
    const checkin = checkinRes.data
    const metrics = metricsRes.data
    const status = statusRes.data
    const blessures = blessuresRes.data || []
    const lifeEvents = lifeEventsRes.data || []
    const goals = goalsRes.data || []

    const naam = profile?.display_name || profile?.first_name || 'je'
    const score = status?.coach_score || 50
    const herstel = status?.recovery_score || 50

    const context = [
      `Coach Score: ${score}/100, Herstel: ${herstel}/100`,
      checkin ? `Gevoel: ${checkin.feeling_score}/10, Energie: ${checkin.energy_score}/10, Stress: ${(checkin as {stress_score?: number}).stress_score || '?'}/10` : 'Geen check-in',
      metrics ? `Slaap: ${metrics.sleep_duration || '?'}u, HRV: ${metrics.hrv || '?'}ms` : '',
      blessures.length > 0 ? `Blessures: ${blessures.map(b => b.body_part).join(', ')}` : '',
      lifeEvents.length > 0 ? `Life events: ${lifeEvents.map(e => e.type).join(', ')}` : '',
      goals.length > 0 ? `Doelen: ${goals.map(g => g.title).join(', ')}` : '',
    ].filter(Boolean).join('\n')

    const systemPrompt = `Je bent een ervaren coach die een concreet dagplan maakt voor ${naam}.

DATA VANDAAG:
${context}

Maak een praktisch dagplan met 3-5 concrete acties verspreid over de dag.
Houd rekening met de coach score, blessures en life events.
Elke actie heeft een tijdstip en is specifiek en uitvoerbaar.

Gebruik GEEN markdown. Geen **bold**. Geen bullets.

Reageer ALLEEN in dit JSON formaat:
{
  "acties": [
    { "tijd": "07:30", "actie": "Beschrijving van de actie" },
    { "tijd": "12:00", "actie": "Beschrijving van de actie" }
  ]
}`

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://coach-os-tau.vercel.app'
    const aiRes = await fetch(appUrl + '/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Maak mijn dagplan.' }],
      }),
    })

    const aiData = await aiRes.json()
    const rawText = aiData.content?.[0]?.text || ''

    let acties: Array<{ tijd: string; actie: string }> = []
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        acties = parsed.acties || []
      }
    } catch {
      return NextResponse.json({ error: 'Generatie mislukt' }, { status: 500 })
    }

    if (acties.length === 0) return NextResponse.json({ error: 'Geen acties gegenereerd' }, { status: 500 })

    // Sla op in coach_recommendations
    await supabase
      .from('coach_recommendations')
      .update({ action_plan: acties })
      .eq('user_id', user.id)
      .eq('date', today)

    return NextResponse.json({ plan: acties })
  } catch (error) {
    console.error('Action plan error:', error)
    return NextResponse.json({ error: 'Generatie mislukt' }, { status: 500 })
  }
}
