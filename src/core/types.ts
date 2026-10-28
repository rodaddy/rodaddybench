export interface ExecutionOptions {
  categories?: string[];
  models?: string[];
  sequential: boolean;
  verbose: boolean;
}

export interface CriterionScore {
  name: string; // criterion name (e.g. "bug_detection")
  score: number; // 1-10 integer score from judge
  maxScore: number; // always 10
  weight: number; // criterion weight from rubric (0.0-1.0)
  description: string; // criterion description from rubric
}

export interface PositionSwapData {
  originalScores: Record<string, number>; // criterion scores from position A (model first)
  swappedScores: Record<string, number>; // criterion scores from position B (golden first)
  averagedScores: Record<string, number>; // mean of both positions per criterion
  originalOverall: number; // weighted overall from position A
  swappedOverall: number; // weighted overall from position B
  delta: number; // abs(originalOverall - swappedOverall)
  isConsistent: boolean; // delta <= threshold (0.15 on 0-1 scale)
  consistencyThreshold: number; // the threshold used (store for reproducibility)
}

export interface VerbosityMetadata {
  responseLength: number; // character count of model response
  goldenAnswerLength: number; // character count of golden answer
  lengthRatio: number; // responseLength / goldenAnswerLength
}

export interface JudgeMetadata {
  judgeModel: string;
  criteriaScores: Record<string, number>; // normalized 0-1 for backward compat
  criterionBreakdown: CriterionScore[]; // per-criterion 1-10 breakdown
  judgeReasoning: string;
  judgeConfidence: number;
  judgeTokens: { prompt: number; completion: number; total: number };
  judgeLatencyMs: number;
  positionSwap?: PositionSwapData;
  verbosityMetadata?: VerbosityMetadata;
}

export interface ModelSummary {
  model: string;
  categoryScores: Record<string, number>;
  overallScore: number;
  avgLatencyMs: number;
  totalTokens: number;
  errorCount: number;
  totalCostUsd: number; // 0 for old runs without cost data
  avgCostPerRequest: number; // 0 for old runs without cost data
  qualityPerDollar: number | null; // null when cost is 0
}

export interface StoredRun {
  runId: string; // "20260223-143052-a7f3"
  timestamp: string; // ISO 8601
  gitCommit: string | null;
  gitBranch: string | null;
  gitDirty: boolean;
  config: {
    categories: string[] | null;
    models: string[] | null;
    sequential: boolean;
  };
  modelsDiscovered: string[];
  testCaseCount: number;
  results: BenchmarkResult[];
  summary: ModelSummary[];
  durationMs: number;
}

export interface BenchmarkResult {
  model: string;
  testCase: string; // test case ID
  category: string;
  response: string;
  score: number; // 0.0-1.0 (weighted if judge, binary if deterministic)
  latencyMs: number; // round-trip latency via Date.now()
  tokens: {
    prompt: number;
    completion: number;
    total: number;
    cachedPrompt?: number;
  };
  error?: string; // populated if execution failed
  costUsd?: number; // cost in USD from LiteLLM response header
  judgeMetadata?: JudgeMetadata; // only populated for judge-scored tests
  checklistMetadata?: {
    itemResults: Array<{
      id: string;
      description: string;
      matched: boolean;
      weight: number;
    }>;
    itemsMatched: number;
    itemsTotal: number;
  };
}
