import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { leaderboardRepository } from "@/lib/leaderboard";
import { validateScoreUpdate } from "@/lib/leaderboard/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const validation = validateScoreUpdate(await request.json().catch(() => null));
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const team = await leaderboardRepository.updateScore(validation.data);
    return NextResponse.json({ team, message: "Score updated." });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update score." },
      { status: 400 },
    );
  }
}
