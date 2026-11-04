import { NextRequest, NextResponse } from "next/server";
import { boundedJson, RequestError } from "@/lib/http";
import { z } from "zod";
import {
  checkoutAvailable,
  stripeRuntimeAvailable,
  startCheckout,
  cancelCheckout,
  reconcileSession,
  stripeGateway,
  budgetStripeGateway,
} from "@/lib/payments/stripe";
import {
  enforceOrigin,
  takeLimit,
  requestNetwork,
} from "@/lib/operations/auth";
import { getStore } from "@/lib/operations/store";
import { digest } from "@/lib/operations/crypto";
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
export async function POST(request: NextRequest) {
  const deadline = Date.now() + 20000;
  if (!stripeRuntimeAvailable())
    return json(
      {
        error: "Online ticket sales are not open yet. Please check back soon.",
      },
      503,
    );
  try {
    enforceOrigin(request);
    const raw = await boundedJson(request);
    const input = z
      .object({
        action: z.enum(["create", "cancel", "reconcile"]),
        mode: z.enum(["embedded", "hosted"]).optional(),
        order: z.unknown().optional(),
        token: z
          .string()
          .regex(/^[A-Za-z0-9_-]{43}$/)
          .optional(),
      })
      .strict()
      .parse(raw);
    if (input.action === "create" && !checkoutAvailable())
      return json({ error: "Online ticket sales are not open yet." }, 503);
    const store = getStore();
    const now = new Date();
    const allowed = await store.transaction(
      (s) =>
        takeLimit(s, "checkout-global", 120, now) &&
        takeLimit(s, `checkout-ip:${digest(requestNetwork(request))}`, 30, now),
    );
    if (!allowed)
      return json(
        { error: "Too many checkout requests. Please wait a minute." },
        429,
      );
    const gateway = budgetStripeGateway(stripeGateway(), deadline);
    if (input.action === "create")
      return json(
        await startCheckout(
          store,
          input.order,
          input.mode ?? "embedded",
          gateway,
          now,
        ),
      );
    if (!input.token) throw new Error("Order access is required.");
    if (input.action === "cancel")
      return json(await cancelCheckout(store, input.token, gateway, now));
    const state = await store.read();
    const order = state.orders.find(
      (o) => o.tokenHash === digest(input.token!),
    );
    const attempt = state.checkouts.find((c) => c.orderId === order?.id);
    if (!order || !attempt?.sessionId)
      return json({ error: "Order not found." }, 404);
    await reconcileSession(store, attempt.sessionId, gateway, now);
    // Ticket email is durable work for the native scheduled worker.
    return json({
      status: (await store.read()).orders.find((o) => o.id === order.id)!
        .status,
    });
  } catch (error) {
    if (error instanceof RequestError)
      return json({ error: error.message }, error.status);
    const message = error instanceof Error ? error.message : "";
    return json(
      {
        error:
          error instanceof z.ZodError
            ? "Check your guest and checkout details."
            : /origin|changed|no longer|not found|Unknown|archived|required|accept|terms|ended|closed|prepared|Retry/.test(
                  message,
                )
              ? message
              : "Checkout could not complete. Retry the same request; check your order before paying again.",
      },
      /origin/.test(message) ? 403 : 400,
    );
  }
}
