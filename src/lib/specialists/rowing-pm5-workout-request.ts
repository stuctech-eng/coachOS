// ── RowingPM5WorkoutRequest — Contract (v1) ──────────────────────────────
// Bron: PM5/Concept2 CSAFE-protocolonderzoek (25 augustus 2026) tegen
// Concept2's officiële documentatie — Concept2 PM CSAFE Communication
// Definition rev 0.27 (log.concept2.com/developers/documentation) en
// Concept2's eigen support-documentatie over "Undefined Rest"
// (concept2.ch/concept2.co.uk, "Setting Up a Workout with Undefined
// Rest"). Zelfde patroon als kettlebell-training-request.ts: dit bestand
// bevat UITSLUITEND het datacontract + validatie — GEEN adapter-logica,
// GEEN CSAFE-bytes, GEEN Bluetooth. De toekomstige iOS/BLE-bridge
// (nog niet gebouwd) vertaalt dit naar CSAFE-commando's.
//
// Architectuur die dit contract bewust mogelijk maakt:
//   CoachOS Training Plan → training_plan_session
//     → RowingPM5WorkoutRequest (dit bestand)
//     → [toekomstige iOS-app] PM5 Bridge Adapter → CSAFE → BLE → PM5
//   en terug:
//     PM5 → BLE/CSAFE → iOS Bridge → CoachOS API → activity_sessions
//     → completed_activity_id → training_plan_sessions → Planned vs Actual
// RowingPM5WorkoutRequest is dus apparaat-onafhankelijk: een andere
// bridge (ander roeitoestel, of een andere transportlaag dan BLE) zou
// dit contract kunnen hergebruiken zonder dat de Training Engine iets
// van CSAFE hoeft te weten.
//
// PM5-REALISTISCH ONTWORPEN: elk veld onder `target` is bevestigd
// programmeerbaar via een echt CSAFE-commando (zie mapping-commentaar
// per veld hieronder). `target_spm` bestaat BEWUST NIET — er is geen
// CSAFE_SET-commando voor streefslagfrequentie gevonden in de volledige,
// officiële commandolijst. Een gewenste SPM is coaching-instructie
// (`instruction.stroke_rate_spm`), nooit een afdwingbaar PM5-commando.
//
// STATUS: v1, APPROVED als ontwerp (25 augustus 2026). Nog GEEN
// productiecode gekoppeld — geen PM5 API-route, geen adapter, geen
// iOS/Bluetooth. Dat volgt in een latere sessie, met echte hardware
// beschikbaar om te verifiëren.

export const ROWING_PM5_WORKOUT_REQUEST_SCHEMA_VERSION = 1

export type RowingPM5DurationType = 'time' | 'distance'

/** Uitsluitend velden met een bevestigd CSAFE-equivalent. */
export interface RowingPM5Target {
  /** Seconden per 500m — CSAFE_PM_SET_TARGETPACETIME. */
  pace_sec_per_500m?: number
  /** CSAFE_SETPOWER_CMD. */
  watts?: number
}

/** Coaching-instructie — NOOIT een PM5-commandotarget, geen CSAFE-
 * equivalent. De toekomstige bridge stuurt dit niet naar de PM5; bedoeld
 * voor weergave elders (in-app tijdens de sessie, of een briefing
 * vooraf). Losstaand van `target` gehouden zodat nooit per ongeluk een
 * niet-uitvoerbaar veld als PM5-commando behandeld wordt. */
export interface RowingPM5Instruction {
  stroke_rate_spm?: { van: number; tot: number }
  notitie?: string
}

export interface RowingPM5WorkInterval {
  type: 'work'
  duration_type: RowingPM5DurationType
  /** Seconden bij 'time', meters bij 'distance'. Nooit een kale, ambigue 'duration'. */
  duration_value: number
  target?: RowingPM5Target
  instruction?: RowingPM5Instruction
}

export interface RowingPM5RestInterval {
  type: 'rest'
  /** Seconden — CSAFE_PM_SET_RESTDURATION kent geen afstandsvariant voor
   * rust, dus hier bewust geen duration_type. Hard gevalideerd op max
   * 595 (9:55) door validateRowingPM5WorkoutRequest() ZODRA aanwezig.
   *
   * Afwezig (undefined) = "Undefined Rest" — de roeier beëindigt de
   * rust zelf (bevestigd: Concept2 support-documentatie, "Setting Up a
   * Workout with Undefined Rest"). Alleen toegestaan wanneer
   * workout_type = 'variable_undefined_rest_interval'. Bevestigde
   * PM5-praktijklimiet: undefined rest kan runtime tot 10 minuten
   * duren (ingebouwd PM5-gedrag, geen instelbare waarde — daarom geen
   * apart contractveld). */
  duration_sec?: number
}

