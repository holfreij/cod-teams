export type PlayerStats = {
  strength: number;
  name: string;
};

export type TeamResults = {
  team1: PlayerStats[];
  team2: PlayerStats[];
  strengthDifference: number;
};

function getCombinations<T>(arr: T[], size: number): T[][] {
  if (size > arr.length) return [];
  if (size === 0) return [[]];
  if (size === arr.length) return [arr];

  const result: T[][] = [];
  function helper(start: number, combination: T[]) {
    if (combination.length === size) {
      result.push([...combination]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combination.push(arr[i]);
      helper(i + 1, combination);
      combination.pop();
    }
  }

  helper(0, []);
  return result;
}

export function createBalancedTeams(
  players: PlayerStats[],
  buffedPlayers: string[],
  nerfedPlayers: string[],
  unevenTeamsPenalty: number
): TeamResults[] {
  const updatedPlayers = players.map((player) => ({
    ...player,
    strength:
      player.strength +
      (buffedPlayers.includes(player.name)
        ? 30
        : nerfedPlayers.includes(player.name)
        ? -30
        : 0),
  }));

  const totalPlayers = updatedPlayers.length;
  const halfSize = Math.floor(totalPlayers / 2);
  const teamCombinations: TeamResults[] = [];

  const possibleTeam1Combinations = getCombinations(updatedPlayers, halfSize);

  for (const team1 of possibleTeam1Combinations) {
    const team2 = updatedPlayers.filter((p) => !team1.includes(p));

    const team1Strength = team1.reduce((sum, p) => sum + p.strength, 0);
    const team2Strength = team2.reduce((sum, p) => sum + p.strength, 0);

    const unevenSizedTeam = team1.length < team2.length;

    const strengthDifference = Math.abs(
      (unevenSizedTeam ? team1Strength - unevenTeamsPenalty : team1Strength) -
        team2Strength
    );

      teamCombinations.push({
        team1,
        team2,
        strengthDifference: strengthDifference,
      });
  }

  return teamCombinations;
}
