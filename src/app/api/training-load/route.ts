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

// ─── Load Factoren per activiteit ────────────────────────────────────────────

interface LoadFactors {
  cardio: number
  strength: number
  recovery: number
}

const ACTIVITY_LOAD: Record<string, LoadFactors> = {
  // Cardio dominante activiteiten
  hardlopen:    { cardio: 0.50, strength: 0.05, recovery: 0.05 },
  running:      { cardio: 0.50, strength: 0.05, recovery: 0.05 },
  fietsen:      { cardio: 0.35, strength: 0.05, recovery: 0.05 },
  cycling:      { cardio: 0.35, strength: 0.05, recovery: 0.05 },
  roeien:       { cardio: 0.40, strength: 0.20, recovery: 0.05 },
  rowing:       { cardio: 0.40, strength: 0.20, recovery: 0.05 },
  zwemmen:      { cardio: 0.40, strength: 0.15, recovery: 0.05 },
  swimming:     { cardio: 0.40, strength: 0.15, recovery: 0.05 },

  // Kracht dominante activiteiten
  kettlebell:   { cardio: 0.20, strength: 0.40, recovery: 0.05 },
  krachttraining: { cardio: 0.10, strength: 0.50, recovery: 0.05 },
  strength:     { cardio: 0.10, strength: 0.50, recovery: 0.05 },
  weightlifting: { cardio: 0.10, strength: 0.50, recovery: 0.05 },

  // Herstel dominante activiteiten
  wandeling:    { cardio: 0.10, strength: 0.00, recovery: 0.20 },
  walking:      { cardio: 0.10, strength: 0.00, recovery: 0.20 },
  yoga:         { cardio: 0.05, strength: 0.10, recovery: 0.30 },
  mobiliteit:   { cardio: 0.05, strength: 0.10, recovery: 0.30 },
  stretching:   { cardio: 0.05, strength: 0.05, recovery: 0.35 },
  ademhaling:   { cardio: 0.00, strength: 0.00, recovery: 0.50 },

  // Mixed
  crossfit:     { cardio: 0.35, strength: 0.35, recovery: 0.05 },
  hiit:         { cardio: 0.40, strength: 0.30, recovery: 0.05 },
  default:      { cardio: 0.25, strength: 0.15, recovery: 0.10 },
}

function getLoadFactors(activityName: string): LoadFactors {
  const lower = activityName.toLowerCase()
  for (const [key, factors] of Object.entries(ACTIVITY_LOAD)) {
    if (lower.includes(key)) return factors
  }
  return ACTIVITY_LOAD.default
}

// ─── HR Modifier ──────────────────────────────────────────────────────────────

function hrModifier(avgHr: number | null): number {
  if (!avgHr) return 1.0
  if (avgHr < 110) return 0.8
  if (avgHr < 130) return 1.0
  if (avgHr < 150) return 1.2
  return 1.4
}

// ─── Load voor één sessie ─────────────────────────────────────────────────────

interface SessionLoad {
  cardio_load: number
  strength_load: number
  recovery_load: number
  total_load: number
  intensity: 'laag' | 'gemiddeld' | 'hoog' | 'zeer_hoog'
}

function berekenSessieLoad(
  duurMinuten: number,
  activityName: string,
  avgHr: number | null
): SessionLoad {
  const factors = getLoadFactors(activityName)
  const modifier = hrModifier(avgHr)

  const cardio = Math.round(duurMinuten * factors.cardio * modifier * 10) / 10
  const strength = Math.round(duurMinuten * factors.strength * modifier * 10) / 10
  const recovery = Math.round(duurMinuten * factors.recovery * 10) / 10 // HR modifier niet op recovery
  const total = Math.round((cardio + strength + recovery) * 10) / 10

  const intensity: SessionLoad['intensity'] =
    total < 10 ? 'laag' :
    total < 20 ? 'gemiddeld' :
    total < 30 ? 'hoog' : 'zeer_hoog'

  return { cardio_load: cardio, strength_load: strength, recovery_load: recovery, total_load: total, intensity }
}

