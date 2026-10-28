import chalk from "chalk";
import Table from "cli-table3";
import type { StoredRun } from "../core/types.ts";

/**
 * Format a score as a colored percentage string.
 */
function formatScore(score: number): string {
  const pct = `${Math.round(score * 100)}%`;
  if (score >= 0.7) return chalk.green(pct);
  if (score >= 0.4) return chalk.yellow(pct);
  return chalk.red(pct);
}

/**
 * Format milliseconds as human-readable duration (e.g., "45s" or "2m 12s").
 */
function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

/**
 * Format a timestamp as YYYY-MM-DD HH:mm.
 */
function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${y}-${mo}-${day} ${h}:${mi}`;
}

/**
 * Format model list -- show names if <= 3, otherwise show count.
 */
function formatModels(models: string[]): string {
  if (models.length <= 3) return models.join(", ");
  return `${models.length} models`;
}

/**
 * Get the highest overall score from a run's summary array.
 */
function getTopScore(run: StoredRun): number | null {
  if (!run.summary || run.summary.length === 0) return null;
  return Math.max(...run.summary.map((s) => s.overallScore));
}

/**
 * Render a formatted history table of past benchmark runs.
 */
export function displayHistoryTable(
  runs: StoredRun[],
  totalCount: number,
): void {
  if (runs.length === 0) {
    console.log("No matching runs found.");
    return;
  }

  const table = new Table({
    head: [
      chalk.bold("Run ID"),
      chalk.bold("Date"),
      chalk.bold("Models"),
      chalk.bold("Tests"),
      chalk.bold("Top Score"),
      chalk.bold("Duration"),
    ],
    style: { head: [], border: [] },
  });

  for (const run of runs) {
    const shortId = run.runId.slice(-4);
    const topScore = getTopScore(run);

    const row: string[] = [
      shortId + " " + chalk.dim(run.runId),
      formatDate(run.timestamp),
      formatModels(run.modelsDiscovered),
      String(run.testCaseCount),
      topScore !== null ? formatScore(topScore) : chalk.dim("-"),
      formatDuration(run.durationMs),
    ];
    table.push(row);
  }

  console.log("");
  console.log(table.toString());
  console.log("");
  console.log(`Showing ${runs.length} of ${totalCount} runs`);
}
