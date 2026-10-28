import { describe, expect, it, afterEach } from "bun:test";
import { generateMarkdownReport, saveMarkdownReport } from "./report.ts";
import type { BenchmarkResult } from "../core/types.ts";
import { existsSync, rmSync, readFileSync } from "node:fs";

const mockResults: BenchmarkResult[] = [
  {
    model: "claude-opus-4",
    testCase: "cr-1",
    category: "code-review",
    response: "Found a bug",
    score: 0.85,
    latencyMs: 1200,
    tokens: { prompt: 500, completion: 300, total: 800 },
  },
  {
    model: "claude-opus-4",
    testCase: "cg-1",
    category: "content-generation",
    response: "LinkedIn post",
    score: 0.7,
    latencyMs: 900,
    tokens: { prompt: 400, completion: 200, total: 600 },
  },
  {
    model: "gemini-2.0-flash",
    testCase: "cr-1",
    category: "code-review",
    response: "No issues",
    score: 0.6,
    latencyMs: 400,
    tokens: { prompt: 300, completion: 150, total: 450 },
  },
  {
    model: "gemini-2.0-flash",
    testCase: "cg-1",
    category: "content-generation",
    response: "Post content",
    score: 0.9,
    latencyMs: 350,
    tokens: { prompt: 250, completion: 180, total: 430 },
  },
];

describe("generateMarkdownReport", () => {
  it("includes all 4 required sections", () => {
    const md = generateMarkdownReport(mockResults);

    expect(md).toContain("## Summary");
    expect(md).toContain("## Scores by Category");
    expect(md).toContain("## Performance Metrics");
    expect(md).toContain("## Scoring Rubrics");
  });

  it("shows top performers in summary", () => {
    const md = generateMarkdownReport(mockResults);

    expect(md).toContain("claude-opus-4");
    expect(md).toContain("gemini-2.0-flash");
    expect(md).toContain("Top Performers");
  });

  it("displays scores as percentages", () => {
    const md = generateMarkdownReport(mockResults);

    // claude-opus-4 overall = (0.85 + 0.7) / 2 = 0.775 -> 77% (Math.round)
    expect(md).toContain("77%");
  });

  it("includes rubric criteria names and weights", () => {
    const md = generateMarkdownReport(mockResults);

    // code-review rubric criteria
    expect(md).toContain("bug_detection");
    expect(md).toContain("40%");
    expect(md).toContain("actionability");
    expect(md).toContain("30%");

    // content-generation rubric criteria
    expect(md).toContain("tone_match");
    expect(md).toContain("engagement");
  });

  it("includes performance metrics per model", () => {
    const md = generateMarkdownReport(mockResults);

    // claude avg latency = (1200 + 900) / 2 = 1050ms
    expect(md).toContain("1050ms");
    // gemini avg latency = (400 + 350) / 2 = 375ms
    expect(md).toContain("375ms");
  });

  it("handles empty results", () => {
    const md = generateMarkdownReport([]);

    expect(md).toContain("## Summary");
    expect(md).toContain("**Models tested:** 0");
  });
});

describe("saveMarkdownReport", () => {
  afterEach(() => {
    if (existsSync(".reports/benchmark.md")) {
      rmSync(".reports", { recursive: true });
    }
  });

  it("creates .reports/benchmark.md", () => {
    const md = "# Test Report\n\nContent here.";
    saveMarkdownReport(md);

    expect(existsSync(".reports/benchmark.md")).toBe(true);
    const content = readFileSync(".reports/benchmark.md", "utf-8");
    expect(content).toBe(md);
  });

  it("overwrites existing report", () => {
    saveMarkdownReport("first");
    saveMarkdownReport("second");

    const content = readFileSync(".reports/benchmark.md", "utf-8");
    expect(content).toBe("second");
  });
});
