import { DailyCheckin, HealthMetrics, StatusColor } from '@/types'

export interface RecoveryFactorBreakdown {
  factor: string
  ruwe_waarde: string
  bijdrage_score: number
}

export interface RecoveryResult {
  score: number
  status: string
  color: StatusColor
  // v2.4.144: puur additief, voor het Recovery Debug Dashboard — de
  // score/status/color-berekening hieronder is NIET gewijzigd, dit legt
  // alleen vast welke factor hoeveel bijdroeg, voor transparantie.
  breakdown: RecoveryFactorBreakdown[]
}

export function calculateRecoveryScore(
  checkin: DailyCheckin | null,
  metrics: HealthMetrics | null,
  lifeEventPenalty: number = 0
): RecoveryResult {
  let total = 0
  let count = 0
  const breakdown: RecoveryFactorBreakdown[] = []

  // Gevoel
  if (checkin?.feeling_score) {
    const bijdrage = (checkin.feeling_score / 10) * 100
    total += bijdrage
    count++
    breakdown.push({ factor: 'Gevoel', ruwe_waarde: `${checkin.feeling_score}/10`, bijdrage_score: Math.round(bijdrage) })
  }

  // Energie
  if (checkin?.energy_score) {
    const bijdrage = (checkin.energy_score / 10) * 100
    total += bijdrage
    count++
    breakdown.push({ factor: 'Energie', ruwe_waarde: `${checkin.energy_score}/10`, bijdrage_score: Math.round(bijdrage) })
  }

  // Stress (omgekeerd — hoge stress = lage score)
  if (checkin?.stress_score) {
    const bijdrage = ((10 - checkin.stress_score) / 10) * 100
    total += bijdrage
    count++
    breakdown.push({ factor: 'Stress', ruwe_waarde: `${checkin.stress_score}/10`, bijdrage_score: Math.round(bijdrage) })
  }

  // Motivatie
  if (checkin?.motivation_score) {
    const bijdrage = (checkin.motivation_score / 10) * 100
    total += bijdrage
    count++
    breakdown.push({ factor: 'Motivatie', ruwe_waarde: `${checkin.motivation_score}/10`, bijdrage_score: Math.round(bijdrage) })
  }

  // Spierpijn (omgekeerd)
  if (checkin?.soreness_score) {
    const bijdrage = ((10 - checkin.soreness_score) / 10) * 100
    total += bijdrage
    count++
    breakdown.push({ factor: 'Spierpijn', ruwe_waarde: `${checkin.soreness_score}/10`, bijdrage_score: Math.round(bijdrage) })
  }

  // Slaapkwaliteit (subjectief)
  if (checkin?.sleep_quality) {
    const bijdrage = (checkin.sleep_quality / 10) * 100
    total += bijdrage
    count++
    breakdown.push({ factor: 'Slaapkwaliteit (subjectief)', ruwe_waarde: `${checkin.sleep_quality}/10`, bijdrage_score: Math.round(bijdrage) })
  }

  // Pijn
  if (checkin?.has_pain) {
    total -= 15
    breakdown.push({ factor: 'Pijn gemeld', ruwe_waarde: 'ja', bijdrage_score: -15 })
  }

  // HRV
  if (metrics?.hrv) {
    const hrvScore = Math.min(100, Math.max(0, ((metrics.hrv - 20) / 60) * 100))
    total += hrvScore
    count++
    breakdown.push({ factor: 'HRV', ruwe_waarde: `${metrics.hrv} ms`, bijdrage_score: Math.round(hrvScore) })
  }

  // Rusthartslag
  if (metrics?.resting_hr) {
    const hrScore = Math.min(100, Math.max(0, ((90 - metrics.resting_hr) / 50) * 100))
    total += hrScore
    count++
    breakdown.push({ factor: 'Rusthartslag', ruwe_waarde: `${metrics.resting_hr} bpm`, bijdrage_score: Math.round(hrScore) })
  }

  // Slaap score (objectief)
  if (metrics?.sleep_score) {
    const bijdrage = Math.min(100, Math.max(0, metrics.sleep_score))
    total += bijdrage
    count++
    breakdown.push({ factor: 'Slaapscore (Garmin)', ruwe_waarde: `${metrics.sleep_score}`, bijdrage_score: Math.round(bijdrage) })
  }

  // Slaap duur
  if (metrics?.sleep_duration) {
    const slaapScore = metrics.sleep_duration >= 7 && metrics.sleep_duration <= 9 ? 100
      : metrics.sleep_duration >= 6 ? 70
      : metrics.sleep_duration >= 5 ? 40
      : 20
    total += slaapScore
    count++
    breakdown.push({ factor: 'Slaapduur', ruwe_waarde: `${metrics.sleep_duration}u`, bijdrage_score: slaapScore })
  }

  // Body battery
  if (metrics?.body_battery) {
    const bijdrage = Math.min(100, Math.max(0, metrics.body_battery))
    total += bijdrage
    count++
    breakdown.push({ factor: 'Body Battery', ruwe_waarde: `${metrics.body_battery}`, bijdrage_score: Math.round(bijdrage) })
  }

  // Bereken score
  let score = count > 0
    ? Math.max(0, Math.min(100, Math.round(total / count)))
    : 50

  // Life event penalty
  if (lifeEventPenalty > 0) {
    breakdown.push({ factor: 'Levensgebeurtenis-correctie', ruwe_waarde: `-${lifeEventPenalty}`, bijdrage_score: -lifeEventPenalty })
  }
  score = Math.max(0, score - lifeEventPenalty)

  if (score >= 75) return { score, status: 'Volledig hersteld', color: 'green', breakdown }
  if (score >= 50) return { score, status: 'Gedeeltelijk hersteld', color: 'orange', breakdown }
  return { score, status: 'Niet hersteld', color: 'red', breakdown }
}
