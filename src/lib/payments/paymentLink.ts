import type Stripe from "stripe";

// Organizer-approved public links. Keep retired links for historical sales.
export const currentPaymentLinkUrl =
  "https://buy.stripe.com/6oU4gz7Tugru8GeaOj2kw03";
export const currentPaymentLinkId = "plink_1UYaoDFjxvBryqqLR9EFY0y7";
export const currentPaymentLinkTotals = { basic: 1158, meat: 1720 } as const;
export const currentPaymentLinkPriceIds = {
  basic: "price_1UYanjFjxvBryqqL1vfly4Ma",
  meat: "price_1UYankFjxvBryqqL2sdHaW0V",
} as const;
export const historicalPaymentLinkUrls = [
  "https://buy.stripe.com/6oU3cva1Ccbe4pY3lR2kw01",
  "https://buy.stripe.com/bJe7sLehS2AEf4C5tZ2kw00",
] as const;
export function paymentLinkAvailable(now = new Date()) {
  return (
    process.env.STRIPE_PAYMENT_LINK_ENABLED === "true" &&
    process.env.STRIPE_PAYMENT_LINK_ID === currentPaymentLinkId &&
    process.env.STRIPE_LINK_PRICE_BASIC === currentPaymentLinkPriceIds.basic &&
    process.env.STRIPE_LINK_PRICE_MEAT === currentPaymentLinkPriceIds.meat &&
    process.env.STRIPE_LINK_TAX_INCLUDED === "true" &&
    now.getTime() < Date.parse("2026-11-19T18:00:00-06:00")
  );
}
export function approvedPaymentLinkUrl(url: string) {
  return (
    url === currentPaymentLinkUrl ||
    historicalPaymentLinkUrls.some((v) => v === url)
  );
}

// Reviewed all-in prices are distinct from the embedded checkout's catalog.
export function paymentLinkPrices() {
  const basic = process.env.STRIPE_LINK_PRICE_BASIC;
  const meat = process.env.STRIPE_LINK_PRICE_MEAT;
  if (!basic && !meat) return [];
  if (
    !basic?.startsWith("price_") ||
    !meat?.startsWith("price_") ||
    basic === meat
  )
    throw new Error("Configure both distinct reviewed Payment Link price IDs.");
  const taxInclusive = process.env.STRIPE_LINK_TAX_INCLUDED === "true";
  return [
    {
      id: basic,
      tier: "basic" as const,
      cents: 1000,
      paidCents: taxInclusive ? currentPaymentLinkTotals.basic : 1061,
      taxInclusive,
      points: 100,
    },
    {
      id: meat,
      tier: "meat" as const,
      cents: 1500,
      paidCents: taxInclusive ? currentPaymentLinkTotals.meat : 1576,
      taxInclusive,
      points: 150,
    },
  ];
}

// Tax comes from the authenticated Stripe session, never a guessed local rate.
export function includedPaymentLinkTax(
  session: Stripe.Checkout.Session,
  taxInclusive: boolean,
) {
  const tax = session.total_details?.amount_tax ?? 0;
  if (!Number.isSafeInteger(tax) || tax < 0 || (!taxInclusive && tax !== 0))
    throw new Error("Unexpected Stripe tax allocation.");
  if (!taxInclusive) return 0;
  if (
    !session.automatic_tax?.enabled ||
    session.automatic_tax.status !== "complete" ||
    !session.line_items ||
    session.line_items.data.some(
      (item) =>
        item.price?.tax_behavior !== "inclusive" ||
        !Number.isSafeInteger(item.amount_tax) ||
        item.amount_tax < 0,
    ) ||
    session.line_items.data.reduce((sum, item) => sum + item.amount_tax, 0) !==
      tax
  )
    throw new Error("Stripe inclusive tax calculation is incomplete.");
  return tax;
}
