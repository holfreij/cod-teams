import { MatchResult, PlayerMatchStats, PlayerRating } from "./types";

export interface RatedPlayer {
  name: string;
  rating: number;
}

export interface PerformanceMatchInput {
  team1: RatedPlayer[];
  team2: RatedPlayer[];
  team1Score: number;
  team2Score: number;
  team1Stats: PlayerMatchStats[];
  team2Stats: PlayerMatchStats[];
  kFactor?: number;
  kPerf?: number;
  // ELO points subtracted from the smaller team's average rating, reflecting
  // the material disadvantage of playing shorthanded (see calculateUnevenTeamHandicap).
  // Makes the larger team the expected winner, so they gain less for winning
  // and the smaller team loses less for losing. Ignored for even teams.
  handicap?: number;
}

// Margin-of-victory multiplier on the team delta: 10-9 -> 0.8, 10-0 -> 1.25
const MOV_BASE = 0.75;
const MOV_PER_POINT = 1 / 20;

const expectedScore = (teamAvgRating: number, opponentAvgRating: number): number =>
  1 / (1 + Math.pow(10, (opponentAvgRating - teamAvgRating) / 400));

// Calculate rating change based on ELO system
// Using standard k-factor of 32 for active players
// Note: Individual player rating isn't used; only team averages matter for fair team-based ELO
// actualScore: 1 = win, 0.5 = draw, 0 = loss
export const calculateRatingChange = (
  teamAvgRating: number,
  opponentAvgRating: number,
  actualScore: number,
  kFactor: number = 32
): number => {
  return Math.round(kFactor * (actualScore - expectedScore(teamAvgRating, opponentAvgRating)));
};

// Performance-weighted ELO for matches with per-player screenshot stats:
//   delta = MoV x teamDelta + kPerf x clamp(playerScore / matchMeanScore - 1, -1, +1)
// The performance term sums to ~0 across the lobby, so it redistributes points
// (strong losers can gain, weak winners can lose) without inflating total rating.
export const calculatePerformanceRatingChanges = (
  input: PerformanceMatchInput
): { [playerName: string]: number } => {
  const { team1, team2, team1Score, team2Score, team1Stats, team2Stats } = input;
  const kFactor = input.kFactor ?? 32;
  const kPerf = input.kPerf ?? 16;

  const avg = (players: RatedPlayer[]) =>
    players.reduce((sum, p) => sum + p.rating, 0) / players.length;
  const handicap = input.handicap ?? 0;
  const team1Avg = avg(team1) - (team1.length < team2.length ? handicap : 0);
  const team2Avg = avg(team2) - (team2.length < team1.length ? handicap : 0);

  const team1Actual = team1Score > team2Score ? 1 : team1Score < team2Score ? 0 : 0.5;
  const mov = MOV_BASE + Math.abs(team1Score - team2Score) * MOV_PER_POINT;

  const team1Delta = kFactor * (team1Actual - expectedScore(team1Avg, team2Avg)) * mov;
  const team2Delta = kFactor * (1 - team1Actual - expectedScore(team2Avg, team1Avg)) * mov;

  const allStats = [...team1Stats, ...team2Stats];
  const meanScore = allStats.length
    ? allStats.reduce((sum, s) => sum + s.score, 0) / allStats.length
    : 0;

  const performanceTerm = (name: string): number => {
    if (meanScore <= 0) return 0;
    const row = allStats.find((s) => s.name === name);
    if (!row) return 0;
    const share = row.score / meanScore;
    return kPerf * Math.max(-1, Math.min(1, share - 1));
  };

  const changes: { [playerName: string]: number } = {};
  team1.forEach((p) => {
    changes[p.name] = Math.round(team1Delta + performanceTerm(p.name));
  });
  team2.forEach((p) => {
    changes[p.name] = Math.round(team2Delta + performanceTerm(p.name));
  });
  return changes;
};

// Rebuild all player ratings from scratch: initial ELO plus every stored
// per-match rating change. Keeps ratings consistent after match deletions
// and lets the two storage backends self-heal.
export const recomputeRatings = (
  players: { name: string; initialElo: number }[],
  matches: MatchResult[]
): { [playerName: string]: PlayerRating } => {
  const ratings: { [playerName: string]: PlayerRating } = {};

  players.forEach((p) => {
    ratings[p.name] = {
      name: p.name,
      rating: p.initialElo,
      wins: 0,
      losses: 0,
      draws: 0,
      gamesPlayed: 0,
    };
  });

  matches.forEach((match) => {
    Object.entries(match.ratingChanges).forEach(([playerName, change]) => {
      if (!ratings[playerName]) {
        ratings[playerName] = {
          name: playerName,
          rating: 1500,
          wins: 0,
          losses: 0,
          draws: 0,
          gamesPlayed: 0,
        };
      }

      const rating = ratings[playerName];
      rating.rating += change;
      rating.gamesPlayed += 1;

      const isTeam1 = match.team1.some((p) => p.name === playerName);
      if (match.winner === 0) {
        rating.draws += 1;
      } else if ((isTeam1 && match.winner === 1) || (!isTeam1 && match.winner === 2)) {
        rating.wins += 1;
      } else {
        rating.losses += 1;
      }
    });
  });

  return ratings;
};
