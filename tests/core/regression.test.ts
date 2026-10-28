import { describe, test, expect } from "bun:test";
import {
  compareRuns,
  detectRegressions,
  resolveRunRef,
} from "../../src/core/regression.ts";
import type { StoredRun, BenchmarkResult } from "../../src/core/types.ts";

function makeResult(
  model: string,
  testCase: string,
  category: string,
  score: number,
): BenchmarkResult {
  return {
    model,
    testCase,
    category,
    response: "test response",
    score,
    latencyMs: 100,
    tokens: { prompt: 10, completion: 20, total: 30 },
  };
}

function makeRun(
  runId: string,
  results: BenchmarkResult[],
  timestamp?: string,
): StoredRun {
  return {
    runId,
    timestamp: timestamp ?? "2026-01-01T00:00:00Z",
    gitCommit: "abc1234",
    gitBranch: "main",
    gitDirty: false,
    config: { categories: null, models: null, sequential: false },
    modelsDiscovered: [...new Set(results.map((r) => r.model))],
    testCaseCount: [...new Set(results.map((r) => r.testCase))].length,
    results,
    summary: [],
    durationMs: 1000,
  };
}

describe("compareRuns", () => {
  test("identical runs return all-zero deltas", () => {
    const results = [
      makeResult("model-a", "tc1", "infra", 0.8),
      makeResult("model-a", "tc2", "code-review", 0.6),
    ];
    const runA = makeRun("20260101-000000-aaaa", results);
    const runB = makeRun("20260102-000000-bbbb", results);

    const compare = compareRuns(runA, runB);

    expect(compare.modelDeltas).toHaveLength(1);
    expect(compare.modelDeltas[0]!.overallDelta).toBe(0);
    expect(compare.modelDeltas[0]!.categoryDeltas["infra"]).toBe(0);
    expect(compare.modelDeltas[0]!.categoryDeltas["code-review"]).toBe(0);
  });

  test("different scores return correct positive/negative deltas", () => {
    const runA = makeRun("20260101-000000-aaaa", [
      makeResult("model-a", "tc1", "infra", 0.8),
      makeResult("model-a", "tc2", "code-review", 0.6),
    ]);
    const runB = makeRun("20260102-000000-bbbb", [
      makeResult("model-a", "tc1", "infra", 0.9), // +0.1
      makeResult("model-a", "tc2", "code-review", 0.4), // -0.2
    ]);

    const compare = compareRuns(runA, runB);

    expect(compare.modelDeltas).toHaveLength(1);
    const md = compare.modelDeltas[0]!;
    expect(md.categoryDeltas["infra"]).toBeCloseTo(0.1);
    expect(md.categoryDeltas["code-review"]).toBeCloseTo(-0.2);
    // Overall: (0.9 + 0.4) / 2 - (0.8 + 0.6) / 2 = 0.65 - 0.7 = -0.05
    expect(md.overallDelta).toBeCloseTo(-0.05);
  });

  test("marks NEW model when only in runB", () => {
    const runA = makeRun("20260101-000000-aaaa", [
      makeResult("model-a", "tc1", "infra", 0.8),
    ]);
    const runB = makeRun("20260102-000000-bbbb", [
      makeResult("model-a", "tc1", "infra", 0.8),
      makeResult("model-b", "tc1", "infra", 0.7),
    ]);

    const compare = compareRuns(runA, runB);

    const newModel = compare.modelDeltas.find((m) => m.model === "model-b");
    expect(newModel).toBeDefined();
    expect(newModel!.status).toBe("new");
  });

  test("marks REMOVED model when only in runA", () => {
    const runA = makeRun("20260101-000000-aaaa", [
      makeResult("model-a", "tc1", "infra", 0.8),
      makeResult("model-b", "tc1", "infra", 0.7),
    ]);
    const runB = makeRun("20260102-000000-bbbb", [
      makeResult("model-a", "tc1", "infra", 0.8),
    ]);

    const compare = compareRuns(runA, runB);

    const removed = compare.modelDeltas.find((m) => m.model === "model-b");
    expect(removed).toBeDefined();
    expect(removed!.status).toBe("removed");
  });

  test("excludes test cases only present in one run", () => {
    const runA = makeRun("20260101-000000-aaaa", [
      makeResult("model-a", "tc1", "infra", 0.8),
      makeResult("model-a", "tc-only-a", "infra", 0.9),
    ]);
    const runB = makeRun("20260102-000000-bbbb", [
      makeResult("model-a", "tc1", "infra", 0.7),
      makeResult("model-a", "tc-only-b", "infra", 0.5),
    ]);

    const compare = compareRuns(runA, runB);

    expect(compare.excludedTestCases).toContain("tc-only-a");
    expect(compare.excludedTestCases).toContain("tc-only-b");
    // Only tc1 compared, so delta should be based on tc1 only
    const md = compare.modelDeltas[0]!;
    expect(md.categoryDeltas["infra"]).toBeCloseTo(-0.1);
  });
});

