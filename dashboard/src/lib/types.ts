// Mirrored from src/core/types.ts -- keep in sync manually

// DB row types for query results
export interface RunRow {
  run_id: string;
  timestamp: string;
  git_commit: string | null;
  git_branch: string | null;
  git_dirty: number;
  config: string; // JSON
  models_discovered: string; // JSON
  test_case_count: number;
  duration_ms: number;
}

export interface ResultRow {
  id: number;
  run_id: string;
  model: string;
  test_case: string;
  category: string;
  response: string;
  score: number;
  latency_ms: number;
  tokens_prompt: number;
  tokens_completion: number;
  tokens_total: number;
  tokens_cached_prompt: number | null;
  error: string | null;
  cost_usd: number | null;
  judge_metadata: string | null; // JSON
  checklist_metadata: string | null; // JSON
}

export interface SummaryRow {
  id: number;
  run_id: string;
  model: string;
  overall_score: number;
  category_scores: string; // JSON
  avg_latency_ms: number;
  total_tokens: number;
  error_count: number;
  total_cost_usd: number;
  avg_cost_per_request: number;
  quality_per_dollar: number | null;
}

// Parsed types for components
export interface Run {
  runId: string;
  timestamp: Date;
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
  durationMs: number;
}

export interface Summary {
  runId: string;
  model: string;
  overallScore: number;
  categoryScores: Record<string, number>;
  avgLatencyMs: number;
  totalTokens: number;
  errorCount: number;
  totalCostUsd: number;
  avgCostPerRequest: number;
  qualityPerDollar: number | null;
}

export interface Result {
  id: number;
  runId: string;
  model: string;
  testCase: string;
  category: string;
  response: string;
  score: number;
  latencyMs: number;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
    cachedPrompt: number | null;
  };
  error: string | null;
  costUsd: number | null;
  judgeMetadata: JudgeMetadata | null;
  checklistMetadata: ChecklistMetadata | null;
}

export interface JudgeMetadata {
  judgeModel: string;
  criteriaScores: Record<string, number>;
  criterionBreakdown: Array<{
    name: string;
    score: number;
    maxScore: number;
    weight: number;
    description: string;
  }>;
  judgeReasoning: string;
  judgeConfidence: number;
  judgeTokens: { prompt: number; completion: number; total: number };
  judgeLatencyMs: number;
  positionSwap?: {
    originalScores: Record<string, number>;
    swappedScores: Record<string, number>;
    averagedScores: Record<string, number>;
    originalOverall: number;
    swappedOverall: number;
    delta: number;
    isConsistent: boolean;
    consistencyThreshold: number;
  };
  verbosityMetadata?: {
    responseLength: number;
    goldenAnswerLength: number;
    lengthRatio: number;
  };
}

export interface ChecklistMetadata {
  itemResults: Array<{
    id: string;
    description: string;
    matched: boolean;
    weight: number;
  }>;
  itemsMatched: number;
  itemsTotal: number;
}
