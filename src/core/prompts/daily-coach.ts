import { Profile, UserGoal, DailyCheckin, HealthMetrics, CoachMemory } from '@/types'
import { RecoveryResult } from '../ai-engine/recovery-engine'
import { COACH_CORE_IDENTITY, getCoachTone } from './coach-personality'

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

function buildGoalContext(goals: UserGoal[]): string {
  if (goals.length === 0) return ''

  const goalTitles = goals.map(g => g.title.toLowerCase())

  // Detecteer doel types
  const isMarathon = goalTitles.some(t => t.includes('marathon') || t.includes('hardlopen') || t.includes('lopen') || t.includes('race') || t.includes('duurloop'))
  const isAfvallen = goalTitles.some(t => t.includes('afvallen') || t.includes('gewicht') || t.includes('afslank') || t.includes('vet'))
  const isKracht = goalTitles.some(t => t.includes('kracht') || t.includes('spier') || t.includes('gym') || t.includes('gewichthef') || t.includes('sterk'))
  const isFietsen = goalTitles.some(t => t.includes('fiets') || t.includes('wielren') || t.includes('cycling'))
  const isGezondheid = goalTitles.some(t => t.includes('gezond') || t.includes('conditie') || t.includes('fit') || t.includes('algemeen'))

  const focusPunten: string[] = []
  const prioriteiten: string[] = []

  if (isMarathon || isFietsen) {
    focusPunten.push('trainingsbelasting en duurvermogen')
    prioriteiten.push(
      'Prioriteer trainingsvolume en -kwaliteit boven alles',
      'HRV en herstel bepalen of een geplande training door kan gaan',
      'Slaap is cruciaal voor aanpassing aan trainingsbelasting',
      'Waarschuw direct als overtraining signalen optreden',
      'Geef specifiek advies over intensiteit: rustig, matig of hoog',
      'Denk in trainingsblokken: opbouw, piek, herstel'
    )
  }

  if (isAfvallen) {
    focusPunten.push('consistentie, dagelijkse beweging en energiebalans')
    prioriteiten.push(
      'Stappen en dagelijkse activiteit zijn even belangrijk als gestructureerde training',
      'Consistentie over weken is belangrijker dan perfecte sessies',
      'Energie en motivatie score bepalen het type activiteit van vandaag',
      'Benoem altijd de calorische impact van keuzes',
      'Slaap en stress hebben directe invloed op vetverbranding — benoem dit',
      'Kleine dagelijkse overwinningen zijn even waardevol als grote trainingsprestaties'
    )
  }

  if (isKracht) {
    focusPunten.push('spierherstel, trainingsfrequentie en progressieve overbelasting')
    prioriteiten.push(
      'Spierpijn score bepaalt of een spiergroep getraind kan worden',
      'Herstel tussen krachttrainingen is cruciaal — minstens 48u per spiergroep',
      'HRV onder gemiddelde = hersteldag, geen zware krachttraining',
      'Eiwitinname en slaap zijn de twee belangrijkste hersteltools',
      'Geef concrete sets/reps suggesties als de conditie het toelaat',
      'Blessures aan specifieke lichaamsdelen sluiten bepaalde oefeningen uit'
    )
  }

  if (isGezondheid || (!isMarathon && !isAfvallen && !isKracht && !isFietsen)) {
    focusPunten.push('algehele gezondheid, herstel en dagelijkse beweging')
    prioriteiten.push(
      'Balans tussen activiteit en herstel staat centraal',
      'Slaap, stress en stappen zijn de drie belangrijkste indicatoren',
      'Kleine dagelijkse gewoontes zijn waardevoller dan extreme sessies',
      'Benoem positieve trends om motivatie te ondersteunen',
      'Geef praktische adviezen die passen in het dagelijks leven'
    )
  }

  return `DOEL-SPECIFIEKE COACHING FOCUS:
De gebruiker wil bereiken: ${goals.map(g => g.title).join(', ')}
Primaire focus: ${focusPunten.join(' en ')}

Coaching prioriteiten voor dit doel:
${prioriteiten.map(p => '- ' + p).join('\n')}

`
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

  const goalContext = buildGoalContext(goals)

  return `${COACH_CORE_IDENTITY}

${getCoachTone(2)}

- Eindig altijd met een concrete actie voor vandaag
- Verwijs ALLEEN naar werk/dienst ("na je dienst", "voor je werk", etc.) als er hieronder een regel "Werktijden vandaag" staat. Staat die er niet, dan werkt de gebruiker vandaag niet — noem dan geen dienst, werk of shift.

DATUM: ${today}

PROFIEL: ${name}, ${profile.age || 'leeftijd onbekend'} jaar, niveau: ${profile.experience_level || 'onbekend'}, beschikbare tijd: ${profile.available_time || 'onbekend'}

DOELEN:
${goalsList}

${goalContext}CHECK-IN VANDAAG: ${checkinText}

HERSTELSTATUS: ${recovery.score}/100 — ${recovery.status}

GEZONDHEIDSDATA VANDAAG: ${vandaagText}

${weekText}${activiteitenText}COACH GEHEUGEN (wat ik over jou weet):
${memoryList}

Reageer ALLEEN in dit JSON formaat:
{
  "actie_type": "herstel",
  "main_action": "Doe vandaag een rustige herstelwandeling van 30 minuten.",
  "advice_bullets": [
    "Vermijd zware training",
    "Drink voldoende water",
    "Focus op slaap vanavond"
  ],
  "reasoning": "Onderbouwing in 2-3 zinnen: interpreteer de data, vergelijk met trends, leg uit waarom dit advies past bij dit specifieke doel van deze atleet op dit moment"
}

Regels:
- actie_type is ALTIJD één van: "trainen", "herstel", "rust"
- main_action: 1 concrete actie voor vandaag
- advice_bullets: 2-4 korte actiegerichte adviezen, elk max 6 woorden
- reasoning: onderbouwing voor de gebruiker`
}
