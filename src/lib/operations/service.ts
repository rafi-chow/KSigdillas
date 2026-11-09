import { randomUUID } from "node:crypto";
import { digest, opaqueToken, passwordHash, seal } from "./crypto";
import { eventDay, quotePrices, saleEnd, saleStart } from "./rules";
import {
  awardInput,
  correctionInput,
  donationInput,
  entryInput,
  orderInput,
  ruleInput,
  staffInput,
  type OrderInput,
} from "./validation";
import type { Category, LedgerEntry, Order, Role, State } from "./model";
import { attributeInitialDonation, validateBrother } from "./brothers";
import { purchaseTerms } from "../policies";
import { donationProducts } from "../eventConfig";
import {
  activeAdmissions,
  admissionWindowOpen,
  attachAdmission,
} from "./admissions";

import {
  capRemaining,
  contestTotals,
  flagDailyAwards,
  socialReference,
  socialRules,
  retiredAwards,
} from "./contests";

const id = () => randomUUID();
const iso = (now: Date) => now.toISOString();
const precisePoints = (points: number) => Math.round(points * 1000) / 1000;
export function audit(
  s: State,
  operator: string,
  action: string,
  subject: string,
  reason: string,
  now: Date,
) {
  s.audit.push({
    id: id(),
    operator,
    action,
    subject,
    reason,
    createdAt: iso(now),
  });
}
function team(s: State, teamId: string | null) {
  if (teamId && !s.teams.some((t) => t.id === teamId))
    throw new Error("Unknown team.");
}
function rule(s: State, ruleId: string) {
  const r = s.rules.find((r) => r.id === ruleId);
  if (!r?.enabled) throw new Error("That scoring item is not enabled.");
  return r;
}
function ledger(
  s: State,
  input: Omit<LedgerEntry, "id" | "createdAt">,
  now: Date,
) {
  if (s.ledger.some((e) => e.source === input.source)) return;
  s.ledger.push({ ...input, id: id(), createdAt: iso(now) });
}
function operation(
  s: State,
  key: string,
  input: unknown,
  now: Date,
  fn: () => string,
) {
  const fingerprint = digest(JSON.stringify(input));
  const found = s.submissions.find((r) => r.id === key);
  if (found) {
    if (found.fingerprint !== fingerprint)
      throw new Error("This request was already used for different data.");
    return found.resultId;
  }
  const resultId = fn();
  s.submissions.push({ id: key, fingerprint, createdAt: iso(now), resultId });
  return resultId;
}
export function createOrder(
  s: State,
  raw: unknown,
  source: Order["source"],
  operator: string,
  now: Date,
  feeCents = 0,
) {
  const input = orderInput.parse(raw);
  if (source === "stripe" && input.termsVersion !== purchaseTerms.version)
    throw new Error("Please accept the current ticket terms before payment.");
  validateBrother(s, input.sellerBrotherId);
  const prices = quotePrices(now);
  const fingerprint = digest(JSON.stringify(input));
  const existing = s.orders.find((o) => o.requestKey === input.requestKey);
  if (existing) {
    if (existing.fingerprint !== fingerprint)
      throw new Error("Order request changed; use a new request key.");
    return existing;
  }
  if (
    source === "cash" &&
    (!s.settings[0]?.offlineSalesEnabled || now.getTime() < saleStart)
  )
    throw new Error("Door cash sales are not open.");
  if (
    source === "test" &&
    (process.env.NODE_ENV === "production" ||
      process.env.OPS_ALLOW_TEST_FIXTURES !== "true")
  )
    throw new Error("Test payments are disabled.");
  if (source === "legacy") throw new Error("Use the audited legacy import.");
  if (
    !Number.isSafeInteger(feeCents) ||
    feeCents < 0 ||
    (source === "cash" && feeCents !== 0)
  )
    throw new Error("Invalid service fee.");
  input.attendees.forEach((a) => {
    team(s, a.teamId);
    rule(s, a.tier);
  });
  const token = opaqueToken();
  const orderId = id();
  const order: Order = {
    id: orderId,
    requestKey: input.requestKey,
    fingerprint,
    email: input.email.toLowerCase(),
    source,
    sellerBrotherId: input.sellerBrotherId ?? null,
    sellerRevision: 0,
    status: "pending",
    baseCents: input.attendees.reduce((sum, a) => sum + prices[a.tier], 0),
    feeCents,
    taxCents: 0,
    totalCents: 0,
    refundedBaseCents: 0,
    refundedFeeCents: 0,
    createdAt: iso(now),
    quoteExpiresAt: new Date(
      Math.min(now.getTime() + 30 * 60000, saleEnd),
    ).toISOString(),
    tokenHash: digest(token),
    tokenBox: seal(token),
    ticketIds: [],
    ...(input.termsVersion === purchaseTerms.version
      ? {
          terms: {
            version: purchaseTerms.version,
            acceptedAt: iso(now),
            digest: digest(JSON.stringify(purchaseTerms)),
          },
        }
      : {}),
  };
  order.totalCents = order.baseCents + feeCents;
  for (const attendee of input.attendees) {
    const token = opaqueToken();
    const ticketId = id();
    const r = rule(s, attendee.tier);
    s.tickets.push({
      id: ticketId,
      orderId,
      ...attendee,
      baseCents: prices[attendee.tier],
      points: r.points,
      ruleRevision: r.revision,
      tokenHash: digest(token),
      tokenBox: seal(token),
      valid: false,
      checkedInAt: null,
      checkedInBy: null,
      refunded: false,
      createdAt: iso(now),
    });
    order.ticketIds.push(ticketId);
  }
  s.orders.push(order);
  audit(s, operator, "order-created", orderId, source, now);
  if (source === "cash")
    fulfillOrder(s, orderId, order.totalCents, operator, now);
  return order;
}
export function fulfillOrder(
  s: State,
  orderId: string,
  cents: number,
  operator: string,
  now: Date,
) {
  const order = s.orders.find((o) => o.id === orderId);
  if (!order) throw new Error("Order not found.");
  if (cents !== order.totalCents)
    throw new Error("Payment amount does not match the order.");
  if (order.status !== "pending" && order.status !== "expired") return order;
  order.status = "paid";
  for (const ticket of s.tickets.filter((t) => t.orderId === order.id)) {
    ticket.valid = true;
    if (ticket.teamId)
      ledger(
        s,
        {
          teamId: ticket.teamId,
          category: "tickets",
          points: ticket.points,
          source: `ticket:${ticket.id}`,
          rule: ticket.tier,
          ruleRevision: ticket.ruleRevision,
          quantity: 1,
          day: eventDay(now),
          operator,
          reason: "Verified payment",
        },
        now,
      );
  }
  s.jobs.push({
    id: `initial:${order.id}`,
    orderId: order.id,
    status: "queued",
    attempts: 0,
    nextAttemptAt: iso(now),
  });
  audit(s, operator, "order-paid", orderId, "Payment verified", now);
  return order;
}
export function scanTicket(
  s: State,
  token: string,
  operator: string,
  now: Date,
  options: {
    admissionCode?: string;
    rehearsal?: boolean;
    overrideReason?: string;
  } = {},
) {
  const ticket = s.tickets.find((t) => t.tokenHash === digest(token));
  if (!ticket) throw new Error("Ticket not found.");
  if (!ticket.valid)
    throw new Error("This ticket is unpaid, refunded, or suspended.");
  if (options.rehearsal) {
    ticket.rehearsalAt = iso(now);
    audit(
      s,
      operator,
      "check-in-rehearsal",
      ticket.id,
      "QR verified; no admission counted",
      now,
    );
    return {
      admitted: false,
      ticket,
      message:
        "Rehearsal: valid QR. Ticket remains unused; no attendance counted.",
    };
  }
  if (!admissionWindowOpen(now) && !options.overrideReason?.trim())
    throw new Error(
      "Check-in is outside event hours. Use rehearsal mode or an organizer override.",
    );
  if (ticket.checkedInAt)
    return {
      admitted: false,
      ticket,
      message: "Already checked in. Do not admit again.",
    };
  if (!options.admissionCode)
    throw new Error(
      "A wristband or admission ID is required. Confirm this person has not already entered.",
    );
  const { alreadyAdmitted } = attachAdmission(
    s,
    ticket,
    options.admissionCode,
    operator,
    now,
    options.overrideReason,
  );
  audit(
    s,
    operator,
    "check-in",
    ticket.id,
    `${alreadyAdmitted ? "Linked to existing person; no additional admission" : "First admission"}${options.overrideReason ? `; override: ${options.overrideReason}` : ""}`,
    now,
  );
  if (s.awards.some((a) => a.contest === "attendance"))
    s.awards
      .filter((a) => a.contest === "attendance")
      .forEach((a) => {
        a.reviewRequired = true;
      });
  return {
    admitted: !alreadyAdmitted,
    ticket,
    message: alreadyAdmitted
      ? "This wristband is already admitted. Ticket linked; do not admit again."
      : "Valid ticket. Admit and issue the recorded wristband.",
  };
}
export function reverseCheckIn(
  s: State,
  ticketId: string,
  reason: string,
  operator: string,
  now: Date,
) {
  if (!reason.trim()) throw new Error("A correction reason is required.");
  const ticket = s.tickets.find((t) => t.id === ticketId);
  if (!ticket) throw new Error("Ticket not found.");
  ticket.checkedInAt = null;
  ticket.checkedInBy = null;
  ticket.admissionId = undefined;
  s.awards
    .filter((a) => a.contest === "attendance")
    .forEach((a) => {
      a.reviewRequired = true;
    });
  audit(s, operator, "check-in-reversed", ticketId, reason, now);
}
export function correctAdmission(
  s: State,
  ticketId: string,
  code: string,
  reason: string,
  operator: string,
  now: Date,
) {
  const ticket = s.tickets.find((t) => t.id === ticketId);
  if (!ticket?.valid || !ticket.checkedInAt)
    throw new Error(
      "Only a checked-in valid ticket can be linked to an admission.",
    );
  if (!reason.trim()) throw new Error("A correction reason is required.");
  const target = s.admissions.find((a) => a.code === code.trim().toUpperCase());
  if (!target) throw new Error("Existing admission ID not found.");
  const previous = ticket.admissionId;
  attachAdmission(s, ticket, code, operator, new Date(ticket.checkedInAt));
  s.awards
    .filter((a) => a.contest === "attendance")
    .forEach((a) => {
      a.reviewRequired = true;
    });
  audit(
    s,
    operator,
    "admission-linked",
    ticket.id,
    `${previous} -> ${target.id}: ${reason}`,
    now,
  );
}
export function addEntry(s: State, raw: unknown, operator: string, now: Date) {
  const input = entryInput.parse(raw);
  team(s, input.teamId);
  if (s.settings[0]?.packetVersion !== 1)
    throw new Error("Packet rules migration is required before scoring.");
  const r = rule(s, input.ruleId);
  validateBrother(s, input.donorBrotherId);
  if (input.donorBrotherId && r.category !== "giving")
    throw new Error("Only food donations can have a donor here.");
  if (
    r.category === "tickets" ||
    r.category === "bonuses" ||
    r.category === "eating" ||
    r.id === "donation"
  )
    throw new Error("Use verified ticket or donation receipts for that rule.");
  if (socialRules.includes(r.id) && input.quantity !== 1)
    throw new Error("Record one verified social post per entry.");
  if (socialRules.includes(r.id) && !input.tagsVerified)
    throw new Error("Verify both @kappasigmauta and @movember.usa tags first.");
  if (
    input.hangMillis &&
    (r.id !== "hang" || input.quantity !== 1 || !input.participant)
  )
    throw new Error("Record one named hanging attempt for a measured time.");
  if (r.cents > 0 && !input.paymentVerified)
    throw new Error("Verify the activity payment first.");
  return operation(s, input.requestKey, input, now, () => {
    const source = `entry:${input.requestKey}`;
    if (
      socialRules.includes(r.id) &&
      s.entries.some(
        (e) =>
          !e.reversedAt &&
          socialRules.includes(e.ruleId) &&
          socialReference(e.reference) === socialReference(input.reference),
      )
    )
      throw new Error("This social post was already scored.");
    const remaining = capRemaining(s, input.teamId, r.id, input.day);
    if (remaining !== null && input.quantity > remaining)
      throw new Error(
        `Monday cap reached: only ${remaining} ${r.label} package(s) can be accepted. Refuse the excess; it earns no points.`,
      );
    const points =
      (input.day === "2026-11-16" ? (r.mondayPoints ?? r.points) : r.points) *
      input.quantity;
    s.entries.push({
      id: source,
      teamId: input.teamId,
      ruleId: r.id,
      quantity: input.quantity,
      points,
      day: input.day,
      reference: input.reference,
      food: r.category === "giving",
      ruleRevision: r.revision,
      policyVersion: 1,
      tagsVerified: input.tagsVerified,
      participant: input.participant,
      hangMillis: input.hangMillis,
    });
    if (r.category === "giving")
      attributeInitialDonation(s, "entry", source, input.donorBrotherId);
    if (input.teamId)
      ledger(
        s,
        {
          teamId: input.teamId,
          category: r.category,
          points,
          source,
          rule: r.id,
          ruleRevision: r.revision,
          quantity: input.quantity,
          day: input.day,
          operator,
          reason: input.reference,
        },
        now,
      );
    if (r.cents > 0)
      s.receipts.push({
        id: source,
        teamId: input.teamId,
        cents: r.cents * input.quantity,
        category: "activity",
        source,
        operator,
        createdAt: iso(now),
      });
    flagDailyAwards(s, {
      food: r.category === "giving",
      day: input.day,
      ruleId: r.id,
    });
    audit(s, operator, "entry-created", source, input.reference, now);
    return source;
  });
}
export function donationDelta(
  s: State,
  teamId: string,
  source: string,
  operator: string,
  now: Date,
) {
  const r = rule(s, "donation");
  const prior = precisePoints(
    s.ledger
      .filter((x) => x.teamId === teamId && x.rule === "donation")
      .reduce((sum, x) => sum + x.points, 0),
  );
  // Apply the minimum to each gift. Existing rate snapshots are points per $5.
  const eligible = s.receipts
    .filter(
      (x) => x.teamId === teamId && x.category === "donation" && !x.reversedAt,
    )
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  let desired = 0;
  for (const receipt of eligible) {
    const rate = receipt.donationRate ?? r.points;
    if (receipt.cents >= 500) desired += (receipt.cents * rate) / 500;
  }
  ledger(
    s,
    {
      teamId,
      category: "giving",
      points: precisePoints(desired - prior),
      source,
      rule: r.id,
      ruleRevision: r.revision,
      quantity: eligible.reduce(
        (n, receipt) => n + (receipt.cents >= 500 ? receipt.cents / 500 : 0),
        0,
      ),
      day: eventDay(now),
      operator,
      reason:
        "Verified donations, proportional points with a $5 minimum per donation",
    },
    now,
  );
}
export function addDonation(
  s: State,
  raw: unknown,
  operator: string,
  now: Date,
) {
  const input = donationInput.parse(raw);
  if (/\b(?:cs_|pi_|ch_|re_)[A-Za-z0-9_]+/.test(input.reference))
    throw new Error(
      "Stripe donations are imported automatically. Reconcile the Stripe payment instead of entering it manually.",
    );
  team(s, input.teamId);
  validateBrother(s, input.donorBrotherId);
  return operation(s, input.requestKey, input, now, () => {
    if (
      s.audit.some(
        (a) =>
          a.action === "donation-received" &&
          a.reason === input.reference &&
          s.receipts.some((r) => r.id === a.subject && !r.reversedAt),
      )
    )
      throw new Error("This donation receipt was already recorded.");
    const source = `donation:${input.requestKey}`;
    s.receipts.push({
      id: source,
      teamId: input.teamId,
      cents: input.cents,
      category: "donation",
      source,
      operator,
      createdAt: iso(now),
      donationRate: rule(s, "donation").points,
      donationPolicy: 3,
      reference: input.reference,
      sequence: s.receipts.length,
    });
    audit(
      s,
      operator,
      "donation-rate",
      source,
      String(rule(s, "donation").points),
      now,
    );
    attributeInitialDonation(s, "receipt", source, input.donorBrotherId);
    if (input.teamId) donationDelta(s, input.teamId, source, operator, now);
    audit(s, operator, "donation-received", source, input.reference, now);
    return source;
  });
}
export function reverseEntry(
  s: State,
  raw: unknown,
  operator: string,
  now: Date,
) {
  const input = correctionInput.parse(raw);
  return operation(s, input.requestKey, input, now, () => {
    const entry = s.ledger.find(
      (e) => e.id === input.id || e.source === input.id,
    );
    const recorded = s.entries.find(
      (e) => e.id === input.id || e.id === entry?.source,
    );
    const receipt = s.receipts.find(
      (r) => r.id === input.id || r.source === entry?.source,
    );
    if (receipt?.providerSessionId)
      throw new Error(
        "Stripe donations must be corrected through Stripe reconciliation.",
      );
    if (entry && ["tickets", "bonuses", "eating"].includes(entry.category))
      throw new Error("Use the ticket or contest correction controls.");
    if (
      receipt?.reversedAt ||
      recorded?.reversedAt ||
      (entry && s.ledger.some((e) => e.reversalOf === entry.id))
    )
      throw new Error("Already reversed.");
    if (!entry && !receipt && !recorded) throw new Error("Entry not found.");
    if (recorded) recorded.reversedAt = iso(now);
    if (receipt) receipt.reversedAt = iso(now);
    if (receipt?.category === "donation" && receipt.teamId)
      donationDelta(
        s,
        receipt.teamId,
        `reverse:${input.requestKey}`,
        operator,
        now,
      );
    else if (entry)
      ledger(
        s,
        {
          ...entry,
          points: -entry.points,
          source: `reverse:${input.requestKey}`,
          reversalOf: entry.id,
          operator,
          reason: input.reason,
        },
        now,
      );
    if (recorded) flagDailyAwards(s, recorded);
    audit(s, operator, "entry-reversed", input.id, input.reason, now);
    return input.id;
  });
}
export function award(s: State, raw: unknown, operator: string, now: Date) {
  const input = awardInput.parse(raw);
  team(s, input.teamId);
  if (s.settings[0]?.packetVersion !== 1)
    throw new Error("Packet rules migration is required before awards.");
  const cutoff =
    input.contest === "attendance"
      ? saleEnd
      : input.contest.startsWith("food:")
        ? Date.parse("2026-11-16T15:00:00-06:00")
        : input.contest.startsWith("participation:")
          ? Date.parse("2026-11-17T15:00:00-06:00")
          : input.contest === "hanging"
            ? Date.parse("2026-11-18T15:00:00-06:00")
            : saleStart;
  if (now.getTime() < cutoff)
    throw new Error("This contest has not reached its cutoff.");
  if (input.contest.startsWith("food:") && !input.boxesVerified)
    throw new Error(
      "Verify the four physical sorority box counts against accepted packages first.",
    );
  if (
    (input.contest === "hanging" ||
      /^(eating|volleyball):/.test(input.contest)) &&
    !input.evidence
  )
    throw new Error(
      "Official result evidence is required (contender, time/amount or placement).",
    );
  const totals = standings(s).teams;
  if (input.contest === "attendance") {
    const max = Math.max(...totals.map((t) => t.attendance));
    if (
      max === 0 ||
      totals.find((t) => t.id === input.teamId)?.attendance !== max
    )
      throw new Error("Choose a team tied for the highest attendance.");
  }
  const candidates = contestTotals(s);
  const measure = input.contest.startsWith("food:")
    ? "mondayPoints"
    : input.contest.startsWith("participation:")
      ? "tuesdayPoints"
      : input.contest === "hanging"
        ? "hangMillis"
        : null;
  if (measure) {
    const max = Math.max(0, ...candidates.map((t) => t[measure]));
    // A written official hanging result can be used when timing was recorded off-site.
    if (
      !(input.contest === "hanging" && max === 0) &&
      (max <= 0 ||
        candidates.find((t) => t.teamId === input.teamId)?.[measure] !== max)
    )
      throw new Error(
        `Choose a team tied for the highest ${measure === "mondayPoints" ? "supply points" : measure === "tuesdayPoints" ? "pie/slap points" : "hang time"}.`,
      );
  }
  return operation(s, input.requestKey, input, now, () => {
    const prior = s.awards.find((a) => a.contest === input.contest);
    if (
      prior?.teamId === input.teamId &&
      !prior.retiredAt &&
      !prior.reviewRequired &&
      prior.evidence === input.evidence
    )
      return prior.id;
    const awardRule = rule(s, `award:${input.contest}`);
    const points = awardRule.points;
    if (
      /^(volleyball|eating):/.test(input.contest) &&
      s.awards.some(
        (a) =>
          a.contest.split(":")[0] === input.contest.split(":")[0] &&
          !a.retiredAt &&
          a.contest !== input.contest &&
          a.teamId === input.teamId,
      )
    )
      throw new Error(
        "This team already has a placement in this contest. Correct that result first.",
      );
    const revision = (prior?.revision ?? 0) + 1;
    if (prior && !prior.retiredAt)
      ledger(
        s,
        {
          teamId: prior.teamId,
          category: input.contest.startsWith("eating:") ? "eating" : "bonuses",
          points: -prior.points,
          source: `award-reversal:${input.contest}:${revision}`,
          rule: input.contest,
          ruleRevision: revision,
          quantity: 1,
          day: eventDay(now),
          operator,
          reason: input.reason,
        },
        now,
      );
    ledger(
      s,
      {
        teamId: input.teamId,
        category: input.contest.startsWith("eating:") ? "eating" : "bonuses",
        points,
        source: `award:${input.contest}:${revision}`,
        rule: input.contest,
        ruleRevision: revision,
        quantity: 1,
        day: eventDay(now),
        operator,
        reason: input.reason,
      },
      now,
    );
    if (prior)
      Object.assign(prior, {
        teamId: input.teamId,
        points,
        revision,
        operator,
        reason: input.reason,
        reviewRequired: false,
        retiredAt: undefined,
        evidence: input.evidence,
      });
    else
      s.awards.push({
        id: id(),
        contest: input.contest,
        teamId: input.teamId,
        points,
        revision,
        operator,
        reason: input.reason,
        createdAt: iso(now),
        evidence: input.evidence,
      });
    audit(s, operator, "award-finalized", input.contest, input.reason, now);
    return input.contest;
  });
}
export function editRule(s: State, raw: unknown, operator: string, now: Date) {
  const input = ruleInput.parse(raw);
  const r = s.rules.find((r) => r.id === input.id);
  if (!r || r.revision !== input.revision)
    throw new Error("Rule changed; refresh before editing.");
  if (retiredAwards.includes(r.id) && input.enabled)
    throw new Error("That award was retired by the packet rules.");
  const product = donationProducts.find((product) => product.id === r.id);
  if (input.enabled && product && (!product.enabled || !product.url))
    throw new Error("Specify an accepted package before enabling this item.");
  Object.assign(r, {
    points: input.points,
    mondayPoints: input.mondayPoints,
    enabled: input.enabled,
    revision: r.revision + 1,
  });
  audit(s, operator, "rule-changed", r.id, input.reason, now);
  return r;
}
export function refundTickets(
  s: State,
  orderId: string,
  ticketIds: string[],
  feeCents: number,
  operator: string,
  reason: string,
  now: Date,
  taxCents = 0,
) {
  const order = s.orders.find((o) => o.id === orderId);
  if (!order) throw new Error("Order not found.");
  if (
    order.status === "pending" ||
    order.status === "expired" ||
    order.status === "disputed"
  )
    throw new Error("This order cannot currently be refunded.");
  if (
    !reason.trim() ||
    !Number.isSafeInteger(feeCents) ||
    feeCents < 0 ||
    feeCents + order.refundedFeeCents > order.feeCents ||
    !Number.isSafeInteger(taxCents) ||
    taxCents < 0 ||
    taxCents + (order.refundedTaxCents ?? 0) > order.taxCents
  )
    throw new Error("Invalid refund details.");
  for (const ticketId of new Set(ticketIds)) {
    const ticket = s.tickets.find(
      (t) => t.id === ticketId && t.orderId === orderId,
    );
    if (!ticket)
      throw new Error("Refund ticket does not belong to this order.");
    if (ticket.refunded) continue;
    ticket.valid = false;
    ticket.refunded = true;
    order.refundedBaseCents += ticket.baseCents;
    if (ticket.teamId)
      ledger(
        s,
        {
          teamId: ticket.teamId,
          category: "tickets",
          points: -ticket.points,
          source: `refund:${ticket.id}`,
          rule: ticket.tier,
          ruleRevision: ticket.ruleRevision,
          quantity: 1,
          day: eventDay(now),
          operator,
          reason,
        },
        now,
      );
  }
  order.refundedFeeCents += feeCents;
  order.refundedTaxCents = (order.refundedTaxCents ?? 0) + taxCents;
  order.status =
    order.refundedBaseCents === order.baseCents
      ? "refunded"
      : order.refundedBaseCents > 0
        ? "partially-refunded"
        : "paid";
  s.awards
    .filter((a) => a.contest === "attendance")
    .forEach((a) => {
      a.reviewRequired = true;
    });
  audit(s, operator, "refund-confirmed", orderId, reason, now);
}
export function dispute(
  s: State,
  orderId: string,
  outcome: "open" | "won" | "lost",
  operator: string,
  now: Date,
) {
  const order = s.orders.find((o) => o.id === orderId);
  if (!order) throw new Error("Order not found.");
  if (outcome === "open" && order.status !== "disputed") {
    if (!["paid", "partially-refunded"].includes(order.status))
      throw new Error("Only paid orders can be disputed.");
    order.disputePreviousStatus = order.status;
    order.disputeRevision = (order.disputeRevision ?? 0) + 1;
    order.status = "disputed";
    for (const ticket of s.tickets.filter(
      (t) => t.orderId === orderId && !t.refunded,
    )) {
      ticket.valid = false;
      if (ticket.teamId)
        ledger(
          s,
          {
            teamId: ticket.teamId,
            category: "tickets",
            points: -ticket.points,
            source: `dispute:${orderId}:${order.disputeRevision}:${ticket.id}`,
            rule: ticket.tier,
            ruleRevision: ticket.ruleRevision,
            quantity: 1,
            day: eventDay(now),
            operator,
            reason: "Dispute opened",
          },
          now,
        );
    }
  } else if (order.status === "disputed" && outcome !== "open") {
    order.status =
      outcome === "won" ? (order.disputePreviousStatus ?? "paid") : "refunded";
    for (const ticket of s.tickets.filter(
      (t) => t.orderId === orderId && !t.refunded,
    )) {
      if (outcome === "won") {
        ticket.valid = true;
        if (ticket.teamId)
          ledger(
            s,
            {
              teamId: ticket.teamId,
              category: "tickets",
              points: ticket.points,
              source: `dispute-won:${orderId}:${order.disputeRevision}:${ticket.id}`,
              rule: ticket.tier,
              ruleRevision: ticket.ruleRevision,
              quantity: 1,
              day: eventDay(now),
              operator,
              reason: "Dispute won",
            },
            now,
          );
      } else {
        ticket.refunded = true;
        order.refundedBaseCents += ticket.baseCents;
      }
    }
  }
  s.awards
    .filter((a) => a.contest === "attendance")
    .forEach((a) => {
      a.reviewRequired = true;
    });
  audit(s, operator, `dispute-${outcome}`, orderId, outcome, now);
}
export function addStaff(s: State, raw: unknown, operator: string, now: Date) {
  const input = staffInput.parse(raw);
  if (s.staff.some((u) => u.id === input.id))
    throw new Error("Staff ID already exists.");
  s.staff.push({
    id: input.id,
    name: input.name,
    role: input.role,
    passwordHash: passwordHash(input.password),
    active: true,
  });
  audit(s, operator, "staff-created", input.id, input.role, now);
}
export function revokeStaff(
  s: State,
  staffId: string,
  operator: string,
  now: Date,
) {
  const user = s.staff.find((u) => u.id === staffId);
  if (!user) throw new Error("Staff member not found.");
  if (
    user.role === "organizer" &&
    s.staff.filter((u) => u.role === "organizer" && u.active).length === 1
  )
    throw new Error("Cannot revoke the last organizer.");
  user.active = false;
  s.sessions
    .filter((x) => x.staffId === staffId)
    .forEach((x) => {
      x.revoked = true;
    });
  audit(s, operator, "staff-revoked", staffId, "Access revoked", now);
}
export function requireRole(
  role: Role,
  permission: "scan" | "score" | "organize",
) {
  if (
    (permission === "organize" && role !== "organizer") ||
    (permission === "score" && role === "check-in")
  )
    throw new Error("Your staff role cannot perform this action.");
}
export function standings(s: State) {
  const admissions = activeAdmissions(s);
  const teams = s.teams
    .map((t) => {
      const entries = s.ledger.filter((e) => e.teamId === t.id);
      const sum = (category: Category) =>
        precisePoints(
          entries
            .filter((e) => e.category === category)
            .reduce((sum, e) => sum + e.points, 0),
        );
      return {
        ...t,
        ticketPoints: sum("tickets"),
        donationPoints: sum("giving"),
        volleyballPoints: sum("activities"),
        eatingCompetitionPoints: sum("eating"),
        bonusPoints: sum("bonuses"),
        totalPoints: precisePoints(entries.reduce((sum, e) => sum + e.points, 0)),
        attendance: admissions.filter((a) => a.teamId === t.id).length,
        lastUpdated:
          entries
            .map((e) => e.createdAt)
            .sort()
            .at(-1) ?? "2026-10-28T00:00:00.000Z",
      };
    })
    .sort(
      (a, b) =>
        b.totalPoints - a.totalPoints ||
        a.displayName.localeCompare(b.displayName),
    );
  const fundsRaisedCents =
    s.orders
      .filter((o) => ["paid", "partially-refunded"].includes(o.status))
      .reduce(
        (sum, o) =>
          sum +
          Math.max(
            0,
            o.baseCents -
              o.refundedBaseCents -
              s.refunds
                .filter((r) => r.orderId === o.id && r.status === "review")
                .reduce((n, r) => n + r.amountCents, 0),
          ),
        0,
      ) +
    s.receipts
      .filter((r) => !r.reversedAt)
      .reduce((sum, r) => sum + r.cents, 0);
  return {
    teams,
    fundsRaisedCents,
    attendance: admissions.length,
    lastUpdated:
      s.audit
        .map((x) => x.createdAt)
        .sort()
        .at(-1) ?? "2026-10-28T00:00:00.000Z",
    storageMode: "postgres" as const,
    rules: s.rules.map(
      ({ id, label, points, mondayPoints, mondayCap, enabled, category }) => ({
        id,
        label,
        points,
        mondayPoints,
        mondayCap,
        enabled,
        category,
      }),
    ),
  };
}
export function requestFingerprint(input: OrderInput) {
  return digest(JSON.stringify(input));
}

