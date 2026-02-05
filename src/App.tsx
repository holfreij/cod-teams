import {
  AccordionItem,
  AccordionItemContent,
  AccordionItemTrigger,
  AccordionRoot,
} from "@/components/ui/accordion";
import { CheckboxCard } from "@/components/ui/checkbox-card";
import { Slider } from "@/components/ui/slider";
import { Button, Card, CheckboxGroup, Heading } from "@chakra-ui/react";
import { useEffect, useState, useMemo } from "react";
import { createBalancedTeams, PlayerStats, TeamResults } from "./algorithm";
import { MatchHistory } from "./components/MatchHistory";
import { PlayerStatsDisplay } from "./components/PlayerStats";
import { Auth } from "./components/Auth";
import { getPlayerRatings, getHandicapCoefficient, getPlayers } from "./storage";
import { useAuth } from "./auth/AuthContext";
import { useDebounce } from "./hooks/useDebounce";

// Default player list (fallback if Supabase/localStorage is empty)
// Players now use pure ELO ratings (standard chess-style system)
const DEFAULT_PLAYERS: PlayerStats[] = [
  { strength: 1875, name: "Frank" },
  { strength: 1359, name: "Guido" },
  { strength: 1172, name: "Jan-Joost" },
  { strength: 1453, name: "Joel" },
  { strength: 2344, name: "Kevin" },
  { strength: 1453, name: "Lennard" },
  { strength: 1781, name: "Maarten" },
  { strength: 1500, name: "Rick" },
  { strength: 1500, name: "Rolf" },
  { strength: 1828, name: "Thomas" },
  { strength: 1172, name: "Arjan" },
];

const maps = [
  {
    name: "Al-Raab Airbase",
    url: "https://callofduty.fandom.com/wiki/Al-Raab_Airbase",
  },
  {
    name: "Aniyah Palace",
    url: "https://callofduty.fandom.com/wiki/Aniyah_Palace",
  },
  {
    name: "Arklov Peak",
    url: "https://callofduty.fandom.com/wiki/Arklov_Peak",
  },
  {
    name: "Atlas Superstore",
    url: "https://callofduty.fandom.com/wiki/Atlas_Superstore",
  },
  { name: "Azhir Cave", url: "https://callofduty.fandom.com/wiki/Azhir_Cave" },
  { name: "Broadcast", url: "https://callofduty.fandom.com/wiki/Broadcast" },
  {
    name: "Cheshire Park",
    url: "https://callofduty.fandom.com/wiki/Cheshire_Park",
  },
  { name: "Crash", url: "https://callofduty.fandom.com/wiki/Crash_(map)" },
  {
    name: "Euphrates Bridge",
    url: "https://callofduty.fandom.com/wiki/Euphrates_Bridge",
  },
  { name: "Gun Runner", url: "https://callofduty.fandom.com/wiki/Gun_Runner" },
  {
    name: "Hackney Yard",
    url: "https://callofduty.fandom.com/wiki/Hackney_Yard",
  },
  { name: "Hardhat", url: "https://callofduty.fandom.com/wiki/Hardhat" },
  {
    name: "Hovec Sawmill",
    url: "https://callofduty.fandom.com/wiki/Hovec_Sawmill",
  },
  {
    name: "Khandor Hideout",
    url: "https://callofduty.fandom.com/wiki/Khandor_Hideout",
  },
  {
    name: "Mialstor Tank Factory",
    url: "https://callofduty.fandom.com/wiki/Mialstor_Tank_Factory",
  },
  {
    name: "Petrov Oil Rig",
    url: "https://callofduty.fandom.com/wiki/Petrov_Oil_Rig",
  },
  {
    name: "Piccadilly",
    url: "https://callofduty.fandom.com/wiki/Piccadilly_(map)",
  },
  { name: "Rammaza", url: "https://callofduty.fandom.com/wiki/Rammaza" },
  {
    name: "Scrapyard",
    url: "https://callofduty.fandom.com/wiki/Scrapyard_(Modern_Warfare)",
  },
  {
    name: "Shoot House",
    url: "https://callofduty.fandom.com/wiki/Shoot_House",
  },
  {
    name: "St. Petrograd",
    url: "https://callofduty.fandom.com/wiki/St._Petrograd",
  },
  {
    name: "Suldal Harbor",
    url: "https://callofduty.fandom.com/wiki/Suldal_Harbor",
  },
  {
    name: "Talsik Backlot",
    url: "https://callofduty.fandom.com/wiki/Talsik_Backlot",
  },
  { name: "Vacant", url: "https://callofduty.fandom.com/wiki/Vacant" },
];

