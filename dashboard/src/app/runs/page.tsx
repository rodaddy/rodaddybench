export const dynamic = "force-dynamic";

import Link from "next/link";
import { Header } from "@/components/layout/header";
import { listRuns } from "@/lib/queries";
import { getSummariesForRun } from "@/lib/queries";
import { formatDate, formatDuration, shortRunId } from "@/lib/format";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function RunsPage() {
  const runs = listRuns();

  if (runs.length === 0) {
    return (
      <div>
        <Header title="Benchmark Runs" description="No runs recorded yet" />
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center text-zinc-500">
          No benchmark runs found. Run a benchmark to populate the dashboard.
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header
        title="Benchmark Runs"
        description="History of all benchmark runs with model performance summaries"
      />
      <div className="rounded-lg border border-zinc-800 bg-zinc-950">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800">
              <TableHead className="text-zinc-400">Run</TableHead>
              <TableHead className="text-zinc-400">Date</TableHead>
              <TableHead className="text-zinc-400">Models</TableHead>
              <TableHead className="text-zinc-400">Tests</TableHead>
              <TableHead className="text-zinc-400">Best Model</TableHead>
              <TableHead className="text-zinc-400">Duration</TableHead>
              <TableHead className="text-zinc-400">Git</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => {
              const summaries = getSummariesForRun(run.runId);
              const best = summaries[0];
              return (
                <TableRow key={run.runId} className="border-zinc-800">
                  <TableCell>
                    <Link
                      href={`/runs/${run.runId}`}
                      className="font-mono text-blue-400 hover:text-blue-300"
                    >
                      {shortRunId(run.runId)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-zinc-300">
                    {formatDate(run.timestamp)}
                  </TableCell>
                  <TableCell className="text-zinc-300">
                    {run.modelsDiscovered.length}
                  </TableCell>
                  <TableCell className="text-zinc-300">
                    {run.testCaseCount}
                  </TableCell>
                  <TableCell>
                    {best ? (
                      <span className="text-zinc-300">
                        {best.model}{" "}
                        <span className="text-blue-400">
                          {(best.overallScore * 100).toFixed(1)}%
                        </span>
                      </span>
                    ) : (
                      <span className="text-zinc-500">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-zinc-400">
                    {formatDuration(run.durationMs)}
                  </TableCell>
                  <TableCell>
                    {run.gitBranch && (
                      <Badge
                        variant="outline"
                        className="border-zinc-700 text-zinc-400"
                      >
                        {run.gitBranch}
                      </Badge>
                    )}
                    {run.gitDirty && (
                      <Badge
                        variant="outline"
                        className="ml-1 border-yellow-700 text-yellow-400"
                      >
                        dirty
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
