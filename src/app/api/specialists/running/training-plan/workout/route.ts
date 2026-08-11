export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { bouwWorkout, type WorkoutBuilderInput } from '@/core/workout-builder/builder'
import { pasWorkoutAan, type AdaptationSignal } from '@/core/workout-builder/adaptation'
import { valideerWorkout } from '@/core/workout-builder/validation'
import { genereerUitvoeringsHints } from '@/core/workout-builder/execution'
import { bepaalMateriaal } from '@/core/workout-builder/equipment'
import type { WorkoutTrainingType, WorkoutMesocycle } from '@/core/workout-builder/types'
import { vertaalTarget, haalPaceZonesVoorGebruiker, RUNNING_EQUIPMENT_MAPPING } from '@/lib/specialists/running-workout-adapter'
import { berekenVDOT } from '@/lib/specialists/running-zones'
import { haalAthleteState } from '@/core/athlete-platform/storage'
import { bepaalKruisSportSignaal } from '@/core/athlete-platform/cross-sport-bridge'
import { voerDailyAdjustmentUitCore } from '@/lib/specialists/training-plan-engine/adjuster-core'
import { runningAdapter } from '@/lib/specialists/training-plan-engine/running-adapter'
// v2.4.319 (CoachDecision-contract): centrale REST-check, vóór er ooit
// een workout gebouwd wordt — zie module-comment bij de GET-handler.
import { genereerCoachPolicy } from '@/lib/specialists/coach-policy'

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

// ── Running — Workout Platform-koppeling, gelijkwaardig aan Rowing ──────
// Bron: overleg 2 augustus 2026. Bewuste architectuurkeuze: Running
// eerst gelijkwaardig maken aan Rowing op Workout Platform-niveau,
// vóórdat het kruis-sport-voorbeeld "echt waarde" heeft — een demo
// binnen één sport bewijst alleen "CoachOS kan binnen een sport
// aanpassen", niet de kernvisie "CoachOS begrijpt de complete atleet,
// ongeacht de sport".
//
// TWEE VERSCHILLEN MET ROWING'S ROUTE:
// 1. Target-vertaling geeft een ECHTE pace (VDOT-gebaseerd, Daniels/
//    Gilbert), niet alleen een generiek zone-label — Running had deze
//    baseline al, Rowing nog niet
// 2. Na het bouwen wordt de Universal Athlete State gecheckt
//    (bepaalKruisSportSignaal) — als een andere sport (bijv. Rowing)
//    het lichaam al zwaar belast heeft, wordt de workout automatisch
//    afgezwakt via de Adaptation Engine. v2.4.265: gecombineerd met
//    het fatigue-signaal (Daily Adjustment Layer) in ÉÉN aanroep
//    (ADR-007 — Single Workout Mutation Principle)

