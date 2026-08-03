// ── CoachOS Workout Platform — Universal Workout Object ─────────────────
// Bron: Universal Workout Builder Master Architecture v1.0, vastgelegd
// 1 augustus 2026. Fase 1, stap 1: alleen het datamodel — nog GEEN
// logica (Builder/Validation/Adaptation-Engines volgen als aparte,
// latere stappen).
//
// KERNREGEL, niet-onderhandelbaar: dit bestand bevat NOOIT sportlogica
// (geen FTP/SPM/pace-kennis, geen sportnamen in de types zelf waar dat
// vermeden kan worden). Dat hoort uitsluitend bij de Specialist Adapter
// (later, per sport). Dit is de sport-ONAFHANKELIJKE basis.
//
// Rowing wordt de eerste, referentie-implementatie (Fase 2) — Cycling/
// Running blijven ongewijzigd tot een latere, evaluatie-gedreven
// migratiebeslissing (Fase 3/4, geen automatisme).

/** Universele targettypen — geen sportspecifieke namen. De Specialist
 * Adapter vertaalt dit naar de eigen taal (bijv. TargetType.pace →
 * "5:30 min/km" bij Running, "2:05/500m split" bij Rowing). */
export type TargetType =
  | 'heart_rate' | 'power' | 'cadence' | 'pace' | 'speed'
  | 'stroke_rate' | 'rpm' | 'rpe' | 'ftp_percentage' | 'critical_power_percentage' | 'zone'

export interface WorkoutTarget {
  type: TargetType
  /** Absolute waarde (bijv. 150 voor heart_rate, 250 voor power) —
   * eenheid is sport-afhankelijk, de Specialist Adapter kent de context */
  waarde?: number
  /** Bereik i.p.v. een vaste waarde, bijv. voor een zone (120-140 bpm) */
  van?: number
  tot?: number
  /** Voor 'zone': welk zone-nummer (1-5 gebruikelijk) */
  zone_nummer?: number
}

/** Elk blok in een workout is van één van deze typen. */
export type WorkoutBlockType =
  | 'warmup' | 'hoofdblok' | 'interval' | 'herstel' | 'techniek'
  | 'cadans' | 'mobiliteit' | 'cooldown'

export interface WorkoutBlock {
  id: string
  type: WorkoutBlockType
  /** In seconden — consistent met de rest van CoachOS (nooit minuten
   * op dit datamodel-niveau, voorkomt eenheidsverwarring zoals we
   * eerder tegenkwamen bij Concept2/Strava se duration-velden) */
  duration_sec: number
  /** In meters, optioneel (niet elke sport/blok werkt met afstand) */
  distance_m?: number
  /** Voor herhaalde blokken (bijv. 5× 1000m) — repeat=5 betekent dit
   * blok wordt 5 keer uitgevoerd, met rust_na_repeat_sec ertussen */
  repeat?: number
  rust_na_repeat_sec?: number
  targets: WorkoutTarget[]
  /** Korte, concrete uitvoeringsinstructie (bijv. "Rustig starten,
   * cadans stabiel houden") — geen AI-tekst, vooraf gedefinieerd of
   * door de Adaptation Engine gekozen, nooit door AI verzonnen */
  instruction: string
  /** Optioneel: een warmere, persoonlijkere coach-boodschap voor dit
   * blok specifiek — mag WEL door AI worden geschreven (AI schrijft
   * coachnotes, nooit de trainingsstructuur zelf) */
  coachMessage?: string
}

export type WorkoutTrainingType = 'endurance' | 'interval' | 'herstel' | 'lange_afstand' | 'test' | 'tempo' | 'sprint' | 'techniek'
export type WorkoutExecutionType = 'FixedDistance' | 'FixedTime' | 'FixedDistanceInterval' | 'FixedTimeInterval' | 'VariableInterval' | 'JustGo'
export type WorkoutMesocycle = 'basis' | 'opbouw' | 'piek' | 'herstel'
export type WorkoutDifficulty = 'beginner' | 'gemiddeld' | 'gevorderd'

/** Verwachte belasting, vooraf berekend — wordt na afloop vergeleken
 * met de werkelijke uitvoering (Performance Platform). */
export interface WorkoutMetrics {
  estimatedTSS?: number
  estimatedTRIMP?: number
  estimatedCalories?: number
}

/** Welk materiaal nodig is — de Specialist Adapter bepaalt HOE dat
 * materiaal gebruikt wordt, deze laag weet alleen WAT nodig is. */
export interface WorkoutEquipment {
  benodigd: string[]
  optioneel?: string[]
}

/** Het centrale, sport-onafhankelijke object. Elke Specialist Adapter
 * ontvangt dit en vertaalt het naar zijn eigen sport (Rowing: split/
 * SPM/power; Running: pace/cadans/zones; Cycling: FTP/power/cadence). */
export interface UniversalWorkout {
  id: string
  sport: string
  discipline?: string
  goal: string
  difficulty: WorkoutDifficulty
  mesocycle: WorkoutMesocycle
  trainingType: WorkoutTrainingType
  executionType: WorkoutExecutionType
  duration_sec: number
  distance_m?: number

  warmup: WorkoutBlock[]
  mainBlocks: WorkoutBlock[]
  recoveryBlocks: WorkoutBlock[]
  cooldown: WorkoutBlock[]
  mobility?: WorkoutBlock[]

  /** Algemene targets voor de hele workout (naast per-blok-targets) */
  targets: WorkoutTarget[]
  coachNotes: string
  executionHints: string[]
  equipment: WorkoutEquipment
  metrics: WorkoutMetrics

  /** Door de Adaptation Engine toegepaste wijzigingen — voor
   * transparantie ("waarom ziet mijn training er zo uit"), zelfde
   * principe als REASON_CODE_UITLEG in de Training Plan Engine */
  adaptations: string[]
  /** v2.4.247: gestructureerde bron als de workout is aangepast door
   * een ANDERE sport (Universal Athlete Platform-koppeling) — apart
   * van de tekst-adaptations, zodat de UI een icoon kan tonen zonder
   * tekst te hoeven parsen (bijv. "🚣 Beïnvloed door roeien"). */
  kruisSportBron?: string
  /** Alternatieve workouts bij bijv. slecht weer of geen materiaal —
   * elk alternatief is zelf ook een (verwijzing naar een) UniversalWorkout */
  alternatives?: { reden: string; workout_id: string }[]
}
