import { before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { boundedJson, boundedText, RequestError } from "../src/lib/http";
import { contentSecurityPolicy } from "../src/lib/security";
import { launchChecks, assertLaunchReady } from "../src/lib/launch";
import { publicPrices, purchaseTerms } from "../src/lib/policies";
import {
  createOrder,
  fulfillOrder,
  audit,
  addStaff,
  standings,
} from "../src/lib/operations/service";
import {
  cleanupTransient,
  privacyPlan,
  anonymizeOrder,
  reapplyDeletions,
} from "../src/lib/operations/privacy";
import { loginToStore, sessionUser } from "../src/lib/operations/auth";
import { digest, unseal } from "../src/lib/operations/crypto";
import {
  checkoutConfig,
  startCheckout,
  reconcileSession,
  requestStripeRefund,
  receiveStripeEvent,
  processStripeWork,
} from "../src/lib/payments/stripe";
import {
  emailWebhookConfig,
  configureBrevoWebhook,
} from "../src/lib/email/setup";
import { ticketEmail } from "../src/lib/email/delivery";
import {
  MemoryStore,
  fakeStripe,
  testEnvironment,
  now,
} from "./integration-fixtures";
before(testEnvironment);
const input = () => ({
  requestKey: randomUUID(),
  email: "synthetic@example.test",
  termsVersion: purchaseTerms.version,
  attendees: [
    { name: "Synthetic buyer", tier: "basic", teamId: "axo" },
    { name: "Synthetic guest", tier: "meat", teamId: "axo" },
  ],
});

test("bounded request parsing rejects byte overflow without Content-Length and stops the stream", async () => {
  let canceled = false;
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode("é".repeat(21)));
    },
    cancel() {
      canceled = true;
    },
  });
  const request = new Request("https://event.example.test", {
    method: "POST",
    body: stream,
    duplex: "half",
  } as RequestInit);
  await assert.rejects(
    boundedText(request, 40),
    (e: unknown) => e instanceof RequestError && e.status === 413,
  );
  assert.equal(canceled, true);
  await assert.rejects(
    boundedJson(
      new Request("https://event.example.test", {
        method: "POST",
        body: "not json",
      }),
    ),
    (e: unknown) => e instanceof RequestError && e.status === 400,
  );
  assert.deepEqual(
    await boundedJson(
      new Request("https://event.example.test", {
        method: "POST",
        body: '{"ok":true}',
      }),
    ),
    { ok: true },
  );
});
test("production CSP uses unpredictable nonces, blocks object embedding and eval, and permits Stripe and QR workers", () => {
  const policy = contentSecurityPolicy("different-per-request");
  assert.match(policy, /nonce-different-per-request/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.match(policy, /worker-src 'self' blob:/);
  assert.match(policy, /https:\/\/checkout.stripe.com/);
  assert.equal(policy.includes("unsafe-eval"), false);
  assert.equal(
    contentSecurityPolicy("development", true).includes("unsafe-eval"),
    true,
  );
});
test("missing launch evidence fails closed and never exposes private references or credentials", () => {
  const env = {
    BREVO_API_KEY: "synthetic-secret",
    EVENT_APPROVAL_REFERENCE: "private-document",
  };
  const checks = launchChecks(env);
  assert.throws(() => assertLaunchReady(env));
  assert.equal(JSON.stringify(checks).includes("synthetic-secret"), false);
  assert.equal(JSON.stringify(checks).includes("private-document"), false);
  assert.equal(checks.find((c) => c.id === "tax")?.ready, false);
});
test("terms are required server-side for Stripe and snapshotted once across retries", () => {
  const store = new MemoryStore(),
    body = input();
  assert.throws(
    () =>
      createOrder(
        store.state,
        { ...body, termsVersion: undefined },
        "stripe",
        "buyer",
        now,
      ),
    /accept/,
  );
  assert.throws(
    () =>
      createOrder(
        store.state,
        { ...body, termsVersion: "old" },
        "stripe",
        "buyer",
        now,
      ),
    /accept/,
  );
  const order = createOrder(store.state, body, "stripe", "buyer", now);
  assert.equal(order.terms?.version, purchaseTerms.version);
  assert.equal(order.terms?.digest, digest(JSON.stringify(purchaseTerms)));
  assert.equal(
    createOrder(
      store.state,
      body,
      "stripe",
      "buyer",
      new Date(now.getTime() + 1000),
    ).terms?.acceptedAt,
    now.toISOString(),
  );
  assert.throws(
    () =>
      createOrder(
        store.state,
        { ...body, email: "changed@example.test" },
        "stripe",
        "buyer",
        now,
      ),
    /changed/,
  );
});
test("bundled online prices charge once and preserve base points and seller accounting", async () => {
  const previous = process.env.STRIPE_PRICING_MODE;
  process.env.STRIPE_PRICING_MODE = "all_in";
  try {
    const store = new MemoryStore();
    const fake = fakeStripe({ price_basic: 1061, price_meat: 1576 });
    const result = await startCheckout(
      store,
      input(),
      "embedded",
      fake.gateway,
      now,
    );
    assert.equal(result.totalCents, 2637);
    assert.equal(result.baseCents, 2500);
    assert.equal(result.feeCents, 137);
    const params = [...fake.parameters.values()][0];
    assert.equal(params.line_items?.length, 2);
    assert.equal(
      params.line_items?.some((item) => item.price_data),
      false,
    );
    const session = [...fake.sessions.keys()][0];
    fake.pay(session);
    await reconcileSession(store, session, fake.gateway, now);
    const state = await store.read();
    assert.equal(state.tickets.length, 2);
    assert.equal(state.orders[0].totalCents, 2637);
    assert.equal(
      standings(state).teams.find((t) => t.id === "axo")?.totalPoints,
      250,
    );
    assert.deepEqual(publicPrices(now).online, { basic: 1061, meat: 1576 });
  } finally {
    process.env.STRIPE_PRICING_MODE = previous;
  }
});
test("restricted Stripe keys work in configuration with two existing presale prices and optional door catalog", () => {
  const saved = {
    secret: process.env.STRIPE_SECRET_KEY,
    basic: process.env.STRIPE_PRICE_BASIC_DOOR,
    meat: process.env.STRIPE_PRICE_MEAT_DOOR,
  };
  try {
    process.env.STRIPE_SECRET_KEY = "rk_test_synthetic";
    delete process.env.STRIPE_PRICE_BASIC_DOOR;
    delete process.env.STRIPE_PRICE_MEAT_DOOR;
    assert.equal(checkoutConfig().livemode, false);
    process.env.STRIPE_SECRET_KEY = "rk_live_synthetic";
    assert.throws(() => checkoutConfig(), /configured/);
  } finally {
    process.env.STRIPE_SECRET_KEY = saved.secret;
    process.env.STRIPE_PRICE_BASIC_DOOR = saved.basic;
    process.env.STRIPE_PRICE_MEAT_DOOR = saved.meat;
  }
});
test("refund writes are unavailable without the explicit capability and make no provider calls", async () => {
  const previous = process.env.STRIPE_REFUND_WRITE_ENABLED;
  process.env.STRIPE_REFUND_WRITE_ENABLED = "false";
  try {
    await assert.rejects(
      requestStripeRefund(
        new MemoryStore(),
        {},
        "organizer",
        fakeStripe().gateway,
      ),
      /account owner/,
    );
  } finally {
    process.env.STRIPE_REFUND_WRITE_ENABLED = previous;
  }
});
test("staff login reservations, revocation and transient cleanup preserve the heartbeat", async () => {
  const store = new MemoryStore();
  await store.transaction((s) =>
    addStaff(
      s,
      {
        id: "test-scanner",
        name: "Synthetic scanner",
        role: "check-in",
        password: "synthetic-long-password",
      },
      "test",
      now,
    ),
  );
  const login = await loginToStore(
    store,
    { id: "test-scanner", password: "synthetic-long-password" },
    "test-network",
    now,
  );
  assert.ok(login);
  assert.equal(
    sessionUser(await store.read(), login.token, now)?.id,
    "test-scanner",
  );
  await store.transaction((s) => {
    s.staff[0].active = false;
    s.attempts.push({
      id: "maintenance-heartbeat",
      resetsAt: now.toISOString(),
      count: 1,
    });
    cleanupTransient(s, new Date(now.getTime() + 9 * 3600000));
  });
  assert.equal(sessionUser(await store.read(), login.token, now), null);
  assert.equal((await store.read()).sessions.length, 0);
  assert.ok(
    (await store.read()).attempts.some((a) => a.id === "maintenance-heartbeat"),
  );
  for (let i = 0; i < 13; i++)
    assert.equal(
      await loginToStore(
        store,
        { id: "unknown", password: "wrong" },
        "abuse-network",
        now,
      ),
      null,
    );
});
test("retention dry run respects holds, financial review, pending work and replay after restore", () => {
  const store = new MemoryStore();
  const order = createOrder(store.state, input(), "test", "test", now);
  fulfillOrder(store.state, order.id, order.totalCents, "test", now);
  store.state.jobs.forEach((j) => {
    j.status = "sent";
  });
  const old = structuredClone(store.state),
    token = unseal(order.tokenBox),
    future = new Date("2027-03-01T12:00:00Z");
  assert.equal(privacyPlan(store.state, future, false)[0].eligible, false);
  audit(
    store.state,
    "test",
    "privacy-hold",
    order.id,
    "Synthetic accounting review",
    future,
  );
  assert.equal(privacyPlan(store.state, future, true)[0].eligible, false);
  audit(
    store.state,
    "test",
    "privacy-hold-released",
    order.id,
    "Review complete",
    future,
  );
  assert.equal(privacyPlan(store.state, future, true)[0].eligible, true);
  const base = order.baseCents,
    totalPoints = standings(store.state).teams[0].totalPoints;
  assert.equal(anonymizeOrder(store.state, order.id, "test", future), true);
  assert.equal(anonymizeOrder(store.state, order.id, "test", future), false);
  assert.equal(order.baseCents, base);
  assert.equal(standings(store.state).teams[0].totalPoints, totalPoints);
  assert.equal(
    store.state.orders.some((o) => o.tokenHash === digest(token)),
    false,
  );
  assert.equal(order.email, "removed@privacy.invalid");
  assert.equal(reapplyDeletions(old, [order.id], future), 1);
  assert.equal(old.orders[0].email, "removed@privacy.invalid");
});
test("Brevo setup authenticates webhooks in headers and is idempotent for its own receiver", async () => {
  assert.throws(() =>
    emailWebhookConfig("http://unsafe.example", "x".repeat(40)),
  );
  const config = emailWebhookConfig(
    "https://event.example.test",
    "x".repeat(40),
  );
  assert.equal(config.url.includes("x".repeat(40)), false);
  assert.equal(config.events.includes("opened"), false);
  const saved = process.env.BREVO_API_KEY;
  process.env.BREVO_API_KEY = "synthetic-key";
  process.env.EMAIL_WEBHOOK_SECRET = "x".repeat(40);
  const calls: string[] = [];
  const send = (async (url, init) => {
    calls.push(`${init?.method ?? "GET"} ${new URL(String(url)).pathname}`);
    assert.equal(
      (init?.headers as Record<string, string>)["api-key"],
      "synthetic-key",
    );
    if (!init?.method)
      return Response.json({
        webhooks: [
          { id: 42, url: config.url, description: config.description },
        ],
      });
    assert.deepEqual(JSON.parse(String(init.body)), config);
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  try {
    assert.deepEqual(await configureBrevoWebhook(send), {
      configured: true,
      updated: true,
      id: 42,
    });
    assert.deepEqual(calls, ["GET /v3/webhooks", "PUT /v3/webhooks/42"]);
  } finally {
    if (saved === undefined) delete process.env.BREVO_API_KEY;
    else process.env.BREVO_API_KEY = saved;
  }
});
test("largest supported order has every ticket reachable with bounded attachments and policy links", async () => {
  const store = new MemoryStore(),
    body = input();
  const order = createOrder(
    store.state,
    {
      ...body,
      attendees: Array.from({ length: 50 }, (_, i) => ({
        name: `Guest ${i + 1}`,
        tier: "basic",
        teamId: null,
      })),
    },
    "test",
    "test",
    now,
  );
  fulfillOrder(store.state, order.id, order.totalCents, "test", now);
  const message = await ticketEmail(store.state, store.state.jobs[0]);
  assert.equal(message.attachments.length, 50);
  assert.ok(JSON.stringify(message).length < 8_000_000);
  assert.match(message.html, /privacy/);
  assert.match(message.text, /except where required by law/);
  assert.equal((message.text.match(/\/tickets\//g) ?? []).length, 50);
});

test("signature-verified webhook references recover paid orders without Events Read permission or payload PII", async () => {
  const store = new MemoryStore(),
    fake = fakeStripe();
  await startCheckout(store, input(), "embedded", fake.gateway, now);
  const id = [...fake.sessions.keys()][0];
  fake.pay(id);
  const event = {
    id: "evt_verified_reference",
    type: "checkout.session.completed",
    livemode: false,
    data: { object: { id, customer_email: "must-not-persist@example.test" } },
  } as unknown as import("stripe").default.Event;
  await receiveStripeEvent(store, event, now);
  assert.equal(
    JSON.stringify((await store.read()).providerEvents).includes(
      "must-not-persist",
    ),
    false,
  );
  const gateway = {
    ...fake.gateway,
    event: async () => {
      throw new Error("Events Read not granted");
    },
  };
  assert.equal((await processStripeWork(store, gateway, now)).failed, 0);
  const state = await store.read();
  assert.equal(state.providerEvents[0].status, "processed");
  assert.equal(state.orders[0].status, "paid");
  assert.equal(state.jobs.length, 1);
  assert.equal(state.tickets.filter((t) => t.valid).length, 2);
});
