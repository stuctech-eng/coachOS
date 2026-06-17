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

// GET — haal gecachede instructie op
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

// POST — genereer nieuw trainingsschema (lichtgewicht)
// Body (optioneel): { module: TrainingModule, source: 'library' }
export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })

    let body: { module?: TrainingModule; source?: string } = {}
    try { body = await req.json() } catch { /* geen body — normale flow */ }
    const forcedModule = body.module
    const isLibrary = body.source === 'library' && !!forcedModule

    const cacheType = isLibrary ? `library_${forcedModule}` : 'training_today'
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
    const [profileRes, checkinRes, garminRes, blessuresRes, goalsRes, stravaRunsRes, stravaRittenRes, coachRecRes] = await Promise.all([
      supabase.from('profiles').select('first_name, experience_level, available_time, kettlebell_available, concept2_available, cycling_available, running_available, dumbbell_available, barbell_available, ab_wheel_available, bodyweight_available').eq('user_id', user.id).single(),
      supabase.from('daily_checkins').select('feeling_score, energy_score, stress_score, motivation_score, soreness_score').eq('user_id', user.id).eq('date', today).single(),
      supabase.from('garmin_imports').select('parsed_data').eq('user_id', user.id).eq('status', 'confirmed').order('date', { ascending: false }).limit(1).single(),
      supabase.from('injuries').select('body_part, pain_score').eq('user_id', user.id).eq('active', true),
      supabase.from('user_goals').select('title').eq('user_id', user.id).eq('status', 'active').limit(2),
      supabase.from('activity_sessions').select('date, duration, metrics, activities!inner(name)').eq('user_id', user.id).eq('source', 'strava').eq('activities.name', 'Hardlopen').gte('date', veertienDagenGeleden).order('date', { ascending: false }).limit(5),
      supabase.from('activity_sessions').select('date, duration, metrics, activities!inner(name)').eq('user_id', user.id).eq('source', 'strava').eq('activities.name', 'Fietsen').gte('date', veertienDagenGeleden).order('date', { ascending: false }).limit(5),
      // Haal het dagelijkse coach advies op — Coach is leidend over training
      supabase.from('coach_recommendations').select('recommendation, actie_type, reasoning').eq('user_id', user.id).eq('date', today).eq('type', 'daily').single(),
    ])

    const profile = profileRes.data
    const checkin = checkinRes.data
    const garmin = garminRes.data?.parsed_data || null
    const blessures = blessuresRes.data || []
    const goals = goalsRes.data || []
    const coachRec = coachRecRes.data

    // Coach advies bepaalt de richting — Trainer AI volgt dit altijd
    const coachActieType = coachRec?.actie_type || null
    const coachAdvies = coachRec?.recommendation || null
    const coachReasoning = coachRec?.reasoning || null

    let coachSturingContext = ''
    if (coachActieType === 'rust') {
      coachSturingContext = `COACH BESLISSING (LEIDEND): RUST vandaag. training_allowed MOET false zijn. Geen training. Alleen lichte herstelmodules (ademhaling, mobiliteit).`
    } else if (coachActieType === 'herstel') {
      coachSturingContext = `COACH BESLISSING (LEIDEND): HERSTEL vandaag. Als training_allowed true is, dan ALLEEN lichte intensiteit (intensity: "light"). Geen zware of matige training. Focus op herstelmodules.`
    } else if (coachActieType === 'trainen') {
      coachSturingContext = `COACH BESLISSING (LEIDEND): TRAINEN vandaag. Training is goedgekeurd. Kies een passende module en intensiteit op basis van de data.`
    }

    if (coachAdvies) {
      coachSturingContext += `\nCoach advies: "${coachAdvies}"`
    }
    if (coachReasoning) {
      coachSturingContext += `\nCoach redenering: "${coachReasoning}"`
    }

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

    const stravaRuns = (stravaRunsRes.data || []) as Array<{ date: string; duration: number; metrics: Record<string, number> }>
    const stravaRunningContext = stravaRuns.length > 0
      ? 'Recente Strava hardloop-historie (laatste ' + stravaRuns.length + ', max 14 dagen):\n' +
        stravaRuns.map((run, i) => {
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
            (m.avg_hr ? `, gem. HS ${m.avg_hr}` : '') +
            (m.avg_cadence ? `, cadans ${m.avg_cadence} spm` : '') +
            (m.elevation ? `, ${m.elevation}m hoogteverschil` : '')
        }).join('\n')
      : 'Geen recente Strava hardloop-historie (laatste 14 dagen).'

    const stravaRitten = (stravaRittenRes.data || []) as Array<{ date: string; duration: number; metrics: Record<string, number> }>
    const stravaCyclingContext = stravaRitten.length > 0
      ? 'Recente Strava fiets-historie (laatste ' + stravaRitten.length + ', max 14 dagen):\n' +
        stravaRitten.map((rit, i) => {
          const m = rit.metrics || {}
          const km = m.distance ? (m.distance / 1000).toFixed(1) : '?'
          const speed = m.avg_speed ? `${m.avg_speed} km/u` : '?'
          return `Rit ${i + 1} (${rit.date}): ${km} km, ${rit.duration} min, gem. snelheid ${speed}` +
            (m.avg_hr ? `, gem. HS ${m.avg_hr}` : '') +
            (m.avg_watts ? `, gem. ${m.avg_watts}W` : '') +
            (m.weighted_avg_watts ? ` (NP ${m.weighted_avg_watts}W)` : '') +
            (m.avg_cadence ? `, cadans ${m.avg_cadence} rpm` : '') +
            (m.elevation ? `, ${m.elevation}m hoogteverschil` : '')
        }).join('\n')
      : 'Geen recente Strava fiets-historie (laatste 14 dagen).'

    if (isLibrary && forcedModule) {
      if (!isModuleAvailable(forcedModule, equipment)) {
        return NextResponse.json({ error: `Module '${forcedModule}' niet beschikbaar — equipment ontbreekt` }, { status: 403 })
      }
      if (forcedModule !== 'kettlebell' && forcedModule !== 'rowing' && forcedModule !== 'running' && forcedModule !== 'cycling') {
        return NextResponse.json({ error: `Module '${forcedModule}' wordt nog niet ondersteund` }, { status: 400 })
      }
    }

    const context = [
      `Naam: ${profile?.first_name || 'gebruiker'}, niveau: ${profile?.experience_level || 'beginner'}`,
      checkin ? `Check-in: gevoel ${checkin.feeling_score}/10, energie ${checkin.energy_score}/10, stress ${checkin.stress_score || '?'}/10, spierpijn ${checkin.soreness_score || '?'}/10` : 'Geen check-in vandaag',
      garmin ? `Garmin: Body Battery ${garmin.body_battery?.current || '?'}, slaap ${garmin.sleep?.score || '?'}/100, HRV ${garmin.hrv?.avg_7d_ms || '?'}ms` : '',
      blessures.length > 0 ? `Blessures: ${blessures.map((b: {body_part: string; pain_score: number}) => b.body_part + ' pijn ' + b.pain_score + '/10').join(', ')}` : '',
      goals.length > 0 ? `Doelen: ${goals.map((g: {title: string}) => g.title).join(', ')}` : '',
      runningAvailable ? stravaRunningContext : '',
      cyclingAvailable ? stravaCyclingContext : '',
    ].filter(Boolean).join('\n')

    const keuzeModules = (['kettlebell', 'rowing', 'running', 'cycling'] as const).filter(m =>
      m === 'kettlebell' ? kettlebellAvailable : m === 'rowing' ? rowingAvailable : m === 'running' ? runningAvailable : cyclingAvailable
    )
    const moduleKeuze = isLibrary && forcedModule
      ? `De gebruiker heeft zelf gekozen voor de "${forcedModule}" module via de Trainingsbibliotheek. training_type MOET "${forcedModule}" zijn. Bepaal zelf, op basis van de data, het beste sessietype binnen deze module.`
      : keuzeModules.length > 1
        ? `Kies zelf het beste training_type voor vandaag uit: ${keuzeModules.map(m => `"${m}"`).join(', ')}, op basis van de data.`
        : keuzeModules.length === 1
          ? `Het enige beschikbare equipment is voor ${keuzeModules[0]}. training_type MOET "${keuzeModules[0]}" zijn.`
          : 'training_type MOET "kettlebell" zijn.'

    const kettlebellFormat = `KETTLEBELL FORMAT — gebruik dit format als training_type "kettlebell" is:
- Genereer 4-6 oefeningen in segments array
- Elk segment: type:"kettlebell", exercise, sets, reps of duration_sec, rest_sec, level, instruction (1 zin), cue (1 zin), common_errors (2-3 items)
- BESCHIKBARE OEFENINGEN: Two Hand Swing, One Hand Swing, Goblet Squat, Clean, Press, Push Press, Clean & Press, Snatch, Turkish Get-Up, Farmer Carry, Rack Carry, Windmill, Deadlift, Front Squat, Lunge`

    const rowingFormat = `ROWING FORMAT — gebruik dit format als training_type "rowing" is (Concept2):
- Kies een session_type: "recovery", "endurance", "tempo", "interval", "sprint", of "test"
- Elk segment: type:"rowing", exercise, session_type, sets, reps:null, duration_sec, rest_sec, instruction, cue, common_errors, equipment_required: ["concept2"]`

    const runningFormat = `RUNNING FORMAT — gebruik dit format als training_type "running" is:
- Kies een session_type: "recovery", "endurance", "tempo", "interval", "sprint", of "test"
- Elk segment: type:"running", exercise, session_type, sets, reps:null, duration_sec, rest_sec, instruction, cue, common_errors, equipment_required: ["running"]`

    const cyclingFormat = `CYCLING FORMAT — gebruik dit format als training_type "cycling" is:
- Kies een session_type: "recovery", "endurance", "tempo", "interval", "sprint", of "test"
- Elk segment: type:"cycling", exercise, session_type, sets, reps:null, duration_sec, rest_sec, instruction, cue, common_errors, equipment_required: ["cycling"]`

    const systemPrompt = `Je bent Trainer AI van CoachOS. Genereer een trainingsschema op basis van de gebruikersdata.

⚠️ COACH STURING (ALTIJD LEIDEND — volg dit op):
${coachSturingContext || 'Geen specifiek coach advies vandaag — gebruik je eigen inschatting op basis van de data.'}

DATA:
${context}

MODULE KEUZE:
${moduleKeuze}

ALGEMENE REGELS:
- De Coach beslissing hierboven is ALTIJD leidend — overschrijf dit nooit
- Pas intensiteit aan op basis van energie en spierpijn
- Bij lage energie: lichtere oefeningen, minder sets
- Bij hoge spierpijn: vermijd belaste spiergroepen
- duration is de totale geschatte sessieduur in minuten

${kettlebellFormat}

${rowingFormat}

${runningFormat}

${cyclingFormat}

Reageer ALLEEN in dit JSON formaat:
{
  "training_allowed": true,
  "training_type": "kettlebell of rowing",
  "title": "Korte titel van de sessie",
  "intensity": "light, medium of heavy",
  "duration": 30,
  "segments": [ ... zie format hierboven ... ],
  "recovery_modules": [
    { "type": "breathing", "subtype": "box_breathing", "duration": 6, "label": "Box Breathing" }
  ],
  "reason": "Korte reden",
  "coach_message": "Persoonlijk motiverend bericht"
}`

    // Fallback schema's
    const kettlebellFallback: TrainingInstruction = {
      training_allowed: true,
      training_type: 'kettlebell',
      title: 'Kettlebell sessie',
      intensity: 'medium',
      duration: 30,
      segments: [
        { type: 'kettlebell', exercise: 'Two Hand Swing', sets: 4, reps: 15, duration_sec: null, rest_sec: 60, level: 1,
          instruction: 'Hinge vanuit de heupen, drijf krachtig vooruit.', cue: 'Heupen drijven', common_errors: ['Rug rolt', 'Armen trekken'] },
        { type: 'kettlebell', exercise: 'Goblet Squat', sets: 3, reps: 12, duration_sec: null, rest_sec: 60, level: 1,
          instruction: 'Houd de bell voor de borst, zak diep door de knieën.', cue: 'Borst omhoog', common_errors: ['Rug rolt voorover'] },
        { type: 'kettlebell', exercise: 'Clean & Press', sets: 3, reps: 8, duration_sec: null, rest_sec: 90, level: 2,
          instruction: 'Clean naar rack positie, dan press boven het hoofd.', cue: 'Elleboog hoog', common_errors: ['Bell slaat pols'] },
        { type: 'kettlebell', exercise: 'Farmer Carry', sets: 3, reps: null, duration_sec: 40, rest_sec: 60, level: 1,
          instruction: 'Loop rechtop met de kettlebell naast je lichaam.', cue: 'Schouders omlaag', common_errors: ['Romp kantelt'] },
      ] as unknown[],
      recovery_modules: [{ type: 'breathing', subtype: 'box_breathing', duration: 6, label: 'Box Breathing' }],
      reason: 'Standaard kettlebell sessie',
      coach_message: 'Goed bezig! Luister naar je lichaam.',
    }

    const herselFallback: TrainingInstruction = {
      training_allowed: false,
      training_type: null,
      intensity: null,
      duration: null,
      recovery_modules: [
        { type: 'mobility', subtype: 'hips', duration: 10, label: 'Heup mobiliteit' },
        { type: 'breathing', subtype: 'box_breathing', duration: 6, label: 'Box Breathing' },
      ],
      reason: 'Coach adviseert herstel vandaag',
      coach_message: 'Vandaag is herstel de training. Rust is productief.',
    }

    const rowingFallback: TrainingInstruction = {
      training_allowed: true,
      training_type: 'rowing',
      title: 'Rowing sessie',
      intensity: 'medium',
      duration: 30,
      segments: [
        { type: 'rowing', exercise: '500m Interval', session_type: 'interval', sets: 6, reps: null,
          duration_sec: 125, rest_sec: 60, distance_m: 500, target_split: '2:05', target_spm: 26,
          instruction: 'Houd de catch scherp, drive met de benen.', cue: 'Benen - rug - armen',
          common_errors: ['Te vroeg armen trekken'], equipment_required: ['concept2'] },
      ] as unknown[],
      recovery_modules: [{ type: 'breathing', subtype: 'box_breathing', duration: 6, label: 'Box Breathing' }],
      reason: 'Standaard rowing sessie',
      coach_message: 'Mooie rowing sessie vandaag — focus op techniek!',
    }

    const runningFallback: TrainingInstruction = {
      training_allowed: true,
      training_type: 'running',
      title: 'Running sessie',
      intensity: 'medium',
      duration: 30,
      segments: [
        { type: 'running', exercise: '5km Steady Run', session_type: 'endurance', sets: 1, reps: null,
          duration_sec: 1800, rest_sec: 0, distance_m: 5000, target_pace: '6:00/km', target_hr_zone: 'Zone 2',
          instruction: 'Loop op een constant, comfortabel tempo.', cue: 'Rustige, gelijkmatige adem',
          common_errors: ['Tempo te hoog starten'], equipment_required: ['running'] },
      ] as unknown[],
      recovery_modules: [{ type: 'breathing', subtype: 'box_breathing', duration: 6, label: 'Box Breathing' }],
      reason: 'Standaard running sessie',
      coach_message: 'Lekker rustig erin lopen vandaag!',
    }

    const cyclingFallback: TrainingInstruction = {
      training_allowed: true,
      training_type: 'cycling',
      title: 'Cycling sessie',
      intensity: 'medium',
      duration: 45,
      segments: [
        { type: 'cycling', exercise: '45 min Steady Ride', session_type: 'endurance', sets: 1, reps: null,
          duration_sec: 2700, rest_sec: 0, target_cadence_rpm: 85, target_hr_zone: 'Zone 2',
          instruction: 'Rij op een constant, comfortabel tempo.', cue: 'Soepele trap, ontspannen bovenlichaam',
          common_errors: ['Cadans te laag'], equipment_required: ['cycling'] },
      ] as unknown[],
      recovery_modules: [{ type: 'breathing', subtype: 'box_breathing', duration: 6, label: 'Box Breathing' }],
      reason: 'Standaard cycling sessie',
      coach_message: 'Rustig en gecontroleerd fietsen vandaag!',
    }

    // Als coach rust zegt en dit geen library call is — direct herstel teruggeven zonder AI call
    if (coachActieType === 'rust' && !isLibrary) {
      await supabase.from('coach_recommendations').upsert({
        user_id: user.id,
        date: today,
        type: cacheType,
        training_instruction: herselFallback,
      }, { onConflict: 'user_id,date,type' })
      return NextResponse.json({ instruction: herselFallback })
    }

    const fallbackInstruction: TrainingInstruction = isLibrary && forcedModule === 'rowing'
      ? rowingFallback
      : isLibrary && forcedModule === 'running'
        ? runningFallback
        : isLibrary && forcedModule === 'cycling'
          ? cyclingFallback
          : isLibrary && forcedModule === 'kettlebell'
            ? kettlebellFallback
            : coachActieType === 'herstel'
              ? { ...kettlebellFallback, intensity: 'light' }
              : kettlebellAvailable ? kettlebellFallback : rowingAvailable ? rowingFallback : runningAvailable ? runningFallback : cyclingAvailable ? cyclingFallback : kettlebellFallback

    let instruction: TrainingInstruction = fallbackInstruction

    try {
      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
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
          const parsedType = parsed.training_type
          const typeAllowed = isLibrary && forcedModule
            ? parsedType === forcedModule
            : !parsedType || (parsedType === 'rowing' && rowingAvailable) || (parsedType === 'kettlebell' && kettlebellAvailable) || (parsedType === 'running' && runningAvailable) || (parsedType === 'cycling' && cyclingAvailable)
          if ((parsed.segments && parsed.segments.length > 0 && typeAllowed) || parsed.training_allowed === false) {
            instruction = parsed
          }
        }
      }
    } catch {
      instruction = fallbackInstruction
    }

    if (!instruction) return NextResponse.json({ error: 'Geen instructie gegenereerd' }, { status: 500 })

    await supabase.from('coach_recommendations').upsert({
      user_id: user.id,
      date: today,
      type: cacheType,
      training_instruction: instruction,
    }, { onConflict: 'user_id,date,type' })

    return NextResponse.json({ instruction })

  } catch (error) {
    console.error('Training today error:', error)
    return NextResponse.json({ error: 'Generatie mislukt' }, { status: 500 })
  }
}
