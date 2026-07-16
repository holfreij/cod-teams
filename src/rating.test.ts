import { describe, it, expect } from "vitest";
import {
  calculateRatingChange,
  calculatePerformanceRatingChanges,
  marginOfVictoryFactor,
  recomputeRatings,
  RatedPlayer,
} from "./rating";
import { MatchResult, PlayerMatchStats } from "./types";

const stats = (name: string, score: number): PlayerMatchStats => ({
  name,
  score,
  kills: 0,
  deaths: 0,
  plants: 0,
  defuses: 0,
});

const player = (name: string, rating = 1500): RatedPlayer => ({ name, rating });

describe("calculateRatingChange", () => {
  it("gives +16 for a win between equally rated teams", () => {
    expect(calculateRatingChange(1500, 1500, 1)).toBe(16);
  });

  it("gives -16 for a loss between equally rated teams", () => {
    expect(calculateRatingChange(1500, 1500, 0)).toBe(-16);
  });

  it("gives 0 for a draw between equally rated teams", () => {
    expect(calculateRatingChange(1500, 1500, 0.5)).toBe(0);
  });

  it("is zero-sum for a draw between unequally rated teams", () => {
    const favorite = calculateRatingChange(1600, 1400, 0.5);
    const underdog = calculateRatingChange(1400, 1600, 0.5);
    expect(favorite).toBe(-8);
    expect(underdog).toBe(8);
  });

  it("gives the favorite less for a win than an even matchup would", () => {
    expect(calculateRatingChange(1600, 1400, 1)).toBe(8);
    expect(calculateRatingChange(1400, 1600, 0)).toBe(-8);
  });
});

describe("marginOfVictoryFactor", () => {
  it("dampens narrow wins and amplifies blowouts", () => {
    expect(marginOfVictoryFactor(10, 9)).toBe(0.8);
    expect(marginOfVictoryFactor(10, 5)).toBe(1);
    expect(marginOfVictoryFactor(10, 0)).toBe(1.25);
  });

  it("is symmetric in the team order", () => {
    expect(marginOfVictoryFactor(9, 10)).toBe(0.8);
  });
});

describe("calculatePerformanceRatingChanges", () => {
  // The real 3v4 S&D match from 2026-07-15, all players at 1500:
  // Team 1 (lost 9-10): Kevin 4175, Joel 3325, Rolf 1175
  // Team 2 (won): Maarten 2775, Frank 2250, Lennard 1675, Guido 250
  const realMatch = {
    team1: [player("Kevin"), player("Joel"), player("Rolf")],
    team2: [player("Maarten"), player("Frank"), player("Lennard"), player("Guido")],
    team1Score: 9,
    team2Score: 10,
    team1Stats: [stats("Kevin", 4175), stats("Joel", 3325), stats("Rolf", 1175)],
    team2Stats: [
      stats("Maarten", 2775),
      stats("Frank", 2250),
      stats("Lennard", 1675),
      stats("Guido", 250),
    ],
  };

  it("rewards strong losers and punishes weak winners (real match example)", () => {
    const changes = calculatePerformanceRatingChanges(realMatch);
    expect(changes).toEqual({
      Kevin: 1, // top scorer gains despite losing
      Joel: -5,
      Rolf: -20,
      Maarten: 17,
      Frank: 13,
      Lennard: 9,
      Guido: -1, // bottom scorer loses rating despite winning
    });
  });

  it("keeps the total rating change zero-sum for even teams", () => {
    const changes = calculatePerformanceRatingChanges({
      team1: [player("A"), player("B")],
      team2: [player("C"), player("D")],
      team1Score: 10,
      team2Score: 8,
      team1Stats: [stats("A", 3000), stats("B", 1000)],
      team2Stats: [stats("C", 2500), stats("D", 1500)],
    });
    expect(changes).toEqual({ A: 22, B: 6, C: -10, D: -18 });
    const sum = Object.values(changes).reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);
  });

  it("scales the team delta by margin of victory", () => {
    // 10-0 blowout, identical performances: pure team delta x 1.25
    const changes = calculatePerformanceRatingChanges({
      team1: [player("A"), player("B")],
      team2: [player("C"), player("D")],
      team1Score: 10,
      team2Score: 0,
      team1Stats: [stats("A", 2000), stats("B", 2000)],
      team2Stats: [stats("C", 2000), stats("D", 2000)],
    });
    expect(changes).toEqual({ A: 20, B: 20, C: -20, D: -20 });
  });

  it("caps the performance bonus at kPerf", () => {
    const changes = calculatePerformanceRatingChanges({
      team1: [player("A"), player("B")],
      team2: [player("C"), player("D")],
      team1Score: 10,
      team2Score: 5, // margin 5 -> MoV factor exactly 1
      team1Stats: [stats("A", 8000), stats("B", 0)],
      team2Stats: [stats("C", 0), stats("D", 0)],
    });
    // A's share is 4x the mean; uncapped bonus would be +48, cap is +16
    expect(changes.A).toBe(32);
  });

  it("gives a roster player missing from the stats a plain team delta", () => {
    const changes = calculatePerformanceRatingChanges({
      team1: [player("A"), player("B")],
      team2: [player("C"), player("D")],
      team1Score: 10,
      team2Score: 9,
      team1Stats: [stats("A", 3000)], // B missed by the model
      team2Stats: [stats("C", 2000), stats("D", 1000)],
    });
    expect(changes).toEqual({ A: 21, B: 13, C: -13, D: -21 });
  });

  it("ignores stat rows that match no roster player", () => {
    const changes = calculatePerformanceRatingChanges({
      team1: [player("A"), player("B")],
      team2: [player("C"), player("D")],
      team1Score: 10,
      team2Score: 9,
      team1Stats: [stats("A", 2000), stats("B", 2000), stats("Rando", 2000)],
      team2Stats: [stats("C", 2000), stats("D", 2000)],
    });
    expect(Object.keys(changes).sort()).toEqual(["A", "B", "C", "D"]);
  });

  it("makes the larger team the favorite via the uneven-team handicap", () => {
    const changes = calculatePerformanceRatingChanges({
      team1: [player("A"), player("B"), player("C")],
      team2: [player("D"), player("E"), player("F"), player("G")],
      team1Score: 9,
      team2Score: 10,
      team1Stats: [stats("A", 2000), stats("B", 2000), stats("C", 2000)],
      team2Stats: [stats("D", 2000), stats("E", 2000), stats("F", 2000), stats("G", 2000)],
      handicap: 400, // smaller team's avg treated as 400 lower -> big team expected to win
    });
    expect(changes).toEqual({ A: -2, B: -2, C: -2, D: 2, E: 2, F: 2, G: 2 });
  });

  it("ignores the handicap for even teams", () => {
    const changes = calculatePerformanceRatingChanges({
      team1: [player("A")],
      team2: [player("B")],
      team1Score: 10,
      team2Score: 9,
      team1Stats: [stats("A", 2000)],
      team2Stats: [stats("B", 2000)],
      handicap: 400,
    });
    expect(changes).toEqual({ A: 13, B: -13 });
  });

  it("applies no performance term when all scores are zero", () => {
    const changes = calculatePerformanceRatingChanges({
      team1: [player("A")],
      team2: [player("B")],
      team1Score: 10,
      team2Score: 9,
      team1Stats: [stats("A", 0)],
      team2Stats: [stats("B", 0)],
    });
    expect(changes).toEqual({ A: 13, B: -13 });
  });
});

