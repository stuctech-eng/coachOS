// ── Recovery Intelligence — gedeelde types ──────────────────────────────
// v2.4.328. Exact matchend met het DB-schema uit de Fase 8.1/8.2-migratie
// (uitgevoerd + geverifieerd 20 augustus 2026). Geen enkel veld hier
// verzonnen — elk type komt rechtstreeks overeen met een kolom die al
// in productie staat.

export type ResponseSignalType =
  | 'energy' | 'feeling' | 'mood' | 'sleep_duration' | 'hrv' | 'resting_hr' | 'functioning'

export type ResponseClassification = 'stable' | 'mild_decline' | 'strong_decline' | 'improvement'

export type TemporalConfidence = 'unknown_order' | 'likely_before' | 'likely_after' | 'confirmed_after'

export type PatternType = 'delayed_decline' | 'boom_bust' | 'stable_tolerance' | 'improving_capacity'

export type ConfidenceTier = 'observatie' | 'mogelijk_verband' | 'patroon' | 'sterk_patroon'

export interface RiAlgorithmConfig {
  enabled: boolean
  deviation_threshold_sd: number
  min_comparable_instances: number
  min_baseline_days: number
  baseline_window_days: number
  no_recent_confirmation_months: number
}

export interface LoadProxyRow {
  user_id: string
  date: string // yyyy-mm-dd
  load_total_min: number
}

export interface ResponseObservationRow {
  id: string
  user_id: string
  date: string
  signal_type: ResponseSignalType
  value_numeric: number | null
  value_categorical: string | null
  source_table: 'daily_checkins' | 'health_metrics' | 'coach_call_items'
}

export interface BaselineMetricResult {
  metric: 'energy' | 'hrv' | 'resting_hr' | 'sleep_duration' | 'feeling'
  baseline_value: number
  baseline_stddev: number
  sample_count: number
  baseline_range: { min: number; max: number }
}

// v2.4.328: een load-event is de eenheid die vergeleken wordt bij
// patroondetectie — één "verhoogde belasting"-dag, met genoeg context
// om vergelijkbaarheid/confounders deterministisch te beoordelen
// (Fase 6, punt 7 — geen AI-oordeel, zie pattern-detection.ts).
export interface LoadEventContext {
  date: string
  loadTotalMin: number
  loadRelativeToBaseline: number // hoeveel SD boven de eigen belasting-baseline
  hasActiveInjury: boolean
  hasHighLifeEventLoad: boolean // werk/ziekte/vakantie met hoge belasting die dag
}
