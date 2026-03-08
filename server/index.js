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
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
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
              text: `Analyze this Call of Duty match result screenshot. Extract the scores for both teams/sides.

Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "team1Score": <number>,
  "team2Score": <number>,
  "map": "<map name if visible, otherwise null>",
  "confidence": <number between 0 and 1>
}

Rules:
- team1 is the top/left team, team2 is the bottom/right team
- If you cannot determine scores, return {"team1Score": null, "team2Score": null, "map": null, "confidence": 0}
- confidence should reflect how certain you are about the extracted values
- Map name should be the standard COD map name if recognizable`,
            },
          ],
        },
      ],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";

    // Parse JSON from response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: "Could not parse AI response" });
    }

    const result = JSON.parse(jsonMatch[0]);
    return res.json(result);
  } catch (err) {
    console.error("Screenshot analysis error:", err.message);
    return res.status(500).json({ error: "Analyse mislukt. Probeer het opnieuw." });
  }
});

app.listen(parseInt(PORT), "127.0.0.1", () => {
  console.log(`Screenshot analysis server running on http://127.0.0.1:${PORT}`);
});
