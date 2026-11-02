import { describe, it, expect } from "vitest";
import { lastPlayedByLineup, lastPlayedLabel, lineupKey } from "./lastPlayed";

// Local-time dates, so the tests hold in any timezone
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

describe("lastPlayedLabel", () => {
  const now = at(2026, 11, 3, 9, 0);

  it("compares calendar days, not 24h windows", () => {
    expect(lastPlayedLabel(at(2026, 11, 3, 0, 5), now)).toBe("vandaag");
    expect(lastPlayedLabel(at(2026, 11, 2, 23, 55), now)).toBe("gisteren");
    expect(lastPlayedLabel(at(2026, 11, 2, 0, 5), at(2026, 11, 3, 23, 55))).toBe("gisteren");
  });

  it("treats a date in the future as today", () => {
    expect(lastPlayedLabel(at(2026, 11, 4), now)).toBe("vandaag");
  });

  it("counts days for 2 to 5 days ago", () => {
    expect(lastPlayedLabel(at(2026, 11, 1), now)).toBe("2 dagen geleden");
    expect(lastPlayedLabel(at(2026, 10, 29), now)).toBe("5 dagen geleden");
  });

  it("says last week for 6 to 13 days ago", () => {
    expect(lastPlayedLabel(at(2026, 10, 28), now)).toBe("vorige week");
    expect(lastPlayedLabel(at(2026, 10, 21), now)).toBe("vorige week");
  });

  it("counts weeks for 14 to 27 days ago", () => {
    expect(lastPlayedLabel(at(2026, 10, 20), now)).toBe("2 weken geleden");
    expect(lastPlayedLabel(at(2026, 10, 14), now)).toBe("2 weken geleden");
    expect(lastPlayedLabel(at(2026, 10, 13), now)).toBe("3 weken geleden");
    expect(lastPlayedLabel(at(2026, 10, 7), now)).toBe("3 weken geleden");
  });

  it("shows a short date from 28 days ago", () => {
    expect(lastPlayedLabel(at(2026, 10, 6), now)).toBe("6 okt");
    expect(lastPlayedLabel(at(2026, 3, 1), now)).toBe("1 mrt");
  });

  it("adds the year when it is not the current year", () => {
    expect(lastPlayedLabel(at(2025, 12, 14), now)).toBe("14 dec 2025");
    expect(lastPlayedLabel(at(2025, 12, 31), at(2026, 1, 1))).toBe("gisteren");
  });

  it("is not thrown off by a daylight saving change", () => {
    // Europe switches clocks on the last Sunday of October
    expect(lastPlayedLabel(at(2026, 10, 24, 0, 30), at(2026, 10, 26, 23, 30))).toBe("2 dagen geleden");
  });
});

describe("lineupKey", () => {
  it("ignores order within a team and which side is which", () => {
    const key = lineupKey(["A", "B"], ["C", "D"]);
    expect(lineupKey(["B", "A"], ["D", "C"])).toBe(key);
    expect(lineupKey(["D", "C"], ["A", "B"])).toBe(key);
  });

  it("distinguishes different splits of the same players", () => {
    expect(lineupKey(["A", "C"], ["B", "D"])).not.toBe(lineupKey(["A", "B"], ["C", "D"]));
  });
});

describe("lastPlayedByLineup", () => {
  const match = (team1: string[], team2: string[], date: Date) => ({
    team1: team1.map((name) => ({ name })),
    team2: team2.map((name) => ({ name })),
    date,
  });

  it("keeps the most recent match per lineup, whatever the history order", () => {
    const lookup = lastPlayedByLineup([
      match(["A", "B"], ["C", "D"], at(2026, 10, 1)),
      match(["D", "C"], ["B", "A"], at(2026, 10, 20)),
      match(["A", "B"], ["C", "D"], at(2026, 10, 10)),
    ]);
    expect(lookup.get(lineupKey(["A", "B"], ["C", "D"]))).toEqual(at(2026, 10, 20));
  });

  it("only counts exact lineups, not subsets", () => {
    const lookup = lastPlayedByLineup([match(["A", "B", "E"], ["C", "D"], at(2026, 10, 1))]);
    expect(lookup.get(lineupKey(["A", "B"], ["C", "D"]))).toBeUndefined();
  });
});
