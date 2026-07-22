// ── Split-analyse — Negative/Positive Split + pacing-consistentie ──────
// Bron: overleg 22 juli 2026, Running Specialist Fase 2 (Professional).
// Hergebruikt de afstandMetTijd-reeks die al werd verzameld voor de
// afstandscurve (v2.4.128) — geen wijziging aan de trackpoint-loop
// nodig, puur een nieuwe berekening op bestaande data.
//
// "Negative split" = tweede helft sneller dan eerste helft (klassiek
// een teken van goede pacing bij duurlopen/wedstrijden — publiek
// bekend, wijdverspreid concept, geen propriëtaire claim).
// "Positive split" = tweede helft langzamer.
//
// Pacing-consistentie: variatiecoëfficiënt (standaarddeviatie/gemiddelde)
// van de pace over 4 kwart-segmenten — lager is consistenter. Ook dit
// een publiek, generiek statistisch concept, geen eigen uitvinding.

export interface SplitAnalyse {
  eerste_helft_pace_sec_per_km: number
  tweede_helft_pace_sec_per_km: number
  verschil_pct: number // negatief = negative split (tweede helft sneller)
  type: 'negative_split' | 'positive_split' | 'gelijkmatig'
  pacing_consistentie_score: number // 0-100, hoger = consistenter
}

export function berekenSplitAnalyse(afstandMetTijd: { tijdSec: number; afstandM: number }[]): SplitAnalyse | null {
  if (afstandMetTijd.length < 4) return null // te weinig punten voor een betrouwbare split

  const totaleAfstand = afstandMetTijd[afstandMetTijd.length - 1].afstandM
  const totaleTijd = afstandMetTijd[afstandMetTijd.length - 1].tijdSec
  if (totaleAfstand < 500 || totaleTijd <= 0) return null // te kort voor een zinvolle split (< 500m)

  const halveAfstand = totaleAfstand / 2
  const halverwegePunt = afstandMetTijd.find(p => p.afstandM >= halveAfstand)
  if (!halverwegePunt) return null

  const tijdEersteHelft = halverwegePunt.tijdSec
  const tijdTweedeHelft = totaleTijd - tijdEersteHelft
  if (tijdEersteHelft <= 0 || tijdTweedeHelft <= 0) return null

  const paceEersteHelft = tijdEersteHelft / (halveAfstand / 1000)
  const paceTweedeHelft = tijdTweedeHelft / (halveAfstand / 1000)

  // Negatief % = tweede helft heeft een LAGER pace-getal = sneller
  const verschilPct = Math.round(((paceTweedeHelft - paceEersteHelft) / paceEersteHelft) * 1000) / 10

  let type: SplitAnalyse['type']
  if (verschilPct <= -2) type = 'negative_split'
  else if (verschilPct >= 2) type = 'positive_split'
  else type = 'gelijkmatig'

  // ── Pacing-consistentie: 4 kwart-segmenten, variatiecoëfficiënt ─────
  const kwartAfstand = totaleAfstand / 4
  const kwartPaces: number[] = []
  let vorigeTijd = 0
  let vorigeAfstand = 0
  for (let kwart = 1; kwart <= 4; kwart++) {
    const doelAfstand = kwartAfstand * kwart
    const punt = afstandMetTijd.find(p => p.afstandM >= doelAfstand)
    if (!punt) break
    const segmentAfstand = punt.afstandM - vorigeAfstand
    const segmentTijd = punt.tijdSec - vorigeTijd
    if (segmentAfstand > 0 && segmentTijd > 0) {
      kwartPaces.push(segmentTijd / (segmentAfstand / 1000))
    }
    vorigeTijd = punt.tijdSec
    vorigeAfstand = punt.afstandM
  }

  let pacingConsistentieScore = 50 // neutrale standaardwaarde als er te weinig segmenten zijn
  if (kwartPaces.length === 4) {
    const gemiddelde = kwartPaces.reduce((a, b) => a + b, 0) / kwartPaces.length
    const variantie = kwartPaces.reduce((s, p) => s + Math.pow(p - gemiddelde, 2), 0) / kwartPaces.length
    const stdDev = Math.sqrt(variantie)
    const variatiecoefficient = gemiddelde > 0 ? stdDev / gemiddelde : 0
    // 0% variatie -> 100, 15%+ variatie -> 0 (ronde, redelijke bandbreedte)
    pacingConsistentieScore = Math.round(Math.min(100, Math.max(0, (1 - variatiecoefficient / 0.15) * 100)))
  }

  return {
    eerste_helft_pace_sec_per_km: Math.round(paceEersteHelft),
    tweede_helft_pace_sec_per_km: Math.round(paceTweedeHelft),
    verschil_pct: verschilPct,
    type,
    pacing_consistentie_score: pacingConsistentieScore,
  }
}
