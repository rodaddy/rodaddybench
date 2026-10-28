/**
 * Benchmark configuration loader.
 * Reads benchmark.config.json from project root; falls back to defaults.
 */

export interface BenchmarkConfig {
  excludeModels: string[];
}

export const DEFAULT_CONFIG: BenchmarkConfig = {
  excludeModels: [
    "quality",
    "main",
    "fast",
    "image",
    "embeddings",
    "fallback",
    "text-embedding-004",
  ],
};

/**
 * Load benchmark configuration from benchmark.config.json at project root.
 * Falls back to DEFAULT_CONFIG if file is missing or unparseable.
 */
export async function loadConfig(): Promise<BenchmarkConfig> {
  try {
    const file = Bun.file("benchmark.config.json");
    const exists = await file.exists();
    if (!exists) {
      return { ...DEFAULT_CONFIG };
    }
    const parsed = (await file.json()) as Partial<BenchmarkConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
    };
  } catch (err) {
    console.error(
      `[warn] Failed to parse benchmark.config.json, using defaults: ${err instanceof Error ? err.message : String(err)}`,
    );
    return { ...DEFAULT_CONFIG };
  }
}
