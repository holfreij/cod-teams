/**
 * Team Balancing Algorithm
 *
 * This module implements a sophisticated team balancing system for multiplayer games.
 * It generates all possible team combinations and evaluates them based on total
 * team strength (sum of player ELO ratings).
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
  strengthDifference: number; // Lower values = more balanced teams
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
 * by comparing total team strengths (sum of player ELO ratings). For uneven team sizes
 * (e.g., 2v3, 5v6), it applies a handicap system to ensure fair matchups.
 *
 * @param players - Array of players with their ELO ratings
 * @param buffedPlayers - Players who are "on fire" (get temporary +50 ELO boost)
 * @param nerfedPlayers - Players having an off day (get temporary -50 ELO penalty)
 * @param handicapCoefficient - Base handicap value for uneven teams (typically 300)
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

    // Calculate total team strength (sum of all player ELO ratings)
    let team1Strength = team1.reduce((sum, p) => sum + p.strength, 0);
    let team2Strength = team2.reduce((sum, p) => sum + p.strength, 0);

    // ============================================================================
    // UNEVEN TEAM HANDICAP SYSTEM
    // ============================================================================
    //
    // When teams have different sizes (e.g., 2v3 or 5v6), we apply a handicap
    // to ensure fair matchups. The handicap is SUBTRACTED from the smaller team's
    // strength during team generation.
    //
    // WHY SUBTRACT (NOT ADD)?
    // -----------------------
    // By subtracting points from the smaller team's strength, we make them appear
    // WEAKER to the balancing algorithm. This forces the algorithm to compensate by
    // assigning STRONGER players to the smaller team.
    //
    // EXAMPLE (2v3 scenario with handicap = 100):
    // -----------------------
    // Let's say we have 5 players with ratings: [2000, 1800, 1600, 1400, 1200]
    //
    // Without handicap:
    //   Option A: Team1 (2 players): [2000, 1800] = 3800
    //             Team2 (3 players): [1600, 1400, 1200] = 4200
    //   Difference: 400 points (unbalanced!)
    //
    // With handicap subtracted from smaller team:
    //   Option A: Team1 (2 players): [2000, 1800] = 3800 - 100 = 3700
    //             Team2 (3 players): [1600, 1400, 1200] = 4200
    //   Difference: 500 points (worse - algorithm rejects this)
    //
    //   Option B: Team1 (2 players): [2000, 1600] = 3600 - 100 = 3500
    //             Team2 (3 players): [1800, 1400, 1200] = 4400
    //   Difference: 900 points (even worse)
    //
    //   ✅ Best: Team1 (2 players): [2000, 1800] = 3800 - 100 = 3700
    //             Team2 (3 players): [1600, 1400, 1200] = 4200
    //   The algorithm naturally picks the combo where the smaller team has
    //   the two STRONGEST players because only that minimizes the difference
    //   after handicap subtraction.
    //
    // THE KEY INSIGHT:
    // -----------------------
    // The handicap subtraction creates an artificial gap that can ONLY be closed
    // by giving the smaller team disproportionately strong players. The algorithm,
    // seeking the minimum strength difference, is forced to make this choice.
    //
    // HANDICAP CALCULATION:
    // -----------------------
    // Handicap = Coefficient × (1 - SmallerSize / LargerSize)
    //
    // The ratio (1 - SmallerSize/LargerSize) represents the proportional disadvantage:
    //   - 2v3: (1 - 2/3) = 0.33 → 33% disadvantage → handicap = coefficient × 0.33
    //   - 5v6: (1 - 5/6) = 0.17 → 17% disadvantage → handicap = coefficient × 0.17
    //   - 3v5: (1 - 3/5) = 0.40 → 40% disadvantage → handicap = coefficient × 0.40
    //
    // This ensures smaller teams with greater disadvantages receive proportionally
    // larger handicaps, resulting in even stronger player assignments.
    //
    // ADAPTIVE COEFFICIENT:
    // -----------------------
    // The coefficient (typically ~300) is NOT fixed. It learns from match results:
    //   - If smaller teams win more than expected → coefficient decreases
    //   - If smaller teams lose more than expected → coefficient increases
    // This creates a feedback loop that converges on optimal team balance over time.
    //
    // ============================================================================

    const isUnevenTeams = team1.length !== team2.length;
    if (isUnevenTeams) {
      const smallerSize = Math.min(team1.length, team2.length);
      const largerSize = Math.max(team1.length, team2.length);

      // Calculate proportional disadvantage (0 to 1 range)
      // The more uneven the teams, the larger the ratio
      const ratio = 1 - (smallerSize / largerSize);

      // Calculate actual handicap points to subtract
      // Example: coefficient=300, ratio=0.33 → handicap=100 points
      const handicap = Math.round(handicapCoefficient * ratio);

      // Subtract handicap from the SMALLER team's strength
      // This forces the algorithm to assign them stronger players to compensate
      if (team1.length < team2.length) {
        team1Strength -= handicap;
      } else {
        team2Strength -= handicap;
      }
    }

    // Calculate the absolute difference between adjusted team strengths
    // The algorithm will sort combinations by this value and prefer the smallest differences
    const strengthDifference = Math.abs(team1Strength - team2Strength);

    // Store this team combination with its balance score
    teamCombinations.push({
      team1,
      team2,
      strengthDifference: strengthDifference, // Lower = more balanced
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
