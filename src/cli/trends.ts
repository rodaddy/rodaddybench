import { parseArgs } from "node:util";
import chalk from "chalk";
import Table from "cli-table3";
import { listRuns, loadRun } from "../storage/runs.ts";
import type { StoredRun } from "../core/types.ts";
import { modelSparkline } from "../display/sparkline.ts";
import { renderTrendChart } from "../display/trend-chart.ts";
import type { TrendSeries } from "../display/trend-chart.ts";

const TRENDS_USAGE = `
Usage: bench trends [options]

Show model performance trends over time with sparklines and ASCII charts.

Options:
  -m, --model <name>       Filter to specific model(s) (can specify multiple)
  -c, --category <name>    Show category scores instead of overall
  -l, --limit <n>          Max runs to include (default: 20)
  --no-chart               Show only sparkline table, skip chart
  -h, --help               Show this help message

Examples:
  bench trends
  bench trends --limit 10
  bench trends -m claude-sonnet -m gemini-pro
  bench trends -c code-review
  bench trends --no-chart
`.trim();

interface TrendsOptions {
  models?: string[];
  category?: string;
  limit: number;
  noChart: boolean;
}

function parseTrendsArgs(argv: string[]): TrendsOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      model: { type: "string", short: "m", multiple: true },
      category: { type: "string", short: "c" },
      limit: { type: "string", short: "l" },
      "no-chart": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(TRENDS_USAGE);
    process.exit(0);
  }

  const rawLimit = values.limit ? parseInt(values.limit, 10) : 20;
  const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 20 : rawLimit), 30);

  return {
    models: values.model ?? undefined,
    category: values.category ?? undefined,
    limit,
    noChart: values["no-chart"] ?? false,
  };
}

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
 * Extract the relevant score from a run for a given model.
 * Uses categoryScores[category] if category filter is set, otherwise overallScore.
 */
function extractScore(
  run: StoredRun,
  model: string,
  category?: string,
): number | null {
  const summary = run.summary.find((s) => s.model === model);
  if (!summary) return null;

  if (category) {
    const catScore = summary.categoryScores[category];
    return catScore !== undefined ? catScore : null;
  }

  return summary.overallScore;
}

/**
 * Handle the `bench trends` subcommand.
 */
export async function handleTrends(argv: string[]): Promise<void> {
  const opts = parseTrendsArgs(argv);

  // Load run metadata, sorted newest-first
  const allRunMeta = await listRuns();

  if (allRunMeta.length === 0) {
    console.log("No runs found. Run `bench run` first.");
    return;
  }

  // Take latest N runs
  const selectedMeta = allRunMeta.slice(0, opts.limit);

  // Load full runs
  const runs: StoredRun[] = [];
  for (const meta of selectedMeta) {
    const run = await loadRun(meta.runId);
    if (run) runs.push(run);
  }

  if (runs.length === 0) {
    console.log("No runs could be loaded.");
    return;
  }

  // Sort oldest-first for chronological display
  runs.reverse();

  if (runs.length === 1) {
    console.log(chalk.yellow("Only 1 run found. Need 2+ runs for trend data."));
    console.log(
      `Run ID: ${runs[0]!.runId} -- ${runs[0]!.summary.length} models tested`,
    );
    return;
  }

  // Collect all model names across runs
  const allModels = new Set<string>();
  for (const run of runs) {
    for (const s of run.summary) {
      allModels.add(s.model);
    }
  }

  // Apply model filter if specified
  let targetModels: string[];
  if (opts.models && opts.models.length > 0) {
    targetModels = opts.models.filter((m) => allModels.has(m));
    if (targetModels.length === 0) {
      console.log("No matching models found in run history.");
      console.log(`Available models: ${[...allModels].sort().join(", ")}`);
      return;
    }
  } else {
    targetModels = [...allModels].sort();
  }

  // Build series data: for each model, collect (runIndex, score) pairs
  const seriesData: TrendSeries[] = [];
  const modelScores: Map<string, number[]> = new Map();

  for (const model of targetModels) {
    const points: Array<{ runIndex: number; score: number }> = [];
    const scores: number[] = [];

    for (let i = 0; i < runs.length; i++) {
      const score = extractScore(runs[i]!, model, opts.category);
      if (score !== null) {
        points.push({ runIndex: i + 1, score });
        scores.push(score);
      }
    }

    if (points.length > 0) {
      seriesData.push({ model, points });
      modelScores.set(model, scores);
    }
  }

  if (seriesData.length === 0) {
    console.log("No score data found for the selected criteria.");
    return;
  }

  // Section 1: Sparkline summary table
  console.log("");
  console.log(
    chalk.bold(
      `Model Performance Trends (${runs.length} runs${opts.category ? `, category: ${opts.category}` : ""})`,
    ),
  );
  console.log("");

  const table = new Table({
    head: [
      chalk.bold("Model"),
      chalk.bold("Trend"),
      chalk.bold("Low"),
      chalk.bold("High"),
      chalk.bold("Latest"),
    ],
    style: { head: [], border: [] },
  });

  for (const s of seriesData) {
    const scores = modelScores.get(s.model) ?? [];
    const low = Math.min(...scores);
    const high = Math.max(...scores);
    const latest = scores[scores.length - 1] ?? 0;

    table.push([
      s.model,
      modelSparkline(scores),
      formatScore(low),
      formatScore(high),
      formatScore(latest),
    ]);
  }

  console.log(table.toString());
  console.log("");

  // Section 2: ASCII chart (unless --no-chart)
  if (!opts.noChart) {
    const chartTitle = opts.category
      ? `${opts.category} Scores Over Time`
      : "Overall Scores Over Time";

    const chart = renderTrendChart(seriesData, { title: chartTitle });
    console.log(chart);
    console.log("");
  }
}
