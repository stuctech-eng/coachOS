// Lifestyle Engine
// Meet dagelijkse beweging en consistentie

export interface LifestyleResult {
  score: number
  status: string
  gemStappen: number
  consistentie: number  // % dagen met voldoende stappen
}

interface DagMetrics {
  date: string
  steps?: number | null
  calories_burned?: number | null
}

export function calculateLifestyleScore(
  metrics: DagMetrics[],
  aantalDagen: number = 7
): LifestyleResult {
  const now = new Date()
  const periode = new Date(now)
  periode.setDate(now.getDate() - aantalDagen)

  const recent = metrics.filter(m => new Date(m.date) >= periode)

  if (recent.length === 0) {
    return { score: 50, status: 'Geen data', gemStappen: 0, consistentie: 0 }
  }

  // Gemiddeld aantal stappen
  const metStappen = recent.filter(m => m.steps && m.steps > 0)
  const gemStappen = metStappen.length > 0
    ? Math.round(metStappen.reduce((a, m) => a + (m.steps || 0), 0) / metStappen.length)
    : 0

  // Stappen score — doel: 8000+ per dag
  let stappenScore = 0
  if (gemStappen >= 10000) stappenScore = 100
  else if (gemStappen >= 8000) stappenScore = 85
  else if (gemStappen >= 6000) stappenScore = 70
  else if (gemStappen >= 4000) stappenScore = 50
  else if (gemStappen >= 2000) stappenScore = 30
  else stappenScore = 10

  // Consistentie — hoeveel dagen had je data
  const consistentie = Math.round((metStappen.length / aantalDagen) * 100)

  // Consistentie score
  const consistentieScore = consistentie >= 80 ? 100
    : consistentie >= 60 ? 75
    : consistentie >= 40 ? 50
    : 25

  // Gecombineerde score
  const score = Math.round((stappenScore * 0.6) + (consistentieScore * 0.4))

  let status = 'Actieve leefstijl'
  if (score >= 75) status = 'Actieve leefstijl'
  else if (score >= 50) status = 'Matig actief'
  else status = 'Weinig beweging'

  return {
    score: Math.max(0, Math.min(100, score)),
    status,
    gemStappen,
    consistentie,
  }
}
