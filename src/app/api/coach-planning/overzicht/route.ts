export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { haalOverzichtData } from '@/lib/coach-planning-overzicht'

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

// ── Coach Planning — Overzicht (Fase A, stap 3) ──────────────────────
// v2.4.202: dataverzameling geëxtraheerd naar
// src/lib/coach-planning-overzicht.ts (gedeeld met de Smart Action
// Engine) — deze route is nu een dunne wrapper eromheen, geen
// functionele wijziging.

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()
    const data = await haalOverzichtData(supabase, user.id)
    return NextResponse.json(data)
  } catch (err) {
    console.error('[coach-planning/overzicht]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}
