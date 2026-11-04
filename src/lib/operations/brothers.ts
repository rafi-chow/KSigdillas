import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { State } from "./model";
const normalize = (value: string) =>
  value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
function record(
  s: State,
  operator: string,
  action: string,
  subject: string,
  reason: string,
  now: Date,
) {
  s.audit.push({
    id: randomUUID(),
    operator,
    action,
    subject,
    reason,
    createdAt: now.toISOString(),
  });
}
export function validateBrother(s: State, id?: string | null) {
  if (id && !s.brothers.some((b) => b.id === id && b.active))
    throw new Error("Unknown or archived brother.");
}
export function resolveBrother(s: State, raw: string) {
  const normalized = normalize(raw);
  if (!normalized) return null;
  const matches = s.brothers.filter((b) =>
    [b.name, ...b.aliases].some((a) => normalize(a) === normalized),
  );
  return matches.length === 1 ? matches[0].id : null;
}
const rosterInput = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(100),
    aliases: z.array(z.string().trim().min(1).max(100)).max(30),
    active: z.boolean(),
    revision: z.number().int().min(0),
    reason: z.string().trim().min(1).max(300),
  })
  .strict();
export function saveBrother(
  s: State,
  raw: unknown,
  operator: string,
  now: Date,
) {
  const input = rosterInput.parse(raw);
  const row = s.brothers.find((b) => b.id === input.id);
  if (input.id && !row) throw new Error("Brother not found.");
  if ((row?.revision ?? 0) !== input.revision)
    throw new Error("Roster changed; refresh first.");
  const id = row?.id ?? randomUUID();
  const value = {
    id,
    name: input.name,
    aliases: [...new Set(input.aliases.map(normalize))],
    active: input.active,
    revision: input.revision + 1,
  };
  if (row) Object.assign(row, value);
  else s.brothers.push(value);
  record(s, operator, "brother-saved", id, input.reason, now);
  return value;
}
const correction = z
  .object({
    id: z.string().max(150),
    brotherId: z.string().uuid().nullable(),
    revision: z.number().int().min(0),
    reason: z.string().trim().min(1).max(300),
  })
  .strict();
export function correctSeller(
  s: State,
  raw: unknown,
  operator: string,
  now: Date,
) {
  const input = correction.parse(raw);
  const order = s.orders.find((o) => o.id === input.id);
  if (!order) throw new Error("Order not found.");
  if ((order.sellerRevision ?? 0) !== input.revision)
    throw new Error("Seller changed; refresh first.");
  validateBrother(s, input.brotherId);
  order.sellerBrotherId = input.brotherId;
  order.sellerRevision = input.revision + 1;
  order.sellerCorrected = true;
  record(
    s,
    operator,
    "seller-corrected",
    order.id,
    `${input.reason} (seller ${input.brotherId ?? "unassigned"})`,
    now,
  );
}
const allocationInput = z
  .object({
    id: z.string().max(150),
    kind: z.enum(["receipt", "entry"]),
    revision: z.number().int().min(0),
    allocations: z
      .array(
        z
          .object({
            brotherId: z.string().uuid(),
            units: z.number().int().positive(),
          })
          .strict(),
      )
      .max(100),
    reason: z.string().trim().min(1).max(300),
  })
  .strict();
