export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { getAvailableModules } from '@/utils/equipment'
import type { EquipmentProfile } from '@/app/api/equipment/route'

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
      .eq('type', 'training_today')
      .single()

    if (cached?.training_instruction) {
      return NextResponse.json({ instruction: cached.training_instruction })
    }

    // Minimale data ophalen — alleen wat nodig is voor schema generatie
    const [profileRes, checkinRes, garminRes, blessuresRes, goalsRes] = await Promise.all([
      supabase.from('profiles').select('first_name, experience_level, available_time, kettlebell_available, concept2_available, cycling_available, running_available, dumbbell_available, barbell_available, ab_wheel_available, bodyweight_available').eq('user_id', user.id).single(),
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

    const context = [
      `Naam: ${profile?.first_name || 'gebruiker'}, niveau: ${profile?.experience_level || 'beginner'}`,
      checkin ? `Check-in: gevoel ${checkin.feeling_score}/10, energie ${checkin.energy_score}/10, stress ${checkin.stress_score || '?'}/10, spierpijn ${checkin.soreness_score || '?'}/10` : 'Geen check-in vandaag',
      garmin ? `Garmin: Body Battery ${garmin.body_battery?.current || '?'}, slaap ${garmin.sleep?.score || '?'}/100, HRV ${garmin.hrv?.avg_7d_ms || '?'}ms` : '',
      blessures.length > 0 ? `Blessures: ${blessures.map((b: {body_part: string; pain_score: number}) => b.body_part + ' pijn ' + b.pain_score + '/10').join(', ')}` : '',
      goals.length > 0 ? `Doelen: ${goals.map((g: {title: string}) => g.title).join(', ')}` : '',
    ].filter(Boolean).join('\n')

    const moduleKeuze = kettlebellAvailable && rowingAvailable
      ? 'Kies zelf het beste training_type voor vandaag: "kettlebell" of "rowing", op basis van de data (bijv. afwisseling met vorige sessies, herstelstatus, doelen).'
      : rowingAvailable
        ? 'Het enige beschikbare equipment voor deze training is een Concept2 roeier. training_type MOET "rowing" zijn.'
        : 'training_type MOET "kettlebell" zijn.'

    const kettlebellFormat = `KETTLEBELL FORMAT — gebruik dit format als training_type "kettlebell" is:
- Genereer 4-6 oefeningen in segments array
- Elk segment: type:"kettlebell", exercise, sets, reps of duration_sec, rest_sec, level, instruction (1 zin), cue (1 zin), common_errors (2-3 items)
- BESCHIKBARE OEFENINGEN: Two Hand Swing, One Hand Swing, Goblet Squat, Clean, Press, Push Press, Clean & Press, Snatch, Turkish Get-Up, Farmer Carry, Rack Carry, Windmill, Deadlift, Front Squat, Lunge

Voorbeeld segment:
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
}`

    const rowingFormat = `ROWING FORMAT — gebruik dit format als training_type "rowing" is (Concept2):
- Kies een session_type: "recovery" (herstel, zone 1-2, 15-30 min), "endurance" (30-90 min steady), "tempo" (drempel, bijv. 3x10min/2min rust), "interval" (bijv. 10x500m), "sprint" (bijv. 8x250m), of "test" (bijv. 2000m test)
- Genereer 1-4 segments. Voor steady/endurance/test: 1 segment met sets:1. Voor intervallen: 1 segment met sets = aantal herhalingen.
- Elk segment: type:"rowing", exercise (korte naam zoals "500m Interval" of "30 min Steady State"), session_type, sets, reps:null, duration_sec (actieve tijd PER set/interval in seconden — bereken dit zelf), rest_sec (tussen sets, 0 als steady), instruction (1 zin techniek), cue (1 zin), common_errors (2-3 items)
- Optioneel indien relevant: distance_m (afstand per interval), target_split (streefsplit per 500m, bijv. "2:05"), target_spm (strokes per minute), target_hr_zone (bijv. "Zone 2")
- duration_sec berekening: als je distance_m + target_split gebruikt, reken split om naar seconden voor de gekozen afstand (bijv. 500m @ 2:05/500m = 125 sec). Voor tijd-gebaseerde sessies (steady/recovery/tempo) is duration_sec direct de tijd in seconden.
- equipment_required: ["concept2"]

Voorbeeld interval segment:
{
  "type": "rowing",
  "exercise": "500m Interval",
  "session_type": "interval",
  "sets": 10,
  "reps": null,
  "duration_sec": 125,
  "rest_sec": 60,
  "distance_m": 500,
  "target_split": "2:05",
  "target_spm": 24,
  "target_hr_zone": "Zone 3-4",
  "instruction": "Houd de catch scherp, drive met de benen, eindig met een rustige recovery.",
  "cue": "Benen - rug - armen, in die volgorde",
  "common_errors": ["Te vroeg armen trekken", "Te hoge slagfrequentie aan het begin", "Inzakken in de recovery"],
  "equipment_required": ["concept2"]
}

Voorbeeld steady segment:
{
  "type": "rowing",
  "exercise": "30 min Steady State",
  "session_type": "endurance",
  "sets": 1,
  "reps": null,
  "duration_sec": 1800,
  "rest_sec": 0,
  "target_spm": 20,
  "target_hr_zone": "Zone 2",
  "instruction": "Roei op een constant, comfortabel tempo. Praten moet nog mogelijk zijn.",
  "cue": "Lange, ontspannen halen",
  "common_errors": ["Tempo te hoog starten", "Slagfrequentie te hoog voor steady"],
  "equipment_required": ["concept2"]
}`

    const systemPrompt = `Je bent Trainer AI van CoachOS. Genereer een trainingsschema op basis van de gebruikersdata.

DATA:
${context}

MODULE KEUZE:
${moduleKeuze}

ALGEMENE REGELS:
- Pas intensiteit aan op basis van energie en spierpijn
- Bij lage energie: lichtere oefeningen, minder sets, of kies recovery/endurance bij rowing
- Bij hoge spierpijn: vermijd belaste spiergroepen, of kies rowing als alternatief
- duration is de totale geschatte sessieduur in minuten

${kettlebellFormat}

${rowingFormat}

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

    // Fallback schema - altijd beschikbaar, gebaseerd op beschikbaar equipment
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

    const rowingFallback: TrainingInstruction = {
      training_allowed: true,
      training_type: 'rowing',
      title: 'Rowing sessie',
      intensity: 'medium',
      duration: 30,
      segments: [
        { type: 'rowing', exercise: '5 min Inroeien', session_type: 'recovery', sets: 1, reps: null,
          duration_sec: 300, rest_sec: 0, target_spm: 20, target_hr_zone: 'Zone 1-2',
          instruction: 'Roei rustig in, focus op een lange, ontspannen haal.', cue: 'Adem rustig mee met de haal',
          common_errors: ['Te snel starten'], equipment_required: ['concept2'] },
        { type: 'rowing', exercise: '500m Interval', session_type: 'interval', sets: 6, reps: null,
          duration_sec: 125, rest_sec: 60, distance_m: 500, target_split: '2:05', target_spm: 26, target_hr_zone: 'Zone 3-4',
          instruction: 'Houd de catch scherp, drive met de benen, eindig met een rustige recovery.', cue: 'Benen - rug - armen',
          common_errors: ['Te vroeg armen trekken', 'Slagfrequentie te hoog aan het begin', 'Inzakken in de recovery'],
          equipment_required: ['concept2'] },
        { type: 'rowing', exercise: '5 min Uitroeien', session_type: 'recovery', sets: 1, reps: null,
          duration_sec: 300, rest_sec: 0, target_spm: 18, target_hr_zone: 'Zone 1',
          instruction: 'Roei rustig uit op laag tempo om af te koelen.', cue: 'Lange, rustige halen',
          common_errors: ['Te abrupt stoppen'], equipment_required: ['concept2'] },
      ] as unknown[],
      recovery_modules: [{ type: 'breathing', subtype: 'box_breathing', duration: 6, label: 'Box Breathing' }],
      reason: 'Standaard rowing sessie',
      coach_message: 'Mooie rowing sessie vandaag — focus op techniek!',
    }

    const fallbackInstruction: TrainingInstruction = kettlebellAvailable ? kettlebellFallback : rowingFallback

    let instruction: TrainingInstruction = fallbackInstruction

    try {
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

      if (aiRes.ok) {
        const aiData = await aiRes.json()
        const rawText = aiData.content?.[0]?.text || ''
        const jsonMatch = rawText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          const parsedType = parsed.training_type
          const typeAllowed = (parsedType === 'rowing' && rowingAvailable) || (parsedType === 'kettlebell' && kettlebellAvailable)
          if (parsed.segments && parsed.segments.length > 0 && typeAllowed) {
            instruction = parsed
          }
        }
      }
    } catch {
      // Gebruik fallback schema (al equipment-aware bepaald)
      instruction = fallbackInstruction
    }

    if (!instruction) return NextResponse.json({ error: 'Geen instructie gegenereerd' }, { status: 500 })

    await supabase.from('coach_recommendations').upsert({
      user_id: user.id,
      date: today,
      type: 'training_today',
      training_instruction: instruction,
    }, { onConflict: 'user_id,date,type' })

    return NextResponse.json({ instruction })

  } catch (error) {
    console.error('Training today error:', error)
    return NextResponse.json({ error: 'Generatie mislukt' }, { status: 500 })
  }
}
