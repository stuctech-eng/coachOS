// Risk Engine
// Detecteert automatisch risico's op basis van trends

export type RiskFlag =
  | 'Overtraining Risico'
  | 'Ziekte Risico'
  | 'Slaapschuld'
  | 'Blessure Risico'
  | 'Mentale Vermoeidheid'
  | 'Herstel Tekort'

export interface RiskResult {
  flags: RiskFlag[]
  hoogsteRisico: RiskFlag | null
  urgentie: 'hoog' | 'gemiddeld' | 'laag' | 'geen'
}

interface TrendData {
  date: string
  hrv?: number | null
  resting_hr?: number | null
  sleep_duration?: number | null
  sleep_score?: number | null
  steps?: number | null
}

interface CheckinTrend {
  date: string
  energy_score?: number | null
  feeling_score?: number | null
}

interface ActiviteitTrend {
  date: string
  duration: number
}

function gemiddelde(waarden: number[]): number {
  if (waarden.length === 0) return 0
  return waarden.reduce((a, b) => a + b, 0) / waarden.length
}

function trend(waarden: number[]): 'stijgend' | 'dalend' | 'stabiel' {
  if (waarden.length < 3) return 'stabiel'
  const eerste = gemiddelde(waarden.slice(0, Math.ceil(waarden.length / 2)))
  const laatste = gemiddelde(waarden.slice(Math.floor(waarden.length / 2)))
  const verschil = ((laatste - eerste) / Math.max(eerste, 1)) * 100
  if (verschil > 8) return 'stijgend'
  if (verschil < -8) return 'dalend'
  return 'stabiel'
}

export function detectRisks(
  metrics: TrendData[],
  checkins: CheckinTrend[],
  activiteiten: ActiviteitTrend[],
  heeftBlessure: boolean = false
): RiskResult {
  const flags: RiskFlag[] = []

  // Sorteer op datum
  const m = [...metrics].sort((a, b) => a.date.localeCompare(b.date))
  const c = [...checkins].sort((a, b) => a.date.localeCompare(b.date))

  // HRV trend
  const hrvWaarden = m.filter(x => x.hrv).map(x => x.hrv as number)
  const hrTrend = m.filter(x => x.resting_hr).map(x => x.resting_hr as number)

  // Activiteiten volume trend
  const now = new Date()
  const weekGeleden = new Date(now)
  weekGeleden.setDate(now.getDate() - 7)
  const tweeWekenGeleden = new Date(now)
  tweeWekenGeleden.setDate(now.getDate() - 14)

  const dezeWeekMin = activiteiten
    .filter(a => new Date(a.date) >= weekGeleden)
    .reduce((a, s) => a + s.duration, 0)
  const vorigeWeekMin = activiteiten
    .filter(a => new Date(a.date) >= tweeWekenGeleden && new Date(a.date) < weekGeleden)
    .reduce((a, s) => a + s.duration, 0)

  // 1. OVERTRAINING RISICO
  // HRV daalt + RHR stijgt + trainingsvolume stijgt
  const hrvTrend = trend(hrvWaarden)
  const rhrTrend = trend(hrTrend)
  const volumeStijgt = vorigeWeekMin > 0 && dezeWeekMin > vorigeWeekMin * 1.2

  if (hrvTrend === 'dalend' && rhrTrend === 'stijgend' && volumeStijgt) {
    flags.push('Overtraining Risico')
  } else if (hrvTrend === 'dalend' && volumeStijgt) {
    flags.push('Herstel Tekort')
  }

  // 2. ZIEKTE RISICO
  // HRV crash (plotselinge daling) + RHR omhoog
  if (hrvWaarden.length >= 3) {
    const recentHrv = gemiddelde(hrvWaarden.slice(-2))
    const eerderHrv = gemiddelde(hrvWaarden.slice(0, -2))
    const hrvDaling = eerderHrv > 0 && ((eerderHrv - recentHrv) / eerderHrv) > 0.20

    const recentRhr = hrTrend.slice(-2)
    const rhrOmhoog = recentRhr.length > 0 && gemiddelde(recentRhr) > 75

    if (hrvDaling && rhrOmhoog) {
      flags.push('Ziekte Risico')
    }
  }

  // 3. SLAAPSCHULD
  // Meerdere korte nachten achter elkaar
  const slaapWaarden = m.filter(x => x.sleep_duration).map(x => x.sleep_duration as number)
  const recenteSlaap = slaapWaarden.slice(-5)
  const korteNachten = recenteSlaap.filter(s => s < 6.5).length

  if (korteNachten >= 3) {
    flags.push('Slaapschuld')
  }

  // 4. BLESSURE RISICO
  // Hoge belasting + lage recovery + bestaande blessure
  if (heeftBlessure && volumeStijgt) {
    flags.push('Blessure Risico')
  } else if (heeftBlessure && hrvTrend === 'dalend') {
    flags.push('Blessure Risico')
  }

  // 5. MENTALE VERMOEIDHEID
  // Energie en gevoel dalen in check-ins
  const energieWaarden = c.filter(x => x.energy_score).map(x => x.energy_score as number)
  const gevoelWaarden = c.filter(x => x.feeling_score).map(x => x.feeling_score as number)

  const energieTrend = trend(energieWaarden)
  const gevoelTrend = trend(gevoelWaarden)

  if (energieTrend === 'dalend' && gevoelTrend === 'dalend') {
    flags.push('Mentale Vermoeidheid')
  }

  // Bepaal urgentie
  let urgentie: RiskResult['urgentie'] = 'geen'
  if (flags.includes('Overtraining Risico') || flags.includes('Ziekte Risico')) {
    urgentie = 'hoog'
  } else if (flags.includes('Blessure Risico') || flags.includes('Slaapschuld')) {
    urgentie = 'gemiddeld'
  } else if (flags.length > 0) {
    urgentie = 'laag'
  }

  return {
    flags,
    hoogsteRisico: flags[0] || null,
    urgentie,
  }
}