const teamsMatch = (team1: PlayerStats[], team2: PlayerStats[]): boolean => {
  if (team1.length !== team2.length) return false;
  const names1 = team1.map(p => p.name).sort();
  const names2 = team2.map(p => p.name).sort();
  return names1.every((name, i) => name === names2[i]);
};

const getBackgroundStyle = (strengthDifference: number) => {
  // Thresholds scaled for ELO ratings (1000-2500 range)
  if (strengthDifference <= 235) {
    return "bg-gradient-to-r from-green-900 to-green-800 shadow-neon-cyan";
  } else if (strengthDifference >= 940) {
    return "bg-gradient-to-r from-red-900 to-red-800 shadow-neon-pink";
  }
  return "bg-gradient-to-r from-yellow-700 to-yellow-600 shadow-lg shadow-yellow-700/50";
};

function App() {
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>(DEFAULT_PLAYERS);
  const [activePlayers, setActivePlayers] = useState<string[]>(
    DEFAULT_PLAYERS.map((player) => player.name)
  );
  const [buffedPlayers, setBuffedPlayers] = useState<string[]>([]);
  const [nerfedPlayers, setNerfedPlayers] = useState<string[]>([]);
  const [randomMap, setRandomMap] = useState<string | null>(null);
  const [solutions, setSolutions] = useState<TeamResults[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<{ team1: PlayerStats[]; team2: PlayerStats[] } | null>(null);
  const [ratingsVersion, setRatingsVersion] = useState(0);
  const [handicapOffset, setHandicapOffset] = useState<number>(0);
  const [currentCoefficient, setCurrentCoefficient] = useState<number>(300);
  const [adjustedPlayerStats, setAdjustedPlayerStats] = useState<PlayerStats[]>([]);
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [isCalculatingTeams, setIsCalculatingTeams] = useState(false);

  const { user } = useAuth();

  // Debounce handicap offset to avoid excessive recalculations while dragging slider
  const debouncedHandicapOffset = useDebounce(handicapOffset, 300);

  // Debounce active players to avoid excessive database calls when toggling checkboxes
  const debouncedActivePlayers = useDebounce(activePlayers, 500);

  // Check if teams are uneven
  const isUnevenTeams = useMemo(() => {
    if (solutions.length === 0) return false;
    return solutions[0].team1.length !== solutions[0].team2.length;
  }, [solutions]);

  // Load players from storage
  useEffect(() => {
    const loadPlayers = async () => {
      const players = await getPlayers();
      if (players.length > 0) {
        const stats: PlayerStats[] = players.map(p => ({
          name: p.name,
          strength: p.initialElo,
        }));
        setPlayerStats(stats);
        setActivePlayers(stats.map(p => p.name));
      }
    };
    loadPlayers();
  }, []);

  // Get current player ratings (pure ELO system)
  // If player has played games, use their current rating; otherwise use initial ELO
  // Memoized to avoid redundant async calls during rapid state changes
  const getAdjustedPlayerStats = useMemo(() => {
    return async (): Promise<PlayerStats[]> => {
      const ratings = await getPlayerRatings();
      return playerStats.map(player => ({
        ...player,
        strength: ratings[player.name]?.rating ?? player.strength
      }));
    };
  }, [playerStats, ratingsVersion]);

  // Load adjusted player stats for display
  useEffect(() => {
    const loadAdjustedStats = async () => {
      const stats = await getAdjustedPlayerStats();
      setAdjustedPlayerStats(stats);
    };
    loadAdjustedStats();
  }, [playerStats, ratingsVersion]);

  // Load current handicap coefficient
  useEffect(() => {
    const loadCoefficient = async () => {
      const coefficient = await getHandicapCoefficient();
      setCurrentCoefficient(coefficient);
    };
    loadCoefficient();
  }, [ratingsVersion]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (event.key === 'r' || event.key === 'R') {
        // Pick random map
        const map = maps[Math.floor(Math.random() * maps.length)];
        setRandomMap(map.name);
      } else if (event.key === 'Escape') {
        // Clear selected team
        setSelectedTeam(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const updateSolutions = async () => {
      // Only show loading state if calculation takes longer than 300ms
      const loadingTimeout = setTimeout(() => {
        setIsCalculatingTeams(true);
        setSolutions([]);
        setSelectedTeam(null);
      }, 300);

      const adjustedStats = await getAdjustedPlayerStats();
      const totalHandicap = currentCoefficient * (1 + debouncedHandicapOffset / 100);
      const newSolutions = createBalancedTeams(
        adjustedStats.filter((player) => debouncedActivePlayers.includes(player.name)),
        buffedPlayers,
        nerfedPlayers,
        totalHandicap
      );

      // Calculation finished - cancel loading state timeout if it hasn't fired yet
      clearTimeout(loadingTimeout);
      setSolutions(newSolutions);
      setIsCalculatingTeams(false);
    };
    updateSolutions();
  }, [debouncedActivePlayers, buffedPlayers, nerfedPlayers, ratingsVersion, currentCoefficient, debouncedHandicapOffset, getAdjustedPlayerStats]);

  const handleRatingsUpdate = () => {
    setRatingsVersion((prev: number) => prev + 1);
  };

  const onActivePlayersChange = (newActivePlayers: string[]) => {
    if (newActivePlayers.length < 4) return;
    setActivePlayers(newActivePlayers);
  };

  const handleBuffedPlayersChange = (newBuffedPlayers: string[]) => {
    setBuffedPlayers(newBuffedPlayers);
    setNerfedPlayers((prev: string[]) =>
      prev.filter((player: string) => !newBuffedPlayers.includes(player))
    );
  };

  const handleNerfedPlayersChange = (newNerfedPlayers: string[]) => {
    setNerfedPlayers(newNerfedPlayers);
    setBuffedPlayers((prev: string[]) =>
      prev.filter((player: string) => !newNerfedPlayers.includes(player))
    );
  };

  // Get display rating for a player (with buff/nerf applied)
  const getDisplayRating = (playerName: string): number => {
    const player = adjustedPlayerStats.find(p => p.name === playerName);
    const baseRating = player?.strength ?? playerStats.find(p => p.name === playerName)?.strength ?? 1500;
    const modifier = buffedPlayers.includes(playerName) ? 50 : nerfedPlayers.includes(playerName) ? -50 : 0;
    return Math.round(baseRating + modifier);
  };

  const strengthDifferenceIndicator = (match: TeamResults) => {
    // Thresholds scaled for ELO ratings
    if (match.strengthDifference <= 235) return;
    const team1Strength = match.team1.reduce(
      (sum, player) => sum + player.strength,
      0
    );
    const team2Strength = match.team2.reduce(
      (sum, player) => sum + player.strength,
      0
    );
    if (match.strengthDifference >= 940)
      if (team1Strength > team2Strength) return ">>";
      else {
        return "<<";
      }
    if (team1Strength > team2Strength) return ">";
    else {
      return "<";
    }
  };

  return (
    <div
      className="flex flex-col gap-6 items-center overflow-auto min-h-screen bg-cyber-gradient bg-grid-overlay"
      style={{ padding: '24px'}}
    >
      <header className="text-center w-full mb-4">
        <h1
          className="text-gradient-cyber uppercase font-display tracking-wider"
          style={{ fontSize: 'clamp(2.5rem, 10vw, 8rem)', fontWeight: 900, lineHeight: 1 }}
        >
          QMG Teams Generator
        </h1>
        <p className="text-gray-500 mt-2 text-sm md:text-base uppercase tracking-widest">Epic Gaming Awaits</p>
        <div className="glow-line"></div>
      </header>
      <Card.Root className="w-full max-w-4xl shadow-xl glass-card transition-all duration-300 hover:shadow-neon-cyan/30">
        <Card.Body className="flex flex-col items-center gap-4">
          <AccordionRoot
            className="flex flex-col gap-4 items-center w-full"
            collapsible
          >
            <AccordionItem key="maps" value="maps" className="w-full">
              <AccordionItemTrigger className="text-lg font-display font-semibold text-cyber-cyan">🗺️ Maps</AccordionItemTrigger>
              <AccordionItemContent>
                <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-80 overflow-y-auto p-4">
                  {maps.map((map) => (
                    <li key={map.name} className="text-center">
                      <a
                        href={map.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyber-cyan hover:text-cyber-pink underline transition-all duration-200 hover:scale-110 inline-block"
                      >
                        {map.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </AccordionItemContent>
            </AccordionItem>
            <Button
              className="cyber-btn-primary mb-2 px-6 py-3 rounded-lg shadow-lg hover:shadow-neon-cyan transition-all duration-300 hover:scale-105"
              onClick={() => {
                const map = maps[Math.floor(Math.random() * maps.length)];
                setRandomMap(map.name);
              }}
            >
              🎲 Kies willekeurige map
            </Button>
            {randomMap && (
              <div className="mb-2 text-center text-lg md:text-xl font-display font-bold text-cyber-cyan animate-pulse">
                {randomMap}
              </div>
            )}
          </AccordionRoot>
        </Card.Body>
      </Card.Root>
      <div className="glow-line"></div>
      <Card.Root className="w-full max-w-4xl shadow-xl glass-card transition-all duration-300 hover:shadow-neon-cyan/30">
        <Card.Body className="flex flex-col gap-4">
          <Heading className="text-xl md:text-2xl text-center font-display font-bold text-cyber-cyan">
            👥 Selecteer spelers
          </Heading>
          <CheckboxGroup
            onValueChange={onActivePlayersChange}
            value={activePlayers}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {playerStats.map((item) => (
                <CheckboxCard
                  className="glass-card transition-all duration-200 hover:scale-105 hover:border-cyber-cyan/50"
                  label={`${item.name} (${getDisplayRating(item.name)})`}
                  key={item.name}
                  value={item.name}
                />
              ))}
            </div>
          </CheckboxGroup>
        </Card.Body>
      </Card.Root>
      <div className="glow-line"></div>
      <Card.Root className="w-full max-w-4xl shadow-xl glass-card transition-all duration-300 hover:shadow-neon-cyan/30 overflow-visible">
        <Card.Body className="flex flex-col gap-4 overflow-visible">
          <AccordionRoot multiple className="w-full">
            <AccordionItem key={"buff"} value={"buff"} className="border-b border-cyber-cyan/20">
              <AccordionItemTrigger className="text-lg font-display font-semibold text-orange-400 hover:text-orange-300 transition-colors">
                On fire 🔥
              </AccordionItemTrigger>
              <AccordionItemContent>
                <CheckboxGroup
                  onValueChange={handleBuffedPlayersChange}
                  value={buffedPlayers}
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-4 overflow-visible">
                    {activePlayers.map((player: string) => (
                      <CheckboxCard
                        className="glass-card transition-all duration-200 hover:scale-105 hover:border-cyber-cyan"
                        label={player}
                        key={player}
                        value={player}
                      />
                    ))}
                  </div>
                </CheckboxGroup>
              </AccordionItemContent>
            </AccordionItem>

            <AccordionItem key={"nerf"} value={"nerf"}>
              <AccordionItemTrigger className="text-lg font-display font-semibold text-cyber-pink hover:text-pink-300 transition-colors">
                Noob 💩♟️⚽
              </AccordionItemTrigger>
              <AccordionItemContent>
                <CheckboxGroup
                  onValueChange={handleNerfedPlayersChange}
                  value={nerfedPlayers}
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-4 overflow-visible">
                    {activePlayers.map((player: string) => (
                      <CheckboxCard
                        className="glass-card transition-all duration-200 hover:scale-105 hover:border-cyber-pink"
                        label={player}
                        key={player}
                        value={player}
                      />
                    ))}
                  </div>
                </CheckboxGroup>
              </AccordionItemContent>
            </AccordionItem>
          </AccordionRoot>
        </Card.Body>
      </Card.Root>
      {isUnevenTeams && solutions.length > 0 && (
        <Card.Root className="w-full max-w-4xl shadow-xl glass-card transition-all duration-300 hover:shadow-neon-cyan/30">
          <Card.Body className="flex flex-col gap-4">
            <Heading className="text-center text-lg md:text-xl font-display font-bold text-cyber-pink">
              ⚖️ Stel moeilijkheid voor het kleine team in
            </Heading>
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center text-sm text-gray-300">
                <span>Basiswaarde:</span>
                <span className="font-bold text-cyber-cyan">{Math.round(currentCoefficient)}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-gray-300">
                <span>Handmatige Aanpassing:</span>
                <span className="font-bold text-cyber-pink">{handicapOffset > 0 ? '+' : ''}{handicapOffset}%</span>
              </div>
              <div className="flex justify-between items-center text-sm text-gray-300 border-t border-cyber-cyan/20 pt-2">
                <span>Totale Handicap:</span>
                <span className="font-bold text-green-400">{Math.round(currentCoefficient * (1 + handicapOffset / 100))}</span>
              </div>
            </div>
            <div className="flex gap-2 md:gap-4 items-center justify-center">
              <p className="text-sm md:text-base font-semibold text-red-400">Moeilijker</p>
              <Slider
                className="flex-1 max-w-md"
                min={-50}
                max={50}
                step={5}
                value={[handicapOffset]}
                onValueChange={(details: { value: number[] }) =>
                  setHandicapOffset(details.value[0])
                }
              />
              <p className="text-sm md:text-base font-semibold text-green-400">Makkelijker</p>
            </div>
          </Card.Body>
        </Card.Root>
      )}
      {isCalculatingTeams ? (
        <Card.Root className="w-full max-w-4xl shadow-xl glass-card">
          <Card.Body className="flex flex-col items-center justify-center gap-6 py-16">
            <div className="cyber-spinner"></div>
            <div className="text-center">
              <p className="text-xl text-gray-200 font-display font-bold mb-1">Berekenen van teams...</p>
              <p className="text-sm text-gray-400">Een moment geduld</p>
            </div>
          </Card.Body>
        </Card.Root>
      ) : solutions.length > 0 && (
        <div className="flex flex-col items-center gap-6 w-full max-w-4xl pb-8">
          <div className="glow-line"></div>
          <Heading className="text-2xl md:text-3xl font-display font-bold text-gradient-cyber">
            ⚔️ Teams
          </Heading>
          {solutions
            .slice(0, 10)
            .map((match: TeamResults, index: number) => (
              <Card.Root
                key={index}
                className={`w-full transition-all duration-500 cursor-pointer ${
                  (selectedTeam && teamsMatch(selectedTeam.team1, match.team1) && teamsMatch(selectedTeam.team2, match.team2)) ||
                  (!selectedTeam && index === 0)
                    ? 'scale-105 selected-team-card'
                    : 'hover:scale-[1.02]'
                }`}
                style={{
                  animation: `fadeInUp 0.5s ease-out ${index * 0.1}s both`
                }}
                onClick={() => setSelectedTeam({ team1: match.team1, team2: match.team2 })}
              >
                <Card.Body
                  className={`${getBackgroundStyle(match.strengthDifference)} rounded-lg transition-all duration-300 flex flex-col gap-4`}
                >
                  <div className="flex flex-row justify-between items-stretch gap-2">
                    <Card.Root className="flex-1 basis-0 glass-card">
                      <Card.Body className="flex items-center justify-center h-full">
                        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-1 text-center">
                          {match.team1.map((player, i) => (
                            <li key={i} className="text-sm md:text-base font-semibold text-cyber-cyan player-name-hover">
                              {player.name}
                            </li>
                          ))}
                        </ul>
                      </Card.Body>
                    </Card.Root>
                    <div className="flex flex-col items-center justify-center gap-1 px-2 sm:px-4 shrink-0">
                      <div
                        className="font-display font-bold text-white drop-shadow-lg"
                        style={{ fontSize: 'clamp(1.5rem, 5vw, 2.5rem)' }}
                      >
                        {strengthDifferenceIndicator(match) || "="}
                      </div>
                      <div
                        className="text-cyber-cyan"
                        style={{ fontSize: 'clamp(0.75rem, 2vw, 1rem)' }}
                      >
                        {match.strengthDifference}
                      </div>
                    </div>
                    <Card.Root className="flex-1 basis-0 glass-card">
                      <Card.Body className="flex items-center justify-center h-full">
                        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-1 text-center">
                          {match.team2.map((player, i) => (
                            <li key={i} className="text-sm md:text-base font-semibold text-cyber-cyan player-name-hover">
                              {player.name}
                            </li>
                          ))}
                        </ul>
                      </Card.Body>
                    </Card.Root>
                  </div>
                  {user && ((selectedTeam && teamsMatch(selectedTeam.team1, match.team1) && teamsMatch(selectedTeam.team2, match.team2)) || (!selectedTeam && index === 0)) && (
                    <div className="flex justify-center">
                      <Button
                        className="cyber-btn-primary px-4 py-2 text-sm rounded-lg shadow-lg hover:shadow-neon-cyan transition-all duration-300 hover:scale-105"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTeam({ team1: match.team1, team2: match.team2 });
                          setIsRecordDialogOpen(true);
                        }}
                      >
                        📝 Registreer uitslag
                      </Button>
                    </div>
                  )}
                </Card.Body>
              </Card.Root>
            ))}
        </div>
      )}

      <Auth />

      <PlayerStatsDisplay />

      <MatchHistory
        currentTeams={user ? (selectedTeam || { team1: solutions[0]?.team1 || [], team2: solutions[0]?.team2 || [] }) : null}
        onRatingsUpdate={handleRatingsUpdate}
        maps={maps}
        externalDialogOpen={isRecordDialogOpen}
        onExternalDialogClose={() => setIsRecordDialogOpen(false)}
      />
    </div>
  );
}

export default App;
