import type { WorkoutTarget } from '@/core/workout-builder/types'
import type { EquipmentMapping } from '@/core/workout-builder/equipment'
import { berekenPaceZones, formatteerPace, type PaceZone } from './running-zones'

// ── Running Specialist Adapter (Workout Platform) ────────────────────────
// Bron: overleg 2 augustus 2026 — Running gelijkwaardig aan Rowing op
// Workout Platform-niveau, zelfde patroon als rowing-workout-adapter.ts.
//
// BELANGRIJK VERSCHIL MET ROWING: Running heeft al een échte,
// gevalideerde persoonlijke baseline (VDOT, Daniels/Gilbert-model,
// zie running-zones.ts) — iets wat Rowing nog mist (2k-testtijd nog
// niet gebouwd). Running's vertaling kan daarom een ECHTE pace geven
// (bijv. "4:32/km"), niet alleen een generiek zone-label zoals Rowing's
// SPM-bereik. Als er geen VDOT bekend is (geen recente wedstrijd
// ingevuld), geeft de vertaling eerlijk niets terug — geen gegokte pace.

// Onze 5 generieke Workout Platform-zones → Daniels/Gilbert's 6
// pace-zones. Zone 5 kiest Interval of Repetition afhankelijk van of
// het om een 'interval' of 'sprint' trainingType gaat (aanroeper geeft
// dit mee via het optionele tweede argument).
const ZONE_NAAR_PACENAAM: Record<number, string> = {
  1: 'Recovery', 2: 'Easy', 3: 'Marathon', 4: 'Threshold', 5: 'Interval',
}

export interface RunningTargetVertaling {
  pace?: string // bijv. "4:32/km - 4:48/km", null als geen VDOT bekend
}

export function vertaalTarget(target: WorkoutTarget, paceZones: PaceZone[] | null, isSprintZone5 = false): RunningTargetVertaling {
  if (target.type !== 'zone' || !target.zone_nummer || !paceZones) return {}

  const paceNaam = target.zone_nummer === 5 && isSprintZone5 ? 'Repetition' : ZONE_NAAR_PACENAAM[target.zone_nummer]
  const zone = paceZones.find(z => z.naam === paceNaam)
  if (!zone) return {}

  return { pace: `${formatteerPace(zone.pace_tot_sec_per_km)}/km - ${formatteerPace(zone.pace_van_sec_per_km)}/km` }
}

/** Haalt de pace-zones op voor een gebruiker, of null als er geen VDOT-
 * baseline bekend is. Dunne wrapper — hergebruikt berekenVDOT/
 * berekenPaceZones uit running-zones.ts, geen nieuwe berekeningen. */
export function haalPaceZonesVoorGebruiker(vdot: number | null): PaceZone[] | null {
  return vdot !== null ? berekenPaceZones(vdot) : null
}

export const RUNNING_EQUIPMENT_MAPPING: EquipmentMapping = {
  benodigd: [], // hardlopen vergt geen verplicht materiaal
  optioneel: ['Hartslagband', 'GPS-horloge'],
}