const TRAININGTYPE_MAP: Record<string, WorkoutTrainingType> = {
  easy_run: 'endurance', interval: 'interval', herstel: 'herstel',
  lange_duurloop: 'lange_afstand', tempo: 'tempo',
}
const MESOCYCLE_MAP: Record<string, WorkoutMesocycle> = {
  basis: 'basis', opbouw: 'opbouw', piek: 'piek', herstel: 'herstel',
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const sessieId = req.nextUrl.searchParams.get('sessieId')
    if (!sessieId) return NextResponse.json({ error: 'sessieId ontbreekt' }, { status: 400 })

    const supabase = createAdminClient()
    const { data: sessie } = await supabase
      .from('training_plan_sessions')
      .select('id, type, duration, mesocycle_type, plan_id')
      .eq('id', sessieId)
      .maybeSingle()

    if (!sessie) return NextResponse.json({ error: 'Sessie niet gevonden' }, { status: 404 })

    const { data: plan } = await supabase
      .from('training_plans').select('athlete_id, sport').eq('id', sessie.plan_id).maybeSingle()
    if (plan?.athlete_id !== user.id) return NextResponse.json({ error: 'Geen toegang tot deze sessie' }, { status: 403 })
    if (plan?.sport !== 'running') return NextResponse.json({ error: 'Dit is geen Running-sessie' }, { status: 400 })

    // v2.4.319 (CoachDecision-contract, integratietest-eis: "nergens
    // mag alsnog TRAIN/ADJUST ontstaan als CoachDecision = REST" —
    // geldt dus ook voor deze detailpagina, niet alleen Today Engine).
    // Eigen catch: bij een fout hier val terug op gewoon bouwen — nooit
    // de gebruiker blokkeren door een fout in de policy-laag zelf.
    try {
      const policy = await genereerCoachPolicy(user.id)
      if (policy.decision === 'REST') {
        return NextResponse.json({ rest: true, reasons: policy.reasons })
      }
    } catch (policyErr) {
      console.error('[running/workout] CoachPolicy ophalen mislukt, val terug op gewoon bouwen:', policyErr)
    }

    const trainingType = TRAININGTYPE_MAP[sessie.type] || 'endurance'
    const mesocycle = MESOCYCLE_MAP[sessie.mesocycle_type] || 'basis'

    const input: WorkoutBuilderInput = {
      sport: 'running', trainingType, mesocycle,
      duration_sec: (sessie.duration || 60) * 60,
      difficulty: 'gemiddeld',
    }

    let workout = bouwWorkout(input)

    // v2.4.265 (ADR-007 — Single Workout Mutation Principle): beide
    // signaalbronnen (kruis-sport + fatigue) verzameld in ÉÉN array,
    // ÉÉN aanroep van pasWorkoutAan() — zie rowing/training-plan/
    // workout/route.ts voor de volledige toelichting.
    try {
      const alleSignalen: AdaptationSignal[] = []

      const athleteState = await haalAthleteState(supabase, user.id)
      const kruisSportSignaal = bepaalKruisSportSignaal(athleteState)
      if (kruisSportSignaal) alleSignalen.push(kruisSportSignaal)

      const dailyAdjustment = await voerDailyAdjustmentUitCore(user.id, sessie.plan_id, runningAdapter)
      if (dailyAdjustment.fatigueSignaal) alleSignalen.push(dailyAdjustment.fatigueSignaal)
      // v2.4.314: Coach Decision Integrity — vacation_mode meenemen,
      // zelfde patroon als fatigue hierboven.
      if (dailyAdjustment.vacationSignaal) alleSignalen.push(dailyAdjustment.vacationSignaal)

      if (alleSignalen.length > 0) {
        workout = pasWorkoutAan(workout, { signalen: alleSignalen })
        const crossSportBron = alleSignalen.find(s => s.source === 'cross_sport')
        if (crossSportBron?.metadata?.bronSport) workout.kruisSportBron = crossSportBron.metadata.bronSport as string
      }
    } catch (signaalErr) {
      console.error('[running/training-plan/workout] Signaal-verzameling mislukt (workout blijft ongewijzigd):', signaalErr)
    }

    const validatie = valideerWorkout(workout)
    const uitvoeringsHints = genereerUitvoeringsHints(workout)

    const { data: profielRij } = await supabase
      .from('specialist_profiles').select('preferences').eq('user_id', user.id).eq('specialist_type', 'running').maybeSingle()
    const prefs = (profielRij?.preferences || {}) as { laatste_race_afstand_m?: number; laatste_race_tijd_sec?: number }
    const vdot = prefs.laatste_race_afstand_m && prefs.laatste_race_tijd_sec
      ? berekenVDOT(prefs.laatste_race_afstand_m, prefs.laatste_race_tijd_sec) : null
    const paceZones = haalPaceZonesVoorGebruiker(vdot)

    const materiaal = bepaalMateriaal(RUNNING_EQUIPMENT_MAPPING, [])

    const isSprintZone5 = trainingType === 'sprint'
    const vertaaldeBlokken = [...workout.warmup, ...workout.mainBlocks, ...workout.cooldown].map(blok => ({
      ...blok,
      looprVertaling: blok.targets.map(t => vertaalTarget(t, paceZones, isSprintZone5)),
    }))

    return NextResponse.json({ workout, validatie, uitvoeringsHints, materiaal, vertaaldeBlokken, heeftVdot: vdot !== null })
  } catch (err) {
    console.error('[running/training-plan/workout]', err)
    return NextResponse.json({ error: 'Workout bouwen mislukt' }, { status: 500 })
  }
}
