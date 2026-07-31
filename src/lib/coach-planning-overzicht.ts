import { SupabaseClient } from '@supabase/supabase-js'

// v2.4.202 (Smart Action Engine, Fase C): geëxtraheerd uit
// api/coach-planning/overzicht/route.ts (v2.4.200) zodat de Smart
// Action Engine dezelfde, al-geteste dataverzameling kan hergebruiken
// zonder een kwetsbare interne HTTP-self-call (zie v2.4.184 — dat
// patroon veroorzaakte eerder een echte bug via VERCEL_URL). Directe
// functie-aanroep i.p.v. fetch('/api/...') binnen de server.

export interface OverzichtData {
  volgendeVakantie: { datum: string; eindDatum: string | null } | null
  volgendEvenement: { datum: string; type: string } | null
  huidigeFase: string | null
  volgendeFaseWissel: { datum: string; fase: string } | null
  werkEventsKomende14Dagen: number
  trainingenKomendeWeek: number
}

export async function haalOverzichtData(supabase: SupabaseClient, userId: string): Promise<OverzichtData> {
  const vandaag = new Date().toISOString().split('T')[0]
  const over14Dagen = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const over90Dagen = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const over7Dagen = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: actievePlannen } = await supabase
    .from('training_plans').select('id').eq('athlete_id', userId).eq('status', 'active')
  const planIds = (actievePlannen || []).map(p => p.id)

  const [lifeEventsRes, sessiesRes] = await Promise.all([
    supabase.from('life_events').select('type, start_time, end_date, recurrence')
      .eq('user_id', userId)
      .gte('start_time', new Date().toISOString())
      .lte('start_time', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString())
      .order('start_time'),
    planIds.length > 0
      ? supabase.from('training_plan_sessions').select('date, mesocycle_type, sport, type')
          .in('plan_id', planIds)
          .gte('date', vandaag)
          .lte('date', over90Dagen)
          .order('date')
      : Promise.resolve({ data: [] as { date: string; mesocycle_type: string | null; sport: string; type: string }[] }),
  ])

  const lifeEvents = lifeEventsRes.data || []
  const sessies = sessiesRes.data || []

  const volgendeVakantie = lifeEvents.find(e => e.type === 'vakantie' && !e.recurrence)
  const volgendEvenement = lifeEvents.find(e => (e.type === 'evenement' || e.type === 'testdag') && !e.recurrence)

  const sessiesMetFase = sessies.filter(s => s.mesocycle_type)
  const huidigeFase = sessiesMetFase.find(s => s.date === vandaag)?.mesocycle_type || null
  const volgendeFaseWissel = sessiesMetFase.find(s => s.mesocycle_type !== huidigeFase && s.date > vandaag)

  const WERK_TYPES = ['nachtdienst', 'avonddienst', 'vroege_dienst', 'dagdienst', 'lange_dag', 'consignatie']
  const werkEventsKomende14Dagen = lifeEvents.filter(e =>
    WERK_TYPES.includes(e.type) && !e.recurrence && e.start_time.split('T')[0] <= over14Dagen
  ).length

  const trainingenKomendeWeek = sessies.filter(s => s.date <= over7Dagen).length

  return {
    volgendeVakantie: volgendeVakantie ? { datum: volgendeVakantie.start_time.split('T')[0], eindDatum: volgendeVakantie.end_date } : null,
    volgendEvenement: volgendEvenement ? { datum: volgendEvenement.start_time.split('T')[0], type: volgendEvenement.type } : null,
    huidigeFase,
    volgendeFaseWissel: volgendeFaseWissel ? { datum: volgendeFaseWissel.date, fase: volgendeFaseWissel.mesocycle_type! } : null,
    werkEventsKomende14Dagen,
    trainingenKomendeWeek,
  }
}
