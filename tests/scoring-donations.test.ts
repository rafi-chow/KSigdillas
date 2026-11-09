import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import {
  MemoryStore,
  fakeStripe,
  now,
  testEnvironment,
} from "./integration-fixtures";
import {
  addDonation,
  createOrder,
  fulfillOrder,
  scanTicket,
  standings,
  reverseCheckIn,
  correctAdmission,
  transferTicket,
  reverseEntry,
} from "../src/lib/operations/service";
import { unseal } from "../src/lib/operations/crypto";
import { brotherReport, saveBrother } from "../src/lib/operations/brothers";
import {
  donationLinkId,
  donationPriceId,
  reconcileDonation,
  correctDonation,
} from "../src/lib/payments/donations";
import {
  processStripeWork,
  receiveStripeEvent,
} from "../src/lib/payments/stripe";
import {
  applyScoringPolicy,
  scoringPolicyPreview,
} from "../src/lib/operations/scoringPolicy";
import { PgStore } from "../src/lib/operations/store";
import { testPostgres } from "./postgres";
testEnvironment();
const eventTime = new Date("2026-11-19T19:00:00-06:00");

function donation(cents = 500, chapter = "axo", brother = "") {
  const fake = fakeStripe();
  const id = `cs_test_${randomUUID()}`;
  const session = {
    id,
    livemode: false,
    mode: "payment",
    status: "complete",
    payment_status: "paid",
    payment_link: donationLinkId,
    payment_intent: `pi_${id}`,
    currency: "usd",
    amount_total: cents,
    created: Math.floor(now.getTime() / 1000),
    total_details: { amount_discount: 0, amount_shipping: 0, amount_tax: 0 },
    line_items: {
      has_more: false,
      data: [
        {
          id: "li_gift",
          quantity: 1,
          currency: "usd",
          amount_total: cents,
          price: {
            id: donationPriceId,
            currency: "usd",
            unit_amount: null,
            custom_unit_amount: { minimum: 100 },
          },
        },
      ],
    },
    custom_fields: [
      { key: "chapter", type: "dropdown", dropdown: { value: chapter } },
      { key: "soldby", type: "text", text: { value: brother } },
    ],
  } as unknown as Stripe.Checkout.Session;
  fake.sessions.set(id, session);
  return { fake, session };
}
function paidGuests(store: MemoryStore, count = 3) {
  const order = createOrder(
    store.state,
    {
      requestKey: randomUUID(),
      email: "group@example.test",
      attendees: Array.from({ length: count }, () => ({
        name: "Same Guest Name",
        teamId: "axo",
        tier: "basic",
      })),
    },
    "test",
    "test",
    now,
  );
  fulfillOrder(store.state, order.id, count * 1000, "test", now);
  return store.state.tickets;
}

test("manual and Stripe donations earn proportional points with a $5 minimum per gift", async () => {
  for (const [cents, points] of [
    [100, 0],
    [499, 0],
    [500, 50],
    [501, 50.1],
    [550, 55],
    [700, 70],
    [999, 99.9],
    [1000, 100],
    [1200, 120],
    [1500, 150],
  ]) {
    const manual = new MemoryStore();
    addDonation(
      manual.state,
      {
        requestKey: randomUUID(),
        teamId: "axo",
        cents,
        reference: `Cash receipt ${cents}`,
      },
      "test",
      now,
    );
    const online = new MemoryStore();
    const { fake, session } = donation(cents);
    await reconcileDonation(online, session.id, fake.gateway, now);
    assert.equal(standings(manual.state).teams[0].totalPoints, points);
    assert.equal(standings(online.state).teams[0].totalPoints, points);
    assert.equal(standings(online.state).fundsRaisedCents, cents);
    assert.equal(online.state.tickets.length, 0);
    assert.equal(online.state.orders.length, 0);
    assert.equal(online.state.jobs.length, 0);
  }
  for (const amounts of [
    [300, 200],
    [700, 300],
  ]) {
    const store = new MemoryStore();
    for (const cents of amounts)
      addDonation(
        store.state,
        {
          requestKey: randomUUID(),
          teamId: "axo",
          cents,
          reference: randomUUID(),
        },
        "test",
        now,
      );
    assert.equal(
      standings(store.state).teams[0].totalPoints,
      amounts[0] === 300 ? 0 : 70,
    );
    const online = new MemoryStore();
    for (const cents of amounts) {
      const { fake, session } = donation(cents);
      await reconcileDonation(online, session.id, fake.gateway, now);
    }
    assert.equal(
      standings(online.state).teams[0].totalPoints,
      amounts[0] === 300 ? 0 : 70,
    );
  }
});

