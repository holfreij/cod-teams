import { CheckboxGroup } from "@chakra-ui/react";
import { Slider } from "@/components/ui/slider";
import { Card } from "@chakra-ui/react";

import { CheckboxCard } from "@/components/ui/checkbox-card";
import { createBalancedTeams, PlayerStats, TeamResults } from "./algorithm";
import { useEffect, useMemo, useState } from "react";

const playerStats: PlayerStats[] = [
  { strength: 3.8, handicap: 1, name: "Frank" },
  { strength: 2.5, handicap: 1, name: "Guido" },
  { strength: 2.0, handicap: 1, name: "Jan-Joost" },
  { strength: 2.9, handicap: 1, name: "Joel" },
  { strength: 5, handicap: 1, name: "Kevin" },
  { strength: 2.8, handicap: 1, name: "Lennard" },
  { strength: 3.6, handicap: 1, name: "Maarten" },
  { strength: 3.0, handicap: 1, name: "Rick" },
  { strength: 3.1, handicap: 1, name: "Rolf" },
  { strength: 3.7, handicap: 1, name: "Thomas" },
];

const getBackgroundStyle = (strengthDifference: number) => {
  if (strengthDifference <= 0.5) {
    return "bg-green-900"; // Nice green
  } else if (strengthDifference >= 2) {
    return "bg-red-900"; // Red
  }

  return "bg-yellow-700";
};

function App() {
  const [activePlayers, setActivePlayers] = useState<string[]>(
    playerStats.map((player) => {
      return player.name;
    })
  );
  const [maxTeamStrengthDifference, setMaxTeamStrengthDifference] =
    useState<number>(1);

  const [unevenTeamsPenalty, setUnevenTeamsPenalty] = useState<number>(1);

  const [solutions, setSolutions] = useState<TeamResults[]>([]);
  useEffect(() => {
    setSolutions(
      createBalancedTeams(
        playerStats.filter((player) => activePlayers.includes(player.name)),
        maxTeamStrengthDifference,
        unevenTeamsPenalty
      )
    );
  }, [maxTeamStrengthDifference, activePlayers, unevenTeamsPenalty]);

  const isNumberOfPlayersEven: boolean = useMemo(() => {
    return activePlayers.length % 2 === 0;
  }, [activePlayers.length]);

  const maxImbalance: number = useMemo(() => {
    if (isNumberOfPlayersEven && maxTeamStrengthDifference > 2)
      setMaxTeamStrengthDifference(2);
    return isNumberOfPlayersEven ? 2 : 3;
  }, [isNumberOfPlayersEven, maxTeamStrengthDifference]);

  return (
    <div
      style={{ padding: 20 }}
      className="flex flex-col gap-4 items-center justify-center overflow-auto"
    >
      <CheckboxGroup onValueChange={setActivePlayers} value={activePlayers}>
        <div className="grid grid-cols-2 gap-4 overflow-auto">
          {playerStats.map((item) => (
            <CheckboxCard label={item.name} key={item.name} value={item.name} />
          ))}
        </div>
      </CheckboxGroup>
      <Card.Root>
        <Card.Body className="flex items-center gap-4">
          <p>Balans</p>
          <div className="flex gap-4 items-center">
            <p>Balanced</p>
            <Slider
              className="w-40"
              min={0}
              max={maxImbalance}
              step={0.1}
              value={[maxTeamStrengthDifference]}
              onValueChange={(newValues) =>
                setMaxTeamStrengthDifference(newValues.value[0])
              }
            />
            <p>Unbalanced</p>
          </div>
        </Card.Body>
      </Card.Root>
      {!isNumberOfPlayersEven && (
        <Card.Root>
          <Card.Body className="flex items-center gap-4">
            <p>Moeilijkheid voor kleine team</p>
            <div className="flex gap-4 items-center">
              <p>Moeilijker</p>
              <Slider
                className="w-40"
                min={0}
                max={2}
                step={0.1}
                value={[unevenTeamsPenalty]}
                onValueChange={(newValues) =>
                  setUnevenTeamsPenalty(newValues.value[0])
                }
              />
              <p>Makkelijker</p>
            </div>
          </Card.Body>
        </Card.Root>
      )}
      {solutions.length > 0 && (
        <div className="flex flex-col items-center gap-4">
          {solutions
            .sort((a, b) => {
              if (a.strengthDifference <= b.strengthDifference) return -1;
              return 0;
            })
            .map((match, index) => (
              <Card.Root key={index}>
                <Card.Body
                  className={`${getBackgroundStyle(match.strengthDifference)}`}
                >
                  <div className="flex gap-4">
                    <Card.Root>
                      <Card.Body>
                        <ul>
                          {match.team1.map((player, i) => (
                            <li key={i}>{player.name}</li>
                          ))}
                        </ul>
                      </Card.Body>
                    </Card.Root>
                    <Card.Root>
                      <Card.Body>
                        <ul>
                          {match.team2.map((player, i) => (
                            <li key={i}>{player.name}</li>
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
    </div>
  );
}

export default App;
