import { boundedText, RequestError } from "@/lib/http";
import { NextRequest, NextResponse } from "next/server";
import { secretMatches } from "@/lib/jobs/auth";
import { getStore } from "@/lib/operations/store";
import { receiveEmailEvents } from "@/lib/email/events";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (
    !secretMatches(
      request.headers.get("x-ksigdillas-webhook-secret"),
      process.env.EMAIL_WEBHOOK_SECRET,
    )
  )
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const body = await boundedText(request, 200000);
    await getStore().transaction((s) =>
      receiveEmailEvents(s, JSON.parse(body)),
    );
    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof RequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(
      { error: "Email event could not be saved." },
      { status: 503 },
    );
  }
}
