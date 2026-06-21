import { COACH_CORE_IDENTITY, getCoachTone, mayUsePlayfulHumor } from './coach-personality'

export interface CoachCallReactionInput {
  sportType: string
  distanceM: number | null
  durationMin: number
  rating: number // RPE 1-10
  mood: number // 1-5: 1=😞 2=😐 3=🙂 4=😃 5=🔥
  notes: string | null
  ignoredAdvice: boolean // trainde tegen coach-advies in (bv. rust voorgeschreven)
  completedCoachCalls: number
}

function moodLabel(mood: number): string {
  const labels: Record<number, string> = {
    1: '😞 voelde niet goed',
    2: '😐 neutraal',
    3: '🙂 prima',
    4: '😃 goed',
    5: '🔥 geweldig',
  }
  return labels[mood] || 'onbekend'
}

export function buildCoachCallReactionPrompt(input: CoachCallReactionInput): string {
  const {
    sportType, distanceM, durationMin, rating, mood, notes,
    ignoredAdvice, completedCoachCalls,
  } = input

  const humorMag = mayUsePlayfulHumor(completedCoachCalls, mood, ignoredAdvice)
  const afstandText = distanceM ? `${(distanceM / 1000).toFixed(1)} km` : 'afstand onbekend'

  return `${COACH_CORE_IDENTITY}

${getCoachTone(3)}

${humorMag
  ? 'Deze gebruiker traint al een tijdje met je en trainde nu tegen je advies in. Plagerige humor is hier toegestaan, gebruik gerust.'
  : 'Houd het luchtig en warm, maar zonder plagerijen — daar is het nu niet het moment voor.'}

ACTIVITEIT TER EVALUATIE:
- Sport: ${sportType}
- Afstand: ${afstandText}
- Duur: ${durationMin} minuten
- RPE (zwaarte, 1-10): ${rating}
- Mood: ${moodLabel(mood)}
${notes ? `- Eigen notitie van de atleet: "${notes}"` : ''}

Reageer ALLEEN in dit JSON formaat:
{
  "coach_reactie": "Korte, persoonlijke reactie van 1-3 zinnen op deze ene training",
  "belasting": "laag" | "gemiddeld" | "hoog",
  "emotie": "negatief" | "neutraal" | "positief"
}`
}
