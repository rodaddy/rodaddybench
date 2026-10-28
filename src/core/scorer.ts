import type OpenAI from "openai";
import type { TestCase } from "../storage/schema.ts";
import type {
  JudgeMetadata,
  CriterionScore,
  BenchmarkResult,
} from "./types.ts";
import { scoreWithPositionSwap, computeWeightedScore } from "./judge.ts";
import { selectJudgeModel, type VendorFamily } from "./vendor-map.ts";

// -- Main entry point (hybrid: deterministic + judge) --

export async function scoreTestCase(
  testCase: TestCase,
  response: string,
  client: OpenAI,
  availableModels: string[],
  testedModelId: string,
  vendorMap?: Map<string, VendorFamily>,
): Promise<{
  score: number;
  judgeMetadata?: JudgeMetadata;
  checklistMetadata?: BenchmarkResult["checklistMetadata"];
}> {
  if (response == null) {
    return { score: 0.0 };
  }

  const method =
    "scoringMethod" in testCase ? (testCase.scoringMethod as string) : "";

  // Checklist method -- deterministic but returns metadata
  if (method === "checklist") {
    const detailed = scoreChecklistDetailed(testCase, response);
    return {
      score: detailed.score,
      checklistMetadata: {
        itemResults: detailed.itemResults,
        itemsMatched: detailed.itemResults.filter((i) => i.matched).length,
        itemsTotal: detailed.itemResults.length,
      },
    };
  }

  // Deterministic methods (Phase 1)
  if (method !== "judge") {
    return { score: scoreDeterministic(testCase, response) };
  }

  // Judge method (Phase 2)
  const judgeModel = selectJudgeModel(
    testedModelId,
    availableModels,
    vendorMap,
  );

  const tc = testCase as {
    goldenAnswer: string;
    rubric: Parameters<typeof scoreWithPositionSwap>[4];
  };
  const startTime = Date.now();
  const { original, swapped, positionSwap } = await scoreWithPositionSwap(
    client,
    judgeModel,
    testCase.prompt,
    response,
    tc.rubric,
    tc.goldenAnswer,
  );
  const judgeLatencyMs = Date.now() - startTime;

  const verbosityMetadata = {
    responseLength: response.length,
    goldenAnswerLength: tc.goldenAnswer.length,
    lengthRatio:
      Math.round((response.length / tc.goldenAnswer.length) * 100) / 100,
  };

  const rubric = tc.rubric;

  // Use position-averaged scores for final result (debiased)
  const overall = computeWeightedScore(
    positionSwap.averagedScores,
    rubric.criteria,
  );

  const criterionBreakdown: CriterionScore[] = rubric.criteria.map((c) => ({
    name: c.name,
    score: positionSwap.averagedScores[c.name] ?? 1, // averaged across positions
    maxScore: 10,
    weight: c.weight,
    description: c.description,
  }));

  return {
    score: overall,
    judgeMetadata: {
      judgeModel,
      criteriaScores: Object.fromEntries(
        criterionBreakdown.map((c) => [c.name, c.score / 10]),
      ),
      criterionBreakdown,
      judgeReasoning: `[Position A] ${original.reasoning}\n\n[Position B] ${swapped.reasoning}`,
      judgeConfidence: (original.confidence + swapped.confidence) / 2,
      judgeTokens: {
        prompt: original.usage.prompt + swapped.usage.prompt,
        completion: original.usage.completion + swapped.usage.completion,
        total: original.usage.total + swapped.usage.total,
      },
      judgeLatencyMs,
      positionSwap,
      verbosityMetadata,
    },
  };
}

// -- Deterministic scoring (kept as internal helper) --

export function scoreDeterministic(
  testCase: TestCase,
  response: string,
): number {
  if (response == null) {
    return 0.0;
  }

  const method =
    "scoringMethod" in testCase ? (testCase.scoringMethod as string) : "";

  switch (method) {
    case "exact-match":
      return scoreExactMatch(testCase, response);
    case "regex":
      return scoreRegex(testCase, response);
    case "command-validation":
      return scoreCommand(testCase, response);
    case "structured-output":
      return scoreStructured(testCase, response);
    case "judge":
      throw new Error(
        "Use scoreTestCase() for judge scoring - requires OpenAI client",
      );
    default:
      throw new Error(`Unknown scoring method: ${method}`);
  }
}

// -- Scoring Methods --

function scoreExactMatch(testCase: TestCase, response: string): number {
  const tc = testCase as unknown as {
    goldenAnswer: string;
    normalize: {
      trim: boolean;
      lowercase: boolean;
      collapseWhitespace: boolean;
    };
  };

  let actual = response;
  let expected = tc.goldenAnswer;

  if (tc.normalize.trim) {
    actual = actual.trim();
    expected = expected.trim();
  }

  if (tc.normalize.collapseWhitespace) {
    actual = actual.replace(/\s+/g, " ");
    expected = expected.replace(/\s+/g, " ");
  }

  if (tc.normalize.lowercase) {
    actual = actual.toLowerCase();
    expected = expected.toLowerCase();
  }

  return actual === expected ? 1.0 : 0.0;
}

