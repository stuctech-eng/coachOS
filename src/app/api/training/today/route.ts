export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { getAvailableModules, isModuleAvailable } from '@/utils/equipment'
import { filterOpCoachDoel, formateerVoorPrompt } from '@/lib/bodyweight-exercises'
import type { CoachDoel } from '@/lib/bodyweight-exercises'
import { filterStrength, formateerStrengthVoorPrompt } from '@/lib/strength-exercises'
import type { KrachtDoel, Equipment } from '@/lib/strength-exercises'
import { filterKettlebell, formateerKettlebellVoorPrompt } from '@/lib/kettlebell-exercises'
import type { KettlebellDoel } from '@/lib/kettlebell-exercises'
import { filterMobility, formateerMobilityVoorPrompt } from '@/lib/mobility-exercises'
import type { MobilityDoel, MobilityLichaamsdeel } from '@/lib/mobility-exercises'
import { filterRecovery, formateerRecoveryVoorPrompt } from '@/lib/recovery-exercises'
import type { RecoveryDoel } from '@/lib/recovery-exercises'
import { filterRunning, formateerRunningVoorPrompt } from '@/lib/running-drills'
import type { RunningDoel } from '@/lib/running-drills'
import { filterRowing, formateerRowingVoorPrompt } from '@/lib/rowing-drills'
import type { RowingDoel } from '@/lib/rowing-drills'
import { filterCycling, formateerCyclingVoorPrompt } from '@/lib/cycling-drills'
import type { CyclingDoel } from '@/lib/cycling-drills'
import type { EquipmentProfile } from '@/app/api/equipment/route'
import type { TrainingModule } from '@/types/training-engine'

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export interface TrainingInstruction {
  training_allowed: boolean
  training_type: string | null
  title?: string
  intensity: 'light' | 'medium' | 'heavy' | null
  duration: number | null
  segments?: unknown[]
  recovery_modules: RecoveryModule[]
  reason: string
  coach_message: string
}

