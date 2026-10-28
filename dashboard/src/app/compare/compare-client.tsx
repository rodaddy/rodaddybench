"use client";

import { useState } from "react";
import type { Summary } from "@/lib/types";
import { formatScore, shortRunId } from "@/lib/format";
import { getModelColor } from "@/lib/vendor";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

interface CompareClientProps {
  runIds: Array<{ runId: string; timestamp: string }>;
  summariesByRun: Record<string, Summary[]>;
  categories: string[];
}

const DELTA_THRESHOLD = 0.05;

function RunSelector({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ runId: string; timestamp: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-zinc-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.runId} value={o.runId}>
            {shortRunId(o.runId)} - {new Date(o.timestamp).toLocaleDateString()}
          </option>
        ))}
      </select>
    </div>
  );
}

function DeltaCell({ delta }: { delta: number }) {
  const abs = Math.abs(delta);
  const display = `${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(1)}%`;

  if (abs < DELTA_THRESHOLD) {
    return <span className="text-zinc-500">{display}</span>;
  }
  return (
    <span
      className={
        delta > 0 ? "text-green-400 font-medium" : "text-red-400 font-medium"
      }
    >
      {display}
    </span>
  );
}

export function CompareClient({
  runIds,
  summariesByRun,
  categories,
}: CompareClientProps) {
  const [runA, setRunA] = useState(runIds[1]?.runId ?? runIds[0].runId);
  const [runB, setRunB] = useState(runIds[0].runId);

  const summariesA = summariesByRun[runA] ?? [];
  const summariesB = summariesByRun[runB] ?? [];

  // Build lookup by model for run B
  const bByModel = new Map<string, Summary>();
  for (const s of summariesB) bByModel.set(s.model, s);

  // All models from both runs
  const allModels = new Set<string>();
  for (const s of summariesA) allModels.add(s.model);
  for (const s of summariesB) allModels.add(s.model);

  const aByModel = new Map<string, Summary>();
  for (const s of summariesA) aByModel.set(s.model, s);

  const modelList = Array.from(allModels).sort();

  return (
    <div className="space-y-6">
      {/* Run selectors */}
      <div className="flex gap-6 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
        <RunSelector
          label="Run A (base):"
          value={runA}
          options={runIds}
          onChange={setRunA}
        />
        <RunSelector
          label="Run B (compare):"
          value={runB}
          options={runIds}
          onChange={setRunB}
        />
      </div>

      {runA === runB ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center text-zinc-500">
          Select two different runs to compare.
        </div>
      ) : (
        <>
          {/* Overall comparison */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">
              Overall Score Comparison
            </h2>
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800">
                  <TableHead className="text-zinc-400">Model</TableHead>
                  <TableHead className="text-zinc-400">
                    Run A ({shortRunId(runA)})
                  </TableHead>
                  <TableHead className="text-zinc-400">
                    Run B ({shortRunId(runB)})
                  </TableHead>
                  <TableHead className="text-zinc-400">Delta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modelList.map((model) => {
                  const a = aByModel.get(model);
                  const b = bByModel.get(model);
                  const scoreA = a?.overallScore ?? null;
                  const scoreB = b?.overallScore ?? null;
                  const delta =
                    scoreA !== null && scoreB !== null ? scoreB - scoreA : null;

                  return (
                    <TableRow key={model} className="border-zinc-800">
                      <TableCell>
                        <span className="flex items-center gap-2 text-white">
                          <span
                            className="inline-block w-2 h-2 rounded-full"
                            style={{ backgroundColor: getModelColor(model) }}
                          />
                          {model}
                        </span>
                      </TableCell>
                      <TableCell className="text-zinc-300">
                        {scoreA !== null ? formatScore(scoreA) : "-"}
                      </TableCell>
                      <TableCell className="text-zinc-300">
                        {scoreB !== null ? formatScore(scoreB) : "-"}
                      </TableCell>
                      <TableCell>
                        {delta !== null ? (
                          <DeltaCell delta={delta} />
                        ) : (
                          <span className="text-zinc-500">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Category breakdown comparison */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">
              Category Breakdown
            </h2>
            {modelList.map((model) => {
              const a = aByModel.get(model);
              const b = bByModel.get(model);
              if (!a && !b) return null;

              return (
                <div key={model} className="mb-6 last:mb-0">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-300">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: getModelColor(model) }}
                    />
                    {model}
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-800">
                        <TableHead className="text-zinc-400">
                          Category
                        </TableHead>
                        <TableHead className="text-zinc-400">Run A</TableHead>
                        <TableHead className="text-zinc-400">Run B</TableHead>
                        <TableHead className="text-zinc-400">Delta</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories.map((cat) => {
                        const scoreA = a?.categoryScores[cat] ?? null;
                        const scoreB = b?.categoryScores[cat] ?? null;
                        const delta =
                          scoreA !== null && scoreB !== null
                            ? scoreB - scoreA
                            : null;

                        return (
                          <TableRow key={cat} className="border-zinc-800">
                            <TableCell className="text-zinc-300">
                              {cat}
                            </TableCell>
                            <TableCell className="text-zinc-300">
                              {scoreA !== null ? formatScore(scoreA) : "-"}
                            </TableCell>
                            <TableCell className="text-zinc-300">
                              {scoreB !== null ? formatScore(scoreB) : "-"}
                            </TableCell>
                            <TableCell>
                              {delta !== null ? (
                                <DeltaCell delta={delta} />
                              ) : (
                                <span className="text-zinc-500">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
