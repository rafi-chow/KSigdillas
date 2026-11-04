import { before, test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import Stripe from "stripe";
import { testEnvironment } from "./integration-fixtures";
import { POST as stripeWebhook } from "../src/app/api/stripe/webhook/route";
import { POST as checkout } from "../src/app/api/checkout/route";
import { POST as emailWebhook } from "../src/app/api/email/webhook/route";
import { POST as jobs } from "../src/app/api/jobs/route";
import { secretMatches } from "../src/lib/jobs/auth";
import { requestNetwork } from "../src/lib/operations/auth";
before(() => {
  testEnvironment();
  process.env.EVENT_OPERATIONS_ENABLED = "false";
  process.env.MAINTENANCE_JOB_SECRET = "synthetic-maintenance-".padEnd(40, "x");
  process.env.EMAIL_WEBHOOK_SECRET = "synthetic-email-".padEnd(40, "x");
});
test("Netlify limits use its connecting IP instead of grouping all buyers or trusting forwarded headers", () => {
  const request = new NextRequest("https://event.example.test", {
    headers: {
      "x-nf-client-connection-ip": "192.0.2.10",
      "x-forwarded-for": "198.51.100.1",
    },
  });
  assert.equal(requestNetwork(request, { SITE_ID: "synthetic" }), "192.0.2.10");
  assert.equal(requestNetwork(request, {}), "direct");
  assert.equal(requestNetwork(request, { VERCEL: "1" }), "198.51.100.1");
  assert.equal(
    requestNetwork(
      new NextRequest("https://event.example.test", {
        headers: { "x-nf-client-connection-ip": "invalid" },
      }),
      { SITE_ID: "synthetic" },
    ),
    "unknown",
  );
});
test("checkout rejects cross-site requests and does not expose configuration or keys", async () => {
  const response = await checkout(
    new NextRequest("https://event.example.test/api/checkout", {
      method: "POST",
      headers: {
        origin: "https://foreign.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "create", order: {} }),
    }),
  );
  assert.equal(response.status, 403);
  assert.equal((await response.text()).includes("sk_test"), false);
});
test("webhook signature verification precedes persistence; a valid event is not acknowledged when storage is disabled", async () => {
  const payload = JSON.stringify({
    id: "evt_synthetic",
    object: "event",
    type: "checkout.session.completed",
    livemode: false,
    data: { object: { id: "cs_test_synthetic" } },
  });
  const invalid = await stripeWebhook(
    new NextRequest("https://event.example.test/api/stripe/webhook", {
      method: "POST",
      body: payload,
      headers: { "stripe-signature": "invalid" },
    }),
  );
  assert.equal(invalid.status, 400);
  const stripe = new Stripe("sk_test_synthetic");
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: "whsec_synthetic",
  });
  const unavailable = await stripeWebhook(
    new NextRequest("https://event.example.test/api/stripe/webhook", {
      method: "POST",
      body: payload,
      headers: { "stripe-signature": signature },
    }),
  );
  assert.equal(unavailable.status, 503);
});
test("email callback and scheduler authentication fail closed; authenticated health exposes no attendee data", async () => {
  assert.equal(secretMatches("short", "short"), false);
  assert.equal(
    secretMatches("wrong".repeat(10), process.env.EMAIL_WEBHOOK_SECRET),
    false,
  );
  assert.equal(
    (
      await emailWebhook(
        new NextRequest("https://event.example.test/api/email/webhook", {
          method: "POST",
          body: "{}",
        }),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await jobs(
        new NextRequest("https://event.example.test/api/jobs", {
          method: "POST",
        }),
      )
    ).status,
    401,
  );
  const health = await jobs(
    new NextRequest("https://event.example.test/api/jobs?health=true", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MAINTENANCE_JOB_SECRET}`,
      },
    }),
  );
  assert.equal(health.status, 503);
  assert.equal((await health.text()).includes("@"), false);
});
