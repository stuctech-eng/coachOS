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
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()

    // Huidige week: maandag t/m zondag
    const now = new Date()
    const dag = now.getDay()
    const maandag = new Date(now)
    maandag.setDate(now.getDate() - (dag === 0 ? 6 : dag - 1))
    maandag.setHours(0, 0, 0, 0)
    const zondag = new Date(maandag)
    zondag.setDate(maandag.getDate() + 6)

    const vanDatum = maandag.toISOString().split('T')[0]
    const totDatum = zondag.toISOString().split('T')[0]

    const [checkinsRes, metricsRes, activiteitenRes] = await Promise.all([
      supabase.from('daily_checkins')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', vanDatum)
        .lte('date', totDatum)
        .order('date', { ascending: true }),
      supabase.from('health_metrics')
        .select('date, resting_hr, hrv, steps, sleep_duration, calories_burned')
        .eq('user_id', user.id)
        .gte('date', vanDatum)
        .lte('date', totDatum)
        .order('date', { ascending: true }),
      supabase.from('activity_sessions')
        .select('date, duration, metrics, activities(name)')
        .eq('user_id', user.id)
        .gte('date', vanDatum)
        .lte('date', totDatum)
        .order('date', { ascending: true }),
    ])

    const checkins = checkinsRes.data || []
    const metrics = metricsRes.data || []
    const activiteiten = activiteitenRes.data || []

    // Bereken statistieken
    const gemGevoel = checkins.length
      ? Math.round(checkins.reduce((a, c) => a + (c.feeling_score || 0), 0) / checkins.length * 10) / 10
      : null
    const gemEnergie = checkins.length
      ? Math.round(checkins.reduce((a, c) => a + (c.energy_score || 0), 0) / checkins.length * 10) / 10
      : null
    const gemHrv = metrics.filter(m => m.hrv).length
      ? Math.round(metrics.filter(m => m.hrv).reduce((a, m) => a + (m.hrv || 0), 0) / metrics.filter(m => m.hrv).length)
      : null
    const totaalStappen = metrics.reduce((a, m) => a + (m.steps || 0), 0)
    const totaalMinuten = activiteiten.reduce((a, s) => a + (s.duration || 0), 0)
    const totaalKm = activiteiten.reduce((a, s) => {
      const dist = (s.metrics as { distance?: number })?.distance || 0
      return a + dist
    }, 0) / 1000

    return NextResponse.json({
      week: { van: vanDatum, tot: totDatum },
      stats: {
        checkins: checkins.length,
        gem_gevoel: gemGevoel,
        gem_energie: gemEnergie,
        gem_hrv: gemHrv,
        totaal_stappen: totaalStappen,
        totaal_minuten: totaalMinuten,
        totaal_km: Math.round(totaalKm * 10) / 10,
        activiteiten: activiteiten.length,
      },
      checkins,
      metrics,
      activiteiten,
    })
  } catch (error) {
    console.error('Weekly GET error:', error)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}

export async function POST() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()

    // Haal week data op
    const now = new Date()
    const dag = now.getDay()
    const maandag = new Date(now)
    maandag.setDate(now.getDate() - (dag === 0 ? 6 : dag - 1))
    const vanDatum = maandag.toISOString().split('T')[0]
    const zondag = new Date(maandag)
    zondag.setDate(maandag.getDate() + 6)
    const totDatum = zondag.toISOString().split('T')[0]

    const [profileRes, checkinsRes, metricsRes, activiteitenRes] = await Promise.all([
      supabase.from('profiles').select('first_name, display_name, experience_level, injury_history').eq('user_id', user.id).single(),
      supabase.from('daily_checkins').select('*').eq('user_id', user.id).gte('date', vanDatum).lte('date', totDatum).order('date'),
      supabase.from('health_metrics').select('*').eq('user_id', user.id).gte('date', vanDatum).lte('date', totDatum).order('date'),
      supabase.from('activity_sessions').select('date, duration, metrics, activities(name)').eq('user_id', user.id).gte('date', vanDatum).lte('date', totDatum),
    ])

    const checkins = checkinsRes.data || []
    const metrics = metricsRes.data || []
    const activiteiten = activiteitenRes.data || []
    const profile = profileRes.data
    const naam = profile?.display_name || profile?.first_name || 'de gebruiker'

    if (checkins.length === 0 && metrics.length === 0 && activiteiten.length === 0) {
      return NextResponse.json({ error: 'Geen data deze week' }, { status: 400 })
    }

    // Bouw prompt
    const checkinTekst = checkins.map(c =>
      c.date + ': gevoel ' + c.feeling_score + '/10, energie ' + c.energy_score + '/10' +
      (c.has_pain ? ', pijn' : '') + (c.notes ? ' — ' + c.notes : '')
    ).join('\n') || 'Geen check-ins'

    const metricsTekst = metrics.map(m =>
      m.date + ': ' + [
        m.hrv ? 'HRV ' + m.hrv + 'ms' : '',
        m.resting_hr ? 'hartslag ' + m.resting_hr + 'bpm' : '',
        m.sleep_duration ? 'slaap ' + m.sleep_duration + 'u' : '',
        m.steps ? m.steps + ' stappen' : '',
      ].filter(Boolean).join(', ')
    ).join('\n') || 'Geen health data'

    const activiteitenTekst = activiteiten.map(a => {
      const naam_act = (a.activities as { name: string } | { name: string }[] | null)
      const actNaam = Array.isArray(naam_act) ? naam_act[0]?.name : naam_act?.name || 'Activiteit'
      return a.date + ': ' + actNaam + ' ' + a.duration + ' min'
    }).join('\n') || 'Geen activiteiten'

    const prompt = 'Je bent CoachOS, persoonlijke AI coach voor ' + naam + '.\n\n' +
      'Geef een weekoverzicht voor de week van ' + vanDatum + ' tot ' + totDatum + '.\n\n' +
      'CHECK-INS:\n' + checkinTekst + '\n\n' +
      'GEZONDHEIDSDATA:\n' + metricsTekst + '\n\n' +
      'ACTIVITEITEN:\n' + activiteitenTekst + '\n\n' +
      (profile?.injury_history ? 'AANDACHTSPUNT: ' + profile.injury_history + '\n\n' : '') +
      'Reageer ALLEEN in dit JSON formaat:\n' +
      '{\n' +
      '  "samenvatting": "2-3 zinnen over hoe de week was",\n' +
      '  "positief": "Wat ging goed deze week",\n' +
      '  "aandacht": "Wat verdient aandacht",\n' +
      '  "tip": "Concrete tip voor volgende week"\n' +
      '}'

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://coach-os-tau.vercel.app'
    const aiResponse = await fetch(appUrl + '/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        system: prompt,
        messages: [{ role: 'user', content: 'Geef mijn weekoverzicht.' }],
      }),
    })

    const aiData = await aiResponse.json()
    const rawText = aiData.content?.[0]?.text || ''

    let analyse = { samenvatting: '', positief: '', aandacht: '', tip: '' }
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (jsonMatch) analyse = JSON.parse(jsonMatch[0])
    } catch {
      analyse.samenvatting = rawText
    }

    return NextResponse.json({ analyse, week: { van: vanDatum, tot: totDatum } })
  } catch (error) {
    console.error('Weekly POST error:', error)
    return NextResponse.json({ error: 'Analyse mislukt' }, { status: 500 })
  }
}
