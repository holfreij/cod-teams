import { useState, useEffect, useMemo } from "react";
import { Card, Heading } from "@chakra-ui/react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { getPlayers, getMatchHistory } from "../storage";
import { buildRatingTimeline, RatingTimelineRow } from "../ratingTimeline";

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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [players, matches] = await Promise.all([getPlayers(), getMatchHistory()]);
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
          <Heading className="text-xl md:text-2xl font-display font-bold text-cyber-cyan">
            📈 Rating verloop
          </Heading>

          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="cyber-spinner-sm"></div>
            </div>
          ) : timeline.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              Nog geen wedstrijden geregistreerd.
            </p>
          ) : (
            <div className="rating-chart h-80">
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
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card.Body>
      </Card.Root>
    </div>
  );
};
