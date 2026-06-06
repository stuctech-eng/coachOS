export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'


// ─── Types ───────────────────────────────────────────────────────────────────

interface GarminParsed {
  resting_hr: number | null
  body_battery: {
    current: number | null
    charged: number | null
    spent: number | null
  }
  sleep: {
    score: number | null
    duration_minutes: number | null
  }
  hrv: {
    avg_7d_ms: number | null
    status: string | null
  }
  calories: {
    active: number | null
    rest: number | null
    total: number | null
  }
  steps: {
    value: number | null
    goal: number | null
  }
  meta: {
    source: 'garmin_screenshot'
    parsed_at: string
  }
}

interface ValidationFlag {
  field: string
  value: number | null
  reason: string
  severity: 'warning' | 'error'
}

// ─── Normalisatie helpers ─────────────────────────────────────────────────────

function toNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const cleaned = val.replace(/[.,](?=\d{3})/g, '').replace(',', '.')
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? null : parsed
  }
  return null
}

function parseSleepDuration(val: unknown): number | null {
  if (typeof val === 'number') return val
  if (typeof val !== 'string') return null

  const match = val.match(/(\d+)u\s*(\d+)m/)
  if (match) return parseInt(match[1]) * 60 + parseInt(match[2])

  const colonMatch = val.match(/(\d+):(\d+)/)
  if (colonMatch) return parseInt(colonMatch[1]) * 60 + parseInt(colonMatch[2])

  return toNumber(val)
}

function normalizeHrvStatus(val: unknown): string | null {
  if (typeof val !== 'string') return null
  const lower = val.toLowerCase()
  if (lower.includes('evenwichtig') || lower.includes('balanced')) return 'balanced'
  if (lower.includes('laag') || lower.includes('low')) return 'low'
  if (lower.includes('hoog') || lower.includes('high')) return 'high'
  if (lower.includes('ongebalanceerd') || lower.includes('unbalanced')) return 'unbalanced'
  return lower
}

// ─── Normaliseer raw Vision output → strict schema ────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeGarminData(raw: any): GarminParsed {
  return {
    resting_hr: toNumber(raw?.resting_hr ?? raw?.hartslag_rust ?? raw?.resting_heart_rate),
    body_battery: {
      current: toNumber(raw?.body_battery?.current ?? raw?.body_battery),
      charged: toNumber(raw?.body_battery?.charged ?? raw?.body_battery_charged),
      spent: toNumber(raw?.body_battery?.spent ?? raw?.body_battery_spent),
    },
    sleep: {
      score: toNumber(raw?.sleep?.score ?? raw?.slaapscore ?? raw?.sleep_score),
      duration_minutes: parseSleepDuration(
        raw?.sleep?.duration_minutes ?? raw?.sleep?.duration ?? raw?.slaap_duur ?? raw?.sleep_duration
      ),
    },
    hrv: {
      avg_7d_ms: toNumber(raw?.hrv?.avg_7d_ms ?? raw?.hrv_ms ?? raw?.hrv),
      status: normalizeHrvStatus(raw?.hrv?.status ?? raw?.hrv_status ?? raw?.hrv_status_label),
    },
    calories: {
      active: toNumber(raw?.calories?.active ?? raw?.actieve_calories ?? raw?.active_calories),
      rest: toNumber(raw?.calories?.rest ?? raw?.rust_calories ?? raw?.resting_calories),
      total: toNumber(raw?.calories?.total ?? raw?.totale_calories ?? raw?.total_calories),
    },
    steps: {
      value: toNumber(raw?.steps?.value ?? raw?.stappen ?? raw?.steps),
      goal: toNumber(raw?.steps?.goal ?? raw?.stappen_doel ?? raw?.steps_goal),
    },
    meta: {
      source: 'garmin_screenshot',
      parsed_at: new Date().toISOString(),
    },
  }
}

// ─── Validatie ────────────────────────────────────────────────────────────────

