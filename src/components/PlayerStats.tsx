import { useState, useEffect } from "react";
import { Card, Heading } from "@chakra-ui/react";
import { getPlayerRatings } from "../storage";
import { PlayerRating } from "../types";

export const PlayerStatsDisplay = () => {
  const [playerList, setPlayerList] = useState<PlayerRating[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRatings = async () => {
      setLoading(true);
      const ratings = await getPlayerRatings();
      const list = Object.values(ratings);
      // Sort by rating (highest first)
      list.sort((a, b) => b.rating - a.rating);
      setPlayerList(list);
      setLoading(false);
    };
    loadRatings();
  }, []);

  if (loading) {
    return (
      <div className="w-full max-w-4xl">
        <Card.Root className="shadow-xl glass-card">
          <Card.Body className="flex flex-col gap-4">
            <Heading className="text-xl md:text-2xl font-display font-bold text-cyber-cyan text-center">
              📈 Statistieken
            </Heading>
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyber-cyan"></div>
            </div>
          </Card.Body>
        </Card.Root>
      </div>
    );
  }

  if (playerList.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-4xl">
      <Card.Root className="shadow-xl glass-card transition-all duration-300 hover:shadow-neon-cyan/30">
        <Card.Body className="flex flex-col gap-4">
          <Heading className="text-xl md:text-2xl font-display font-bold text-cyber-cyan text-center">
            📈 Statistieken
          </Heading>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cyber-cyan/30">
                  <th className="text-left py-2 px-2 text-cyber-cyan font-display">Speler</th>
                  <th className="text-center py-2 px-2 text-cyber-cyan font-display">Rating</th>
                  <th className="text-center py-2 px-2 text-cyber-cyan font-display">Gespeeld</th>
                  <th className="text-center py-2 px-2 text-cyber-cyan font-display">W</th>
                  <th className="text-center py-2 px-2 text-cyber-cyan font-display">L</th>
                  <th className="text-center py-2 px-2 text-cyber-cyan font-display">D</th>
                  <th className="text-center py-2 px-2 text-cyber-cyan font-display">Win %</th>
                </tr>
              </thead>
              <tbody>
                {playerList.map((player) => {
                  const winRate =
                    player.gamesPlayed > 0
                      ? ((player.wins / player.gamesPlayed) * 100).toFixed(1)
                      : "0.0";

                  const getRatingColor = (rating: number) => {
                    if (rating > 50) return "text-green-400";
                    if (rating < -50) return "text-red-400";
                    return "text-yellow-400";
                  };

                  return (
                    <tr
                      key={player.name}
                      className="border-b border-cyber-dark-secondary hover:bg-cyber-dark-secondary/50 transition-colors"
                    >
                      <td className="py-2 px-2 font-semibold text-cyber-cyan">{player.name}</td>
                      <td className={`py-2 px-2 text-center font-bold ${getRatingColor(player.rating)}`}>
                        {player.rating > 0 ? "+" : ""}
                        {player.rating}
                      </td>
                      <td className="py-2 px-2 text-center">{player.gamesPlayed}</td>
                      <td className="py-2 px-2 text-center text-cyber-cyan">{player.wins}</td>
                      <td className="py-2 px-2 text-center text-cyber-pink">{player.losses}</td>
                      <td className="py-2 px-2 text-center text-gray-400">{player.draws}</td>
                      <td className="py-2 px-2 text-center">{winRate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="text-xs text-gray-400 text-center">
            Ratings worden aangepast na elke wedstrijd op basis van de uitslag
          </div>
        </Card.Body>
      </Card.Root>
    </div>
  );
};
