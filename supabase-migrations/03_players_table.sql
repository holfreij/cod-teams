-- Migration: Add Players Table
-- This table stores the list of players and their initial ELO ratings
-- Run this migration in your Supabase SQL Editor

-- Create players table
CREATE TABLE IF NOT EXISTS public.players (
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

-- Insert default players (current hardcoded list)
-- You can modify these values or add/remove players as needed
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
  ('Arjan', 1172)
ON CONFLICT (name) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_players_name ON public.players(name);

COMMENT ON TABLE public.players IS 'Stores the list of players and their initial ELO ratings';
COMMENT ON COLUMN public.players.name IS 'Player name (unique identifier)';
COMMENT ON COLUMN public.players.initial_elo IS 'Initial ELO rating for the player (used when they have no match history)';
