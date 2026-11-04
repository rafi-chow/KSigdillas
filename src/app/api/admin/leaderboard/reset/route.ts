import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { leaderboardRepository } from "@/lib/leaderboard";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Reset is disabled in production." }, { status: 403 });
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const teams = await leaderboardRepository.resetDemoData();
  return NextResponse.json({ teams, message: "Demo leaderboard restored." });
}
