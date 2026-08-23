export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { bepaalPaceCoach } from '@/lib/specialists/kettlebell-pace-coach'
import type { KettlebellDiscipline } from '@/lib/specialists/kettlebell-data'

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

    const url = new URL(req.url)
    const discipline = url.searchParams.get('discipline') as KettlebellDiscipline | null
    const bellWeightKg = url.searchParams.get('bell_weight_kg')

    if (!discipline || !bellWeightKg) {
      return NextResponse.json({ error: 'discipline en bell_weight_kg zijn verplicht' }, { status: 400 })
    }

    const resultaat = await bepaalPaceCoach(user.id, discipline, Number(bellWeightKg))
    return NextResponse.json(resultaat)
  } catch (err) {
    console.error('[kettlebell/pace-coach GET]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}
