import { PlayerMatchStats } from "../types";

const deltaColor = (change: number) =>
  change > 0 ? "text-green-400" : change < 0 ? "text-red-400" : "text-gray-400";

export const RatingDelta = ({ change }: { change: number | undefined }) => {
  if (change == null) return null;
  return (
    <span className={deltaColor(change)}>
      {change > 0 ? `+${change}` : change}
    </span>
  );
};

interface StatsTableProps {
  players: PlayerMatchStats[];
  teamColor: string;
  // Per-player rating change for the match; adds a +/- column when provided
  ratingChanges?: { [playerName: string]: number };
}

export const StatsTable = ({ players, teamColor, ratingChanges }: StatsTableProps) => (
  <table className="w-full text-xs">
    <thead>
      <tr className={`text-${teamColor}/70`}>
        <th className="text-left font-medium py-0.5">Speler</th>
        <th className="text-right font-medium py-0.5">Score</th>
        <th className="text-right font-medium py-0.5">K</th>
        <th className="text-right font-medium py-0.5">D</th>
        <th className="text-right font-medium py-0.5">P</th>
        <th className="text-right font-medium py-0.5">Def</th>
        {ratingChanges && <th className="text-right font-medium py-0.5">±</th>}
      </tr>
    </thead>
    <tbody>
      {players.map((p) => (
        <tr key={p.name} className="text-gray-300">
          <td className={`text-left py-0.5 text-${teamColor}`}>{p.name}</td>
          <td className="text-right py-0.5">{p.score}</td>
          <td className="text-right py-0.5">{p.kills}</td>
          <td className="text-right py-0.5">{p.deaths}</td>
          <td className="text-right py-0.5">{p.plants}</td>
          <td className="text-right py-0.5">{p.defuses}</td>
          {ratingChanges && (
            <td className="text-right py-0.5 font-semibold">
              <RatingDelta change={ratingChanges[p.name]} />
            </td>
          )}
        </tr>
      ))}
    </tbody>
  </table>
);
