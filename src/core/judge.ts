import { z } from "zod";
import type OpenAI from "openai";
import type { ScoringRubric } from "../scoring/rubrics.ts";
import type { PositionSwapData } from "./types.ts";

export const JudgeScoreSchema = z.object({
  scores: z.record(z.string(), z.number().int().min(1).max(10)),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
});

export type JudgeScore = z.infer<typeof JudgeScoreSchema>;

/**
 * Compute a weighted overall score from per-criterion scores.
 * Scores are on 1-10 scale; result is normalized to [0.0, 1.0]
 * for downstream compatibility (display, reports, regressions).
 */
export function computeWeightedScore(
  criteriaScores: Record<string, number>,
  criteria: Array<{ name: string; weight: number }>,
): number {
  const weights = Object.fromEntries(criteria.map((c) => [c.name, c.weight]));

  let weighted = 0;
  for (const [criterion, score] of Object.entries(criteriaScores)) {
    weighted += (score / 10) * (weights[criterion] ?? 0);
  }

  return Math.round(Math.max(0, Math.min(1, weighted)) * 10000) / 10000;
}

/**
 * Parse judge response content, handling cases where the model wraps JSON in markdown
 * or returns prose with embedded JSON.
 */
function parseJudgeResponse(content: string): unknown {
  // Try direct parse first
  try {
    return JSON.parse(content);
  } catch {
    // fall through
  }

  // Try extracting from ```json code block
  const jsonBlock = /```(?:json)?\s*\n([\s\S]*?)```/;
  const blockMatch = jsonBlock.exec(content);
  if (blockMatch?.[1]) {
    try {
      return JSON.parse(blockMatch[1].trim());
    } catch {
      // fall through
    }
  }

  // Try finding JSON object boundaries
  const braceStart = content.indexOf("{");
  const braceEnd = content.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    try {
      return JSON.parse(content.slice(braceStart, braceEnd + 1));
    } catch {
      // fall through
    }
  }

  throw new Error(
    `Judge response is not valid JSON: ${content.slice(0, 200)}...`,
  );
}

/**
 * Score a model response using a judge model.
 * Uses json_object response format with explicit JSON schema in prompt.
 * Includes golden answer as reference and MT-Bench-style scoring anchors.
 */
export interface JudgeScoreWithUsage extends JudgeScore {
  usage: { prompt: number; completion: number; total: number };
}

