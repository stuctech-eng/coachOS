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

  if (checkin?.feeling_score) { total += (checkin.feeling_score / 10) * 100; count++ }
  if (checkin?.energy_score) { total += (checkin.energy_score / 10) * 100; count++ }
  if (checkin?.has_pain) total -= 15
  if (metrics?.sleep_score) { total += metrics.sleep_score; count++ }
  if (metrics?.hrv) { total += Math.min(100, Math.max(0, ((metrics.hrv - 20) / 40) * 100)); count++ }
  if (metrics?.body_battery) { total += metrics.body_battery; count++ }

  const score = count > 0 ? Math.round(total / count) : 50
  if (score >= 70) return { score, status: 'Volledig hersteld', color: 'green' }
  if (score >= 45) return { score, status: 'Gedeeltelijk hersteld', color: 'orange' }
  return { score, status: 'Niet hersteld', color: 'red' }
}
