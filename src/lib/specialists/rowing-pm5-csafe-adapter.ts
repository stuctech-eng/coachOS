// ── RowingPM5WorkoutRequest → CSAFE — Adapter v2 (pure logica) ──────────
// Bron: bevestigde, daadwerkelijk werkende broncode uit
// tijmenvangulik/ErgometerJS (Apache 2.0, 126 sterren, echte PM5-
// hardware-gebruikers) — specifiek
// api/typescript/ergometer/csafe/proprietary_program_commands.ts —
// kruisgeverifieerd tegen de officiële Concept2 PM CSAFE Communication
// Definition rev 0.27 (log.concept2.com/developers/documentation).
// Command-ID's onafhankelijk bevestigd via twee bronnen (deze library
// én het losse open-source csafe.h-header van dezelfde auteur).
//
// SCOPE: dit bestand bouwt CSAFE command+data-byte-paren. GEEN BLE-
// frame-encoding (start/stop-bytes, byte-stuffing, checksum, 120-byte-
// frame-opsplitsing — dat is transportlaag-werk voor de toekomstige
// iOS-bridge), GEEN Bluetooth, GEEN Xcode-afhankelijkheid.
//
// v2 t.o.v. v1 — wat er veranderd is en waarom:
//   - Structuur is nu stateful/interval-index-gebaseerd i.p.v. een
//     platte commandolijst — bevestigd nodig, geen keuze.
//   - Afstand-duur: rauwe meters, GEEN ×10 (v1-fout, gecorrigeerd).
//   - Watts: PM_SET_TARGETAVGWATTS (0x15, proprietary, 2 bytes MSB-
//     eerst, geen eenheid-byte) i.p.v. het publieke CSAFE_SETPOWER_CMD
//     (0x34) dat v1 gebruikte — deze programmeerroute is exclusief
//     proprietary, mixen met een publiek commando is niet bevestigd
//     en dus vermeden.
//   - Pace: nu wél geïmplementeerd — CSAFE_PM_SET_TARGETPACETIME,
//     4 bytes MSB-eerst, ×100 (0,01 sec), GEEN type-vlagbyte. Bevestigd
//     via `.setTargetPaceTime({value:(1*60+40)*100})` in een echt
//     werkend ErgometerJS-voorbeeld voor "1:40"-pace.
//
// BELANGRIJKE TERMINOLOGIE-CORRECTIE: CONFIGURE_WORKOUT(true) wordt
// hieronder NERGENS "commit-stap" genoemd. Bevestigd is uitsluitend dat
// ErgometerJS deze aanroep doet tijdens het programmeren van elk
// interval, in elk werkend voorbeeld dat gevonden is. De betekenis van
// CONFIGURE_WORKOUT(false) is nergens gedocumenteerd en in geen enkel
// gevonden werkend voorbeeld gebruikt — deze adapter roept daarom
// UITSLUITEND programmingMode=true aan, nooit false.

import type {
  RowingPM5WorkoutRequest,
  RowingPM5WorkoutType,
  RowingPM5Interval,
  RowingPM5WorkInterval,
  RowingPM5RestInterval,
} from './rowing-pm5-workout-request'

export interface CSAFECommando {
  commando: number
  data: number[]
  naam: string
}

/** Gegooid i.p.v. een gok — zie module-commentaar en de functie
 * hieronder voor de exacte reden. */
export class RowingPM5AdapterFout extends Error {
  constructor(public code: 'UNDEFINED_REST_INTERVALTYPE_ONBEKEND', melding: string) {
    super(melding)
    this.name = 'RowingPM5AdapterFout'
  }
}

// ── Bevestigde command-ID's (CSAFE_PM_LONG_PUSH_CFG_CMDS) ───────────────
// Kruisgeverifieerd: ErgometerJS/api/typescript/ergometer/csafe/
// typedefinitions.ts ÉN de officiële PDF (Table: "C2 Proprietary Long
// Set Configuration Commands"), beide identiek.
const PM_SET_WORKOUTTYPE = 0x01
const PM_SET_WORKOUTDURATION = 0x03
const PM_SET_RESTDURATION = 0x04
const PM_SET_TARGETPACETIME = 0x06
const PM_CONFIGURE_WORKOUT = 0x14
const PM_SET_TARGETAVGWATTS = 0x15
const PM_SET_INTERVALTYPE = 0x17
const PM_SET_WORKOUTINTERVALCOUNT = 0x18

// ── Workout-type-enum — bevestigd (OBJ_WORKOUTTYPE_T, officiële PDF) ────
const WORKOUTTYPE_ENUM: Record<RowingPM5WorkoutType, number> = {
  // EERLIJKE BEPERKING (ongewijzigd t.o.v. v1): het contract kent geen
  // "met/zonder splits"-onderscheid voor just_row/fixed_distance/
  // fixed_time — bewust de _NOSPLITS-variant als conservatieve default.
  just_row: 0,
  fixed_distance: 2,
  fixed_time: 4,
  fixed_time_interval: 6,
  fixed_distance_interval: 7,
  variable_interval: 8,
  variable_undefined_rest_interval: 9,
}