export type RowingPM5Interval = RowingPM5WorkInterval | RowingPM5RestInterval

export type RowingPM5WorkoutType =
  | 'just_row'
  | 'fixed_distance'
  | 'fixed_time'
  | 'fixed_distance_interval'
  | 'fixed_time_interval'
  | 'variable_interval'
  /** WORKOUTTYPE_VARIABLE_UNDEFINEDREST_INTERVAL (CSAFE enum-waarde 9).
   * Bevestigd: max 29 undefined-rest-intervallen (Concept2
   * support-documentatie) — een STRENGERE grens dan de algemene
   * 50-splits-limiet uit Table 19 van de CSAFE-definitie, apart
   * gevalideerd. */
  | 'variable_undefined_rest_interval'

export interface RowingPM5WorkoutRequest {
  schema_version: typeof ROWING_PM5_WORKOUT_REQUEST_SCHEMA_VERSION
  workout_type: RowingPM5WorkoutType
  title: string
  description?: string
  /** 'just_row'/'fixed_distance'/'fixed_time': exact 1 element, type='work'.
   * Interval-typen: afwisselend work/rest, max 50 (PM5-limiet, Table 19),
   * of max 29 undefined-rest-intervallen bij 'variable_undefined_rest_interval'. */
  intervals: RowingPM5Interval[]
  metadata: {
    /** Sleutel voor de deterministische Planned → PM5 → Actual-koppeling
     * (i.t.t. de bestaande, retrospectieve/kans-gebaseerde rowingMatcher
     * voor workouts die buiten CoachOS om op de PM5 gestart worden). */
    training_plan_session_id: string
    coachos_workout_id: string
    created_at: string // ISO 8601
  }
}

// ── Validatie ─────────────────────────────────────────────────────────

export type RowingPM5ValidationError =
  | { code: 'GEEN_INTERVALS'; melding: string }
  | { code: 'TE_VEEL_INTERVALS'; melding: string; aantal: number; maximum: 50 }
  | { code: 'TE_VEEL_ONDEFINIEERDE_RUST_INTERVALS'; melding: string; aantal: number; maximum: 29 }
  | { code: 'RUST_TE_LANG'; melding: string; intervalIndex: number; opgegeven_sec: number; maximum_sec: 595 }
  | { code: 'ONGEDEFINIEERDE_RUST_NIET_TOEGESTAAN'; melding: string; intervalIndex: number }
  | { code: 'GEMENGDE_RUSTVORM'; melding: string }
  | { code: 'ONGELDIGE_DUUR'; melding: string; intervalIndex: number }
  | { code: 'WORKOUTTYPE_INTERVALS_MISMATCH'; melding: string }

export type RowingPM5ValidationResultaat =
  | { geldig: true }
  | { geldig: false; fouten: RowingPM5ValidationError[] }

