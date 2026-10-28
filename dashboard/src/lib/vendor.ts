export const VENDOR_COLORS: Record<string, string> = {
  anthropic: "#3b82f6",
  google: "#22c55e",
  openai: "#a855f7",
  meta: "#f97316",
  unknown: "#6b7280",
};

export function getVendor(model: string): string {
  const lower = model.toLowerCase();
  if (lower.includes("claude") || lower.includes("anthropic"))
    return "anthropic";
  if (lower.includes("gemini") || lower.includes("palm")) return "google";
  if (lower.includes("gpt") || lower.includes("o1") || lower.includes("o3"))
    return "openai";
  if (lower.includes("llama")) return "meta";
  return "unknown";
}

export function getModelColor(model: string): string {
  return VENDOR_COLORS[getVendor(model)] ?? VENDOR_COLORS.unknown;
}

const MODEL_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#a855f7",
  "#f97316",
  "#ef4444",
  "#14b8a6",
  "#eab308",
  "#ec4899",
  "#6366f1",
  "#84cc16",
];

export function getIndexColor(index: number): string {
  return MODEL_COLORS[index % MODEL_COLORS.length];
}
