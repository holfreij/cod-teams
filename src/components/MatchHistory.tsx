import { Fragment, useState, useEffect } from "react";
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
import { MatchResult, PlayerStats, ScreenshotAnalysisResult } from "../types";
import {
  getMatchHistory,
  deleteMatch,
  saveMatchResult,
  updatePlayerRatings,
  getPlayerRatings,
  getHandicapCoefficient,
  updateHandicapCoefficient,
} from "../storage";
import { rateMatch } from "../rating";
import { Field } from "@/components/ui/field";
import {
  DEFAULT_GAME_MODE,
  GAME_MODES,
  GAME_MODE_LIST,
  GameMode,
  toGameMode,
  validateScores,
  winTargetOf,
} from "../gameMode";
import { ScreenshotUpload } from "./ScreenshotUpload";
import { StatsTable, RatingDelta } from "./StatsTable";
import { TeamSelection, toggleTeamMembership } from "../teamSelection";
import { ScoreSheet, addLeaver, addablePlayers, removeLeaver } from "../scoreSheet";

interface MapInfo {
  name: string;
  url: string;
}

interface MatchHistoryProps {
  currentTeams: { team1: PlayerStats[]; team2: PlayerStats[] } | null;
  allPlayers: PlayerStats[];
  onRatingsUpdate: () => void;
  maps: MapInfo[];
  externalDialogOpen?: boolean;
  onExternalDialogClose?: () => void;
}

