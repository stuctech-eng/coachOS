// Coach Score Engine (Readiness Engine)
// Combineert Recovery + Training + Lifestyle tot één Coach Score

export interface CoachScoreResult {
  coachScore: number
  recoveryScore: number
  trainingScore: number
  lifestyleScore: number
  label: string
  kleur: 'green' | 'orange' | 'red'
  beschrijving: string
}

export function calculateCoachScore(
  recoveryScore: number,
  trainingScore: number,
  lifestyleScore: number
): CoachScoreResult {
  // Gewichten — recovery is het belangrijkst
  const coachScore = Math.round(
    (recoveryScore * 0.50) +
    (trainingScore * 0.30) +
    (lifestyleScore * 0.20)
  )

  const score = Math.max(0, Math.min(100, coachScore))

  // Label en kleur
  let label = ''
  let kleur: CoachScoreResult['kleur'] = 'green'
  let beschrijving = ''

  if (score >= 90) {
    label = 'Elite Readiness'
    kleur = 'green'
    beschrijving = 'Je lichaam is optimaal hersteld. Dit is een uitstekende dag voor een zware training.'
  } else if (score >= 75) {
    label = 'Klaar'
    kleur = 'green'
    beschrijving = 'Je bent goed hersteld en klaar voor een normale trainingsdag.'
  } else if (score >= 60) {
    label = 'Voorzichtig'
    kleur = 'orange'
    beschrijving = 'Je lichaam heeft iets meer rust nodig. Kies voor een lichtere training.'
  } else if (score >= 40) {
    label = 'Herstel nodig'
    kleur = 'orange'
    beschrijving = 'Je lichaam is vermoeid. Focus op herstel en lichte beweging vandaag.'
  } else {
    label = 'Hoog Risico'
    kleur = 'red'
    beschrijving = 'Je lichaam heeft dringend rust nodig. Geen intensieve training vandaag.'
  }

  return {
    coachScore: score,
    recoveryScore,
    trainingScore,
    lifestyleScore,
    label,
    kleur,
    beschrijving,
  }
}
