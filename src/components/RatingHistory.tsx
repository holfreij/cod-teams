import { useState, useEffect, useMemo, useRef } from "react";
import { Button, Card, Heading } from "@chakra-ui/react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
} from "recharts";
import { getPlayers, getMatchHistory } from "../storage";
import {
  buildRatingTimeline,
  countGamesPerPlayer,
  startIndexForPeriod,
  RatingTimelineRow,
} from "../ratingTimeline";

// Players with fewer matches than this start hidden in the chart
// (still listed in the legend — click to show them)
const MIN_GAMES_SHOWN_BY_DEFAULT = 15;

// Zoom presets above the chart; null = full history
const PERIODS: { label: string; months: number | null }[] = [
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1J", months: 12 },
  { label: "Alles", months: null },
];
const DEFAULT_PERIOD_MONTHS = 3;

const LINE_COLORS = [
  "#00ffff",
  "#ff0080",
  "#ffe600",
  "#00ff88",
  "#bf5fff",
  "#ff8c00",
  "#38bdf8",
  "#ff5050",
  "#a3ff00",
  "#ff66d9",
  "#00ffcc",
];

const formatDate = (t: number) =>
  new Date(t).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });

interface TooltipEntry {
  dataKey?: string | number;
  value?: number | string;
  stroke?: string;
}

const ChartTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: number;
}) => {
  if (!active || !payload?.length) return null;
  const entries = [...payload].sort((a, b) => Number(b.value) - Number(a.value));
  return (
    <div className="glass-card border border-cyber-cyan/30 rounded-lg px-3 py-2 text-xs bg-cyber-dark/90">
      <p className="text-gray-400 mb-1">{label != null && formatDate(label)}</p>
      {entries.map((entry) => (
        <p key={String(entry.dataKey)} style={{ color: entry.stroke }}>
          {entry.dataKey}: {entry.value}
        </p>
      ))}
    </div>
  );
};

interface RatingHistoryProps {
  refreshToken?: number;
}

export const RatingHistory = ({ refreshToken = 0 }: RatingHistoryProps) => {
  const [timeline, setTimeline] = useState<RatingTimelineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const hiddenInitialized = useRef(false);
  // Selected preset (undefined once the user drags the brush to a custom range)
  const [periodMonths, setPeriodMonths] = useState<number | null | undefined>(
    DEFAULT_PERIOD_MONTHS
  );
  const [range, setRange] = useState({ startIndex: 0, endIndex: 0 });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [players, matches] = await Promise.all([getPlayers(), getMatchHistory()]);
      // Hide low-activity players by default, but only on first load so
      // refreshes don't undo the user's legend toggles
      if (!hiddenInitialized.current) {
        hiddenInitialized.current = true;
        const games = countGamesPerPlayer(matches);
        setHidden(
          new Set(
            players
              .map((p) => p.name)
              .filter((name) => (games[name] ?? 0) < MIN_GAMES_SHOWN_BY_DEFAULT)
          )
        );
      }
      setTimeline(
        buildRatingTimeline(
          players.map((p) => ({ name: p.name, initialElo: p.initialElo })),
          matches
        )
      );
      setLoading(false);
    };
    load();
  }, [refreshToken]);

  // Players sorted by their latest rating, so legend order matches the leaderboard
  const playerNames = useMemo(() => {
    if (!timeline.length) return [];
    const last = timeline[timeline.length - 1].ratings;
    return Object.keys(last).sort((a, b) => last[b] - last[a]);
  }, [timeline]);

  const rows = useMemo(
    () => timeline.map((row) => ({ t: row.date.getTime(), ...row.ratings })),
    [timeline]
  );

  // Re-apply the preset when data (re)loads; a custom range is clamped instead
  useEffect(() => {
    const last = Math.max(rows.length - 1, 0);
    if (periodMonths !== undefined) {
      setRange({ startIndex: startIndexForPeriod(timeline, periodMonths), endIndex: last });
    } else {
      setRange((prev) => ({
        startIndex: Math.min(prev.startIndex, last),
        endIndex: Math.min(prev.endIndex, last),
      }));
    }
  }, [rows, timeline, periodMonths]);

  const toggle = (name: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  return (
    <div className="w-full max-w-4xl">
      <Card.Root className="shadow-xl glass-card transition-all duration-300 hover:shadow-neon-cyan/30">
        <Card.Body className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Heading className="text-xl md:text-2xl font-display font-bold text-cyber-cyan">
              📈 Rating verloop
            </Heading>
            <div className="flex gap-1">
              {PERIODS.map(({ label, months }) => (
                <Button
                  key={label}
                  size="xs"
                  variant="outline"
                  onClick={() => setPeriodMonths(months)}
                  color={periodMonths === months ? "#00ffff" : "gray.400"}
                  borderColor={periodMonths === months ? "#00ffff" : "whiteAlpha.300"}
                  bg={periodMonths === months ? "rgba(0,255,255,0.1)" : "transparent"}
                  _hover={{ color: periodMonths === months ? "#00ffff" : "gray.200" }}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="cyber-spinner-sm"></div>
            </div>
          ) : timeline.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              Nog geen wedstrijden geregistreerd.
            </p>
          ) : (
            <div className="rating-chart h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rows} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="t"
                    type="number"
                    scale="time"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={formatDate}
                    stroke="rgba(255,255,255,0.15)"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    minTickGap={40}
                  />
                  <YAxis
                    width={45}
                    domain={["auto", "auto"]}
                    stroke="rgba(255,255,255,0.15)"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    onClick={(entry) => toggle(String(entry.dataKey))}
                    wrapperStyle={{ fontSize: 12, cursor: "pointer" }}
                    formatter={(value: string) => (
                      <span style={{ color: hidden.has(value) ? "#4b5563" : "#d1d5db" }}>
                        {value}
                      </span>
                    )}
                  />
                  {playerNames.map((name, i) => (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={LINE_COLORS[i % LINE_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      hide={hidden.has(name)}
                      animationDuration={800}
                    />
                  ))}
                  <Brush
                    dataKey="t"
                    height={24}
                    travellerWidth={10}
                    startIndex={range.startIndex}
                    endIndex={range.endIndex}
                    onChange={({ startIndex, endIndex }) => {
                      if (startIndex == null || endIndex == null) return;
                      if (startIndex === range.startIndex && endIndex === range.endIndex) return;
                      setPeriodMonths(undefined);
                      setRange({ startIndex, endIndex });
                    }}
                    tickFormatter={formatDate}
                    stroke="#00ffff"
                    fill="rgba(0,0,0,0.3)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card.Body>
      </Card.Root>
    </div>
  );
};
