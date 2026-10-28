export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import {
  getModelSummaries,
  getLatestRunId,
  getResultsForRunAndModel,
  getAllCategories,
} from "@/lib/queries";
import { formatScore, formatCost, formatDate } from "@/lib/format";
import { StatCard } from "@/components/data/stat-card";
import { RunResultsTable } from "@/components/data/run-results-table";
import { ModelCharts } from "./charts-wrapper";

interface ModelDetailPageProps {
  params: Promise<{ model: string }>;
}

export default async function ModelDetailPage({
  params,
}: ModelDetailPageProps) {
  const { model } = await params;
  const decodedModel = decodeURIComponent(model);
  const summaries = getModelSummaries(decodedModel);

  if (summaries.length === 0) notFound();

  const latestRunId = getLatestRunId();
  const latestResults = latestRunId
    ? getResultsForRunAndModel(latestRunId, decodedModel)
    : [];
  const categories = getAllCategories();

  const latest = summaries[summaries.length - 1];
  const bestScore = Math.max(...summaries.map((s) => s.overallScore));
  const avgCost =
    summaries.reduce((sum, s) => sum + s.totalCostUsd, 0) / summaries.length;

  // Trend data (summaries are ordered by timestamp ASC)
  const trendData = summaries.map((s, i) => ({
    timestamp: `Run ${i + 1}`,
    score: s.overallScore,
    label: s.runId.slice(0, 8),
  }));

  // Category breakdown for latest
  const categoryData = categories.map((cat) => ({
    category: cat,
    score: latest.categoryScores[cat] ?? 0,
  }));

  return (
    <div>
      <Header
        title={decodedModel}
        description="Performance history and category breakdown"
      />

      {/* Stats */}
      <div className="mb-8 grid grid-cols-4 gap-4">
        <StatCard
          label="Latest Score"
          value={formatScore(latest.overallScore)}
        />
        <StatCard label="Best Score" value={formatScore(bestScore)} />
        <StatCard label="Avg Cost" value={formatCost(avgCost)} />
        <StatCard label="Total Runs" value={summaries.length} />
      </div>

      {/* Charts */}
      <ModelCharts trendData={trendData} categoryData={categoryData} />

      {/* Recent results */}
      {latestResults.length > 0 && (
        <div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Latest Results
          </h2>
          <RunResultsTable results={latestResults} />
        </div>
      )}
    </div>
  );
}
