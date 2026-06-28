import type { Metadata } from "next";
import { PublicLeaderboard } from "@/components/PublicLeaderboard";
import { eventConfig } from "@/lib/eventConfig";
import { getLiveLeaderboard } from "@/lib/leaderboard/live";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Live Leaderboard | KSigdillas",
  description: "Follow the live KSigdillas chapter competition standings.",
};

export default async function LeaderboardPage() {
  const initialData = await getLiveLeaderboard();

  return (
    <PublicLeaderboard
      initialData={initialData}
      ticketUrl={eventConfig.ticketUrl}
    />
  );
}
