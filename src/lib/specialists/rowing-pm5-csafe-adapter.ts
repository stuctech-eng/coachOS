// ── RowingPM5WorkoutRequest → CSAFE — Adapter (pure logica) ─────────────
// Bron: Concept2 PM CSAFE Communication Definition rev 0.27
// (log.concept2.com/developers/documentation) + command-ID-bevestiging
// via het open-source csafe.h-header (github.com/tijmenvangulik/
// PM3Monitor, MIT-vergelijkbare licentie, identieke command-IDs als de
// officiële Concept2-documentatie).
//
// SCOPE: dit bestand bouwt CSAFE command+data-byte-paren. GEEN BLE-
// frame-encoding (start/stop-bytes, byte-stuffing, checksum — dat is
// transportlaag-werk voor de toekomstige iOS-bridge), GEEN Bluetooth,
// GEEN Xcode-afhankelijkheid. Puur TypeScript, geïsoleerd te
// verifiëren zonder hardware — vandaar nu al bouwbaar, in
// tegenstelling tot de iOS/BLE-laag zelf.
//
// NIET GEÏMPLEMENTEERD, BEWUST: doelpace (CSAFE_PM_SET_TARGETPACETIME,
// commando 0x06). Het command-ID is bevestigd (twee onafhankelijke
// bronnen), maar het exacte byte-formaat van de data (eenheid,
// bytelengte, volgorde) kon ik nergens vinden — de officiële PDF kapte
// op precies dat punt af (drie pogingen, ook met verhoogd
// tokenlimiet), en het open-source csafe.h-header bevat alleen de
// command-ID, niet de data-encoding (die zit in een niet-publiek
// .cpp-bestand). Zie encodeerDoelPace() hieronder — gooit bewust een
// fout i.p.v. te gokken naar een byte-indeling.

import type {
  RowingPM5WorkoutRequest,
  RowingPM5WorkoutType,
  RowingPM5WorkInterval,
  RowingPM5RestInterval,
} from './rowing-pm5-workout-request'

export interface CSAFECommando {
  /** Het CSAFE long-commando-ID, bijv. 0x01 voor CSAFE_PM_SET_WORKOUTTYPE. */
  commando: number
  /** Ruwe databytes, exact zoals de documentatie ze beschrijft. */
  data: number[]
  /** Voor menselijke leesbaarheid/debugging — geen onderdeel van de CSAFE-frame zelf. */
  naam: string
}

// ── Bevestigde command-IDs (CSAFE_PM_LONG_PUSH_CFG_CMDS) ────────────────
// Command space: CSAFE_SETPMCFG_CMD_LONG_MIN = 0x00, dus dit zijn de
// ruwe long-commando-bytes zoals ze op de CSAFE_SETPMCFG_CMD (0x76) of
// CSAFE_SETPMDATA_CMD (0x77) wrapper meegaan — de wrapping zelf is
// bridge/transportlaag-werk, hier alleen de "binnenkant".
const CSAFE_PM_SET_WORKOUTTYPE = 0x01
const CSAFE_PM_SET_WORKOUTDURATION = 0x03
const CSAFE_PM_SET_RESTDURATION = 0x04
const CSAFE_SETPOWER_CMD = 0x34 // Standaard (publieke) CSAFE long-commando, niet PM-proprietary — eigen command space (CSAFE_DATA_CMD_LONG_MIN-gebaseerd), apart afgehandeld

// ── Workout-type-mapping — CSAFE_PM_GET_WORKOUTTYPE-enum, bevestigd ─────
// Twee keer identiek teruggevonden in de officiële documentatie
// (rowing general status-characteristic 0x0031 én de multiplexed-
// informatietabel). OBJ_WORKOUTTYPE_T-enum-waarden, 0-12.
const WORKOUTTYPE_ENUM: Record<RowingPM5WorkoutType, number> = {
  // EERLIJKE BEPERKING: het contract kent geen "met/zonder splits"-
  // onderscheid voor just_row/fixed_distance/fixed_time (de PM5-enum
  // heeft dat wel — bijv. WORKOUTTYPE_JUSTROW_SPLITS vs _NOSPLITS).
  // Hier bewust de _NOSPLITS-variant als conservatieve default gekozen
  // — geen aanname over of de gebruiker split-weergave wil.
  just_row: 0, // WORKOUTTYPE_JUSTROW_NOSPLITS
  fixed_distance: 2, // WORKOUTTYPE_FIXEDDIST_NOSPLITS
  fixed_time: 4, // WORKOUTTYPE_FIXEDTIME_NOSPLITS
  fixed_time_interval: 6, // WORKOUTTYPE_FIXEDTIME_INTERVAL
  fixed_distance_interval: 7, // WORKOUTTYPE_FIXEDDIST_INTERVAL
  variable_interval: 8, // WORKOUTTYPE_VARIABLE_INTERVAL
  variable_undefined_rest_interval: 9, // WORKOUTTYPE_VARIABLE_UNDEFINEDREST_INTERVAL
}

function encodeer4ByteWaarde(waarde: number, volgorde: 'MSB_EERST' | 'LSB_EERST'): number[] {
  const bytes = [
    (waarde >> 24) & 0xff,
    (waarde >> 16) & 0xff,
    (waarde >> 8) & 0xff,
    waarde & 0xff,
  ]
  return volgorde === 'MSB_EERST' ? bytes : bytes.reverse()
}

/** CSAFE_PM_SET_WORKOUTTYPE (0x01) — bevestigd: 1 databyte, de enum-waarde. */
export function encodeerWorkoutType(workoutType: RowingPM5WorkoutType): CSAFECommando {
  return { commando: CSAFE_PM_SET_WORKOUTTYPE, data: [WORKOUTTYPE_ENUM[workoutType]], naam: 'CSAFE_PM_SET_WORKOUTTYPE' }
}

