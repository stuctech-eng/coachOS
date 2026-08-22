// ── Kettlebell Specialist → Universal Workout Builder — Contract ────────
// Bron: gebruikersverduidelijking 22 augustus 2026 ("leg de brug nu al
// vast als contract/interface, ook al bouw je 'm pas in MVP2.5"). Dit
// bestand bevat UITSLUITEND het datacontract — GEEN adapter-logica, geen
// aanroep van bouwWorkout(). De daadwerkelijke vertaling naar
// WorkoutBuilderInput (core/workout-builder/builder.ts) volgt in MVP2.5,
// zodra Federatie/Classificatie (MVP2) en de eerste Analysis-signalen
// bestaan om deze velden zinvol te vullen.
//
// Waarom nu al vastleggen: voorkomt dat de Trainer AI-koppeling later
// opnieuw ontworpen moet worden. Velden zijn bewust uitlijnbaar op het
// bestaande Universal Workout Builder-vocabulaire
// (core/workout-builder/types.ts): WorkoutTarget kent al 'rpm' en 'rpe'
// als TargetType, WorkoutBlockType kent al 'techniek' — dit contract
// dupliceert dat vocabulaire dus niet, het hergebruikt de namen.

import type { KettlebellDiscipline } from './kettlebell-data'

/** Vaste, MVP1/MVP2-bekende velden — door de Specialist bepaald op basis
 * van profiel/doel/federatie, altijd aanwezig zodra de brug (MVP2.5)
 * gebruikt wordt. */
export interface KettlebellTrainingRequestCore {
  discipline: KettlebellDiscipline
  bell_weight_kg: number
  duration_sec: number
  target_rpm?: number
  target_rpe?: number
  /** Vrije, maar beperkte set — sluit aan op WorkoutBlockType/spec §15
   * (techniek als aparte laag t.o.v. performance). */
  technical_focus?: 'pacing' | 'grip' | 'technique' | 'breathing' | 'fixation' | 'lockout'
  /** True zodra een wedstrijd/classificatie de aanleiding is (MVP2) —
   * bepaalt bijv. of de sessie een volledige wedstrijdduur simuleert. */
  competition_specific: boolean
  /** Puur informatief zolang MVP2 niet actief is — welke regelset-
   * context van toepassing is, indien de gebruiker die gekozen heeft. */
  federation_id?: string
}

/** Optionele, MVP3-velden — pas te vullen zodra Limiter Engine/Fatigue
 * Signature/Pace Coach bestaan. Bewust een apart, optioneel blok i.p.v.
 * nu al verplichte velden die niemand kan invullen — voorkomt dat MVP2.5
 * moet wachten op MVP3 om te kunnen bouwen. */
export interface KettlebellTrainingRequestIntelligence {
  limiter?: 'maximal_strength' | 'strength_endurance' | 'power' | 'aerobic_capacity'
    | 'anaerobic_capacity' | 'grip' | 'local_muscular_endurance' | 'technique'
    | 'pacing' | 'breathing' | 'recovery' | 'mental_tolerance' | 'competition_experience'
  fatigue_point_sec?: number
  recommended_rpm?: number
}

/** Het volledige contract dat de Kettlebell Specialist aan de Universal
 * Workout Builder levert. `intelligence` is optioneel en mag in MVP2.5
 * volledig afwezig zijn — de brug moet ook zonder MVP3-data werken. */
export interface KettlebellTrainingRequest {
  core: KettlebellTrainingRequestCore
  intelligence?: KettlebellTrainingRequestIntelligence
  /** Verplicht, net als bij elke Analysis/Decision-laag in dit platform
   * (specialist-engine-architecture.md) — waarom deze parameters, niet
   * alleen wélke. */
  reden: string[]
}
