import assert from "node:assert/strict";
import {
  applyVerifiedPaymentEvent,
  expireQuotes,
} from "../src/lib/operations/payment";
import { importLegacyTickets } from "../src/lib/operations/legacy";
import { before, test } from "node:test";
import { randomUUID } from "node:crypto";
import {
  initialState,
  quotePrices,
  grossUp,
} from "../src/lib/operations/rules";
import { emptyState } from "../src/lib/operations/model";
import {
  createOrder,
  standings,
  fulfillOrder,
  scanTicket,
  addEntry,
  addDonation,
  reverseEntry,
  editRule,
  award,
  refundTickets,
  dispute,
  requireRole,
  transferTicket,
} from "../src/lib/operations/service";
import { unseal, digest } from "../src/lib/operations/crypto";
import {
  login,
  authorize,
  sessionUser,
  enforceOrigin,
} from "../src/lib/operations/auth";
import { addStaff, revokeStaff } from "../src/lib/operations/service";
import { ticketEmail } from "../src/lib/email/delivery";
import { NextRequest } from "next/server";

const monday = new Date("2026-11-16T12:00:00-06:00");
const close = new Date("2026-11-19T21:00:00-06:00");
const state = () => initialState(emptyState());
const orderInput = (
  tiers: ("basic" | "meat")[] = ["basic", "basic", "meat"],
) => ({
  requestKey: randomUUID(),
  email: "guest@example.test",
  attendees: tiers.map((tier, i) => ({
    name: `Guest ${i + 1}`,
    teamId: "axo" as string | null,
    tier,
  })),
});
before(() => {
  process.env.TICKET_ENCRYPTION_KEY = "1".repeat(64);
  process.env.OPS_ALLOW_TEST_FIXTURES = "true";
  process.env.APP_URL = "http://127.0.0.1:3100";
});
test("mixed order: independent $35 / 350 points / three tickets / fee separation", () => {
  const s = state();
  const input = orderInput();
  const o = createOrder(s, input, "test", "test", monday, 123);
  assert.equal(o.baseCents, 3500);
  assert.equal(o.totalCents, 3623);
  assert.equal(standings(s).fundsRaisedCents, 0);
  fulfillOrder(s, o.id, 3623, "test", monday);
  fulfillOrder(s, o.id, 3623, "test", monday);
  assert.equal(s.tickets.length, 3);
  assert.equal(s.jobs.length, 1);
  assert.equal(standings(s).teams[0].totalPoints, 350);
  assert.equal(standings(s).fundsRaisedCents, 3500);
  assert.equal(standings(s).attendance, 0);
  assert.equal(createOrder(s, input, "test", "test", monday).id, o.id);
  assert.throws(() =>
    createOrder(
      s,
      { ...input, email: "other@example.test" },
      "test",
      "test",
      monday,
    ),
  );
});
test("cutoff uses Central time, door prices $42, and 9 PM close", () => {
  assert.deepEqual(quotePrices(new Date("2026-11-19T23:59:59Z")), {
    basic: 1e3,
    meat: 1500,
  });
  assert.deepEqual(quotePrices(new Date("2026-11-20T00:00:00Z")), {
    basic: 1200,
    meat: 1800,
  });
  assert.throws(() => quotePrices(close));
  const o = createOrder(
    state(),
    orderInput(),
    "test",
    "test",
    new Date("2026-11-20T00:00:00Z"),
  );
  assert.equal(o.baseCents, 4200);
});
test("fee gross-up is integer and applies fixed component once per order", () => {
  assert.equal(grossUp(3500, 290, 30), 3636);
  assert.equal(grossUp(0, 0, 0), 0);
  assert.throws(() => grossUp(-1, 290, 30));
  assert.throws(() => grossUp(3500, 1e4, 30));
});
test("server validation rejects invalid tier, team, empty names and client price", () => {
  for (const patch of [
    { attendees: [{ name: "x", teamId: "wrong", tier: "basic" }] },
    { attendees: [{ name: "", teamId: "axo", tier: "basic" }] },
    { price: 1 },
    { attendees: [] },
  ])
    assert.throws(() =>
      createOrder(
        state(),
        { ...orderInput(), ...patch },
        "test",
        "test",
        monday,
      ),
    );
});
test("unpaid/wrong-amount tickets cannot be admitted; each paid QR admits once", () => {
  const s = state();
  const o = createOrder(s, orderInput(), "test", "test", monday);
  const token = unseal(s.tickets[0].tokenBox);
  assert.throws(() => scanTicket(s, token, "scanner", monday));
  assert.throws(() => fulfillOrder(s, o.id, 1, "test", monday));
  fulfillOrder(s, o.id, 3500, "test", monday);
  assert.equal(scanTicket(s, token, "scanner", monday).admitted, true);
  assert.equal(scanTicket(s, token, "scanner", monday).admitted, false);
  assert.equal(standings(s).teams[0].ticketPoints, 350);
  assert.equal(standings(s).teams[0].attendance, 1);
});
test("no-team guests generate funds and overall attendance, no team points", () => {
  const s = state();
  const input = orderInput(["basic"]);
  input.attendees[0].teamId = null;
  const o = createOrder(s, input, "test", "test", monday);
  fulfillOrder(s, o.id, 1e3, "test", monday);
  scanTicket(s, unseal(s.tickets[0].tokenBox), "test", monday);
  assert.equal(standings(s).fundsRaisedCents, 1e3);
  assert.equal(standings(s).attendance, 1);
  assert.equal(
    standings(s).teams.reduce((sum, t) => sum + t.totalPoints, 0),
    0,
  );
});
test("food fixture is 375 Monday / 195 Tuesday and does not invent funds", () => {
  for (const [day, points] of [
    ["2026-11-16", 375],
    ["2026-11-17", 195],
  ]) {
    const s = state();
    for (const [ruleId, quantity] of [
      ["cheese", 2],
      ["soda", 1],
      ["water", 1],
    ])
      addEntry(
        s,
        {
          requestKey: randomUUID(),
          teamId: "axo",
          ruleId,
          quantity,
          day,
          reference: "Verified packages",
          paymentVerified: false,
        },
        "scorer",
        monday,
      );
    assert.equal(standings(s).teams[0].totalPoints, points);
    assert.equal(standings(s).fundsRaisedCents, 0);
  }
});
test("disabled supplies and invalid quantities are rejected; hanging is 10 with no cash", () => {
  const s = state();
  s.rules.find((r) => r.id === "steak")!.enabled = false;
  const input = {
    requestKey: randomUUID(),
    teamId: "axo",
    ruleId: "steak",
    quantity: 1,
    day: "2026-11-18",
    reference: "Attempt",
    paymentVerified: false,
  };
  assert.throws(() => addEntry(s, input, "test", monday));
  assert.throws(() =>
    addEntry(s, { ...input, ruleId: "hang", quantity: -2 }, "test", monday),
  );
  addEntry(s, { ...input, ruleId: "hang", quantity: 3 }, "test", monday);
  assert.equal(standings(s).teams[0].totalPoints, 30);
  assert.equal(s.receipts.length, 0);
});
test("slap/pie require verified payment, replay cannot repeat receipts or points", () => {
  const s = state();
  const input = {
    requestKey: randomUUID(),
    teamId: "axo",
    ruleId: "slap",
    quantity: 2,
    day: "2026-11-17",
    reference: "Receipt 1",
    paymentVerified: false,
  };
  assert.throws(() => addEntry(s, input, "test", monday));
  const paid = { ...input, paymentVerified: true };
  addEntry(s, paid, "test", monday);
  addEntry(s, paid, "test", monday);
  addEntry(
    s,
    { ...paid, requestKey: randomUUID(), quantity: 1, ruleId: "pie" },
    "test",
    monday,
  );
  assert.equal(standings(s).teams[0].totalPoints, 35);
  assert.equal(standings(s).fundsRaisedCents, 600);
  assert.equal(s.receipts.length, 2);
});
test("$7+$3 donation earns 100; reversing $3 leaves $7 and 50", () => {
  const s = state();
  const first = {
    requestKey: randomUUID(),
    teamId: "axo",
    cents: 700,
    reference: "Receipt A",
  };
  addDonation(s, first, "test", monday);
  assert.equal(standings(s).teams[0].totalPoints, 50);
  const receiptId = addDonation(
    s,
    { ...first, requestKey: randomUUID(), cents: 300, reference: "Receipt B" },
    "test",
    monday,
  );
  assert.equal(standings(s).teams[0].totalPoints, 100);
  assert.equal(standings(s).fundsRaisedCents, 1e3);
  reverseEntry(
    s,
    { requestKey: randomUUID(), id: receiptId, reason: "Cash returned" },
    "test",
    monday,
  );
  assert.equal(standings(s).teams[0].totalPoints, 50);
  assert.equal(standings(s).fundsRaisedCents, 700);
});
test("rule edits are prospective, versioned, reject stale revisions and allow specified steak", () => {
  const s = state();
  const input = {
    requestKey: randomUUID(),
    teamId: "axo",
    ruleId: "hang",
    quantity: 1,
    day: "2026-11-18",
    reference: "Attempt",
    paymentVerified: false,
  };
  addEntry(s, input, "test", monday);
  editRule(
    s,
    {
      id: "hang",
      revision: 1,
      points: 20,
      enabled: true,
      reason: "Updated rule",
    },
    "test",
    monday,
  );
  addEntry(s, { ...input, requestKey: randomUUID() }, "test", monday);
  assert.equal(standings(s).teams[0].totalPoints, 30);
  assert.equal(s.ledger[0].ruleRevision, 1);
  assert.equal(s.ledger[1].ruleRevision, 2);
  assert.throws(() =>
    editRule(
      s,
      { id: "hang", revision: 1, points: 25, enabled: true, reason: "Stale" },
      "test",
      monday,
    ),
  );
  const steak = editRule(
    s,
    {
      id: "steak",
      revision: 1,
      points: 100,
      enabled: true,
      mondayPoints: 175,
      reason: "Verified Great Value 18 oz steak fajita package",
    },
    "test",
    monday,
  );
  assert.equal(steak.enabled, true);
  assert.equal(steak.revision, 2);
});
test("single attendance award, cutoffs, repeat and audited winner correction", () => {
  const s = state();
  assert.throws(() =>
    award(
      s,
      {
        requestKey: randomUUID(),
        teamId: "axo",
        contest: "attendance",
        reason: "Winner",
      },
      "test",
      monday,
    ),
  );
  const input = orderInput(["basic", "basic"]);
  input.attendees[1].teamId = "dz";
  const o = createOrder(s, input, "test", "test", monday);
  fulfillOrder(s, o.id, 2e3, "test", monday);
  for (const t of s.tickets) scanTicket(s, unseal(t.tokenBox), "test", monday);
  const awardInput = {
    requestKey: randomUUID(),
    teamId: "axo",
    contest: "attendance",
    reason: "Tied winner selected",
  };
  award(s, awardInput, "test", close);
  award(s, { ...awardInput, requestKey: randomUUID() }, "test", close);
  assert.equal(s.ledger.filter((e) => e.category === "bonuses").length, 1);
  award(
    s,
    {
      ...awardInput,
      requestKey: randomUUID(),
      teamId: "dz",
      reason: "Corrected tied result",
    },
    "test",
    close,
  );
  assert.equal(standings(s).teams.find((t) => t.id === "axo")!.bonusPoints, 0);
  assert.equal(standings(s).teams.find((t) => t.id === "dz")!.bonusPoints, 1e3);
});
test("partial item refund selects correct ticket; fee-only does not remove points", () => {
  const s = state();
  const o = createOrder(s, orderInput(), "test", "test", monday, 123);
  fulfillOrder(s, o.id, 3623, "test", monday);
  refundTickets(s, o.id, [], 23, "test", "Fee adjustment", monday);
  assert.equal(standings(s).teams[0].ticketPoints, 350);
  refundTickets(
    s,
    o.id,
    [s.tickets[0].id],
    0,
    "test",
    "Exceptional refund",
    monday,
  );
  assert.equal(s.tickets.filter((t) => t.valid).length, 2);
  assert.equal(standings(s).teams[0].ticketPoints, 250);
  assert.equal(standings(s).fundsRaisedCents, 2500);
  assert.throws(() =>
    scanTicket(s, unseal(s.tickets[0].tokenBox), "test", monday),
  );
});
test("dispute suspends then restores without duplicate restoration", () => {
  const s = state();
  const o = createOrder(s, orderInput(["basic"]), "test", "test", monday);
  fulfillOrder(s, o.id, 1e3, "test", monday);
  dispute(s, o.id, "open", "test", monday);
  assert.equal(standings(s).fundsRaisedCents, 0);
  assert.equal(standings(s).teams[0].ticketPoints, 0);
  dispute(s, o.id, "won", "test", monday);
  dispute(s, o.id, "won", "test", monday);
  assert.equal(standings(s).fundsRaisedCents, 1e3);
  assert.equal(standings(s).teams[0].ticketPoints, 100);
});
test("staff roles, server expiry, revocation and durable login throttling", () => {
  const s = state();
  addStaff(
    s,
    {
      id: "organizer",
      name: "Organizer",
      role: "organizer",
      password: "test-only-long-password",
    },
    "bootstrap",
    monday,
  );
  addStaff(
    s,
    {
      id: "scanner",
      name: "Scanner",
      role: "check-in",
      password: "test-only-scanner-password",
    },
    "bootstrap",
    monday,
  );
  const result = login(
    s,
    { id: "scanner", password: "test-only-scanner-password" },
    monday,
  );
  assert.ok(result);
  assert.ok(result.token);
  assert.equal(authorize(s, result.token, "scan", monday).id, "scanner");
  assert.throws(() => authorize(s, result.token, "organize", monday));
  assert.equal(
    sessionUser(s, result.token, new Date(monday.getTime() + 9 * 36e5)),
    null,
  );
  revokeStaff(s, "scanner", "organizer", monday);
  assert.equal(sessionUser(s, result.token, monday), null);
  assert.throws(() => revokeStaff(s, "organizer", "organizer", monday));
  for (let i = 0; i < 9; i++)
    assert.equal(
      login(s, { id: "organizer", password: "wrong" }, monday),
      null,
    );
  assert.equal(
    login(s, { id: "organizer", password: "test-only-long-password" }, monday),
    null,
  );
  assert.throws(() => requireRole("check-in", "score"));
});
test("origin protection rejects cross-site and absent origins", () => {
  assert.throws(() =>
    enforceOrigin(
      new NextRequest("https://example.test/api", {
        method: "POST",
        headers: { origin: "https://other.test" },
      }),
    ),
  );
  assert.throws(() =>
    enforceOrigin(
      new NextRequest("https://example.test/api", { method: "POST" }),
    ),
  );
  enforceOrigin(
    new NextRequest("http://127.0.0.1:3100/api", {
      method: "POST",
      headers: { origin: "http://127.0.0.1:3100" },
    }),
  );
});
test("real QR email renderer escapes attendee HTML and supplies per-ticket fallback", async () => {
  const s = state();
  const input = orderInput(["basic"]);
  input.attendees[0].name = '<script>alert("test")</script>';
  const o = createOrder(s, input, "test", "test", monday);
  fulfillOrder(s, o.id, 1e3, "test", monday);
  const email = await ticketEmail(s, s.jobs[0]);
  assert.equal(email.attachments.length, 1);
  assert.ok(email.html.includes("&lt;script&gt;"));
  assert.ok(!email.html.includes("<script>"));
  assert.ok(email.text.includes("/tickets/"));
  assert.ok(email.html.includes("zachzapalac@gmail.com"));
  assert.equal(digest(unseal(s.tickets[0].tokenBox)), s.tickets[0].tokenHash);
});
test("social posts cannot be credited twice; corrections remain auditable", () => {
  const s = state();
  const input = {
    requestKey: randomUUID(),
    teamId: "axo",
    ruleId: "story",
    tagsVerified: true,
    quantity: 1,
    day: "2026-11-17",
    reference: "https://instagram.example/post/123",
    paymentVerified: false,
  };
  addEntry(s, input, "scorer", monday);
  assert.throws(
    () =>
      addEntry(
        s,
        { ...input, requestKey: randomUUID(), teamId: "dz" },
        "scorer",
        monday,
      ),
    /already/,
  );
  reverseEntry(
    s,
    {
      requestKey: randomUUID(),
      id: s.ledger[0].id,
      reason: "Wrong attribution",
    },
    "organizer",
    monday,
  );
  assert.equal(standings(s).teams.find((t) => t.id === "axo")!.totalPoints, 0);
  assert.equal(s.ledger.length, 2);
});
test("donation rule changes preserve prior awarded rates and receipt uniqueness", () => {
  const s = state();
  addDonation(
    s,
    {
      requestKey: randomUUID(),
      teamId: "axo",
      cents: 500,
      reference: "Unique receipt 1",
    },
    "test",
    monday,
  );
  editRule(
    s,
    {
      id: "donation",
      revision: 1,
      points: 100,
      enabled: true,
      reason: "Future donations only",
    },
    "test",
    monday,
  );
  addDonation(
    s,
    {
      requestKey: randomUUID(),
      teamId: "axo",
      cents: 500,
      reference: "Unique receipt 2",
    },
    "test",
    monday,
  );
  assert.equal(standings(s).teams[0].totalPoints, 150);
  assert.throws(
    () =>
      addDonation(
        s,
        {
          requestKey: randomUUID(),
          teamId: "dz",
          cents: 500,
          reference: "Unique receipt 2",
        },
        "test",
        monday,
      ),
    /already/,
  );
});
test("award rules are editable; new award honors configured points", () => {
  const s = state();
  editRule(
    s,
    {
      id: "award:hanging",
      revision: 1,
      points: 400,
      enabled: true,
      reason: "Future award",
    },
    "test",
    monday,
  );
  award(
    s,
    {
      requestKey: randomUUID(),
      teamId: "axo",
      contest: "hanging",
      evidence: "Official contender result: 90 seconds",
      reason: "Overall winner",
    },
    "test",
    close,
  );
  assert.equal(standings(s).teams[0].bonusPoints, 400);
});
test("cash sales require event window, staff setting and no card fee", () => {
  const s = state();
  assert.throws(() =>
    createOrder(s, orderInput(), "cash", "organizer", monday),
  );
  const door = new Date("2026-11-19T19:00:00-06:00");
  assert.throws(() => createOrder(s, orderInput(), "cash", "organizer", door));
  s.settings[0].offlineSalesEnabled = true;
  const o = createOrder(s, orderInput(), "cash", "organizer", door);
  assert.equal(o.baseCents, 4200);
  assert.equal(o.status, "paid");
  assert.equal(standings(s).teams[0].ticketPoints, 350);
});
test("production rejects simulated payment creation", () => {
  const env = process.env as Record<string, string | undefined>;
  const prior = env.NODE_ENV;
  env.NODE_ENV = "production";
  try {
    assert.throws(
      () => createOrder(state(), orderInput(), "test", "test", monday),
      /disabled/,
    );
  } finally {
    if (prior === void 0) delete env.NODE_ENV;
    else env.NODE_ENV = prior;
  }
});
test("ticket team correction transfers original points and attendance without changing money", () => {
  const s = state();
  const o = createOrder(s, orderInput(["basic"]), "test", "test", monday);
  fulfillOrder(s, o.id, 1e3, "test", monday);
  scanTicket(s, unseal(s.tickets[0].tokenBox), "scanner", monday);
  transferTicket(
    s,
    s.tickets[0].id,
    "dz",
    "Buyer selected wrong team",
    "organizer",
    monday,
  );
  assert.equal(standings(s).teams.find((t) => t.id === "axo")!.ticketPoints, 0);
  assert.equal(
    standings(s).teams.find((t) => t.id === "dz")!.ticketPoints,
    100,
  );
  assert.equal(standings(s).teams.find((t) => t.id === "dz")!.attendance, 1);
  assert.equal(standings(s).fundsRaisedCents, 1e3);
  refundTickets(
    s,
    o.id,
    [s.tickets[0].id],
    0,
    "organizer",
    "Exceptional refund",
    monday,
  );
  assert.equal(standings(s).teams.find((t) => t.id === "dz")!.ticketPoints, 0);
});
test("legacy import dry-run/idempotency preserves provider IDs and known check-ins", () => {
  const s = state();
  const manifest = [
    {
      eventId: "fixture-event",
      attendeeId: "attendee-1",
      name: "Legacy guest",
      email: "legacy@example.test",
      tier: "meat",
      teamId: "zta",
      baseCents: 1500,
      checkedInAt: "2026-11-20T00:05:00.000Z",
    },
  ];
  const dry = structuredClone(s);
  assert.equal(importLegacyTickets(dry, manifest, "test", monday).imported, 1);
  assert.equal(s.orders.length, 0);
  assert.equal(importLegacyTickets(s, manifest, "test", monday).imported, 1);
  assert.equal(importLegacyTickets(s, manifest, "test", monday).skipped, 1);
  assert.equal(standings(s).fundsRaisedCents, 1500);
  assert.equal(standings(s).teams.find((t) => t.id === "zta")!.attendance, 1);
  assert.equal(s.orders[0].providerRef, "eventbrite:fixture-event:attendee-1");
  assert.throws(
    () =>
      importLegacyTickets(
        s,
        [{ ...manifest[0], baseCents: 1 }],
        "test",
        monday,
      ),
    /differs/,
  );
});