/** CSAFE_PM_SET_WORKOUTDURATION (0x03) — bevestigd: byte 0 = type-vlag
 * (0x00 tijd, 0x80 afstand — calorieën/watt-minuten niet gebruikt door
 * dit contract), byte 1-4 = duur, MSB eerst (bevestigd uit de
 * documentatie-tekst voor dit specifieke commando).
 *
 * Sub-eenheid AFGELEID uit het patroon dat elders in dezelfde
 * documentatie consistent gebruikt wordt voor tijd/afstand (0,01 sec
 * resp. 0,1 m per LSB, gezien in alle BLE-status-characteristics) —
 * NIET letterlijk herbevestigd voor dit specifieke SET-commando. Zie
 * module-commentaar: als richtwaarde gebruikt, niet als 100% zeker feit. */
export function encodeerWorkoutDuur(work: RowingPM5WorkInterval): CSAFECommando {
  const typeVlag = work.duration_type === 'distance' ? 0x80 : 0x00
  const subEenheid = work.duration_type === 'distance' ? 10 : 100 // 0,1 m of 0,01 sec per eenheid — afgeleid, zie boven
  const ruweWaarde = Math.round(work.duration_value * subEenheid)
  return {
    commando: CSAFE_PM_SET_WORKOUTDURATION,
    data: [typeVlag, ...encodeer4ByteWaarde(ruweWaarde, 'MSB_EERST')],
    naam: 'CSAFE_PM_SET_WORKOUTDURATION',
  }
}

/** CSAFE_PM_SET_RESTDURATION (0x04) — bevestigd: 2 databytes, MSB eerst,
 * hele seconden (Table 19 specificeert de limiet zelf al in hele
 * seconden — ":00" tot "9:55" — geen sub-seconde-precisie nodig of
 * gedocumenteerd voor dit commando). Retourneert null bij undefined
 * rest (geen duration_sec) — er is geen waarde om te versturen; de
 * bridge moet in dat geval WORKOUTTYPE_VARIABLE_UNDEFINEDREST_INTERVAL
 * gebruiken (al gezet via encodeerWorkoutType) zonder deze SET-aanroep
 * voor dat specifieke rust-interval. */
export function encodeerRestDuur(rest: RowingPM5RestInterval): CSAFECommando | null {
  if (rest.duration_sec === undefined) return null
  const seconden = Math.round(rest.duration_sec)
  return {
    commando: CSAFE_PM_SET_RESTDURATION,
    data: [(seconden >> 8) & 0xff, seconden & 0xff],
    naam: 'CSAFE_PM_SET_RESTDURATION',
  }
}

/** CSAFE_SETPOWER_CMD (0x34) — bevestigd: byte 0 = watts LSB, byte 1 =
 * watts MSB, byte 2 = eenheid-specifier. CSAFE_POWER_WATTS_0_0 = 0x58
 * (bevestigd uit de eenheid-definitietabel in dezelfde documentatie). */
export function encodeerDoelWatts(watts: number): CSAFECommando {
  const w = Math.round(watts)
  return { commando: CSAFE_SETPOWER_CMD, data: [w & 0xff, (w >> 8) & 0xff, 0x58], naam: 'CSAFE_SETPOWER_CMD' }
}

/** CSAFE_PM_SET_TARGETPACETIME (0x06) — command-ID bevestigd, databyte-
 * formaat NIET. Gooit bewust een fout i.p.v. te gokken. Zie
 * module-commentaar voor de exacte reden. */
export function encodeerDoelPace(_paceSecPer500m: number): never {
  throw new Error(
    'encodeerDoelPace: CSAFE_PM_SET_TARGETPACETIME (0x06) — command-ID bevestigd, '
    + 'maar het exacte databyte-formaat (eenheid/bytelengte/volgorde) kon niet worden '
    + 'gevonden in de beschikbare documentatie. Niet geïmplementeerd i.p.v. giswerk. '
    + 'Vereist verificatie tegen echte PM5-hardware of een aanvullende, vertrouwde bron '
    + 'vóórdat dit veilig gebouwd kan worden.'
  )
}

/** Bouwt de volledige, geordende lijst CSAFE-commando's voor een
 * workout — GEEN BLE-verzending, GEEN frame-encoding, puur de
 * commando+data-inhoud. `target.pace_sec_per_500m` wordt overgeslagen
 * (niet gegooid) als er ook geen watts-target is opgegeven, zodat een
 * workout zonder enig target gewoon door kan; is er ALLEEN een
 * pace-target opgegeven, dan gooit dit een fout — beter dan stilzwijgend
 * een target laten verdwijnen. */
export function genereerCSAFECommandos(request: RowingPM5WorkoutRequest): CSAFECommando[] {
  const commandos: CSAFECommando[] = [encodeerWorkoutType(request.workout_type)]

  for (const interval of request.intervals) {
    if (interval.type === 'work') {
      commandos.push(encodeerWorkoutDuur(interval))
      if (interval.target?.watts !== undefined) {
        commandos.push(encodeerDoelWatts(interval.target.watts))
      }
      if (interval.target?.pace_sec_per_500m !== undefined) {
        encodeerDoelPace(interval.target.pace_sec_per_500m) // gooit altijd — zie functie
      }
    } else {
      const restCommando = encodeerRestDuur(interval)
      if (restCommando) commandos.push(restCommando)
      // undefined rest: geen SET_RESTDURATION-aanroep nodig — de
      // WORKOUTTYPE staat al op VARIABLE_UNDEFINEDREST_INTERVAL.
    }
  }

  return commandos
}
