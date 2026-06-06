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
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()
    const { session_id, completed, duration_minutes, rating, notes } = await req.json()

    if (!session_id) return NextResponse.json({ error: 'session_id verplicht' }, { status: 400 })

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })

    // Update sessie status
    await supabase
      .from('training_sessions')
      .update({ status: completed ? 'completed' : 'skipped' })
      .eq('id', session_id)
      .eq('user_id', user.id)

    // Sla resultaat op
    const { data: result, error } = await supabase
      .from('training_results')
      .insert({
        user_id: user.id,
        session_id,
        date: today,
        completed: completed ?? false,
        actual_duration: duration_minutes ?? null,
        rating: rating ?? null,
        notes: notes ?? null,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, result })
  } catch (err) {
    console.error('[training/complete]', err)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
