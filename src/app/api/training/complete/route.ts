export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

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

async function withRetry<F extends () => PromiseLike<{ data: unknown; error: unknown }>>(
  fn: F,
  label: string
): Promise<Awaited<ReturnType<F>>> {
  const attempt = async () => {
    const result = await fn() as Awaited<ReturnType<F>>
    if (result.error) {
      const e = result.error as { code?: string; message?: string; details?: string; hint?: string }
      throw new Error(
        `${label} FOUT — code: ${e.code || '?'}, message: ${e.message || '?'}, details: ${e.details || '?'}, hint: ${e.hint || '?'}`
      )
    }
    return result
  }

  try {
    return await attempt()
  } catch (err) {
    console.error(`[training/complete] ${label} eerste poging mislukt, retry over 400ms:`, err)
    await new Promise(resolve => setTimeout(resolve, 400))
    return await attempt()
  }
}

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

            return {
              user_id: user.id,
              training_result_id: result.id,
              exercise_id: exerciseId,
              exercise_name: naam,
              exercise_type: (seg.type as string) || defaultExerciseType,
              module: moduleType,
              weight_kg: gebruiktGewicht,
              advised_weight_kg: geadviseerdGewicht,
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
        const existingResult = await withRetry(
          () => supabase
            .from('coach_calls')
            .select('id, status, coach_call_items(training_result_id)')
            .eq('user_id', user.id)
            .eq('date', today)
            .single(),
          'coach_calls select'
        )
        const existing = existingResult.data as { id: string; status: string; coach_call_items: { training_result_id: string }[] } | null

        const alreadyAdded = (existing?.coach_call_items || [])
          .some(i => i.training_result_id === result.id)

        if (!alreadyAdded) {
          let callId = existing?.id

          if (!callId) {
            const newCallResult = await withRetry(
              () => supabase
                .from('coach_calls')
                .insert({ user_id: user.id, date: today, status: 'pending' })
                .select('id')
                .single(),
              'coach_calls insert'
            )
            callId = (newCallResult.data as { id: string } | null)?.id
          }

          if (callId) {
            const sportLabel: Record<string, string> = {
              kettlebell: 'Kettlebell',
              rowing: 'Roeien',
              running: 'Hardlopen',
              cycling: 'Fietsen',
              strength: 'Kracht',
              bodyweight: 'Bodyweight',
            }
            await withRetry(
              () => supabase.from('coach_call_items').insert({
                coach_call_id: callId,
                training_result_id: result.id,
                sport_type: sportLabel[training_type || module] || training_type || module || 'Training',
                duration_min: actual_duration ?? null,
                status: 'pending',
              }),
              'coach_call_items insert'
            )

            if (existing && (existing.status === 'completed' || existing.status === 'expired')) {
              await withRetry(
                () => supabase.from('coach_calls')
                  .update({ status: 'pending', completed_at: null })
                  .eq('id', callId),
                'coach_calls heropenen'
              )
            }
          }
        }
      } catch (coachCallErr) {
        console.error('[training/complete] coach_call aanmaken mislukt (na retry):', coachCallErr)
      }
    }

    return NextResponse.json({ success: true, result })
  } catch (err) {
    console.error('[training/complete]', err)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
