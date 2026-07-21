import type { EngineResult, ExplanationResult } from '../core/engine-result'
import type { RecoveryValue } from './recovery-engine'

// ── Explainability Engine ────────────────────────────────────────────────
// Bron: overleg 21 juli 2026. BEWUST regelgebaseerd, geen AI-aanroep —
// voorspelbaar, goedkoop, testbaar, geen AI-afhankelijkheid voor
// basisfunctionaliteit. Claude/AI kan dit later verfijnen (mooiere
// zinnen), maar de basisuitleg moet altijd werken, ook zonder AI-call.
//
// Gecentraliseerd — elke engine (Recovery nu, straks Load/Fatigue/
// Readiness/Consistency) gaat door DEZELFDE uitleglaag, geen losse
// uitleglogica per engine.

/**
 * Neemt de top-factoren uit een breakdown (zoals Recovery's) en zet ze
 * om in leesbare +/- zinnen, gesorteerd op absolute bijdrage.
 */
function factorenNaarZinnen(breakdown: { factor: string; bijdrage_score: number }[], aantal: number): string[] {
  return [...breakdown]
    .sort((a, b) => Math.abs(b.bijdrage_score) - Math.abs(a.bijdrage_score))
    .slice(0, aantal)
    .map(f => `${f.bijdrage_score >= 0 ? '+' : '−'} ${f.factor}`)
}

export function verklaarRecovery(result: EngineResult<RecoveryValue>): ExplanationResult {
  const { score, status, breakdown } = result.value
  const topFactoren = factorenNaarZinnen(breakdown, 3)

  const title = status
  let summary: string
  let coachMessage: string

  if (score >= 75) {
    summary = `Herstelscore ${score}/100. De belangrijkste bijdragen: ${topFactoren.join(', ')}.`
    coachMessage = 'Je lichaam is goed hersteld — ruimte voor een pittigere training vandaag.'
  } else if (score >= 50) {
    summary = `Herstelscore ${score}/100, gedeeltelijk hersteld. Belangrijkste factoren: ${topFactoren.join(', ')}.`
    coachMessage = 'Gematigd trainen is vandaag verstandig — luister naar je lichaam.'
  } else {
    summary = `Herstelscore ${score}/100, nog niet volledig hersteld. Belangrijkste factoren: ${topFactoren.join(', ')}.`
    coachMessage = 'Vandaag rustig aan doen of een hersteldag inlassen is verstandig.'
  }

  if (result.confidence.level === 'LOW') {
    summary += ` Let op: deze inschatting is nog onzeker (${result.confidence.limitations[0] || 'beperkte data'}).`
  }

  return { title, summary, coachMessage }
}
