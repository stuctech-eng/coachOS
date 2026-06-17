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

// Detecteer blessure-gerelateerde herstelmodules op basis van actieve blessures
// Coach bepaalt recovery_modules via AI — Trainer voegt niets toe

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
      // Coach advies — leidend over training
      supabase.from('coach_recommendations').select('recommendation, actie_type, reasoning, trainer_instructies').eq('user_id', user.id).eq('date', today).eq('type', 'coach').single(),
      // Dagplan van vandaag — coach heeft dit al gepland
      supabase.from('coach_recommendations').select('action_plan').eq('user_id', user.id).eq('date', today).neq('action_plan', null).order('created_at', { ascending: false }).limit(1).single(),
    ])

    const profile = profileRes.data
    const checkin = checkinRes.data
    const garmin = garminRes.data?.parsed_data || null
    const blessures = blessuresRes.data || []
    const goals = goalsRes.data || []
    const coachRec = coachRecRes.data
    const dagplan: Array<{ tijd: string; actie: string }> = dagplanRes.data?.action_plan || []

    // Coach bepaalt — Trainer pakt het over
    // Geen eigen blessure logica in Trainer
    const coachActieType = coachRec?.actie_type || null
    const coachAdvies = coachRec?.recommendation || null
    const coachReasoning = coachRec?.reasoning || null
    const trainerInstructies = coachRec?.trainer_instructies || null

    // Coach bepaalt recovery_modules — Trainer voegt NIETS toe
    // AI leest het dagplan als context en bepaalt zelf de juiste modules

    let coachSturingContext = ''
    if (coachActieType === 'rust') {
      coachSturingContext = `COACH BESLISSING (LEIDEND): RUST vandaag. training_allowed MOET false zijn. Geen training. Alleen herstelmodules.`
    } else if (coachActieType === 'herstel') {
      coachSturingContext = `COACH BESLISSING (LEIDEND): HERSTEL vandaag. Als training_allowed true is, ALLEEN intensity "light". Geen zware of matige training.`
    } else if (coachActieType === 'trainen') {
      coachSturingContext = `COACH BESLISSING (LEIDEND): TRAINEN vandaag. Training is goedgekeurd. Kies passende module en intensiteit.`
    }
    if (coachAdvies) coachSturingContext += `\nCoach advies: "${coachAdvies}"`
    if (coachReasoning) coachSturingContext += `\nCoach redenering: "${coachReasoning}"`
    if (trainerInstructies) coachSturingContext += `\n\n⚠️ DIRECTE INSTRUCTIE VAN COACH AAN TRAINER: ${trainerInstructies}`

    // Dagplan context voor Trainer AI
    const dagplanContext = dagplan.length > 0
      ? `\nDagplan van Coach (volg dit op):\n${dagplan.map(d => `${d.tijd}: ${d.actie}`).join('\n')}`
      : ''

    // Blessure context
    const blessureContext = blessures.length > 0
      ? `\nActieve blessures: ${blessures.map((b: {body_part: string; pain_score: number}) => `${b.body_part} (pijn ${b.pain_score}/10)`).join(', ')}`
      : ''

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

    if (isLibrary && forcedModule) {
      if (!isModuleAvailable(forcedModule, equipment)) {
        return NextResponse.json({ error: `Module '${forcedModule}' niet beschikbaar` }, { status: 403 })
      }
    }

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
    const moduleKeuze = isLibrary && forcedModule
      ? `De gebruiker koos zelf voor "${forcedModule}". training_type MOET "${forcedModule}" zijn.`
      : keuzeModules.length > 1
        ? `Kies het beste training_type uit: ${keuzeModules.map(m => `"${m}"`).join(', ')}, op basis van de data en het dagplan.`
        : keuzeModules.length === 1
          ? `training_type MOET "${keuzeModules[0]}" zijn.`
          : 'training_type MOET "kettlebell" zijn.'

    const systemPrompt = `Je bent Trainer AI van CoachOS. Genereer een trainingsschema dat aansluit op het dagplan van de Coach.

⚠️ COACH STURING (ALTIJD LEIDEND):
${coachSturingContext || 'Geen specifiek coach advies — gebruik eigen inschatting op basis van de data.'}

DATA:
${context}

MODULE KEUZE:
${moduleKeuze}

REGELS:
- Coach beslissing is ALTIJD leidend
- Stem het trainingsschema af op het dagplan van de Coach
- Bij lage energie of herstel: lichte intensiteit, kortere duur
- duration = totale sessieduur in minuten
- Heup mobiliteit oefeningen zijn herstel — die staan al in recovery_modules, NIET in segments

BLESSURE INFO (alleen als context):
${blessures.length > 0 ? blessures.map((b: {body_part: string; pain_score: number}) => `${b.body_part} (pijn ${b.pain_score}/10)`).join(', ') : 'Geen actieve blessures.'}
De Coach heeft al rekening gehouden met blessures in het advies en dagplan. Volg dat op.

KETTLEBELL: genereer 4-6 oefeningen. Elk segment: type:"kettlebell", exercise, sets, reps of duration_sec, rest_sec, level, instruction, cue, common_errors.

ROWING (Concept2): session_type kiezen (recovery/endurance/tempo/interval/sprint/test). Elk segment: type:"rowing", exercise, session_type, sets, reps:null, duration_sec, rest_sec, instruction, cue, common_errors, equipment_required:["concept2"].

RUNNING: session_type kiezen. Elk segment: type:"running", exercise, session_type, sets, reps:null, duration_sec, rest_sec, instruction, cue, common_errors, equipment_required:["running"].

CYCLING: session_type kiezen. Elk segment: type:"cycling", exercise, session_type, sets, reps:null, duration_sec, rest_sec, instruction, cue, common_errors, equipment_required:["cycling"].

Reageer ALLEEN in dit JSON formaat:
{
  "training_allowed": true,
  "training_type": "kettlebell",
  "title": "Korte titel",
  "intensity": "light",
  "duration": 30,
  "segments": [],
  "recovery_modules": [
    { "type": "mobility", "subtype": "hips", "duration": 10, "label": "Heup mobiliteit" },
    { "type": "breathing", "subtype": "box_breathing", "duration": 6, "label": "Box Breathing" }
  ],
  "reason": "Korte reden",
  "coach_message": "Persoonlijk motiverend bericht dat aansluit op het dagplan"
}

VERPLICHTE REGELS voor recovery_modules:
- Elk item MOET een "label" hebben (string, niet leeg)
- Elk item MOET een "duration" hebben (getal in MINUTEN, niet seconden, minimaal 1)
- Elk item MOET een "type" hebben: "breathing", "mobility", "walk", of "relaxation"
- Elk item MOET een "subtype" hebben
- Geen lege labels, geen 0 minuten, geen null waarden`

    // Fallbacks
    const herselFallback: TrainingInstruction = {
      training_allowed: false,
      training_type: null,
      intensity: null,
      duration: null,
      recovery_modules: [],
      reason: 'Coach adviseert herstel vandaag',
      coach_message: 'Vandaag is herstel de training. Rust is productief.',
    }

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
      recovery_modules: [],
      reason: 'Standaard kettlebell sessie',
      coach_message: 'Goed bezig! Luister naar je lichaam.',
    }

    // Rust → direct terug zonder AI call
    if (coachActieType === 'rust' && !isLibrary) {
      await supabase.from('coach_recommendations').upsert({
        user_id: user.id, date: today, type: cacheType,
        training_instruction: herselFallback,
      }, { onConflict: 'user_id,date,type' })
      return NextResponse.json({ instruction: herselFallback })
    }

    const fallbackInstruction: TrainingInstruction = coachActieType === 'herstel'
      ? { ...kettlebellFallback, intensity: 'light', recovery_modules: [] }
      : kettlebellAvailable ? kettlebellFallback
      : { ...herselFallback, training_allowed: false }

    let instruction: TrainingInstruction = { ...fallbackInstruction, recovery_modules: [] }

    try {
      // Haiku voor snelheid — training schema is minder complex dan coach advies
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
          const parsedType = parsed.training_type
          const typeAllowed = isLibrary && forcedModule
            ? parsedType === forcedModule
            : !parsedType || (parsedType === 'rowing' && rowingAvailable) || (parsedType === 'kettlebell' && kettlebellAvailable) || (parsedType === 'running' && runningAvailable) || (parsedType === 'cycling' && cyclingAvailable)

          if ((parsed.segments && parsed.segments.length > 0 && typeAllowed) || parsed.training_allowed === false) {
            // Coach bepaalt — gebruik AI output direct, geen toevoegingen
            instruction = parsed
          }
        }
      }
    } catch {
      instruction = { ...fallbackInstruction, recovery_modules: [] }
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
