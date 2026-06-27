import { NextResponse } from "next/server";
import { leaderboardRepository } from "@/lib/leaderboard";
import type { LeaderboardResponse } from "@/types/leaderboard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const teams = await leaderboardRepository.getTeams();
    const lastUpdated =
      teams
        .map((team) => team.lastUpdated)
        .sort()
        .at(-1) ?? new Date().toISOString();

    const response: LeaderboardResponse = {
      teams,
      lastUpdated,
      storageMode: "json",
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json(
      { error: "Leaderboard data is temporarily unavailable." },
      { status: 500 },
    );
  }
}
