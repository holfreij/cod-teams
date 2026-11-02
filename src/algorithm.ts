/**
 * Team Balancing Algorithm
 *
 * This module implements a sophisticated team balancing system for multiplayer games.
 * It generates all possible team combinations and evaluates them based on
 * average team rating (mean player ELO), with a handicap for uneven team sizes.
 *
 * Key Features:
 * - Handles even teams (3v3, 4v4) and uneven teams (2v3, 5v6)
 * - Applies adaptive handicapping for uneven team sizes
 * - Supports temporary player buffs/nerfs for session-specific adjustments
 * - Sorts results by balance quality (smallest strength difference = most balanced)
 */

import { PlayerStats } from './types';

export type TeamResults = {
  team1: PlayerStats[];
  team2: PlayerStats[];
  team1Advantage: number; // Effective average-rating gap, positive = team1 favoured
  strengthDifference: number; // |team1Advantage|; lower values = more balanced teams
};

export type { PlayerStats };

/**
 * Generates all possible combinations of selecting 'size' items from an array.
 * Uses recursive backtracking to efficiently enumerate combinations.
 *
 * @param arr - Input array of items
 * @param size - Number of items to select per combination
 * @returns Array of all possible combinations
 *
 * @example
 * getCombinations([1, 2, 3], 2) → [[1,2], [1,3], [2,3]]
 */
function getCombinations<T>(arr: T[], size: number): T[][] {
  if (size > arr.length) return [];
  if (size === 0) return [[]];
  if (size === arr.length) return [arr];

  const result: T[][] = [];

  // Recursive helper function using backtracking
  function helper(start: number, combination: T[]) {
    // Base case: combination is complete
    if (combination.length === size) {
      result.push([...combination]);
      return;
    }

    // Try adding each remaining element
    for (let i = start; i < arr.length; i++) {
      combination.push(arr[i]);      // Add element
      helper(i + 1, combination);    // Recurse
      combination.pop();              // Backtrack
    }
  }

  helper(0, []);
  return result;
}

/**
 * Creates balanced team combinations from a list of players.
 *
 * This function generates all possible team combinations and evaluates their balance
 * by comparing average team ratings (mean player ELO). For uneven team sizes
 * (e.g., 2v3, 5v6), it applies a handicap system to ensure fair matchups.
 *
 * @param players - Array of players with their ELO ratings
 * @param buffedPlayers - Players who are "on fire" (get temporary +50 ELO boost)
 * @param nerfedPlayers - Players having an off day (get temporary -50 ELO penalty)
 * @param handicapCoefficient - Handicap coefficient for uneven teams (ELO points, adaptive)
 * @returns Array of all possible team combinations, sorted by balance quality
 */
