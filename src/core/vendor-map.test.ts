import { describe, test, expect } from "bun:test";
import { getVendorFamily, selectJudgeModel } from "./vendor-map";

describe("getVendorFamily", () => {
  test("returns 'anthropic' for claude models", () => {
    expect(getVendorFamily("claude-opus-4")).toBe("anthropic");
    expect(getVendorFamily("claude-sonnet-4-5")).toBe("anthropic");
    expect(getVendorFamily("claude-3-haiku")).toBe("anthropic");
  });

  test("returns 'google' for gemini models", () => {
    expect(getVendorFamily("gemini-2.0-flash")).toBe("google");
    expect(getVendorFamily("gemini-1.5-pro")).toBe("google");
    expect(getVendorFamily("gemini-pro")).toBe("google");
  });

  test("returns 'openai' for gpt/o1/o3 models", () => {
    expect(getVendorFamily("gpt-4o")).toBe("openai");
    expect(getVendorFamily("gpt-4-turbo")).toBe("openai");
    expect(getVendorFamily("o1-preview")).toBe("openai");
    expect(getVendorFamily("o3-mini")).toBe("openai");
  });

  test("returns 'meta' for llama models", () => {
    expect(getVendorFamily("llama-3.1-70b")).toBe("meta");
    expect(getVendorFamily("llama-2-13b")).toBe("meta");
  });

  test("returns 'unknown' for unrecognized model IDs", () => {
    expect(getVendorFamily("mistral-7b")).toBe("unknown");
    expect(getVendorFamily("some-random-model")).toBe("unknown");
  });

  test("handles -nocache suffix variants", () => {
    expect(getVendorFamily("claude-opus-4-nocache")).toBe("anthropic");
    expect(getVendorFamily("gemini-pro-nocache")).toBe("google");
    expect(getVendorFamily("gpt-4o-nocache")).toBe("openai");
  });
});

describe("selectJudgeModel", () => {
  const allModels = [
    "claude-opus-4",
    "claude-sonnet-4-5",
    "gemini-2.0-pro",
    "gemini-1.5-pro",
    "gpt-4-turbo",
    "gpt-4o",
  ];

  test("never returns same vendor as tested model", () => {
    const judge = selectJudgeModel("claude-opus-4", allModels);
    expect(getVendorFamily(judge)).not.toBe("anthropic");
  });

  test("never returns same vendor for gemini model", () => {
    const judge = selectJudgeModel("gemini-2.0-flash", allModels);
    expect(getVendorFamily(judge)).not.toBe("google");
  });

  test("prefers high-quality judges (opus first for non-anthropic)", () => {
    const judge = selectJudgeModel("gemini-2.0-flash", allModels);
    expect(judge).toBe("claude-opus-4");
  });

  test("prefers gemini-2.0-pro for anthropic models", () => {
    const judge = selectJudgeModel("claude-opus-4", allModels);
    expect(judge).toBe("gemini-2.0-pro");
  });

  test("throws if no cross-vendor judge available", () => {
    const onlyAnthropicModels = ["claude-opus-4", "claude-sonnet-4-5"];
    expect(() =>
      selectJudgeModel("claude-opus-4", onlyAnthropicModels),
    ).toThrow(/no cross-vendor judge/i);
  });

  test("handles -nocache suffix variants correctly", () => {
    const modelsWithNocache = [
      "claude-opus-4-nocache",
      "gemini-2.0-pro-nocache",
    ];
    const judge = selectJudgeModel("claude-opus-4-nocache", modelsWithNocache);
    expect(getVendorFamily(judge)).not.toBe("anthropic");
  });

  test("returns first available cross-vendor model when no preferred match", () => {
    const obscureModels = ["llama-3.1-70b", "claude-opus-4"];
    const judge = selectJudgeModel("llama-3.1-70b", obscureModels);
    expect(judge).toBe("claude-opus-4");
  });

  test("excludes unknown vendor models from judge pool", () => {
    const mixedModels = ["mistral-7b", "claude-opus-4"];
    // Testing a mistral model -- unknown vendor, so claude should be selected
    const judge = selectJudgeModel("mistral-7b", mixedModels);
    expect(judge).toBe("claude-opus-4");
  });
});
