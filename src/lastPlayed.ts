// "Laatst gespeeld" lookup for generated team splits

const MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

// Whole calendar days between two dates in local time. Rounding absorbs the
// hour gained or lost on a daylight saving change.
const calendarDaysBetween = (from: Date, to: Date): number => {
  const fromDay = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const toDay = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toDay.getTime() - fromDay.getTime()) / 86_400_000);
};

export const lastPlayedLabel = (date: Date, now: Date = new Date()): string => {
  const days = calendarDaysBetween(date, now);
  if (days <= 0) return "vandaag";
  if (days === 1) return "gisteren";
  if (days <= 5) return `${days} dagen geleden`;
  if (days <= 13) return "vorige week";
  if (days <= 27) return `${Math.floor(days / 7)} weken geleden`;
  const short = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear() ? short : `${short} ${date.getFullYear()}`;
};

// Same key for the same two sets of players, whatever the order within a team
// or which side is team 1
export const lineupKey = (team1: string[], team2: string[]): string =>
  JSON.stringify([JSON.stringify([...team1].sort()), JSON.stringify([...team2].sort())].sort());

interface PlayedMatch {
  team1: { name: string }[];
  team2: { name: string }[];
  date: Date;
}

// Most recent match date per exact lineup
export const lastPlayedByLineup = (history: PlayedMatch[]): Map<string, Date> => {
  const latest = new Map<string, Date>();
  for (const match of history) {
    const key = lineupKey(match.team1.map((p) => p.name), match.team2.map((p) => p.name));
    const seen = latest.get(key);
    if (!seen || match.date > seen) latest.set(key, match.date);
  }
  return latest;
};
