"use client";

import { TrendLine } from "@/components/charts/trend-line";
import { ScoreBar } from "@/components/charts/score-bar";

interface ModelChartsProps {
  trendData: Array<{ timestamp: string; score: number; label?: string }>;
  categoryData: Array<{ category: string; score: number }>;
}

export function ModelCharts({ trendData, categoryData }: ModelChartsProps) {
  const barData = categoryData.map((d) => ({
    model: d.category,
    score: d.score,
  }));

  return (
    <div className="grid grid-cols-2 gap-4">
      {trendData.length > 1 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Score Trend</h2>
          <TrendLine data={trendData} yDomain={[0, 1]} />
        </div>
      )}
      <div
        className={`rounded-lg border border-zinc-800 bg-zinc-950 p-6 ${trendData.length <= 1 ? "col-span-2" : ""}`}
      >
        <h2 className="mb-4 text-lg font-semibold text-white">
          Category Breakdown
        </h2>
        <ScoreBar data={barData} />
      </div>
    </div>
  );
}
