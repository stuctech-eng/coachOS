export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { bouwWorkout, type WorkoutBuilderInput } from '@/core/workout-builder/builder'
import { valideerWorkout } from '@/core/workout-builder/validation'
import { genereerUitvoeringsHints } from '@/core/workout-builder/execution'
import { bepaalMateriaal } from '@/core/workout-builder/equipment'
import type { WorkoutMesocycle, WorkoutDifficulty } from '@/core/workout-builder/types'
import { bepaalTrainingType, verrijkMetKettlebellContext, KETTLEBELL_EQUIPMENT_MAPPING } from '@/lib/specialists/kettlebell-workout-adapter'
import type { KettlebellTrainingRequest } from '@/lib/specialists/kettlebell-training-request'
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

// ── Kettlebell Specialist → Trainer AI-brug — MVP2.5 ─────────────────────
// Eerste, daadwerkelijk aanroepbare implementatie van het contract uit
// kettlebell-training-request.ts (v2.4.349). Neemt een KettlebellTrainingRequest
// in de POST-body (i.p.v. een sessieId zoals Cycling/Running/Rowing) —
// die drie lezen uit training_plan_sessions, een periodisatietabel die
// voor Kettlebell nog niet bestaat (spec §23 Periodisering, MVP3+).
// Deze route is dus bewust EENMALIG/on-demand, geen automatische
// dagelijkse planning via today-engine.ts — die integratie volgt pas
// zodra er een Kettlebell Training Plan Engine is.
//
// Wel al gedeeld met de andere specialisten: de CoachPolicy REST-check
// (Master Coach blijft de centrale regisseur, spec §21/§37 — een
// specialist mag nooit om de recovery-status heen trainingen voorstellen).

const MESOCYCLE_MAP: Record<string, WorkoutMesocycle> = {
  basis: 'basis', opbouw: 'opbouw', piek: 'piek', herstel: 'herstel',
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body = await req.json() as { request: KettlebellTrainingRequest; mesocycle?: string; difficulty?: WorkoutDifficulty }
    const request = body.request
    if (!request?.core?.discipline || !request.core.bell_weight_kg || !request.core.duration_sec) {
      return NextResponse.json({ error: 'request.core.discipline, bell_weight_kg en duration_sec zijn verplicht' }, { status: 400 })
    }

    try {
      const policy = await genereerCoachPolicy(user.id)
      if (policy.decision === 'REST') {
        return NextResponse.json({ rest: true, reasons: policy.reasons })
      }
    } catch (policyErr) {
      console.error('[kettlebell/workout] CoachPolicy ophalen mislukt, val terug op gewoon bouwen:', policyErr)
    }

    const input: WorkoutBuilderInput = {
      sport: 'kettlebell',
      trainingType: bepaalTrainingType(request),
      duration_sec: request.core.duration_sec,
      mesocycle: MESOCYCLE_MAP[body.mesocycle || 'basis'] || 'basis',
      // v2.4.353-note: bewust vast/via parameter, geen Kettlebell-niveauveld —
      // zelfde eerlijke beperking als Rowing's workout-route.
      difficulty: body.difficulty || 'gemiddeld',
    }

    const workout = bouwWorkout(input)
    const verrijkt = verrijkMetKettlebellContext(workout, request)

    const validatie = valideerWorkout(verrijkt)
    const uitvoeringsHints = genereerUitvoeringsHints(verrijkt)
    const materiaal = bepaalMateriaal(KETTLEBELL_EQUIPMENT_MAPPING, ['Kettlebell'])

    return NextResponse.json({ workout: verrijkt, validatie, uitvoeringsHints, materiaal })
  } catch (err) {
    console.error('[kettlebell/training-plan/workout POST]', err)
    return NextResponse.json({ error: 'Workout bouwen mislukt' }, { status: 500 })
  }
}