describe("detectRegressions", () => {
  test("returns empty array when all deltas within threshold", () => {
    const runA = makeRun("20260101-000000-aaaa", [
      makeResult("model-a", "tc1", "infra", 0.8),
    ]);
    const runB = makeRun("20260102-000000-bbbb", [
      makeResult("model-a", "tc1", "infra", 0.75), // -0.05, within 0.10
    ]);

    const compare = compareRuns(runA, runB);
    const regressions = detectRegressions(compare, 0.1);

    expect(regressions).toHaveLength(0);
  });

  test("returns regression when delta exceeds threshold", () => {
    const runA = makeRun("20260101-000000-aaaa", [
      makeResult("model-a", "tc1", "infra", 0.8),
    ]);
    const runB = makeRun("20260102-000000-bbbb", [
      makeResult("model-a", "tc1", "infra", 0.5), // -0.30, exceeds 0.10
    ]);

    const compare = compareRuns(runA, runB);
    const regressions = detectRegressions(compare, 0.1);

    expect(regressions.length).toBeGreaterThan(0);
    const reg = regressions.find((r) => r.category === "infra");
    expect(reg).toBeDefined();
    expect(reg!.delta).toBeCloseTo(-0.3);
  });

  test("uses custom threshold when provided", () => {
    const runA = makeRun("20260101-000000-aaaa", [
      makeResult("model-a", "tc1", "infra", 0.8),
    ]);
    const runB = makeRun("20260102-000000-bbbb", [
      makeResult("model-a", "tc1", "infra", 0.75), // -0.05
    ]);

    const compare = compareRuns(runA, runB);

    // With default threshold (0.10), no regression
    expect(detectRegressions(compare, 0.1)).toHaveLength(0);

    // With strict threshold (0.03), regression detected
    const strict = detectRegressions(compare, 0.03);
    expect(strict.length).toBeGreaterThan(0);
  });
});

describe("resolveRunRef", () => {
  const runs = [
    { runId: "20260224-120000-aaaa" },
    { runId: "20260223-120000-bbbb" },
    { runId: "20260222-120000-cccc" },
  ];

  test("matches full ID", () => {
    const result = resolveRunRef("20260223-120000-bbbb", runs);
    expect(result).toBe("20260223-120000-bbbb");
  });

  test("matches suffix prefix", () => {
    const result = resolveRunRef("bbbb", runs);
    expect(result).toBe("20260223-120000-bbbb");
  });

  test("resolves 'latest' alias", () => {
    const result = resolveRunRef("latest", runs);
    expect(result).toBe("20260224-120000-aaaa");
  });

  test("resolves 'previous' alias", () => {
    const result = resolveRunRef("previous", runs);
    expect(result).toBe("20260223-120000-bbbb");
  });

  test("throws on ambiguous prefix", () => {
    // "120000" matches all three runs
    expect(() => resolveRunRef("120000", runs)).toThrow("Ambiguous");
  });
});
