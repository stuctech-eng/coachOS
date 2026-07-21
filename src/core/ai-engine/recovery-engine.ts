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

// v2.4.148 (CoachPolicy Niveau 2): minimale interface, alleen de twee
// velden die deze berekening nodig heeft — niet de volledige
// performance_snapshots-rij, om deze module niet te koppelen aan het
// hele Performance-schema.
export interface PerformanceVoorRecovery {
  training_readiness: number | null
  load_ratio: number | null
}

// Training Readiness telt mee met een BESCHEIDEN gewicht — het is
// Garmin's eigen samengestelde herstelindicator en overlapt daardoor
// deels met HRV/slaap/trainingsbelasting die al apart meetellen. Vult
// aan, domineert niet.
const TRAINING_READINESS_GEWICHT = 0.5

// ACWR (Acute:Chronic Workload Ratio) is GEEN herstelsignaal — het zegt
// niets over hoe goed iemand hersteld is, wel iets over het
// blessurerisico van de huidige trainingsbelasting. Daarom geen
// gemiddelde-factor, maar een vaste correctie NA het gemiddelde (net
// als lifeEventPenalty) — oplopend, geen harde knip bij 1,5.
function berekenAcwrCorrectie(loadRatio: number | null): number {
  if (loadRatio === null || loadRatio === undefined) return 0
  if (loadRatio > 1.7) return 15
  if (loadRatio > 1.5) return 10
  if (loadRatio > 1.3) return 5
  return 0
  // Bewust GEEN correctie bij een lage ratio (<0,8) — dat is een
  // fitness-/trainingsplan-vraag (te weinig belasting), geen
  // herstelvraag. Hoort thuis bij de Goal Engine/specialist, niet hier.
}

export function calculateRecoveryScore(
  checkin: DailyCheckin | null,
  metrics: HealthMetrics | null,
  lifeEventPenalty: number = 0,
  performance: PerformanceVoorRecovery | null = null
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

  // Training Readiness — v2.4.148, bescheiden gewicht (zie toelichting
  // hierboven bij TRAINING_READINESS_GEWICHT)
  if (performance?.training_readiness !== null && performance?.training_readiness !== undefined) {
    const bijdrage = Math.min(100, Math.max(0, performance.training_readiness)) * TRAINING_READINESS_GEWICHT
    total += bijdrage
    count += TRAINING_READINESS_GEWICHT
    breakdown.push({ factor: `Training Readiness (gewicht ${TRAINING_READINESS_GEWICHT}×)`, ruwe_waarde: `${performance.training_readiness}`, bijdrage_score: Math.round(bijdrage) })
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

  // ACWR-risicocorrectie — v2.4.148, NA het gemiddelde toegepast (niet
  // verdund door het aantal factoren), zie berekenAcwrCorrectie()
  const acwrCorrectie = berekenAcwrCorrectie(performance?.load_ratio ?? null)
  if (acwrCorrectie > 0) {
    breakdown.push({ factor: `Belastingsverhouding-risico (ACWR ${performance?.load_ratio})`, ruwe_waarde: `${performance?.load_ratio}`, bijdrage_score: -acwrCorrectie })
  }
  score = Math.max(0, score - acwrCorrectie)

  if (score >= 75) return { score, status: 'Volledig hersteld', color: 'green', breakdown }
  if (score >= 50) return { score, status: 'Gedeeltelijk hersteld', color: 'orange', breakdown }
  return { score, status: 'Niet hersteld', color: 'red', breakdown }
}
