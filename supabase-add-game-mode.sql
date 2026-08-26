-- Incremental migration for existing databases (run once in the Supabase SQL editor).
-- Adds the game mode to match history so Demolition results can be told apart
-- from Search and Destroy ones.
--
-- Every match logged before this column existed was Search and Destroy, so the
-- DEFAULT backfills them correctly.
ALTER TABLE public.match_history
  ADD COLUMN IF NOT EXISTS game_mode TEXT NOT NULL DEFAULT 'search_and_destroy';

ALTER TABLE public.match_history
  DROP CONSTRAINT IF EXISTS match_history_game_mode_check;

ALTER TABLE public.match_history
  ADD CONSTRAINT match_history_game_mode_check
  CHECK (game_mode IN ('search_and_destroy', 'demolition'));

COMMENT ON COLUMN public.match_history.game_mode IS 'Game mode: search_and_destroy (first to 10) or demolition (first to 2)';

-- Verify: every existing row should now read search_and_destroy
SELECT game_mode, COUNT(*) FROM public.match_history GROUP BY game_mode;
