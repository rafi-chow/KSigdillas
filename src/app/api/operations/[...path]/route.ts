import { NextRequest, NextResponse } from "next/server";
import { boundedJson, RequestError } from "@/lib/http";
import { launchChecks } from "@/lib/launch";
import { z } from "zod";
import { getStore } from "@/lib/operations/store";
import {
  authorize,
  enforceOrigin,
  loginToStore,
  sessionUser,
  staffCookie,
  takeLimit,
  requestNetwork,
} from "@/lib/operations/auth";
import {
  addDonation,
  addEntry,
  addStaff,
  audit,
  award,
  createOrder,
  correctAdmission,
  editRule,
  refundTickets,
  reverseCheckIn,
  reverseEntry,
  revokeStaff,
  scanTicket,
  standings,
  transferTicket,
} from "@/lib/operations/service";
import { digest, unseal } from "@/lib/operations/crypto";
import {
  allocateDonation,
  brotherCsv,
  brotherReport,
  correctSeller,
  saveBrother,
} from "@/lib/operations/brothers";
import {
  requestStripeRefund,
  reconcileSession,
  stripeGateway,
  stripeRefundWriteEnabled,
} from "@/lib/payments/stripe";
import { admissionWindowOpen } from "@/lib/operations/admissions";
import { correctDonation } from "@/lib/payments/donations";
import { contestTotals } from "@/lib/operations/contests";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    },
  });
