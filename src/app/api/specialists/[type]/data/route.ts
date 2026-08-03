export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { haalCyclingData } from '@/lib/specialists/cycling-data'
import { haalRunningData } from '@/lib/specialists/running-data'
import { haalRowingData } from '@/lib/specialists/rowing-data'

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

// ── Fase 2a — Data Layer, gegeneraliseerd (v2.4.83) ─────────────────────
// Was hardcoded op alleen 'cycling' — nu ook 'running' ondersteund, exact
// het "invuloefening"-scenario dat specialist-engine-architecture.md
// voorspelde: Data Layer is per sport uniek werk (haalCyclingData vs.
// haalRunningData), maar de ROUTE zelf is nu generiek genoeg om beide
// aan te roepen.
const DATA_FETCHERS: Record<string, (userId: string, periodDays: number) => Promise<unknown>> = {
  cycling: haalCyclingData,
  running: haalRunningData,
  rowing: haalRowingData,
}

export async function GET(req: NextRequest, { params }: { params: { type: string } }) {
  try {
    const fetcher = DATA_FETCHERS[params.type]
    if (!fetcher) {
      return NextResponse.json({ error: `Data Layer voor '${params.type}' bestaat nog niet` }, { status: 501 })
    }

    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const url = new URL(req.url)
    const periodDays = parseInt(url.searchParams.get('period_days') || '30', 10)

    const data = await fetcher(user.id, periodDays) as { activiteiten: unknown[]; trainingsresultaten: unknown[] }

    return NextResponse.json({
      ...data,
      aantal_activiteiten: data.activiteiten.length,
      aantal_trainingsresultaten: data.trainingsresultaten.length,
    })
  } catch (err) {
    console.error(`[specialists/${params.type}/data]`, err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}
