// ─── Equipment ↔ Module mapping ───────────────────────────────────────────────
// Bepaalt of een trainingsmodule beschikbaar is op basis van het equipment profiel.
// Wordt gebruikt door: Training tab (UI gating) en Trainer AI (generatie gating).

import type { TrainingModule } from '@/types/training-engine'
import type { EquipmentProfile } from '@/app/api/equipment/route'

export interface ModuleAvailability {
  available: boolean
  label: string          // weergavenaam module
  missingLabel: string   // bijv. "Concept2 roeier"
}

const MODULE_INFO: Record<TrainingModule, { label: string; missingLabel: string }> = {
  kettlebell: { label: 'Kettlebell', missingLabel: 'Kettlebell' },
  rowing: { label: 'Rowing', missingLabel: 'Concept2 roeier' },
  cycling: { label: 'Cycling', missingLabel: 'Hometrainer / fiets' },
  running: { label: 'Hardlopen', missingLabel: 'Hardloop equipment' },
  strength: { label: 'Kracht', missingLabel: 'Dumbbells of barbell' },
  bodyweight: { label: 'Bodyweight', missingLabel: 'Bodyweight' },
}

/**
 * Bepaalt of een module beschikbaar is op basis van het equipment profiel.
 *
 * Mapping:
 * - kettlebell  → kettlebell_available
 * - rowing      → concept2_available
 * - cycling     → cycling_available
 * - running     → running_available
 * - strength    → dumbbell_available OR barbell_available
 * - bodyweight  → altijd true
 */
export function isModuleAvailable(module: TrainingModule, equipment: Partial<EquipmentProfile> | null | undefined): boolean {
  if (!equipment) return module === 'bodyweight'

  switch (module) {
    case 'kettlebell':
      return !!equipment.kettlebell_available
    case 'rowing':
      return !!equipment.concept2_available
    case 'cycling':
      return !!equipment.cycling_available
    case 'running':
      return !!equipment.running_available
    case 'strength':
      return !!(equipment.dumbbell_available || equipment.barbell_available)
    case 'bodyweight':
      return true
    default:
      return false
  }
}

export function getModuleAvailability(module: TrainingModule, equipment: Partial<EquipmentProfile> | null | undefined): ModuleAvailability {
  const info = MODULE_INFO[module]
  return {
    available: isModuleAvailable(module, equipment),
    label: info.label,
    missingLabel: info.missingLabel,
  }
}

/**
 * Filtert een lijst van mogelijke modules naar alleen de modules die beschikbaar zijn.
 * Gebruikt door Trainer AI om te bepalen welke training types gegenereerd mogen worden.
 */
export function getAvailableModules(equipment: Partial<EquipmentProfile> | null | undefined): TrainingModule[] {
  const all: TrainingModule[] = ['kettlebell', 'rowing', 'cycling', 'running', 'strength', 'bodyweight']
  return all.filter(m => isModuleAvailable(m, equipment))
}
