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
    ? 'Gevoel: ' + checkin.feeling_score + '/10, Energie: ' + checkin.energy_score + '/10' +
      (checkin.stress_score ? ', Stress: ' + checkin.stress_score + '/10' : '') +
      (checkin.motivation_score ? ', Motivatie: ' + checkin.motivation_score + '/10' : '') +
      (checkin.soreness_score ? ', Spierpijn: ' + checkin.soreness_score + '/10' : '') +
      (checkin.sleep_quality ? ', Slaapkwaliteit: ' + checkin.sleep_quality + '/10' : '') +
      ', Pijn: ' + (checkin.has_pain ? 'Ja — ' + (checkin.pain_description || '') : 'Nee') +
      (checkin.notes ? ', Notitie: ' + checkin.notes : '')
    : 'Geen check-in vandaag'

  const vandaagTexts: string[] = []
  if (metrics?.hrv)            vandaagTexts.push('HRV: ' + metrics.hrv + 'ms')
  if (metrics?.resting_hr)     vandaagTexts.push('Hartslag: ' + metrics.resting_hr + 'bpm')
  if (metrics?.sleep_duration) vandaagTexts.push('Slaap: ' + metrics.sleep_duration + 'uur')
  if (metrics?.steps)          vandaagTexts.push('Stappen: ' + metrics.steps)
  if (metrics?.body_battery)   vandaagTexts.push('Body Battery: ' + metrics.body_battery)
  if (metrics?.vo2max)         vandaagTexts.push('VO2max: ' + metrics.vo2max)
  const vandaagText = vandaagTexts.length > 0 ? vandaagTexts.join(', ') : 'Geen data vandaag'

  let weekText = ''
  if (weekMetrics) {
    const weekParts: string[] = []
    if (weekMetrics.hrv.length >= 3) weekParts.push('HRV gem. ' + gemiddelde(weekMetrics.hrv) + 'ms (' + trend(weekMetrics.hrv) + ')')
    if (weekMetrics.resting_hr.length >= 3) weekParts.push('Hartslag gem. ' + gemiddelde(weekMetrics.resting_hr) + 'bpm (' + trend(weekMetrics.resting_hr) + ')')
    if (weekMetrics.sleep_duration.length >= 3) weekParts.push('Slaap gem. ' + gemiddelde(weekMetrics.sleep_duration) + 'uur (' + trend(weekMetrics.sleep_duration) + ')')
    if (weekMetrics.steps.length >= 3) weekParts.push('Stappen gem. ' + Math.round(gemiddelde(weekMetrics.steps)) + '/dag')
    if (weekParts.length > 0) weekText = 'WEEK TREND (7 dagen):\n' + weekParts.map(p => '- ' + p).join('\n') + '\n\n'
  }

  let activiteitenText = ''
  if (recenteActiviteiten && recenteActiviteiten.length > 0) {
    activiteitenText = 'RECENTE ACTIVITEITEN:\n' + recenteActiviteiten.map(a => '- ' + a).join('\n') + '\n\n'
  }

  return `Je bent CoachOS, de persoonlijke coach van ${name}. Je bent geen app of dashboard — je bent een ervaren coach die deze atleet door en door kent.

COACH PERSOONLIJKHEID:
- Spreek als een betrokken, ervaren coach — niet als een systeem dat data rapporteert
- Gebruik "je" en "ik" — persoonlijk en direct
- Interpreteer altijd: wat betekent deze data voor DEZE atleet op DIT moment?
- Geef nooit ruwe getallen zonder duiding — verklaar wat ze betekenen
- Wees eerlijk maar motiverend
- Eindig altijd met een concrete actie voor vandaag
- Schrijf in natuurlijke zinnen, geen opsommingen

DATUM: ${today}

PROFIEL: ${name}, ${profile.age || 'leeftijd onbekend'} jaar, niveau: ${profile.experience_level || 'onbekend'}, beschikbare tijd: ${profile.available_time || 'onbekend'}

DOELEN:
${goalsList}

CHECK-IN VANDAAG: ${checkinText}

HERSTELSTATUS: ${recovery.score}/100 — ${recovery.status}

GEZONDHEIDSDATA VANDAAG: ${vandaagText}

${weekText}${activiteitenText}COACH GEHEUGEN (wat ik over jou weet):
${memoryList}

Reageer ALLEEN in dit JSON formaat:
{
  "recommendation": "Persoonlijk advies voor vandaag in 1-2 zinnen als een echte coach",
  "reasoning": "Onderbouwing in 2-3 zinnen: interpreteer de data, vergelijk met trends, leg uit waarom dit advies past bij deze atleet op dit moment"
}`
}
