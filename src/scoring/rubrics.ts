export interface ScoringCriterion {
  name: string;
  weight: number; // 0.0-1.0, sum to 1.0 within rubric
  description: string;
  scoringLevels: Record<string, string>; // keys: "1", "3", "5", "7", "10"
}

export interface ScoringRubric {
  method: "judge" | "deterministic";
  judge?: string; // Description of judging approach
  criteria: ScoringCriterion[];
}

export const RUBRICS: Record<string, ScoringRubric> = {
  "code-review": {
    method: "judge",
    judge: "Cross-vendor (Claude judges Gemini, Gemini judges Claude)",
    criteria: [
      {
        name: "bug_detection",
        weight: 0.35,
        description:
          "Correctly identifies real bugs/issues. False positives reduce score.",
        scoringLevels: {
          "1": "Misses all real bugs or identifies only trivially obvious issues",
          "3": "Finds some bugs but misses the most critical one; includes false positives",
          "5": "Identifies the primary bug but misses secondary issues or lacks precision",
          "7": "Catches all significant bugs with accurate descriptions; minor omissions only",
          "10": "Identifies every bug including subtle ones; zero false positives; precise root cause analysis",
        },
      },
      {
        name: "actionability",
        weight: 0.3,
        description:
          "Specific, includes code examples, explains why issues matter.",
        scoringLevels: {
          "1": "Vague observations with no fix suggestions",
          "3": "Identifies issues but fixes are hand-wavy or incomplete",
          "5": "Provides fix direction but lacks concrete code examples",
          "7": "Includes specific code fixes for most issues with clear explanations",
          "10": "Every issue has a concrete, copy-pasteable fix with explanation of why it works",
        },
      },
      {
        name: "false_positive_rate",
        weight: 0.2,
        description: "Avoids flagging non-issues.",
        scoringLevels: {
          "1": "Majority of flagged issues are non-issues or style preferences",
          "3": "Several false positives mixed with real issues",
          "5": "One or two false positives but mostly accurate",
          "7": "No false positives; every flagged item is a genuine concern",
          "10": "Zero false positives AND explicitly acknowledges clean patterns as intentional",
        },
      },
      {
        name: "severity_triage",
        weight: 0.1,
        description: "Correctly prioritizes critical vs minor issues.",
        scoringLevels: {
          "1": "No severity classification or completely wrong priorities",
          "3": "Severity labels exist but critical bugs rated as low priority",
          "5": "Mostly correct severity ordering with one or two swaps",
          "7": "Accurate severity classification for all issues",
          "10": "Perfect severity triage with clear justification for each level",
        },
      },
      {
        name: "conciseness",
        weight: 0.05,
        description:
          "Response is appropriately concise. No unnecessary repetition, filler, or over-explanation of obvious points.",
        scoringLevels: {
          "1": "Extremely verbose; repeats the same point multiple ways; heavy filler and padding",
          "3": "Noticeably wordy; could be cut by 30%+ without losing substance",
          "5": "Reasonable length but includes some unnecessary elaboration",
          "7": "Concise and focused; every paragraph contributes meaningful analysis",
          "10": "Maximally efficient; zero filler; dense with actionable insight",
        },
      },
    ],
  },
  "content-generation": {
    method: "judge",
    judge: "Cross-vendor",
    criteria: [
      {
        name: "tone_match",
        weight: 0.4,
        description: "Matches user's authentic voice and style.",
        scoringLevels: {
          "1": "Generic corporate tone, clearly AI-generated feel",
          "3": "Somewhat natural but misses the technical-but-accessible voice",
          "5": "Reasonable tone but occasionally slips into marketing speak or over-formality",
          "7": "Matches the requested voice well; reads as authentic",
          "10": "Indistinguishable from the golden answer's voice; perfectly calibrated tone",
        },
      },
      {
        name: "technical_accuracy",
        weight: 0.3,
        description: "Technically correct, no oversimplification.",
        scoringLevels: {
          "1": "Contains factual errors or fundamentally misunderstands the technology",
          "3": "Technically vague; no real depth or insight",
          "5": "Technically correct but surface-level; no novel insight",
          "7": "Accurate with specific technical details that demonstrate understanding",
          "10": "Deep technical accuracy with specific, correct details matching the golden answer's depth",
        },
      },
      {
        name: "engagement",
        weight: 0.2,
        description: "Compelling hook, clear structure, actionable takeaway.",
        scoringLevels: {
          "1": "No hook, buried lede, reads like documentation",
          "3": "Weak opening; structure exists but no compelling reason to keep reading",
          "5": "Decent structure with a clear point, but unremarkable",
          "7": "Strong hook, clear structure, ends with actionable takeaway or discussion prompt",
          "10": "Immediately compelling; reader would stop scrolling; clear call to action",
        },
      },
      {
        name: "brevity",
        weight: 0.1,
        description: "Concise, no filler, appropriate length.",
        scoringLevels: {
          "1": "Wall of text with excessive filler, repetition, or padding",
          "3": "Noticeably verbose; could be cut by 40%+ without losing substance",
          "5": "Appropriate length but has some filler sentences",
          "7": "Concise; every sentence earns its place",
          "10": "Maximally dense; cannot remove a sentence without losing meaning",
        },
      },
    ],
  },
};

/**
 * Validate that rubric criteria weights sum to 1.0.
 * Throws if weights are malformed.
 */
export function validateRubricWeights(rubric: ScoringRubric): void {
  const sum = rubric.criteria.reduce((s, c) => s + c.weight, 0);
  if (Math.abs(sum - 1.0) > 0.001) {
    throw new Error(`Rubric weights don't sum to 1.0 (got ${sum})`);
  }
}

// Self-check: validate all built-in rubrics at module load
for (const [category, rubric] of Object.entries(RUBRICS)) {
  try {
    validateRubricWeights(rubric);
  } catch (err) {
    throw new Error(
      `Invalid built-in rubric for "${category}": ${(err as Error).message}`,
    );
  }
}
