export const eventConfig = {
  name: "KSigdillas",
  organization: "Kappa Sigma Theta-Omega",
  date: "Date to be announced",
  dayAndTime: "Friday · 6:00 PM",
  venue: "707 S Davis Dr",
  venueNote: "Backyard location",
  ticketUrl:
    process.env.NEXT_PUBLIC_EVENTBRITE_URL ||
    "https://www.eventbrite.com/e/ksigdillas-tickets-1992696425651?aff=oddtdtcreator",
  instagramUrl:
    process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? "https://instagram.com/placeholder",
  instagramHandle: "@ksigdillas",
  contactEmail:
    process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "ksigdillas@example.com",
  beneficiaryConfirmed: false,
  proceedsPercentageEnabled: false,
} as const;

export const ticketTiers = [
  {
    name: "Basicdilla",
    label: "The classic",
    color: "yellow",
    features: [
      "Backyard event access",
      "Free sodas",
      "Unlimited cheese quesadillas while supplies last",
    ],
  },
  {
    name: "Chicken + Veggie",
    label: "More on the menu",
    color: "orange",
    featured: true,
    features: [
      "Everything in Basicdilla",
      "Chicken quesadilla options",
      "Veggie quesadilla options",
    ],
  },
  {
    name: "Beef Tier",
    label: "The full spread",
    color: "red",
    features: [
      "Everything in previous tiers",
      "Beef quesadilla access",
      "Every available filling option",
    ],
  },
] as const;
