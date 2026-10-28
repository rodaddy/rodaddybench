"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Summary } from "@/lib/types";
import { formatScore, formatCost, formatLatency } from "@/lib/format";
import { getModelColor } from "@/lib/vendor";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

interface LeaderboardTableProps {
  summaries: Summary[];
  categories: string[];
  defaultSort?: string;
}

type SortKey = "overall" | "cost" | "latency" | string;

export function LeaderboardTable({
  summaries,
  categories,
  defaultSort = "overall",
}: LeaderboardTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>(defaultSort);
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    setSortKey(defaultSort);
    setSortAsc(false);
  }, [defaultSort]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const sorted = [...summaries].sort((a, b) => {
    let aVal: number, bVal: number;
    if (sortKey === "overall") {
      aVal = a.overallScore;
      bVal = b.overallScore;
    } else if (sortKey === "cost") {
      aVal = a.totalCostUsd;
      bVal = b.totalCostUsd;
    } else if (sortKey === "latency") {
      aVal = a.avgLatencyMs;
      bVal = b.avgLatencyMs;
    } else {
      aVal = a.categoryScores[sortKey] ?? 0;
      bVal = b.categoryScores[sortKey] ?? 0;
    }
    return sortAsc ? aVal - bVal : bVal - aVal;
  });

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return "";
    return sortAsc ? " +" : " -";
  };

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-zinc-800">
          <TableHead className="w-12 text-zinc-400">#</TableHead>
          <TableHead className="text-zinc-400">Model</TableHead>
          <TableHead
            className="cursor-pointer text-zinc-400 hover:text-white"
            onClick={() => handleSort("overall")}
          >
            Overall{sortIndicator("overall")}
          </TableHead>
          {categories.map((cat) => (
            <TableHead
              key={cat}
              className="cursor-pointer text-zinc-400 hover:text-white"
              onClick={() => handleSort(cat)}
            >
              {cat}
              {sortIndicator(cat)}
            </TableHead>
          ))}
          <TableHead
            className="cursor-pointer text-zinc-400 hover:text-white"
            onClick={() => handleSort("cost")}
          >
            Cost{sortIndicator("cost")}
          </TableHead>
          <TableHead
            className="cursor-pointer text-zinc-400 hover:text-white"
            onClick={() => handleSort("latency")}
          >
            Latency{sortIndicator("latency")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((s, i) => (
          <TableRow key={s.model} className="border-zinc-800">
            <TableCell className="text-zinc-500">{i + 1}</TableCell>
            <TableCell>
              <Link
                href={`/models/${encodeURIComponent(s.model)}`}
                className="font-medium text-white hover:text-blue-400"
              >
                <span
                  className="inline-block w-2 h-2 rounded-full mr-2"
                  style={{ backgroundColor: getModelColor(s.model) }}
                />
                {s.model}
              </Link>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <div className="w-20 h-2 rounded-full bg-zinc-800">
                  <div
                    className="h-2 rounded-full bg-blue-500"
                    style={{ width: `${s.overallScore * 100}%` }}
                  />
                </div>
                <span
                  className={
                    i === 0 ? "text-blue-400 font-semibold" : "text-zinc-300"
                  }
                >
                  {formatScore(s.overallScore)}
                </span>
              </div>
            </TableCell>
            {categories.map((cat) => (
              <TableCell key={cat} className="text-zinc-300">
                {s.categoryScores[cat] !== undefined
                  ? formatScore(s.categoryScores[cat])
                  : "-"}
              </TableCell>
            ))}
            <TableCell className="text-zinc-400">
              {formatCost(s.totalCostUsd)}
            </TableCell>
            <TableCell className="text-zinc-400">
              {formatLatency(s.avgLatencyMs)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
