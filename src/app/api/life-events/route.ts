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

    // v2.4.173-FIX: was `.gte('start_time', 14 dagen geleden)` voor
    // ALLE events — een terugkerend event dat 3 maanden geleden werd
    // ingesteld verdween daardoor uit het overzicht, ook al is het nog
    // actief (recurrence wordt op dag-van-de-week beoordeeld, niet op
    // hoe lang geleden het is aangemaakt). Nu: terugkerende events
    // altijd meenemen, eenmalige events op een ruimere venster (90
    // dagen terug tot 90 dagen vooruit — dekt zowel recente als
    // toekomstig geplande vakanties).
    const negentigTerug = new Date(); negentigTerug.setDate(negentigTerug.getDate() - 90)
    const negentigVooruit = new Date(); negentigVooruit.setDate(negentigVooruit.getDate() + 90)

    const [eenmaligRes, herhalendRes] = await Promise.all([
      supabase.from('life_events').select('*').eq('user_id', user.id)
        .is('recurrence', null)
        .gte('start_time', negentigTerug.toISOString())
        .lte('start_time', negentigVooruit.toISOString())
        .order('start_time', { ascending: false }),
      supabase.from('life_events').select('*').eq('user_id', user.id)
        .not('recurrence', 'is', null)
        .order('start_time', { ascending: false }),
    ])

    const events = [...(eenmaligRes.data || []), ...(herhalendRes.data || [])]
    return NextResponse.json({ events })
  } catch {
    return NextResponse.json({ events: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const body = await req.json()
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('life_events')
      .insert({
        user_id: user.id,
        type: body.type,
        start_time: body.start_time,
        recovery_impact: body.recovery_impact ?? 1,
        stress_load: body.stress_load ?? 1,
        sleep_disruption: body.sleep_disruption ?? 1,
        start_hour: body.start_hour ?? null,
        end_hour: body.end_hour ?? null,
        recurrence: body.recurrence ?? null,
        recurrence_days: body.recurrence_days ?? null,
        recurrence_end_date: body.recurrence_end_date ?? null,
        end_date: body.end_date ?? null,
        vacation_type: body.vacation_type ?? null,
        notes: body.notes ?? null,
      })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ event: data })
  } catch (error) {
    console.error('Life events POST error:', error)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const body = await req.json()
    const supabase = createAdminClient()
    const updates: Record<string, unknown> = {}
    if (body.notes !== undefined) updates.notes = body.notes
    if (body.start_hour !== undefined) updates.start_hour = body.start_hour
    if (body.end_hour !== undefined) updates.end_hour = body.end_hour
    if (body.recurrence !== undefined) updates.recurrence = body.recurrence
    if (body.recurrence_days !== undefined) updates.recurrence_days = body.recurrence_days
    if (body.recurrence_end_date !== undefined) updates.recurrence_end_date = body.recurrence_end_date
    if (body.end_date !== undefined) updates.end_date = body.end_date
    if (body.vacation_type !== undefined) updates.vacation_type = body.vacation_type
    const { error } = await supabase
      .from('life_events')
      .update(updates)
      .eq('id', body.id)
      .eq('user_id', user.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Life events PATCH error:', error)
    return NextResponse.json({ error: 'Bijwerken mislukt' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Geen ID' }, { status: 400 })
    const supabase = createAdminClient()
    const { error } = await supabase.from('life_events').delete().eq('id', id).eq('user_id', user.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Life events DELETE error:', error)
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 })
  }
}