const requestKey = z.string().uuid();
async function handle(request: NextRequest, context: Context) {
  try {
    const path = (await context.params).path.join("/");
    const now = new Date();
    const store = getStore();
    const token = request.cookies.get(staffCookie)?.value;
    if (request.method !== "GET") enforceOrigin(request);
    if (path === "auth" && request.method === "GET") {
      const user = sessionUser(await store.read(), token, now);
      return json({
        user: user ? { id: user.id, name: user.name, role: user.role } : null,
      });
    }
    if (path === "auth" && request.method === "POST") {
      const body = await boundedJson(request);
      const network = requestNetwork(request);
      const result = await loginToStore(store, body, network, now);
      if (!result)
        return json(
          {
            error: "Invalid credentials or too many attempts. Try again later.",
          },
          401,
        );
      const response = json({ user: result.user });
      response.cookies.set(staffCookie, result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 8 * 3600,
      });
      return response;
    }
    if (path === "auth" && request.method === "DELETE") {
      await store.transaction((s) => {
        const session = s.sessions.find((x) => x.id === digest(token ?? ""));
        if (session) session.revoked = true;
      });
      const response = json({ ok: true });
      response.cookies.delete(staffCookie);
      return response;
    }
    if (request.method === "GET") {
      const s = await store.read();
      const user = authorize(s, token, "scan", now);
      if (path === "launch") {
        authorize(s, token, "organize", now);
        return json({ checks: launchChecks(), termsVersion: "2026-11-03-v1" });
      }
      if (path === "desk") {
        const publicData = standings(s);
        return json({
          user: { id: user.id, name: user.name, role: user.role },
          ...publicData,
          admissionWindowOpen: admissionWindowOpen(now),
          settings: user.role === "organizer" ? s.settings[0] : undefined,
          awards: s.awards,
          contests: user.role !== "check-in" ? contestTotals(s) : [],
          rules: s.rules,
          brothers:
            user.role !== "check-in"
              ? s.brothers
                  .filter((b) => b.active)
                  .map(({ id, name }) => ({ id, name }))
              : [],
          jobs: user.role === "organizer" ? s.jobs : [],
          staff:
            user.role === "organizer"
              ? s.staff.map(({ id, name, role, active }) => ({
                  id,
                  name,
                  role,
                  active,
                }))
              : [],
          audit: user.role === "organizer" ? s.audit.slice(-100).reverse() : [],
          ledger:
            user.role !== "check-in" ? s.ledger.slice(-100).reverse() : [],
          receipts:
            user.role !== "check-in" ? s.receipts.slice(-100).reverse() : [],
          entries:
            user.role !== "check-in" ? s.entries.slice(-100).reverse() : [],
          integrations:
            user.role === "organizer"
              ? {
                  pendingEvents: s.providerEvents.filter(
                    (e) => e.status !== "processed",
                  ),
                  donations: s.donations,
                  refunds: s.refunds,
                  refundWriteEnabled: stripeRefundWriteEnabled(),
                  checkouts: s.checkouts.map(
                    ({
                      id,
                      orderId,
                      status,
                      processorFeeCents,
                      nextCheckAt,
                      error,
                    }) => ({
                      id,
                      orderId,
                      status,
                      processorFeeCents,
                      nextCheckAt,
                      error,
                    }),
                  ),
                  heartbeat: s.attempts.find(
                    (a) => a.id === "maintenance-heartbeat",
                  )?.resetsAt,
                }
              : undefined,
        });
      }
      if (path === "brothers" || path === "brothers.csv") {
        authorize(s, token, "organize", now);
        if (path === "brothers.csv")
          return new NextResponse(brotherCsv(s), {
            headers: {
              "Content-Type": "text/csv; charset=utf-8",
              "Content-Disposition":
                "attachment; filename=brother-contributions.csv",
              "Cache-Control": "private, no-store",
            },
          });
        return json(brotherReport(s));
      }
      if (path === "orders") {
        const query = request.nextUrl.searchParams
          .get("q")
          ?.trim()
          .toLowerCase();
        if (!query || query.length < 2) return json({ orders: [] });
        const orders = s.orders
          .filter(
            (o) =>
              o.id.includes(query) ||
              o.email.includes(query) ||
              s.tickets.some(
                (t) =>
                  t.orderId === o.id &&
                  (t.name.toLowerCase().includes(query) ||
                    t.id.includes(query)),
              ),
          )
          .slice(0, 30);
        return json({
          orders: orders.map((o) => ({
            id: o.id,
            status: o.status,
            source: o.source,
            sellerBrotherId:
              user.role === "organizer" ? o.sellerBrotherId : undefined,
            createdAt: o.createdAt,
            baseCents: user.role !== "check-in" ? o.baseCents : undefined,
            feeCents: user.role === "organizer" ? o.feeCents : undefined,
            refundedFeeCents:
              user.role === "organizer" ? o.refundedFeeCents : undefined,
            taxCents: user.role === "organizer" ? o.taxCents : undefined,
            refundedTaxCents:
              user.role === "organizer" ? (o.refundedTaxCents ?? 0) : undefined,
            email: user.role !== "check-in" ? o.email : undefined,
            tickets: s.tickets
              .filter((t) => t.orderId === o.id)
              .map(
                ({
                  id,
                  name,
                  tier,
                  teamId,
                  valid,
                  checkedInAt,
                  admissionId,
                  refunded,
                  baseCents,
                }) => ({
                  id,
                  name,
                  tier,
                  teamId,
                  valid,
                  checkedInAt,
                  admissionCode: s.admissions.find((a) => a.id === admissionId)
                    ?.code,
                  refunded,
                  baseCents: user.role === "organizer" ? baseCents : undefined,
                }),
              ),
          })),
        });
      }
      if (path === "export") {
        authorize(s, token, "organize", now);
        // Safe attendee manifest; no credentials, encrypted secrets, or bearer tokens.
        const manifest = s.tickets.map(
          ({
            id,
            orderId,
            name,
            tier,
            teamId,
            valid,
            checkedInAt,
            admissionId,
          }) => ({
            id,
            orderId,
            name,
            tier,
            teamId,
            valid,
            checkedInAt,
            admissionCode: s.admissions.find((a) => a.id === admissionId)?.code,
          }),
        );
        return json({
          exportedAt: now.toISOString(),
          tickets: manifest,
          totals: standings(s),
        });
      }
      return json({ error: "Not found." }, 404);
    }
    if (request.method !== "POST")
      return json({ error: "Method not allowed." }, 405);
    const body = await boundedJson(request);
    const allowed = await store.transaction((s) => {
      const user = authorize(s, token, "scan", now);
      return takeLimit(s, `mutation:${user.id}`, 120, now);
    });
    if (!allowed)
      return json({ error: "Too many requests. Please wait a minute." }, 429);
    if (path === "stripe-refund") {
      const state = await store.read();
      const user = authorize(state, token, "organize", now);
      return json({
        refund: await requestStripeRefund(
          store,
          body,
          user.id,
          stripeGateway(),
          now,
        ),
        message:
          "Refund submitted. Tickets change only after Stripe confirms it.",
      });
    }
    if (path === "allocate-stripe-refund") {
      const input = z
        .object({
          id: z.string(),
          ticketIds: z.array(z.string()).max(198),
          feeCents: z.number().int().min(0),
          taxCents: z.number().int().min(0).default(0),
          reason: z.string().trim().min(1).max(300),
        })
        .strict()
        .parse(body);
      const session = await store.transaction((s) => {
        const user = authorize(s, token, "organize", now);
        const refund = s.refunds.find(
          (r) => r.id === input.id && r.status === "review" && r.providerId,
        );
        if (!refund) throw new Error("Refund not found or already allocated.");
        const order = s.orders.find((o) => o.id === refund.orderId)!;
        if (new Set(input.ticketIds).size !== input.ticketIds.length)
          throw new Error("Invalid repeated refund ticket.");
        const tickets = input.ticketIds.map((id) =>
          s.tickets.find(
            (t) => t.id === id && t.orderId === order.id && !t.refunded,
          ),
        );
        if (
          tickets.some((t) => !t) ||
          input.feeCents > order.feeCents - order.refundedFeeCents ||
          input.taxCents > order.taxCents - (order.refundedTaxCents ?? 0) ||
          tickets.reduce((n, t) => n + t!.baseCents, 0) +
            input.feeCents +
            input.taxCents !==
            refund.amountCents
        )
          throw new Error(
            "Refund allocation does not match the confirmed amount.",
          );
        refund.ticketIds = input.ticketIds;
        refund.feeCents = input.feeCents;
        refund.taxCents = input.taxCents;
        refund.reason = input.reason;
        refund.status = "pending";
        audit(s, user.id, "refund-allocated", refund.id, input.reason, now);
        return s.checkouts.find((c) => c.orderId === order.id)!.sessionId!;
      });
      await reconcileSession(store, session, stripeGateway(), now);
      return json({ message: "Refund allocation saved and reconciled." });
    }
    const result = await store.transaction((s) => {
      const permission = ["scan", "lookup-scan"].includes(path)
        ? "scan"
        : ["entry", "donation"].includes(path)
          ? "score"
          : "organize";
      const user = authorize(s, token, permission, now);
      if (path === "chapter-representative") {
        const input = z
          .object({
            teamId: z.string(),
            name: z.string().trim().min(1).max(100),
            contact: z.string().trim().min(1).max(200),
            revision: z.number().int(),
            reason: z.string().trim().min(1).max(300),
          })
          .strict()
          .parse(body);
        if (!s.teams.some((t) => t.id === input.teamId))
          throw new Error("Unknown team.");
        const settings = s.settings[0];
        if (settings.revision !== input.revision)
          throw new Error("Settings changed; refresh first.");
        settings.chapterRepresentatives ??= [];
        const prior = settings.chapterRepresentatives.find(
          (r) => r.teamId === input.teamId,
        );
        if (prior)
          Object.assign(prior, { name: input.name, contact: input.contact });
        else
          settings.chapterRepresentatives.push({
            teamId: input.teamId,
            name: input.name,
            contact: input.contact,
          });
        settings.revision++;
        audit(
          s,
          user.id,
          "chapter-representative-saved",
          input.teamId,
          input.reason,
          now,
        );
        return { ok: true };
      }
      if (path === "brother")
        return { brother: saveBrother(s, body, user.id, now) };
      if (path === "seller") {
        correctSeller(s, body, user.id, now);
        return { ok: true };
      }
      if (path === "donor") {
        allocateDonation(s, body, user.id, now);
        return { ok: true };
      }
      if (path === "resolve-email") {
        const input = z
          .object({
            id: z.string(),
            providerRef: z.string().max(500).optional(),
            retry: z.boolean(),
            reason: z.string().trim().min(1).max(300),
          })
          .strict()
          .parse(body);
        const job = s.jobs.find((j) => j.id === input.id);
        if (!job) throw new Error("Email job not found.");
        if (input.retry) {
          job.status = "queued";
          job.attempts = 0;
          job.uncertain = false;
          job.nextAttemptAt = now.toISOString();
          job.leaseUntil = undefined;
          job.leaseId = undefined;
          job.lastError = undefined;
        } else {
          if (!input.providerRef)
            throw new Error("Provider reference is required.");
          job.status = "sent";
          job.providerRef = input.providerRef;
          job.deliveryStatus = "accepted";
          job.uncertain = false;
          job.leaseUntil = undefined;
        }
        audit(s, user.id, "email-resolved", job.id, input.reason, now);
        return { ok: true };
      }
      if (path === "donation-attribution") {
        const input = z
          .object({
            id: z.string(),
            revision: z.number().int().nonnegative(),
            teamId: z.string().nullable(),
            brotherId: z.string().nullable(),
            reason: z.string().trim().min(1).max(300),
          })
          .strict()
          .parse(body);
        correctDonation(s, input, user.id, now);
        return { ok: true };
      }
      if (path === "link-admission") {
        const input = z
          .object({
            id: z.string(),
            admissionCode: z.string(),
            reason: z.string().trim().min(1).max(300),
          })
          .strict()
          .parse(body);
        correctAdmission(
          s,
          input.id,
          input.admissionCode,
          input.reason,
          user.id,
          now,
        );
        return { ok: true };
      }
      const scanOptions = {
        admissionCode: z.string().max(40).optional(),
        rehearsal: z.boolean().optional(),
        overrideReason: z.string().trim().min(1).max(300).optional(),
      };
      if (path === "scan") {
        const { token: input, ...options } = z
          .object({ token: z.string().min(1).max(2048), ...scanOptions })
          .strict()
          .parse(body);
        let value = input.trim();
        if (value.startsWith("http")) {
          const url = new URL(value);
          if (
            url.origin !== new URL(process.env.APP_URL ?? request.url).origin ||
            !url.pathname.startsWith("/tickets/")
          )
            throw new Error("This QR belongs to another site.");
          value = url.pathname.split("/").at(-1)!;
        }
        if (options.overrideReason && user.role !== "organizer")
          throw new Error("Only the organizer role can override event hours.");
        const result = scanTicket(s, value, user.id, now, options);
        return {
          admitted: result.admitted,
          rehearsal: options.rehearsal === true,
          message: result.message,
          ticket: {
            id: result.ticket.id,
            name: result.ticket.name,
            tier: result.ticket.tier,
            teamId: result.ticket.teamId,
            checkedInAt: result.ticket.checkedInAt,
          },
        };
      }
      if (path === "lookup-scan") {
        const { id, ...options } = z
          .object({ id: z.string().max(100), ...scanOptions })
          .strict()
          .parse(body);
        if (options.overrideReason && user.role !== "organizer")
          throw new Error("Only the organizer role can override event hours.");
        const ticket = s.tickets.find((t) => t.id === id);
        if (!ticket) throw new Error("Ticket not found.");
        const result = scanTicket(
          s,
          unseal(ticket.tokenBox),
          user.id,
          now,
          options,
        );
        return {
          admitted: result.admitted,
          rehearsal: options.rehearsal === true,
          message: result.message,
          ticket: {
            id,
            name: ticket.name,
            tier: ticket.tier,
            teamId: ticket.teamId,
          },
        };
      }
      if (path === "entry") return { id: addEntry(s, body, user.id, now) };
      if (path === "donation")
        return { id: addDonation(s, body, user.id, now) };
      if (path === "reverse")
        return { id: reverseEntry(s, body, user.id, now) };
      if (path === "award") return { id: award(s, body, user.id, now) };
      if (path === "rule") return { rule: editRule(s, body, user.id, now) };
      if (path === "staff") {
        addStaff(s, body, user.id, now);
        return { ok: true };
      }
      if (path === "revoke-staff") {
        const { id } = z
          .object({ id: z.string().max(100) })
          .strict()
          .parse(body);
        revokeStaff(s, id, user.id, now);
        return { ok: true };
      }
      if (path === "cash-sale") {
        const { paymentVerified, ...input } = z
          .object({
            requestKey,
            email: z.string(),
            attendees: z.array(z.unknown()),
            sellerBrotherId: z.string().uuid().nullable().optional(),
            paymentVerified: z.literal(true),
          })
          .strict()
          .parse(body);
        void paymentVerified;
        const order = createOrder(s, input, "cash", user.id, now);
        return { id: order.id, orderUrl: `/orders/${unseal(order.tokenBox)}` };
      }
      if (path === "settings") {
        const input = z
          .object({
            revision: z.number().int(),
            offlineSalesEnabled: z.boolean(),
            reason: z.string().trim().min(1).max(300),
          })
          .strict()
          .parse(body);
        const settings = s.settings[0];
        if (settings.revision !== input.revision)
          throw new Error("Settings changed; refresh first.");
        settings.offlineSalesEnabled = input.offlineSalesEnabled;
        settings.revision++;
        settings.updatedAt = now.toISOString();
        audit(s, user.id, "sales-setting", "event", input.reason, now);
        return { ok: true };
      }
      if (path === "reverse-check-in") {
        const input = z
          .object({
            id: z.string().max(100),
            reason: z.string().trim().min(1).max(300),
          })
          .strict()
          .parse(body);
        reverseCheckIn(s, input.id, input.reason, user.id, now);
        return { ok: true };
      }
      if (path === "cash-refund") {
        const input = z
          .object({
            requestKey,
            id: z.string().max(100),
            ticketIds: z.array(z.string()).max(50),
            reason: z.string().trim().min(1).max(300),
            cashReturned: z.literal(true),
          })
          .strict()
          .parse(body);
        const order = s.orders.find((o) => o.id === input.id);
        if (order?.source !== "cash")
          throw new Error("Remote payment refunds are not available yet.");
        if (!s.submissions.some((x) => x.id === input.requestKey)) {
          refundTickets(
            s,
            input.id,
            input.ticketIds,
            0,
            user.id,
            input.reason,
            now,
          );
          s.submissions.push({
            id: input.requestKey,
            fingerprint: digest(JSON.stringify(input)),
            createdAt: now.toISOString(),
            resultId: input.id,
          });
        }
        return { ok: true };
      }
      if (path === "resend") {
        const input = z
          .object({ requestKey, id: z.string().max(100) })
          .strict()
          .parse(body);
        const order = s.orders.find((o) => o.id === input.id);
        if (
          !order ||
          order.privacyAnonymizedAt ||
          !["paid", "partially-refunded"].includes(order.status)
        )
          throw new Error("Order is not eligible for delivery.");
        if (
          s.jobs.some(
            (j) =>
              j.orderId === order.id &&
              (j.uncertain || ["queued", "sending"].includes(j.status)),
          )
        )
          throw new Error(
            "Resolve the existing queued or uncertain email before resending.",
          );
        if (!s.jobs.some((j) => j.id === input.requestKey))
          s.jobs.push({
            id: input.requestKey,
            orderId: input.id,
            status: "queued",
            attempts: 0,
            nextAttemptAt: now.toISOString(),
          });
        audit(
          s,
          user.id,
          "ticket-resend",
          input.id,
          "Staff resend requested",
          now,
        );
        return { ok: true };
      }
      if (path === "transfer-ticket") {
        const input = z
          .object({
            id: z.string().max(100),
            teamId: z.string().max(100).nullable(),
            reason: z.string().trim().min(1).max(300),
          })
          .strict()
          .parse(body);
        transferTicket(s, input.id, input.teamId, input.reason, user.id, now);
        return { ok: true };
      }
      if (path === "replace-ticket") {
        const input = z
          .object({
            id: z.string().max(100),
            reason: z.string().trim().min(1).max(300),
          })
          .strict()
          .parse(body);
        const ticket = s.tickets.find((t) => t.id === input.id);
        if (!ticket?.valid || ticket.checkedInAt)
          throw new Error("Only unused valid tickets can be replaced.");
        const replacement = opaqueToken();
        ticket.tokenHash = digest(replacement);
        ticket.tokenBox = seal(replacement);
        audit(s, user.id, "ticket-replaced", input.id, input.reason, now);
        return { ok: true };
      }
      throw new Error("Unknown staff action.");
    });
    return json({ message: "Saved.", ...result });
  } catch (e) {
    if (e instanceof RequestError) return json({ error: e.message }, e.status);
    if (e instanceof z.ZodError)
      return json(
        { error: "Please check the required fields and values." },
        400,
      );
    if (e && typeof e === "object" && "code" in e)
      return json(
        {
          error: "Event storage is temporarily unavailable. Please try again.",
        },
        503,
      );
    const text =
      e instanceof Error ? e.message : "Unable to complete this request.";
    const expected =
      /sign in|not found|not open|not configured|role|origin|changed|already|Choose|rejected|disabled|Invalid|Verify|Specify|required|eligible|Only|Only|Unknown|not enabled|ended|cannot|does not|Request|Ticket|Order|Sales|contest|Remote|Cash|partial/i.test(
        text,
      );
    return json(
      { error: expected ? text : "The event desk is temporarily unavailable." },
      /sign in/.test(text)
        ? 401
        : /role|origin|Cross-site/.test(text)
          ? 403
          : /not configured|not open/.test(text)
            ? 503
            : 400,
    );
  }
}
import { opaqueToken, seal } from "@/lib/operations/crypto";
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
