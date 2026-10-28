import { join } from "node:path";
import { readFileSync } from "node:fs";
import type { StoredRun } from "../core/types.ts";
import { initDb, insertRun, runExists } from "./sqlite.ts";

const DEFAULT_RESULTS_DIR = join(process.cwd(), "results", "runs");

export interface MigrationResult {
  imported: number;
  skipped: number;
  errors: string[];
}

/**
 * Migrate all JSON runs from results/runs/*.json into SQLite.
 * Skips runs that already exist in the database.
 */
export function migrateJsonRuns(dbPath?: string): MigrationResult {
  const db = initDb(dbPath);
  const result: MigrationResult = {
    imported: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Scan for all JSON files in results/runs/
    const glob = new Bun.Glob("*.json");
    const files: string[] = [];

    for (const path of glob.scanSync({ cwd: DEFAULT_RESULTS_DIR })) {
      files.push(join(DEFAULT_RESULTS_DIR, path));
    }

    if (files.length === 0) {
      return result;
    }

    for (const filePath of files) {
      try {
        // Read and parse the JSON file
        const text = readFileSync(filePath, "utf-8");
        const run = JSON.parse(text) as StoredRun;

        // Skip if already exists
        if (runExists(db, run.runId)) {
          result.skipped++;
          continue;
        }

        // Insert into database
        insertRun(db, run);
        result.imported++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        result.errors.push(`${filePath}: ${errMsg}`);
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Migration failed: ${errMsg}`);
  } finally {
    db.close();
  }

  return result;
}
