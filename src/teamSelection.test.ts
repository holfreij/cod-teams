import { describe, it, expect } from "vitest";
import { findLeavers, toggleTeamMembership, withLeavers } from "./teamSelection";

describe("toggleTeamMembership", () => {
  it("adds a player to an empty team", () => {
    const result = toggleTeamMembership({ team1: [], team2: [] }, 1, "Kevin");
    expect(result).toEqual({ team1: ["Kevin"], team2: [] });
  });

  it("removes a player already on that team", () => {
    const result = toggleTeamMembership({ team1: ["Kevin", "Joel"], team2: [] }, 1, "Kevin");
    expect(result).toEqual({ team1: ["Joel"], team2: [] });
  });

  it("moves a player selected on the other team", () => {
    const result = toggleTeamMembership({ team1: ["Kevin"], team2: ["Guido"] }, 2, "Kevin");
    expect(result).toEqual({ team1: [], team2: ["Guido", "Kevin"] });
  });

  it("leaves other players untouched", () => {
    const result = toggleTeamMembership(
      { team1: ["Kevin", "Joel"], team2: ["Guido"] },
      2,
      "Rolf"
    );
    expect(result).toEqual({ team1: ["Kevin", "Joel"], team2: ["Guido", "Rolf"] });
  });
});

describe("findLeavers", () => {
  it("finds selected players missing from the scoreboard, with their team", () => {
    const scoreboard = { team1: ["Kevin", "Rolf"], team2: ["Maarten", "Thomas", "Joel"] };
    const selected = { team1: ["Kevin", "Rolf", "Scott"], team2: ["Maarten", "Thomas", "Joel"] };
    expect(findLeavers(scoreboard, selected)).toEqual([{ name: "Scott", team: 1 }]);
  });

  it("follows the scoreboard when a player switched sides", () => {
    const scoreboard = { team1: ["Kevin", "Joel"], team2: ["Rolf"] };
    const selected = { team1: ["Kevin", "Rolf"], team2: ["Joel"] };
    expect(findLeavers(scoreboard, selected)).toEqual([]);
  });

  it("returns nothing without a selection", () => {
    expect(findLeavers({ team1: ["A"], team2: ["B"] }, { team1: [], team2: [] })).toEqual([]);
  });
});

describe("withLeavers", () => {
  it("adds included leavers to their selected team", () => {
    const scoreboard = { team1: ["Kevin"], team2: ["Maarten", "Joel"] };
    const leavers = [
      { name: "Scott", team: 1 as const },
      { name: "Rick", team: 2 as const },
    ];
    expect(withLeavers(scoreboard, leavers, ["Rick"])).toEqual({
      team1: ["Kevin", "Scott"],
      team2: ["Maarten", "Joel"],
    });
  });
});
