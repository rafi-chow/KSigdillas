import { NextRequest, NextResponse } from "next/server";
import {
  clearAdminSession,
  isAdminConfigured,
  isAdminRequest,
  setAdminSession,
  verifyAdminPasscode,
} from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    authenticated: isAdminRequest(request),
    configured: isAdminConfigured(),
  });
}

export async function POST(request: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "ADMIN_PASSCODE is not configured on the server." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    passcode?: unknown;
  } | null;

  if (
    !body ||
    typeof body.passcode !== "string" ||
    !verifyAdminPasscode(body.passcode)
  ) {
    return NextResponse.json({ error: "Incorrect passcode." }, { status: 401 });
  }

  const response = NextResponse.json({ authenticated: true });
  setAdminSession(response);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  clearAdminSession(response);
  return response;
}
