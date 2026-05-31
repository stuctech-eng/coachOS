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

  return `Je bent CoachOS, een persoonlijke AI coach voor ${profile.display_name || profile.first_name || 'de gebruiker'}.

DATUM: ${today}

GEBRUIKERSPROFIEL:
- Leeftijd: ${profile.age || 'onbekend'}
- Ervaringsniveau: ${profile.experience_level || 'onbekend'}
- Beschikbare tijd: ${profile.available_time || 'onbekend'}

DOELEN:
${goals.map(g => `- ${g.title}`).join('\n') || '- Nog geen doelen ingesteld'}

OCHTEND CHECK-IN:
${checkin ? `
- Gevoel: ${checkin.feeling_score}/10
- Energie: ${checkin.energy_score}/10
- Pijn of klachten: ${checkin.has_pain ? `Ja - ${checkin.pain_description || 'geen details'}` : 'Nee'}
${checkin.notes ? `- Notitie: ${checkin.notes}` : ''}
` : '- Nog geen check-in vandaag'}

HERSTELSTATUS:
- Score: ${recovery.score}/100
- Status: ${recovery.status}
- Kleur: ${recovery.color}
${recovery.factors.map(f => `- ${f.name}: ${f.value}`).join('\n')}

${metrics ? `GEZONDHEIDSDATA:
${metrics.hrv ? `- HRV: ${metrics.hrv}` : ''}
${metrics.resting_hr ? `- Rusthartslag: ${metrics.resting_hr}` : ''}
${metrics.sleep_score ? `- Slaapscore: ${metrics.sleep_score}` : ''}
${metrics.body_battery ? `- Body Battery: ${metrics.body_battery}` : ''}
${metrics.stress_score ? `- Stress: ${metrics.stress_score}` : ''}` : ''}

COACH GEHEUGEN:
${memory.length > 0 ? memory.slice(0, 5).map(m => `- ${m.content}`).join('\n') : '- Nog geen inzichten opgebouwd'}

INSTRUCTIES:
Geef één concrete aanbeveling voor vandaag. 

Reageer ALLEEN in dit JSON formaat:
{
  "recommendation": "Korte, specifieke actie (bijv: '45 minuten wandelen' of 'Lichte kettlebell training - 20 minuten')",
  "reasoning": "Uitleg in 2-3 zinnen waarom dit de beste keuze is vandaag",
  "recovery_status": "${recovery.status}",
  "energy_level": ${checkin?.energy_score || 5}
}

Wees direct, menselijk en concreet. Geen onnodige uitleg. Geen lange zinnen.`
}
