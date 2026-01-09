import { createClient } from '@supabase/supabase-js';

// These will be set via environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types for type safety
export interface Database {
  public: {
    Tables: {
      player_ratings: {
        Row: {
          id: string;
          name: string;
          rating: number;
          wins: number;
          losses: number;
          draws: number;
          games_played: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          rating?: number;
          wins?: number;
          losses?: number;
          draws?: number;
          games_played?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          rating?: number;
          wins?: number;
          losses?: number;
          draws?: number;
          games_played?: number;
          updated_at?: string;
        };
      };
      match_history: {
        Row: {
          id: string;
          date: string;
          team1_players: string[];
          team2_players: string[];
          team1_score: number;
          team2_score: number;
          winner: number;
          map_played: string | null;
          rating_changes: Record<string, number>;
          created_at: string;
        };
        Insert: {
          id?: string;
          date: string;
          team1_players: string[];
          team2_players: string[];
          team1_score: number;
          team2_score: number;
          winner: number;
          map_played?: string | null;
          rating_changes: Record<string, number>;
          created_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          team1_players?: string[];
          team2_players?: string[];
          team1_score?: number;
          team2_score?: number;
          winner?: number;
          map_played?: string | null;
          rating_changes?: Record<string, number>;
          created_at?: string;
        };
      };
    };
  };
}
