export type VendorFamily =
  "anthropic" | "google" | "openai" | "meta" | "unknown";

/**
 * Module-level alias-to-vendor map, populated by initVendorMap().
 * Empty until explicitly initialized -- ensures backward compatibility.
 */
const vendorMap = new Map<string, VendorFamily>();

/**
 * Pattern-based vendor detection from a model ID string.
 * This is the original logic, now extracted for reuse by initVendorMap().
 */
function detectVendorByPattern(modelId: string): VendorFamily {
  const id = modelId.toLowerCase();

  if (id.includes("claude")) return "anthropic";
  if (id.includes("gemini") || id.includes("palm") || id.includes("bard"))
    return "google";
  if (id.includes("gpt") || id.startsWith("o1") || id.startsWith("o3"))
    return "openai";
  if (id.includes("llama")) return "meta";

  return "unknown";
}

/**
 * Map a model ID to its vendor family.
 * First checks the alias-based vendor map (if initialized), then falls back
 * to pattern-based detection from naming conventions.
 */
export function getVendorFamily(modelId: string): VendorFamily {
  // Check vendor map first (case-insensitive)
  const mapped = vendorMap.get(modelId.toLowerCase());
  if (mapped) return mapped;

  return detectVendorByPattern(modelId);
}

/**
 * Initialize the vendor map from a LiteLLM alias-to-actual-model mapping.
 * For each alias, runs pattern detection against the ACTUAL model ID
 * and stores the result so getVendorFamily() can resolve aliases.
 */
export function initVendorMap(aliasToModel: Map<string, string>): void {
  vendorMap.clear();

  for (const [alias, actualModel] of aliasToModel) {
    const vendor = detectVendorByPattern(actualModel);
    if (vendor !== "unknown") {
      vendorMap.set(alias.toLowerCase(), vendor);
    }
  }
}

/**
 * Check whether the vendor map has been populated.
 * Useful for diagnostics and tests.
 */
export function isVendorMapInitialized(): boolean {
  return vendorMap.size > 0;
}

/**
 * Judge model preference order -- higher quality models first.
 * These are partial matches (model ID must include the string).
 */
const PREFERRED_JUDGES = [
  "gemini-3.1-pro-nocache",
  "opus-nocache",
  "sonnet-nocache",
  "gemini-3-pro",
  "gemini-2.5-pro",
  "claude-opus-4",
  "claude-sonnet-4",
];

/**
 * Select a cross-vendor judge model for the given tested model.
 * Throws if no cross-vendor judge is available (prevents self-judging bias).
 *
 * When vendorMap is provided, it is consulted first for vendor resolution,
 * falling back to pattern-based getVendorFamily(). This allows aliases like
 * "sonnet" or "flash" to resolve correctly without module-level init.
 */
export function selectJudgeModel(
  testedModelId: string,
  availableModels: string[],
  externalVendorMap?: Map<string, VendorFamily>,
): string {
  const getVendor = (id: string): VendorFamily =>
    externalVendorMap?.get(id.toLowerCase()) ?? getVendorFamily(id);

  const testedVendor = getVendor(testedModelId);

  // Filter to different vendors, exclude unknown
  const crossVendorModels = availableModels.filter((m) => {
    const vendor = getVendor(m);
    return vendor !== testedVendor && vendor !== "unknown";
  });

  if (crossVendorModels.length === 0) {
    throw new Error(
      `No cross-vendor judge available for ${testedModelId} (vendor: ${testedVendor})`,
    );
  }

  // Prefer high-quality judges
  for (const preferred of PREFERRED_JUDGES) {
    const match = crossVendorModels.find((m) => m.includes(preferred));
    if (match) return match;
  }

  // Fallback to first available cross-vendor model
  return crossVendorModels[0]!;
}
