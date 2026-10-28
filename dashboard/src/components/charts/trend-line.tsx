"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

interface TrendLineProps {
  data: Array<{ timestamp: string; score: number; label?: string }>;
  yDomain?: [number, number];
}

export function TrendLine({ data, yDomain }: TrendLineProps) {
  const chartData = data.map((d) => ({
    ...d,
    displayScore: Math.round(d.score * 100),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart
        data={chartData}
        margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
      >
        <defs>
          <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="timestamp" tick={{ fill: "#71717a", fontSize: 11 }} />
        <YAxis
          domain={yDomain ? [yDomain[0] * 100, yDomain[1] * 100] : [0, 100]}
          tick={{ fill: "#71717a", fontSize: 11 }}
          tickFormatter={(v: number) => `${v}%`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#18181b",
            border: "1px solid #3f3f46",
            borderRadius: 8,
          }}
          labelStyle={{ color: "#fff" }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [`${value}%`, "Score"]}
        />
        <Area
          type="monotone"
          dataKey="displayScore"
          stroke="#3b82f6"
          fill="url(#scoreGradient)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
