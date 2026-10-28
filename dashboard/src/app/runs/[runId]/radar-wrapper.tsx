"use client";

import { RadarChart } from "@/components/charts/radar-chart";

interface RunRadarChartProps {
  models: Array<{
    model: string;
    data: Array<{ category: string; score: number }>;
  }>;
}

export function RunRadarChart({ models }: RunRadarChartProps) {
  return <RadarChart data={[]} models={models} />;
}
