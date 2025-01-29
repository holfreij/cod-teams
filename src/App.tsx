import {
  AccordionItem,
  AccordionItemContent,
  AccordionItemTrigger,
  AccordionRoot,
} from "@/components/ui/accordion";
import { CheckboxCard } from "@/components/ui/checkbox-card";
import { Slider } from "@/components/ui/slider";
import { Card, CheckboxGroup, Heading } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { createBalancedTeams, PlayerStats, TeamResults } from "./algorithm";

const playerStats: PlayerStats[] = [
  { strength: 380, name: "Frank" },
  { strength: 250, name: "Guido" },
  { strength: 200, name: "Jan-Joost" },
  { strength: 290, name: "Joel" },
  { strength: 500, name: "Kevin" },
  { strength: 280, name: "Lennard" },
  { strength: 360, name: "Maarten" },
  { strength: 300, name: "Rick" },
  { strength: 310, name: "Rolf" },
  { strength: 370, name: "Thomas" },
];

const getBackgroundStyle = (strengthDifference: number) => {
  if (strengthDifference <= 50) {
    return "bg-green-900";
  } else if (strengthDifference >= 200) {
    return "bg-red-900";
  }

  return "bg-yellow-700";
};

function App() {
  const [activePlayers, setActivePlayers] = useState<string[]>(
    playerStats.map((player) => {
      return player.name;
    })
  );
  const [buffedPlayers, setBuffedPlayers] = useState<string[]>([]);
  const [nerfedPlayers, setNerfedPlayers] = useState<string[]>([]);
  const [maxTeamStrengthDifference, setMaxTeamStrengthDifference] =
    useState<number>(100);

  const [unevenTeamsPenalty, setUnevenTeamsPenalty] = useState<number>(100);

  const [solutions, setSolutions] = useState<TeamResults[]>([]);
  useEffect(() => {
    setSolutions(
      createBalancedTeams(
        playerStats.filter((player) => activePlayers.includes(player.name)),
        buffedPlayers,
        nerfedPlayers,
        maxTeamStrengthDifference,
        unevenTeamsPenalty
      )
    );
  }, [
    maxTeamStrengthDifference,
    activePlayers,
    unevenTeamsPenalty,
    buffedPlayers,
    nerfedPlayers,
  ]);

  const isNumberOfPlayersEven: boolean = useMemo(() => {
    return activePlayers.length % 2 === 0;
  }, [activePlayers.length]);

  const maxImbalance: number = useMemo(() => {
    if (isNumberOfPlayersEven && maxTeamStrengthDifference > 200)
      setMaxTeamStrengthDifference(200);
    return isNumberOfPlayersEven ? 200 : 300;
  }, [isNumberOfPlayersEven, maxTeamStrengthDifference]);

  const handleBuffedPlayersChange = (newBuffedPlayers: string[]) => {
    setBuffedPlayers(newBuffedPlayers);
    setNerfedPlayers((prev) =>
      prev.filter((player) => !newBuffedPlayers.includes(player))
    );
  };

  const handleNerfedPlayersChange = (newNerfedPlayers: string[]) => {
    setNerfedPlayers(newNerfedPlayers);
    setBuffedPlayers((prev) =>
      prev.filter((player) => !newNerfedPlayers.includes(player))
    );
  };

  return (
    <div
      style={{ padding: 20 }}
      className="flex flex-col gap-4 items-center justify-center overflow-auto"
    >
      <Heading>QMG Teams Generator</Heading>
      <CheckboxGroup onValueChange={setActivePlayers} value={activePlayers}>
        <div className="grid grid-cols-2 gap-4 overflow-auto">
          {playerStats.map((item) => (
            <CheckboxCard label={item.name} key={item.name} value={item.name} />
          ))}
        </div>
      </CheckboxGroup>

      <Card.Root>
        <Card.Body className="flex items-center gap-4 w-80">
          <AccordionRoot multiple>
            <AccordionItem key={"buff"} value={"buff"}>
              <AccordionItemTrigger>{"On Fire 🔥"}</AccordionItemTrigger>
              <AccordionItemContent>
                <CheckboxGroup
                  onValueChange={handleBuffedPlayersChange}
                  value={buffedPlayers}
                >
                  <div className="grid grid-cols-2 gap-4 overflow-auto">
                    {activePlayers.map((player) => (
                      <CheckboxCard
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
              <AccordionItemTrigger>{"Noob 💩♟️⚽"}</AccordionItemTrigger>
              <AccordionItemContent>
                <CheckboxGroup
                  onValueChange={handleNerfedPlayersChange}
                  value={nerfedPlayers}
                >
                  <div className="grid grid-cols-2 gap-4 overflow-auto">
                    {activePlayers.map((player) => (
                      <CheckboxCard
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
      <Card.Root>
        <Card.Body className="flex items-center gap-4">
          <p>Balans</p>
          <div className="flex gap-4 items-center">
            <p>Balanced</p>
            <Slider
              className="w-40"
              min={0}
              max={maxImbalance}
              step={10}
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
                max={200}
                step={10}
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
