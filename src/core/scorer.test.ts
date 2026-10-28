import { describe, test, expect, mock, beforeEach } from "bun:test";
import { scoreDeterministic, scoreChecklistDetailed } from "./scorer";
import type { TestCase } from "../storage/schema";
import type { CriterionScore } from "./types";

// -- Helper to build test cases with required base fields --

function makeTestCase(scoring: Record<string, unknown>): TestCase {
  return {
    id: "test-1",
    category: "infrastructure",
    prompt: "test prompt",
    metadata: {
      source: "crafted",
      tags: [],
      created: "2026-01-01T00:00:00Z",
      lastModified: "2026-01-01T00:00:00Z",
    },
    ...scoring,
  } as unknown as TestCase;
}

// -- Exact Match --

describe("exact-match scoring", () => {
  test("exact string match returns 1.0", () => {
    const tc = makeTestCase({
      scoringMethod: "exact-match",
      goldenAnswer: "42",
      normalize: { trim: true, lowercase: false, collapseWhitespace: false },
    });
    expect(scoreDeterministic(tc, "42")).toBe(1.0);
  });

  test("non-matching string returns 0.0", () => {
    const tc = makeTestCase({
      scoringMethod: "exact-match",
      goldenAnswer: "42",
      normalize: { trim: true, lowercase: false, collapseWhitespace: false },
    });
    expect(scoreDeterministic(tc, "43")).toBe(0.0);
  });

  test("match with leading/trailing whitespace returns 1.0 (trim enabled)", () => {
    const tc = makeTestCase({
      scoringMethod: "exact-match",
      goldenAnswer: "hello world",
      normalize: { trim: true, lowercase: false, collapseWhitespace: false },
    });
    expect(scoreDeterministic(tc, "  hello world  ")).toBe(1.0);
  });

  test("case-sensitive by default (different case returns 0.0)", () => {
    const tc = makeTestCase({
      scoringMethod: "exact-match",
      goldenAnswer: "Hello",
      normalize: { trim: true, lowercase: false, collapseWhitespace: false },
    });
    expect(scoreDeterministic(tc, "hello")).toBe(0.0);
  });

  test("case-insensitive when normalize.lowercase is true returns 1.0", () => {
    const tc = makeTestCase({
      scoringMethod: "exact-match",
      goldenAnswer: "Hello",
      normalize: { trim: true, lowercase: true, collapseWhitespace: false },
    });
    expect(scoreDeterministic(tc, "hello")).toBe(1.0);
  });

  test("collapse whitespace normalizes internal spaces", () => {
    const tc = makeTestCase({
      scoringMethod: "exact-match",
      goldenAnswer: "hello world",
      normalize: { trim: true, lowercase: false, collapseWhitespace: true },
    });
    expect(scoreDeterministic(tc, "hello   world")).toBe(1.0);
  });
});

// -- Regex Extraction --

describe("regex scoring", () => {
  test("extraction pattern captures group 1, matches golden answer returns 1.0", () => {
    const tc = makeTestCase({
      scoringMethod: "regex",
      goldenAnswer: "192.168.1.1",
      extractionPattern: "IP:\\s*(\\S+)",
      regexFlags: "",
    });
    expect(scoreDeterministic(tc, "The IP: 192.168.1.1 is active")).toBe(1.0);
  });

  test("extraction pattern captures but doesn't match golden answer returns 0.0", () => {
    const tc = makeTestCase({
      scoringMethod: "regex",
      goldenAnswer: "192.168.1.1",
      extractionPattern: "IP:\\s*(\\S+)",
      regexFlags: "",
    });
    expect(scoreDeterministic(tc, "The IP: 10.0.0.1 is active")).toBe(0.0);
  });

  test("no regex match in response returns 0.0", () => {
    const tc = makeTestCase({
      scoringMethod: "regex",
      goldenAnswer: "192.168.1.1",
      extractionPattern: "IP:\\s*(\\S+)",
      regexFlags: "",
    });
    expect(scoreDeterministic(tc, "No IP address here")).toBe(0.0);
  });

  test("regex flags from test case are applied (case-insensitive)", () => {
    const tc = makeTestCase({
      scoringMethod: "regex",
      goldenAnswer: "hello",
      extractionPattern: "answer:\\s*(\\w+)",
      regexFlags: "i",
    });
    expect(scoreDeterministic(tc, "ANSWER: hello")).toBe(1.0);
  });

  test("regex with multiline flag matches across lines", () => {
    const tc = makeTestCase({
      scoringMethod: "regex",
      goldenAnswer: "world",
      extractionPattern: "^result:\\s*(\\w+)",
      regexFlags: "m",
    });
    expect(scoreDeterministic(tc, "some preamble\nresult: world\ndone")).toBe(
      1.0,
    );
  });
});

