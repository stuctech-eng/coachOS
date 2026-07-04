export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

// ─── Types ───────────────────────────────────────────────────────────────────

interface GarminActivityParsed {
  activity_type: string | null
  duration_total_min: number | null
  duration_moved_min: number | null
  avg_hr: number | null
  max_hr: number | null
  training_effect: {
    primary_benefit: string | null
    aerobic: number | null
    anaerobic: number | null
    exercise_load: number | null
  }
  avg_pace_per_km: string | null
  avg_speed_kmh: number | null
  cadence_avg: number | null
  steps: number | null
  meta: {
    source: 'garmin_activity_screenshot'
    parsed_at: string
  }
}

interface ValidationFlag {
  field: string
  value: number | string | null
  reason: string
  severity: 'warning' | 'error'
}

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

// ─── Normalisatie ──────────────────────────────────────────────────────────────

function toNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const cleaned = val.replace(',', '.')
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? null : parsed
  }
  return null
}

// "47:18" of "1:02:45" → minuten (afgerond)
function parseTijdNaarMinuten(val: unknown): number | null {
  if (typeof val !== 'string') return toNumber(val)
  const delen = val.split(':').map(Number)
  if (delen.some(isNaN)) return null
  if (delen.length === 2) return Math.round(delen[0] + delen[1] / 60)
  if (delen.length === 3) return Math.round(delen[0] * 60 + delen[1] + delen[2] / 60)
  return null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeActivityData(raw: any): GarminActivityParsed {
  return {
    activity_type: typeof raw?.activity_type === 'string' ? raw.activity_type : null,
    duration_total_min: parseTijdNaarMinuten(raw?.duration_total ?? raw?.totale_tijd),
    duration_moved_min: parseTijdNaarMinuten(raw?.duration_moved ?? raw?.tijd_bewogen),
    avg_hr: toNumber(raw?.avg_hr ?? raw?.gemiddelde_hartslag),
    max_hr: toNumber(raw?.max_hr ?? raw?.maximale_hartslag),
    training_effect: {
      primary_benefit: typeof raw?.training_effect?.primary_benefit === 'string' ? raw.training_effect.primary_benefit : null,
      aerobic: toNumber(raw?.training_effect?.aerobic ?? raw?.aeroob),
      anaerobic: toNumber(raw?.training_effect?.anaerobic ?? raw?.anaerobisch),
      exercise_load: toNumber(raw?.training_effect?.exercise_load ?? raw?.exercise_load),
    },
    avg_pace_per_km: typeof raw?.avg_pace_per_km === 'string' ? raw.avg_pace_per_km : null,
    avg_speed_kmh: toNumber(raw?.avg_speed_kmh ?? raw?.gem_snelheid),
    cadence_avg: toNumber(raw?.cadence_avg ?? raw?.gem_cadans),
    steps: toNumber(raw?.steps ?? raw?.stappen),
    meta: {
      source: 'garmin_activity_screenshot',
      parsed_at: new Date().toISOString(),
    },
  }
}

function validateActivityData(data: GarminActivityParsed): { flags: ValidationFlag[]; confidence: number } {
  const flags: ValidationFlag[] = []

  if (!data.activity_type) {
    flags.push({ field: 'activity_type', value: null, reason: 'Activiteitstype kon niet worden uitgelezen', severity: 'warning' })
  }
  if (data.duration_moved_min === null && data.duration_total_min === null) {
    flags.push({ field: 'duration', value: null, reason: 'Geen duur gevonden', severity: 'error' })
  }
  if (data.avg_hr !== null && (data.avg_hr < 30 || data.avg_hr > 220)) {
    flags.push({ field: 'avg_hr', value: data.avg_hr, reason: 'Waarde buiten verwacht bereik', severity: 'error' })
  }
  if (data.training_effect.exercise_load !== null && (data.training_effect.exercise_load < 0 || data.training_effect.exercise_load > 500)) {
    flags.push({ field: 'training_effect.exercise_load', value: data.training_effect.exercise_load, reason: 'Waarde buiten verwacht bereik', severity: 'warning' })
  }

  const errorCount = flags.filter(f => f.severity === 'error').length
  const warningCount = flags.filter(f => f.severity === 'warning').length
  const confidence = Math.max(0, 100 - errorCount * 25 - warningCount * 10)

  return { flags, confidence }
}

// v2.4.23: sportnaam-mapping — hergebruikt dezelfde Nederlandse labels als
// Strava (SPORT_TYPE_MAP in strava-activity-processor.ts) zodat beide
// bronnen consistente namen tonen in Coach Call en Activiteiten.
const ACTIVITY_LABEL_MAP: Record<string, string> = {
  wandelen: 'Wandelen', walking: 'Wandelen', walk: 'Wandelen', hiking: 'Wandelen', hike: 'Wandelen',
  hardlopen: 'Hardlopen', running: 'Hardlopen', run: 'Hardlopen',
  fietsen: 'Fietsen', cycling: 'Fietsen', ride: 'Fietsen', biking: 'Fietsen',
  zwemmen: 'Zwemmen', swimming: 'Zwemmen', swim: 'Zwemmen',
  roeien: 'Roeien', rowing: 'Roeien',
  yoga: 'Yoga',
  kracht: 'Krachttraining', krachttraining: 'Krachttraining', 'strength training': 'Krachttraining',
}

function normaliseerActiviteitLabel(type: string | null): string {
  if (!type) return 'Activiteit'
  const key = type.toLowerCase().trim()
  return ACTIVITY_LABEL_MAP[key] || type
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const adminSupabase = createAdminClient()
    const formData = await req.formData()
    const imageFile = formData.get('image') as File | null
    const confirmId = formData.get('confirm_id') as string | null

    // ── Confirm flow: sla op in activity_sessions + trigger Coach Call ──────
    if (confirmId) {
      const { data: pendingImport } = await adminSupabase
        .from('garmin_activity_imports')
        .select('id, user_id, parsed_data, status')
        .eq('id', confirmId)
        .eq('user_id', user.id)
        .single()

      if (!pendingImport) {
        return NextResponse.json({ error: 'Import niet gevonden' }, { status: 404 })
      }
      if (pendingImport.status === 'confirmed') {
        return NextResponse.json({ error: 'Deze activiteit is al bevestigd' }, { status: 409 })
      }

      const parsed = pendingImport.parsed_data as GarminActivityParsed
      const activityLabel = normaliseerActiviteitLabel(parsed.activity_type)
      const durationMin = parsed.duration_moved_min ?? parsed.duration_total_min ?? 0
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })

      // Zoek of gebruiker deze activiteitssoort al heeft (zelfde patroon als
      // strava-activity-processor.ts, voor consistentie in de Activiteiten-lijst)
      let { data: userActivity } = await adminSupabase
        .from('activities')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', activityLabel)
        .single()

      if (!userActivity) {
        const { data: template } = await adminSupabase
          .from('activity_templates')
          .select('id')
          .eq('name', activityLabel)
          .single()
        const { data: newActivity } = await adminSupabase
          .from('activities')
          .insert({ user_id: user.id, template_id: template?.id || null, name: activityLabel })
          .select()
          .single()
        userActivity = newActivity
      }

      const metrics: Record<string, unknown> = {}
      if (parsed.avg_hr) metrics.avg_hr = parsed.avg_hr
      if (parsed.max_hr) metrics.max_hr = parsed.max_hr
      if (parsed.avg_speed_kmh) metrics.avg_speed = parsed.avg_speed_kmh
      if (parsed.cadence_avg) metrics.avg_cadence = parsed.cadence_avg
      if (parsed.steps) metrics.steps = parsed.steps
      if (parsed.training_effect.exercise_load !== null) metrics.exercise_load = parsed.training_effect.exercise_load
      if (parsed.training_effect.aerobic !== null) metrics.training_effect_aerobic = parsed.training_effect.aerobic
      if (parsed.training_effect.anaerobic !== null) metrics.training_effect_anaerobic = parsed.training_effect.anaerobic
      if (parsed.training_effect.primary_benefit) metrics.training_effect_label = parsed.training_effect.primary_benefit

      const { data: session, error: sessionError } = await adminSupabase
        .from('activity_sessions')
        .insert({
          user_id: user.id,
          activity_id: userActivity?.id || null,
          date: today,
          duration: durationMin,
          metrics,
          source: 'garmin_manual',
          notes: 'garmin_activity_import:' + confirmId,
        })
        .select('id')
        .single()

      if (sessionError) throw sessionError

      // v2.4.23: Coach Call ALTIJD aanmaken — dit is een bewuste, handmatige
      // upload (net als een Trainingsbibliotheek-sessie, v2.4.6), geen
      // automatische bulk-sync zoals Strava. Daarom geen drempel-check zoals
      // in coach-calls/route.ts, wel dezelfde heropen-logica als v2.4.8/v2.4.12
      // voor het geval er al een completed/expired call bestond vandaag.
      try {
        const { data: existingCall } = await adminSupabase
          .from('coach_calls')
          .select('id, status')
          .eq('user_id', user.id)
          .eq('date', today)
          .single()

        let callId = existingCall?.id
        if (!callId) {
          const { data: newCall } = await adminSupabase
            .from('coach_calls')
            .insert({ user_id: user.id, date: today, status: 'pending' })
            .select('id')
            .single()
          callId = newCall?.id
        }

        if (callId) {
          await adminSupabase.from('coach_call_items').insert({
            coach_call_id: callId,
            activity_session_id: session.id,
            sport_type: activityLabel,
            duration_min: durationMin,
            status: 'pending',
          })

          if (existingCall && (existingCall.status === 'completed' || existingCall.status === 'expired')) {
            await adminSupabase.from('coach_calls')
              .update({ status: 'pending', completed_at: null })
              .eq('id', callId)
          }
        }
      } catch (coachCallErr) {
        console.error('[garmin-activity-vision] coach_call aanmaken mislukt:', coachCallErr)
        // Niet kritisch voor de activiteit-opslag zelf — niet blokkeren
      }

      await adminSupabase
        .from('garmin_activity_imports')
        .update({ status: 'confirmed', activity_session_id: session.id })
        .eq('id', confirmId)

      return NextResponse.json({ success: true, confirmed: true, activity_session_id: session.id })
    }

    // ── Extract flow ─────────────────────────────────────────────────────────
    if (!imageFile) {
      return NextResponse.json({ error: 'Geen afbeelding meegestuurd' }, { status: 400 })
    }

    const rawBuffer = Buffer.from(await imageFile.arrayBuffer())
    const compressedBuffer = await sharp(rawBuffer)
      .resize({ width: 800, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer()
    const base64 = compressedBuffer.toString('base64')

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
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
              {
                type: 'text',
                text: 'Dit is een screenshot van het "Statistieken"-tabblad van een Garmin Connect activiteit.\nLees alle zichtbare waarden uit en retourneer ALLEEN een JSON object, zonder markdown of uitleg.\n\nGebruik dit exacte schema:\n{\n  "activity_type": "Wandelen",\n  "duration_total": "1:02:45",\n  "duration_moved": "47:18",\n  "avg_hr": 73,\n  "max_hr": 97,\n  "training_effect": { "primary_benefit": "Herstel (Laag aeroob)", "aerobic": 0.7, "anaerobic": 0.0, "exercise_load": 7 },\n  "avg_pace_per_km": "14:40",\n  "avg_speed_kmh": 4.1,\n  "cadence_avg": 78,\n  "steps": 4952\n}\n\nHet activiteitstype staat meestal bovenaan het scherm als titel (bv. "Wandelen", "Hardlopen"). Duur-velden staan in het formaat UU:MM:SS of MM:SS — geef ze exact zo terug als string. Als een waarde niet zichtbaar is, gebruik null.\nRetourneer ALLEEN het JSON object.',
              },
            ],
          },
        ],
      }),
    })

    if (!visionRes.ok) {
      const errText = await visionRes.text()
      console.error('[garmin-activity-vision] Anthropic error:', errText)
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

    const parsed = normalizeActivityData(rawJson)
    const { flags, confidence } = validateActivityData(parsed)
    const status = flags.some(f => f.severity === 'error') ? 'flagged' : 'pending'

    const { data: saved, error: saveError } = await adminSupabase
      .from('garmin_activity_imports')
      .insert({
        user_id: user.id,
        raw_vision_response: rawJson,
        parsed_data: parsed,
        validation_flags: flags,
        confidence_score: confidence,
        status,
      })
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
    console.error('[garmin-activity-vision]', err)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
