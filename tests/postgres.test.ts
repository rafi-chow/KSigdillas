import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testPostgres } from "./postgres";
import { PgStore } from "../src/lib/operations/store";
import {
  createOrder,
  fulfillOrder,
  scanTicket,
  standings,
  addDonation,
  addEntry,
  reverseEntry,
} from "../src/lib/operations/service";
import { cleanupTransient } from "../src/lib/operations/privacy";
import { unseal } from "../src/lib/operations/crypto";
import { capRemaining, contestTotals } from "../src/lib/operations/contests";
import { packetPreview, applyPacket } from "../src/lib/operations/packet";
import { deliverDue } from "../src/lib/email/delivery";
import { DeliveryError } from "../src/lib/email/providers";
import { runMaintenance, maintenanceHealth } from "../src/lib/jobs/maintenance";
import {
  brotherReport,
  correctSeller,
  saveBrother,
} from "../src/lib/operations/brothers";
let pg: Awaited<ReturnType<typeof testPostgres>>;
let store: PgStore;
const now = new Date("2026-11-16T12:00:00-06:00");
before(
  async () => {
    process.env.TICKET_ENCRYPTION_KEY = "2".repeat(64);
    process.env.OPS_ALLOW_TEST_FIXTURES = "true";
    process.env.APP_URL = "http://127.0.0.1:3100";
    pg = await testPostgres();
    store = new PgStore(pg.url);
    await store.migrate();
  },
  { timeout: 60000 },
);
after(async () => {
  await store?.close();
  await pg?.instance.stop();
});
async function freshStore() {
  const name = `test_${randomUUID().replaceAll("-", "")}`;
  await pg.instance.createDatabase(name);
  const s = new PgStore(pg.url.replace(/\/postgres$/, `/${name}`));
  await s.migrate();
  return s;
}
test("SQL minute-worker probe wakes only actionable queues and expired leases outside event week", async () => {
  const db = await freshStore();
  const clock = new Date("2026-11-05T18:01:00Z");
  const later = new Date(clock.getTime() + 60000).toISOString();
  try {
    assert.equal(await db.maintenanceDue(clock, false), false);
    await db.recordMaintenanceProbe(clock);
    assert.equal(maintenanceHealth(await db.read(), clock).healthy, true);
    assert.equal(
      maintenanceHealth(await db.read(), new Date(clock.getTime() + 360000))
        .healthy,
      false,
    );
    // A delayed old invocation cannot move the heartbeat backwards.
    await db.recordMaintenanceProbe(new Date(clock.getTime() - 60000));
    assert.equal(
      maintenanceHealth(await db.read(), clock).lastSuccess,
      clock.toISOString(),
    );
    await db.transaction((s) => {
      const order = createOrder(
        s,
        {
          requestKey: randomUUID(),
          email: "probe@example.test",
          attendees: [{ name: "Queue buyer", tier: "basic", teamId: "axo" }],
        },
        "test",
        "test",
        clock,
      );
      fulfillOrder(s, order.id, 1000, "test", clock);
    });
    assert.equal(await db.maintenanceDue(clock, false), true);
    await db.transaction((s) => {
      s.jobs[0].nextAttemptAt = later;
    });
    assert.equal(await db.maintenanceDue(clock, false), false);
    await db.transaction((s) => {
      s.jobs[0].nextAttemptAt = clock.toISOString();
      s.jobs[0].uncertain = true;
    });
    assert.equal(await db.maintenanceDue(clock, false), false);
    await db.transaction((s) => {
      s.jobs[0].status = "sending";
      s.jobs[0].leaseUntil = later;
    });
    assert.equal(await db.maintenanceDue(clock, false), false);
    assert.equal(await db.maintenanceDue(new Date(later), false), true);
    await db.transaction((s) => {
      s.jobs[0].status = "sent";
      s.providerEvents.push({
        id: "evt_queue_probe",
        objectId: "cs_queue_probe",
        type: "checkout.session.completed",
        status: "pending",
        attempts: 0,
        nextAttemptAt: clock.toISOString(),
        createdAt: clock.toISOString(),
        leaseUntil: later,
      });
    });
    assert.equal(await db.maintenanceDue(clock, false), false);
    assert.equal(await db.maintenanceDue(new Date(later), false), true);
    await db.transaction((s) => {
      s.providerEvents[0].status = "review";
      s.checkouts.push({
        id: "queue-checkout",
        orderId: s.orders[0].id,
        sessionId: "cs_queue_probe",
        mode: "embedded",
        status: "complete",
        createdAt: clock.toISOString(),
        nextCheckAt: later,
        accountId: "acct_synthetic",
        livemode: false,
      });
    });
    assert.equal(await db.maintenanceDue(clock, false), false);
    assert.equal(await db.maintenanceDue(new Date(later), false), true);
  } finally {
    await db.close();
  }
});
test("maintenance storage deadline rolls back a mutation before commit", async () => {
  const bounded = new PgStore(pg.url, Date.now() + 100);
  const id = `deadline-${randomUUID()}`;
  try {
    await assert.rejects(
      bounded.transaction(async (s) => {
        s.attempts.push({ id, count: 1, resetsAt: now.toISOString() });
        await new Promise((resolve) => setTimeout(resolve, 150));
      }),
      /deadline/,
    );
    assert.equal(
      (await store.read()).attempts.some((a) => a.id === id),
      false,
    );
  } finally {
    await bounded.close();
  }
});
test("real SQL maintenance drains a bounded 50-order pass and records independent liveness", async () => {
  const db = await freshStore();
  try {
    await db.transaction((s) => {
      for (let i = 0; i < 50; i++) {
        const order = createOrder(
          s,
          {
            requestKey: randomUUID(),
            email: "worker@example.test",
            attendees: [{ name: `Worker ${i}`, tier: "basic", teamId: "axo" }],
          },
          "test",
          "test",
          now,
        );
        fulfillOrder(s, order.id, 1000, "test", now);
      }
    });
    const result = await runMaintenance(db, {
      source: "scheduled",
      now,
      gateway: null,
      delivery: async () => "synthetic-provider-only",
    });
    assert.equal(result.sent, 50);
    assert.ok(result.durationMs < 18000);
    assert.equal(maintenanceHealth(await db.read()).healthy, true);
    const idle = await runMaintenance(db, {
      source: "scheduled",
      now,
      gateway: null,
    });
    assert.equal(idle.sent, 0);
    console.log(
      `SQL maintenance: 50 synthetic deliveries ${result.durationMs}ms; idle ${idle.durationMs}ms. Deployment allocation/latency unmeasured.`,
    );
  } finally {
    await db.close();
  }
});
test("concurrent final supply slot accepts one donation and preserves independent SQL totals", async () => {
  const db = await freshStore();
  const entry = (quantity: number) => ({
    requestKey: randomUUID(),
    teamId: "axo",
    ruleId: "cheese",
    quantity,
    day: "2026-11-16",
    reference: "Synthetic cap test",
    paymentVerified: false,
  });
  try {
    await db.transaction((s) => addEntry(s, entry(9), "test", now));
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        db.transaction((s) => addEntry(s, entry(1), "test", now)),
      ),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const s = await db.read();
    assert.equal(contestTotals(s)[0].mondayPackages, 10);
    assert.equal(capRemaining(s, "axo", "cheese", "2026-11-16"), 0);
    const sql = await db.pool.query(
      "SELECT sum((payload->>'quantity')::int) AS packages, sum((payload->>'points')::int) AS points FROM event_ops_entries",
    );
    assert.deepEqual(sql.rows[0], { packages: "10", points: "750" });
    const first = s.entries.find((e) => e.quantity === 9)!;
    await db.transaction((s) =>
      reverseEntry(
        s,
        { requestKey: randomUUID(), id: first.id, reason: "Return nine bags" },
        "test",
        now,
      ),
    );
    assert.equal(
      capRemaining(await db.read(), "axo", "cheese", "2026-11-16"),
      9,
    );
  } finally {
    await db.close();
  }
});

