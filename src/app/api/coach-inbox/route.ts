export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { evalueerCoachInboxSignalen, pauzeerTrainingsplannen } from '@/lib/coach/coach-inbox'

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

// ── Coach Inbox — Fase C, eerste signaal ─────────────────────────────────
// Bron: v2.4.299. Zie module-comment in coach-inbox.ts voor de volledige
// toelichting.

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()
    const signalen = await evalueerCoachInboxSignalen(supabase, user.id)
    return NextResponse.json({ signalen })
  } catch (err) {
    console.error('[coach-inbox GET]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()

    const body = await request.json().catch(() => null) as { actie?: string; sporten?: string[] } | null
    if (body?.actie === 'pauzeer_trainingsplannen' && body.sporten?.length) {
      const aantal = await pauzeerTrainingsplannen(supabase, user.id, body.sporten)
      return NextResponse.json({ gepauzeerd: aantal })
    }

    return NextResponse.json({ error: `Onbekende actie: ${body?.actie}` }, { status: 400 })
  } catch (err) {
    console.error('[coach-inbox POST]', err)
    return NextResponse.json({ error: 'Actie mislukt' }, { status: 500 })
  }
}
