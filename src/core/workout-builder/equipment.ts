import type { WorkoutEquipment } from './types'

// ── CoachOS Workout Platform — Equipment Engine ──────────────────────────
// Bron: Universal Workout Builder Master Architecture v1.0. Fase 1, stap 5a.
// "Workout Builder weet welk materiaal beschikbaar is. De specialist
// bepaalt daarna hoe dat wordt gebruikt." — deze laag bevat dus GEEN
// sportspecifieke materiaalkennis (geen hardcoded "Rowing heeft een PM5
// nodig"). De aanroeper (Specialist Adapter, latere stap) levert de
// mapping aan; deze Engine past 'm alleen consistent toe.

export interface EquipmentMapping {
  /** Welk materiaal deze sport/trainingType-combinatie normaal gesproken
   * nodig heeft — aangeleverd door de aanroeper, niet hier hardcoded */
  benodigd: string[]
  optioneel?: string[]
}

/** Filtert de benodigde/optionele materiaallijst tegen wat de gebruiker
 * daadwerkelijk beschikbaar heeft (uit Equipment-instellingen). Materiaal
 * dat benodigd is maar niet beschikbaar, verschuift naar een aparte
 * "ontbreekt"-lijst — de aanroeper beslist wat daarmee te doen (bijv.
 * de Alternative Engine inschakelen). */
export interface EquipmentResultaat extends WorkoutEquipment {
  ontbreekt: string[]
}

export function bepaalMateriaal(mapping: EquipmentMapping, beschikbaarMateriaal: string[]): EquipmentResultaat {
  const beschikbaarSet = new Set(beschikbaarMateriaal.map(m => m.toLowerCase()))
  const isBeschikbaar = (item: string) => beschikbaarSet.has(item.toLowerCase())

  const benodigd = mapping.benodigd.filter(isBeschikbaar)
  const ontbreekt = mapping.benodigd.filter(item => !isBeschikbaar(item))
  const optioneel = (mapping.optioneel || []).filter(isBeschikbaar)

  return { benodigd, optioneel, ontbreekt }
}
