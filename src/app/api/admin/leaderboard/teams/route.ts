import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { leaderboardRepository } from "@/lib/leaderboard";
import { validateTeamInput } from "@/lib/leaderboard/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const validation = validateTeamInput(await request.json().catch(() => null));
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const team = await leaderboardRepository.createTeam(validation.data);
  return NextResponse.json(
    { team, message: "Team created." },
    { status: 201 },
  );
}

export async function PATCH(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const validation = validateTeamInput(body);

  if (!id) {
    return NextResponse.json({ error: "Team ID is required." }, { status: 400 });
  }
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const team = await leaderboardRepository.updateTeam(id, validation.data);
    return NextResponse.json({ team, message: "Team details saved." });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save team." },
      { status: 400 },
    );
  }
}