// -- Command Validation --

describe("command-validation scoring", () => {
  test("exact command match returns 1.0", () => {
    const tc = makeTestCase({
      scoringMethod: "command-validation",
      goldenAnswer: "ls -la",
      acceptedVariations: [],
    });
    expect(scoreDeterministic(tc, "ls -la")).toBe(1.0);
  });

  test("command with reordered flags returns 1.0", () => {
    const tc = makeTestCase({
      scoringMethod: "command-validation",
      goldenAnswer: "ls -al",
      acceptedVariations: [],
    });
    expect(scoreDeterministic(tc, "ls -la")).toBe(1.0);
  });

  test("command from acceptedVariations returns 1.0", () => {
    const tc = makeTestCase({
      scoringMethod: "command-validation",
      goldenAnswer: "ls -la",
      acceptedVariations: ["ls -a -l", "ls --all -l"],
    });
    expect(scoreDeterministic(tc, "ls -a -l")).toBe(1.0);
  });

  test("completely wrong command returns 0.0", () => {
    const tc = makeTestCase({
      scoringMethod: "command-validation",
      goldenAnswer: "ls -la",
      acceptedVariations: [],
    });
    expect(scoreDeterministic(tc, "cat /etc/passwd")).toBe(0.0);
  });

  test("command extracted from markdown code block returns 1.0", () => {
    const tc = makeTestCase({
      scoringMethod: "command-validation",
      goldenAnswer: "docker ps -a",
      acceptedVariations: [],
    });
    const response =
      "Run this:\n```bash\ndocker ps -a\n```\nThat shows all containers.";
    expect(scoreDeterministic(tc, response)).toBe(1.0);
  });

  test("command extracted from generic code block returns 1.0", () => {
    const tc = makeTestCase({
      scoringMethod: "command-validation",
      goldenAnswer: "kubectl get pods",
      acceptedVariations: [],
    });
    const response = "Try:\n```\nkubectl get pods\n```";
    expect(scoreDeterministic(tc, response)).toBe(1.0);
  });
});

// -- Structured Output --

describe("structured-output scoring", () => {
  test("all requiredFields present and matching returns 1.0", () => {
    const tc = makeTestCase({
      scoringMethod: "structured-output",
      goldenAnswer: JSON.stringify({ name: "test", version: "1.0" }),
      requiredFields: ["name", "version"],
    });
    expect(
      scoreDeterministic(tc, JSON.stringify({ name: "test", version: "1.0" })),
    ).toBe(1.0);
  });

  test("missing required field returns 0.0", () => {
    const tc = makeTestCase({
      scoringMethod: "structured-output",
      goldenAnswer: JSON.stringify({ name: "test", version: "1.0" }),
      requiredFields: ["name", "version"],
    });
    expect(scoreDeterministic(tc, JSON.stringify({ name: "test" }))).toBe(0.0);
  });

  test("extra fields ignored, only requiredFields checked", () => {
    const tc = makeTestCase({
      scoringMethod: "structured-output",
      goldenAnswer: JSON.stringify({ name: "test", version: "1.0" }),
      requiredFields: ["name"],
    });
    expect(
      scoreDeterministic(
        tc,
        JSON.stringify({ name: "test", extra: "ignored", version: "2.0" }),
      ),
    ).toBe(1.0);
  });

  test("non-JSON response returns 0.0", () => {
    const tc = makeTestCase({
      scoringMethod: "structured-output",
      goldenAnswer: JSON.stringify({ name: "test" }),
      requiredFields: ["name"],
    });
    expect(scoreDeterministic(tc, "this is not json")).toBe(0.0);
  });

  test("JSON embedded in markdown code block extracted and scored", () => {
    const tc = makeTestCase({
      scoringMethod: "structured-output",
      goldenAnswer: JSON.stringify({ status: "ok", count: 5 }),
      requiredFields: ["status", "count"],
    });
    const response =
      'Here is the result:\n```json\n{"status":"ok","count":5}\n```\nDone.';
    expect(scoreDeterministic(tc, response)).toBe(1.0);
  });
});

