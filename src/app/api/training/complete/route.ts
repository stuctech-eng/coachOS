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
      // Rowing-specifiek (optioneel, alleen bij module === 'rowing')
      rowing_technique_rating,
      rowing_pacing_rating,
      rowing_fatigue_rating,
      // Running-specifiek (optioneel, alleen bij module === 'running')
      running_technique_rating,
      running_pacing_rating,
      running_fatigue_rating,
      running_rpe_rating,
      // Cycling-specifiek (optioneel, alleen bij module === 'cycling')
      cycling_technique_rating,
      cycling_pacing_rating,
      cycling_fatigue_rating,
      cycling_rpe_rating,
    } = body

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })

    // Update sessie status indien session_id meegegeven (oude flow)
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

    // Rowing-specifieke velden alleen toevoegen indien aanwezig
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

    return NextResponse.json({ success: true, result })
  } catch (err) {
    console.error('[training/complete]', err)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
