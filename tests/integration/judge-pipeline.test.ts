import { describe, expect, it, afterEach } from "bun:test";
import { existsSync, rmSync, readFileSync } from "node:fs";
import {
  generateMarkdownReport,
  saveMarkdownReport,
} from "../../src/display/report.ts";
import { scoreTestCase, scoreDeterministic } from "../../src/core/scorer.ts";
import {
  selectJudgeModel,
  getVendorFamily,
} from "../../src/core/vendor-map.ts";
import type { BenchmarkResult } from "../../src/core/types.ts";

// -- Test 1: Hybrid scoring routes correctly --

describe("Hybrid scoring (deterministic + judge)", () => {
  it("deterministic test case uses scoreDeterministic path", () => {
    const testCase = {
      id: "test-exact",
      category: "infrastructure",
      prompt: "What command lists VMs?",
      scoringMethod: "exact-match",
      goldenAnswer: "qm list",
      normalize: { trim: true, lowercase: true, collapseWhitespace: true },
    };

    const score = scoreDeterministic(testCase as any, "qm list");
    expect(score).toBe(1.0);
  });

  it("deterministic scorer rejects judge method", () => {
    const testCase = {
      id: "test-judge",
      category: "code-review",
      prompt: "Review this code",
      scoringMethod: "judge",
      rubric: {
        criteria: [
          { name: "quality", weight: 1.0, description: "Code quality" },
        ],
      },
    };

    expect(() => scoreDeterministic(testCase as any, "looks good")).toThrow(
      "Use scoreTestCase() for judge scoring",
    );
  });

  it("scoreTestCase returns score 0 for null response", async () => {
    const testCase = {
      id: "test-null",
      category: "infrastructure",
      prompt: "Test",
      scoringMethod: "exact-match",
      goldenAnswer: "answer",
      normalize: { trim: true, lowercase: false, collapseWhitespace: false },
    };

    const result = await scoreTestCase(
      testCase as any,
      null as any,
      {} as any,
      [],
      "test-model",
    );
    expect(result.score).toBe(0.0);
    expect(result.judgeMetadata).toBeUndefined();
  });
});

// -- Test 2: Cross-vendor judge selection --

describe("Cross-vendor judge selection", () => {
  const models = [
    "claude-opus-4",
    "claude-sonnet-4",
    "gemini-2.0-flash",
    "gemini-3-pro",
    "gemini-3.1-pro-nocache",
  ];

  it("selects non-Anthropic judge for Claude model", () => {
    const judge = selectJudgeModel("claude-opus-4", models);
    const judgeVendor = getVendorFamily(judge);
    expect(judgeVendor).not.toBe("anthropic");
  });

  it("selects non-Google judge for Gemini model", () => {
    const judge = selectJudgeModel("gemini-2.0-flash", models);
    const judgeVendor = getVendorFamily(judge);
    expect(judgeVendor).not.toBe("google");
  });

  it("prefers higher-quality judge models", () => {
    // For a Claude model, should prefer a Gemini model (cross-vendor)
    const judge = selectJudgeModel("claude-opus-4", models);
    const judgeVendor = getVendorFamily(judge);
    expect(judgeVendor).toBe("google");
    // Should prefer pro over flash
    expect(judge).toContain("pro");
  });

  it("throws when no cross-vendor judge available", () => {
    const claudeOnly = ["claude-opus-4", "claude-sonnet-4"];
    expect(() => selectJudgeModel("claude-opus-4", claudeOnly)).toThrow(
      "No cross-vendor judge available",
    );
  });
});

// -- Test 3: Markdown report generation --

describe("Markdown report generation", () => {
  const sampleResults: BenchmarkResult[] = [
    {
      model: "claude-opus-4",
      testCase: "cr-missing-error-handling",
      category: "code-review",
      response: "Found missing try/catch",
      score: 0.85,
      latencyMs: 2100,
      tokens: { prompt: 800, completion: 400, total: 1200 },
      judgeMetadata: {
        judgeModel: "gemini-2.0-pro",
        criteriaScores: { bug_detection: 0.9, actionability: 0.8 },
        judgeReasoning: "Good detection",
        judgeConfidence: 0.9,
        judgeTokens: { prompt: 500, completion: 200, total: 700 },
        judgeLatencyMs: 1500,
      },
    },
    {
      model: "claude-opus-4",
      testCase: "infra-proxmox",
      category: "infrastructure",
      response: "qm list",
      score: 1.0,
      latencyMs: 800,
      tokens: { prompt: 200, completion: 50, total: 250 },
    },
    {
      model: "gemini-2.0-flash",
      testCase: "cr-missing-error-handling",
      category: "code-review",
      response: "No issues found",
      score: 0.3,
      latencyMs: 400,
      tokens: { prompt: 600, completion: 200, total: 800 },
    },
    {
      model: "gemini-2.0-flash",
      testCase: "infra-proxmox",
      category: "infrastructure",
      response: "pvesh get /nodes",
      score: 0.0,
      latencyMs: 350,
      tokens: { prompt: 180, completion: 40, total: 220 },
      error: "Wrong command",
    },
  ];

  it("contains all 4 required sections", () => {
    const md = generateMarkdownReport(sampleResults);

    expect(md).toContain("## Summary");
    expect(md).toContain("## Scores by Category");
    expect(md).toContain("## Performance Metrics");
    expect(md).toContain("## Scoring Rubrics");
  });

  it("includes rubric criteria names and weights", () => {
    const md = generateMarkdownReport(sampleResults);

    // code-review rubric should be present
    expect(md).toContain("bug_detection");
    expect(md).toContain("35%");
    expect(md).toContain("actionability");
    expect(md).toContain("30%");
    expect(md).toContain("false_positive_rate");
    expect(md).toContain("severity_triage");
  });

  it("ranks models by overall score", () => {
    const md = generateMarkdownReport(sampleResults);

    // claude-opus-4: (0.85 + 1.0) / 2 = 0.925 -> 93%
    // gemini-2.0-flash: (0.3 + 0.0) / 2 = 0.15 -> 15%
    expect(md).toContain("| 1 | claude-opus-4");
    expect(md).toContain("| 2 | gemini-2.0-flash");
  });

  it("shows performance metrics per model", () => {
    const md = generateMarkdownReport(sampleResults);

    // claude avg latency = (2100 + 800) / 2 = 1450ms
    expect(md).toContain("1450ms");
    // gemini avg latency = (400 + 350) / 2 = 375ms
    expect(md).toContain("375ms");
  });

  it("marks categories without rubrics as deterministic", () => {
    const md = generateMarkdownReport(sampleResults);

    // infrastructure has no rubric in RUBRICS constant
    expect(md).toContain("### infrastructure");
    expect(md).toContain("deterministic scoring");
  });
});

describe("Report file persistence", () => {
  afterEach(() => {
    if (existsSync(".reports/benchmark.md")) {
      rmSync(".reports", { recursive: true });
    }
  });

  it("saveMarkdownReport creates .reports/benchmark.md with content", () => {
    const md = "# Test\n\n## Summary\n\nTest content";
    saveMarkdownReport(md);

    expect(existsSync(".reports/benchmark.md")).toBe(true);
    const content = readFileSync(".reports/benchmark.md", "utf-8");
    expect(content).toBe(md);
  });

  it("overwrites existing report (no date suffixes)", () => {
    saveMarkdownReport("first run");
    saveMarkdownReport("second run");

    const content = readFileSync(".reports/benchmark.md", "utf-8");
    expect(content).toBe("second run");
  });
});
