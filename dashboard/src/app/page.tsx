export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getLatestRunId } from "@/lib/queries";

export default function Home() {
  const latestRunId = getLatestRunId();
  if (latestRunId) {
    redirect(`/runs/${latestRunId}`);
  }
  redirect("/leaderboard");
}
