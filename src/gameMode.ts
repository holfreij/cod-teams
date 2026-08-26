export type GameMode = "search_and_destroy" | "demolition";

export interface GameModeInfo {
  // Dutch label for the UI
  label: string;
  // Round score the winning team must reach exactly
  winTarget: number;
  // How the mode is spelled on the Call of Duty result screen, used by the
  // screenshot analyser prompt
  screenshotLabel: string;
}

export const GAME_MODES: Record<GameMode, GameModeInfo> = {
  search_and_destroy: {
    label: "Search & Destroy",
    winTarget: 10,
    screenshotLabel: "Search and Destroy",
  },
  demolition: {
    label: "Demolition",
    winTarget: 2,
    screenshotLabel: "Demolition",
  },
};

// Every match logged before game modes existed was Search and Destroy, so it
// doubles as the fallback for rows without a game_mode column.
export const DEFAULT_GAME_MODE: GameMode = "search_and_destroy";

export const GAME_MODE_LIST = Object.keys(GAME_MODES) as GameMode[];

export const isGameMode = (value: unknown): value is GameMode =>
  typeof value === "string" && value in GAME_MODES;

// Coerce anything stored, parsed or returned by the AI into a valid mode.
export const toGameMode = (value: unknown): GameMode =>
  isGameMode(value) ? value : DEFAULT_GAME_MODE;

export const winTargetOf = (mode: GameMode): number => GAME_MODES[mode].winTarget;

// Validate a pair of round scores for a mode: exactly one team reaches the
// win target, the other lands between 0 and target-1. Returns a Dutch error
// message, or null when the scores are valid.
export const validateScores = (
  mode: GameMode,
  team1Score: number,
  team2Score: number
): string | null => {
  const target = winTargetOf(mode);

  if (!Number.isInteger(team1Score) || !Number.isInteger(team2Score)) {
    return "Vul geldige scores in";
  }
  if (team1Score < 0 || team2Score < 0) {
    return "Scores kunnen niet negatief zijn";
  }
  if (team1Score !== target && team2Score !== target) {
    return `Één team moet precies ${target} scoren om te winnen`;
  }
  if (team1Score === target && team2Score === target) {
    return `Beide teams kunnen niet allebei ${target} scoren`;
  }

  const loserScore = team1Score === target ? team2Score : team1Score;
  if (loserScore > target - 1) {
    return `Score van verliezend team moet tussen 0 en ${target - 1} zijn`;
  }

  return null;
};
