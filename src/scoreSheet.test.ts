import { describe, it, expect } from "vitest";
import {
  addLeaver,
  addablePlayers,
  leaverRow,
  removeLeaver,
} from "./scoreSheet";

const row = (name: string, score = 1000) => ({
  name,
  score,
  kills: 5,
  deaths: 5,
  plants: 0,
  defuses: 0,
});

const sheet = {
  team1: [row("Kevin"), row("Rolf")],
  team2: [row("Maarten"), row("Thomas")],
};

describe("addLeaver", () => {
  it("adds a zero row marked as left to the chosen team", () => {
    const next = addLeaver(sheet, 2, "Joel");
    expect(next.team2).toEqual([row("Maarten"), row("Thomas"), leaverRow("Joel")]);
    expect(leaverRow("Joel")).toMatchObject({ score: 0, left: true });
  });

  it("supports several leavers per team", () => {
    const next = addLeaver(addLeaver(sheet, 1, "Scott"), 1, "Rick");
    expect(next.team1.map((s) => s.name)).toEqual(["Kevin", "Rolf", "Scott", "Rick"]);
  });

  it("ignores a player already on either team", () => {
    expect(addLeaver(sheet, 2, "Kevin")).toBe(sheet);
  });
});

describe("removeLeaver", () => {
  it("removes a hand-added leaver", () => {
    expect(removeLeaver(addLeaver(sheet, 1, "Scott"), "Scott")).toEqual(sheet);
  });

  it("keeps scoreboard rows read from the screenshot", () => {
    expect(removeLeaver(sheet, "Kevin")).toEqual(sheet);
  });
});

describe("addablePlayers", () => {
  it("lists everyone not on the sheet yet", () => {
    const all = ["Kevin", "Rolf", "Maarten", "Thomas", "Joel", "Scott"];
    expect(addablePlayers(addLeaver(sheet, 1, "Scott"), all)).toEqual(["Joel"]);
  });
});
