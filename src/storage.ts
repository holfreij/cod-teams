import { MatchResult, PlayerRating } from './types';
import { supabase } from './supabaseClient';

const MATCH_HISTORY_KEY = 'qmg_match_history';
const PLAYER_RATINGS_KEY = 'qmg_player_ratings';

// Check if Supabase is configured
const isSupabaseConfigured = () => {
  return !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
};

// Match History functions
export const saveMatchResult = async (match: MatchResult): Promise<void> => {
  if (isSupabaseConfigured()) {
    try {
      await supabase.from('match_history').insert({
        id: match.id,
        date: match.date.toISOString(),
        team1_players: match.team1.map(p => p.name),
        team2_players: match.team2.map(p => p.name),
        team1_score: match.team1Score,
        team2_score: match.team2Score,
        winner: match.winner,
        map_played: match.mapPlayed || null,
        rating_changes: match.ratingChanges,
      });
      return;
    } catch (error) {
      console.error('Error saving to Supabase, falling back to localStorage:', error);
    }
  }

  // Fallback to localStorage
  const history = await getMatchHistory();
  history.push(match);
  localStorage.setItem(MATCH_HISTORY_KEY, JSON.stringify(history));
};

export const getMatchHistory = async (): Promise<MatchResult[]> => {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('match_history')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        date: new Date(row.date),
        team1: row.team1_players.map((name: string) => ({ name, strength: 0 })),
        team2: row.team2_players.map((name: string) => ({ name, strength: 0 })),
        team1Score: row.team1_score,
        team2Score: row.team2_score,
        winner: row.winner,
        mapPlayed: row.map_played,
        ratingChanges: row.rating_changes,
      }));
    } catch (error) {
      console.error('Error fetching from Supabase, falling back to localStorage:', error);
    }
  }

  // Fallback to localStorage
  const data = localStorage.getItem(MATCH_HISTORY_KEY);
  if (!data) return [];

  try {
    const parsed = JSON.parse(data);
    return parsed.map((match: any) => ({
      ...match,
      date: new Date(match.date),
    }));
  } catch {
    return [];
  }
};

export const clearMatchHistory = async (): Promise<void> => {
  if (isSupabaseConfigured()) {
    try {
      await supabase.from('match_history').delete().neq('id', '');
      return;
    } catch (error) {
      console.error('Error clearing Supabase data:', error);
    }
  }

  localStorage.removeItem(MATCH_HISTORY_KEY);
};

export const deleteMatch = async (matchId: string): Promise<void> => {
  if (isSupabaseConfigured()) {
    try {
      await supabase.from('match_history').delete().eq('id', matchId);
      return;
    } catch (error) {
      console.error('Error deleting from Supabase:', error);
    }
  }

  const history = await getMatchHistory();
  const filtered = history.filter(match => match.id !== matchId);
  localStorage.setItem(MATCH_HISTORY_KEY, JSON.stringify(filtered));
};

// Player Ratings functions
export const getPlayerRatings = async (): Promise<{ [playerName: string]: PlayerRating }> => {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('player_ratings')
        .select('*');

      if (error) throw error;

      const ratings: { [playerName: string]: PlayerRating } = {};
      (data || []).forEach((row: any) => {
        ratings[row.name] = {
          name: row.name,
          rating: row.rating,
          wins: row.wins,
          losses: row.losses,
          draws: row.draws,
          gamesPlayed: row.games_played,
        };
      });
      return ratings;
    } catch (error) {
      console.error('Error fetching ratings from Supabase:', error);
    }
  }

  // Fallback to localStorage
  const data = localStorage.getItem(PLAYER_RATINGS_KEY);
  if (!data) return {};

  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
};

export const savePlayerRatings = async (ratings: { [playerName: string]: PlayerRating }): Promise<void> => {
  if (isSupabaseConfigured()) {
    try {
      const ratingsArray = Object.values(ratings).map(rating => ({
        name: rating.name,
        rating: rating.rating,
        wins: rating.wins,
        losses: rating.losses,
        draws: rating.draws,
        games_played: rating.gamesPlayed,
      }));

      await supabase.from('player_ratings').upsert(ratingsArray, {
        onConflict: 'name',
      });
      return;
    } catch (error) {
      console.error('Error saving ratings to Supabase:', error);
    }
  }

  localStorage.setItem(PLAYER_RATINGS_KEY, JSON.stringify(ratings));
};

export const updatePlayerRatings = async (match: MatchResult): Promise<void> => {
  const ratings = await getPlayerRatings();

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

  await savePlayerRatings(ratings);
};

export const resetPlayerRatings = async (): Promise<void> => {
  if (isSupabaseConfigured()) {
    try {
      await supabase.from('player_ratings').delete().neq('name', '');
      return;
    } catch (error) {
      console.error('Error resetting ratings in Supabase:', error);
    }
  }

  localStorage.removeItem(PLAYER_RATINGS_KEY);
};

// Calculate rating change based on ELO system
// Using a lower k-factor (16) for more gradual rating changes
export const calculateRatingChange = (
  _playerRating: number,
  teamAvgRating: number,
  opponentAvgRating: number,
  won: boolean,
  kFactor: number = 16
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
