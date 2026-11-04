// Published versions are immutable: add a new version when purchase terms change.
export const purchaseTerms = {
  version: "2026-11-03-v1",
  updated: "November 3, 2026",
  organizer: "Kappa Sigma Theta-Omega",
  refund: "Tickets are nonrefundable except where required by law.",
  cancellation:
    "If the event is canceled, postponed or materially changed, ticket holders will be notified using their purchase email. Contact the organizer about your order and any rights or remedies available under applicable law. A schedule change does not automatically authorize a replacement charge.",
  availability:
    "Admission and the food options listed for your wristband are included. Food is available while supplies last; the menu may vary with donated ingredients. Activities are optional and may change for safety, weather or availability.",
  transfer:
    "Each ticket admits one person once. Keep your private ticket link secure. Contact the organizer to correct a guest name, arrange a transfer or replace a lost ticket; copying a QR does not create another admission.",
} as const;
export const retentionPolicy = {
  abandonedDays: 30,
  attendeeDays: 90,
  eventEnd: "2026-11-20T03:00:00.000Z",
  version: "2026-11-03-v1",
} as const;
export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );

// These are the already observed organizer prices, not a second Stripe surcharge.
export function publicPrices(now = new Date()) {
  const door = now.getTime() >= Date.parse("2026-11-19T18:00:00-06:00");
  return {
    base: door ? { basic: 1200, meat: 1800 } : { basic: 1000, meat: 1500 },
    online: door ? { basic: 1267, meat: 1885 } : { basic: 1061, meat: 1576 },
    door,
  };
}
