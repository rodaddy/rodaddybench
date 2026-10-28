/**
 * Unicode sparkline renderer for inline score visualization.
 * Hand-rolled using Unicode block characters -- no external dependency.
 */

const BLOCKS = "▁▂▃▄▅▆▇█";

/**
 * Render a sparkline string from an array of 0.0-1.0 scores.
 * Each score maps to a Unicode block character showing relative magnitude.
 *
 * @param scores - Array of scores in [0, 1] range
 * @returns Unicode sparkline string, or empty string for empty input
 */
export function modelSparkline(scores: number[]): string {
  if (scores.length === 0) return "";

  return scores
    .map((s) => {
      const clamped = Math.max(0, Math.min(1, s));
      // Map 0.0-1.0 to index 0-7 in BLOCKS
      const idx = Math.min(
        Math.round(clamped * (BLOCKS.length - 1)),
        BLOCKS.length - 1,
      );
      return BLOCKS[idx];
    })
    .join("");
}
