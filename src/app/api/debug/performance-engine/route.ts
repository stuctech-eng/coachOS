export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getPerformanceContext, berekenRecovery, verklaarRecovery, ENGINE_REGISTRY } from '@/core/performance'

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

// ── Performance Engine Debug — test de volledige Fase 1A-keten ─────────
// Bron: overleg 21 juli 2026. Bevestigt dat adapter → confidence →
// recovery-wrapper → explainability daadwerkelijk samenwerken, met
// echte data van de ingelogde gebruiker.

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const context = await getPerformanceContext(user.id)
    const recovery = berekenRecovery(context)
    const explanation = verklaarRecovery(recovery)

    return NextResponse.json({
      context,
      recovery: { ...recovery, explanation },
      registry: ENGINE_REGISTRY,
    })
  } catch (err) {
    console.error('[debug/performance-engine]', err)
    return NextResponse.json({ error: (err as Error).message || 'Fout' }, { status: 500 })
  }
}
