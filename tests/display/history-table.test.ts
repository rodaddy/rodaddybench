import { describe, expect, it, mock, spyOn } from "bun:test";
import { displayHistoryTable } from "../../src/display/history-table.ts";
import type { StoredRun } from "../../src/core/types.ts";

describe("displayHistoryTable", () => {
  it("shows empty message when no runs provided", () => {
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    displayHistoryTable([], 0);

    expect(logSpy).toHaveBeenCalledWith("No matching runs found.");
    logSpy.mockRestore();
  });

  it("renders a formatted table with run data", () => {
    const logSpy = spyOn(console, "log").mockImplementation(() => {});

    const mockRuns: StoredRun[] = [
      {
        runId: "20260224-120000-a1b2",
        timestamp: "2026-02-24T12:00:00.000Z",
        gitCommit: "abc1234",
        gitBranch: "main",
        gitDirty: false,
        config: { categories: null, models: null, sequential: false },
        modelsDiscovered: ["gpt-4o", "claude-3-5-sonnet"],
        testCaseCount: 10,
        results: [],
        summary: [
          {
            model: "gpt-4o",
            categoryScores: {},
            overallScore: 0.85,
            avgLatencyMs: 500,
            totalTokens: 1000,
            errorCount: 0,
            totalCostUsd: 0.01,
            avgCostPerRequest: 0.001,
            qualityPerDollar: 85,
          },
        ],
        durationMs: 45000,
      },
    ];

    displayHistoryTable(mockRuns, 1);

    // Get all log calls
    const calls = logSpy.mock.calls.map((c) => c[0] as string);

    // Check for ID and metadata
    const tableStr = calls.find((c) => c && c.includes("a1b2"));
    expect(tableStr).toBeDefined();
    expect(tableStr).toContain("20260224-120000-a1b2");
    expect(tableStr).toContain("2026-02-24 12:00");
    expect(tableStr).toContain("gpt-4o, claude-3-5-sonnet");
    expect(tableStr).toContain("10");
    expect(tableStr).toContain("85%"); // formatScore(0.85)
    expect(tableStr).toContain("45s"); // formatDuration(45000)

    // Check footer
    expect(calls).toContain("Showing 1 of 1 runs");

    logSpy.mockRestore();
  });

  it("formats multi-model lists correctly", () => {
    const logSpy = spyOn(console, "log").mockImplementation(() => {});

    const mockRuns: StoredRun[] = [
      {
        runId: "20260224-120000-a1b2",
        timestamp: "2026-02-24T12:00:00.000Z",
        gitCommit: "abc1234",
        gitBranch: "main",
        gitDirty: false,
        config: { categories: null, models: null, sequential: false },
        modelsDiscovered: ["m1", "m2", "m3", "m4"],
        testCaseCount: 5,
        results: [],
        summary: [
          {
            model: "m1",
            categoryScores: {},
            overallScore: 0.5,
            avgLatencyMs: 100,
            totalTokens: 100,
            errorCount: 0,
            totalCostUsd: 0,
            avgCostPerRequest: 0,
            qualityPerDollar: null,
          },
        ],
        durationMs: 72000,
      },
    ];

    displayHistoryTable(mockRuns, 1);

    const calls = logSpy.mock.calls.map((c) => c[0] as string);
    const tableStr = calls.find((c) => c && c.includes("a1b2"));

    expect(tableStr).toContain("4 models");
    expect(tableStr).toContain("1m 12s");
    expect(tableStr).toContain("50%");

    logSpy.mockRestore();
  });
});
