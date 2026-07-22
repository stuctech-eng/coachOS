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

// ── Performance Engine — productie-route ────────────────────────────────
// Bron: overleg 21 juli 2026. Zelfde keten als /api/debug/performance-engine,
// maar dit is de route die het echte Dashboard (src/app/performance/page.tsx)
// gebruikt — één bron van waarheid, geen tweede, losstaande berekening.
// Geeft bewust GEEN volledige ruwe context terug (geen checkin/health-
// details) — alleen wat het Dashboard nodig heeft om te tonen.

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

    // Elke berekende score bewaren voor toekomstige trends — eigen
    // try/catch per snapshot, mag het Dashboard nooit blokkeren
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

    const [recoveryHistorie, readinessHistorie] = await Promise.all([
      haalHistorie(user.id, 'Recovery', 30).catch(() => []),
      haalHistorie(user.id, 'Readiness', 30).catch(() => []),
    ])

    return NextResponse.json({
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
      readinessHistorie,
      registry: ENGINE_REGISTRY,
    })
  } catch (err) {
    console.error('[performance-engine]', err)
    return NextResponse.json({ error: 'Ophalen mislukt — probeer het later opnieuw.' }, { status: 500 })
  }
}
