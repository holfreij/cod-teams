-- ============================================================================
-- COD Teams - Complete Supabase Database Setup
-- ============================================================================
--
-- This script sets up a fresh Supabase database for the COD Teams application.
-- Run this in your Supabase SQL Editor to create all tables, policies, and data.
--
-- Tables created:
--   1. players - Player list with initial ELO ratings
--   2. player_ratings - Current ELO ratings and match statistics
--   3. match_history - Record of all matches played
--   4. settings - Application configuration (handicap coefficient)
--
-- ============================================================================

-- Clean up existing tables (if any)
DROP TABLE IF EXISTS public.match_history CASCADE;
DROP TABLE IF EXISTS public.player_ratings CASCADE;
DROP TABLE IF EXISTS public.players CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;

-- ============================================================================
-- TABLE: players
-- ============================================================================
-- Stores the list of players and their initial ELO ratings.
-- Initial ELO is used when a player has no match history yet.
-- ============================================================================

CREATE TABLE public.players (
  name TEXT PRIMARY KEY,
  initial_elo INTEGER NOT NULL DEFAULT 1500,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read players (public data)
CREATE POLICY "Players are publicly readable"
  ON public.players
  FOR SELECT
  USING (true);

-- Policy: Only authenticated users can insert/update/delete players
CREATE POLICY "Authenticated users can manage players"
  ON public.players
  FOR ALL
  USING (auth.role() = 'authenticated');

-- Insert default players
INSERT INTO public.players (name, initial_elo) VALUES
  ('Frank', 1875),
  ('Guido', 1359),
  ('Jan-Joost', 1172),
  ('Joel', 1453),
  ('Kevin', 2344),
  ('Lennard', 1453),
  ('Maarten', 1781),
  ('Rick', 1500),
  ('Rolf', 1500),
  ('Thomas', 1828),
  ('Arjan', 1172);

-- Create index for faster lookups
CREATE INDEX idx_players_name ON public.players(name);

COMMENT ON TABLE public.players IS 'Stores the list of players and their initial ELO ratings';
COMMENT ON COLUMN public.players.name IS 'Player name (unique identifier)';
COMMENT ON COLUMN public.players.initial_elo IS 'Initial ELO rating (used when player has no match history)';

-- ============================================================================
-- TABLE: player_ratings
-- ============================================================================
-- Stores current ELO ratings and match statistics for each player.
-- Updated automatically after each match.
-- ============================================================================

CREATE TABLE public.player_ratings (
  name TEXT PRIMARY KEY,
  rating INTEGER NOT NULL DEFAULT 1500,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  games_played INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.player_ratings ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read ratings (public leaderboard)
CREATE POLICY "Player ratings are publicly readable"
  ON public.player_ratings
  FOR SELECT
  USING (true);

-- Policy: Only authenticated users can update ratings
CREATE POLICY "Authenticated users can manage ratings"
  ON public.player_ratings
  FOR ALL
  USING (auth.role() = 'authenticated');

-- Create index for faster queries
CREATE INDEX idx_player_ratings_rating ON public.player_ratings(rating DESC);

COMMENT ON TABLE public.player_ratings IS 'Current ELO ratings and statistics for all players';
COMMENT ON COLUMN public.player_ratings.rating IS 'Current ELO rating (updated after each match)';
COMMENT ON COLUMN public.player_ratings.wins IS 'Total number of wins';
COMMENT ON COLUMN public.player_ratings.losses IS 'Total number of losses';
COMMENT ON COLUMN public.player_ratings.draws IS 'Total number of draws';
COMMENT ON COLUMN public.player_ratings.games_played IS 'Total matches played';

-- ============================================================================
-- TABLE: match_history
-- ============================================================================
-- Stores complete history of all matches played.
-- Includes team compositions, scores, and rating changes.
-- ============================================================================

CREATE TABLE public.match_history (
  id TEXT PRIMARY KEY,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  team1_players TEXT[] NOT NULL,
  team2_players TEXT[] NOT NULL,
  team1_score INTEGER NOT NULL,
  team2_score INTEGER NOT NULL,
  winner INTEGER NOT NULL CHECK (winner IN (0, 1, 2)),
  map_played TEXT,
  rating_changes JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.match_history ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read match history (public data)
CREATE POLICY "Match history is publicly readable"
  ON public.match_history
  FOR SELECT
  USING (true);

-- Policy: Only authenticated users can insert/delete matches
CREATE POLICY "Authenticated users can manage match history"
  ON public.match_history
  FOR ALL
  USING (auth.role() = 'authenticated');

-- Create indexes for faster queries
CREATE INDEX idx_match_history_date ON public.match_history(date DESC);
CREATE INDEX idx_match_history_winner ON public.match_history(winner);

COMMENT ON TABLE public.match_history IS 'Complete history of all matches played';
COMMENT ON COLUMN public.match_history.id IS 'Unique match identifier';
COMMENT ON COLUMN public.match_history.date IS 'When the match was played';
COMMENT ON COLUMN public.match_history.team1_players IS 'Array of player names on team 1';
COMMENT ON COLUMN public.match_history.team2_players IS 'Array of player names on team 2';
COMMENT ON COLUMN public.match_history.team1_score IS 'Final score for team 1';
COMMENT ON COLUMN public.match_history.team2_score IS 'Final score for team 2';
COMMENT ON COLUMN public.match_history.winner IS 'Winner: 0=draw, 1=team1, 2=team2';
COMMENT ON COLUMN public.match_history.map_played IS 'Optional: which map was played';
COMMENT ON COLUMN public.match_history.rating_changes IS 'JSON object mapping player names to rating changes';

-- ============================================================================
-- TABLE: settings
-- ============================================================================
-- Stores application configuration values.
-- Currently used for the adaptive handicap coefficient.
-- ============================================================================

CREATE TABLE public.settings (
  key TEXT PRIMARY KEY,
  value NUMERIC NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read settings (public data)
CREATE POLICY "Settings are publicly readable"
  ON public.settings
  FOR SELECT
  USING (true);

-- Policy: Only authenticated users can update settings
CREATE POLICY "Authenticated users can manage settings"
  ON public.settings
  FOR ALL
  USING (auth.role() = 'authenticated');

-- Insert default handicap coefficient
INSERT INTO public.settings (key, value, description) VALUES
  ('uneven_team_coefficient', 300, 'Handicap coefficient for uneven team sizes (adaptive learning)');

COMMENT ON TABLE public.settings IS 'Application configuration and settings';
COMMENT ON COLUMN public.settings.key IS 'Setting identifier (unique)';
COMMENT ON COLUMN public.settings.value IS 'Numeric value of the setting';
COMMENT ON COLUMN public.settings.description IS 'Human-readable description of what this setting does';

-- ============================================================================
-- TRIGGERS: Auto-update timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_player_ratings_updated_at
  BEFORE UPDATE ON public.player_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify the setup was successful:
-- ============================================================================

-- Check that all tables were created
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN ('players', 'player_ratings', 'match_history', 'settings')
ORDER BY table_name;

-- Check that default data was inserted
SELECT 'players' as table_name, COUNT(*) as row_count FROM public.players
UNION ALL
SELECT 'settings' as table_name, COUNT(*) as row_count FROM public.settings;

-- Check that RLS is enabled on all tables
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('players', 'player_ratings', 'match_history', 'settings')
ORDER BY tablename;

-- ============================================================================
-- SETUP COMPLETE!
-- ============================================================================
--
-- Next steps:
-- 1. Add your Supabase URL and anon key to your .env file:
--    VITE_SUPABASE_URL=your_project_url
--    VITE_SUPABASE_ANON_KEY=your_anon_key
--
-- 2. Configure Supabase Auth:
--    - Go to Authentication → Providers
--    - Enable "Email" provider
--    - Go to Authentication → URL Configuration
--    - Add redirect URLs:
--      * http://localhost:5173 (for development)
--      * Your production URL (e.g., https://yourusername.github.io/cod-teams/)
--
-- 3. Test the connection:
--    - Run your app: npm run dev
--    - Try logging in with magic link
--    - Generate some teams
--    - Record a match result
--
-- ============================================================================
