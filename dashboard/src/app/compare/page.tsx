export const dynamic = "force-dynamic";

import { Header } from "@/components/layout/header";
import {
  listRunIds,
  getSummariesForRun,
  getAllCategories,
} from "@/lib/queries";
import { CompareClient } from "./compare-client";
import type { Summary } from "@/lib/types";

export default function ComparePage() {
  const runIds = listRunIds();
  const categories = getAllCategories();

  if (runIds.length < 1) {
    return (
      <div>
        <Header
          title="Compare Runs"
          description="Need at least one run to compare"
        />
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center text-zinc-500">
          Run benchmarks first to use the comparison view.
        </div>
      </div>
    );
  }

  // Pre-fetch summaries for all runs so the client can switch instantly
  const summariesByRun: Record<string, Summary[]> = {};
  for (const r of runIds) {
    summariesByRun[r.runId] = getSummariesForRun(r.runId);
  }

  return (
    <div>
      <Header
        title="Compare Runs"
        description="Side-by-side comparison of two benchmark runs"
      />
      <CompareClient
        runIds={runIds}
        summariesByRun={summariesByRun}
        categories={categories}
      />
    </div>
  );
}
