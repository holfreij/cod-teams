import { describe, it, expect } from "vitest";
import {
  DEFAULT_GAME_MODE,
  GAME_MODE_LIST,
  toGameMode,
  validateScores,
  winTargetOf,
} from "./gameMode";

describe("toGameMode", () => {
  it("keeps a known mode", () => {
    expect(toGameMode("demolition")).toBe("demolition");
    expect(toGameMode("search_and_destroy")).toBe("search_and_destroy");
  });

  it("falls back to Search and Destroy for anything else", () => {
    // Matches rows written before the game_mode column existed
    expect(toGameMode(null)).toBe("search_and_destroy");
    expect(toGameMode(undefined)).toBe("search_and_destroy");
    expect(toGameMode("Domination")).toBe("search_and_destroy");
    expect(toGameMode(2)).toBe("search_and_destroy");
  });

  it("agrees with DEFAULT_GAME_MODE", () => {
    expect(toGameMode(null)).toBe(DEFAULT_GAME_MODE);
  });
});

describe("winTargetOf", () => {
  it("is 10 for Search and Destroy and 2 for Demolition", () => {
    expect(winTargetOf("search_and_destroy")).toBe(10);
    expect(winTargetOf("demolition")).toBe(2);
  });

  it("covers every listed mode", () => {
    GAME_MODE_LIST.forEach((mode) => {
      expect(winTargetOf(mode)).toBeGreaterThan(0);
    });
  });
});

describe("validateScores", () => {
  it("accepts a Search and Destroy result", () => {
    expect(validateScores("search_and_destroy", 10, 7)).toBeNull();
    expect(validateScores("search_and_destroy", 3, 10)).toBeNull();
    expect(validateScores("search_and_destroy", 10, 0)).toBeNull();
  });

  it("accepts a Demolition result", () => {
    expect(validateScores("demolition", 2, 1)).toBeNull();
    expect(validateScores("demolition", 0, 2)).toBeNull();
  });

  it("rejects a Demolition score of 10", () => {
    expect(validateScores("demolition", 10, 7)).toBe(
      "Één team moet precies 2 scoren om te winnen"
    );
  });

  it("rejects a Search and Destroy score of 2", () => {
    expect(validateScores("search_and_destroy", 2, 1)).toBe(
      "Één team moet precies 10 scoren om te winnen"
    );
  });

  it("rejects a losing score above the target", () => {
    expect(validateScores("demolition", 2, 3)).toBe(
      "Score van verliezend team moet tussen 0 en 1 zijn"
    );
    expect(validateScores("search_and_destroy", 12, 10)).toBe(
      "Score van verliezend team moet tussen 0 en 9 zijn"
    );
  });

  it("rejects both teams reaching the target", () => {
    expect(validateScores("demolition", 2, 2)).toBe(
      "Beide teams kunnen niet allebei 2 scoren"
    );
  });

  it("rejects negative and non-numeric scores", () => {
    expect(validateScores("demolition", -1, 2)).toBe("Scores kunnen niet negatief zijn");
    expect(validateScores("demolition", NaN, 2)).toBe("Vul geldige scores in");
  });
});
