import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Haalt ALLE levensgebeurtenissen op voor een gebruiker — alle categorieën
 * (Werk, Leven, Gezondheid, Omgeving), zowel eenmalige als herhalende events
 * die vandaag relevant zijn.
 *
 * Wordt gedeeld door coach/route.ts en action-plan/route.ts zodat beide
 * exact dezelfde levensgebeurtenissen-context zien — voorkomt dat Coach en
 * Dagplan op verschillende databeelden tegenstrijdig advies geven.
 *
 * Trainer (training/today/route.ts) gebruikt dit NIET — die leest alleen
 * de al-verwerkte coach-output (trainer_instructies, action_plan).
 */

export interface LifeEventRow {
  type: string
  start_hour: number | null
  end_hour: number | null
  notes: string | null
  recurrence: string | null
  recurrence_days: number[] | null
  recovery_impact?: number | null
  stress_load?: number | null
  sleep_disruption?: number | null
}

export async function fetchTodaysLifeEvents(
  supabase: SupabaseClient,
  userId: string,
  dagNummer: number,
  isWeekend: boolean
): Promise<LifeEventRow[]> {
  const SELECT_FIELDS = 'type, start_hour, end_hour, notes, recurrence, recurrence_days, recovery_impact, stress_load, sleep_disruption'

  const [eenmaligRes, herhalendRes] = await Promise.all([
    supabase
      .from('life_events')
      .select(SELECT_FIELDS)
      .eq('user_id', userId)
      .gte('start_time', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from('life_events')
      .select(SELECT_FIELDS)
      .eq('user_id', userId)
      .not('recurrence', 'is', null),
  ])

  const eenmalig = (eenmaligRes.data || []) as LifeEventRow[]
  const herhalend = (herhalendRes.data || []) as LifeEventRow[]

  // Filter herhalende events op relevantie voor vandaag — alle categorieën,
  // niet alleen werk. Een wekelijks terugkerend "hersteldag" event hoort
  // hier net zo goed in als een nachtdienst.
  const relevanteHerhalend = herhalend.filter(he => {
    if (he.recurrence === 'workdays' && isWeekend) return false
    if (he.recurrence === 'weekend' && !isWeekend) return false
    if (he.recurrence === 'weekly' || he.recurrence === 'biweekly' || he.recurrence === 'custom') {
      const days = he.recurrence_days
      return days ? days.includes(dagNummer) : true
    }
    // 'daily' of geen specifieke regel: altijd relevant
    return true
  })

  // Dedupliceer op type — eenmalige events hebben voorrang als beide
  // hetzelfde type vandaag bevatten
  const alleEvents = [...eenmalig]
  relevanteHerhalend.forEach(he => {
    if (!alleEvents.find(e => e.type === he.type)) alleEvents.push(he)
  })

  return alleEvents
}

/**
 * Zet een lijst levensgebeurtenissen om naar een leesbare regel voor in
 * de coach-prompt. Bevat type, tijden (indien aanwezig), notitie, en
 * de berekende impact-scores zodat de coach kan wegen hoe zwaar dit weegt.
 */
export function formatLifeEventsContext(events: LifeEventRow[]): string {
  if (events.length === 0) return ''

  const regels = events.map(e => {
    const tijden = e.start_hour !== null && e.end_hour !== null
      ? ` ${String(e.start_hour).padStart(2, '0')}:00-${String(e.end_hour).padStart(2, '0')}:00`
      : ''
    const notitie = e.notes ? ` — "${e.notes}"` : ''
    const impact: string[] = []
    if (e.recovery_impact) impact.push(`herstel-impact ${e.recovery_impact}/3`)
    if (e.stress_load) impact.push(`stress ${e.stress_load}/3`)
    if (e.sleep_disruption) impact.push(`slaapverstoring ${e.sleep_disruption}/3`)
    const impactText = impact.length > 0 ? ` (${impact.join(', ')})` : ''
    return `- ${e.type}${tijden}${notitie}${impactText}`
  })

  return `LEVENSGEBEURTENISSEN VANDAAG:\n${regels.join('\n')}\n`
}
