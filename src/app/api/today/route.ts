export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { bepaalTodayPlan } from '@/lib/today-engine'

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

// ── api/today — de enige ingang voor "wat moet ik vandaag doen?" ────────
// Bron: overleg 22 juli 2026. "Dan is er nog maar één ingang." Home
// (en later elk ander scherm dat dit nodig heeft) roept UITSLUITEND
// deze route aan — nooit meer rechtstreeks api/training/today of de
// specialist-trainingsplan-routes voor dit doel.

export async function GET(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const cookieHeader = req.headers.get('cookie') || ''
    const plan = await bepaalTodayPlan(user.id, cookieHeader)

    return NextResponse.json({ plan })
  } catch (err) {
    console.error('[api/today]', err)
    return NextResponse.json({ error: 'Kon vandaag niet bepalen' }, { status: 500 })
  }
}
