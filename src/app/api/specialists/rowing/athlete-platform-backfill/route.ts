export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { legeAthleteState, slaAthleteStateOp } from '@/core/athlete-platform/storage'
import { pasImpactToe, MINIMUM_SESSIE_DUUR_MINUTEN } from '@/core/athlete-platform/impact-engine'
import { vertaalRowingSessieNaarImpact } from '@/lib/specialists/rowing-impact-adapter'

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

// v2.4.245 (Universal Athlete Platform — eenmalige terugvul-actie):
// gemeld: sessies die vóór de Impact Engine-koppeling (v2.4.238) al
// geïmporteerd waren, hebben de Universal Athlete State nooit gevuld —
// nieuwe sync-runs zien ze als "al bekend" en doen dan niets.
//
// Deze route verwerkt bestaande Concept2-sessies ALSNOG, chronologisch
// (oud naar nieuw), zodat de staat evolueert zoals 'ie zou hebben
// gedaan als de koppeling er vanaf het begin al was geweest — de
// meest recente sessies wegen het zwaarst mee (exponentieel
// voortschrijdend gemiddelde, zelfde model als de live-koppeling).
// Draait bovenop de v2.4.245-confidence-fix — met veel sessies bouwt
// de confidence nu ook daadwerkelijk op, niet alleen de ruwe waarde.
// Bewust een EENMALIGE actie (POST, door de gebruiker zelf getriggerd),
// geen automatische achtergrondtaak — dit hoeft maar één keer.
export async function POST() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()
    const { data: sessies, error } = await supabase
      .from('activity_sessions')
      .select('date, duration')
      .eq('user_id', user.id)
      .eq('source', 'concept2')
      .order('date', { ascending: true })

    if (error) throw error
    if (!sessies || sessies.length === 0) {
      return NextResponse.json({ verwerkt: 0, boodschap: 'Geen Concept2-sessies gevonden om terug te vullen.' })
    }

    let state = legeAthleteState(user.id)
    let overgeslagen = 0
    for (const sessie of sessies) {
      // v2.4.246-FIX: zelfde drempel als de live-koppeling — anders
      // zou de terugvul-functie ruis (bijv. een 1-minuut-testsessie)
      // alsnog meenemen terwijl nieuwe syncs die al negeren
      if (sessie.duration < MINIMUM_SESSIE_DUUR_MINUTEN) { overgeslagen++; continue }
      const bijdragen = vertaalRowingSessieNaarImpact(sessie.duration)
      state = pasImpactToe(state, bijdragen)
    }

    await slaAthleteStateOp(supabase, user.id, state)

    const verwerkt = sessies.length - overgeslagen
    return NextResponse.json({
      verwerkt, overgeslagen,
      boodschap: `${verwerkt} sessies verwerkt${overgeslagen > 0 ? `, ${overgeslagen} overgeslagen (korter dan ${MINIMUM_SESSIE_DUUR_MINUTEN} min)` : ''}.`,
    })
  } catch (err) {
    console.error('[rowing/athlete-platform-backfill]', err)
    return NextResponse.json({ error: 'Terugvullen mislukt' }, { status: 500 })
  }
}
