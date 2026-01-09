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
        <Card.Root className="shadow-xl border border-gray-700">
          <Card.Body className="flex flex-col gap-4">
            <Heading className="text-xl md:text-2xl font-bold text-gray-100 text-center">
              📈 Player Statistics
            </Heading>
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400"></div>
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
      <Card.Root className="shadow-xl border border-gray-700 transition-all duration-300 hover:border-gray-600">
        <Card.Body className="flex flex-col gap-4">
          <Heading className="text-xl md:text-2xl font-bold text-gray-100 text-center">
            📈 Player Statistics
          </Heading>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-2">Rank</th>
                  <th className="text-left py-2 px-2">Player</th>
                  <th className="text-center py-2 px-2">Rating</th>
                  <th className="text-center py-2 px-2">Games</th>
                  <th className="text-center py-2 px-2">W</th>
                  <th className="text-center py-2 px-2">L</th>
                  <th className="text-center py-2 px-2">D</th>
                  <th className="text-center py-2 px-2">Win %</th>
                </tr>
              </thead>
              <tbody>
                {playerList.map((player, index) => {
                  const winRate =
                    player.gamesPlayed > 0
                      ? ((player.wins / player.gamesPlayed) * 100).toFixed(1)
                      : "0.0";

                  const getRatingColor = (rating: number) => {
                    if (rating > 50) return "text-green-400";
                    if (rating < -50) return "text-red-400";
                    return "text-yellow-400";
                  };

                  const getRankEmoji = (rank: number) => {
                    if (rank === 0) return "🥇";
                    if (rank === 1) return "🥈";
                    if (rank === 2) return "🥉";
                    return "";
                  };

                  return (
                    <tr
                      key={player.name}
                      className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="py-2 px-2 text-center">
                        {getRankEmoji(index)} {index + 1}
                      </td>
                      <td className="py-2 px-2 font-semibold">{player.name}</td>
                      <td className={`py-2 px-2 text-center font-bold ${getRatingColor(player.rating)}`}>
                        {player.rating > 0 ? "+" : ""}
                        {player.rating}
                      </td>
                      <td className="py-2 px-2 text-center">{player.gamesPlayed}</td>
                      <td className="py-2 px-2 text-center text-green-400">{player.wins}</td>
                      <td className="py-2 px-2 text-center text-red-400">{player.losses}</td>
                      <td className="py-2 px-2 text-center text-gray-400">{player.draws}</td>
                      <td className="py-2 px-2 text-center">{winRate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="text-xs text-gray-400 text-center">
            Ratings are adjusted after each match based on performance and opponent strength
          </div>
        </Card.Body>
      </Card.Root>
    </div>
  );
};
