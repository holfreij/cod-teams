-- Retroactive rating recalculation, generated 2026-11-25 from live data
-- (99 matches). Every match re-rated in date order under the current rules:
-- performance judged against the rating's expected score share. Uneven
-- matches use the live handicap coefficient (1366), which is left as is.
-- Run in the Supabase SQL editor.
-- Undo with revert.sql (uses the backup tables this script creates).
BEGIN;

-- Refuse if matches were recorded after this script was generated
DO $$ BEGIN
  IF (SELECT count(*) FROM match_history) <> 99
     OR (SELECT max(id::bigint) FROM match_history) <> 1795639923231 THEN
    RAISE EXCEPTION 'match_history changed since apply.sql was generated: regenerate it';
  END IF;
END $$;

-- Backups (RLS on with no policies: not reachable through the public API)
CREATE TABLE backup_20261125_match_history AS SELECT * FROM match_history;
ALTER TABLE backup_20261125_match_history ENABLE ROW LEVEL SECURITY;
CREATE TABLE backup_20261125_player_ratings AS SELECT * FROM player_ratings;
ALTER TABLE backup_20261125_player_ratings ENABLE ROW LEVEL SECURITY;

-- Recomputed per-match rating changes
UPDATE match_history SET rating_changes = '{"Frank":13,"Maarten":13,"Thomas":13,"Joel":-13,"Kevin":-13,"Rolf":-13}' WHERE id = '1767983531283';
UPDATE match_history SET rating_changes = '{"Frank":-19,"Kevin":-19,"Thomas":-19,"Joel":19,"Maarten":19,"Rick":19,"Rolf":19}' WHERE id = '1770234910104';
UPDATE match_history SET rating_changes = '{"Kevin":14,"Maarten":14,"Thomas":14,"Frank":-14,"Joel":-14,"Rick":-14,"Rolf":-14}' WHERE id = '1770236510481';
UPDATE match_history SET rating_changes = '{"Kevin":-11,"Maarten":-11,"Rick":-11,"Frank":11,"Joel":11,"Rolf":11,"Thomas":11}' WHERE id = '1770237973377';
UPDATE match_history SET rating_changes = '{"Frank":10,"Kevin":10,"Maarten":10,"Joel":-10,"Rick":-10,"Rolf":-10,"Thomas":-10}' WHERE id = '1770239630852';
UPDATE match_history SET rating_changes = '{"Frank":-22,"Kevin":-22,"Thomas":-22,"Joel":22,"Maarten":22,"Rick":22,"Rolf":22}' WHERE id = '1770241018160';
UPDATE match_history SET rating_changes = '{"Frank":15,"Lennard":15,"Maarten":15,"Thomas":15,"Joel":-15,"Kevin":-15,"Rick":-15,"Rolf":-15}' WHERE id = '1771444562139';
UPDATE match_history SET rating_changes = '{"Frank":11,"Joel":11,"Kevin":11,"Lennard":11,"Maarten":-11,"Rick":-11,"Rolf":-11,"Thomas":-11}' WHERE id = '1771446163945';
UPDATE match_history SET rating_changes = '{"Frank":-13,"Maarten":-13,"Rick":-13,"Rolf":-13,"Joel":13,"Kevin":13,"Lennard":13,"Thomas":13}' WHERE id = '1771447599480';
UPDATE match_history SET rating_changes = '{"Frank":11,"Maarten":11,"Rick":11,"Thomas":11,"Joel":-11,"Kevin":-11,"Lennard":-11,"Rolf":-11}' WHERE id = '1771449143897';
UPDATE match_history SET rating_changes = '{"Frank":-16,"Lennard":-16,"Maarten":-16,"Thomas":-16,"Joel":16,"Kevin":16,"Rick":16,"Rolf":16}' WHERE id = '1771450972719';
UPDATE match_history SET rating_changes = '{"Frank":-12,"Joel":-12,"Maarten":-12,"Rolf":-12,"Guido":12,"Kevin":12,"Lennard":12,"Thomas":12}' WHERE id = '1772658525064';
UPDATE match_history SET rating_changes = '{"Frank":-17,"Guido":-17,"Maarten":-17,"Thomas":-17,"Joel":17,"Kevin":17,"Lennard":17,"Rolf":17}' WHERE id = '1772660230642';
UPDATE match_history SET rating_changes = '{"Frank":-19,"Guido":-19,"Kevin":-19,"Lennard":-19,"Joel":19,"Maarten":19,"Rolf":19,"Thomas":19}' WHERE id = '1772661879958';
UPDATE match_history SET rating_changes = '{"Frank":16,"Lennard":16,"Maarten":16,"Guido":-16,"Kevin":-16,"Rolf":-16}' WHERE id = '1773261882906';
UPDATE match_history SET rating_changes = '{"Frank":-15,"Maarten":-15,"Rolf":-15,"Guido":15,"Kevin":15,"Lennard":15}' WHERE id = '1773263258029';
UPDATE match_history SET rating_changes = '{"Frank":16,"Maarten":16,"Rolf":16,"Guido":-16,"Kevin":-16,"Lennard":-16}' WHERE id = '1773264603834';
UPDATE match_history SET rating_changes = '{"Frank":17,"Lennard":17,"Maarten":17,"Guido":-17,"Kevin":-17,"Rolf":-17}' WHERE id = '1773265534028';
UPDATE match_history SET rating_changes = '{"Kevin":-19,"Maarten":-19,"Thomas":-19,"Frank":19,"Jan-Joost":19,"Joel":19,"Rolf":19}' WHERE id = '1774468054850';
UPDATE match_history SET rating_changes = '{"Frank":-22,"Kevin":-22,"Maarten":-22,"Jan-Joost":22,"Joel":22,"Rolf":22,"Thomas":22}' WHERE id = '1774469224460';
UPDATE match_history SET rating_changes = '{"Frank":-20,"Kevin":-20,"Thomas":-20,"Jan-Joost":20,"Joel":20,"Maarten":20,"Rolf":20}' WHERE id = '1774470672448';
UPDATE match_history SET rating_changes = '{"Frank":-21,"Kevin":-21,"Thomas":-21,"Jan-Joost":21,"Joel":21,"Maarten":21,"Rolf":21}' WHERE id = '1774471877311';
UPDATE match_history SET rating_changes = '{"Joel":20,"Kevin":20,"Maarten":20,"Frank":-20,"Jan-Joost":-20,"Rolf":-20,"Thomas":-20}' WHERE id = '1774473403543';
UPDATE match_history SET rating_changes = '{"Joel":18,"Kevin":18,"Maarten":18,"Frank":-18,"Jan-Joost":-18,"Rolf":-18,"Thomas":-18}' WHERE id = '1774475163065';
UPDATE match_history SET rating_changes = '{"Joel":-12,"Maarten":-12,"Rick":-12,"Kevin":12,"Lennard":12,"Rolf":12}' WHERE id = '1776281280516';
UPDATE match_history SET rating_changes = '{"Joel":8,"Kevin":8,"Lennard":8,"Maarten":-8,"Rick":-8,"Rolf":-8}' WHERE id = '1776282586792';
UPDATE match_history SET rating_changes = '{"Joel":-12,"Maarten":-12,"Rolf":-12,"Kevin":12,"Lennard":12,"Rick":12}' WHERE id = '1776283731641';
UPDATE match_history SET rating_changes = '{"Joel":23,"Rick":23,"Rolf":23,"Kevin":-23,"Lennard":-23,"Maarten":-23}' WHERE id = '1776285343141';
UPDATE match_history SET rating_changes = '{"Frank":-14,"Maarten":-14,"Thomas":-14,"Kevin":14,"Lennard":14,"Rolf":14}' WHERE id = '1778699458575';
UPDATE match_history SET rating_changes = '{"Frank":8,"Kevin":8,"Lennard":8,"Maarten":-8,"Rolf":-8,"Thomas":-8}' WHERE id = '1778701783609';
UPDATE match_history SET rating_changes = '{"Frank":-21,"Kevin":-21,"Lennard":-21,"Maarten":21,"Rolf":21,"Thomas":21}' WHERE id = '1778703257807';
UPDATE match_history SET rating_changes = '{"Frank":-12,"Joel":-12,"Maarten":-12,"Kevin":12,"Lennard":12,"Rolf":12}' WHERE id = '1779305864839';
UPDATE match_history SET rating_changes = '{"Frank":17,"Maarten":17,"Rolf":17,"Joel":-17,"Kevin":-17,"Lennard":-17}' WHERE id = '1779307851742';
UPDATE match_history SET rating_changes = '{"Frank":-17,"Kevin":-17,"Joel":17,"Lennard":17,"Rolf":17}' WHERE id = '1779308869243';
UPDATE match_history SET rating_changes = '{"Frank":-6,"Rolf":-6,"Thomas":-6,"Joel":6,"Kevin":6,"Maarten":6}' WHERE id = '1779909268761';
UPDATE match_history SET rating_changes = '{"Frank":-19,"Joel":-19,"Kevin":-19,"Maarten":19,"Rolf":19,"Thomas":19}' WHERE id = '1779910864693';
UPDATE match_history SET rating_changes = '{"Frank":-14,"Maarten":-14,"Thomas":-14,"Joel":14,"Kevin":14,"Rolf":14}' WHERE id = '1779912158732';
UPDATE match_history SET rating_changes = '{"Frank":10,"Kevin":10,"Rolf":10,"Joel":-10,"Maarten":-10,"Thomas":-10}' WHERE id = '1779913430536';
UPDATE match_history SET rating_changes = '{"Frank":-9,"Maarten":-9,"Rolf":-9,"Joel":9,"Kevin":9,"Thomas":9}' WHERE id = '1779914710023';
UPDATE match_history SET rating_changes = '{"Kevin":13,"Maarten":13,"Thomas":13,"Frank":-13,"Joel":-13,"Lennard":-13,"Rolf":-13}' WHERE id = '1781722938819';
UPDATE match_history SET rating_changes = '{"Kevin":-13,"Maarten":-13,"Rolf":-13,"Frank":13,"Joel":13,"Lennard":13,"Thomas":13}' WHERE id = '1781724217696';
UPDATE match_history SET rating_changes = '{"Kevin":25,"Rolf":25,"Thomas":25,"Frank":-25,"Joel":-25,"Lennard":-25,"Maarten":-25}' WHERE id = '1781725427416';
UPDATE match_history SET rating_changes = '{"Joel":19,"Kevin":19,"Thomas":19,"Frank":-19,"Lennard":-19,"Maarten":-19,"Rolf":-19}' WHERE id = '1781726883435';
UPDATE match_history SET rating_changes = '{"Frank":13,"Kevin":13,"Rick":13,"Maarten":-13,"Rolf":-13,"Thomas":-13}' WHERE id = '1783536990881';
UPDATE match_history SET rating_changes = '{"Frank":-13,"Maarten":-13,"Thomas":-13,"Kevin":13,"Rick":13,"Rolf":13}' WHERE id = '1783538535522';
UPDATE match_history SET rating_changes = '{"Frank":19,"Rolf":19,"Thomas":19,"Kevin":-19,"Maarten":-19,"Rick":-19}' WHERE id = '1783540578272';
UPDATE match_history SET rating_changes = '{"Frank":-24,"Kevin":-24,"Rolf":-24,"Maarten":24,"Rick":24,"Thomas":24}' WHERE id = '1783541595546';
UPDATE match_history SET rating_changes = '{"Frank":-23,"Joel":-23,"Kevin":-23,"Maarten":23,"Rolf":23,"Thomas":23}' WHERE id = '1784142617145';
UPDATE match_history SET rating_changes = '{"Frank":-21,"Kevin":-21,"Rolf":-21,"Joel":21,"Maarten":21,"Thomas":21}' WHERE id = '1784143539438';
UPDATE match_history SET rating_changes = '{"Frank":15,"Maarten":15,"Thomas":15,"Joel":-15,"Kevin":-15,"Rolf":-15}' WHERE id = '1784145871674';
UPDATE match_history SET rating_changes = '{"Frank":-9,"Rolf":-9,"Thomas":-9,"Joel":9,"Kevin":9,"Maarten":9}' WHERE id = '1784147343921';
UPDATE match_history SET rating_changes = '{"Frank":-9,"Joel":-9,"Thomas":-9,"Kevin":9,"Maarten":9,"Rolf":9}' WHERE id = '1784148925530';
UPDATE match_history SET rating_changes = '{"Rolf":23,"Maarten":17,"Frank":18,"Thomas":-14,"Kevin":-26,"Arjan":-18}' WHERE id = '1787779227375';
UPDATE match_history SET rating_changes = '{"Rolf":30,"Frank":26,"Maarten":17,"Thomas":-20,"Kevin":-30,"Arjan":-24}' WHERE id = '1787779261762';
UPDATE match_history SET rating_changes = '{"Thomas":17,"Rolf":16,"Frank":16,"Kevin":-22,"Maarten":-17,"Arjan":-10}' WHERE id = '1787779289521';
UPDATE match_history SET rating_changes = '{"Rolf":23,"Lennard":17,"Joel":15,"Kevin":-21,"Thomas":-16}' WHERE id = '1788461864769';
UPDATE match_history SET rating_changes = '{"Rolf":-7,"Lennard":-13,"Joel":-18,"Kevin":13,"Thomas":15,"Scott":9}' WHERE id = '1788462552428';
UPDATE match_history SET rating_changes = '{"Kevin":15,"Thomas":17,"Rolf":15,"Frank":-13,"Joel":-12,"Lennard":-13,"Scott":-22}' WHERE id = '1788463514805';
UPDATE match_history SET rating_changes = '{"Thomas":27,"Kevin":13,"Rolf":18,"Lennard":-15,"Joel":-17,"Frank":-19,"Scott":-21}' WHERE id = '1788464846519';
UPDATE match_history SET rating_changes = '{"Rolf":8,"Frank":-4,"Thomas":-13,"Kevin":6,"Joel":6,"Lennard":6,"Scott":-3}' WHERE id = '1788466510408';
UPDATE match_history SET rating_changes = '{"Thomas":22,"Rolf":25,"Maarten":12,"Frank":-16,"Jan-Joost":-14,"Rick":-22,"Scott":-22}' WHERE id = '1790189949943';
UPDATE match_history SET rating_changes = '{"Rolf":-5,"Joel":-13,"Frank":-20,"Scott":-16,"Kevin":12,"Maarten":17,"Thomas":14}' WHERE id = '1790189967909';
UPDATE match_history SET rating_changes = '{"Kevin":18,"Rolf":19,"Thomas":12,"Frank":-10,"Joel":-14,"Maarten":-21,"Scott":-17}' WHERE id = '1790191438720';
UPDATE match_history SET rating_changes = '{"Rolf":15,"Thomas":11,"Maarten":5,"Kevin":-10,"Joel":-9,"Frank":-11}' WHERE id = '1790193204539';
UPDATE match_history SET rating_changes = '{"Kevin":19,"Rolf":25,"Frank":24,"Thomas":-22,"Joel":-16,"Maarten":-25,"Scott":-26}' WHERE id = '1790195049678';
UPDATE match_history SET rating_changes = '{"Kevin":18,"Thomas":18,"Frank":18,"Joel":-18,"Maarten":-18,"Scott":-18,"Rolf":-18}' WHERE id = '1790203474266';
UPDATE match_history SET rating_changes = '{"Joel":1,"Rolf":-11,"Frank":-11,"Maarten":15,"Kevin":3,"Scott":4}' WHERE id = '1790798711466';
UPDATE match_history SET rating_changes = '{"Rolf":-15,"Joel":-16,"Maarten":-29,"Kevin":18,"Frank":28,"Scott":14}' WHERE id = '1790798728805';
UPDATE match_history SET rating_changes = '{"Frank":25,"Rolf":16,"Maarten":4,"Kevin":-17,"Joel":-10,"Scott":-19}' WHERE id = '1790799909741';
UPDATE match_history SET rating_changes = '{"Maarten":29,"Frank":17,"Rolf":14,"Kevin":-23,"Thomas":-17,"Scott":-20}' WHERE id = '1792174079465';
UPDATE match_history SET rating_changes = '{"Thomas":18,"Rolf":15,"Frank":15,"Kevin":-18,"Maarten":-15,"Scott":-15}' WHERE id = '1792174117923';
UPDATE match_history SET rating_changes = '{"Kevin":-24,"Lennard":-8,"Scott":-18,"Rolf":-31,"Frank":31,"Thomas":24,"Joel":13,"Rick":13}' WHERE id = '1792608988654';
UPDATE match_history SET rating_changes = '{"Thomas":-10,"Rolf":-19,"Maarten":-25,"Rick":-21,"Scott":-20,"Kevin":33,"Joel":21,"Jan-Joost":17,"Lennard":14,"Frank":9}' WHERE id = '1792610741693';
UPDATE match_history SET rating_changes = '{"Kevin":27,"Rolf":32,"Rick":25,"Joel":15,"Scott":14,"Thomas":-23,"Frank":-21,"Lennard":-19,"Maarten":-26,"Jan-Joost":-23}' WHERE id = '1792611806184';
UPDATE match_history SET rating_changes = '{"Rolf":31,"Thomas":19,"Lennard":26,"Frank":17,"Jan-Joost":17,"Kevin":-24,"Maarten":-20,"Joel":-17,"Rick":-22,"Scott":-26}' WHERE id = '1792613372957';
UPDATE match_history SET rating_changes = '{"Frank":18,"Jan-Joost":18,"Lennard":18,"Maarten":18,"Thomas":18,"Joel":-18,"Kevin":-18,"Rick":-18,"Rolf":-18,"Scott":-18}' WHERE id = '1792614606174';
UPDATE match_history SET rating_changes = '{"Lennard":-4,"Rolf":-9,"Maarten":-11,"Jan-Joost":-6,"Scott":-16,"Kevin":13,"Thomas":8,"Frank":7,"Joel":10}' WHERE id = '1792616846345';
UPDATE match_history SET rating_changes = '{"Maarten":18,"Lennard":22,"Thomas":7,"Joel":14,"Frank":-9,"Kevin":-23,"Rick":-11,"Scott":-17}' WHERE id = '1793217453959';
UPDATE match_history SET rating_changes = '{"Rolf":20,"Thomas":14,"Lennard":17,"Kevin":-1,"Rick":-8,"Frank":-14,"Maarten":-16,"Joel":-12,"Scott":-11}' WHERE id = '1793219150509';
UPDATE match_history SET rating_changes = '{"Rick":-13,"Rolf":-19,"Joel":-14,"Frank":-22,"Lennard":-24,"Thomas":29,"Kevin":9,"Scott":25,"Maarten":12}' WHERE id = '1793221295180';
UPDATE match_history SET rating_changes = '{"Joel":8,"Rolf":2,"Lennard":3,"Rick":3,"Frank":-2,"Kevin":-2,"Thomas":-2,"Scott":-4}' WHERE id = '1793222803196';
UPDATE match_history SET rating_changes = '{"Kevin":29,"Rolf":28,"Maarten":19,"Jan-Joost":19,"Scott":18,"Lennard":-17,"Thomas":-29,"Frank":-21,"Rick":-19,"Joel":-27}' WHERE id = '1793224122852';
UPDATE match_history SET rating_changes = '{"Frank":-26,"Rolf":-30,"Jan-Joost":-28,"Scott":-27,"Kevin":22,"Lennard":35}' WHERE id = '1793225390497';
UPDATE match_history SET rating_changes = '{"Rolf":21,"Maarten":17,"Frank":10,"Thomas":-14,"Kevin":-23,"Scott":-12}' WHERE id = '1793824320359';
UPDATE match_history SET rating_changes = '{"Thomas":33,"Rolf":27,"Maarten":18,"Kevin":-33,"Lennard":-20,"Frank":-23,"Scott":-21}' WHERE id = '1793825941872';
UPDATE match_history SET rating_changes = '{"Thomas":12,"Frank":19,"Rolf":6,"Scott":14,"Kevin":-11,"Maarten":-16,"Lennard":-12}' WHERE id = '1793827271789';
UPDATE match_history SET rating_changes = '{"Thomas":-9,"Frank":-4,"Rolf":-10,"Kevin":6,"Lennard":15,"Scott":12,"Maarten":1}' WHERE id = '1793828697369';
UPDATE match_history SET rating_changes = '{"Maarten":-9,"Rolf":-11,"Kevin":-24,"Scott":-18,"Thomas":18,"Rick":17,"Joel":16,"Frank":12}' WHERE id = '1794427974242';
UPDATE match_history SET rating_changes = '{"Frank":-12,"Joel":-14,"Maarten":-19,"Rolf":-24,"Kevin":29,"Thomas":11,"Rick":15,"Scott":13}' WHERE id = '1794429668918';
UPDATE match_history SET rating_changes = '{"Rolf":16,"Kevin":4,"Maarten":10,"Scott":18,"Thomas":-13,"Rick":-5,"Frank":-15,"Joel":-15}' WHERE id = '1794431381304';
UPDATE match_history SET rating_changes = '{"Maarten":30,"Rolf":29,"Rick":19,"Frank":13,"Thomas":-14,"Joel":-15,"Kevin":-35,"Scott":-24}' WHERE id = '1794432701421';
UPDATE match_history SET rating_changes = '{"Thomas":-21,"Rolf":-22,"Joel":-20,"Scott":-22,"Maarten":27,"Kevin":15,"Frank":26}' WHERE id = '1794434147281';
UPDATE match_history SET rating_changes = '{"Maarten":-28,"Thomas":-35,"Rick":-36,"Scott":-34,"Kevin":39,"Frank":36,"Joel":30}' WHERE id = '1795031768732';
UPDATE match_history SET rating_changes = '{"Thomas":13,"Maarten":7,"Rick":9,"Scott":8,"Kevin":-9,"Frank":-10,"Joel":-8}' WHERE id = '1795033448802';
UPDATE match_history SET rating_changes = '{"Thomas":-20,"Maarten":-21,"Frank":-20,"Kevin":25,"Joel":22,"Rick":14,"Scott":17}' WHERE id = '1795034863338';
UPDATE match_history SET rating_changes = '{"Maarten":25,"Rick":31,"Scott":26,"Kevin":-25,"Frank":-27,"Joel":-31}' WHERE id = '1795048388775';
UPDATE match_history SET rating_changes = '{"Kevin":22,"Rolf":26,"Maarten":-21,"Thomas":-25,"Joel":-20}' WHERE id = '1795636673007';
UPDATE match_history SET rating_changes = '{"Kevin":-9,"Rolf":-19,"Scott":-16,"Maarten":17,"Joel":19,"Thomas":8}' WHERE id = '1795638302676';
UPDATE match_history SET rating_changes = '{"Thomas":-11,"Joel":-11,"Rolf":-22,"Kevin":17,"Maarten":12,"Scott":15}' WHERE id = '1795639923231';

