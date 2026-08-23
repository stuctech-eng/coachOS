export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { bepaalPromotieStatus } from '@/lib/specialists/kettlebell-promotion'
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

// ── Beat My Class — v2 (na WKSF Ranking-import) ─────────────────────────
// ranking_discipline (bijv. 'long_cycle_10') en ranking_block ('A'/'B')
// worden nu EXPLICIET door de gebruiker gekozen — nooit afgeleid uit
// bell_weight_kg. kettlebell_discipline/bell_weight_kg blijven nodig om
// de PR uit kettlebell_gs_sessions op te zoeken (dat is losstaand van de
// WKSF-classificatie zelf).

export async function GET(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const url = new URL(req.url)
    const rankingDiscipline = url.searchParams.get('ranking_discipline')
    const bodyweightClass = url.searchParams.get('bodyweight_class')
    const rankingBlock = url.searchParams.get('ranking_block') as RankingBlock | null
    const sex = url.searchParams.get('sex') as 'male' | 'female' | null
    const kettlebellDiscipline = url.searchParams.get('kettlebell_discipline') as KettlebellDiscipline | null
    const bellWeightKg = url.searchParams.get('bell_weight_kg')

    if (!rankingDiscipline || !bodyweightClass || !rankingBlock || !sex || !kettlebellDiscipline || !bellWeightKg) {
      return NextResponse.json({
        error: 'ranking_discipline, bodyweight_class, ranking_block, sex, kettlebell_discipline en bell_weight_kg zijn verplicht',
      }, { status: 400 })
    }

    const resultaat = await bepaalPromotieStatus(
      user.id, rankingDiscipline, bodyweightClass, rankingBlock, sex, kettlebellDiscipline, Number(bellWeightKg)
    )
    return NextResponse.json(resultaat)
  } catch (err) {
    console.error('[kettlebell/beat-my-class GET]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}
