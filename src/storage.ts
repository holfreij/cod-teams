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

  // Update each player's rating (ELO changes are applied directly)
  Object.entries(match.ratingChanges).forEach(([playerName, change]) => {
    if (!ratings[playerName]) {
      // Initialize with the player's current strength from the match
      // This captures their pre-match ELO
      const player = [...match.team1, ...match.team2].find(p => p.name === playerName);
      ratings[playerName] = {
        name: playerName,
        rating: player ? player.strength : 1500, // Fallback to 1500 if not found
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

// Uneven Team Handicap Management
const HANDICAP_COEFFICIENT_KEY = 'uneven_team_coefficient';
const DEFAULT_HANDICAP_COEFFICIENT = 300; // ELO points per full player disadvantage

export const getHandicapCoefficient = async (): Promise<number> => {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', HANDICAP_COEFFICIENT_KEY)
        .single();

      if (error) throw error;
      return data?.value as number || DEFAULT_HANDICAP_COEFFICIENT;
    } catch (error) {
      console.error('Error fetching handicap coefficient from Supabase:', error);
    }
  }

  // Fallback to localStorage
  const stored = localStorage.getItem(HANDICAP_COEFFICIENT_KEY);
  return stored ? parseFloat(stored) : DEFAULT_HANDICAP_COEFFICIENT;
};

export const updateHandicapCoefficient = async (newCoefficient: number): Promise<void> => {
  if (isSupabaseConfigured()) {
    try {
      await supabase.from('settings').upsert({
        key: HANDICAP_COEFFICIENT_KEY,
        value: newCoefficient,
      });
      return;
    } catch (error) {
      console.error('Error updating handicap coefficient in Supabase:', error);
    }
  }

  localStorage.setItem(HANDICAP_COEFFICIENT_KEY, newCoefficient.toString());
};

// Calculate handicap for uneven teams
// Returns ELO points to add to smaller team's rating
export const calculateUnevenTeamHandicap = (
  smallerTeamSize: number,
  largerTeamSize: number,
  coefficient: number
): number => {
  if (smallerTeamSize === largerTeamSize) return 0;

  // Handicap scales with team size ratio
  // 2v3: (1 - 2/3) = 0.33 → coefficient * 0.33
  // 5v6: (1 - 5/6) = 0.17 → coefficient * 0.17
  // This means 2v3 gets double the handicap of 5v6
  const ratio = 1 - (smallerTeamSize / largerTeamSize);
  return Math.round(coefficient * ratio);
};

// Update handicap coefficient based on match outcome
// If smaller team wins more than expected, reduce coefficient
// If smaller team loses more than expected, increase coefficient
export const adjustHandicapCoefficient = async (
  currentCoefficient: number,
  smallerTeamWon: boolean,
  expectedWinProbability: number
): Promise<number> => {
  // Learning rate: how quickly we adjust the coefficient
  const learningRate = 20;

  const actualOutcome = smallerTeamWon ? 1 : 0;
  const error = actualOutcome - expectedWinProbability;

  // If smaller team won when they shouldn't have, reduce handicap
  // If smaller team lost when they should have won, increase handicap
  const adjustment = -error * learningRate;

  const newCoefficient = Math.max(0, Math.min(1000, currentCoefficient + adjustment));
  await updateHandicapCoefficient(newCoefficient);

  return newCoefficient;
};

// Calculate rating change based on ELO system
// Using standard k-factor of 32 for active players
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