describe("recomputeRatings", () => {
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

  it("returns players at their initial ELO when there is no history", () => {
    const ratings = recomputeRatings(
      [{ name: "Alice", initialElo: 1500 }, { name: "Bob", initialElo: 1450 }],
      []
    );
    expect(ratings.Alice).toEqual({
      name: "Alice",
      rating: 1500,
      wins: 0,
      losses: 0,
      draws: 0,
      gamesPlayed: 0,
    });
    expect(ratings.Bob.rating).toBe(1450);
  });

  it("replays stored rating changes and win/loss counts from history", () => {
    const matches = [
      makeMatch({
        id: "1",
        team1: [{ name: "Alice", strength: 1500 }],
        team2: [{ name: "Bob", strength: 1600 }],
        winner: 1,
        ratingChanges: { Alice: 10, Bob: -10 },
      }),
      makeMatch({
        id: "2",
        team1: [{ name: "Alice", strength: 1510 }],
        team2: [{ name: "Bob", strength: 1590 }],
        winner: 2,
        ratingChanges: { Alice: -5, Bob: 5 },
      }),
    ];
    const ratings = recomputeRatings(
      [{ name: "Alice", initialElo: 1500 }, { name: "Bob", initialElo: 1600 }],
      matches
    );
    expect(ratings.Alice).toEqual({
      name: "Alice",
      rating: 1505,
      wins: 1,
      losses: 1,
      draws: 0,
      gamesPlayed: 2,
    });
    expect(ratings.Bob).toEqual({
      name: "Bob",
      rating: 1595,
      wins: 1,
      losses: 1,
      draws: 0,
      gamesPlayed: 2,
    });
  });

  it("counts draws", () => {
    const ratings = recomputeRatings(
      [{ name: "Alice", initialElo: 1500 }],
      [
        makeMatch({
          team1: [{ name: "Alice", strength: 1500 }],
          team2: [{ name: "Bob", strength: 1500 }],
          winner: 0,
          ratingChanges: { Alice: 3, Bob: -3 },
        }),
      ]
    );
    expect(ratings.Alice.draws).toBe(1);
    expect(ratings.Alice.rating).toBe(1503);
  });

  it("seeds players missing from the players list at 1500", () => {
    const ratings = recomputeRatings(
      [],
      [
        makeMatch({
          team1: [{ name: "Dave", strength: 1500 }],
          team2: [{ name: "Eve", strength: 1500 }],
          winner: 1,
          ratingChanges: { Dave: 7, Eve: -7 },
        }),
      ]
    );
    expect(ratings.Dave.rating).toBe(1507);
    expect(ratings.Dave.wins).toBe(1);
    expect(ratings.Eve.rating).toBe(1493);
  });
});
