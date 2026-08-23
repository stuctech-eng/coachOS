export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { bepaalKettlebellRecords } from '@/lib/specialists/kettlebell-records'

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

// ── Records — MVP2 ───────────────────────────────────────────────────────
// Let op: dit is een NIEUWE route, los van de al bestaande (v2.4.352)
// api/specialists/kettlebell/records/route.ts — die leest de officiële
// WKSF-recordtabel (kettlebell_records, leeg). Deze route hier levert de
// Records Engine (Personal/Competition/Season Best). Bewust twee aparte
// routes/eindpunten: officiële federatierecords en persoonlijke records
// zijn conceptueel andere dingen (spec-eis: nooit vermengen).

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const resultaat = await bepaalKettlebellRecords(user.id)
    return NextResponse.json(resultaat)
  } catch (err) {
    console.error('[kettlebell/persoonlijke-records GET]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}
