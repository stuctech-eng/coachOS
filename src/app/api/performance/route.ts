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

// ─── Types ────────────────────────────────────────────────────────────────────

interface PerformanceAnalysis {
  progressie_trend: 'stijgend' | 'stabiel' | 'dalend' | 'onvoldoende_data'
  consistentie: 'hoog' | 'gemiddeld' | 'laag' | 'onvoldoende_data'
  herstel_na_training: 'goed' | 'matig' | 'slecht' | 'onvoldoende_data'
  niveau_gereed: boolean
  gem_rating: number | null
  gem_rating_trend: number | null
  trainingen_per_week: number | null
  samenvatting: string
  gegenereerd_op: string
}

// ─── Bereken analyses ─────────────────────────────────────────────────────────

function berekenProgressieTrend(ratings: number[]): PerformanceAnalysis['progressie_trend'] {
  if (ratings.length < 3) return 'onvoldoende_data'
  const eerste_helft = ratings.slice(0, Math.floor(ratings.length / 2))
  const tweede_helft = ratings.slice(Math.floor(ratings.length / 2))
  const gem1 = eerste_helft.reduce((a, b) => a + b, 0) / eerste_helft.length
  const gem2 = tweede_helft.reduce((a, b) => a + b, 0) / tweede_helft.length
  const verschil = gem2 - gem1
  if (verschil > 0.5) return 'stijgend'
  if (verschil < -0.5) return 'dalend'
  return 'stabiel'
}

function berekenConsistentie(trainingen: number, weken: number): PerformanceAnalysis['consistentie'] {
  if (weken < 1) return 'onvoldoende_data'
  const perWeek = trainingen / weken
  if (perWeek >= 3) return 'hoog'
  if (perWeek >= 1.5) return 'gemiddeld'
  return 'laag'
}

function berekenHerstel(
  garminData: Array<{ date: string; parsed_data: { body_battery?: { current?: number } } }>,
  trainingDatums: string[]
): PerformanceAnalysis['herstel_na_training'] {
  if (garminData.length < 3 || trainingDatums.length < 2) return 'onvoldoende_data'

  const garminMap = new Map(garminData.map(g => [g.date, g.parsed_data?.body_battery?.current]))

  let bbVerschillen: number[] = []
  for (const datum of trainingDatums) {
    const dagNa = new Date(datum)
    dagNa.setDate(dagNa.getDate() + 1)
    const dagNaStr = dagNa.toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
    const bbVoor = garminMap.get(datum)
    const bbNa = garminMap.get(dagNaStr)
    if (bbVoor && bbNa) {
      bbVerschillen.push(bbNa - bbVoor)
    }
  }

  if (bbVerschillen.length < 2) return 'onvoldoende_data'
  const gemVerschil = bbVerschillen.reduce((a, b) => a + b, 0) / bbVerschillen.length

  if (gemVerschil >= 10) return 'goed'
  if (gemVerschil >= 0) return 'matig'
  return 'slecht'
}

function bepaalNiveauGereed(ratings: number[], bodyBattery: number | null): boolean {
  if (ratings.length < 3) return false
  const gem = ratings.reduce((a, b) => a + b, 0) / ratings.length
  const bb = bodyBattery ?? 0
  return gem >= 8 && bb >= 70
}

function genereerSamenvatting(analyse: Omit<PerformanceAnalysis, 'samenvatting' | 'gegenereerd_op'>): string {
  const delen: string[] = []

  if (analyse.progressie_trend === 'stijgend') {
    delen.push(`Ratings stijgen (gem. ${analyse.gem_rating}/10) — goede progressie.`)
  } else if (analyse.progressie_trend === 'dalend') {
    delen.push(`Ratings dalen (gem. ${analyse.gem_rating}/10) — training mogelijk te zwaar.`)
  } else if (analyse.progressie_trend === 'stabiel') {
    delen.push(`Ratings stabiel op ${analyse.gem_rating}/10.`)
  }

  if (analyse.consistentie === 'hoog') {
    delen.push(`Traint consistent (${analyse.trainingen_per_week?.toFixed(1)}x/week).`)
  } else if (analyse.consistentie === 'laag') {
    delen.push(`Inconsistent trainen (${analyse.trainingen_per_week?.toFixed(1)}x/week) — regelmaat verbetert resultaten.`)
  }

  if (analyse.herstel_na_training === 'goed') {
    delen.push('Herstelt goed na training.')
  } else if (analyse.herstel_na_training === 'slecht') {
    delen.push('Herstel na training matig — meer rust of lagere intensiteit overwegen.')
  }

  if (analyse.niveau_gereed) {
    delen.push('Klaar voor zwaarder niveau.')
  }

  if (delen.length === 0) return 'Onvoldoende trainingsdata voor analyse.'
  return delen.join(' ')
}

