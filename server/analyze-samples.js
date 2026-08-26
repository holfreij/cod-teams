// Run sample screenshots through the live analysis prompt, without booting the
// server or needing a Supabase session. Useful when changing ANALYSIS_PROMPT.
//
//   node server/analyze-samples.js <image-or-directory> [...]
//
// Needs ANTHROPIC_API_KEY (read from server/.env like index.js does).
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";
import { ANALYSIS_PROMPT } from "./prompt.js";

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
  // .env is optional if env vars are set externally
}

const MEDIA_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const expand = (path) =>
  statSync(path).isDirectory()
    ? readdirSync(path)
        .map((f) => join(path, f))
        .filter((f) => extname(f).toLowerCase() in MEDIA_TYPES)
        .sort()
    : [path];

const files = process.argv.slice(2).flatMap(expand);
if (files.length === 0) {
  console.error("Usage: node server/analyze-samples.js <image-or-directory> [...]");
  process.exit(1);
}

console.log(`Model: ${ANTHROPIC_MODEL}\n`);

for (const file of files) {
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
              media_type: MEDIA_TYPES[extname(file).toLowerCase()],
              data: readFileSync(file).toString("base64"),
            },
          },
          { type: "text", text: ANALYSIS_PROMPT },
        ],
      },
    ],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  console.log(`=== ${file} ===`);
  if (!jsonMatch) {
    console.log("NO JSON IN RESPONSE:", text.slice(0, 400));
    continue;
  }
  const result = JSON.parse(jsonMatch[0]);
  console.log(
    `mode: ${result.gameMode}   score: ${result.team1Score}-${result.team2Score}   ` +
      `map: ${result.map}   confidence: ${result.confidence}`
  );
  console.log(
    `  team1: ${result.team1Players.map((p) => `${p.name} ${p.score}/${p.kills}k/${p.deaths}d`).join(", ")}`
  );
  console.log(
    `  team2: ${result.team2Players.map((p) => `${p.name} ${p.score}/${p.kills}k/${p.deaths}d`).join(", ")}\n`
  );
}
