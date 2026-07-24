export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { haalDagContext } from '@/core/utils/life-events-context'

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

// ── Levert de opgeloste dagcontext aan de Levensgebeurtenissen-pagina ──
// Bron: overleg 22 juli 2026, Coach Context Engine Fase 1. Zelfde bron
// als de Coach-prompt/Coach Score (haalDagContext) — het scherm toont nu
// precies wat de Coach ook daadwerkelijk gebruikt, geen aparte
// interpretatie.

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()

    const vandaagNummer = new Date().getDay()
    const isWeekend = vandaagNummer === 0 || vandaagNummer === 6
    const context = await haalDagContext(supabase, user.id, vandaagNummer, isWeekend)

    return NextResponse.json({ context })
  } catch (err) {
    console.error('[life-events/context]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}
