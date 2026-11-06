import { before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  MemoryStore,
  fakeStripe,
  testEnvironment,
  now,
} from "./integration-fixtures";
import { importPaymentLinkSession } from "../src/lib/payments/import";
import {
  startCheckout,
  reconcileSession,
  receiveStripeEvent,
  processStripeWork,
} from "../src/lib/payments/stripe";
import {
  approvedPaymentLinkUrl,
  currentPaymentLinkUrl,
  historicalPaymentLinkUrls,
  paymentLinkPrices,
  paymentLinkAvailable,
  currentPaymentLinkId,
  currentPaymentLinkPriceIds,
} from "../src/lib/payments/paymentLink";
import { ticketEmail } from "../src/lib/email/delivery";
import {
  saveBrother,
  brotherReport,
  correctSeller,
} from "../src/lib/operations/brothers";
import { standings } from "../src/lib/operations/service";
before(testEnvironment);
test("verified standalone Payment Link sale imports once, preserves unresolved names and seller corrections", async () => {
  const store = new MemoryStore();
  const fake = fakeStripe();
  await startCheckout(
    store,
    {
      requestKey: randomUUID(),
      termsVersion: "2026-11-03-v1",
      email: "buyer@example.test",
      attendees: [
        { name: "First", teamId: "axo", tier: "basic" },
        { name: "Second", teamId: "axo", tier: "meat" },
      ],
    },
    "hosted",
    fake.gateway,
    now,
  );
  const session = [...fake.sessions.values()][0];
  fake.pay(session.id);
  session.payment_link = "plink_event";
  session.client_reference_id = null;
  session.metadata = {};
  session.custom_fields = [
    {
      key: "chapter",
      type: "dropdown",
      label: { type: "custom", custom: "Chapter" },
      optional: true,
      dropdown: {
        value: "axo",
        default_value: null,
        options: [{ label: "AXO", value: "axo" }],
      },
    },
    {
      key: "soldby",
      type: "text",
      label: { type: "custom", custom: "Brother" },
      optional: true,
      text: {
        value: "  Sam  ",
        default_value: null,
        maximum_length: null,
        minimum_length: null,
      },
    },
  ];
  session.customer_details = {
    email: "buyer@example.test",
    name: "Buyer name",
  } as typeof session.customer_details;
  session.created = Math.floor(now.getTime() / 1000);
  session.amount_total = 2500;
  session.line_items!.data = session.line_items!.data.filter(
    (i) => i.description !== "Processing fee",
  );
  const target = new MemoryStore();
  const b = saveBrother(
    target.state,
    {
      name: "Synthetic Sam",
      aliases: ["Sam"],
      active: true,
      revision: 0,
      reason: "Synthetic roster",
    },
    "test",
    now,
  );
  const result = await target.transaction((s) =>
    importPaymentLinkSession(s, session, "plink_event", now),
  );
  await reconcileSession(target, session.id, fake.gateway, now);
  assert.equal(standings(target.state).fundsRaisedCents, 2500);
  assert.equal(
    brotherReport(target.state).rows.find((r) => r.brotherId === b.id)!
      .ticketsSold,
    2,
  );
  assert.match(target.state.tickets[1].name, /name pending/);
  correctSeller(
    target.state,
    {
      id: result.orderId,
      brotherId: null,
      revision: 0,
      reason: "Buyer correction",
    },
    "organizer",
    now,
  );
  assert.equal(
    importPaymentLinkSession(target.state, session, "plink_event", now)
      .imported,
    false,
  );
  assert.equal(target.state.orders.length, 1);
  assert.equal(target.state.orders[0].sellerBrotherId, null);
  assert.equal(target.state.orders[0].sellerRaw, "  Sam  ");
  assert.throws(
    () =>
      importPaymentLinkSession(
        new MemoryStore().state,
        session,
        "plink_other",
        now,
      ),
    /eligible/,
  );
});
test("unknown products and unpaid sessions cannot leave partial imported records", async () => {
  const store = new MemoryStore();
  const fake = fakeStripe();
  await startCheckout(
    store,
    {
      requestKey: randomUUID(),
      termsVersion: "2026-11-03-v1",
      email: "buyer@example.test",
      attendees: [{ name: "First", teamId: null, tier: "basic" }],
    },
    "hosted",
    fake.gateway,
    now,
  );
  const session = [...fake.sessions.values()][0];
  session.payment_link = "plink_event";
  const target = new MemoryStore();
  await assert.rejects(
    target.transaction((s) =>
      importPaymentLinkSession(s, session, "plink_event", now),
    ),
    /eligible/,
  );
  fake.pay(session.id);
  session.line_items!.data[0].price!.id = "price_unrelated";
  await assert.rejects(
    target.transaction((s) =>
      importPaymentLinkSession(s, session, "plink_event", now),
    ),
  );
  assert.equal(target.state.orders.length, 0);
  assert.equal(target.state.tickets.length, 0);
});

