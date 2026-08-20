// ── Recovery Intelligence — Pattern Detection ───────────────────────────
// v2.4.328. KERNREGEL (Fase 6, punt 7 + Fase 7, punt C): vergelijkbaarheid
// tussen belastingsgebeurtenissen is VOLLEDIG DETERMINISTISCH — puur
// code-logica op basis van load-magnitude, life_events, blessurestatus
// en ontbrekende data. GEEN AI-aanroep in dit bestand, nergens. Een
// taalmodel komt pas kijken in context-formatter.ts, uitsluitend om een
// al-bepaald resultaat leesbaar te maken — nooit om te classificeren.

import { SupabaseClient } from '@supabase/supabase-js'
import type {
  RiAlgorithmConfig, ResponseClassification, TemporalConfidence,
  PatternType, ConfidenceTier,
} from './types'

interface LoadDagRij { date: string; load_total_min: number }

interface DagContext {
  date: string
  loadTotalMin: number
  hasActiveInjury: boolean
  hasHighLifeEventLoad: boolean
}

// ── 1. Load-baseline (analoog aan de bestaande respons-baselines, maar
// voor belasting zelf — nodig om "verhoogde belasting" relatief te
// bepalen, nooit als vast aantal minuten, zie Fase 6 punt 1) ──────────
async function berekenLoadBaseline(
  supabase: SupabaseClient, userId: string, config: RiAlgorithmConfig
): Promise<{ gemiddelde: number; sd: number } | null> {
  const vensterStart = new Date(Date.now() - config.baseline_window_days * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('ri_load_proxy_view')
    .select('load_total_min')
    .eq('user_id', userId)
    .gte('date', vensterStart)

  if (error || !data || data.length < config.min_baseline_days) return null

  const waarden = data.map(r => r.load_total_min)
  const gemiddelde = waarden.reduce((a, b) => a + b, 0) / waarden.length
  const variantie = waarden.length > 1
    ? waarden.reduce((s, w) => s + (w - gemiddelde) ** 2, 0) / (waarden.length - 1)
    : 0
  return { gemiddelde, sd: Math.sqrt(variantie) }
}

// ── 2. Confounder-context per dag — deterministisch, geen interpretatie ─
async function bepaalDagContext(
  supabase: SupabaseClient, userId: string, date: string, loadTotalMin: number
): Promise<DagContext> {
  const [{ data: blessures }, { data: events }] = await Promise.all([
    supabase.from('injuries').select('id').eq('user_id', userId).eq('active', true),
    supabase.from('life_events').select('type, recovery_impact')
      .eq('user_id', userId).lte('start_time', date + 'T23:59:59').or(`end_date.is.null,end_date.gte.${date}`),
  ])

  const hasActiveInjury = (blessures || []).length > 0
  // "hoge belasting" via life_events: recovery_impact is negatief en
  // substantieel (bestaand veld, zie context-resolver.ts se
  // TrainingImpact — hergebruikt dezelfde schaal, geen nieuwe verzonnen)
  const hasHighLifeEventLoad = (events || []).some(e => (e.recovery_impact ?? 0) <= -20)

  return { date, loadTotalMin, hasActiveInjury, hasHighLifeEventLoad }
}

// ── 3. Vergelijkbaarheid tussen twee load-events — DETERMINISTISCH ─────
// Fase 6, punt 7, letterlijk: "3 onafhankelijke, vergelijkbare
// waarnemingen" — vergelijkbaar = zelfde belasting-band tov baseline
// EN geen sterk-afwijkend confounder-profiel tussen de twee.
function zijnVergelijkbaar(a: DagContext, b: DagContext, loadBaseline: { gemiddelde: number; sd: number }): boolean {
  const bandA = Math.floor((a.loadTotalMin - loadBaseline.gemiddelde) / Math.max(loadBaseline.sd, 1))
  const bandB = Math.floor((b.loadTotalMin - loadBaseline.gemiddelde) / Math.max(loadBaseline.sd, 1))
  const zelfdeLoadBand = Math.abs(bandA - bandB) <= 1

  // Confounder-profiel moet niet sterk verschillen — als de ene dag een
  // blessure/hoge-life-event-belasting had en de andere niet, is dat
  // een reëel alternatief-verklaring, geen bewijs voor hetzelfde patroon
  // (Fase 6, punt 7, expliciet voorbeeld: drie terugvallen door drie
  // verschillende oorzaken tellen niet als hetzelfde patroon).
  const zelfdeConfounderProfiel =
    a.hasActiveInjury === b.hasActiveInjury && a.hasHighLifeEventLoad === b.hasHighLifeEventLoad

  return zelfdeLoadBand && zelfdeConfounderProfiel
}

// ── 4. Respons-classificatie voor één dag-offset ────────────────────────
function classificeerRespons(
  observatieWaarden: number[], baseline: { baseline_value: number; baseline_stddev: number } | null,
  config: RiAlgorithmConfig
): ResponseClassification {
  if (!baseline || observatieWaarden.length === 0) return 'stable' // geen basis om af te wijken vast te stellen
  const gemiddelde = observatieWaarden.reduce((a, b) => a + b, 0) / observatieWaarden.length
  const afwijkingInSd = (gemiddelde - baseline.baseline_value) / Math.max(baseline.baseline_stddev, 0.01)

  if (afwijkingInSd <= -2 * config.deviation_threshold_sd) return 'strong_decline'
  if (afwijkingInSd <= -config.deviation_threshold_sd) return 'mild_decline'
  if (afwijkingInSd >= config.deviation_threshold_sd) return 'improvement'
  return 'stable'
}

// ── 5. Hoofdfunctie — bouwt calendar_day_response + detecteert patronen ─
export async function voerPatroonDetectieUit(
  supabase: SupabaseClient, userId: string, algorithmVersion: string, config: RiAlgorithmConfig
): Promise<{ nieuweCalendarResponses: number; nieuwePatronen: number }> {
  const loadBaseline = await berekenLoadBaseline(supabase, userId, config)
  if (!loadBaseline) return { nieuweCalendarResponses: 0, nieuwePatronen: 0 } // te weinig geschiedenis

  // Responsbaselines per metric ophalen (al berekend door baseline.ts,
  // hier alleen gelezen — geen dubbele berekening)
  const { data: baselineRijen } = await supabase
    .from('ri_baselines').select('metric, baseline_value, baseline_stddev')
    .eq('user_id', userId).is('valid_until', null)
  const baselinesPerMetric = new Map((baselineRijen || []).map(b => [b.metric, b]))

  const vensterStart = new Date(Date.now() - config.baseline_window_days * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0]
  const { data: loadDagen } = await supabase
    .from('ri_load_proxy_view').select('date, load_total_min')
    .eq('user_id', userId).gte('date', vensterStart).order('date', { ascending: true })

  if (!loadDagen || loadDagen.length === 0) return { nieuweCalendarResponses: 0, nieuwePatronen: 0 }

  // Alleen dagen met daadwerkelijk verhoogde belasting relatief aan de
  // eigen baseline tellen als "load event" (Fase 6, punt 1 — geen vast
  // aantal minuten, altijd relatief)
  const verhoogdeDagen = loadDagen.filter(
    (d: LoadDagRij) => d.load_total_min > loadBaseline.gemiddelde + loadBaseline.sd
  )

  const dagContexten: DagContext[] = []
  let nieuweCalendarResponses = 0

  for (const dag of verhoogdeDagen) {
    const context = await bepaalDagContext(supabase, userId, dag.date, dag.load_total_min)
    dagContexten.push(context)

    for (const offset of [0, 1, 2, 3]) {
      const responsDatum = new Date(new Date(dag.date).getTime() + offset * 86400000)
        .toISOString().split('T')[0]

      const { data: observaties } = await supabase
        .from('ri_response_observations_view')
        .select('id, signal_type, value_numeric, source_table')
        .eq('user_id', userId).eq('date', responsDatum)

      if (!observaties || observaties.length === 0) continue // ontbrekende dag, overslaan (Fase 6, punt 5)

      // Classificatie op basis van 'energy' (primaire, altijd-aanwezige
      // signaal) — andere signalen worden wel gekoppeld als bewijs,
      // maar bepalen de classificatie niet mee (voorkomt premature
      // samenvoeging tot één score, Fase 4 punt 2)
      const energieWaarden = observaties.filter(o => o.signal_type === 'energy' && o.value_numeric !== null)
        .map(o => o.value_numeric as number)
      const energieBaseline = baselinesPerMetric.get('energy')
      const classificatie = classificeerRespons(energieWaarden, energieBaseline ?? null, config)

      const temporalConfidence: TemporalConfidence = offset === 0 ? 'unknown_order' : 'confirmed_after'

      const { data: cdr, error: cdrErr } = await supabase
        .from('ri_calendar_day_response')
        .insert({
          user_id: userId, load_event_date: dag.date, offset_days: offset,
          temporal_confidence: temporalConfidence, classification: classificatie,
          algorithm_version: algorithmVersion,
        })
        .select('id').single()

      if (cdrErr || !cdr) continue

      nieuweCalendarResponses++

      const links = observaties.map(o => ({
        calendar_day_response_id: cdr.id,
        source_table: o.source_table, source_id: o.id, signal_type: o.signal_type,
      }))
      if (links.length > 0) await supabase.from('ri_response_links').insert(links)
    }
  }

  const nieuwePatronen = await groepeerEnDetecteerPatronen(
    supabase, userId, algorithmVersion, config, dagContexten, loadBaseline
  )

  return { nieuweCalendarResponses, nieuwePatronen }
}

// ── 6. Groepeer vergelijkbare dagen, check consistentie, maak/werk patronen bij ─
async function groepeerEnDetecteerPatronen(
  supabase: SupabaseClient, userId: string, algorithmVersion: string, config: RiAlgorithmConfig,
  dagContexten: DagContext[], loadBaseline: { gemiddelde: number; sd: number }
): Promise<number> {
  let nieuwePatronen = 0
  const verwerkt = new Set<string>()

  for (const dag of dagContexten) {
    if (verwerkt.has(dag.date)) continue

    const vergelijkbareGroep = dagContexten.filter(
      d => !verwerkt.has(d.date) && zijnVergelijkbaar(dag, d, loadBaseline)
    )
    if (vergelijkbareGroep.length < config.min_comparable_instances) continue

    vergelijkbareGroep.forEach(d => verwerkt.add(d.date))

    // Haal de classificaties op voor deze groep (offset+2 als
    // representatief punt voor "vertraagde respons" — consistent met
    // de kalenderdag-precisie-grens uit Fase 1A)
    const { data: responsRijen } = await supabase
      .from('ri_calendar_day_response')
      .select('id, load_event_date, classification')
      .eq('user_id', userId).eq('offset_days', 2)
      .in('load_event_date', vergelijkbareGroep.map(d => d.date))

    if (!responsRijen || responsRijen.length < config.min_comparable_instances) continue

    const declineCount = responsRijen.filter(r => r.classification === 'strong_decline' || r.classification === 'mild_decline').length
    const stableCount = responsRijen.filter(r => r.classification === 'stable').length
    const improvementCount = responsRijen.filter(r => r.classification === 'improvement').length

    let patternType: PatternType | null = null
    if (declineCount >= config.min_comparable_instances) patternType = 'delayed_decline'
    else if (stableCount >= config.min_comparable_instances) patternType = 'stable_tolerance'
    else if (improvementCount >= config.min_comparable_instances) patternType = 'improving_capacity'
    if (!patternType) continue // gemengd resultaat, (nog) geen consistent patroon

    const relevanteRijen = responsRijen.filter(r =>
      patternType === 'delayed_decline' ? (r.classification === 'strong_decline' || r.classification === 'mild_decline')
      : patternType === 'stable_tolerance' ? r.classification === 'stable'
      : r.classification === 'improvement'
    )

    const confidenceTier: ConfidenceTier = relevanteRijen.length >= 5 ? 'sterk_patroon' : 'patroon'
    const datums = relevanteRijen.map(r => r.load_event_date).sort()

    const beschrijving = patternType === 'delayed_decline'
      ? 'Verhoogde belasting herhaaldelijk gevolgd door verminderde energie rond dag+2.'
      : patternType === 'stable_tolerance'
      ? 'Dit type belasting wordt herhaaldelijk zonder terugval verdragen.'
      : 'Herhaaldelijk verbeterde respons na dit type belasting waargenomen.'

    const { data: nieuwPatroon, error: patErr } = await supabase
      .from('ri_patterns')
      .insert({
        user_id: userId, pattern_type: patternType, description: beschrijving,
        occurrence_count: relevanteRijen.length, confidence_tier: confidenceTier,
        first_observed: datums[0], last_observed: datums[datums.length - 1],
        algorithm_version: algorithmVersion, influences_decision: false,
      })
      .select('id').single()

    if (patErr || !nieuwPatroon) continue
    nieuwePatronen++

    const evidenceRijen = relevanteRijen.map(r => ({ pattern_id: nieuwPatroon.id, calendar_day_response_id: r.id }))
    await supabase.from('ri_pattern_evidence').insert(evidenceRijen)
  }

  return nieuwePatronen
}
