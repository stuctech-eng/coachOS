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
import { vertaalTarget, haalVermogensZonesVoorGebruiker, CYCLING_EQUIPMENT_MAPPING } from '@/lib/specialists/cycling-workout-adapter'
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

// ── Cycling — Workout Platform-koppeling, derde gelijkwaardige sport ────
// Bron: overleg 2 augustus 2026. Exact hetzelfde patroon als Running
// (v2.4.242): echte vermogenswaarden (FTP-gebaseerd, Coggan 7-zone-
// model) i.p.v. een generiek label, plus het kruis-sport-signaal.

const TRAININGTYPE_MAP: Record<string, WorkoutTrainingType> = {
  duurtraining: 'endurance', interval: 'interval', herstel: 'herstel',
  lange_duurtraining: 'lange_afstand',
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
    if (plan?.sport !== 'cycling') return NextResponse.json({ error: 'Dit is geen Cycling-sessie' }, { status: 400 })

    const trainingType = TRAININGTYPE_MAP[sessie.type] || 'endurance'
    const mesocycle = MESOCYCLE_MAP[sessie.mesocycle_type] || 'basis'

    const input: WorkoutBuilderInput = {
      sport: 'cycling', trainingType, mesocycle,
      duration_sec: (sessie.duration || 60) * 60,
      difficulty: 'gemiddeld',
    }

    let workout = bouwWorkout(input)

    try {
      const athleteState = await haalAthleteState(supabase, user.id)
      const kruisSportSignaal = bepaalKruisSportSignaal(athleteState)
      if (kruisSportSignaal) {
        workout = pasWorkoutAan(workout, { lichaamAlBelast: kruisSportSignaal })
        workout.kruisSportBron = kruisSportSignaal.bronSport
      }
    } catch (kruisSportErr) {
      console.error('[cycling/training-plan/workout] Kruis-sport-check mislukt (workout blijft ongewijzigd):', kruisSportErr)
    }

    const validatie = valideerWorkout(workout)
    const uitvoeringsHints = genereerUitvoeringsHints(workout)

    const { data: profielRij } = await supabase
      .from('specialist_profiles').select('preferences').eq('user_id', user.id).eq('specialist_type', 'cycling').maybeSingle()
    const prefs = (profielRij?.preferences || {}) as { ftp?: number }
    const vermogensZones = haalVermogensZonesVoorGebruiker(prefs.ftp)

    const materiaal = bepaalMateriaal(CYCLING_EQUIPMENT_MAPPING, [])

    const isSprintZone5 = trainingType === 'sprint'
    const vertaaldeBlokken = [...workout.warmup, ...workout.mainBlocks, ...workout.cooldown].map(blok => ({
      ...blok,
      fietsVertaling: blok.targets.map(t => vertaalTarget(t, vermogensZones, isSprintZone5)),
    }))

    return NextResponse.json({ workout, validatie, uitvoeringsHints, materiaal, vertaaldeBlokken, heeftFtp: !!prefs.ftp })
  } catch (err) {
    console.error('[cycling/training-plan/workout]', err)
    return NextResponse.json({ error: 'Workout bouwen mislukt' }, { status: 500 })
  }
}