async function bundledSale() {
  const fake = fakeStripe();
  await startCheckout(
    new MemoryStore(),
    {
      requestKey: randomUUID(),
      termsVersion: "2026-11-03-v1",
      email: "buyer@example.test",
      attendees: [
        { name: "First", teamId: "axo", tier: "basic" },
        { name: "Second", teamId: "axo", tier: "basic" },
        { name: "Third", teamId: "axo", tier: "meat" },
      ],
    },
    "hosted",
    fake.gateway,
    now,
  );
  const session = [...fake.sessions.values()][0];
  fake.pay(session.id);
  session.payment_link = "plink_current";
  session.client_reference_id = null;
  session.metadata = {};
  session.custom_fields = [
    {
      key: "chapter",
      type: "dropdown",
      label: { type: "custom", custom: "Chapter" },
      optional: false,
      dropdown: {
        value: "axo",
        default_value: null,
        options: [{ label: "AXO", value: "axo" }],
      },
    },
    {
      key: "soldby",
      type: "text",
      label: { type: "custom", custom: "Brother" },
      optional: true,
      text: {
        value: "Sam",
        default_value: null,
        maximum_length: null,
        minimum_length: null,
      },
    },
  ];
  session.customer_details = {
    email: "buyer@example.test",
    name: "Buyer",
  } as typeof session.customer_details;
  session.created = Math.floor(now.getTime() / 1000);
  session.line_items!.data = session.line_items!.data.filter(
    (i) => i.description !== "Processing fee",
  );
  for (const item of session.line_items!.data) {
    const basic = item.price!.id === "price_basic";
    item.price!.id = basic ? "price_link_basic" : "price_link_meat";
    item.price!.unit_amount = basic ? 1061 : 1576;
    item.amount_total = item.quantity! * item.price!.unit_amount;
  }
  session.amount_total = 3698;
  return { fake, session };
}

function configureLink(t: { after: (fn: () => void) => void }) {
  const keys = [
    "STRIPE_LINK_PRICE_BASIC",
    "STRIPE_LINK_PRICE_MEAT",
    "STRIPE_PAYMENT_LINK_ENABLED",
    "STRIPE_PAYMENT_LINK_ID",
    "STRIPE_CHECKOUT_ENABLED",
    "STRIPE_LINK_TAX_INCLUDED",
  ];
  const old = keys.map((k) => process.env[k]);
  t.after(() =>
    keys.forEach((k, i) => {
      if (old[i] === undefined) delete process.env[k];
      else process.env[k] = old[i];
    }),
  );
  process.env.STRIPE_LINK_PRICE_BASIC = "price_link_basic";
  process.env.STRIPE_LINK_PRICE_MEAT = "price_link_meat";
  process.env.STRIPE_LINK_TAX_INCLUDED = "false";
}

async function inclusiveSale(t: { after: (fn: () => void) => void }) {
  configureLink(t);
  const result = await bundledSale();
  process.env.STRIPE_LINK_TAX_INCLUDED = "true";
  result.session.automatic_tax = {
    enabled: true,
    status: "complete",
    liability: null,
    provider: "stripe",
  };
  for (const item of result.session.line_items!.data) {
    const basic = item.price!.id === "price_link_basic";
    item.price!.unit_amount = basic ? 1158 : 1720;
    item.price!.tax_behavior = "inclusive";
    item.amount_total = item.quantity! * item.price!.unit_amount;
    item.amount_tax = basic ? 177 : 131;
  }
  result.session.total_details!.amount_tax = 308;
  result.session.amount_total = 4036;
  return result;
}

