# Claude.md - AI Assistant Guide for COD Teams

## Project Overview

**COD Teams** (Quick Match Generator) is a React-based web application for creating balanced Call of Duty multiplayer teams. It uses ELO ratings, smart algorithms, and adaptive handicapping to ensure fair matches even with uneven team sizes.

**Key Purpose**: Automatically generate fair team compositions for gaming sessions with friends.

---

## Quick Facts

- **Tech Stack**: React 18.3 + TypeScript 5.6 + Vite 6.0 + Chakra UI 3.5 + Tailwind CSS 4.0 + Recharts
- **Backend**: Supabase (PostgreSQL + Auth) with localStorage fallback, plus a small Express server (`server/`) for AI screenshot analysis
- **Language**: UI text is in Dutch (Nederlandse)
- **Deployment**: PRODUCTION is self-hosted at https://qmg.rolf.bible via `npm run deploy` (build with `VITE_BASE_PATH=/` + rsync to nginx webroot). The GitHub Pages workflow deploys a SEPARATE copy to github.io — that is NOT the production site. A plain `npm run build` uses base path `/cod-teams/` and will blank-page qmg.rolf.bible if rsynced.
- **Tests**: vitest (`npm test`) covers the rating math (src/*.test.ts)
- **Branch**: work happens directly on `main`

---

## Critical File Map

### Core Application Logic
- **`src/App.tsx`** - Main component, state management, UI orchestration
- **`src/algorithm.ts`** - Team balancing algorithm, combination generation
- **`src/rating.ts`** - Pure rating math: classic team ELO, performance-weighted ELO (screenshot matches), recompute-from-history. Unit tested in `src/rating.test.ts`.
- **`src/ratingTimeline.ts`** - Replays match history into the rating-over-time chart data
- **`src/teamSelection.ts`** - Manual roster picker state logic (one team per player)
- **`src/storage.ts`** - Data persistence (Supabase + localStorage fallback)
- **`src/types.ts`** - TypeScript interfaces (PlayerStats, MatchResult, PlayerMatchStats, ScreenshotAnalysisResult)
- **`server/index.js`** - Express server: analyzes CoD scoreboard screenshots via the Anthropic API. Runs as systemd service `cod-teams-server` on the production box; restart required after changes (sudo, ask Rolf).

### Components
- **`src/components/MatchHistory.tsx`** - Match recording dialog, history display, ELO updates
- **`src/components/PlayerStats.tsx`** - Leaderboard table with rankings
- **`src/components/Auth.tsx`** - Magic link authentication UI
- **`src/components/ErrorBoundary.tsx`** - Error handling wrapper

### Authentication & Hooks
- **`src/auth/AuthContext.tsx`** - Supabase auth state management
- **`src/hooks/useDebounce.ts`** - Custom debounce hook (300ms/500ms delays)
- **`src/supabaseClient.ts`** - Supabase initialization

### Configuration
- **`vite.config.ts`** - Build config, base path `/cod-teams/`
- **`tsconfig.app.json`** - TypeScript strict mode, path aliases
- **`.github/workflows/jekyll-gh-pages.yml`** - CI/CD deployment

### Database
- **`supabase-migration.sql`** - Complete database schema with initial data

---

## Key Concepts & Algorithms

### 1. Team Balancing Algorithm (`algorithm.ts`)
```typescript
createBalancedTeams(players, coefficient, offset)
```
- Applies buff/nerf adjustments (+50/-50 ELO)
- Generates all possible team combinations
- Calculates strength difference between teams
- For uneven teams: applies handicap to smaller team
- Returns top 100 most balanced combinations

**Handicap Formula**:
```
handicap = coefficient × (1 - smallerTeamSize / largerTeamSize)
```
This value is **subtracted from smaller team's strength**, forcing the algorithm to assign stronger players to compensate.

### 2. ELO Rating System (`rating.ts`)
Two paths, chosen at record time in `MatchHistory.tsx`:

**Manual entries** — `calculateRatingChange(teamAvg, opponentAvg, actualScore, kFactor=32)`:
```
expectedScore = 1 / (1 + 10^((opponentAvg - teamAvg) / 400))
ratingChange = 32 × (actualScore - expectedScore)   // actualScore: 1 win, 0.5 draw, 0 loss
```

**Screenshot matches** (per-player stats available) — `calculatePerformanceRatingChanges`:
```
delta = MoV × teamDelta + kPerf × clamp(playerScore / matchMeanScore - 1, -1, +1)
```
- MoV (margin of victory): 0.75 + margin/20 → 10-9 counts 0.8×, 10-0 counts 1.25×
- kPerf = 16: strong losers can gain rating, weak winners can lose it
- Performance term sums to ~0 across the lobby (no inflation)

**Uneven teams (both paths)**: the adaptive handicap coefficient is subtracted from the
smaller team's average before computing expectations, so the larger team is the expected
winner (wins earn less, shorthanded losses cost less).

**Consistency invariant**: `player_ratings` must always equal `players.initial_elo` +
sum of `match_history.rating_changes`. Deleting a match triggers a full recompute
(`recomputeRatingsFromHistory`). The rating graph replays the same ledger, so the
leaderboard and the chart endpoint always agree. Verify with `node scripts/verify-ratings.mjs`.

### 3. Adaptive Handicap Coefficient
- Auto-adjusts based on match outcomes
- Smaller team wins → decrease by 20
- Smaller team loses → increase by 20
- Bounds: 0 to 3000
- **Purpose**: Learn optimal handicap over time

### 4. Dual-Mode Storage Architecture
```
Try Supabase → Catch error → Fall back to localStorage
```
All storage functions (`storage.ts`) implement this pattern:
- Primary: Supabase PostgreSQL (cloud, persistent)
- Fallback: Browser localStorage (offline, per-device)
- User never sees the difference

---

## Database Schema (Supabase)

### Tables

#### `players`
```sql
name TEXT PRIMARY KEY
initial_elo INTEGER DEFAULT 1500
created_at TIMESTAMP
```
11 default players with initial ratings.

#### `player_ratings`
```sql
name TEXT PRIMARY KEY
rating INTEGER DEFAULT 1500
wins, losses, draws, games_played INTEGER
updated_at TIMESTAMP
INDEX on rating DESC
```

#### `match_history`
```sql
id TEXT PRIMARY KEY
date TIMESTAMP
team1_players, team2_players TEXT[]
team1_score, team2_score INTEGER
winner INTEGER CHECK (0|1|2)  -- 0=draw, 1=team1, 2=team2
map_played TEXT NULLABLE
rating_changes JSONB
created_at TIMESTAMP
```

#### `settings`
```sql
key TEXT PRIMARY KEY
value ANY TYPE
```
Stores `uneven_team_coefficient` (default: 1500).

### Security
- **RLS Enabled**: All tables
- **Public Read**: All tables (leaderboard, match history)
- **Authenticated Write**: Only logged-in users can record matches

---

## Common Tasks

### Adding a New Player
1. Add to `src/App.tsx` in `defaultPlayers` array
2. Or add via Supabase `players` table
3. Initial ELO: 1500 (standard starting rating)

### Modifying the Algorithm
- **File**: `src/algorithm.ts`
- **Function**: `createBalancedTeams()`
- **Test locally**: `npm run dev`
- **Key variables**:
  - `coefficient` - Base handicap value
  - `offset` - User adjustment percentage
  - `strengthDiff` - Metric for team balance

### Changing Handicap Behavior
- **Auto-adjustment**: `storage.ts` → `adjustHandicapCoefficient()`
- **Learning rate**: Currently 20 points per match
- **Bounds**: 0 (no handicap) to 3000 (max handicap)

### Adding Maps
- **File**: `src/App.tsx`
- **Variable**: `codMaps` array
- **Format**: `{ name: string, url: string }`
- Currently 27 maps from COD wiki

### Localization (Adding English)
Would require refactoring all hardcoded Dutch strings:
- UI labels: "Selecteer spelers" → "Select players"
- Buttons: "Registreer uitslag" → "Record result"
- Recommend using `react-i18next` library
- Extract all strings to translation files

### Styling Changes
- **Global**: `src/index.css`
- **Tailwind utilities**: Inline in JSX
- **Chakra components**: `src/components/ui/*`
- **Theme**: Dark mode optimized (gray-900 base)
- **Animations**: Defined in `index.css` (`fadeInUp`, `rainbowShift`)

---

## Development Workflow

### Setup
```bash
npm install
cp .env.example .env
# Add Supabase credentials to .env (optional)
npm run dev  # http://localhost:5173
```

### Build
```bash
npm run build  # Type check + Vite build
npm run preview  # Test production build locally
```

### Linting
```bash
npm run lint
```

### Git Workflow
- Work happens directly on `main`; commit and push after each verified feature

---

## State Management (App.tsx)

### Key State Variables
```typescript
playerStats: Player[]              // All players with ratings
activePlayers: Set<string>         // Currently selected players
buffedPlayers: Set<string>         // +50 ELO temporary buff
nerfedPlayers: Set<string>         // -50 ELO temporary nerf
solutions: Solution[]              // Top 10 balanced combinations
selectedTeam: number              // Index of selected team
handicapOffset: number            // User adjustment (-50% to +50%)
currentCoefficient: number        // Adaptive handicap value
ratingsVersion: number            // Trigger for rating reload
isLoading: boolean                // Show spinner during calculation
```

### State Update Triggers
- Player selection → debounced 500ms → recalculate teams
- Buff/nerf toggle → immediate recalculate
- Handicap slider → debounced 300ms → recalculate
- Match recorded → increment `ratingsVersion` → reload ratings → recalculate

---

## Performance Considerations

### Debouncing
- **Handicap slider**: 300ms delay (prevents excessive recalculations)
- **Player selection**: 500ms delay
- **Hook**: `src/hooks/useDebounce.ts`

### Loading Optimization
- Show spinner only if calculation takes >300ms
- Prevents flash for fast calculations (<300ms)

### Result Pruning
- Algorithm keeps max 100 combinations (pruned during generation)
- UI displays top 10 only
- Sorted by strength difference (lowest = most balanced)

### Memoization
- `useMemo` for `getAdjustedPlayerStats` (applies buffs/nerfs)
- `useMemo` for `isUnevenTeams` check

---

## Authentication Flow

```
User enters email → Magic link sent
    ↓
User clicks link → Redirects to app
    ↓
AuthContext detects session → user object populated
    ↓
Match recording enabled
```

**Implementation**:
- Supabase Auth with email OTP (magic link)
- No password storage
- Session persists in localStorage
- Auth state managed by `AuthContext.tsx`

---

## Environment Variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_BASE_PATH=/cod-teams/  # Default for GitHub Pages
```

**Optional**: App works without Supabase (localStorage fallback).

---

## Deployment

### Production: qmg.rolf.bible (self-hosted, THIS machine)
1. Frontend: `npm run deploy` — builds with `VITE_BASE_PATH=/` and rsyncs `dist/` to
   `/var/www/qmg.rolf.bible/html` (nginx webroot). NEVER rsync a plain `npm run build`:
   the default base path `/cod-teams/` blank-pages the site.
2. Backend: nginx proxies `/api/` to the `cod-teams-server` systemd service, which runs
   `server/index.js` straight from this repo's working tree. Server changes require
   `sudo systemctl restart cod-teams-server` (Claude has no sudo — ask Rolf).
3. Schema changes: only anon keys exist on this box; DDL goes through the Supabase
   dashboard SQL editor (ask Rolf to run it).
4. Users with open tabs keep running the old bundle after a deploy (no cache headers);
   a hard refresh is needed to pick up changes.
5. Verify deploys by rendering in a real browser (`npx playwright screenshot ...`),
   not just curl.

### GitHub Pages (secondary copy, automatic)
Push to `main` → `.github/workflows/jekyll-gh-pages.yml` builds (base `/cod-teams/`,
Supabase secrets from repo settings) and deploys to github.io. Not the production site.

---

## Code Style & Patterns

### TypeScript
- Strict mode enabled
- Explicit types for function parameters
- Interfaces defined in `src/types.ts`

### React Patterns
- Hooks-based (no class components)
- Context for auth (`AuthContext`)
- Error boundaries for resilience
- Controlled components (forms)

### Error Handling
- Try-catch for all Supabase calls
- ErrorBoundary for component errors
- Graceful fallbacks (localStorage)
- User-friendly error messages

### Naming Conventions
- Components: PascalCase (`MatchHistory.tsx`)
- Functions: camelCase (`createBalancedTeams`)
- Constants: camelCase (`defaultPlayers`)
- CSS: kebab-case (Tailwind utilities)

---

## Troubleshooting

### "No teams found"
- Need at least 4 players selected
- Check that players have valid ratings

### Supabase Connection Failed
- App automatically falls back to localStorage
- Check `.env` file has correct credentials
- Verify Supabase project is not paused

### Build Errors
```bash
npm run lint  # Check for linting issues
npx tsc --noEmit  # Type check without building
```

### Authentication Issues
- Check Supabase Email Auth is enabled
- Verify redirect URLs in Supabase dashboard
- Production URL: `https://[user].github.io/cod-teams/`
- Local URL: `http://localhost:5173/`

---

## Testing Checklist

Before deploying changes:
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds
- [ ] Local testing: `npm run dev`
- [ ] Test player selection (4+ players)
- [ ] Test buff/nerf functionality
- [ ] Test handicap slider (uneven teams)
- [ ] Test match recording (if Supabase connected)
- [ ] Test authentication flow
- [ ] Test localStorage fallback (disable network)
- [ ] Check mobile responsiveness

---

## Known Limitations

1. **Language**: Hardcoded Dutch UI text (no i18n)
2. **Testing**: vitest covers the rating/domain math; no component/integration tests
3. **Offline**: Requires localStorage for offline functionality
4. **Scale**: Algorithm may slow with 100+ players (unlikely use case)
5. **Auth**: Only email magic link (no OAuth providers configured)
6. **History**: Match history loads 50 at a time (pagination)

---

## Extension Ideas

If adding new features, consider:
- **Localization**: Add `react-i18next` for multi-language support
- **Player profiles**: Add avatars, stats graphs, match history per player
- **Advanced stats**: K/D ratio, map performance, streak tracking
- **Team history**: Save and reuse successful team compositions
- **Tournament mode**: Bracket generation, multi-round tracking
- **Export/Import**: Backup/restore all data (already in `storage.ts`)
- **Dark/Light theme**: Add theme toggle (Chakra supports this)
- **Notifications**: Email/push notifications for match reminders
- **Social features**: Share team compositions, leaderboards

---

## Important Notes for AI Assistants

1. **Always read files before editing**: Use `Read` tool first
2. **UI text is Dutch**: Don't assume English labels
3. **Dual storage**: Changes to data layer must work for both Supabase and localStorage
4. **TDD the rating math**: pure logic lives in `src/rating.ts` / `src/ratingTimeline.ts` / `src/teamSelection.ts` with tests — extend tests first
5. **ELO handicap logic**: Handicap is SUBTRACTED from smaller team (see comments in `algorithm.ts:133-146`)
6. **Debouncing**: Don't remove debounce hooks - they prevent performance issues
7. **Type safety**: Maintain strict TypeScript types
8. **Testing**: Always test locally before committing (`npm run dev`)

---

## Contact & Support

- **GitHub Issues**: https://github.com/holfreij/cod-teams/issues
- **Documentation**: README.md, SUPABASE_SETUP.md
- **Database Schema**: supabase-migration.sql

---

## Quick Reference Commands

```bash
# Development
npm install              # Install dependencies
npm run dev              # Start dev server
npm run build            # Production build
npm run lint             # Run linter
npm run preview          # Preview production build

# Git
git status
git add .
git commit -m "message"
git push -u origin claude/init-and-update-docs-nQIKw

# Supabase (if using Supabase CLI)
supabase start           # Start local Supabase
supabase db reset        # Reset local database
```

---

## Summary for AI Assistants

This is a **well-structured React + TypeScript SPA** with:
- Smart team balancing using ELO ratings and adaptive handicapping
- Dual-mode storage (Supabase + localStorage fallback)
- Dutch UI language
- Dark theme optimized for gaming sessions
- ~2,000 lines of clean, typed code
- Production-ready deployment pipeline

**Most common tasks**: Adjusting algorithm parameters, adding players, styling changes, fixing bugs in team generation logic.

**Critical files to understand**: `App.tsx` (main), `algorithm.ts` (logic), `storage.ts` (data).

**Always test locally before pushing**: `npm run dev` and verify team generation works correctly.
