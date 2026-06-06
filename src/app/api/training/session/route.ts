export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
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

// ─── Oefeningen Bibliotheek ───────────────────────────────────────────────────

interface Oefening {
  name: string
  category: 'hinge' | 'squat' | 'push' | 'pull' | 'carry' | 'core'
  level: 1 | 2 | 3
  coaching_cue: string
  avoid_injuries?: string[] // body parts to avoid
}

const BIBLIOTHEEK: Oefening[] = [
  // Hinge
  { name: 'Deadlift', category: 'hinge', level: 1, coaching_cue: 'Houd rug recht, duw de grond weg', avoid_injuries: ['rug', 'lower back'] },
  { name: 'Swing', category: 'hinge', level: 1, coaching_cue: 'Explosieve heupen, niet armen', avoid_injuries: ['rug', 'lower back'] },
  { name: 'Single-Arm Swing', category: 'hinge', level: 2, coaching_cue: 'Draai mee met de heup, controle bovenin', avoid_injuries: ['rug', 'schouder', 'pols'] },
  { name: 'High Pull', category: 'hinge', level: 2, coaching_cue: 'Elleboog hoog, explosief omhoog', avoid_injuries: ['schouder', 'pols'] },
  { name: 'Snatch', category: 'hinge', level: 3, coaching_cue: 'Punch door bovenin, pols recht', avoid_injuries: ['schouder', 'pols', 'rug'] },

  // Squat
  { name: 'Goblet Squat', category: 'squat', level: 1, coaching_cue: 'Borst omhoog, knieën volgen tenen', avoid_injuries: ['knie', 'heup'] },
  { name: 'Front Squat', category: 'squat', level: 2, coaching_cue: 'Ellebogen hoog, borst rechtop', avoid_injuries: ['knie', 'heup', 'rug'] },
  { name: 'Split Squat', category: 'squat', level: 2, coaching_cue: 'Achterste knie richting grond, romp rechtop', avoid_injuries: ['knie', 'heup'] },
  { name: 'Reverse Lunge', category: 'squat', level: 2, coaching_cue: 'Stap terug, gewicht op voorknie', avoid_injuries: ['knie', 'heup'] },

  // Push
  { name: 'Floor Press', category: 'push', level: 1, coaching_cue: 'Ellebogen 45 graden, druk explosief', avoid_injuries: ['schouder', 'pols'] },
  { name: 'Strict Press', category: 'push', level: 2, coaching_cue: 'Kern strak, druk recht omhoog', avoid_injuries: ['schouder', 'pols', 'rug'] },
  { name: 'Push Press', category: 'push', level: 2, coaching_cue: 'Kleine dip, explosieve heupen, druk door', avoid_injuries: ['schouder', 'knie'] },
  { name: 'Clean & Press', category: 'push', level: 3, coaching_cue: 'Clean eerst, korte pauze, druk recht', avoid_injuries: ['schouder', 'pols', 'rug'] },

  // Pull
  { name: 'Bent-Over Row', category: 'pull', level: 1, coaching_cue: 'Rug recht, elleboog langs romp', avoid_injuries: ['rug', 'schouder'] },
  { name: 'Renegade Row', category: 'pull', level: 2, coaching_cue: 'Heupen stabiel, draai niet mee', avoid_injuries: ['rug', 'schouder', 'pols'] },

  // Carry
  { name: 'Farmer Carry', category: 'carry', level: 1, coaching_cue: 'Schouders naar achteren, rustig tempo', avoid_injuries: ['rug', 'schouder'] },
  { name: 'Suitcase Carry', category: 'carry', level: 2, coaching_cue: 'Lateraal stabiel, niet zijwaarts leunen', avoid_injuries: ['rug', 'schouder'] },
  { name: 'Rack Carry', category: 'carry', level: 2, coaching_cue: 'Kettlebell in rack positie, elleboog laag', avoid_injuries: ['schouder', 'pols'] },
  { name: 'Overhead Carry', category: 'carry', level: 3, coaching_cue: 'Arm gestrekt, schouder actief, blik vooruit', avoid_injuries: ['schouder', 'pols', 'rug'] },

  // Core / Complex
  { name: 'Halo', category: 'core', level: 1, coaching_cue: 'Kleine cirkels, kern strak, langzaam', avoid_injuries: ['schouder', 'nek'] },
  { name: 'Russian Twist', category: 'core', level: 1, coaching_cue: 'Voeten omhoog, draai vanuit kern', avoid_injuries: ['rug'] },
  { name: 'Clean', category: 'core', level: 2, coaching_cue: 'Trek elleboog hoog, vang zacht', avoid_injuries: ['pols', 'schouder'] },
  { name: 'Turkish Get-Up', category: 'core', level: 3, coaching_cue: 'Oog op de kettlebell, elke fase bewust', avoid_injuries: ['schouder', 'pols', 'heup', 'knie'] },
  { name: 'Windmill', category: 'core', level: 3, coaching_cue: 'Arm gestrekt, kijk omhoog, langzaam zakken', avoid_injuries: ['schouder', 'rug', 'heup'] },
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface OefeningOutput {
  exercise: string
  sets?: number
  reps?: number
  duration?: number
  rest?: number
  coaching_cue: string
}

interface TrainingSession {
  warmup: OefeningOutput[]
  blocks: OefeningOutput[]
  cooldown: OefeningOutput[]
}

// ─── Selectielogica ───────────────────────────────────────────────────────────

function bepaalMaxNiveau(
  experienceLevel: string | null,
  bodyBattery: number | null,
  gemiddeldeRating: number | null
): 1 | 2 | 3 {
  // Basis niveau op basis van experience
  let basis: 1 | 2 | 3 = 1
  if (experienceLevel === 'gemiddeld') basis = 2
  if (experienceLevel === 'gevorderd') basis = 3

  // Body Battery corrigeert naar beneden
  let bbMax: 1 | 2 | 3 = 3
  if (bodyBattery !== null) {
    if (bodyBattery < 40) bbMax = 1
    else if (bodyBattery < 70) bbMax = 2
    else bbMax = 3
  }

  // Progressie op basis van ratings
  let progressieCorrectie = 0
  if (gemiddeldeRating !== null) {
    if (gemiddeldeRating >= 8 && (bodyBattery ?? 0) >= 70) progressieCorrectie = 1
    else if (gemiddeldeRating <= 4) progressieCorrectie = -1
  }

  const berekend = Math.min(basis, bbMax) + progressieCorrectie
  return Math.max(1, Math.min(3, berekend)) as 1 | 2 | 3
}

function filterOpBlessures(oefeningen: Oefening[], blessures: string[]): Oefening[] {
  if (blessures.length === 0) return oefeningen
  const blessureLower = blessures.map(b => b.toLowerCase())
  return oefeningen.filter(o => {
    if (!o.avoid_injuries) return true
    return !o.avoid_injuries.some(ai =>
      blessureLower.some(b => b.includes(ai) || ai.includes(b))
    )
  })
}

function selecteerOefening(
  categorie: Oefening['category'],
  maxNiveau: 1 | 2 | 3,
  beschikbaar: Oefening[],
  gebruiktNamen: Set<string>
): Oefening | null {
  const kandidaten = beschikbaar
    .filter(o => o.category === categorie && o.level <= maxNiveau && !gebruiktNamen.has(o.name))
    .sort((a, b) => b.level - a.level) // voorkeur voor hogere niveaus binnen limiet

  return kandidaten[0] ?? null
}

function bouwSessie(
  maxNiveau: 1 | 2 | 3,
  beschikbaar: Oefening[],
  duration: number
): TrainingSession {
  const gebruikt = new Set<string>()

  // Bepaal sets/reps op basis van niveau en duur
  const isLicht = maxNiveau === 1
  const warmupSets = isLicht ? 2 : 2
  const blockSets = isLicht ? 3 : maxNiveau === 2 ? 4 : 5
  const warmupReps = isLicht ? 8 : 10
  const blockReps = isLicht ? 8 : maxNiveau === 2 ? 10 : 12
  const rustSec = isLicht ? 90 : maxNiveau === 2 ? 60 : 45

  // Aantal blok oefeningen op basis van duur
  const aantalBlokken = duration <= 20 ? 2 : duration <= 35 ? 3 : 4

  // Warmup: hinge + squat
  const warmup: OefeningOutput[] = []
  const hingeWarmup = selecteerOefening('hinge', Math.min(maxNiveau, 2) as 1|2|3, beschikbaar, gebruikt)
  if (hingeWarmup) {
    gebruikt.add(hingeWarmup.name)
    warmup.push({ exercise: hingeWarmup.name, sets: warmupSets, reps: warmupReps, rest: 60, coaching_cue: hingeWarmup.coaching_cue })
  }
  const squat1 = selecteerOefening('squat', Math.min(maxNiveau, 2) as 1|2|3, beschikbaar, gebruikt)
  if (squat1) {
    gebruikt.add(squat1.name)
    warmup.push({ exercise: squat1.name, sets: warmupSets, reps: warmupReps, rest: 60, coaching_cue: squat1.coaching_cue })
  }

  // Blokken: hinge → squat → push/pull → carry/core → finisher
  const blokVolgorde: Array<Oefening['category'][]> = [
    ['hinge'],
    ['squat'],
    ['push', 'pull'],
    ['carry', 'core'],
    ['hinge', 'core'], // finisher
  ]

  const blocks: OefeningOutput[] = []
  for (let i = 0; i < aantalBlokken && i < blokVolgorde.length; i++) {
    const categorieOpties = blokVolgorde[i]
    let gekozen: Oefening | null = null
    for (const cat of categorieOpties) {
      gekozen = selecteerOefening(cat, maxNiveau, beschikbaar, gebruikt)
      if (gekozen) break
    }
    if (gekozen) {
      gebruikt.add(gekozen.name)
      blocks.push({
        exercise: gekozen.name,
        sets: blockSets,
        reps: gekozen.category === 'hinge' && gekozen.name === 'Swing' ? blockReps + 4 : blockReps,
        rest: rustSec,
        coaching_cue: gekozen.coaching_cue,
      })
    }
  }

  // Cool-down: carry of core, licht
  const cooldown: OefeningOutput[] = []
  const carryCD = selecteerOefening('carry', 1, beschikbaar, gebruikt)
  if (carryCD) {
    cooldown.push({ exercise: carryCD.name, duration: 120, coaching_cue: carryCD.coaching_cue })
  } else {
    const coreCD = selecteerOefening('core', 1, beschikbaar, gebruikt)
    if (coreCD) cooldown.push({ exercise: coreCD.name, duration: 90, coaching_cue: coreCD.coaching_cue })
  }

  return { warmup, blocks, cooldown }
}

// ─── GET — haal sessie van vandaag op ────────────────────────────────────────

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json(null)

    const supabase = createAdminClient()
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })

    const { data } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .single()

    return NextResponse.json(data || null)
  } catch {
    return NextResponse.json(null)
  }
}

