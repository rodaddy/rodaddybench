import { parseArgs } from "node:util";
import { listRuns, loadRun } from "../storage/runs.ts";
import {
  compareRuns,
  detectRegressions,
  resolveRunRef,
} from "../core/regression.ts";
import { displayCompareTable } from "../display/compare-table.ts";

export interface CompareOptions {
  ref1: string;
  ref2: string;
  threshold: number;
  models?: string[];
  categories?: string[];
}

export function parseCompareArgs(argv: string[]): CompareOptions {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      threshold: { type: "string", default: "0.10" },
      model: { type: "string", short: "m", multiple: true },
      category: { type: "string", short: "c", multiple: true },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(COMPARE_USAGE);
    process.exit(0);
  }

  if (positionals.length < 2) {
    throw new Error(
      "Compare requires two run references: bench compare <run1> <run2>",
    );
  }

  const threshold = parseFloat(values.threshold ?? "0.10");
  if (isNaN(threshold) || threshold < 0 || threshold > 1) {
    throw new Error("Threshold must be a number between 0 and 1");
  }

  return {
    ref1: positionals[0]!,
    ref2: positionals[1]!,
    threshold,
    models: values.model ?? undefined,
    categories: values.category ?? undefined,
  };
}

const COMPARE_USAGE = `
Usage: bench compare <run1> <run2> [options]

Arguments:
  run1, run2    Run references (full ID, prefix, "latest", "previous")

Options:
  --threshold <value>      Regression threshold (default: 0.10 = 10pp)
  -m, --model <name>       Filter comparison to specific model(s)
  -c, --category <name>    Filter comparison to specific category(ies)
  -h, --help               Show this help message

Examples:
  bench compare latest previous
  bench compare 20260223-143052-a7f3 20260224-091500-b2c1
  bench compare latest previous --threshold 0.05
  bench compare latest previous -m claude-sonnet
`.trim();

export async function handleCompare(argv: string[]): Promise<void> {
  const opts = parseCompareArgs(argv);

  // Load available runs
  const runs = await listRuns();
  if (runs.length === 0) {
    console.log("No benchmark runs found. Run benchmarks first with: bench");
    return;
  }

  // Resolve references
  const runIdA = resolveRunRef(opts.ref1, runs);
  const runIdB = resolveRunRef(opts.ref2, runs);

  // Load full run data
  const runA = await loadRun(runIdA);
  const runB = await loadRun(runIdB);

  if (!runA) {
    throw new Error(`Failed to load run: ${runIdA}`);
  }
  if (!runB) {
    throw new Error(`Failed to load run: ${runIdB}`);
  }

  // Apply model/category filters by filtering results before comparison
  if (opts.models && opts.models.length > 0) {
    const modelFilter = new Set(opts.models);
    runA.results = runA.results.filter((r) => modelFilter.has(r.model));
    runB.results = runB.results.filter((r) => modelFilter.has(r.model));
  }

  if (opts.categories && opts.categories.length > 0) {
    const catFilter = new Set(opts.categories);
    runA.results = runA.results.filter((r) => catFilter.has(r.category));
    runB.results = runB.results.filter((r) => catFilter.has(r.category));
  }

  // Compare and display
  const result = compareRuns(runA, runB);
  displayCompareTable(result, opts.threshold);

  // Check for regressions
  const regressions = detectRegressions(result, opts.threshold);
  if (regressions.length > 0) {
    process.exit(1);
  }
}
