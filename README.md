# COD Teams - Quick Match Generator

A smart team balancing application for Call of Duty multiplayer matches, featuring ELO-based ratings and adaptive handicapping for uneven team sizes.

## Features

- 🎯 **Smart Team Balancing**: Generates balanced teams using ELO ratings
- 📊 **ELO Rating System**: Tracks player performance with standard chess-style ratings
- ⚖️ **Uneven Team Handicapping**: Automatically adjusts for different team sizes (2v3, 5v6, etc.)
- 🧠 **Adaptive Learning**: Handicap coefficient learns from match outcomes
- 📈 **Match History**: Track all matches with automatic rating updates
- 🗺️ **Random Map Selection**: Pick maps from the COD map pool
- 🔐 **Secure Authentication**: Magic link login via Supabase
- 💾 **Dual Storage**: Supabase backend with localStorage fallback
- 📱 **Responsive Design**: Works on desktop and mobile

## Quick Start

### Prerequisites

- Node.js 20+ and npm
- Supabase account (optional - app works with localStorage fallback)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd cod-teams

# Install dependencies
npm install

# Set up environment variables (optional for Supabase)
cp .env.example .env
# Edit .env and add your Supabase credentials

# Run development server
npm run dev

# Build for production
npm run build
```

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Note**: If these are not set, the app will use localStorage for all data storage.

## Supabase Setup

1. Create a new Supabase project
2. Run the SQL migrations in order from the `supabase-migrations/` directory:
   - `01_match_history_table.sql`
   - `02_player_ratings_settings_tables.sql`
   - `03_players_table.sql`
3. Configure authentication:
   - Enable Email authentication in Supabase Auth settings
   - Add your app URLs to the redirect allowlist:
     - `http://localhost:5173` (development)
     - `https://yourdomain.com` (production)

See `supabase-migrations/README.md` for detailed migration instructions.

## How It Works

### ELO Rating System

The app uses a standard chess-style ELO rating system to track player skill:

- **Starting Rating**: New players begin at their initial ELO (typically 1500)
- **K-Factor**: 32 (standard for active players)
- **Rating Changes**: Based on match outcome and opponent strength
- **Team Average**: Uses average team rating to calculate expected win probability

### Uneven Team Handicapping

When teams have different sizes (e.g., 2v3, 5v6), the handicap system ensures fair matches:

#### How It Works

1. **Handicap Applied to Smaller Team**: The smaller team has a handicap **subtracted** from their collective strength
2. **Two-Stage Application**:
   - **Team Generation**: Handicap is subtracted during team creation, forcing the algorithm to assign stronger players to the smaller team
   - **ELO Calculation**: Same handicap is subtracted when calculating rating changes, accounting for the player disadvantage

#### Why Subtract (Not Add)?

The handicap is **always subtracted from the smaller team**:

- **During Team Generation**: Makes the smaller team appear weaker, so the algorithm compensates by assigning stronger players
- **During Rating Changes**: Accounts for the disadvantage when calculating ELO adjustments

This ensures the smaller team gets:
- ✅ Stronger players (to compensate for fewer members)
- ✅ Fair rating changes (accounting for their disadvantage)

#### Handicap Calculation

```
Handicap = Coefficient × (1 - SmallerSize / LargerSize)
```

**Examples**:
- 2v3: Handicap = 300 × (1 - 2/3) = 300 × 0.33 = **100 points**
- 5v6: Handicap = 300 × (1 - 5/6) = 300 × 0.17 = **50 points**

The handicap scales proportionally - smaller teams with greater size disadvantages receive larger handicaps.

### Adaptive Learning System

The handicap coefficient automatically adjusts based on match outcomes:

