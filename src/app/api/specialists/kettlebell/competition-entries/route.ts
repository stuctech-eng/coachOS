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

// ── Competition Entries — MVP2 ───────────────────────────────────────────
// Persoonlijke wedstrijddeelname/-voorbereiding (spec §24-25). Bewust
// GESCHEIDEN van kettlebell_gs_sessions (training) en van
// kettlebell_classifications (norm) — een wedstrijdresultaat is geen
// classificatienorm (expliciete eis van de gebruiker, §5/§14).
// federation_id is hier verplicht (NOT NULL in het schema), net als bij
// elke wedstrijdlogica-tabel.

interface NieuweEntryBody {
  competition_id: string
  federation_id: string
  discipline: string
  target_class?: string
  target_reps?: number
}

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('kettlebell_competition_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ deelnames: data || [] })
  } catch (err) {
    console.error('[kettlebell/competition-entries GET]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body = await req.json() as NieuweEntryBody
    if (!body.competition_id || !body.federation_id || !body.discipline) {
      return NextResponse.json({ error: 'competition_id, federation_id en discipline zijn verplicht' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('kettlebell_competition_entries')
      .insert({
        user_id: user.id,
        competition_id: body.competition_id,
        federation_id: body.federation_id,
        discipline: body.discipline,
        target_class: body.target_class ?? null,
        target_reps: body.target_reps ?? null,
        status: 'planned',
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, deelname: data })
  } catch (err) {
    console.error('[kettlebell/competition-entries POST]', err)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }
}
