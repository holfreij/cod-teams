import { PlayerMatchStats } from "./types";

// Per-team scoreboard rows of a screenshot-recorded match, as edited before saving
export interface ScoreSheet {
  team1: PlayerMatchStats[];
  team2: PlayerMatchStats[];
}

// Row for a player who quit (alt+F4) before the result screen: CoD drops them
// from the scoreboard, but they played and share their team's result
export const leaverRow = (name: string): PlayerMatchStats => ({
  name,
  score: 0,
  kills: 0,
  deaths: 0,
  plants: 0,
  defuses: 0,
  left: true,
});

const namesOn = (sheet: ScoreSheet) => [...sheet.team1, ...sheet.team2].map((s) => s.name);

// Add a leaver to a team; a no-op for a player already on the sheet
export const addLeaver = (sheet: ScoreSheet, team: 1 | 2, name: string): ScoreSheet => {
  if (namesOn(sheet).includes(name)) return sheet;
  return team === 1
    ? { ...sheet, team1: [...sheet.team1, leaverRow(name)] }
    : { ...sheet, team2: [...sheet.team2, leaverRow(name)] };
};

// Remove a hand-added leaver; scoreboard rows read from the screenshot stay
export const removeLeaver = (sheet: ScoreSheet, name: string): ScoreSheet => ({
  team1: sheet.team1.filter((s) => !(s.left && s.name === name)),
  team2: sheet.team2.filter((s) => !(s.left && s.name === name)),
});

// Players who can still be added: everyone not on either team yet
export const addablePlayers = (sheet: ScoreSheet, allNames: string[]): string[] => {
  const taken = namesOn(sheet);
  return allNames.filter((n) => !taken.includes(n));
};

