import EmbeddedPostgres from "embedded-postgres";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  currentPaymentLinkId,
  currentPaymentLinkPriceIds,
} from "../src/lib/payments/paymentLink";
import { PgStore } from "../src/lib/operations/store";
import {
  addStaff,
  createOrder,
  fulfillOrder,
} from "../src/lib/operations/service";
import { unseal } from "../src/lib/operations/crypto";
import { correctSeller, saveBrother } from "../src/lib/operations/brothers";
async function main() {
  const e2e = process.argv.includes("--e2e");
  const fresh = process.argv.includes("--fresh");
  const port = e2e ? 54387 : 54386;
  const appPort = e2e ? 3101 : 3100;
  const directory =
    e2e || fresh
      ? await mkdtemp(join(tmpdir(), "ksigdillas-browser-pg-"))
      : resolve(".data/preview-postgres");
  await mkdir(resolve(".data"), { recursive: true });
  await mkdir(directory, { recursive: true });
  const keyPath = resolve(`.data/${e2e ? "e2e" : "preview"}-key`);
  let key: string;
  try {
    key = (await readFile(keyPath, "utf8")).trim();
  } catch {
    key = randomBytes(32).toString("hex");
    await writeFile(keyPath, key, { mode: 0o600 });
  }
  process.env.TICKET_ENCRYPTION_KEY = key;
  process.env.OPS_ALLOW_TEST_FIXTURES = "true";
  process.env.APP_URL = `http://127.0.0.1:${appPort}`;
  const pg = new EmbeddedPostgres({
    databaseDir: directory,
    port,
    user: "postgres",
    password: "isolated-local-preview",
    persistent: !e2e && !fresh,
    postgresFlags: ["-h", "127.0.0.1", "-k", directory],
    onLog: () => undefined,
    onError: (error) => console.error(String(error).split("\n")[0]),
  });
  try {
    await readFile(resolve(directory, "PG_VERSION"));
  } catch {
    await pg.initialise();
  }
  await pg.start();
  const databaseUrl = `postgresql://postgres:isolated-local-preview@127.0.0.1:${port}/postgres`;
  const store = new PgStore(databaseUrl);
  await store.migrate();
  await store.transaction((s) => {
    if (!s.brothers.length) {
      for (const name of ["Preview Brother A", "Preview Brother B"])
        saveBrother(
          s,
          {
            name,
            aliases: [],
            active: true,
            revision: 0,
            reason: "Isolated synthetic preview roster",
          },
          "preview-bootstrap",
          new Date(),
        );
    }
    if (!s.staff.length) {
      addStaff(
        s,
        {
          id: "organizer",
          name: "Preview organizer",
          role: "organizer",
          password: "local-preview-organizer-only",
        },
        "preview-bootstrap",
        new Date(),
      );
      addStaff(
        s,
        {
          id: "scanner",
          name: "Preview scanner",
          role: "check-in",
          password: "local-preview-scanner-only",
        },
        "preview-bootstrap",
        new Date(),
      );
      addStaff(
        s,
        {
          id: "scorer",
          name: "Preview scorer",
          role: "scorer",
          password: "local-preview-scorer-only",
        },
        "preview-bootstrap",
        new Date(),
      );
    }
    if (!s.orders.some((o) => o.email === "preview@example.test")) {
      const now = new Date("2026-11-16T12:00:00-06:00");
      const o = createOrder(
        s,
        {
          requestKey: randomUUID(),
          email: "preview@example.test",
          sellerBrotherId: s.brothers[0].id,
          attendees: [
            { name: "Preview Alex", teamId: "axo", tier: "basic" },
            { name: "Preview Jordan", teamId: "axo", tier: "meat" },
          ],
        },
        "test",
        "preview-bootstrap",
        now,
      );
      fulfillOrder(s, o.id, 2500, "preview-bootstrap", now);
    }
    const previewOrder = s.orders.find(
      (o) => o.email === "preview@example.test" && o.source === "test",
    );
    if (
      previewOrder &&
      !previewOrder.sellerBrotherId &&
      !previewOrder.sellerCorrected
    )
      correctSeller(
        s,
        {
          id: previewOrder.id,
          brotherId: s.brothers[0].id,
          revision: previewOrder.sellerRevision ?? 0,
          reason: "Assign synthetic preview sales for demonstration",
        },
        "preview-bootstrap",
        new Date(),
      );
  });
  const state = await store.read();
  const order = state.orders.find((o) => o.email === "preview@example.test")!;
  await writeFile(
    resolve(`.data/${e2e ? "e2e" : "preview"}-fixture.json`),
    JSON.stringify({
      orderUrl: `/orders/${unseal(order.tokenBox)}`,
      tickets: state.tickets
        .filter((t) => t.orderId === order.id)
        .map((t) => ({ name: t.name, url: `/tickets/${unseal(t.tokenBox)}` })),
    }),
    { mode: 0o600 },
  );
  await store.close();
  const env = {
    ...process.env,
    EVENT_PREVIEW: "true",
    NEXT_DIST_DIR: e2e ? ".next-e2e" : ".next-preview",
    DATABASE_URL: "",
    OPERATIONS_DATABASE_URL: databaseUrl,
    EVENT_OPERATIONS_ENABLED: "true",
    EVENTBRITE_SYNC_ENABLED: "false",
    EVENTBRITE_PRIVATE_TOKEN: "",
    RESEND_API_KEY: "",
    BREVO_API_KEY: "",
    STRIPE_CHECKOUT_ENABLED: "false",
    STRIPE_SECRET_KEY: "",
    STRIPE_SECRET: "",
    STRIPE_PUBLISHABLE: "",
    STRIPE_WEBHOOK: "",
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "",
    STRIPE_ACCOUNT_ID: "",
    STRIPE_PAYMENT_LINK_ENABLED: process.argv.includes("--payment-link")
      ? "true"
      : "false",
    STRIPE_PAYMENT_LINK_ID: currentPaymentLinkId,
    STRIPE_LINK_PRICE_BASIC: currentPaymentLinkPriceIds.basic,
    STRIPE_LINK_PRICE_MEAT: currentPaymentLinkPriceIds.meat,
    STRIPE_LINK_TAX_INCLUDED: "true",
    STRIPE_WEBHOOK_SECRET: "",
    EMAIL_PROVIDER: "",
    EMAIL_FROM: "",
    MAINTENANCE_JOB_SECRET: "",
    OPS_ALLOW_TEST_FIXTURES: "false",
  };
  // Every service URL is explicitly local. Existing .env.local is never used for operations.
  // Stable preview refreshes; Turbopack can repeatedly reload cached browser fixtures.
  const child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--webpack",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(appPort),
    ],
    { stdio: "inherit", env },
  );
  let stopPromise: Promise<void> | undefined;
  function stop() {
    return (stopPromise ??= (async () => {
      child.kill("SIGTERM");
      await pg.stop();
    })());
  }
  process.once("SIGTERM", () => void stop());
  process.once("SIGINT", () => void stop());
  child.once("exit", async (code) => {
    await stop();
    process.exit(code ?? 0);
  });
  console.log(
    `Isolated ${e2e ? "test" : "preview"} website: http://127.0.0.1:${appPort}. Synthetic data only. Preview credentials are documented in DEVELOPMENT.md.`,
  );
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Operation failed.");
  process.exitCode = 1;
});
