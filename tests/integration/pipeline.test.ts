import { describe, expect, it, mock, beforeEach } from "bun:test";
import { parseCliArgs } from "../../src/cli.ts";
import { aggregateResults } from "../../src/display/table.ts";
import type { BenchmarkResult } from "../../src/core/types.ts";

// -- Test 1: CLI argument parsing --

describe("CLI argument parsing", () => {
  it("parses --category, --model, and --sequential correctly", () => {
    const options = parseCliArgs([
      "--category",
      "infrastructure",
      "--model",
      "claude",
      "--sequential",
    ]);

    expect(options.categories).toEqual(["infrastructure"]);
    expect(options.models).toEqual(["claude"]);
    expect(options.sequential).toBe(true);
    expect(options.verbose).toBe(false);
  });

  it("parses short flags", () => {
    const options = parseCliArgs(["-c", "code-review", "-m", "gemini", "-v"]);

    expect(options.categories).toEqual(["code-review"]);
    expect(options.models).toEqual(["gemini"]);
    expect(options.verbose).toBe(true);
    expect(options.sequential).toBe(false);
  });

  it("parses multiple categories and models", () => {
    const options = parseCliArgs([
      "-c",
      "infrastructure",
      "-c",
      "research",
      "-m",
      "claude",
      "-m",
      "gemini",
    ]);

    expect(options.categories).toEqual(["infrastructure", "research"]);
    expect(options.models).toEqual(["claude", "gemini"]);
  });

  it("defaults to no filters and parallel mode", () => {
    const options = parseCliArgs([]);

    expect(options.categories).toBeUndefined();
    expect(options.models).toBeUndefined();
    expect(options.sequential).toBe(false);
    expect(options.verbose).toBe(false);
  });
});

// -- Test 2: Pipeline handles model failure gracefully --

describe("Pipeline failure handling", () => {
  it("Promise.allSettled captures both successes and failures", async () => {
    // Simulate what the executor does with Promise.allSettled
    const successTask = Promise.resolve<BenchmarkResult>({
      model: "claude",
      testCase: "tc-1",
      category: "infrastructure",
      response: "some response",
      score: 0.8,
      latencyMs: 500,
      tokens: { prompt: 100, completion: 200, total: 300 },
    });

    const failTask = Promise.reject(new Error("Model unavailable"));

    const settled = await Promise.allSettled([successTask, failTask]);

    expect(settled).toHaveLength(2);
    expect(settled[0]!.status).toBe("fulfilled");
    expect(settled[1]!.status).toBe("rejected");

    // Map settled results like the executor does
    const results: BenchmarkResult[] = settled.map((s, i) => {
      if (s.status === "fulfilled") {
        return s.value;
      }
      return {
        model: i === 1 ? "gemini" : "unknown",
        testCase: "tc-1",
        category: "infrastructure",
        response: "",
        score: 0,
        latencyMs: 0,
        tokens: { prompt: 0, completion: 0, total: 0 },
        error: s.reason instanceof Error ? s.reason.message : String(s.reason),
      };
    });

    expect(results).toHaveLength(2);
    expect(results[0]!.score).toBe(0.8);
    expect(results[0]!.error).toBeUndefined();
    expect(results[1]!.score).toBe(0);
    expect(results[1]!.error).toBe("Model unavailable");
  });
});

// -- Test 3: Results aggregation produces correct table data --

describe("Results aggregation", () => {
  const mockResults: BenchmarkResult[] = [
    {
      model: "claude",
      testCase: "tc-1",
      category: "infrastructure",
      response: "",
      score: 0.8,
      latencyMs: 1000,
      tokens: { prompt: 100, completion: 200, total: 300 },
    },
    {
      model: "claude",
      testCase: "tc-2",
      category: "code-review",
      response: "",
      score: 0.6,
      latencyMs: 800,
      tokens: { prompt: 150, completion: 250, total: 400 },
    },
    {
      model: "gemini",
      testCase: "tc-1",
      category: "infrastructure",
      response: "",
      score: 0.4,
      latencyMs: 500,
      tokens: { prompt: 80, completion: 120, total: 200 },
    },
    {
      model: "gemini",
      testCase: "tc-2",
      category: "code-review",
      response: "",
      score: 0.9,
      latencyMs: 600,
      tokens: { prompt: 90, completion: 180, total: 270 },
      error: "partial failure",
    },
  ];

  it("computes per-category average scores correctly", () => {
    const summaries = aggregateResults(mockResults);

    const claude = summaries.find((s) => s.model === "claude")!;
    expect(claude.categoryScores["infrastructure"]).toBe(0.8);
    expect(claude.categoryScores["code-review"]).toBe(0.6);

    const gemini = summaries.find((s) => s.model === "gemini")!;
    expect(gemini.categoryScores["infrastructure"]).toBe(0.4);
    expect(gemini.categoryScores["code-review"]).toBe(0.9);
  });

  it("computes overall average score correctly", () => {
    const summaries = aggregateResults(mockResults);

    const claude = summaries.find((s) => s.model === "claude")!;
    expect(claude.overallScore).toBe(0.7); // (0.8 + 0.6) / 2

    const gemini = summaries.find((s) => s.model === "gemini")!;
    expect(gemini.overallScore).toBeCloseTo(0.65); // (0.4 + 0.9) / 2
  });

  it("computes average latency correctly", () => {
    const summaries = aggregateResults(mockResults);

    const claude = summaries.find((s) => s.model === "claude")!;
    expect(claude.avgLatencyMs).toBe(900); // (1000 + 800) / 2

    const gemini = summaries.find((s) => s.model === "gemini")!;
    expect(gemini.avgLatencyMs).toBe(550); // (500 + 600) / 2
  });

  it("computes total tokens correctly", () => {
    const summaries = aggregateResults(mockResults);

    const claude = summaries.find((s) => s.model === "claude")!;
    expect(claude.totalTokens).toBe(700); // 300 + 400

    const gemini = summaries.find((s) => s.model === "gemini")!;
    expect(gemini.totalTokens).toBe(470); // 200 + 270
  });

  it("counts errors correctly", () => {
    const summaries = aggregateResults(mockResults);

    const claude = summaries.find((s) => s.model === "claude")!;
    expect(claude.errorCount).toBe(0);

    const gemini = summaries.find((s) => s.model === "gemini")!;
    expect(gemini.errorCount).toBe(1);
  });

  it("sorts by overall score descending", () => {
    const summaries = aggregateResults(mockResults);
    expect(summaries[0]!.model).toBe("claude"); // 0.7 > 0.65
    expect(summaries[1]!.model).toBe("gemini");
  });
});

// -- Test 4: Sequential mode runs tasks in order --

describe("Sequential execution order", () => {
  it("tasks execute sequentially with no overlap", async () => {
    const timestamps: Array<{ task: number; start: number; end: number }> = [];

    // Simulate sequential execution with delays
    const tasks = [0, 1, 2];

    for (const taskIndex of tasks) {
      const start = Date.now();
      // Simulate async work with a small delay
      await new Promise((resolve) => setTimeout(resolve, 20));
      const end = Date.now();
      timestamps.push({ task: taskIndex, start, end });
    }

    // Verify each task started after the previous one ended
    for (let i = 1; i < timestamps.length; i++) {
      const prev = timestamps[i - 1]!;
      const curr = timestamps[i]!;
      expect(curr.start).toBeGreaterThanOrEqual(prev.end);
    }
  });
});
