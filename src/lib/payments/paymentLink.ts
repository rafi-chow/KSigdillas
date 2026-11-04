// Organizer-approved public links. Keep the retired link for historical sales.
export const currentPaymentLinkUrl =
  "https://buy.stripe.com/6oU3cva1Ccbe4pY3lR2kw01";
export const historicalPaymentLinkUrls = [
  "https://buy.stripe.com/bJe7sLehS2AEf4C5tZ2kw00",
] as const;
export function approvedPaymentLinkUrl(url: string) {
  return (
    url === currentPaymentLinkUrl ||
    historicalPaymentLinkUrls.some((v) => v === url)
  );
}

// The November 3 link includes a fee in each ticket's price. These are separate
// Stripe prices from the website's base-price catalog, never inferred by name.
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
  return [
    {
      id: basic,
      tier: "basic" as const,
      cents: 1000,
      paidCents: 1061,
      points: 100,
    },
    {
      id: meat,
      tier: "meat" as const,
      cents: 1500,
      paidCents: 1576,
      points: 150,
    },
  ];
}
