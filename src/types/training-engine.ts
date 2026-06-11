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
}

export interface RowingSegment {
  type: 'rowing'
  segment_type: 'warmup' | 'steady' | 'interval' | 'sprint' | 'cooldown'
  duration_min: number
  target_intensity: 'recovery' | 'aerobic' | 'threshold' | 'max'
  stroke_rate?: number   // SPM
  instruction: string
  cue: string
}

export interface RunningSegment {
  type: 'running'
  segment_type: 'warmup' | 'easy' | 'tempo' | 'interval' | 'hill' | 'cooldown'
  duration_min: number
  distance_km?: number
  target_zone: 1 | 2 | 3 | 4 | 5  // hartslag zones
  instruction: string
  cue: string
}

export interface CyclingSegment {
  type: 'cycling'
  segment_type: 'warmup' | 'easy' | 'tempo' | 'interval' | 'hill' | 'cooldown'
  duration_min: number
  target_zone: 1 | 2 | 3 | 4 | 5
  instruction: string
  cue: string
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

export interface LiveSessionState {
  session_id: string
  module: TrainingModule
  status: SessionStatus
  schema: TrainingSchema
  started_at: string     // ISO timestamp
  current_segment: number
  completed_segments: number[]
  elapsed_seconds: number
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
}

// ─── localStorage key ─────────────────────────────────────────────────────────

export const SESSION_STORAGE_KEY = 'coachos_active_session'