export function validateRowingPM5WorkoutRequest(request: RowingPM5WorkoutRequest): RowingPM5ValidationResultaat {
  const fouten: RowingPM5ValidationError[] = []

  if (request.intervals.length === 0) {
    fouten.push({ code: 'GEEN_INTERVALS', melding: 'Een workout moet minimaal 1 interval bevatten.' })
  }
  if (request.intervals.length > 50) {
    fouten.push({
      code: 'TE_VEEL_INTERVALS',
      melding: `Maximaal 50 intervals per workout (PM5-limiet) — ${request.intervals.length} opgegeven.`,
      aantal: request.intervals.length, maximum: 50,
    })
  }

  const restIntervals = request.intervals.filter((i): i is RowingPM5RestInterval => i.type === 'rest')
  const ondefinieerdeRustIntervals = restIntervals.filter(r => r.duration_sec === undefined)
  const vasteRustIntervals = restIntervals.filter(r => r.duration_sec !== undefined)

  // Bevestigd: Concept2 support-documentatie noemt expliciet "up to 29
  // undefined rest intervals" — een striktere grens dan de algemene
  // 50-splits-limiet.
  if (ondefinieerdeRustIntervals.length > 29) {
    fouten.push({
      code: 'TE_VEEL_ONDEFINIEERDE_RUST_INTERVALS',
      melding: `Maximaal 29 undefined-rest-intervallen (Concept2-limiet) — ${ondefinieerdeRustIntervals.length} opgegeven.`,
      aantal: ondefinieerdeRustIntervals.length, maximum: 29,
    })
  }

  // NIET rechtstreeks in Concept2's documentatie bevestigd — een
  // ontwerpkeuze, geen geverifieerd feit. De officiële voorbeelden tonen
  // steeds workouts die volledig vaste óf volledig undefined rust
  // gebruiken, nooit gemengd. Bewust voorzichtig: een striktere regel nu
  // is veiliger dan een aanname die later een PM5-afwijzing veroorzaakt.
  // Kan losgelaten worden zodra dit apart bevestigd is (bijv. via een
  // testworkout op echte hardware).
  if (request.workout_type === 'variable_undefined_rest_interval' && vasteRustIntervals.length > 0) {
    fouten.push({
      code: 'GEMENGDE_RUSTVORM',
      melding: `workout_type 'variable_undefined_rest_interval' verwacht dat ALLE rust-intervallen undefined zijn (geen duration_sec) — ${vasteRustIntervals.length} met een vaste duur gevonden. (Aanname, niet 1-op-1 bevestigd in de documentatie.)`,
    })
  }
  if (request.workout_type !== 'variable_undefined_rest_interval' && ondefinieerdeRustIntervals.length > 0) {
    ondefinieerdeRustIntervals.forEach((_, i) => {
      fouten.push({
        code: 'ONGEDEFINIEERDE_RUST_NIET_TOEGESTAAN',
        melding: `Undefined rest (geen duration_sec) is alleen toegestaan bij workout_type 'variable_undefined_rest_interval'.`,
        intervalIndex: i,
      })
    })
  }

  request.intervals.forEach((interval, i) => {
    if (interval.type === 'rest' && interval.duration_sec !== undefined && interval.duration_sec > 595) {
      fouten.push({
        code: 'RUST_TE_LANG',
        melding: `Interval ${i}: rust van ${interval.duration_sec}s overschrijdt de PM5-limiet van 9:55 (595s).`,
        intervalIndex: i, opgegeven_sec: interval.duration_sec, maximum_sec: 595,
      })
    }
    if (interval.type === 'work' && interval.duration_value <= 0) {
      fouten.push({ code: 'ONGELDIGE_DUUR', melding: `Interval ${i}: duration_value moet positief zijn.`, intervalIndex: i })
    }
  })

  const enkeleWorkoutTypes: RowingPM5WorkoutType[] = ['just_row', 'fixed_distance', 'fixed_time']
  if (enkeleWorkoutTypes.includes(request.workout_type) && (request.intervals.length !== 1 || request.intervals[0].type !== 'work')) {
    fouten.push({ code: 'WORKOUTTYPE_INTERVALS_MISMATCH', melding: `workout_type '${request.workout_type}' vergt exact 1 work-interval, geen rest.` })
  }

  return fouten.length === 0 ? { geldig: true } : { geldig: false, fouten }
}

// ── Voorbeelden/documentatie ──────────────────────────────────────────
// Puur ter illustratie en voor toekomstig hergebruik in tests, zodra er
// een testframework is (bewust nu niet toegevoegd — zie changelog).
// Getypeerd tegen het echte contract, dus deze voorbeelden compileren
// altijd mee met eventuele toekomstige contractwijzigingen.

/** 5 × 2.000m / 3:00 rust — geen rest na de laatste work-interval. */
export const VOORBEELD_5X2000M: RowingPM5WorkoutRequest = {
  schema_version: 1,
  workout_type: 'fixed_distance_interval',
  title: '5 x 2000m',
  intervals: [
    { type: 'work', duration_type: 'distance', duration_value: 2000 },
    { type: 'rest', duration_sec: 180 },
    { type: 'work', duration_type: 'distance', duration_value: 2000 },
    { type: 'rest', duration_sec: 180 },
    { type: 'work', duration_type: 'distance', duration_value: 2000 },
    { type: 'rest', duration_sec: 180 },
    { type: 'work', duration_type: 'distance', duration_value: 2000 },
    { type: 'rest', duration_sec: 180 },
    { type: 'work', duration_type: 'distance', duration_value: 2000 },
  ],
  metadata: { training_plan_session_id: 'tps_a1b2c3', coachos_workout_id: 'wo_20260901_001', created_at: '2026-09-01T07:00:00Z' },
}

