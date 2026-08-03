export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { calculateRecoveryScore } from '@/core/ai-engine/recovery-engine'
import { buildDailyCoachPrompt, WeekMetrics } from '@/core/prompts/daily-coach'
import { haalDagContext, formatResolvedContext } from '@/core/utils/life-events-context'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { genereerCoachPolicy } from '@/lib/specialists/coach-policy'
import { beslisTussenSpecialisten } from '@/lib/specialists/decision-engine'
import { haalGoalsMetProgress } from '@/lib/specialists/goal-engine'
import { haalHrvTrend } from '@/lib/specialists/health-analysis-engine'
import { haalPerformanceVoorRecovery } from '@/lib/specialists/health-analysis-engine'
import { bepaalTodayPlan } from '@/lib/today-engine'

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

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()
    const today = new Date().toISOString().split('T')[0]
    const vandaagAms = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })

    // v2.4.180-FIX: verwijderd — deze "geef bestaande rij terug, genereer
    // niets nieuws" kortsluiting zat IN de POST-functie zelf, die
    // uitsluitend via expliciete knopklikken wordt aangeroepen (ververs-
    // knop, "Genereer advies"-knop). Er is geen achtergrond-aanroeper die
    // hiervan profiteert. Gevolg: als er ooit een rij met fallback-tekst
    // was aangemaakt (bijv. door de race condition uit v2.4.179, vóór die
    // fix), kon de gebruiker daar nooit meer vanaf komen — een expliciete
    // klik op ververs gaf gewoon dezelfde oude tekst terug, want zowel
    // recommendation als advice_bullets waren toevallig gevuld (ook al
    // was het de foute inhoud). POST betekent nu altijd: echt opnieuw
    // genereren. GET (hierboven) blijft de cache-lezende variant voor
    // stille achtergrond-weergave bij het openen van Home.

    const zeven = new Date()
    zeven.setDate(zeven.getDate() - 7)
    const zevenDagenGeleden = zeven.toISOString().split('T')[0]

    const drieDagenGeleden = new Date()
    drieDagenGeleden.setDate(drieDagenGeleden.getDate() - 3)
    const drieDagenGeledenStr = drieDagenGeleden.toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })

    const vandaagNummer = new Date().getDay()
    const isWeekend = vandaagNummer === 0 || vandaagNummer === 6

    const [profileRes, goalsRes, checkinRes, metricsRes, memoryRes, weekMetricsRes, activiteitenRes, garminRes, garminWeekRes, trainingsRes, blessuresRes, journalRes, dagContext, exerciseRecordsRes, coachCallsRes, weerRes, actieveSpecialistenRes] = await Promise.all([
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
      haalDagContext(supabase, user.id, vandaagNummer, isWeekend),
      // v2.4.52/53: advised_weight_kg + tempo/advised_tempo toegevoegd aan
      // de select, nodig voor de advies-vs-gebruikt-vergelijking hieronder
      supabase.from('exercise_records')
        .select('exercise_name, module, weight_kg, advised_weight_kg, tempo, advised_tempo, reps, duration_sec, performed_at')
        .eq('user_id', user.id)
        .gte('performed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('performed_at', { ascending: false })
        .limit(100),
      supabase.from('coach_calls')
        .select('date, coach_call_items(sport_type, duration_min, rating, mood, notes, status)')
        .eq('user_id', user.id)
        .gte('date', drieDagenGeledenStr)
        .in('status', ['pending', 'partial', 'completed'])
        .order('date', { ascending: false })
        .limit(3),
      fetchWithTimeout('https://coach-os-tau.vercel.app/api/weather', {}, 3000)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null),
      // v2.4.80: welke specialisten zijn actief — bepaalt of we straks
      // hun SpecialistSummary erbij zoeken (zie na de Promise.all)
      supabase.from('specialist_profiles').select('specialist_type').eq('user_id', user.id).eq('active', true),
    ])

    const profile = profileRes.data
    if (!profile) return NextResponse.json({ error: 'Profiel niet gevonden' }, { status: 404 })

    // ── v2.4.84: CoachPolicy hier ook opgehaald — nodig als input voor de
    // Decision Engine (policy.priority bepaalt of er "ruimte" is voor
    // meerdere specialisten om tegelijk op te bouwen). Dezelfde
    // deterministische functie als de specialist-routes al gebruiken —
    // zelfde dag, zelfde onderliggende data, dus consistente uitkomst.
    let masterPolicy: Awaited<ReturnType<typeof genereerCoachPolicy>> | null = null
    try {
      masterPolicy = await genereerCoachPolicy(user.id)
    } catch (policyErr) {
      console.error('[coach] CoachPolicy ophalen mislukt voor Decision Engine, specialisten blijven gelijkwaardig:', policyErr)
    }

    // ── v2.4.80: SpecialistSummary's ophalen voor actieve specialisten ──
    // Bron: docs/specialist-coach-policy.md. Master Coach leest de meest
    // recente SpecialistSummary per actieve specialist (nooit ruwe
    // specialist-data zelf) en neemt dat mee in zijn eigen eindadvies.
    // Bewust in een eigen try/catch: als dit om welke reden dan ook
    // faalt, mag het dagelijkse coach-advies NOOIT breken — specialisten
    // zijn een aanvulling, geen vereiste.
    let specialistContext = ''
    try {
      const actieveSpecialisten = actieveSpecialistenRes.data || []
      if (actieveSpecialisten.length > 0) {
        const summaries = await Promise.all(
          actieveSpecialisten.map(async (s: { specialist_type: string }) => {
            const { data } = await supabase
              .from('specialist_analyses')
              .select('specialist_summary, generated_at')
              .eq('user_id', user.id)
              .eq('specialist_type', s.specialist_type)
              .not('specialist_summary', 'is', null)
              .order('generated_at', { ascending: false })
              .limit(1)
              .maybeSingle()
            return data
          })
        )

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const geldigeSummaries = summaries.filter((s): s is { specialist_summary: any; generated_at: string } => !!s?.specialist_summary)

        if (geldigeSummaries.length > 0) {
          // ── v2.4.84: Decision Engine — alleen relevant bij 2+ specialisten
          // met een geldige summary. Bepaalt of er een conflict is
          // (bijv. beide willen vandaag volume opbouwen) en zo ja, wie
          // vandaag de hoofdfocus krijgt. Geeft null terug als er geen
          // conflict is — dan blijft het bestaande gedrag (alle
          // specialisten gelijkwaardig genoemd) ongewijzigd.
          let decision: ReturnType<typeof beslisTussenSpecialisten> = null
          if (masterPolicy) {
            try {
              // v2.4.87, rechtzetting: importance (gebruikerskeuze) en
              // calculated_urgency (Goal Engine-berekening) APART
              // opgehaald, niet meer vermengd tot één "urgency"-veld
              const doelData = await Promise.all(
                geldigeSummaries.map(async (s) => {
                  const specialistNaam = typeof s.specialist_summary.specialist === 'string' ? s.specialist_summary.specialist : 'specialist'
                  try {
                    const goals = await haalGoalsMetProgress(user.id, specialistNaam)
                    const specialistDoelen = goals.filter(g => g.goal_scope === 'specialist')
                    if (specialistDoelen.length === 0) return { hoogsteImportance: undefined, hoogsteUrgentie: undefined, naasteDeadlineDagen: undefined }
                    const importanceRang: Record<string, number> = { must: 3, high: 2, normal: 1, low: 0 }
                    const urgentieRang: Record<string, number> = { critical: 3, high: 2, normal: 1, low: 0 }
                    const hoogsteImportanceDoel = specialistDoelen.reduce((a, b) => importanceRang[a.importance] >= importanceRang[b.importance] ? a : b)
                    const hoogsteUrgentieDoel = specialistDoelen.reduce((a, b) => urgentieRang[a.calculated_urgency] >= urgentieRang[b.calculated_urgency] ? a : b)
                    const deadlines = specialistDoelen.map(g => g.dagen_resterend).filter((d): d is number => d !== null)
                    const naasteDeadline = deadlines.length > 0 ? Math.min(...deadlines) : null
                    return { hoogsteImportance: hoogsteImportanceDoel.importance, hoogsteUrgentie: hoogsteUrgentieDoel.calculated_urgency, naasteDeadlineDagen: naasteDeadline }
                  } catch {
                    return { hoogsteImportance: undefined, hoogsteUrgentie: undefined, naasteDeadlineDagen: undefined }
                  }
                })
              )

              decision = beslisTussenSpecialisten(
                geldigeSummaries.map((s, i) => ({
                  specialist: typeof s.specialist_summary.specialist === 'string' ? s.specialist_summary.specialist : 'specialist',
                  load: s.specialist_summary.load,
                  risk: s.specialist_summary.risk,
                  recommendation: s.specialist_summary.recommendation,
                  hoogsteImportance: doelData[i].hoogsteImportance,
                  hoogsteUrgentie: doelData[i].hoogsteUrgentie,
                  naasteDeadlineDagen: doelData[i].naasteDeadlineDagen,
                })),
                masterPolicy.priority
              )
            } catch (decisionErr) {
              console.error('[coach] Decision Engine mislukt, specialisten blijven gelijkwaardig:', decisionErr)
            }
          }

          const regels = geldigeSummaries.map(s => {
            const sum = s.specialist_summary
            const specialistNaam = typeof sum.specialist === 'string' ? sum.specialist : 'specialist'
            const isAfgewezen = decision?.rejectedCoaches.includes(specialistNaam)
            const markering = isAfgewezen ? ' [vandaag getemperd — zie Decision Engine-toelichting]' : ''
            return `- ${specialistNaam} Coach: belasting ${sum.load}, progressie ${sum.progress}, risico ${sum.risk}. "${sum.recommendation}" (zekerheid ${sum.confidence}%)${markering}`
          })

          const decisionToelichting = decision
            ? `\n\nDecision Engine-toelichting (deterministisch bepaald, niet zelf heroverwegen): ${decision.selectedCoach} Coach krijgt vandaag de hoofdfocus. Reden: ${decision.reasoning.join(' ')}`
            : ''

          specialistContext = `\n\nActieve specialisten — samenvatting (niet zelf herberekenen, dit is al hun eigen analyse):\n${regels.join('\n')}${decisionToelichting}\nNeem dit mee in je algehele advies indien relevant, maar jij blijft eindverantwoordelijk voor de gezondheids- en herstelbeslissing.`
        }
      }
    } catch (specialistErr) {
      console.error('[coach] Specialist-context ophalen mislukt, dagadvies gaat door zonder:', specialistErr)
    }

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

    // v2.4.172 (Coach Context Engine Fase 1): opgeloste dagcontext
    // i.p.v. de ruwe eventlijst — vakantie/ziekte/blessure onderdrukt
    // nu automatisch conflicterende werk-events, geen tegenstrijdige
    // context meer naar de Coach ("werkt vandaag" + "op vakantie"
    // tegelijk kon eerder allebei in de prompt terechtkomen)
    const lifeEventsContext = formatResolvedContext(dagContext)

    // v2.4.174 (Coach Context Engine, prioriteit 1): de Coach-tekst
    // gebruikte tot nu toe een ANDERE bron dan de Today Engine-kaart op
    // Home (trainingsgeschiedenis + specialist-samenvatting, i.p.v. het
    // exacte schema van vandaag). Twee bronnen van waarheid — konden in
    // theorie iets anders zeggen. Nu leest de Coach-prompt hetzelfde,
    // al-bepaalde TodayPlan als de kaart — één waarheid, niet twee.
    // Eigen try/catch: mag de rest van het Coach-advies nooit blokkeren.
    let todayEngineContext = ''
    try {
      const cookieHeader = req.headers.get('cookie') || ''
      const todayPlan = await bepaalTodayPlan(user.id, cookieHeader, req.nextUrl.origin)
      if (todayPlan.source !== 'rust' || todayPlan.title !== 'Geen training gepland') {
        // v2.4.250-FIX: 'rowing' ontbrak in deze bronlabel-ternary —
        // zou eerder als "Rust" in de prompt terechtgekomen zijn,
        // exact hetzelfde bug-patroon als eerder vandaag meermaals
        // gevonden en gefixt (Training Plan Engine, Smart Actions, etc.)
        const bronLabel = todayPlan.source === 'cycling' ? 'Cycling Specialist' : todayPlan.source === 'running' ? 'Running Specialist' : todayPlan.source === 'rowing' ? 'Rowing Specialist' : todayPlan.source === 'trainer' ? 'Trainer AI' : 'Rust'
        todayEngineContext = `\nVANDAAG STAAT GEPLAND (bepaald door de Today Engine — dit is de autoritatieve bron, gebruik dit als basis voor je trainingsadvies, verzin geen ander sessietype):\n- ${todayPlan.title}${todayPlan.duration ? ` (${todayPlan.duration} min)` : ''}${todayPlan.intensity ? `, intensiteit ${todayPlan.intensity}` : ''}\n- Bron: ${bronLabel}\n- Reden: ${todayPlan.reason}${todayPlan.trainingPhase ? `\n- Trainingsfase: ${todayPlan.trainingPhase.mesocycleType} — leg desgewenst uit waarom de belasting van vandaag past bij deze fase (bijv. "omdat je in een opbouwweek zit, hoort deze hogere belasting bij de opbouw" of "ondanks dat je je fit voelt, zit je in een herstelweek — daarom nu bewust rustiger")` : ''}\n`

        // v2.4.250 (Universal Athlete Platform — Stap 2, Coach Intelligence):
        // als de workout is aangepast door een ANDERE sport (kruis-sport-
        // signaal), geeft dit de Coach de context om dat proactief uit te
        // leggen — matcht exact het voorbeeld uit het overleg: "Je zware
        // roeitraining van gisteren heeft veel belasting gegeven. Daarom
        // heb ik de intensiteit vandaag iets verlaagd." Eigen try/catch —
        // mag de rest van het advies nooit blokkeren.
        if (todayPlan.sessieId && (todayPlan.source === 'cycling' || todayPlan.source === 'running' || todayPlan.source === 'rowing')) {
          try {
            const workoutRes = await fetch(`${req.nextUrl.origin}/api/specialists/${todayPlan.source}/training-plan/workout?sessieId=${todayPlan.sessieId}`, {
              headers: { cookie: cookieHeader },
            })
            const workoutData = await workoutRes.json()
            if (workoutData.workout?.kruisSportBron) {
              const SPORT_NAAM: Record<string, string> = { rowing: 'roeien', running: 'hardlopen', cycling: 'fietsen' }
              const bronSportNaam = SPORT_NAAM[workoutData.workout.kruisSportBron] || workoutData.workout.kruisSportBron
              todayEngineContext += `\nBELANGRIJK — deze training is AANGEPAST vanwege recente belasting door een ANDERE sport (${bronSportNaam}). Leg dit proactief uit aan de sporter, bijvoorbeeld: "Je recente ${bronSportNaam}-sessie heeft veel belasting gegeven, daarom is de training vandaag iets lichter." Concrete aanpassingen: ${(workoutData.workout.adaptations || []).join(' ')}\n`
            }
          } catch (workoutErr) {
            console.error('[coach] Kruis-sport-context ophalen mislukt, advies gaat door zonder dit blok:', workoutErr)
          }
        }
      }
    } catch (err) {
      console.error('[coach] Today Engine ophalen mislukt, advies gaat door zonder dit blok:', err)
    }

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

    // v2.4.148 (Niveau 2): Training Readiness + belastingsverhouding nu
    // ook input voor de Recovery Score
    const performanceVoorRecovery = await haalPerformanceVoorRecovery(user.id).catch(() => null)
    const recovery = calculateRecoveryScore(checkinRes.data || null, metricsVandaag || null, 0, performanceVoorRecovery)

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

    // ── Morning Health-trend + Performance Snapshot — v2.4.140 ──────────
    // Bron: overleg 20 juli 2026. Zelfde additief-context-patroon als
    // garminContext hierboven — CoachPolicy en buildDailyCoachPrompt
    // blijven ongewijzigd, dit is puur extra INPUT voor de AI, geen
    // nieuwe beslissingslogica. HRV-trend komt uit de Health Analysis
    // Engine (baseline-relatief, niet de absolute drempelwaarde die de
    // recovery-score elders gebruikt — zie health-analysis-engine.ts
    // voor de toelichting op dat bewuste onderscheid).
    let morningHealthContext = ''
    try {
      const [hrvTrend, performanceRes] = await Promise.all([
        haalHrvTrend(user.id),
        supabase.from('performance_snapshots').select('*').eq('user_id', user.id).eq('date', today).maybeSingle(),
      ])
      const perf = performanceRes.data

      const regels = [
        hrvTrend?.trend ? `HRV-trend t.o.v. eigen 7-daags gemiddelde: ${hrvTrend.trend} (${hrvTrend.verschil_pct! > 0 ? '+' : ''}${hrvTrend.verschil_pct}%)` : '',
        perf?.training_readiness !== null && perf?.training_readiness !== undefined ? `Training Readiness: ${perf.training_readiness}${perf.training_readiness_label ? ` (${perf.training_readiness_label})` : ''}` : '',
        perf?.training_status_label ? `Trainingsstatus: ${perf.training_status_label}` : '',
        perf?.load_ratio !== null && perf?.load_ratio !== undefined ? `Belastingsverhouding (acuut/chronisch): ${perf.load_ratio}` : '',
        perf?.vo2max !== null && perf?.vo2max !== undefined ? `VO2max: ${perf.vo2max}` : '',
      ].filter(Boolean)

      if (regels.length > 0) {
        morningHealthContext = `\n\nMorning Health & Performance:\n${regels.join('\n')}`
      }
    } catch (mhErr) {
      // Nooit het hele coach-advies laten falen op deze context — dit is
      // een aanvulling, geen kernfunctionaliteit
      console.error('[coach] Morning Health-context ophalen mislukt:', mhErr)
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
      // v2.4.52/53: advised_weight_kg + tempo/advised_tempo toegevoegd aan het record-type
      type ExRec = { exercise_name: string; module: string; weight_kg: number | null; advised_weight_kg: number | null; tempo: string | null; advised_tempo: string | null; reps: number | null; duration_sec: number | null; performed_at: string }
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
        // v2.4.52: laatst geadviseerde gewicht, voor advies-vs-gebruikt-vergelijking
        laatste_advies_gewicht: number | null
        // v2.4.53: zelfde voor tempo
        laatste_gebruikt_tempo: string | null
        laatste_advies_tempo: string | null
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
            laatste_advies_gewicht: r.advised_weight_kg,
            laatste_gebruikt_tempo: r.tempo,
            laatste_advies_tempo: r.advised_tempo,
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
          laatste_advies_gewicht: laatste.advised_weight_kg,
          laatste_gebruikt_tempo: laatste.tempo,
          laatste_advies_tempo: laatste.advised_tempo,
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
        let heeftAfwijking = false
        let heeftTempoAfwijking = false

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

          // v2.4.52: expliciete advies-vs-gebruikt-vermelding — alleen als
          // er daadwerkelijk een afwijking is (geen ruis bij elke exacte match)
          if (t.laatste_advies_gewicht !== null && t.laatste_gewicht !== null && t.laatste_advies_gewicht !== t.laatste_gewicht) {
            regel += ` [Trainer AI adviseerde ${t.laatste_advies_gewicht}kg, gebruiker deed ${t.laatste_gewicht}kg]`
            heeftAfwijking = true
          }
          // v2.4.53: zelfde principe voor tempo
          if (t.laatste_advies_tempo !== null && t.laatste_gebruikt_tempo !== null && t.laatste_advies_tempo !== t.laatste_gebruikt_tempo) {
            regel += ` [tempo-advies: ${t.laatste_advies_tempo}, gebruiker deed: ${t.laatste_gebruikt_tempo}]`
            heeftTempoAfwijking = true
          }

          regels.push(regel)
        }

        if (gemRpe !== null) regels.push(`Gemiddelde RPE laatste 7 dagen: ${gemRpe}/10`)
        if (belastingTrend !== null) {
          const trendLabel = belastingTrend > 0 ? `+${belastingTrend}%` : `${belastingTrend}%`
          regels.push(`Trainingsbelasting t.o.v. vorige week: ${trendLabel} (${dezeWeekMin} vs ${vorigeWeekMin} min)`)
        }

        regels.push('Gebruik deze trenddata in je advies. Benoem concrete progressie als die er is. Waarschuw bij stijgende belasting + hoge RPE. Stel progressie voor als trend stijgend is en RPE laag.')
        if (heeftAfwijking) {
          regels.push('Bij [Trainer AI adviseerde X, gebruiker deed Y]: dit betekent dat de gebruiker zelf een ander kettlebell-gewicht koos tijdens de training dan geadviseerd. Je mag dit kort en niet-veroordelend benoemen — bijvoorbeeld als het zwaarder was dan geadviseerd en de RPE ook hoog was, kun je vragen of dat goed voelde. Als het lichter was, kan dat een teken van een terechte eigen inschatting zijn. Overdrijf niet — één keer afwijken is normaal.')
        }
        if (heeftTempoAfwijking) {
          regels.push('Bij [tempo-advies: X, gebruiker deed: Y]: de gebruiker koos een ander uitvoeringstempo dan geadviseerd (slow/normal/fast). Dit mag je ook kort benoemen indien relevant — bijvoorbeeld als een langzamer tempo bij een explosieve oefening (zoals swings) juist bewust voor meer controle kan zijn, of als een sneller tempo bij een gecontroleerde oefening (zoals squats) op vermoeidheid of haast kan wijzen. Niet elke afwijking is een probleem — alleen benoemen als het echt relevant is.')
        }
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
    ) + garminContext + morningHealthContext + todayEngineContext + trainingsCoachContext + (progressieContext ? progressieContext : '') + (weerContext || '') + (journalContext ? '\n' + journalContext : '') + (loadContext ? '\n' + loadContext : '') + (lifeEventsContext ? '\n' + lifeEventsContext : '') + (blessureContext ? '\n' + blessureContext : '') + (coachCallContext ? coachCallContext : '') + (specialistContext || '') + trainerInstructiePrompt

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

    fetch('https://coach-os-tau.vercel.app/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    }).catch(() => {})

    return NextResponse.json(saved)
  } catch (error) {
    console.error('Coach API error:', error)
    return NextResponse.json({ error: 'Coach generatie mislukt' }, { status: 500 })
  }
}
