"use client";

import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { getIndexColor } from "@/lib/vendor";

interface RadarChartProps {
  data: Array<{ category: string; score: number }>;
  models?: Array<{
    model: string;
    data: Array<{ category: string; score: number }>;
  }>;
}

export function RadarChart({ data, models }: RadarChartProps) {
  if (models && models.length > 0) {
    const categories = models[0].data.map((d) => d.category);
    const merged = categories.map((cat) => {
      const point: Record<string, string | number> = { category: cat };
      for (const m of models) {
        const found = m.data.find((d) => d.category === cat);
        point[m.model] = found ? Math.round(found.score * 100) : 0;
      }
      return point;
    });

    return (
      <ResponsiveContainer width="100%" height={400}>
        <RechartsRadarChart data={merged}>
          <PolarGrid stroke="#3f3f46" />
          <PolarAngleAxis
            dataKey="category"
            tick={{ fill: "#a1a1aa", fontSize: 12 }}
          />
          <PolarRadiusAxis
            domain={[0, 100]}
            tick={{ fill: "#71717a", fontSize: 10 }}
          />
          {models.map((m, i) => (
            <Radar
              key={m.model}
              name={m.model}
              dataKey={m.model}
              stroke={getIndexColor(i)}
              fill={getIndexColor(i)}
              fillOpacity={0.15}
            />
          ))}
          <Legend wrapperStyle={{ color: "#a1a1aa", fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: 8,
            }}
            labelStyle={{ color: "#fff" }}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    );
  }

  const chartData = data.map((d) => ({
    category: d.category,
    score: Math.round(d.score * 100),
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <RechartsRadarChart data={chartData}>
        <PolarGrid stroke="#3f3f46" />
        <PolarAngleAxis
          dataKey="category"
          tick={{ fill: "#a1a1aa", fontSize: 12 }}
        />
        <PolarRadiusAxis
          domain={[0, 100]}
          tick={{ fill: "#71717a", fontSize: 10 }}
        />
        <Radar
          name="Score"
          dataKey="score"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.3}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#18181b",
            border: "1px solid #3f3f46",
            borderRadius: 8,
          }}
          labelStyle={{ color: "#fff" }}
        />
      </RechartsRadarChart>
    </ResponsiveContainer>
  );
}
