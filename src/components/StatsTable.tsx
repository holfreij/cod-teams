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
  // Adds a remove button to rows of players who left early (score sheet editing)
  onRemoveLeaver?: (name: string) => void;
}

export const StatsTable = ({ players, teamColor, ratingChanges, onRemoveLeaver }: StatsTableProps) => (
  // Fixed column widths keep both teams' tables aligned when shown stacked
  <table className="w-full text-xs table-fixed tabular-nums">
    <colgroup>
      <col />
      <col className="w-11" />
      <col className="w-7" />
      <col className="w-7" />
      <col className="w-7" />
      <col className="w-8" />
      {ratingChanges && <col className="w-9" />}
    </colgroup>
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
          <td className={`text-left py-0.5 truncate text-${teamColor}`}>
            {p.name}
            {p.left && <span className="text-yellow-400/80"> · gestopt</span>}
            {p.left && onRemoveLeaver && (
              <button
                type="button"
                title={`${p.name} verwijderen`}
                onClick={() => onRemoveLeaver(p.name)}
                className="ml-1 px-1 text-gray-400 hover:text-red-400"
              >
                ✕
              </button>
            )}
          </td>
          {/* A leaver's zeros are placeholders, not real stats */}
          {[p.score, p.kills, p.deaths, p.plants, p.defuses].map((value, i) => (
            <td key={i} className="text-right py-0.5">
              {p.left ? "–" : value}
            </td>
          ))}
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
