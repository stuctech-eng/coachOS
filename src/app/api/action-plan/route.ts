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

function getDagInfo() {
  const now = new Date()
  const dagen = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']
  const dagNummer = now.getDay()
  return {
    dag: dagen[dagNummer],
    isWeekend: dagNummer === 0 || dagNummer === 6,
    dagNummer,
  }
}

const WERK_TYPES = ['nachtdienst', 'avonddienst', 'vroege_dienst', 'dagdienst', 'thuiswerken', 'lange_dag']

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
    const { dag, isWeekend, dagNummer } = getDagInfo()

    const [profileRes, checkinRes, metricsRes, statusRes, blessuresRes, lifeEventsRes, goalsRes, herhalendeEventsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('daily_checkins').select('*').eq('user_id', user.id).eq('date', today).single(),
      supabase.from('health_metrics').select('*').eq('user_id', user.id).eq('date', today).single(),
      supabase.from('daily_status').select('*').eq('user_id', user.id).eq('date', today).single(),
      supabase.from('injuries').select('body_part, pain_score').eq('user_id', user.id).eq('active', true),
      supabase.from('life_events')
        .select('type, start_hour, end_hour, notes, recurrence, recurrence_days')
        .eq('user_id', user.id)
        .gte('start_time', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('user_goals').select('title').eq('user_id', user.id).eq('status', 'active'),
      supabase.from('life_events')
        .select('type, start_hour, end_hour, notes, recurrence, recurrence_days')
        .eq('user_id', user.id)
        .not('recurrence', 'is', null),
    ])

    const profile = profileRes.data
    const checkin = checkinRes.data
    const metrics = metricsRes.data
    const status = statusRes.data
    const blessures = blessuresRes.data || []
    const lifeEvents = lifeEventsRes.data || []
    const goals = goalsRes.data || []
    const herhalendeEvents = herhalendeEventsRes.data || []

    // Filter herhalende events correct op dag
    const relevanteHerhalendeEvents = herhalendeEvents.filter(he => {
      // Werkevents op weekend tonen alleen als ze specifiek za/zo hebben
      if (isWeekend && WERK_TYPES.includes(he.type)) {
        const days = he.recurrence_days as number[] | null
        if (!days) return false
        return days.includes(dagNummer)
      }
      // Werkdagen herhaling niet op weekend
      if (he.recurrence === 'workdays' && isWeekend) return false
      // Weekend herhaling niet op werkdag
      if (he.recurrence === 'weekend' && !isWeekend) return false
      // Wekelijks/aangepast — check dag
      if (he.recurrence === 'weekly' || he.recurrence === 'biweekly' || he.recurrence === 'custom') {
        const days = he.recurrence_days as number[] | null
        return days ? days.includes(dagNummer) : true
      }
      return true
    })

    // Combineer — voorkom duplicaten
    const alleEvents = [...lifeEvents]
    relevanteHerhalendeEvents.forEach(he => {
      if (!alleEvents.find(e => e.type === he.type)) alleEvents.push(he)
    })

    const naam = profile?.display_name || profile?.first_name || 'je'
    const score = status?.coach_score || 50
    const herstel = status?.recovery_score || 50

    const context = [
      `Dag: ${dag} ${isWeekend ? '(WEEKEND — vrije dag, geen werkverplichtingen)' : '(werkdag)'}`,
      `Coach Score: ${score}/100, Herstel: ${herstel}/100`,
      checkin ? `Gevoel: ${checkin.feeling_score}/10, Energie: ${checkin.energy_score}/10, Stress: ${(checkin as {stress_score?: number}).stress_score || '?'}/10` : 'Geen check-in',
      metrics ? `Slaap: ${metrics.sleep_duration || '?'}u, HRV: ${metrics.hrv || '?'}ms` : '',
      blessures.length > 0 ? `Blessures: ${blessures.map(b => b.body_part).join(', ')}` : '',
      alleEvents.length > 0 ? `Vandaag actieve events: ${alleEvents.map(e => {
        const tijden = e.start_hour !== null && e.end_hour !== null
          ? ` ${String(e.start_hour).padStart(2,'0')}:00-${String(e.end_hour).padStart(2,'0')}:00`
          : ''
        const notitie = e.notes ? ` (${e.notes})` : ''
        return e.type + tijden + notitie
      }).join(', ')}` : isWeekend ? 'Geen werkverplichtingen vandaag' : '',
      goals.length > 0 ? `Doelen: ${goals.map(g => g.title).join(', ')}` : '',
    ].filter(Boolean).join('\n')

    const systemPrompt = `Je bent een ervaren coach die een concreet dagplan maakt voor ${naam}.

DATA VANDAAG:
${context}

INSTRUCTIES:
- Het is vandaag ${dag}${isWeekend
  ? '. Het is WEEKEND — geen werk, geen diensten. Plan activiteiten op realistische tijden voor een vrije dag (niet te vroeg tenzij de persoon vroeg opstaat).'
  : '.'}
- Alleen events die VANDAAG actief zijn meenemen (zie "Vandaag actieve events")
- Als er geen werkevents zijn, ga dan NIET uit van werktijden
- Houd rekening met blessures: geen oefeningen die pijnlijke lichaamsdelen belasten
- Coach score onder 50: focus op herstel, niet op training
- Maak 3-5 concrete acties verspreid over de dag
- Gebruik GEEN markdown, geen bold, geen bullets

Reageer ALLEEN in dit JSON formaat:
{
  "acties": [
    { "tijd": "09:00", "actie": "Beschrijving van de actie" }
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