const INTERVAL_TYPES_MET_PM5_PROGRAMMERING: RowingPM5WorkoutType[] = [
  'fixed_time_interval', 'fixed_distance_interval', 'variable_interval', 'variable_undefined_rest_interval',
]

function getByte(waarde: number, byteIndex: number): number {
  return (waarde >> (byteIndex * 8)) & 0xff
}
function vierBytesMsbEerst(waarde: number): number[] {
  return [getByte(waarde, 3), getByte(waarde, 2), getByte(waarde, 1), getByte(waarde, 0)]
}
function tweeBytesMsbEerst(waarde: number): number[] {
  return [getByte(waarde, 1), getByte(waarde, 0)]
}

function encodeerWorkoutType(workoutType: RowingPM5WorkoutType): CSAFECommando {
  return { commando: PM_SET_WORKOUTTYPE, data: [WORKOUTTYPE_ENUM[workoutType]], naam: 'PM_SET_WORKOUTTYPE' }
}

/** Bevestigd: byte0 = type-vlag (0x00 tijd, 0x80 afstand), dan 4 bytes
 * MSB-eerst. Tijd in 0,01 sec (×100, bevestigd via ErgometerJS-
 * broncode-commentaar "when the value is a time it is in 0.01
 * seconds"). Afstand: RAUWE METERS — bevestigd via het werkende
 * voorbeeld `setWorkoutDuration({value:500, distance})` voor 500m
 * (v1 gebruikte hier ten onrechte ×10). */
function encodeerWorkoutDuur(work: RowingPM5WorkInterval): CSAFECommando {
  const typeVlag = work.duration_type === 'distance' ? 0x80 : 0x00
  const ruweWaarde = work.duration_type === 'distance'
    ? Math.round(work.duration_value)
    : Math.round(work.duration_value * 100)
  return { commando: PM_SET_WORKOUTDURATION, data: [typeVlag, ...vierBytesMsbEerst(ruweWaarde)], naam: 'PM_SET_WORKOUTDURATION' }
}

/** Bevestigd: 2 bytes MSB-eerst, rauwe hele seconden. Wordt alleen
 * aangeroepen voor een AANWEZIGE, vaste rust — undefined rest wordt
 * hiervoor nooit bereikt (zie generateerCSAFECommandos: fail-fast). */
function encodeerRestDuur(rest: RowingPM5RestInterval): CSAFECommando {
  const seconden = Math.round(rest.duration_sec as number)
  return { commando: PM_SET_RESTDURATION, data: tweeBytesMsbEerst(seconden), naam: 'PM_SET_RESTDURATION' }
}

/** Bevestigd via werkend voorbeeld: `.setTargetPaceTime({value:(1*60+40)*100})`
 * voor pace "1:40" → 4 bytes MSB-eerst, ×100 (0,01 sec), GEEN type-vlagbyte
 * (in tegenstelling tot WORKOUTDURATION/SPLITDURATION). */
function encodeerDoelPace(paceSecPer500m: number): CSAFECommando {
  const waarde = Math.round(paceSecPer500m * 100)
  return { commando: PM_SET_TARGETPACETIME, data: vierBytesMsbEerst(waarde), naam: 'PM_SET_TARGETPACETIME' }
}

/** Bevestigd: PM_SET_TARGETAVGWATTS (0x15, proprietary), 2 bytes
 * MSB-eerst, GEEN eenheid-byte. Vervangt v1's publieke SETPOWER_CMD
 * (0x34) — die hoort niet in een verder volledig proprietary
 * programmeersequentie, op expliciet verzoek gecorrigeerd. */
function encodeerDoelWatts(watts: number): CSAFECommando {
  return { commando: PM_SET_TARGETAVGWATTS, data: tweeBytesMsbEerst(Math.round(watts)), naam: 'PM_SET_TARGETAVGWATTS' }
}

/** Bevestigd: 1 byte, 0=tijd/1=afstand voor een NORMAAL (niet-undefined-
 * rest) werk-interval. Undefined-rest-intervaltype-waarden worden hier
 * bewust nooit gebruikt — zie generateerCSAFECommandos(). */
function encodeerIntervalType(work: RowingPM5WorkInterval): CSAFECommando {
  const waarde = work.duration_type === 'distance' ? 1 : 0
  return { commando: PM_SET_INTERVALTYPE, data: [waarde], naam: 'PM_SET_INTERVALTYPE' }
}

function encodeerWorkoutIntervalCount(index: number): CSAFECommando {
  return { commando: PM_SET_WORKOUTINTERVALCOUNT, data: [index], naam: 'PM_SET_WORKOUTINTERVALCOUNT' }
}

/** Bevestigd: 1 byte, 1=true/0=false. UITSLUITEND met true aangeroepen
 * in deze adapter — zie module-commentaar. */
function encodeerConfigureWorkout(programmingMode: true): CSAFECommando {
  return { commando: PM_CONFIGURE_WORKOUT, data: [programmingMode ? 1 : 0], naam: 'PM_CONFIGURE_WORKOUT' }
}

