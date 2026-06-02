import { Profile, UserGoal, DailyCheckin, HealthMetrics, CoachMemory } from '@/types'
import { RecoveryResult } from '../ai-engine/recovery-engine'

export interface WeekMetrics {
  hrv: number[]
  resting_hr: number[]
  sleep_duration: number[]
  steps: number[]
  dates: string[]
}

function trend(waarden: number[]): string {
  if (waarden.length < 2) return 'onvoldoende data'
  const eerste = waarden.slice(0, Math.floor(waarden.length / 2))
  const laatste = waarden.slice(Math.floor(waarden.length / 2))
  const gemEerste = eerste.reduce((a, b) => a + b, 0) / eerste.length
  const gemLaatste = laatste.reduce((a, b) => a + b, 0) / laatste.length
  const verschil = ((gemLaatste - gemEerste) / gemEerste) * 100
  if (verschil > 5) return 'stijgend'
  if (verschil < -5) return 'dalend'
  return 'stabiel'
}

function gemiddelde(waarden: number[]): number {
  if (waarden.length === 0) return 0
  return Math.round(waarden.reduce((a, b) => a + b, 0) / waarden.length * 10) / 10
}

export function buildDailyCoachPrompt(
  profile: Profile,
  goals: UserGoal[],
  checkin: DailyCheckin | null,
  metrics: HealthMetrics | null,
  recovery: RecoveryResult,
  memory: CoachMemory[],
  weekMetrics?: WeekMetrics | null,
  recenteActiviteiten?: string[]
): string {
  const today = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
  const name = profile.display_name || profile.first_name || 'de gebruiker'
  const goalsList = goals.map(g => '- ' + g.title).join('\n') || '- Nog geen doelen'
  const memoryList = memory.slice(0, 5).map(m => '- ' + m.content).join('\n') || '- Nog geen inzichten'

  const checkinText = checkin
    ? 'Gevoel: ' + checkin.feeling_score + '/10, Energie: ' + checkin.energy_score + '/10, Pijn: ' + (checkin.has_pain ? 'Ja — ' + (checkin.pain_description || '') : 'Nee') + (checkin.notes ? ', Notitie: ' + checkin.notes : '')
    : 'Geen check-in vandaag'

  // Vandaag metrics
  const vandaagTexts: string[] = []
  if (metrics?.hrv)           vandaagTexts.push('HRV: ' + metrics.hrv + 'ms')
  if (metrics?.resting_hr)    vandaagTexts.push('Hartslag: ' + metrics.resting_hr + 'bpm')
  if (metrics?.sleep_duration) vandaagTexts.push('Slaap: ' + metrics.sleep_duration + 'uur')
  if (metrics?.steps)          vandaagTexts.push('Stappen: ' + metrics.steps)
  if (metrics?.calories_burned) vandaagTexts.push('Calorieën: ' + metrics.calories_burned + 'kcal')
  if (metrics?.body_battery)   vandaagTexts.push('Body Battery: ' + metrics.body_battery)
  if (metrics?.vo2max)         vandaagTexts.push('VO2max: ' + metrics.vo2max)
  const vandaagText = vandaagTexts.length > 0 ? vandaagTexts.join(', ') : 'Geen data vandaag'

  // Week trend
  let weekText = ''
  if (weekMetrics) {
    const weekParts: string[] = []
    if (weekMetrics.hrv.length >= 3) {
      weekParts.push('HRV gem. ' + gemiddelde(weekMetrics.hrv) + 'ms (' + trend(weekMetrics.hrv) + ')')
    }
    if (weekMetrics.resting_hr.length >= 3) {
      weekParts.push('Hartslag gem. ' + gemiddelde(weekMetrics.resting_hr) + 'bpm (' + trend(weekMetrics.resting_hr) + ')')
    }
    if (weekMetrics.sleep_duration.length >= 3) {
      weekParts.push('Slaap gem. ' + gemiddelde(weekMetrics.sleep_duration) + 'uur (' + trend(weekMetrics.sleep_duration) + ')')
    }
    if (weekMetrics.steps.length >= 3) {
      weekParts.push('Stappen gem. ' + Math.round(gemiddelde(weekMetrics.steps)) + '/dag')
    }
    if (weekParts.length > 0) {
      weekText = 'WEEK TREND (7 dagen):\n' + weekParts.map(p => '- ' + p).join('\n') + '\n\n'
    }
  }

  // Recente activiteiten
  let activiteitenText = ''
  if (recenteActiviteiten && recenteActiviteiten.length > 0) {
    activiteitenText = 'RECENTE ACTIVITEITEN:\n' + recenteActiviteiten.map(a => '- ' + a).join('\n') + '\n\n'
  }

  return 'Je bent CoachOS, persoonlijke AI coach voor ' + name + '.\n\n' +
    'DATUM: ' + today + '\n\n' +
    'PROFIEL: Leeftijd: ' + (profile.age || 'onbekend') + ', Beschikbare tijd: ' + (profile.available_time || 'onbekend') + ', Niveau: ' + (profile.experience_level || 'onbekend') + '\n\n' +
    'DOELEN:\n' + goalsList + '\n\n' +
    'CHECK-IN VANDAAG: ' + checkinText + '\n\n' +
    'HERSTELSTATUS: Score ' + recovery.score + '/100 — ' + recovery.status + '\n\n' +
    'GEZONDHEIDSDATA VANDAAG: ' + vandaagText + '\n\n' +
    weekText +
    activiteitenText +
    'COACH GEHEUGEN:\n' + memoryList + '\n\n' +
    'INSTRUCTIES:\n' +
    '- Gebruik de week trend om te beoordelen of het lichaam herstelt of overbelast raakt\n' +
    '- Een dalende HRV trend betekent meer herstel nodig\n' +
    '- Een stijgende HRV trend betekent het lichaam herstelt goed\n' +
    '- Houd rekening met recent uitgevoerde activiteiten\n' +
    '- Geef een specifiek, persoonlijk advies voor vandaag\n\n' +
    'Reageer ALLEEN in dit JSON formaat:\n' +
    '{\n  "recommendation": "Specifieke actie voor vandaag (1 zin)",\n  "reasoning": "Persoonlijke uitleg gebaseerd op data (2-3 zinnen)"\n}'
}
