import { CheckboxGroup } from "@chakra-ui/react";
import { Slider } from "@/components/ui/slider";
import { Card } from "@chakra-ui/react";

import { CheckboxCard } from "@/components/ui/checkbox-card";
import { createBalancedTeams, PlayerStats, TeamResults } from "./algorithm";
import { useEffect, useState } from "react";

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

function App() {
  const [maxTeamStrengthDifference, setMaxTeamStrengthDifference] =
    useState<number>(1);
  const [activePlayers, setActivePlayers] = useState<string[]>(
    playerStats.map((player) => {
      return player.name;
    })
  );
  const [solutions, setSolutions] = useState<TeamResults[]>([]);

  useEffect(() => {
    setSolutions(
      createBalancedTeams(
        playerStats.filter((player) => activePlayers.includes(player.name)),
        maxTeamStrengthDifference
      )
    );
  }, [maxTeamStrengthDifference, activePlayers]);

  useEffect(() => {
    console.log(solutions);
  }, [solutions]);

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
      <div className="flex gap-4 items-center">
        <h2>Balanced</h2>
        <Slider
          className="w-40"
          min={0}
          max={2}
          step={0.1}
          value={[maxTeamStrengthDifference]}
          onValueChange={(newValues) =>
            setMaxTeamStrengthDifference(newValues.value[0])
          }
        />
        <h2>Unbalanced</h2>
      </div>
      {solutions.length > 0 && (
        <div className="flex flex-col items-center gap-4">
          {solutions
            .sort((a, b) => {
              if (a.strengthDifference <= b.strengthDifference) return -1;
              return 0;
            })
            .map((match, index) => (
              <Card.Root key={index}>
                <Card.Body>
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
