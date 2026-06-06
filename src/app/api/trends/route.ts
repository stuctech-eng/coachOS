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

type TrendRichting = 'stijgend' | 'dalend' | 'stabiel' | 'onvoldoende data'

interface TrendItem {
  gemiddelde: number
  laatste: number
  richting: TrendRichting
  verschil: number
  aantalDagen: number
  beschrijving: string
}

interface TrendData {
  hrv: TrendItem | null
  resting_hr: TrendItem | null
  slaap: TrendItem | null
  stappen: TrendItem | null
  coach_score: TrendItem | null
  herstel_score: TrendItem | null
  samenvatting: string[]
}

function berekenTrend(waarden: number[], label: string, eenheid: string, omgekeerd = false): TrendItem | null {
  if (waarden.length < 3) return null

  const gemiddelde = Math.round(waarden.reduce((a, b) => a + b, 0) / waarden.length * 10) / 10
  const laatste = waarden[waarden.length - 1]
  const eerste = waarden[0]
  const verschilPct = ((laatste - eerste) / eerste) * 100
  const verschil = Math.round(Math.abs(laatste - gemiddelde) * 10) / 10

  let richting: TrendRichting
  if (Math.abs(verschilPct) < 5) {
    richting = 'stabiel'
  } else if (verschilPct > 0) {
    richting = omgekeerd ? 'dalend' : 'stijgend'
  } else {
    richting = omgekeerd ? 'stijgend' : 'dalend'
  }

  // Beschrijving in mensentaal
  const aantalDagen = waarden.length
  let beschrijving = ''
  if (richting === 'stabiel') {
    beschrijving = `${label} is stabiel op ${gemiddelde}${eenheid} over ${aantalDagen} dagen`
  } else if (richting === 'stijgend') {
    beschrijving = `${label} stijgt — nu ${laatste}${eenheid} vs gemiddeld ${gemiddelde}${eenheid}`
  } else {
    beschrijving = `${label} daalt — nu ${laatste}${eenheid} vs gemiddeld ${gemiddelde}${eenheid}`
  }

  return { gemiddelde, laatste, richting, verschil, aantalDagen, beschrijving }
}

function genereerSamenvatting(trends: Omit<TrendData, 'samenvatting'>): string[] {
  const alarmen: string[] = []
  const positief: string[] = []

  if (trends.hrv) {
    if (trends.hrv.richting === 'dalend' && trends.hrv.aantalDagen >= 5) {
      alarmen.push(`HRV daalt al ${trends.hrv.aantalDagen} dagen — lichaam herstelt onvoldoende`)
    } else if (trends.hrv.richting === 'stijgend') {
      positief.push(`HRV stijgt — herstel verbetert`)
    }
  }

  if (trends.resting_hr) {
    if (trends.resting_hr.richting === 'stijgend') {
      alarmen.push(`Rusthartslag stijgt — mogelijk overbelasting of ziekte`)
    }
  }

  if (trends.slaap) {
    if (trends.slaap.richting === 'dalend' && trends.slaap.gemiddelde < 7) {
      alarmen.push(`Slaap daalt en is gemiddeld onder 7 uur — slaapschuld risico`)
    } else if (trends.slaap.richting === 'stijgend') {
      positief.push(`Slaap verbetert — goed herstel signaal`)
    }
  }

  if (trends.coach_score) {
    if (trends.coach_score.richting === 'dalend' && trends.coach_score.aantalDagen >= 4) {
      alarmen.push(`Coach Score daalt al ${trends.coach_score.aantalDagen} dagen — actie vereist`)
    } else if (trends.coach_score.richting === 'stijgend') {
      positief.push(`Coach Score stijgt — je bent op de goede weg`)
    }
  }

  return [...alarmen, ...positief]
}

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()

    const negentig = new Date()
    negentig.setDate(negentig.getDate() - 90)

    const [garminRes, statusRes] = await Promise.all([
      supabase.from('garmin_imports')
        .select('date, parsed_data')
        .eq('user_id', user.id)
        .eq('status', 'confirmed')
        .gte('date', negentig.toISOString().split('T')[0])
        .order('date', { ascending: true }),
      supabase.from('daily_status')
        .select('date, coach_score, recovery_score')
        .eq('user_id', user.id)
        .gte('date', negentig.toISOString().split('T')[0])
        .order('date', { ascending: true }),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const garmin = (garminRes.data || []) as Array<{ date: string; parsed_data: any }>
    const statussen = statusRes.data || []

    // Extract waarden uit Garmin imports
    const hrv7 = garmin.slice(-7).filter(g => g.parsed_data?.hrv?.avg_7d_ms).map(g => g.parsed_data.hrv.avg_7d_ms as number)
    const hrv30 = garmin.slice(-30).filter(g => g.parsed_data?.hrv?.avg_7d_ms).map(g => g.parsed_data.hrv.avg_7d_ms as number)
    const rhr7 = garmin.slice(-7).filter(g => g.parsed_data?.resting_hr).map(g => g.parsed_data.resting_hr as number)
    const slaap7 = garmin.slice(-7).filter(g => g.parsed_data?.sleep?.duration_minutes).map(g => Math.round(g.parsed_data.sleep.duration_minutes / 60 * 10) / 10)
    const slaap30 = garmin.slice(-30).filter(g => g.parsed_data?.sleep?.duration_minutes).map(g => Math.round(g.parsed_data.sleep.duration_minutes / 60 * 10) / 10)
    const stappen7 = garmin.slice(-7).filter(g => g.parsed_data?.steps?.value).map(g => g.parsed_data.steps.value as number)
    const score7 = statussen.slice(-7).filter(s => s.coach_score).map(s => s.coach_score as number)
    const herstel7 = statussen.slice(-7).filter(s => s.recovery_score).map(s => s.recovery_score as number)

    const trends: Omit<TrendData, 'samenvatting'> = {
      hrv: berekenTrend(hrv7.length >= 3 ? hrv7 : hrv30, 'HRV', 'ms'),
      resting_hr: berekenTrend(rhr7, 'Rusthartslag', 'bpm', true),
      slaap: berekenTrend(slaap7.length >= 3 ? slaap7 : slaap30, 'Slaap', 'u'),
      stappen: berekenTrend(stappen7, 'Stappen', ''),
      coach_score: berekenTrend(score7, 'Coach Score', ''),
      herstel_score: berekenTrend(herstel7, 'Herstel', ''),
    }

    const samenvatting = genereerSamenvatting(trends)

    return NextResponse.json({ ...trends, samenvatting })

  } catch (error) {
    console.error('Trends error:', error)
    return NextResponse.json({ error: 'Trends ophalen mislukt' }, { status: 500 })
  }
}
