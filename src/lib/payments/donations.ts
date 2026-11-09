import type Stripe from "stripe";
import { randomUUID } from "node:crypto";
import type { State, StripeDonation } from "../operations/model";
import type { Store } from "../operations/store";
import { resolveBrother, validateBrother } from "../operations/brothers";
import { audit, donationDelta } from "../operations/service";
import { checkoutConfig, type StripeGateway } from "./stripe";

import { donationLinkId, donationPriceId } from "./donationLink";
export { donationUrl, donationLinkId, donationPriceId } from "./donationLink";
const ref = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : value?.id;

export function importDonation(
  s: State,
  session: Stripe.Checkout.Session,
  now = new Date(),
) {
  const config = checkoutConfig();
  const item = session.line_items?.data[0];
  const amount = session.amount_total;
  const paymentId = ref(session.payment_intent);
  if (
    ref(session.payment_link) !== donationLinkId ||
    session.livemode !== config.livemode ||
    session.mode !== "payment" ||
    session.status !== "complete" ||
    session.payment_status !== "paid" ||
    session.currency !== "usd" ||
    !paymentId ||
    !Number.isSafeInteger(amount) ||
    amount! < 100 ||
    session.line_items?.has_more ||
    session.line_items?.data.length !== 1 ||
    item?.price?.id !== donationPriceId ||
    item.price.currency !== "usd" ||
    item.price.recurring ||
    item.quantity !== 1 ||
    item.amount_total !== amount ||
    session.total_details?.amount_discount ||
    session.total_details?.amount_shipping ||
    session.total_details?.amount_tax
  )
    throw new Error(
      "Stripe donation does not match the reviewed link and amount.",
    );
  const existing = s.donations.find(
    (d) => d.id === session.id || d.paymentId === paymentId,
  );
  if (existing) {
    if (
      existing.id !== session.id ||
      existing.paymentId !== paymentId ||
      existing.amountCents !== amount ||
      existing.accountId !== config.accountId ||
      existing.livemode !== config.livemode
    )
      throw new Error("Stripe donation association changed.");
    return existing;
  }
  // A previously entered provider reference must be reconciled by staff, never credited twice.
  if (
    s.receipts.some(
      (r) =>
        !r.providerSessionId &&
        !r.reversedAt &&
        [session.id, paymentId].some(
          (id) =>
            r.reference?.includes(id) ||
            s.audit.some(
              (a) =>
                a.subject === r.id &&
                a.action === "donation-received" &&
                a.reason.includes(id),
            ),
        ),
    )
  )
    throw new Error(
      "This Stripe donation was manually recorded; reconcile its existing receipt first.",
    );
  const chapter = session.custom_fields?.find((f) => f.key === "chapter")
    ?.dropdown?.value;
  const teamId = s.teams.some((t) => t.id === chapter) ? chapter! : null;
  const raw =
    session.custom_fields?.find((f) => f.key === "soldby")?.text?.value ?? "";
  const brotherId = resolveBrother(s, raw);
  const donationRule = s.rules.find((r) => r.id === "donation" && r.enabled);
  if (!donationRule) throw new Error("Donation scoring is not enabled.");
  const receiptId = `stripe-donation:${session.id}`;
  const row: StripeDonation = {
    id: session.id,
    paymentLinkId: donationLinkId,
    paymentId,
    accountId: config.accountId,
    livemode: config.livemode,
    receiptId,
    teamId,
    amountCents: amount!,
    refundedCents: 0,
    status: "paid" as const,
    referrerBrotherId: brotherId,
    referrerRaw: raw.slice(0, 500),
    review: [
      ...(!teamId && chapter !== "none" ? ["Chapter needs review"] : []),
      ...(raw && !brotherId ? ["Brother referral needs review"] : []),
    ],
    revision: 0,
    createdAt: new Date(session.created * 1000).toISOString(),
    nextCheckAt: now.toISOString(),
  };
  s.donations.push(row);
  // Start at zero until the authenticated charge, refunds and disputes have been checked.
  s.receipts.push({
    id: receiptId,
    teamId,
    cents: 0,
    category: "donation",
    source: receiptId,
    operator: "stripe",
    createdAt: row.createdAt,
    donationRate: donationRule.points,
    donationPolicy: 3,
    providerSessionId: session.id,
    reference: session.id,
  });
  audit(
    s,
    "stripe",
    "donation-imported",
    receiptId,
    "Verified donation session; charge reconciliation pending",
    now,
  );
  return row;
}