// -- Router --

describe("score routing", () => {
  test("routes to exact-match scorer", () => {
    const tc = makeTestCase({
      scoringMethod: "exact-match",
      goldenAnswer: "yes",
      normalize: { trim: true, lowercase: false, collapseWhitespace: false },
    });
    expect(scoreDeterministic(tc, "yes")).toBe(1.0);
  });

  test("routes to regex scorer", () => {
    const tc = makeTestCase({
      scoringMethod: "regex",
      goldenAnswer: "42",
      extractionPattern: "answer: (\\d+)",
      regexFlags: "",
    });
    expect(scoreDeterministic(tc, "The answer: 42")).toBe(1.0);
  });

  test("routes to command-validation scorer", () => {
    const tc = makeTestCase({
      scoringMethod: "command-validation",
      goldenAnswer: "git status",
      acceptedVariations: [],
    });
    expect(scoreDeterministic(tc, "git status")).toBe(1.0);
  });

  test("routes to structured-output scorer", () => {
    const tc = makeTestCase({
      scoringMethod: "structured-output",
      goldenAnswer: JSON.stringify({ ok: true }),
      requiredFields: ["ok"],
    });
    expect(scoreDeterministic(tc, JSON.stringify({ ok: true }))).toBe(1.0);
  });

  test("throws when calling scoreDeterministic for judge method", () => {
    const tc = makeTestCase({
      scoringMethod: "judge",
      rubric: {
        method: "judge",
        criteria: [
          { name: "quality", weight: 1.0, description: "Overall quality" },
        ],
      },
    });
    expect(() => scoreDeterministic(tc, "some response")).toThrow(
      /scoreTestCase/i,
    );
  });

  test("routes to checklist scorer via scoreChecklistDetailed", () => {
    const tc = makeTestCase({
      scoringMethod: "checklist",
      goldenAnswer: "qm list",
      checklistItems: [
        {
          id: "cmd",
          description: "Uses qm",
          pattern: "\\bqm\\b",
          patternFlags: "i",
          weight: 1,
        },
        {
          id: "sub",
          description: "Uses list",
          pattern: "\\blist\\b",
          patternFlags: "i",
          weight: 1,
        },
      ],
    });
    expect(scoreChecklistDetailed(tc, "qm list").score).toBe(1.0);
  });

  test("throws Error for unknown scoring method", () => {
    const tc = makeTestCase({
      scoringMethod: "unknown-method" as never,
      goldenAnswer: "test",
    });
    expect(() => scoreDeterministic(tc, "test")).toThrow();
  });
});

// -- Checklist Scoring --

