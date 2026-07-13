export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { analyseerCycling } from '@/lib/specialists/cycling-analysis'

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

// ── Fase 2b — Cycling Analysis Engine (blootgesteld als endpoint) ──────
// Bron: docs/specialist-api.md Fase 2b. Roept intern de Data Layer aan
// (haalCyclingData, via analyseerCycling) — geen aparte HTTP-roundtrip.
// VOLLEDIG DETERMINISTISCH, geen AI — zie src/lib/specialists/cycling-analysis.ts
// voor de berekeningen zelf.
export async function GET(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const url = new URL(req.url)
    const periodDays = parseInt(url.searchParams.get('period_days') || '30', 10)

    const resultaat = await analyseerCycling(user.id, periodDays)

    return NextResponse.json(resultaat)
  } catch (err) {
    console.error('[specialists/cycling/engine]', err)
    return NextResponse.json({ error: 'Analyse mislukt' }, { status: 500 })
  }
}
