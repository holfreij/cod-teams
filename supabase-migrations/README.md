# Supabase Database Migrations

This directory contains SQL migration scripts for setting up the Supabase database schema.

## Running Migrations

1. Log into your Supabase project dashboard
2. Navigate to the **SQL Editor** in the left sidebar
3. Run each migration file in order:
   - `01_match_history_table.sql` - Match history storage
   - `02_player_ratings_settings_tables.sql` - Player ratings and settings
   - `03_players_table.sql` - Player list management

## Migration Details

### 03_players_table.sql

**Purpose**: Moves the player list from hardcoded in App.tsx to Supabase storage.

**What it does**:
- Creates `players` table with columns: `name`, `initial_elo`, `created_at`
- Sets up Row Level Security (RLS):
  - Public read access (anyone can view players)
  - Authenticated write access (only logged-in users can add/modify players)
- Inserts the current default player list
- Creates an index for faster lookups

**After running this migration**:
- The app will load players from Supabase instead of using hardcoded values
- If Supabase is unavailable, the app falls back to localStorage
- If localStorage is also empty, the app uses the default hardcoded list

## Managing Players

### Adding a new player
```sql
INSERT INTO public.players (name, initial_elo)
VALUES ('New Player', 1500);
```

### Updating a player's initial ELO
```sql
UPDATE public.players
SET initial_elo = 1600
WHERE name = 'Player Name';
```

### Removing a player
```sql
DELETE FROM public.players
WHERE name = 'Player Name';
```

### Viewing all players
```sql
SELECT * FROM public.players
ORDER BY name;
```

## Notes

- **Initial ELO vs Current Rating**:
  - `initial_elo` in the `players` table is used for new players who haven't played any matches yet
  - Once a player plays matches, their current rating is stored in the `player_ratings` table
  - The app automatically uses the current rating if available, otherwise falls back to `initial_elo`

- **Data Fallback Chain**:
  1. Try Supabase
  2. Fall back to localStorage
  3. Fall back to hardcoded DEFAULT_PLAYERS in App.tsx

- **Backward Compatibility**: The app will continue to work even if you don't run this migration, as it includes a hardcoded fallback player list.
