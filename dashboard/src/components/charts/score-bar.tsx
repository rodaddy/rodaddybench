"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { getModelColor } from "@/lib/vendor";

interface ScoreBarProps {
  data: Array<{ model: string; score: number; color?: string }>;
}

export function ScoreBar({ data }: ScoreBarProps) {
  const sorted = [...data].sort((a, b) => b.score - a.score);
  const chartData = sorted.map((d) => ({
    ...d,
    displayScore: Math.round(d.score * 100),
    fill: d.color ?? getModelColor(d.model),
  }));

  return (
    <ResponsiveContainer
      width="100%"
      height={Math.max(200, chartData.length * 40)}
    >
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ left: 120, right: 40 }}
      >
        <XAxis type="number" domain={[0, 100]} tick={{ fill: "#71717a" }} />
        <YAxis
          type="category"
          dataKey="model"
          tick={{ fill: "#a1a1aa", fontSize: 12 }}
          width={110}
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
        <Bar dataKey="displayScore" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
          <LabelList
            dataKey="displayScore"
            position="right"
            fill="#a1a1aa"
            fontSize={12}
            formatter={(v: any) => `${v}%`}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
