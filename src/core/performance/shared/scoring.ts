// ── Performance Intelligence Platform — gedeelde score-hulpfuncties ────

/** Begrenst een waarde tussen min en max. */
export function clamp(waarde: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, waarde))
}

/** Zet een 0-100-score om naar een label op basis van drempelwaarden. */
export function scoreNaarConfidenceLevel(score: number, medium: number, high: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (score >= high) return 'HIGH'
  if (score >= medium) return 'MEDIUM'
  return 'LOW'
}
