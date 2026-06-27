import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import {
  getEventbriteSyncStatus,
  syncEventbriteTickets,
} from "@/lib/eventbrite/sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json(getEventbriteSyncStatus(), {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const report = await syncEventbriteTickets();
    return NextResponse.json({
      report,
      message: `Eventbrite sync complete: ${report.ticketsCounted} tickets counted.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to sync Eventbrite tickets.",
        status: getEventbriteSyncStatus(),
      },
      { status: 400 },
    );
  }
}
