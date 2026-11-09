import { donationProducts } from "../eventConfig";
import type { Rule, State } from "./model";
export const saleStart = Date.parse("2026-11-19T18:00:00-06:00");
export const saleEnd = Date.parse("2026-11-19T21:00:00-06:00");
export function salesWindowOpen(now = new Date()) {
  return now.getTime() < saleEnd;
}
export function eventDay(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function quotePrices(now: Date) {
  if (now.getTime() >= saleEnd) throw new Error("Ticket sales have ended.");
  return now.getTime() >= saleStart
    ? { basic: 1200, meat: 1800 }
    : { basic: 1000, meat: 1500 };
}
export function grossUp(
  base: number,
  percentageBasisPoints: number,
  fixedCents: number,
) {
  if (
    ![base, percentageBasisPoints, fixedCents].every(Number.isSafeInteger) ||
    base < 0 ||
    fixedCents < 0 ||
    percentageBasisPoints < 0 ||
    percentageBasisPoints >= 10000
  )
    throw new Error("Invalid fee parameters.");
  return Math.ceil(
    ((base + fixedCents) * 10000) / (10000 - percentageBasisPoints),
  );
}
export const defaultRules: Rule[] = [
  ...donationProducts.map((p) => ({
    id: p.id,
    label: p.name,
    points: p.points,
    mondayPoints: p.mondayPoints,
    mondayCap: p.mondayCap,
    cents: 0,
    enabled: p.enabled,
    category: "giving" as const,
    revision: 1,
  })),
  ...[
    { id: "slap", label: "Slap", points: 10, cents: 200 },
    { id: "pie", label: "Pie", points: 15, cents: 200 },
    { id: "hang", label: "Hanging attempt", points: 10, cents: 0 },
    { id: "story", label: "Instagram story", points: 25, cents: 0 },
    { id: "reel", label: "Instagram reel", points: 50, cents: 0 },
    { id: "feed", label: "Instagram feed post", points: 50, cents: 0 },
  ].map((r) => ({
    ...r,
    enabled: true,
    category: "activities" as const,
    revision: 1,
  })),
  {
    id: "basic",
    label: "Basicdilla ticket",
    points: 100,
    cents: 1000,
    enabled: true,
    category: "tickets",
    revision: 1,
  },
  {
    id: "meat",
    label: "Meat/Veggie ticket",
    points: 150,
    cents: 1500,
    enabled: true,
    category: "tickets",
    revision: 1,
  },
  ...[
    { id: "award:attendance", label: "Attendance winner", points: 1000 },
    { id: "award:hanging", label: "Overall hanging winner", points: 300 },
    {
      id: "award:food:2026-11-16",
      label: "Monday supply points winner",
      points: 500,
    },
    {
      id: "award:participation:2026-11-17",
      label: "Tuesday pie/slap points winner",
      points: 300,
    },
    { id: "award:volleyball:1", label: "Volleyball first", points: 400 },
    { id: "award:volleyball:2", label: "Volleyball second", points: 200 },
    { id: "award:volleyball:3", label: "Volleyball third", points: 100 },
    { id: "award:eating:1", label: "Eating first", points: 400 },
    { id: "award:eating:2", label: "Eating second", points: 200 },
    { id: "award:eating:3", label: "Eating third", points: 100 },
  ].map((r) => ({
    ...r,
    cents: 0,
    enabled: true,
    category: r.id.startsWith("award:eating:")
      ? ("eating" as const)
      : ("bonuses" as const),
    revision: 1,
  })),
  {
    id: "donation",
    label: "Donation · $5 minimum for points",
    points: 50,
    cents: 500,
    enabled: true,
    category: "giving",
    revision: 1,
  },
];
export function initialState(state: State) {
  state.teams = [
    {
      id: "axo",
      name: "Alpha Chi Omega",
      displayName: "AXO",
      accentColor: "#B5232B",
    },
    { id: "dz", name: "Delta Zeta", displayName: "DZ", accentColor: "#E96B94" },
    {
      id: "zta",
      name: "Zeta Tau Alpha",
      displayName: "ZTA",
      accentColor: "#179B83",
    },
    {
      id: "ddd",
      name: "Delta Delta Delta",
      displayName: "DDD",
      accentColor: "#2E67A0",
    },
  ];
  state.rules = structuredClone(defaultRules);
  state.settings = [
    {
      id: "event",
      revision: 1,
      offlineSalesEnabled: false,
      packetVersion: 1,
      scoringPolicyVersion: 3,
      updatedAt: new Date().toISOString(),
    },
  ];
  return state;
}
