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
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('injuries')
      .select('*')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
    return NextResponse.json({ injuries: data || [] })
  } catch {
    return NextResponse.json({ injuries: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const body = await req.json()
    if (!body.body_part) return NextResponse.json({ error: 'Lichaamsdeel verplicht' }, { status: 400 })
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('injuries')
      .insert({
        user_id: user.id,
        body_part: body.body_part,
        pain_score: body.pain_score || null,
        started_at: body.started_at || new Date().toISOString().split('T')[0],
        notes: body.notes || null,
        active: true,
      })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ injury: data })
  } catch (error) {
    console.error('Injury POST error:', error)
    return NextResponse.json({ error: 'Toevoegen mislukt' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const body = await req.json()
    if (!body.id) return NextResponse.json({ error: 'ID verplicht' }, { status: 400 })
    const supabase = createAdminClient()
    const update: Record<string, unknown> = {}
    if (body.active !== undefined) update.active = body.active
    if (body.pain_score !== undefined) update.pain_score = body.pain_score
    if (body.notes !== undefined) update.notes = body.notes
    const { error } = await supabase
      .from('injuries')
      .update(update)
      .eq('id', body.id)
      .eq('user_id', user.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Injury PATCH error:', error)
    return NextResponse.json({ error: 'Updaten mislukt' }, { status: 500 })
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
    const { error } = await supabase
      .from('injuries')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Injury DELETE error:', error)
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 })
  }
}
