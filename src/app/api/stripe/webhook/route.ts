import { boundedText, RequestError } from "@/lib/http";
import { NextRequest, NextResponse, after } from "next/server";
import {
  checkoutConfig,
  receiveStripeEvent,
  processStripeWork,
  stripeClient,
  stripeWebhookSecret,
  stripeGateway,
} from "@/lib/payments/stripe";
import { getStore } from "@/lib/operations/store";
import { deliverDue } from "@/lib/email/delivery";
export const runtime = "nodejs";
export const maxDuration = 120;
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
    if (error instanceof RequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(
      { error: "Stripe signature or configuration is invalid." },
      { status: 400 },
    );
  }
  try {
    const store = getStore();
    await receiveStripeEvent(store, event);
    after(async () => {
      await processStripeWork(store, stripeGateway());
      await deliverDue(store);
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof RequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(
      { error: "Event could not be persisted; retry required." },
      { status: 503 },
    );
  }
}
