// ── Afstandscurve-berekening — Running Records ──────────────────────────
// Bron: Running Specialist Roadmap v1.0, Fase 1. VOLLEDIG DETERMINISTISCH
// — geen AI. Isomorf (geen server-only imports).
//
// Spiegelbeeld van vermogenscurve.ts, maar met vast en variabel omgedraaid:
// vermogenscurve zoekt "beste GEMIDDELDE over een vaste TIJD" (bijv. beste
// 5 minuten). Dit hier zoekt "snelste TIJD over een vaste AFSTAND" (bijv.
// snelste 5 km) — het venster schuift dus tot de afstand behaald is,
// i.p.v. tot de tijd om is.

export interface AfstandsPunt {
  tijdSec: number // seconden sinds start van de activiteit
  afstandM: number // CUMULATIEVE afstand sinds start van de activiteit
}

export interface AfstandsCurvePunt {
  afstand_m: number
  tijd_sec: number
}

// Standaard doelafstanden — Master Spec-lijst, "1 km" weggelaten (zelfde
// als 1000m, geen dubbele rij). "Ultra" heeft geen vaste afstand en
// wordt dus niet hier berekend — dat blijft "langste rit" op het
// Dashboard.
export const STANDAARD_DOELAFSTANDEN = [
  100, 200, 400, 800, 1000, 1609, 3000, 5000, 10000, 15000, 16093, 21097, 25000, 30000, 42195,
]

export function berekenAfstandscurve(reeks: AfstandsPunt[], doelen: number[] = STANDAARD_DOELAFSTANDEN): AfstandsCurvePunt[] {
  if (reeks.length < 2) return []

  const gesorteerd = [...reeks].sort((a, b) => a.tijdSec - b.tijdSec)
  const totaalAfstand = gesorteerd[gesorteerd.length - 1].afstandM - gesorteerd[0].afstandM

  const resultaat: AfstandsCurvePunt[] = []

  for (const doelM of doelen) {
    if (doelM > totaalAfstand) continue // activiteit te kort voor deze afstand

    let besteTijd = Infinity
    let linksIndex = 0

    // Voor elk rechts-eindpunt: schuif links zo ver mogelijk op zolang
    // de afgelegde afstand nog steeds >= doel is — dat geeft het
    // krapste (dus snelste) venster dat op dit punt eindigt. Omdat
    // afstand monotoon stijgt met tijd, beweegt de optimale links-
    // grens alleen maar vooruit naarmate rechts vordert — vandaar dat
    // dit in totaal O(n) is, niet O(n²).
    for (let rechtsIndex = 0; rechtsIndex < gesorteerd.length; rechtsIndex++) {
      while (
        linksIndex <= rechtsIndex &&
        gesorteerd[rechtsIndex].afstandM - gesorteerd[linksIndex].afstandM >= doelM
      ) {
        const tijd = gesorteerd[rechtsIndex].tijdSec - gesorteerd[linksIndex].tijdSec
        if (tijd < besteTijd) besteTijd = tijd
        linksIndex++
      }
    }

    if (besteTijd < Infinity) {
      resultaat.push({ afstand_m: doelM, tijd_sec: Math.round(besteTijd) })
    }
  }

  return resultaat
}
