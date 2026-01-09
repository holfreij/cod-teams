-- QMG Teams Generator - Supabase Database Migration
-- Run this SQL in your Supabase SQL Editor to create the required tables

-- Create player_ratings table
CREATE TABLE IF NOT EXISTS player_ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  rating INTEGER DEFAULT 0 NOT NULL,
  wins INTEGER DEFAULT 0 NOT NULL,
  losses INTEGER DEFAULT 0 NOT NULL,
  draws INTEGER DEFAULT 0 NOT NULL,
  games_played INTEGER DEFAULT 0 NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create match_history table
CREATE TABLE IF NOT EXISTS match_history (
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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_player_ratings_name ON player_ratings(name);
CREATE INDEX IF NOT EXISTS idx_match_history_date ON match_history(date DESC);

-- Enable Row Level Security (RLS) for security
ALTER TABLE player_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_history ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public access (for GitHub Pages deployment)
-- Note: You may want to restrict this if you add authentication later
CREATE POLICY "Allow public read access on player_ratings"
  ON player_ratings FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on player_ratings"
  ON player_ratings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on player_ratings"
  ON player_ratings FOR UPDATE
  USING (true);

CREATE POLICY "Allow public read access on match_history"
  ON match_history FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on match_history"
  ON match_history FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public delete on match_history"
  ON match_history FOR DELETE
  USING (true);

-- Optional: Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_player_ratings_updated_at BEFORE UPDATE
    ON player_ratings FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
