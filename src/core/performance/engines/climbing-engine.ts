import { getHoogtemeters, getFtpEnGewicht } from '../data/performance-data-adapter'
import type { PerformanceContext } from '../core/types'
import type { EngineResult } from '../core/engine-result'
import { berekenConfidence } from './confidence-engine'
import { clamp } from '../shared/scoring'

// ── Climbing Score ────────────────────────────────────────────────────
// Bron: overleg 21 juli 2026, Fase 2. Master spec noemt hoogtemeters,
// stijgingspercentage, W/kg, vermogen, cadans, klimduur, klimfrequentie.
//
// v1, bewust beperkt: alleen hoogtemeters (30 dagen) + W/kg (uit FTP +
// gewicht, al bestaande data). Stijgingspercentage/klimduur/
// klimfrequentie vergen klim-segmentatie per activiteit — dat bestaat
// nergens in CoachOS (zelfde eerlijke beperking als eerder benoemd bij
// Running's "beste klim" tijdens de Records-discussie, v2.4.128).

export interface ClimbingValue {
  score: number
  label: 'Vlak terrein' | 'Ontwikkelend' | 'Sterke klimmer' | 'Bergspecialist'
  hoogtemeters_30d: number
  watt_per_kg: number | null
}

function hoogtemetersNaarComponent(meters: number): number {
  // 0-5000m in 30 dagen als redelijke bandbreedte — geen exacte claim
  return clamp(Math.round((meters / 5000) * 100), 0, 100)
}

function wattPerKgNaarComponent(wattPerKg: number | null): number | null {
  if (wattPerKg === null) return null
  // 2-6 W/kg als redelijke bandbreedte voor recreatief-tot-sterk
  return clamp(Math.round(((wattPerKg - 2) / 4) * 100), 0, 100)
}

function scoreNaarLabel(score: number): ClimbingValue['label'] {
  if (score >= 75) return 'Bergspecialist'
  if (score >= 50) return 'Sterke klimmer'
  if (score >= 25) return 'Ontwikkelend'
  return 'Vlak terrein'
}

export async function berekenClimbing(context: PerformanceContext): Promise<EngineResult<ClimbingValue>> {
  const [hoogtemeters, { ftp, gewicht }] = await Promise.all([
    getHoogtemeters(context.userId, 30).catch(() => 0),
    getFtpEnGewicht(context.userId).catch(() => ({ ftp: null, gewicht: null })),
  ])

  const wattPerKg = ftp && gewicht ? Math.round((ftp / gewicht) * 100) / 100 : null

  const hoogtemetersComponent = hoogtemetersNaarComponent(hoogtemeters)
  const wattPerKgComponent = wattPerKgNaarComponent(wattPerKg)

  const componenten = [hoogtemetersComponent, ...(wattPerKgComponent !== null ? [wattPerKgComponent] : [])]
  const score = Math.round(componenten.reduce((a, b) => a + b, 0) / componenten.length)

  return {
    engine: 'Climbing',
    timestamp: new Date().toISOString(),
    value: { score, label: scoreNaarLabel(score), hoogtemeters_30d: Math.round(hoogtemeters), watt_per_kg: wattPerKg },
    confidence: berekenConfidence(context),
    metadata: {
      dataPointsUsed: componenten.length,
      calculationVersion: 'climbing-engine.ts v1 (hoogtemeters + W/kg, Cycling-only)',
    },
  }
}
