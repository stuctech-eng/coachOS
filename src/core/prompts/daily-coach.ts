import { Profile, UserGoal, DailyCheckin, HealthMetrics, CoachMemory } from '@/types'
import { RecoveryResult } from '../ai-engine/recovery-engine'

export function buildDailyCoachPrompt(
  profile: Profile,
  goals: UserGoal[],
  checkin: DailyCheckin | null,
  metrics: HealthMetrics | null,
  recovery: RecoveryResult,
  memory: CoachMemory[]
): string {
  const today = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
  const name = profile.display_name || profile.first_name || 'de gebruiker'
  const goalsList = goals.map(g => '- ' + g.title).join('\n') || '- Nog geen doelen'
  const memoryList = memory.slice(0, 5).map(m => '- ' + m.content).join('\n') || '- Nog geen inzichten'
  const checkinText = checkin
    ? 'Gevoel: ' + checkin.feeling_score + '/10, Energie: ' + checkin.energy_score + '/10, Pijn: ' + (checkin.has_pain ? 'Ja' : 'Nee')
    : 'Geen check-in vandaag'
  const metricsText = metrics
    ? [metrics.hrv ? 'HRV: ' + metrics.hrv : '', metrics.sleep_score ? 'Slaap: ' + metrics.sleep_score : '', metrics.body_battery ? 'Body Battery: ' + metrics.body_battery : ''].filter(Boolean).join(', ')
    : ''

  return 'Je bent CoachOS, persoonlijke AI coach voor ' + name + '.\n\n' +
    'DATUM: ' + today + '\n\n' +
    'PROFIEL: Leeftijd: ' + (profile.age || 'onbekend') + ', Tijd: ' + (profile.available_time || 'onbekend') + '\n\n' +
    'DOELEN:\n' + goalsList + '\n\n' +
    'CHECK-IN: ' + checkinText + '\n\n' +
    'HERSTEL: Score ' + recovery.score + '/100 - ' + recovery.status + '\n\n' +
    (metricsText ? 'DATA: ' + metricsText + '\n\n' : '') +
    'GEHEUGEN:\n' + memoryList + '\n\n' +
    'Reageer ALLEEN in dit JSON formaat:\n' +
    '{\n  "recommendation": "Specifieke actie voor vandaag",\n  "reasoning": "Uitleg in 2-3 zinnen"\n}'
}
