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

    const body = await req.json()
    const supabase = createAdminClient()
    const today = new Date().toISOString().split('T')[0]

    const { data: session, error: sessionError } = await supabase
      .from('recovery_sessions')
      .insert({
        user_id: user.id,
        date: today,
        type: body.type,
        module: body.module,
        started_at: new Date(Date.now() - (body.duration || 0) * 60 * 1000).toISOString(),
        ended_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (sessionError) throw sessionError

    const { error: resultError } = await supabase
      .from('recovery_results')
      .insert({
        user_id: user.id,
        date: today,
        session_id: session.id,
        type: body.type,
        module: body.module,
        duration: body.duration || 0,
        completion_status: body.completion_status || 'completed',
        recovery_impact: body.recovery_impact || 'medium',
        notes: body.notes || null,
      })

    if (resultError) throw resultError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Recovery complete error:', error)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }
}
