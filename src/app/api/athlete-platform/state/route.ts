export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { haalAthleteState } from '@/core/athlete-platform/storage'

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

// v2.4.239 (Universal Athlete Platform — eerste UI-koppeling): dunne
// route, hergebruikt haalAthleteState() rechtstreeks. Geeft de VOLLEDIGE
// UniverseleWaarde terug inclusief ruweWaarde — de UI-laag is
// verantwoordelijk om ruweWaarde NOOIT te tonen (zie Kernregel 2 in
// types.ts), niet deze route. Dat is bewust zo (de route hoeft niet te
// weten wat "tonen" betekent, dat is UI-verantwoordelijkheid).
export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()
    const state = await haalAthleteState(supabase, user.id)
    return NextResponse.json({ state })
  } catch (err) {
    console.error('[athlete-platform/state]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}
