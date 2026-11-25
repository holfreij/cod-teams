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
