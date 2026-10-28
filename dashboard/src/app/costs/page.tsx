export const dynamic = "force-dynamic";

import { Header } from "@/components/layout/header";
import {
  getLatestRunId,
  getSummariesForRun,
  getRunCostSummary,
} from "@/lib/queries";
import { formatCost, formatScore } from "@/lib/format";
import { StatCard } from "@/components/data/stat-card";
import { CostsCharts } from "./charts-wrapper";
import { QualityPerDollarTable } from "./quality-table";

export default function CostsPage() {
  const latestRunId = getLatestRunId();
  const costSummary = getRunCostSummary();

  if (!latestRunId || costSummary.length === 0) {
    return (
      <div>
        <Header
          title="Cost Analysis"
          description="No cost data available yet"
        />
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center text-zinc-500">
          Run benchmarks to see cost analysis.
        </div>
      </div>
    );
  }

  const summaries = getSummariesForRun(latestRunId);

  // Stats
  const totalSpend = costSummary.reduce((sum, r) => sum + r.totalCost, 0);
  const avgCostPerRun = totalSpend / costSummary.length;

  const bestQpd = summaries
    .filter((s) => s.qualityPerDollar !== null && s.qualityPerDollar > 0)
    .sort((a, b) => (b.qualityPerDollar ?? 0) - (a.qualityPerDollar ?? 0))[0];

  // Scatter data for latest run
  const scatterData = summaries.map((s) => ({
    model: s.model,
    score: s.overallScore,
    cost: s.totalCostUsd,
  }));

  // Cost trend data
  const costTrendData = costSummary.map((r) => ({
    timestamp: new Date(r.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    score: r.totalCost, // reusing TrendLine but for cost
    label: r.runId.slice(0, 8),
  }));

  // Quality per dollar table data
  const qpdData = summaries
    .map((s) => ({
      model: s.model,
      score: s.overallScore,
      cost: s.totalCostUsd,
      qualityPerDollar: s.qualityPerDollar,
    }))
    .sort((a, b) => (b.qualityPerDollar ?? 0) - (a.qualityPerDollar ?? 0));

  return (
    <div>
      <Header
        title="Cost Analysis"
        description="Cost efficiency and spending trends across benchmark runs"
      />

      {/* Stats */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <StatCard
          label="Total Spend"
          value={formatCost(totalSpend)}
          detail={`Across ${costSummary.length} runs`}
        />
        <StatCard label="Avg Cost / Run" value={formatCost(avgCostPerRun)} />
        <StatCard
          label="Best Quality/Dollar"
          value={bestQpd ? bestQpd.model : "-"}
          detail={
            bestQpd
              ? `${formatScore(bestQpd.overallScore)} at ${formatCost(bestQpd.totalCostUsd)}`
              : undefined
          }
        />
      </div>

      {/* Charts */}
      <CostsCharts scatterData={scatterData} costTrendData={costTrendData} />

      {/* Quality per dollar table */}
      <div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-950 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">
          Quality per Dollar Rankings
        </h2>
        <QualityPerDollarTable data={qpdData} />
      </div>
    </div>
  );
}
