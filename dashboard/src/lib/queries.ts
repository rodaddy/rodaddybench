import { getDb } from "./db";
import type {
  RunRow,
  ResultRow,
  SummaryRow,
  Run,
  Summary,
  Result,
} from "./types";

function parseRun(row: RunRow): Run {
  return {
    runId: row.run_id,
    timestamp: new Date(row.timestamp),
    gitCommit: row.git_commit,
    gitBranch: row.git_branch,
    gitDirty: row.git_dirty === 1,
    config: JSON.parse(row.config),
    modelsDiscovered: JSON.parse(row.models_discovered),
    testCaseCount: row.test_case_count,
    durationMs: row.duration_ms,
  };
}

function parseSummary(row: SummaryRow): Summary {
  return {
    runId: row.run_id,
    model: row.model,
    overallScore: row.overall_score,
    categoryScores: JSON.parse(row.category_scores),
    avgLatencyMs: row.avg_latency_ms,
    totalTokens: row.total_tokens,
    errorCount: row.error_count,
    totalCostUsd: row.total_cost_usd,
    avgCostPerRequest: row.avg_cost_per_request,
    qualityPerDollar: row.quality_per_dollar,
  };
}

function parseResult(row: ResultRow): Result {
  return {
    id: row.id,
    runId: row.run_id,
    model: row.model,
    testCase: row.test_case,
    category: row.category,
    response: row.response,
    score: row.score,
    latencyMs: row.latency_ms,
    tokens: {
      prompt: row.tokens_prompt,
      completion: row.tokens_completion,
      total: row.tokens_total,
      cachedPrompt: row.tokens_cached_prompt,
    },
    error: row.error,
    costUsd: row.cost_usd,
    judgeMetadata: row.judge_metadata ? JSON.parse(row.judge_metadata) : null,
    checklistMetadata: row.checklist_metadata
      ? JSON.parse(row.checklist_metadata)
      : null,
  };
}

// === Run queries ===
export function listRuns(limit = 50): Run[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
    SELECT r.* FROM runs r
    WHERE EXISTS (SELECT 1 FROM summaries s WHERE s.run_id = r.run_id)
    ORDER BY r.timestamp DESC LIMIT ?
  `,
    )
    .all(limit) as RunRow[];
  return rows.map(parseRun);
}

export function getRun(runId: string): Run | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM runs WHERE run_id = ?").get(runId) as
    RunRow | undefined;
  return row ? parseRun(row) : null;
}

export function getLatestRunId(): string | null {
  const db = getDb();
  const row = db
    .prepare(
      `
    SELECT r.run_id FROM runs r
    WHERE EXISTS (SELECT 1 FROM summaries s WHERE s.run_id = r.run_id)
    ORDER BY r.timestamp DESC LIMIT 1
  `,
    )
    .get() as { run_id: string } | undefined;
  return row?.run_id ?? null;
}

// === Summary queries ===
export function getSummariesForRun(runId: string): Summary[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM summaries WHERE run_id = ? ORDER BY overall_score DESC",
    )
    .all(runId) as SummaryRow[];
  return rows.map(parseSummary);
}

export function getModelSummaries(model: string, limit = 50): Summary[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
    SELECT s.* FROM summaries s
    JOIN runs r ON s.run_id = r.run_id
    WHERE s.model = ?
    ORDER BY r.timestamp ASC
    LIMIT ?
  `,
    )
    .all(model, limit) as SummaryRow[];
  return rows.map(parseSummary);
}

export function getAllModels(): string[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT DISTINCT model FROM summaries ORDER BY model")
    .all() as { model: string }[];
  return rows.map((r) => r.model);
}

export function getAllCategories(): string[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT DISTINCT category FROM results ORDER BY category")
    .all() as { category: string }[];
  return rows.map((r) => r.category);
}

export function listRunIds(): Array<{ runId: string; timestamp: string }> {
  const db = getDb();
  return db
    .prepare(
      `
    SELECT r.run_id as runId, r.timestamp FROM runs r
    WHERE EXISTS (SELECT 1 FROM summaries s WHERE s.run_id = r.run_id)
    ORDER BY r.timestamp DESC LIMIT 50
  `,
    )
    .all() as Array<{ runId: string; timestamp: string }>;
}

export function getRunCostSummary(): Array<{
  runId: string;
  timestamp: string;
  totalCost: number;
  avgScore: number;
}> {
  const db = getDb();
  return db
    .prepare(
      `
    SELECT r.run_id as runId, r.timestamp,
           SUM(s.total_cost_usd) as totalCost,
           AVG(s.overall_score) as avgScore
    FROM runs r JOIN summaries s ON r.run_id = s.run_id
    GROUP BY r.run_id
    ORDER BY r.timestamp ASC
  `,
    )
    .all() as Array<{
    runId: string;
    timestamp: string;
    totalCost: number;
    avgScore: number;
  }>;
}

// === Result queries ===
export function getResultsForRun(runId: string): Result[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM results WHERE run_id = ? ORDER BY model, category, test_case",
    )
    .all(runId) as ResultRow[];
  return rows.map(parseResult);
}

export function getResultsForRunAndModel(
  runId: string,
  model: string,
): Result[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM results WHERE run_id = ? AND model = ? ORDER BY category, test_case",
    )
    .all(runId, model) as ResultRow[];
  return rows.map(parseResult);
}
