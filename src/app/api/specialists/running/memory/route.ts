export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { verwerkKandidaatInzicht, haalMemoryOp } from '@/lib/specialists/learning-engine'

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

// ── Memory Engine, sub-stap 2 — testbare route ──────────────────────────
// GET: huidige Memory-staat voor cycling (alle statussen, gesorteerd op
// confidence). POST: dien handmatig een kandidaat-inzicht in — TIJDELIJK,
// totdat sub-stap 3 de Coach Layer koppelt zodat de AI dit automatisch
// doet. Nu puur om de Learning Engine zelf te kunnen testen.

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const memory = await haalMemoryOp(user.id, 'running')
    return NextResponse.json({ memory })
  } catch (err) {
    console.error('[specialists/running/memory GET]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body = await req.json()
    const { insight, category, knowledge_type } = body

    if (!insight || !category || !knowledge_type) {
      return NextResponse.json({ error: 'insight, category en knowledge_type zijn verplicht' }, { status: 400 })
    }
    if (knowledge_type !== 'hard' && knowledge_type !== 'soft') {
      return NextResponse.json({ error: "knowledge_type moet 'hard' of 'soft' zijn" }, { status: 400 })
    }

    const resultaat = await verwerkKandidaatInzicht(user.id, {
      specialist_type: 'running',
      knowledge_type,
      insight,
      category,
    })

    return NextResponse.json(resultaat)
  } catch (err) {
    console.error('[specialists/running/memory POST]', err)
    return NextResponse.json({ error: 'Verwerken mislukt' }, { status: 500 })
  }
}
