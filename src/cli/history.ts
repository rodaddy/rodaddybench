import { parseArgs } from "node:util";
import { listRuns, loadRun } from "../storage/runs.ts";
import type { StoredRun } from "../core/types.ts";
import { displayHistoryTable } from "../display/history-table.ts";

const HISTORY_USAGE = `
Usage: bench history [options]

List past benchmark runs with optional filtering.

Options:
  -m, --model <name>     Filter by model (can specify multiple)
  -c, --category <name>  Filter by category (can specify multiple)
  --since <date>         Show runs on or after date (YYYY-MM-DD)
  --until <date>         Show runs on or before date (YYYY-MM-DD)
  -l, --limit <n>        Max runs to show (default: 20)
  -h, --help             Show this help message

Examples:
  bench history
  bench history --limit 5
  bench history --model claude-sonnet --model gemini-pro
  bench history --since 2026-01-01 --until 2026-02-28
  bench history -c infrastructure -c code-review
`.trim();

export interface HistoryOptions {
  models?: string[];
  categories?: string[];
  since?: string;
  until?: string;
  limit: number;
}

export function parseHistoryArgs(argv: string[]): HistoryOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      model: { type: "string", short: "m", multiple: true },
      category: { type: "string", short: "c", multiple: true },
      since: { type: "string" },
      until: { type: "string" },
      limit: { type: "string", short: "l" },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(HISTORY_USAGE);
    process.exit(0);
  }

  const limit = values.limit ? parseInt(values.limit, 10) : 20;
  if (isNaN(limit) || limit < 1) {
    throw new Error("Limit must be a positive integer");
  }

  return {
    models: values.model ?? undefined,
    categories: values.category ?? undefined,
    since: values.since ?? undefined,
    until: values.until ?? undefined,
    limit,
  };
}

/**
 * Extract the YYYYMMDD date prefix from a run ID for fast date filtering.
 * Run IDs have format: YYYYMMDD-HHmmss-xxxx
 */
function extractDatePrefix(runId: string): string {
  return runId.slice(0, 8);
}

/**
 * Convert a date string (YYYY-MM-DD or ISO 8601) to YYYYMMDD format for comparison.
 */
function toDatePrefix(dateStr: string): string {
  // Handle YYYY-MM-DD format directly
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}${match[2]}${match[3]}`;
  }
  // Try parsing as ISO date
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${mo}${day}`;
}

/**
 * Handle the `bench history` subcommand.
 */
export async function handleHistory(argv: string[]): Promise<void> {
  const opts = parseHistoryArgs(argv);

  // Get all runs (lightweight metadata, sorted newest-first)
  const allRuns = await listRuns();
  const totalCount = allRuns.length;

  if (allRuns.length === 0) {
    console.log("No matching runs found.");
    return;
  }

  // Pre-compute date filter prefixes
  const sincePrefix = opts.since ? toDatePrefix(opts.since) : null;
  const untilPrefix = opts.until ? toDatePrefix(opts.until) : null;

  const needsContentFilter =
    (opts.models && opts.models.length > 0) ||
    (opts.categories && opts.categories.length > 0);

  const filtered: StoredRun[] = [];

  for (const entry of allRuns) {
    // Stop early once we have enough
    if (filtered.length >= opts.limit) break;

    // Fast date filter on run ID prefix (no file read needed)
    const datePrefix = extractDatePrefix(entry.runId);
    if (sincePrefix && datePrefix < sincePrefix) continue;
    if (untilPrefix && datePrefix > untilPrefix) continue;

    // If we need model/category filtering, load the full run
    if (needsContentFilter) {
      const run = await loadRun(entry.runId);
      if (!run) continue;

      // Model filter: run must include at least one of the specified models
      if (opts.models && opts.models.length > 0) {
        const modelSet = new Set(run.modelsDiscovered);
        const hasModel = opts.models.some((m) => modelSet.has(m));
        if (!hasModel) continue;
      }

      // Category filter: run must include at least one result with the specified category
      if (opts.categories && opts.categories.length > 0) {
        const runCategories = new Set(run.results.map((r) => r.category));
        const hasCat = opts.categories.some((c) => runCategories.has(c));
        if (!hasCat) continue;
      }

      filtered.push(run);
    } else {
      // No content filter needed -- load the run for display
      const run = await loadRun(entry.runId);
      if (!run) continue;
      filtered.push(run);
    }
  }

  displayHistoryTable(filtered, totalCount);
}
