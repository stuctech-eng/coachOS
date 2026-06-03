// Training Engine
// Bepaalt trainingsbelasting score op basis van activiteiten

export interface TrainingResult {
  score: number        // 0-100 (50 = optimaal)
  status: string
  weekVolume: number   // minuten deze week
  trend: 'stijgend' | 'stabiel' | 'dalend' | 'onvoldoende data'
  weekActiviteiten: number
}

interface Activiteit {
  date: string
  duration: number
  metrics?: {
    distance?: number
    avg_hr?: number
    calories?: number
  }
}

export function calculateTrainingScore(
  activiteiten: Activiteit[],
  beschikbareTijd: string | null
): TrainingResult {
  const now = new Date()

  // Deze week (laatste 7 dagen)
  const weekGeleden = new Date(now)
  weekGeleden.setDate(now.getDate() - 7)
  const dezeWeek = activiteiten.filter(a => new Date(a.date) >= weekGeleden)

  // Vorige week (7-14 dagen geleden)
  const tweeWekenGeleden = new Date(now)
  tweeWekenGeleden.setDate(now.getDate() - 14)
  const vorigeWeek = activiteiten.filter(a => {
    const d = new Date(a.date)
    return d >= tweeWekenGeleden && d < weekGeleden
  })

  const weekMinuten = dezeWeek.reduce((a, s) => a + (s.duration || 0), 0)
  const vorigeWeekMinuten = vorigeWeek.reduce((a, s) => a + (s.duration || 0), 0)

  // Bepaal optimaal volume op basis van beschikbare tijd
  const optimaalMinuten = beschikbareTijd === '15min' ? 75
    : beschikbareTijd === '30min' ? 150
    : beschikbareTijd === '60min' ? 300
    : 200 // flexibel default

  // Score berekening
  // 50 = optimaal, 0 = veel te veel of niets
  let score = 50

  if (weekMinuten === 0) {
    score = 20 // Geen training deze week
  } else {
    const ratio = weekMinuten / optimaalMinuten
    if (ratio <= 0.5) score = 30        // Te weinig
    else if (ratio <= 0.75) score = 45  // Iets te weinig
    else if (ratio <= 1.25) score = 80  // Optimaal
    else if (ratio <= 1.5) score = 60   // Iets te veel
    else if (ratio <= 2.0) score = 40   // Te veel
    else score = 20                      // Veel te veel
  }

  // Trend berekening
  let trend: TrainingResult['trend'] = 'onvoldoende data'
  if (vorigeWeekMinuten > 0 && weekMinuten > 0) {
    const verschil = ((weekMinuten - vorigeWeekMinuten) / vorigeWeekMinuten) * 100
    if (verschil > 15) trend = 'stijgend'
    else if (verschil < -15) trend = 'dalend'
    else trend = 'stabiel'
  } else if (weekMinuten > 0) {
    trend = 'stabiel'
  }

  // Status
  let status = 'Optimale belasting'
  if (score >= 70) status = 'Optimale belasting'
  else if (score >= 50) status = 'Lichte onderbelasting'
  else if (score >= 30) status = 'Overbelasting risico'
  else status = 'Geen training'

  return {
    score: Math.max(0, Math.min(100, score)),
    status,
    weekVolume: weekMinuten,
    trend,
    weekActiviteiten: dezeWeek.length,
  }
}
