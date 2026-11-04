import { before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MemoryStore, now, testEnvironment } from "./integration-fixtures";
import {
  allocateDonation,
  brotherReport,
  brotherCsv,
  correctSeller,
  resolveBrother,
  saveBrother,
} from "../src/lib/operations/brothers";
import {
  createOrder,
  fulfillOrder,
  addDonation,
  addEntry,
  refundTickets,
  reverseEntry,
  scanTicket,
  standings,
  transferTicket,
} from "../src/lib/operations/service";
import { unseal } from "../src/lib/operations/crypto";
before(testEnvironment);
function fixture() {
  const s = new MemoryStore().state;
  const a = saveBrother(
    s,
    {
      name: "Brother A",
      aliases: ["A"],
      active: true,
      revision: 0,
      reason: "Synthetic roster",
    },
    "test",
    now,
  );
  const b = saveBrother(
    s,
    {
      name: "Brother B",
      aliases: ["B"],
      active: true,
      revision: 0,
      reason: "Synthetic roster",
    },
    "test",
    now,
  );
  return { s, a, b };
}
test("brother sales, personal money, food, reversal and seller correction reconcile independently", () => {
  const { s, a, b } = fixture();
  const o = createOrder(
    s,
    {
      requestKey: randomUUID(),
      email: "synthetic@example.test",
      sellerBrotherId: a.id,
      attendees: ["basic", "basic", "meat"].map((tier, i) => ({
        name: `Guest ${i}`,
        tier,
        teamId: "axo",
      })),
    },
    "test",
    "test",
    now,
    123,
  );
  fulfillOrder(s, o.id, 3623, "test", now);
  const row = (id: string) =>
    brotherReport(s).rows.find((r) => r.brotherId === id)!;
  assert.deepEqual(
    [
      row(a.id).ticketsSold,
      row(a.id).ticketRevenueCents,
      row(a.id).personallyDonatedCents,
    ],
    [3, 3500, 0],
  );
  addDonation(
    s,
    {
      requestKey: randomUUID(),
      teamId: "axo",
      cents: 700,
      reference: "Gift 7",
      donorBrotherId: a.id,
    },
    "test",
    now,
  );
  const gift = addDonation(
    s,
    {
      requestKey: randomUUID(),
      teamId: "axo",
      cents: 300,
      reference: "Gift 3",
      donorBrotherId: a.id,
    },
    "test",
    now,
  );
  assert.equal(row(a.id).personallyDonatedCents, 1000);
  assert.equal(
    standings(s).teams.find((t) => t.id === "axo")!.donationPoints,
    100,
  );
  reverseEntry(
    s,
    { id: gift, requestKey: randomUUID(), reason: "Gift reversed" },
    "test",
    now,
  );
  assert.equal(row(a.id).personallyDonatedCents, 700);
  assert.equal(
    standings(s).teams.find((t) => t.id === "axo")!.donationPoints,
    50,
  );
  const food = addEntry(
    s,
    {
      requestKey: randomUUID(),
      teamId: "axo",
      ruleId: "cheese",
      quantity: 2,
      day: "2026-11-16",
      reference: "Cheese",
      paymentVerified: false,
      donorBrotherId: a.id,
    },
    "test",
    now,
  );
  addEntry(
    s,
    {
      requestKey: randomUUID(),
      teamId: null,
      ruleId: "water",
      quantity: 1,
      day: "2026-11-17",
      reference: "Water",
      paymentVerified: false,
      donorBrotherId: a.id,
    },
    "test",
    now,
  );
  assert.equal(
    Object.values(row(a.id).goods).reduce((n, r) => n + r.points, 0),
    200,
  );
  assert.equal(standings(s).fundsRaisedCents, 4200);
  refundTickets(
    s,
    o.id,
    [o.ticketIds[0]],
    0,
    "test",
    "Exceptional refund",
    now,
  );
  correctSeller(
    s,
    { id: o.id, brotherId: b.id, revision: 0, reason: "Correct buyer answer" },
    "test",
    now,
  );
  assert.equal(row(a.id).ticketsSold, 0);
  assert.deepEqual(
    [row(b.id).ticketsSold, row(b.id).ticketRevenueCents],
    [2, 2500],
  );
  assert.equal(row(a.id).personallyDonatedCents, 700);
  assert.equal(
    standings(s).teams.find((t) => t.id === "axo")!.ticketPoints,
    250,
  );
  const t = s.tickets.find((t) => t.id === o.ticketIds[1])!;
  scanTicket(s, unseal(t.tokenBox), "scanner", now);
  transferTicket(s, t.id, "dz", "Correct team", "test", now);
  assert.equal(row(b.id).ticketsSold, 2);
  reverseEntry(
    s,
    { id: food, requestKey: randomUUID(), reason: "Returned cheese" },
    "test",
    now,
  );
  assert.equal(
    Object.values(row(a.id).goods).reduce((n, r) => n + r.points, 0),
    50,
  );
  assert.throws(
    () =>
      correctSeller(
        s,
        { id: o.id, brotherId: a.id, revision: 0, reason: "Conflicting edit" },
        "test",
        now,
      ),
    /changed/,
  );
});
test("aliases, ambiguity, archives, malicious CSV and unknown IDs are handled without guessing", () => {
  const { s, a, b } = fixture();
  assert.equal(resolveBrother(s, "  BROTHER   A "), a.id);
  assert.equal(resolveBrother(s, "A"), a.id);
  assert.equal(resolveBrother(s, "Alex"), null);
  saveBrother(
    s,
    {
      id: a.id,
      name: "Brother A",
      aliases: ["Alex"],
      active: true,
      revision: 1,
      reason: "Alias",
    },
    "test",
    now,
  );
  saveBrother(
    s,
    {
      id: b.id,
      name: "=UNTRUSTED()",
      aliases: ["Alex"],
      active: false,
      revision: 1,
      reason: "Archive",
    },
    "test",
    now,
  );
  assert.equal(resolveBrother(s, "Alex"), null);
  assert.match(brotherCsv(s), /"'=UNTRUSTED\(\)"/);
  assert.throws(
    () =>
      createOrder(
        s,
        {
          requestKey: randomUUID(),
          email: "x@example.test",
          sellerBrotherId: b.id,
          attendees: [{ name: "X", teamId: null, tier: "basic" }],
        },
        "test",
        "test",
        now,
      ),
    /archived/,
  );
});
test("joint gifts enforce allocation bounds and donor corrections do not alter team money or points", () => {
  const { s, a, b } = fixture();
  const id = addDonation(
    s,
    {
      requestKey: randomUUID(),
      teamId: null,
      cents: 2000,
      reference: "Joint gift",
    },
    "test",
    now,
  );
  const base = {
    id,
    kind: "receipt",
    revision: 0,
    reason: "Verified shared donors",
  };
  assert.throws(
    () =>
      allocateDonation(
        s,
        {
          ...base,
          allocations: [
            { brotherId: a.id, units: 1200 },
            { brotherId: b.id, units: 1200 },
          ],
        },
        "test",
        now,
      ),
    /exceed/,
  );
  allocateDonation(
    s,
    {
      ...base,
      allocations: [
        { brotherId: a.id, units: 1200 },
        { brotherId: b.id, units: 800 },
      ],
    },
    "test",
    now,
  );
  assert.equal(
    brotherReport(s).rows.find((r) => r.brotherId === a.id)!
      .personallyDonatedCents,
    1200,
  );
  assert.equal(standings(s).fundsRaisedCents, 2000);
  assert.equal(s.ledger.length, 0);
  assert.throws(
    () => allocateDonation(s, { ...base, allocations: [] }, "test", now),
    /changed/,
  );
  assert.throws(
    () =>
      addDonation(
        s,
        {
          requestKey: randomUUID(),
          teamId: null,
          cents: 2000,
          reference: "Joint gift",
        },
        "test",
        now,
      ),
    /already/,
  );
});
