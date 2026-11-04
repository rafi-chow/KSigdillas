import type Stripe from "stripe";
import { initialState } from "../src/lib/operations/rules";
import { emptyState, type State } from "../src/lib/operations/model";
import type { Store } from "../src/lib/operations/store";
import type { StripeGateway } from "../src/lib/payments/stripe";
export const now = new Date("2026-11-16T12:00:00-06:00");
export function testEnvironment() {
  Object.assign(process.env, {
    TICKET_ENCRYPTION_KEY: "ef".repeat(32),
    OPS_ALLOW_TEST_FIXTURES: "true",
    APP_URL: "https://event.example.test",
    STRIPE_CHECKOUT_ENABLED: "true",
    STRIPE_PRICING_MODE: "order_fee",
    STRIPE_REFUND_WRITE_ENABLED: "true",
    STRIPE_FEE_POLICY_APPROVED: "true",
    STRIPE_FEE_POLICY_REFERENCE: "synthetic-policy-not-for-live-use",
    STRIPE_SECRET_KEY: "sk_test_synthetic",
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_synthetic",
    STRIPE_WEBHOOK_SECRET: "whsec_synthetic",
    STRIPE_ACCOUNT_ID: "acct_synthetic",
    STRIPE_PRICE_BASIC: "price_basic",
    STRIPE_PRICE_MEAT: "price_meat",
    STRIPE_PRICE_BASIC_DOOR: "price_basic_door",
    STRIPE_PRICE_MEAT_DOOR: "price_meat_door",
    EMAIL_PROVIDER: "brevo",
    EMAIL_FROM: "tickets@example.test",
  });
}
export class MemoryStore implements Store {
  state: State = initialState(emptyState());
  private queue: Promise<unknown> = Promise.resolve();
  async read() {
    return structuredClone(this.state);
  }
  async transaction<T>(fn: (s: State) => T | Promise<T>): Promise<T> {
    const work = this.queue.then(async () => {
      const next = structuredClone(this.state);
      const result = await fn(next);
      this.state = next;
      return structuredClone(result);
    });
    this.queue = work.catch(() => {});
    return work;
  }
}
export function fakeStripe(priceOverrides: Record<string, number> = {}) {
  const sessions = new Map<string, Stripe.Checkout.Session>();
  const keys = new Map<string, string>();
  const parameters = new Map<string, Stripe.Checkout.SessionCreateParams>();
  const refunds: Stripe.Refund[] = [];
  const disputes: Stripe.Dispute[] = [];
  const events = new Map<string, Stripe.Event>();
  let calls = 0;
  const gateway: StripeGateway = {
    create: async (params, key) => {
      calls++;
      if (keys.has(key)) {
        if (JSON.stringify(parameters.get(key)) !== JSON.stringify(params))
          throw new Error("Idempotency parameters changed");
        return structuredClone(sessions.get(keys.get(key)!)!);
      }
      const id = `cs_test_${sessions.size + 1}`;
      const prices: Record<string, number> = {
        price_basic: 1000,
        price_meat: 1500,
        price_basic_door: 1200,
        price_meat_door: 1800,
        ...priceOverrides,
      };
      const items = (params.line_items ?? []).map((item, i) => {
        const cents = item.price
          ? prices[item.price]
          : Number(item.price_data?.unit_amount);
        return {
          id: `li_${i}`,
          quantity: item.quantity,
          currency: "usd",
          description: item.price ? "Ticket" : "Processing fee",
          amount_total: cents * (item.quantity ?? 1),
          price: {
            id: item.price ?? "price_fee",
            currency: "usd",
            unit_amount: cents,
          },
        };
      });
      const session = {
        id,
        livemode: false,
        status: "open",
        mode: "payment",
        payment_status: "unpaid",
        payment_intent: `pi_${id}`,
        currency: "usd",
        amount_total: items.reduce((n, i) => n + i.amount_total, 0),
        client_reference_id: params.client_reference_id,
        metadata: params.metadata,
        line_items: { data: items, has_more: false },
        total_details: {
          amount_discount: 0,
          amount_tax: 0,
          amount_shipping: 0,
        },
        client_secret: `${id}_secret_synthetic`,
        url: `https://checkout.stripe.com/synthetic/${id}`,
      } as unknown as Stripe.Checkout.Session;
      sessions.set(id, session);
      keys.set(key, id);
      parameters.set(key, structuredClone(params));
      return structuredClone(session);
    },
    session: async (id) => {
      if (!sessions.has(id)) throw new Error("Unknown synthetic session");
      return structuredClone(sessions.get(id)!);
    },
    expire: async (id) => {
      const session = sessions.get(id)!;
      if (session.status !== "open") throw new Error("Already complete");
      session.status = "expired";
      return structuredClone(session);
    },
    charge: async (paymentId) => {
      const session = [...sessions.values()].find(
        (s) => s.payment_intent === paymentId,
      )!;
      return {
        id: `ch_${session.id}`,
        payment_intent: paymentId,
        paid: true,
        currency: "usd",
        amount: session.amount_total,
        disputed: disputes.some(
          (d) => !["won", "warning_closed"].includes(d.status),
        ),
        balance_transaction: { fee: 136 },
      } as unknown as Stripe.Charge;
    },
    refunds: async (chargeId) =>
      structuredClone(refunds.filter((r) => r.charge === chargeId)),
    disputes: async (chargeId) =>
      structuredClone(disputes.filter((d) => d.charge === chargeId)),
    refund: async (params, key) => {
      const prior = refunds.find((r) => r.metadata?.key === key);
      if (prior) return structuredClone(prior);
      const session = [...sessions.values()].find(
        (s) => s.payment_intent === params.payment_intent,
      )!;
      const refund = {
        id: `re_${refunds.length + 1}`,
        charge: `ch_${session.id}`,
        currency: "usd",
        amount: params.amount,
        status: "succeeded",
        metadata: { ...params.metadata, key },
      } as unknown as Stripe.Refund;
      refunds.push(refund);
      return structuredClone(refund);
    },
    event: async (id) => {
      if (!events.has(id)) throw new Error("Unknown synthetic event");
      return structuredClone(events.get(id)!);
    },
  };
  return {
    gateway,
    sessions,
    parameters,
    refunds,
    disputes,
    events,
    get calls() {
      return calls;
    },
    pay(id: string) {
      const s = sessions.get(id)!;
      s.status = "complete";
      s.payment_status = "paid";
    },
    event(id: string, sessionId: string) {
      const event = {
        id,
        type: "checkout.session.completed",
        livemode: false,
        data: { object: { id: sessionId } },
      } as Stripe.Event;
      events.set(id, event);
      return event;
    },
  };
}
