import chalk from "chalk";
import Table from "cli-table3";
import type { BenchmarkResult, ModelSummary } from "../core/types.ts";

export type { ModelSummary };

/**
 * Aggregate raw benchmark results into per-model summaries.
 * Exported separately for testability.
 */
export function aggregateResults(results: BenchmarkResult[]): ModelSummary[] {
  const byModel = new Map<string, BenchmarkResult[]>();

  for (const r of results) {
    const existing = byModel.get(r.model);
    if (existing) {
      existing.push(r);
    } else {
      byModel.set(r.model, [r]);
    }
  }

  const summaries: ModelSummary[] = [];

  for (const [model, modelResults] of byModel) {
    // Per-category average scores
    const byCategory = new Map<string, number[]>();
    for (const r of modelResults) {
      const existing = byCategory.get(r.category);
      if (existing) {
        existing.push(r.score);
      } else {
        byCategory.set(r.category, [r.score]);
      }
    }

    const categoryScores: Record<string, number> = {};
    for (const [cat, scores] of byCategory) {
      categoryScores[cat] = scores.reduce((a, b) => a + b, 0) / scores.length;
    }

    const overallScore =
      modelResults.reduce((sum, r) => sum + r.score, 0) / modelResults.length;
    const avgLatencyMs =
      modelResults.reduce((sum, r) => sum + r.latencyMs, 0) /
      modelResults.length;
    const totalTokens = modelResults.reduce(
      (sum, r) => sum + r.tokens.total,
      0,
    );
    const errorCount = modelResults.filter((r) => r.error).length;

    const totalCostUsd = modelResults.reduce(
      (sum, r) => sum + (r.costUsd ?? 0),
      0,
    );
    const avgCostPerRequest = totalCostUsd / modelResults.length;

    summaries.push({
      model,
      categoryScores,
      overallScore,
      avgLatencyMs,
      totalTokens,
      errorCount,
      totalCostUsd,
      avgCostPerRequest,
      qualityPerDollar: totalCostUsd > 0 ? overallScore / totalCostUsd : null,
    });
  }

  return summaries.sort((a, b) => b.overallScore - a.overallScore);
}

// -- Formatting helpers --

function formatScore(score: number): string {
  const pct = `${Math.round(score * 100)}%`;
  if (score >= 0.7) return chalk.green(pct);
  if (score >= 0.4) return chalk.yellow(pct);
  return chalk.red(pct);
}

function formatLatency(ms: number): string {
  return chalk.cyan(`${Math.round(ms)}ms`);
}

function formatTokens(count: number): string {
  return chalk.dim(count.toLocaleString("en-US"));
}

function formatErrors(count: number): string {
  return count > 0 ? chalk.red(String(count)) : chalk.dim("0");
}

function formatCost(usd: number): string {
  if (usd === 0) return chalk.dim("$0.00");
  const formatted = usd >= 0.01 ? `$${usd.toFixed(2)}` : `$${usd.toFixed(4)}`;
  return chalk.magenta(formatted);
}

/**
 * Render benchmark results as a colorized terminal table.
 */
function formatCriterionScore(score: number, maxScore: number): string {
  const ratio = maxScore > 0 ? score / maxScore : 0;
  const text = `${score}/${maxScore}`;
  if (ratio >= 0.7) return chalk.green(text);
  if (ratio >= 0.4) return chalk.yellow(text);
  return chalk.red(text);
}

export function displayResults(
  results: BenchmarkResult[],
  verbose?: boolean,
): void {
  if (results.length === 0) {
    console.log("No results to display.");
    return;
  }

  const summaries = aggregateResults(results);

  // Collect all categories across all models
  const allCategories = new Set<string>();
  for (const s of summaries) {
    for (const cat of Object.keys(s.categoryScores)) {
      allCategories.add(cat);
    }
  }
  const categories = [...allCategories].sort();

  // Build table
  const table = new Table({
    head: [
      chalk.bold("Model"),
      ...categories.map((c) => chalk.bold(c)),
      chalk.bold("Overall"),
      chalk.bold("Avg Latency"),
      chalk.bold("Total Tokens"),
      chalk.bold("Cost"),
      chalk.bold("Errors"),
      chalk.bold("Bias"),
    ],
    style: { head: [], border: [] },
  });

  for (const summary of summaries) {
    // Count position swap inconsistencies for this model
    const modelSwapResults = results.filter(
      (r) => r.model === summary.model && r.judgeMetadata?.positionSwap,
    );
    const modelInconsistent = modelSwapResults.filter(
      (r) => r.judgeMetadata!.positionSwap!.isConsistent === false,
    ).length;
    const modelSwapTotal = modelSwapResults.length;
    let biasCell: string;
    if (modelSwapTotal === 0) {
      biasCell = chalk.dim("-");
    } else if (modelInconsistent === 0) {
      biasCell = chalk.green(`0/${modelSwapTotal}`);
    } else {
      biasCell = chalk.red(`${modelInconsistent}/${modelSwapTotal}`);
    }

    const row: string[] = [
      summary.model,
      ...categories.map((cat) => {
        const score = summary.categoryScores[cat];
        return score !== undefined ? formatScore(score) : chalk.dim("-");
      }),
      formatScore(summary.overallScore),
      formatLatency(summary.avgLatencyMs),
      formatTokens(summary.totalTokens),
      formatCost(summary.totalCostUsd),
      formatErrors(summary.errorCount),
      biasCell,
    ];
    table.push(row);
  }

  console.log("");
  console.log(table.toString());

  // Summary line
  const totalTests = results.length;
  const totalModels = summaries.length;
  const totalErrors = results.filter((r) => r.error).length;

  console.log("");
  console.log(
    `Total: ${totalTests} test cases, ${totalModels} models, ${totalErrors} errors`,
  );

  if (totalErrors > 0) {
    console.log(
      chalk.yellow(
        `Warning: ${totalErrors} test case(s) failed. Use --verbose for details.`,
      ),
    );
  }

  // Verbose: per-criterion breakdown grouped by model
  if (verbose) {
    const byModel = new Map<string, BenchmarkResult[]>();
    for (const r of results) {
      if (!r.judgeMetadata?.criterionBreakdown?.length) continue;
      const existing = byModel.get(r.model);
      if (existing) existing.push(r);
      else byModel.set(r.model, [r]);
    }

    if (byModel.size > 0) {
      console.log("");
      console.log(chalk.bold("Per-Criterion Breakdown:"));

      for (const [model, modelResults] of byModel) {
        console.log("");
        console.log(chalk.bold.underline(model));

        // Get all criterion names from first result for headers
        const firstMeta = modelResults[0]?.judgeMetadata;
        if (!firstMeta?.criterionBreakdown) continue;
        const criterionNames = firstMeta.criterionBreakdown.map((c) => c.name);

        const criterionTable = new Table({
          head: [
            chalk.bold("Test Case"),
            ...criterionNames.map((n) => chalk.bold(n)),
          ],
          style: { head: [], border: [] },
        });

        for (const r of modelResults) {
          const breakdown = r.judgeMetadata!.criterionBreakdown;
          const row: string[] = [
            r.testCase,
            ...criterionNames.map((name) => {
              const c = breakdown.find((b) => b.name === name);
              return c
                ? formatCriterionScore(c.score, c.maxScore)
                : chalk.dim("-");
            }),
          ];
          criterionTable.push(row);
        }

        console.log(criterionTable.toString());
      }
    }
  }
}
