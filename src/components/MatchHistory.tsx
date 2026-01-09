import { useState, useEffect } from "react";
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
} from "../storage";
import { Field } from "@/components/ui/field";

interface MatchHistoryProps {
  currentTeams: { team1: PlayerStats[]; team2: PlayerStats[] } | null;
  onRatingsUpdate: () => void;
}

export const MatchHistory = ({ currentTeams, onRatingsUpdate }: MatchHistoryProps) => {
  const [matchHistory, setMatchHistory] = useState<MatchResult[]>([]);
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [team1Score, setTeam1Score] = useState("");
  const [team2Score, setTeam2Score] = useState("");
  const [selectedMap, setSelectedMap] = useState("");

  // Load match history on mount
  useEffect(() => {
    const loadHistory = async () => {
      const history = await getMatchHistory();
      setMatchHistory(history);
    };
    loadHistory();
  }, []);

  const handleRecordMatch = async () => {
    if (!currentTeams) return;

    const score1 = parseInt(team1Score);
    const score2 = parseInt(team2Score);

    if (isNaN(score1) || isNaN(score2)) {
      alert("Please enter valid scores");
      return;
    }

    const winner = score1 > score2 ? 1 : score1 < score2 ? 2 : 0;

    // Calculate rating changes
    const ratings = await getPlayerRatings();
    const team1AvgRating =
      currentTeams.team1.reduce((sum, p) => {
        const currentRating = ratings[p.name]?.rating || 0;
        return sum + p.strength + currentRating;
      }, 0) / currentTeams.team1.length;

    const team2AvgRating =
      currentTeams.team2.reduce((sum, p) => {
        const currentRating = ratings[p.name]?.rating || 0;
        return sum + p.strength + currentRating;
      }, 0) / currentTeams.team2.length;

    const ratingChanges: { [playerName: string]: number } = {};

    // Calculate changes for team 1
    currentTeams.team1.forEach((player) => {
      const playerCurrentRating = (ratings[player.name]?.rating || 0) + player.strength;
      ratingChanges[player.name] = calculateRatingChange(
        playerCurrentRating,
        team1AvgRating,
        team2AvgRating,
        winner === 1 || winner === 0
      );
    });

    // Calculate changes for team 2
    currentTeams.team2.forEach((player) => {
      const playerCurrentRating = (ratings[player.name]?.rating || 0) + player.strength;
      ratingChanges[player.name] = calculateRatingChange(
        playerCurrentRating,
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
    const history = await getMatchHistory();
    setMatchHistory(history);
    onRatingsUpdate();

    // Reset form
    setTeam1Score("");
    setTeam2Score("");
    setSelectedMap("");
    setIsRecordDialogOpen(false);
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (confirm("Are you sure you want to delete this match?")) {
      await deleteMatch(matchId);
      const history = await getMatchHistory();
      setMatchHistory(history);
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
                      <Input
                        value={selectedMap}
                        onChange={(e) => setSelectedMap(e.target.value)}
                        placeholder="e.g., Shoot House"
                      />
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

          {matchHistory.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              No matches recorded yet. Play a match and record the results!
            </p>
          ) : (
            <div className="flex flex-col gap-3 max-h-96 overflow-y-auto">
              {matchHistory
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
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
                          <Button
                            size="sm"
                            onClick={() => handleDeleteMatch(match.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            🗑️
                          </Button>
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
          )}
        </Card.Body>
      </Card.Root>
    </div>
  );
};
