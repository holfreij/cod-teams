// Prompt for the screenshot analyser, kept in its own module so it can be
// exercised against sample screenshots without booting the server
// (see server/analyze-samples.js).
export const ANALYSIS_PROMPT = `Analyze this Call of Duty match result screenshot. The match is either Search and Destroy or Demolition — work out which from the screenshot.

Screenshot layout:
- At the top: a "WON"/"VICTORY" or "LOST"/"DEFEAT" indicator showing the result for the player who took the screenshot.
- Directly below that: a line reading "<game mode> | <map name>", e.g. "Search and Destroy | Rammaza" or "Demolition | Hackney Yard". Match time may appear on the far right (ignore the time). This line is how you determine the game mode.
- Two vertically stacked tables (top table = team 1, bottom table = team 2).
- The team's total round score is shown as a VERY LARGE numeral to the left of each team's player table, under the faction name.
- Team/faction names like "Allegiance" and "Coalition" are generic labels — ignore them.
- Each table lists the players on that team with 6 columns:
  1. Player name — often prefixed with [QMG] or [<QMG>] and suffixed with #1234567 (ignore prefix and suffix)
  2. Score (total points from kills/assists/objectives)
  3. Kills
  4. Deaths
  5. Plants
  6. Defuses

Game modes and their round scores:
- "Search and Destroy": the winning team's round score is always exactly 10; the losing team's is 0-9. Return gameMode "search_and_destroy".
- "Demolition": the winning team's round score is always exactly 2; the losing team's is 0 or 1. Return gameMode "demolition".

CRITICAL — do not confuse the player counter with the round score:
A small fraction like "3/10", "4/10" or "6/10" may appear just above or beside each faction name. That is the PLAYER COUNT on that team out of a maximum of 10 players. It is NOT the round score, and its "/10" has nothing to do with the Search and Destroy target of 10. The round score is the separate VERY LARGE standalone numeral (no slash) below the faction name. Never report a value that appeared with a slash as a round score.

Known player gamer tags (tag -> real name). Ignore any trailing #numbers and [QMG] prefixes:
- Glow -> Kevin
- D3labottle -> Maarten
- W33M4N -> Thomas
- Freagle -> Frank
- hYdrax1 -> Rolf
- deSperado -> Rick
- chilljoey -> Joel
- Aegys -> Lennard
- Guido68 -> Guido
- getJayked -> Jan-Joost
- Tuinman40 -> Arjan
- Scotty -> Scott
- ScottyPhil -> Scott

Tags may have slight variations (capitalization, extra characters). Match them as best you can.

Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "gameMode": "search_and_destroy" | "demolition",
  "team1Score": <number>,
  "team2Score": <number>,
  "team1Players": [
    { "name": "<real name>", "score": <number>, "kills": <number>, "deaths": <number>, "plants": <number>, "defuses": <number> }
  ],
  "team2Players": [
    { "name": "<real name>", "score": <number>, "kills": <number>, "deaths": <number>, "plants": <number>, "defuses": <number> }
  ],
  "map": "<map name if visible, otherwise null>",
  "confidence": <number between 0 and 1>
}

Rules:
- team1 is the top table, team2 is the bottom table
- gameMode comes from the mode name on the line under the WON/LOST indicator. If that line is unreadable, infer it from the round scores (a winning score of 10 means search_and_destroy, 2 means demolition). Only use null if you genuinely cannot tell.
- Use the real names from the mapping above, not the gamer tags
- If a gamer tag doesn't match any known player, use the cleaned tag (without prefix/suffix) as the name
- team1Score/team2Score are the large standalone round-score numerals left of the tables. Always extract them, and check they fit the mode: Search and Destroy is 10 vs 0-9, Demolition is 2 vs 0-1. Cross-check with the WON/LOST indicator at the top. Only use null for a round score if the numeral is truly not visible in the screenshot.
- If a specific value is unreadable, set just that value to null and lower the confidence; still return everything you could read
- confidence should reflect how certain you are about the extracted values`;
