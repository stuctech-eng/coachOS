export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { haalGoalsMetProgress } from '@/lib/specialists/goal-engine'

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

// ── Doelvoortgang — Running Dashboard, Fase 2c ──────────────────────────
// Puur een dunne laag over de al-bestaande Goal Engine — geen nieuwe
// berekening. Geeft het leidende (hoogste importance) specialist-scoped
// Running-doel terug, voor weergave op het Dashboard.
export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const goalProgress = await haalGoalsMetProgress(user.id, 'running')
    const specialistDoelen = goalProgress.filter(g => g.goal_scope === 'specialist')

    if (specialistDoelen.length === 0) return NextResponse.json({ leidend_doel: null })

    const importanceRang: Record<string, number> = { must: 3, high: 2, normal: 1, low: 0 }
    const leidendDoel = specialistDoelen.reduce((a, b) => importanceRang[a.importance] >= importanceRang[b.importance] ? a : b)

    return NextResponse.json({ leidend_doel: leidendDoel })
  } catch (err) {
    console.error('[specialists/running/doelvoortgang]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}
