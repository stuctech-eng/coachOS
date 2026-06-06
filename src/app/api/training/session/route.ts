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

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Oefening {
  exercise: string
  sets?: number
  reps?: number
  duration?: number // seconden, voor carries en cool-down
  rest?: number    // seconden rust na set
  coaching_cue: string // uitleg/tip per oefening
}

export interface TrainingSession {
  warmup: Oefening[]
  blocks: Oefening[]
  cooldown: Oefening[]
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

// ─── POST — genereer nieuwe sessie via Trainer AI ────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })

    const body = await req.json()
    const { intensity = 'medium', duration = 30 } = body

    // Haal context op
    const [blessuresRes, garminRes] = await Promise.all([
      supabase.from('injuries').select('body_part, pain_score').eq('user_id', user.id).eq('active', true),
      supabase.from('garmin_imports')
        .select('parsed_data')
        .eq('user_id', user.id)
        .eq('status', 'confirmed')
        .order('date', { ascending: false })
        .limit(1)
        .single(),
    ])

    const blessures = blessuresRes.data || []
    const garmin = garminRes.data?.parsed_data || null

    const bodyBattery = garmin?.body_battery?.current ?? null
    const sleepScore = garmin?.sleep?.score ?? null
    const hrv = garmin?.hrv?.avg_7d_ms ?? null
    const hrvStatus = garmin?.hrv?.status ?? null

    // Bepaal effectieve intensiteit op basis van Garmin
    let effectiefIntensity = intensity
    if (bodyBattery !== null && bodyBattery < 40) effectiefIntensity = 'light'
    else if (sleepScore !== null && sleepScore < 65) effectiefIntensity = 'light'
    else if (hrvStatus === 'low' || hrvStatus === 'unbalanced') {
      if (intensity === 'heavy') effectiefIntensity = 'medium'
    }

    const blessuresTekst = blessures.length > 0
      ? `Actieve blessures: ${blessures.map(b => `${b.body_part} (pijn ${b.pain_score}/10)`).join(', ')}. Vermijd oefeningen die deze gebieden belasten.`
      : 'Geen actieve blessures.'

    const garminTekst = garmin ? [
      `Body Battery: ${bodyBattery ?? 'onbekend'}`,
      `Slaapscore: ${sleepScore ?? 'onbekend'}/100`,
      `HRV: ${hrv ?? 'onbekend'} ms (${hrvStatus ?? 'onbekend'})`,
    ].join(', ') : 'Geen Garmin data beschikbaar.'

    const systemPrompt = `Je bent Trainer AI voor CoachOS — een kettlebell training specialist.

CONTEXT:
- Intensiteit (Coach AI): ${intensity}
- Effectieve intensiteit (na Garmin analyse): ${effectiefIntensity}
- Geplande duur: ${duration} minuten
- ${blessuresTekst}
- Garmin data: ${garminTekst}

BESCHIKBARE OEFENINGEN:
Swing, Goblet Squat, Deadlift, Clean, Press, Clean & Press, Turkish Get-Up, Farmer Carry

INTENSITEIT RICHTLIJNEN:
- light: techniek focus, lage volume, geen swings, geen clean & press
  Warming-up: 2 oefeningen × 2 sets × 8-10 reps
  Blokken: 2-3 oefeningen × 3 sets × 8 reps, rust 90 sec
  Cool-down: 1 carry of mobility

- medium: balans kracht en conditie
  Warming-up: 2 oefeningen × 2 sets × 10 reps
  Blokken: 3-4 oefeningen × 4 sets × 10-12 reps, rust 60 sec
  Cool-down: 1-2 oefeningen

- heavy: maximale inspanning, hoog volume
  Warming-up: 3 oefeningen × 3 sets × 10 reps
  Blokken: 4-5 oefeningen × 5 sets × 15-20 reps (swings), rust 45-60 sec
  Cool-down: 2 oefeningen

BLESSURE REGELS:
- Schouderblessure → geen Press, geen Clean & Press, geen Turkish Get-Up
- Rugblessure → geen Swing, geen Deadlift, geen Farmer Carry zwaar
- Knieblessure → geen Goblet Squat, lichte Deadlift enkel
- Polsblessure → geen Clean, geen Press

Elke oefening krijgt een korte coaching_cue (max 15 woorden, praktisch).

Retourneer ALLEEN dit JSON object, zonder markdown:
{
  "warmup": [
    { "exercise": "Deadlift", "sets": 2, "reps": 10, "rest": 60, "coaching_cue": "Houd rug recht, duw de grond weg" }
  ],
  "blocks": [
    { "exercise": "Swing", "sets": 5, "reps": 20, "rest": 60, "coaching_cue": "Explosieve heupen, niet armen" }
  ],
  "cooldown": [
    { "exercise": "Farmer Carry", "duration": 120, "coaching_cue": "Schouders naar achteren, rustig tempo" }
  ]
}`

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://coach-os-tau.vercel.app'
    const aiRes = await fetch(appUrl + '/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Genereer mijn kettlebell sessie.' }],
      }),
    })

    const aiData = await aiRes.json()
    const rawText = aiData.content?.[0]?.text || ''

    let session: TrainingSession
    try {
      const cleaned = rawText.replace(/```json|```/g, '').trim()
      session = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'Trainer AI kon geen sessie genereren.' }, { status: 422 })
    }

    // Sla sessie op
    const garminContext = garmin ? { body_battery: bodyBattery, sleep_score: sleepScore, hrv_ms: hrv, hrv_status: hrvStatus } : null

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
    })
  } catch (err) {
    console.error('[training/session]', err)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