1. **Track Expected vs Actual**: System calculates expected win probability for the smaller team
2. **Adjust on Mismatch**:
   - If smaller team wins more than expected → **Reduce coefficient** (they're overcompensated)
   - If smaller team loses more than expected → **Increase coefficient** (they're undercompensated)
3. **Learning Rate**: 20 points per match (gradual adjustments)
4. **Bounds**: Coefficient stays between 0 and 1000

**Example**: If a 2v3 smaller team consistently wins 60% of matches when expected to win 50%, the system will gradually reduce the coefficient from 300 → 280 → 260 until win rates balance.

### Manual Handicap Adjustment

Users can add a manual offset to the system coefficient via the slider:

- **Range**: -200 to +200
- **Debounced**: 300ms delay to prevent excessive recalculations
- **Immediate UI Feedback**: Display updates instantly
- **Live Calculation**: Teams regenerate with new handicap

This allows fine-tuning for specific situations or player preferences.

## Architecture

### Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + Chakra UI
- **Backend**: Supabase (PostgreSQL + Auth)
- **Storage**: Dual-mode (Supabase primary, localStorage fallback)

### Key Components

```
src/
├── components/
│   ├── MatchHistory.tsx      # Match recording and history display
│   ├── PlayerStats.tsx        # ELO rankings table
│   ├── Auth.tsx               # Magic link authentication
│   └── ErrorBoundary.tsx      # Error handling wrapper
├── auth/
│   └── AuthContext.tsx        # Supabase auth integration
├── hooks/
│   └── useDebounce.ts         # Debouncing hook for slider
├── storage.ts                 # Data persistence layer
├── algorithm.ts               # Team balancing algorithm
└── App.tsx                    # Main application
```

### Data Flow

1. **Load Data**: App fetches players, ratings, and coefficient from storage
2. **Calculate Teams**: Algorithm generates balanced team combinations
3. **Record Match**: User logs scores → ratings update → coefficient adjusts
4. **Persist**: All changes saved to Supabase (or localStorage fallback)

### Storage Fallback Chain

```
Supabase (primary)
    ↓ (on error)
localStorage (fallback)
    ↓ (on error)
Hardcoded defaults (last resort)
```

## Player Management

### Adding Players

**Via Supabase SQL Editor**:
```sql
INSERT INTO public.players (name, initial_elo)
VALUES ('New Player', 1500);
```

**Via Code**: Update `DEFAULT_PLAYERS` in `src/App.tsx` (used when storage is empty)

### Modifying Initial Ratings

Players have two ratings:
- **Initial ELO**: Set in the `players` table (for new players without match history)
- **Current Rating**: Stored in `player_ratings` table (updated after each match)

The app automatically uses the current rating if available, otherwise falls back to initial ELO.

## Deployment

### GitHub Pages

The app includes workflows for automatic deployment:

- **Main**: `.github/workflows/jekyll-gh-pages.yml` → Deploys to `https://yourusername.github.io/cod-teams/`
- **Preview**: `.github/workflows/deploy-preview.yml` → Deploys feature branch to `/preview/` subdirectory

**Setup**:
1. Enable GitHub Pages in repository settings
2. Add Supabase secrets to repository:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Push to `main` branch to trigger deployment

### Other Platforms

The app is a standard Vite/React SPA and can deploy to:
- Vercel
- Netlify
- AWS Amplify
- Any static hosting service

**Build command**: `npm run build`
**Output directory**: `dist/`

## Troubleshooting

### Magic Links Not Working

Ensure redirect URLs are added to Supabase:
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add redirect URLs:
   - `http://localhost:5173`
   - Your production URL (e.g., `https://yourusername.github.io/cod-teams/`)

### Supabase Connection Issues

If Supabase fails, the app automatically falls back to localStorage. Check browser console for error messages.

### Teams Not Balancing Well

Try adjusting the handicap slider or regenerating teams. The algorithm considers all possible combinations and picks the most balanced ones.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

MIT License - feel free to use this for your own gaming groups!

## Acknowledgments

- Built for COD multiplayer sessions
- ELO system inspired by chess ratings
- Handicap learning algorithm custom-designed for team balance
