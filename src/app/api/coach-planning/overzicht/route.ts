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

// ── Coach Planning — Overzicht (Fase A, stap 3) ──────────────────────
// Bron: overleg 31 juli 2026. Intelligente samenvatting, geen kalender
// — "volgende vakantie, volgende wedstrijd, lopende Build Week,
// werkbelasting komende 14 dagen". Gebruikt UITSLUITEND bestaande
// databronnen (life_events, training_plan_sessions) — geen nieuwe
// tabel, zoals in de visie vastgelegd. Deze functie voedt straks ook
// de Home "Coach Vooruitblik"-kaart (Fase B) — één bron, geen dubbele
// logica.

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()

    const vandaag = new Date().toISOString().split('T')[0]
    const over14Dagen = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const over90Dagen = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const { data: actievePlannen } = await supabase
      .from('training_plans').select('id').eq('athlete_id', user.id).eq('status', 'active')
    const planIds = (actievePlannen || []).map(p => p.id)

    const [lifeEventsRes, sessiesRes] = await Promise.all([
      supabase.from('life_events').select('type, start_time, end_date, recurrence')
        .eq('user_id', user.id)
        .gte('start_time', new Date().toISOString())
        .lte('start_time', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString())
        .order('start_time'),
      planIds.length > 0
        ? supabase.from('training_plan_sessions').select('date, mesocycle_type, sport, type')
            .in('plan_id', planIds)
            .gte('date', vandaag)
            .lte('date', over90Dagen)
            .order('date')
        : Promise.resolve({ data: [] }),
    ])

    const lifeEvents = lifeEventsRes.data || []
    const sessies = sessiesRes.data || []

    // Volgende vakantie (eenmalig/periode-type, geen recurrence)
    const volgendeVakantie = lifeEvents.find(e => e.type === 'vakantie' && !e.recurrence)

    // Volgende wedstrijd/evenement
    const volgendEvenement = lifeEvents.find(e => (e.type === 'evenement' || e.type === 'testdag') && !e.recurrence)

    // Huidige en volgende mesocyclus-fase — alleen sessies mét een
    // ingevuld mesocycle_type meenemen (oudere plannen hebben dit nog
    // niet, v2.4.176-beperking, geen crash bij ontbrekende data)
    const sessiesMetFase = sessies.filter(s => s.mesocycle_type)
    const huidigeFase = sessiesMetFase.find(s => s.date === vandaag)?.mesocycle_type || null
    const volgendeFaseWissel = sessiesMetFase.find(s => s.mesocycle_type !== huidigeFase && s.date > vandaag)

    // Werkbelasting komende 14 dagen — telling van werk-categorie events
    const WERK_TYPES = ['nachtdienst', 'avonddienst', 'vroege_dienst', 'dagdienst', 'lange_dag', 'consignatie']
    const werkEventsKomende14Dagen = lifeEvents.filter(e =>
      WERK_TYPES.includes(e.type) && !e.recurrence && e.start_time.split('T')[0] <= over14Dagen
    ).length

    // Trainingsbelasting komende week — aantal geplande sessies
    const over7Dagen = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const trainingenKomendeWeek = sessies.filter(s => s.date <= over7Dagen).length

    return NextResponse.json({
      volgendeVakantie: volgendeVakantie ? { datum: volgendeVakantie.start_time.split('T')[0], eindDatum: volgendeVakantie.end_date } : null,
      volgendEvenement: volgendEvenement ? { datum: volgendEvenement.start_time.split('T')[0], type: volgendEvenement.type } : null,
      huidigeFase,
      volgendeFaseWissel: volgendeFaseWissel ? { datum: volgendeFaseWissel.date, fase: volgendeFaseWissel.mesocycle_type } : null,
      werkEventsKomende14Dagen,
      trainingenKomendeWeek,
    })
  } catch (err) {
    console.error('[coach-planning/overzicht]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}
