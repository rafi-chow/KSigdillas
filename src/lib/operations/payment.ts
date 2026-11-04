import type { State } from "./model";
import { audit, dispute, fulfillOrder, refundTickets } from "./service";
import { digest } from "./crypto";
export type VerifiedPaymentEvent = {
  // Only a future trusted provider adapter may construct this event after
  // signature, account, environment and authoritative status verification.
  id: string;
  orderId: string;
  currency: "usd";
  amountCents: number;
} & (
  | { kind: "paid" }
  | { kind: "expired" }
  | { kind: "refund"; ticketIds: string[]; feeCents: number }
  | { kind: "dispute"; outcome: "open" | "won" | "lost" }
);
export function applyVerifiedPaymentEvent(
  s: State,
  event: VerifiedPaymentEvent,
  now: Date,
) {
  const key = `provider-event:${event.id}`;
  const fingerprint = digest(JSON.stringify(event));
  const previous = s.submissions.find((x) => x.id === key);
  if (previous) {
    if (previous.fingerprint !== fingerprint)
      throw new Error("Provider event ID was reused for different data.");
    return;
  }
  const order = s.orders.find((o) => o.id === event.orderId);
  if (
    !order ||
    event.currency !== "usd" ||
    event.amountCents !== order.totalCents
  )
    throw new Error("Provider event does not match the order.");
  if (event.kind === "paid")
    fulfillOrder(s, order.id, event.amountCents, "verified-provider", now);
  else if (event.kind === "expired" && order.status === "pending")
    order.status = "expired";
  else if (event.kind === "refund")
    refundTickets(
      s,
      order.id,
      event.ticketIds,
      event.feeCents,
      "verified-provider",
      "Confirmed provider refund",
      now,
    );
  else if (event.kind === "dispute")
    dispute(s, order.id, event.outcome, "verified-provider", now);
  s.submissions.push({
    id: key,
    fingerprint,
    createdAt: now.toISOString(),
    resultId: order.id,
  });
  audit(
    s,
    "verified-provider",
    `payment-${event.kind}`,
    order.id,
    event.id,
    now,
  );
}
export function expireQuotes(s: State, now: Date) {
  let expired = 0;
  for (const order of s.orders)
    if (
      order.status === "pending" &&
      Date.parse(order.quoteExpiresAt) <= now.getTime()
    ) {
      order.status = "expired";
      expired++;
      audit(
        s,
        "maintenance",
        "quote-expired",
        order.id,
        "Unpaid quote elapsed",
        now,
      );
    }
  return expired;
}
