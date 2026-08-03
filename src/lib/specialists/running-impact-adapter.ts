import type { ImpactBijdrage } from '@/core/athlete-platform/impact-engine'

// ── Running Impact Adapter (Universal Athlete Platform) ─────────────────
// Bron: overleg 2 augustus 2026 — Running als tweede sport die de
// Universal Impact Engine voedt (naast Rowing). Nodig voor een écht
// WEDERZIJDS cross-sport-principe: niet alleen "roeien beïnvloedt
// hardlopen" (al gebouwd, v2.4.238/241), maar ook omgekeerd.
//
// EERLIJK, ANDERS DAN ROWING'S ADAPTER: voor Rowing kon de Master
// Vision letterlijk geciteerd worden (90 min roeien → exacte cijfers
// stonden al in het document). Voor Running bestaat zo'n vastgelegd
// voorbeeld niet — dit zijn EIGEN, redelijke inschattingen gebaseerd op
// bekende looptrainingsfysiologie (hoge cardio/beenbelasting, lage
// bovenlichaam/core-belasting vergeleken met roeien, hogere mechanische
// impact door grondcontact), GEEN citaat uit een brondocument. Confidence
// daarom bewust op MEDIUM, net als Rowing's adapter.

const REFERENTIE_MINUTEN = 60
const BASIS_IMPACT: Record<string, number> = {
  'cardiovasculair.aerobic_load': 55,       // hardlopen is zeer cardio-intensief
  'spieren.been_vermoeidheid': 70,           // benen zijn de primaire aandrijving
  'spieren.core_vermoeidheid': 20,           // enige core-stabilisatie, veel minder dan roeien
  'spieren.bovenlichaam_vermoeidheid': 5,    // minimale bovenlichaam-belasting
  'mechanisch.gewricht_impact': 60,          // grondcontact — significant hoger dan roeien (~5)
}
const BASIS_VERMOEIDHEID = 45 // impact op herstel_capaciteit

/** Vertaalt een voltooide hardloopsessie (duur in minuten) naar
 * universele impact-bijdragen. Zelfde schaal-/plafondlogica als
 * rowing-impact-adapter.ts — geen nieuw patroon verzonnen. */
export function vertaalRunningSessieNaarImpact(duurMinuten: number): ImpactBijdrage[] {
  const schaal = Math.min(1.5, duurMinuten / REFERENTIE_MINUTEN)

  const bijdragen: ImpactBijdrage[] = Object.entries(BASIS_IMPACT).map(([pad, basisWaarde]) => ({
    pad,
    impactWaarde: Math.max(0, Math.min(100, Math.round(basisWaarde * schaal))),
    confidence: 'MEDIUM' as const,
    confidence_score: 55, // iets lager dan Rowing's 60 — deze cijfers zijn een eigen inschatting, geen citaat uit een brondocument
    bronSport: 'running',
  }))

  bijdragen.push({
    pad: 'herstel.herstel_capaciteit',
    impactWaarde: Math.max(0, Math.min(100, Math.round(BASIS_VERMOEIDHEID * schaal))),
    confidence: 'MEDIUM', confidence_score: 55, bronSport: 'running',
  })

  return bijdragen
}
