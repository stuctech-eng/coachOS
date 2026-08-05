export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { overwegActiviteitUitTrainingResultaat } from '@/lib/activity-import/activity-bridge'

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

// ── Activity Bridge Debug Dashboard — API ────────────────────────────────
// Bron: v2.4.278 (Activity Bridge + Source Priority Policy). Zelfde
// opzet als debug/workout-matching: puur uitlezen + een handmatige
// test-trigger die exact dezelfde functie aanroept als productie
// (overwegActiviteitUitTrainingResultaat).
//
// Belangrijk verschil met debug/workout-matching: er is hier geen
// historische testdata (geen oude training_results om tegenaan te
// testen, zoals er wel oude Concept2-activiteiten waren). Deze debug-
// route roept de Bridge daarom aan met een SYNTHETISCH
// trainingResultId (`debug-<uuid>`), zonder een echte training_results-
// rij aan te maken — test dus specifiek de Bridge- en dedup-logica
// zelf, niet de (al bestaande, ongewijzigde) training_results-insert.
// Alle aangemaakte activity_sessions zijn herkenbaar aan
// `notes: training_result:debug-...` en alleen zulke rijen zijn via
// de reset-actie te verwijderen — een echte, productie-Bridge-rij
// (`training_result:<echt-uuid>`) kan hier nooit per ongeluk verdwijnen.

const ACTIVITEIT_NAMEN_ACTIVITEITSSPORTEN = ['Hardlopen', 'Fietsen', 'Roeien', 'Wandelen', 'Zwemmen']
const DEBUG_ID_PREFIX = 'debug-'

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()

    const vanaf = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const { data: activiteiten } = await supabase
      .from('activity_sessions')
      .select('id, date, duration, source, notes, activities!inner(name)')
      .eq('user_id', user.id)
      .in('activities.name', ACTIVITEIT_NAMEN_ACTIVITEITSSPORTEN)
      .gte('date', vanaf)
      .order('date', { ascending: false })
      .limit(30)

    return NextResponse.json({ activiteiten: activiteiten || [] })
  } catch (err) {
    console.error('[debug/activity-bridge GET]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()

    const body = await request.json().catch(() => null) as {
      actie?: 'test' | 'reset'
      trainingType?: string
      actualDuration?: number
      date?: string
      activiteitId?: string
    } | null
    const actie = body?.actie || 'test'

    if (actie === 'test') {
      if (!body?.trainingType || !body?.actualDuration) {
        return NextResponse.json({ error: 'trainingType en actualDuration zijn verplicht' }, { status: 400 })
      }
      const datum = body.date || new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
      const syntheticId = `${DEBUG_ID_PREFIX}${randomUUID()}`

      const resultaat = await overwegActiviteitUitTrainingResultaat({
        trainingResultId: syntheticId,
        userId: user.id,
        trainingType: body.trainingType,
        actualDuration: body.actualDuration,
        date: datum,
      })

      return NextResponse.json({ resultaat })
    }

    if (actie === 'reset') {
      if (!body?.activiteitId) return NextResponse.json({ error: 'activiteitId ontbreekt' }, { status: 400 })
      const { data: activiteit } = await supabase
        .from('activity_sessions')
        .select('id, user_id, source, notes')
        .eq('id', body.activiteitId).eq('user_id', user.id)
        .maybeSingle()

      if (!activiteit) return NextResponse.json({ error: 'Activiteit niet gevonden' }, { status: 404 })
      if (activiteit.source !== 'trainer_ai' || !activiteit.notes?.includes(`training_result:${DEBUG_ID_PREFIX}`)) {
        return NextResponse.json({ error: 'Deze activiteit is geen debug-testrij van de Activity Bridge — reset hier bewust geweigerd' }, { status: 400 })
      }

      await supabase.from('activity_sessions').delete().eq('id', activiteit.id)
      return NextResponse.json({ resultaat: { verwijderd: true } })
    }

    return NextResponse.json({ error: `Onbekende actie: ${actie}` }, { status: 400 })
  } catch (err) {
    console.error('[debug/activity-bridge POST]', err)
    return NextResponse.json({ error: 'Test mislukt' }, { status: 500 })
  }
}
