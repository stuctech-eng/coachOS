import { haalCyclingData, type CyclingActiviteit, type CyclingTrainingResultaat } from './cycling-data'

// ── Fase 2b — Cycling Analysis Engine ───────────────────────────────────
// Bron: docs/specialist-api.md Fase 2b, docs/specialist-engine-architecture.md.
// VOLLEDIG DETERMINISTISCH — geen AI, geen berekening door een taalmodel.
// Vaste output-vorm (EngineResult-patroon uit specialist-engine-architecture.md):
// resultaat + reden[] + databronnen[] + gegenereerd_op. Confidence is hier
// niet van toepassing (dat is een Confidence Engine-concept voor Memory,
// zie specialist-memory.md — deze Analysis Engine berekent gewoon cijfers
// uit bestaande data, geen "hoe zeker zijn we"-vraag).

export interface CyclingAnalysisResultaat {
  trainingsfrequentie: {
    aantal_deze_periode: number
    aantal_vorige_periode: number
    trend: 'stijgend' | 'stabiel' | 'dalend'
  }
  vermogen: {
    gemiddeld_watt: number | null
    max_watt: number | null
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
  // v2.4.66: versionering, vastgelegd in specialist-engine-architecture.md
  engine_version: string
  algorithm_version: string
}

const ENGINE_VERSION = 'cycling-engine-1.0'
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

export async function analyseerCycling(userId: string, periodDays: number): Promise<EngineResult<CyclingAnalysisResultaat>> {
  const reden: string[] = []

  // Huidige periode + evenlange voorgaande periode voor trendvergelijking
  const [huidigePeriode, vorigePeriode] = await Promise.all([
    haalCyclingData(userId, periodDays),
    haalCyclingDataUitVerleden(userId, periodDays, periodDays), // periodDays terug, nog eens periodDays terug
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
    trend = 'stijgend' // van 0 naar iets is per definitie stijgend
  }
  reden.push(`Frequentie: ${aantalDeze} activiteiten deze periode vs. ${aantalVorige} vorige periode (${periodDays} dagen elk) → trend "${trend}"`)

  // ── Vermogen ───────────────────────────────────────────────────────
  // Let op: avg_watts komt zowel uit Strava- als Garmin-imports, maar
  // max_watts is tot nu toe alleen bevestigd in Garmin TCX-imports (zie
  // specialist-api.md-kanttekening) — niet elke activiteit zal dit veld
  // hebben, vandaar overal expliciete null-checks i.p.v. aannames.
  const vermogenWaarden = activiteiten.map(a => haalWaarde(a.metrics, 'avg_watts')).filter((v): v is number => v !== null)
  const maxVermogenWaarden = activiteiten.map(a => haalWaarde(a.metrics, 'max_watts')).filter((v): v is number => v !== null)
  const gemiddeldWatt = gemiddelde(vermogenWaarden)
  const maxWatt = maxVermogenWaarden.length > 0 ? Math.max(...maxVermogenWaarden) : null

  const vorigeVermogenWaarden = vorigeActiviteiten.map(a => haalWaarde(a.metrics, 'avg_watts')).filter((v): v is number => v !== null)
  const vorigGemiddeldWatt = gemiddelde(vorigeVermogenWaarden)
  const vermogenTrendPct = (gemiddeldWatt !== null && vorigGemiddeldWatt !== null && vorigGemiddeldWatt > 0)
    ? Math.round(((gemiddeldWatt - vorigGemiddeldWatt) / vorigGemiddeldWatt) * 100)
    : null

  if (gemiddeldWatt !== null) {
    reden.push(`Vermogen: gemiddeld ${gemiddeldWatt}W over ${vermogenWaarden.length} activiteiten met vermogensdata${vermogenTrendPct !== null ? ` (${vermogenTrendPct > 0 ? '+' : ''}${vermogenTrendPct}% t.o.v. vorige periode)` : ''}`)
  } else {
    reden.push('Vermogen: geen activiteiten met vermogensdata in deze periode (avg_watts ontbreekt)')
  }

  // ── Afstand ────────────────────────────────────────────────────────
  const afstandenM = activiteiten.map(a => haalWaarde(a.metrics, 'distance')).filter((v): v is number => v !== null)
  const totaalKm = Math.round((afstandenM.reduce((a, b) => a + b, 0) / 1000) * 10) / 10
  const gemKmPerActiviteit = afstandenM.length > 0 ? Math.round((totaalKm / afstandenM.length) * 10) / 10 : null
  reden.push(`Afstand: ${totaalKm}km totaal over ${afstandenM.length} activiteiten met afstandsdata`)

  // ── Trainingsbelasting ─────────────────────────────────────────────
  // Vereenvoudigde belasting-indicatie: totale minuten uit zowel losse
  // activiteiten als AI-gecoachte trainingen. GEEN RPE-weging zoals de
  // bestaande trainingsCoachContext in api/coach/route.ts doet, omdat
  // losse activity_sessions doorgaans geen RPE hebben — puur duur-
  // gebaseerd, bewust eenvoudiger en transparant hierover.
  const totaleMinutenActiviteiten = activiteiten.reduce((a, act) => a + (act.duration || 0), 0)
  const totaleMinutenTrainingen = huidigePeriode.trainingsresultaten.reduce((a, t) => a + (t.actual_duration || 0), 0)
  const totaleMinuten = totaleMinutenActiviteiten + totaleMinutenTrainingen
  const gemiddeldPerWeek = (totaleMinuten / periodDays) * 7
  const belastingScore: 'laag' | 'gemiddeld' | 'hoog' = gemiddeldPerWeek < 90 ? 'laag' : gemiddeldPerWeek < 240 ? 'gemiddeld' : 'hoog'
  reden.push(`Trainingsbelasting: ${totaleMinuten} minuten totaal (${Math.round(gemiddeldPerWeek)} min/week gemiddeld) → score "${belastingScore}"`)

  return {
    resultaat: {
      trainingsfrequentie: { aantal_deze_periode: aantalDeze, aantal_vorige_periode: aantalVorige, trend },
      vermogen: { gemiddeld_watt: gemiddeldWatt, max_watt: maxWatt, trend_pct: vermogenTrendPct },
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

// Haalt data op uit een periode die zelf al in het verleden ligt (voor
// trendvergelijking: "de periodDays vóór de huidige periodDays")
async function haalCyclingDataUitVerleden(userId: string, periodDays: number, hoeVerTerug: number) {
  // Simpele aanpak: haal 2x periodDays op, splits dan de oudste helft eruit
  const dubbeleData = await haalCyclingData(userId, periodDays + hoeVerTerug)
  const grensDatum = new Date(Date.now() - hoeVerTerug * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  return {
    ...dubbeleData,
    activiteiten: dubbeleData.activiteiten.filter((a: CyclingActiviteit) => a.date < grensDatum),
    trainingsresultaten: dubbeleData.trainingsresultaten.filter((t: CyclingTrainingResultaat) => t.completed_at < grensDatum),
  }
}
