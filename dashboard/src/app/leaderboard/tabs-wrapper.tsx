"use client";

import type { Summary } from "@/lib/types";
import { LeaderboardTable } from "@/components/data/leaderboard-table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface LeaderboardTabsProps {
  summaries: Summary[];
  categories: string[];
}

export function LeaderboardTabs({
  summaries,
  categories,
}: LeaderboardTabsProps) {
  return (
    <Tabs defaultValue="overall">
      <TabsList>
        <TabsTrigger value="overall">Overall</TabsTrigger>
        {categories.map((cat) => (
          <TabsTrigger key={cat} value={cat}>
            {cat}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="overall" className="mt-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
          <LeaderboardTable summaries={summaries} categories={categories} />
        </div>
      </TabsContent>

      {categories.map((cat) => (
        <TabsContent key={cat} value={cat} className="mt-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
            <LeaderboardTable
              summaries={summaries}
              categories={categories}
              defaultSort={cat}
            />
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
