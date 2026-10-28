/**
 * Nocache model variant parsing and pairing.
 *
 * LiteLLM proxy exposes "-nocache" variants that bypass the cache layer.
 * These functions identify and pair cached/nocache models for comparison.
 */

export interface ModelVariant {
  baseName: string;
  isNocache: boolean;
}

export interface ModelPair {
  baseName: string;
  cached: string;
  nocache: string;
}

/**
 * Parse a model ID into base name and nocache flag.
 * Convention: models ending in "-nocache" are cache-bypass variants.
 */
export function parseModelVariant(modelId: string): ModelVariant {
  const suffix = "-nocache";
  if (modelId.endsWith(suffix) && modelId.length > suffix.length) {
    return {
      baseName: modelId.slice(0, -suffix.length),
      isNocache: true,
    };
  }
  return {
    baseName: modelId,
    isNocache: false,
  };
}

/**
 * Group model IDs into paired cached/nocache variants.
 * Only returns pairs where BOTH the base model and its -nocache variant exist.
 * Unpaired models are excluded.
 */
export function pairModelVariants(modelIds: string[]): ModelPair[] {
  const variants = modelIds.map((id) => ({ id, ...parseModelVariant(id) }));
  const idSet = new Set(modelIds);

  const pairs: ModelPair[] = [];
  const seen = new Set<string>();

  for (const v of variants) {
    if (seen.has(v.baseName)) continue;

    const cachedId = v.baseName;
    const nocacheId = `${v.baseName}-nocache`;

    if (idSet.has(cachedId) && idSet.has(nocacheId)) {
      pairs.push({
        baseName: v.baseName,
        cached: cachedId,
        nocache: nocacheId,
      });
      seen.add(v.baseName);
    }
  }

  return pairs.sort((a, b) => a.baseName.localeCompare(b.baseName));
}
