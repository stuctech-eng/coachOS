// ─── Universal Training Engine Types ──────────────────────────────────────────
// Geldt voor ALLE sportmodules: kettlebell, rowing, running, cycling, strength, bodyweight

export type TrainingModule =
  | 'kettlebell'
  | 'rowing'
  | 'running'
  | 'cycling'
  | 'strength'
  | 'bodyweight'

export type SessionStatus =
  | 'schema'      // Schema Layer: Trainer AI plan tonen
  | 'learning'    // Learning Layer: uitleg per oefening
  | 'workout'     // Workout Engine: live uitvoering
  | 'evaluation'  // Evaluatie Layer: feedback na training
  | 'completed'   // Klaar, opgeslagen in Supabase

export type Intensity = 'light' | 'medium' | 'heavy'

// ─── Schema Layer ────────────────────────────────────────────────────────────

export interface TrainingSchema {
  module: TrainingModule
  title: string
  duration: number       // minuten
  intensity: Intensity
  segments: TrainingSegment[]
  coach_message: string
}

// ─── Segments (sport-specifiek) ───────────────────────────────────────────────

export type TrainingSegment =
  | KettlebellSegment
  | RowingSegment
  | RunningSegment
  | CyclingSegment
  | StrengthSegment
  | BodyweightSegment

export interface KettlebellSegment {
  type: 'kettlebell'
  exercise: string       // naam van de oefening
  sets: number
  reps: number | null    // null = tijdgebaseerd
  duration_sec: number | null // null = rep-gebaseerd
  rest_sec: number
  level: 1 | 2 | 3
  // Learning Layer
  instruction: string    // techniek uitleg
  cue: string           // korte cue tijdens uitvoering
  common_errors: string[]
  // Equipment (V5.5 voorbereiding voor alle modules)
  equipment_required?: string[]
}

export interface RowingSegment {
  type: 'rowing'
  exercise: string        // bijv. "500m Interval" / "Steady State" — toon-naam in engine
  session_type: 'recovery' | 'endurance' | 'tempo' | 'interval' | 'sprint' | 'test'
  sets: number             // aantal herhalingen (intervallen). 1 voor steady/test
  reps: number | null      // ongebruikt voor rowing — altijd null
  duration_sec: number | null // afgeleide actieve tijd (uit duration of distance+split)
  rest_sec: number
  // Rowing-specifieke targets (optioneel, voor weergave)
  distance_m?: number       // bijv. 500
  target_split?: string     // bijv. "2:05" per 500m
  target_spm?: number       // strokes per minute
  target_hr_zone?: string   // bijv. "Zone 2"
  // Learning Layer
  instruction: string
  cue: string
  common_errors: string[]
  // Equipment (V5.5 voorbereiding voor alle modules)
  equipment_required?: string[]
}

export interface RunningSegment {
  type: 'running'
  exercise: string        // bijv. "5km Steady Run" / "6x400m Interval"
  session_type: 'recovery' | 'endurance' | 'tempo' | 'interval' | 'sprint' | 'test'
  sets: number             // aantal herhalingen (intervallen). 1 voor steady/test
  reps: number | null      // ongebruikt voor running — altijd null
  duration_sec: number | null // actieve tijd per set/interval
  rest_sec: number
  // Running-specifieke targets (optioneel, voor weergave)
  distance_m?: number       // bijv. 400 of 5000
  target_pace?: string      // bijv. "5:30/km"
  target_speed_kmh?: number // bijv. 10.5
  target_hr_zone?: string   // bijv. "Zone 2"
  // Learning Layer
  instruction: string
  cue: string
  common_errors: string[]
  // Equipment (V5.5+ voorbereiding voor alle modules)
  equipment_required?: string[]
}

export interface CyclingSegment {
  type: 'cycling'
  exercise: string        // bijv. "20 min FTP-test" / "6×5 min Interval"
  session_type: 'recovery' | 'endurance' | 'tempo' | 'interval' | 'sprint' | 'test'
  sets: number             // 1 voor steady/test, meer voor intervallen
  reps: number | null      // altijd null
  duration_sec: number | null
  rest_sec: number
  // Cycling-specifieke targets (optioneel)
  distance_m?: number
  target_power_w?: number   // watt — primaire cycling metriek
  target_cadence_rpm?: number
  target_speed_kmh?: number
  target_hr_zone?: string   // bijv. "Zone 2"
  // Learning Layer
  instruction: string
  cue: string
  common_errors: string[]
  equipment_required?: string[]
}

export interface StrengthSegment {
  type: 'strength'
  exercise: string
  sets: number
  reps: number
  weight_kg?: number
  rest_sec: number
  instruction: string
  cue: string
  common_errors: string[]
}

export interface BodyweightSegment {
  type: 'bodyweight'
  exercise: string
  sets: number
  reps: number | null
  duration_sec: number | null
  rest_sec: number
  instruction: string
  cue: string
}

// ─── Live Session State (localStorage) ───────────────────────────────────────

// ─── Trainingsbron (v5.5.1) ────────────────────────────────────────────────────
// Bepaalt waar een trainingssessie vandaan kwam. Wordt opgeslagen op elke
// training_results rij zodat Performance AI/Progressie/Coach AI onderscheid
// kunnen maken zonder de analyses te splitsen — alles telt mee.
export type TrainingSource =
  | 'coach_plan'  // "Vandaag voor jou" — Coach AI's dagadvies
  | 'library'     // Trainingsbibliotheek — gebruiker koos zelf een module
  | 'manual'      // toekomstig: handmatig ingevoerde training
  | 'imported'    // toekomstig: Strava/Concept2 import

export interface LiveSessionState {
  session_id: string
  module: TrainingModule
  status: SessionStatus
  schema: TrainingSchema
  started_at: string     // ISO timestamp
  current_segment: number
  completed_segments: number[]
  elapsed_seconds: number
  training_source: TrainingSource
  // Evaluatie
  result?: SessionResult
}

// ─── Session Result (Supabase) ────────────────────────────────────────────────

export interface SessionResult {
  rating: number | null
  perceived_effort: number | null
  fatigue_after: number | null
  soreness: number | null
  notes: string | null
  actual_duration: number | null
  completed: boolean
  // Rowing-specifieke evaluatie (V5.5, optioneel)
  rowing_technique_rating?: number | null
  rowing_pacing_rating?: number | null
  rowing_fatigue_rating?: number | null
  // Running-specifieke evaluatie (V5.6, optioneel)
  running_technique_rating?: number | null
  running_pacing_rating?: number | null
  running_fatigue_rating?: number | null
  running_rpe_rating?: number | null
  // Cycling-specifieke evaluatie (V5.7, optioneel)
  cycling_technique_rating?: number | null
  cycling_pacing_rating?: number | null
  cycling_fatigue_rating?: number | null
  cycling_rpe_rating?: number | null
}

// ─── localStorage key ─────────────────────────────────────────────────────────

export const SESSION_STORAGE_KEY = 'coachos_active_session'
