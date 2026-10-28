export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import {
  getRun,
  getSummariesForRun,
  getResultsForRun,
  getAllCategories,
} from "@/lib/queries";
import {
  formatDate,
  formatDuration,
  formatCost,
  shortRunId,
} from "@/lib/format";
import { StatCard } from "@/components/data/stat-card";
import { LeaderboardTable } from "@/components/data/leaderboard-table";
import { RunResultsTable } from "@/components/data/run-results-table";
import { RunRadarChart } from "./radar-wrapper";

interface RunDetailPageProps {
  params: Promise<{ runId: string }>;
}

export default async function RunDetailPage({ params }: RunDetailPageProps) {
  const { runId } = await params;
  const run = getRun(runId);
  if (!run) notFound();

  const summaries = getSummariesForRun(runId);
  const results = getResultsForRun(runId);
  const categories = getAllCategories();

  const totalCost = summaries.reduce((sum, s) => sum + s.totalCostUsd, 0);

  // Build radar data for multi-model overlay
  const radarModels = summaries.map((s) => ({
    model: s.model,
    data: categories.map((cat) => ({
      category: cat,
      score: s.categoryScores[cat] ?? 0,
    })),
  }));

  return (
    <div>
      <Header
        title={`Run ${shortRunId(runId)}`}
        description={`${formatDate(run.timestamp)} - ${run.gitBranch ?? "unknown branch"}`}
      />

      {/* Stats cards */}
      <div className="mb-8 grid grid-cols-4 gap-4">
        <StatCard label="Models Tested" value={run.modelsDiscovered.length} />
        <StatCard label="Test Cases" value={run.testCaseCount} />
        <StatCard label="Duration" value={formatDuration(run.durationMs)} />
        <StatCard label="Total Cost" value={formatCost(totalCost)} />
      </div>

      {/* Radar chart */}
      {radarModels.length > 0 && (
        <div className="mb-8 rounded-lg border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Category Performance
          </h2>
          <RunRadarChart models={radarModels} />
        </div>
      )}

      {/* Leaderboard */}
      <div className="mb-8 rounded-lg border border-zinc-800 bg-zinc-950 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Leaderboard</h2>
        <LeaderboardTable summaries={summaries} categories={categories} />
      </div>

      {/* Results */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Results</h2>
        <RunResultsTable results={results} />
      </div>
    </div>
  );
}