// ─── Exporteerbaar type ───────────────────────────────────────────────────────

export interface TrainingLoadResult {
  // 7-daagse totalen
  cardio_load_7d: number
  strength_load_7d: number
  recovery_load_7d: number
  total_load_7d: number

  // Vandaag
  today_load: number
  today_intensity: string

  // Trend
  load_trend: 'stijgend' | 'stabiel' | 'dalend' | 'onvoldoende_data'
  load_trend_pct: number | null

  // Laatste zware sessie
  last_heavy_session_days: number | null

  // Gemiddeld per week
  avg_load_per_week: number

  // Samenvatting voor Coach AI
  samenvatting: string

  gegenereerd_op: string
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()
    const vandaag = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })

    // Check cache
    const { data: cached } = await supabase
      .from('coach_recommendations')
      .select('recommendation, created_at')
      .eq('user_id', user.id)
      .eq('type', 'training_load')
      .eq('date', vandaag)
      .single()

    if (cached?.recommendation) {
      return NextResponse.json(JSON.parse(cached.recommendation))
    }

    // Haal 14 dagen activiteiten op (7d huidig + 7d vorig voor trend)
    const veertienDagenGeleden = new Date()
    veertienDagenGeleden.setDate(veertienDagenGeleden.getDate() - 14)

    const [activiteitenRes, kettlebellRes, recoveryRes] = await Promise.all([
      // Strava activiteiten
      supabase
        .from('activity_sessions')
        .select('date, duration, metrics, activities(name)')
        .eq('user_id', user.id)
        .gte('date', veertienDagenGeleden.toLocaleDateString('en-CA'))
        .order('date', { ascending: true }),
      // Kettlebell sessies
      supabase
        .from('training_results')
        .select('completed_at, actual_duration, rating')
        .eq('user_id', user.id)
        .eq('completed', true)
        .gte('completed_at', veertienDagenGeleden.toISOString())
        .order('completed_at', { ascending: true }),
      // Recovery sessies
      supabase
        .from('recovery_results')
        .select('completed_at, duration, type, module')
        .eq('user_id', user.id)
        .gte('completed_at', veertienDagenGeleden.toISOString())
        .order('completed_at', { ascending: true }),
    ])

    const activiteiten = activiteitenRes.data || []
    const kettlebell = kettlebellRes.data || []
    const recovery = recoveryRes.data || []

    // Bereken load per dag
    const dagLoads: Record<string, number> = {}

    // Strava activiteiten
    for (const act of activiteiten) {
      const datum = act.date
      const naam = (act.activities as { name: string } | null)?.name || 'default'
      const duur = act.duration || 0
      const hr = act.metrics?.avg_hr || null
      const load = berekenSessieLoad(duur, naam, hr)
      dagLoads[datum] = (dagLoads[datum] || 0) + load.total_load
    }

    // Kettlebell
    for (const kb of kettlebell) {
      const datum = new Date(kb.completed_at).toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
      const duur = kb.actual_duration || 30
      const load = berekenSessieLoad(duur, 'kettlebell', null)
      dagLoads[datum] = (dagLoads[datum] || 0) + load.total_load
    }

    // Recovery
    for (const rec of recovery) {
      const datum = new Date(rec.completed_at).toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
      const duur = rec.duration || 10
      const type = rec.module || rec.type || 'herstel'
      const load = berekenSessieLoad(duur, type, null)
      dagLoads[datum] = (dagLoads[datum] || 0) + load.total_load
    }

    // 7-daagse totalen (huidig)
    const zeven = new Date()
    zeven.setDate(zeven.getDate() - 7)
    const zevenDatums = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - i)
      return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
    })
    const vorigZevenDatums = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - 7 - i)
      return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
    })

    const load7d = zevenDatums.reduce((sum, d) => sum + (dagLoads[d] || 0), 0)
    const loadVorig7d = vorigZevenDatums.reduce((sum, d) => sum + (dagLoads[d] || 0), 0)
    const todayLoad = dagLoads[vandaag] || 0

    // Gedetailleerde 7d loads
    let cardio7d = 0, strength7d = 0, recovery7d = 0
    for (const act of activiteiten.filter(a => zevenDatums.includes(a.date))) {
      const naam = (act.activities as { name: string } | null)?.name || 'default'
      const sl = berekenSessieLoad(act.duration || 0, naam, act.metrics?.avg_hr || null)
      cardio7d += sl.cardio_load; strength7d += sl.strength_load; recovery7d += sl.recovery_load
    }
    for (const kb of kettlebell.filter(k => zevenDatums.includes(new Date(k.completed_at).toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })))) {
      const sl = berekenSessieLoad(kb.actual_duration || 30, 'kettlebell', null)
      cardio7d += sl.cardio_load; strength7d += sl.strength_load; recovery7d += sl.recovery_load
    }

    // Trend
    let trend: TrainingLoadResult['load_trend'] = 'onvoldoende_data'
    let trendPct: number | null = null
    if (loadVorig7d > 0) {
      trendPct = Math.round(((load7d - loadVorig7d) / loadVorig7d) * 100)
      trend = trendPct > 10 ? 'stijgend' : trendPct < -10 ? 'dalend' : 'stabiel'
    } else if (load7d > 0) {
      trend = 'stijgend'
    }

    // Laatste zware sessie
    let lastHeavyDays: number | null = null
    const sortedDagen = Object.entries(dagLoads)
      .filter(([d]) => d <= vandaag)
      .sort(([a], [b]) => b.localeCompare(a))
    for (const [dag, load] of sortedDagen) {
      if (load >= 20 && dag !== vandaag) {
        const diff = Math.floor((new Date(vandaag).getTime() - new Date(dag).getTime()) / (1000 * 60 * 60 * 24))
        lastHeavyDays = diff
        break
      }
    }

    // Samenvatting
    const todayIntensity = todayLoad < 10 ? 'laag' : todayLoad < 20 ? 'gemiddeld' : todayLoad < 30 ? 'hoog' : 'zeer hoog'
    const parts: string[] = []
    parts.push(`Trainingsbelasting 7 dagen: cardio ${Math.round(cardio7d)}, kracht ${Math.round(strength7d)}, herstel ${Math.round(recovery7d)}, totaal ${Math.round(load7d)}.`)
    if (trend !== 'onvoldoende_data') parts.push(`Trend: ${trend}${trendPct !== null ? ` (${trendPct > 0 ? '+' : ''}${trendPct}%)` : ''}.`)
    if (todayLoad > 0) parts.push(`Vandaag: ${todayIntensity} (load ${Math.round(todayLoad)}).`)
    if (lastHeavyDays !== null) parts.push(`Laatste zware sessie: ${lastHeavyDays} dag${lastHeavyDays === 1 ? '' : 'en'} geleden.`)

    const result: TrainingLoadResult = {
      cardio_load_7d: Math.round(cardio7d * 10) / 10,
      strength_load_7d: Math.round(strength7d * 10) / 10,
      recovery_load_7d: Math.round(recovery7d * 10) / 10,
      total_load_7d: Math.round(load7d * 10) / 10,
      today_load: Math.round(todayLoad * 10) / 10,
      today_intensity: todayIntensity,
      load_trend: trend,
      load_trend_pct: trendPct,
      last_heavy_session_days: lastHeavyDays,
      avg_load_per_week: Math.round(load7d * 10) / 10,
      samenvatting: parts.join(' '),
      gegenereerd_op: new Date().toISOString(),
    }

    // Cache opslaan
    await supabase.from('coach_recommendations').upsert({
      user_id: user.id,
      type: 'training_load',
      date: vandaag,
      recommendation: JSON.stringify(result),
      created_at: new Date().toISOString(),
    }, { onConflict: 'user_id,type,date' })

    return NextResponse.json(result)

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[training-load]', msg)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
