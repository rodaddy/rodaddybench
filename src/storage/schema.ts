import { z } from "zod";

// -- Metadata --

export const MetadataSchema = z.object({
  source: z.enum(["real-work", "crafted"]),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  tags: z.array(z.string()).default([]),
  created: z.string().datetime(),
  lastModified: z.string().datetime(),
});

export type Metadata = z.infer<typeof MetadataSchema>;

// -- Base test case fields (shared by all scoring methods) --

export const BaseTestCaseSchema = z.object({
  id: z.string().min(1),
  category: z.enum([
    "infrastructure",
    "code-review",
    "research",
    "content-generation",
    "agent-orchestration",
    "antagonist",
  ]),
  prompt: z.string().min(1),
  context: z.string().optional(),
  metadata: MetadataSchema,
});

// -- Scoring method schemas (discriminated on `scoringMethod`) --

export const ExactMatchSchema = z.object({
  scoringMethod: z.literal("exact-match"),
  goldenAnswer: z.string(),
  normalize: z
    .object({
      trim: z.boolean().default(true),
      lowercase: z.boolean().default(false),
      collapseWhitespace: z.boolean().default(false),
    })
    .default(() => ({
      trim: true,
      lowercase: false,
      collapseWhitespace: false,
    })),
});

export const RegexSchema = z.object({
  scoringMethod: z.literal("regex"),
  goldenAnswer: z.string(),
  extractionPattern: z.string(),
  regexFlags: z.string().default(""),
});

export const CommandValidationSchema = z.object({
  scoringMethod: z.literal("command-validation"),
  goldenAnswer: z.string(),
  acceptedVariations: z.array(z.string()).default([]),
  extractionPattern: z.string().optional(),
});

export const StructuredOutputSchema = z.object({
  scoringMethod: z.literal("structured-output"),
  goldenAnswer: z.string(),
  requiredFields: z.array(z.string()),
});

const ScoringCriterionSchema = z.object({
  name: z.string().min(1),
  weight: z.number().min(0).max(1),
  description: z.string().min(1),
  scoringLevels: z.record(
    z.enum(["1", "3", "5", "7", "10"]),
    z.string().min(1),
  ),
});

const ScoringRubricSchema = z
  .object({
    method: z.enum(["judge", "deterministic"]),
    judge: z.string().optional(),
    criteria: z.array(ScoringCriterionSchema).min(1),
  })
  .refine(
    (rubric) => {
      const sum = rubric.criteria.reduce((s, c) => s + c.weight, 0);
      return Math.abs(sum - 1.0) < 0.001;
    },
    { message: "Rubric criterion weights must sum to 1.0" },
  );

export const JudgeSchema = z.object({
  scoringMethod: z.literal("judge"),
  goldenAnswer: z.string(),
  rubric: ScoringRubricSchema,
});

export const ChecklistSchema = z.object({
  scoringMethod: z.literal("checklist"),
  goldenAnswer: z.string(), // kept for reference/display, not used for scoring
  checklistItems: z
    .array(
      z.object({
        id: z.string().min(1),
        description: z.string().min(1),
        pattern: z.string().min(1),
        patternFlags: z.string().default("i"),
        weight: z.number().min(0).max(1).default(1),
      }),
    )
    .min(1),
});

// -- Combined scoring union --

export const ScoringMethodSchema = z.discriminatedUnion("scoringMethod", [
  ExactMatchSchema,
  RegexSchema,
  CommandValidationSchema,
  StructuredOutputSchema,
  JudgeSchema,
  ChecklistSchema,
]);

// -- Full test case = base fields + scoring method --

export const TestCaseSchema = z.intersection(
  BaseTestCaseSchema,
  ScoringMethodSchema,
);

export type TestCase = z.infer<typeof TestCaseSchema>;
