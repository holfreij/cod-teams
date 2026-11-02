import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { ANALYSIS_PROMPT } from "./prompt.js";
import { voiceMembersHandler } from "./voiceMembers.js";
import { voiceGatherHandler, voiceMoveHandler } from "./voiceMove.js";
import { createRateLimiter, enforceRateLimit } from "./rateLimit.js";

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
  VOICE_API_URL = "https://knoeks.rolf.bible/api/voice-members",
  VOICE_MOVE_URL = "https://knoeks.rolf.bible/api/voice-move",
  VOICE_GATHER_URL = "https://knoeks.rolf.bible/api/voice-gather",
  VOICE_API_TOKEN = "",
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

// The Supabase user behind "Authorization: Bearer <jwt>", or null if missing/invalid
async function verifyUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(authHeader.slice(7));
  return error || !user ? null : user;
}

// Rate limiting: each route gets its own budget, so one can't starve the others.
const screenshotRateLimiter = createRateLimiter(10, 60_000);
const voiceRateLimiter = createRateLimiter(30, 60_000);
const voiceMoveRateLimiter = createRateLimiter(10, 60_000);

// Clean up rate limit entries every 5 minutes
setInterval(() => {
  screenshotRateLimiter.cleanup();
  voiceRateLimiter.cleanup();
  voiceMoveRateLimiter.cleanup();
}, 300_000);

app.post("/api/analyze-screenshot", async (req, res) => {
  if (!(await verifyUser(req))) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // Rate limit
  if (!enforceRateLimit(screenshotRateLimiter, req, res)) return;

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
              text: ANALYSIS_PROMPT,
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

// Who is in Discord voice, for pre-selecting players. Public like the leaderboard;
// optional, so a missing VOICE_API_TOKEN yields 503 instead of refusing to boot.
app.get(
  "/api/voice-members",
  (req, res, next) => {
    if (!enforceRateLimit(voiceRateLimiter, req, res)) return;
    next();
  },
  voiceMembersHandler({ url: VOICE_API_URL, token: VOICE_API_TOKEN })
);

// Move a proposed team split into the Discord team voice channels. Logged-in users only.
app.post(
  "/api/move-to-voice",
  (req, res, next) => {
    if (!enforceRateLimit(voiceMoveRateLimiter, req, res)) return;
    next();
  },
  voiceMoveHandler({ url: VOICE_MOVE_URL, token: VOICE_API_TOKEN, verifyUser })
);

// Everyone in Discord voice (except AFK) to Lobby. Logged-in users only; shares the move route's budget.
app.post(
  "/api/gather-to-lobby",
  (req, res, next) => {
    if (!enforceRateLimit(voiceMoveRateLimiter, req, res)) return;
    next();
  },
  voiceGatherHandler({ url: VOICE_GATHER_URL, token: VOICE_API_TOKEN, verifyUser })
);

app.listen(parseInt(PORT), "127.0.0.1", () => {
  console.log(`Screenshot analysis server running on http://127.0.0.1:${PORT} (model: ${ANTHROPIC_MODEL})`);
});