test("current tax-inclusive link fulfills once, emails every QR, excludes tax from funds and reconciles a full refund", async (t) => {
  const { fake, session } = await inclusiveSale(t);
  process.env.STRIPE_PAYMENT_LINK_ENABLED = "true";
  process.env.STRIPE_PAYMENT_LINK_ID = "plink_current";
  process.env.STRIPE_CHECKOUT_ENABLED = "false";
  const target = new MemoryStore();
  const event = fake.event("evt_tax_paid", session.id);
  await receiveStripeEvent(target, event, now);
  await processStripeWork(target, fake.gateway, now);
  await receiveStripeEvent(
    target,
    fake.event("evt_tax_repeated", session.id),
    now,
  );
  await processStripeWork(target, fake.gateway, now);
  assert.equal(target.state.orders.length, 1);
  const order = target.state.orders[0];
  assert.equal(order.taxCents, 308);
  assert.equal(order.feeCents, 228);
  assert.equal(order.baseCents, 3500);
  assert.equal(order.totalCents, 4036);
  assert.equal(order.status, "paid");
  assert.equal(standings(target.state).fundsRaisedCents, 3500);
  assert.equal(target.state.jobs.length, 1);
  const email = await ticketEmail(target.state, target.state.jobs[0]);
  assert.equal(email.attachments.length, 3);
  assert.equal(
    target.state.providerEvents.every((e) => e.status === "processed"),
    true,
  );
  fake.refunds.push({
    id: "re_inclusive_full",
    charge: `ch_${session.id}`,
    currency: "usd",
    amount: 4036,
    status: "succeeded",
    metadata: {},
  } as never);
  await reconcileSession(target, session.id, fake.gateway, now);
  await reconcileSession(target, session.id, fake.gateway, now);
  assert.equal(target.state.orders[0].status, "refunded");
  assert.equal(target.state.orders[0].refundedBaseCents, 3500);
  assert.equal(target.state.orders[0].refundedFeeCents, 228);
  assert.equal(target.state.orders[0].refundedTaxCents, 308);
  assert.equal(standings(target.state).fundsRaisedCents, 0);
  assert.equal(
    target.state.tickets.some((t) => t.valid),
    false,
  );
});

test("unresolved or inconsistent inclusive tax cannot issue tickets", async (t) => {
  const { session } = await inclusiveSale(t);
  for (const mutate of [
    (s: typeof session) => {
      s.automatic_tax.status = "failed";
    },
    (s: typeof session) => {
      s.total_details!.amount_tax++;
    },
    (s: typeof session) => {
      s.line_items!.data[0].price!.tax_behavior = "exclusive";
    },
    (s: typeof session) => {
      s.line_items!.data[0].amount_tax = -1;
    },
  ]) {
    const invalid = structuredClone(session);
    mutate(invalid);
    const target = new MemoryStore();
    await assert.rejects(
      target.transaction((s) =>
        importPaymentLinkSession(s, invalid, "plink_current", now),
      ),
      /tax/,
    );
    assert.equal(target.state.orders.length, 0);
    assert.equal(target.state.tickets.length, 0);
    assert.equal(target.state.jobs.length, 0);
  }
});

test("abandoned and delayed unpaid link sessions do not issue tickets or create false alerts", async (t) => {
  const { fake, session } = await inclusiveSale(t);
  process.env.STRIPE_PAYMENT_LINK_ENABLED = "true";
  process.env.STRIPE_PAYMENT_LINK_ID = "plink_current";
  session.payment_status = "unpaid";
  const target = new MemoryStore();
  await receiveStripeEvent(
    target,
    fake.event("evt_delayed_payment", session.id),
    now,
  );
  await processStripeWork(target, fake.gateway, now);
  assert.equal(target.state.orders.length, 0);
  assert.equal(target.state.providerEvents[0].status, "processed");
  session.status = "expired";
  const expired = fake.event("evt_abandoned_link", session.id);
  expired.type = "checkout.session.expired";
  await receiveStripeEvent(target, expired, now);
  await processStripeWork(target, fake.gateway, now);
  assert.equal(target.state.jobs.length, 0);
  assert.equal(
    target.state.providerEvents.every((e) => e.status === "processed"),
    true,
  );
  session.status = "complete";
  session.payment_status = "paid";
  const paid = fake.event("evt_async_link_paid", session.id);
  paid.type = "checkout.session.async_payment_succeeded";
  await receiveStripeEvent(target, paid, now);
  await processStripeWork(target, fake.gateway, now);
  assert.equal(target.state.orders.length, 1);
  assert.equal(target.state.tickets.filter((t) => t.valid).length, 3);
});