export async function scoreWithJudge(
  client: OpenAI,
  judgeModel: string,
  testCasePrompt: string,
  modelResponse: string,
  rubric: ScoringRubric,
  goldenAnswer: string,
  position: "original" | "swapped" = "original",
): Promise<JudgeScoreWithUsage> {
  const criteriaDescription = rubric.criteria
    .map((c) => {
      const levels = c.scoringLevels;
      let desc = `### ${c.name} (weight: ${Math.round(c.weight * 100)}%)\n${c.description}\n`;
      if (levels) {
        desc += "\nScoring anchors:\n";
        for (const [score, explanation] of Object.entries(levels).sort(
          ([a], [b]) => Number(a) - Number(b),
        )) {
          desc += `  ${score}: ${explanation}\n`;
        }
      }
      return desc;
    })
    .join("\n");

  const completion = await client.chat.completions.create({
    model: judgeModel,
    messages: [
      {
        role: "system",
        content: `You are an expert evaluator scoring AI model responses against a reference answer.

Score each criterion on a 1-10 integer scale using the scoring anchors below. You may use any integer 1-10, not just the anchor points. The anchors describe what specific scores mean for each criterion.

IMPORTANT: Compare the response against the REFERENCE ANSWER provided. The reference answer represents the expected quality level.

VERBOSITY BIAS WARNING: LLM judges tend to prefer longer responses. Actively resist this bias. A concise response that covers all key points should score EQUAL TO or HIGHER THAN a verbose response covering the same points with filler. Length alone is never a positive signal. Penalize unnecessary repetition, over-explanation of obvious points, and padding.

RUBRIC:
${criteriaDescription}

You MUST respond with ONLY a valid JSON object (no markdown, no explanation outside the JSON). The JSON must have this exact structure:
{
  "scores": [${rubric.criteria.map((c) => `{"criterion": "${c.name}", "score": <1-10 integer>}`).join(", ")}],
  "reasoning": "<detailed reasoning explaining each score>",
  "confidence": <0.0 to 1.0>
}`,
      },
      {
        role: "user",
        content:
          position === "swapped"
            ? `TASK PROMPT:\n${testCasePrompt}\n\nREFERENCE ANSWER:\n${modelResponse}\n\nMODEL RESPONSE:\n${goldenAnswer}\n\nScore each criterion (1-10 integer) and provide reasoning. Respond with ONLY the JSON object.`
            : `TASK PROMPT:\n${testCasePrompt}\n\nREFERENCE ANSWER:\n${goldenAnswer}\n\nMODEL RESPONSE:\n${modelResponse}\n\nScore each criterion (1-10 integer) and provide reasoning. Respond with ONLY the JSON object.`,
      },
    ],
    response_format: { type: "json_object" },
    ...({ cache: { "no-cache": true } } as Record<string, unknown>),
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Judge model returned empty response");

  const raw = parseJudgeResponse(content) as Record<string, unknown>;

  // Convert array-style scores to Record format
  if (Array.isArray(raw.scores)) {
    raw.scores = Object.fromEntries(
      (raw.scores as Array<{ criterion: string; score: number }>).map((s) => [
        s.criterion,
        s.score,
      ]),
    );
  }

  const score = JudgeScoreSchema.parse(raw);

  return {
    ...score,
    usage: {
      prompt: completion.usage?.prompt_tokens ?? 0,
      completion: completion.usage?.completion_tokens ?? 0,
      total: completion.usage?.total_tokens ?? 0,
    },
  };
}

/**
 * Run position-swapped judge evaluation to detect and mitigate position bias.
 * Calls scoreWithJudge twice in parallel: once with original order (model response
 * as "MODEL RESPONSE"), once swapped (golden answer as "MODEL RESPONSE").
 * Returns both results plus averaged scores and consistency metadata.
 */
export async function scoreWithPositionSwap(
  client: OpenAI,
  judgeModel: string,
  testCasePrompt: string,
  modelResponse: string,
  rubric: ScoringRubric,
  goldenAnswer: string,
  consistencyThreshold: number = 0.15,
): Promise<{
  original: JudgeScoreWithUsage;
  swapped: JudgeScoreWithUsage;
  positionSwap: PositionSwapData;
}> {
  const [original, swapped] = await Promise.all([
    scoreWithJudge(
      client,
      judgeModel,
      testCasePrompt,
      modelResponse,
      rubric,
      goldenAnswer,
      "original",
    ),
    scoreWithJudge(
      client,
      judgeModel,
      testCasePrompt,
      modelResponse,
      rubric,
      goldenAnswer,
      "swapped",
    ),
  ]);

  // Compute per-criterion averaged scores
  const allCriteria = new Set([
    ...Object.keys(original.scores),
    ...Object.keys(swapped.scores),
  ]);
  const averagedScores: Record<string, number> = {};
  for (const criterion of allCriteria) {
    const origScore = original.scores[criterion] ?? 1;
    const swapScore = swapped.scores[criterion] ?? 1;
    averagedScores[criterion] = (origScore + swapScore) / 2;
  }

  // Compute weighted overall scores for each position
  const originalOverall = computeWeightedScore(
    original.scores,
    rubric.criteria,
  );
  const swappedOverall = computeWeightedScore(swapped.scores, rubric.criteria);

  const delta = Math.abs(originalOverall - swappedOverall);

  const positionSwap: PositionSwapData = {
    originalScores: { ...original.scores },
    swappedScores: { ...swapped.scores },
    averagedScores,
    originalOverall,
    swappedOverall,
    delta,
    isConsistent: delta <= consistencyThreshold,
    consistencyThreshold,
  };

  return { original, swapped, positionSwap };
}
