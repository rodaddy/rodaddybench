export const dynamic = "force-dynamic";

import { Header } from "@/components/layout/header";
import {
  getLatestRunId,
  getSummariesForRun,
  getAllCategories,
  listRuns,
} from "@/lib/queries";
import { LeaderboardTable } from "@/components/data/leaderboard-table";
import { LeaderboardTabs } from "./tabs-wrapper";

export default function LeaderboardPage() {
  const latestRunId = getLatestRunId();

  if (!latestRunId) {
    return (
      <div>
        <Header title="Leaderboard" description="No runs recorded yet" />
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center text-zinc-500">
          Run a benchmark to see the leaderboard.
        </div>
      </div>
    );
  }

  const runs = listRuns();
  const summaries = getSummariesForRun(latestRunId);
  const categories = getAllCategories();

  return (
    <div>
      <Header
        title="Leaderboard"
        description={`Latest run: ${latestRunId.slice(0, 8)} - ${runs[0]?.timestamp ? new Date(runs[0].timestamp).toLocaleDateString() : ""}`}
      />

      <LeaderboardTabs summaries={summaries} categories={categories} />
    </div>
  );
}
