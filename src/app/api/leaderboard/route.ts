import { NextResponse } from "next/server";
import { getLiveLeaderboard } from "@/lib/leaderboard/live";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const response = await getLiveLeaderboard();

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