interface Pm5IntervalSlot {
  index: number
  work: RowingPM5WorkInterval
  rest: RowingPM5RestInterval | null
}

/** Groepeert de platte, afwisselende work/rest-lijst uit het contract
 * in PM5-interval-"slots" (één work + de eventueel direct erop volgende
 * rest = één 0-based interval-index) — bevestigd patroon uit het
 * werkende variable-interval-voorbeeld. */
function groepeerInPm5Slots(intervals: RowingPM5Interval[]): Pm5IntervalSlot[] {
  const slots: Pm5IntervalSlot[] = []
  let i = 0
  let index = 0
  while (i < intervals.length) {
    const huidig = intervals[i]
    if (huidig.type !== 'work') { i++; continue } // contract-validatie voorkomt dit al, puur defensief
    const volgende = intervals[i + 1]
    const rest = (volgende && volgende.type === 'rest') ? volgende : null
    slots.push({ index, work: huidig, rest })
    index++
    i += rest ? 2 : 1
  }
  return slots
}

function pushTargets(commandos: CSAFECommando[], work: RowingPM5WorkInterval) {
  if (work.target?.watts !== undefined) commandos.push(encodeerDoelWatts(work.target.watts))
  if (work.target?.pace_sec_per_500m !== undefined) commandos.push(encodeerDoelPace(work.target.pace_sec_per_500m))
}

/** Bouwt de volledige, geordende lijst CSAFE-commando's — GEEN BLE-
 * verzending, GEEN frame-encoding.
 *
 * Gooit RowingPM5AdapterFout (UNDEFINED_REST_INTERVALTYPE_ONBEKEND) en
 * genereert HELEMAAL NIETS als de workout een undefined-rest-interval
 * bevat — bewust fail-fast, geen gedeeltelijke/foutieve commandolijst.
 * variable_undefined_rest_interval blijft daarmee wél onderdeel van
 * het contract (RowingPM5WorkoutRequest v1, approved), maar is via
 * deze adapter voorlopig bewust niet uitvoerbaar. */
export function genereerCSAFECommandos(request: RowingPM5WorkoutRequest): CSAFECommando[] {
  const isIntervalWorkout = INTERVAL_TYPES_MET_PM5_PROGRAMMERING.includes(request.workout_type)

  if (isIntervalWorkout) {
    const slots = groepeerInPm5Slots(request.intervals)

    const ongedefinieerdeRustSlot = slots.find(s => s.rest && s.rest.duration_sec === undefined)
    if (ongedefinieerdeRustSlot) {
      throw new RowingPM5AdapterFout(
        'UNDEFINED_REST_INTERVALTYPE_ONBEKEND',
        `PM5 IntervalType voor undefined rest is niet voldoende bevestigd; workout niet gegenereerd om `
        + `protocolgokken te voorkomen (interval-index ${ongedefinieerdeRustSlot.index}). `
        + `Vijf kandidaat-enumwaarden gevonden (timertUndefined/distanceRestUndefined/restUndefined/`
        + `calRestUndefined/wattMinuteRestUndefined) zonder een werkend voorbeeld dat bevestigt welke `
        + `daadwerkelijk gebruikt wordt voor deze situatie.`
      )
    }

    const commandos: CSAFECommando[] = []
    for (const slot of slots) {
      commandos.push(encodeerWorkoutIntervalCount(slot.index))
      if (slot.index === 0) commandos.push(encodeerWorkoutType(request.workout_type)) // bevestigd: alleen bij interval 0
      commandos.push(encodeerIntervalType(slot.work))
      commandos.push(encodeerWorkoutDuur(slot.work))
      if (slot.rest) commandos.push(encodeerRestDuur(slot.rest))
      pushTargets(commandos, slot.work)
      commandos.push(encodeerConfigureWorkout(true))
    }
    return commandos
  }

  // Niet-interval-workouts (just_row / fixed_distance / fixed_time):
  // geen SET_WORKOUTINTERVALCOUNT/SET_INTERVALTYPE — bevestigd afwezig
  // in de werkende "Configure 2000m/400m splits"/"Configure 20:00/4:00
  // splits"-voorbeelden.
  const enkelWork = request.intervals.find((i): i is RowingPM5WorkInterval => i.type === 'work')!

  if (request.workout_type === 'just_row') {
    // Bevestigd: het "Configure JustRow"-voorbeeld roept ALLEEN
    // setWorkoutType aan — geen duur, geen CONFIGURE_WORKOUT. Het
    // contract staat een duration_value toe voor just_row (zie
    // rowing-pm5-workout-request.ts), maar echte JustRow kent geen
    // duurdoel — bewust genegeerd door deze adapter, niet verzonden.
    return [encodeerWorkoutType('just_row')]
  }

  const commandos: CSAFECommando[] = [encodeerWorkoutType(request.workout_type), encodeerWorkoutDuur(enkelWork)]
  pushTargets(commandos, enkelWork)
  commandos.push(encodeerConfigureWorkout(true))
  return commandos
}
