// Mapping between Supabase `players` rows and the app's Player shape.
// Kept separate from storage.ts so it can be tested without a Supabase client.

export interface PlayerRow {
  name: string;
  initial_elo: number;
  discord_id?: string | null;
}

export interface Player {
  name: string;
  initialElo: number;
  // Discord user ID, used to pre-select players who are in voice
  discordId?: string;
}

export const rowToPlayer = (row: PlayerRow): Player => ({
  name: row.name,
  initialElo: row.initial_elo,
  ...(row.discord_id ? { discordId: row.discord_id } : {}),
});

export const playerToRow = (player: Player) => ({
  name: player.name,
  initial_elo: player.initialElo,
  discord_id: player.discordId ?? null,
});
