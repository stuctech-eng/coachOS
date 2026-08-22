export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { haalKettlebellData } from '@/lib/specialists/kettlebell-data'
import { analyseerKettlebellData } from '@/lib/specialists/kettlebell-analysis'

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

// ── Kettlebell Analysis Engine-route — MVP1 ─────────────────────────────
// Dunne verbinding Data Engine → Analysis Engine, zelfde tweetraps-patroon
// als de andere specialisten (haalXData → analyseerXData). Geen AI-
// aanroep hier — Analysis Engine is deterministisch, zie
// docs/specialist-engine-architecture.md.

export async function GET(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const url = new URL(req.url)
    const periodDays = parseInt(url.searchParams.get('period_days') || '90', 10)

    const data = await haalKettlebellData(user.id, periodDays)
    const analyse = analyseerKettlebellData(data.activiteiten)

    return NextResponse.json(analyse)
  } catch (err) {
    console.error('[kettlebell/analyse GET]', err)
    return NextResponse.json({ error: 'Analyse mislukt' }, { status: 500 })
  }
}
