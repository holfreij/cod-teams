-- Incremental migration for existing databases (run once in the Supabase SQL editor).
-- Adds per-player scoreboard stats from screenshot analysis to match history:
-- {"team1": [{"name": "...", "score": 0, "kills": 0, "deaths": 0, "plants": 0, "defuses": 0}], "team2": [...]}
ALTER TABLE public.match_history
  ADD COLUMN IF NOT EXISTS player_stats JSONB;
