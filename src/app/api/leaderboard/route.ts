import { NextResponse } from "next/server";
import { getLiveLeaderboard } from "@/lib/leaderboard/live";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const response = await getLiveLeaderboard();

    return NextResponse.json(response, {
      // Only standings()'s allowlisted public aggregates enter this cache.
      // Visible clients poll every 30s; CDN freshness is at most another 15s.
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=15, must-revalidate",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Leaderboard data is temporarily unavailable." },
      { status: 500 },
    );
  }
}
