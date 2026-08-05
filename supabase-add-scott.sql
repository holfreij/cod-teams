-- Incremental migration for the live database (run once in the Supabase SQL editor).
-- Adds Scott (gamer tags: Scotty / ScottyPhil) with a starting ELO of 1300.
-- The player_ratings row must match players.initial_elo with zero games, otherwise
-- `node scripts/verify-ratings.mjs` will flag a leaderboard/ledger mismatch.

INSERT INTO public.players (name, initial_elo)
VALUES ('Scott', 1300)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.player_ratings (name, rating, wins, losses, draws, games_played)
VALUES ('Scott', 1300, 0, 0, 0, 0)
ON CONFLICT (name) DO NOTHING;
