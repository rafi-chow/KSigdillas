import { before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  MemoryStore,
  now,
  testEnvironment,
  fakeStripe,
} from "./integration-fixtures";
import { createOrder, fulfillOrder } from "../src/lib/operations/service";
import { deliverDue } from "../src/lib/email/delivery";
import {
  scheduledPassDue,
  maintenanceHealth,
  runMaintenance,
  scheduledMaintenanceDue,
  maintenanceWorkDue,
} from "../src/lib/jobs/maintenance";
import { startCheckout, receiveStripeEvent } from "../src/lib/payments/stripe";
import { withinBudget } from "../src/lib/jobs/budget";
import scheduled from "../netlify/functions/maintenance";
import { purchaseTerms } from "../src/lib/policies";
before(testEnvironment);
test("presale and post-event work wakes the minute worker without a browser or duplicate fulfillment", async () => {
  for (const at of ["2026-11-05T18:01:00Z", "2026-11-12T18:01:00Z"]) {
    const clock = new Date(at);
    const store = new MemoryStore();
    const stripe = fakeStripe();
    assert.equal(await scheduledMaintenanceDue(store, clock), false);
    await startCheckout(
      store,
      {
        requestKey: randomUUID(),
        email: "presale@example.test",
        termsVersion: purchaseTerms.version,
        attendees: [{ name: "Presale buyer", tier: "basic", teamId: "axo" }],
      },
      "embedded",
      stripe.gateway,
      clock,
    );
    const sessionId = store.state.checkouts[0].sessionId!;
    stripe.pay(sessionId);
    await receiveStripeEvent(
      store,
      stripe.event("evt_presale", sessionId),
      clock,
    );
    assert.equal(await scheduledMaintenanceDue(store, clock), true);
    let sent = 0;
    for (let minute = 0; minute < 2; minute++) {
      await runMaintenance(store, {
        source: "scheduled",
        now: new Date(clock.getTime() + minute * 60000),
        gateway: stripe.gateway,
        delivery: async () => {
          sent++;
          return "presale-email";
        },
      });
    }
    assert.equal(store.state.orders[0].status, "paid");
    assert.equal(store.state.tickets.length, 1);
    assert.equal(store.state.ledger.length, 1);
    assert.equal(store.state.jobs[0].status, "sent");
    assert.equal(sent, 1);
    await receiveStripeEvent(
      store,
      stripe.event("evt_presale", sessionId),
      clock,
    );
    assert.equal(store.state.providerEvents.length, 1);
    assert.equal(
      await scheduledMaintenanceDue(store, new Date(clock.getTime() + 120000)),
      false,
    );
    await store.transaction((s) => {
      s.jobs[0].status = "queued";
      s.jobs[0].nextAttemptAt = "2026-12-01T18:01:00.000Z";
    });
    assert.equal(
      await scheduledMaintenanceDue(store, new Date("2026-12-01T18:01:00Z")),
      true,
    );
  }
});
test("idle cadence ignores future work and held sends; expired leases still get recovery", async () => {
  const store = queued(1);
  const clock = new Date("2026-11-05T18:01:00Z");
  const job = store.state.jobs[0];
  assert.equal(maintenanceWorkDue(store.state, clock), false);
  job.nextAttemptAt = clock.toISOString();
  assert.equal(maintenanceWorkDue(store.state, clock), true);
  job.uncertain = true;
  assert.equal(maintenanceWorkDue(store.state, clock), false);
  job.status = "sending";
  job.leaseUntil = new Date(clock.getTime() - 1).toISOString();
  assert.equal(maintenanceWorkDue(store.state, clock), true);
  assert.equal(
    await scheduledMaintenanceDue(
      new MemoryStore(),
      new Date("2026-11-05T18:15:00Z"),
    ),
    true,
  );
});
function queued(count: number) {
  const store = new MemoryStore();
  for (let i = 0; i < count; i++) {
    const order = createOrder(
      store.state,
      {
        requestKey: randomUUID(),
        email: "synthetic@example.test",
        attendees: [{ name: `Synthetic ${i}`, tier: "basic", teamId: "axo" }],
      },
      "test",
      "test",
      now,
    );
    fulfillOrder(store.state, order.id, 1000, "test", now);
  }
  return store;
}
test("deadline prevents claiming work and does not start an expired provider operation", async () => {
  const store = queued(3);
  let calls = 0;
  await deliverDue(
    store,
    async () => {
      calls++;
      return "unused";
    },
    now,
    { deadline: Date.now() - 1 },
  );
  await assert.rejects(
    withinBudget(async () => {
      calls++;
    }, Date.now() - 1),
  );
  assert.equal(calls, 0);
  assert.equal(store.state.jobs.filter((j) => j.status === "queued").length, 3);
});
test("a stalled send releases on deadline and leaves unstarted messages safely queued", async () => {
  const store = queued(3);
  const started = Date.now();
  const result = await deliverDue(store, () => new Promise(() => {}), now, {
    deadline: started + 1200,
  });
  assert.deepEqual(result, { sent: 0, failed: 1 });
  assert.ok(Date.now() - started < 2500);
  assert.equal(store.state.jobs.filter((j) => j.uncertain).length, 1);
  assert.equal(
    store.state.jobs.filter((j) => j.status === "queued" && j.attempts === 0)
      .length,
    2,
  );
  const next = await deliverDue(store, async () => "synthetic", now);
  assert.equal(next.sent, 2);
  assert.equal(store.state.tickets.length, 3);
});
test("an expired preparation lease is retried safely, while a lost acceptance write is held for review", async () => {
  const store = queued(1);
  const job = store.state.jobs[0];
  job.status = "sending";
  job.sendStarted = false;
  job.leaseUntil = new Date(now.getTime() - 1).toISOString();
  let accepted = false;
  const original = store.transaction.bind(store);
  let failOnce = true;
  store.transaction = async (fn) => {
    if (accepted && failOnce) {
      failOnce = false;
      throw new Error("Lost acceptance commit");
    }
    return original(fn);
  };
  let sends = 0;
  await deliverDue(
    store,
    async () => {
      accepted = true;
      sends++;
      return "synthetic";
    },
    now,
  );
  assert.equal(sends, 1);
  assert.equal(store.state.jobs[0].uncertain, true);
  await deliverDue(
    store,
    async () => {
      sends++;
      return "duplicate";
    },
    new Date(now.getTime() + 600000),
  );
  assert.equal(sends, 1);
});
test("overlapping maintenance passes drain a 200-order queue without duplicate sends or tickets", async () => {
  const store = queued(200);
  const keys = new Set<string>();
  const delivery = async (_: unknown, key: string) => {
    assert.equal(keys.has(key), false);
    keys.add(key);
    return key;
  };
  for (let i = 0; i < 2; i++)
    await Promise.all([
      runMaintenance(store, { now, gateway: null, delivery }),
      runMaintenance(store, { now, gateway: null, delivery }),
    ]);
  assert.equal(keys.size, 200);
  assert.equal(store.state.jobs.filter((j) => j.status === "sent").length, 200);
  assert.equal(store.state.tickets.length, 200);
  assert.equal(store.state.ledger.length, 200);
});
test("a stalled Stripe provider cannot starve email; scheduled liveness survives business exceptions", async () => {
  const store = queued(2);
  const stripe = fakeStripe();
  stripe.gateway.event = () => new Promise(() => {});
  store.state.providerEvents.push({
    id: "evt_slow",
    type: "checkout.session.completed",
    objectId: "cs_slow",
    status: "pending",
    attempts: 0,
    createdAt: now.toISOString(),
    nextAttemptAt: now.toISOString(),
  });
  const started = Date.now();
  const result = await runMaintenance(store, {
    source: "scheduled",
    now,
    deadline: started + 2200,
    gateway: stripe.gateway,
    delivery: async () => "synthetic",
  });
  assert.equal(result.sent, 2);
  assert.ok(result.stripe.failed > 0);
  assert.ok(Date.now() - started < 3000);
  store.state.jobs[0].deliveryStatus = "bounced";
  const health = maintenanceHealth(store.state);
  assert.equal(health.healthy, true);
  assert.ok(health.attentionRequired > 0);
});
test("manual work cannot mask a missing scheduler; liveness expires at the configured cadence", async () => {
  const store = queued(1);
  await runMaintenance(store, {
    now,
    gateway: null,
    delivery: async () => "synthetic",
  });
  assert.equal(maintenanceHealth(store.state).healthy, false);
  store.state.attempts.push({
    id: "maintenance-heartbeat",
    count: 1,
    resetsAt: now.toISOString(),
  });
  assert.equal(
    maintenanceHealth(store.state, new Date(now.getTime() + 4 * 60000)).healthy,
    true,
  );
  assert.equal(
    maintenanceHealth(store.state, new Date(now.getTime() + 6 * 60000)).healthy,
    false,
  );
  assert.equal(scheduledPassDue(new Date("2026-11-16T18:01:00Z")), false);
  assert.equal(scheduledPassDue(new Date("2026-12-01T12:15:00Z")), true);
  assert.equal(scheduledPassDue(new Date("2026-12-01T12:16:00Z")), false);
});
test("manually invoking a preview or an old production deploy cannot touch production services", async () => {
  process.env.MAINTENANCE_ENABLED = "true";
  process.env.EVENT_OPERATIONS_ENABLED = "true";
  process.env.OPERATIONS_DATABASE_URL =
    "postgres://invalid-preview-must-never-connect";
  const request = new Request("https://preview.example.test");
  await scheduled(request, {
    deploy: { context: "deploy-preview", published: false },
  });
  await scheduled(request, {
    deploy: { context: "production", published: false },
  });
});
