import type { VisionParser, ValidationFlag } from './types'

// ── Garmin Health Parser ─────────────────────────────────────────────────
// Bron: overleg 20 juli 2026. Herkent het "In één oogopslag"-scherm met
// de Health-widgets (HRV, Body Battery, rusthartslag, stress, slaap,
// ademhaling) — te onderscheiden van het Performance-scherm
// (garmin-performance-parser.ts), dat dezelfde titel deelt maar andere
// widgets toont.
//
// Vrijwel 1-op-1 overgenomen uit garmin-vision/route.ts (bewezen prompt/
// normalisatie/validatie) — nu als losse Vision Engine-parser i.p.v.
// inline in de route.

export interface GarminHealthParsed {
  resting_hr: number | null
  body_battery: { current: number | null; charged: number | null; spent: number | null }
  sleep: { score: number | null; duration_minutes: number | null }
  hrv: { avg_7d_ms: number | null; status: string | null }
  stress: number | null
  breathing: { current_brpm: number | null; avg_awake_brpm: number | null; avg_sleep_brpm: number | null }
}

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

export const garminHealthParser: VisionParser<GarminHealthParsed> = {
  naam: 'garmin-health',
  prompt: 'Dit is een screenshot van de Garmin Connect "In één oogopslag" pagina (Health-widgets).\n' +
    'Lees ALLEEN de zichtbare cijfers uit — geen interpretatie, geen advies, puur de waarden.\n' +
    'Retourneer ALLEEN een JSON object, zonder markdown of uitleg.\n\n' +
    'Gebruik dit exacte schema:\n' +
    '{\n' +
    '  "resting_hr": 46,\n' +
    '  "body_battery": { "current": 83, "charged": 49, "spent": 8 },\n' +
    '  "sleep": { "score": 83, "duration": "6u 48m" },\n' +
    '  "hrv": { "avg_7d_ms": 49, "status": "Evenwichtig" },\n' +
    '  "stress": 18,\n' +
    '  "breathing": { "current_brpm": 20, "avg_awake_brpm": 15, "avg_sleep_brpm": 13 }\n' +
    '}\n\n' +
    'Als een waarde niet zichtbaar is, gebruik null. Retourneer ALLEEN het JSON object.',

  normalize(raw): GarminHealthParsed {
    return {
      resting_hr: toNumber(raw?.resting_hr),
      body_battery: {
        current: toNumber((raw?.body_battery as Record<string, unknown>)?.current),
        charged: toNumber((raw?.body_battery as Record<string, unknown>)?.charged),
        spent: toNumber((raw?.body_battery as Record<string, unknown>)?.spent),
      },
      sleep: {
        score: toNumber((raw?.sleep as Record<string, unknown>)?.score),
        duration_minutes: parseSleepDuration((raw?.sleep as Record<string, unknown>)?.duration),
      },
      hrv: {
        avg_7d_ms: toNumber((raw?.hrv as Record<string, unknown>)?.avg_7d_ms),
        status: normalizeHrvStatus((raw?.hrv as Record<string, unknown>)?.status),
      },
      stress: toNumber(raw?.stress),
      breathing: {
        current_brpm: toNumber((raw?.breathing as Record<string, unknown>)?.current_brpm),
        avg_awake_brpm: toNumber((raw?.breathing as Record<string, unknown>)?.avg_awake_brpm),
        avg_sleep_brpm: toNumber((raw?.breathing as Record<string, unknown>)?.avg_sleep_brpm),
      },
    }
  },

  validate(data): { flags: ValidationFlag[]; confidence: number } {
    const flags: ValidationFlag[] = []
    const rangeChecks = [
      { field: 'resting_hr', value: data.resting_hr, min: 25, max: 100 },
      { field: 'body_battery.current', value: data.body_battery.current, min: 0, max: 100 },
      { field: 'sleep.score', value: data.sleep.score, min: 0, max: 100 },
      { field: 'sleep.duration_minutes', value: data.sleep.duration_minutes, min: 60, max: 840 },
      { field: 'hrv.avg_7d_ms', value: data.hrv.avg_7d_ms, min: 10, max: 200 },
      { field: 'stress', value: data.stress, min: 0, max: 100 },
      { field: 'breathing.avg_sleep_brpm', value: data.breathing.avg_sleep_brpm, min: 8, max: 25 },
    ]
    for (const check of rangeChecks) {
      if (check.value === null) {
        flags.push({ field: check.field, value: null, reason: 'Waarde ontbreekt of kon niet worden uitgelezen', severity: 'warning' })
      } else if (check.value < check.min || check.value > check.max) {
        flags.push({ field: check.field, value: check.value, reason: `Waarde buiten verwacht bereik (${check.min}–${check.max})`, severity: 'error' })
      }
    }
    const errorCount = flags.filter(f => f.severity === 'error').length
    const warningCount = flags.filter(f => f.severity === 'warning').length
    return { flags, confidence: Math.max(0, 100 - errorCount * 20 - warningCount * 5) }
  },
}
