import { MatchResult } from "./types";

export interface RatingTimelineRow {
  date: Date;
  ratings: { [playerName: string]: number };
}

export const countGamesPerPlayer = (
  matches: MatchResult[]
): { [playerName: string]: number } => {
  const counts: { [playerName: string]: number } = {};
  matches.forEach((match) => {
    Object.keys(match.ratingChanges).forEach((name) => {
      counts[name] = (counts[name] ?? 0) + 1;
    });
  });
  return counts;
};

// Replay stored per-match rating changes into a chart-ready time series:
// a baseline row with everyone at their initial ELO (dated the day before the
// first match), then ONE row per calendar day with the end-of-day ratings.
// Works retroactively on the full history.
export const buildRatingTimeline = (
  players: { name: string; initialElo: number }[],
  matches: MatchResult[]
): RatingTimelineRow[] => {
  if (matches.length === 0) return [];

  const sorted = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const current: { [playerName: string]: number } = {};
  players.forEach((p) => {
    current[p.name] = p.initialElo;
  });
  sorted.forEach((match) => {
    Object.keys(match.ratingChanges).forEach((name) => {
      if (!(name in current)) current[name] = 1500;
    });
  });

  const dayOf = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const firstDay = dayOf(new Date(sorted[0].date));
  const rows: RatingTimelineRow[] = [
    {
      date: new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() - 1),
      ratings: { ...current },
    },
  ];

  sorted.forEach((match) => {
    Object.entries(match.ratingChanges).forEach(([name, change]) => {
      current[name] += change;
    });
    const day = dayOf(new Date(match.date));
    const lastRow = rows[rows.length - 1];
    if (lastRow.date.getTime() === day.getTime()) {
      lastRow.ratings = { ...current };
    } else {
      rows.push({ date: day, ratings: { ...current } });
    }
  });

  return rows;
};