export const MatchHistory = ({ currentTeams, allPlayers, onRatingsUpdate, maps, externalDialogOpen, onExternalDialogClose }: MatchHistoryProps) => {
  const { user } = useAuth();
  const [matchHistory, setMatchHistory] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [manualTeams, setManualTeams] = useState<TeamSelection>({ team1: [], team2: [] });

  // Start the manual selection from the generated teams; the user can adjust
  const prefillFromCurrentTeams = () => {
    setManualTeams({
      team1: currentTeams?.team1.map((p) => p.name) ?? [],
      team2: currentTeams?.team2.map((p) => p.name) ?? [],
    });
  };

  // Sync with external dialog control
  useEffect(() => {
    if (externalDialogOpen) {
      prefillFromCurrentTeams();
      setIsRecordDialogOpen(true);
    }
    // prefill only at open; re-running on currentTeams changes would wipe manual edits
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalDialogOpen]);

  const handleDialogOpenChange = (open: boolean) => {
    if (open && !isRecordDialogOpen) {
      prefillFromCurrentTeams();
    }
    setIsRecordDialogOpen(open);
    if (!open && onExternalDialogClose) {
      onExternalDialogClose();
    }
  };
  const [team1Score, setTeam1Score] = useState("");
  const [team2Score, setTeam2Score] = useState("");
  const [selectedMap, setSelectedMap] = useState("");
  const [gameMode, setGameMode] = useState<GameMode>(DEFAULT_GAME_MODE);
  const [displayCount, setDisplayCount] = useState(50);
  // Parsed scoreboard plus hand-added leavers (players who quit before the result screen)
  const [screenshotStats, setScreenshotStats] = useState<ScoreSheet | null>(null);

  const handleScreenshotResult = (result: ScreenshotAnalysisResult | null) => {
    if (!result) {
      setScreenshotStats(null);
      return;
    }
    if (result.team1Score != null) setTeam1Score(String(result.team1Score));
    if (result.team2Score != null) setTeam2Score(String(result.team2Score));
    // The result screen prints the mode ("Demolition | Hackney Yard"); keep the
    // current selection when it couldn't be read
    if (result.gameMode) setGameMode(result.gameMode);
    // Only a full parse (both teams) can replace the manual team selection;
    // players who quit before the scoreboard are added by hand from there
    setScreenshotStats(
      result.team1Players.length && result.team2Players.length
        ? { team1: result.team1Players, team2: result.team2Players }
        : null
    );
    if (result.map) {
      // Match against known maps (case-insensitive)
      const matched = maps.find(
        (m) => m.name.toLowerCase() === result.map!.toLowerCase()
      );
      if (matched) setSelectedMap(matched.name);
    }
  };

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
    // Roster: the score sheet (scoreboard plus leavers) when available,
    // otherwise the manual selection
    const rosterNames = screenshotStats
      ? {
          team1: screenshotStats.team1.map((s) => s.name),
          team2: screenshotStats.team2.map((s) => s.name),
        }
      : manualTeams;

    if (rosterNames.team1.length === 0 || rosterNames.team2.length === 0) {
      alert("Selecteer voor beide teams minstens één speler");
      return;
    }

    const strengthOf = (name: string) =>
      allPlayers.find((p) => p.name === name)?.strength ?? 1500;
    const team1 = rosterNames.team1.map((name) => ({ name, strength: strengthOf(name) }));
    const team2 = rosterNames.team2.map((name) => ({ name, strength: strengthOf(name) }));

    const score1 = parseInt(team1Score);
    const score2 = parseInt(team2Score);

    // Validate against the selected mode's win target (S&D 10, Demolition 2)
    const scoreError = validateScores(gameMode, score1, score2);
    if (scoreError) {
      alert(scoreError);
      return;
    }

    const winner = score1 > score2 ? 1 : score1 < score2 ? 2 : 0;

    // Rate from current ELO (stored rating, or initial strength for a new player)
    const ratings = await getPlayerRatings();
    const ratedTeam = (team: PlayerStats[]) =>
      team.map((p) => ({ name: p.name, rating: ratings[p.name]?.rating ?? p.strength }));
    const isUnevenMatch = team1.length !== team2.length;
    const coefficient = isUnevenMatch ? await getHandicapCoefficient() : 0;
    const { ratingChanges, nextCoefficient } = rateMatch({
      team1: ratedTeam(team1),
      team2: ratedTeam(team2),
      team1Score: score1,
      team2Score: score2,
      winTarget: winTargetOf(gameMode),
      team1Stats: screenshotStats?.team1,
      team2Stats: screenshotStats?.team2,
      handicapCoefficient: coefficient,
    });

    const match: MatchResult = {
      id: Date.now().toString(),
      date: new Date(),
      team1,
      team2,
      team1Score: score1,
      team2Score: score2,
      winner: winner as 0 | 1 | 2,
      gameMode,
      mapPlayed: selectedMap || undefined,
      ratingChanges,
      team1Stats: screenshotStats?.team1,
      team2Stats: screenshotStats?.team2,
    };

    await saveMatchResult(match);
    await updatePlayerRatings(match);

    // Uneven matches teach the handicap coefficient (see nextHandicapCoefficient)
    if (isUnevenMatch) await updateHandicapCoefficient(nextCoefficient);

    setLoading(true);
    const history = await getMatchHistory();
    setMatchHistory(history);
    setLoading(false);
    onRatingsUpdate();

    // Reset form
    setTeam1Score("");
    setTeam2Score("");
    setSelectedMap("");
    setGameMode(DEFAULT_GAME_MODE);
    setScreenshotStats(null);
    setManualTeams({ team1: [], team2: [] });
    handleDialogOpenChange(false);
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (confirm("Weet je zeker dat je deze wedstrijd wilt verwijderen?")) {
      setLoading(true);
      await deleteMatch(matchId);
      const history = await getMatchHistory();
      setMatchHistory(history);
      setLoading(false);
      // deleteMatch recomputes all ratings from the remaining history
      onRatingsUpdate();
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" });
  };

  return (
    <div className="w-full max-w-4xl">
      <Card.Root className="shadow-xl glass-card transition-all duration-300 hover:shadow-neon-cyan/30">
        <Card.Body className="flex flex-col gap-4">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <Heading className="text-xl md:text-2xl font-display font-bold text-cyber-cyan whitespace-nowrap">
              📊 Geschiedenis
            </Heading>
            {user && allPlayers.length > 0 && (
              <DialogRoot open={isRecordDialogOpen} onOpenChange={(e) => handleDialogOpenChange(e.open)}>
                <DialogTrigger asChild>
                  <Button className="cyber-btn-primary w-full sm:w-auto px-4 py-2 rounded-lg shadow-lg hover:shadow-neon-cyan transition-all duration-300 sm:hover:scale-105">
                    📝 Registreer uitslag
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass-card border-cyber-cyan/30">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-display font-bold text-cyber-cyan">Registreer wedstrijd uitslag</DialogTitle>
                  </DialogHeader>
                  <DialogBody className="flex flex-col gap-4">
                    <ScreenshotUpload onResult={handleScreenshotResult} dialogOpen={isRecordDialogOpen} />

                    {screenshotStats && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {([1, 2] as const).map((teamNo) => {
                          const color = teamNo === 1 ? "cyber-cyan" : "cyber-pink";
                          const candidates = addablePlayers(screenshotStats, allPlayers.map((p) => p.name));
                          return (
                            <div key={teamNo} className="flex flex-col gap-1">
                              <p className={`text-xs font-semibold text-${color}`}>Team {teamNo}</p>
                              <StatsTable
                                players={teamNo === 1 ? screenshotStats.team1 : screenshotStats.team2}
                                teamColor={color}
                                onRemoveLeaver={(name) => setScreenshotStats(removeLeaver(screenshotStats, name))}
                              />
                              {candidates.length > 0 && (
                                <select
                                  value=""
                                  onChange={(e) =>
                                    e.target.value &&
                                    setScreenshotStats(addLeaver(screenshotStats, teamNo, e.target.value))
                                  }
                                  title="Speler die vroegtijdig stopte en niet op het scorebord staat"
                                  className="w-full h-8 px-2 bg-transparent border border-gray-600 rounded-lg text-xs text-gray-300 cursor-pointer focus:outline-none focus:border-blue-500"
                                >
                                  <option value="" className="bg-gray-800">+ Gestopte speler toevoegen…</option>
                                  {candidates.map((name) => (
                                    <option key={name} value={name} className="bg-gray-800">
                                      {name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {!screenshotStats && (
                      <div className="grid grid-cols-2 gap-4">
                        {([1, 2] as const).map((teamNo) => (
                          <div key={teamNo}>
                            <p className={`font-display font-semibold mb-2 ${teamNo === 1 ? "text-cyber-cyan" : "text-cyber-pink"}`}>
                              Team {teamNo}
                            </p>
                            <div className="flex flex-col gap-1">
                              {allPlayers.map((p) => {
                                const selected = (teamNo === 1 ? manualTeams.team1 : manualTeams.team2).includes(p.name);
                                return (
                                  <label
                                    key={p.name}
                                    className={`flex items-center gap-2 text-sm cursor-pointer select-none ${
                                      selected
                                        ? teamNo === 1 ? "text-cyber-cyan" : "text-cyber-pink"
                                        : "text-gray-400 hover:text-gray-200"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selected}
                                      onChange={() => setManualTeams(toggleTeamMembership(manualTeams, teamNo, p.name))}
                                      className="accent-current"
                                    />
                                    {p.name}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <Field label="Gametype">
                      <div className="flex flex-col gap-1 w-full">
                        <div className="grid grid-cols-2 gap-2">
                          {GAME_MODE_LIST.map((mode) => {
                            const active = gameMode === mode;
                            return (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => setGameMode(mode)}
                                className={`h-10 px-3 rounded-lg border font-display text-sm transition-all ${
                                  active
                                    ? "border-cyber-cyan text-cyber-cyan bg-cyber-cyan/10 shadow-neon-cyan/50"
                                    : "border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-500"
                                }`}
                              >
                                {GAME_MODES[mode].label}
                              </button>
                            );
                          })}
                        </div>
                        <span className="text-xs text-gray-500">
                          Winnaar scoort {winTargetOf(gameMode)}
                        </span>
                      </div>
                    </Field>

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
              <div className="cyber-spinner-sm"></div>
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
                  .map((match) => {
                  const hasStats = !!(match.team1Stats?.length && match.team2Stats?.length);
                  // Separator lives BETWEEN the nowrap spans so lines can wrap there
                  const nameList = (team: PlayerStats[]) =>
                    team.map((p, i) => (
                      <Fragment key={p.name}>
                        {i > 0 && ", "}
                        <span className="whitespace-nowrap">
                          {p.name} <RatingDelta change={match.ratingChanges[p.name]} />
                        </span>
                      </Fragment>
                    ));
                  return (
                  <Card.Root
                    key={match.id}
                    className="glass-card hover:border-cyber-cyan/30 transition-all"
                  >
                    <Card.Body>
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center gap-2">
                          <div className="text-xs text-gray-500 min-w-0">
                            <span className="text-cyber-pink/60">{formatDate(match.date)}</span>
                            <span className="text-purple-400/70"> • {GAME_MODES[toGameMode(match.gameMode)].label}</span>
                            {match.mapPlayed && <span className="text-cyber-cyan/60"> • {match.mapPlayed}</span>}
                          </div>
                          {user && (
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Verwijder wedstrijd"
                              onClick={() => handleDeleteMatch(match.id)}
                              className="shrink-0 opacity-60 hover:opacity-100 hover:bg-red-500/15"
                            >
                              🗑️
                            </Button>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            {!hasStats && (
                              <div className="text-sm font-semibold mb-1 text-cyber-cyan">
                                {nameList(match.team1)}
                              </div>
                            )}
                            <div className={`text-2xl font-display font-bold ${match.winner === 1 ? 'text-green-400' : match.winner === 2 ? 'text-cyber-pink' : 'text-yellow-400'}`}>
                              {match.team1Score}
                            </div>
                          </div>

                          <div className="text-xl font-display font-bold text-cyber-pink">VS</div>

                          <div className="flex-1 min-w-0 text-right">
                            {!hasStats && (
                              <div className="text-sm font-semibold mb-1 text-cyber-cyan">
                                {nameList(match.team2)}
                              </div>
                            )}
                            <div className={`text-2xl font-display font-bold ${match.winner === 2 ? 'text-green-400' : match.winner === 1 ? 'text-cyber-pink' : 'text-yellow-400'}`}>
                              {match.team2Score}
                            </div>
                          </div>
                        </div>

                        {hasStats && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <StatsTable
                              players={match.team1Stats!}
                              teamColor="cyber-cyan"
                              ratingChanges={match.ratingChanges}
                            />
                            <StatsTable
                              players={match.team2Stats!}
                              teamColor="cyber-pink"
                              ratingChanges={match.ratingChanges}
                            />
                          </div>
                        )}
                      </div>
                    </Card.Body>
                  </Card.Root>
                  );
                })}
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