export function allocateDonation(
  s: State,
  raw: unknown,
  operator: string,
  now: Date,
) {
  const input = allocationInput.parse(raw);
  const source =
    input.kind === "receipt"
      ? s.receipts.find((r) => r.id === input.id && r.category === "donation")
      : s.entries.find((e) => e.id === input.id && e.food);
  if (!source || source.reversedAt)
    throw new Error("Eligible donation source not found.");
  const max = "cents" in source ? source.cents : source.quantity;
  if (
    new Set(input.allocations.map((a) => a.brotherId)).size !==
    input.allocations.length
  )
    throw new Error("A brother cannot appear twice in an allocation.");
  input.allocations.forEach((a) => validateBrother(s, a.brotherId));
  if (input.allocations.reduce((n, a) => n + a.units, 0) > max)
    throw new Error("Donation allocations cannot exceed the verified source.");
  const existing = s.attributions.find((a) => a.id === input.id);
  if ((existing?.revision ?? 0) !== input.revision)
    throw new Error("Donor attribution changed; refresh first.");
  const value = {
    id: input.id,
    kind: input.kind,
    allocations: input.allocations,
    revision: input.revision + 1,
  };
  if (existing) Object.assign(existing, value);
  else s.attributions.push(value);
  record(s, operator, "donor-attribution", input.id, input.reason, now);
}
export function attributeInitialDonation(
  s: State,
  kind: "receipt" | "entry",
  sourceId: string,
  brotherId?: string | null,
) {
  validateBrother(s, brotherId);
  if (!brotherId || s.attributions.some((a) => a.id === sourceId)) return;
  const source =
    kind === "receipt"
      ? s.receipts.find((r) => r.id === sourceId)
      : s.entries.find((e) => e.id === sourceId);
  if (!source) throw new Error("Donation source not found.");
  s.attributions.push({
    id: sourceId,
    kind,
    allocations: [
      { brotherId, units: "cents" in source ? source.cents : source.quantity },
    ],
    revision: 1,
  });
}
export function brotherReport(s: State) {
  const rows = [
    ...s.brothers.map((b) => ({
      brotherId: b.id as string | null,
      name: b.name,
      active: b.active,
    })),
    { brotherId: null, name: "Unassigned", active: true },
  ].map((b) => ({
    ...b,
    ticketsSold: 0,
    ticketRevenueCents: 0,
    personallyDonatedCents: 0,
    goods: {} as Record<string, { quantity: number; points: number }>,
  }));
  for (const order of s.orders) {
    const row =
      rows.find((r) => r.brotherId === (order.sellerBrotherId ?? null)) ??
      rows.at(-1)!;
    for (const ticket of s.tickets.filter(
      (t) => t.orderId === order.id && t.valid && !t.refunded,
    )) {
      row.ticketsSold++;
      row.ticketRevenueCents += ticket.baseCents;
    }
  }
  for (const source of [
    ...s.receipts.filter((r) => r.category === "donation" && !r.reversedAt),
    ...s.entries.filter((e) => e.food && !e.reversedAt),
  ]) {
    const allocations =
      s.attributions.find((a) => a.id === source.id)?.allocations ?? [];
    const total = "cents" in source ? source.cents : source.quantity;
    for (const row of rows) {
      const units = row.brotherId
        ? allocations
            .filter((a) => a.brotherId === row.brotherId)
            .reduce((n, a) => n + a.units, 0)
        : total - allocations.reduce((n, a) => n + a.units, 0);
      if ("cents" in source) row.personallyDonatedCents += units;
      else if (units) {
        const key = `${source.ruleId}:${source.day}`;
        const item = (row.goods[key] ??= { quantity: 0, points: 0 });
        item.quantity += units;
        item.points += (source.points / source.quantity) * units;
      }
    }
  }
  return {
    rows,
    roster: s.brothers,
    orders: s.orders.map((o) => ({
      id: o.id,
      status: o.status,
      sellerBrotherId: o.sellerBrotherId ?? null,
      sellerRaw: o.sellerRaw,
      sellerRevision: o.sellerRevision ?? 0,
      unresolved: Boolean(
        o.sellerRaw && !o.sellerBrotherId && !o.sellerCorrected,
      ),
    })),
    donations: [
      ...s.receipts.filter((r) => r.category === "donation"),
      ...s.entries.filter((e) => e.food),
    ].map((source) => ({
      ...source,
      attribution: s.attributions.find((a) => a.id === source.id) ?? null,
    })),
  };
}
export function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${(/^[\s]*[=+@-]/.test(text) ? "'" : "") + text.replace(/"/g, '""')}"`;
}
export function brotherCsv(s: State) {
  return [
    [
      "Brother",
      "Tickets sold",
      "Ticket base revenue cents",
      "Personal donations cents",
      "Goods (category:day, packages, points)",
    ],
    ...brotherReport(s).rows.map((r) => [
      r.name,
      r.ticketsSold,
      r.ticketRevenueCents,
      r.personallyDonatedCents,
      JSON.stringify(r.goods),
    ]),
  ]
    .map((r) => r.map(csvCell).join(","))
    .join("\r\n");
}
