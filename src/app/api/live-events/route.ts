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

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ events: [] })
    const supabase = createAdminClient()

    const veertien = new Date()
    veertien.setDate(veertien.getDate() - 14)

    const { data } = await supabase
      .from('life_events')
      .select('*')
      .eq('user_id', user.id)
      .gte('start_time', veertien.toISOString())
      .order('start_time', { ascending: false })

    return NextResponse.json({ events: data || [] })
  } catch {
    return NextResponse.json({ events: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const body = await req.json()
    if (!body.type) return NextResponse.json({ error: 'Type verplicht' }, { status: 400 })

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('life_events')
      .insert({
        user_id: user.id,
        type: body.type,
        start_time: body.start_time || new Date().toISOString(),
        end_time: body.end_time || null,
        recovery_impact: body.recovery_impact || 0,
        stress_load: body.stress_load || 0,
        sleep_disruption: body.sleep_disruption || 0,
        notes: body.notes || null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ event: data })
  } catch (error) {
    console.error('Life event POST error:', error)
    return NextResponse.json({ error: 'Toevoegen mislukt' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID verplicht' }, { status: 400 })
    const supabase = createAdminClient()
    await supabase.from('life_events').delete().eq('id', id).eq('user_id', user.id)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 })
  }
}