function scoreRegex(testCase: TestCase, response: string): number {
  const tc = testCase as unknown as {
    goldenAnswer: string;
    extractionPattern: string;
    regexFlags: string;
  };

  let regex: RegExp;
  try {
    regex = new RegExp(tc.extractionPattern, tc.regexFlags);
  } catch {
    return 0.0;
  }
  const match = regex.exec(response);

  if (!match) {
    return 0.0;
  }

  // Use capture group if present, otherwise use full match
  const extracted = match[1] !== undefined ? match[1] : match[0];
  return extracted.trim() === tc.goldenAnswer.trim() ? 1.0 : 0.0;
}

function scoreCommand(testCase: TestCase, response: string): number {
  const tc = testCase as unknown as {
    goldenAnswer: string;
    acceptedVariations: string[];
  };

  const extracted = extractFromCodeBlock(response);
  const normalizedResponse = normalizeCommand(extracted);
  const normalizedGolden = normalizeCommand(tc.goldenAnswer);

  if (normalizedResponse === normalizedGolden) {
    return 1.0;
  }

  for (const variation of tc.acceptedVariations ?? []) {
    if (normalizedResponse === normalizeCommand(variation)) {
      return 1.0;
    }
  }

  return 0.0;
}

function scoreStructured(testCase: TestCase, response: string): number {
  const tc = testCase as unknown as {
    goldenAnswer: string;
    requiredFields: string[];
  };

  const parsedResponse = extractJson(response);
  if (parsedResponse === null) {
    return 0.0;
  }

  let parsedGolden: Record<string, unknown>;
  try {
    parsedGolden = JSON.parse(tc.goldenAnswer) as Record<string, unknown>;
  } catch {
    return 0.0;
  }

  for (const field of tc.requiredFields) {
    if (!(field in parsedResponse)) {
      return 0.0;
    }
    if (
      JSON.stringify(parsedResponse[field]) !==
      JSON.stringify(parsedGolden[field])
    ) {
      return 0.0;
    }
  }

  return 1.0;
}

// -- Checklist Scoring --

interface ChecklistItem {
  id: string;
  description: string;
  pattern: string;
  patternFlags: string;
  weight: number;
}

export function scoreChecklistDetailed(
  testCase: TestCase,
  response: string,
): {
  score: number;
  itemResults: Array<{
    id: string;
    description: string;
    matched: boolean;
    weight: number;
  }>;
} {
  const tc = testCase as unknown as { checklistItems: ChecklistItem[] };

  let totalWeight = 0;
  let earnedWeight = 0;
  const itemResults: Array<{
    id: string;
    description: string;
    matched: boolean;
    weight: number;
  }> = [];

  for (const item of tc.checklistItems) {
    const w = item.weight;
    totalWeight += w;
    let matched = false;
    try {
      const regex = new RegExp(item.pattern, item.patternFlags);
      matched = regex.test(response);
    } catch {
      // Invalid pattern counts as not matched
    }
    if (matched) {
      earnedWeight += w;
    }
    itemResults.push({
      id: item.id,
      description: item.description,
      matched,
      weight: w,
    });
  }

  return {
    score: totalWeight > 0 ? earnedWeight / totalWeight : 0,
    itemResults,
  };
}

// -- Helpers --

function extractFromCodeBlock(text: string): string {
  // Try ```bash blocks first, then generic ``` blocks
  const bashBlock = /```(?:bash|sh)\n([\s\S]*?)```/;
  const genericBlock = /```\n([\s\S]*?)```/;

  const bashMatch = bashBlock.exec(text);
  if (bashMatch?.[1]) {
    return bashMatch[1].trim();
  }

  const genericMatch = genericBlock.exec(text);
  if (genericMatch?.[1]) {
    return genericMatch[1].trim();
  }

  return text.trim();
}

function normalizeCommand(cmd: string): string {
  const trimmed = cmd.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length <= 1) {
    return trimmed;
  }

  // First part is the command, rest are args/flags
  const command = parts[0];
  const args = parts.slice(1).map(normalizeFlagChars).sort();
  return [command, ...args].join(" ");
}

function normalizeFlagChars(arg: string): string {
  // Sort characters within combined short flags like -la -> -al
  if (/^-[^-]/.test(arg) && arg.length > 2) {
    return "-" + arg.slice(1).split("").sort().join("");
  }
  return arg;
}

function extractJson(text: string): Record<string, unknown> | null {
  // Try ```json code block first
  const jsonBlock = /```json\n([\s\S]*?)```/;
  const jsonMatch = jsonBlock.exec(text);
  if (jsonMatch?.[1]) {
    try {
      return JSON.parse(jsonMatch[1].trim()) as Record<string, unknown>;
    } catch {
      // fall through
    }
  }

  // Try finding { } boundaries
  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    try {
      return JSON.parse(text.slice(braceStart, braceEnd + 1)) as Record<
        string,
        unknown
      >;
    } catch {
      // fall through
    }
  }

  // Try [ ] boundaries
  const bracketStart = text.indexOf("[");
  const bracketEnd = text.lastIndexOf("]");
  if (bracketStart !== -1 && bracketEnd > bracketStart) {
    try {
      return JSON.parse(text.slice(bracketStart, bracketEnd + 1)) as Record<
        string,
        unknown
      >;
    } catch {
      // fall through
    }
  }

  // Try parsing full text
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}
