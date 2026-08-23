export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { simuleerWedstrijd } from '@/lib/specialists/kettlebell-competition-simulator'
import type { KettlebellDiscipline } from '@/lib/specialists/kettlebell-data'
import type { RankingBlock } from '@/lib/specialists/kettlebell-classification'

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

export async function GET(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const url = new URL(req.url)
    const kettlebellDiscipline = url.searchParams.get('kettlebell_discipline') as KettlebellDiscipline | null
    const bellWeightKg = url.searchParams.get('bell_weight_kg')
    const durationSec = url.searchParams.get('duration_sec')
    const rankingDiscipline = url.searchParams.get('ranking_discipline')
    const sex = url.searchParams.get('sex') as 'male' | 'female' | null
    const bodyweightClass = url.searchParams.get('bodyweight_class')
    const rankingBlock = url.searchParams.get('ranking_block') as RankingBlock | null

    if (!kettlebellDiscipline || !bellWeightKg || !durationSec || !rankingDiscipline || !sex || !bodyweightClass || !rankingBlock) {
      return NextResponse.json({ error: 'kettlebell_discipline, bell_weight_kg, duration_sec, ranking_discipline, sex, bodyweight_class en ranking_block zijn verplicht' }, { status: 400 })
    }

    const resultaat = await simuleerWedstrijd(
      user.id, kettlebellDiscipline, Number(bellWeightKg), Number(durationSec),
      rankingDiscipline, sex, bodyweightClass, rankingBlock,
    )
    return NextResponse.json(resultaat)
  } catch (err) {
    console.error('[kettlebell/competition-simulator GET]', err)
    return NextResponse.json({ error: 'Simuleren mislukt' }, { status: 500 })
  }
}
