// ── Performance Intelligence Platform — constanten ──────────────────────

export const CONFIDENCE_DREMPELS = {
  HIGH: 75,
  MEDIUM: 40,
  // < MEDIUM = LOW
} as const

// Hoeveel activiteiten/dagen als "veel data" gelden — bewust
// conservatieve, ronde getallen, geen wetenschappelijke claim. Aan te
// passen zodra er ervaring is met echte gebruikers.
export const CONFIDENCE_REFERENTIEWAARDEN = {
  ACTIVITEITEN_VOOR_VOLLEDIGE_SCORE: 40,
  DAGEN_TRACKED_VOOR_VOLLEDIGE_SCORE: 90,
} as const