describe("checklist scoring", () => {
  const checklistTC = (
    items: Array<{
      id: string;
      description: string;
      pattern: string;
      patternFlags?: string;
      weight?: number;
    }>,
  ) =>
    makeTestCase({
      scoringMethod: "checklist",
      goldenAnswer: "reference answer",
      checklistItems: items.map((i) => ({
        patternFlags: "i",
        weight: 1,
        ...i,
      })),
    });

  test("all checklist items matched returns 1.0", () => {
    const tc = checklistTC([
      { id: "a", description: "Has foo", pattern: "foo" },
      { id: "b", description: "Has bar", pattern: "bar" },
      { id: "c", description: "Has baz", pattern: "baz" },
    ]);
    expect(scoreChecklistDetailed(tc, "foo bar baz").score).toBe(1.0);
  });

  test("no checklist items matched returns 0.0", () => {
    const tc = checklistTC([
      { id: "a", description: "Has foo", pattern: "foo" },
      { id: "b", description: "Has bar", pattern: "bar" },
    ]);
    expect(scoreChecklistDetailed(tc, "completely unrelated").score).toBe(0.0);
  });

  test("partial match returns proportional score", () => {
    const tc = checklistTC([
      { id: "a", description: "Has foo", pattern: "foo" },
      { id: "b", description: "Has bar", pattern: "bar" },
      { id: "c", description: "Has baz", pattern: "baz" },
      { id: "d", description: "Has qux", pattern: "qux" },
      { id: "e", description: "Has nope", pattern: "nope" },
    ]);
    // matches foo, bar, baz -- 3/5 = 0.6
    expect(scoreChecklistDetailed(tc, "foo bar baz").score).toBeCloseTo(
      0.6,
      10,
    );
  });

  test("weighted items affect score proportionally", () => {
    const tc = checklistTC([
      { id: "a", description: "Has foo", pattern: "foo", weight: 1 },
      { id: "b", description: "Has bar", pattern: "bar", weight: 0.5 },
    ]);
    // only foo matches: earned 1 / total 1.5 = 0.6667
    expect(scoreChecklistDetailed(tc, "foo only").score).toBeCloseTo(
      1 / 1.5,
      10,
    );
  });

  test("case-insensitive matching by default", () => {
    const tc = checklistTC([
      {
        id: "a",
        description: "Has Foo",
        pattern: "foo",
        patternFlags: "i",
      },
    ]);
    expect(scoreChecklistDetailed(tc, "FOO").score).toBe(1.0);
  });

  test("invalid regex pattern treated as not matched", () => {
    const tc = checklistTC([
      {
        id: "a",
        description: "Bad pattern",
        pattern: "[invalid",
        patternFlags: "",
      },
      { id: "b", description: "Good pattern", pattern: "hello" },
    ]);
    // bad pattern = 0, good pattern = 1 -> 1/2 = 0.5
    expect(scoreChecklistDetailed(tc, "hello world").score).toBeCloseTo(
      0.5,
      10,
    );
  });

  test("scoreChecklistDetailed returns per-item breakdown", () => {
    const tc = checklistTC([
      { id: "cmd", description: "Uses pct create", pattern: "pct\\s+create" },
      { id: "id", description: "Has ID 105", pattern: "\\b105\\b" },
      { id: "mem", description: "Has memory flag", pattern: "--memory" },
    ]);
    const result = scoreChecklistDetailed(
      tc,
      "pct create 105 local:vztmpl/foo.tar.zst",
    );

    expect(result.score).toBeCloseTo(2 / 3, 10);
    expect(result.itemResults).toHaveLength(3);

    const cmdItem = result.itemResults.find((i) => i.id === "cmd");
    expect(cmdItem!.matched).toBe(true);

    const idItem = result.itemResults.find((i) => i.id === "id");
    expect(idItem!.matched).toBe(true);

    const memItem = result.itemResults.find((i) => i.id === "mem");
    expect(memItem!.matched).toBe(false);
  });
});

// -- Judge Scoring with criterionBreakdown --

// Helper to build scoreWithPositionSwap mock return value
function makePositionSwapResult(
  scores: Record<string, number>,
  reasoning = "Good bug detection, some false positives",
  confidence = 0.85,
) {
  const usage = { prompt: 100, completion: 50, total: 150 };
  return {
    original: { scores, reasoning, confidence, usage },
    swapped: { scores, reasoning, confidence, usage },
    positionSwap: {
      originalScores: scores,
      swappedScores: scores,
      averagedScores: scores,
      originalOverall: 0,
      swappedOverall: 0,
      delta: 0,
      isConsistent: true,
      consistencyThreshold: 0.15,
    },
  };
}

// Mock the judge module before importing scoreTestCase
const mockScoreWithPositionSwap = mock(() =>
  Promise.resolve(
    makePositionSwapResult({ bug_detection: 8, false_positives: 6 }),
  ),
);

mock.module("./judge.ts", () => ({
  scoreWithPositionSwap: mockScoreWithPositionSwap,
  computeWeightedScore: (
    scores: Record<string, number>,
    criteria: Array<{ name: string; weight: number }>,
  ) => {
    const weights = Object.fromEntries(criteria.map((c) => [c.name, c.weight]));
    let weighted = 0;
    for (const [criterion, score] of Object.entries(scores)) {
      weighted += (score / 10) * (weights[criterion] ?? 0);
    }
    return Math.max(0, Math.min(1, weighted));
  },
}));

// Must import after mock.module
const { scoreTestCase } = await import("./scorer.ts");

