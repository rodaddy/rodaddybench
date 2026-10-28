"use client";

import { useState } from "react";
import type { Result } from "@/lib/types";
import { formatScore, formatCost, formatLatency } from "@/lib/format";
import { ResponseViewer } from "./response-viewer";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight } from "lucide-react";

interface RunResultsTableProps {
  results: Result[];
}

export function RunResultsTable({ results }: RunResultsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggle = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Group by model
  const byModel = new Map<string, Result[]>();
  for (const r of results) {
    const existing = byModel.get(r.model) ?? [];
    existing.push(r);
    byModel.set(r.model, existing);
  }

  return (
    <div className="space-y-6">
      {Array.from(byModel.entries()).map(([model, modelResults]) => (
        <div key={model}>
          <h3 className="mb-2 text-sm font-semibold text-zinc-300">{model}</h3>
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800">
                <TableHead className="w-8 text-zinc-400" />
                <TableHead className="text-zinc-400">Test Case</TableHead>
                <TableHead className="text-zinc-400">Category</TableHead>
                <TableHead className="text-zinc-400">Score</TableHead>
                <TableHead className="text-zinc-400">Latency</TableHead>
                <TableHead className="text-zinc-400">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modelResults.map((r) => {
                const expanded = expandedRows.has(r.id);
                return (
                  <TableRow key={r.id} className="border-zinc-800">
                    <TableCell colSpan={6} className="p-0">
                      <div>
                        <button
                          onClick={() => toggle(r.id)}
                          className="flex w-full items-center gap-0 px-2 py-2 text-left hover:bg-zinc-900"
                        >
                          <span className="w-8 flex-shrink-0">
                            {expanded ? (
                              <ChevronDown className="h-4 w-4 text-zinc-500" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-zinc-500" />
                            )}
                          </span>
                          <span className="flex-1 text-sm text-zinc-300">
                            {r.testCase}
                          </span>
                          <span className="w-28 text-sm text-zinc-400">
                            {r.category}
                          </span>
                          <span className="w-20 text-sm text-zinc-300">
                            {formatScore(r.score)}
                          </span>
                          <span className="w-20 text-sm text-zinc-400">
                            {formatLatency(r.latencyMs)}
                          </span>
                          <span className="w-20 text-sm text-zinc-400">
                            {formatCost(r.costUsd)}
                          </span>
                        </button>
                        {expanded && (
                          <div className="border-t border-zinc-800 bg-zinc-950">
                            <ResponseViewer result={r} />
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  );
}
