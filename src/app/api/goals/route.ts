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

// GET — haal alle actieve doelen op
export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('user_goals')
      .select('*')
      .eq('user_id', user.id)
      .order('priority', { ascending: true })
    return NextResponse.json({ goals: data || [] })
  } catch (error) {
    console.error('Goals GET error:', error)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}

// POST — voeg nieuw doel toe
export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const body = await req.json()
    if (!body.title) return NextResponse.json({ error: 'Titel verplicht' }, { status: 400 })
    const supabase = createAdminClient()

    // Bepaal prioriteit
    const { data: existing } = await supabase
      .from('user_goals')
      .select('priority')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('priority', { ascending: false })
      .limit(1)
    const priority = ((existing?.[0]?.priority || 0) + 1)

    const { data, error } = await supabase
      .from('user_goals')
      .insert({
        user_id: user.id,
        goal_type: body.goal_type || 'custom',
        title: body.title,
        priority,
        status: 'active',
        target_date: body.target_date || null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ goal: data })
  } catch (error) {
    console.error('Goals POST error:', error)
    return NextResponse.json({ error: 'Toevoegen mislukt' }, { status: 500 })
  }
}

// PATCH — update doel status
export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const body = await req.json()
    if (!body.id) return NextResponse.json({ error: 'ID verplicht' }, { status: 400 })
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('user_goals')
      .update({ status: body.status || 'completed' })
      .eq('id', body.id)
      .eq('user_id', user.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Goals PATCH error:', error)
    return NextResponse.json({ error: 'Updaten mislukt' }, { status: 500 })
  }
}

// DELETE — verwijder doel
export async function DELETE(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID verplicht' }, { status: 400 })
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('user_goals')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Goals DELETE error:', error)
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 })
  }
}
