export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

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
      .single()
    return NextResponse.json({ instruction: data?.training_instruction || null })
  } catch {
    return NextResponse.json({ instruction: null })
  }
}

// POST — genereer nieuw trainingsschema (lichtgewicht)
export async function POST() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })

    // Check cache
    const { data: cached } = await supabase
      .from('coach_recommendations')
      .select('training_instruction')
      .eq('user_id', user.id)
      .eq('date', today)
      .single()

    if (cached?.training_instruction) {
      return NextResponse.json({ instruction: cached.training_instruction })
    }

    // Minimale data ophalen — alleen wat nodig is voor schema generatie
    const [profileRes, checkinRes, garminRes, blessuresRes, goalsRes] = await Promise.all([
      supabase.from('profiles').select('first_name, experience_level, available_time').eq('user_id', user.id).single(),
      supabase.from('daily_checkins').select('feeling_score, energy_score, stress_score, motivation_score, soreness_score').eq('user_id', user.id).eq('date', today).single(),
      supabase.from('garmin_imports').select('parsed_data').eq('user_id', user.id).eq('status', 'confirmed').order('date', { ascending: false }).limit(1).single(),
      supabase.from('injuries').select('body_part, pain_score').eq('user_id', user.id).eq('active', true),
      supabase.from('user_goals').select('title').eq('user_id', user.id).eq('status', 'active').limit(2),
    ])

    const profile = profileRes.data
    const checkin = checkinRes.data
    const garmin = garminRes.data?.parsed_data || null
    const blessures = blessuresRes.data || []
    const goals = goalsRes.data || []

    const context = [
      `Naam: ${profile?.first_name || 'gebruiker'}, niveau: ${profile?.experience_level || 'beginner'}`,
      checkin ? `Check-in: gevoel ${checkin.feeling_score}/10, energie ${checkin.energy_score}/10, stress ${checkin.stress_score || '?'}/10, spierpijn ${checkin.soreness_score || '?'}/10` : 'Geen check-in vandaag',
      garmin ? `Garmin: Body Battery ${garmin.body_battery?.current || '?'}, slaap ${garmin.sleep?.score || '?'}/100, HRV ${garmin.hrv?.avg_7d_ms || '?'}ms` : '',
      blessures.length > 0 ? `Blessures: ${blessures.map((b: {body_part: string; pain_score: number}) => b.body_part + ' pijn ' + b.pain_score + '/10').join(', ')}` : '',
      goals.length > 0 ? `Doelen: ${goals.map((g: {title: string}) => g.title).join(', ')}` : '',
    ].filter(Boolean).join('\n')

    const systemPrompt = `Je bent Trainer AI van CoachOS. Genereer een kettlebell trainingsschema op basis van de gebruikersdata.

DATA:
${context}

REGELS:
- Genereer 4-6 kettlebell oefeningen in segments array
- Elk segment: exercise, sets, reps of duration_sec, rest_sec, instruction (1 zin), cue (1 zin), common_errors (2-3 items)
- Pas intensiteit aan op basis van energie en spierpijn
- Bij lage energie: lichtere oefeningen, minder sets
- Bij hoge spierpijn: vermijd die spiergroepen
- BESCHIKBARE OEFENINGEN: Two Hand Swing, One Hand Swing, Goblet Squat, Clean, Press, Push Press, Clean & Press, Snatch, Turkish Get-Up, Farmer Carry, Rack Carry, Windmill, Deadlift, Front Squat, Lunge

Reageer ALLEEN in dit JSON formaat:
{
  "training_allowed": true,
  "training_type": "kettlebell",
  "title": "Kettlebell sessie",
  "intensity": "medium",
  "duration": 30,
  "segments": [
    {
      "type": "kettlebell",
      "exercise": "Two Hand Swing",
      "sets": 4,
      "reps": 15,
      "duration_sec": null,
      "rest_sec": 60,
      "level": 1,
      "instruction": "Hinge vanuit de heupen, drijf krachtig vooruit.",
      "cue": "Heupen drijven, niet tillen",
      "common_errors": ["Rug rolt", "Armen trekken de bell", "Knieën buigen te ver"]
    }
  ],
  "recovery_modules": [
    { "type": "breathing", "subtype": "box_breathing", "duration": 6, "label": "Box Breathing" }
  ],
  "reason": "Korte reden",
  "coach_message": "Persoonlijk motiverend bericht"
}`

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://coach-os-tau.vercel.app'
    const aiRes = await fetch(appUrl + '/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Genereer het trainingsschema.' }],
      }),
    })

    const aiData = await aiRes.json()
    const rawText = aiData.content?.[0]?.text || ''

    let instruction: TrainingInstruction | null = null
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (jsonMatch) instruction = JSON.parse(jsonMatch[0])
    } catch {
      // Fallback schema
      instruction = {
        training_allowed: true,
        training_type: 'kettlebell',
        title: 'Kettlebell sessie',
        intensity: 'medium',
        duration: 30,
        segments: [
          { type: 'kettlebell', exercise: 'Two Hand Swing', sets: 4, reps: 15, duration_sec: null, rest_sec: 60, level: 1,
            instruction: 'Hinge vanuit de heupen, drijf krachtig vooruit.', cue: 'Heupen drijven', common_errors: ['Rug rolt', 'Armen trekken'] },
          { type: 'kettlebell', exercise: 'Goblet Squat', sets: 3, reps: 12, duration_sec: null, rest_sec: 60, level: 1,
            instruction: 'Houd de bell voor de borst, zak diep.', cue: 'Borst omhoog', common_errors: ['Rug rolt voorover'] },
          { type: 'kettlebell', exercise: 'Clean & Press', sets: 3, reps: 8, duration_sec: null, rest_sec: 90, level: 2,
            instruction: 'Clean naar rack, dan press.', cue: 'Elleboog hoog', common_errors: ['Bell slaat pols'] },
        ] as unknown[],
        recovery_modules: [{ type: 'breathing', subtype: 'box_breathing', duration: 6, label: 'Box Breathing' }],
        reason: 'Standaard sessie',
        coach_message: 'Goede training vandaag!',
      } as TrainingInstruction
    }

    if (!instruction) return NextResponse.json({ error: 'Geen instructie gegenereerd' }, { status: 500 })

    await supabase.from('coach_recommendations').upsert({
      user_id: user.id,
      date: today,
      training_instruction: instruction,
    }, { onConflict: 'user_id,date' })

    return NextResponse.json({ instruction })

  } catch (error) {
    console.error('Training today error:', error)
    return NextResponse.json({ error: 'Generatie mislukt' }, { status: 500 })
  }
}