export interface RecoveryModule {
  type: 'breathing' | 'mobility' | 'walk' | 'relaxation'
  subtype: string
  duration: number
  label: string
}

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ instruction: null })
    const supabase = createAdminClient()
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
    const { data } = await supabase
      .from('coach_recommendations')
      .select('training_instruction')
      .eq('user_id', user.id)
      .eq('date', today)
      .eq('type', 'training_today')
      .single()
    return NextResponse.json({ instruction: data?.training_instruction || null })
  } catch {
    return NextResponse.json({ instruction: null })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })

    let body: { module?: TrainingModule; source?: string; force?: boolean } = {}
    try { body = await req.json() } catch { /* geen body */ }
    const forcedModule = body.module
    const isLibrary = body.source === 'library' && !!forcedModule
    const cacheType = isLibrary ? `library_${forcedModule}` : 'training_today'

    // v2.4.55: force=true omzeilt de cache-check volledig — nodig omdat
    // gedeployde codewijzigingen (bv. nieuwe velden zoals weight_kg/
    // target_tempo, v2.4.51) anders NOOIT zichtbaar worden voor een
    // schema dat dezelfde dag al eerder werd gegenereerd en gecached,
    // ongeacht hoeveel nieuwe deploys erna volgen. Zie ook de client-side
    // localStorage-cache in session/[module]/page.tsx, die apart
    // doorbroken moet worden (zie daar).
    if (!body.force) {
      const { data: cached } = await supabase
        .from('coach_recommendations')
        .select('training_instruction')
        .eq('user_id', user.id)
        .eq('date', today)
        .eq('type', cacheType)
        .single()
      if (cached?.training_instruction) {
        return NextResponse.json({ instruction: cached.training_instruction })
      }
    }

    const veertienDagenGeleden = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA')

    const [profileRes, checkinRes, garminRes, blessuresRes, goalsRes, stravaRunsRes, stravaRittenRes, coachRecRes, dagplanRes] = await Promise.all([
      supabase.from('profiles').select('first_name, experience_level, available_time, kettlebell_available, concept2_available, cycling_available, running_available, dumbbell_available, barbell_available, ab_wheel_available, bodyweight_available').eq('user_id', user.id).single(),
      supabase.from('daily_checkins').select('feeling_score, energy_score, stress_score, motivation_score, soreness_score').eq('user_id', user.id).eq('date', today).single(),
      supabase.from('garmin_imports').select('parsed_data').eq('user_id', user.id).eq('status', 'confirmed').order('date', { ascending: false }).limit(1).single(),
      supabase.from('injuries').select('body_part, pain_score').eq('user_id', user.id).eq('active', true),
      supabase.from('user_goals').select('title').eq('user_id', user.id).eq('status', 'active').limit(2),
      supabase.from('activity_sessions').select('date, duration, metrics, activities!inner(name)').eq('user_id', user.id).eq('source', 'strava').eq('activities.name', 'Hardlopen').gte('date', veertienDagenGeleden).order('date', { ascending: false }).limit(5),
      supabase.from('activity_sessions').select('date, duration, metrics, activities!inner(name)').eq('user_id', user.id).eq('source', 'strava').eq('activities.name', 'Fietsen').gte('date', veertienDagenGeleden).order('date', { ascending: false }).limit(5),
      supabase.from('coach_recommendations').select('recommendation, actie_type, reasoning, trainer_instructies').eq('user_id', user.id).eq('date', today).eq('type', 'coach').single(),
      supabase.from('coach_recommendations').select('action_plan').eq('user_id', user.id).eq('date', today).neq('action_plan', null).order('created_at', { ascending: false }).limit(1).single(),
    ])

    const profile = profileRes.data
    const checkin = checkinRes.data
    const garmin = garminRes.data?.parsed_data || null
    const blessures = blessuresRes.data || []
    const goals = goalsRes.data || []
    const coachRec = coachRecRes.data
    const dagplan: Array<{ tijd: string; actie: string }> = dagplanRes.data?.action_plan || []

    const equipment: Partial<EquipmentProfile> = {
      kettlebell_available: profile?.kettlebell_available ?? true,
      concept2_available: profile?.concept2_available ?? false,
      cycling_available: profile?.cycling_available ?? false,
      running_available: profile?.running_available ?? false,
      dumbbell_available: profile?.dumbbell_available ?? false,
      barbell_available: profile?.barbell_available ?? false,
      ab_wheel_available: profile?.ab_wheel_available ?? false,
      bodyweight_available: profile?.bodyweight_available ?? true,
    }
    const availableModules = getAvailableModules(equipment)
    const rowingAvailable = availableModules.includes('rowing')
    const kettlebellAvailable = availableModules.includes('kettlebell')
    const runningAvailable = availableModules.includes('running')
    const cyclingAvailable = availableModules.includes('cycling')
    const bodyweightAvailable = availableModules.includes('bodyweight') || (profile?.bodyweight_available ?? true)

    if (isLibrary && forcedModule) {
      if (!isModuleAvailable(forcedModule, equipment)) {
        return NextResponse.json({ error: `Module '${forcedModule}' niet beschikbaar` }, { status: 403 })
      }
    }

    const stravaRuns = (stravaRunsRes.data || []) as Array<{ date: string; duration: number; metrics: Record<string, number> }>
    const stravaRunningContext = stravaRuns.length > 0
      ? 'Recente Strava hardloop-historie:\n' + stravaRuns.map((run, i) => {
          const m = run.metrics || {}
          const km = m.distance ? (m.distance / 1000).toFixed(1) : '?'
          const avgSpeed = m.avg_speed
          let pace = '?'
          if (avgSpeed && avgSpeed > 0) {
            const paceMinPerKm = 60 / avgSpeed
            const min = Math.floor(paceMinPerKm)
            const sec = Math.round((paceMinPerKm - min) * 60)
            pace = `${min}:${sec.toString().padStart(2, '0')}/km`
          }
          return `Run ${i + 1} (${run.date}): ${km} km, ${run.duration} min, gem. pace ${pace}` +
            (m.avg_hr ? `, gem. HS ${m.avg_hr}` : '')
        }).join('\n')
      : ''

    const stravaRitten = (stravaRittenRes.data || []) as Array<{ date: string; duration: number; metrics: Record<string, number> }>
    const stravaCyclingContext = stravaRitten.length > 0
      ? 'Recente Strava fiets-historie:\n' + stravaRitten.map((rit, i) => {
          const m = rit.metrics || {}
          const km = m.distance ? (m.distance / 1000).toFixed(1) : '?'
          const speed = m.avg_speed ? `${m.avg_speed} km/u` : '?'
          return `Rit ${i + 1} (${rit.date}): ${km} km, ${rit.duration} min, gem. snelheid ${speed}` +
            (m.avg_hr ? `, gem. HS ${m.avg_hr}` : '') +
            (m.avg_watts ? `, gem. ${m.avg_watts}W` : '')
        }).join('\n')
      : ''

    // Coach sturing — bij library-keuze bepaalt de gebruiker de module,
    // coach bepaalt alleen de intensiteit. Bij normale flow bepaalt coach alles.
    const coachActieType = coachRec?.actie_type || null
    const trainerInstructies = coachRec?.trainer_instructies || null

    let coachSturingContext = ''
    if (isLibrary) {
      // Bibliotheek: gebruiker kiest module — coach bepaalt alleen intensiteit
      if (coachActieType === 'rust') {
        coachSturingContext = `COACH ADVIES (intensiteit): Coach adviseerde rust vandaag. Kies recovery/light sessietype voor de gekozen module. training_allowed MOET true zijn — de gebruiker heeft bewust gekozen deze module te starten.`
      } else if (coachActieType === 'herstel') {
        coachSturingContext = `COACH ADVIES (intensiteit): Coach adviseerde herstel vandaag. Kies recovery of licht sessietype voor de gekozen module. intensity MOET "light" zijn.`
      } else {
        coachSturingContext = `COACH ADVIES: Coach heeft trainen goedgekeurd. Kies passend sessietype voor de gekozen module.`
      }
    } else {
      // Normale flow: coach is volledig leidend
      if (coachActieType === 'rust') {
        coachSturingContext = `COACH BESLISSING (LEIDEND): RUST vandaag. training_allowed MOET false zijn.`
      } else if (coachActieType === 'herstel') {
        coachSturingContext = `COACH BESLISSING (LEIDEND): HERSTEL vandaag. Alleen intensity "light" als training_allowed true is.`
      } else if (coachActieType === 'trainen') {
        coachSturingContext = `COACH BESLISSING (LEIDEND): TRAINEN vandaag. Training goedgekeurd.`
      }
      if (coachRec?.recommendation) coachSturingContext += `\nCoach advies: "${coachRec.recommendation}"`
      if (trainerInstructies) coachSturingContext += `\n\nDIRECTE INSTRUCTIE VAN COACH AAN TRAINER: ${trainerInstructies}`
    }

    const dagplanContext = dagplan.length > 0
      ? `\nDagplan van Coach:\n${dagplan.map(d => `${d.tijd}: ${d.actie}`).join('\n')}`
      : ''

    const blessureContext = blessures.length > 0
      ? `\nActieve blessures: ${blessures.map((b: {body_part: string; pain_score: number}) => `${b.body_part} (pijn ${b.pain_score}/10)`).join(', ')}`
      : ''

    const context = [
      `Naam: ${profile?.first_name || 'gebruiker'}, niveau: ${profile?.experience_level || 'beginner'}`,
      checkin ? `Check-in: gevoel ${checkin.feeling_score}/10, energie ${checkin.energy_score}/10, stress ${checkin.stress_score || '?'}/10, spierpijn ${checkin.soreness_score || '?'}/10` : 'Geen check-in vandaag',
      garmin ? `Garmin: Body Battery ${garmin.body_battery?.current || '?'}, slaap ${garmin.sleep?.score || '?'}/100, HRV ${garmin.hrv?.avg_7d_ms || '?'}ms` : '',
      blessureContext,
      goals.length > 0 ? `Doelen: ${goals.map((g: {title: string}) => g.title).join(', ')}` : '',
      runningAvailable ? stravaRunningContext : '',
      cyclingAvailable ? stravaCyclingContext : '',
      dagplanContext,
    ].filter(Boolean).join('\n')

    const keuzeModules = (['kettlebell', 'rowing', 'running', 'cycling', 'bodyweight'] as const).filter(m =>
      m === 'kettlebell' ? kettlebellAvailable : m === 'rowing' ? rowingAvailable : m === 'running' ? runningAvailable : m === 'cycling' ? cyclingAvailable : bodyweightAvailable
    )

    // Bij library-keuze wint forcedModule altijd — coach bepaalt alleen intensiteit
    const moduleKeuze = isLibrary && forcedModule
      ? `De gebruiker heeft gekozen voor "${forcedModule}". training_type MOET "${forcedModule}" zijn. Bepaal het sessietype binnen deze module op basis van de coach-intensiteit hierboven.`
      : keuzeModules.length > 1
        ? `Kies het beste training_type uit: ${keuzeModules.map(m => `"${m}"`).join(', ')}, op basis van de data en het dagplan.`
        : keuzeModules.length === 1
          ? `training_type MOET "${keuzeModules[0]}" zijn.`
          : 'training_type MOET "kettlebell" zijn.'

    // Optie C: Kettlebell filter — coach bepaalt doel → route filtert →
    // Trainer AI krijgt de lijst en assembleert de sessie
    let kettlebellContext = ''
    if (isLibrary && forcedModule === 'kettlebell' || (!isLibrary && kettlebellAvailable)) {
      const kbDoel: KettlebellDoel = coachActieType === 'herstel' ? 'herstel'
        : coachActieType === 'rust' ? 'herstel'
        : 'kracht'
      const kbNiveau = profile?.experience_level === 'gevorderd' ? 'gevorderd'
        : profile?.experience_level === 'intermediate' ? 'gemiddeld'
        : 'beginner'
      const kbOef = filterKettlebell(kbDoel, kbNiveau as 'beginner' | 'gemiddeld' | 'gevorderd')
      if (kbOef.length > 0) {
        kettlebellContext = `\nBESCHIKBARE KETTLEBELL OEFENINGEN (gebruik UITSLUITEND deze lijst bij kettlebell training):\n${formateerKettlebellVoorPrompt(kbOef)}`
      }
    }

    // Optie C: Strength filter
    let strengthContext = ''
    if (isLibrary && forcedModule === 'strength' || (!isLibrary && (profile?.dumbbell_available || profile?.barbell_available))) {
      const krachtDoel: KrachtDoel = coachActieType === 'herstel' ? 'herstel'
        : coachActieType === 'rust' ? 'herstel'
        : 'kracht'
      const beschikbaarEquipment: Equipment[] = []
      if (profile?.dumbbell_available) beschikbaarEquipment.push('dumbbell')
      if (profile?.barbell_available) beschikbaarEquipment.push('barbell')
      if (beschikbaarEquipment.length === 0) beschikbaarEquipment.push('dumbbell')
      const strengthOef = filterStrength(krachtDoel, beschikbaarEquipment)
      if (strengthOef.length > 0) {
        strengthContext = `\nBESCHIKBARE STRENGTH OEFENINGEN (gebruik UITSLUITEND deze lijst bij strength training):\n${formateerStrengthVoorPrompt(strengthOef)}`
      }
    }

    // Optie C: Mobility filter
    let mobilityContext = ''
    {
      const mobilityDoel: MobilityDoel = coachActieType === 'herstel' || coachActieType === 'rust'
        ? 'herstel' : 'mobiliteit'

      // Blessure-gebaseerde lichaamsdeel focus
      let mobilityLichaamsdeel: MobilityLichaamsdeel | undefined = undefined
      if (blessures.length > 0) {
        const blessurePart = blessures[0]?.body_part?.toLowerCase() || ''
        if (blessurePart.includes('heup') || blessurePart.includes('hip')) mobilityLichaamsdeel = 'heupen'
        else if (blessurePart.includes('hamstring')) mobilityLichaamsdeel = 'hamstrings'
        else if (blessurePart.includes('kuit') || blessurePart.includes('enkel')) mobilityLichaamsdeel = 'kuiten'
        else if (blessurePart.includes('rug') || blessurePart.includes('back')) mobilityLichaamsdeel = 'onderrug'
        else if (blessurePart.includes('schouder')) mobilityLichaamsdeel = 'schouders'
        else if (blessurePart.includes('nek')) mobilityLichaamsdeel = 'nek'
      }

      const mobilityOef = filterMobility(mobilityDoel, mobilityLichaamsdeel)
      if (mobilityOef.length > 0) {
        mobilityContext = `
BESCHIKBARE MOBILITY OEFENINGEN (gebruik UITSLUITEND deze lijst bij mobility recovery_modules):
${formateerMobilityVoorPrompt(mobilityOef)}`
      }
    }

    // Optie C: Running drill filter
    let runningContext = ''
    if (isLibrary && forcedModule === 'running' || (!isLibrary && runningAvailable)) {
      const runningDoel: RunningDoel = coachActieType === 'herstel' || coachActieType === 'rust'
        ? 'herstel' : 'uithoudingsvermogen'
      const runningNiveau = profile?.experience_level === 'gevorderd' ? 'gevorderd'
        : profile?.experience_level === 'intermediate' ? 'gemiddeld' : 'beginner'
      const runningDrills = filterRunning(runningDoel, runningNiveau as 'beginner' | 'gemiddeld' | 'gevorderd')
      if (runningDrills.length > 0) {
        runningContext = `
BESCHIKBARE RUNNING SESSIES (gebruik UITSLUITEND deze lijst bij running training, gebruik de session_type waarde):
${formateerRunningVoorPrompt(runningDrills)}`
      }
    }

    // Optie C: Rowing drill filter
    let rowingContext = ''
    if (isLibrary && forcedModule === 'rowing' || (!isLibrary && rowingAvailable)) {
      const rowingDoel: RowingDoel = coachActieType === 'herstel' || coachActieType === 'rust'
        ? 'herstel' : 'uithoudingsvermogen'
      const rowingNiveau = profile?.experience_level === 'gevorderd' ? 'gevorderd'
        : profile?.experience_level === 'intermediate' ? 'gemiddeld' : 'beginner'
      const rowingDrills = filterRowing(rowingDoel, rowingNiveau as 'beginner' | 'gemiddeld' | 'gevorderd')
      if (rowingDrills.length > 0) {
        rowingContext = `
BESCHIKBARE ROWING SESSIES (gebruik UITSLUITEND deze lijst bij rowing training, gebruik de session_type waarde):
${formateerRowingVoorPrompt(rowingDrills)}`
      }
    }

    // Optie C: Cycling drill filter
    let cyclingContext = ''
    if (isLibrary && forcedModule === 'cycling' || (!isLibrary && cyclingAvailable)) {
      const cyclingDoel: CyclingDoel = coachActieType === 'herstel' || coachActieType === 'rust'
        ? 'herstel' : 'uithoudingsvermogen'
      const cyclingNiveau = profile?.experience_level === 'gevorderd' ? 'gevorderd'
        : profile?.experience_level === 'intermediate' ? 'gemiddeld' : 'beginner'
      const cyclingDrills = filterCycling(cyclingDoel, cyclingNiveau as 'beginner' | 'gemiddeld' | 'gevorderd')
      if (cyclingDrills.length > 0) {
        cyclingContext = `
BESCHIKBARE CYCLING SESSIES (gebruik UITSLUITEND deze lijst bij cycling training, gebruik de session_type waarde):
${formateerCyclingVoorPrompt(cyclingDrills)}`
      }
    }

    // Optie C: Recovery filter
    let recoveryContext = ''
    {
      const recoveryDoel: RecoveryDoel = coachActieType === 'herstel' || coachActieType === 'rust'
        ? 'herstel'
        : coachActieType === 'stress' ? 'stress'
        : 'herstel'
      const recoveryModules = filterRecovery(recoveryDoel)
      if (recoveryModules.length > 0) {
        recoveryContext = `\nBESCHIKBARE RECOVERY MODULES (gebruik UITSLUITEND deze lijst bij recovery_modules):\n${formateerRecoveryVoorPrompt(recoveryModules)}`
      }
    }

    // Optie C: Coach bepaalt doel → route filtert bodyweight oefeningen →
    // Trainer AI krijgt de lijst en maakt de sessie
    let bodyweightContext = ''
    if (isLibrary && forcedModule === 'bodyweight' || (!isLibrary && bodyweightAvailable)) {
      const coachDoel: CoachDoel = coachActieType === 'herstel' ? 'herstel'
        : coachActieType === 'rust' ? 'herstel'
        : 'kracht'
      const beschikbaar = filterOpCoachDoel(coachDoel)
      if (beschikbaar.length > 0) {
        bodyweightContext = `
BESCHIKBARE BODYWEIGHT OEFENINGEN (gebruik UITSLUITEND deze lijst bij bodyweight training):
${formateerVoorPrompt(beschikbaar)}`
      }
    }

    const systemPrompt = `Je bent Trainer AI van CoachOS. Genereer een trainingsschema.

${isLibrary && forcedModule ? `⚠️ GEFIXEERDE MODULE: training_type is al bepaald door de gebruiker en STAAT VAST op "${forcedModule}". Jij vult ALLEEN de sessie-inhoud in (sessietype, segmenten, intensiteit, duur, bericht). Je mag training_type NIET wijzigen — zelfs niet als de coach herstel heeft geadviseerd. Dat is al verwerkt in de intensiteit hieronder.` : ''}

COACH STURING:
${coachSturingContext || 'Geen specifiek coach advies — gebruik eigen inschatting op basis van de data.'}

DATA:
${context}

MODULE KEUZE:
${moduleKeuze}

REGELS:
- training_type MOET "${isLibrary && forcedModule ? forcedModule : 'de gekozen module'}" zijn — niet wijzigen
- Coach sturing bepaalt intensiteit en sessietype, NIET het training_type bij library-keuze
- Bij lage energie of herstel: lichtere intensiteit, recovery sessietype
- duration = totale sessieduur in minuten

KETTLEBELL: genereer 4-6 oefeningen. Elk segment: type:"kettlebell", exercise, sets, reps of duration_sec, rest_sec, level, instruction, cue, common_errors, weight_kg (geadviseerd gewicht — kies UITSLUITEND uit 14, 16, 20, 24, 28, 32, gebaseerd op oefening-zwaarte en niveau van de gebruiker), target_tempo (geadviseerd tempo — UITSLUITEND "slow", "normal" of "fast", gebaseerd op het type oefening: explosieve bewegingen zoals swings = "fast", gecontroleerde bewegingen zoals squats = "normal" of "slow").

ROWING (Concept2): session_type kiezen (recovery/endurance/tempo/interval/sprint/test). Elk segment: type:"rowing", exercise, session_type, sets, reps:null, duration_sec, rest_sec, instruction, cue, common_errors, equipment_required:["concept2"]. Optioneel: distance_m, target_split, target_spm, target_hr_zone.

RUNNING: session_type kiezen. Elk segment: type:"running", exercise, session_type, sets, reps:null, duration_sec, rest_sec, instruction, cue, common_errors, equipment_required:["running"]. Optioneel: distance_m, target_pace, target_hr_zone.

CYCLING: session_type kiezen. Elk segment: type:"cycling", exercise, session_type, sets, reps:null, duration_sec, rest_sec, instruction, cue, common_errors, equipment_required:["cycling"]. Optioneel: target_power_w, target_cadence_rpm, target_hr_zone.

Reageer ALLEEN in dit JSON formaat:
{
  "training_allowed": true,
  "training_type": "${isLibrary && forcedModule ? forcedModule : 'MODULE'}",
  "title": "Korte titel",
  "intensity": "light",
  "duration": 30,
  "segments": [],
  "recovery_modules": [
    { "type": "breathing", "subtype": "box_breathing", "duration": 6, "label": "Box Breathing" }
  ],
  "reason": "Korte reden",
  "coach_message": "Persoonlijk motiverend bericht"
}`

    // Module-specifieke fallbacks — bij mislukte AI-call altijd het juiste type terug
    // v2.4.51: kettlebellFallback-segmenten kregen weight_kg + target_tempo,
    // consistent met de nieuwe prompt-instructie hierboven — anders zou
    // een mislukte AI-call terugvallen op segmenten zonder advies.
    const kettlebellFallback: TrainingInstruction = {
      training_allowed: true,
      training_type: 'kettlebell',
      title: 'Kettlebell sessie',
      intensity: coachActieType === 'herstel' ? 'light' : 'medium',
      duration: 30,
      segments: [
        { type: 'kettlebell', exercise: 'Two Hand Swing', sets: 4, reps: 15, duration_sec: null, rest_sec: 60, level: 1,
          instruction: 'Hinge vanuit de heupen, drijf krachtig vooruit.', cue: 'Heupen drijven', common_errors: ['Rug rolt', 'Armen trekken'],
          weight_kg: 16, target_tempo: 'fast' },
        { type: 'kettlebell', exercise: 'Goblet Squat', sets: 3, reps: 12, duration_sec: null, rest_sec: 60, level: 1,
          instruction: 'Houd de bell voor de borst, zak diep door de knieën.', cue: 'Borst omhoog', common_errors: ['Rug rolt voorover'],
          weight_kg: 16, target_tempo: 'normal' },
        { type: 'kettlebell', exercise: 'Farmer Carry', sets: 3, reps: null, duration_sec: 40, rest_sec: 60, level: 1,
          instruction: 'Loop rechtop met de kettlebell naast je lichaam.', cue: 'Schouders omlaag', common_errors: ['Romp kantelt'],
          weight_kg: 20, target_tempo: null },
      ] as unknown[],
      recovery_modules: [{ type: 'breathing', subtype: 'box_breathing', duration: 6, label: 'Box Breathing' }],
      reason: 'Standaard kettlebell sessie',
      coach_message: 'Goed bezig! Luister naar je lichaam.',
    }

    const rowingFallback: TrainingInstruction = {
      training_allowed: true,
      training_type: 'rowing',
      title: 'Rowing sessie',
      intensity: coachActieType === 'herstel' ? 'light' : 'medium',
      duration: coachActieType === 'herstel' ? 20 : 30,
      segments: coachActieType === 'herstel' ? [
        { type: 'rowing', exercise: '20 min Recovery Row', session_type: 'recovery', sets: 1, reps: null,
          duration_sec: 1200, rest_sec: 0, target_spm: 18, target_hr_zone: 'Zone 1-2',
          instruction: 'Roei rustig en ontspannen, focus op lange halen en lage hartslag.', cue: 'Adem rustig mee met de haal',
          common_errors: ['Tempo te hoog', 'Slagfrequentie te hoog'], equipment_required: ['concept2'] },
      ] as unknown[] : [
        { type: 'rowing', exercise: '5 min Inroeien', session_type: 'recovery', sets: 1, reps: null,
          duration_sec: 300, rest_sec: 0, target_spm: 20, target_hr_zone: 'Zone 1-2',
          instruction: 'Roei rustig in, focus op een lange, ontspannen haal.', cue: 'Adem rustig mee',
          common_errors: ['Te snel starten'], equipment_required: ['concept2'] },
        { type: 'rowing', exercise: '500m Interval', session_type: 'interval', sets: 6, reps: null,
          duration_sec: 125, rest_sec: 60, distance_m: 500, target_split: '2:05', target_spm: 26, target_hr_zone: 'Zone 3-4',
          instruction: 'Houd de catch scherp, drive met de benen.', cue: 'Benen - rug - armen',
          common_errors: ['Te vroeg armen trekken', 'Slagfrequentie te hoog', 'Inzakken in de recovery'],
          equipment_required: ['concept2'] },
        { type: 'rowing', exercise: '5 min Uitroeien', session_type: 'recovery', sets: 1, reps: null,
          duration_sec: 300, rest_sec: 0, target_spm: 18, target_hr_zone: 'Zone 1',
          instruction: 'Roei rustig uit om af te koelen.', cue: 'Lange, rustige halen',
          common_errors: ['Te abrupt stoppen'], equipment_required: ['concept2'] },
      ] as unknown[],
      recovery_modules: [{ type: 'breathing', subtype: 'box_breathing', duration: 6, label: 'Box Breathing' }],
      reason: 'Standaard rowing sessie',
      coach_message: 'Mooie rowing sessie — focus op techniek!',
    }

    const runningFallback: TrainingInstruction = {
      training_allowed: true,
      training_type: 'running',
      title: 'Running sessie',
      intensity: coachActieType === 'herstel' ? 'light' : 'medium',
      duration: coachActieType === 'herstel' ? 25 : 35,
      segments: [
        { type: 'running', exercise: coachActieType === 'herstel' ? '25 min Recovery Run' : '5km Steady Run',
          session_type: coachActieType === 'herstel' ? 'recovery' : 'endurance',
          sets: 1, reps: null,
          duration_sec: coachActieType === 'herstel' ? 1500 : 1800,
          rest_sec: 0,
          distance_m: coachActieType === 'herstel' ? undefined : 5000,
          target_pace: coachActieType === 'herstel' ? '6:30/km' : '6:00/km',
          target_hr_zone: coachActieType === 'herstel' ? 'Zone 1-2' : 'Zone 2',
          instruction: 'Loop op een constant, comfortabel tempo. Praten moet nog mogelijk zijn.',
          cue: 'Rustige, gelijkmatige adem',
          common_errors: ['Tempo te hoog starten', 'Te grote pasgrootte bij vermoeidheid'],
          equipment_required: ['running'] },
      ] as unknown[],
      recovery_modules: [{ type: 'breathing', subtype: 'box_breathing', duration: 6, label: 'Box Breathing' }],
      reason: 'Standaard running sessie',
      coach_message: 'Lekker rustig erin lopen vandaag!',
    }

    const cyclingFallback: TrainingInstruction = {
      training_allowed: true,
      training_type: 'cycling',
      title: 'Cycling sessie',
      intensity: coachActieType === 'herstel' ? 'light' : 'medium',
      duration: coachActieType === 'herstel' ? 30 : 45,
      segments: [
        { type: 'cycling', exercise: coachActieType === 'herstel' ? '30 min Recovery Ride' : '45 min Steady Ride',
          session_type: coachActieType === 'herstel' ? 'recovery' : 'endurance',
          sets: 1, reps: null,
          duration_sec: coachActieType === 'herstel' ? 1800 : 2700,
          rest_sec: 0,
          target_cadence_rpm: 85,
          target_hr_zone: coachActieType === 'herstel' ? 'Zone 1-2' : 'Zone 2',
          instruction: 'Rij op een constant, comfortabel tempo. Houd cadans hoog en soepel.',
          cue: 'Soepele trap, ontspannen bovenlichaam',
          common_errors: ['Cadans te laag', 'Te hard starten'],
          equipment_required: ['cycling'] },
      ] as unknown[],
      recovery_modules: [{ type: 'breathing', subtype: 'box_breathing', duration: 6, label: 'Box Breathing' }],
      reason: 'Standaard cycling sessie',
      coach_message: 'Rustig en gecontroleerd fietsen vandaag!',
    }

    // Strength fallback
    const strengthFallback: TrainingInstruction = {
      training_allowed: true,
      training_type: 'strength',
      title: coachActieType === 'herstel' ? 'Herstel Kracht' : 'Krachttraining',
      intensity: coachActieType === 'herstel' ? 'light' : 'medium',
      duration: coachActieType === 'herstel' ? 20 : 45,
      segments: [
        { type: 'strength', exercise: 'Goblet Squat', session_type: 'kracht', sets: 4, reps: '10-12', rest_sec: 60,
          instruction: 'Dumbbell voor de borst, diep squatten.', cue: 'Ellebogen duwen knieën naar buiten', common_errors: ['Borst naar voren', 'Knieën naar binnen'], equipment: 'dumbbell' },
        { type: 'strength', exercise: 'Dumbbell Row', session_type: 'kracht', sets: 4, reps: '10-12', rest_sec: 60,
          instruction: 'Elleboog recht omhoog langs het lichaam trekken.', cue: 'Trek naar de heup', common_errors: ['Romp roteren', 'Elleboog te wijd'], equipment: 'dumbbell' },
        { type: 'strength', exercise: 'Dumbbell Bench Press', session_type: 'kracht', sets: 4, reps: '8-12', rest_sec: 60,
          instruction: 'Dumbbells boven de borst omhoog drukken.', cue: 'Schouderbladen samenknijpen', common_errors: ['Ellebogen te wijd', 'Heupen optillen'], equipment: 'dumbbell' },
        { type: 'strength', exercise: 'Romanian Deadlift Dumbbell', session_type: 'kracht', sets: 3, reps: '10-12', rest_sec: 60,
          instruction: 'Buig vanuit de heupen met rechte rug.', cue: 'Stang dicht langs de benen', common_errors: ['Rug afronden', 'Knieën te veel buigen'], equipment: 'dumbbell' },
        { type: 'strength', exercise: 'Dumbbell Shoulder Press', session_type: 'kracht', sets: 3, reps: '10-12', rest_sec: 60,
          instruction: 'Dumbbells recht omhoog drukken vanuit schouderhoogte.', cue: 'Core actief houden', common_errors: ['Rug hol trekken', 'Dumbbells naar voren drukken'], equipment: 'dumbbell' },
      ] as unknown[],
      recovery_modules: [],
      reason: coachActieType === 'herstel' ? 'Lichte krachtsessie op hersteldag' : 'Standaard krachttraining',
      coach_message: coachActieType === 'herstel' ? 'Lichte krachttraining vandaag — focus op techniek.' : 'Krachttraining vandaag — compound bewegingen.',
    }

    // Bodyweight fallback
    const bodyweightFallback: TrainingInstruction = {
      training_allowed: true,
      training_type: 'bodyweight',
      title: coachActieType === 'herstel' ? 'Herstel & Mobiliteit' : 'Bodyweight Training',
      intensity: coachActieType === 'herstel' ? 'light' : 'medium',
      duration: coachActieType === 'herstel' ? 20 : 30,
      segments: coachActieType === 'herstel' ? [
        { type: 'bodyweight', exercise: 'Cat-Cow', session_type: 'recovery', sets: 1, reps: null, duration_sec: 120,
          rest_sec: 0, instruction: 'Beweeg langzaam tussen Cat en Cow, gesynchroniseerd met je adem.', cue: 'Adem in bij Cow, uit bij Cat', common_errors: ['Te snel bewegen', 'Adem loskoppelen'] },
        { type: 'bodyweight', exercise: 'Childs Pose', session_type: 'recovery', sets: 1, reps: null, duration_sec: 60,
          rest_sec: 0, instruction: 'Heupen naar hielen, armen gestrekt, laat je rug ontspannen.', cue: 'Zak dieper bij elke uitademing', common_errors: ['Schouders optrekken'] },
        { type: 'bodyweight', exercise: 'Thoracale Rotatie', session_type: 'recovery', sets: 2, reps: null, duration_sec: 45,
          rest_sec: 15, instruction: 'Lig op je zij, roteer je bovenlichaam langzaam.', cue: 'Knieën blijven op de grond', common_errors: ['Knieën optillen', 'Te snel draaien'] },
        { type: 'bodyweight', exercise: 'Dead Bug', session_type: 'recovery', sets: 2, reps: null, duration_sec: 40,
          rest_sec: 20, instruction: 'Onderrug plat op de mat, strek arm en been tegelijk.', cue: 'Rug plat houden', common_errors: ['Onderrug van mat', 'Te snel'] },
        { type: 'bodyweight', exercise: 'Deep Squat Hold', session_type: 'recovery', sets: 1, reps: null, duration_sec: 60,
          rest_sec: 0, instruction: 'Zak diep en houd de positie ontspannen vast.', cue: 'Knieën naar buiten duwen', common_errors: ['Hielen van grond', 'Spanning vasthouden'] },
      ] as unknown[] : [
        { type: 'bodyweight', exercise: 'Air Squat', session_type: 'strength', sets: 3, reps: null, duration_sec: 40,
          rest_sec: 45, instruction: 'Borst omhoog, knieën volgen de tenen.', cue: 'Drijf via de hielen', common_errors: ['Borst naar voren', 'Knieën naar binnen'] },
        { type: 'bodyweight', exercise: 'Push-Up', session_type: 'strength', sets: 3, reps: null, duration_sec: 35,
          rest_sec: 45, instruction: 'Lichaam recht als een plank, borst bijna de grond.', cue: 'Ellebogen op 45 graden', common_errors: ['Heupen zakken', 'Ellebogen te wijd'] },
        { type: 'bodyweight', exercise: 'Glute Bridge', session_type: 'strength', sets: 3, reps: null, duration_sec: 35,
          rest_sec: 30, instruction: 'Bilspieren aanspannen en heupen omhoog duwen.', cue: 'Span billen aan bovenin', common_errors: ['Rug hol trekken', 'Knieën naar binnen'] },
        { type: 'bodyweight', exercise: 'Plank', session_type: 'core', sets: 3, reps: null, duration_sec: 30,
          rest_sec: 30, instruction: 'Lichaam recht, core actief, adem rustig door.', cue: 'Heupen in lijn', common_errors: ['Heupen omhoog', 'Adem inhouden'] },
        { type: 'bodyweight', exercise: 'Superman', session_type: 'strength', sets: 3, reps: null, duration_sec: 30,
          rest_sec: 30, instruction: 'Til armen en benen gelijktijdig op en houd vast.', cue: 'Hoofd in lijn', common_errors: ['Niet gelijktijdig', 'Te snel'] },
      ] as unknown[],
      recovery_modules: [{ type: 'breathing', subtype: 'box_breathing', duration: 6, label: 'Box Breathing' }],
      reason: coachActieType === 'herstel' ? 'Herstel bodyweight sessie' : 'Standaard bodyweight sessie',
      coach_message: coachActieType === 'herstel' ? 'Rustig bewegen vandaag — mobiliteit en herstel.' : 'Bodyweight training — geen materiaal nodig!',
    }

    // Kies de juiste fallback op basis van forcedModule of beschikbaar equipment
    const fallbackInstruction: TrainingInstruction = isLibrary && forcedModule === 'rowing'
      ? rowingFallback
      : isLibrary && forcedModule === 'running'
        ? runningFallback
        : isLibrary && forcedModule === 'cycling'
          ? cyclingFallback
          : isLibrary && forcedModule === 'kettlebell'
            ? kettlebellFallback
            : isLibrary && forcedModule === 'bodyweight'
              ? bodyweightFallback
              : isLibrary && forcedModule === 'strength'
              ? strengthFallback
              : coachActieType === 'rust'
              ? { training_allowed: false, training_type: null, intensity: null, duration: null,
                  recovery_modules: [], reason: 'Coach adviseert rust vandaag', coach_message: 'Vandaag is herstel de training.' }
              : kettlebellAvailable ? kettlebellFallback
              : rowingAvailable ? rowingFallback
              : runningAvailable ? runningFallback
              : cyclingAvailable ? cyclingFallback
              : kettlebellFallback

    // Voeg bibliotheek context toe aan de system prompt
    const bibliotheekContext = [
      kettlebellContext,
      bodyweightContext,
      strengthContext,
      mobilityContext,
      recoveryContext,
      runningContext,
      rowingContext,
      cyclingContext,
    ].filter(Boolean).join('\n')

    // Beschikbare mobility subtypes — AI mag alleen hieruit kiezen
    // Mobility subtypes — exact de ids uit mobility-exercises.ts
    const mobilitySubtypes = [
      'neck_shoulders', 'hips', 'full_body', 'hamstring_stretch',
      'hip_flexor', 'lower_back', 'thoracic', 'shoulder_mobility',
      'calf_ankle', 'recovery_flow', 'spine_mobility',
      'nek-kantelen', 'schouder-cirkels', 'cat-cow', 'kind-houding',
      'heupbuiger-stretch', 'piriformis-stretch', 'hamstring-stretch-liggend',
      'wereld-grootste-stretch', 'deep-squat-hold', 'savasana'
    ]
    const mobilityInstructie = `\n\nVOOR MOBILITY MODULES: gebruik als subtype UITSLUITEND één van deze waarden: ${mobilitySubtypes.join(', ')}. Gebruik GEEN andere subtype namen.`

    const naamInstructie = bibliotheekContext
      ? '\n\nBELANGRIJK: Gebruik in het "exercise" veld UITSLUITEND de exacte naam zoals die in de BESCHIKBARE OEFENINGEN lijst staat. Gebruik GEEN vertalingen, varianten of alternatieve namen. Kopieer de naam exact over.'
      : ''

    const systemPromptMet = bibliotheekContext
      ? systemPrompt + '\n' + bibliotheekContext + naamInstructie + mobilityInstructie
      : systemPrompt

    let instruction: TrainingInstruction = fallbackInstruction

    try {
      // Directe Anthropic API call — geen /api/ai proxy (die geeft 500 errors)
      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2000,
          system: systemPromptMet,
          messages: [{ role: 'user', content: 'Genereer het trainingsschema.' }],
        }),
      })

      if (aiRes.ok) {
        const aiData = await aiRes.json()
        const rawText = aiData.content?.[0]?.text || ''
        const jsonMatch = rawText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])

          if (isLibrary && forcedModule) {
            // Bij library + herstel/rust: altijd fallback — Haiku genereert
            // bij herstel te vaak wandel/jog segmenten, ook bij rowing/cycling keuze
            if (coachActieType === 'herstel' || coachActieType === 'rust') {
              instruction = fallbackInstruction
            } else {
              // Bij trainen: controleer of segmenten kloppen
              const segments = parsed.segments || []
              const segmentsKloppen = segments.length > 0 &&
                segments.every((s: { type?: string }) => s.type === forcedModule)
              if (segmentsKloppen) {
                parsed.training_type = forcedModule
                parsed.training_allowed = true
                instruction = parsed
              } else {
                instruction = fallbackInstruction
              }
            }
          } else {
            // Normale flow
            const parsedType = parsed.training_type
            const typeAllowed = !parsedType ||
              (parsedType === 'rowing' && rowingAvailable) ||
              (parsedType === 'kettlebell' && kettlebellAvailable) ||
              (parsedType === 'running' && runningAvailable) ||
              (parsedType === 'cycling' && cyclingAvailable) ||
              (parsedType === 'bodyweight' && bodyweightAvailable) ||
              (parsedType === 'strength' && (profile?.dumbbell_available || profile?.barbell_available || true))

            if ((parsed.segments && parsed.segments.length > 0 && typeAllowed) || parsed.training_allowed === false) {
              instruction = parsed
            }
          }
        }
      }
    } catch {
      instruction = fallbackInstruction
    }

    await supabase.from('coach_recommendations').upsert({
      user_id: user.id, date: today, type: cacheType,
      training_instruction: instruction,
    }, { onConflict: 'user_id,date,type' })

    return NextResponse.json({ instruction })

  } catch (error) {
    console.error('Training today error:', error)
    return NextResponse.json({ error: 'Generatie mislukt' }, { status: 500 })
  }
}