test("payment-intent events arriving before checkout recover their association without clearing unrelated review", async (t) => {
  const { fake, session } = await inclusiveSale(t);
  process.env.STRIPE_PAYMENT_LINK_ENABLED = "true";
  process.env.STRIPE_PAYMENT_LINK_ID = "plink_current";
  const target = new MemoryStore();
  const intent = fake.event("evt_intent_first", session.id);
  intent.type = "payment_intent.succeeded";
  intent.data.object = { id: session.payment_intent } as never;
  await receiveStripeEvent(target, intent, now);
  await processStripeWork(target, fake.gateway, now);
  assert.equal(target.state.providerEvents[0].status, "review");
  await receiveStripeEvent(
    target,
    fake.event("evt_checkout_later", session.id),
    now,
  );
  await processStripeWork(target, fake.gateway, now);
  assert.equal(target.state.providerEvents[0].status, "pending");
  await processStripeWork(target, fake.gateway, now);
  assert.equal(
    target.state.providerEvents.every((e) => e.status === "processed"),
    true,
  );
  assert.equal(target.state.orders.length, 1);
  assert.equal(target.state.jobs.length, 1);
});

test("hosted link allows its actual maximum quantities and closes website entry at presale cutoff", async (t) => {
  const { session } = await inclusiveSale(t);
  for (const item of session.line_items!.data) {
    item.quantity = 99;
    item.amount_total = 99 * item.price!.unit_amount!;
    item.amount_tax = 10000;
  }
  session.amount_total = 284922;
  session.total_details!.amount_tax = 20000;
  const target = new MemoryStore();
  await target.transaction((s) =>
    importPaymentLinkSession(s, session, "plink_current", now),
  );
  assert.equal(target.state.tickets.length, 198);
  process.env.STRIPE_PAYMENT_LINK_ENABLED = "true";
  process.env.STRIPE_PAYMENT_LINK_ID = currentPaymentLinkId;
  process.env.STRIPE_LINK_PRICE_BASIC = currentPaymentLinkPriceIds.basic;
  process.env.STRIPE_LINK_PRICE_MEAT = currentPaymentLinkPriceIds.meat;
  assert.equal(
    paymentLinkAvailable(new Date("2026-11-19T17:59:59-06:00")),
    true,
  );
  assert.equal(
    paymentLinkAvailable(new Date("2026-11-19T18:00:00-06:00")),
    false,
  );
  process.env.STRIPE_LINK_PRICE_MEAT = "price_unreviewed";
  assert.equal(paymentLinkAvailable(now), false);
});

test("current and historical links are explicit; bundled catalog must be complete and distinct", (t) => {
  configureLink(t);
  assert.equal(approvedPaymentLinkUrl(currentPaymentLinkUrl), true);
  assert.equal(approvedPaymentLinkUrl(historicalPaymentLinkUrls[0]), true);
  assert.equal(
    approvedPaymentLinkUrl("https://buy.stripe.com/unrelated"),
    false,
  );
  process.env.STRIPE_LINK_PRICE_MEAT = "";
  assert.throws(paymentLinkPrices, /both distinct/);
  process.env.STRIPE_LINK_PRICE_MEAT = "price_link_basic";
  assert.throws(paymentLinkPrices, /both distinct/);
});

test("fee-inclusive link imports preserve base revenue, chapter points, brother credit and full-refund allocation", async (t) => {
  configureLink(t);
  const { fake, session } = await bundledSale();
  const target = new MemoryStore();
  saveBrother(
    target.state,
    {
      name: "Synthetic Sam",
      aliases: ["Sam"],
      active: true,
      revision: 0,
      reason: "Test roster",
    },
    "test",
    now,
  );
  await target.transaction((s) =>
    importPaymentLinkSession(s, session, "plink_current", now),
  );
  await reconcileSession(target, session.id, fake.gateway, now);
  const order = target.state.orders[0];
  assert.equal(order.baseCents, 3500);
  assert.equal(order.feeCents, 198);
  assert.equal(order.totalCents, 3698);
  assert.equal(standings(target.state).fundsRaisedCents, 3500);
  assert.equal(
    standings(target.state).teams.find((r) => r.id === "axo")!.ticketPoints,
    350,
  );
  assert.equal(brotherReport(target.state).rows[0].ticketsSold, 3);
  assert.deepEqual(
    target.state.tickets.map((r) => r.baseCents),
    [1000, 1000, 1500],
  );
  fake.refunds.push({
    id: "re_link_full",
    charge: `ch_${session.id}`,
    currency: "usd",
    amount: 3698,
    status: "succeeded",
    metadata: {},
  } as never);
  await reconcileSession(target, session.id, fake.gateway, now);
  assert.equal(target.state.orders[0].status, "refunded");
  assert.equal(target.state.orders[0].refundedFeeCents, 198);
  assert.equal(target.state.orders[0].refundedBaseCents, 3500);
  assert.equal(standings(target.state).fundsRaisedCents, 0);
  assert.equal(target.state.tickets.filter((r) => r.valid).length, 0);
});

