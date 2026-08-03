export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { bouwWorkout, type WorkoutBuilderInput } from '@/core/workout-builder/builder'
import { pasWorkoutAan } from '@/core/workout-builder/adaptation'
import { valideerWorkout } from '@/core/workout-builder/validation'
import { genereerUitvoeringsHints } from '@/core/workout-builder/execution'
import { bepaalMateriaal } from '@/core/workout-builder/equipment'
import type { WorkoutTrainingType, WorkoutMesocycle } from '@/core/workout-builder/types'
import { vertaalTarget, haalPaceZonesVoorGebruiker, RUNNING_EQUIPMENT_MAPPING } from '@/lib/specialists/running-workout-adapter'
import { berekenVDOT } from '@/lib/specialists/running-zones'
import { haalAthleteState } from '@/core/athlete-platform/storage'
import { bepaalKruisSportSignaal } from '@/core/athlete-platform/cross-sport-bridge'

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
//    afgezwakt via de Adaptation Engine (lichaamAlBelast-signaal)

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

    const trainingType = TRAININGTYPE_MAP[sessie.type] || 'endurance'
    const mesocycle = MESOCYCLE_MAP[sessie.mesocycle_type] || 'basis'

    const input: WorkoutBuilderInput = {
      sport: 'running', trainingType, mesocycle,
      duration_sec: (sessie.duration || 60) * 60,
      difficulty: 'gemiddeld',
    }

    let workout = bouwWorkout(input)

    // Kruis-sport-signaal — leest de Universal Athlete State, past de
    // workout aan als een ANDERE sport het lichaam al belast heeft.
    // In een try/catch: een fout hier mag het bouwen van de workout
    // zelf nooit laten falen, zelfde voorzichtigheidsprincipe als bij
    // de Concept2-sync-koppeling.
    try {
      const athleteState = await haalAthleteState(supabase, user.id)
      const kruisSportSignaal = bepaalKruisSportSignaal(athleteState)
      if (kruisSportSignaal) {
        workout = pasWorkoutAan(workout, { lichaamAlBelast: kruisSportSignaal })
        workout.kruisSportBron = kruisSportSignaal.bronSport
      }
    } catch (kruisSportErr) {
      console.error('[running/training-plan/workout] Kruis-sport-check mislukt (workout blijft ongewijzigd):', kruisSportErr)
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
