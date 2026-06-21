export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { fetchTodaysLifeEvents, formatLifeEventsContext } from '@/core/utils/life-events-context'

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

    const [profileRes, checkinRes, statusRes, blessuresRes, goalsRes, garminRes, trainingsRes, journalRes, alleEvents] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('daily_checkins').select('*').eq('user_id', user.id).eq('date', today).single(),
      supabase.from('daily_status').select('*').eq('user_id', user.id).eq('date', today).single(),
      supabase.from('injuries').select('body_part, pain_score').eq('user_id', user.id).eq('active', true),
      supabase.from('user_goals').select('title').eq('user_id', user.id).eq('status', 'active'),
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
      fetchTodaysLifeEvents(supabase, user.id, dagNummer, isWeekend),
    ])

    const profile = profileRes.data
    const checkin = checkinRes.data
    const status = statusRes.data
    const blessures = blessuresRes.data || []
    const goals = goalsRes.data || []
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

    // Levensgebeurtenissen — alle categorieën, zelfde selectie als coach/route.ts
    const lifeEventsContext = formatLifeEventsContext(alleEvents)

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
      lifeEventsContext || (isWeekend ? 'Geen werkverplichtingen vandaag' : ''),
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
- Houd rekening met levensgebeurtenissen (ziek, slecht geslapen, jetlag, vakantie, emotionele stress, etc.) — niet alleen werk
- Coach score onder 50: focus op herstel
- Maak 3-5 concrete acties verspreid over de dag
- Plan NOOIT activiteiten tijdens werktijd — als iemand 06:00-15:00 werkt, plan dan alleen voor 06:00 of na 15:00
- Houd elke actie KORT en bondig (max 1-2 zinnen) — dit is een dagplan, geen essay
- Gebruik GEEN markdown, geen bold, geen bullets

Reageer ALLEEN in dit JSON formaat:
{
  "acties": [
    { "tijd": "09:00", "actie": "Beschrijving van de actie" }
  ]
}`

    let aiRes: Response
    try {
      aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1500,
          system: systemPrompt,
          messages: [{ role: 'user', content: 'Maak mijn dagplan.' }],
        }),
      })
    } catch (fetchError) {
      console.error('Action plan: Anthropic fetch netwerkfout:', fetchError)
      return NextResponse.json({ error: 'Kon geen verbinding maken met AI service' }, { status: 500 })
    }

    if (!aiRes.ok) {
      const errBody = await aiRes.text().catch(() => '')
      console.error(`Action plan: Anthropic API status ${aiRes.status}:`, errBody)
      return NextResponse.json({ error: `AI service fout (${aiRes.status})` }, { status: 500 })
    }

    const aiData = await aiRes.json()
    const rawText = aiData.content?.[0]?.text || ''

    let acties: Array<{ tijd: string; actie: string }> = []
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        acties = parsed.acties || []
      }
    } catch (parseError) {
      console.error('Action plan: JSON parse fout:', parseError, 'Raw text:', rawText.slice(0, 500))
      console.error('Action plan: stop_reason was:', aiData.stop_reason)
      return NextResponse.json({ error: 'Generatie mislukt' }, { status: 500 })
    }

    if (acties.length === 0) {
      console.error('Action plan: geen acties in response. Raw text:', rawText.slice(0, 500))
      return NextResponse.json({ error: 'Geen acties gegenereerd' }, { status: 500 })
    }

    // UPDATE eerst — dit raakt alleen het action_plan veld van een
    // BESTAANDE rij (meestal al aangemaakt door /api/coach) zonder
    // andere verplichte velden (recommendation, reasoning, actie_type)
    // te overschrijven met null. select() erbij om te zien of er
    // daadwerkelijk een rij geraakt is.
    const { data: updated, error: updateError } = await supabase
      .from('coach_recommendations')
      .update({ action_plan: acties })
      .eq('user_id', user.id)
      .eq('date', today)
      .eq('type', 'coach')
      .select('id')

    if (updateError) {
      console.error('Action plan: Supabase update fout:', updateError)
      return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
    }

    // Geen rij geraakt = er bestond nog geen coach_recommendations rij
    // voor vandaag (bijv. coach-route nog niet eerder gedraaid). Maak
    // er dan zelf een aan met sensible defaults voor de verplichte
    // velden, zodat de NOT NULL constraint op "recommendation" niet
    // wordt geschonden.
    if (!updated || updated.length === 0) {
      const { error: insertError } = await supabase
        .from('coach_recommendations')
        .insert({
          user_id: user.id,
          date: today,
          type: 'coach',
          recommendation: 'Bekijk je dagplan hieronder',
          reasoning: 'Gegenereerd via dagplan — nog geen apart coach advies voor vandaag.',
          actie_type: 'herstel',
          advice_bullets: JSON.stringify([]),
          action_plan: acties,
        })

      if (insertError) {
        console.error('Action plan: Supabase insert fallback fout:', insertError)
        return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
      }
    }

    return NextResponse.json({ plan: acties })
  } catch (error) {
    console.error('Action plan error:', error)
    return NextResponse.json({ error: 'Generatie mislukt' }, { status: 500 })
  }
}