test("stored pre-packet rules upgrade with reviewed history reversal and repeatable schema migrations", async () => {
  const db = await freshStore();
  try {
    await db.transaction((s) => {
      addEntry(
        s,
        {
          requestKey: randomUUID(),
          teamId: "axo",
          ruleId: "cheese",
          quantity: 2,
          day: "2026-11-16",
          reference: "Original old-policy fixture",
          paymentVerified: false,
        },
        "test",
        now,
      );
      s.entries[0].policyVersion = undefined;
      s.settings[0].packetVersion = undefined;
      s.rules.find((r) => r.id === "cheese")!.mondayPoints = 70;
    });
    const original = (await db.read()).ledger[0];
    const manifest = {
      ...packetPreview(await db.read()).manifest,
      reason: "Reviewed old entry, re-enter using packet",
    };
    await db.transaction((s) => applyPacket(s, manifest, "test", now));
    await db.transaction((s) => applyPacket(s, manifest, "test", now));
    await db.migrate();
    const s = await db.read();
    assert.deepEqual(
      s.ledger.find((e) => e.id === original.id),
      original,
    );
    assert.equal(s.settings[0].packetVersion, 1);
    assert.equal(s.rules.find((r) => r.id === "cheese")!.mondayPoints, 75);
    assert.equal(standings(s).teams[0].totalPoints, 0);
    const versions = await db.pool.query(
      "SELECT version FROM event_ops_migrations ORDER BY version",
    );
    assert.deepEqual(
      versions.rows.map((r) => r.version),
      [1, 2, 3],
    );
  } finally {
    await db.close();
  }
});
test(
  "200 separate orders reconcile brother sales, SQL revenue and durable email delivery without duplicates",
  { timeout: 120000 },
  async () => {
    const db = await freshStore();
    try {
      const ids = await db.transaction((s) => {
        const a = saveBrother(
          s,
          {
            name: "Synthetic A",
            aliases: [],
            active: true,
            revision: 0,
            reason: "Load fixture",
          },
          "test",
          now,
        );
        const b = saveBrother(
          s,
          {
            name: "Synthetic B",
            aliases: [],
            active: true,
            revision: 0,
            reason: "Load fixture",
          },
          "test",
          now,
        );
        const orders: string[] = [];
        for (const tier of ["basic", "meat"] as const)
          for (let i = 0; i < 100; i++) {
            const o = createOrder(
              s,
              {
                requestKey: randomUUID(),
                email: `fixture-${tier}-${i}@example.test`,
                sellerBrotherId: i < 50 ? a.id : i < 90 ? b.id : null,
                attendees: [
                  { name: `Guest ${tier} ${i}`, tier, teamId: "axo" },
                ],
              },
              "test",
              "test",
              now,
            );
            fulfillOrder(s, o.id, o.totalCents, "test", now);
            orders.push(o.id);
          }
        return { a: a.id, b: b.id, orders };
      });
      let s = await db.read();
      const report = brotherReport(s);
      const a = report.rows.find((r) => r.brotherId === ids.a)!;
      const b = report.rows.find((r) => r.brotherId === ids.b)!;
      const none = report.rows.find((r) => r.brotherId === null)!;
      assert.deepEqual(
        [
          a.ticketsSold,
          a.ticketRevenueCents,
          b.ticketsSold,
          b.ticketRevenueCents,
          none.ticketsSold,
          none.ticketRevenueCents,
        ],
        [100, 125000, 80, 100000, 20, 25000],
      );
      assert.equal(standings(s).fundsRaisedCents, 250000);
      assert.equal(standings(s).teams[0].ticketPoints, 25000);
      const sql = await db.pool.query(
        "SELECT count(*)::int AS count, sum((payload->>'baseCents')::integer)::int AS cents FROM event_ops_tickets WHERE (payload->>'valid')::boolean",
      );
      assert.deepEqual(sql.rows[0], { count: 200, cents: 250000 });
      const latencies: number[] = [];
      const scannerWork = s.tickets.slice(0, 10).map(async (ticket) => {
        const startScan = performance.now();
        const result = await db.transaction((next) =>
          scanTicket(
            next,
            unseal(ticket.tokenBox),
            "concurrent-test-scanner",
            now,
          ),
        );
        latencies.push(performance.now() - startScan);
        assert.equal(result.admitted, true);
      });
      await Promise.all([
        ...scannerWork,
        ...Array.from({ length: 5 }, () => db.read()),
      ]);
      latencies.sort((a, b) => a - b);
      const p95 = latencies[Math.ceil(latencies.length * 0.95) - 1];
      console.log(
        `200-order concurrent scanner fixture: 10 scans plus 5 reads; scan p95 ${Math.round(p95)}ms.`,
      );
      assert.ok(
        p95 < 2000,
        `Scan p95 ${p95}ms exceeds the 2-second local target`,
      );
      assert.equal(
        standings(await db.read()).teams.find((t) => t.id === "axo")
          ?.attendance,
        10,
      );
      const sends = new Set<string>();
      while ((await db.read()).jobs.some((j) => j.status !== "sent")) {
        await deliverDue(
          db,
          async (_message, key) => {
            assert.equal(sends.has(key), false);
            sends.add(key);
            return `synthetic-${sends.size}`;
          },
          now,
        );
      }
      assert.equal(sends.size, 200);
      s = await db.read();
      assert.equal(s.jobs.filter((j) => j.status === "sent").length, 200);
      assert.equal(s.tickets.length, 200);
      const results = await Promise.allSettled(
        [ids.b, null].map((brotherId) =>
          db.transaction((s) =>
            correctSeller(
              s,
              {
                id: ids.orders[0],
                brotherId,
                revision: 0,
                reason: "Concurrent correction",
              },
              "test",
              now,
            ),
          ),
        ),
      );
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        brotherReport(await db.read()).rows.reduce(
          (n, r) => n + r.ticketsSold,
          0,
        ),
        200,
      );
      await db.migrate();
      assert.equal((await db.read()).brothers.length, 2);
      console.log(
        "200-order brother fixture: A 100/$1,250, B 80/$1,000, unassigned 20/$250; 200 logical emails via delivery fake.",
      );
    } finally {
      await db.close();
    }
  },
);
test("repeatable migration preserves balances and immutable history", async () => {
  await store.transaction((s) =>
    addDonation(
      s,
      {
        requestKey: randomUUID(),
        teamId: "axo",
        cents: 500,
        reference: "Fixture",
      },
      "test",
      now,
    ),
  );
  await store.migrate();
  assert.equal(standings(await store.read()).teams[0].totalPoints, 50);
  await assert.rejects(
    store.pool.query(
      "UPDATE event_ops_ledger SET payload=jsonb_set(payload,'{points}','0'::jsonb)",
    ),
    /append-only/,
  );
  await assert.rejects(
    store.pool.query("DELETE FROM event_ops_audit"),
    /append-only/,
  );
});
test("failure before commit leaves no partial tickets, ledger, or email job", async () => {
  const db = await freshStore();
  try {
    await assert.rejects(
      db.transaction((s) => {
        const order = createOrder(
          s,
          {
            requestKey: randomUUID(),
            email: "fixture@example.test",
            attendees: [{ name: "Fixture", teamId: "axo", tier: "basic" }],
          },
          "test",
          "test",
          now,
        );
        fulfillOrder(s, order.id, 1000, "test", now);
        throw new Error("Injected failure");
      }),
    );
    const s = await db.read();
    assert.equal(s.orders.length, 0);
    assert.equal(s.tickets.length, 0);
    assert.equal(s.ledger.length, 0);
    assert.equal(s.jobs.length, 0);
  } finally {
    await db.close();
  }
});
test(
  "concurrent fulfillment and 200-ticket fixture reconcile to SQL, points, funds",
  { timeout: 120000 },
  async () => {
    const db = await freshStore();
    const start = performance.now();
    try {
      const orderIds: string[] = [];
      for (let batch = 0; batch < 4; batch++) {
        const order = await db.transaction((s) =>
          createOrder(
            s,
            {
              requestKey: randomUUID(),
              email: "fixture@example.test",
              attendees: Array.from({ length: 50 }, (_, i) => ({
                name: `Guest ${batch * 50 + i}`,
                teamId: "axo",
                tier: batch < 2 ? "basic" : "meat",
              })),
            },
            "test",
            "test",
            now,
          ),
        );
        orderIds.push(order.id);
      }
      await Promise.all(
        orderIds.flatMap((orderId, i) =>
          Array.from({ length: 3 }, () =>
            db.transaction((s) =>
              fulfillOrder(s, orderId, i < 2 ? 50000 : 75000, "test", now),
            ),
          ),
        ),
      );
      let s = await db.read();
      assert.equal(s.tickets.length, 200);
      assert.equal(s.jobs.length, 4);
      assert.equal(standings(s).teams[0].ticketPoints, 25000);
      assert.equal(standings(s).fundsRaisedCents, 250000);
      const token = unseal(s.tickets[0].tokenBox);
      const scans = await Promise.all(
        Array.from({ length: 12 }, () =>
          db.transaction((s) => scanTicket(s, token, "scanner", now)),
        ),
      );
      assert.equal(scans.filter((x) => x.admitted).length, 1);
      for (let offset = 1; offset < s.tickets.length; offset += 20)
        await Promise.all(
          s.tickets
            .slice(offset, offset + 20)
            .map((ticket) =>
              db.transaction((s) =>
                scanTicket(s, unseal(ticket.tokenBox), "scanner", now),
              ),
            ),
        );
      s = await db.read();
      assert.equal(standings(s).teams[0].attendance, 200);
      const sql = await db.pool.query(
        "SELECT count(*)::int AS count, sum((payload->>'points')::integer)::int AS points FROM event_ops_ledger",
      );
      assert.equal(sql.rows[0].count, 200);
      assert.equal(sql.rows[0].points, 25000);
      await db.close();
      const restarted = new PgStore(
        pg.url.replace(
          /\/postgres$/,
          new URL(db.pool.options.connectionString!).pathname,
        ),
      );
      try {
        assert.equal(standings(await restarted.read()).attendance, 200);
      } finally {
        await restarted.close();
      }
      console.log(
        `200-ticket transaction and scan fixture: ${Math.round(performance.now() - start)}ms; 200 unique admissions, 25,000 points, $2,500 base funds.`,
      );
    } finally {
      if (!db.pool.ended) await db.close();
    }
  },
);
test("leased email retry sends the same logical ticket without reissuing", async () => {
  const db = await freshStore();
  try {
    await db.transaction((s) => {
      const o = createOrder(
        s,
        {
          requestKey: randomUUID(),
          email: "fixture@example.test",
          attendees: [{ name: "Email guest", teamId: "axo", tier: "basic" }],
        },
        "test",
        "test",
        now,
      );
      fulfillOrder(s, o.id, 1000, "test", now);
    });
    assert.deepEqual(
      await deliverDue(
        db,
        async () => {
          throw new DeliveryError(false);
        },
        now,
      ),
      { sent: 0, failed: 1 },
    );
    const keys: string[] = [];
    const send = async (_: unknown, key: string) => {
      keys.push(key);
      return "fake-delivery-id";
    };
    const later = new Date(now.getTime() + 120000);
    await Promise.all([
      deliverDue(db, send, later),
      deliverDue(db, send, later),
    ]);
    const s = await db.read();
    assert.equal(keys.length, 1);
    assert.equal(s.jobs[0].status, "sent");
    assert.equal(s.tickets.length, 1);
    assert.equal(s.ledger.length, 1);
  } finally {
    await db.close();
  }
});

