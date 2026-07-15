import { describe, it, expect } from "vitest";
import { buildRatingTimeline } from "./ratingTimeline";
import { MatchResult } from "./types";

const makeMatch = (overrides: Partial<MatchResult>): MatchResult => ({
  id: "1",
  date: new Date("2026-01-01"),
  team1: [],
  team2: [],
  team1Score: 10,
  team2Score: 5,
  winner: 1,
  ratingChanges: {},
  ...overrides,
});

const players = [
  { name: "Alice", initialElo: 1500 },
  { name: "Bob", initialElo: 1400 },
  { name: "Carol", initialElo: 1600 },
];

describe("buildRatingTimeline", () => {
  it("returns an empty timeline when there are no matches", () => {
    expect(buildRatingTimeline(players, [])).toEqual([]);
  });

  it("starts at initial ELO and carries ratings forward through matches", () => {
    const matches = [
      makeMatch({
        id: "m1",
        date: new Date("2026-01-01"),
        ratingChanges: { Alice: 10, Bob: -10 },
      }),
      makeMatch({
        id: "m2",
        date: new Date("2026-01-02"),
        ratingChanges: { Alice: -5, Carol: 5 },
      }),
    ];
    expect(buildRatingTimeline(players, matches)).toEqual([
      { date: new Date("2026-01-01"), ratings: { Alice: 1500, Bob: 1400, Carol: 1600 } },
      { date: new Date("2026-01-01"), ratings: { Alice: 1510, Bob: 1390, Carol: 1600 } },
      { date: new Date("2026-01-02"), ratings: { Alice: 1505, Bob: 1390, Carol: 1605 } },
    ]);
  });

  it("sorts matches chronologically regardless of input order", () => {
    const matches = [
      makeMatch({
        id: "later",
        date: new Date("2026-02-01"),
        ratingChanges: { Alice: 20 },
      }),
      makeMatch({
        id: "earlier",
        date: new Date("2026-01-01"),
        ratingChanges: { Alice: -20 },
      }),
    ];
    const timeline = buildRatingTimeline(players, matches);
    expect(timeline.map((row) => row.ratings.Alice)).toEqual([1500, 1480, 1500]);
  });

  it("seeds players missing from the players list at 1500", () => {
    const matches = [
      makeMatch({ ratingChanges: { Dave: 7 } }),
    ];
    const timeline = buildRatingTimeline([], matches);
    expect(timeline[0].ratings.Dave).toBe(1500);
    expect(timeline[1].ratings.Dave).toBe(1507);
  });
});
