import type { Metadata } from "next";
import { PublicLeaderboard } from "@/components/PublicLeaderboard";
import { eventConfig } from "@/lib/eventConfig";
import { leaderboardRepository } from "@/lib/leaderboard";
import type { LeaderboardResponse } from "@/types/leaderboard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Live Leaderboard | KSigdillas",
  description: "Follow the live KSigdillas chapter competition standings.",
};

export default async function LeaderboardPage() {
  const teams = await leaderboardRepository.getTeams();
  const initialData: LeaderboardResponse = {
    teams,
    lastUpdated:
      teams.map((team) => team.lastUpdated).sort().at(-1) ??
      new Date().toISOString(),
    storageMode: "json",
  };

  return (
    <PublicLeaderboard
      initialData={initialData}
      ticketUrl={eventConfig.ticketUrl}
    />
  );
}
