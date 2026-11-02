import { describe, it, expect } from "vitest";
import { createBalancedTeams, PlayerStats } from "./algorithm";

const players = (ratings: Record<string, number>): PlayerStats[] =>
  Object.entries(ratings).map(([name, strength]) => ({ name, strength }));

const avg = (team: PlayerStats[]) =>
  team.reduce((sum, p) => sum + p.strength, 0) / team.length;

const bestSplit = (pool: PlayerStats[], coefficient: number) => {
  const best = createBalancedTeams(pool, [], [], coefficient)[0];
  return best.team1.length < best.team2.length
    ? { small: best.team1, large: best.team2, best }
    : { small: best.team2, large: best.team1, best };
};

const NINE = players({
  Kevin: 2456, Thomas: 2111, Rolf: 1857, Maarten: 1787, Frank: 1630,
  Lennard: 1521, Joel: 1459, Rick: 1438, Scott: 842,
});

describe("createBalancedTeams", () => {
  it("balances even teams on average rating", () => {
    const best = createBalancedTeams(players({ A: 2000, B: 1800, C: 1600, D: 1400 }), [], [], 1440)[0];
    expect(best.strengthDifference).toBe(0);
    expect(avg(best.team1)).toBe(avg(best.team2));
  });

  it("without a handicap, does not stack the smaller team to make up a whole player", () => {
    // Summing ratings forced the 4-player team ~375 average points stronger
    // even at coefficient 0; on averages it should be near-even
    const { small, large } = bestSplit(NINE, 0);
    expect(Math.abs(avg(small) - avg(large))).toBeLessThan(30);
  });

  it("gives the smaller team an average edge close to the handicap in 4v5", () => {
    // coefficient 1440 x (1 - 4/5) = 288
    const { small, large } = bestSplit(NINE, 1440);
    const gap = avg(small) - avg(large);
    expect(gap).toBeGreaterThan(288 - 40);
    expect(gap).toBeLessThan(288 + 40);
  });

  it("asks for a bigger edge in 2v3 than in 4v5 at the same coefficient", () => {
    const five = players({ A: 2200, B: 2000, C: 1800, D: 1600, E: 1400 });
    const { small, large } = bestSplit(five, 900); // handicap 300
    expect(avg(small) - avg(large)).toBeGreaterThan(200);
  });

  it("reports the signed handicap-adjusted gap as team1Advantage", () => {
    const { small, large, best } = bestSplit(NINE, 1440);
    const smallAdvantage = avg(small) - 288 - avg(large);
    const team1IsSmall = best.team1 === small;
    expect(best.team1Advantage).toBe(Math.round(team1IsSmall ? smallAdvantage : -smallAdvantage));
    expect(best.strengthDifference).toBe(Math.abs(best.team1Advantage));
  });
});
