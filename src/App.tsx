import { Button } from "@chakra-ui/react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import { createBalancedTeams, PlayerStats, TeamResults } from "./algorithm";
import { useEffect, useState } from "react";

const playerStats: PlayerStats[] = [
  { strength: 5, handicap: 1, name: "Kevin" },
  { strength: 4, handicap: 1, name: "Frank" },
  { strength: 3.8, handicap: 1, name: "Thomas" },
  { strength: 3.7, handicap: 1, name: "Maarten" },
  { strength: 3.0, handicap: 1, name: "Rick" },
  { strength: 3.1, handicap: 1, name: "Rolf" },
  { strength: 2.9, handicap: 1, name: "Joel" },
  { strength: 2.8, handicap: 1, name: "Lennard" },
  { strength: 2.5, handicap: 1, name: "Guido" },
  { strength: 2.0, handicap: 1, name: "Jan-Joost" },
];
const maxTeamStrengthDifference = 0.5;

function App() {
  const [solutions, setSolutions] = useState<TeamResults[]>([]);

  const onCreateTeams = () => {
    setSolutions(createBalancedTeams(playerStats, maxTeamStrengthDifference));
  };

  useEffect(() => {
    console.log("Solutions:");
    solutions.forEach((solution, index) => {
      console.log(`Solution ${index + 1}:`);
      console.log(
        "  Group 1:",
        solution.team1.map((item) => item.name),
        "Sum:",
        solution.team1.reduce((a, b) => a + b.strength, 0)
      );
      console.log(
        "  Group 2:",
        solution.team2.map((item) => item.name),
        "Sum:",
        solution.team2.reduce((a, b) => a + b.strength, 0)
      );
      console.log("  Difference:", solution.strengthDifference);
    });
  }, [solutions]);

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={onCreateTeams}>Maak teams</button>
        <Button>Hoi</Button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
