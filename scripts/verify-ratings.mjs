// Consistency check (read-only): current player_ratings must equal
// players.initial_elo + the sum of all match_history.rating_changes.
// Non-zero drift means the leaderboard and the rating graph disagree.
// Usage: node scripts/verify-ratings.mjs
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const headers = {
  apikey: env.VITE_SUPABASE_ANON_KEY,
  Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
};
const get = async (path) =>
  (await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${path}`, { headers })).json();

const players = await get("players?select=name,initial_elo");
const matches = await get("match_history?select=id,date,rating_changes&order=date.asc");
const ratings = await get("player_ratings?select=name,rating");

console.log(`players: ${players.length}, matches: ${matches.length}`);
const missing = matches.filter((m) => !m.rating_changes || !Object.keys(m.rating_changes).length);
if (missing.length) console.log(`WARNING: ${missing.length} matches without rating_changes`);

const replayed = {};
players.forEach((p) => (replayed[p.name] = p.initial_elo));
matches.forEach((m) =>
  Object.entries(m.rating_changes || {}).forEach(([n, c]) => {
    replayed[n] = (replayed[n] ?? 1500) + c;
  })
);

let maxDrift = 0;
console.log("\nname            replayed  stored  drift");
ratings
  .sort((a, b) => b.rating - a.rating)
  .forEach((r) => {
    const rep = replayed[r.name];
    const drift = rep == null ? 0 : rep - r.rating;
    maxDrift = Math.max(maxDrift, Math.abs(drift));
    console.log(
      `${r.name.padEnd(15)} ${String(rep ?? "-").padStart(8)} ${String(r.rating).padStart(7)} ${String(drift).padStart(6)}`
    );
  });

console.log(maxDrift === 0 ? "\nOK: leaderboard and history are in sync" : "\nDRIFT DETECTED");
process.exit(maxDrift === 0 ? 0 : 1);
