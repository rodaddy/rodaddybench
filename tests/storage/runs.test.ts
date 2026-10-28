import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  generateRunId,
  getGitMetadata,
  saveRun,
  loadRun,
  listRuns,
} from "../../src/storage/runs.ts";
import type { StoredRun } from "../../src/core/types.ts";

function makeTestRun(overrides: Partial<StoredRun> = {}): StoredRun {
  return {
    runId: overrides.runId ?? generateRunId(),
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    gitCommit: "abc1234",
    gitBranch: "main",
    gitDirty: false,
    config: {
      categories: null,
      models: null,
      sequential: false,
    },
    modelsDiscovered: ["model-a", "model-b"],
    testCaseCount: 3,
    results: [],
    summary: [],
    durationMs: 1500,
    ...overrides,
  };
}

describe("generateRunId", () => {
  test("matches YYYYMMDD-HHmmss-xxxx format", () => {
    const id = generateRunId();
    expect(id).toMatch(/^\d{8}-\d{6}-[a-f0-9]{4}$/);
  });

  test("produces unique IDs", () => {
    const id1 = generateRunId();
    const id2 = generateRunId();
    expect(id1).not.toBe(id2);
  });
});

describe("getGitMetadata", () => {
  test("returns non-null commit and branch in a git repo", async () => {
    const git = await getGitMetadata();
    expect(git.commit).not.toBeNull();
    expect(git.branch).not.toBeNull();
    expect(typeof git.dirty).toBe("boolean");
  });
});

describe("saveRun + loadRun", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "rodaddybench-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("roundtrip: save then load returns identical data", async () => {
    const run = makeTestRun();
    await saveRun(run, tempDir);
    const loaded = await loadRun(run.runId, tempDir);
    expect(loaded).toEqual(run);
  });

  test("loadRun returns null for nonexistent ID", async () => {
    const loaded = await loadRun("nonexistent-run-id", tempDir);
    expect(loaded).toBeNull();
  });
});

describe("listRuns", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "rodaddybench-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("returns runs sorted newest-first", async () => {
    const older = makeTestRun({
      runId: "20260101-120000-aaaa",
      timestamp: "2026-01-01T12:00:00.000Z",
    });
    const newer = makeTestRun({
      runId: "20260201-120000-bbbb",
      timestamp: "2026-02-01T12:00:00.000Z",
    });

    await saveRun(older, tempDir);
    await saveRun(newer, tempDir);

    const runs = await listRuns(tempDir);
    expect(runs).toHaveLength(2);
    expect(runs[0]!.runId).toBe("20260201-120000-bbbb");
    expect(runs[1]!.runId).toBe("20260101-120000-aaaa");
  });

  test("returns lightweight summaries with correct fields", async () => {
    const run = makeTestRun({
      modelsDiscovered: ["m1", "m2", "m3"],
      testCaseCount: 7,
    });
    await saveRun(run, tempDir);

    const runs = await listRuns(tempDir);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.modelCount).toBe(3);
    expect(runs[0]!.testCaseCount).toBe(7);
  });

  test("returns empty array for nonexistent directory", async () => {
    const runs = await listRuns(join(tempDir, "nonexistent"));
    expect(runs).toHaveLength(0);
  });
});
