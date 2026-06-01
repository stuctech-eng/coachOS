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
    if (!user) return NextResponse.json(null)
    const supabase = createAdminClient()
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('daily_checkins').select('*').eq('user_id', user.id).eq('date', today).single()
    return NextResponse.json(data || null)
  } catch {
    return NextResponse.json(null)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const body = await req.json()
    const supabase = createAdminClient()
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('daily_checkins')
      .upsert({
        user_id: user.id,
        date: today,
        feeling_score: body.feeling_score,
        energy_score: body.energy_score,
        has_pain: body.has_pain || false,
        pain_description: body.has_pain ? body.pain_description : null,
        notes: body.notes || null,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Check-in error:', error)
    return NextResponse.json({ error: 'Check-in opslaan mislukt' }, { status: 500 })
  }
}
