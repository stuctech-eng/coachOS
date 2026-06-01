-- Voer uit in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS strava_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  athlete_id BIGINT,
  athlete_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE strava_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_data" ON strava_tokens FOR ALL USING (auth.uid() = user_id);
CREATE TRIGGER update_strava_tokens_ts BEFORE UPDATE ON strava_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at();
