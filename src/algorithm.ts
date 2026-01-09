import { PlayerStats } from './types';

export type TeamResults = {
  team1: PlayerStats[];
  team2: PlayerStats[];
  strengthDifference: number;
};

export type { PlayerStats };

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
  handicapCoefficient: number
): TeamResults[] {
  // Apply temporary rating adjustments for "on fire" or "noob" players
  // These are small temporary boosts/penalties (±50 ELO) for current session
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
  const halfSize = Math.floor(totalPlayers / 2);
  const teamCombinations: TeamResults[] = [];

  const possibleTeam1Combinations = getCombinations(updatedPlayers, halfSize);
  const seenTeams = new Set<string>();

  for (const team1 of possibleTeam1Combinations) {
    const team2 = updatedPlayers.filter((p) => !team1.includes(p));

    const team1Names = team1
      .map((p) => p.name)
      .sort()
      .join("");
    const team2Names = team2
      .map((p) => p.name)
      .sort()
      .join("");
    const teamKey =
      team1Names < team2Names
        ? `${team1Names}-${team2Names}`
        : `${team2Names}-${team1Names}`;

    if (seenTeams.has(teamKey)) continue;
    seenTeams.add(teamKey);

    let team1Strength = team1.reduce((sum, p) => sum + p.strength, 0);
    let team2Strength = team2.reduce((sum, p) => sum + p.strength, 0);

    // Apply handicap for uneven teams during team generation
    // This ensures the smaller team gets stronger players to compensate
    const isUnevenTeams = team1.length !== team2.length;
    if (isUnevenTeams) {
      const smallerSize = Math.min(team1.length, team2.length);
      const largerSize = Math.max(team1.length, team2.length);
      const ratio = 1 - (smallerSize / largerSize);
      const handicap = Math.round(handicapCoefficient * ratio);

      // Add handicap to the smaller team's strength
      if (team1.length < team2.length) {
        team1Strength += handicap;
      } else {
        team2Strength += handicap;
      }
    }

    const strengthDifference = Math.abs(team1Strength - team2Strength);

    teamCombinations.push({
      team1,
      team2,
      strengthDifference: strengthDifference,
    });
  }

  return teamCombinations;
}