test("fractional donation points remain exact across repeated credits and reversals", () => {
  const store = new MemoryStore();
  const receipts = Array.from({ length: 10 }, () =>
    addDonation(
      store.state,
      {
        requestKey: randomUUID(),
        teamId: "axo",
        cents: 501,
        reference: randomUUID(),
      },
      "test",
      now,
    ),
  );
  assert.equal(standings(store.state).teams[0].donationPoints, 501);
  for (const id of receipts.slice(0, 9))
    reverseEntry(
      store.state,
      { requestKey: randomUUID(), id, reason: "Synthetic reversal" },
      "test",
      now,
    );
  assert.equal(standings(store.state).teams[0].donationPoints, 50.1);
  assert.equal(standings(store.state).teams[0].totalPoints, 50.1);
});

test("policy 3 corrects an existing $7 gift from 50 to 70 points once", () => {
  const store = new MemoryStore();
  addDonation(
    store.state,
    {
      requestKey: randomUUID(),
      teamId: "axo",
      cents: 700,
      reference: "Existing gift",
    },
    "test",
    now,
  );
  store.state.settings[0].scoringPolicyVersion = 2;
  store.state.receipts[0].donationPolicy = 2;
  store.state.ledger[0].points = 50;
  const preview = scoringPolicyPreview(store.state);
  assert.equal(preview.alreadyApplied, false);
  const rules = structuredClone(store.state.rules);
  store.state.ledger[0].points = 49;
  assert.throws(
    () => applyScoringPolicy(store.state, preview.fingerprint, "Stale ledger", "test", now),
    /snapshot/,
  );
  store.state.ledger[0].points = 50;
  applyScoringPolicy(
    store.state,
    preview.fingerprint,
    "Organizer clarified points per dollar",
    "test",
    now,
  );
  assert.deepEqual(store.state.rules, rules);
  assert.equal(standings(store.state).teams[0].donationPoints, 70);
  assert.equal(standings(store.state).fundsRaisedCents, 700);
  assert.equal(store.state.receipts[0].donationPolicy, 3);
  const size = store.state.ledger.length;
  applyScoringPolicy(store.state, preview.fingerprint, "Replay", "test", now);
  assert.equal(store.state.ledger.length, size);
});

test("paid donation webhooks replay and arrive out of order without issuing tickets", async () => {
  const store = new MemoryStore();
  const brother = saveBrother(
    store.state,
    {
      name: "Synthetic Thaddeus",
      aliases: ["Thad"],
      active: true,
      revision: 0,
      reason: "Test roster",
    },
    "test",
    now,
  );
  const { fake, session } = donation(1000, "axo", " thad ");
  const intent = fake.event("evt_intent_before_gift", session.id);
  intent.type = "payment_intent.succeeded";
  intent.data.object = { id: session.payment_intent } as never;
  await receiveStripeEvent(store, intent, now);
  await processStripeWork(store, fake.gateway, now);
  assert.equal(store.state.providerEvents[0].status, "review");
  const charge = fake.gateway.charge;
  fake.gateway.charge = async (id) => ({
    ...(await charge(id)),
    receipt_url: "https://pay.stripe.com/receipts/payment/synthetic",
  });
  const paid = fake.event("evt_paid_gift", session.id);
  await Promise.all([
    receiveStripeEvent(store, paid, now),
    receiveStripeEvent(store, paid, now),
  ]);
  await processStripeWork(store, fake.gateway, now);
  await processStripeWork(store, fake.gateway, now);
  await receiveStripeEvent(
    store,
    fake.event("evt_paid_gift_again", session.id),
    now,
  );
  await processStripeWork(store, fake.gateway, now);
  assert.equal(store.state.donations.length, 1);
  assert.equal(store.state.receipts.length, 1);
  assert.equal(
    store.state.donations[0].receiptUrl,
    "https://pay.stripe.com/receipts/payment/synthetic",
  );
  assert.equal(standings(store.state).teams[0].donationPoints, 100);
  assert.equal(
    store.state.providerEvents.every((e) => e.status === "processed"),
    true,
  );
  const row = brotherReport(store.state).rows.find(
    (r) => r.brotherId === brother.id,
  )!;
  assert.equal(row.referredDonationCents, 1000);
  assert.equal(row.referredDonationCount, 1);
  assert.equal(row.personallyDonatedCents, 0);
  assert.equal(row.ticketsSold, 0);
  assert.equal(store.state.jobs.length, 0);
});

