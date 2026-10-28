import { migrateJsonRuns } from "../storage/migrate.ts";

export async function handleMigrate(_args: string[]): Promise<void> {
  console.log("Starting migration from JSON to SQLite...\n");

  const result = migrateJsonRuns();

  console.log("Migration complete:");
  console.log(`  Imported: ${result.imported}`);
  console.log(`  Skipped:  ${result.skipped}`);

  if (result.errors.length > 0) {
    console.log(`  Errors:   ${result.errors.length}`);
    console.log("\nError details:");
    for (const err of result.errors) {
      console.log(`  - ${err}`);
    }
  }

  if (
    result.imported === 0 &&
    result.skipped === 0 &&
    result.errors.length === 0
  ) {
    console.log("\nNo runs found to migrate.");
  }
}
