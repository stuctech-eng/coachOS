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
import { vertaalTarget, ROWING_EQUIPMENT_MAPPING } from '@/lib/specialists/rowing-workout-adapter'
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

// ── Rowing Fase 2: eerste echte aansluiting op de Workout Platform ──────
// Bron: overleg 1 augustus 2026. Voor een gegeven training_plan_sessions-
// rij: bouwt een concrete workout (Builder), valideert 'm (Validation
// Engine), en vertaalt de generieke targets naar roei-specifieke SPM-
// waarden (Rowing Specialist Adapter). Dit is de eerste plek waar het
// Core Platform (v2.4.224-228) daadwerkelijk sportspecifieke betekenis
// krijgt.
//
// v2.4.229-FIX: gevonden vlak vóór het bouwen — de Training Plan Engine's
// rowing-adapter gebruikt 'recovery' als sessietype (matcht rowing-
// drills.ts), maar de Workout Platform's WorkoutTrainingType verwacht
// 'herstel'. Zonder deze mapping zou een herstel-sessie stil in de
// verkeerde tak van bouwHoofdblokken() terechtkomen. MESOCYCLE_MAP lost
// hetzelfde soort verschil op voor mesocycle_type (die zijn toevallig al
// gelijk, maar expliciet gemapt voor consistentie/toekomstbestendigheid).

const TRAININGTYPE_MAP: Record<string, WorkoutTrainingType> = {
  endurance: 'endurance', interval: 'interval', recovery: 'herstel',
  lange_afstand: 'lange_afstand', test: 'test',
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

    // v2.4.230-FIX: losse query i.p.v. een ongeteste join-syntax —
    // zelfde, bewezen patroon als elders vandaag (bijv. Concept2-sync)
    const { data: plan } = await supabase
      .from('training_plans').select('athlete_id, sport').eq('id', sessie.plan_id).maybeSingle()
    if (plan?.athlete_id !== user.id) return NextResponse.json({ error: 'Geen toegang tot deze sessie' }, { status: 403 })
    if (plan?.sport !== 'rowing') return NextResponse.json({ error: 'Dit is geen Rowing-sessie' }, { status: 400 })

    const trainingType = TRAININGTYPE_MAP[sessie.type] || 'endurance'
    const mesocycle = MESOCYCLE_MAP[sessie.mesocycle_type] || 'basis'

    const input: WorkoutBuilderInput = {
      sport: 'rowing', trainingType, mesocycle,
      duration_sec: (sessie.duration || 60) * 60, // v2.4.217-les: duration staat in minuten, hier bewust expliciet omgerekend naar seconden
      difficulty: 'gemiddeld', // v2.4.230-note: bewust vast — een echt niveau-veld bestaat nog niet in het Rowing-profiel
    }

    const workout = bouwWorkout(input)

    // v2.4.247: kruis-sport-check ook hier toegevoegd (ontbrak eerder —
    // Running/Cycling hadden 'm al) — voor consistentie nu ook Rowing
    // zelf beïnvloedbaar door een zware Running/Cycling-sessie
    let finaleWorkout = workout
    try {
      const athleteState = await haalAthleteState(supabase, user.id)
      const kruisSportSignaal = bepaalKruisSportSignaal(athleteState)
      if (kruisSportSignaal) {
        finaleWorkout = pasWorkoutAan(workout, { lichaamAlBelast: kruisSportSignaal })
        finaleWorkout.kruisSportBron = kruisSportSignaal.bronSport
      }
    } catch (kruisSportErr) {
      console.error('[rowing/training-plan/workout] Kruis-sport-check mislukt (workout blijft ongewijzigd):', kruisSportErr)
    }

    const validatie = valideerWorkout(finaleWorkout)
    const uitvoeringsHints = genereerUitvoeringsHints(finaleWorkout)

    // v2.4.230-FIX: gevonden ná het eerste schrijven — 'user_equipment'
    // bestaat niet, equipment staat als boolean-kolommen in 'profiles'
    // (zie api/equipment/route.ts). Hergebruikt de al-bestaande
    // 'concept2_available'-kolom, geen nieuwe databron.
    const { data: profielRij } = await supabase
      .from('profiles').select('concept2_available').eq('user_id', user.id).maybeSingle()
    const beschikbaarMateriaal = profielRij?.concept2_available ? ['Concept2'] : []
    const materiaal = bepaalMateriaal(ROWING_EQUIPMENT_MAPPING, beschikbaarMateriaal)

    // Targets vertalen naar SPM (Rowing Specialist Adapter)
    const vertaaldeBlokken = [...finaleWorkout.warmup, ...finaleWorkout.mainBlocks, ...finaleWorkout.cooldown].map(blok => ({
      ...blok,
      roeiVertaling: blok.targets.map(vertaalTarget),
    }))

    return NextResponse.json({ workout: finaleWorkout, validatie, uitvoeringsHints, materiaal, vertaaldeBlokken })
  } catch (err) {
    console.error('[rowing/training-plan/workout]', err)
    return NextResponse.json({ error: 'Workout bouwen mislukt' }, { status: 500 })
  }
}
