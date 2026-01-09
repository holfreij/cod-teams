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
import { SystemInfo } from "./components/SystemInfo";
import { Auth } from "./components/Auth";
import { getPlayerRatings, getHandicapCoefficient } from "./storage";
import { useAuth } from "./auth/AuthContext";

// Players now use pure ELO ratings (standard chess-style system)
// Middle tier (Rick/Rolf) = 1500, Kevin significantly higher as best player
const playerStats: PlayerStats[] = [
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

const getBackgroundStyle = (strengthDifference: number) => {
  // Thresholds scaled for ELO ratings (1000-2500 range)
  if (strengthDifference <= 235) {
    return "bg-gradient-to-r from-green-900 to-green-800 shadow-lg shadow-green-900/50";
  } else if (strengthDifference >= 940) {
    return "bg-gradient-to-r from-red-900 to-red-800 shadow-lg shadow-red-900/50";
  }
  return "bg-gradient-to-r from-yellow-700 to-yellow-600 shadow-lg shadow-yellow-700/50";
};

function App() {
  const [activePlayers, setActivePlayers] = useState<string[]>(
    playerStats.map((player) => {
      return player.name;
    })
  );
  const [buffedPlayers, setBuffedPlayers] = useState<string[]>([]);
  const [nerfedPlayers, setNerfedPlayers] = useState<string[]>([]);
  const [randomMap, setRandomMap] = useState<string | null>(null);
  const [solutions, setSolutions] = useState<TeamResults[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<{ team1: PlayerStats[]; team2: PlayerStats[] } | null>(null);
  const [ratingsVersion, setRatingsVersion] = useState(0);
  const [handicapOffset, setHandicapOffset] = useState<number>(0);
  const [currentCoefficient, setCurrentCoefficient] = useState<number>(300);

  const { user } = useAuth();

  // Check if teams are uneven
  const isUnevenTeams = useMemo(() => {
    if (solutions.length === 0) return false;
    return solutions[0].team1.length !== solutions[0].team2.length;
  }, [solutions]);

  // Get current player ratings (pure ELO system)
  // If player has played games, use their current rating; otherwise use initial ELO
  const getAdjustedPlayerStats = async (): Promise<PlayerStats[]> => {
    const ratings = await getPlayerRatings();
    return playerStats.map(player => ({
      ...player,
      strength: ratings[player.name]?.rating ?? player.strength
    }));
  };

  // Load current handicap coefficient
  useEffect(() => {
    const loadCoefficient = async () => {
      const coefficient = await getHandicapCoefficient();
      setCurrentCoefficient(coefficient);
    };
    loadCoefficient();
  }, [ratingsVersion]);

  useEffect(() => {
    const updateSolutions = async () => {
      const adjustedStats = await getAdjustedPlayerStats();
      setSolutions(
        createBalancedTeams(
          adjustedStats.filter((player) => activePlayers.includes(player.name)),
          buffedPlayers,
          nerfedPlayers
        )
      );
    };
    updateSolutions();
  }, [activePlayers, buffedPlayers, nerfedPlayers, ratingsVersion]);

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
      className="flex flex-col gap-6 items-center justify-center overflow-auto p-4 md:p-8 py-8 md:py-12 min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"
    >
      <Card.Root className="w-full max-w-4xl shadow-2xl border border-gray-700 transition-all duration-300 hover:shadow-blue-500/20">
        <Card.Body className="flex items-center justify-center gap-4 bg-gradient-to-r from-blue-900/30 to-purple-900/30">
          <Heading className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            QMG Teams Generator
          </Heading>
        </Card.Body>
      </Card.Root>
      <Card.Root className="w-full max-w-4xl shadow-xl border border-gray-700 transition-all duration-300 hover:border-gray-600">
        <Card.Body className="flex flex-col items-center gap-4">
          <AccordionRoot
            className="flex flex-col gap-4 items-center w-full"
            collapsible
          >
            <AccordionItem key="maps" value="maps" className="w-full">
              <AccordionItemTrigger className="text-lg font-semibold">🗺️ Maps</AccordionItemTrigger>
              <AccordionItemContent>
                <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto p-2">
                  {maps.map((map) => (
                    <li key={map.name}>
                      <a
                        href={map.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline transition-all duration-200 hover:scale-105 inline-block"
                      >
                        {map.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </AccordionItemContent>
            </AccordionItem>
            <Button
              className="mb-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold shadow-lg hover:shadow-blue-500/50 transition-all duration-300 hover:scale-105 hover:from-blue-500 hover:to-blue-600"
              onClick={() => {
                const map = maps[Math.floor(Math.random() * maps.length)];
                setRandomMap(map.name);
              }}
            >
              🎲 Pick Random Map
            </Button>
            {randomMap && (
              <div className="mb-2 text-center text-lg md:text-xl font-bold text-blue-400 animate-pulse">
                Selected: {randomMap}
              </div>
            )}
          </AccordionRoot>
        </Card.Body>
      </Card.Root>
      <Card.Root className="w-full max-w-4xl shadow-xl border border-gray-700 transition-all duration-300 hover:border-gray-600">
        <Card.Body className="flex flex-col gap-4">
          <Heading className="text-xl md:text-2xl text-center font-bold text-gray-100">
            👥 Select Players
          </Heading>
          <CheckboxGroup
            onValueChange={onActivePlayersChange}
            value={activePlayers}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {playerStats.map((item) => (
                <CheckboxCard
                  className="transition-all duration-200 hover:scale-105"
                  label={item.name}
                  key={item.name}
                  value={item.name}
                />
              ))}
            </div>
          </CheckboxGroup>
        </Card.Body>
      </Card.Root>

      <Card.Root className="w-full max-w-4xl shadow-xl border border-gray-700 transition-all duration-300 hover:border-gray-600">
        <Card.Body className="flex flex-col gap-4">
          <AccordionRoot multiple className="w-full">
            <AccordionItem key={"buff"} value={"buff"} className="border-b border-gray-700">
              <AccordionItemTrigger className="text-lg font-semibold hover:text-orange-400 transition-colors">
                On Fire 🔥
              </AccordionItemTrigger>
              <AccordionItemContent>
                <CheckboxGroup
                  onValueChange={handleBuffedPlayersChange}
                  value={buffedPlayers}
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-2">
                    {activePlayers.map((player: string) => (
                      <CheckboxCard
                        className="transition-all duration-200 hover:scale-105 hover:border-orange-500"
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
              <AccordionItemTrigger className="text-lg font-semibold hover:text-purple-400 transition-colors">
                Noob 💩♟️⚽
              </AccordionItemTrigger>
              <AccordionItemContent>
                <CheckboxGroup
                  onValueChange={handleNerfedPlayersChange}
                  value={nerfedPlayers}
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-2">
                    {activePlayers.map((player: string) => (
                      <CheckboxCard
                        className="transition-all duration-200 hover:scale-105 hover:border-purple-500"
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
        <Card.Root className="w-full max-w-4xl shadow-xl border border-yellow-700/50 transition-all duration-300 hover:border-yellow-600/50">
          <Card.Body className="flex flex-col gap-4 bg-gradient-to-r from-yellow-900/20 to-orange-900/20">
            <Heading className="text-center text-lg md:text-xl font-bold text-yellow-400">
              ⚖️ Uneven Team Handicap Adjustment
            </Heading>
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center text-sm text-gray-300">
                <span>Current System Coefficient:</span>
                <span className="font-bold text-blue-400">{Math.round(currentCoefficient)}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-gray-300">
                <span>Manual Offset:</span>
                <span className="font-bold text-purple-400">{handicapOffset > 0 ? '+' : ''}{handicapOffset}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-gray-300 border-t border-gray-700 pt-2">
                <span>Total Applied:</span>
                <span className="font-bold text-green-400">{Math.round(currentCoefficient + handicapOffset)}</span>
              </div>
            </div>
            <div className="flex gap-2 md:gap-4 items-center justify-center">
              <p className="text-sm md:text-base font-semibold text-red-400">Harder</p>
              <Slider
                className="flex-1 max-w-md"
                min={-200}
                max={200}
                step={10}
                value={[handicapOffset]}
                onValueChange={(newValues: any) =>
                  setHandicapOffset(newValues.value[0])
                }
              />
              <p className="text-sm md:text-base font-semibold text-green-400">Easier</p>
            </div>
            <p className="text-xs text-center text-gray-400">
              Adjust the handicap for the smaller team. Positive values make it easier for them.
            </p>
          </Card.Body>
        </Card.Root>
      )}
      {solutions.length > 0 && (
        <div className="flex flex-col items-center gap-6 w-full max-w-4xl pb-8">
          <Heading className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">
            ⚔️ Team Matchups
          </Heading>
          {solutions
            .sort((a: TeamResults, b: TeamResults) => {
              if (a.strengthDifference <= b.strengthDifference) return -1;
              return 0;
            })
            .slice(0, 10)
            .map((match: TeamResults, index: number) => (
              <Card.Root
                key={index}
                className={`w-full transition-all duration-500 hover:scale-[1.02] cursor-pointer ${
                  index === 0 ? 'ring-2 ring-green-500 ring-offset-2 ring-offset-gray-900' : ''
                } ${
                  selectedTeam?.team1 === match.team1 && selectedTeam?.team2 === match.team2
                    ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-900'
                    : ''
                }`}
                style={{
                  animation: `fadeInUp 0.5s ease-out ${index * 0.1}s both`
                }}
                onClick={() => setSelectedTeam({ team1: match.team1, team2: match.team2 })}
              >
                <Card.Body
                  className={`${getBackgroundStyle(match.strengthDifference)} rounded-lg transition-all duration-300`}
                >
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-2">
                    <Card.Root className="w-full sm:flex-1 bg-gray-800/80 backdrop-blur transition-transform duration-300 hover:scale-105">
                      <Card.Body>
                        <ul className="flex flex-col items-center gap-1">
                          {match.team1.map((player, i) => (
                            <li key={i} className="text-sm md:text-base font-semibold text-gray-100">
                              {player.name}
                            </li>
                          ))}
                        </ul>
                      </Card.Body>
                    </Card.Root>
                    <div className="flex flex-col items-center gap-1 px-4">
                      <div className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">
                        {strengthDifferenceIndicator(match) || "="}
                      </div>
                      <div className="text-xs text-gray-300">
                        {match.strengthDifference}
                      </div>
                    </div>
                    <Card.Root className="w-full sm:flex-1 bg-gray-800/80 backdrop-blur transition-transform duration-300 hover:scale-105">
                      <Card.Body>
                        <ul className="flex flex-col items-center gap-1">
                          {match.team2.map((player, i) => (
                            <li key={i} className="text-sm md:text-base font-semibold text-gray-100">
                              {player.name}
                            </li>
                          ))}
                        </ul>
                      </Card.Body>
                    </Card.Root>
                  </div>
                </Card.Body>
              </Card.Root>
            ))}
        </div>
      )}

      <Auth />

      <SystemInfo version={ratingsVersion} />

      <PlayerStatsDisplay />

      <MatchHistory
        currentTeams={user ? selectedTeam : null}
        onRatingsUpdate={handleRatingsUpdate}
      />
    </div>
  );
}

export default App;
