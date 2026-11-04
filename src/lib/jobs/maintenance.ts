import type { State } from "../operations/model";
import type { Store } from "../operations/store";
import { cleanupTransient } from "../operations/privacy";
import { expireQuotes } from "../operations/payment";
import { deliverDue, type Delivery } from "../email/delivery";
import {
  budgetStripeGateway,
  processStripeWork,
  requestStripeRefund,
  stripeGateway,
  stripeRuntimeAvailable,
  stripeRefundWriteEnabled,
  type StripeGateway,
} from "../payments/stripe";

export function activeMaintenance(now = new Date()) {
  return (
    now.getTime() >= Date.parse("2026-11-15T00:00:00-06:00") &&
    now.getTime() < Date.parse("2026-11-22T00:00:00-06:00")
  );
}
export function scheduledPassDue(now = new Date()) {
  return activeMaintenance(now) || now.getUTCMinutes() % 15 === 0;
}
export function maintenanceHealth(state: State, now = new Date()) {
  const heartbeat = state.attempts.find(
    (a) => a.id === "maintenance-heartbeat",
  );
  const allowance = activeMaintenance(now) ? 5 * 60000 : 35 * 60000;
  const healthy = Boolean(
    heartbeat && Date.parse(heartbeat.resetsAt) >= now.getTime() - allowance,
  );
  const attentionRequired =
    state.jobs.filter(
      (j) =>
        j.uncertain ||
        j.deliveryStatus === "bounced" ||
        (j.status !== "sent" &&
          (j.attempts >= 8 ||
            Date.parse(j.nextAttemptAt) < now.getTime() - 300000)),
    ).length +
    state.providerEvents.filter(
      (e) =>
        e.status === "review" ||
        (e.status === "pending" &&
          Date.parse(e.createdAt) < now.getTime() - 300000),
    ).length +
    state.refunds.filter((r) => ["review", "failed"].includes(r.status))
      .length +
    state.checkouts.filter((c) => Boolean(c.error)).length;
  return {
    healthy,
    lastSuccess: heartbeat?.resetsAt ?? null,
    attentionRequired,
  };
}

/** Provider lanes run independently; persistence completes before the 24s storage deadline. */
export async function runMaintenance(
  store: Store,
  options: {
    source?: "scheduled" | "manual";
    now?: Date;
    deadline?: number;
    gateway?: StripeGateway | null;
    delivery?: Delivery;
  } = {},
) {
  const started = Date.now();
  const deadline = options.deadline ?? started + 18000;
  const now = options.now ?? new Date();
  const expiredQuotes = await store.transaction((s) => {
    cleanupTransient(s, now);
    return expireQuotes(s, now);
  });
  const gateway =
    options.gateway === undefined
      ? stripeRuntimeAvailable()
        ? stripeGateway()
        : null
      : options.gateway;
  const refundLane = async () => {
    if (!gateway || !stripeRefundWriteEnabled() || Date.now() >= deadline)
      return 0;
    const refund = (await store.read()).refunds.find(
      (r) => r.status === "requested",
    );
    if (!refund) return 0;
    await requestStripeRefund(
      store,
      {
        requestKey: refund.id,
        id: refund.orderId,
        ticketIds: refund.ticketIds,
        feeCents: refund.feeCents,
        reason: refund.reason,
      },
      "maintenance",
      budgetStripeGateway(gateway, deadline),
    );
    return 0;
  };
  const [payments, email, refunds] = await Promise.allSettled([
    gateway
      ? processStripeWork(store, gateway, now, { deadline, limit: 50 })
      : Promise.resolve({ failed: 0, events: 0, sessions: 0 }),
    deliverDue(store, options.delivery, now, { deadline, limit: 50 }),
    refundLane(),
  ]);
  const stripe =
    payments.status === "fulfilled"
      ? payments.value
      : { failed: 1, events: 0, sessions: 0 };
  const result =
    email.status === "fulfilled" ? email.value : { sent: 0, failed: 1 };
  if (refunds.status === "rejected") stripe.failed++;
  const completed = new Date();
  const id =
    options.source === "scheduled"
      ? "maintenance-heartbeat"
      : "maintenance-manual-heartbeat";
  await store.transaction((s) => {
    const heartbeat = s.attempts.find((a) => a.id === id);
    if (heartbeat) {
      heartbeat.resetsAt = completed.toISOString();
      heartbeat.count++;
    } else s.attempts.push({ id, count: 1, resetsAt: completed.toISOString() });
  });
  const health = maintenanceHealth(await store.read(), completed);
  return {
    ...result,
    stripe,
    expiredQuotes,
    attentionRequired: health.attentionRequired + stripe.failed + result.failed,
    durationMs: Date.now() - started,
    source: options.source ?? "manual",
  };
}
