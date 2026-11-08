import { reapplyDeletions } from "../src/lib/operations/privacy";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { PgStore } from "../src/lib/operations/store";
import { collections, type State } from "../src/lib/operations/model";
import { packetPreview, applyPacket } from "../src/lib/operations/packet";
import {
  applyScoringPolicy,
  scoringPolicyPreview,
} from "../src/lib/operations/scoringPolicy";
import {
  donationLinkId,
  donationUrl,
  reconcileDonation,
} from "../src/lib/payments/donations";
import { importLegacyTickets } from "../src/lib/operations/legacy";
import { addStaff, audit, standings } from "../src/lib/operations/service";
import {
  checkoutConfig,
  stripeClient,
  retrieveOwnStripeAccount,
  stripeGateway,
  reconcileSession,
} from "../src/lib/payments/stripe";
import { importPaymentLinkSession } from "../src/lib/payments/import";
import {
  approvedPaymentLinkUrl,
  currentPaymentLinkUrl,
  paymentLinkPrices,
} from "../src/lib/payments/paymentLink";
async function main() {
  const url = process.env.OPERATIONS_DATABASE_URL;
  if (!url)
    throw new Error(
      "Set OPERATIONS_DATABASE_URL explicitly. This tool never reads .env.local or DATABASE_URL.",
    );
  const store = new PgStore(url);
  const [command, filename] = process.argv.slice(2);
  try {
    if (command === "migrate") {
      await store.migrate();
      console.log("Operations migration applied. Legacy data was not changed.");
    } else if (command === "check-scoring-policy") {
      console.log(JSON.stringify(scoringPolicyPreview(await store.read())));
    } else if (command === "apply-scoring-policy") {
      if (!filename)
        throw new Error(
          "Provide a reviewed scoring-policy manifest with fingerprint and reason.",
        );
      const input = z
        .object({
          fingerprint: z.string(),
          reason: z.string().trim().min(1).max(300),
        })
        .strict()
        .parse(JSON.parse(await readFile(resolve(filename), "utf8")));
      await store.transaction((s) =>
        applyScoringPolicy(
          s,
          input.fingerprint,
          input.reason,
          "scoring-policy-cli",
          new Date(),
        ),
      );
      console.log("Scoring policy v2 applied with audit history retained.");
    } else if (
      command === "check-donations" ||
      command === "import-donations"
    ) {
      const stripe = stripeClient();
      const link = await stripe.paymentLinks.retrieve(donationLinkId);
      if (
        link.url !== donationUrl ||
        link.livemode !== checkoutConfig().livemode
      )
        throw new Error(
          "Donation link does not match the reviewed account/environment.",
        );
      let paid = 0,
        imported = 0;
      for await (const session of stripe.checkout.sessions.list({
        payment_link: donationLinkId,
        status: "complete",
        limit: 100,
      })) {
        if (session.payment_status !== "paid") continue;
        paid++;
        if (command === "import-donations") {
          await reconcileDonation(store, session.id, stripeGateway());
          imported++;
        }
      }
      console.log(
        JSON.stringify({ mode: command, paid, reconciled: imported }),
      );
    } else if (command === "check-packet-rules") {
      if (!filename)
        throw new Error(
          "Provide a private output path for the packet review manifest.",
        );
      const report = packetPreview(await store.read());
      await writeFile(
        resolve(filename),
        JSON.stringify(report.manifest, null, 2) + "\n",
        { mode: 0o600, flag: "wx" },
      );
      console.log(
        JSON.stringify({
          changes: report.changes,
          affectedEntryCount: report.reverseEntries.length,
          affectedAwardCount: report.retireAwards.length,
          message:
            "Review the private manifest, retain source evidence, supply a reason, then apply. Affected old entries are reversed for re-entry, not silently rescored.",
        }),
      );
    } else if (command === "apply-packet-rules") {
      if (!filename) throw new Error("Provide the reviewed packet manifest.");
      const manifest = JSON.parse(await readFile(resolve(filename), "utf8"));
      await store.transaction((s) =>
        applyPacket(s, manifest, "packet-migration-cli", new Date()),
      );
      console.log(
        "Packet rules applied. Re-enter reviewed reversed records under the new policy before finalizing winners.",
      );
    } else if (command === "staff") {
      if (!process.env.STAFF_PASSWORD)
        throw new Error(
          "Supply STAFF_PASSWORD securely in the process environment.",
        );
      await store.transaction((s) =>
        addStaff(
          s,
          {
            id: process.env.STAFF_ID,
            name: process.env.STAFF_NAME,
            role: process.env.STAFF_ROLE ?? "organizer",
            password: process.env.STAFF_PASSWORD,
          },
          "bootstrap-cli",
          new Date(),
        ),
      );
      console.log("Staff member provisioned. Password not printed.");
    } else if (command === "stripe-check") {
      const config = checkoutConfig();
      const stripe = stripeClient();
      const account = config.secret.startsWith("rk_")
        ? null
        : await retrieveOwnStripeAccount(stripe);
      if (account && account.id !== config.accountId)
        throw new Error("Configured Stripe account does not match API key.");
      const expected = [
        {
          id: config.prices.basic,
          cents: config.pricingMode === "all_in" ? 1061 : 1000,
        },
        {
          id: config.prices.meat,
          cents: config.pricingMode === "all_in" ? 1576 : 1500,
        },
        {
          id: config.prices.basicDoor,
          cents: config.pricingMode === "all_in" ? 1267 : 1200,
        },
        {
          id: config.prices.meatDoor,
          cents: config.pricingMode === "all_in" ? 1885 : 1800,
        },
        ...paymentLinkPrices().map((p) => ({ id: p.id, cents: p.paidCents })),
      ];
      for (const p of expected.filter((p) => p.id)) {
        const price = await stripe.prices.retrieve(p.id);
        if (
          price.unit_amount !== p.cents ||
          price.currency !== "usd" ||
          price.recurring ||
          !price.active
        )
          throw new Error(
            "Stripe catalog does not match approved ticket prices.",
          );
      }
      const matchingLinks = [];
      for await (const link of stripe.paymentLinks.list({ limit: 100 })) {
        if (approvedPaymentLinkUrl(link.url))
          matchingLinks.push({
            id: link.id,
            url: link.url,
            current: link.url === currentPaymentLinkUrl,
            active: link.active,
          });
      }
      console.log(
        JSON.stringify({
          catalogVerified: true,
          chargesEnabled:
            account?.charges_enabled ?? "not requested with restricted key",
          payoutsEnabled: account?.payouts_enabled ?? "owner-controlled",
          matchingPaymentLinks: matchingLinks,
          feePolicyApproved: process.env.STRIPE_FEE_POLICY_APPROVED === "true",
        }),
      );
    } else if (
      command === "check-stripe-import" ||
      command === "import-stripe"
    ) {
      const config = checkoutConfig();
      const stripe = stripeClient();
      const gateway = stripeGateway();
      const account = config.secret.startsWith("rk_")
        ? null
        : await retrieveOwnStripeAccount(stripe);
      if (account && account.id !== config.accountId)
        throw new Error("Configured Stripe account does not match API key.");
      const linkId = process.env.STRIPE_PAYMENT_LINK_ID;
      if (!linkId?.startsWith("plink_"))
        throw new Error(
          "Set the reviewed STRIPE_PAYMENT_LINK_ID from stripe-check.",
        );
      const link = await stripe.paymentLinks.retrieve(linkId);
      if (!approvedPaymentLinkUrl(link.url))
        throw new Error(
          "Payment Link is not the organizer-supplied event link.",
        );
      let imported = 0,
        skipped = 0,
        needsReview = 0;
      const dry = await store.read();
      for await (const row of stripe.checkout.sessions.list({
        payment_link: linkId,
        status: "complete",
        limit: 100,
      })) {
        if (row.payment_status !== "paid") {
          needsReview++;
          continue;
        }
        const session = await gateway.session(row.id);
        const paymentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;
        if (!paymentId) {
          needsReview++;
          continue;
        }
        const charge = await gateway.charge(paymentId);
        if (charge.amount_refunded || charge.disputed) {
          needsReview++;
          continue;
        }
        const result =
          command === "check-stripe-import"
            ? importPaymentLinkSession(dry, session, linkId)
            : await store.transaction((s) =>
                importPaymentLinkSession(s, session, linkId),
              );
        if (result.imported) imported++;
        else skipped++;
        if (command === "import-stripe")
          await reconcileSession(store, session.id, gateway);
      }
      console.log(
        JSON.stringify({
          mode: command,
          imported,
          skipped,
          needsReview,
          note: "Refunded/disputed or incomplete sessions require explicit reconciliation before cutover. No real emails were sent by this command; imported orders queue ticket delivery.",
        }),
      );
    } else if (command === "backup") {
      if (!filename)
        throw new Error("Provide a private backup path outside tracked files.");
      await writeFile(
        resolve(filename),
        JSON.stringify({
          version: 2,
          createdAt: new Date().toISOString(),
          state: await store.read(),
        }),
        { mode: 0o600, flag: "wx" },
      );
      console.log(
        "Private encrypted-token snapshot written. Retain the separate encryption key for recovery.",
      );
    } else if (command === "restore") {
      if (!filename) throw new Error("Provide a backup file.");
      const backup = JSON.parse(await readFile(resolve(filename), "utf8")) as {
        version: number;
        state: State;
      };
      if (
        ![1, 2].includes(backup.version) ||
        collections.some(
          (key) =>
            !Array.isArray(backup.state[key]) &&
            !(
              (backup.version === 1 &&
                [
                  "brothers",
                  "entries",
                  "attributions",
                  "checkouts",
                  "providerEvents",
                  "refunds",
                  "emailEvents",
                ].includes(key)) ||
              ["admissions", "donations"].includes(key)
            ),
        )
      )
        throw new Error("Invalid operations backup.");
      const deletionPath = process.env.PRIVACY_DELETION_MANIFEST;
      if (!deletionPath)
        throw new Error(
          "Restore requires PRIVACY_DELETION_MANIFEST; use a reviewed empty list if no deletions have occurred.",
        );
      const deletionIds = z
        .array(z.string().uuid())
        .parse(JSON.parse(await readFile(resolve(deletionPath), "utf8")));
      await store.transaction((s) => {
        if (
          s.orders.length ||
          s.ledger.length ||
          s.staff.length ||
          s.receipts.length ||
          s.audit.length
        )
          throw new Error(
            "Restore requires an empty operations database, never a live merge.",
          );
        for (const key of collections)
          (s[key] as unknown[]) = backup.state[key] ?? [];
        reapplyDeletions(s, deletionIds);
        audit(
          s,
          "restore-cli",
          "snapshot-restored",
          "event",
          "Restored into empty database",
          new Date(),
        );
      });
      console.log("Snapshot restored; verify totals before enabling writes.");
    } else if (command === "check-tickets" || command === "import-tickets") {
      if (!filename)
        throw new Error("Provide a reviewed legacy ticket manifest.");
      const manifest = JSON.parse(await readFile(resolve(filename), "utf8"));
      const result =
        command === "check-tickets"
          ? importLegacyTickets(
              await store.read(),
              manifest,
              "migration-dry-run",
              new Date(),
            )
          : await store.transaction((s) =>
              importLegacyTickets(s, manifest, "migration-cli", new Date()),
            );
      console.log(JSON.stringify({ mode: command, ...result }));
    } else if (command === "import-balances" || command === "check-balances") {
      if (!filename)
        throw new Error("Provide a reviewed legacy opening-balance manifest.");
      const rows = z
        .array(
          z
            .object({
              providerId: z.string().min(1),
              teamId: z.string(),
              category: z.enum(["tickets", "giving", "activities", "bonuses"]),
              points: z.number().int().nonnegative(),
              reason: z.string().min(1),
            })
            .strict(),
        )
        .parse(JSON.parse(await readFile(resolve(filename), "utf8")));
      const state = await store.read();
      for (const r of rows)
        if (!state.teams.some((t) => t.id === r.teamId))
          throw new Error("Unknown legacy team.");
      if (command === "import-balances")
        await store.transaction((s) => {
          for (const r of rows) {
            const source = `legacy-opening:${r.providerId}:${r.category}`;
            if (s.ledger.some((e) => e.source === source)) continue;
            s.ledger.push({
              id: randomUUID(),
              teamId: r.teamId,
              category: r.category,
              points: r.points,
              source,
              rule: "opening-balance",
              ruleRevision: 1,
              quantity: 1,
              day: "2026-11-19",
              operator: "migration-cli",
              reason: r.reason,
              createdAt: new Date().toISOString(),
            });
          }
          audit(
            s,
            "migration-cli",
            "opening-balances-imported",
            "event",
            "Reviewed manifest imported; financial receipts not inferred",
            new Date(),
          );
        });
      console.log(
        JSON.stringify({
          mode: command,
          entries: rows.length,
          points: rows.reduce((sum, r) => sum + r.points, 0),
          totals: standings(await store.read()).teams.map((t) => ({
            id: t.id,
            points: t.totalPoints,
          })),
        }),
      );
    } else
      throw new Error(
        "Usage: ops.ts migrate | staff | backup PATH | restore PATH | check-balances PATH | import-balances PATH | check-tickets PATH | import-tickets PATH",
      );
  } finally {
    await store.close();
  }
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Operation failed.");
  process.exitCode = 1;
});
