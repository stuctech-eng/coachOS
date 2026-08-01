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

// ── Rowing Profile — Fase 1, stap 3 ──────────────────────────────────────
// Bron: overleg 1 augustus 2026. Bewust MINIMAAL — alleen trainingsdagen
// + beschikbare uren, exact wat de Training Plan Engine's
// haalProfiel()-contract nodig heeft (zie rowing-adapter.ts). Een
// 2k-testtijd-gebaseerd "FTP-equivalent voor roeien" (uit de Master
// Vision) is bewust NIET meegebouwd — hoort bij een latere, intensiteits-
// gerichte verfijning, niet bij de basis plan-generatie zelf. Slaat
// GEEN nieuwe tabel op — hergebruikt specialist_profiles.preferences
// (specialist_type='rowing'), exact hetzelfde patroon als Cycling/Running.

interface RowingPreferences {
  trainingsdagen?: string[]
  beschikbare_uren_per_week?: number
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
      preferences: { trainingsdagen: body.trainingsdagen || [], beschikbare_uren_per_week: body.beschikbare_uren_per_week || 3 },
    }, { onConflict: 'user_id,specialist_type' })

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[rowing/profile POST]', err)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }
}
