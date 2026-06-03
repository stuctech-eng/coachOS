export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
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

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const { messages } = await req.json()
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Geen berichten' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const today = new Date().toISOString().split('T')[0]

    const zeven = new Date()
    zeven.setDate(zeven.getDate() - 7)
    const zevenDagenGeleden = zeven.toISOString().split('T')[0]

    const dertig = new Date()
    dertig.setDate(dertig.getDate() - 30)
    const dertigDagenGeleden = dertig.toISOString().split('T')[0]

    // Haal alle context op
    const [
      profileRes,
      goalsRes,
      checkinRes,
      statusRes,
      metricsRes,
      metrics7Res,
      activiteitenRes,
      memoryRes,
      blessuresRes,
      lifeEventsRes,
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('user_goals').select('*').eq('user_id', user.id).eq('status', 'active'),
      supabase.from('daily_checkins').select('*').eq('user_id', user.id).eq('date', today).single(),
      supabase.from('daily_status').select('*').eq('user_id', user.id).eq('date', today).single(),
      supabase.from('health_metrics').select('*').eq('user_id', user.id).eq('date', today).single(),
      supabase.from('health_metrics')
        .select('date, hrv, resting_hr, sleep_duration, steps, calories_burned')
        .eq('user_id', user.id)
        .gte('date', zevenDagenGeleden)
        .order('date', { ascending: true }),
      supabase.from('activity_sessions')
        .select('date, duration, metrics, activities(name)')
        .eq('user_id', user.id)
        .gte('date', dertigDagenGeleden)
        .order('date', { ascending: false })
        .limit(10),
      supabase.from('coach_memory')
        .select('memory_type, content, confidence')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(8),
      supabase.from('injuries')
        .select('body_part, pain_score, notes, active')
        .eq('user_id', user.id)
        .eq('active', true),
      supabase.from('life_events')
        .select('type, start_time, recovery_impact, stress_load, sleep_disruption, notes')
        .eq('user_id', user.id)
        .gte('start_time', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
        .order('start_time', { ascending: false }),
    ])

    const profile = profileRes.data
    const goals = goalsRes.data || []
    const checkin = checkinRes.data
    const status = statusRes.data
    const metrics = metricsRes.data
    const metrics7 = metrics7Res.data || []
    const activiteiten = activiteitenRes.data || []
    const memory = memoryRes.data || []
    const blessures = blessuresRes.data || []
    const lifeEvents = lifeEventsRes.data || []

    const naam = profile?.display_name || profile?.first_name || 'de atleet'

    // Bouw coach context
    const context = [
      `Je bent CoachOS, de persoonlijke AI coach van ${naam}. Je bent geen app en geen dashboard — je bent een ervaren coach die deze atleet door en door kent.`,
      ``,
      `PERSOONLIJKHEID EN TOON:`,
      `- Spreek als een betrokken, ervaren coach — niet als een systeem dat data rapporteert`,
      `- Gebruik "je" en "ik" — persoonlijk en direct`,
      `- Interpreteer altijd: wat betekent deze data voor DEZE atleet op DIT moment?`,
      `- Geef nooit ruwe getallen zonder duiding. Niet "HRV 52" maar "je HRV is lager dan je gemiddelde, wat wijst op onvoldoende herstel"`,
      `- Wees eerlijk maar motiverend. Een goede coach liegt niet maar geeft ook niet op`,
      `- Als iets goed gaat: benoem het specifiek en leg uit waarom`,
      `- Als iets zorgelijk is: benoem het direct maar geef altijd een concrete actie mee`,
      `- Varieer in toon: soms zakelijk, soms aanmoedigend, soms corrigerend — afhankelijk van de situatie`,
      ``,
      `COACHING STIJL:`,
      `- Korte vragen → kort antwoord (2-3 zinnen), maar altijd met een conclusie of advies`,
      `- Complexe vragen → uitgebreider, maar nooit meer dan nodig`,
      `- Eindig antwoorden altijd met een concrete actie of beslissing`,
      `- Vergelijk altijd met eerdere data als die beschikbaar is`,
      `- Denk vooruit: wat betekent dit voor morgen, deze week?`,
      ``,
      `TAAL:`,
      `- Altijd Nederlands`,
      `- Geen jargon tenzij de gebruiker dat zelf gebruikt`,
      `- Geen opsommingen tenzij nodig — schrijf in natuurlijke zinnen`,
      ``,
      `PROFIEL:`,
      `Naam: ${naam}, Leeftijd: ${profile?.age || 'onbekend'}, Gewicht: ${profile?.weight || 'onbekend'}kg`,
      `Niveau: ${profile?.experience_level || 'onbekend'}, Tijd: ${profile?.available_time || 'onbekend'}`,
      profile?.injury_history ? `Aandachtspunt: ${profile.injury_history}` : '',
      ``,
      `DOELEN:`,
      goals.length > 0 ? goals.map(g => `- ${g.title}`).join('\n') : '- Geen doelen',
      ``,
    ]

    // Coach Score
    if (status) {
      context.push(`COACH SCORE VANDAAG:`)
      if (status.coach_score) context.push(`Coach Score: ${status.coach_score}/100`)
      if (status.recovery_score) context.push(`Herstel: ${status.recovery_score}/100`)
      if (status.training_score) context.push(`Training: ${status.training_score}/100`)
      if (status.lifestyle_score) context.push(`Leefstijl: ${status.lifestyle_score}/100`)
      if (status.risk_flags && status.risk_flags.length > 0) {
        context.push(`Risico's: ${status.risk_flags.join(', ')}`)
      }
      context.push(``)
    }

    // Check-in
    if (checkin) {
      context.push(`CHECK-IN VANDAAG:`)
      context.push(`Gevoel: ${checkin.feeling_score}/10, Energie: ${checkin.energy_score}/10`)
      if (checkin.has_pain) context.push(`Pijn: ja${checkin.pain_description ? ' — ' + checkin.pain_description : ''}`)
      if (checkin.notes) context.push(`Notitie: ${checkin.notes}`)
      context.push(``)
    }

    // Health vandaag
    if (metrics) {
      const vandaag: string[] = []
      if (metrics.hrv) vandaag.push(`HRV: ${metrics.hrv}ms`)
      if (metrics.resting_hr) vandaag.push(`Rusthartslag: ${metrics.resting_hr}bpm`)
      if (metrics.sleep_duration) vandaag.push(`Slaap: ${metrics.sleep_duration}u`)
      if (metrics.steps) vandaag.push(`Stappen: ${metrics.steps}`)
      if (vandaag.length > 0) {
        context.push(`GEZONDHEID VANDAAG: ${vandaag.join(', ')}`)
        context.push(``)
      }
    }

    // 7-daagse trend
    if (metrics7.length >= 3) {
      const hrvWaarden = metrics7.filter(m => m.hrv).map(m => m.hrv as number)
      const slaapWaarden = metrics7.filter(m => m.sleep_duration).map(m => m.sleep_duration as number)

      const trend = (w: number[]) => {
        if (w.length < 2) return 'stabiel'
        const gem1 = w.slice(0, Math.ceil(w.length/2)).reduce((a,b) => a+b,0) / Math.ceil(w.length/2)
        const gem2 = w.slice(Math.floor(w.length/2)).reduce((a,b) => a+b,0) / w.slice(Math.floor(w.length/2)).length
        const d = ((gem2-gem1)/gem1)*100
        return d > 8 ? 'stijgend' : d < -8 ? 'dalend' : 'stabiel'
      }

      context.push(`WEEK TREND:`)
      if (hrvWaarden.length >= 3) context.push(`HRV: ${trend(hrvWaarden)} (gem. ${Math.round(hrvWaarden.reduce((a,b)=>a+b,0)/hrvWaarden.length)}ms)`)
      if (slaapWaarden.length >= 3) context.push(`Slaap: ${trend(slaapWaarden)} (gem. ${Math.round(slaapWaarden.reduce((a,b)=>a+b,0)/slaapWaarden.length*10)/10}u)`)
      context.push(``)
    }

    // Recente activiteiten
    if (activiteiten.length > 0) {
      context.push(`RECENTE ACTIVITEITEN:`)
      activiteiten.slice(0, 5).forEach(a => {
        const act = a.activities as { name: string } | { name: string }[] | null
        const naam_act = Array.isArray(act) ? act[0]?.name : act?.name || 'Activiteit'
        const dist = (a.metrics as { distance?: number })?.distance
        context.push(`- ${a.date}: ${naam_act} ${a.duration}min${dist ? ` ${(dist/1000).toFixed(1)}km` : ''}`)
      })
      context.push(``)
    }

    // Blessures
    if (blessures.length > 0) {
      context.push(`ACTIEVE BLESSURES:`)
      blessures.forEach(b => {
        context.push(`- ${b.body_part}${b.pain_score ? ` (pijn: ${b.pain_score}/10)` : ''}${b.notes ? ': ' + b.notes : ''}`)
      })
      context.push(``)
    }

    // Life events
    if (lifeEvents.length > 0) {
      const EVENT_LABELS: Record<string, string> = {
        nachtdienst: 'Nachtdienst',
        vroege_dienst: 'Vroege dienst',
        reizen: 'Reizen',
        werk_stress: 'Werkstress',
        feest: 'Feest/late avond',
        ziek: 'Ziek',
        emotionele_stress: 'Emotionele stress',
        vakantie: 'Vakantie',
      }
      context.push(`LEVENSGEBEURTENISSEN (laatste 3 dagen):`)
      lifeEvents.forEach((e: { type: string; start_time: string; recovery_impact: number; stress_load: number; sleep_disruption: number; notes: string | null }) => {
        const label = EVENT_LABELS[e.type] || e.type
        const datum = new Date(e.start_time).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
        context.push(`- ${datum}: ${label}${e.notes ? ' — ' + e.notes : ''} (herstelimpact: ${e.recovery_impact}/3, stress: ${e.stress_load}/3)`)
      })
      context.push(``)
    }

    // Coach memory
    if (memory.length > 0) {
      context.push(`COACH GEHEUGEN (wat ik over jou weet):`)
      memory.forEach(m => context.push(`- ${m.content}`))
      context.push(``)
    }

    const systemPrompt = context.filter(Boolean).join('\n')

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://coach-os-tau.vercel.app'
    const aiResponse = await fetch(appUrl + '/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: systemPrompt,
        messages,
      }),
    })

    const aiData = await aiResponse.json()
    const tekst = aiData.content?.[0]?.text || 'Geen antwoord ontvangen.'

    // Sla gesprek op
    await supabase.from('ai_conversations').insert([
      { user_id: user.id, role: 'user', message: messages[messages.length - 1]?.content || '' },
      { user_id: user.id, role: 'assistant', message: tekst },
    ])

    return NextResponse.json({ message: tekst })

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({ error: 'Chat mislukt' }, { status: 500 })
  }
}
