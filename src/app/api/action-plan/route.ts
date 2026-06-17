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
    const vandaagAms = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
    const { dag, isWeekend, dagNummer } = getDagInfo()

    const [profileRes, checkinRes, statusRes, blessuresRes, lifeEventsRes, goalsRes, herhalendeEventsRes, garminRes, trainingsRes, journalRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('daily_checkins').select('*').eq('user_id', user.id).eq('date', today).single(),
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
      supabase.from('garmin_imports')
        .select('parsed_data, date')
        .eq('user_id', user.id)
        .eq('status', 'confirmed')
        .order('date', { ascending: false })
        .limit(1)
        .single(),
      supabase.from('training_results')
        .select('rating, actual_duration, completed_at')
        .eq('user_id', user.id)
        .eq('completed', true)
        .order('completed_at', { ascending: false })
        .limit(5),
      supabase.from('journal_entries')
        .select('energy, stress, motivation, note, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3),
    ])

    const profile = profileRes.data
    const checkin = checkinRes.data
    const status = statusRes.data
    const blessures = blessuresRes.data || []
    const lifeEvents = lifeEventsRes.data || []
    const goals = goalsRes.data || []
    const herhalendeEvents = herhalendeEventsRes.data || []
    const garmin = garminRes.data?.parsed_data || null
    const loadContext = ''
    const trainingen = trainingsRes.data || []
    const journalEntries = journalRes.data || []
    const journalContext = journalEntries.length > 0
      ? `Dagboek (laatste ${journalEntries.length} notities):\n` + journalEntries.map((j: {energy?: number|null; stress?: number|null; motivation?: number|null; note?: string|null; created_at: string}) => {
          const tijd = new Date(j.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })
          const datum = new Date(j.created_at).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' })
          const scores = [j.energy ? 'energie ' + j.energy : '', j.stress ? 'stress ' + j.stress : '', j.motivation ? 'motivatie ' + j.motivation : ''].filter(Boolean).join(', ')
          return datum + ' ' + tijd + (scores ? ': ' + scores : '') + (j.note ? ' — "' + j.note + '"' : '')
        }).join('\n')
      : ''
    const gemRating = trainingen.filter((t: {rating: number|null}) => t.rating).length > 0
      ? Math.round(trainingen.filter((t: {rating: number|null}) => t.rating).reduce((a: number, t: {rating: number|null}) => a + (t.rating || 0), 0) / trainingen.filter((t: {rating: number|null}) => t.rating).length * 10) / 10
      : null
    const trainingsContext = trainingen.length > 0
      ? `Trainingshistorie: ${trainingen.length} sessies, gem. rating ${gemRating}/10`
      : 'Nog geen trainingen'
    const garminDatum = garminRes.data?.date || null
    const garminIsVandaag = garminDatum === vandaagAms

    const relevanteHerhalendeEvents = herhalendeEvents.filter(he => {
      if (isWeekend && WERK_TYPES.includes(he.type)) {
        const days = he.recurrence_days as number[] | null
        if (!days) return false
        return days.includes(dagNummer)
      }
      if (he.recurrence === 'workdays' && isWeekend) return false
      if (he.recurrence === 'weekend' && !isWeekend) return false
      if (he.recurrence === 'weekly' || he.recurrence === 'biweekly' || he.recurrence === 'custom') {
        const days = he.recurrence_days as number[] | null
        return days ? days.includes(dagNummer) : true
      }
      return true
    })

    const alleEvents = [...lifeEvents]
    relevanteHerhalendeEvents.forEach(he => {
      if (!alleEvents.find(e => e.type === he.type)) alleEvents.push(he)
    })

    const naam = profile?.display_name || profile?.first_name || 'je'
    const score = status?.coach_score || 50
    const herstel = status?.recovery_score || 50

    // Garmin context string
    let garminContext = ''
    if (garmin) {
      const label = garminIsVandaag ? 'vandaag' : 'gisteren'
      garminContext = [
        `Garmin data (${label}):`,
        garmin.resting_hr ? `- Rusthartslag: ${garmin.resting_hr} bpm` : '',
        garmin.body_battery?.current !== null ? `- Body Battery: ${garmin.body_battery.current} (opgeladen +${garmin.body_battery.charged}, verbruikt -${garmin.body_battery.spent})` : '',
        garmin.sleep?.score ? `- Slaapscore: ${garmin.sleep.score}/100 (${Math.floor((garmin.sleep.duration_minutes || 0) / 60)}u ${(garmin.sleep.duration_minutes || 0) % 60}m)` : '',
        garmin.hrv?.avg_7d_ms ? `- HRV 7d gem.: ${garmin.hrv.avg_7d_ms} ms (${garmin.hrv.status || ''})` : '',
        garmin.steps?.value ? `- Stappen: ${garmin.steps.value.toLocaleString('nl-NL')}` : '',
      ].filter(Boolean).join('\n')
    }

    const context = [
      `Dag: ${dag} ${isWeekend ? '(WEEKEND — vrije dag)' : '(werkdag)'}`,
      `Coach Score: ${score}/100, Herstel: ${herstel}/100`,
      checkin ? `Gevoel: ${checkin.feeling_score}/10, Energie: ${checkin.energy_score}/10, Stress: ${(checkin as {stress_score?: number}).stress_score || '?'}/10` : 'Geen check-in',
      garminContext,
      blessures.length > 0 ? `Blessures: ${blessures.map(b => b.body_part).join(', ')}` : '',
      alleEvents.length > 0 ? `Vandaag actieve events: ${alleEvents.map(e => {
        const tijden = e.start_hour !== null && e.end_hour !== null
          ? ` ${String(e.start_hour).padStart(2,'0')}:00-${String(e.end_hour).padStart(2,'0')}:00`
          : ''
        const notitie = e.notes ? ` (${e.notes})` : ''
        return e.type + tijden + notitie
      }).join(', ')}` : isWeekend ? 'Geen werkverplichtingen vandaag' : '',
      goals.length > 0 ? `Doelen: ${goals.map(g => g.title).join(', ')}` : '',
      journalContext,
      loadContext,
      trainingsContext,
    ].filter(Boolean).join('\n')

    const systemPrompt = `Je bent een ervaren coach die een concreet dagplan maakt voor ${naam}.

DATA VANDAAG:
${context}

INSTRUCTIES:
- Het is vandaag ${dag}${isWeekend
  ? '. Het is WEEKEND — geen werk. Plan activiteiten op realistische tijden voor een vrije dag.'
  : '.'}
- Gebruik de Garmin data (Body Battery, slaap, HRV) als leidraad voor intensiteit
- Body Battery onder 50: focus op herstel en lichte activiteit
- Slaapscore onder 70: extra herstelmoment inplannen
- HRV status "laag" of "ongebalanceerd": geen intensieve training
- Houd rekening met blessures
- Coach score onder 50: focus op herstel
- Maak 3-5 concrete acties verspreid over de dag
- Plan NOOIT activiteiten tijdens werktijd — als iemand 06:00-15:00 werkt, plan dan alleen voor 06:00 of na 15:00
- Gebruik GEEN markdown, geen bold, geen bullets

Reageer ALLEEN in dit JSON formaat:
{
  "acties": [
    { "tijd": "09:00", "actie": "Beschrijving van de actie" }
  ]
}`

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
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