export function transferTicket(
  s: State,
  ticketId: string,
  teamId: string | null,
  reason: string,
  operator: string,
  now: Date,
) {
  team(s, teamId);
  if (!reason.trim()) throw new Error("A correction reason is required.");
  const ticket = s.tickets.find((t) => t.id === ticketId);
  if (!ticket) throw new Error("Ticket not found.");
  if (ticket.teamId === teamId) return;
  const prior = ticket.teamId;
  const source = `ticket-transfer:${id()}`;
  if (ticket.valid && prior)
    ledger(
      s,
      {
        teamId: prior,
        category: "tickets",
        points: -ticket.points,
        source: `${source}:from`,
        rule: ticket.tier,
        ruleRevision: ticket.ruleRevision,
        quantity: 1,
        day: eventDay(now),
        operator,
        reason,
      },
      now,
    );
  if (ticket.valid && teamId)
    ledger(
      s,
      {
        teamId,
        category: "tickets",
        points: ticket.points,
        source: `${source}:to`,
        rule: ticket.tier,
        ruleRevision: ticket.ruleRevision,
        quantity: 1,
        day: eventDay(now),
        operator,
        reason,
      },
      now,
    );
  ticket.teamId = teamId;
  const admission = s.admissions.find((a) => a.id === ticket.admissionId);
  if (admission) admission.teamId = teamId;
  s.awards
    .filter((a) => a.contest === "attendance")
    .forEach((a) => {
      a.reviewRequired = true;
    });
  audit(
    s,
    operator,
    "ticket-team-corrected",
    ticket.id,
    `${prior ?? "unassigned"} -> ${teamId ?? "unassigned"}: ${reason}`,
    now,
  );
}
