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

const QUALIFYING_THRESHOLDS: Record<string, number> = {
  Hardlopen: 5000,
  Fietsen: 20000,
  Roeien: 5000,
}
const MIN_DURATION_MIN = 45

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json(null, { status: 401 })

    const supabase = createAdminClient()
    const now = new Date()
    const vandaag = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
    const gisteren = new Date(now.getTime() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })

    const { data: calls } = await supabase
      .from('coach_calls')
      .select('*, coach_call_items(*)')
      .eq('user_id', user.id)
      .in('date', [vandaag, gisteren])
      .in('status', ['pending', 'partial'])
      .order('date', { ascending: false })
      .limit(1)

    if (!calls || calls.length === 0) return NextResponse.json(null)

    const call = calls[0]

    // Expiry check: 24u na aanmaken
    if (now.getTime() - new Date(call.created_at).getTime() > 24 * 60 * 60 * 1000) {
      await supabase.from('coach_calls').update({ status: 'expired' }).eq('id', call.id)
      return NextResponse.json(null)
    }

    const pendingCount = (call.coach_call_items || []).filter((i: { status: string }) => i.status === 'pending').length

    return NextResponse.json({ ...call, pending_count: pendingCount })
  } catch (err) {
    console.error('[coach-calls GET]', err)
    return NextResponse.json(null)
  }
}

export async function POST(_req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()
    const now = new Date()
    const vandaag = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
    const gisteren = new Date(now.getTime() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })

    const { data: sessions } = await supabase
      .from('activity_sessions')
      .select('id, date, duration, metrics, activities(name)')
      .eq('user_id', user.id)
      .eq('source', 'strava')
      .in('date', [vandaag, gisteren])

    if (!sessions || sessions.length === 0) return NextResponse.json({ created: false, reason: 'no_activities' })

    const qualifying = sessions.filter(s => {
      const sportName = (s.activities as { name?: string } | null)?.name || ''
      const threshold = QUALIFYING_THRESHOLDS[sportName]
      if (!threshold) return false
      const distance = (s.metrics as Record<string, number>)?.distance || 0
      return s.duration >= MIN_DURATION_MIN && distance >= threshold
    })

    if (qualifying.length === 0) return NextResponse.json({ created: false, reason: 'below_threshold' })

    const byDate: Record<string, typeof qualifying> = {}
    for (const s of qualifying) {
      if (!byDate[s.date]) byDate[s.date] = []
      byDate[s.date].push(s)
    }

    let created = 0
    let updated = 0

    for (const [date, activities] of Object.entries(byDate)) {
      // Idempotency: select first, insert only if missing
      const { data: existing } = await supabase
        .from('coach_calls')
        .select('id, coach_call_items(activity_session_id)')
        .eq('user_id', user.id)
        .eq('date', date)
        .single()

      if (existing) {
        const existingIds = new Set(
          (existing.coach_call_items as { activity_session_id: string }[] || []).map(i => i.activity_session_id)
        )
        const newActivities = activities.filter(a => !existingIds.has(a.id))
        if (newActivities.length > 0) {
          await supabase.from('coach_call_items').insert(
            newActivities.map(a => ({
              coach_call_id: existing.id,
              activity_session_id: a.id,
              sport_type: (a.activities as { name?: string } | null)?.name || 'Onbekend',
              distance_m: (a.metrics as Record<string, number>)?.distance || null,
              duration_min: a.duration,
              status: 'pending',
            }))
          )
          updated++
        }
        continue
      }

      const { data: newCall } = await supabase
        .from('coach_calls')
        .insert({ user_id: user.id, date, status: 'pending' })
        .select('id')
        .single()

      if (newCall) {
        await supabase.from('coach_call_items').insert(
          activities.map(a => ({
            coach_call_id: newCall.id,
            activity_session_id: a.id,
            sport_type: (a.activities as { name?: string } | null)?.name || 'Onbekend',
            distance_m: (a.metrics as Record<string, number>)?.distance || null,
            duration_min: a.duration,
            status: 'pending',
          }))
        )
        created++
      }
    }

    return NextResponse.json({ created, updated })
  } catch (err) {
    console.error('[coach-calls POST]', err)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
