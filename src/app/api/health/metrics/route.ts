export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
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

    // Laatste 14 dagen
    const veertienDagenGeleden = new Date()
    veertienDagenGeleden.setDate(veertienDagenGeleden.getDate() - 14)
    const vanDatum = veertienDagenGeleden.toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('health_metrics')
      .select('date, resting_hr, hrv, steps, sleep_duration, weight, calories_burned, vo2max')
      .eq('user_id', user.id)
      .gte('date', vanDatum)
      .order('date', { ascending: true })

    if (error) throw error

    return NextResponse.json({ metrics: data || [] })
  } catch (error) {
    console.error('Health metrics fout:', error)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}