export async function reconcileDonation(
  store: Store,
  sessionId: string,
  gateway: StripeGateway,
  now = new Date(),
) {
  const session = await gateway.session(sessionId);
  const config = checkoutConfig();
  if (
    ref(session.payment_link) !== donationLinkId ||
    session.livemode !== config.livemode
  )
    throw new Error("Unknown donation session.");
  if (session.status !== "complete" || session.payment_status !== "paid")
    return;
  const paymentId = ref(session.payment_intent);
  if (!paymentId) throw new Error("Donation payment is missing.");
  const charge = await gateway.charge(paymentId);
  const [refunds, disputes] = await Promise.all([
    gateway.refunds(charge.id),
    gateway.disputes(charge.id),
  ]);
  if (
    charge.currency !== "usd" ||
    !charge.paid ||
    charge.amount !== session.amount_total ||
    ref(charge.payment_intent) !== paymentId ||
    (charge.livemode !== undefined && charge.livemode !== config.livemode)
  )
    throw new Error("Donation charge does not match its session.");
  if (
    refunds.some(
      (r) =>
        r.currency !== "usd" ||
        ref(r.charge) !== charge.id ||
        !Number.isSafeInteger(r.amount) ||
        r.amount < 0,
    )
  )
    throw new Error("Donation refund requires review.");
  const refunded = [...new Map(refunds.map((r) => [r.id, r])).values()]
    .filter((r) => r.status === "succeeded")
    .reduce((n, r) => n + r.amount, 0);
  if (
    refunded > charge.amount ||
    (charge.amount_refunded != null && charge.amount_refunded !== refunded)
  )
    throw new Error("Donation refund totals require review.");
  if (disputes.some((d) => ref(d.charge) !== charge.id))
    throw new Error("Donation dispute association changed.");
  const disputed = disputes.some(
    (d) => !["won", "warning_closed"].includes(d.status),
  );
  if (charge.disputed && !disputes.length)
    throw new Error("Donation dispute requires review.");
  return store.transaction((s) => {
    const d = importDonation(s, session, now);
    const receipt = s.receipts.find((r) => r.id === d.receiptId)!;
    const eligible = disputed ? 0 : d.amountCents - refunded;
    const status = disputed
      ? "disputed"
      : refunded === d.amountCents
        ? "refunded"
        : refunded
          ? "partially-refunded"
          : "paid";
    const changed =
      receipt.cents !== eligible ||
      d.status !== status ||
      d.refundedCents !== refunded ||
      !d.chargeId;
    d.chargeId = charge.id;
    if (charge.receipt_url) {
      const receipt = new URL(charge.receipt_url);
      if (
        receipt.protocol === "https:" &&
        receipt.hostname === "pay.stripe.com"
      )
        d.receiptUrl = receipt.href;
    }
    d.refundedCents = refunded;
    d.status = status;
    const balance = charge.balance_transaction;
    if (balance && typeof balance !== "string")
      d.processorFeeCents = balance.fee;
    d.nextCheckAt = new Date(
      now.getTime() + (disputed ? 300000 : 86400000),
    ).toISOString();
    d.error = undefined;
    if (changed) {
      d.revision++;
      receipt.cents = eligible;
      if (d.teamId)
        donationDelta(
          s,
          d.teamId,
          `donation-reconcile:${d.id}:${d.revision}`,
          "stripe",
          now,
        );
      audit(
        s,
        "stripe",
        "donation-reconciled",
        d.id,
        `${status}; ${eligible} eligible cents; ${refunded} refunded cents`,
        now,
      );
    }
    return d;
  });
}

export function correctDonation(
  s: State,
  input: {
    id: string;
    revision: number;
    teamId: string | null;
    brotherId: string | null;
    reason: string;
  },
  operator: string,
  now: Date,
) {
  const d = s.donations.find((d) => d.id === input.id);
  if (!d) throw new Error("Donation not found.");
  if (d.revision !== input.revision)
    throw new Error("Donation changed; refresh first.");
  if (
    !input.reason.trim() ||
    (input.teamId && !s.teams.some((t) => t.id === input.teamId))
  )
    throw new Error("Invalid donation correction.");
  validateBrother(s, input.brotherId);
  const previousTeam = d.teamId;
  d.teamId = input.teamId;
  d.referrerBrotherId = input.brotherId;
  d.review = [];
  d.revision++;
  s.receipts.find((r) => r.id === d.receiptId)!.teamId = input.teamId;
  const source = `donation-correction:${randomUUID()}`;
  for (const teamId of new Set([previousTeam, d.teamId]))
    if (teamId) donationDelta(s, teamId, `${source}:${teamId}`, operator, now);
  audit(s, operator, "donation-attribution-corrected", d.id, input.reason, now);
}
