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
    const injuryId = searchParams.get('injury_id')
    if (!injuryId) return NextResponse.json({ error: 'injury_id verplicht' }, { status: 400 })
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('injury_updates')
      .select('*')
      .eq('injury_id', injuryId)
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
    if (!body.injury_id) return NextResponse.json({ error: 'injury_id verplicht' }, { status: 400 })
    const supabase = createAdminClient()

    // Sla update op
    const { data, error } = await supabase
      .from('injury_updates')
      .insert({
        injury_id: body.injury_id,
        user_id: user.id,
        pain_score: body.pain_score,
        notes: body.notes || null,
      })
      .select()
      .single()

    if (error) throw error

    // Update ook de hoofdblessure pain_score
    await supabase
      .from('injuries')
      .update({ pain_score: body.pain_score })
      .eq('id', body.injury_id)
      .eq('user_id', user.id)

    return NextResponse.json({ update: data })
  } catch (error) {
    console.error('Injury update error:', error)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }
}
