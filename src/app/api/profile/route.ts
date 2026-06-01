import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { OnboardingData } from '@/types'

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
    const [profileRes, goalsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('user_goals').select('*').eq('user_id', user.id).eq('status', 'active').order('priority'),
    ])
    return NextResponse.json({ profile: profileRes.data, goals: goalsRes.data || [] })
  } catch (error) {
    console.error('Profile GET error:', error)
    return NextResponse.json({ error: 'Profiel ophalen mislukt' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const body: OnboardingData = await req.json()
    const supabase = createAdminClient()
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ first_name: body.first_name, display_name: body.first_name, age: body.age, gender: body.gender, available_time: body.available_time, onboarding_completed: true })
      .eq('user_id', user.id)
    if (profileError) throw profileError
    if (body.goals.length > 0) {
      await supabase.from('user_goals').insert(body.goals.map((g, i) => ({ user_id: user.id, goal_type: g, title: g, priority: i + 1, status: 'active' as const })))
    }
    if (body.activities.length > 0) {
      const { data: templates } = await supabase.from('activity_templates').select('id, name').in('name', body.activities)
      if (templates?.length) {
        await supabase.from('activities').insert(templates.map(t => ({ user_id: user.id, template_id: t.id, name: t.name })))
      }
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Profile POST error:', error)
    return NextResponse.json({ error: 'Profiel opslaan mislukt' }, { status: 500 })
  }
}
