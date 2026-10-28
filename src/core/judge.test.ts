import { describe, test, expect, mock } from "bun:test";
import {
  computeWeightedScore,
  scoreWithJudge,
  JudgeScoreSchema,
} from "./judge";
import type { ScoringRubric } from "../scoring/rubrics";

// -- computeWeightedScore --

describe("computeWeightedScore", () => {
  test("returns weighted sum normalized from 1-10 to 0-1", () => {
    const scores = { bug_detection: 8, actionability: 6 };
    const criteria = [
      { name: "bug_detection", weight: 0.6 },
      { name: "actionability", weight: 0.4 },
    ];
    // (8/10)*0.6 + (6/10)*0.4 = 0.48 + 0.24 = 0.72
    expect(computeWeightedScore(scores, criteria)).toBeCloseTo(0.72, 5);
  });

  test("clamps result to 0.0 minimum", () => {
    const scores = { a: -5 };
    const criteria = [{ name: "a", weight: 1.0 }];
    expect(computeWeightedScore(scores, criteria)).toBe(0.0);
  });

  test("clamps result to 1.0 maximum", () => {
    // Score of 10 with weight 1.0 = 1.0 exactly
    const scores = { a: 10 };
    const criteria = [{ name: "a", weight: 1.0 }];
    expect(computeWeightedScore(scores, criteria)).toBe(1.0);
  });

  test("handles missing criteria gracefully (treats as weight 0)", () => {
    const scores = { bug_detection: 9, unknown_criterion: 5 };
    const criteria = [{ name: "bug_detection", weight: 1.0 }];
    // unknown_criterion has weight 0, so only bug_detection counts: 9/10 = 0.9
    expect(computeWeightedScore(scores, criteria)).toBeCloseTo(0.9, 5);
  });

  test("returns 0.0 for empty scores", () => {
    const criteria = [{ name: "a", weight: 1.0 }];
    expect(computeWeightedScore({}, criteria)).toBe(0.0);
  });

  test("handles all criteria from code-review rubric", () => {
    const scores = {
      bug_detection: 9,
      actionability: 7,
      false_positive_rate: 8,
      severity_triage: 6,
    };
    const criteria = [
      { name: "bug_detection", weight: 0.4 },
      { name: "actionability", weight: 0.3 },
      { name: "false_positive_rate", weight: 0.2 },
      { name: "severity_triage", weight: 0.1 },
    ];
    // (9/10)*0.4 + (7/10)*0.3 + (8/10)*0.2 + (6/10)*0.1
    // = 0.36 + 0.21 + 0.16 + 0.06 = 0.79
    expect(computeWeightedScore(scores, criteria)).toBeCloseTo(0.79, 5);
  });

  test("score of 5 across all criteria returns 0.5", () => {
    const scores = { a: 5, b: 5 };
    const criteria = [
      { name: "a", weight: 0.5 },
      { name: "b", weight: 0.5 },
    ];
    expect(computeWeightedScore(scores, criteria)).toBeCloseTo(0.5, 5);
  });
});

// -- scoreWithJudge --

