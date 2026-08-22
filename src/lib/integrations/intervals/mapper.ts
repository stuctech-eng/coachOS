// ── Intervals.icu — Mapper ──────────────────────────────────────────────
// v2.4.337. Fase 12 van het master plan. Vertaalt een ruwe Intervals.icu-
// activiteit naar exact het formaat dat de bestaande Activity Bridge al
// gebruikt (§8: "geen nieuw activity-model zonder noodzaak").
//
// PUUR TRANSFORMATIE — deze functie schrijft nooit iets weg, doet geen
// database-aanroepen. Dat gebeurt pas in de dry-run-route (Fase 13/14),
// en uiteindelijk in een aparte productie-route (Fase 15, nog te bouwen).

export interface IntervalsActiviteitRuw {
  id: string
  external_id: string | null
  start_date_local: string
  type: string | null
  source: string | null
  device_name: string | null
  distance: number | null
  moving_time: number | null
  average_heartrate: number | null
  max_heartrate: number | null
  average_cadence: number | null
  calories: number | null
}

export interface GemappedActiviteit {
  date: string // yyyy-mm-dd
  duration: number // minuten, afgerond — consistent met bestaande activity_sessions.duration
  metrics: {
    distance?: number
    avg_hr?: number
    max_hr?: number
    avg_stroke_rate?: number
    calories?: number
    precieze_duur_sec?: number
  }
  source: 'intervals_icu'
  // §9 van het master plan: externe ID bewaren, notes-patroon
  // hergebruikt van de bestaande Activity Bridge (`training_result:${id}`)
  notes: string
  externalId: string | null
}

export function mapIntervalsActiviteit(ruw: IntervalsActiviteitRuw): GemappedActiviteit {
  const datum = ruw.start_date_local.split('T')[0]
  const duurMin = ruw.moving_time ? Math.round(ruw.moving_time / 60) : 0

  return {
    date: datum,
    duration: duurMin,
    metrics: {
      distance: ruw.distance ?? undefined,
      avg_hr: (ruw.average_heartrate && ruw.average_heartrate > 0) ? ruw.average_heartrate : undefined,
      max_hr: (ruw.max_heartrate && ruw.max_heartrate > 0) ? ruw.max_heartrate : undefined,
      avg_stroke_rate: ruw.average_cadence ?? undefined,
      calories: ruw.calories ?? undefined,
      // v2.4.332 introduceerde dit veld al voor Concept2-sync — zelfde
      // precisie-doel, nu ook voor de Intervals.icu-route.
      precieze_duur_sec: ruw.moving_time ?? undefined,
    },
    source: 'intervals_icu',
    notes: `intervals_icu:${ruw.external_id || ruw.id}`,
    externalId: ruw.external_id,
  }
}
