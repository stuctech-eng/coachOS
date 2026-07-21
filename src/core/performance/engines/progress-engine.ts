import { haalHistorie } from './history-engine'
import type { PerformanceContext } from '../core/types'
import type { EngineResult } from '../core/engine-result'
import { berekenConfidence } from './confidence-engine'
import { clamp, scoreNaarConfidenceLevel } from '../shared/scoring'
import { CONFIDENCE_DREMPELS } from '../core/constants'

// ── Progress Score ────────────────────────────────────────────────────
// Bron: overleg 21 juli 2026, Fase 2. "Meet ontwikkeling, niet absolute
// prestaties." Gebruikt de History Engine (v2.4.155) — vergelijkt het
// gemiddelde van de laatste 14 dagen met de 14 dagen daarvoor, voor een
// gekozen bron-engine (standaard Endurance).
//
// EERLIJKE BEPERKING: de History Engine is pas sinds v2.4.155 live —
// bij de meeste gebruikers is er nu nog nauwelijks geschiedenis. Deze
// engine geeft dan terecht een lage Confidence en een neutrale uitkomst
// terug, in plaats van een misleidend cijfer te verzinnen. Wordt
// vanzelf betekenisvoller naarmate er meer dagen data bijkomen.

export interface ProgressValue {
  percentageVerandering: number | null // null als er te weinig data is om te vergelijken
  richting: 'stijgend' | 'dalend' | 'stabiel' | 'onbekend'
  gemiddeldeRecent: number | null
  gemiddeldeEerder: number | null
  bronEngine: string
}

export async function berekenProgress(context: PerformanceContext, bronEngine: string = 'Endurance'): Promise<EngineResult<ProgressValue>> {
  const historie = await haalHistorie(context.userId, bronEngine, 28).catch(() => [])

  const vandaag = new Date(context.now)
  const veertienDagenGeleden = new Date(vandaag)
  veertienDagenGeleden.setDate(veertienDagenGeleden.getDate() - 14)

  const recentePunten = historie.filter(p => new Date(p.date) >= veertienDagenGeleden)
  const eerderePunten = historie.filter(p => new Date(p.date) < veertienDagenGeleden)

  const gemiddelde = (punten: typeof historie) => punten.length > 0 ? punten.reduce((s, p) => s + p.score, 0) / punten.length : null
  const gemiddeldeRecent = gemiddelde(recentePunten)
  const gemiddeldeEerder = gemiddelde(eerderePunten)

  let percentageVerandering: number | null = null
  let richting: ProgressValue['richting'] = 'onbekend'

  if (gemiddeldeRecent !== null && gemiddeldeEerder !== null && gemiddeldeEerder !== 0) {
    percentageVerandering = Math.round(((gemiddeldeRecent - gemiddeldeEerder) / gemiddeldeEerder) * 1000) / 10
    if (percentageVerandering > 5) richting = 'stijgend'
    else if (percentageVerandering < -5) richting = 'dalend'
    else richting = 'stabiel'
  }

  const confidence = berekenConfidence(context)
  // Extra, engine-specifieke beperking bovenop de algemene Confidence —
  // eerlijk benoemen dat er simpelweg nog te weinig historie is,
  // ongeacht hoeveel activiteiten/sensoren er beschikbaar zijn
  if (eerderePunten.length < 3) {
    confidence.limitations.unshift('Nog te weinig geschiedenis om een betrouwbare trend te bepalen (History Engine sinds v2.4.155)')
    confidence.score = clamp(confidence.score - 30, 0, 100)
    confidence.level = scoreNaarConfidenceLevel(confidence.score, CONFIDENCE_DREMPELS.MEDIUM, CONFIDENCE_DREMPELS.HIGH)
  }

  return {
    engine: 'Progress',
    timestamp: new Date().toISOString(),
    value: { percentageVerandering, richting, gemiddeldeRecent, gemiddeldeEerder, bronEngine },
    confidence,
    metadata: {
      dataPointsUsed: historie.length,
      calculationVersion: 'progress-engine.ts v1 (14d vs voorgaande 14d, via History Engine)',
    },
  }
}
