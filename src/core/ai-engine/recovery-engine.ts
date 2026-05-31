import { DailyCheckin, HealthMetrics, StatusColor } from '@/types'

export interface RecoveryResult {
  score: number // 0-100
  status: 'Volledig hersteld' | 'Gedeeltelijk hersteld' | 'Niet hersteld'
  color: StatusColor
  factors: RecoveryFactor[]
}

export interface RecoveryFactor {
  name: string
  value: number
  weight: number
  impact: 'positive' | 'neutral' | 'negative'
}

export function calculateRecoveryScore(
  checkin: DailyCheckin | null,
  metrics: HealthMetrics | null
): RecoveryResult {
  const factors: RecoveryFactor[] = []
  let totalWeight = 0
  let weightedScore = 0

  // Subjective feeling (weight: 25%)
  if (checkin?.feeling_score) {
    const score = (checkin.feeling_score / 10) * 100
    factors.push({
      name: 'Gevoel',
      value: checkin.feeling_score,
      weight: 25,
      impact: score >= 70 ? 'positive' : score >= 40 ? 'neutral' : 'negative',
    })
    weightedScore += score * 25
    totalWeight += 25
  }

  // Energy score (weight: 20%)
  if (checkin?.energy_score) {
    const score = (checkin.energy_score / 10) * 100
    factors.push({
      name: 'Energie',
      value: checkin.energy_score,
      weight: 20,
      impact: score >= 70 ? 'positive' : score >= 40 ? 'neutral' : 'negative',
    })
    weightedScore += score * 20
    totalWeight += 20
  }

  // Pain penalty
  if (checkin?.has_pain) {
    weightedScore -= 15 * (totalWeight / 100 || 1)
  }

  // HRV (weight: 25%)
  if (metrics?.hrv) {
    // Normalize HRV: assume 60 = excellent, 20 = poor
    const score = Math.min(100, Math.max(0, ((metrics.hrv - 20) / 40) * 100))
    factors.push({
      name: 'HRV',
      value: metrics.hrv,
      weight: 25,
      impact: score >= 70 ? 'positive' : score >= 40 ? 'neutral' : 'negative',
    })
    weightedScore += score * 25
    totalWeight += 25
  }

  // Sleep (weight: 20%)
  if (metrics?.sleep_score) {
    factors.push({
      name: 'Slaap',
      value: metrics.sleep_score,
      weight: 20,
      impact: metrics.sleep_score >= 70 ? 'positive' : metrics.sleep_score >= 50 ? 'neutral' : 'negative',
    })
    weightedScore += metrics.sleep_score * 20
    totalWeight += 20
  }

  // Body Battery (weight: 10%)
  if (metrics?.body_battery) {
    factors.push({
      name: 'Body Battery',
      value: metrics.body_battery,
      weight: 10,
      impact: metrics.body_battery >= 70 ? 'positive' : metrics.body_battery >= 40 ? 'neutral' : 'negative',
    })
    weightedScore += metrics.body_battery * 10
    totalWeight += 10
  }

  // Calculate final score
  const finalScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 50

  let status: RecoveryResult['status']
  let color: StatusColor

  if (finalScore >= 70) {
    status = 'Volledig hersteld'
    color = 'green'
  } else if (finalScore >= 45) {
    status = 'Gedeeltelijk hersteld'
    color = 'orange'
  } else {
    status = 'Niet hersteld'
    color = 'red'
  }

  return { score: finalScore, status, color, factors }
}
