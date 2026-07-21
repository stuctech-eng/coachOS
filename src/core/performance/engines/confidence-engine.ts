import type { PerformanceContext } from '../core/types'
import type { ConfidenceResult, ConfidenceFactors } from '../core/engine-result'
import { CONFIDENCE_DREMPELS, CONFIDENCE_REFERENTIEWAARDEN } from '../core/constants'
import { clamp, scoreNaarConfidenceLevel } from '../shared/scoring'

// ── Confidence Engine ──────────────────────────────────────────────────
// Bron: overleg 21 juli 2026. "De poortwachter" — draait vóór elke
// andere engine, want die geven hun uitkomst altijd samen met een
// Confidence-resultaat terug. VOLLEDIG DETERMINISTISCH, geen AI.
//
// Bewust NIET "onvoldoende data, geen score" — een score bestaat altijd
// vanaf dag 1, MET een eerlijke betrouwbaarheidsindicatie erbij. Zie
// overleg: "Endurance Index 73, Confidence 41%, gebaseerd op 9
// trainingen" is eerlijker dan "nog niet beschikbaar".

export function berekenConfidence(context: PerformanceContext): ConfidenceResult {
  const limitations: string[] = []

  // Dataomvang — aantal activiteiten t.o.v. de referentiewaarde
  const dataAmount = clamp(
    Math.round((context.activities.total / CONFIDENCE_REFERENTIEWAARDEN.ACTIVITEITEN_VOOR_VOLLEDIGE_SCORE) * 100),
    0, 100
  )
  if (context.activities.total < 10) {
    limitations.push(`Slechts ${context.activities.total} activiteit${context.activities.total === 1 ? '' : 'en'} bekend`)
  }

  // Versheid — activiteit in de laatste 30 dagen t.o.v. het totaal.
  // Iemand die nooit meer traint moet niet hoog scoren op versheid.
  const dataFreshness = context.activities.total > 0
    ? clamp(Math.round((context.activities.last30Days / Math.min(context.activities.total, 12)) * 100), 0, 100)
    : 0
  if (context.activities.last30Days === 0 && context.activities.total > 0) {
    limitations.push('Geen recente activiteit in de laatste 30 dagen')
  }

  // Sensordekking — hoeveel van de vier health-velden beschikbaar zijn
  const beschikbareVelden = [context.health.hrvAvailable, context.health.sleepAvailable, context.health.bodyBatteryAvailable, context.health.restingHrAvailable]
  const sensorCoverage = Math.round((beschikbareVelden.filter(Boolean).length / beschikbareVelden.length) * 100)
  if (!context.health.hrvAvailable) limitations.push('HRV-data ontbreekt, interpretatie leunt op trainingshistorie')
  if (!context.health.sleepAvailable) limitations.push('Slaapdata ontbreekt')

  // Trainingshistorie — aantal dagen tracked t.o.v. de referentiewaarde
  const trainingHistory = clamp(
    Math.round((context.history.daysTracked / CONFIDENCE_REFERENTIEWAARDEN.DAGEN_TRACKED_VOOR_VOLLEDIGE_SCORE) * 100),
    0, 100
  )

  const factors: ConfidenceFactors = { dataAmount, dataFreshness, sensorCoverage, trainingHistory }

  // Eindscore: gemiddelde van de vier factoren — bewust gelijk gewogen,
  // geen enkele factor domineert
  const score = Math.round((dataAmount + dataFreshness + sensorCoverage + trainingHistory) / 4)
  const level = scoreNaarConfidenceLevel(score, CONFIDENCE_DREMPELS.MEDIUM, CONFIDENCE_DREMPELS.HIGH)

  return { score, level, factors, limitations }
}
