import { describe, it, expect } from "vitest";
import { toggleTeamMembership } from "./teamSelection";

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
