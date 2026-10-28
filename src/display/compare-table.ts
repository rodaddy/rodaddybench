import chalk from "chalk";
import Table from "cli-table3";
import type { CompareResult } from "../core/regression.ts";

/**
 * Format a delta value as a colored string with pp suffix.
 */
function formatDelta(
  delta: number,
  threshold: number,
  status: "compared" | "new" | "removed",
): string {
  if (status === "new") return chalk.cyan("NEW");
  if (status === "removed") return chalk.dim("REM");

  const pp = Math.round(delta * 100);

  if (pp === 0) return chalk.dim("0pp");
  if (delta > 0) return chalk.green(`+${pp}pp`);
  if (Math.abs(delta) > threshold) return chalk.red(`${pp}pp !!`);
  return chalk.yellow(`${pp}pp`);
}

/**
 * Render a color-coded comparison table showing per-model, per-category deltas.
 */
export function displayCompareTable(
  result: CompareResult,
  threshold: number,
): void {
  // Collect all categories across all model deltas
  const allCategories = new Set<string>();
  for (const md of result.modelDeltas) {
    for (const cat of Object.keys(md.categoryDeltas)) {
      allCategories.add(cat);
    }
  }
  const categories = [...allCategories].sort();

  // Header
  console.log("");
  console.log(chalk.bold(`Comparing: ${result.runA.id} -> ${result.runB.id}`));

  // Build table
  const table = new Table({
    head: [
      chalk.bold("Model"),
      ...categories.map((c) => chalk.bold(c)),
      chalk.bold("Overall"),
    ],
    style: { head: [], border: [] },
  });

  for (const md of result.modelDeltas) {
    const row: string[] = [
      md.model,
      ...categories.map((cat) => {
        const delta = md.categoryDeltas[cat];
        if (delta === undefined) return chalk.dim("-");
        return formatDelta(delta, threshold, md.status);
      }),
      formatDelta(md.overallDelta, threshold, md.status),
    ];
    table.push(row);
  }

  console.log(table.toString());

  // Footer: regression count
  const regressionCount = result.modelDeltas.reduce((count, md) => {
    if (md.status !== "compared") return count;
    let modelRegs = 0;
    for (const delta of Object.values(md.categoryDeltas)) {
      if (delta < -threshold) modelRegs++;
    }
    if (md.overallDelta < -threshold) modelRegs++;
    return count + modelRegs;
  }, 0);

  console.log("");
  if (regressionCount > 0) {
    console.log(
      chalk.red(
        `${regressionCount} regression(s) detected (>${Math.round(threshold * 100)}pp drop)`,
      ),
    );
  } else {
    console.log(chalk.green("No regressions detected"));
  }
}
