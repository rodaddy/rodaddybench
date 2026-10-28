import { formatScore, formatCost } from "@/lib/format";
import { getModelColor } from "@/lib/vendor";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

interface QualityPerDollarTableProps {
  data: Array<{
    model: string;
    score: number;
    cost: number;
    qualityPerDollar: number | null;
  }>;
}

export function QualityPerDollarTable({ data }: QualityPerDollarTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-zinc-800">
          <TableHead className="w-12 text-zinc-400">#</TableHead>
          <TableHead className="text-zinc-400">Model</TableHead>
          <TableHead className="text-zinc-400">Score</TableHead>
          <TableHead className="text-zinc-400">Cost</TableHead>
          <TableHead className="text-zinc-400">Quality / Dollar</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((d, i) => (
          <TableRow key={d.model} className="border-zinc-800">
            <TableCell className="text-zinc-500">{i + 1}</TableCell>
            <TableCell>
              <span className="flex items-center gap-2 text-white">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: getModelColor(d.model) }}
                />
                {d.model}
              </span>
            </TableCell>
            <TableCell className="text-zinc-300">
              {formatScore(d.score)}
            </TableCell>
            <TableCell className="text-zinc-400">
              {formatCost(d.cost)}
            </TableCell>
            <TableCell
              className={
                i === 0 ? "text-green-400 font-semibold" : "text-zinc-300"
              }
            >
              {d.qualityPerDollar !== null
                ? d.qualityPerDollar.toFixed(1)
                : "-"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
