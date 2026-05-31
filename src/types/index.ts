export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Profile {
  id: string
  user_id: string
  first_name: string | null
  display_name: string | null
  age: number | null
  height: number | null
  weight: number | null
  gender: 'man' | 'vrouw' | 'anders' | 'zeg ik liever niet' | null
  experience_level: 'beginner' | 'gemiddeld' | 'gevorderd' | null
  available_time: '15min' | '30min' | '60min' | 'flexibel' | null
  injury_history: string | null
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

export interface UserGoal {
  id: string
  user_id: string
  goal_type: string
  title: string
  priority: number
  target_value: number | null
  current_value: number | null
  target_date: string | null
  status: 'active' | 'completed' | 'paused' | 'cancelled'
  created_at: string
}

export type ActivityCategory = 'cardio' | 'strength' | 'mobility' | 'recovery' | 'mindfulness' | 'sport' | 'overig'

export interface ActivityTemplate {
  id: string
  name: string
  category: ActivityCategory
  description: string | null
  metrics: string[]
  coaching_rules: string[]
  recovery_impact: number
  strength_factor: number
  fitness_factor: number
  is_system: boolean
  created_at: string
}

export interface Activity {
  id: string
  user_id: string
  template_id: string | null
  name: string
  notes: string | null
  is_active: boolean
  created_at: string
  template?: ActivityTemplate
}

export interface ActivitySession {
  id: string
  user_id: string
  activity_id: string | null
  date: string
  duration: number | null
  metrics: Record<string, unknown>
  rpe: number | null
  notes: string | null
  source: 'manual' | 'garmin' | 'apple_health' | 'strava'
  created_at: string
}

export interface DailyCheckin {
  id: string
  user_id: string
  date: string
  feeling_score: number | null
  energy_score: number | null
  has_pain: boolean
  pain_description: string | null
  notes: string | null
  created_at: string
}

export interface HealthMetrics {
  id: string
  user_id: string
  date: string
  weight: number | null
  resting_hr: number | null
  hrv: number | null
  sleep_score: number | null
  sleep_duration: number | null
  stress_score: number | null
  body_battery: number | null
  vo2max: number | null
  calories_burned: number | null
  steps: number | null
  source: string
  created_at: string
}

export type StatusColor = 'green' | 'orange' | 'red'

export interface DailyStatus {
  id: string
  user_id: string
  date: string
  recovery_score: number | null
  energy_score: number | null
  fitness_score: number | null
  health_score: number | null
  risk_score: number | null
  status_color: StatusColor | null
  created_at: string
}

export interface CoachMemory {
  id: string
  user_id: string
  memory_type: 'injury' | 'preference' | 'pattern' | 'achievement' | 'warning'
  content: string
  confidence: number | null
  created_at: string
  updated_at: string
}

export interface CoachRecommendation {
  id: string
  user_id: string
  date: string
  recommendation: string
  reasoning: string | null
  recovery_status: string | null
  energy_level: number | null
  created_at: string
}

export interface CoachInsight {
  id: string
  user_id: string
  title: string
  insight: string
  confidence: number | null
  status: 'active' | 'revised' | 'archived'
  version: number
  created_at: string
  updated_at: string
}

export interface KnowledgeObservation {
  id: string
  user_id: string
  observation: string
  confidence: number | null
  source: string | null
  created_at: string
}

export interface AIConversation {
  id: string
  user_id: string
  role: 'user' | 'assistant' | 'system'
  message: string
  context: Record<string, unknown>
  created_at: string
}

export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AIProvider {
  name: string
  generateResponse(messages: AIMessage[], systemPrompt?: string): Promise<string>
}

export interface OnboardingData {
  first_name: string
  display_name: string
  age: number
  gender: Profile['gender']
  goals: string[]
  available_time: Profile['available_time']
  activities: string[]
}

export const GOAL_TYPES = {
  conditie: 'Betere conditie',
  kracht: 'Sterker worden',
  afvallen: 'Afvallen',
  energie: 'Meer energie',
  gezondheid: 'Gezond ouder worden',
  slaap: 'Beter slapen',
  marathon: 'Marathon lopen',
  custom: 'Eigen doel',
} as const

export type GoalType = keyof typeof GOAL_TYPES
