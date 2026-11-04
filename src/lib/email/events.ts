import { z } from "zod";
import { digest } from "../operations/crypto";
import type { State } from "../operations/model";
const input = z
  .object({
    event: z.string(),
    "message-id": z.string().min(1).max(500),
    email: z.email(),
    ts_event: z.number().int().positive().optional(),
    ts_epoch: z.number().positive().optional(),
  })
  .passthrough();
export function receiveEmailEvents(s: State, raw: unknown, now = new Date()) {
  const rows = z
    .array(input)
    .max(100)
    .parse(Array.isArray(raw) ? raw : [raw]);
  for (const row of rows) {
    const status =
      row.event === "delivered"
        ? "delivered"
        : [
              "hard_bounce",
              "soft_bounce",
              "blocked",
              "invalid",
              "spam",
              "error",
            ].includes(row.event)
          ? "bounced"
          : row.event === "deferred"
            ? "deferred"
            : row.event === "request"
              ? "accepted"
              : null;
    if (!status) continue;
    const time = row.ts_event ? row.ts_event * 1000 : row.ts_epoch;
    if (!time || !Number.isFinite(time) || time > now.getTime() + 300000)
      throw new Error("Invalid email event timestamp.");
    const id = digest(
      `${row["message-id"]}:${row.email.toLowerCase()}:${row.event}:${time}`,
    );
    if (!s.emailEvents.some((e) => e.id === id))
      s.emailEvents.push({
        id,
        providerRef: row["message-id"],
        emailHash: digest(row.email.toLowerCase()),
        status,
        occurredAt: new Date(time).toISOString(),
        processed: false,
      });
  }
  applyEmailEvents(s);
}
export function applyEmailEvents(s: State) {
  for (const event of s.emailEvents.filter((e) => !e.processed)) {
    const job = s.jobs.find(
      (j) =>
        j.provider === "brevo" &&
        j.providerRef === event.providerRef &&
        s.orders.some(
          (o) =>
            o.id === j.orderId &&
            digest(o.email.toLowerCase()) === event.emailHash,
        ),
    );
    if (!job) continue;
    if (
      !job.deliveryUpdatedAt ||
      Date.parse(event.occurredAt) > Date.parse(job.deliveryUpdatedAt) ||
      (event.occurredAt === job.deliveryUpdatedAt &&
        ["delivered", "bounced"].includes(event.status))
    ) {
      job.deliveryStatus = event.status;
      job.deliveryUpdatedAt = event.occurredAt;
      if (event.status === "bounced")
        job.lastError =
          "Email bounced or was blocked. Verify buyer address and contact the organizer.";
    }
    event.processed = true;
  }
}
