import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { State } from "./model";
import { digest, opaqueToken, seal } from "./crypto";
import { admissionWindowOpen, attachAdmission } from "./admissions";
import { audit } from "./service";
export const legacyTickets = z.array(
  z
    .object({
      eventId: z.string().min(1).max(100),
      attendeeId: z.string().min(1).max(100),
      name: z.string().trim().min(1).max(100),
      email: z.email().max(254),
      tier: z.enum(["basic", "meat"]),
      teamId: z.string().nullable(),
      baseCents: z.number().int().min(0),
      checkedInAt: z.iso.datetime().nullable(),
    })
    .strict(),
);
// Called only from the explicit migration CLI or isolated tests, never a public API.
export function importLegacyTickets(
  s: State,
  raw: unknown,
  operator: string,
  now: Date,
) {
  const rows = legacyTickets.parse(raw);
  let imported = 0;
  for (const row of rows) {
    const providerRef = `eventbrite:${row.eventId}:${row.attendeeId}`;
    const prior = s.orders.find((o) => o.providerRef === providerRef);
    if (prior) {
      if (prior.fingerprint !== digest(JSON.stringify(row)))
        throw new Error(
          "Previously imported attendee differs from the manifest; reconcile explicitly.",
        );
      continue;
    }
    if (row.teamId && !s.teams.some((t) => t.id === row.teamId))
      throw new Error("Unknown legacy team.");
    if (
      row.teamId &&
      s.ledger.some(
        (e) =>
          e.teamId === row.teamId &&
          e.category === "tickets" &&
          e.rule === "opening-balance",
      )
    )
      throw new Error(
        "Legacy ticket opening balance exists for this team. Reconcile before importing individual ticket credits.",
      );
    const rule = s.rules.find((r) => r.id === row.tier);
    if (!rule) throw new Error("Ticket rule is missing.");
    const orderId = randomUUID();
    const ticketId = randomUUID();
    const orderToken = opaqueToken();
    const ticketToken = opaqueToken();
    s.orders.push({
      id: orderId,
      requestKey: providerRef,
      fingerprint: digest(JSON.stringify(row)),
      email: row.email.toLowerCase(),
      source: "legacy",
      status: "paid",
      baseCents: row.baseCents,
      totalCents: row.baseCents,
      feeCents: 0,
      taxCents: 0,
      refundedBaseCents: 0,
      refundedFeeCents: 0,
      createdAt: now.toISOString(),
      quoteExpiresAt: now.toISOString(),
      tokenHash: digest(orderToken),
      tokenBox: seal(orderToken),
      ticketIds: [ticketId],
      providerRef,
    });
    s.tickets.push({
      id: ticketId,
      orderId,
      name: row.name,
      tier: row.tier,
      teamId: row.teamId,
      baseCents: row.baseCents,
      points: rule.points,
      ruleRevision: rule.revision,
      valid: true,
      refunded: false,
      checkedInAt: row.checkedInAt,
      checkedInBy: row.checkedInAt ? "eventbrite-import" : null,
      createdAt: now.toISOString(),
      tokenHash: digest(ticketToken),
      tokenBox: seal(ticketToken),
    });
    if (row.checkedInAt) {
      const ticket = s.tickets.find((t) => t.id === ticketId)!;
      if (admissionWindowOpen(new Date(row.checkedInAt)))
        attachAdmission(
          s,
          ticket,
          `L-${ticket.id}`,
          "eventbrite-import",
          new Date(row.checkedInAt),
        );
      else {
        ticket.rehearsalAt = row.checkedInAt;
        ticket.checkedInAt = null;
        ticket.checkedInBy = null;
      }
    }
    if (row.teamId)
      s.ledger.push({
        id: randomUUID(),
        source: `ticket:${ticketId}`,
        teamId: row.teamId,
        category: "tickets",
        points: rule.points,
        rule: row.tier,
        ruleRevision: rule.revision,
        quantity: 1,
        day: "2026-11-19",
        operator,
        reason: providerRef,
        createdAt: now.toISOString(),
      });
    audit(s, operator, "legacy-ticket-imported", orderId, providerRef, now);
    imported++;
  }
  return { imported, skipped: rows.length - imported };
}
