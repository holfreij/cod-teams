import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// Load .env manually (avoid dotenv dependency)
try {
  const envFile = readFileSync(new URL("./.env", import.meta.url), "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch {
  // .env file is optional if env vars are set externally
}

const {
  ANTHROPIC_API_KEY,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  PORT = "3001",
} = process.env;

// Optioneel te overriden via ANTHROPIC_MODEL in .env (geen deploy nodig bij modelwissel)
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required");
if (!SUPABASE_URL) throw new Error("SUPABASE_URL is required");
if (!SUPABASE_ANON_KEY) throw new Error("SUPABASE_ANON_KEY is required");

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const app = express();
app.use(express.json({ limit: "10mb" }));

// Rate limiting: 10 requests per minute per IP
const rateLimitMap = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (now - entry.windowStart > RATE_WINDOW_MS) {
    entry.count = 1;
    entry.windowStart = now;
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

// Clean up rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_WINDOW_MS) {
      rateLimitMap.delete(ip);
    }
  }
}, 300_000);

app.post("/api/analyze-screenshot", async (req, res) => {
  // Verify auth
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  const token = authHeader.slice(7);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // Rate limit
  const ip = req.headers["x-real-ip"] || req.ip;
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: "Te veel verzoeken. Probeer het over een minuut opnieuw." });
  }

  const { image, mediaType } = req.body;
  if (!image || !mediaType) {
    return res.status(400).json({ error: "image (base64) and mediaType are required" });
  }

  try {
    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: image,
              },
            },
            {
              type: "text",
              text: `Analyze this Call of Duty Search and Destroy match result screenshot.

Screenshot layout:
- At the top: a "WON" or "LOST" indicator showing the result for the player who took the screenshot.
- Below that: a line reading "Search and Destroy | <map name>" with match time on the far right (ignore the time).
- Two vertically stacked tables (top table = team 1, bottom table = team 2).
- The team's total round score is shown as a VERY LARGE numeral to the left of each team's player table. The winning team's round score is always exactly 10; the losing team's is 0-9.
- Team names like "Allegiance" and "Coalition" are generic labels — ignore them.
- Each table lists the players on that team with 6 columns:
  1. Player name — often prefixed with [QMG] or [<QMG>] and suffixed with #1234567 (ignore prefix and suffix)
  2. Score (total points from kills/assists/objectives)
  3. Kills
  4. Deaths
  5. Plants
  6. Defuses

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

Tags may have slight variations (capitalization, extra characters). Match them as best you can.

Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
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
- Use the real names from the mapping above, not the gamer tags
- If a gamer tag doesn't match any known player, use the cleaned tag (without prefix/suffix) as the name
- team1Score/team2Score are the large round-score numerals left of the tables. Always extract them: one team has exactly 10, the other 0-9. Cross-check with the WON/LOST indicator at the top. Only use null for a round score if the numeral is truly not visible in the screenshot.
- If a specific value is unreadable, set just that value to null and lower the confidence; still return everything you could read
- confidence should reflect how certain you are about the extracted values`,
            },
          ],
        },
      ],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    console.log(
      `Screenshot analysis response (stop: ${response.stop_reason}):`,
      text.replace(/\s+/g, " ").slice(0, 600)
    );

    // Parse JSON from response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in model response");
      return res.status(500).json({ error: "Could not parse AI response" });
    }

    let result;
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error(
        `JSON parse failed (stop: ${response.stop_reason}, len: ${text.length}):`,
        parseErr.message
      );
      return res.status(500).json({ error: "Could not parse AI response" });
    }
    return res.json(result);
  } catch (err) {
    console.error(`Screenshot analysis error (model: ${ANTHROPIC_MODEL}):`, err.status, err.message);
    return res.status(500).json({ error: "Analyse mislukt. Probeer het opnieuw." });
  }
});

app.listen(parseInt(PORT), "127.0.0.1", () => {
  console.log(`Screenshot analysis server running on http://127.0.0.1:${PORT} (model: ${ANTHROPIC_MODEL})`);
});