test("backup restoration into a new database preserves tickets, points and QR validity", async () => {
  const original = await freshStore();
  const restored = await freshStore();
  try {
    await original.transaction((s) => {
      const o = createOrder(
        s,
        {
          requestKey: randomUUID(),
          email: "restore@example.test",
          attendees: [{ name: "Restore guest", tier: "meat", teamId: "dz" }],
        },
        "test",
        "test",
        now,
      );
      fulfillOrder(s, o.id, 1500, "test", now);
    });
    const snapshot = await original.read();
    await restored.transaction((s) =>
      Object.assign(s, structuredClone(snapshot)),
    );
    const recovered = await restored.read();
    assert.equal(standings(recovered).fundsRaisedCents, 1500);
    assert.equal(standings(recovered).teams[0].ticketPoints, 150);
    const result = await restored.transaction((s) =>
      scanTicket(
        s,
        unseal(recovered.tickets[0].tokenBox),
        "restored-scanner",
        now,
      ),
    );
    assert.equal(result.admitted, true);
  } finally {
    await original.close();
    await restored.close();
  }
});

test("Postgres removes only expired transient records and rejects deleting financial history", async () => {
  const db = await freshStore();
  try {
    await db.transaction((s) => {
      s.sessions.push({
        id: "expired-test-session",
        staffId: "synthetic",
        expiresAt: now.toISOString(),
        revoked: false,
      });
      s.attempts.push({
        id: "expired-test-limit",
        count: 2,
        resetsAt: now.toISOString(),
      });
      s.attempts.push({
        id: "maintenance-heartbeat",
        count: 1,
        resetsAt: now.toISOString(),
      });
      const order = createOrder(
        s,
        {
          requestKey: randomUUID(),
          email: "transient@example.test",
          attendees: [{ name: "Synthetic", tier: "basic", teamId: "axo" }],
        },
        "test",
        "test",
        now,
      );
      fulfillOrder(s, order.id, order.totalCents, "test", now);
    });
    await db.transaction((s) =>
      cleanupTransient(s, new Date(now.getTime() + 2 * 86400000)),
    );
    assert.equal((await db.read()).sessions.length, 0);
    assert.deepEqual(
      (await db.read()).attempts.map((a) => a.id),
      ["maintenance-heartbeat"],
    );
    const count = (await db.read()).ledger.length;
    await assert.rejects(
      db.transaction((s) => {
        s.ledger[0].id = randomUUID();
      }),
      /cannot be deleted/,
    );
    assert.equal((await db.read()).ledger.length, count);
  } finally {
    await db.close();
  }
});
