import { PgStore } from "../../src/lib/operations/store";
import {
  runMaintenance,
  scheduledMaintenanceDue,
} from "../../src/lib/jobs/maintenance";

export default async function maintenance(
  _request: Request,
  context: { deploy: { context: string; published: boolean } },
) {
  if (
    context.deploy.context !== "production" ||
    !context.deploy.published ||
    process.env.MAINTENANCE_ENABLED !== "true" ||
    process.env.EVENT_OPERATIONS_ENABLED !== "true" ||
    !process.env.OPERATIONS_DATABASE_URL
  )
    return;
  const store = new PgStore(
    process.env.OPERATIONS_DATABASE_URL,
    Date.now() + 24000,
  );
  try {
    const started = Date.now();
    if (!(await scheduledMaintenanceDue(store))) {
      await store.recordMaintenanceProbe(new Date());
      console.log(
        JSON.stringify({ skipped: true, durationMs: Date.now() - started }),
      );
      return;
    }
    const result = await runMaintenance(store, { source: "scheduled" });
    console.log(JSON.stringify(result)); // Counts and timings only.
  } finally {
    await store.close();
  }
}
export const config = { schedule: "* * * * *" };
