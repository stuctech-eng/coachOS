-- ============================================
-- COACHOS DATABASE SCHEMA V1.0
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES
-- ============================================
CREATE TABLE profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  first_name TEXT,
  display_name TEXT,
  age INTEGER,
  height INTEGER, -- cm
  weight DECIMAL(5,2), -- kg
  gender TEXT CHECK (gender IN ('man', 'vrouw', 'anders', 'zeg ik liever niet')),
  experience_level TEXT CHECK (experience_level IN ('beginner', 'gemiddeld', 'gevorderd')),
  available_time TEXT CHECK (available_time IN ('15min', '30min', '60min', 'flexibel')),
  injury_history TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USER GOALS
-- ============================================
CREATE TABLE user_goals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  goal_type TEXT NOT NULL,
  title TEXT NOT NULL,
  priority INTEGER DEFAULT 1,
  target_value DECIMAL,
  current_value DECIMAL,
  target_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ACTIVITY TEMPLATES
-- ============================================
CREATE TABLE activity_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('cardio', 'strength', 'mobility', 'recovery', 'mindfulness', 'sport', 'overig')),
  description TEXT,
  metrics JSONB DEFAULT '[]', -- ["weight", "reps", "sets", "duration", "distance", "rpe"]
  coaching_rules JSONB DEFAULT '[]',
  recovery_impact INTEGER DEFAULT 5 CHECK (recovery_impact BETWEEN 1 AND 10),
  strength_factor DECIMAL(3,2) DEFAULT 0,
  fitness_factor DECIMAL(3,2) DEFAULT 0,
  is_system BOOLEAN DEFAULT TRUE, -- false = user created
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ACTIVITIES (user's personal activity list)
-- ============================================
CREATE TABLE activities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES activity_templates(id),
  name TEXT NOT NULL,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ACTIVITY SESSIONS
-- ============================================
CREATE TABLE activity_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  activity_id UUID REFERENCES activities(id),
  date DATE NOT NULL,
  duration INTEGER, -- minutes
  metrics JSONB DEFAULT '{}', -- flexible: {weight: 20, reps: 10, sets: 3}
  rpe INTEGER CHECK (rpe BETWEEN 1 AND 10),
  notes TEXT,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'garmin', 'apple_health', 'strava')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DAILY CHECK-INS
-- ============================================
CREATE TABLE daily_checkins (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  feeling_score INTEGER CHECK (feeling_score BETWEEN 1 AND 10),
  energy_score INTEGER CHECK (energy_score BETWEEN 1 AND 10),
  has_pain BOOLEAN DEFAULT FALSE,
  pain_description TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- ============================================
-- HEALTH METRICS (from Garmin, Apple Health, manual)
-- ============================================
CREATE TABLE health_metrics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  weight DECIMAL(5,2),
  resting_hr INTEGER,
  hrv DECIMAL(6,2),
  sleep_score INTEGER,
  sleep_duration INTEGER, -- minutes
  stress_score INTEGER,
  body_battery INTEGER,
  vo2max DECIMAL(5,2),
  calories_burned INTEGER,
  steps INTEGER,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- ============================================
-- DAILY STATUS (cached computed scores)
-- ============================================
CREATE TABLE daily_status (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  recovery_score INTEGER,
  energy_score INTEGER,
  fitness_score INTEGER,
  health_score INTEGER,
  risk_score INTEGER,
  status_color TEXT CHECK (status_color IN ('green', 'orange', 'red')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- ============================================
-- COACH MEMORY
-- ============================================
CREATE TABLE coach_memory (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  memory_type TEXT NOT NULL, -- 'injury', 'preference', 'pattern', 'achievement', 'warning'
  content TEXT NOT NULL,
  confidence DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- COACH RECOMMENDATIONS
-- ============================================
CREATE TABLE coach_recommendations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  recommendation TEXT NOT NULL,
  reasoning TEXT,
  recovery_status TEXT,
  energy_level INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- ============================================
-- COACH INSIGHTS (versioned)
-- ============================================
CREATE TABLE coach_insights (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  insight TEXT NOT NULL,
  confidence DECIMAL(5,2),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'revised', 'archived')),
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- KNOWLEDGE OBSERVATIONS
-- ============================================
CREATE TABLE knowledge_observations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  observation TEXT NOT NULL,
  confidence DECIMAL(5,2),
  source TEXT, -- 'garmin', 'checkin', 'pattern', 'manual'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AI CONVERSATIONS
-- ============================================
CREATE TABLE ai_conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

-- Policies: users can only access their own data
CREATE POLICY "Users own data" ON profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON user_goals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON activities FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON activity_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON daily_checkins FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON health_metrics FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON daily_status FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON coach_memory FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON coach_recommendations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON coach_insights FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON knowledge_observations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON ai_conversations FOR ALL USING (auth.uid() = user_id);

-- Activity templates: readable by all authenticated users
ALTER TABLE activity_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Templates readable by all" ON activity_templates FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- DEFAULT ACTIVITY TEMPLATES
-- ============================================
INSERT INTO activity_templates (name, category, metrics, coaching_rules, recovery_impact, strength_factor, fitness_factor) VALUES
('Wandelen', 'cardio', '["duration", "distance", "steps"]', '["consistent_pace", "daily_habit"]', 2, 0.1, 0.3),
('Hardlopen', 'cardio', '["duration", "distance", "pace", "hr"]', '["progressive_overload", "recovery_monitoring"]', 6, 0.2, 0.8),
('Fietsen', 'cardio', '["duration", "distance", "speed", "elevation", "hr"]', '["zone_training", "recovery_monitoring"]', 5, 0.2, 0.7),
('Kettlebell', 'strength', '["weight", "reps", "sets", "duration", "rpe"]', '["progressive_overload", "technique_monitoring", "recovery_monitoring"]', 7, 0.9, 0.4),
('Krachttraining', 'strength', '["weight", "reps", "sets", "rpe"]', '["progressive_overload", "technique_monitoring"]', 7, 1.0, 0.3),
('Yoga', 'mobility', '["duration", "type"]', '["consistency", "breath_awareness"]', 2, 0.1, 0.2),
('Zwemmen', 'cardio', '["duration", "distance", "laps"]', '["zone_training", "technique_monitoring"]', 4, 0.3, 0.7),
('Mobiliteit', 'mobility', '["duration"]', '["daily_habit", "consistency"]', 1, 0.1, 0.1),
('Meditatie', 'mindfulness', '["duration"]', '["consistency", "stress_reduction"]', 1, 0.0, 0.0),
('Padel', 'sport', '["duration", "sets_played"]', '["recovery_monitoring"]', 5, 0.3, 0.5),
('Tennis', 'sport', '["duration", "sets_played"]', '["recovery_monitoring"]', 5, 0.3, 0.5),
('Roeien', 'cardio', '["duration", "distance", "strokes", "hr"]', '["zone_training", "technique_monitoring"]', 6, 0.5, 0.7),
('CrossFit', 'strength', '["duration", "rpe", "wod_name"]', '["progressive_overload", "recovery_monitoring"]', 9, 0.8, 0.7),
('Boksen', 'sport', '["duration", "rounds", "rpe"]', '["recovery_monitoring", "technique_monitoring"]', 7, 0.5, 0.6),
('Klimmen', 'sport', '["duration", "routes", "grade"]', '["technique_monitoring", "recovery_monitoring"]', 6, 0.7, 0.4);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_coach_memory_updated_at BEFORE UPDATE ON coach_memory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_coach_insights_updated_at BEFORE UPDATE ON coach_insights FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
