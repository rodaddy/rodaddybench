import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string | number;
  detail?: string;
}

export function StatCard({ label, value, detail }: StatCardProps) {
  return (
    <Card className="border-zinc-800 bg-zinc-950">
      <CardContent className="pt-0">
        <p className="text-sm text-zinc-400">{label}</p>
        <p className="mt-1 text-2xl font-bold text-white">{value}</p>
        {detail && <p className="mt-1 text-xs text-zinc-500">{detail}</p>}
      </CardContent>
    </Card>
  );
}
