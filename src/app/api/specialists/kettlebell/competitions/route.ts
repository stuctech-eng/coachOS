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

// ── Competitions (referentiedata) — MVP2 ────────────────────────────────
// Leest kettlebell_competitions. GEEN officiële WKSF-wedstrijdkalender
// geïmporteerd (die bestaat niet als vrij toegankelijke, machineleesbare
// bron — zie eerdere bronaudits) — in plaats daarvan mag een gebruiker
// zelf een wedstrijd registreren waar hij/zij aan deelneemt/deelnam.
// Zelf-gerapporteerd, dus GEEN claim van officiële WKSF-erkenning; puur
// een organisatorisch anker voor kettlebell_competition_entries.

interface NieuweCompetitieBody {
  name: string
  federation_id: string
  event_date?: string
  location?: string
  discipline?: string
}

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('kettlebell_competitions')
      .select('id, name, event_date, location, federation_id, discipline')
      .order('event_date', { ascending: true })

    if (error) throw error
    return NextResponse.json({ competities: data || [] })
  } catch (err) {
    console.error('[kettlebell/competitions GET]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body = await req.json() as NieuweCompetitieBody
    if (!body.name || !body.federation_id) {
      return NextResponse.json({ error: 'name en federation_id zijn verplicht' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('kettlebell_competitions')
      .insert({
        name: body.name,
        federation_id: body.federation_id,
        event_date: body.event_date ?? null,
        location: body.location ?? null,
        discipline: body.discipline ?? null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, competitie: data })
  } catch (err) {
    console.error('[kettlebell/competitions POST]', err)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }
}
