import type { ImpactBijdrage } from '@/core/athlete-platform/impact-engine'

// ── Rowing Impact Adapter (Universal Athlete Platform) ──────────────────
// Bron: overleg 2 augustus 2026 — Rowing als eerste specialist die de
// Universal Impact Engine daadwerkelijk voedt. Vertaalt een voltooide
// roeisessie naar universele bijdragen, EXACT de verhoudingen uit het
// oorspronkelijke visie-voorbeeld (90 min roeien: Cardio+65/Core+80/
// Upper Body+75/Legs+45/Impact+5/Fatigue+60) — bewust niet zelf
// verzonnen, maar overgenomen uit het document dat tot dit platform leidde.
//
// EERLIJK: dit is een eenvoudige, duur-geschaalde toepassing van die
// verhoudingen (een langere sessie schaalt evenredig mee, tot een
// plafond) — geen gevalideerde sportwetenschappelijke formule. Confidence
// daarom bewust op MEDIUM gezet, niet HIGH.

// Basisverhoudingen bij een "referentiesessie" van 60 minuten,
// rechtstreeks overgenomen uit de Master Vision (herschaald van het
// 90-min-voorbeeld naar 60 min als neutrale basis)
const REFERENTIE_MINUTEN = 60
const BASIS_IMPACT: Record<string, number> = {
  'cardiovasculair.aerobic_load': 43, // 65 * 60/90
  'spieren.core_vermoeidheid': 53,     // 80 * 60/90
  'spieren.bovenlichaam_vermoeidheid': 50, // 75 * 60/90
  'spieren.been_vermoeidheid': 30,     // 45 * 60/90
  'mechanisch.gewricht_impact': 3,      // 5 * 60/90
}
// "Fatigue +60" uit de visie — apart behandeld, zie toelichting in de functie
const BASIS_VERMOEIDHEID = 40 // 60 * 60/90

/** Vertaalt een voltooide roeisessie (duur in minuten) naar universele
 * impact-bijdragen. Schaalt lineair met duur t.o.v. de 60-min-basis,
 * geklemd op maximaal 150% (voorkomt dat een extreem lange sessie de
 * staat onrealistisch laat pieken). */
export function vertaalRowingSessieNaarImpact(duurMinuten: number): ImpactBijdrage[] {
  const schaal = Math.min(1.5, duurMinuten / REFERENTIE_MINUTEN)

  const bijdragen: ImpactBijdrage[] = Object.entries(BASIS_IMPACT).map(([pad, basisWaarde]) => ({
    pad,
    impactWaarde: Math.max(0, Math.min(100, Math.round(basisWaarde * schaal))),
    confidence: 'MEDIUM' as const,
    confidence_score: 60,
  }))

  // "Fatigue +60" uit de visie vertaalt naar herstel_capaciteit — meer
  // vermoeidheid = LAGERE herstelcapaciteit, dus hier bewust als
  // "hoeveel vermoeidheid deze sessie toevoegt" (0-100, hoger = zwaarder)
  bijdragen.push({
    pad: 'herstel.herstel_capaciteit',
    impactWaarde: Math.max(0, Math.min(100, Math.round(BASIS_VERMOEIDHEID * schaal))),
    confidence: 'MEDIUM', confidence_score: 60,
  })

  return bijdragen
}
