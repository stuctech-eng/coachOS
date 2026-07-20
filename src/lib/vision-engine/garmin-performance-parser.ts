import type { VisionParser, ValidationFlag } from './types'

// ── Garmin Performance Parser ────────────────────────────────────────────
// Bron: overleg 20 juli 2026, gebaseerd op het door de gebruiker
// aangeleverde screenshot (Training Readiness/Trainingslast/
// Trainingsstatus/Focus lading/VO2max/Endurance Score). Zelfde
// "In één oogopslag"-paginatitel als de Health-widgets, maar andere
// widget-set — vandaar een aparte parser i.p.v. één alles-in-één-prompt
// (hogere herkenningsbetrouwbaarheid per scherm).
//
// EERLIJKE BEPERKING: "Focus lading" (drie waarden + een optimaal-
// bereik-balk in het screenshot) is met één voorbeeld nog onzeker qua
// exacte betekenis per getal — hier als drie losse ruwe waarden
// opgeslagen (laag/gemiddeld/hoog aeroob, beste inschatting), niet als
// afgeleide interpretatie. Hill Score, Recovery Time en Race Predictor
// stonden niet op het aangeleverde screenshot — velden bestaan alvast
// (NULL als er niets is), zodat de tabel niet opnieuw hoeft te wijzigen
// zodra een screenshot met die widgets beschikbaar komt.

export interface GarminPerformanceParsed {
  training_readiness: number | null
  training_readiness_label: string | null
  acute_load: number | null
  chronic_load: number | null
  load_ratio: number | null
  training_status_label: string | null
  load_focus_low: number | null
  load_focus_moderate: number | null
  load_focus_high: number | null
  vo2max: number | null
  vo2max_label: string | null
  endurance_score: number | null
  endurance_score_label: string | null
  hill_score: number | null
  recovery_time_hours: number | null
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

function toStringOrNull(val: unknown): string | null {
  return typeof val === 'string' && val.trim() ? val.trim() : null
}

export const garminPerformanceParser: VisionParser<GarminPerformanceParsed> = {
  naam: 'garmin-performance',
  prompt: 'Dit is een screenshot van de Garmin Connect "In één oogopslag" pagina (Performance-widgets: ' +
    'Training Readiness, Trainingslast, Trainingsstatus, Focus lading, VO2max, Endurance Score).\n' +
    'Lees ALLEEN de zichtbare cijfers en labels uit — geen interpretatie, geen advies, puur de waarden.\n' +
    'Retourneer ALLEEN een JSON object, zonder markdown of uitleg.\n\n' +
    'Gebruik dit exacte schema:\n' +
    '{\n' +
    '  "training_readiness": 98,\n' +
    '  "training_readiness_label": "Uitstekend",\n' +
    '  "acute_load": 95,\n' +
    '  "chronic_load": 219,\n' +
    '  "load_ratio": 0.4,\n' +
    '  "training_status_label": "Herstel",\n' +
    '  "load_focus_low": 52,\n' +
    '  "load_focus_moderate": 0,\n' +
    '  "load_focus_high": 578,\n' +
    '  "vo2max": 45,\n' +
    '  "vo2max_label": "Uitstekend",\n' +
    '  "endurance_score": 4725,\n' +
    '  "endurance_score_label": "Gevorderd",\n' +
    '  "hill_score": null,\n' +
    '  "recovery_time_hours": null\n' +
    '}\n\n' +
    'Als een waarde niet zichtbaar is (bijv. Hill Score staat er niet op), gebruik null. Retourneer ALLEEN het JSON object.',

  normalize(raw): GarminPerformanceParsed {
    return {
      training_readiness: toNumber(raw?.training_readiness),
      training_readiness_label: toStringOrNull(raw?.training_readiness_label),
      acute_load: toNumber(raw?.acute_load),
      chronic_load: toNumber(raw?.chronic_load),
      load_ratio: toNumber(raw?.load_ratio),
      training_status_label: toStringOrNull(raw?.training_status_label),
      load_focus_low: toNumber(raw?.load_focus_low),
      load_focus_moderate: toNumber(raw?.load_focus_moderate),
      load_focus_high: toNumber(raw?.load_focus_high),
      vo2max: toNumber(raw?.vo2max),
      vo2max_label: toStringOrNull(raw?.vo2max_label),
      endurance_score: toNumber(raw?.endurance_score),
      endurance_score_label: toStringOrNull(raw?.endurance_score_label),
      hill_score: toNumber(raw?.hill_score),
      recovery_time_hours: toNumber(raw?.recovery_time_hours),
    }
  },

  validate(data): { flags: ValidationFlag[]; confidence: number } {
    const flags: ValidationFlag[] = []
    const rangeChecks = [
      { field: 'training_readiness', value: data.training_readiness, min: 0, max: 100 },
      { field: 'load_ratio', value: data.load_ratio, min: 0, max: 3 },
      { field: 'vo2max', value: data.vo2max, min: 15, max: 90 },
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
