import { haalRowingData, type RowingActiviteit } from './rowing-data'

// ── Rowing Analysis Engine ────────────────────────────────────────────────
// Spiegelbeeld van running-analysis.ts/cycling-analysis.ts. VOLLEDIG
// DETERMINISTISCH. Gebouwd als ontbrekende schakel voor de Rowing coach-
// conversatieroute (laatste openstaande punt uit de systematische sweep,
// v2.4.251).
//
// Metrics-keuze: 'distance' (uit Concept2-sync, v2.4.219) — geen SPM
// (stroke rate) als hoofdmetric, want die is niet betrouwbaar aanwezig
// bij ALLE importbronnen (handmatig/Strava missen 'm vaak), in
// tegenstelling tot afstand die overal consistent is. "Snelheid" hier =
// afstand/duur, zelfde eenvoudige proxy als bij Running.

export interface RowingAnalysisResultaat {
  trainingsfrequentie: {
    aantal_deze_periode: number
    aantal_vorige_periode: number
    trend: 'stijgend' | 'stabiel' | 'dalend'
  }
  snelheid: {
    gemiddelde_snelheid_m_per_min: number | null
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

const ENGINE_VERSION = 'rowing-engine-1.0'
const ALGORITHM_VERSION = 'basic-trend-v1'

function gemiddelde(waarden: number[]): number | null {
  if (waarden.length === 0) return null
  return Math.round((waarden.reduce((a, b) => a + b, 0) / waarden.length) * 10) / 10
}

export async function analyseerRowing(userId: string, periodDays: number): Promise<EngineResult<RowingAnalysisResultaat>> {
  const reden: string[] = []

  const [huidigePeriode, vorigePeriode] = await Promise.all([
    haalRowingData(userId, periodDays),
    haalRowingDataUitVerleden(userId, periodDays, periodDays),
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

  // ── Snelheid (afstand/duur — zelfde eenvoudige proxy als bij Running) ──
  function berekenSnelheden(lijst: RowingActiviteit[]): number[] {
    return lijst
      .filter(a => a.metrics?.distance && a.duration > 0)
      .map(a => Math.round(((a.metrics!.distance as number) / a.duration) * 10) / 10)
  }
  const snelheidWaarden = berekenSnelheden(activiteiten)
  const gemSnelheid = gemiddelde(snelheidWaarden)
  const vorigeSnelheidWaarden = berekenSnelheden(vorigeActiviteiten)
  const vorigGemSnelheid = gemiddelde(vorigeSnelheidWaarden)
  const snelheidTrendPct = (gemSnelheid !== null && vorigGemSnelheid !== null && vorigGemSnelheid > 0)
    ? Math.round(((gemSnelheid - vorigGemSnelheid) / vorigGemSnelheid) * 100)
    : null

  if (gemSnelheid !== null) {
    reden.push(`Snelheid: gemiddeld ${gemSnelheid} m/min over ${snelheidWaarden.length} activiteiten met afstandsdata${snelheidTrendPct !== null ? ` (${snelheidTrendPct > 0 ? '+' : ''}${snelheidTrendPct}% t.o.v. vorige periode)` : ''}`)
  } else {
    reden.push('Snelheid: geen activiteiten met afstandsdata in deze periode (metrics.distance ontbreekt — vaak het geval bij handmatige/Strava-imports zonder Concept2)')
  }

  // ── Afstand ────────────────────────────────────────────────────────
  const afstandenM = activiteiten.map(a => a.metrics?.distance).filter((v): v is number => typeof v === 'number')
  const totaalKm = Math.round((afstandenM.reduce((a, b) => a + b, 0) / 1000) * 10) / 10
  const gemKmPerActiviteit = afstandenM.length > 0 ? Math.round((totaalKm / afstandenM.length) * 10) / 10 : null
  reden.push(`Afstand: ${totaalKm}km totaal over ${afstandenM.length} activiteiten met afstandsdata`)

  // ── Trainingsbelasting ─────────────────────────────────────────────
  const totaleMinutenActiviteiten = activiteiten.reduce((a, act) => a + (act.duration || 0), 0)
  const totaleMinutenTrainingen = huidigePeriode.trainingsresultaten.reduce((a, t) => a + (t.actual_duration || 0), 0)
  const totaleMinuten = totaleMinutenActiviteiten + totaleMinutenTrainingen
  const gemiddeldPerWeek = (totaleMinuten / periodDays) * 7
  const belastingScore: 'laag' | 'gemiddeld' | 'hoog' = gemiddeldPerWeek < 60 ? 'laag' : gemiddeldPerWeek < 180 ? 'gemiddeld' : 'hoog'
  reden.push(`Trainingsbelasting: ${totaleMinuten} minuten totaal (${Math.round(gemiddeldPerWeek)} min/week gemiddeld) → score "${belastingScore}"`)

  return {
    resultaat: {
      trainingsfrequentie: { aantal_deze_periode: aantalDeze, aantal_vorige_periode: aantalVorige, trend },
      snelheid: { gemiddelde_snelheid_m_per_min: gemSnelheid, trend_pct: snelheidTrendPct },
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

async function haalRowingDataUitVerleden(userId: string, periodDays: number, hoeVerTerug: number) {
  const dubbeleData = await haalRowingData(userId, periodDays + hoeVerTerug)
  const grensDatum = new Date(Date.now() - hoeVerTerug * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  return {
    ...dubbeleData,
    activiteiten: dubbeleData.activiteiten.filter((a: RowingActiviteit) => a.date < grensDatum),
    trainingsresultaten: dubbeleData.trainingsresultaten.filter(t => t.completed_at < grensDatum),
  }
}
