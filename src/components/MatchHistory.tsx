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
  externalDialogOpen?: boolean;
  onExternalDialogClose?: () => void;
}

export const MatchHistory = ({ currentTeams, onRatingsUpdate, maps, externalDialogOpen, onExternalDialogClose }: MatchHistoryProps) => {
  const { user } = useAuth();
  const [matchHistory, setMatchHistory] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);

  // Sync with external dialog control
  useEffect(() => {
    if (externalDialogOpen) {
      setIsRecordDialogOpen(true);
    }
  }, [externalDialogOpen]);

  const handleDialogOpenChange = (open: boolean) => {
    setIsRecordDialogOpen(open);
    if (!open && onExternalDialogClose) {
      onExternalDialogClose();
    }
  };
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
      alert("Vul geldige scores in");
      return;
    }
    if (score1 < 0 || score2 < 0) {
      alert("Scores kunnen niet negatief zijn");
      return;
    }
    const hasWinner = score1 === 10 || score2 === 10;
    const loserScore = score1 === 10 ? score2 : score1;
    if (!hasWinner) {
      alert("Één team moet precies 10 scoren om te winnen");
      return;
    }
    if (loserScore < 0 || loserScore > 9) {
      alert("Score van verliezend team moet tussen 0 en 9 zijn");
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

    // Track team sizes for handicap coefficient adjustment
    const team1Size = currentTeams.team1.length;
    const team2Size = currentTeams.team2.length;
    const isUnevenMatch = team1Size !== team2Size;

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
      const coefficient = await getHandicapCoefficient();
      const smallerTeamIsTeam1 = team1Size < team2Size;
      const smallerTeamWon = smallerTeamIsTeam1 ? (winner === 1) : (winner === 2);

      await adjustHandicapCoefficient(coefficient, smallerTeamWon);
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
    handleDialogOpenChange(false);
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (confirm("Weet je zeker dat je deze wedstrijd wilt verwijderen?")) {
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
      <Card.Root className="shadow-xl glass-card transition-all duration-300 hover:shadow-neon-cyan/30">
        <Card.Body className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <Heading className="text-xl md:text-2xl font-display font-bold text-cyber-cyan">
              📊 Geschiedenis
            </Heading>
            {currentTeams && (
              <DialogRoot open={isRecordDialogOpen} onOpenChange={(e) => handleDialogOpenChange(e.open)}>
                <DialogTrigger asChild>
                  <Button className="cyber-btn-primary px-4 py-2 rounded-lg shadow-lg hover:shadow-neon-cyan transition-all duration-300 hover:scale-105">
                    📝 Registreer uitslag
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass-card border-cyber-cyan/30">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-display font-bold text-cyber-cyan">Registreer wedstrijd uitslag</DialogTitle>
                  </DialogHeader>
                  <DialogBody className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="font-display font-semibold mb-2 text-cyber-cyan">Team 1</p>
                        <ul className="text-sm text-cyber-cyan/80">
                          {currentTeams.team1.map((p) => (
                            <li key={p.name}>{p.name}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="font-display font-semibold mb-2 text-cyber-pink">Team 2</p>
                        <ul className="text-sm text-cyber-pink/80">
                          {currentTeams.team2.map((p) => (
                            <li key={p.name}>{p.name}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Score Team 1">
                        <Input
                          type="number"
                          value={team1Score}
                          onChange={(e) => setTeam1Score(e.target.value)}
                          placeholder="0"
                        />
                      </Field>
                      <Field label="Score Team 2">
                        <Input
                          type="number"
                          value={team2Score}
                          onChange={(e) => setTeam2Score(e.target.value)}
                          placeholder="0"
                        />
                      </Field>
                    </div>

                    <Field label="Gespeelde Map (Optioneel)">
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
                        <option value="" className="bg-gray-800">Selecteer een map...</option>
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
                      className="cyber-btn-primary px-4 py-2 rounded-lg hover:shadow-neon-cyan transition-all"
                    >
                      Registreer uitslag
                    </Button>
                  </DialogFooter>
                  <DialogCloseTrigger />
                </DialogContent>
              </DialogRoot>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyber-cyan"></div>
            </div>
          ) : matchHistory.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              Nog geen wedstrijden geregistreerd. Speel een wedstrijd en registreer de uitslag!
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
                    className="glass-card hover:border-cyber-cyan/30 transition-all"
                  >
                    <Card.Body>
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <div className="text-xs text-gray-500">
                            <span className="text-cyber-pink/60">{formatDate(match.date)}</span>
                            {match.mapPlayed && <span className="text-cyber-cyan/60"> • {match.mapPlayed}</span>}
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
                            <div className="text-sm font-semibold mb-1 text-cyber-cyan">
                              {match.team1.map((p) => p.name).join(", ")}
                            </div>
                            <div className={`text-2xl font-display font-bold ${match.winner === 1 ? 'text-green-400' : match.winner === 2 ? 'text-cyber-pink' : 'text-yellow-400'}`}>
                              {match.team1Score}
                            </div>
                          </div>

                          <div className="text-xl font-display font-bold text-cyber-pink">VS</div>

                          <div className="flex-1 text-right">
                            <div className="text-sm font-semibold mb-1 text-cyber-cyan">
                              {match.team2.map((p) => p.name).join(", ")}
                            </div>
                            <div className={`text-2xl font-display font-bold ${match.winner === 2 ? 'text-green-400' : match.winner === 1 ? 'text-cyber-pink' : 'text-yellow-400'}`}>
                              {match.team2Score}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card.Body>
                  </Card.Root>
                ))}
              </div>
              {matchHistory.length > displayCount && (
                <Button
                  onClick={handleLoadMore}
                  className="w-full mt-2 bg-cyber-dark-secondary hover:bg-cyber-dark border border-cyber-cyan/30 text-cyber-cyan font-display hover:shadow-neon-cyan/50 transition-all"
                >
                  Laad meer ({matchHistory.length - displayCount} resterend)
                </Button>
              )}
            </>
          )}
        </Card.Body>
      </Card.Root>
    </div>
  );
};
