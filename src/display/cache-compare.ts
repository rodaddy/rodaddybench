import chalk from "chalk";
import Table from "cli-table3";

export interface CacheCompareStats {
  score: number;
  avgLatencyMs: number;
  totalCostUsd: number;
  cachedTokenRatio: number | null;
}

export interface CacheComparePair {
  baseName: string;
  cached: CacheCompareStats;
  nocache: CacheCompareStats;
}

function formatDelta(
  value: number,
  suffix: string,
  invertColor = false,
): string {
  const sign = value > 0 ? "+" : "";
  const text = `${sign}${value.toFixed(1)}${suffix}`;
  // For latency/cost: negative is good (green). For score: positive is good.
  const isGood = invertColor ? value < 0 : value > 0;
  if (value === 0) return chalk.dim(text);
  return isGood ? chalk.green(text) : chalk.red(text);
}

function formatPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatLatency(ms: number): string {
  return `${Math.round(ms)}ms`;
}

/**
 * Display a comparison table of cached vs nocache model variants.
 * Shows score, latency, and cost deltas to reveal cache impact.
 */
export function displayCacheCompare(pairs: CacheComparePair[]): void {
  if (pairs.length === 0) {
    console.log("No cached/nocache model pairs found in this run.");
    return;
  }

  const table = new Table({
    head: [
      chalk.bold("Model"),
      chalk.bold("Cached Score"),
      chalk.bold("Nocache Score"),
      chalk.bold("Score Delta"),
      chalk.bold("Cached Latency"),
      chalk.bold("Nocache Latency"),
      chalk.bold("Latency Delta"),
      chalk.bold("Cost Delta"),
    ],
    style: { head: [], border: [] },
  });

  for (const pair of pairs) {
    const scoreDelta = (pair.cached.score - pair.nocache.score) * 100;
    const latencyDeltaPct =
      pair.nocache.avgLatencyMs > 0
        ? ((pair.cached.avgLatencyMs - pair.nocache.avgLatencyMs) /
            pair.nocache.avgLatencyMs) *
          100
        : 0;
    const costDelta = pair.cached.totalCostUsd - pair.nocache.totalCostUsd;

    table.push([
      pair.baseName,
      formatPct(pair.cached.score),
      formatPct(pair.nocache.score),
      formatDelta(scoreDelta, "pp"),
      formatLatency(pair.cached.avgLatencyMs),
      formatLatency(pair.nocache.avgLatencyMs),
      formatDelta(latencyDeltaPct, "%", true),
      formatDelta(costDelta, "", true),
    ]);
  }

  console.log("");
  console.log(chalk.bold("Cache vs Nocache Comparison"));
  console.log(table.toString());
  console.log("");
  console.log(
    chalk.dim(
      "Note: Score deltas reflect model stochasticity, not cache quality. " +
        "Latency and cost deltas indicate cache impact.",
    ),
  );
}
