export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { overwegActiviteitUitTrainingResultaat } from '@/lib/activity-import/activity-bridge'
import { evalueerCoachCallBehoefte } from '@/lib/coach/coach-decision-engine'
import { schrijfCoachCallItem } from '@/lib/coach/coach-call-writer'

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        getAll: () => cookieStore.getAll(),
      }
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// v2.4.290: withRetry() (v2.4.9, retry-wrapper specifiek voor de oude
// coach_call-aanmaak) verwijderd — enige gebruik zat in de Stap 3-logica
// die nu vervangen is door schrijfCoachCallItem() (coach-call-writer.ts),
// geen dode code laten staan (architectuurregel).

// POST — sla evaluatie van een Universal Training Engine sessie op
// Body komt van session/[module]/page.tsx: { module, training_type, ...SessionResult }
export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()
    const body = await req.json()

    const {
      session_id,
      training_type,
      module,
      training_source,
      completed,
      actual_duration,
      rating,
      perceived_effort,
      fatigue_after,
      soreness,
      notes,
      segments,
      rowing_technique_rating,
      rowing_pacing_rating,
      rowing_fatigue_rating,
      running_technique_rating,
      running_pacing_rating,
      running_fatigue_rating,
      running_rpe_rating,
      cycling_technique_rating,
      cycling_pacing_rating,
      cycling_fatigue_rating,
      cycling_rpe_rating,
    } = body

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })

    if (session_id) {
      await supabase
        .from('training_sessions')
        .update({ status: completed ? 'completed' : 'skipped' })
        .eq('id', session_id)
        .eq('user_id', user.id)
    }

    const VALID_SOURCES = ['coach_plan', 'library', 'manual', 'imported']
    const insertData: Record<string, unknown> = {
      user_id: user.id,
      session_id: session_id ?? null,
      date: today,
      training_type: training_type || module || null,
      training_source: VALID_SOURCES.includes(training_source) ? training_source : 'coach_plan',
      completed: completed ?? false,
      actual_duration: actual_duration ?? null,
      rating: rating ?? null,
      notes: notes ?? null,
      perceived_effort: perceived_effort ?? null,
      fatigue_after: fatigue_after ?? null,
      soreness: soreness ?? null,
      completed_at: new Date().toISOString(),
    }

    if (rowing_technique_rating !== undefined) insertData.rowing_technique_rating = rowing_technique_rating
    if (rowing_pacing_rating !== undefined) insertData.rowing_pacing_rating = rowing_pacing_rating
    if (rowing_fatigue_rating !== undefined) insertData.rowing_fatigue_rating = rowing_fatigue_rating
    if (running_technique_rating !== undefined) insertData.running_technique_rating = running_technique_rating
    if (running_pacing_rating !== undefined) insertData.running_pacing_rating = running_pacing_rating
    if (running_fatigue_rating !== undefined) insertData.running_fatigue_rating = running_fatigue_rating
    if (running_rpe_rating !== undefined) insertData.running_rpe_rating = running_rpe_rating
    if (cycling_technique_rating !== undefined) insertData.cycling_technique_rating = cycling_technique_rating
    if (cycling_pacing_rating !== undefined) insertData.cycling_pacing_rating = cycling_pacing_rating
    if (cycling_fatigue_rating !== undefined) insertData.cycling_fatigue_rating = cycling_fatigue_rating
    if (cycling_rpe_rating !== undefined) insertData.cycling_rpe_rating = cycling_rpe_rating

    const { data: result, error } = await supabase
      .from('training_results')
      .insert(insertData)
      .select()
      .single()

    if (error) throw error

    // v2.4.278 (Activity Bridge, Final Architecture v1.0 — gebruiker
    // 5 augustus 2026): voor activiteitssporten (Running/Cycling/
    // Rowing/Walking/Swimming) die hier binnenkomen ZONDER externe
    // bron (bijv. via Trainer AI, geen Garmin-horloge om), alsnog een
    // activity_session laten ontstaan — zodat Performance Platform/
    // Workout Matching deze training niet missen. Strength/Kettlebell/
    // Bodyweight/etc. worden door de Bridge zelf overgeslagen
    // (training_results blijft voor hen de enige waarheid). Bewust in
    // try/catch — een fout hier mag de evaluatie-opslag zelf nooit
    // laten falen.
    if (result?.id) {
      try {
        await overwegActiviteitUitTrainingResultaat({
          trainingResultId: result.id,
          userId: user.id,
          trainingType: training_type || module || null,
          actualDuration: actual_duration ?? null,
          date: today,
        })
      } catch (bridgeErr) {
        console.error('[training/complete] Activity Bridge mislukt (evaluatie zelf blijft opgeslagen):', bridgeErr)
      }
    }

    // ── Stap 2: Exercise Records opslaan ────────────────────────────────────
    // Sla individuele oefeningen op voor progressietracking
    if (result?.id && segments && Array.isArray(segments) && segments.length > 0) {
      try {
        const moduleType = training_type || module || 'unknown'

        // Bepaal exercise_type op basis van module
        const exerciseTypeMap: Record<string, string> = {
          kettlebell: 'kettlebell',
          strength: 'strength',
          bodyweight: 'bodyweight',
          rowing: 'endurance',
          running: 'endurance',
          cycling: 'endurance',
          mobility: 'mobility',
        }
        const defaultExerciseType = exerciseTypeMap[moduleType] || 'general'

        const records = segments
          .filter((seg: Record<string, unknown>) => seg.exercise || seg.naam)
          .map((seg: Record<string, unknown>) => {
            const naam = (seg.exercise || seg.naam || '') as string
            // Genereer een consistente exercise_id van de naam
            const exerciseId = naam.toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '')

            // v2.4.52 FIX: was seg.weight_kg (= altijd het COACH-ADVIES,
            // ongewijzigd sinds v2.4.51 een apart actual_weight_kg-veld
            // toevoegde náást het bestaande weight_kg-veld). Hierdoor
            // registreerde de progressie-tracking van de coach altijd het
            // geadviseerde gewicht, nooit wat de gebruiker daadwerkelijk
            // gebruikte — ook niet bij een bewuste afwijking. Nu: gebruik
            // actual_weight_kg als dat aanwezig is (kettlebell-segmenten
            // sinds v2.4.51), val terug op het gewone weight_kg-veld voor
            // alle andere gevallen (ongewijzigd gedrag daar).
            const gebruiktGewicht = typeof seg.actual_weight_kg === 'number'
              ? seg.actual_weight_kg
              : (seg.weight_kg as number) || null
            const geadviseerdGewicht = typeof seg.advised_weight_kg === 'number'
              ? seg.advised_weight_kg
              : null
            // v2.4.53: tempo, exact hetzelfde patroon als gewicht hierboven
            const gebruiktTempo = typeof seg.actual_tempo === 'string'
              ? seg.actual_tempo
              : (typeof seg.tempo === 'string' ? seg.tempo : null)
            const geadviseerdTempo = typeof seg.advised_tempo === 'string'
              ? seg.advised_tempo
              : null

            return {
              user_id: user.id,
              training_result_id: result.id,
              exercise_id: exerciseId,
              exercise_name: naam,
              exercise_type: (seg.type as string) || defaultExerciseType,
              module: moduleType,
              weight_kg: gebruiktGewicht,
              advised_weight_kg: geadviseerdGewicht,
              tempo: gebruiktTempo,
              advised_tempo: geadviseerdTempo,
              reps: typeof seg.reps === 'number' ? seg.reps : null,
              duration_sec: typeof seg.duration_sec === 'number' ? seg.duration_sec : null,
              distance_m: typeof seg.distance_m === 'number' ? seg.distance_m : null,
              sets: typeof seg.sets === 'number' ? seg.sets : null,
              rpe: typeof perceived_effort === 'number' ? perceived_effort : null,
              performed_at: new Date().toISOString(),
            }
          })

        if (records.length > 0) {
          const { error: exErr } = await supabase.from('exercise_records').insert(records)
          if (exErr) {
            console.error('[training/complete] exercise_records opslaan mislukt:', exErr)
          }
        }
      } catch (exErr) {
        console.error('[training/complete] exercise_records opslaan mislukt:', exErr)
      }
    }

    // ── Stap 3: Coach Call aanmaken bij elke bibliotheek-training ───────────
    if (training_source === 'library' && result?.id) {
      try {
        // v2.4.290 (Coach Decision Engine, Fase 3 — Bibliotheek):
        // vervangt de oude, onvoorwaardelijke aanmaak + de handmatige
        // "bestaat de call al, is dit item al toegevoegd"-check —
        // schrijfCoachCallItem() doet die idempotency-check nu zelf al
        // (zelfde patroon als Concept2/Garmin TCX). Sport-sleutel
        // (training_type || module) matcht al de sleutels die
        // training_plans.sport gebruikt voor Rowing/Running/Cycling —
        // geen aparte mapping nodig. Voor Strength/Kettlebell/
        // Bodyweight bestaat per ontwerp geen Training Plan Engine, dus
        // evalueerCoachCallBehoefte geeft daar altijd geen_actief_plan/
        // nodig:true terug (v2.4.290-FIX) — behoudt exact het oude
        // "altijd vragen"-gedrag voor die sporten, geen regressie.
        const sportSleutel = training_type || module || ''
        const behoefte = await evalueerCoachCallBehoefte(supabase, user.id, sportSleutel, today, actual_duration ?? 0)

        if (behoefte.nodig) {
          const sportLabel: Record<string, string> = {
            kettlebell: 'Kettlebell',
            rowing: 'Roeien',
            running: 'Hardlopen',
            cycling: 'Fietsen',
            strength: 'Kracht',
            bodyweight: 'Bodyweight',
          }
          await schrijfCoachCallItem(supabase, user.id, today, {
            trainingResultId: result.id,
            sportNaam: sportLabel[sportSleutel] || sportSleutel || 'Training',
            afstandM: null,
            duurMin: actual_duration ?? null,
            redenType: behoefte.type,
            reden: behoefte.reden,
          })
        }
      } catch (coachCallErr) {
        console.error('[training/complete] Coach Decision Engine mislukt:', coachCallErr)
      }
    }

    return NextResponse.json({ success: true, result })
  } catch (err) {
    console.error('[training/complete]', err)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
