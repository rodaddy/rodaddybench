import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import type { StoredRun } from "../core/types.ts";

const DEFAULT_RESULTS_DIR = join(process.cwd(), "results", "runs");

/**
 * Generate a human-readable, sortable, unique run ID.
 * Format: YYYYMMDD-HHmmss-xxxx (UTC timestamp + 4 hex chars)
 */
export function generateRunId(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const mo = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const h = String(now.getUTCHours()).padStart(2, "0");
  const mi = String(now.getUTCMinutes()).padStart(2, "0");
  const s = String(now.getUTCSeconds()).padStart(2, "0");
  const hex = crypto.randomUUID().slice(0, 4);
  return `${y}${mo}${d}-${h}${mi}${s}-${hex}`;
}

/**
 * Capture current git metadata (commit, branch, dirty status).
 * Returns null values gracefully when not in a git repo.
 */
export async function getGitMetadata(): Promise<{
  commit: string | null;
  branch: string | null;
  dirty: boolean;
}> {
  let commit: string | null = null;
  let branch: string | null = null;
  let dirty = false;

  try {
    const commitProc = Bun.spawn(["git", "rev-parse", "--short", "HEAD"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const commitText = await new Response(commitProc.stdout).text();
    await commitProc.exited;
    if (commitProc.exitCode === 0) {
      commit = commitText.trim() || null;
    }
  } catch {
    // Not in a git repo or git not available
  }

  try {
    const branchProc = Bun.spawn(["git", "rev-parse", "--abbrev-ref", "HEAD"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const branchText = await new Response(branchProc.stdout).text();
    await branchProc.exited;
    if (branchProc.exitCode === 0) {
      branch = branchText.trim() || null;
    }
  } catch {
    // Not in a git repo or git not available
  }

  try {
    const dirtyProc = Bun.spawn(["git", "status", "--porcelain"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const dirtyText = await new Response(dirtyProc.stdout).text();
    await dirtyProc.exited;
    if (dirtyProc.exitCode === 0) {
      dirty = dirtyText.trim().length > 0;
    }
  } catch {
    // Not in a git repo or git not available
  }

  return { commit, branch, dirty };
}

/**
 * Persist a run to disk as JSON.
 * Creates the results directory if it doesn't exist.
 */
export async function saveRun(
  run: StoredRun,
  baseDir: string = DEFAULT_RESULTS_DIR,
): Promise<void> {
  await mkdir(baseDir, { recursive: true });
  const filePath = join(baseDir, `${run.runId}.json`);
  await Bun.write(filePath, JSON.stringify(run, null, 2));

  // Also write to SQLite (non-blocking, errors logged but don't fail the run)
  try {
    const { initDb, insertRun } = await import("./sqlite.ts");
    const db = initDb();
    insertRun(db, run);
    db.close();
  } catch (err) {
    console.error(
      "[sqlite] Failed to write run:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Load a run by ID. Returns null if not found.
 */
export async function loadRun(
  runId: string,
  baseDir: string = DEFAULT_RESULTS_DIR,
): Promise<StoredRun | null> {
  const filePath = join(baseDir, `${runId}.json`);
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    return null;
  }
  const text = await file.text();
  const run = JSON.parse(text) as StoredRun;
  // Backfill cost fields for runs stored before cost tracking was added
  for (const s of run.summary) {
    s.totalCostUsd ??= 0;
    s.avgCostPerRequest ??= 0;
    s.qualityPerDollar ??= null;
  }
  return run;
}

/**
 * List all stored runs with lightweight metadata, sorted newest-first.
 */
export async function listRuns(baseDir: string = DEFAULT_RESULTS_DIR): Promise<
  Array<{
    runId: string;
    timestamp: string;
    modelCount: number;
    testCaseCount: number;
  }>
> {
  const glob = new Bun.Glob("*.json");
  const entries: Array<{
    runId: string;
    timestamp: string;
    modelCount: number;
    testCaseCount: number;
  }> = [];

  try {
    for await (const path of glob.scan({ cwd: baseDir })) {
      try {
        const file = Bun.file(join(baseDir, path));
        const text = await file.text();
        const run = JSON.parse(text) as StoredRun;
        entries.push({
          runId: run.runId,
          timestamp: run.timestamp,
          modelCount: run.modelsDiscovered.length,
          testCaseCount: run.testCaseCount,
        });
      } catch {
        // Skip corrupted files
      }
    }
  } catch {
    // Directory doesn't exist yet -- return empty
    return [];
  }

  return entries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}
