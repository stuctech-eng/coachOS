// ── Smart Action Engine (Coach Planning Fase C) ──────────────────────
// Bron: overleg 31 juli 2026. NIET-ONDERHANDELBAAR, expliciet zo
// vastgelegd: 100% deterministisch, GEEN AI-call. Elke module levert
// een actie-voorstel met een vast prioriteitscijfer aan; deze functie
// kiest alleen de top 3 — geen intelligentie, puur arbitrage.
//
// BELANGRIJKE CORRECTIE tijdens het ontwerp (vastgelegd in README):
// de bestaande Decision Engine (beslisTussenSpecialisten, voor
// trainingsspecialisten) is NIET herbruikt — die is smal getypeerd
// voor specialist-vergelijking (load/risk/importance), niet voor
// generieke actie-voorstellen. Dit is een eigen, nieuwe, generieke
// arbitrage — zelfde filosofie (deterministisch), andere code.

export interface ActionProposal {
  icon: string
  label: string
  href: string
  priority: number // hoger = belangrijker, geen bovengrens
  bron: string // welke module dit voorstelde — voor transparantie/debug
}

/** Kiest de top 3 uit alle voorstellen, hoogste prioriteit eerst. */
export function kiesTop3(voorstellen: ActionProposal[]): ActionProposal[] {
  return [...voorstellen].sort((a, b) => b.priority - a.priority).slice(0, 3)
}