export function createBalancedTeams(
  players: PlayerStats[],
  buffedPlayers: string[],
  nerfedPlayers: string[],
  handicapCoefficient: number,
  maxResults: number = 100 // Limit results for better performance
): TeamResults[] {
  // Apply temporary rating adjustments for "on fire" or "noob" players
  // These are small temporary boosts/penalties (±50 ELO) for current session
  // Note: These are NOT permanent - they only affect team generation, not stored ratings
  const updatedPlayers = players.map((player) => ({
    ...player,
    strength:
      player.strength +
      (buffedPlayers.includes(player.name)
        ? 50
        : nerfedPlayers.includes(player.name)
        ? -50
        : 0),
  }));

  const totalPlayers = updatedPlayers.length;
  const halfSize = Math.floor(totalPlayers / 2); // Smaller team size for uneven splits
  const teamCombinations: TeamResults[] = [];

  // Generate all possible combinations of players for team1
  // (team2 is automatically the remaining players)
  const possibleTeam1Combinations = getCombinations(updatedPlayers, halfSize);

  // Track seen team pairs to avoid duplicates
  // Example: [A,B] vs [C,D] is the same as [C,D] vs [A,B]
  const seenTeams = new Set<string>();

  for (const team1 of possibleTeam1Combinations) {
    // Team2 consists of all players NOT in team1
    const team2 = updatedPlayers.filter((p) => !team1.includes(p));

    // Create a unique key for this team pairing to detect duplicates
    // Sort names alphabetically and combine into a string
    const team1Names = team1
      .map((p) => p.name)
      .sort()
      .join("");
    const team2Names = team2
      .map((p) => p.name)
      .sort()
      .join("");

    // Ensure consistent ordering (smaller lexicographically first)
    // This prevents counting [A,B] vs [C,D] and [C,D] vs [A,B] as different
    const teamKey =
      team1Names < team2Names
        ? `${team1Names}-${team2Names}`
        : `${team2Names}-${team1Names}`;

    // Skip duplicate team pairings
    if (seenTeams.has(teamKey)) continue;
    seenTeams.add(teamKey);

    // Compare team AVERAGE ratings, not sums. ELO is not a ratio scale (everyone
    // sits around 1500), so with sums the extra player on the larger team counts
    // as a whole ~1500 points the smaller team must make up - far more than the
    // real disadvantage of playing one short, especially in bigger lobbies.
    // Averages are also what the rating update uses (see MatchHistory), so the
    // generator and the learned handicap describe the same thing.
    const avg = (team: PlayerStats[]) =>
      team.reduce((sum, p) => sum + p.strength, 0) / team.length;
    let team1Strength = avg(team1);
    let team2Strength = avg(team2);

    // ============================================================================
    // UNEVEN TEAM HANDICAP SYSTEM
    // ============================================================================
    //
    // When teams have different sizes (e.g. 2v3 or 4v5), the smaller team is
    // treated as `handicap` ELO points weaker than its average rating. To balance
    // that, the algorithm must give the smaller team players whose average is
    // about `handicap` points higher than the larger team's average.
    //
    // HANDICAP CALCULATION:
    //   Handicap = Coefficient x (1 - SmallerSize / LargerSize)
    //   - 2v3: 0.33 x coefficient
    //   - 3v4: 0.25 x coefficient
    //   - 4v5: 0.20 x coefficient
    // One missing player hurts less the bigger the teams are.
    //
    // ADAPTIVE COEFFICIENT:
    //   The coefficient learns from uneven match results (see
    //   nextHandicapCoefficient in rating.ts): if the smaller team wins more than
    //   expected it decreases, if it loses more than expected it increases.
    //
    // ============================================================================

    const isUnevenTeams = team1.length !== team2.length;
    if (isUnevenTeams) {
      const smallerSize = Math.min(team1.length, team2.length);
      const largerSize = Math.max(team1.length, team2.length);
      const handicap = handicapCoefficient * (1 - smallerSize / largerSize);

      if (team1.length < team2.length) {
        team1Strength -= handicap;
      } else {
        team2Strength -= handicap;
      }
    }

    // Signed difference in effective average rating (positive = team1 favoured).
    // The algorithm sorts by its absolute value and prefers the smallest.
    const team1Advantage = Math.round(team1Strength - team2Strength);

    // Store this team combination with its balance score
    teamCombinations.push({
      team1,
      team2,
      team1Advantage,
      strengthDifference: Math.abs(team1Advantage), // Lower = more balanced
    });

    // Performance optimization: periodically prune results to keep only top N
    // This reduces memory usage and speeds up subsequent iterations
    if (teamCombinations.length >= maxResults * 2) {
      teamCombinations.sort((a, b) => a.strengthDifference - b.strengthDifference);
      teamCombinations.splice(maxResults); // Keep only top N
    }
  }

  // Sort by balance quality and return top results
  // Lower strengthDifference = more balanced teams
  teamCombinations.sort((a, b) => a.strengthDifference - b.strengthDifference);

  // Return only the top results to reduce memory usage and improve performance
  return teamCombinations.slice(0, maxResults);
}
