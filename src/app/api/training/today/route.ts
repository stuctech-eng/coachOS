export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { getAvailableModules, isModuleAvailable } from '@/utils/equipment'
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

    let body: { module?: TrainingModule; source?: string } = {}
    try { body = await req.json() } catch { /* geen body */ }
    const forcedModule = body.module
    const isLibrary = body.source === 'library' && !!forcedModule
    const cacheType = isLibrary ? `library_${forcedModule}` : 'training_today'

    // Cache check
    {
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

    const keuzeModules = (['kettlebell', 'rowing', 'running', 'cycling'] as const).filter(m =>
      m === 'kettlebell' ? kettlebellAvailable : m === 'rowing' ? rowingAvailable : m === 'running' ? runningAvailable : cyclingAvailable
    )

    // Bij library-keuze wint forcedModule altijd — coach bepaalt alleen intensiteit
    const moduleKeuze = isLibrary && forcedModule
      ? `De gebruiker heeft gekozen voor "${forcedModule}". training_type MOET "${forcedModule}" zijn. Bepaal het sessietype binnen deze module op basis van de coach-intensiteit hierboven.`
      : keuzeModules.length > 1
        ? `Kies het beste training_type uit: ${keuzeModules.map(m => `"${m}"`).join(', ')}, op basis van de data en het dagplan.`
        : keuzeModules.length === 1
          ? `training_type MOET "${keuzeModules[0]}" zijn.`
          : 'training_type MOET "kettlebell" zijn.'

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

KETTLEBELL: genereer 4-6 oefeningen. Elk segment: type:"kettlebell", exercise, sets, reps of duration_sec, rest_sec, level, instruction, cue, common_errors.

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
    const kettlebellFallback: TrainingInstruction = {
      training_allowed: true,
      training_type: 'kettlebell',
      title: 'Kettlebell sessie',
      intensity: coachActieType === 'herstel' ? 'light' : 'medium',
      duration: 30,
      segments: [
        { type: 'kettlebell', exercise: 'Two Hand Swing', sets: 4, reps: 15, duration_sec: null, rest_sec: 60, level: 1,
          instruction: 'Hinge vanuit de heupen, drijf krachtig vooruit.', cue: 'Heupen drijven', common_errors: ['Rug rolt', 'Armen trekken'] },
        { type: 'kettlebell', exercise: 'Goblet Squat', sets: 3, reps: 12, duration_sec: null, rest_sec: 60, level: 1,
          instruction: 'Houd de bell voor de borst, zak diep door de knieën.', cue: 'Borst omhoog', common_errors: ['Rug rolt voorover'] },
        { type: 'kettlebell', exercise: 'Farmer Carry', sets: 3, reps: null, duration_sec: 40, rest_sec: 60, level: 1,
          instruction: 'Loop rechtop met de kettlebell naast je lichaam.', cue: 'Schouders omlaag', common_errors: ['Romp kantelt'] },
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

    // Kies de juiste fallback op basis van forcedModule of beschikbaar equipment
    const fallbackInstruction: TrainingInstruction = isLibrary && forcedModule === 'rowing'
      ? rowingFallback
      : isLibrary && forcedModule === 'running'
        ? runningFallback
        : isLibrary && forcedModule === 'cycling'
          ? cyclingFallback
          : isLibrary && forcedModule === 'kettlebell'
            ? kettlebellFallback
            : coachActieType === 'rust'
              ? { training_allowed: false, training_type: null, intensity: null, duration: null,
                  recovery_modules: [], reason: 'Coach adviseert rust vandaag', coach_message: 'Vandaag is herstel de training.' }
              : kettlebellAvailable ? kettlebellFallback
              : rowingAvailable ? rowingFallback
              : runningAvailable ? runningFallback
              : cyclingAvailable ? cyclingFallback
              : kettlebellFallback

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
          system: systemPrompt,
          messages: [{ role: 'user', content: 'Genereer het trainingsschema.' }],
        }),
      })

      if (aiRes.ok) {
        const aiData = await aiRes.json()
        const rawText = aiData.content?.[0]?.text || ''
        const jsonMatch = rawText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])

          // Bij library-keuze: forceer het type altijd, ongeacht wat AI teruggeeft
          // De AI mag de segmenten/intensiteit/sessietype bepalen, niet het module-type
          if (isLibrary && forcedModule) {
            parsed.training_type = forcedModule
            parsed.training_allowed = true
          }

          const parsedType = parsed.training_type
          const typeAllowed = isLibrary && forcedModule
            ? true // altijd toegestaan, type is al geforceerd
            : !parsedType || (parsedType === 'rowing' && rowingAvailable) ||
              (parsedType === 'kettlebell' && kettlebellAvailable) ||
              (parsedType === 'running' && runningAvailable) ||
              (parsedType === 'cycling' && cyclingAvailable)

          if ((parsed.segments && parsed.segments.length > 0 && typeAllowed) || parsed.training_allowed === false) {
            instruction = parsed
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
