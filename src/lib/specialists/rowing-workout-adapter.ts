import type { WorkoutTarget } from '@/core/workout-builder/types'
import type { EquipmentMapping } from '@/core/workout-builder/equipment'

// ── Rowing Specialist Adapter (Workout Platform) ─────────────────────────
// Bron: Universal Workout Builder Master Architecture v1.0, Fase 2 —
// Rowing als referentie-implementatie. Vertaalt het sport-onafhankelijke
// UniversalWorkout naar roeispecifieke taal: Split, SPM, Power (vision-
// citaat: "Rowing → Split, SPM, Power").
//
// EERLIJKE BEPERKING: alleen SPM (stroke rate) kan nu vertaald worden —
// dat vergt geen persoonlijke baseline. Split en Power VEREISEN een
// 2k-testtijd-gebaseerd referentiepunt ("FTP-equivalent voor roeien" uit
// de Rowing Master Vision), dat is bewust nog niet gebouwd (zie
// settings/rowing-profile — bewust minimaal gehouden). Split/power-
// targets geven daarom nu `null` terug i.p.v. een verzonnen waarde.

export interface RowingTargetVertaling {
  spm?: { van: number; tot: number }
  split?: string // null totdat er een 2k-baseline is
  power_watt?: { van: number; tot: number } // null totdat er een 2k-baseline is
}

// Stroke rate-bereik per zone — generieke, breed geaccepteerde
// vuistregels uit de roeiwereld, geen persoonlijke baseline nodig
// (in tegenstelling tot split/power, die wel een 2k-referentie vergen).
const ZONE_SPM: Record<number, { van: number; tot: number }> = {
  1: { van: 16, tot: 20 },
  2: { van: 20, tot: 24 },
  3: { van: 24, tot: 28 },
  4: { van: 28, tot: 32 },
  5: { van: 32, tot: 38 },
}

export function vertaalTarget(target: WorkoutTarget): RowingTargetVertaling {
  if (target.type === 'zone' && target.zone_nummer && ZONE_SPM[target.zone_nummer]) {
    return { spm: ZONE_SPM[target.zone_nummer] }
  }
  // Overige targettypen (heart_rate/power/pace/etc.) — geen roei-
  // specifieke vertaling voor nu, geeft bewust niets terug i.p.v. te gokken
  return {}
}

/** Materiaal dat een gemiddelde roeisessie nodig heeft. Generiek genoeg
 * gehouden (geen "PM5" hardcoded — dat is een specifiek merk/model,
 * "Concept2" dekt de bestaande Equipment-instelling exact). */
export const ROWING_EQUIPMENT_MAPPING: EquipmentMapping = {
  benodigd: ['Concept2'],
  optioneel: ['Hartslagband'],
}

/** Korte, leesbare labels voor de vier bewuste, minimale sessietypen
 * die de Training Plan Engine's rowing-adapter al gebruikt — zelfde
 * vocabulaire, geen nieuwe parallelle lijst. */
export const ROWING_TRAININGTYPE_LABEL: Record<string, string> = {
  endurance: 'Duurtraining', interval: 'Intervallen', recovery: 'Herstel',
  lange_afstand: 'Lange afstand', test: 'Test',
}
