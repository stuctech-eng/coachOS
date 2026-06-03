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

export async function GET(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const goalId = searchParams.get('goal_id')
    if (!goalId) return NextResponse.json({ error: 'goal_id verplicht' }, { status: 400 })
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('goal_updates')
      .select('*')
      .eq('goal_id', goalId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    return NextResponse.json({ updates: data || [] })
  } catch {
    return NextResponse.json({ updates: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const body = await req.json()
    if (!body.goal_id) return NextResponse.json({ error: 'goal_id verplicht' }, { status: 400 })
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('goal_updates')
      .insert({
        goal_id: body.goal_id,
        user_id: user.id,
        current_value: body.current_value,
        notes: body.notes || null,
      })
      .select()
      .single()

    if (error) throw error

    // Update ook het doel zelf
    await supabase
      .from('user_goals')
      .update({ current_value: body.current_value })
      .eq('id', body.goal_id)
      .eq('user_id', user.id)

    return NextResponse.json({ update: data })
  } catch (error) {
    console.error('Goal update error:', error)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }
}