test("embedded and Payment Link checkout may safely share the same reviewed all-in prices", async (t) => {
  configureLink(t);
  const { session } = await bundledSale();
  const previous = process.env.STRIPE_PRICING_MODE;
  t.after(() => {
    process.env.STRIPE_PRICING_MODE = previous;
  });
  process.env.STRIPE_LINK_PRICE_BASIC = process.env.STRIPE_PRICE_BASIC;
  process.env.STRIPE_LINK_PRICE_MEAT = process.env.STRIPE_PRICE_MEAT;
  for (const item of session.line_items!.data)
    item.price!.id =
      item.price!.unit_amount === 1061
        ? process.env.STRIPE_PRICE_BASIC!
        : process.env.STRIPE_PRICE_MEAT!;
  assert.throws(
    () =>
      importPaymentLinkSession(
        new MemoryStore().state,
        session,
        "plink_current",
        now,
      ),
    /conflicts/,
  );
  process.env.STRIPE_PRICING_MODE = "all_in";
  const target = new MemoryStore();
  importPaymentLinkSession(target.state, session, "plink_current", now);
  assert.equal(target.state.orders[0].baseCents, 3500);
  assert.equal(target.state.orders[0].totalCents, 3698);
  assert.equal(target.state.tickets.length, 3);
  assert.equal(
    standings(target.state).teams.find((team) => team.id === "axo")
      ?.ticketPoints,
    350,
  );
});

test("reviewed link paid events import automatically once while website sales are paused; unrelated links stay for review", async (t) => {
  configureLink(t);
  const { fake, session } = await bundledSale();
  Object.assign(process.env, {
    STRIPE_PAYMENT_LINK_ENABLED: "true",
    STRIPE_PAYMENT_LINK_ID: "plink_current",
    STRIPE_CHECKOUT_ENABLED: "false",
  });
  const target = new MemoryStore();
  const event = fake.event("evt_link_paid", session.id);
  await receiveStripeEvent(target, event, now);
  await receiveStripeEvent(target, event, now);
  await processStripeWork(target, fake.gateway, now);
  await receiveStripeEvent(
    target,
    fake.event("evt_link_repeated", session.id),
    now,
  );
  await processStripeWork(target, fake.gateway, now);
  assert.equal(target.state.orders.length, 1);
  assert.equal(target.state.tickets.length, 3);
  assert.equal(target.state.jobs.length, 1);
  assert.equal(
    target.state.providerEvents.every((e) => e.status === "processed"),
    true,
  );
  session.payment_link = "plink_unrelated";
  const other = new MemoryStore();
  await receiveStripeEvent(
    other,
    fake.event("evt_other_link", session.id),
    now,
  );
  await processStripeWork(other, fake.gateway, now);
  assert.equal(other.state.orders.length, 0);
  assert.equal(other.state.providerEvents[0].status, "review");
});

test("changed bundled amounts and extra products cannot issue tickets or leave partial imports", async (t) => {
  configureLink(t);
  const { session } = await bundledSale();
  const target = new MemoryStore();
  session.amount_total!++;
  await assert.rejects(
    target.transaction((s) =>
      importPaymentLinkSession(s, session, "plink_current", now),
    ),
    /total/,
  );
  session.amount_total!--;
  session.line_items!.data[1].price!.id = "price_unapproved";
  await assert.rejects(
    target.transaction((s) =>
      importPaymentLinkSession(s, session, "plink_current", now),
    ),
    /Unknown/,
  );
  assert.equal(target.state.orders.length, 0);
  assert.equal(target.state.tickets.length, 0);
  assert.equal(target.state.jobs.length, 0);
});