/** 5 × 4:00 / 2:00 rust, met doelpace 1:45/500m. */
export const VOORBEELD_5X4MIN_TARGET_PACE: RowingPM5WorkoutRequest = {
  schema_version: 1,
  workout_type: 'fixed_time_interval',
  title: '5 x 4:00',
  intervals: [
    { type: 'work', duration_type: 'time', duration_value: 240, target: { pace_sec_per_500m: 105 } },
    { type: 'rest', duration_sec: 120 },
    { type: 'work', duration_type: 'time', duration_value: 240, target: { pace_sec_per_500m: 105 } },
    { type: 'rest', duration_sec: 120 },
    { type: 'work', duration_type: 'time', duration_value: 240, target: { pace_sec_per_500m: 105 } },
    { type: 'rest', duration_sec: 120 },
    { type: 'work', duration_type: 'time', duration_value: 240, target: { pace_sec_per_500m: 105 } },
    { type: 'rest', duration_sec: 120 },
    { type: 'work', duration_type: 'time', duration_value: 240, target: { pace_sec_per_500m: 105 } },
  ],
  metadata: { training_plan_session_id: 'tps_d4e5f6', coachos_workout_id: 'wo_20260901_002', created_at: '2026-09-01T07:00:00Z' },
}

/** 6.000m met doelvermogen 200W. */
export const VOORBEELD_6000M_TARGET_WATTS: RowingPM5WorkoutRequest = {
  schema_version: 1,
  workout_type: 'fixed_distance',
  title: '6000m @ 200W',
  intervals: [
    { type: 'work', duration_type: 'distance', duration_value: 6000, target: { watts: 200 } },
  ],
  metadata: { training_plan_session_id: 'tps_g7h8i9', coachos_workout_id: 'wo_20260901_003', created_at: '2026-09-01T07:00:00Z' },
}

/** 3 × 500m met undefined rest — bijv. box jumps ertussen (Concept2's eigen CrossFit-voorbeeld). */
export const VOORBEELD_UNDEFINED_REST: RowingPM5WorkoutRequest = {
  schema_version: 1,
  workout_type: 'variable_undefined_rest_interval',
  title: '3 x 500m, undefined rest (box jumps ertussen)',
  intervals: [
    { type: 'work', duration_type: 'distance', duration_value: 500 },
    { type: 'rest' },
    { type: 'work', duration_type: 'distance', duration_value: 500 },
    { type: 'rest' },
    { type: 'work', duration_type: 'distance', duration_value: 500 },
  ],
  metadata: { training_plan_session_id: 'tps_m4n5o6', coachos_workout_id: 'wo_20260901_005', created_at: '2026-09-01T07:00:00Z' },
}

/** Ongeldig ter illustratie: rust van 10:00 overschrijdt de 9:55-limiet.
 * validateRowingPM5WorkoutRequest(VOORBEELD_ONGELDIG_RUST_TE_LANG).geldig === false */
export const VOORBEELD_ONGELDIG_RUST_TE_LANG: RowingPM5WorkoutRequest = {
  schema_version: 1,
  workout_type: 'fixed_time_interval',
  title: 'Ongeldig: rust te lang',
  intervals: [
    { type: 'work', duration_type: 'time', duration_value: 240 },
    { type: 'rest', duration_sec: 600 },
  ],
  metadata: { training_plan_session_id: 'tps_j1k2l3', coachos_workout_id: 'wo_20260901_004', created_at: '2026-09-01T07:00:00Z' },
}

/** Ongeldig ter illustratie: gemengde vaste/undefined rust binnen 'variable_undefined_rest_interval'.
 * validateRowingPM5WorkoutRequest(VOORBEELD_ONGELDIG_GEMENGDE_RUST).geldig === false */
export const VOORBEELD_ONGELDIG_GEMENGDE_RUST: RowingPM5WorkoutRequest = {
  schema_version: 1,
  workout_type: 'variable_undefined_rest_interval',
  title: 'Ongeldig: gemengde rustvorm',
  intervals: [
    { type: 'work', duration_type: 'distance', duration_value: 500 },
    { type: 'rest' },
    { type: 'work', duration_type: 'distance', duration_value: 500 },
    { type: 'rest', duration_sec: 60 },
  ],
  metadata: { training_plan_session_id: 'tps_p7q8r9', coachos_workout_id: 'wo_20260901_006', created_at: '2026-09-01T07:00:00Z' },
}