test("partial refunds cross the $5 threshold; dispute loss suspends and a win restores only net eligible funds", async () => {
  const store = new MemoryStore();
  const { fake, session } = donation(1000);
  await reconcileDonation(store, session.id, fake.gateway, now);
  const refund = {
    id: "re_partial_gift",
    charge: `ch_${session.id}`,
    currency: "usd",
    amount: 501,
    status: "succeeded",
  } as Stripe.Refund;
  fake.refunds.push(refund);
  await reconcileDonation(store, session.id, fake.gateway, now);
  assert.equal(standings(store.state).fundsRaisedCents, 499);
  assert.equal(standings(store.state).teams[0].donationPoints, 0);
  fake.refunds[0].amount = 300;
  await reconcileDonation(store, session.id, fake.gateway, now);
  assert.equal(standings(store.state).teams[0].donationPoints, 70);
  fake.refunds[0].amount = 500;
  await reconcileDonation(store, session.id, fake.gateway, now);
  assert.equal(standings(store.state).teams[0].donationPoints, 50);
  fake.disputes.push({
    id: "dp_gift",
    charge: `ch_${session.id}`,
    status: "needs_response",
    created: 100,
  } as Stripe.Dispute);
  await reconcileDonation(store, session.id, fake.gateway, now);
  assert.equal(standings(store.state).fundsRaisedCents, 0);
  assert.equal(standings(store.state).teams[0].donationPoints, 0);
  fake.disputes[0].status = "lost";
  await reconcileDonation(store, session.id, fake.gateway, now);
  assert.equal(standings(store.state).teams[0].donationPoints, 0);
  fake.disputes[0].status = "won";
  await reconcileDonation(store, session.id, fake.gateway, now);
  assert.equal(standings(store.state).fundsRaisedCents, 500);
  assert.equal(standings(store.state).teams[0].donationPoints, 50);
  fake.refunds[0].amount = 1000;
  await reconcileDonation(store, session.id, fake.gateway, now);
  await reconcileDonation(store, session.id, fake.gateway, now);
  assert.equal(standings(store.state).fundsRaisedCents, 0);
  assert.equal(standings(store.state).teams[0].donationPoints, 0);
});

test("unpaid and invalid donation sessions cannot create financial records", async () => {
  for (const mutate of [
    (s: Stripe.Checkout.Session) => {
      s.payment_status = "unpaid";
    },
    (s: Stripe.Checkout.Session) => {
      s.payment_link = "plink_other";
    },
    (s: Stripe.Checkout.Session) => {
      s.livemode = true;
    },
    (s: Stripe.Checkout.Session) => {
      s.currency = "eur";
    },
    (s: Stripe.Checkout.Session) => {
      s.line_items!.data[0].price!.id = "price_other";
    },
    (s: Stripe.Checkout.Session) => {
      s.line_items!.data[0].quantity = 2;
    },
    (s: Stripe.Checkout.Session) => {
      s.line_items!.has_more = true;
    },
    (s: Stripe.Checkout.Session) => {
      s.amount_total = 501;
    },
  ]) {
    const store = new MemoryStore();
    const { fake, session } = donation();
    mutate(session);
    try {
      await reconcileDonation(store, session.id, fake.gateway, now);
    } catch {
      /* Expected validation rejection. */
    }
    assert.equal(store.state.receipts.length, 0);
    assert.equal(store.state.donations.length, 0);
    assert.equal(standings(store.state).fundsRaisedCents, 0);
  }
});

test("delayed payment succeeds once; no-chapter funds and unknown attribution stay distinct", async () => {
  const store = new MemoryStore();
  const { fake, session } = donation(1000, "none", "Unknown referral");
  session.payment_status = "unpaid";
  await receiveStripeEvent(
    store,
    fake.event("evt_unpaid_donation", session.id),
    now,
  );
  await processStripeWork(store, fake.gateway, now);
  assert.equal(store.state.donations.length, 0);
  assert.equal(store.state.providerEvents[0].status, "processed");
  session.payment_status = "paid";
  const event = fake.event("evt_async_donation", session.id);
  event.type = "checkout.session.async_payment_succeeded";
  await receiveStripeEvent(store, event, now);
  await processStripeWork(store, fake.gateway, now);
  assert.equal(standings(store.state).fundsRaisedCents, 1000);
  assert.equal(
    standings(store.state).teams.reduce((n, t) => n + t.totalPoints, 0),
    0,
  );
  assert.deepEqual(store.state.donations[0].review, [
    "Brother referral needs review",
  ]);
  correctDonation(
    store.state,
    {
      id: session.id,
      revision: store.state.donations[0].revision,
      teamId: "dz",
      brotherId: null,
      reason: "Donor confirmed chapter",
    },
    "organizer",
    now,
  );
  assert.equal(
    standings(store.state).teams.find((t) => t.id === "dz")!.donationPoints,
    100,
  );
  assert.equal(standings(store.state).fundsRaisedCents, 1000);
  await reconcileDonation(store, session.id, fake.gateway, now);
  assert.equal(store.state.donations[0].teamId, "dz");
  assert.throws(
    () =>
      reverseEntry(
        store.state,
        {
          id: store.state.receipts[0].id,
          requestKey: randomUUID(),
          reason: "Wrong control",
        },
        "organizer",
        now,
      ),
    /Stripe reconciliation/,
  );
});

