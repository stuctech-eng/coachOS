-- COACHOS DATABASE SCHEMA V1.1

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  first_name TEXT, display_name TEXT, age INTEGER, height INTEGER,
  weight DECIMAL(5,2), gender TEXT, experience_level TEXT,
  available_time TEXT, injury_history TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_goals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  goal_type TEXT NOT NULL, title TEXT NOT NULL, priority INTEGER DEFAULT 1,
  target_value DECIMAL, current_value DECIMAL, target_date DATE,
  status TEXT DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL, category TEXT NOT NULL, description TEXT,
  metrics JSONB DEFAULT '[]', coaching_rules JSONB DEFAULT '[]',
  recovery_impact INTEGER DEFAULT 5, strength_factor DECIMAL(3,2) DEFAULT 0,
  fitness_factor DECIMAL(3,2) DEFAULT 0, is_system BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES activity_templates(id),
  name TEXT NOT NULL, notes TEXT, is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_checkins (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL, feeling_score INTEGER, energy_score INTEGER,
  has_pain BOOLEAN DEFAULT FALSE, pain_description TEXT, notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS health_metrics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL, weight DECIMAL(5,2), resting_hr INTEGER,
  hrv DECIMAL(6,2), sleep_score INTEGER, sleep_duration INTEGER,
  stress_score INTEGER, body_battery INTEGER, vo2max DECIMAL(5,2),
  calories_burned INTEGER, steps INTEGER, source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS daily_status (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL, recovery_score INTEGER, energy_score INTEGER,
  fitness_score INTEGER, health_score INTEGER, risk_score INTEGER,
  status_color TEXT, created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS coach_memory (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  memory_type TEXT NOT NULL, content TEXT NOT NULL, confidence DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coach_recommendations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL, recommendation TEXT NOT NULL, reasoning TEXT,
  recovery_status TEXT, energy_level INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS coach_insights (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL, insight TEXT NOT NULL, confidence DECIMAL(5,2),
  status TEXT DEFAULT 'active', version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_observations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  observation TEXT NOT NULL, confidence DECIMAL(5,2), source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL, message TEXT NOT NULL, context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_data" ON profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON user_goals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON activities FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON daily_checkins FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON health_metrics FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON daily_status FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON coach_memory FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON coach_recommendations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON coach_insights FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON knowledge_observations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON ai_conversations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "templates_read" ON activity_templates FOR SELECT USING (auth.role() = 'authenticated');

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ language 'plpgsql';
CREATE TRIGGER update_profiles_ts BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_memory_ts BEFORE UPDATE ON coach_memory FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_insights_ts BEFORE UPDATE ON coach_insights FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

INSERT INTO activity_templates (name, category, metrics, coaching_rules, recovery_impact, strength_factor, fitness_factor) VALUES
('Wandelen', 'cardio', '["duration","distance","steps"]', '["consistent_pace"]', 2, 0.1, 0.3),
('Hardlopen', 'cardio', '["duration","distance","pace","hr"]', '["progressive_overload"]', 6, 0.2, 0.8),
('Fietsen', 'cardio', '["duration","distance","speed","hr"]', '["zone_training"]', 5, 0.2, 0.7),
('Kettlebell', 'strength', '["weight","reps","sets","duration","rpe"]', '["progressive_overload","technique_monitoring"]', 7, 0.9, 0.4),
('Krachttraining', 'strength', '["weight","reps","sets","rpe"]', '["progressive_overload"]', 7, 1.0, 0.3),
('Yoga', 'mobility', '["duration","type"]', '["consistency"]', 2, 0.1, 0.2),
('Zwemmen', 'cardio', '["duration","distance","laps"]', '["zone_training"]', 4, 0.3, 0.7),
('Mobiliteit', 'mobility', '["duration"]', '["daily_habit"]', 1, 0.1, 0.1),
('Meditatie', 'mindfulness', '["duration"]', '["consistency"]', 1, 0.0, 0.0),
('Padel', 'sport', '["duration","sets_played"]', '["recovery_monitoring"]', 5, 0.3, 0.5),
('Tennis', 'sport', '["duration","sets_played"]', '["recovery_monitoring"]', 5, 0.3, 0.5),
('CrossFit', 'strength', '["duration","rpe"]', '["progressive_overload","recovery_monitoring"]', 9, 0.8, 0.7),
('Anders', 'overig', '["duration"]', '["recovery_monitoring"]', 3, 0.2, 0.3)
ON CONFLICT DO NOTHING;
