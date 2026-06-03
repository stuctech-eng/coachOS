import { DailyCheckin, HealthMetrics, StatusColor } from '@/types'

export interface RecoveryResult {
  score: number
  status: string
  color: StatusColor
}

export function calculateRecoveryScore(
  checkin: DailyCheckin | null,
  metrics: HealthMetrics | null,
  lifeEventPenalty: number = 0
): RecoveryResult {
  let total = 0
  let count = 0

  // Gevoel
  if (checkin?.feeling_score) {
    total += (checkin.feeling_score / 10) * 100
    count++
  }

  // Energie
  if (checkin?.energy_score) {
    total += (checkin.energy_score / 10) * 100
    count++
  }

  // Stress (omgekeerd — hoge stress = lage score)
  if ((checkin as DailyCheckin & { stress_score?: number })?.stress_score) {
    const stressScore = (checkin as DailyCheckin & { stress_score?: number }).stress_score!
    total += ((10 - stressScore) / 10) * 100
    count++
  }

  // Motivatie
  if ((checkin as DailyCheckin & { motivation_score?: number })?.motivation_score) {
    const motivatieScore = (checkin as DailyCheckin & { motivation_score?: number }).motivation_score!
    total += (motivatieScore / 10) * 100
    count++
  }

  // Spierpijn (omgekeerd)
  if ((checkin as DailyCheckin & { soreness_score?: number })?.soreness_score) {
    const spierpijnScore = (checkin as DailyCheckin & { soreness_score?: number }).soreness_score!
    total += ((10 - spierpijnScore) / 10) * 100
    count++
  }

  // Slaapkwaliteit (subjectief)
  if ((checkin as DailyCheckin & { sleep_quality?: number })?.sleep_quality) {
    const slaapScore = (checkin as DailyCheckin & { sleep_quality?: number }).sleep_quality!
    total += (slaapScore / 10) * 100
    count++
  }

  // Pijn
  if (checkin?.has_pain) total -= 15

  // HRV
  if (metrics?.hrv) {
    const hrvScore = Math.min(100, Math.max(0, ((metrics.hrv - 20) / 60) * 100))
    total += hrvScore
    count++
  }

  // Rusthartslag
  if (metrics?.resting_hr) {
    const hrScore = Math.min(100, Math.max(0, ((90 - metrics.resting_hr) / 50) * 100))
    total += hrScore
    count++
  }

  // Slaap score (objectief)
  if (metrics?.sleep_score) {
    total += Math.min(100, Math.max(0, metrics.sleep_score))
    count++
  }

  // Slaap duur
  if (metrics?.sleep_duration) {
    const slaapScore = metrics.sleep_duration >= 7 && metrics.sleep_duration <= 9 ? 100
      : metrics.sleep_duration >= 6 ? 70
      : metrics.sleep_duration >= 5 ? 40
      : 20
    total += slaapScore
    count++
  }

  // Body battery
  if (metrics?.body_battery) {
    total += Math.min(100, Math.max(0, metrics.body_battery))
    count++
  }

  // Bereken score
  let score = count > 0
    ? Math.max(0, Math.min(100, Math.round(total / count)))
    : 50

  // Life event penalty toepassen
  score = Math.max(0, score - lifeEventPenalty)

  if (score >= 75) return { score, status: 'Volledig hersteld', color: 'green' }
  if (score >= 50) return { score, status: 'Gedeeltelijk hersteld', color: 'orange' }
  return { score, status: 'Niet hersteld', color: 'red' }
}