// ─── GET — haal performance analyse op ───────────────────────────────────────

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()
    const vandaag = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
    const dertigDagenGeleden = new Date()
    dertigDagenGeleden.setDate(dertigDagenGeleden.getDate() - 30)

    // Check cache in coach_recommendations
    const { data: cached } = await supabase
      .from('coach_recommendations')
      .select('recommendation, created_at')
      .eq('user_id', user.id)
      .eq('type', 'performance_ai')
      .eq('date', vandaag)
      .single()

    if (cached?.recommendation) {
      return NextResponse.json(JSON.parse(cached.recommendation))
    }

    // Haal data op
    const [trainingsRes, garminRes, profileRes] = await Promise.all([
      supabase
        .from('training_results')
        .select('rating, actual_duration, completed_at')
        .eq('user_id', user.id)
        .eq('completed', true)
        .gte('completed_at', dertigDagenGeleden.toISOString())
        .order('completed_at', { ascending: true }),
      supabase
        .from('garmin_imports')
        .select('parsed_data, date')
        .eq('user_id', user.id)
        .eq('status', 'confirmed')
        .gte('date', dertigDagenGeleden.toLocaleDateString('en-CA'))
        .order('date', { ascending: true }),
      supabase
        .from('profiles')
        .select('experience_level')
        .eq('user_id', user.id)
        .single(),
    ])

    const trainingen = trainingsRes.data || []
    const garminData = garminRes.data || []
    const experienceLevel = profileRes.data?.experience_level || 'beginner'

    // Bereken analyses
    const ratings = trainingen.filter(t => t.rating !== null).map(t => t.rating as number)
    const gemRating = ratings.length > 0
      ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length * 10) / 10
      : null

    // Rating trend (verschil gem laatste 3 vs vorige 3)
    let gemRatingTrend: number | null = null
    if (ratings.length >= 6) {
      const laatste3 = ratings.slice(-3)
      const vorige3 = ratings.slice(-6, -3)
      const gemLaatste = laatste3.reduce((a, b) => a + b, 0) / 3
      const gemVorige = vorige3.reduce((a, b) => a + b, 0) / 3
      gemRatingTrend = Math.round((gemLaatste - gemVorige) * 10) / 10
    }

    // Trainingen per week
    const aantalWeken = 4
    const trainingenPerWeek = trainingen.length > 0
      ? Math.round(trainingen.length / aantalWeken * 10) / 10
      : null

    // Training datums voor herstelanalyse
    const trainingDatums = trainingen.map(t =>
      new Date(t.completed_at).toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
    )

    // Laatste Body Battery
    const latestGarmin = garminData[garminData.length - 1]
    const huidigeBodyBattery = latestGarmin?.parsed_data?.body_battery?.current ?? null

    const analyse: Omit<PerformanceAnalysis, 'samenvatting' | 'gegenereerd_op'> = {
      progressie_trend: berekenProgressieTrend(ratings),
      consistentie: berekenConsistentie(trainingen.length, aantalWeken),
      herstel_na_training: berekenHerstel(garminData, trainingDatums),
      niveau_gereed: bepaalNiveauGereed(ratings.slice(-3), huidigeBodyBattery),
      gem_rating: gemRating,
      gem_rating_trend: gemRatingTrend,
      trainingen_per_week: trainingenPerWeek,
    }

    const result: PerformanceAnalysis = {
      ...analyse,
      samenvatting: genereerSamenvatting(analyse),
      gegenereerd_op: new Date().toISOString(),
    }

    // Sla op in cache
    await supabase
      .from('coach_recommendations')
      .upsert({
        user_id: user.id,
        type: 'performance_ai',
        date: vandaag,
        recommendation: JSON.stringify(result),
        created_at: new Date().toISOString(),
      }, { onConflict: 'user_id,type,date' })

    return NextResponse.json(result)

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[performance]', msg)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
