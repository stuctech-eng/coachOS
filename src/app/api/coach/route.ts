export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { calculateRecoveryScore } from '@/core/ai-engine/recovery-engine'
import { buildDailyCoachPrompt, WeekMetrics } from '@/core/prompts/daily-coach'
import { fetchTodaysLifeEvents, formatLifeEventsContext } from '@/core/utils/life-events-context'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

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

    const drieDagenGeleden = new Date()
    drieDagenGeleden.setDate(drieDagenGeleden.getDate() - 3)
    const drieDagenGeledenStr = drieDagenGeleden.toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })

    const vandaagNummer = new Date().getDay()
    const isWeekend = vandaagNummer === 0 || vandaagNummer === 6

    const [profileRes, goalsRes, checkinRes, metricsRes, memoryRes, weekMetricsRes, activiteitenRes, garminRes, garminWeekRes, trainingsRes, blessuresRes, journalRes, lifeEvents, exerciseRecordsRes, coachCallsRes, weerRes] = await Promise.all([
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
      supabase.from('injuries')
        .select('body_part, pain_score')
        .eq('user_id', user.id)
        .eq('active', true),
      supabase.from('journal_entries')
        .select('energy, stress, motivation, note, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3),
      fetchTodaysLifeEvents(supabase, user.id, vandaagNummer, isWeekend),
      // Progressie: exercise records laatste 30 dagen voor PR context
      supabase.from('exercise_records')
        .select('exercise_name, module, weight_kg, reps, duration_sec, performed_at')
        .eq('user_id', user.id)
        .gte('performed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('performed_at', { ascending: false })
        .limit(100),
      // Stap 3: Coach Call evaluaties laatste 3 dagen
      supabase.from('coach_calls')
        .select('date, coach_call_items(sport_type, duration_min, rating, mood, notes, status)')
        .eq('user_id', user.id)
        .gte('date', drieDagenGeledenStr)
        .in('status', ['pending', 'partial', 'completed'])
        .order('date', { ascending: false })
        .limit(3),
      // FIX v2.4.4: timeout toegevoegd — voorkomt dat een hangende Open-Meteo
      // verbinding de volledige coach-advies-generatie blokkeert (500 na platform-timeout)
      fetchWithTimeout('https://coach-os-tau.vercel.app/api/weather', {}, 3000)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null),
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
    const blessures = blessuresRes.data || []

    const lifeEventsContext = formatLifeEventsContext(lifeEvents)

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

    // ── Stap 3: Coach Call evaluatiecontext ───────────────────────────────────
    const coachCalls = coachCallsRes.data || []
    const MOOD_LABELS: Record<number, string> = { 1: 'slecht 😞', 2: 'matig 😐', 3: 'prima 🙂', 4: 'goed 😃', 5: 'geweldig 🔥' }

    const coachCallContext = coachCalls.length > 0 ? (() => {
      const regels: string[] = ['\nEvaluaties van recente trainingen (Coach Call data):']
      for (const call of coachCalls) {
        const items = (call.coach_call_items || []) as Array<{
          sport_type: string; duration_min: number; rating: number | null;
          mood: number | null; notes: string | null; status: string
        }>
        const gedaan = items.filter(i => i.status === 'done' && i.rating)
        if (gedaan.length === 0) continue

        const datumLabel = new Date(call.date + 'T12:00:00').toLocaleDateString('nl-NL', {
          weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam'
        })
        regels.push(`\n${datumLabel}:`)

        for (const item of gedaan) {
          const moodLabel = item.mood ? MOOD_LABELS[item.mood] || String(item.mood) : 'niet ingevuld'
          regels.push(`- ${item.sport_type}: RPE ${item.rating}/10, mood ${moodLabel}, duur ${item.duration_min} min${item.notes ? ` — "${item.notes}"` : ''}`)
        }
      }

      if (regels.length <= 1) return ''

      regels.push('\nAls de gebruiker een training heeft gedaan terwijl jij rust of herstel had geadviseerd, weet je dat nu. Je mag daar in je advies op reageren — direct maar zonder te overdrijven. Als RPE hoog was en mood laag, is dat een signaal van overbelasting.')
      return regels.join('\n')
    })() : ''

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

    // ── Progressie trendanalyse voor de coach (Fase 3A) ─────────────────────
    const exerciseRecords = exerciseRecordsRes.data || []
    let progressieContext = ''

    if (exerciseRecords.length > 0) {
      // Groepeer per oefening — chronologisch gesorteerd (oudste eerst)
      type ExRec = { exercise_name: string; module: string; weight_kg: number | null; reps: number | null; duration_sec: number | null; performed_at: string }
      const groepen = new Map<string, ExRec[]>()
      for (const rec of (exerciseRecords as ExRec[]).slice().reverse()) {
        if (!groepen.has(rec.exercise_name)) groepen.set(rec.exercise_name, [])
        groepen.get(rec.exercise_name)!.push(rec)
      }

      // Bereken trend per oefening
      type Trend = {
        naam: string; module: string; uitvoeringen: number
        eerste_gewicht: number | null; laatste_gewicht: number | null
        eerste_reps: number | null; laatste_reps: number | null
        verandering_pct: number | null; trend: 'stijgend' | 'stabiel' | 'dalend'
      }
      const trends: Trend[] = []

      for (const [naam, recs] of groepen) {
        if (recs.length < 2) {
          // Slechts 1 uitvoering — alleen PR tonen
          const r = recs[0]
          trends.push({
            naam, module: r.module, uitvoeringen: 1,
            eerste_gewicht: r.weight_kg, laatste_gewicht: r.weight_kg,
            eerste_reps: r.reps, laatste_reps: r.reps,
            verandering_pct: null, trend: 'stabiel',
          })
          continue
        }

        const eerste = recs[0]
        const laatste = recs[recs.length - 1]

        // Bereken % verandering — gebruik gewicht of reps
        let verandering_pct: number | null = null
        let trend: 'stijgend' | 'stabiel' | 'dalend' = 'stabiel'

        if (eerste.weight_kg && laatste.weight_kg && eerste.weight_kg > 0) {
          verandering_pct = Math.round(((laatste.weight_kg - eerste.weight_kg) / eerste.weight_kg) * 100)
        } else if (eerste.reps && laatste.reps && eerste.reps > 0) {
          verandering_pct = Math.round(((laatste.reps - eerste.reps) / eerste.reps) * 100)
        }

        if (verandering_pct !== null) {
          if (verandering_pct >= 5) trend = 'stijgend'
          else if (verandering_pct <= -5) trend = 'dalend'
        }

        trends.push({
          naam, module: eerste.module, uitvoeringen: recs.length,
          eerste_gewicht: eerste.weight_kg, laatste_gewicht: laatste.weight_kg,
          eerste_reps: eerste.reps, laatste_reps: laatste.reps,
          verandering_pct, trend,
        })
      }

      // Sorteer — meest uitgevoerd en met trend bovenaan
      const gesorteerd = trends
        .sort((a, b) => b.uitvoeringen - a.uitvoeringen)
        .slice(0, 8)

      // Gemiddelde RPE
      const rpeWaarden = trainingsResultaten.filter(t => t.rating).map(t => t.rating as number)
      const gemRpe = rpeWaarden.length > 0
        ? Math.round(rpeWaarden.reduce((a, b) => a + b, 0) / rpeWaarden.length * 10) / 10
        : null

      // Belastingtrend — vergelijk laatste 2 weken
      const nu = new Date()
      const weekGeleden = new Date(nu.getTime() - 7 * 24 * 60 * 60 * 1000)
      const tweeWekenGeleden = new Date(nu.getTime() - 14 * 24 * 60 * 60 * 1000)
      const dezeWeek = trainingsResultaten.filter(t => new Date(t.completed_at) >= weekGeleden)
      const vorigeWeek = trainingsResultaten.filter(t => {
        const d = new Date(t.completed_at)
        return d >= tweeWekenGeleden && d < weekGeleden
      })
      const dezeWeekMin = dezeWeek.reduce((a, t) => a + (t.actual_duration || 0), 0)
      const vorigeWeekMin = vorigeWeek.reduce((a, t) => a + (t.actual_duration || 0), 0)
      const belastingTrend = vorigeWeekMin > 0
        ? Math.round(((dezeWeekMin - vorigeWeekMin) / vorigeWeekMin) * 100)
        : null

      if (gesorteerd.length > 0) {
        const regels: string[] = [`\n\nProgressie analyse laatste 30 dagen:`]

        for (const t of gesorteerd) {
          let regel = `- ${t.naam} (${t.module}, ${t.uitvoeringen}×)`
          if (t.verandering_pct !== null && t.uitvoeringen >= 2) {
            const richting = t.trend === 'stijgend' ? '↑' : t.trend === 'dalend' ? '↓' : '→'
            if (t.eerste_gewicht && t.laatste_gewicht) {
              regel += `: ${t.eerste_gewicht}kg → ${t.laatste_gewicht}kg (${t.verandering_pct > 0 ? '+' : ''}${t.verandering_pct}%) ${richting}`
            } else if (t.eerste_reps && t.laatste_reps) {
              regel += `: ${t.eerste_reps} → ${t.laatste_reps} reps (${t.verandering_pct > 0 ? '+' : ''}${t.verandering_pct}%) ${richting}`
            }
          } else if (t.laatste_gewicht) {
            regel += `: ${t.laatste_gewicht}kg`
          } else if (t.laatste_reps) {
            regel += `: ${t.laatste_reps} reps`
          }
          regels.push(regel)
        }

        if (gemRpe !== null) regels.push(`Gemiddelde RPE laatste 7 dagen: ${gemRpe}/10`)
        if (belastingTrend !== null) {
          const trendLabel = belastingTrend > 0 ? `+${belastingTrend}%` : `${belastingTrend}%`
          regels.push(`Trainingsbelasting t.o.v. vorige week: ${trendLabel} (${dezeWeekMin} vs ${vorigeWeekMin} min)`)
        }

        regels.push('Gebruik deze trenddata in je advies. Benoem concrete progressie als die er is. Waarschuw bij stijgende belasting + hoge RPE. Stel progressie voor als trend stijgend is en RPE laag.')
        progressieContext = regels.join('\n')
      }
    }

    // ── Weercontext voor de coach ────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const weerData = weerRes as any
    const weerContext = weerData?.coach_context
      ? `\n\nWeersomstandigheden vandaag: ${weerData.coach_context}`
      : ''

    const systemPrompt = buildDailyCoachPrompt(
      profile,
      goalsRes.data || [],
      checkinRes.data || null,
      metricsVandaag,
      recovery,
      memoryRes.data || [],
      weekMetrics,
      recenteActiviteiten
    ) + garminContext + trainingsCoachContext + (progressieContext ? progressieContext : '') + (weerContext || '') + (journalContext ? '\n' + journalContext : '') + (loadContext ? '\n' + loadContext : '') + (lifeEventsContext ? '\n' + lifeEventsContext : '') + (blessureContext ? '\n' + blessureContext : '') + (coachCallContext ? coachCallContext : '') + trainerInstructiePrompt

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
    let trainer_instructies = ''

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

    fetch('https://coach-os-tau.vercel.app/api/memory', { method: 'POST' }).catch(() => {})

    return NextResponse.json(saved)
  } catch (error) {
    console.error('Coach API error:', error)
    return NextResponse.json({ error: 'Coach generatie mislukt' }, { status: 500 })
  }
}
