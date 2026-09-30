-- Incremental migration for the live database (run once in the Supabase SQL editor).
-- Adds each player's Discord user ID so qmg.rolf.bible can pre-select whoever is in
-- a Discord voice channel.
--
-- Additive only: no rows are deleted and no existing column changes. The transaction
-- makes it all-or-nothing, and the IS NULL guards make re-running it a no-op.
--   BEFORE: node scripts/backup-supabase.mjs
--   AFTER:  node scripts/backup-supabase.mjs --compare supabase-backups/<snapshot>.json
--           node scripts/verify-ratings.mjs

BEGIN;

ALTER TABLE public.players ADD COLUMN IF NOT EXISTS discord_id TEXT UNIQUE;
COMMENT ON COLUMN public.players.discord_id IS 'Discord user ID (snowflake, as text) for voice-channel pre-selection';

UPDATE public.players SET discord_id = '707336978068275341' WHERE name = 'Arjan'     AND discord_id IS NULL;
UPDATE public.players SET discord_id = '381801709539688448' WHERE name = 'Frank'     AND discord_id IS NULL;
UPDATE public.players SET discord_id = '312220239653896193' WHERE name = 'Guido'     AND discord_id IS NULL;
UPDATE public.players SET discord_id = '381812737874984970' WHERE name = 'Jan-Joost' AND discord_id IS NULL;
UPDATE public.players SET discord_id = '395547130393133056' WHERE name = 'Joel'      AND discord_id IS NULL;
UPDATE public.players SET discord_id = '340500831973670913' WHERE name = 'Kevin'     AND discord_id IS NULL;
UPDATE public.players SET discord_id = '381818898506579969' WHERE name = 'Lennard'   AND discord_id IS NULL;
UPDATE public.players SET discord_id = '440477861099470849' WHERE name = 'Maarten'   AND discord_id IS NULL;
UPDATE public.players SET discord_id = '385506883479535616' WHERE name = 'Rick'      AND discord_id IS NULL;
UPDATE public.players SET discord_id = '364542389353709570' WHERE name = 'Rolf'      AND discord_id IS NULL;
UPDATE public.players SET discord_id = '684951231357124638' WHERE name = 'Scott'     AND discord_id IS NULL;
UPDATE public.players SET discord_id = '706461150572970025' WHERE name = 'Thomas'    AND discord_id IS NULL;

COMMIT;

-- Expect 12 rows, each with a discord_id.
SELECT name, discord_id FROM public.players ORDER BY name;
