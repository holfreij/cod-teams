-- Undo apply.sql: restore per-match rating changes and the leaderboard
-- from the backup_20261125_* tables it created. Run in the Supabase SQL editor.
BEGIN;

-- Refuse if matches were recorded after apply.sql: their rating changes were
-- computed on the new ratings, so a plain restore would leave the leaderboard
-- out of step with the ledger. Ask Claude to regenerate in that case.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM match_history m WHERE NOT EXISTS
             (SELECT 1 FROM backup_20261125_match_history b WHERE b.id = m.id)) THEN
    RAISE EXCEPTION 'matches were recorded after apply.sql; a plain revert would drift';
  END IF;
END $$;

UPDATE match_history m SET rating_changes = b.rating_changes FROM backup_20261125_match_history b WHERE m.id = b.id;
UPDATE player_ratings p SET rating = b.rating, wins = b.wins, losses = b.losses, draws = b.draws, games_played = b.games_played, updated_at = now() FROM backup_20261125_player_ratings b WHERE p.name = b.name;

COMMIT;

-- Once you are sure you will not revert, drop the backups:
-- DROP TABLE backup_20261125_match_history;
-- DROP TABLE backup_20261125_player_ratings;
