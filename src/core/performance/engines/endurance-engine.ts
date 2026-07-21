import type { PerformanceContext } from '../core/types'
import type { EngineResult } from '../core/engine-result'
import type { LoadValue } from './load-engine'
import type { ConsistencyValue } from './consistency-engine'
import { berekenConfidence } from './confidence-engine'
import { clamp } from '../shared/scoring'

// ── Endurance Index ────────────────────────────────────────────────────
// Bron: overleg 21 juli 2026, Fase 2 (eerste engine). "Endurance Index
// hoeft niet te wachten op 90 dagen data — je kunt vanaf dag 1 een
// score berekenen en er een Confidence aan koppelen." VOLLEDIG
// DETERMINISTISCH, geen AI.
//
// v1, bewust eenvoudig: drie indicatoren van uithoudingsvermogen-basis,
// gelijk gewogen. Geen "definitieve wetenschappelijke score" — een
// eerste versie die met de Confidence Engine eerlijk laat zien hoe
// zeker de uitkomst is. Latere versies (Fase 2, vervolgstap) kunnen
// meer factoren toevoegen (progressie over tijd, recente prestaties)
// zodra de History Engine (v2.4.155) genoeg data heeft opgebouwd.
//
// Drie componenten, elk genormaliseerd naar 0-100:
// - VO2max (indien beschikbaar) — 20-70 als redelijke bandbreedte
// - CTL (fitness/chronische belasting, uit de Load Engine)
// - Consistency-percentage (uit de Consistency Engine)

export interface EnduranceValue {
  score: number
  label: 'Beginnend' | 'Ontwikkelend' | 'Goed' | 'Uitstekend'
  vo2max_component: number | null
  ctl_component: number
  consistency_component: number
}

function vo2maxNaarComponent(vo2max: number | null): number | null {
  if (vo2max === null || vo2max === undefined) return null
  // Redelijke bandbreedte voor recreatieve tot goed getrainde
  // duursporters — geen claim op exacte wetenschappelijke normering
  return clamp(Math.round(((vo2max - 20) / 50) * 100), 0, 100)
}

function ctlNaarComponent(ctl: number): number {
  // CTL wordt uitgedrukt in TSS-punten (chronisch gemiddelde) — een
  // CTL van ~80-100 geldt doorgaans als een stevige trainingsbasis.
  // Ruwe, ronde normering, geen exacte claim.
  return clamp(Math.round((ctl / 90) * 100), 0, 100)
}

function scoreNaarLabel(score: number): EnduranceValue['label'] {
  if (score >= 75) return 'Uitstekend'
  if (score >= 50) return 'Goed'
  if (score >= 25) return 'Ontwikkelend'
  return 'Beginnend'
}

export function berekenEndurance(
  context: PerformanceContext,
  load: EngineResult<LoadValue>,
  consistency: EngineResult<ConsistencyValue>,
  vo2max: number | null
): EngineResult<EnduranceValue> {
  const vo2maxComponent = vo2maxNaarComponent(vo2max)
  const ctlComponent = ctlNaarComponent(load.value.ctl)
  const consistencyComponent = consistency.value.percentage

  // Gemiddelde van de beschikbare componenten — VO2max telt alleen mee
  // als het bekend is, geen 0 invullen voor ontbrekende data (dat zou
  // de score onterecht omlaag trekken)
  const componenten = [ctlComponent, consistencyComponent, ...(vo2maxComponent !== null ? [vo2maxComponent] : [])]
  const score = Math.round(componenten.reduce((a, b) => a + b, 0) / componenten.length)

  return {
    engine: 'Endurance',
    timestamp: new Date().toISOString(),
    value: {
      score,
      label: scoreNaarLabel(score),
      vo2max_component: vo2maxComponent,
      ctl_component: ctlComponent,
      consistency_component: consistencyComponent,
    },
    confidence: berekenConfidence(context),
    metadata: {
      dataPointsUsed: componenten.length,
      calculationVersion: 'endurance-engine.ts v1 (VO2max + CTL + Consistency, gemiddeld)',
    },
  }
}
