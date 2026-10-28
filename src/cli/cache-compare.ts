import { parseArgs } from "node:util";
import { listRuns, loadRun } from "../storage/runs.ts";
import { pairModelVariants } from "../core/nocache.ts";
import {
  displayCacheCompare,
  type CacheComparePair,
  type CacheCompareStats,
} from "../display/cache-compare.ts";
import type { BenchmarkResult } from "../core/types.ts";

const CACHE_COMPARE_USAGE = `
Usage: bench cache-compare [options]

Compare cached vs nocache model variants to measure cache impact.

Options:
  --run <id>    Run ID to analyze (default: latest)
  -h, --help    Show this help message

Output:
  Shows a delta table comparing score, latency, and cost between
  cached and nocache variants of each model. Only models with both
  variants present in the run are included.
`.trim();

function computeStats(results: BenchmarkResult[]): CacheCompareStats {
  if (results.length === 0) {
    return {
      score: 0,
      avgLatencyMs: 0,
      totalCostUsd: 0,
      cachedTokenRatio: null,
    };
  }

  const score = results.reduce((sum, r) => sum + r.score, 0) / results.length;
  const avgLatencyMs =
    results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length;
  const totalCostUsd = results.reduce((sum, r) => sum + (r.costUsd ?? 0), 0);

  // Cached token ratio: total cached prompt tokens / total prompt tokens
  const totalPrompt = results.reduce((sum, r) => sum + r.tokens.prompt, 0);
  const totalCached = results.reduce(
    (sum, r) => sum + (r.tokens.cachedPrompt ?? 0),
    0,
  );
  const cachedTokenRatio =
    totalPrompt > 0 && totalCached > 0 ? totalCached / totalPrompt : null;

  return { score, avgLatencyMs, totalCostUsd, cachedTokenRatio };
}

export async function handleCacheCompare(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      run: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: false,
    strict: true,
  });

  if (values.help) {
    console.log(CACHE_COMPARE_USAGE);
    return;
  }

  // Load runs list
  const runs = await listRuns();
  if (runs.length === 0) {
    console.log("No benchmark runs found. Run benchmarks first with: bench");
    return;
  }

  // Resolve run ID
  const runId = values.run ?? runs[0]!.runId;
  const run = await loadRun(runId);
  if (!run) {
    console.error(`Run not found: ${runId}`);
    process.exit(1);
  }

  // Find paired models
  const pairs = pairModelVariants(run.modelsDiscovered);
  if (pairs.length === 0) {
    console.log("No cached/nocache model pairs found in this run.");
    console.log(
      `Models in run: ${run.modelsDiscovered.slice(0, 5).join(", ")}${run.modelsDiscovered.length > 5 ? "..." : ""}`,
    );
    return;
  }

  // Compute stats for each pair
  const comparePairs: CacheComparePair[] = pairs.map((pair) => {
    const cachedResults = run.results.filter((r) => r.model === pair.cached);
    const nocacheResults = run.results.filter((r) => r.model === pair.nocache);

    return {
      baseName: pair.baseName,
      cached: computeStats(cachedResults),
      nocache: computeStats(nocacheResults),
    };
  });

  console.log(`Run: ${run.runId} (${run.timestamp})`);
  console.log(`Paired models: ${pairs.length}`);
  displayCacheCompare(comparePairs);
}
