import { DailyCheckin, HealthMetrics, StatusColor } from '@/types'

export interface RecoveryResult {
  score: number
  status: string
  color: StatusColor
}

export function calculateRecoveryScore(
  checkin: DailyCheckin | null,
  metrics: HealthMetrics | null
): RecoveryResult {
  let total = 0
  let count = 0

  // Subjectieve data
  if (checkin?.feeling_score) {
    total += (checkin.feeling_score / 10) * 100
    count++
  }
  if (checkin?.energy_score) {
    total += (checkin.energy_score / 10) * 100
    count++
  }
  if (checkin?.has_pain) {
    total -= 15 // Pijn verlaagt score maar telt niet mee in gemiddelde
  }

  // HRV — hogere waarde = beter hersteld
  // Normaal bereik: 20-80ms, schaal naar 0-100
  if (metrics?.hrv) {
    const hrvScore = Math.min(100, Math.max(0, ((metrics.hrv - 20) / 60) * 100))
    total += hrvScore
    count++
  }

  // Rusthartslag — lagere waarde = beter hersteld
  // Normaal bereik: 40-90 bpm
  if (metrics?.resting_hr) {
    const hrScore = Math.min(100, Math.max(0, ((90 - metrics.resting_hr) / 50) * 100))
    total += hrScore
    count++
  }

  // Slaap score
  if (metrics?.sleep_score) {
    total += Math.min(100, Math.max(0, metrics.sleep_score))
    count++
  }

  // Slaap duur — optimaal 7-9 uur
  if (metrics?.sleep_duration) {
    const slaapScore = metrics.sleep_duration >= 7 && metrics.sleep_duration <= 9
      ? 100
      : metrics.sleep_duration >= 6
        ? 70
        : metrics.sleep_duration >= 5
          ? 40
          : 20
    total += slaapScore
    count++
  }

  // Body battery (Garmin)
  if (metrics?.body_battery) {
    total += Math.min(100, Math.max(0, metrics.body_battery))
    count++
  }

  // Bereken score — begrensd tussen 0 en 100
  const score = count > 0
    ? Math.max(0, Math.min(100, Math.round(total / count)))
    : 50

  if (score >= 75) return { score, status: 'Volledig hersteld', color: 'green' }
  if (score >= 50) return { score, status: 'Gedeeltelijk hersteld', color: 'orange' }
  return { score, status: 'Niet hersteld', color: 'red' }
}
