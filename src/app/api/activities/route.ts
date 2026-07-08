export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
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

// v2.4.40: POST (Garmin GPX/TCX import) volledig verwijderd. Was een
// oudere, kapotte importweg — de regex-based TCX-parser las met
// `content.match(/<TotalTimeSeconds>.../)` alleen de EERSTE match in het
// hele bestand, dus bij een activiteit met meerdere laps (bijna elk
// TCX-bestand) werd alleen lap 1 gebruikt in plaats van het totaal. Ook
// ontbrak een Coach Call-trigger, dus activiteiten via deze weg telden
// nooit mee in de herstelberekening. Vervangen door de geteste flow op
// /settings/garmin-activity-import (client-side TCX-parsing incl.
// meerdere laps, zie v2.4.25/35, plus altijd een Coach Call, v2.4.23).
// GET blijft ongewijzigd — wordt nog gebruikt om de activiteitenlijst
// op /activities te laden.

// GET — haal alle activiteit sessies op
export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()

    const { data: sessions, error } = await supabase
      .from('activity_sessions')
      .select(`
        *,
        activities (
          id,
          name
        )
      `)
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(100)

    if (error) throw error

    return NextResponse.json({ sessions: sessions || [] })
  } catch (error) {
    console.error('Activiteiten ophalen fout:', error)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}
