import { MatchResult, PlayerRating } from './types';

const MATCH_HISTORY_KEY = 'qmg_match_history';
const PLAYER_RATINGS_KEY = 'qmg_player_ratings';

// Match History functions
export const saveMatchResult = (match: MatchResult): void => {
  const history = getMatchHistory();
  history.push(match);
  localStorage.setItem(MATCH_HISTORY_KEY, JSON.stringify(history));
};

export const getMatchHistory = (): MatchResult[] => {
  const data = localStorage.getItem(MATCH_HISTORY_KEY);
  if (!data) return [];

  try {
    const parsed = JSON.parse(data);
    // Convert date strings back to Date objects
    return parsed.map((match: any) => ({
      ...match,
      date: new Date(match.date),
    }));
  } catch {
    return [];
  }
};

export const clearMatchHistory = (): void => {
  localStorage.removeItem(MATCH_HISTORY_KEY);
};

export const deleteMatch = (matchId: string): void => {
  const history = getMatchHistory();
  const filtered = history.filter(match => match.id !== matchId);
  localStorage.setItem(MATCH_HISTORY_KEY, JSON.stringify(filtered));
};

// Player Ratings functions
export const getPlayerRatings = (): { [playerName: string]: PlayerRating } => {
  const data = localStorage.getItem(PLAYER_RATINGS_KEY);
  if (!data) return {};

  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
};

export const savePlayerRatings = (ratings: { [playerName: string]: PlayerRating }): void => {
  localStorage.setItem(PLAYER_RATINGS_KEY, JSON.stringify(ratings));
};

export const updatePlayerRatings = (match: MatchResult): void => {
  const ratings = getPlayerRatings();

  // Update each player's rating
  Object.entries(match.ratingChanges).forEach(([playerName, change]) => {
    if (!ratings[playerName]) {
      ratings[playerName] = {
        name: playerName,
        rating: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        gamesPlayed: 0,
      };
    }

    ratings[playerName].rating += change;
    ratings[playerName].gamesPlayed += 1;

    // Determine if this player won, lost, or drew
    const isTeam1 = match.team1.some(p => p.name === playerName);
    if (match.winner === 0) {
      ratings[playerName].draws += 1;
    } else if ((isTeam1 && match.winner === 1) || (!isTeam1 && match.winner === 2)) {
      ratings[playerName].wins += 1;
    } else {
      ratings[playerName].losses += 1;
    }
  });

  savePlayerRatings(ratings);
};

export const resetPlayerRatings = (): void => {
  localStorage.removeItem(PLAYER_RATINGS_KEY);
};

// Calculate rating change based on ELO system
export const calculateRatingChange = (
  _playerRating: number,
  teamAvgRating: number,
  opponentAvgRating: number,
  won: boolean,
  kFactor: number = 32
): number => {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentAvgRating - teamAvgRating) / 400));
  const actualScore = won ? 1 : 0;
  return Math.round(kFactor * (actualScore - expectedScore));
};

// Export/Import functions for backup
export const exportData = (): string => {
  const data = {
    matchHistory: getMatchHistory(),
    playerRatings: getPlayerRatings(),
    exportDate: new Date(),
  };
  return JSON.stringify(data, null, 2);
};

export const importData = (jsonString: string): boolean => {
  try {
    const data = JSON.parse(jsonString);
    if (data.matchHistory) {
      localStorage.setItem(MATCH_HISTORY_KEY, JSON.stringify(data.matchHistory));
    }
    if (data.playerRatings) {
      localStorage.setItem(PLAYER_RATINGS_KEY, JSON.stringify(data.playerRatings));
    }
    return true;
  } catch {
    return false;
  }
};
