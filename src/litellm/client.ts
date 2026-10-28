import OpenAI from "openai";

export type ModelInfo = {
  id: string;
  created: number;
};

export type ModelInfoEntry = {
  model_name: string;
  litellm_params: { model: string };
  [key: string]: unknown;
};

export type ModelInfoResponse = {
  data: ModelInfoEntry[];
};

export interface ClientOptions {
  baseURL?: string;
  apiKey?: string;
}

/**
 * Create an OpenAI SDK client configured for the LiteLLM proxy.
 *
 * Defaults:
 *   baseURL  -> LITELLM_BASE_URL env var or http://localhost:4000/v1
 *   apiKey   -> LITELLM_API_KEY env var (throws if missing)
 *   timeout  -> 120s, maxRetries -> 2
 */
export function createClient(options?: ClientOptions): OpenAI {
  const baseURL =
    options?.baseURL ??
    process.env.LITELLM_BASE_URL ??
    "http://localhost:4000/v1";

  const apiKey = options?.apiKey ?? process.env.LITELLM_API_KEY;

  if (!apiKey) {
    throw new Error(
      "LITELLM_API_KEY is required. Set it as an environment variable or pass it via options.apiKey.",
    );
  }

  return new OpenAI({
    baseURL,
    apiKey,
    timeout: 120_000,
    maxRetries: 2,
  });
}

/**
 * Discover all available model IDs from the LiteLLM proxy.
 * Returns a sorted array of model ID strings.
 */
export async function discoverModels(client: OpenAI): Promise<string[]> {
  const response = await client.models.list();
  const models: string[] = [];

  for await (const model of response) {
    models.push(model.id);
  }

  return models.sort();
}

/**
 * Discover models with additional metadata (id + created timestamp).
 * Useful for filtering by model age or debugging.
 */
export async function discoverModelsDetailed(
  client: OpenAI,
): Promise<ModelInfo[]> {
  const response = await client.models.list();
  const models: ModelInfo[] = [];

  for await (const model of response) {
    models.push({ id: model.id, created: model.created });
  }

  return models.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Query the LiteLLM /model/info endpoint to build an alias-to-actual-model map.
 * Returns a Map where key = model_name (alias) and value = litellm_params.model (actual model ID).
 * Gracefully returns an empty Map on failure (no throw).
 */
export async function fetchModelInfo(
  client: OpenAI,
): Promise<Map<string, string>> {
  const aliasMap = new Map<string, string>();

  try {
    // Derive base URL, stripping trailing /v1 if present
    let baseURL = client.baseURL;
    if (baseURL.endsWith("/v1")) {
      baseURL = baseURL.slice(0, -3);
    }

    const response = await fetch(`${baseURL}/model/info`, {
      headers: {
        Authorization: `Bearer ${client.apiKey}`,
      },
    });

    if (!response.ok) {
      console.warn(
        `[fetchModelInfo] /model/info returned ${response.status}: ${response.statusText}`,
      );
      return aliasMap;
    }

    const data = (await response.json()) as ModelInfoResponse;

    for (const entry of data.data) {
      if (entry.model_name && entry.litellm_params?.model) {
        aliasMap.set(entry.model_name, entry.litellm_params.model);
      }
    }
  } catch (err) {
    console.warn(
      `[fetchModelInfo] Failed to query /model/info:`,
      err instanceof Error ? err.message : err,
    );
  }

  return aliasMap;
}
