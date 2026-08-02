import type { WorkoutTarget } from '@/core/workout-builder/types'
import type { EquipmentMapping } from '@/core/workout-builder/equipment'
import { berekenVermogensZones, type VermogensZone } from './cycling-zones'

// ── Cycling Specialist Adapter (Workout Platform) ────────────────────────
// Bron: overleg 2 augustus 2026 — derde sport gelijkwaardig aan Rowing/
// Running op Workout Platform-niveau, zelfde patroon. Cycling had al een
// gevalideerde FTP-gebaseerde vermogenszone-berekening (Coggan 7-zone-
// model, cycling-zones.ts) — net als Running's VDOT, een échte
// persoonlijke baseline i.p.v. een generiek label.

// Onze 5 generieke Workout Platform-zones → Coggan's 7 vermogenszones.
// Zone 5 kiest VO2max/Anaerobe capaciteit/Neuromusculair afhankelijk van
// trainingType (interval vs. sprint), zelfde aanpak als Running's
// isSprintZone5.
const ZONE_NAAR_COGGAN_NAAM: Record<number, string> = {
  1: 'Actief herstel', 2: 'Duurtraining', 3: 'Tempo', 4: 'Drempel', 5: 'VO2max',
}

export interface CyclingTargetVertaling {
  vermogen_watt?: string // bijv. "180W - 245W", null als geen FTP bekend
}

export function vertaalTarget(target: WorkoutTarget, vermogensZones: VermogensZone[] | null, isSprintZone5 = false): CyclingTargetVertaling {
  if (target.type !== 'zone' || !target.zone_nummer || !vermogensZones) return {}

  const zoneNaam = target.zone_nummer === 5 && isSprintZone5 ? 'Anaerobe capaciteit' : ZONE_NAAR_COGGAN_NAAM[target.zone_nummer]
  const zone = vermogensZones.find(z => z.naam === zoneNaam)
  if (!zone) return {}

  return { vermogen_watt: zone.tot_watt !== null ? `${zone.van_watt}W - ${zone.tot_watt}W` : `${zone.van_watt}W+` }
}

/** Haalt de vermogenszones op, of null als er geen FTP bekend is. Dunne
 * wrapper — hergebruikt berekenVermogensZones() uit cycling-zones.ts,
 * geen nieuwe berekeningen. */
export function haalVermogensZonesVoorGebruiker(ftp: number | null | undefined): VermogensZone[] | null {
  return ftp ? berekenVermogensZones(ftp) : null
}

export const CYCLING_EQUIPMENT_MAPPING: EquipmentMapping = {
  benodigd: [],
  optioneel: ['Vermogensmeter', 'Hartslagband', 'Smart trainer'],
}
