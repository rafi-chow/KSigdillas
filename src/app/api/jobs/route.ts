import { NextRequest, NextResponse } from "next/server";
import { secretMatches } from "@/lib/jobs/auth";
import { PgStore, operationsEnabled } from "@/lib/operations/store";
import { maintenanceHealth, runMaintenance } from "@/lib/jobs/maintenance";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  const headers = { "Cache-Control": "no-store" };
  const healthOnly = request.nextUrl.searchParams.get("health") === "true";
  if (
    !secretMatches(token, process.env.MAINTENANCE_JOB_SECRET) &&
    !(healthOnly && secretMatches(token, process.env.MONITORING_HEALTH_SECRET))
  )
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401, headers },
    );
  if (!operationsEnabled() || !process.env.OPERATIONS_DATABASE_URL)
    return NextResponse.json(
      { error: "Maintenance unavailable." },
      { status: 503, headers },
    );
  const store = new PgStore(
    process.env.OPERATIONS_DATABASE_URL,
    Date.now() + 24000,
  );
  try {
    if (healthOnly) {
      const health = maintenanceHealth(await store.read());
      return NextResponse.json(health, {
        status:
          health.healthy &&
          (request.nextUrl.searchParams.get("strict") !== "true" ||
            !health.attentionRequired)
            ? 200
            : 503,
        headers,
      });
    }
    const result = await runMaintenance(store);
    return NextResponse.json(result, {
      status: result.attentionRequired ? 503 : 200,
      headers,
    });
  } catch {
    return NextResponse.json(
      {
        error: "Maintenance failed. Check storage and provider configuration.",
      },
      { status: 503, headers },
    );
  } finally {
    await store.close();
  }
}
export const GET = POST;
