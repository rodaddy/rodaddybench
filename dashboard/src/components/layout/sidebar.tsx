"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  History,
  Trophy,
  GitCompare,
  DollarSign,
} from "lucide-react";

const navItems = [
  { href: "/runs", label: "Runs", icon: History },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/compare", label: "Compare", icon: GitCompare },
  { href: "/costs", label: "Costs", icon: DollarSign },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 border-r border-zinc-800 bg-zinc-950 p-6">
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-blue-500" />
          <h1 className="text-xl font-bold text-white">RodaddyBench</h1>
        </div>
        <p className="mt-1 text-sm text-zinc-500">AI Model Benchmarking</p>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-500/10 text-blue-400"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