function validateGarminData(data: GarminParsed): { flags: ValidationFlag[]; confidence: number } {
  const flags: ValidationFlag[] = []

  const rangeChecks: Array<{
    field: string
    value: number | null
    min: number
    max: number
  }> = [
    { field: 'resting_hr', value: data.resting_hr, min: 25, max: 100 },
    { field: 'body_battery.current', value: data.body_battery.current, min: 0, max: 100 },
    { field: 'body_battery.charged', value: data.body_battery.charged, min: 0, max: 100 },
    { field: 'body_battery.spent', value: data.body_battery.spent, min: 0, max: 100 },
    { field: 'sleep.score', value: data.sleep.score, min: 0, max: 100 },
    { field: 'sleep.duration_minutes', value: data.sleep.duration_minutes, min: 60, max: 840 },
    { field: 'hrv.avg_7d_ms', value: data.hrv.avg_7d_ms, min: 10, max: 200 },
    { field: 'calories.active', value: data.calories.active, min: 0, max: 5000 },
    { field: 'calories.rest', value: data.calories.rest, min: 800, max: 4000 },
    { field: 'steps.value', value: data.steps.value, min: 0, max: 60000 },
  ]

  for (const check of rangeChecks) {
    if (check.value === null) {
      flags.push({
        field: check.field,
        value: null,
        reason: 'Waarde ontbreekt of kon niet worden uitgelezen',
        severity: 'warning',
      })
    } else if (check.value < check.min || check.value > check.max) {
      flags.push({
        field: check.field,
        value: check.value,
        reason: `Waarde buiten verwacht bereik (${check.min}–${check.max})`,
        severity: 'error',
      })
    }
  }

  // Cross-field: calories totaal = actief + rust
  if (
    data.calories.active !== null &&
    data.calories.rest !== null &&
    data.calories.total !== null
  ) {
    const expectedTotal = data.calories.active + data.calories.rest
    const diff = Math.abs(expectedTotal - data.calories.total)
    if (diff > 10) {
      flags.push({
        field: 'calories.total',
        value: data.calories.total,
        reason: `Totaal (${data.calories.total}) komt niet overeen met actief + rust (${expectedTotal})`,
        severity: 'warning',
      })
    }
  }

  const errorCount = flags.filter((f) => f.severity === 'error').length
  const warningCount = flags.filter((f) => f.severity === 'warning').length
  const confidence = Math.max(0, 100 - errorCount * 20 - warningCount * 5)

  return { flags, confidence }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const formData = await req.formData()
    const imageFile = formData.get('image') as File | null
    const confirmId = formData.get('confirm_id') as string | null

    // ── Confirm flow ───────────────────────────────────────────────────────
    if (confirmId) {
      const { data: existing } = await supabase
        .from('garmin_imports')
        .select('id, user_id')
        .eq('id', confirmId)
        .eq('user_id', user.id)
        .single()

      if (!existing) {
        return NextResponse.json({ error: 'Import niet gevonden' }, { status: 404 })
      }

      const { error } = await supabase
        .from('garmin_imports')
        .update({ status: 'confirmed' })
        .eq('id', confirmId)

      if (error) throw error
      return NextResponse.json({ success: true, confirmed: true })
    }

    // ── Extract flow ───────────────────────────────────────────────────────
    if (!imageFile) {
      return NextResponse.json({ error: 'Geen afbeelding meegestuurd' }, { status: 400 })
    }

    const today = new Date()
      .toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })

    const { data: existing } = await supabase
      .from('garmin_imports')
      .select('id, status, parsed_data')
      .eq('user_id', user.id)
      .eq('date', today)
      .single()

    if (existing?.status === 'confirmed') {
      return NextResponse.json({
        error: 'Je hebt vandaag al een Garmin import bevestigd.',
        already_confirmed: true,
        existing_data: existing.parsed_data,
      }, { status: 409 })
    }

    const buffer = await imageFile.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mediaType = (imageFile.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp'

    const visionRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64 },
              },
              {
                type: 'text',
                text: 'Dit is een screenshot van de Garmin Connect "In één oogopslag" pagina.\nLees alle zichtbare waarden uit en retourneer ALLEEN een JSON object, zonder markdown of uitleg.\n\nGebruik dit exacte schema:\n{\n  "resting_hr": 43,\n  "body_battery": { "current": 66, "charged": 55, "spent": 36 },\n  "sleep": { "score": 84, "duration": "8u 46m" },\n  "hrv": { "avg_7d_ms": 49, "status": "Evenwichtig" },\n  "calories": { "active": 285, "rest": 1401, "total": 1686 },\n  "steps": { "value": 6811, "goal": 6870 }\n}\n\nAls een waarde niet zichtbaar is, gebruik null.\nRetourneer ALLEEN het JSON object.',
              },
            ],
          },
        ],
      }),
    })

    if (!visionRes.ok) {
      const errText = await visionRes.text()
      console.error('[garmin-vision] Anthropic error:', errText)
      return NextResponse.json({ error: 'AI kon de afbeelding niet verwerken.' }, { status: 502 })
    }

    const visionData = await visionRes.json()
    const rawText: string = visionData.content?.[0]?.text ?? ''


    let rawJson: Record<string, unknown>
    try {
      const cleaned = rawText.replace(/```json|```/g, '').trim()
      rawJson = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({
        error: 'Kon de afbeelding niet verwerken. Probeer een scherpere screenshot.',
        raw: rawText,
      }, { status: 422 })
    }

    const parsed = normalizeGarminData(rawJson)
    const { flags, confidence } = validateGarminData(parsed)
    const status = flags.some((f) => f.severity === 'error') ? 'flagged' : 'pending'

    const { data: saved, error: saveError } = await supabase
      .from('garmin_imports')
      .upsert(
        {
          user_id: user.id,
          date: today,
          raw_vision_response: rawJson,
          parsed_data: parsed,
          validation_flags: flags,
          confidence_score: confidence,
          status,
        },
        { onConflict: 'user_id,date' }
      )
      .select('id')
      .single()

    if (saveError) throw saveError

    return NextResponse.json({
      success: true,
      import_id: saved.id,
      parsed,
      validation_flags: flags,
      confidence_score: confidence,
      status,
    })
  } catch (err) {
    console.error('[garmin-vision]', err)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
