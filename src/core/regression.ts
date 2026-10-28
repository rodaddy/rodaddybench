import type { StoredRun, ModelSummary } from "./types.ts";

export interface CompareResult {
  runA: { id: string; timestamp: string };
  runB: { id: string; timestamp: string };
  modelDeltas: ModelDelta[];
  excludedTestCases: string[];
}

export interface ModelDelta {
  model: string;
  status: "compared" | "new" | "removed";
  categoryDeltas: Record<string, number>;
  overallDelta: number;
}

export interface Regression {
  model: string;
  category: string | "overall";
  delta: number;
  threshold: number;
}

/**
 * Compare two stored runs and compute per-model, per-category score deltas.
 * Delta = runB score - runA score (positive = improvement, negative = decline).
 */
export function compareRuns(runA: StoredRun, runB: StoredRun): CompareResult {
  // Find test case IDs present in both runs
  const testCaseIdsA = new Set(runA.results.map((r) => r.testCase));
  const testCaseIdsB = new Set(runB.results.map((r) => r.testCase));

  const commonTestCases = new Set(
    [...testCaseIdsA].filter((id) => testCaseIdsB.has(id)),
  );
  const excludedTestCases = [
    ...[...testCaseIdsA].filter((id) => !testCaseIdsB.has(id)),
    ...[...testCaseIdsB].filter((id) => !testCaseIdsA.has(id)),
  ];

  // Filter results to common test cases only
  const resultsA = runA.results.filter((r) => commonTestCases.has(r.testCase));
  const resultsB = runB.results.filter((r) => commonTestCases.has(r.testCase));

  // Build summaries from filtered results
  const summaryA = buildModelSummaries(resultsA);
  const summaryB = buildModelSummaries(resultsB);

  const allModels = new Set([
    ...summaryA.map((s) => s.model),
    ...summaryB.map((s) => s.model),
  ]);

  const modelDeltas: ModelDelta[] = [];

  for (const model of allModels) {
    const a = summaryA.find((s) => s.model === model);
    const b = summaryB.find((s) => s.model === model);

    if (a && b) {
      // Both runs have this model -- compute deltas
      const allCategories = new Set([
        ...Object.keys(a.categoryScores),
        ...Object.keys(b.categoryScores),
      ]);

      const categoryDeltas: Record<string, number> = {};
      for (const cat of allCategories) {
        const scoreA = a.categoryScores[cat] ?? 0;
        const scoreB = b.categoryScores[cat] ?? 0;
        categoryDeltas[cat] = scoreB - scoreA;
      }

      modelDeltas.push({
        model,
        status: "compared",
        categoryDeltas,
        overallDelta: b.overallScore - a.overallScore,
      });
    } else if (b && !a) {
      // New model in runB
      modelDeltas.push({
        model,
        status: "new",
        categoryDeltas: {},
        overallDelta: 0,
      });
    } else {
      // Model removed in runB
      modelDeltas.push({
        model,
        status: "removed",
        categoryDeltas: {},
        overallDelta: 0,
      });
    }
  }

  return {
    runA: { id: runA.runId, timestamp: runA.timestamp },
    runB: { id: runB.runId, timestamp: runB.timestamp },
    modelDeltas: modelDeltas.sort((a, b) => a.model.localeCompare(b.model)),
    excludedTestCases,
  };
}

/**
 * Detect regressions where any category or overall score dropped
 * more than the threshold (default 0.10 = 10pp).
 */
export function detectRegressions(
  result: CompareResult,
  threshold: number = 0.1,
): Regression[] {
  const regressions: Regression[] = [];

  for (const md of result.modelDeltas) {
    if (md.status !== "compared") continue;

    // Check each category
    for (const [cat, delta] of Object.entries(md.categoryDeltas)) {
      if (delta < -threshold) {
        regressions.push({
          model: md.model,
          category: cat,
          delta,
          threshold,
        });
      }
    }

    // Check overall
    if (md.overallDelta < -threshold) {
      regressions.push({
        model: md.model,
        category: "overall",
        delta: md.overallDelta,
        threshold,
      });
    }
  }

  return regressions;
}

/**
 * Resolve a run reference to a full run ID.
 * Supports: full ID match, suffix prefix match (4+ chars), aliases (latest, previous).
 */
export function resolveRunRef(
  ref: string,
  runs: Array<{ runId: string }>,
): string {
  if (runs.length === 0) {
    throw new Error("No runs available");
  }

  // Alias: latest
  if (ref === "latest") {
    return runs[0]!.runId;
  }

  // Alias: previous
  if (ref === "previous") {
    if (runs.length < 2) {
      throw new Error("Not enough runs for 'previous' alias (need at least 2)");
    }
    return runs[1]!.runId;
  }

  // Full ID match
  const exactMatch = runs.find((r) => r.runId === ref);
  if (exactMatch) {
    return exactMatch.runId;
  }

  // Suffix/prefix match (match on any part of the ID)
  const matches = runs.filter((r) => r.runId.includes(ref));
  if (matches.length === 1) {
    return matches[0]!.runId;
  }
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous run reference "${ref}" -- matches: ${matches.map((r) => r.runId).join(", ")}`,
    );
  }

  throw new Error(`No run found matching "${ref}"`);
}

/**
 * Build per-model summaries from a filtered set of results.
 */
function buildModelSummaries(
  results: Array<{ model: string; category: string; score: number }>,
): ModelSummary[] {
  const byModel = new Map<string, Array<{ category: string; score: number }>>();

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

    summaries.push({
      model,
      categoryScores,
      overallScore,
      avgLatencyMs: 0,
      totalTokens: 0,
      errorCount: 0,
      totalCostUsd: 0,
      avgCostPerRequest: 0,
      qualityPerDollar: null,
    });
  }

  return summaries;
}
