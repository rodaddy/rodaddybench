#!/usr/bin/env bun

import { parseArgs } from "node:util";
import { handleRun, parseCliArgs } from "./cli/run.ts";
import { handleCompare } from "./cli/compare.ts";
import { handleHistory } from "./cli/history.ts";
import { handleTrends } from "./cli/trends.ts";
import { handleCacheCompare } from "./cli/cache-compare.ts";
import { handleMigrate } from "./cli/migrate.ts";

// Re-export for backward compatibility (used by integration tests)
export { parseCliArgs };

const USAGE = `
Usage: bench [command] [options]

Commands:
  run            Run benchmarks (default)
  compare        Compare two benchmark runs
  history        List past benchmark runs
  trends         Show model performance trends over time
  cache-compare  Compare cached vs nocache model variants
  migrate        Migrate JSON runs to SQLite database

Run: bench run [options]  (or just: bench [options])
  -c, --category <name>   Filter by category
  -m, --model <name>      Filter by model
  --sequential             Run sequentially
  -v, --verbose            Verbose output

Compare: bench compare <run1> <run2> [options]
  --threshold <value>      Regression threshold (default: 0.10)
  -m, --model <name>       Filter comparison to specific model
  -c, --category <name>    Filter comparison to specific category

History: bench history [options]
  -m, --model <name>       Filter by model (can specify multiple)
  -c, --category <name>    Filter by category (can specify multiple)
  --since <date>           Show runs on or after date (YYYY-MM-DD)
  --until <date>           Show runs on or before date (YYYY-MM-DD)
  -l, --limit <n>          Max runs to show (default: 20)

Trends: bench trends [options]
  -m, --model <name>       Filter to specific model(s)
  -c, --category <name>    Show category scores instead of overall
  -l, --limit <n>          Max runs to include (default: 20)
  --no-chart               Show only sparkline table, skip chart

Cache Compare: bench cache-compare [options]
  --run <id>               Run ID to analyze (default: latest)

Migrate: bench migrate
  Migrate all JSON runs from results/runs/*.json to SQLite database
`.trim();

const SUBCOMMANDS = new Set([
  "run",
  "compare",
  "history",
  "trends",
  "cache-compare",
  "migrate",
]);

export function routeSubcommand(argv: string[]): {
  command: string;
  args: string[];
} {
  const { tokens } = parseArgs({
    args: argv,
    options: { help: { type: "boolean", short: "h" } },
    tokens: true,
    allowPositionals: true,
    strict: false,
  });

  // Check for top-level --help before subcommand routing
  const helpToken = tokens.find(
    (t) => t.kind === "option" && t.name === "help",
  );
  if (helpToken) {
    console.log(USAGE);
    process.exit(0);
  }

  const firstPositional = tokens.find((t) => t.kind === "positional");

  if (!firstPositional) {
    // No positional args -- default to "run" with all original args
    return { command: "run", args: argv };
  }

  if (SUBCOMMANDS.has(firstPositional.value)) {
    // Known subcommand -- pass remaining args after it
    return {
      command: firstPositional.value,
      args: argv.slice(firstPositional.index + 1),
    };
  }

  // Unknown first positional -- default to "run" with all original args
  // This handles cases like `bench -c infrastructure` where -c value
  // is the first positional
  return { command: "run", args: argv };
}

async function main(): Promise<void> {
  const { command, args } = routeSubcommand(process.argv.slice(2));

  switch (command) {
    case "run":
      await handleRun(args);
      break;
    case "compare":
      await handleCompare(args);
      break;
    case "history":
      await handleHistory(args);
      break;
    case "trends":
      await handleTrends(args);
      break;
    case "cache-compare":
      await handleCacheCompare(args);
      break;
    case "migrate":
      await handleMigrate(args);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.log(USAGE);
      process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(
    "Fatal error:",
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
