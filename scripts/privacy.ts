import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { PgStore } from "../src/lib/operations/store";
import { anonymizeOrder, privacyPlan } from "../src/lib/operations/privacy";
import { audit } from "../src/lib/operations/service";
async function main() {
  if (!process.env.OPERATIONS_DATABASE_URL)
    throw new Error("Configure the intended event database explicitly.");
  const store = new PgStore(process.env.OPERATIONS_DATABASE_URL);
  const mode = process.argv[2] ?? "dry-run";
  const manifest = resolve(".data/privacy-deletions.json");
  try {
    if (mode === "hold" || mode === "release") {
      const id = process.argv[3];
      if (!id || !process.env.PRIVACY_REASON?.trim())
        throw new Error("Supply an order ID and private PRIVACY_REASON.");
      await store.transaction((s) => {
        if (!s.orders.some((o) => o.id === id))
          throw new Error("Order not found.");
        audit(
          s,
          "privacy-cli",
          mode === "hold" ? "privacy-hold" : "privacy-hold-released",
          id,
          process.env.PRIVACY_REASON!,
          new Date(),
        );
      });
      console.log("Privacy hold updated; no attendee data printed.");
      return;
    }
    if (!["dry-run", "apply"].includes(mode))
      throw new Error(
        "Use dry-run | apply | hold ORDER_ID | release ORDER_ID.",
      );
    const now = new Date();
    const plan = privacyPlan(
      await store.read(),
      now,
      process.env.DATA_PAID_ANONYMIZATION_APPROVED === "true",
    );
    if (mode === "dry-run") {
      console.log(
        JSON.stringify({
          candidates: plan.filter((r) => r.eligible),
          held: plan.filter((r) => r.held).length,
          unresolved: plan.filter((r) => r.unresolved).length,
        }),
      );
      return;
    }
    if (process.env.DATA_RETENTION_APPROVED !== "2026-11-03-v1")
      throw new Error("The retention policy has not been approved.");
    await mkdir(resolve(".data"), { recursive: true });
    let prior: string[] = [];
    try {
      prior = JSON.parse(await readFile(manifest, "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const count = await store.transaction(async (s) => {
      // Eligibility and hold changes share this lock. Persist deletion intent
      // before mutation so old backups can be sanitized even after a crash.
      const eligible = privacyPlan(
        s,
        now,
        process.env.DATA_PAID_ANONYMIZATION_APPROVED === "true",
      )
        .filter((r) => r.eligible)
        .map((r) => r.orderId);
      const ids = [...new Set([...prior, ...eligible])];
      await writeFile(manifest, JSON.stringify(ids), { mode: 0o600 });
      return eligible.filter((id) => anonymizeOrder(s, id, "privacy-cli", now))
        .length;
    });
    console.log(
      JSON.stringify({
        anonymizedOrders: count,
        restoreManifest: ".data/privacy-deletions.json",
      }),
    );
  } finally {
    await store.close();
  }
}
void main().catch(() => {
  console.error(
    "Privacy operation failed; check mode, policy approval, private hold reason and database configuration. No personal data printed.",
  );
  process.exitCode = 1;
});
