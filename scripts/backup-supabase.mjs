// Read-only snapshot of every Supabase table, plus a post-migration check.
//   node scripts/backup-supabase.mjs                   -> supabase-backups/<timestamp>.json
//   node scripts/backup-supabase.mjs --compare <file>  -> diff live data against a snapshot
// Uses the public anon key from .env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY);
// it can only read. Exit code 1 when --compare finds a problem.
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { TABLES, diffSnapshots } from "./snapshot-diff.mjs";
import { parseContentRangeTotal } from "./content-range.mjs";
import { fetchAllRows } from "./paginate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(join(root, ".env"), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const headers = {
  apikey: env.VITE_SUPABASE_ANON_KEY,
  Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
  "Prefer": "count=exact",
};
const PAGE = 1000; // PostgREST's default max rows per request

async function fetchTable(table, key) {
  const fetchPage = async (offset, limit) => {
    const url = `${env.VITE_SUPABASE_URL}/rest/v1/${table}?select=*&order=${key}.asc&limit=${limit}&offset=${offset}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${await res.text()}`);
    const contentRange = res.headers.get("Content-Range");
    const rows = await res.json();
    return {
      rows,
      total: parseContentRangeTotal(contentRange),
    };
  };
  return fetchAllRows(fetchPage, PAGE);
}

async function snapshot() {
  const tables = {};
  for (const [table, key] of Object.entries(TABLES)) tables[table] = await fetchTable(table, key);
  return { takenAt: new Date().toISOString(), tables };
}

const compareIdx = process.argv.indexOf("--compare");

// Validate --compare file before fetching anything
if (compareIdx !== -1) {
  const compareFile = process.argv[compareIdx + 1];
  if (!compareFile) {
    console.error("Error: --compare requires a file path argument");
    process.exit(1);
  }
  try {
    const content = readFileSync(compareFile, "utf8");
    const before = JSON.parse(content);
    if (!before.tables || typeof before.tables !== "object") {
      console.error(`Error: file does not contain a valid snapshot (missing tables object): ${compareFile}`);
      process.exit(1);
    }
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error(`Error: file not found: ${compareFile}`);
    } else if (err instanceof SyntaxError) {
      console.error(`Error: file is not valid JSON: ${compareFile}`);
    } else {
      console.error(`Error: could not read file: ${compareFile}\n${err.message}`);
    }
    process.exit(1);
  }
}

const current = await snapshot();
const counts = Object.entries(current.tables).map(([t, rows]) => `${t}: ${rows.length}`).join(", ");

if (compareIdx === -1) {
  const dir = join(root, "supabase-backups");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${current.takenAt.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(current, null, 2));
  console.log(`Snapshot written: ${file}\n${counts}`);
} else {
  const before = JSON.parse(readFileSync(process.argv[compareIdx + 1], "utf8"));
  const { problems, allowed } = diffSnapshots(before, current);
  console.log(`Live: ${counts}`);
  allowed.forEach((l) => console.log(`  ok       ${l}`));
  problems.forEach((l) => console.log(`  PROBLEM  ${l}`));
  console.log(problems.length ? `\n${problems.length} problem(s) - investigate before continuing.` : "\nNo data lost or changed.");
  process.exit(problems.length ? 1 : 0);
}
