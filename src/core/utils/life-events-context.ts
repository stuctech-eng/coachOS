import { SupabaseClient } from '@supabase/supabase-js'
import { bepaalDagContext, type ResolvedContext } from './context-resolver'

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
  // v2.4.173: toegevoegd voor de echte periode-check hieronder
  start_time?: string
  end_date?: string | null
}

export async function fetchTodaysLifeEvents(
  supabase: SupabaseClient,
  userId: string,
  dagNummer: number,
  isWeekend: boolean
): Promise<LifeEventRow[]> {
  const SELECT_FIELDS = 'type, start_hour, end_hour, notes, recurrence, recurrence_days, recovery_impact, stress_load, sleep_disruption, start_time, end_date'
  const vandaag = new Date().toISOString().split('T')[0]
  const negentigDagenGeleden = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const [eenmaligRes, herhalendRes] = await Promise.all([
    supabase
      .from('life_events')
      .select(SELECT_FIELDS)
      .eq('user_id', userId)
      .is('recurrence', null)
      .gte('start_time', negentigDagenGeleden),
    supabase
      .from('life_events')
      .select(SELECT_FIELDS)
      .eq('user_id', userId)
      .not('recurrence', 'is', null),
  ])

  const eenmalig = (eenmaligRes.data || []) as LifeEventRow[]
  const herhalend = (herhalendRes.data || []) as LifeEventRow[]

  // v2.4.173-FIX: was `.gte('start_time', laatste 2 dagen)` — dat
  // betekende dat een meerdaags event (bijv. vakantie 20 juli t/m 3
  // augustus) na een paar dagen automatisch uit de Coach-context
  // verdween, los van end_date. Nu een echte periode-check: actief als
  // vandaag tussen start_date en (end_date, of anders start_date zelf
  // bij eenmalige events) valt. Was eerder ALLEEN toegepast op
  // type==='vakantie' in de kalender-UI (life-events/page.tsx) — hier
  // gold het voorheen zelfs voor GEEN enkel type correct.
  const eenmaligActiefVandaag = eenmalig.filter(e => {
    if (!e.start_time) return false
    const startDatum = e.start_time.split('T')[0]
    const eindDatum = e.end_date || startDatum
    return vandaag >= startDatum && vandaag <= eindDatum
  })

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
  const alleEvents = [...eenmaligActiefVandaag]
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

// ── Context Resolver — gedeelde ingang ──────────────────────────────────
// Bron: overleg 22 juli 2026, Coach Context Engine Fase 1. Haalt de
// ruwe events + actieve blessures op en roept de PURE
// `bepaalDagContext()` (context-resolver.ts) aan. Dit is nu de ENIGE
// plek die dit doet — coach/route.ts, action-plan/route.ts,
// api/status/route.ts en de Performance-data-adapter roepen voortaan
// allemaal deze functie aan, i.p.v. elk hun eigen lifeEventPenalty-
// berekening of ruwe events-lijst te gebruiken.
export async function haalDagContext(
  supabase: SupabaseClient,
  userId: string,
  dagNummer: number,
  isWeekend: boolean
): Promise<ResolvedContext> {
  const [events, injuriesRes] = await Promise.all([
    fetchTodaysLifeEvents(supabase, userId, dagNummer, isWeekend),
    supabase.from('injuries').select('body_part, pain_score').eq('user_id', userId).eq('active', true),
  ])

  return bepaalDagContext({
    lifeEvents: events,
    injuries: injuriesRes.data || [],
  })
}

/**
 * Zet een ResolvedContext om naar een leesbare regel voor in de
 * coach-prompt — vervangt formatLifeEventsContext() op de plekken die
 * nu de opgeloste werkelijkheid krijgen i.p.v. de ruwe eventlijst.
 */
export function formatResolvedContext(context: ResolvedContext): string {
  if (context.lifeContext.mode === 'normaal' && !context.healthContext.activeInjuries) return ''

  const regels = [
    `LEVENSCONTEXT VANDAAG: ${context.lifeContext.mode} (${context.lifeContext.priorityReason})`,
    context.lifeContext.coachInstruction ? `Instructie: ${context.lifeContext.coachInstruction}` : '',
    context.trainingImpact.trainingModifier !== 0 ? `Trainingsbelasting-aanpassing: ${context.trainingImpact.trainingModifier > 0 ? '+' : ''}${context.trainingImpact.trainingModifier}%` : '',
    context.lifeContext.suppressedEvents.length > 0
      ? `Onderdrukt vandaag: ${context.lifeContext.suppressedEvents.map(e => `${e.type} (${e.reason})`).join(', ')}`
      : '',
  ].filter(Boolean)

  return regels.join('\n') + '\n'
}
