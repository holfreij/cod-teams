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
  maxStrengthDifference: number,
  unevenTeamsPenalty: number
): TeamResults[] {
  const totalPlayers = players.length;
  const halfSize = Math.floor(totalPlayers / 2);
  const teamCombinations: TeamResults[] = [];

  const possibleTeam1Combinations = getCombinations(players, halfSize);

  for (const team1 of possibleTeam1Combinations) {
    const team2 = players.filter((p) => !team1.includes(p));

    const team1Strength = team1.reduce(
      (sum, p) =>
        sum +
        p.strength +
        (buffedPlayers.includes(p.name) ? 0.5 : 0) -
        (nerfedPlayers.includes(p.name) ? 0.5 : 0),
      0
    );
    const team2Strength = team2.reduce(
      (sum, p) =>
        sum +
        p.strength +
        (buffedPlayers.includes(p.name) ? 0.5 : 0) -
        (nerfedPlayers.includes(p.name) ? 0.5 : 0),
      0
    );

    const unevenSizedTeam = team1.length < team2.length;

    const strengthDifference = Math.abs(
      (unevenSizedTeam ? team1Strength - unevenTeamsPenalty : team1Strength) -
        team2Strength
    );

    if (strengthDifference < maxStrengthDifference)
      teamCombinations.push({
        team1,
        team2,
        strengthDifference: strengthDifference,
      });
  }

  return teamCombinations;
}
