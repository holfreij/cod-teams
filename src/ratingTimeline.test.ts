import { describe, it, expect } from "vitest";
import { buildRatingTimeline, countGamesPerPlayer } from "./ratingTimeline";
import { MatchResult } from "./types";

const makeMatch = (overrides: Partial<MatchResult>): MatchResult => ({
  id: "1",
  date: new Date(2026, 0, 1, 20, 30), // Jan 1st, evening (local time)
  team1: [],
  team2: [],
  team1Score: 10,
  team2Score: 5,
  winner: 1,
  gameMode: "search_and_destroy",
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

  it("starts at initial ELO the day before and carries ratings forward per day", () => {
    const matches = [
      makeMatch({
        id: "m1",
        date: new Date(2026, 0, 1, 20, 30),
        ratingChanges: { Alice: 10, Bob: -10 },
      }),
      makeMatch({
        id: "m2",
        date: new Date(2026, 0, 2, 21, 0),
        ratingChanges: { Alice: -5, Carol: 5 },
      }),
    ];
    expect(buildRatingTimeline(players, matches)).toEqual([
      { date: new Date(2025, 11, 31), ratings: { Alice: 1500, Bob: 1400, Carol: 1600 } },
      { date: new Date(2026, 0, 1), ratings: { Alice: 1510, Bob: 1390, Carol: 1600 } },
      { date: new Date(2026, 0, 2), ratings: { Alice: 1505, Bob: 1390, Carol: 1605 } },
    ]);
  });

  it("collapses multiple matches on the same day into one end-of-day point", () => {
    const matches = [
      makeMatch({
        id: "m1",
        date: new Date(2026, 0, 1, 20, 0),
        ratingChanges: { Alice: 10 },
      }),
      makeMatch({
        id: "m2",
        date: new Date(2026, 0, 1, 22, 15),
        ratingChanges: { Alice: 5 },
      }),
    ];
    const timeline = buildRatingTimeline(players, matches);
    expect(timeline).toHaveLength(2); // baseline + one point for the day
    expect(timeline[1]).toEqual({
      date: new Date(2026, 0, 1),
      ratings: { Alice: 1515, Bob: 1400, Carol: 1600 },
    });
  });

  it("sorts matches chronologically regardless of input order", () => {
    const matches = [
      makeMatch({
        id: "later",
        date: new Date(2026, 1, 1, 20, 0),
        ratingChanges: { Alice: 20 },
      }),
      makeMatch({
        id: "earlier",
        date: new Date(2026, 0, 1, 20, 0),
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

describe("countGamesPerPlayer", () => {
  it("counts how many matches each player appears in", () => {
    const matches = [
      makeMatch({ id: "1", ratingChanges: { Alice: 10, Bob: -10 } }),
      makeMatch({ id: "2", ratingChanges: { Alice: -5, Carol: 5 } }),
    ];
    expect(countGamesPerPlayer(matches)).toEqual({ Alice: 2, Bob: 1, Carol: 1 });
  });

  it("returns an empty object for no matches", () => {
    expect(countGamesPerPlayer([])).toEqual({});
  });
});
