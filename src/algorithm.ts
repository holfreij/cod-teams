export type PlayerStats = {
  strength: number;
  handicap: number;
  name: string;
};

export type TeamResults = {
  team1: PlayerStats[];
  team2: PlayerStats[];
  strengthDifference: number;
};

export function createBalancedTeams(
  playerStats: PlayerStats[],
  strengthDifference: number
): TeamResults[] {
  const scale = 100; // Scale factor to handle decimal precision
  const scaledPlayerStrengths = playerStats.map((item) =>
    Math.round(item.strength * item.handicap * scale)
  );
  const totalPlayerStrength = scaledPlayerStrengths.reduce(
    (sum, num) => sum + num,
    0
  );
  const numberOfPlayers = scaledPlayerStrengths.length;

  // Target is half the total sum to minimize the difference
  const targetTeamStrength = Math.floor(totalPlayerStrength / 2);

  // DP table: dp[i][j] is true if a subset of the first i numbers has a sum of j
  const dp: boolean[][] = Array.from({ length: numberOfPlayers + 1 }, () =>
    Array(targetTeamStrength + 1).fill(false)
  );
  dp[0][0] = true; // Base case: a sum of 0 is possible with 0 elements

  // Fill the DP table
  for (let i = 1; i <= numberOfPlayers; i++) {
    for (let j = 0; j <= targetTeamStrength; j++) {
      dp[i][j] = dp[i - 1][j]; // Exclude the current number
      if (j >= scaledPlayerStrengths[i - 1]) {
        dp[i][j] = dp[i][j] || dp[i - 1][j - scaledPlayerStrengths[i - 1]]; // Include the current number
      }
    }
  }

  // Collect valid subsets that meet the delta condition
  const balancedTeams: TeamResults[] = [];
  for (let sum1 = 0; sum1 <= targetTeamStrength; sum1++) {
    if (dp[numberOfPlayers][sum1]) {
      const sum2 = totalPlayerStrength - sum1;
      const difference = Math.abs(sum1 - sum2);
      if (difference <= strengthDifference * scale) {
        const { team1, team2 } = backtrack(
          playerStats,
          scaledPlayerStrengths,
          dp,
          numberOfPlayers,
          sum1
        );
        balancedTeams.push({
          team1,
          team2,
          strengthDifference: difference / scale,
        });
      }
    }
  }

  return balancedTeams;
}

// Backtracking to determine the subset for a given sum
function backtrack(
  playerStats: PlayerStats[],
  scaledPlayerStrengths: number[],
  dp: boolean[][],
  numberOfPlayers: number,
  teamStrength: number
): { team1: PlayerStats[]; team2: PlayerStats[] } {
  const team1: PlayerStats[] = [];
  const team2: PlayerStats[] = [...playerStats];
  let i = numberOfPlayers;
  let j = teamStrength;

  while (i > 0 && j > 0) {
    if (dp[i][j] && !dp[i - 1][j]) {
      team1.push(playerStats[i - 1]); // Include this item in group1
      team2.splice(team2.indexOf(playerStats[i - 1]), 1); // Remove it from group2
      j -= scaledPlayerStrengths[i - 1];
    }
    i--;
  }

  return { team1, team2 };
}
