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

// ── Rowing Profile — Fase 1, stap 3 + Fase 2-uitbreiding (2k-baseline) ──
// Bron: overleg 1 + 3 augustus 2026. Was bewust minimaal (alleen
// trainingsdagen + beschikbare uren) — nu uitgebreid met een 2.000m-
// referentietest, exact hetzelfde principe als Running's
// laatste_race_afstand_m/laatste_race_tijd_sec: "geen schijnprecisie,
// een persoonlijke baseline vóórdat je personaliseert" (letterlijk
// citaat uit het overleg). Voordat deze baseline bestaat: Population
// Model (algemene sportwetenschap, geen individuele claim). Erna:
// Personal Baseline — echte, uitlegbare TSS-berekening mogelijk.

interface RowingPreferences {
  trainingsdagen?: string[]
  beschikbare_uren_per_week?: number
  laatste_2k_tijd_sec?: number
}

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('specialist_profiles')
      .select('preferences')
      .eq('user_id', user.id)
      .eq('specialist_type', 'rowing')
      .maybeSingle()
    return NextResponse.json({ preferences: (data?.preferences || {}) as RowingPreferences })
  } catch (err) {
    console.error('[rowing/profile GET]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const body = await req.json() as RowingPreferences
    const supabase = createAdminClient()

    const { error } = await supabase.from('specialist_profiles').upsert({
      user_id: user.id,
      specialist_type: 'rowing',
      preferences: {
        trainingsdagen: body.trainingsdagen || [],
        beschikbare_uren_per_week: body.beschikbare_uren_per_week || 3,
        laatste_2k_tijd_sec: body.laatste_2k_tijd_sec || undefined,
      },
    }, { onConflict: 'user_id,specialist_type' })

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[rowing/profile POST]', err)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }
}
