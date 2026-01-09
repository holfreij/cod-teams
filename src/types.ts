export interface PlayerStats {
  strength: number;
  name: string;
}

export interface MatchResult {
  id: string;
  date: Date;
  team1: PlayerStats[];
  team2: PlayerStats[];
  team1Score: number;
  team2Score: number;
  winner: 1 | 2 | 0; // 0 = draw
  mapPlayed?: string;
  ratingChanges: { [playerName: string]: number };
}

export interface PlayerRating {
  name: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
}
