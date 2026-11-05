import { boundedText, RequestError } from "@/lib/http";
import { NextRequest, NextResponse } from "next/server";
import {
  checkoutConfig,
  receiveStripeEvent,
  stripeClient,
  stripeWebhookSecret,
} from "@/lib/payments/stripe";
import { getStore } from "@/lib/operations/store";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  let event;
  try {
    checkoutConfig();
    const body = await boundedText(request, 1048576);
    event = stripeClient().webhooks.constructEvent(
      body,
      request.headers.get("stripe-signature") ?? "",
      stripeWebhookSecret(),
    );
  } catch (error) {
    if (error instanceof RequestError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "Stripe signature or configuration is invalid." },
      { status: 400 },
    );
  }
  try {
    const store = getStore();
    await receiveStripeEvent(store, event);
    // Signature-verified transport evidence only; no customer payload or tokens.
    console.log(
      JSON.stringify({
        kind: "stripe-webhook-received",
        eventId: event.id,
        type: event.type,
        livemode: event.livemode,
        configurationProbe:
          (event.data.object as { metadata?: Record<string, string> }).metadata
            ?.ksigdillas_setup === "unpaid-configuration-check",
      }),
    );
    // Acknowledge only durable receipt. The native worker handles recovery and
    // delivery independently of this request and its execution limit.
    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof RequestError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "Event could not be persisted; retry required." },
      { status: 503 },
    );
  }
}