describe("judge scoring with criterionBreakdown", () => {
  const judgeTestCase = makeTestCase({
    scoringMethod: "judge",
    prompt: "Review this code for bugs",
    goldenAnswer: "The code has a null pointer on line 5",
    rubric: {
      method: "judge",
      criteria: [
        {
          name: "bug_detection",
          weight: 0.6,
          description: "Ability to find bugs",
        },
        {
          name: "false_positives",
          weight: 0.4,
          description: "Avoidance of false alarms",
        },
      ],
    },
  });

  const fakeClient = {} as Parameters<typeof scoreTestCase>[2];
  const availableModels = ["claude-3-opus", "gemini-1.5-pro"];

  beforeEach(() => {
    mockScoreWithPositionSwap.mockClear();
    mockScoreWithPositionSwap.mockResolvedValue(
      makePositionSwapResult({ bug_detection: 8, false_positives: 6 }),
    );
  });

  test("judge-scored results include criterionBreakdown array", async () => {
    const result = await scoreTestCase(
      judgeTestCase,
      "Found null pointer on line 5",
      fakeClient,
      availableModels,
      "claude-3-opus",
    );

    expect(result.judgeMetadata).toBeDefined();
    expect(result.judgeMetadata!.criterionBreakdown).toBeArray();
    expect(result.judgeMetadata!.criterionBreakdown).toHaveLength(2);
  });

  test("criterionBreakdown entries have correct fields", async () => {
    const result = await scoreTestCase(
      judgeTestCase,
      "Found null pointer on line 5",
      fakeClient,
      availableModels,
      "claude-3-opus",
    );

    const breakdown = result.judgeMetadata!.criterionBreakdown;
    const bugDetection = breakdown.find(
      (c: CriterionScore) => c.name === "bug_detection",
    );
    const falsePosEntry = breakdown.find(
      (c: CriterionScore) => c.name === "false_positives",
    );

    expect(bugDetection).toBeDefined();
    expect(bugDetection!.score).toBe(8);
    expect(bugDetection!.maxScore).toBe(10);
    expect(bugDetection!.weight).toBe(0.6);
    expect(bugDetection!.description).toBe("Ability to find bugs");

    expect(falsePosEntry).toBeDefined();
    expect(falsePosEntry!.score).toBe(6);
    expect(falsePosEntry!.maxScore).toBe(10);
    expect(falsePosEntry!.weight).toBe(0.4);
    expect(falsePosEntry!.description).toBe("Avoidance of false alarms");
  });

  test("criteriaScores contains normalized 0-1 values matching score/10", async () => {
    const result = await scoreTestCase(
      judgeTestCase,
      "Found null pointer on line 5",
      fakeClient,
      availableModels,
      "claude-3-opus",
    );

    const { criteriaScores, criterionBreakdown } = result.judgeMetadata!;

    // criteriaScores should be normalized: score / 10
    expect(criteriaScores["bug_detection"]).toBe(0.8); // 8 / 10
    expect(criteriaScores["false_positives"]).toBe(0.6); // 6 / 10

    // Verify consistency between breakdown and criteriaScores
    for (const entry of criterionBreakdown) {
      expect(criteriaScores[entry.name]).toBe(entry.score / 10);
    }
  });

  test("overall score matches weighted normalized computation", async () => {
    const result = await scoreTestCase(
      judgeTestCase,
      "Found null pointer on line 5",
      fakeClient,
      availableModels,
      "claude-3-opus",
    );

    // bug_detection: 8/10 * 0.6 = 0.48
    // false_positives: 6/10 * 0.4 = 0.24
    // total = 0.72
    expect(result.score).toBeCloseTo(0.72, 10);
  });

  test("missing criterion score defaults to 1", async () => {
    mockScoreWithPositionSwap.mockResolvedValueOnce(
      makePositionSwapResult(
        { bug_detection: 7 },
        "Only scored one criterion",
        0.5,
      ),
    );

    const result = await scoreTestCase(
      judgeTestCase,
      "Partial review",
      fakeClient,
      availableModels,
      "claude-3-opus",
    );

    const breakdown = result.judgeMetadata!.criterionBreakdown;
    const falsePosEntry = breakdown.find(
      (c: CriterionScore) => c.name === "false_positives",
    );
    expect(falsePosEntry!.score).toBe(1); // defaults to 1
  });
});
