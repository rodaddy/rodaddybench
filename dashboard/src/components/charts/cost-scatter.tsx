"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Label,
} from "recharts";
import { getModelColor, getVendor, VENDOR_COLORS } from "@/lib/vendor";

interface CostScatterProps {
  data: Array<{ model: string; score: number; cost: number; vendor?: string }>;
}

export function CostScatter({ data }: CostScatterProps) {
  const chartData = data.map((d) => ({
    ...d,
    displayScore: Math.round(d.score * 100),
    fill: d.vendor
      ? (VENDOR_COLORS[d.vendor] ?? VENDOR_COLORS.unknown)
      : getModelColor(d.model),
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <ScatterChart margin={{ top: 20, right: 20, bottom: 30, left: 20 }}>
        <XAxis
          dataKey="cost"
          type="number"
          tick={{ fill: "#71717a", fontSize: 11 }}
          tickFormatter={(v: number) => `$${v.toFixed(2)}`}
        >
          <Label
            value="Total Cost (USD)"
            position="bottom"
            offset={10}
            fill="#71717a"
            fontSize={12}
          />
        </XAxis>
        <YAxis
          dataKey="displayScore"
          type="number"
          domain={[0, 100]}
          tick={{ fill: "#71717a", fontSize: 11 }}
          tickFormatter={(v: number) => `${v}%`}
        >
          <Label
            value="Quality Score"
            angle={-90}
            position="insideLeft"
            offset={-5}
            fill="#71717a"
            fontSize={12}
          />
        </YAxis>
        <Tooltip
          contentStyle={{
            backgroundColor: "#18181b",
            border: "1px solid #3f3f46",
            borderRadius: 8,
          }}
          labelStyle={{ color: "#fff" }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => {
            if (name === "displayScore") return [`${value}%`, "Score"];
            if (name === "cost")
              return [`$${Number(value).toFixed(4)}`, "Cost"];
            return [String(value), String(name)];
          }}
          labelFormatter={(_, payload) => {
            const item = payload?.[0]?.payload;
            return item?.model ?? "";
          }}
        />
        <Scatter data={chartData} name="Models">
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.fill} r={8} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
