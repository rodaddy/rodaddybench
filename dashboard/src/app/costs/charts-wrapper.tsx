"use client";

import { CostScatter } from "@/components/charts/cost-scatter";
import { TrendLine } from "@/components/charts/trend-line";

interface CostsChartsProps {
  scatterData: Array<{ model: string; score: number; cost: number }>;
  costTrendData: Array<{ timestamp: string; score: number; label?: string }>;
}

export function CostsCharts({ scatterData, costTrendData }: CostsChartsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">
          Quality vs Cost
        </h2>
        <CostScatter data={scatterData} />
      </div>
      {costTrendData.length > 1 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Cost per Run Trend
          </h2>
          <TrendLine data={costTrendData} />
        </div>
      )}
    </div>
  );
}
