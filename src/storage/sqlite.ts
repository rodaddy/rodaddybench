import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { StoredRun } from "../core/types.ts";

const DEFAULT_DB_PATH = join(process.cwd(), "data", "rodaddybench.db");

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS runs (
  run_id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  git_commit TEXT,
  git_branch TEXT,
  git_dirty INTEGER NOT NULL DEFAULT 0,
  config TEXT NOT NULL,
  models_discovered TEXT NOT NULL,
  test_case_count INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES runs(run_id),
  model TEXT NOT NULL,
  test_case TEXT NOT NULL,
  category TEXT NOT NULL,
  response TEXT NOT NULL,
  score REAL NOT NULL,
  latency_ms INTEGER NOT NULL,
  tokens_prompt INTEGER NOT NULL,
  tokens_completion INTEGER NOT NULL,
  tokens_total INTEGER NOT NULL,
  tokens_cached_prompt INTEGER,
  error TEXT,
  cost_usd REAL,
  judge_metadata TEXT,
  checklist_metadata TEXT
);

CREATE TABLE IF NOT EXISTS summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES runs(run_id),
  model TEXT NOT NULL,
  overall_score REAL NOT NULL,
  category_scores TEXT NOT NULL,
  avg_latency_ms REAL NOT NULL,
  total_tokens INTEGER NOT NULL,
  error_count INTEGER NOT NULL,
  total_cost_usd REAL NOT NULL,
  avg_cost_per_request REAL NOT NULL,
  quality_per_dollar REAL
);

CREATE INDEX IF NOT EXISTS idx_results_run_model ON results(run_id, model);
CREATE INDEX IF NOT EXISTS idx_summaries_run ON summaries(run_id);
`;

/**
 * Open or create the SQLite database with WAL mode enabled.
 * Creates the schema if it doesn't exist.
 */
export function initDb(dbPath: string = DEFAULT_DB_PATH): Database {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath, { create: true });

  // Enable WAL mode for better concurrency
  db.run("PRAGMA journal_mode = WAL;");

  // Create schema -- run each statement individually
  for (const stmt of SCHEMA_SQL.split(";")
    .map((s) => s.trim())
    .filter(Boolean)) {
    db.run(`${stmt};`);
  }

  return db;
}

/**
 * Insert a complete benchmark run into the database.
 * Uses a transaction to ensure atomicity across all three tables.
 */
export function insertRun(db: Database, run: StoredRun): void {
  const txn = db.transaction(() => {
    // Insert run metadata
    db.prepare(
      `
      INSERT INTO runs (
        run_id, timestamp, git_commit, git_branch, git_dirty,
        config, models_discovered, test_case_count, duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      run.runId,
      run.timestamp,
      run.gitCommit,
      run.gitBranch,
      run.gitDirty ? 1 : 0,
      JSON.stringify(run.config),
      JSON.stringify(run.modelsDiscovered),
      run.testCaseCount,
      run.durationMs,
    );

    // Insert results
    const insertResult = db.prepare(`
      INSERT INTO results (
        run_id, model, test_case, category, response, score,
        latency_ms, tokens_prompt, tokens_completion, tokens_total,
        tokens_cached_prompt, error, cost_usd, judge_metadata,
        checklist_metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const result of run.results) {
      insertResult.run(
        run.runId,
        result.model,
        result.testCase,
        result.category,
        result.response,
        result.score,
        result.latencyMs,
        result.tokens.prompt,
        result.tokens.completion,
        result.tokens.total,
        result.tokens.cachedPrompt ?? null,
        result.error ?? null,
        result.costUsd ?? null,
        result.judgeMetadata ? JSON.stringify(result.judgeMetadata) : null,
        result.checklistMetadata
          ? JSON.stringify(result.checklistMetadata)
          : null,
      );
    }

    // Insert summaries
    const insertSummary = db.prepare(`
      INSERT INTO summaries (
        run_id, model, overall_score, category_scores,
        avg_latency_ms, total_tokens, error_count,
        total_cost_usd, avg_cost_per_request, quality_per_dollar
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const summary of run.summary) {
      insertSummary.run(
        run.runId,
        summary.model,
        summary.overallScore,
        JSON.stringify(summary.categoryScores),
        summary.avgLatencyMs,
        summary.totalTokens,
        summary.errorCount,
        summary.totalCostUsd,
        summary.avgCostPerRequest,
        summary.qualityPerDollar ?? null,
      );
    }
  });

  txn();
}

/**
 * Check if a run ID already exists in the database.
 */
export function runExists(db: Database, runId: string): boolean {
  const result = db
    .prepare("SELECT 1 FROM runs WHERE run_id = ? LIMIT 1")
    .get(runId);
  return result !== null;
}
