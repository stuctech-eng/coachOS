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

    // v2.4.113: FIX — "Wissen mislukt" bleek te komen door een tweede,
    // gemiste foreign-key: garmin_activity_imports.activity_session_id
    // verwijst ook naar activity_sessions (zie garmin-activity-tcx/
    // route.ts, waar dit veld wordt gezet bij een bevestigde import).
    // coach_call_items alleen opruimen (v2.4.112) was niet genoeg.
    // Nu: beide gekoppelde tabellen opgeruimd vóór het wissen zelf.
    // v2.4.114: FIX — het wissen van coach_call_items (v2.4.112) kon een
    // Coach Call volledig leeg achterlaten. De Coach Call-pagina toont dan
    // niets om op te reageren (call.coach_call_items.every() op een lege
    // lijst is vacuously true), wat aanvoelde als "kan niet meer
    // reageren" — geen crash, maar een verwarrende lege staat. Nu: eerst
    // de gekoppelde coach_call_id('s) vastleggen, en als een Coach Call
    // daardoor leeg wordt, die op 'expired' zetten (dezelfde status die
    // elders al gebruikt wordt voor niet-meer-relevante Coach Calls, zie
    // coach-calls/route.ts).
    let betrokkenCallIds: string[] = []
    try {
      const { data: teVerwijderenItems } = await supabase
        .from('coach_call_items')
        .select('coach_call_id')
        .eq('activity_session_id', params.id)
      betrokkenCallIds = [...new Set((teVerwijderenItems || []).map(i => i.coach_call_id))]
    } catch (linkErr) {
      console.error('[activities DELETE] Ophalen coach_call_id vóór wissen mislukt:', linkErr)
    }

    try {
      await supabase.from('coach_call_items').delete().eq('activity_session_id', params.id)
    } catch (linkErr) {
      console.error('[activities DELETE] Opruimen coach_call_items mislukt (gaat door):', linkErr)
    }

    for (const callId of betrokkenCallIds) {
      try {
        const { count } = await supabase
          .from('coach_call_items')
          .select('id', { count: 'exact', head: true })
          .eq('coach_call_id', callId)
        if (!count || count === 0) {
          await supabase.from('coach_calls').update({ status: 'expired' }).eq('id', callId)
        }
      } catch (callErr) {
        console.error('[activities DELETE] Opruimen lege coach_call mislukt (gaat door):', callErr)
      }
    }
    try {
      // Import-record zelf niet wissen (historische waarde: wanneer/
      // hoe geïmporteerd), alleen de verwijzing naar de nu-te-wissen
      // activiteit loskoppelen
      await supabase.from('garmin_activity_imports').update({ activity_session_id: null }).eq('activity_session_id', params.id)
    } catch (linkErr) {
      console.error('[activities DELETE] Loskoppelen garmin_activity_imports mislukt (gaat door):', linkErr)
    }

    const { error } = await supabase
      .from('activity_sessions')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (error) {
      // v2.4.113: foutdetail nu wél teruggegeven — "Wissen mislukt"
      // zonder reden was niet te diagnosticeren zonder serverlogs
      console.error('[activities DELETE] Database-fout:', error)
      return NextResponse.json({ error: `Wissen mislukt: ${error.message || error.code || 'onbekende databasefout'}` }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Activiteit wissen fout:', error)
    return NextResponse.json({ error: `Wissen mislukt: ${(error as Error).message || 'onbekende fout'}` }, { status: 500 })
  }
}
