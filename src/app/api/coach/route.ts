export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { calculateRecoveryScore } from '@/core/ai-engine/recovery-engine'
import { buildDailyCoachPrompt, WeekMetrics } from '@/core/prompts/daily-coach'

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
    if (!user) return NextResponse.json(null)
    const supabase = createAdminClient()
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('coach_recommendations')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .eq('type', 'coach')
      .single()
    return NextResponse.json(data || null)
  } catch {
    return NextResponse.json(null)
  }
}

export async function POST() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()
    const today = new Date().toISOString().split('T')[0]
    const vandaagAms = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })

    const { data: cached } = await supabase
      .from('coach_recommendations')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .eq('type', 'coach')
      .single()
    if (cached?.recommendation && cached?.advice_bullets) return NextResponse.json(cached)

    const zeven = new Date()
    zeven.setDate(zeven.getDate() - 7)
    const zevenDagenGeleden = zeven.toISOString().split('T')[0]

    const [profileRes, goalsRes, checkinRes, metricsRes, memoryRes, weekMetricsRes, activiteitenRes, garminRes, garminWeekRes, trainingsRes, lifeEventsRes, blessuresRes, journalRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('user_goals').select('*').eq('user_id', user.id).eq('status', 'active'),
      supabase.from('daily_checkins').select('*').eq('user_id', user.id).eq('date', today).single(),
      supabase.from('health_metrics').select('*').eq('user_id', user.id).eq('date', today).single(),
      supabase.from('coach_memory').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('health_metrics')
        .select('date, hrv, resting_hr, sleep_duration, steps')
        .eq('user_id', user.id)
        .gte('date', zevenDagenGeleden)
        .order('date', { ascending: true }),
      supabase.from('activity_sessions')
        .select('date, duration, metrics, activities(name)')
        .eq('user_id', user.id)
        .gte('date', zevenDagenGeleden)
        .order('date', { ascending: false })
        .limit(5),
      supabase.from('garmin_imports')
        .select('parsed_data, date')
        .eq('user_id', user.id)
        .eq('status', 'confirmed')
        .order('date', { ascending: false })
        .limit(1)
        .single(),
      supabase.from('garmin_imports')
        .select('parsed_data, date')
        .eq('user_id', user.id)
        .eq('status', 'confirmed')
        .gte('date', zevenDagenGeleden)
        .order('date', { ascending: true }),
      supabase.from('training_results')
        .select('rating, actual_duration, completed_at, training_type')
        .eq('user_id', user.id)
        .eq('completed', true)
        .gte('completed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('completed_at', { ascending: false }),
      supabase.from('life_events')
        .select('type, start_hour, end_hour, notes, recurrence, recurrence_days')
        .eq('user_id', user.id)
        .not('recurrence', 'is', null),
      supabase.from('injuries')
        .select('body_part, pain_score')
        .eq('user_id', user.id)
        .eq('active', true),
      supabase.from('journal_entries')
        .select('energy, stress, motivation, note, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3),
    ])

    const profile = profileRes.data
    if (!profile) return NextResponse.json({ error: 'Profiel niet gevonden' }, { status: 404 })

    const garmin = garminRes.data?.parsed_data || null
    const garminDatum = garminRes.data?.date || null
    const garminIsVandaag = garminDatum === vandaagAms
    const garminWeek = garminWeekRes.data || []
    const journalEntries = journalRes.data || []
    const journalContext = journalEntries.length > 0
      ? `Dagboek (laatste ${journalEntries.length} notities):\n` + journalEntries.map((j: {energy?: number|null; stress?: number|null; motivation?: number|null; note?: string|null; created_at: string}) => {
          const tijd = new Date(j.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })
          const datum = new Date(j.created_at).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' })
          const scores = [j.energy ? 'energie ' + j.energy : '', j.stress ? 'stress ' + j.stress : '', j.motivation ? 'motivatie ' + j.motivation : ''].filter(Boolean).join(', ')
          return datum + ' ' + tijd + (scores ? ': ' + scores : '') + (j.note ? ' — "' + j.note + '"' : '')
        }).join('\n')
      : ''
    const loadContext = ''
    const lifeEvents = lifeEventsRes.data || []
    const blessures = blessuresRes.data || []

    const vandaagNummer = new Date().getDay()
    const isWeekend = vandaagNummer === 0 || vandaagNummer === 6
    const WERK_TYPES = ['nachtdienst', 'avonddienst', 'vroege_dienst', 'dagdienst', 'thuiswerken', 'lange_dag']
    const werkEvents = lifeEvents.filter((e: {type: string; recurrence?: string|null; recurrence_days?: number[]|null}) =>
      WERK_TYPES.includes(e.type) && (
        e.recurrence === 'daily' ||
        (e.recurrence === 'weekdays' && !isWeekend) ||
        (e.recurrence_days && e.recurrence_days.includes(vandaagNummer))
      )
    )
    const werkContext = werkEvents.length > 0
      ? `Werktijden vandaag: ${werkEvents.map((e: {type: string; start_hour?: number|null; end_hour?: number|null}) => `${e.type} ${e.start_hour !== null && e.start_hour !== undefined ? `${String(e.start_hour).padStart(2,'0')}:00-${String(e.end_hour).padStart(2,'0')}:00` : ''}`).join(', ')}`
      : ''
    const blessureContext = blessures.length > 0
      ? `Actieve blessures: ${blessures.map((b: {body_part: string; pain_score: number}) => `${b.body_part} (pijn ${b.pain_score}/10)`).join(', ')}`
      : ''
    const trainingsResultaten = trainingsRes.data || []

    const trainingsCoachContext = trainingsResultaten.length > 0 ? (() => {
      const sessies = trainingsResultaten.filter(t => t.actual_duration && t.rating)
      const totaalDuur = trainingsResultaten.reduce((a, t) => a + (t.actual_duration || 0), 0)
      const uren = Math.floor(totaalDuur / 60)
      const minuten = totaalDuur % 60
      const licht = sessies.filter(t => (t.rating || 0) <= 4).length
      const matig = sessies.filter(t => (t.rating || 0) >= 5 && (t.rating || 0) <= 7).length
      const zwaar = sessies.filter(t => (t.rating || 0) >= 8).length
      const weekBelasting = sessies.reduce((a, t) => a + (t.actual_duration || 0) * (t.rating || 0), 0)
      const belastingLabel = weekBelasting <= 500 ? 'laag' : weekBelasting <= 1500 ? 'gemiddeld' : 'hoog'
      return `\nTrainingsbelasting laatste 7 dagen:` +
        `\n- ${trainingsResultaten.length} training${trainingsResultaten.length !== 1 ? 'en' : ''}` +
        `\n- Totale duur: ${uren > 0 ? `${uren}u ` : ''}${minuten}min` +
        (licht > 0 ? `\n- Licht: ${licht}` : '') +
        (matig > 0 ? `\n- Matig: ${matig}` : '') +
        (zwaar > 0 ? `\n- Zwaar: ${zwaar}` : '') +
        `\n- Trainingsbelasting: ${belastingLabel} (score ${weekBelasting})` +
        `\nGebruik deze samenvatting voor trainingsfrequentie en belasting. Ga niet in op sport-specifieke details (watt, tempo, split) — dat is voor Trainer AI.`
    })() : '\nGeen trainingen afgelopen 7 dagen.'

    const metricsVandaag = metricsRes.data || (garmin ? {
      hrv: garmin.hrv?.avg_7d_ms || null,
      resting_hr: garmin.resting_hr || null,
      sleep_duration: garmin.sleep?.duration_minutes ? Math.round(garmin.sleep.duration_minutes / 60) : null,
      sleep_score: garmin.sleep?.score || null,
      steps: garmin.steps?.value || null,
      body_battery: garmin.body_battery?.current || null,
    } : null)

    const recovery = calculateRecoveryScore(checkinRes.data || null, metricsVandaag || null)

    await supabase.from('daily_status').upsert({
      user_id: user.id, date: today,
      recovery_score: recovery.score,
      energy_score: checkinRes.data?.energy_score ? checkinRes.data.energy_score * 10 : null,
      status_color: recovery.color,
    })

    let weekMetrics: WeekMetrics | null = null
    const weekData = weekMetricsRes.data || []

    if (weekData.length > 0) {
      weekMetrics = {
        hrv: weekData.filter(d => d.hrv).map(d => d.hrv as number),
        resting_hr: weekData.filter(d => d.resting_hr).map(d => d.resting_hr as number),
        sleep_duration: weekData.filter(d => d.sleep_duration).map(d => d.sleep_duration as number),
        steps: weekData.filter(d => d.steps).map(d => d.steps as number),
        dates: weekData.map(d => d.date),
      }
    } else if (garminWeek.length > 0) {
      weekMetrics = {
        hrv: garminWeek.filter(g => g.parsed_data?.hrv?.avg_7d_ms).map(g => g.parsed_data.hrv.avg_7d_ms as number),
        resting_hr: garminWeek.filter(g => g.parsed_data?.resting_hr).map(g => g.parsed_data.resting_hr as number),
        sleep_duration: garminWeek.filter(g => g.parsed_data?.sleep?.duration_minutes).map(g => Math.round(g.parsed_data.sleep.duration_minutes / 60)),
        steps: garminWeek.filter(g => g.parsed_data?.steps?.value).map(g => g.parsed_data.steps.value as number),
        dates: garminWeek.map(g => g.date),
      }
    }

    let garminContext = ''
    if (garmin) {
      const label = garminIsVandaag ? 'vandaag' : 'gisteren'
      garminContext = [
        `\nGarmin data (${label}):`,
        garmin.resting_hr ? `Rusthartslag: ${garmin.resting_hr} bpm` : '',
        garmin.body_battery?.current !== null ? `Body Battery: ${garmin.body_battery.current} (opgeladen +${garmin.body_battery.charged}, verbruikt -${garmin.body_battery.spent})` : '',
        garmin.sleep?.score ? `Slaapscore: ${garmin.sleep.score}/100, duur: ${Math.floor((garmin.sleep.duration_minutes || 0) / 60)}u ${(garmin.sleep.duration_minutes || 0) % 60}m` : '',
        garmin.hrv?.avg_7d_ms ? `HRV 7d gem.: ${garmin.hrv.avg_7d_ms} ms — status: ${garmin.hrv.status || 'onbekend'}` : '',
        garmin.steps?.value ? `Stappen: ${garmin.steps.value.toLocaleString('nl-NL')} (doel: ${(garmin.steps.goal || 0).toLocaleString('nl-NL')})` : '',
        garmin.calories?.total ? `Calorieën: ${garmin.calories.total} kcal (actief: ${garmin.calories.active})` : '',
      ].filter(Boolean).join('\n')
    }

    const recenteActiviteiten: string[] = (activiteitenRes.data || []).map(a => {
      const activiteit = a.activities as { name: string } | { name: string }[] | null
      const naam = (Array.isArray(activiteit) ? activiteit[0]?.name : activiteit?.name) || 'Activiteit'
      const duur = a.duration ? a.duration + ' min' : ''
      const afstand = (a.metrics as { distance?: number })?.distance
        ? ((a.metrics as { distance?: number }).distance! / 1000).toFixed(1) + ' km'
        : ''
      return [naam, duur, afstand].filter(Boolean).join(' — ')
    })

    const trainerInstructiePrompt = `

INSTRUCTIES VOOR TRAINER AI:
Jij (Coach) geeft hieronder ook expliciete instructies mee aan Trainer AI via het veld "trainer_instructies".
Trainer AI voert jouw trainingsplan uit en kiest de oefeningen.
${blessures.length > 0 ? `De gebruiker heeft actieve blessures: ${blessures.map((b: {body_part: string; pain_score: number}) => `${b.body_part} (pijn ${b.pain_score}/10)`).join(', ')}. Geef Trainer AI duidelijke instructies welke oefeningen vermeden moeten worden en welke juist goed zijn.` : ''}

Voeg aan je JSON response het veld "trainer_instructies" toe: een korte, directe instructie voor Trainer AI over wat hij wel/niet moet doen vandaag. Bijvoorbeeld: "Vermijd heup-belastende oefeningen (swings, squats, lunges). Gebruik alleen upper body en carry oefeningen." of "Volle training toegestaan, focus op techniek." of "Alleen herstel vandaag, geen krachttraining."`

    const systemPrompt = buildDailyCoachPrompt(
      profile,
      goalsRes.data || [],
      checkinRes.data || null,
      metricsVandaag,
      recovery,
      memoryRes.data || [],
      weekMetrics,
      recenteActiviteiten
    ) + garminContext + trainingsCoachContext + (journalContext ? '\n' + journalContext : '') + (loadContext ? '\n' + loadContext : '') + (werkContext ? '\n' + werkContext : '') + (blessureContext ? '\n' + blessureContext : '') + trainerInstructiePrompt

    // Directe Anthropic API call — geen /api/ai proxy
    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Geef mijn coaching advies voor vandaag.' }],
      }),
    })

    const aiData = await aiResponse.json()
    const rawText = aiData.content?.[0]?.text || ''

    let recommendation = 'Een rustige wandeling van 30 minuten'
    let reasoning = 'Op basis van je herstelstatus is lichte beweging de beste keuze vandaag.'
    let actie_type: 'trainen' | 'herstel' | 'rust' = 'herstel'
    let main_action = ''
    let advice_bullets: string[] = []
    let trainer_instructies = '' // Expliciete instructies van Coach aan Trainer

    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.main_action) {
          main_action = parsed.main_action
          recommendation = parsed.main_action
        } else if (parsed.recommendation) {
          recommendation = parsed.recommendation
          main_action = parsed.recommendation
        }
        if (parsed.reasoning) reasoning = parsed.reasoning
        if (parsed.actie_type && ['trainen', 'herstel', 'rust'].includes(parsed.actie_type)) {
          actie_type = parsed.actie_type
        }
        if (Array.isArray(parsed.advice_bullets)) {
          advice_bullets = parsed.advice_bullets.slice(0, 4)
        }
        if (parsed.trainer_instructies) {
          trainer_instructies = parsed.trainer_instructies
        }
      } else if (rawText.length > 10) {
        reasoning = rawText
      }
    } catch {
      if (rawText.length > 10) reasoning = rawText
    }

    const { data: saved, error: saveError } = await supabase
      .from('coach_recommendations')
      .upsert({
        user_id: user.id, date: today,
        type: 'coach',
        recommendation, reasoning, actie_type, advice_bullets: JSON.stringify(advice_bullets),
        trainer_instructies,
        recovery_status: recovery.status,
        energy_level: checkinRes.data?.energy_score || 5,
      }, { onConflict: 'user_id,date,type' })
      .select().single()

    if (saveError) throw saveError

    await supabase.from('ai_conversations').insert({
      user_id: user.id, role: 'assistant', message: recommendation,
    })

    // Memory update — fire and forget
    fetch('https://coach-os-tau.vercel.app/api/memory', { method: 'POST' }).catch(() => {})

    return NextResponse.json(saved)
  } catch (error) {
    console.error('Coach API error:', error)
    return NextResponse.json({ error: 'Coach generatie mislukt' }, { status: 500 })
  }
}