describe("scoreWithJudge", () => {
  const testRubric: ScoringRubric = {
    method: "judge",
    criteria: [
      {
        name: "bug_detection",
        weight: 0.6,
        description: "Finds real bugs",
        scoringLevels: {
          "1": "Misses all bugs",
          "3": "Finds some bugs",
          "5": "Finds most bugs",
          "7": "Finds all bugs",
          "10": "Perfect detection",
        },
      },
      {
        name: "actionability",
        weight: 0.4,
        description: "Gives actionable feedback",
        scoringLevels: {
          "1": "No actionable feedback",
          "3": "Some actionable feedback",
          "5": "Mostly actionable",
          "7": "Very actionable",
          "10": "Perfectly actionable",
        },
      },
    ],
  };

  const testGoldenAnswer = "Expected answer for testing";

  function makeMockClient(responseContent: string) {
    return {
      chat: {
        completions: {
          create: mock(() =>
            Promise.resolve({
              choices: [{ message: { content: responseContent } }],
            }),
          ),
        },
      },
    } as unknown as import("openai").default;
  }

  test("returns JudgeScore with 1-10 integer scores", async () => {
    const mockResponse = JSON.stringify({
      scores: { bug_detection: 8, actionability: 7 },
      reasoning: "Good bug detection, decent actionability.",
      confidence: 0.9,
    });

    const client = makeMockClient(mockResponse);
    const result = await scoreWithJudge(
      client,
      "gemini-2.0-pro",
      "Review this code",
      "Found 3 bugs...",
      testRubric,
      testGoldenAnswer,
    );

    expect(result.scores.bug_detection).toBe(8);
    expect(result.scores.actionability).toBe(7);
    expect(result.reasoning).toBe("Good bug detection, decent actionability.");
    expect(result.confidence).toBe(0.9);
  });

  test("judge prompt includes rubric criteria with weights and scoring anchors", async () => {
    const mockResponse = JSON.stringify({
      scores: { bug_detection: 5, actionability: 5 },
      reasoning: "Average.",
      confidence: 0.8,
    });

    const client = makeMockClient(mockResponse);
    await scoreWithJudge(
      client,
      "gemini-2.0-pro",
      "Review this code",
      "Some response",
      testRubric,
      testGoldenAnswer,
    );

    const createCall = client.chat.completions.create as ReturnType<
      typeof mock
    >;
    const callArgs = createCall.mock.calls[0]![0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const systemMessage = callArgs.messages[0]!.content;

    expect(systemMessage).toContain("bug_detection");
    expect(systemMessage).toContain("60%");
    expect(systemMessage).toContain("actionability");
    expect(systemMessage).toContain("40%");
    expect(systemMessage).toContain("Scoring anchors:");
    expect(systemMessage).toContain("1-10 integer scale");
  });

  test("judge prompt includes golden answer as REFERENCE ANSWER", async () => {
    const mockResponse = JSON.stringify({
      scores: { bug_detection: 7, actionability: 6 },
      reasoning: "Good.",
      confidence: 0.8,
    });

    const client = makeMockClient(mockResponse);
    await scoreWithJudge(
      client,
      "gemini-2.0-pro",
      "Review this code",
      "Some response",
      testRubric,
      "This is the golden answer",
    );

    const createCall = client.chat.completions.create as ReturnType<
      typeof mock
    >;
    const callArgs = createCall.mock.calls[0]![0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const userMessage = callArgs.messages[1]!.content;

    expect(userMessage).toContain("REFERENCE ANSWER:");
    expect(userMessage).toContain("This is the golden answer");
  });

  test("uses response_format with strict JSON schema", async () => {
    const mockResponse = JSON.stringify({
      scores: { bug_detection: 5, actionability: 5 },
      reasoning: "OK.",
      confidence: 0.7,
    });

    const client = makeMockClient(mockResponse);
    await scoreWithJudge(
      client,
      "gemini-2.0-pro",
      "prompt",
      "response",
      testRubric,
      testGoldenAnswer,
    );

    const createCall = client.chat.completions.create as ReturnType<
      typeof mock
    >;
    const callArgs = createCall.mock.calls[0]![0] as {
      response_format: { type: string };
    };

    expect(callArgs.response_format.type).toBe("json_object");
  });

  test("throws on empty response from judge", async () => {
    const client = {
      chat: {
        completions: {
          create: mock(() =>
            Promise.resolve({
              choices: [{ message: { content: null } }],
            }),
          ),
        },
      },
    } as unknown as import("openai").default;

    await expect(
      scoreWithJudge(
        client,
        "gemini-2.0-pro",
        "prompt",
        "response",
        testRubric,
        testGoldenAnswer,
      ),
    ).rejects.toThrow(/empty response/i);
  });

  test("throws on invalid JSON from judge", async () => {
    const client = makeMockClient("not valid json");

    await expect(
      scoreWithJudge(
        client,
        "gemini-2.0-pro",
        "prompt",
        "response",
        testRubric,
        testGoldenAnswer,
      ),
    ).rejects.toThrow();
  });
});

// -- JudgeScoreSchema validation --

describe("JudgeScoreSchema", () => {
  test("validates correct judge score with 1-10 integers", () => {
    const valid = {
      scores: { bug_detection: 8 },
      reasoning: "Good",
      confidence: 0.9,
    };
    expect(() => JudgeScoreSchema.parse(valid)).not.toThrow();
  });

  test("rejects scores outside 1-10 range (too high)", () => {
    const invalid = {
      scores: { bug_detection: 11 },
      reasoning: "Good",
      confidence: 0.9,
    };
    expect(() => JudgeScoreSchema.parse(invalid)).toThrow();
  });

  test("rejects scores outside 1-10 range (too low)", () => {
    const invalid = {
      scores: { bug_detection: 0 },
      reasoning: "Good",
      confidence: 0.9,
    };
    expect(() => JudgeScoreSchema.parse(invalid)).toThrow();
  });

  test("rejects non-integer scores", () => {
    const invalid = {
      scores: { bug_detection: 7.5 },
      reasoning: "Good",
      confidence: 0.9,
    };
    expect(() => JudgeScoreSchema.parse(invalid)).toThrow();
  });

  test("accepts boundary values 1 and 10", () => {
    const min = {
      scores: { a: 1 },
      reasoning: "Bad",
      confidence: 0.5,
    };
    const max = {
      scores: { a: 10 },
      reasoning: "Perfect",
      confidence: 1.0,
    };
    expect(() => JudgeScoreSchema.parse(min)).not.toThrow();
    expect(() => JudgeScoreSchema.parse(max)).not.toThrow();
  });
});
