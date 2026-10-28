import { aggregateResults, type ModelSummary } from "./table.ts";
import type { BenchmarkResult } from "../core/types.ts";
import { RUBRICS } from "../scoring/rubrics.ts";
import { mkdirSync, writeFileSync } from "node:fs";

/**
 * Generate a full markdown benchmark report from raw results.
 * Returns markdown string with 4 sections: Summary, Scores by Category,
 * Performance Metrics, and Scoring Rubrics.
 */
export function generateMarkdownReport(results: BenchmarkResult[]): string {
  const summaries = aggregateResults(results);
  const allCategories = collectCategories(summaries);
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);

  const sections = [
    generateHeader(timestamp),
    generateSummarySection(summaries, results, timestamp),
    generateScoresByCategory(summaries, allCategories),
    generatePerformanceMetrics(summaries),
    generateCostEfficiency(summaries),
    generateScoringRubrics(allCategories),
  ];

  return sections.join("\n\n");
}

/**
 * Write markdown report to .reports/benchmark.md (overwrites, no dates).
 */
export function saveMarkdownReport(markdown: string): void {
  const dir = ".reports";
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/benchmark.md`, markdown, "utf-8");
  console.log("Report saved to .reports/benchmark.md");
}

// -- Internal helpers --

function collectCategories(summaries: ModelSummary[]): string[] {
  const cats = new Set<string>();
  for (const s of summaries) {
    for (const cat of Object.keys(s.categoryScores)) {
      cats.add(cat);
    }
  }
  return [...cats].sort();
}

function pct(score: number): string {
  return `${Math.round(score * 100)}%`;
}

function generateHeader(timestamp: string): string {
  return `# RodaddyBench Report

> Generated: ${timestamp} UTC`;
}

function generateSummarySection(
  summaries: ModelSummary[],
  results: BenchmarkResult[],
  _timestamp: string,
): string {
  const totalTests = results.length;
  const totalModels = summaries.length;
  const totalErrors = results.filter((r) => r.error).length;
  const top3 = summaries.slice(0, 3);

  let md = `## Summary

- **Models tested:** ${totalModels}
- **Total test cases:** ${totalTests}
- **Errors:** ${totalErrors}

### Top Performers

| Rank | Model | Overall Score |
|------|-------|---------------|`;

  for (let i = 0; i < top3.length; i++) {
    const s = top3[i]!;
    md += `\n| ${i + 1} | ${s.model} | ${pct(s.overallScore)} |`;
  }

  return md;
}

function generateScoresByCategory(
  summaries: ModelSummary[],
  categories: string[],
): string {
  const header = ["Model", ...categories, "Overall"]
    .map((h) => `**${h}**`)
    .join(" | ");
  const separator = Array(categories.length + 2)
    .fill("---")
    .join(" | ");

  let md = `## Scores by Category

| ${header} |
| ${separator} |`;

  for (const s of summaries) {
    const catScores = categories.map((cat) => {
      const score = s.categoryScores[cat];
      return score !== undefined ? pct(score) : "-";
    });
    md += `\n| ${s.model} | ${catScores.join(" | ")} | ${pct(s.overallScore)} |`;
  }

  return md;
}

function generatePerformanceMetrics(summaries: ModelSummary[]): string {
  let md = `## Performance Metrics

| **Model** | **Avg Latency** | **Total Tokens** | **Errors** |
| --- | --- | --- | --- |`;

  for (const s of summaries) {
    md += `\n| ${s.model} | ${Math.round(s.avgLatencyMs)}ms | ${s.totalTokens.toLocaleString("en-US")} | ${s.errorCount} |`;
  }

  return md;
}

function generateCostEfficiency(summaries: ModelSummary[]): string {
  const sorted = [...summaries].sort((a, b) => {
    // null (free/local models) goes to bottom
    if (a.qualityPerDollar === null && b.qualityPerDollar === null) return 0;
    if (a.qualityPerDollar === null) return 1;
    if (b.qualityPerDollar === null) return -1;
    return b.qualityPerDollar - a.qualityPerDollar;
  });

  let md = `## Cost Efficiency

| **Model** | **Total Cost** | **Avg/Request** | **Quality/$** | **Overall Score** |
| --- | --- | --- | --- | --- |`;

  for (const s of sorted) {
    const totalCost = `$${s.totalCostUsd.toFixed(4)}`;
    const avgCost = `$${s.avgCostPerRequest.toFixed(4)}`;
    const qpd =
      s.qualityPerDollar !== null
        ? `${(s.qualityPerDollar * 100).toFixed(1)} pts/$`
        : "-";
    md += `\n| ${s.model} | ${totalCost} | ${avgCost} | ${qpd} | ${pct(s.overallScore)} |`;
  }

  return md;
}

function generateScoringRubrics(categories: string[]): string {
  let md = `## Scoring Rubrics`;

  for (const cat of categories) {
    const rubric = RUBRICS[cat];
    if (!rubric) {
      md += `\n\n### ${cat}\n\n*No rubric defined (deterministic scoring)*`;
      continue;
    }

    md += `\n\n### ${cat}

**Method:** ${rubric.method}${rubric.judge ? ` - ${rubric.judge}` : ""}

| Criterion | Weight | Description |
| --- | --- | --- |`;

    for (const c of rubric.criteria) {
      md += `\n| ${c.name} | ${pct(c.weight)} | ${c.description} |`;
    }
  }

  return md;
}
