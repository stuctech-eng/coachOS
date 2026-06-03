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

export interface DailyCheckin {
  id: string
  user_id: string
  date: string
  feeling_score: number | null
  energy_score: number | null
  stress_score: number | null
  motivation_score: number | null
  soreness_score: number | null
  sleep_quality: number | null
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

export interface CoachMemory {
  id: string
  user_id: string
  memory_type: string
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

export interface OnboardingData {
  first_name: string
  display_name: string
  age: number
  gender: Profile['gender']
  goals: string[]
  available_time: Profile['available_time']
  activities: string[]
}

export interface ActivityMetrics {
  distance?: number
  avg_hr?: number
  max_hr?: number
  elevation?: number
  avg_speed?: number
  calories?: number
  steps?: number
  cadence?: number
}

export interface ActivitySession {
  id: string
  user_id: string
  activity_id: string | null
  date: string
  duration: number
  metrics: ActivityMetrics
  source: 'strava' | 'garmin' | 'manual' | string
  notes: string | null
  created_at: string
}

export interface Activity {
  id: string
  user_id: string
  template_id: string | null
  name: string
  created_at: string
}

export interface ActivityWithSessions extends Activity {
  sessions: ActivitySession[]
}

export interface Injury {
  id: string
  user_id: string
  body_part: string
  pain_score: number | null
  started_at: string | null
  notes: string | null
  active: boolean
  created_at: string
}

export interface LifeEvent {
  id: string
  user_id: string
  type: string
  start_time: string
  end_time: string | null
  recovery_impact: number
  stress_load: number
  sleep_disruption: number
  notes: string | null
  created_at: string
}

export interface DailyStatus {
  id: string
  user_id: string
  date: string
  recovery_score: number | null
  training_score: number | null
  lifestyle_score: number | null
  coach_score: number | null
  energy_score: number | null
  status_color: string | null
  risk_flags: string[]
  created_at: string
}
