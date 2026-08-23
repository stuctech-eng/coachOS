export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { bepaalPromotieStatus } from '@/lib/specialists/kettlebell-promotion'
import type { KettlebellDiscipline } from '@/lib/specialists/kettlebell-data'

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

// ── Beat My Class — MVP2 ────────────────────────────────────────────────
// discipline/bell_weight/sex komen als query-params (sessiespecifiek,
// geen aanname vanuit het profiel) — de UI stuurt mee wat de gebruiker
// heeft geselecteerd.

export async function GET(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const url = new URL(req.url)
    const discipline = url.searchParams.get('discipline') as KettlebellDiscipline | null
    const bellWeightKg = url.searchParams.get('bell_weight_kg')
    const sex = url.searchParams.get('sex') as 'male' | 'female' | null

    if (!discipline || !bellWeightKg || !sex) {
      return NextResponse.json({ error: 'discipline, bell_weight_kg en sex zijn verplicht' }, { status: 400 })
    }

    const resultaat = await bepaalPromotieStatus(user.id, discipline, Number(bellWeightKg), sex)
    return NextResponse.json(resultaat)
  } catch (err) {
    console.error('[kettlebell/beat-my-class GET]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}
