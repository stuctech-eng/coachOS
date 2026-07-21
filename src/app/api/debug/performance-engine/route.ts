export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getPerformanceContext, berekenRecovery, berekenLoad, berekenFatigue, berekenReadiness, berekenConsistency, berekenEndurance, berekenSprint, berekenEfficiency, berekenClimbing, berekenProgress, getVo2max, bewaarSnapshot, haalHistorie, verklaarRecovery, ENGINE_REGISTRY } from '@/core/performance'

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
    const load = await berekenLoad(user.id, context)
    const fatigue = berekenFatigue(context, load)
    const readiness = await berekenReadiness(context, recovery, fatigue)
    const consistency = await berekenConsistency(context)
    const vo2max = await getVo2max(user.id).catch(() => null)
    const endurance = berekenEndurance(context, load, consistency, vo2max)
    const sprint = await berekenSprint(context)
    const efficiency = await berekenEfficiency(context)
    const climbing = await berekenClimbing(context)
    const progress = await berekenProgress(context)

    // v2.4.155: elke berekende score bewaren voor toekomstige trends —
    // eigen try/catch per snapshot, mag het debug-scherm nooit blokkeren
    await Promise.all([
      bewaarSnapshot(user.id, 'Recovery', recovery.value.score).catch(e => console.error('[history] Recovery bewaren mislukt:', e)),
      bewaarSnapshot(user.id, 'Load', load.value.tsb).catch(e => console.error('[history] Load bewaren mislukt:', e)),
      bewaarSnapshot(user.id, 'Fatigue', fatigue.value.score).catch(e => console.error('[history] Fatigue bewaren mislukt:', e)),
      bewaarSnapshot(user.id, 'Readiness', readiness.value.score).catch(e => console.error('[history] Readiness bewaren mislukt:', e)),
      bewaarSnapshot(user.id, 'Consistency', consistency.value.percentage).catch(e => console.error('[history] Consistency bewaren mislukt:', e)),
      bewaarSnapshot(user.id, 'Endurance', endurance.value.score).catch(e => console.error('[history] Endurance bewaren mislukt:', e)),
      bewaarSnapshot(user.id, 'Sprint', sprint.value.score).catch(e => console.error('[history] Sprint bewaren mislukt:', e)),
      bewaarSnapshot(user.id, 'Efficiency', efficiency.value.score).catch(e => console.error('[history] Efficiency bewaren mislukt:', e)),
      bewaarSnapshot(user.id, 'Climbing', climbing.value.score).catch(e => console.error('[history] Climbing bewaren mislukt:', e)),
    ])

    const recoveryHistorie = await haalHistorie(user.id, 'Recovery', 30).catch(() => [])

    return NextResponse.json({
      context,
      recovery: { ...recovery, explanation },
      load,
      fatigue,
      readiness,
      consistency,
      endurance,
      sprint,
      efficiency,
      climbing,
      progress,
      recoveryHistorie,
      registry: ENGINE_REGISTRY,
    })
  } catch (err) {
    console.error('[debug/performance-engine]', err)
    return NextResponse.json({ error: (err as Error).message || 'Fout' }, { status: 500 })
  }
}
