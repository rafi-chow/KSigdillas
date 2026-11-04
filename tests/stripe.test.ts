import { before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import {
  MemoryStore,
  fakeStripe,
  now,
  testEnvironment,
} from "./integration-fixtures";
import {
  startCheckout,
  reconcileSession,
  receiveStripeEvent,
  processStripeWork,
  cancelCheckout,
  requestStripeRefund,
  checkoutAvailable,
  stripeApiVersion,
  stripeGateway,
  assertStripePrice,
} from "../src/lib/payments/stripe";
import { standings } from "../src/lib/operations/service";
before(testEnvironment);
test("official Stripe SDK serializes the pinned embedded Checkout contract and rejects a wrong catalog before charging", async () => {
  let createCalls = 0;
  let wrong = false;
  const requests: string[] = [];
  const client = new Stripe("sk_test_synthetic", {
    apiVersion: stripeApiVersion,
    maxNetworkRetries: 0,
    httpClient: Stripe.createFetchHttpClient(async (url, init) => {
      const target = new URL(String(url));
      assert.equal(target.origin, "https://api.stripe.com");
      requests.push(target.pathname);
      if (target.pathname === "/v1/account")
        return Response.json({
          id: "acct_synthetic",
          charges_enabled: true,
          payouts_enabled: true,
        });
      if (target.pathname === "/v1/prices/price_basic")
        return Response.json({
          id: "price_basic",
          active: true,
          currency: "usd",
          unit_amount: wrong ? 999 : 1000,
          recurring: null,
        });
      assert.equal(target.pathname, "/v1/checkout/sessions");
      createCalls++;
      const body = new URLSearchParams(String(init?.body));
      assert.equal(body.get("ui_mode"), "embedded_page");
      assert.equal(body.get("allowed_payment_method_types[0]"), "card");
      assert.equal(body.get("line_items[0][price]"), "price_basic");
      return Response.json({
        id: "cs_test_wire",
        object: "checkout.session",
        status: "open",
        livemode: false,
        client_secret: "synthetic_client_secret",
      });
    }),
  });
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    ui_mode: "embedded_page",
    allowed_payment_method_types: ["card"],
    return_url: "https://event.example.test/orders/synthetic",
    line_items: [{ price: "price_basic", quantity: 1 }],
    metadata: {
      catalog: JSON.stringify({ price_basic: { quantity: 1, cents: 1000 } }),
    },
  };
  assert.equal(
    (await stripeGateway(client).create(params, "synthetic-idempotency")).id,
    "cs_test_wire",
  );
  assert.equal(createCalls, 1);
  assert.ok(requests.includes("/v1/account"));
  wrong = true;
  await assert.rejects(
    stripeGateway(client).create(params, "different-key"),
    /catalog/,
  );
  assert.equal(createCalls, 1);
  assert.throws(
    () =>
      assertStripePrice(
        {
          active: true,
          currency: "eur",
          unit_amount: 1000,
          recurring: null,
        } as Stripe.Price,
        1000,
      ),
    /catalog/,
  );
});
const input = () => ({
  requestKey: randomUUID(),
  email: "buyer@example.test",
  termsVersion: "2026-11-03-v1",
  attendees: [
    { name: "One", tier: "basic", teamId: "axo" },
    { name: "Two", tier: "basic", teamId: "axo" },
    { name: "Three", tier: "meat", teamId: "axo" },
  ],
});
test("Stripe SDK verifies actual signatures; modified payload and wrong secrets fail", () => {
  const stripe = new Stripe("sk_test_synthetic", {
    apiVersion: stripeApiVersion,
  });
  const payload = JSON.stringify({
    id: "evt_synthetic",
    object: "event",
    livemode: false,
    type: "checkout.session.completed",
    data: { object: { id: "cs_test_synthetic" } },
  });
  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: "whsec_synthetic",
  });
  assert.equal(
    stripe.webhooks.constructEvent(payload, header, "whsec_synthetic").id,
    "evt_synthetic",
  );
  assert.throws(() =>
    stripe.webhooks.constructEvent(payload + " ", header, "whsec_synthetic"),
  );
  assert.throws(() => stripe.webhooks.constructEvent(payload, header, "wrong"));
});
test("server sessions use selected cart and buyer fee; retries and duplicate payment events fulfill once", async () => {
  const store = new MemoryStore();
  const fake = fakeStripe();
  const order = input();
  const result = await startCheckout(
    store,
    order,
    "embedded",
    fake.gateway,
    now,
  );
  assert.equal(result.baseCents, 3500);
  assert.equal(result.feeCents, 136);
  assert.equal(result.totalCents, 3636);
  assert.equal(result.publishableKey, "pk_test_synthetic");
  const again = await startCheckout(
    store,
    order,
    "embedded",
    fake.gateway,
    new Date(now.getTime() + 5000),
  );
  assert.equal(again.orderUrl, result.orderUrl);
  assert.equal(fake.sessions.size, 1);
  const params = [...fake.parameters.values()][0];
  assert.equal(params.ui_mode, "embedded_page");
  assert.deepEqual(params.allowed_payment_method_types, ["card"]);
  assert.equal(params.line_items!.length, 3);
  assert.equal(params.line_items![0].quantity, 2);
  const sessionId = [...fake.sessions.keys()][0];
  fake.pay(sessionId);
  await Promise.all([
    reconcileSession(store, sessionId, fake.gateway, now),
    reconcileSession(store, sessionId, fake.gateway, now),
  ]);
  const event = fake.event("evt_1", sessionId);
  await receiveStripeEvent(store, event, now);
  await receiveStripeEvent(store, event, now);
  await processStripeWork(store, fake.gateway, now);
  const s = await store.read();
  assert.equal(s.orders.length, 1);
  assert.equal(s.tickets.filter((t) => t.valid).length, 3);
  assert.equal(s.jobs.length, 1);
  assert.equal(s.ledger.length, 3);
  assert.equal(standings(s).fundsRaisedCents, 3500);
  assert.equal(standings(s).teams[0].ticketPoints, 350);
  assert.equal(s.providerEvents.length, 1);
  assert.equal(s.providerEvents[0].status, "processed");
});
test("pending, wrong amount, price, currency, live mode and account cannot issue tickets", async () => {
  const store = new MemoryStore();
  const fake = fakeStripe();
  await startCheckout(store, input(), "embedded", fake.gateway, now);
  const session = [...fake.sessions.values()][0];
  await reconcileSession(store, session.id, fake.gateway, now);
  assert.equal(
    (await store.read()).tickets.some((t) => t.valid),
    false,
  );
  fake.pay(session.id);
  for (const field of ["amount_total", "currency", "livemode"]) {
    const old = (session as unknown as Record<string, unknown>)[field];
    (session as unknown as Record<string, unknown>)[field] =
      field === "amount_total" ? 1 : field === "currency" ? "eur" : true;
    await assert.rejects(
      reconcileSession(store, session.id, fake.gateway, now),
      /match/,
    );
    (session as unknown as Record<string, unknown>)[field] = old;
  }
  const price = session.line_items!.data[0].price!;
  price.unit_amount = 1;
  await assert.rejects(
    reconcileSession(store, session.id, fake.gateway, now),
    /mismatch/,
  );
  price.unit_amount = 1000;
  const event = fake.event("evt_wrong", session.id);
  await assert.rejects(
    receiveStripeEvent(store, { ...event, account: "acct_other" }, now),
    /account/,
  );
  assert.equal(
    (await store.read()).tickets.some((t) => t.valid),
    false,
  );
});
test("uncertain session creation recovers original idempotent parameters and quoted catalog", async () => {
  const store = new MemoryStore();
  const fake = fakeStripe();
  const order = input();
  const uncertain = {
    ...fake.gateway,
    create: async (...args: Parameters<typeof fake.gateway.create>) => {
      await fake.gateway.create(...args);
      throw new Error("Lost API response");
    },
  };
  await assert.rejects(startCheckout(store, order, "embedded", uncertain, now));
  const old = process.env.STRIPE_PRICE_BASIC;
  process.env.STRIPE_PRICE_BASIC = "price_new_catalog";
  try {
    await startCheckout(
      store,
      order,
      "embedded",
      fake.gateway,
      new Date(now.getTime() + 15000),
    );
    assert.equal(fake.sessions.size, 1);
    fake.pay([...fake.sessions.keys()][0]);
    await reconcileSession(
      store,
      [...fake.sessions.keys()][0],
      fake.gateway,
      now,
    );
    assert.equal((await store.read()).tickets.filter((t) => t.valid).length, 3);
  } finally {
    process.env.STRIPE_PRICE_BASIC = old;
  }
});
test("cancel retires unpaid checkout; completed race returns the paid order; sales pause preserves reconciliation", async () => {
  const store = new MemoryStore();
  const fake = fakeStripe();
  const result = await startCheckout(
    store,
    input(),
    "embedded",
    fake.gateway,
    now,
  );
  const token = result.orderUrl.split("/").at(-1)!;
  assert.deepEqual(await cancelCheckout(store, token, fake.gateway, now), {
    paid: false,
  });
  const second = await startCheckout(
    store,
    input(),
    "hosted",
    fake.gateway,
    now,
  );
  const id = [...fake.sessions.keys()].at(-1)!;
  fake.pay(id);
  process.env.STRIPE_CHECKOUT_ENABLED = "false";
  try {
    assert.equal(checkoutAvailable(), false);
    const race = await cancelCheckout(
      store,
      second.orderUrl.split("/").at(-1)!,
      fake.gateway,
      now,
    );
    assert.equal(race.paid, true);
    assert.equal((await store.read()).tickets.filter((t) => t.valid).length, 3);
  } finally {
    process.env.STRIPE_CHECKOUT_ENABLED = "true";
  }
});
test("provider expiry minimum and 6 PM/9 PM boundaries use server clock", async () => {
  const store = new MemoryStore();
  const fake = fakeStripe();
  await startCheckout(
    store,
    input(),
    "hosted",
    fake.gateway,
    new Date("2026-11-19T20:55:00-06:00"),
  );
  const params = [...fake.parameters.values()][0];
  assert.equal((await store.read()).orders[0].baseCents, 4200);
  assert.ok(
    params.expires_at! >= Date.parse("2026-11-19T21:25:00-06:00") / 1000,
  );
  await assert.rejects(
    startCheckout(
      store,
      input(),
      "embedded",
      fake.gateway,
      new Date("2026-11-19T21:00:00-06:00"),
    ),
    /ended/,
  );
});
test("selected and fee-only refunds, external partial review, and refund replay reconcile exactly", async () => {
  const store = new MemoryStore();
  const fake = fakeStripe();
  await startCheckout(store, input(), "embedded", fake.gateway, now);
  const id = [...fake.sessions.keys()][0];
  fake.pay(id);
  await reconcileSession(store, id, fake.gateway, now);
  let s = await store.read();
  const order = s.orders[0];
  const raw = {
    requestKey: randomUUID(),
    id: order.id,
    ticketIds: [order.ticketIds[0]],
    feeCents: 0,
    reason: "Exceptional refund",
  };
  await requestStripeRefund(store, raw, "organizer", fake.gateway, now);
  await requestStripeRefund(store, raw, "organizer", fake.gateway, now);
  s = await store.read();
  assert.equal(fake.refunds.length, 1);
  assert.equal(s.tickets.filter((t) => t.valid).length, 2);
  assert.equal(standings(s).fundsRaisedCents, 2500);
  assert.equal(standings(s).teams[0].ticketPoints, 250);
  await requestStripeRefund(
    store,
    { ...raw, requestKey: randomUUID(), ticketIds: [], feeCents: 50 },
    "organizer",
    fake.gateway,
    now,
  );
  assert.equal(standings(await store.read()).fundsRaisedCents, 2500);
  fake.refunds.push({
    id: "re_external",
    currency: "usd",
    amount: 300,
    charge: `ch_${id}`,
    status: "succeeded",
    metadata: {},
  } as Stripe.Refund);
  await reconcileSession(store, id, fake.gateway, now);
  s = await store.read();
  assert.equal(
    s.refunds.find((r) => r.providerId === "re_external")!.status,
    "review",
  );
  assert.equal(s.tickets.filter((t) => t.valid).length, 2);
  assert.equal(standings(s).fundsRaisedCents, 2200);
});
test("dispute arriving after lost opening event suspends/reverses once; won restores", async () => {
  const store = new MemoryStore();
  const fake = fakeStripe();
  await startCheckout(store, input(), "embedded", fake.gateway, now);
  const id = [...fake.sessions.keys()][0];
  fake.pay(id);
  await reconcileSession(store, id, fake.gateway, now);
  fake.disputes.push({
    id: "dp_1",
    charge: `ch_${id}`,
    status: "needs_response",
    created: 1,
  } as Stripe.Dispute);
  await reconcileSession(store, id, fake.gateway, now);
  assert.equal((await store.read()).tickets.filter((t) => t.valid).length, 0);
  assert.equal(standings(await store.read()).teams[0].ticketPoints, 0);
  fake.disputes[0].status = "won";
  await reconcileSession(store, id, fake.gateway, now);
  await reconcileSession(store, id, fake.gateway, now);
  assert.equal(standings(await store.read()).teams[0].ticketPoints, 350);
  fake.disputes.push({
    id: "dp_2",
    charge: `ch_${id}`,
    status: "lost",
    created: 2,
  } as Stripe.Dispute);
  await reconcileSession(store, id, fake.gateway, now);
  assert.equal((await store.read()).orders[0].status, "refunded");
  assert.equal(standings(await store.read()).teams[0].ticketPoints, 0);
});
test("buyer fee stays required and is never silently absorbed", async () => {
  process.env.STRIPE_FEE_POLICY_APPROVED = "false";
  try {
    assert.equal(checkoutAvailable(), false);
    await assert.rejects(
      startCheckout(
        new MemoryStore(),
        input(),
        "embedded",
        fakeStripe().gateway,
        now,
      ),
      /not open/,
    );
  } finally {
    process.env.STRIPE_FEE_POLICY_APPROVED = "true";
  }
});
