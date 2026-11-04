import { z } from "zod";
const id = z.string().min(1).max(100);
const text = z.string().trim().min(1).max(300);
const quantity = z.number().int().min(1).max(1000);
const cents = z.number().int().min(1).max(10000000);
export const orderInput = z
  .object({
    requestKey: z.string().uuid(),
    email: z.email().max(254),
    sellerBrotherId: id.nullable().optional(),
    termsVersion: z.string().max(80).optional(),
    attendees: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(100),
            teamId: id.nullable(),
            tier: z.enum(["basic", "meat"]),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();
export const entryInput = z
  .object({
    requestKey: z.string().uuid(),
    teamId: id.nullable(),
    donorBrotherId: id.nullable().optional(),
    ruleId: id,
    quantity,
    day: z.enum(["2026-11-16", "2026-11-17", "2026-11-18"]),
    reference: text,
    paymentVerified: z.boolean(),
    tagsVerified: z.boolean().optional(),
    participant: z.string().trim().min(1).max(100).optional(),
    hangMillis: z.number().int().positive().max(86400000).optional(),
  })
  .strict();
export const donationInput = z
  .object({
    requestKey: z.string().uuid(),
    teamId: id.nullable(),
    cents,
    reference: text,
    donorBrotherId: id.nullable().optional(),
  })
  .strict();
export const awardInput = z
  .object({
    requestKey: z.string().uuid(),
    evidence: z.string().trim().min(1).max(500).optional(),
    boxesVerified: z.boolean().optional(),
    contest: z.enum([
      "food:2026-11-16",
      "participation:2026-11-17",
      "attendance",
      "hanging",
      "volleyball:1",
      "volleyball:2",
      "volleyball:3",
      "eating:1",
      "eating:2",
      "eating:3",
    ]),
    teamId: id,
    reason: text,
  })
  .strict();
export const ruleInput = z
  .object({
    id,
    revision: z.number().int().positive(),
    points: z.number().int().min(0).max(10000),
    mondayPoints: z.number().int().min(0).max(20000).optional(),
    enabled: z.boolean(),
    reason: text,
  })
  .strict();
export const staffInput = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{3,50}$/),
    name: z.string().trim().min(1).max(100),
    role: z.enum(["check-in", "scorer", "organizer"]),
    password: z.string().min(12).max(256),
  })
  .strict();
export const correctionInput = z
  .object({ requestKey: z.string().uuid(), id, reason: text })
  .strict();
export const loginInput = z
  .object({
    id: z.string().min(1).max(100),
    password: z.string().min(1).max(256),
  })
  .strict();
export type OrderInput = z.infer<typeof orderInput>;
