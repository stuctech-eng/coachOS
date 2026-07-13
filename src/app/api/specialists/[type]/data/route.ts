export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { haalCyclingData } from '@/lib/specialists/cycling-data'

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

// ── Fase 2a — Data Layer ────────────────────────────────────────────────
// v2.4.66: herbouwd als dunne wrapper om de gedeelde haalCyclingData()-
// functie (src/lib/specialists/cycling-data.ts) — dezelfde functie wordt
// nu ook intern gebruikt door de Cycling Analysis Engine (Fase 2b), geen
// duplicatie meer. Gedrag van deze route zelf is ongewijzigd t.o.v. v2.4.61.
export async function GET(req: NextRequest, { params }: { params: { type: string } }) {
  try {
    if (params.type !== 'cycling') {
      return NextResponse.json({ error: `Data Layer voor '${params.type}' bestaat nog niet — alleen 'cycling' is geïmplementeerd (referentie-specialist)` }, { status: 501 })
    }

    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const url = new URL(req.url)
    const periodDays = parseInt(url.searchParams.get('period_days') || '30', 10)

    const data = await haalCyclingData(user.id, periodDays)

    return NextResponse.json({
      ...data,
      aantal_activiteiten: data.activiteiten.length,
      aantal_trainingsresultaten: data.trainingsresultaten.length,
    })
  } catch (err) {
    console.error('[specialists/cycling/data]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}
