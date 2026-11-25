export interface TeamSelection {
  team1: string[];
  team2: string[];
}

// Toggle a player on/off a team; selecting a player already on the other
// team moves them, so the same player can never be on both teams.
export const toggleTeamMembership = (
  selection: TeamSelection,
  team: 1 | 2,
  name: string
): TeamSelection => {
  const target = team === 1 ? "team1" : "team2";
  const other = team === 1 ? "team2" : "team1";

  if (selection[target].includes(name)) {
    return { ...selection, [target]: selection[target].filter((n) => n !== name) };
  }
  return {
    ...selection,
    [target]: [...selection[target], name],
    [other]: selection[other].filter((n) => n !== name),
  } as TeamSelection;
};

export interface Leaver {
  name: string;
  team: 1 | 2;
}

// Players picked for the match who are missing from the scoreboard screenshot,
// usually because they quit (alt+F4) before the result screen. CoD drops them
// from the scoreboard, but they played and must share their team's result.
// A player who shows up on either side of the scoreboard is not a leaver,
// even if they switched teams.
export const findLeavers = (scoreboard: TeamSelection, selected: TeamSelection): Leaver[] => {
  const onScoreboard = new Set([...scoreboard.team1, ...scoreboard.team2]);
  return ([1, 2] as const).flatMap((team) =>
    (team === 1 ? selected.team1 : selected.team2)
      .filter((name) => !onScoreboard.has(name))
      .map((name) => ({ name, team }))
  );
};

// The scoreboard roster plus every leaver not in `excluded`, on their selected team.
export const withLeavers = (
  scoreboard: TeamSelection,
  leavers: Leaver[],
  excluded: string[]
): TeamSelection => {
  const included = leavers.filter((l) => !excluded.includes(l.name));
  return {
    team1: [...scoreboard.team1, ...included.filter((l) => l.team === 1).map((l) => l.name)],
    team2: [...scoreboard.team2, ...included.filter((l) => l.team === 2).map((l) => l.name)],
  };
};