-- Leaderboard = initial ELO + recomputed ledger
UPDATE player_ratings SET rating = 1120, wins = 0, losses = 3, draws = 0, games_played = 3, updated_at = now() WHERE name = 'Arjan';
UPDATE player_ratings SET rating = 1648, wins = 38, losses = 52, draws = 0, games_played = 90, updated_at = now() WHERE name = 'Frank';
UPDATE player_ratings SET rating = 1301, wins = 2, losses = 5, draws = 0, games_played = 7, updated_at = now() WHERE name = 'Guido';
UPDATE player_ratings SET rating = 1216, wins = 8, losses = 6, draws = 0, games_played = 14, updated_at = now() WHERE name = 'Jan-Joost';
UPDATE player_ratings SET rating = 1423, wins = 36, losses = 41, draws = 0, games_played = 77, updated_at = now() WHERE name = 'Joel';
UPDATE player_ratings SET rating = 2240, wins = 52, losses = 46, draws = 0, games_played = 98, updated_at = now() WHERE name = 'Kevin';
UPDATE player_ratings SET rating = 1513, wins = 26, losses = 20, draws = 0, games_played = 46, updated_at = now() WHERE name = 'Lennard';
UPDATE player_ratings SET rating = 1859, wins = 48, losses = 42, draws = 0, games_played = 90, updated_at = now() WHERE name = 'Maarten';
UPDATE player_ratings SET rating = 1511, wins = 18, losses = 19, draws = 0, games_played = 37, updated_at = now() WHERE name = 'Rick';
UPDATE player_ratings SET rating = 1805, wins = 50, losses = 44, draws = 0, games_played = 94, updated_at = now() WHERE name = 'Rolf';
UPDATE player_ratings SET rating = 1004, wins = 15, losses = 26, draws = 0, games_played = 41, updated_at = now() WHERE name = 'Scott';
UPDATE player_ratings SET rating = 1947, wins = 44, losses = 39, draws = 0, games_played = 83, updated_at = now() WHERE name = 'Thomas';

COMMIT;
