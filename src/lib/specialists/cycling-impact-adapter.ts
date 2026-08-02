import type { ImpactBijdrage } from '@/core/athlete-platform/impact-engine'

// ── Cycling Impact Adapter (Universal Athlete Platform) ─────────────────
// Bron: overleg 2 augustus 2026 — Cycling als derde sport die de
// Universal Impact Engine voedt (naast Rowing/Running), voor een
// volledig wederzijdse driehoek.
//
// EERLIJK, zelfde soort disclaimer als running-impact-adapter.ts: eigen,
// redelijke inschattingen — geen citaat uit een brondocument. Fietsen:
// hoge cardio, hoge beenbelasting maar minder piek-intensief dan
// hardlopen door het zittende, cyclische karakter, minimale mechanische
// impact (geen grondcontact, in tegenstelling tot hardlopen), lichte
// core-belasting (houding vasthouden), vrijwel geen bovenlichaam.

const REFERENTIE_MINUTEN = 60
const BASIS_IMPACT: Record<string, number> = {
  'cardiovasculair.aerobic_load': 50,
  'spieren.been_vermoeidheid': 55,
  'spieren.core_vermoeidheid': 15,
  'spieren.bovenlichaam_vermoeidheid': 3,
  'mechanisch.gewricht_impact': 8, // vrijwel geen impact, geen grondcontact
}
const BASIS_VERMOEIDHEID = 35

export function vertaalCyclingSessieNaarImpact(duurMinuten: number): ImpactBijdrage[] {
  const schaal = Math.min(1.5, duurMinuten / REFERENTIE_MINUTEN)

  const bijdragen: ImpactBijdrage[] = Object.entries(BASIS_IMPACT).map(([pad, basisWaarde]) => ({
    pad,
    impactWaarde: Math.max(0, Math.min(100, Math.round(basisWaarde * schaal))),
    confidence: 'MEDIUM' as const,
    confidence_score: 55,
  }))

  bijdragen.push({
    pad: 'herstel.herstel_capaciteit',
    impactWaarde: Math.max(0, Math.min(100, Math.round(BASIS_VERMOEIDHEID * schaal))),
    confidence: 'MEDIUM', confidence_score: 55,
  })

  return bijdragen
}
