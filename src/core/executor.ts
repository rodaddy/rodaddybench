import type { ExecutionOptions, BenchmarkResult, StoredRun } from "./types.ts";
import { loadAllTestCases, type LoadedTestCase } from "../storage/loader.ts";
import {
  createClient,
  discoverModels,
  fetchModelInfo,
} from "../litellm/client.ts";
import { scoreTestCase } from "./scorer.ts";
import { loadConfig } from "./config.ts";
import {
  initVendorMap,
  getVendorFamily,
  type VendorFamily,
} from "./vendor-map.ts";
import { displayResults, aggregateResults } from "../display/table.ts";
import {
  generateMarkdownReport,
  saveMarkdownReport,
} from "../display/report.ts";
import {
  generateRunId,
  getGitMetadata,
  saveRun,
  listRuns,
  loadRun,
} from "../storage/runs.ts";
import { compareRuns, detectRegressions } from "./regression.ts";
import { displayCompareTable } from "../display/compare-table.ts";
import chalk from "chalk";

/**
 * Run the full benchmark pipeline: load -> discover -> execute -> score -> display.
 * Returns all results (including error results for failed tasks).
 */
export async function runBenchmark(
  options: ExecutionOptions,
): Promise<BenchmarkResult[]> {
  const runStartMs = Date.now();

  // Phase 1: Load test cases
  const loadResult = await loadAllTestCases();

  let cases = loadResult.cases;
  if (options.categories && options.categories.length > 0) {
    const cats = new Set(options.categories);
    cases = cases.filter((c) => cats.has(c.testCase.category));
  }

  if (loadResult.errors.length > 0 && options.verbose) {
    for (const err of loadResult.errors) {
      console.error(`[warn] Failed to load ${err.file}: ${err.error}`);
    }
  }

  const categorySet = new Set(cases.map((c) => c.testCase.category));
  console.log(
    `Loaded ${cases.length} test cases (${categorySet.size} categories)`,
  );

  if (cases.length === 0) {
    console.log("No test cases found. Nothing to run.");
    return [];
  }

  // Phase 2: Discover models
  const client = createClient();
  let models = await discoverModels(client);

  // Phase 2.5: Exclude router aliases (configurable via benchmark.config.json)
  const config = await loadConfig();
  const excludeSet = new Set(config.excludeModels);
  const preFilterCount = models.length;
  models = models.filter((m) => !excludeSet.has(m));
  const excluded = preFilterCount - models.length;
  if (excluded > 0 && options.verbose) {
    console.log(`Excluded ${excluded} router alias(es)`);
  }

  // Keep full model list for judge selection (judges can be any available model)
  const allModels = [...models];

  if (options.models && options.models.length > 0) {
    const filter = new Set(options.models);
    models = models.filter((m) => filter.has(m));
  }

  console.log(
    `Discovered ${models.length} models (${allModels.length} available for judging)`,
  );

  if (models.length === 0) {
    console.log("No models matched. Nothing to run.");
    return [];
  }

  // Phase 2.7: Build vendor map for cross-vendor judge selection
  const aliasToModel = await fetchModelInfo(client);
  initVendorMap(aliasToModel);
  // Build explicit VendorFamily map for passing to scorer/selectJudgeModel
  const resolvedVendorMap = new Map<string, VendorFamily>();
  for (const [alias, actualModel] of aliasToModel) {
    const vendor = getVendorFamily(actualModel);
    if (vendor !== "unknown") {
      resolvedVendorMap.set(alias.toLowerCase(), vendor);
    }
  }

  // Phase 3: Execute - build cartesian product of models x test cases
  const tasks: Array<{ model: string; loaded: LoadedTestCase }> = [];
  for (const model of models) {
    for (const loaded of cases) {
      tasks.push({ model, loaded });
    }
  }

  let results: BenchmarkResult[];

  if (options.sequential) {
    results = [];
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]!;
      console.log(
        `[${i + 1}/${tasks.length}] Running ${task.loaded.testCase.id} against ${task.model}...`,
      );
      const result = await executeTask(client, task.model, task.loaded);
      results.push(result);
    }
  } else {
    const promises = tasks.map((task, i) => {
      console.log(
        `[${i + 1}/${tasks.length}] Running ${task.loaded.testCase.id} against ${task.model}...`,
      );
      return executeTask(client, task.model, task.loaded);
    });
    const settled = await Promise.allSettled(promises);
    results = settled.map((s, i) => {
      if (s.status === "fulfilled") {
        return s.value;
      }
      const task = tasks[i]!;
      return makeErrorResult(
        task.model,
        task.loaded,
        s.reason instanceof Error ? s.reason.message : String(s.reason),
      );
    });
  }

  // Phase 4: Score results (hybrid: deterministic + judge)
  for (const result of results) {
    if (!result.error) {
      const loaded = cases.find((c) => c.testCase.id === result.testCase);
      if (loaded) {
        try {
          const scored = await scoreTestCase(
            loaded.testCase,
            result.response,
            client,
            allModels,
            result.model,
            resolvedVendorMap,
          );
          result.score = scored.score;
          if (scored.judgeMetadata) {
            result.judgeMetadata = scored.judgeMetadata;
          }
        } catch (err) {
          if (options.verbose) {
            console.error(
              `[warn] Scoring failed for ${result.testCase}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
          // Keep score at 0 if scoring fails
        }
      }
    }
  }

  // Phase 5: Display
  displayResults(results, options.verbose);

  // Phase 5.5: Generate and save markdown report
  const markdown = generateMarkdownReport(results);
  saveMarkdownReport(markdown);

  // Phase 6: Persist run
  try {
    const runId = generateRunId();
    const git = await getGitMetadata();
    const summary = aggregateResults(results);

    const storedRun: StoredRun = {
      runId,
      timestamp: new Date().toISOString(),
      gitCommit: git.commit,
      gitBranch: git.branch,
      gitDirty: git.dirty,
      config: {
        categories: options.categories ?? null,
        models: options.models ?? null,
        sequential: options.sequential,
      },
      modelsDiscovered: models,
      testCaseCount: cases.length,
      results,
      summary,
      durationMs: Date.now() - runStartMs,
    };

    await saveRun(storedRun);
    console.log(`Run saved: ${runId}`);
  } catch (err) {
    // Storage failure must not crash the pipeline
    if (options.verbose) {
      console.error(
        `[warn] Failed to save run: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Phase 7: Auto-regression check against previous run
  try {
    const allRuns = await listRuns();
    if (allRuns.length < 2) {
      console.log(chalk.dim("First run recorded -- baseline established"));
    } else {
      const previousRunId = allRuns[1]!.runId;
      const currentRunId = allRuns[0]!.runId;

      const previousRun = await loadRun(previousRunId);
      const currentRun = await loadRun(currentRunId);

      if (previousRun && currentRun) {
        const compareResult = compareRuns(previousRun, currentRun);
        const regressions = detectRegressions(compareResult, 0.1);

        if (regressions.length > 0) {
          displayCompareTable(compareResult, 0.1);
          console.log(
            chalk.red.bold(
              `\u26A0 ${regressions.length} regression(s) detected vs previous run`,
            ),
          );
          for (const r of regressions) {
            console.log(
              chalk.red(
                `  ${r.model}: ${r.category} dropped ${Math.abs(r.delta * 100).toFixed(0)}pp`,
              ),
            );
          }
        } else {
          console.log(chalk.green("No regressions vs previous run"));
        }
      }
    }
  } catch (err) {
    // Regression check failure must not break the benchmark run
    console.log(
      chalk.yellow(
        `[warn] Regression check failed: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
  }

  return results;
}

async function executeTask(
  client: ReturnType<typeof createClient>,
  model: string,
  loaded: LoadedTestCase,
): Promise<BenchmarkResult> {
  const tc = loaded.testCase;

  try {
    const start = Date.now();
    const { data: response, response: httpResponse } =
      await client.chat.completions
        .create({
          model,
          messages: [{ role: "user" as const, content: tc.prompt }],
          stream: false,
          ...({ cache: { "no-cache": true } } as Record<string, unknown>),
        })
        .withResponse();
    const latencyMs = Date.now() - start;

    const content = response.choices[0]?.message?.content ?? "";
    const usage = response.usage;

    // Extract cost from LiteLLM response header
    const costHeader = httpResponse.headers.get("x-litellm-response-cost");
    const costUsd = costHeader ? parseFloat(costHeader) : 0;

    // Extract cached prompt tokens if available (provider-dependent)
    const cachedTokens = (usage as unknown as Record<string, unknown>)
      ?.prompt_tokens_details as { cached_tokens?: number } | undefined;
    const cachedPrompt = cachedTokens?.cached_tokens;

    return {
      model,
      testCase: tc.id,
      category: tc.category,
      response: content,
      score: 0, // scored in Phase 4
      latencyMs,
      tokens: {
        prompt: usage?.prompt_tokens ?? 0,
        completion: usage?.completion_tokens ?? 0,
        total: usage?.total_tokens ?? 0,
        ...(cachedPrompt !== undefined && cachedPrompt > 0
          ? { cachedPrompt }
          : {}),
      },
      costUsd: Number.isFinite(costUsd) ? costUsd : 0,
    };
  } catch (err) {
    return makeErrorResult(
      model,
      loaded,
      err instanceof Error ? err.message : String(err),
    );
  }
}

function makeErrorResult(
  model: string,
  loaded: LoadedTestCase,
  errorMessage: string,
): BenchmarkResult {
  return {
    model,
    testCase: loaded.testCase.id,
    category: loaded.testCase.category,
    response: "",
    score: 0,
    latencyMs: 0,
    tokens: { prompt: 0, completion: 0, total: 0 },
    costUsd: 0,
    error: errorMessage,
  };
}
