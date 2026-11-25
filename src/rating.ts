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
  // Round score the winner must reach, from the match's game mode (see gameMode.ts).
  // Normalises the margin-of-victory multiplier across modes.
  winTarget?: number;
  // ELO points subtracted from the smaller team's average rating, reflecting
  // the material disadvantage of playing shorthanded (see calculateUnevenTeamHandicap).
  // Makes the larger team the expected winner, so they gain less for winning
  // and the smaller team loses less for losing. Ignored for even teams.
  handicap?: number;
}

export const DEFAULT_K_FACTOR = 32;

// Margin-of-victory multiplier on the team delta, scaled by the mode's win
// target so every mode spans the same 0.75-1.25 range: a 10-0 Search and
// Destroy and a 2-0 Demolition are both maximum blowouts.
// S&D (target 10): 10-9 -> 0.8, 10-5 -> 1.0, 10-0 -> 1.25.
// Demolition (target 2): 2-1 -> 1.0, 2-0 -> 1.25.
// Applies to both rating paths (manual and screenshot).
const MOV_BASE = 0.75;
const MOV_RANGE = 0.5;
const DEFAULT_WIN_TARGET = 10;

export const marginOfVictoryFactor = (
  team1Score: number,
  team2Score: number,
  winTarget: number = DEFAULT_WIN_TARGET
): number =>
  MOV_BASE + (Math.abs(team1Score - team2Score) / winTarget) * MOV_RANGE;

export const expectedScore = (teamAvgRating: number, opponentAvgRating: number): number =>
  1 / (1 + Math.pow(10, (opponentAvgRating - teamAvgRating) / 400));

// Step size for learning the uneven-team handicap, in ELO points of handicap
// per unit of surprise - the same scale as a player's K-factor.
const HANDICAP_K = 32;
const MAX_HANDICAP_COEFFICIENT = 3000;

// Next uneven-team handicap coefficient after a match. Moves the handicap by
// HANDICAP_K x (expected - actual) for the smaller team, so an upset moves it a
// lot and an expected result barely at all. Converted back to coefficient
// units via the size ratio: the same handicap step is a bigger coefficient
// step in a 4v5 (ratio 0.2) than in a 2v3 (ratio 0.33).
// smallerActual: 1 = smaller team won, 0.5 = draw, 0 = lost.
export const nextHandicapCoefficient = (
  currentCoefficient: number,
  smallerSize: number,
  largerSize: number,
  smallerActual: number,
  smallerExpected: number
): number => {
  const ratio = 1 - smallerSize / largerSize;
  if (ratio <= 0) return currentCoefficient;
  const handicapStep = HANDICAP_K * (smallerExpected - smallerActual);
  const next = currentCoefficient + handicapStep / ratio;
  return Math.round(Math.max(0, Math.min(MAX_HANDICAP_COEFFICIENT, next)));
};

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

// ELO gap at which one player is expected to outscore another 10x on the
// scoreboard. Fitted on the 319 scoreboard rows up to 2026-11-25 (log score
// share vs rating minus lobby mean, r = 0.72).
export const SCORE_SHARE_ELO_SCALE = 2000;

// Score share each player's rating predicts: 10^((rating - lobby mean) / scale),
// normalised so the lobby averages 1, the same scale as an actual score share.
export const expectedScoreShares = (
  players: RatedPlayer[]
): { [playerName: string]: number } => {
  if (!players.length) return {};
  const meanRating = players.reduce((sum, p) => sum + p.rating, 0) / players.length;
  const weights = players.map((p) =>
    Math.pow(10, (p.rating - meanRating) / SCORE_SHARE_ELO_SCALE)
  );
  const meanWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
  return Object.fromEntries(players.map((p, i) => [p.name, weights[i] / meanWeight]));
};

// Performance-weighted ELO for matches with per-player screenshot stats:
//   delta = MoV x teamDelta + kPerf x clamp(scoreShare - expectedShare, -1, +1)
// scoreShare = playerScore / lobby mean score; expectedShare comes from the
// player's rating (expectedScoreShares). Judging against the expectation is
// what lets ratings settle: a top scorer who is already rated as one gains
// nothing extra for top-scoring again. Both shares average 1 over the lobby,
// so the term sums to ~0 and redistributes points without inflating ratings.
// Roster players without a stats row (missed by the model, or quit before the
// scoreboard) get the plain team delta.
export const calculatePerformanceRatingChanges = (
  input: PerformanceMatchInput
): { [playerName: string]: number } => {
  const { team1, team2, team1Score, team2Score, team1Stats, team2Stats } = input;
  const kFactor = input.kFactor ?? DEFAULT_K_FACTOR;
  const kPerf = input.kPerf ?? 16;

  const avg = (players: RatedPlayer[]) =>
    players.reduce((sum, p) => sum + p.rating, 0) / players.length;
  const handicap = input.handicap ?? 0;
  const team1Avg = avg(team1) - (team1.length < team2.length ? handicap : 0);
  const team2Avg = avg(team2) - (team2.length < team1.length ? handicap : 0);

  const team1Actual = team1Score > team2Score ? 1 : team1Score < team2Score ? 0 : 0.5;
  const mov = marginOfVictoryFactor(team1Score, team2Score, input.winTarget);

  const team1Delta = kFactor * (team1Actual - expectedScore(team1Avg, team2Avg)) * mov;
  const team2Delta = kFactor * (1 - team1Actual - expectedScore(team2Avg, team1Avg)) * mov;

  // Only rows for roster players: their ratings set the expected shares
  const roster = [...team1, ...team2];
  const allStats = [...team1Stats, ...team2Stats].filter((s) =>
    roster.some((p) => p.name === s.name)
  );
  const meanScore = allStats.length
    ? allStats.reduce((sum, s) => sum + s.score, 0) / allStats.length
    : 0;
  const expectedShares = expectedScoreShares(
    roster.filter((p) => allStats.some((s) => s.name === p.name))
  );

  const performanceTerm = (name: string): number => {
    if (meanScore <= 0) return 0;
    const row = allStats.find((s) => s.name === name);
    if (!row) return 0;
    const share = row.score / meanScore;
    return kPerf * Math.max(-1, Math.min(1, share - expectedShares[name]));
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
