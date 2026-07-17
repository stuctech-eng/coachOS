import { haalRunningData, type RunningActiviteit, type RunningTrainingResultaat } from './running-data'

// ── Running Analysis Engine ──────────────────────────────────────────────
// Spiegelbeeld van cycling-analysis.ts (v2.4.66). VOLLEDIG DETERMINISTISCH.
//
// Belangrijk verschil met Cycling: geen vermogen (avg_watts) — running
// heeft doorgaans geen vermogensmeter. In plaats daarvan: gemiddelde
// snelheid (avg_speed), zelfde metrics-veld-conventie als bij cycling
// (zie activity_sessions.metrics), niet aangenomen dat het veld exact
// hetzelfde eenheid/precisie heeft — puur doorgegeven zoals opgeslagen.

export interface RunningAnalysisResultaat {
  trainingsfrequentie: {
    aantal_deze_periode: number
    aantal_vorige_periode: number
    trend: 'stijgend' | 'stabiel' | 'dalend'
  }
  snelheid: {
    gemiddelde_snelheid: number | null
    max_snelheid: number | null
    trend_pct: number | null
  }
  afstand: {
    totaal_km: number
    gemiddeld_km_per_activiteit: number | null
  }
  trainingsbelasting: {
    totale_minuten: number
    score: 'laag' | 'gemiddeld' | 'hoog'
  }
}

export interface EngineResult<T> {
  resultaat: T
  reden: string[]
  databronnen: string[]
  gegenereerd_op: string
  engine_version: string
  algorithm_version: string
}

const ENGINE_VERSION = 'running-engine-1.0'
const ALGORITHM_VERSION = 'basic-trend-v1'

function haalWaarde(metrics: Record<string, number> | null, veld: string): number | null {
  if (!metrics) return null
  const waarde = metrics[veld]
  return typeof waarde === 'number' && !isNaN(waarde) ? waarde : null
}

function gemiddelde(waarden: number[]): number | null {
  if (waarden.length === 0) return null
  return Math.round((waarden.reduce((a, b) => a + b, 0) / waarden.length) * 10) / 10
}

