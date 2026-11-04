import { before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MemoryStore, now, testEnvironment } from "./integration-fixtures";
import { createOrder, fulfillOrder } from "../src/lib/operations/service";
import { deliverDue, ticketEmail } from "../src/lib/email/delivery";
import {
  brevoPayload,
  DeliveryError,
  providerSend,
} from "../src/lib/email/providers";
import { receiveEmailEvents, applyEmailEvents } from "../src/lib/email/events";
before(testEnvironment);
function fixture(count = 1) {
  const store = new MemoryStore();
  const order = createOrder(
    store.state,
    {
      requestKey: randomUUID(),
      email: "inbox@example.test",
      attendees: Array.from({ length: count }, (_, i) => ({
        name: `<Guest ${i}>`,
        tier: "basic",
        teamId: null,
      })),
    },
    "test",
    "test",
    now,
  );
  fulfillOrder(store.state, order.id, count * 1000, "test", now);
  return store;
}
test("Brevo payload preserves all guest QR attachments, escaped text and secure fallback links", async () => {
  const store = fixture(50);
  const message = await ticketEmail(store.state, store.state.jobs[0]);
  const payload = brevoPayload(message, "stable-message-key");
  assert.equal(payload.to.length, 1);
  assert.equal(payload.to[0].contactPixelTrackingConsent, false);
  assert.equal(payload.attachment.length, 50);
  assert.equal(payload.htmlContent.includes('src="cid:'), false);
  assert.ok(payload.htmlContent.includes("&lt;Guest 0&gt;"));
  assert.equal(
    (
      payload.textContent.match(/https:\/\/event.example.test\/tickets\//g) ??
      []
    ).length,
    50,
  );
  assert.equal(payload.replyTo.email, "zachzapalac@gmail.com");
  assert.match(
    payload.headers.idempotencyKey,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  assert.equal(
    brevoPayload(message, "stable-message-key").headers.idempotencyKey,
    payload.headers.idempotencyKey,
  );
  assert.ok(
    payload.attachment.every(
      (a) =>
        Buffer.from(a.content, "base64").subarray(1, 4).toString() === "PNG",
    ),
  );
});
test("Brevo and Resend adapters use documented endpoints, headers and provider message IDs", async () => {
  const store = fixture();
  const message = await ticketEmail(store.state, store.state.jobs[0]);
  const original = global.fetch;
  process.env.BREVO_API_KEY = "synthetic-brevo-key";
  process.env.RESEND_API_KEY = "synthetic-resend-key";
  try {
    global.fetch = async (url, options) => {
      assert.equal(url, "https://api.brevo.com/v3/smtp/email");
      assert.equal(
        (options!.headers as Record<string, string>)["api-key"],
        "synthetic-brevo-key",
      );
      const body = JSON.parse(String(options!.body));
      assert.equal(body.sender.name, "KSigdillas Tickets");
      return Response.json({ messageId: "<brevo-synthetic>" }, { status: 201 });
    };
    assert.equal(await providerSend(message, "key"), "<brevo-synthetic>");
    process.env.EMAIL_PROVIDER = "resend";
    global.fetch = async (url, options) => {
      assert.equal(url, "https://api.resend.com/emails");
      assert.equal(
        (options!.headers as Record<string, string>)["Idempotency-Key"],
        "key",
      );
      return Response.json({ id: "resend-synthetic" });
    };
    assert.equal(await providerSend(message, "key"), "resend-synthetic");
  } finally {
    global.fetch = original;
    process.env.EMAIL_PROVIDER = "brevo";
  }
});
test("unknown send outcome is held for review, while definite throttles remain retryable", async () => {
  const store = fixture();
  const original = global.fetch;
  process.env.BREVO_API_KEY = "synthetic";
  let calls = 0;
  try {
    global.fetch = async () => {
      calls++;
      throw new Error("Timeout after possible acceptance");
    };
    assert.deepEqual(await deliverDue(store, undefined, now), {
      sent: 0,
      failed: 1,
    });
    assert.equal(store.state.jobs[0].uncertain, true);
    await deliverDue(store, undefined, new Date(now.getTime() + 600000));
    assert.equal(calls, 1);
    assert.equal(store.state.tickets.length, 1);
    store.state.jobs[0].uncertain = false;
    store.state.jobs[0].nextAttemptAt = now.toISOString();
    global.fetch = async () =>
      Response.json({ error: "limit" }, { status: 429 });
    await deliverDue(store, undefined, now);
    assert.equal(store.state.jobs[0].uncertain, false);
    assert.equal(
      Date.parse(store.state.jobs[0].nextAttemptAt),
      now.getTime() + 3600000,
    );
  } finally {
    global.fetch = original;
  }
});
test("free quota is reserved atomically across workers, queues excess and recovers after 24 hours", async () => {
  const store = fixture();
  const order = store.state.orders[0];
  store.state.jobs.push(
    {
      id: "resend-a",
      orderId: order.id,
      status: "queued",
      attempts: 0,
      nextAttemptAt: now.toISOString(),
    },
    {
      id: "resend-b",
      orderId: order.id,
      status: "queued",
      attempts: 0,
      nextAttemptAt: now.toISOString(),
    },
  );
  for (let i = 0; i < 299; i++)
    store.state.audit.push({
      id: randomUUID(),
      operator: "test",
      action: "email-quota-reserved",
      subject: `prior-${i}`,
      reason: "brevo",
      createdAt: now.toISOString(),
    });
  const original = global.fetch;
  process.env.BREVO_API_KEY = "synthetic";
  let calls = 0;
  try {
    global.fetch = async () =>
      Response.json({ messageId: `synthetic-${++calls}` }, { status: 201 });
    await Promise.all([
      deliverDue(store, undefined, now),
      deliverDue(store, undefined, now),
    ]);
    assert.equal(calls, 1);
    assert.equal(
      store.state.jobs.filter((j) => j.status === "queued").length,
      2,
    );
    assert.equal(
      store.state.audit.filter((a) => a.action === "email-quota-reserved")
        .length,
      300,
    );
    await deliverDue(store, undefined, new Date(now.getTime() + 86400001));
    assert.equal(calls, 3);
    assert.equal(store.state.jobs.filter((j) => j.status === "sent").length, 3);
    assert.equal(store.state.tickets.length, 1);
  } finally {
    global.fetch = original;
  }
});
test("email callbacks persist before acceptance, reject mismatched recipient, and ignore older status", () => {
  const store = fixture();
  const s = store.state;
  const time = Math.floor(Date.now() / 1000);
  const event = {
    event: "delivered",
    "message-id": "<synthetic>",
    email: "inbox@example.test",
    ts_event: time,
  };
  receiveEmailEvents(s, event);
  assert.equal(s.emailEvents[0].processed, false);
  s.jobs[0].provider = "brevo";
  s.jobs[0].providerRef = "<synthetic>";
  applyEmailEvents(s);
  assert.equal(s.jobs[0].deliveryStatus, "delivered");
  receiveEmailEvents(s, { ...event, event: "request", ts_event: time - 1 });
  assert.equal(s.jobs[0].deliveryStatus, "delivered");
  receiveEmailEvents(s, event);
  assert.equal(s.emailEvents.length, 2);
  receiveEmailEvents(s, {
    ...event,
    event: "hard_bounce",
    email: "somebodyelse@example.test",
    ts_event: time + 1,
  });
  assert.equal(s.jobs[0].deliveryStatus, "delivered");
  receiveEmailEvents(s, { ...event, event: "hard_bounce", ts_event: time + 1 });
  assert.equal(s.jobs[0].deliveryStatus, "bounced");
});
test("a worker interrupted during send requires provider inspection before automatic resend", async () => {
  const store = fixture();
  store.state.jobs[0].status = "sending";
  store.state.jobs[0].attempts = 1;
  store.state.jobs[0].leaseUntil = new Date(now.getTime() - 1).toISOString();
  let sends = 0;
  await deliverDue(
    store,
    async () => {
      sends++;
      return "synthetic";
    },
    now,
  );
  assert.equal(sends, 0);
  assert.equal(store.state.jobs[0].uncertain, true);
  assert.equal(store.state.jobs[0].status, "failed");
  assert.ok(new DeliveryError(true).uncertain);
});
