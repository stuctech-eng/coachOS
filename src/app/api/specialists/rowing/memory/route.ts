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

// v2.4.232 (Rowing Fase 2): dunne wrapper, exact het patroon van
// cycling/running/memory/route.ts — de Learning Engine zelf was al
// sport-onafhankelijk (specialist_type: string, geen hardcoded union),
// Rowing sluit gewoon aan zonder wijziging aan de Engine zelf.

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const memory = await haalMemoryOp(user.id, 'rowing')
    return NextResponse.json({ memory })
  } catch (err) {
    console.error('[specialists/rowing/memory GET]', err)
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
      specialist_type: 'rowing',
      knowledge_type,
      insight,
      category,
    })

    return NextResponse.json(resultaat)
  } catch (err) {
    console.error('[specialists/rowing/memory POST]', err)
    return NextResponse.json({ error: 'Verwerken mislukt' }, { status: 500 })
  }
}