export async function analyseerRunning(userId: string, periodDays: number): Promise<EngineResult<RunningAnalysisResultaat>> {
  const reden: string[] = []

  const [huidigePeriode, vorigePeriode] = await Promise.all([
    haalRunningData(userId, periodDays),
    haalRunningDataUitVerleden(userId, periodDays, periodDays),
  ])

  const activiteiten = huidigePeriode.activiteiten
  const vorigeActiviteiten = vorigePeriode.activiteiten

  // ── Trainingsfrequentie ────────────────────────────────────────────
  const aantalDeze = activiteiten.length
  const aantalVorige = vorigeActiviteiten.length
  let trend: 'stijgend' | 'stabiel' | 'dalend' = 'stabiel'
  if (aantalVorige > 0) {
    const verschilPct = ((aantalDeze - aantalVorige) / aantalVorige) * 100
    if (verschilPct >= 15) trend = 'stijgend'
    else if (verschilPct <= -15) trend = 'dalend'
  } else if (aantalDeze > 0) {
    trend = 'stijgend'
  }
  reden.push(`Frequentie: ${aantalDeze} activiteiten deze periode vs. ${aantalVorige} vorige periode (${periodDays} dagen elk) → trend "${trend}"`)

  // ── Snelheid (i.p.v. vermogen bij Cycling) ────────────────────────
  const snelheidWaarden = activiteiten.map(a => haalWaarde(a.metrics, 'avg_speed')).filter((v): v is number => v !== null)
  const maxSnelheidWaarden = activiteiten.map(a => haalWaarde(a.metrics, 'max_speed')).filter((v): v is number => v !== null)
  const gemSnelheid = gemiddelde(snelheidWaarden)
  const maxSnelheid = maxSnelheidWaarden.length > 0 ? Math.max(...maxSnelheidWaarden) : null

  const vorigeSnelheidWaarden = vorigeActiviteiten.map(a => haalWaarde(a.metrics, 'avg_speed')).filter((v): v is number => v !== null)
  const vorigGemSnelheid = gemiddelde(vorigeSnelheidWaarden)
  const snelheidTrendPct = (gemSnelheid !== null && vorigGemSnelheid !== null && vorigGemSnelheid > 0)
    ? Math.round(((gemSnelheid - vorigGemSnelheid) / vorigGemSnelheid) * 100)
    : null

  if (gemSnelheid !== null) {
    reden.push(`Snelheid: gemiddeld ${gemSnelheid} over ${snelheidWaarden.length} activiteiten met snelheidsdata${snelheidTrendPct !== null ? ` (${snelheidTrendPct > 0 ? '+' : ''}${snelheidTrendPct}% t.o.v. vorige periode)` : ''}`)
  } else {
    reden.push('Snelheid: geen activiteiten met snelheidsdata in deze periode (avg_speed ontbreekt)')
  }

  // ── Afstand ────────────────────────────────────────────────────────
  const afstandenM = activiteiten.map(a => haalWaarde(a.metrics, 'distance')).filter((v): v is number => v !== null)
  const totaalKm = Math.round((afstandenM.reduce((a, b) => a + b, 0) / 1000) * 10) / 10
  const gemKmPerActiviteit = afstandenM.length > 0 ? Math.round((totaalKm / afstandenM.length) * 10) / 10 : null
  reden.push(`Afstand: ${totaalKm}km totaal over ${afstandenM.length} activiteiten met afstandsdata`)

  // ── Trainingsbelasting ─────────────────────────────────────────────
  const totaleMinutenActiviteiten = activiteiten.reduce((a, act) => a + (act.duration || 0), 0)
  const totaleMinutenTrainingen = huidigePeriode.trainingsresultaten.reduce((a, t) => a + (t.actual_duration || 0), 0)
  const totaleMinuten = totaleMinutenActiviteiten + totaleMinutenTrainingen
  const gemiddeldPerWeek = (totaleMinuten / periodDays) * 7
  const belastingScore: 'laag' | 'gemiddeld' | 'hoog' = gemiddeldPerWeek < 90 ? 'laag' : gemiddeldPerWeek < 240 ? 'gemiddeld' : 'hoog'
  reden.push(`Trainingsbelasting: ${totaleMinuten} minuten totaal (${Math.round(gemiddeldPerWeek)} min/week gemiddeld) → score "${belastingScore}"`)

  return {
    resultaat: {
      trainingsfrequentie: { aantal_deze_periode: aantalDeze, aantal_vorige_periode: aantalVorige, trend },
      snelheid: { gemiddelde_snelheid: gemSnelheid, max_snelheid: maxSnelheid, trend_pct: snelheidTrendPct },
      afstand: { totaal_km: totaalKm, gemiddeld_km_per_activiteit: gemKmPerActiviteit },
      trainingsbelasting: { totale_minuten: totaleMinuten, score: belastingScore },
    },
    reden,
    databronnen: ['activity_sessions', 'training_results'],
    gegenereerd_op: new Date().toISOString(),
    engine_version: ENGINE_VERSION,
    algorithm_version: ALGORITHM_VERSION,
  }
}

async function haalRunningDataUitVerleden(userId: string, periodDays: number, hoeVerTerug: number) {
  const dubbeleData = await haalRunningData(userId, periodDays + hoeVerTerug)
  const grensDatum = new Date(Date.now() - hoeVerTerug * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  return {
    ...dubbeleData,
    activiteiten: dubbeleData.activiteiten.filter((a: RunningActiviteit) => a.date < grensDatum),
    trainingsresultaten: dubbeleData.trainingsresultaten.filter((t: RunningTrainingResultaat) => t.completed_at < grensDatum),
  }
}
