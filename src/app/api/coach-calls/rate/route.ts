export const dynamic = 'force-dynamic'

// POST — sla rating op voor één of meerdere coach_call_items
// Herberekent coach_call.status (pending/partial/completed)

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

// Body: { ratings: [{ item_id, rating }], coach_call_id }
export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const { ratings, coach_call_id } = await req.json() as {
      ratings: { item_id: string; rating: number }[]
      coach_call_id: string
    }

    if (!ratings?.length || !coach_call_id) {
      return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Valideer dat coach_call van deze user is
    const { data: call } = await supabase
      .from('coach_calls')
      .select('id')
      .eq('id', coach_call_id)
      .eq('user_id', user.id)
      .single()

    if (!call) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    // Update elk item
    for (const { item_id, rating } of ratings) {
      await supabase.from('coach_call_items')
        .update({ rating, status: 'done', updated_at: new Date().toISOString() })
        .eq('id', item_id)
        .eq('coach_call_id', coach_call_id)
    }

    // Herbereken call status (status-machine)
    const { data: allItems } = await supabase
      .from('coach_call_items')
      .select('status')
      .eq('coach_call_id', coach_call_id)

    const total = allItems?.length || 0
    const done = allItems?.filter(i => i.status === 'done').length || 0

    let newStatus: string
    let completedAt: string | null = null
    if (done === 0) newStatus = 'pending'
    else if (done < total) newStatus = 'partial'
    else { newStatus = 'completed'; completedAt = new Date().toISOString() }

    await supabase.from('coach_calls').update({
      status: newStatus,
      ...(completedAt ? { completed_at: completedAt } : {}),
    }).eq('id', coach_call_id)

    return NextResponse.json({ status: newStatus, done, total })
  } catch (err) {
    console.error('[coach-calls/rate]', err)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
