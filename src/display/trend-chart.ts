/**
 * ASCII trend chart renderer for multi-model performance over time.
 * Uses simple-ascii-chart for line chart rendering.
 */

import plot from "simple-ascii-chart";

export interface TrendSeries {
  model: string;
  points: Array<{ runIndex: number; score: number }>;
}

export interface TrendChartOptions {
  width?: number; // default: min(process.stdout.columns - 10, 80)
  height?: number; // default: 20
  title?: string;
}

/**
 * Render a multi-series ASCII line chart showing model scores over time.
 *
 * Each series is a model with (runIndex, score) pairs.
 * X-axis = run number, Y-axis = score 0-100%.
 *
 * @param series - Array of model trend series
 * @param options - Chart dimensions and title
 * @returns Rendered ASCII chart string
 */
export function renderTrendChart(
  series: TrendSeries[],
  options?: TrendChartOptions,
): string {
  if (series.length === 0) {
    return "No data to chart.";
  }

  const termWidth = process.stdout.columns || 80;
  const width = options?.width ?? Math.min(termWidth - 10, 80);
  const height = options?.height ?? 20;
  const title = options?.title;

  try {
    // Convert each series to [x, y][] coordinate pairs
    const chartData: Array<Array<[number, number]>> = [];
    const labels: string[] = [];

    for (const s of series) {
      if (s.points.length === 0) continue;

      let coords: Array<[number, number]> = s.points.map((p) => [
        p.runIndex,
        Math.round(p.score * 100),
      ]);

      // plot needs at least 2 points -- duplicate single point
      if (coords.length === 1) {
        const single = coords[0]!;
        coords = [single, single];
      }

      chartData.push(coords);
      labels.push(s.model.length > 30 ? s.model.slice(0, 27) + "..." : s.model);
    }

    if (chartData.length === 0) {
      return "No data to chart.";
    }

    const chartOptions: Record<string, unknown> = {
      width,
      height,
      yRange: [0, 100],
    };

    if (title) {
      chartOptions.title = title;
    }

    if (labels.length > 1) {
      chartOptions.legend = { position: "bottom", series: labels };
    }

    return plot(chartData, chartOptions);
  } catch {
    // Fallback: simple text table if chart library fails
    const lines: string[] = ["Score Trend (chart rendering failed):"];
    for (const s of series) {
      const scores = s.points
        .map((p) => `Run ${p.runIndex}: ${Math.round(p.score * 100)}%`)
        .join(", ");
      lines.push(`  ${s.model}: ${scores}`);
    }
    return lines.join("\n");
  }
}
