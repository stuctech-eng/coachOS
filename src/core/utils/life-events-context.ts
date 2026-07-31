import { SupabaseClient } from '@supabase/supabase-js'
import { bepaalDagContext, type ResolvedContext } from './context-resolver'
import { isFeestdag } from '@/lib/feestdagen'

// v2.4.203-FIX: new Date().toISOString().split('T')[0] geeft de datum
// in UTC, niet de lokale kalenderdag — kan rond middernacht lokale tijd
// (bijv. Nederland, UTC+2) een dag te vroeg/laat rapporteren aan de
// Coach. Kleinere impact dan de kritiekere versie in de Coach Planning-
// kalender (v2.4.203, coach-planning/page.tsx — daar was het fout voor
// élke dag, hier alleen in een venster van enkele uren rond
// middernacht) maar wel gefixt, want dit voedt de Coach rechtstreeks.
function lokaleDagStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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
  // v2.4.185 (Coach Agenda Fase A): uitzonderingen op een terugkerende
  // regel — specifieke datums die de regel voor die ene dag overschrijven
  recurrence_exceptions?: string[] | null
  // v2.4.189-FIX: ontbrak volledig in de backend-query — de Coach kon
  // hierdoor nooit weten of een terugkerende regel al beëindigd was
  recurrence_end_date?: string | null
}

// v2.4.193-FIX: "om de week" (biweekly) gedroeg zich exact hetzelfde
// als "elke week" — er werd nergens gecheckt of het een even of
// oneven week was ten opzichte van de startdatum, alleen of de
// dag-van-de-week matchte. Deze helper berekent het aantal volle
// weken tussen de startdatum en vandaag (gerekend vanaf de maandag
// van elke week, dus onafhankelijk van welke dag de startdatum zelf
// op valt).
function weekVerschil(startDatumStr: string, vandaagStr: string): number {
  const maandagVan = (datumStr: string) => {
    const d = new Date(datumStr + 'T00:00:00')
    const dagOffset = (d.getDay() + 6) % 7 // maandag=0
    d.setDate(d.getDate() - dagOffset)
    return d
  }
  const verschilMs = maandagVan(vandaagStr).getTime() - maandagVan(startDatumStr).getTime()
  return Math.round(verschilMs / (1000 * 60 * 60 * 24 * 7))
}

export async function fetchTodaysLifeEvents(
  supabase: SupabaseClient,
  userId: string,
  dagNummer: number,
  isWeekend: boolean
): Promise<LifeEventRow[]> {
  const SELECT_FIELDS = 'type, start_hour, end_hour, notes, recurrence, recurrence_days, recovery_impact, stress_load, sleep_disruption, start_time, end_date, recurrence_exceptions, recurrence_end_date'
  const vandaag = lokaleDagStr(new Date())
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
    // v2.4.185 (Coach Agenda Fase A): uitzonderingen eerst checken —
    // "iedere maandag dagdienst, BEHALVE 17 augustus" overschrijft de
    // regel alleen voor die ene dag, de regel zelf blijft ongewijzigd
    if (he.recurrence_exceptions?.includes(vandaag)) return false
    // v2.4.189-FIX: begin- en einddatum ontbraken volledig — een
    // terugkerende regel met een toekomstige startdatum (of een
    // beëindigde regel) werd hierdoor altijd als actief beschouwd,
    // ongeacht wat er werkelijk was ingesteld. Dit voedde rechtstreeks
    // de Context Resolver/Coach Score sinds v2.4.173.
    if (he.start_time && vandaag < he.start_time.split('T')[0]) return false
    // v2.4.190-FIX: er blijken TWEE aparte "einddatum"-velden te
    // bestaan — end_date (het hoofdveld, in de UI "Einddatum" boven het
    // formulier) en recurrence_end_date (apart, binnen de Herhaling-
    // substap). Alleen het laatste werd gecheckt — als de gebruiker de
    // datum via het hoofdveld instelde (het meest voor de hand liggende
    // veld), werd die dus genegeerd. Nu allebei gecheckt.
    if (he.end_date && vandaag > he.end_date) return false
    if (he.recurrence_end_date && vandaag > he.recurrence_end_date) return false
    if (he.recurrence === 'workdays' && isWeekend) return false
    if (he.recurrence === 'weekend' && !isWeekend) return false
    if (he.recurrence === 'weekly' || he.recurrence === 'custom') {
      const days = he.recurrence_days
      return days ? days.includes(dagNummer) : true
    }
    if (he.recurrence === 'biweekly') {
      const days = he.recurrence_days
      const dagMatcht = days ? days.includes(dagNummer) : true
      if (!dagMatcht || !he.start_time) return false
      // Even weekverschil = zelfde week als start, of exact 2/4/6... weken later
      return weekVerschil(he.start_time.split('T')[0], vandaag) % 2 === 0
    }
    // v2.4.197-FIX: "Jaarlijks" ontbrak volledig — een verjaardag had
    // geen correcte optie, waardoor de AI "wekelijks" gokte
    if (he.recurrence === 'yearly' && he.start_time) {
      return vandaag.slice(5) === he.start_time.split('T')[0].slice(5)
    }
    if (he.recurrence === 'monthly' && he.start_time) {
      return vandaag.slice(8) === he.start_time.split('T')[0].slice(8)
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

  // v2.4.175 (Coach Agenda Fase 2, eerste stap): puur wiskundig, geen
  // extra databron of API-call nodig — zelfde berekening als de UI
  const vandaag = lokaleDagStr(new Date())
  const feestdag = isFeestdag(vandaag)

  return bepaalDagContext({
    lifeEvents: events,
    injuries: injuriesRes.data || [],
    holiday: feestdag ? { name: feestdag.name } : null,
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
