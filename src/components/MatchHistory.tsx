import { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  DialogRoot,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogCloseTrigger,
} from "@/components/ui/dialog";
import { Button, Card, Heading, Input } from "@chakra-ui/react";
import { MatchResult, PlayerStats } from "../types";
import {
  getMatchHistory,
  deleteMatch,
  saveMatchResult,
  updatePlayerRatings,
  calculateRatingChange,
  getPlayerRatings,
  getHandicapCoefficient,
  calculateUnevenTeamHandicap,
  adjustHandicapCoefficient,
} from "../storage";
import { Field } from "@/components/ui/field";

interface MapInfo {
  name: string;
  url: string;
}

interface MatchHistoryProps {
  currentTeams: { team1: PlayerStats[]; team2: PlayerStats[] } | null;
  onRatingsUpdate: () => void;
  maps: MapInfo[];
}

export const MatchHistory = ({ currentTeams, onRatingsUpdate, maps }: MatchHistoryProps) => {
  const { user } = useAuth();
  const [matchHistory, setMatchHistory] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [team1Score, setTeam1Score] = useState("");
  const [team2Score, setTeam2Score] = useState("");
  const [selectedMap, setSelectedMap] = useState("");
  const [displayCount, setDisplayCount] = useState(50);

  // Load match history on mount
  useEffect(() => {
    const loadHistory = async () => {
      setLoading(true);
      const history = await getMatchHistory();
      setMatchHistory(history);
      setLoading(false);
    };
    loadHistory();
  }, []);

  const handleLoadMore = () => {
    setDisplayCount(prev => prev + 50);
  };

  const handleRecordMatch = async () => {
    if (!currentTeams) return;

    const score1 = parseInt(team1Score);
    const score2 = parseInt(team2Score);

    // Validate scores: one team must score 10 (winner), other team 0-9
    if (isNaN(score1) || isNaN(score2)) {
      alert("Please enter valid scores");
      return;
    }
    if (score1 < 0 || score2 < 0) {
      alert("Scores cannot be negative");
      return;
    }
    const hasWinner = score1 === 10 || score2 === 10;
    const loserScore = score1 === 10 ? score2 : score1;
    if (!hasWinner) {
      alert("One team must score exactly 10 to win");
      return;
    }
    if (loserScore < 0 || loserScore > 9) {
      alert("Losing team's score must be between 0 and 9");
      return;
    }

    const winner = score1 > score2 ? 1 : score1 < score2 ? 2 : 0;

    // Calculate rating changes using pure ELO
    const ratings = await getPlayerRatings();

    // Helper to get current ELO (stored rating or initial strength)
    const getCurrentRating = (playerName: string, initialStrength: number) =>
      ratings[playerName]?.rating ?? initialStrength;

    let team1AvgRating =
      currentTeams.team1.reduce((sum, p) => {
        return sum + getCurrentRating(p.name, p.strength);
      }, 0) / currentTeams.team1.length;

    let team2AvgRating =
      currentTeams.team2.reduce((sum, p) => {
        return sum + getCurrentRating(p.name, p.strength);
      }, 0) / currentTeams.team2.length;

    // Apply handicap for uneven teams
    // IMPORTANT: Handicap is SUBTRACTED from smaller team's rating
    // Rationale: The smaller team already has stronger players (assigned by the algorithm)
    // to compensate for the player count disadvantage. By subtracting the handicap here,
    // we account for that disadvantage in the ELO calculation, ensuring fair rating changes.
    const team1Size = currentTeams.team1.length;
    const team2Size = currentTeams.team2.length;
    const isUnevenMatch = team1Size !== team2Size;
    let handicapApplied = 0;
    let coefficient = 0;

    if (isUnevenMatch) {
      coefficient = await getHandicapCoefficient();
      const smallerSize = Math.min(team1Size, team2Size);
      const largerSize = Math.max(team1Size, team2Size);
      handicapApplied = calculateUnevenTeamHandicap(smallerSize, largerSize, coefficient);

      // Subtract handicap from smaller team's rating (not add!)
      // This represents their player count disadvantage
      if (team1Size < team2Size) {
        team1AvgRating -= handicapApplied;
      } else {
        team2AvgRating -= handicapApplied;
      }
    }

    const ratingChanges: { [playerName: string]: number } = {};

    // Calculate changes for team 1
    currentTeams.team1.forEach((player) => {
      ratingChanges[player.name] = calculateRatingChange(
        team1AvgRating,
        team2AvgRating,
        winner === 1 || winner === 0
      );
    });

    // Calculate changes for team 2
    currentTeams.team2.forEach((player) => {
      ratingChanges[player.name] = calculateRatingChange(
        team2AvgRating,
        team1AvgRating,
        winner === 2 || winner === 0
      );
    });

    const match: MatchResult = {
      id: Date.now().toString(),
      date: new Date(),
      team1: currentTeams.team1,
      team2: currentTeams.team2,
      team1Score: score1,
      team2Score: score2,
      winner: winner as 0 | 1 | 2,
      mapPlayed: selectedMap || undefined,
      ratingChanges,
    };

    await saveMatchResult(match);
    await updatePlayerRatings(match);

    // Adjust handicap coefficient based on match outcome (for uneven matches)
    if (isUnevenMatch) {
      const expectedWinProb = 1 / (1 + Math.pow(10, (team2AvgRating - team1AvgRating) / 400));
      const smallerTeamIsTeam1 = team1Size < team2Size;
      const smallerTeamWon = smallerTeamIsTeam1 ? (winner === 1) : (winner === 2);

      // Use cached coefficient value from earlier to avoid race conditions
      await adjustHandicapCoefficient(
        coefficient,
        smallerTeamWon,
        smallerTeamIsTeam1 ? expectedWinProb : (1 - expectedWinProb)
      );
    }

    setLoading(true);
    const history = await getMatchHistory();
    setMatchHistory(history);
    setLoading(false);
    onRatingsUpdate();

    // Reset form
    setTeam1Score("");
    setTeam2Score("");
    setSelectedMap("");
    setIsRecordDialogOpen(false);
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (confirm("Are you sure you want to delete this match?")) {
      setLoading(true);
      await deleteMatch(matchId);
      const history = await getMatchHistory();
      setMatchHistory(history);
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  return (
    <div className="w-full max-w-4xl">
      <Card.Root className="shadow-xl border border-gray-700 transition-all duration-300 hover:border-gray-600">
        <Card.Body className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <Heading className="text-xl md:text-2xl font-bold text-gray-100">
              📊 Match History
            </Heading>
            {currentTeams && (
              <DialogRoot open={isRecordDialogOpen} onOpenChange={(e) => setIsRecordDialogOpen(e.open)}>
                <DialogTrigger asChild>
                  <Button className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-semibold shadow-lg hover:shadow-green-500/50 transition-all duration-300 hover:scale-105">
                    📝 Record Match
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-gray-800 border border-gray-700">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Record Match Result</DialogTitle>
                  </DialogHeader>
                  <DialogBody className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="font-semibold mb-2">Team 1</p>
                        <ul className="text-sm">
                          {currentTeams.team1.map((p) => (
                            <li key={p.name}>{p.name}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold mb-2">Team 2</p>
                        <ul className="text-sm">
                          {currentTeams.team2.map((p) => (
                            <li key={p.name}>{p.name}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Team 1 Score">
                        <Input
                          type="number"
                          value={team1Score}
                          onChange={(e) => setTeam1Score(e.target.value)}
                          placeholder="0"
                        />
                      </Field>
                      <Field label="Team 2 Score">
                        <Input
                          type="number"
                          value={team2Score}
                          onChange={(e) => setTeam2Score(e.target.value)}
                          placeholder="0"
                        />
                      </Field>
                    </div>

                    <Field label="Map Played (Optional)">
                      <select
                        value={selectedMap}
                        onChange={(e) => setSelectedMap(e.target.value)}
                        className="w-full h-10 px-3 bg-transparent border border-gray-600 rounded-lg text-white appearance-none cursor-pointer focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239CA3AF'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 0.75rem center',
                          backgroundSize: '1rem',
                          paddingRight: '2.5rem'
                        }}
                      >
                        <option value="" className="bg-gray-800">Select a map...</option>
                        {maps.map((map) => (
                          <option key={map.name} value={map.name} className="bg-gray-800">
                            {map.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </DialogBody>
                  <DialogFooter>
                    <Button
                      onClick={handleRecordMatch}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      Save Match
                    </Button>
                  </DialogFooter>
                  <DialogCloseTrigger />
                </DialogContent>
              </DialogRoot>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400"></div>
            </div>
          ) : matchHistory.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              No matches recorded yet. Play a match and record the results!
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-3 max-h-96 overflow-y-auto">
                {matchHistory
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, displayCount)
                  .map((match) => (
                  <Card.Root
                    key={match.id}
                    className="bg-gray-800/50 border border-gray-700 hover:border-gray-600 transition-all"
                  >
                    <Card.Body>
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <div className="text-xs text-gray-400">
                            {formatDate(match.date)}
                            {match.mapPlayed && ` • ${match.mapPlayed}`}
                          </div>
                          {user && (
                            <Button
                              size="sm"
                              onClick={() => handleDeleteMatch(match.id)}
                              className="text-red-400 hover:text-red-300"
                            >
                              🗑️
                            </Button>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="text-sm font-semibold mb-1">
                              {match.team1.map((p) => p.name).join(", ")}
                            </div>
                            <div className="text-2xl font-bold">
                              {match.team1Score}
                            </div>
                          </div>

                          <div className="text-xl font-bold text-gray-500">VS</div>

                          <div className="flex-1 text-right">
                            <div className="text-sm font-semibold mb-1">
                              {match.team2.map((p) => p.name).join(", ")}
                            </div>
                            <div className="text-2xl font-bold">
                              {match.team2Score}
                            </div>
                          </div>
                        </div>

                        {match.winner !== 0 && (
                          <div className="text-center text-sm text-green-400 font-semibold">
                            Winner: Team {match.winner}
                          </div>
                        )}
                      </div>
                    </Card.Body>
                  </Card.Root>
                ))}
              </div>
              {matchHistory.length > displayCount && (
                <Button
                  onClick={handleLoadMore}
                  className="w-full mt-2 bg-gray-700 hover:bg-gray-600 text-white"
                >
                  Load More ({matchHistory.length - displayCount} remaining)
                </Button>
              )}
            </>
          )}
        </Card.Body>
      </Card.Root>
    </div>
  );
};