// ─── POST — genereer sessie via Trainer AI ────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })

    const body = await req.json()
    const { intensity = 'medium', duration = 30 } = body

    // Haal alle context op parallel
    const [profileRes, blessuresRes, garminRes, ratingsRes] = await Promise.all([
      supabase.from('profiles').select('experience_level').eq('user_id', user.id).single(),
      supabase.from('injuries').select('body_part').eq('user_id', user.id).eq('active', true),
      supabase.from('garmin_imports')
        .select('parsed_data')
        .eq('user_id', user.id)
        .eq('status', 'confirmed')
        .order('date', { ascending: false })
        .limit(1)
        .single(),
      supabase.from('training_results')
        .select('rating, actual_duration, completed_at')
        .eq('user_id', user.id)
        .eq('completed', true)
        .order('completed_at', { ascending: false })
        .limit(3),
    ])

    const experienceLevel = profileRes.data?.experience_level ?? 'beginner'
    const blessures = (blessuresRes.data || []).map(b => b.body_part)
    const garmin = garminRes.data?.parsed_data ?? null
    const ratings = ratingsRes.data || []

    const bodyBattery = garmin?.body_battery?.current ?? null
    const sleepScore = garmin?.sleep?.score ?? null
    const hrv = garmin?.hrv?.avg_7d_ms ?? null
    const hrvStatus = garmin?.hrv?.status ?? null

    // Gemiddelde rating laatste 3 sessies
    const ratingsMetWaarde = ratings.filter(r => r.rating !== null).map(r => r.rating as number)
    const gemiddeldeRating = ratingsMetWaarde.length > 0
      ? ratingsMetWaarde.reduce((a, b) => a + b, 0) / ratingsMetWaarde.length
      : null

    // Bepaal max niveau
    const maxNiveau = bepaalMaxNiveau(experienceLevel, bodyBattery, gemiddeldeRating)

    // Effectieve intensiteit
    let effectiefIntensity = intensity
    if (bodyBattery !== null && bodyBattery < 40) effectiefIntensity = 'light'
    else if (sleepScore !== null && sleepScore < 65) effectiefIntensity = 'light'
    else if (hrvStatus === 'low' || hrvStatus === 'unbalanced') {
      if (intensity === 'heavy') effectiefIntensity = 'medium'
    }

    // Filter oefeningen op blessures
    const beschikbaar = filterOpBlessures(BIBLIOTHEEK, blessures)

    // Bouw sessie
    const session = bouwSessie(maxNiveau, beschikbaar, duration)

    // Progressie log
    const progressieInfo = {
      experience_level: experienceLevel,
      body_battery: bodyBattery,
      gemiddelde_rating: gemiddeldeRating ? Math.round(gemiddeldeRating * 10) / 10 : null,
      max_niveau: maxNiveau,
      blessures_gefilterd: blessures,
      ratings_gebruikt: ratingsMetWaarde,
    }

    // Sla sessie op
    const garminContext = garmin ? {
      body_battery: bodyBattery,
      sleep_score: sleepScore,
      hrv_ms: hrv,
      hrv_status: hrvStatus,
    } : null

    const { data: saved, error } = await supabase
      .from('training_sessions')
      .upsert({
        user_id: user.id,
        date: today,
        intensity: effectiefIntensity,
        duration,
        training_type: 'kettlebell',
        session,
        garmin_context: garminContext,
        status: 'generated',
      }, { onConflict: 'user_id,date' })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      session_id: saved.id,
      session,
      intensity: effectiefIntensity,
      original_intensity: intensity,
      adjusted: effectiefIntensity !== intensity,
      max_niveau: maxNiveau,
      progressie: progressieInfo,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[training/session]', msg)
    return NextResponse.json({ error: 'Server fout', detail: msg }, { status: 500 })
  }
}
