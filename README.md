# COD Teams - Quick Match Generator

Een slimme team-balancering applicatie voor Call of Duty multiplayer gaming sessies. Genereert automatisch eerlijke teams op basis van ELO ratings met geavanceerde handicap-aanpassingen voor ongelijke team groottes.

![Status](https://img.shields.io/badge/status-active-success)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)
![React](https://img.shields.io/badge/React-18.3-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 📋 Inhoudsopgave

- [Functies](#-functies)
- [Tech Stack](#️-tech-stack)
- [Snel Starten](#-snel-starten)
- [Configuratie](#️-configuratie)
- [Hoe Het Werkt](#-hoe-het-werkt)
- [Database Schema](#-database-schema)
- [Deployment](#-deployment)
- [Project Structuur](#-project-structuur)
- [Troubleshooting](#-troubleshooting)
- [Bijdragen](#-bijdragen)

---

## ✨ Functies

### Kernfunctionaliteit

- **🎯 Slimme Team Balancering** - Genereert alle mogelijke team combinaties en selecteert de meest gebalanceerde opties
- **📊 ELO Rating Systeem** - Chess-style rating systeem (start: 1500, K-factor: 32) voor eerlijke matchmaking
- **⚖️ Adaptieve Handicapping** - Intelligente handicap voor ongelijke teams (2v3, 3v4, etc.) die automatisch leert van wedstrijd uitkomsten
- **📝 Wedstrijd Geschiedenis** - Registreer scores, update ratings automatisch, en bekijk volledige match history
- **👥 Speler Management** - 11 standaard spelers met aanpasbare ratings, tijdelijke buffs/nerfs (+50/-50 ELO)
- **🗺️ Map Selectie** - 27 COD multiplayer maps met random picker en wiki links
- **🔐 Authenticatie** - Magic link login via Supabase voor match recording rechten
- **💾 Dual-Mode Opslag** - Supabase (cloud) met automatische fallback naar localStorage (offline)
- **📱 Responsive Design** - Dark theme geoptimaliseerd voor desktop, tablet en mobile

### Geavanceerde Functies

- **Top 10 Resultaten** - Toont de beste team combinaties gesorteerd op balans kwaliteit
- **Handmatige Handicap Aanpassing** - Slider voor fine-tuning (-50% tot +50%)
- **Auto-Learning Handicap** - Coefficient past zich aan op basis van kleinere team prestaties
- **Debounced Berekeningen** - Optimalisaties voor soepele UX tijdens slider adjustments
- **Loading States** - Spinner alleen bij berekeningen >300ms (voorkomt flashing)
- **Player Stats Leaderboard** - Volledige rankings met win rates, games played, en trend indicators

---

## 🛠️ Tech Stack

### Frontend
- **React 18.3.1** - UI library met hooks
- **TypeScript 5.6.2** - Type-safe development
- **Vite 6.0.5** - Lightning-fast build tool
- **Chakra UI 3.5.1** - Accessible component library
- **Tailwind CSS 4.0** - Utility-first styling
- **React Icons 5.4** - SVG icon library
- **next-themes 0.4.4** - Theme management

### Backend
- **Supabase 2.90.1** - Backend-as-a-Service
  - PostgreSQL database
  - Email authentication (magic links)
  - Row-level security (RLS)
  - Real-time subscriptions

### Development & Deployment
- **GitHub Pages** - Static hosting
- **GitHub Actions** - CI/CD pipeline
- **ESLint 9.17** - Code linting
- **Node.js 20+** - Runtime requirement

---

## 🚀 Snel Starten

### Vereisten
- Node.js 20 of hoger
- npm (included with Node.js)
- Supabase account (optioneel - app werkt ook met localStorage)

### Installatie

1. **Clone de repository**
   ```bash
   git clone https://github.com/holfreij/cod-teams.git
   cd cod-teams
   ```

2. **Installeer dependencies**
   ```bash
   npm install
   ```

3. **Configureer environment variabelen** (optioneel)
   ```bash
   cp .env.example .env
   ```

   Vul `.env` in met je Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

   > **Note**: Als je geen Supabase configureert, werkt de app automatisch met localStorage.

4. **Start development server**
   ```bash
   npm run dev
   ```

   Open http://localhost:5173 in je browser.

### Supabase Setup (Optioneel)

Voor volledige functionaliteit met cloud opslag en authenticatie:

1. Maak een gratis Supabase account aan op [supabase.com](https://supabase.com)
2. Maak een nieuw project aan
3. Ga naar SQL Editor en run `supabase-migration.sql`
4. Schakel Email Authentication in (Settings → Authentication)
5. Kopieer je Project URL en anon key naar `.env`
6. Configureer Auth redirect URLs:
   - Development: `http://localhost:5173/`
   - Production: `https://[username].github.io/cod-teams/`

Zie [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) voor gedetailleerde instructies.

---

## ⚙️ Configuratie

### Environment Variabelen

| Variabele | Beschrijving | Verplicht | Default |
|-----------|--------------|-----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL | Nee | - |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | Nee | - |
| `VITE_BASE_PATH` | Base path voor deployment | Nee | `/cod-teams/` |

### Standaard Spelers

De app komt met 11 vooraf geconfigureerde spelers:

| Speler | Initial ELO | Beschrijving |
|--------|-------------|--------------|
| Pim | 1172 | Laagste rating |
| Sem | 1210 | - |
| Fred | 1379 | - |
| James | 1449 | - |
| Klaas | 1466 | - |
| Danny | 1478 | - |
| Nick | 1500 | Starting rating |
| Roderick | 1622 | - |
| Reinout | 1803 | - |
| Thijme | 1913 | - |
| Niek | 2344 | Hoogste rating |

Ratings kunnen worden aangepast via match results of handmatig in de database.

---

## 🎮 Hoe Het Werkt

### 1. Team Balancering Algoritme

Het algoritme genereert eerlijke teams in meerdere stappen:

```typescript
1. Pas tijdelijke buffs/nerfs toe op speler ratings
2. Bereken team grootte (floor van totaal / 2 voor kleinere team)
3. Genereer alle mogelijke combinaties voor kleinere team
4. Voor elke combinatie:
   a. Bereken som van beide teams' sterkte
   b. Bij ongelijke teams: trek handicap af van kleinere team sterkte
   c. Bereken absolute verschil
5. Dedupliceer team pairings (zelfde teams slechts 1x)
6. Sorteer op sterkte verschil (kleinste eerst)
7. Return top 100 resultaten (UI toont top 10)
```

### 2. Handicap Systeem (Ongelijke Teams)

Voor ongelijke teams (2v3, 3v4, etc.) past het systeem een handicap toe:

**Formule**:
```
ratio = 1 - (kleinereTeamGrootte / grotereTeamGrootte)
handicap = coefficient × ratio
```

**Voorbeeld**: 2v3 met coefficient 300
```
ratio = 1 - (2/3) = 0.333
handicap = 300 × 0.333 = 100 punten
```

De handicap wordt **afgetrokken van de kleinere team sterkte**, wat het algoritme forceert om sterkere spelers aan het kleinere team toe te wijzen.

**Adaptief Leren**:
- Kleinere team wint → coefficient -20
- Kleinere team verliest → coefficient +20
- Bounds: 0 tot 3000
- Leert optimale handicap over tijd

### 3. ELO Rating Berekeningen

Chess-style ELO systeem voor eerlijke rating updates:

**Formule**:
```
expectedScore = 1 / (1 + 10^((opponentAvg - playerRating) / 400))
ratingChange = K × (actualScore - expectedScore)
```

**Parameters**:
- **K-Factor**: 32 (standaard voor actieve spelers)
- **Starting Rating**: 1500
- **Team Ratings**: Gebruikt team gemiddeldes, niet individuele ratings
- **Scores**: Win = 1.0, Draw = 0.5, Loss = 0.0

**Voorbeeld**:
```
Speler A (rating 1500) vs Team gemiddelde 1600
Expected: 1 / (1 + 10^((1600-1500)/400)) = 0.36
Bij winst: 32 × (1.0 - 0.36) = +20 punten
Bij verlies: 32 × (0.0 - 0.36) = -12 punten
```

### 4. Data Flow

```
Gebruiker Interactie
    ↓
[App.tsx] State Management
    ├→ Speler Selectie → [algorithm.ts] → Team Combinaties
    ├→ Buff/Nerf Toggle → Herbereken Teams
    ├→ Handicap Slider (debounce 300ms) → Herbereken Teams
    └→ Registreer Match → [MatchHistory.tsx]
                              ↓
                    [storage.ts] Dual-Mode
                    ├→ Try: Supabase (cloud)
                    │   ├→ Insert match_history
                    │   └→ Upsert player_ratings
                    └→ Catch: localStorage (fallback)
                              ↓
                    Bereken ELO Changes
                              ↓
                    Pas Handicap Coefficient aan
                              ↓
                    Update [PlayerStats] Display
```

---

## 🗄️ Database Schema

### Tables

#### `players`
Basis speler informatie met initiele ratings.

```sql
CREATE TABLE players (
  name TEXT PRIMARY KEY,
  initial_elo INTEGER DEFAULT 1500,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `player_ratings`
Huidige ratings en statistieken (updated na elke match).

```sql
CREATE TABLE player_ratings (
  name TEXT PRIMARY KEY,
  rating INTEGER DEFAULT 1500,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_player_ratings_rating ON player_ratings(rating DESC);
```

#### `match_history`
Volledige wedstrijd geschiedenis met scores en rating changes.

```sql
CREATE TABLE match_history (
  id TEXT PRIMARY KEY,
  date TIMESTAMP NOT NULL,
  team1_players TEXT[] NOT NULL,
  team2_players TEXT[] NOT NULL,
  team1_score INTEGER NOT NULL,
  team2_score INTEGER NOT NULL,
  winner INTEGER CHECK (winner IN (0, 1, 2)),  -- 0=draw, 1=team1, 2=team2
  map_played TEXT,
  rating_changes JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_match_history_date ON match_history(date DESC);
CREATE INDEX idx_match_history_winner ON match_history(winner);
```

#### `settings`
App-wide instellingen (handicap coefficient, etc.).

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
```

### Row-Level Security

Alle tables hebben RLS enabled:
- **Public Read**: Iedereen kan matches en leaderboard bekijken
- **Authenticated Write**: Alleen ingelogde users kunnen matches registreren

---

## 📦 Deployment

### GitHub Pages (Automatisch)

De app deployed automatisch naar GitHub Pages bij elke push naar `main`:

1. **Push naar main branch**
   ```bash
   git push origin main
   ```

2. **GitHub Actions workflow**
   - `.github/workflows/jekyll-gh-pages.yml` triggered
   - Installeert dependencies
   - Bouwt productie bundle met Supabase secrets
   - Deployed naar GitHub Pages

3. **Toegang tot app**
   - URL: `https://[username].github.io/cod-teams/`

**Vereisten**:
- GitHub Pages enabled in repository settings
- GitHub Secrets geconfigureerd:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

### Handmatige Deployment

#### Build voor productie
```bash
npm run build
```

Output: `dist/` directory met geoptimaliseerde bundle.

#### Preview productie build lokaal
```bash
npm run preview
```

#### Deploy naar andere platforms

**Vercel**:
```bash
npm run build
vercel --prod
```

**Netlify**:
```bash
npm run build
netlify deploy --prod --dir=dist
```

**AWS S3 / CloudFront**:
```bash
npm run build
aws s3 sync dist/ s3://your-bucket-name
```

---

## 📁 Project Structuur

```
cod-teams/
├── src/
│   ├── App.tsx                    # Main component (556 lines)
│   ├── main.tsx                   # React entry point
│   ├── index.css                  # Global styles & animations
│   ├── types.ts                   # TypeScript interfaces
│   ├── algorithm.ts               # Team balancing logic (251 lines)
│   ├── storage.ts                 # Data persistence (429 lines)
│   ├── supabaseClient.ts          # Supabase initialization
│   │
│   ├── auth/
│   │   └── AuthContext.tsx        # Supabase auth state
│   │
│   ├── hooks/
│   │   └── useDebounce.ts         # Custom debounce hook
│   │
│   └── components/
│       ├── MatchHistory.tsx       # Match recording & history
│       ├── PlayerStats.tsx        # Leaderboard table
│       ├── Auth.tsx               # Login UI
│       ├── ErrorBoundary.tsx      # Error handling
│       │
│       └── ui/                    # Chakra UI components
│           ├── accordion.tsx
│           ├── avatar.tsx
│           ├── checkbox.tsx
│           ├── slider.tsx
│           └── ...
│
├── .github/
│   └── workflows/
│       └── jekyll-gh-pages.yml    # CI/CD deployment
│
├── public/                        # Static assets
├── dist/                          # Build output (generated)
│
├── Configuration
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   ├── vite.config.ts
│   ├── eslint.config.js
│   ├── .env.example
│   └── .gitignore
│
├── Documentation
│   ├── README.md                  # Dit bestand
│   ├── claude.md                  # AI assistant guide
│   ├── SUPABASE_SETUP.md          # Supabase configuratie
│   │
└── Database
    └── supabase-migration.sql     # Complete DB schema
```

**Total Lines of Code**: ~2,000 lines

---

## 🔧 Development

### Commands

```bash
# Development
npm run dev          # Start dev server (localhost:5173)
npm run build        # TypeScript check + Vite build
npm run preview      # Preview production build
npm run lint         # Run ESLint

# Type checking
npx tsc --noEmit     # Type check without building
```

### Code Style

- **TypeScript Strict Mode**: Enabled
- **ESLint**: TypeScript + React rules
- **Formatting**: Consistent spacing, semicolons
- **Naming**:
  - Components: PascalCase
  - Functions: camelCase
  - Constants: camelCase
  - CSS: kebab-case (Tailwind)

### Performance Optimizations

1. **Debouncing**
   - Handicap slider: 300ms delay
   - Player selection: 500ms delay
   - Prevents excessive recalculations

2. **Loading States**
   - Spinner only shows if calculation >300ms
   - Prevents flash on fast calculations

3. **Result Pruning**
   - Algoritme houdt max 100 combinaties
   - UI toont top 10
   - Gesorteerd op balans kwaliteit

4. **Memoization**
   - `useMemo` voor adjusted player stats
   - `useMemo` voor uneven teams check

---

## 🐛 Troubleshooting

### "Geen teams gevonden"

**Oorzaak**: Te weinig spelers geselecteerd.

**Oplossing**: Selecteer minimaal 4 spelers.

### Supabase Connection Failed

**Symptomen**: App werkt, maar match history niet opgeslagen.

**Oorzaak**: Supabase credentials onjuist of project gepauzeerd.

**Oplossing**:
1. Check `.env` file heeft correcte credentials
2. Verify Supabase project is niet gepauzeerd (gratis tier pauzeert na 1 week inactiviteit)
3. Test connection in browser console
4. App werkt automatisch met localStorage fallback

### Build Errors

**TypeScript errors**:
```bash
npx tsc --noEmit  # Check type errors
```

**Linting errors**:
```bash
npm run lint  # Check code style
```

### Authentication Issues

**Magic link niet ontvangen**:
- Check spam folder
- Verify email auth is enabled in Supabase
- Check redirect URLs zijn correct geconfigureerd

**Redirect na login werkt niet**:
- Verify `VITE_BASE_PATH` is correct
- Check redirect URLs in Supabase dashboard:
  - Local: `http://localhost:5173/`
  - Production: `https://[user].github.io/cod-teams/`

### Performance Issues

**Team berekeningen te traag**:
- Check hoeveel spelers geselecteerd zijn (>15 kan traag zijn)
- Verify browser console voor errors
- Clear localStorage: `localStorage.clear()`

---

## 🧪 Testing

### Manual Testing Checklist

Voordat je pusht naar productie:

- [ ] **Speler selectie**: Minimaal 4 spelers → teams generated
- [ ] **Buff/Nerf**: Toggle buff/nerf → teams recalculated
- [ ] **Handicap slider**: Adjust slider → teams update (debounced)
- [ ] **Match recording**: Log in → record match → ratings updated
- [ ] **Leaderboard**: Check player stats → sorted by rating
- [ ] **Match history**: View history → all matches shown
- [ ] **Map picker**: Random map → new map selected
- [ ] **Authentication**: Login → logout → works correctly
- [ ] **localStorage fallback**: Disable network → app still works
- [ ] **Mobile responsiveness**: Test on phone → UI adapts
- [ ] **Loading states**: Long calculation → spinner shows
- [ ] **Error handling**: Break something → error boundary catches

### Automated Testing

**Niet geimplementeerd** - Maar aanbevolen voor toekomstige ontwikkeling:
- Unit tests voor `algorithm.ts` (Jest + React Testing Library)
- Integration tests voor `storage.ts`
- E2E tests voor kritieke flows (Playwright / Cypress)

---

## 🌟 Features Roadmap

Potentiële uitbreidingen voor de toekomst:

- [ ] **Localization**: Engels / andere talen (react-i18next)
- [ ] **Player Avatars**: Upload custom avatars
- [ ] **Advanced Stats**: K/D ratio, map performance, streaks
- [ ] **Team History**: Save en reuse succesvolle compositions
- [ ] **Tournament Mode**: Bracket generation, multi-round tracking
- [ ] **Export/Import**: Volledige data backup/restore
- [ ] **Theme Toggle**: Dark / Light mode switch
- [ ] **Notifications**: Email/push voor match reminders
- [ ] **Social Features**: Share teams, public leaderboards
- [ ] **OAuth Login**: Google / Discord / GitHub auth
- [ ] **Real-time Updates**: Live leaderboard via Supabase realtime
- [ ] **PWA**: Offline-first progressive web app
- [ ] **Mobile App**: React Native port

---

## 🤝 Bijdragen

Contributions zijn welkom! Voor grote changes, open eerst een issue om te discussieren wat je wilt veranderen.

### Development Workflow

1. **Fork de repository**
2. **Create feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit changes**
   ```bash
   git commit -m "Add amazing feature"
   ```
4. **Push naar branch**
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open Pull Request**

### Pull Request Guidelines

- Update README.md met details van changes (indien relevant)
- Update de interface types in `src/types.ts`
- Ensure `npm run lint` passes
- Ensure `npm run build` succeeds
- Test manueel in browser
- Beschrijf wat je getest hebt in PR description

---

## 📄 License

Dit project is gelicenseerd onder de MIT License.

---

## 👥 Authors

- **Holfreij** - Initial work

---

## 🙏 Acknowledgments

- **Supabase** - Geweldige BaaS platform
- **Chakra UI** - Accessible component library
- **COD Community** - Inspiratie voor match balancing
- **ELO System** - Arpad Elo's chess rating systeem

---

## 📞 Support

Voor vragen, bugs, of feature requests:
- **GitHub Issues**: [holfreij/cod-teams/issues](https://github.com/holfreij/cod-teams/issues)
- **Documentation**: [claude.md](./claude.md) voor AI assistant guide
- **Supabase Setup**: [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)

---

## 📊 Stats

- **Lines of Code**: ~2,000
- **Components**: 15+
- **Dependencies**: 24
- **Database Tables**: 4
- **Supported Players**: Unlimited
- **Default Maps**: 27

---

**Geniet van het balanceren van je COD teams! 🎮**
