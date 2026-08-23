import type { UniversalWorkout, WorkoutTrainingType } from '@/core/workout-builder/types'
import type { EquipmentMapping } from '@/core/workout-builder/equipment'
import type { KettlebellTrainingRequest } from './kettlebell-training-request'

// ── Kettlebell Specialist Adapter (Workout Platform) — MVP2.5 ───────────
// Bron: Universal Workout Builder Master Architecture v1.0, zelfde patroon
// als cycling-/running-/rowing-workout-adapter.ts. Vertaalrichting hier is
// FORWARD (i.t.t. rowing's vertaalTarget, die UniversalWorkout → sport
// vertaalt): een KettlebellTrainingRequest (het contract uit
// kettlebell-training-request.ts, v2.4.349) → een concrete UniversalWorkout.
// bouwWorkout() zelf blijft ongewijzigd — geen sportlogica daar, exact
// zoals de KERNREGEL in core/workout-builder/types.ts voorschrijft.
//
// EERLIJKE BEPERKING: er bestaat nog geen Kettlebell Training Plan Engine
// (periodisering/mesocyclus-toewijzing per week — spec §23). mesocycle/
// difficulty worden daarom nu vast/via parameter meegegeven, niet
// automatisch bepaald — zelfde aanpak als rowing's `difficulty: 'gemiddeld'`
// (vast, want er bestaat nog geen niveauveld).

export function bepaalTrainingType(request: KettlebellTrainingRequest): WorkoutTrainingType {
  const { technical_focus, competition_specific } = request.core
  if (competition_specific) return 'test' // simuleert de wedstrijdsituatie, spec §18 Competition Simulator
  if (technical_focus === 'pacing') return 'tempo'
  if (technical_focus && ['grip', 'technique', 'breathing', 'fixation', 'lockout'].includes(technical_focus)) return 'techniek'
  return 'endurance'
}

/** Overlegt de generieke, zone-gebaseerde blokken van bouwWorkout() met de
 * specialistische RPM/RPE-targets uit het contract. Voegt GEEN nieuwe
 * blokken toe en verandert de duur niet — enrichment, geen herbouw. */
export function verrijkMetKettlebellContext(workout: UniversalWorkout, request: KettlebellTrainingRequest): UniversalWorkout {
  const { discipline, bell_weight_kg, target_rpm, target_rpe, technical_focus, federation_id } = request.core

  const extraTargets = [
    ...(target_rpm != null ? [{ type: 'rpm' as const, waarde: target_rpm }] : []),
    ...(target_rpe != null ? [{ type: 'rpe' as const, waarde: target_rpe }] : []),
  ]

  const mainBlocksMetTargets = workout.mainBlocks.map(blok => ({
    ...blok,
    targets: extraTargets.length > 0 ? [...blok.targets, ...extraTargets] : blok.targets,
  }))

  return {
    ...workout,
    sport: 'kettlebell',
    discipline,
    mainBlocks: mainBlocksMetTargets,
    equipment: { benodigd: [`Kettlebell ${bell_weight_kg}kg`], optioneel: workout.equipment.optioneel },
    coachNotes: [
      workout.coachNotes,
      technical_focus ? `Focus vandaag: ${technical_focus}.` : null,
      federation_id ? 'Wedstrijdcontext: gekoppeld aan een specifieke federatie-voorkeur.' : null,
    ].filter(Boolean).join(' '),
    adaptations: [...workout.adaptations, ...request.reden],
  }
}

export const KETTLEBELL_EQUIPMENT_MAPPING: EquipmentMapping = {
  benodigd: ['Kettlebell'],
  optioneel: ['Magnesium', 'Polsbandage'],
}

export const KETTLEBELL_TRAININGTYPE_LABEL: Record<WorkoutTrainingType, string> = {
  endurance: 'Duurtraining', interval: 'Intervallen', herstel: 'Herstel',
  lange_afstand: 'Lange sessie', test: 'Wedstrijdsimulatie', tempo: 'Pacing',
  sprint: 'Sprint', techniek: 'Techniek',
}