test("manual provider references cannot duplicate automatic Stripe donations", async () => {
  const store = new MemoryStore();
  const { fake, session } = donation();
  assert.throws(
    () =>
      addDonation(
        store.state,
        {
          requestKey: randomUUID(),
          teamId: "axo",
          cents: 500,
          reference: session.id,
        },
        "test",
        now,
      ),
    /automatically/,
  );
  // Historic manual entry recorded before the guard was introduced.
  const receipt = addDonation(
    store.state,
    {
      requestKey: randomUUID(),
      teamId: "axo",
      cents: 500,
      reference: "Old receipt",
    },
    "test",
    now,
  );
  store.state.receipts[0].reference = session.id;
  await assert.rejects(
    reconcileDonation(store, session.id, fake.gateway, now),
    /manually recorded/,
  );
  assert.equal(store.state.receipts[0].id, receipt);
  assert.equal(store.state.receipts.length, 1);
  assert.equal(standings(store.state).fundsRaisedCents, 500);
  reverseEntry(
    store.state,
    {
      id: receipt,
      requestKey: randomUUID(),
      reason: "Replace old manual record with authenticated Stripe receipt",
    },
    "organizer",
    now,
  );
  await reconcileDonation(store, session.id, fake.gateway, now);
  assert.equal(standings(store.state).fundsRaisedCents, 500);
  assert.equal(standings(store.state).teams[0].donationPoints, 50);
});

test("attendance counts people by admission ID, supports distinct group guests, linking and reversal", () => {
  const store = new MemoryStore();
  const tickets = paidGuests(store);
  const scan = (i: number, code: string) =>
    scanTicket(store.state, unseal(tickets[i].tokenBox), "scanner", eventTime, {
      admissionCode: code,
    });
  assert.equal(scan(0, "W001").admitted, true);
  assert.equal(scan(0, "W002").admitted, false);
  assert.equal(scan(1, "w001").admitted, false);
  assert.equal(standings(store.state).attendance, 1);
  assert.equal(scan(2, "W002").admitted, true);
  assert.equal(standings(store.state).attendance, 2);
  correctAdmission(
    store.state,
    tickets[2].id,
    "W001",
    "Same person had another ticket",
    "organizer",
    eventTime,
  );
  assert.equal(standings(store.state).attendance, 1);
  transferTicket(
    store.state,
    tickets[0].id,
    "dz",
    "Chapter corrected",
    "organizer",
    eventTime,
  );
  assert.equal(
    standings(store.state).teams.find((t) => t.id === "dz")!.attendance,
    1,
  );
  for (const t of tickets)
    reverseCheckIn(store.state, t.id, "Correction", "organizer", eventTime);
  assert.equal(standings(store.state).attendance, 0);
  assert.equal(scan(0, "W001").admitted, true);
  assert.equal(standings(store.state).attendance, 1);
});

test("rehearsals preserve unused tickets; event boundaries and override are explicit", () => {
  const store = new MemoryStore();
  const tickets = paidGuests(store, 1);
  const token = unseal(tickets[0].tokenBox);
  assert.throws(
    () =>
      scanTicket(store.state, token, "scanner", now, { admissionCode: "W001" }),
    /outside event hours/,
  );
  scanTicket(store.state, token, "scanner", now, { rehearsal: true });
  assert.equal(tickets[0].checkedInAt, null);
  assert.equal(standings(store.state).attendance, 0);
  assert.throws(
    () => scanTicket(store.state, token, "scanner", eventTime),
    /admission ID is required/,
  );
  for (const time of [
    "2026-11-19T18:00:00-06:00",
    "2026-11-19T21:00:00-06:00",
  ]) {
    assert.equal(
      scanTicket(store.state, token, "scanner", new Date(time), {
        admissionCode: "W001",
      }).admitted,
      true,
    );
    reverseCheckIn(
      store.state,
      tickets[0].id,
      "Boundary test",
      "test",
      eventTime,
    );
  }
  assert.throws(
    () =>
      scanTicket(
        store.state,
        token,
        "scanner",
        new Date("2026-11-19T21:00:01-06:00"),
        { admissionCode: "W001" },
      ),
    /outside event hours/,
  );
});