test("expired quote stays unpaid; late verified success recovers once; stale expiry cannot undo payment", () => {
  const s = state();
  const o = createOrder(s, orderInput(["basic"]), "test", "test", monday);
  const later = new Date(monday.getTime() + 31 * 60000);
  assert.equal(expireQuotes(s, later), 1);
  assert.equal(o.status, "expired");
  assert.equal(s.tickets[0].valid, false);
  const event = {
    id: "synthetic-paid-event",
    orderId: o.id,
    amountCents: 1000,
    currency: "usd" as const,
    kind: "paid" as const,
  };
  applyVerifiedPaymentEvent(s, event, later);
  applyVerifiedPaymentEvent(s, event, later);
  applyVerifiedPaymentEvent(
    s,
    { ...event, id: "synthetic-stale-expired", kind: "expired" },
    later,
  );
  assert.equal(o.status, "paid");
  assert.equal(s.jobs.length, 1);
  assert.equal(standings(s).teams[0].ticketPoints, 100);
  assert.throws(
    () => applyVerifiedPaymentEvent(s, { ...event, amountCents: 1 }, later),
    /different data/,
  );
});

test("a later dispute cycle cannot leave ticket points active while admission is suspended", () => {
  const s = state();
  const o = createOrder(s, orderInput(["basic"]), "test", "test", monday);
  fulfillOrder(s, o.id, 1000, "test", monday);
  dispute(s, o.id, "open", "test", monday);
  dispute(s, o.id, "won", "test", monday);
  dispute(s, o.id, "open", "test", monday);
  assert.equal(standings(s).teams[0].ticketPoints, 0);
  assert.equal(s.tickets[0].valid, false);
  dispute(s, o.id, "lost", "test", monday);
  assert.equal(standings(s).fundsRaisedCents, 0);
});
