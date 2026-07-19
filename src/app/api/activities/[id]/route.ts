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

// v2.4.41: nieuwe route voor de activiteit-detailpagina (/activities/[id]),
// nodig om de route/kaart en volledige metrics van één activiteit te tonen
// zonder de hele lijst (limit 100) opnieuw op te halen.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()
    const { data: session, error } = await supabase
      .from('activity_sessions')
      .select(`*, activities ( id, name )`)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (error || !session) {
      return NextResponse.json({ error: 'Activiteit niet gevonden' }, { status: 404 })
    }

    return NextResponse.json({ session })
  } catch (error) {
    console.error('Activiteit ophalen fout:', error)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}

// v2.4.112: activiteit wissen — op verzoek, na een importfout (verkeerde
// datum, zie de bijbehorende fix in garmin-activity-tcx/route.ts) die
// geen andere manier had om te herstellen dan opnieuw beginnen.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()

    // Eerst bevestigen dat de activiteit bestaat én van deze gebruiker
    // is, vóór het verwijderen — voorkomt dat iemand een andere
    // gebruiker's activiteit-id kan raden en wissen
    const { data: bestaand } = await supabase
      .from('activity_sessions')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!bestaand) {
      return NextResponse.json({ error: 'Activiteit niet gevonden' }, { status: 404 })
    }

    // v2.4.112: gekoppelde coach_call_items eerst opruimen — voorkomt een
    // mogelijke foreign-key-fout bij het verwijderen van de activiteit
    // zelf, ongeacht hoe die koppeling in het schema is ingesteld
    try {
      await supabase.from('coach_call_items').delete().eq('activity_session_id', params.id)
    } catch (linkErr) {
      console.error('[activities DELETE] Opruimen coach_call_items mislukt (gaat door):', linkErr)
    }

    const { error } = await supabase
      .from('activity_sessions')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Activiteit wissen fout:', error)
    return NextResponse.json({ error: 'Wissen mislukt' }, { status: 500 })
  }
}
