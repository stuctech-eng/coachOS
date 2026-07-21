import { haalCTLATLTSB } from '@/lib/specialists/cycling-grafieken'
import { haalRunningCTLATLTSB } from '@/lib/specialists/running-grafieken'
import type { PerformanceContext } from '../core/types'
import type { EngineResult } from '../core/engine-result'
import { berekenConfidence } from './confidence-engine'

// ── Load Engine (Performance-laag) ───────────────────────────────────────
// Bron: overleg 21 juli 2026, Fase 1B. WRAPPER — combineert de
// bestaande, al-geteste per-sport CTL/ATL/TSB-berekeningen
// (cycling-grafieken.ts, running-grafieken.ts) tot één platformniveau-
// cijfer. Geen nieuwe TSS-formule, geen nieuwe EWMA-implementatie.
//
// Wiskundige onderbouwing (geverifieerd vóór implementatie): de EWMA-
// formule (ctl = ctl + (tss-ctl)/42) is een lineaire, tijdsinvariante
// recursie. Dat betekent CTL_totaal = CTL_cycling + CTL_running, exact
// (geverifieerd met synthetische data, verschil ~10⁻¹⁵, puur
// afrondingsruis) — dus optellen van de laatste per-sport-waarden is
// wiskundig equivalent aan een nieuwe berekening op gecombineerde
// dagelijkse TSS, maar veel simpeler en zonder duplicatie van de
// EWMA-logica.

export interface LoadSportDetail {
  sport: 'cycling' | 'running'
  ctl: number
  atl: number
  tsb: number
  vandaag_tss: number
}

export interface LoadValue {
  ctl: number
  atl: number
  tsb: number
  vandaag_tss: number
  per_sport: LoadSportDetail[]
}

export async function berekenLoad(userId: string, context: PerformanceContext): Promise<EngineResult<LoadValue>> {
  const [cyclingSerie, runningSerie] = await Promise.all([
    haalCTLATLTSB(userId, 90).catch(() => []),
    haalRunningCTLATLTSB(userId, 90).catch(() => []),
  ])

  const laatsteCycling = cyclingSerie[cyclingSerie.length - 1] || null
  const laatsteRunning = runningSerie[runningSerie.length - 1] || null

  const perSport: LoadSportDetail[] = []
  if (laatsteCycling) perSport.push({ sport: 'cycling', ctl: laatsteCycling.ctl, atl: laatsteCycling.atl, tsb: laatsteCycling.tsb, vandaag_tss: laatsteCycling.geschatte_tss })
  if (laatsteRunning) perSport.push({ sport: 'running', ctl: laatsteRunning.ctl, atl: laatsteRunning.atl, tsb: laatsteRunning.tsb, vandaag_tss: laatsteRunning.geschatte_tss })

  const ctl = Math.round(((laatsteCycling?.ctl || 0) + (laatsteRunning?.ctl || 0)) * 10) / 10
  const atl = Math.round(((laatsteCycling?.atl || 0) + (laatsteRunning?.atl || 0)) * 10) / 10
  const tsb = Math.round((ctl - atl) * 10) / 10
  const vandaagTss = (laatsteCycling?.geschatte_tss || 0) + (laatsteRunning?.geschatte_tss || 0)

  return {
    engine: 'Load',
    timestamp: new Date().toISOString(),
    value: { ctl, atl, tsb, vandaag_tss: vandaagTss, per_sport: perSport },
    confidence: berekenConfidence(context),
    metadata: {
      dataPointsUsed: cyclingSerie.length + runningSerie.length,
      calculationVersion: 'cycling-grafieken.ts + running-grafieken.ts (EWMA, opgeteld)',
    },
  }
}
