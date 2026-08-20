// ── Recovery Intelligence — baseline-berekening ─────────────────────────
// v2.4.328. Rollend gemiddelde + standaarddeviatie per metric, per
// gebruiker (Fase 6, punt 2). Leest uitsluitend uit de al-bestaande
// ri_response_observations_view — geen dubbele dataopslag.

import { SupabaseClient } from '@supabase/supabase-js'
import type { RiAlgorithmConfig, BaselineMetricResult } from './types'

const METRIC_SIGNAL_MAP: Record<BaselineMetricResult['metric'], string> = {
  energy: 'energy', hrv: 'hrv', resting_hr: 'resting_hr',
  sleep_duration: 'sleep_duration', feeling: 'feeling',
}

function standaarddeviatie(waarden: number[], gemiddelde: number): number {
  if (waarden.length < 2) return 0
  const variantie = waarden.reduce((som, w) => som + (w - gemiddelde) ** 2, 0) / (waarden.length - 1)
  return Math.sqrt(variantie)
}

/**
 * Berekent de baseline voor één metric — retourneert null als er te
 * weinig data is (Fase 6, punt 2: minimum min_baseline_days vereist).
 * Puur berekening, schrijft niets weg — dat gebeurt in updateBaselines().
 */
export async function berekenBaselineVoorMetric(
  supabase: SupabaseClient, userId: string, metric: BaselineMetricResult['metric'], config: RiAlgorithmConfig
): Promise<BaselineMetricResult | null> {
  const vensterStart = new Date(Date.now() - config.baseline_window_days * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('ri_response_observations_view')
    .select('value_numeric')
    .eq('user_id', userId)
    .eq('signal_type', METRIC_SIGNAL_MAP[metric])
    .gte('date', vensterStart)
    .not('value_numeric', 'is', null)

  if (error || !data || data.length < config.min_baseline_days) {
    return null // te weinig data — geen baseline, geen gok
  }

  const waarden = data.map(r => r.value_numeric as number)
  const gemiddelde = waarden.reduce((a, b) => a + b, 0) / waarden.length
  const sd = standaarddeviatie(waarden, gemiddelde)

  return {
    metric,
    baseline_value: Math.round(gemiddelde * 100) / 100,
    baseline_stddev: Math.round(sd * 100) / 100,
    sample_count: waarden.length,
    baseline_range: { min: Math.min(...waarden), max: Math.max(...waarden) },
  }
}

/**
 * Werkt de baseline voor alle vijf metrics bij — sluit een eventuele
 * bestaande actieve baseline netjes af (valid_until + superseded_by)
 * vóór de nieuwe wordt aangemaakt, zodat de unieke index
 * (idx_ri_baselines_one_current) nooit geschonden wordt.
 */
export async function updateBaselines(
  supabase: SupabaseClient, userId: string, algorithmVersion: string, config: RiAlgorithmConfig
): Promise<void> {
  const vandaag = new Date().toISOString().split('T')[0]
  const metrics: BaselineMetricResult['metric'][] = ['energy', 'hrv', 'resting_hr', 'sleep_duration', 'feeling']

  for (const metric of metrics) {
    const resultaat = await berekenBaselineVoorMetric(supabase, userId, metric, config)
    if (!resultaat) continue // te weinig data voor deze metric — sla over, geen fout

    // Bestaande actieve baseline ophalen (indien aanwezig)
    const { data: bestaande } = await supabase
      .from('ri_baselines')
      .select('id, baseline_value')
      .eq('user_id', userId).eq('metric', metric).is('valid_until', null)
      .maybeSingle()

    // Ongewijzigde baseline: niets doen, voorkomt onnodige churn
    if (bestaande && Math.abs(bestaande.baseline_value - resultaat.baseline_value) < 0.01) continue

    const { data: nieuwe, error: insertErr } = await supabase
      .from('ri_baselines')
      .insert({
        user_id: userId, metric: resultaat.metric,
        baseline_value: resultaat.baseline_value, baseline_stddev: resultaat.baseline_stddev,
        sample_count: resultaat.sample_count, baseline_range: resultaat.baseline_range,
        algorithm_version: algorithmVersion, valid_from: vandaag,
      })
      .select('id').single()

    if (insertErr || !nieuwe) {
      console.error(`[recovery-intelligence] Nieuwe baseline (${metric}) aanmaken mislukt:`, insertErr)
      continue
    }

    if (bestaande) {
      await supabase.from('ri_baselines')
        .update({ valid_until: vandaag, superseded_by: nieuwe.id })
        .eq('id', bestaande.id)
    }
  }
}
