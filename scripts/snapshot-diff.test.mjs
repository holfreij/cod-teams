import { describe, it, expect } from "vitest";
import { diffSnapshots } from "./snapshot-diff.mjs";

const snap = (overrides = {}) => ({
  tables: {
    players: [
      { name: "Kevin", initial_elo: 1500 },
      { name: "Rolf", initial_elo: 1500 },
    ],
    player_ratings: [{ name: "Kevin", rating: 1600, wins: 3 }],
    match_history: [{ id: "m1", team1_score: 10, rating_changes: { Kevin: 12 } }],
    settings: [{ key: "uneven_team_coefficient", value: 1500 }],
    ...overrides,
  },
});

describe("diffSnapshots", () => {
  it("reports nothing for identical snapshots", () => {
    expect(diffSnapshots(snap(), snap())).toEqual({ problems: [], allowed: [] });
  });

  it("allows discord_id going from absent to a value", () => {
    const after = snap({
      players: [
        { name: "Kevin", initial_elo: 1500, discord_id: "340500831973670913" },
        { name: "Rolf", initial_elo: 1500, discord_id: null },
      ],
    });
    const result = diffSnapshots(snap(), after);
    expect(result.problems).toEqual([]);
    expect(result.allowed).toEqual(["players Kevin: discord_id set to 340500831973670913"]);
  });

  it("flags a discord_id that is changed or cleared", () => {
    const before = snap({ players: [{ name: "Kevin", initial_elo: 1500, discord_id: "1" }] });
    const changed = snap({ players: [{ name: "Kevin", initial_elo: 1500, discord_id: "2" }] });
    const cleared = snap({ players: [{ name: "Kevin", initial_elo: 1500, discord_id: null }] });
    expect(diffSnapshots(before, changed).problems).toHaveLength(1);
    expect(diffSnapshots(before, cleared).problems).toHaveLength(1);
  });

  it("flags a missing row in any table", () => {
    const after = snap({ match_history: [] });
    expect(diffSnapshots(snap(), after).problems).toEqual(["match_history m1: row missing"]);
  });

  it("flags a changed value in a non-discord column", () => {
    const after = snap({ player_ratings: [{ name: "Kevin", rating: 1500, wins: 3 }] });
    expect(diffSnapshots(snap(), after).problems).toEqual([
      "player_ratings Kevin: rating changed 1600 -> 1500",
    ]);
  });

  it("compares JSON columns by value, not identity", () => {
    const after = snap({ match_history: [{ id: "m1", team1_score: 10, rating_changes: { Kevin: 12 } }] });
    expect(diffSnapshots(snap(), after).problems).toEqual([]);
  });

  it("flags added rows so a match recorded mid-migration gets noticed", () => {
    const after = snap({ settings: [...snap().tables.settings, { key: "x", value: 1 }] });
    expect(diffSnapshots(snap(), after).problems).toEqual(["settings x: row added"]);
  });

  it("flags a table that is missing from the new snapshot", () => {
    const after = { tables: { ...snap().tables } };
    delete after.tables.settings;
    expect(diffSnapshots(snap(), after).problems).toEqual(["settings: table missing"]);
  });

  it("flags duplicate keys in the new snapshot", () => {
    const after = snap({
      players: [
        { name: "Kevin", initial_elo: 1500 },
        { name: "Kevin", initial_elo: 1600 },
        { name: "Rolf", initial_elo: 1500 },
      ],
    });
    expect(diffSnapshots(snap(), after).problems).toContain("players: duplicate keys in new snapshot");
  });
});
