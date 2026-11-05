import { randomUUID } from "node:crypto";
import { digest } from "./crypto";
import type { State } from "./model";
import { audit } from "./service";
import { retentionPolicy } from "../policies";
const day = 86400000;
export function cleanupTransient(s: State, now = new Date()) {
  const before = s.sessions.length + s.attempts.length;
  s.sessions = s.sessions.filter(
    (session) =>
      !session.revoked && Date.parse(session.expiresAt) > now.getTime(),
  );
  s.attempts = s.attempts.filter(
    (attempt) =>
      ["maintenance-heartbeat", "maintenance-probe-heartbeat"].includes(
        attempt.id,
      ) || Date.parse(attempt.resetsAt) > now.getTime() - day,
  );
  return before - s.sessions.length - s.attempts.length;
}
export function privacyPlan(s: State, now = new Date(), paidApproved = false) {
  return s.orders
    .filter((o) => !o.privacyAnonymizedAt)
    .map((o) => {
      const abandoned = o.status === "expired" && o.baseCents >= 0;
      const due = abandoned
        ? Date.parse(o.createdAt) + retentionPolicy.abandonedDays * day <=
          now.getTime()
        : Date.parse(retentionPolicy.eventEnd) +
            retentionPolicy.attendeeDays * day <=
            now.getTime() && paidApproved;
      const actions = s.audit.filter(
        (a) =>
          a.subject === o.id &&
          ["privacy-hold", "privacy-hold-released"].includes(a.action),
      );
      const held = actions.at(-1)?.action === "privacy-hold";
      const unresolved =
        o.status === "pending" ||
        o.status === "disputed" ||
        s.refunds.some(
          (r) =>
            r.orderId === o.id && !["succeeded", "failed"].includes(r.status),
        ) ||
        s.jobs.some(
          (j) => j.orderId === o.id && j.status !== "sent" && j.attempts < 8,
        ) ||
        s.checkouts.some(
          (c) => c.orderId === o.id && ["creating", "open"].includes(c.status),
        );
      return {
        orderId: o.id,
        eligible: due && !held && !unresolved,
        held,
        unresolved,
        kind: abandoned ? "abandoned" : "attendee",
      };
    });
}
export function anonymizeOrder(
  s: State,
  orderId: string,
  operator: string,
  now = new Date(),
) {
  const order = s.orders.find((o) => o.id === orderId);
  if (!order || order.privacyAnonymizedAt) return false;
  // Financial amounts, payment IDs, aggregates and immutable scoring sources stay.
  order.email = "removed@privacy.invalid";
  order.sellerRaw = undefined;
  order.tokenHash = digest(randomUUID());
  order.tokenBox = "";
  order.privacyAnonymizedAt = now.toISOString();
  for (const ticket of s.tickets.filter((t) => t.orderId === orderId)) {
    ticket.name = "Removed attendee";
    ticket.tokenHash = digest(randomUUID());
    ticket.tokenBox = "";
    // Preserve historical validity/check-in aggregates; rotating private tokens
    // removes access without changing the event's recorded attendance winner.
  }
  // Clear unneeded provider error text without discarding delivery evidence.
  for (const job of s.jobs.filter((j) => j.orderId === orderId))
    job.lastError = undefined;
  audit(
    s,
    operator,
    "privacy-anonymized",
    orderId,
    retentionPolicy.version,
    now,
  );
  return true;
}
export function applyRetention(
  s: State,
  now = new Date(),
  paidApproved = false,
) {
  let removed = 0;
  for (const row of privacyPlan(s, now, paidApproved))
    if (row.eligible && anonymizeOrder(s, row.orderId, "retention-worker", now))
      removed++;
  return removed;
}
export function reapplyDeletions(s: State, ids: string[], now = new Date()) {
  return ids.filter((id) => anonymizeOrder(s, id, "restore-privacy", now))
    .length;
}
