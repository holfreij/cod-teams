import { describe, it, expect } from "vitest";
import { playerToRow, rowToPlayer } from "./playerRows";

describe("rowToPlayer", () => {
  it("maps discord_id to discordId", () => {
    expect(rowToPlayer({ name: "Kevin", initial_elo: 1500, discord_id: "340500831973670913" }))
      .toEqual({ name: "Kevin", initialElo: 1500, discordId: "340500831973670913" });
  });

  it("omits discordId when the column is null or absent (pre-migration database)", () => {
    expect(rowToPlayer({ name: "Kevin", initial_elo: 1500, discord_id: null }))
      .toEqual({ name: "Kevin", initialElo: 1500 });
    expect(rowToPlayer({ name: "Kevin", initial_elo: 1500 }))
      .toEqual({ name: "Kevin", initialElo: 1500 });
  });
});

describe("playerToRow", () => {
  it("writes discord_id so a delete-and-reinsert save keeps the mapping", () => {
    expect(playerToRow({ name: "Kevin", initialElo: 1500, discordId: "340500831973670913" }))
      .toEqual({ name: "Kevin", initial_elo: 1500, discord_id: "340500831973670913" });
  });

  it("writes null when there is no discordId", () => {
    expect(playerToRow({ name: "Kevin", initialElo: 1500 }))
      .toEqual({ name: "Kevin", initial_elo: 1500, discord_id: null });
  });

  it("round-trips", () => {
    const p = { name: "Rolf", initialElo: 1500, discordId: "364542389353709570" };
    expect(rowToPlayer(playerToRow(p))).toEqual(p);
  });
});