test("scoring migration rejects stale snapshots and preserves pre-event rehearsal evidence and paid tickets", () => {
  const store = new MemoryStore();
  const tickets = paidGuests(store, 1);
  delete store.state.settings[0].scoringPolicyVersion;
  tickets[0].checkedInAt = now.toISOString();
  tickets[0].checkedInBy = "old-scanner";
  const preview = scoringPolicyPreview(store.state);
  assert.equal(preview.rehearsalCheckIns.length, 1);
  assert.throws(
    () => applyScoringPolicy(store.state, "stale", "Reviewed", "test", now),
    /snapshot/,
  );
  applyScoringPolicy(
    store.state,
    preview.fingerprint,
    "Reviewed pre-event rehearsal",
    "test",
    now,
  );
  assert.equal(tickets[0].checkedInAt, null);
  assert.equal(tickets[0].rehearsalAt, now.toISOString());
  assert.equal(tickets[0].valid, true);
  assert.equal(store.state.orders[0].status, "paid");
  assert.equal(standings(store.state).fundsRaisedCents, 1000);
  assert.equal(store.state.settings[0].scoringPolicyVersion, 3);
});

test("policy migration adjusts historical pooled donation points once and flags existing daily awards", () => {
  const store = new MemoryStore();
  delete store.state.settings[0].scoringPolicyVersion;
  for (const cents of [300, 200])
    addDonation(
      store.state,
      {
        requestKey: randomUUID(),
        teamId: "axo",
        cents,
        reference: randomUUID(),
      },
      "test",
      now,
    );
  store.state.ledger.push({
    id: randomUUID(),
    source: "historic-pooled-donation",
    teamId: "axo",
    category: "giving",
    rule: "donation",
    ruleRevision: 1,
    points: 50,
    quantity: 1,
    day: "2026-11-16",
    operator: "old-code",
    reason: "Old combined $5 credit",
    createdAt: now.toISOString(),
  });
  store.state.awards.push({
    id: "old-daily",
    contest: "food:2026-11-16",
    teamId: "axo",
    points: 500,
    revision: 1,
    createdAt: now.toISOString(),
    operator: "test",
    reason: "Previous policy",
  });
  assert.equal(standings(store.state).teams[0].donationPoints, 50);
  const preview = scoringPolicyPreview(store.state);
  applyScoringPolicy(
    store.state,
    preview.fingerprint,
    "Reviewed policy change",
    "test",
    now,
  );
  assert.equal(standings(store.state).teams[0].donationPoints, 0);
  assert.equal(standings(store.state).fundsRaisedCents, 500);
  assert.equal(store.state.awards[0].reviewRequired, true);
  const ledgerSize = store.state.ledger.length;
  applyScoringPolicy(store.state, preview.fingerprint, "Repeat", "test", now);
  assert.equal(store.state.ledger.length, ledgerSize);
});

test("Postgres serializes concurrent donation imports and simultaneous admissions", async () => {
  const pg = await testPostgres();
  const a = new PgStore(pg.url);
  const b = new PgStore(pg.url);
  try {
    await a.migrate();
    const { fake, session } = donation(1000);
    await Promise.all([
      reconcileDonation(a, session.id, fake.gateway, now),
      reconcileDonation(b, session.id, fake.gateway, now),
    ]);
    let state = await a.read();
    assert.equal(state.receipts.length, 1);
    assert.equal(standings(state).fundsRaisedCents, 1000);
    assert.equal(standings(state).teams[0].donationPoints, 100);
    const order = await a.transaction((s) => {
      const order = createOrder(
        s,
        {
          requestKey: randomUUID(),
          email: "group@example.test",
          attendees: [
            { name: "A", teamId: "axo", tier: "basic" },
            { name: "B", teamId: "axo", tier: "basic" },
          ],
        },
        "test",
        "test",
        now,
      );
      fulfillOrder(s, order.id, 2000, "test", now);
      return order;
    });
    state = await a.read();
    const results = await Promise.all(
      order.ticketIds.map((id, i) =>
        (i ? b : a).transaction((s) =>
          scanTicket(
            s,
            unseal(s.tickets.find((t) => t.id === id)!.tokenBox),
            "scanner",
            eventTime,
            { admissionCode: "W001" },
          ),
        ),
      ),
    );
    assert.equal(results.filter((r) => r.admitted).length, 1);
    assert.equal(standings(await b.read()).attendance, 1);
  } finally {
    await a.close();
    await b.close();
    await pg.instance.stop();
  }
});
