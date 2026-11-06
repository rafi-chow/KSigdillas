import type Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { State } from "../operations/model";
import { digest, opaqueToken, seal } from "../operations/crypto";
import { audit, fulfillOrder } from "../operations/service";
import { resolveBrother } from "../operations/brothers";
import { checkoutConfig } from "./stripe";
import { includedPaymentLinkTax, paymentLinkPrices } from "./paymentLink";
import { publicPrices } from "../policies";
export function importPaymentLinkSession(
  s: State,
  session: Stripe.Checkout.Session,
  linkId: string,
  now = new Date(),
) {
  const config = checkoutConfig();
  const providerRef = `stripe:${session.id}`;
  const existing = s.checkouts.find((c) => c.sessionId === session.id);
  if (existing) return { imported: false, orderId: existing.orderId };
  const actualLink =
    typeof session.payment_link === "string"
      ? session.payment_link
      : session.payment_link?.id;
  if (
    !/^plink_/.test(linkId) ||
    actualLink !== linkId ||
    session.livemode !== config.livemode ||
    session.mode !== "payment" ||
    session.status !== "complete" ||
    session.payment_status !== "paid" ||
    session.currency !== "usd" ||
    !session.line_items ||
    session.line_items.has_more ||
    session.total_details?.amount_discount ||
    session.total_details?.amount_shipping
  )
    throw new Error(
      "Payment Link session is not eligible for verified import.",
    );
  const email = z
    .email()
    .parse(session.customer_details?.email ?? session.customer_email)
    .toLowerCase();
  const chapter = session.custom_fields.find(
    (f) => f.key === (process.env.STRIPE_CHAPTER_FIELD_KEY ?? "chapter"),
  )?.dropdown?.value;
  const sellerRaw = session.custom_fields
    .find((f) => f.key === (process.env.STRIPE_SELLER_FIELD_KEY ?? "soldby"))
    ?.text?.value?.slice(0, 300);
  const teamId = s.teams.some((t) => t.id === chapter) ? chapter! : null;
  if (
    teamId &&
    s.ledger.some(
      (e) =>
        e.teamId === teamId &&
        e.category === "tickets" &&
        e.rule === "opening-balance",
    )
  )
    throw new Error(
      "Reconcile ticket opening balance before importing individual Stripe tickets.",
    );
  const allowed = new Map([
    [
      config.prices.basic,
      {
        tier: "basic" as const,
        cents: 1000,
        paidCents: config.pricingMode === "all_in" ? 1061 : 1000,
        points: 100,
      },
    ],
    [
      config.prices.meat,
      {
        tier: "meat" as const,
        cents: 1500,
        paidCents: config.pricingMode === "all_in" ? 1576 : 1500,
        points: 150,
      },
    ],
    [
      config.prices.basicDoor,
      {
        tier: "basic" as const,
        cents: 1200,
        paidCents:
          config.pricingMode === "all_in"
            ? publicPrices(new Date("2026-11-19T18:00:00-06:00")).online.basic
            : 1200,
        points: 100,
      },
    ],
    [
      config.prices.meatDoor,
      {
        tier: "meat" as const,
        cents: 1800,
        paidCents:
          config.pricingMode === "all_in"
            ? publicPrices(new Date("2026-11-19T18:00:00-06:00")).online.meat
            : 1800,
        points: 150,
      },
    ],
  ]);
  for (const price of paymentLinkPrices()) {
    const existing = allowed.get(price.id);
    if (
      existing &&
      (existing.tier !== price.tier ||
        existing.cents !== price.cents ||
        existing.paidCents !== price.paidCents ||
        existing.points !== price.points)
    )
      throw new Error(
        "Payment Link catalog conflicts with the website ticket price.",
      );
    allowed.set(price.id, price);
  }
  const orderId = randomUUID();
  const orderToken = opaqueToken();
  const ticketIds: string[] = [];
  let baseCents = 0;
  let totalCents = 0;
  let taxInclusive = true;
  const catalog: Record<string, { quantity: number; cents: number }> = {};
  const review: string[] = [
    "External Payment Link purchase: website terms acceptance was not recorded.",
  ];
  if (chapter && chapter !== "none" && !teamId)
    review.push("Unknown chapter; attribution requires review.");
  for (const item of session.line_items.data) {
    const price = item.price;
    const rule = price ? allowed.get(price.id) : undefined;
    const quantity = item.quantity ?? 0;
    if (
      !price ||
      !rule ||
      price.currency !== "usd" ||
      price.unit_amount !== rule.paidCents ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > 99 ||
      item.amount_total !== quantity * rule.paidCents
    )
      throw new Error("Unknown Payment Link product, price, or quantity.");
    if (catalog[price.id])
      throw new Error("Repeated Payment Link product requires review.");
    catalog[price.id] = { quantity, cents: rule.paidCents };
    taxInclusive =
      taxInclusive && "taxInclusive" in rule && rule.taxInclusive === true;
    totalCents += item.amount_total;
    for (let n = 0; n < quantity; n++) {
      const id = randomUUID();
      const token = opaqueToken();
      const name =
        ticketIds.length === 0
          ? session.customer_details?.name?.slice(0, 100) ||
            "Buyer (name pending)"
          : `Guest ${ticketIds.length + 1} (name pending)`;
      s.tickets.push({
        id,
        orderId,
        name,
        tier: rule.tier,
        teamId,
        baseCents: rule.cents,
        points: rule.points,
        ruleRevision: 1,
        tokenHash: digest(token),
        tokenBox: seal(token),
        valid: false,
        checkedInAt: null,
        checkedInBy: null,
        refunded: false,
        createdAt: now.toISOString(),
      });
      ticketIds.push(id);
      baseCents += rule.cents;
    }
  }
  if (
    ticketIds.length === 0 ||
    ticketIds.length > 198 ||
    totalCents !== session.amount_total
  )
    throw new Error("Payment Link total does not match the ticket catalog.");
  if (ticketIds.length > 1)
    review.push(
      "Guest names need completion; preserve one ticket per paid unit.",
    );
  const taxCents = includedPaymentLinkTax(session, taxInclusive);
  if (totalCents - baseCents - taxCents < 0)
    throw new Error("Stripe tax exceeds the reviewed ticket allocation.");
  const sellerBrotherId = sellerRaw ? resolveBrother(s, sellerRaw) : null;
  if (sellerRaw && !sellerBrotherId)
    review.push("Brother referral needs review.");
  s.orders.push({
    id: orderId,
    requestKey: providerRef,
    fingerprint: digest(providerRef),
    email,
    source: "stripe",
    status: "pending",
    baseCents,
    feeCents: totalCents - baseCents - taxCents,
    taxCents,
    totalCents,
    refundedBaseCents: 0,
    refundedFeeCents: 0,
    createdAt: new Date(session.created * 1000).toISOString(),
    quoteExpiresAt: now.toISOString(),
    tokenHash: digest(orderToken),
    tokenBox: seal(orderToken),
    ticketIds,
    providerRef,
    sellerBrotherId,
    sellerRaw,
    sellerRevision: 0,
    importReview: review,
  });
  s.checkouts.push({
    id: `import:${session.id}`,
    orderId,
    mode: "hosted",
    catalog,
    paymentLinkId: linkId,
    includedFeeCents: totalCents - baseCents - taxCents,
    taxInclusive,
    sessionId: session.id,
    paymentId:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id,
    status: "complete",
    createdAt: now.toISOString(),
    nextCheckAt: now.toISOString(),
    accountId: config.accountId,
    livemode: config.livemode,
  });
  fulfillOrder(s, orderId, totalCents, "stripe-import", now);
  audit(s, "stripe-import", "payment-link-imported", orderId, providerRef, now);
  return { imported: true, orderId };
}
