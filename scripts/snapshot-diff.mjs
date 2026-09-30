// Compares two Supabase snapshots (see backup-supabase.mjs). The only change the
// Discord-ID migration may make is players.discord_id going from null to a value;
// everything else is reported as a problem.

export const TABLES = {
  players: "name",
  player_ratings: "name",
  match_history: "id",
  settings: "key",
};

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function diffSnapshots(before, after) {
  const problems = [];
  const allowed = [];

  for (const [table, key] of Object.entries(TABLES)) {
    const oldRows = before.tables[table] ?? [];
    const newRows = after.tables[table];
    if (!newRows) {
      problems.push(`${table}: table missing`);
      continue;
    }
    const newByKey = new Map(newRows.map((r) => [r[key], r]));
    if (newByKey.size !== newRows.length) {
      problems.push(`${table}: duplicate keys in new snapshot`);
    }
    const oldKeys = new Set(oldRows.map((r) => r[key]));

    for (const oldRow of oldRows) {
      const id = oldRow[key];
      const newRow = newByKey.get(id);
      if (!newRow) {
        problems.push(`${table} ${id}: row missing`);
        continue;
      }
      for (const col of new Set([...Object.keys(oldRow), ...Object.keys(newRow)])) {
        if (same(oldRow[col], newRow[col])) continue;
        if (table === "players" && col === "discord_id" && oldRow[col] == null) {
          allowed.push(`players ${id}: discord_id set to ${newRow[col]}`);
          continue;
        }
        problems.push(
          `${table} ${id}: ${col} changed ${JSON.stringify(oldRow[col])} -> ${JSON.stringify(newRow[col])}`
        );
      }
    }
    for (const newRow of newRows) {
      if (!oldKeys.has(newRow[key])) problems.push(`${table} ${newRow[key]}: row added`);
    }
  }
  return { problems, allowed };
}
