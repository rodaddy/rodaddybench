import { parseArgs } from "node:util";
import { runBenchmark } from "../core/executor.ts";
import type { ExecutionOptions } from "../core/types.ts";

const RUN_USAGE = `
Usage: bench run [options]  (or just: bench [options])

Options:
  -c, --category <name>   Filter by category (can specify multiple)
  -m, --model <name>      Filter by model (can specify multiple)
  --sequential             Run tasks sequentially instead of in parallel
  -v, --verbose            Show detailed output including errors
  -h, --help               Show this help message

Report is saved to .reports/benchmark.md after each run (overwritten).

Examples:
  bench                              Run all benchmarks
  bench -c infrastructure            Run only infrastructure category
  bench -m claude -m gemini          Run only specific models
  bench --sequential -v              Run sequentially with verbose output
`.trim();

export function parseCliArgs(argv: string[]): ExecutionOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      category: { type: "string", short: "c", multiple: true },
      model: { type: "string", short: "m", multiple: true },
      sequential: { type: "boolean", default: false },
      verbose: { type: "boolean", short: "v", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(RUN_USAGE);
    process.exit(0);
  }

  return {
    categories: values.category ?? undefined,
    models: values.model ?? undefined,
    sequential: values.sequential ?? false,
    verbose: values.verbose ?? false,
  };
}

export async function handleRun(argv: string[]): Promise<void> {
  const options = parseCliArgs(argv);
  await runBenchmark(options);
}
