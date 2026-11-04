import Stripe from "stripe";
import { withinBudget } from "../jobs/budget";
import { z } from "zod";
import type { Store } from "../operations/store";
import type { CheckoutAttempt, Order, State } from "../operations/model";
import {
  createOrder,
  fulfillOrder,
  audit,
  refundTickets,
  dispute,
} from "../operations/service";
import { grossUp, saleStart, saleEnd } from "../operations/rules";
import { digest, unseal } from "../operations/crypto";
import { appUrl } from "../email/delivery";
import { publicPrices, purchaseTerms } from "../policies";
import { assertLaunchReady } from "../launch";
export const stripeApiVersion = "2026-10-28.endive" as const;
export function checkoutConfig(requireSales = false) {
  const env = process.env;
  if (
    requireSales &&
    (env.STRIPE_CHECKOUT_ENABLED !== "true" ||
      env.STRIPE_FEE_POLICY_APPROVED !== "true" ||
      !env.STRIPE_FEE_POLICY_REFERENCE?.trim())
  )
    throw new Error("Online ticket sales are not open yet.");
  const secret = env.STRIPE_SECRET_KEY || env.STRIPE_SECRET || "";
  const publishableKey =
    env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || env.STRIPE_PUBLISHABLE || "";
  const livemode = /^(sk|rk)_live_/.test(secret);
  if (
    !/^(sk|rk)_(test|live)_/.test(secret) ||
    !publishableKey.startsWith(livemode ? "pk_live_" : "pk_test_") ||
    !/^acct_/.test(env.STRIPE_ACCOUNT_ID ?? "") ||
    !stripeWebhookSecret().startsWith("whsec_")
  )
    throw new Error("Stripe is not configured.");
  if (requireSales && livemode) assertLaunchReady();
  const pricingMode = env.STRIPE_PRICING_MODE ?? "all_in";
  if (!["all_in", "order_fee"].includes(pricingMode))
    throw new Error("Invalid ticket pricing mode.");
  const prices = {
    basic: env.STRIPE_PRICE_BASIC ?? "",
    meat: env.STRIPE_PRICE_MEAT ?? "",
    basicDoor: env.STRIPE_PRICE_BASIC_DOOR ?? "",
    meatDoor: env.STRIPE_PRICE_MEAT_DOOR ?? "",
  };
  if (
    ![prices.basic, prices.meat].every((p) => /^price_/.test(p)) ||
    Object.values(prices).some((p) => Boolean(p) && !/^price_/.test(p)) ||
    Boolean(prices.basicDoor) !== Boolean(prices.meatDoor) ||
    new Set(Object.values(prices).filter(Boolean)).size !==
      Object.values(prices).filter(Boolean).length
  )
    throw new Error("Stripe prices are not configured.");
  const basisPoints = Number(env.STRIPE_FEE_BASIS_POINTS ?? "290");
  const fixedCents = Number(env.STRIPE_FEE_FIXED_CENTS ?? "30");
  if (
    !Number.isInteger(basisPoints) ||
    basisPoints < 0 ||
    basisPoints > 1000 ||
    !Number.isInteger(fixedCents) ||
    fixedCents < 0 ||
    fixedCents > 100
  )
    throw new Error("Invalid approved processing fee configuration.");
  return {
    secret,
    publishableKey,
    livemode,
    accountId: env.STRIPE_ACCOUNT_ID!,
    prices,
    basisPoints,
    fixedCents,
    pricingMode: pricingMode as "all_in" | "order_fee",
  };
}
export function checkoutAvailable(now = new Date()) {
  try {
    const config = checkoutConfig(true);
    if (now.getTime() >= saleEnd) return false;
    if (
      publicPrices(now).door &&
      (!config.prices.basicDoor || !config.prices.meatDoor)
    )
      return false;
    return true;
  } catch {
    return false;
  }
}
export function stripeRefundWriteEnabled() {
  return process.env.STRIPE_REFUND_WRITE_ENABLED === "true";
}
export function stripeRuntimeAvailable() {
  try {
    checkoutConfig();
    return true;
  } catch {
    return false;
  }
}
export interface StripeGateway {
  create(
    params: Stripe.Checkout.SessionCreateParams,
    key: string,
  ): Promise<Stripe.Checkout.Session>;
  session(id: string): Promise<Stripe.Checkout.Session>;
  expire(id: string): Promise<Stripe.Checkout.Session>;
  charge(paymentId: string): Promise<Stripe.Charge>;
  disputes(chargeId: string): Promise<Stripe.Dispute[]>;
  refunds(chargeId: string): Promise<Stripe.Refund[]>;
  refund(
    params: Stripe.RefundCreateParams,
    key: string,
  ): Promise<Stripe.Refund>;
  event(id: string): Promise<Stripe.Event>;
}
export function stripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK || "";
}
export function stripeClient() {
  return new Stripe(
    process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET || "",
    {
      apiVersion: stripeApiVersion,
      maxNetworkRetries: 0,
      timeout: 5000,
    },
  );
}
export async function retrieveOwnStripeAccount(stripe = stripeClient()) {
  return z
    .object({
      id: z.string(),
      charges_enabled: z.boolean(),
      payouts_enabled: z.boolean(),
    })
    .parse(await stripe.rawRequest("GET", "/v1/account"));
}
export function assertStripePrice(price: Stripe.Price, expectedCents: number) {
  if (
    !price.active ||
    price.currency !== "usd" ||
    price.unit_amount !== expectedCents ||
    price.recurring
  )
    throw new Error("Stripe catalog does not match the quoted ticket price.");
}
export function stripeGateway(stripe = stripeClient()): StripeGateway {
  return {
    create: async (p, key) => {
      const config = checkoutConfig();
      // Restricted keys need no account-management permission. Approved price
      // IDs are account-scoped; retrieving them with this key and creating the
      // session proves access to that catalog. Full keys can additionally read
      // account capability without expanding the restricted key's permissions.
      if (!config.secret.startsWith("rk_")) {
        const account = await retrieveOwnStripeAccount(stripe);
        if (
          account.id !== config.accountId ||
          (config.livemode && !account.charges_enabled)
        )
          throw new Error("Stripe account is not ready for these payments.");
      }
      const catalog = z
        .record(
          z.string(),
          z.object({
            quantity: z.number().int().positive(),
            cents: z.number().int().positive(),
          }),
        )
        .parse(JSON.parse(String(p.metadata?.catalog ?? "{}")));
      await Promise.all(
        (p.line_items ?? [])
          .filter((item) => item.price)
          .map(async (item) => {
            const expected = catalog[item.price!];
            if (!expected || item.quantity !== expected.quantity)
              throw new Error("Stripe catalog snapshot is missing.");
            assertStripePrice(
              await stripe.prices.retrieve(item.price!),
              expected.cents,
            );
          }),
      );
      return stripe.checkout.sessions.create(p, { idempotencyKey: key });
    },
    session: (id) =>
      stripe.checkout.sessions.retrieve(id, {
        expand: ["line_items.data.price", "payment_intent"],
      }),
    expire: (id) => stripe.checkout.sessions.expire(id),
    charge: async (id) => {
      const intent = await stripe.paymentIntents.retrieve(id, {
        expand: [
          checkoutConfig().secret.startsWith("rk_")
            ? "latest_charge"
            : "latest_charge.balance_transaction",
        ],
      });
      if (!intent.latest_charge || typeof intent.latest_charge === "string")
        throw new Error("Payment charge is not available.");
      return intent.latest_charge;
    },
    disputes: async (charge) =>
      (await stripe.disputes.list({ charge, limit: 100 })).data,
    refunds: async (charge) => {
      const items: Stripe.Refund[] = [];
      for await (const item of stripe.refunds.list({ charge, limit: 100 }))
        items.push(item);
      return items;
    },
    refund: (p, key) => stripe.refunds.create(p, { idempotencyKey: key }),
    event: (id) => stripe.events.retrieve(id),
  };
}
export function budgetStripeGateway(
  gateway: StripeGateway,
  deadline: number,
): StripeGateway {
  return new Proxy(gateway, {
    get(target, property: keyof StripeGateway) {
      const operation = target[property];
      return (...args: unknown[]) =>
        withinBudget(
          () => Reflect.apply(operation, target, args),
          Math.min(deadline, Date.now() + 5000),
        );
    },
  });
}
function priceFor(
  config: ReturnType<typeof checkoutConfig>,
  tier: "basic" | "meat",
  cents: number,
) {
  return tier === "basic"
    ? cents === 1200
      ? config.prices.basicDoor
      : config.prices.basic
    : cents === 1800
      ? config.prices.meatDoor
      : config.prices.meat;
}
export function sessionParameters(
  s: State,
  order: Order,
  attempt: CheckoutAttempt,
  now: Date,
) {
  void now;
  const config = checkoutConfig();
  const counts = new Map<string, number>();
  s.tickets
    .filter((t) => t.orderId === order.id)
    .forEach((t) => {
      const price = priceFor(config, t.tier, t.baseCents);
      counts.set(price, (counts.get(price) ?? 0) + 1);
    });
  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] =
    attempt.catalog
      ? Object.entries(attempt.catalog).map(([price, row]) => ({
          price,
          quantity: row.quantity,
        }))
      : [...counts].map(([price, quantity]) => ({ price, quantity }));
  const extraFee = order.feeCents - (attempt.includedFeeCents ?? 0);
  if (extraFee)
    line_items.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: extraFee,
        product_data: { name: "Processing fee" },
      },
    });
  const path = `${attempt.origin ?? appUrl()}/orders/${unseal(order.tokenBox)}`;
  return {
    mode: "payment",
    ui_mode: attempt.mode === "embedded" ? "embedded_page" : "hosted_page",
    allowed_payment_method_types: ["card"],
    customer_email: order.email,
    client_reference_id: order.id,
    metadata: {
      orderId: order.id,
      catalog: JSON.stringify(attempt.catalog ?? {}),
      feePolicy: (
        attempt.feePolicy ??
        process.env.STRIPE_FEE_POLICY_REFERENCE ??
        "existing-order"
      ).slice(0, 300),
    },
    payment_intent_data: { metadata: { orderId: order.id } },
    line_items,
    expires_at: Math.floor(
      Math.max(
        Date.parse(order.quoteExpiresAt),
        Date.parse(attempt.createdAt) + 31 * 60000,
      ) / 1000,
    ),
    ...(attempt.mode === "embedded"
      ? { return_url: path, redirect_on_completion: "always" }
      : { success_url: path, cancel_url: path }),
    custom_text: {
      submit: {
        message: `${purchaseTerms.refund} One QR ticket per guest. Terms: ${purchaseTerms.version}.`,
      },
    },
  } satisfies Stripe.Checkout.SessionCreateParams;
}
export async function startCheckout(
  store: Store,
  raw: unknown,
  mode: "embedded" | "hosted",
  gateway: StripeGateway,
  now = new Date(),
) {
  const config = checkoutConfig(true);
  const claimed = await store.transaction((s) => {
    const estimate = createOrder(s, raw, "stripe", "buyer", now);
    if (
      !["pending"].includes(estimate.status) ||
      Date.parse(estimate.quoteExpiresAt) <= now.getTime()
    )
      throw new Error(
        "This order is no longer payable. Check your order before starting again.",
      );
    let attempt = s.checkouts.find((c) => c.orderId === estimate.id);
    if (
      attempt &&
      (attempt.mode !== mode ||
        attempt.accountId !== config.accountId ||
        attempt.livemode !== config.livemode)
    )
      throw new Error(
        "Checkout settings changed. Cancel this attempt before starting again.",
      );
    if (!attempt) {
      const tickets = s.tickets.filter((t) => t.orderId === estimate.id);
      const paidPrices = publicPrices(now).online;
      estimate.feeCents =
        config.pricingMode === "all_in"
          ? tickets.reduce(
              (sum, t) => sum + paidPrices[t.tier] - t.baseCents,
              0,
            )
          : grossUp(estimate.baseCents, config.basisPoints, config.fixedCents) -
            estimate.baseCents;
      estimate.totalCents = estimate.baseCents + estimate.feeCents;
      attempt = {
        id: `checkout:${estimate.id}`,
        orderId: estimate.id,
        mode,
        status: "creating",
        createdAt: now.toISOString(),
        nextCheckAt: new Date(now.getTime() + 60000).toISOString(),
        accountId: config.accountId,
        livemode: config.livemode,
      };
      attempt.pricingMode = config.pricingMode;
      attempt.includedFeeCents =
        config.pricingMode === "all_in" ? estimate.feeCents : 0;
      attempt.origin = appUrl();
      attempt.feePolicy = process.env.STRIPE_FEE_POLICY_REFERENCE;
      attempt.catalog = {};
      for (const ticket of s.tickets.filter((t) => t.orderId === estimate.id)) {
        const price = priceFor(config, ticket.tier, ticket.baseCents);
        if (!price)
          throw new Error(
            "Online door prices are not configured. Door cash tickets remain available.",
          );
        const row = (attempt.catalog[price] ??= {
          quantity: 0,
          cents:
            config.pricingMode === "all_in"
              ? paidPrices[ticket.tier]
              : ticket.baseCents,
        });
        row.quantity++;
      }
      s.checkouts.push(attempt);
    }
    return {
      order: structuredClone(estimate),
      attempt: structuredClone(attempt),
      parameters: sessionParameters(s, estimate, attempt, now),
    };
  });
  // Identical requests use identical parameters and the same provider idempotency key.
  const session = claimed.attempt.sessionId
    ? await gateway.session(claimed.attempt.sessionId)
    : await gateway.create(claimed.parameters, claimed.attempt.id);
  if (
    session.livemode !== config.livemode ||
    session.client_reference_id !== claimed.order.id
  )
    throw new Error("Stripe session does not match this order.");
  await store.transaction((s) => {
    const a = s.checkouts.find((c) => c.id === claimed.attempt.id)!;
    if (a.sessionId && a.sessionId !== session.id)
      throw new Error("Provider session conflict.");
    a.sessionId = session.id;
    a.status =
      session.status === "complete"
        ? "complete"
        : session.status === "expired"
          ? "expired"
          : "open";
  });
  if (session.payment_status === "paid")
    await reconcileSession(store, session.id, gateway, now);
  if (session.status !== "open")
    return {
      orderUrl: `/orders/${unseal(claimed.order.tokenBox)}`,
      complete: true,
    };
  return {
    orderUrl: `/orders/${unseal(claimed.order.tokenBox)}`,
    publishableKey: config.publishableKey,
    clientSecret: mode === "embedded" ? session.client_secret : undefined,
    url: mode === "hosted" ? session.url : undefined,
    baseCents: claimed.order.baseCents,
    feeCents: claimed.order.feeCents,
    totalCents: claimed.order.totalCents,
  };
}
export function validateSession(s: State, session: Stripe.Checkout.Session) {
  const config = checkoutConfig();
  const attempt = s.checkouts.find((c) => c.sessionId === session.id);
  const order = s.orders.find(
    (o) => o.id === attempt?.orderId && o.source === "stripe",
  );
  if (
    !attempt ||
    !order ||
    attempt.accountId !== config.accountId ||
    attempt.livemode !== config.livemode ||
    session.livemode !== config.livemode ||
    session.mode !== "payment" ||
    (!attempt.paymentLinkId &&
      (session.client_reference_id !== order.id ||
        session.metadata?.orderId !== order.id)) ||
    (attempt.paymentLinkId &&
      (typeof session.payment_link === "string"
        ? session.payment_link
        : session.payment_link?.id) !== attempt.paymentLinkId) ||
    session.currency !== "usd" ||
    session.amount_total !== order.totalCents ||
    session.total_details?.amount_discount ||
    session.total_details?.amount_tax ||
    session.total_details?.amount_shipping
  )
    throw new Error("Stripe session does not match the authorized order.");
  if (!attempt.catalog)
    throw new Error("Checkout catalog snapshot is missing.");
  const expected = new Map(Object.entries(structuredClone(attempt.catalog)));
  const includedFee = attempt.includedFeeCents ?? 0;
  if (
    !Number.isSafeInteger(includedFee) ||
    includedFee < 0 ||
    includedFee > order.feeCents ||
    (includedFee > 0 &&
      !attempt.paymentLinkId &&
      attempt.pricingMode !== "all_in") ||
    [...expected.values()].reduce(
      (sum, row) => sum + row.quantity * row.cents,
      0,
    ) !==
      order.baseCents + includedFee
  )
    throw new Error("Stripe catalog fee allocation does not match the order.");
  if (!session.line_items || session.line_items.has_more)
    throw new Error("Stripe line items are incomplete.");
  let fee = 0;
  for (const item of session.line_items.data) {
    const price = item.price;
    if (!price || price.currency !== "usd")
      throw new Error("Invalid Stripe price.");
    const row = expected.get(price.id);
    if (row) {
      if (
        item.quantity !== row.quantity ||
        price.unit_amount !== row.cents ||
        item.amount_total !== row.quantity * row.cents
      )
        throw new Error("Stripe ticket quantity or price mismatch.");
      expected.delete(price.id);
    } else {
      if (
        fee ||
        !(order.feeCents - includedFee) ||
        item.quantity !== 1 ||
        price.unit_amount !== order.feeCents - includedFee ||
        item.amount_total !== order.feeCents - includedFee ||
        item.description !== "Processing fee"
      )
        throw new Error("Unexpected Stripe line item.");
      fee = item.amount_total;
    }
  }
  if (expected.size || fee + includedFee !== order.feeCents)
    throw new Error("Stripe cart does not match the order.");
  return { order, attempt };
}
export async function reconcileSession(
  store: Store,
  sessionId: string,
  gateway: StripeGateway,
  now = new Date(),
) {
  const session = await gateway.session(sessionId);
  const result = await store.transaction((s) => {
    const { order, attempt } = validateSession(s, session);
    const paymentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;
    if (attempt.paymentId && attempt.paymentId !== paymentId)
      throw new Error("Payment association changed.");
    attempt.paymentId = paymentId;
    attempt.status =
      session.status === "complete"
        ? "complete"
        : session.status === "expired"
          ? "expired"
          : "open";
    attempt.nextCheckAt = new Date(now.getTime() + 60000).toISOString();
    if (session.payment_status === "paid" && session.status === "complete")
      fulfillOrder(s, order.id, order.totalCents, "stripe", now);
    else if (session.status === "expired" && order.status === "pending")
      order.status = "expired";
    return {
      orderId: order.id,
      paymentId,
      paid: ["paid", "partially-refunded", "disputed", "refunded"].includes(
        order.status,
      ),
    };
  });
  if (result.paid && result.paymentId)
    await reconcileCharge(
      store,
      result.orderId,
      result.paymentId,
      gateway,
      now,
    );
  return result;
}
async function reconcileCharge(
  store: Store,
  orderId: string,
  paymentId: string,
  gateway: StripeGateway,
  now: Date,
) {
  const charge = await gateway.charge(paymentId);
  const refunds = await gateway.refunds(charge.id);
  const disputes = await gateway.disputes(charge.id);
  await store.transaction((s) => {
    const order = s.orders.find((o) => o.id === orderId)!;
    if (
      charge.currency !== "usd" ||
      charge.amount !== order.totalCents ||
      !charge.paid ||
      (typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id) !== paymentId
    )
      throw new Error("Charge does not match the order.");
    const attempt = s.checkouts.find((c) => c.orderId === orderId)!;
    attempt.chargeId = charge.id;
    const balance = charge.balance_transaction;
    if (balance && typeof balance !== "string")
      attempt.processorFeeCents = balance.fee;
    const disputeObject = disputes.sort((a, b) => b.created - a.created)[0];
    if (charge.disputed && !disputeObject)
      throw new Error("Dispute status requires review.");
    if (disputeObject) {
      const outcome = ["won", "warning_closed"].includes(disputeObject.status)
        ? "won"
        : disputeObject.status === "lost"
          ? "lost"
          : "open";
      if (
        order.status !== "disputed" &&
        (outcome === "open" || outcome === "lost") &&
        ["paid", "partially-refunded"].includes(order.status)
      )
        dispute(s, order.id, "open", "stripe", now);
      if (order.status === "disputed" && outcome !== "open")
        dispute(s, order.id, outcome, "stripe", now);
    }
    for (const refund of refunds) {
      let record = s.refunds.find(
        (r) =>
          r.providerId === refund.id ||
          (refund.metadata?.refundId &&
            r.id === refund.metadata.refundId &&
            r.orderId === orderId),
      );
      if (record?.status === "succeeded") continue;
      if (!record) {
        const remaining = s.tickets.filter(
          (t) => t.orderId === orderId && !t.refunded,
        );
        const totalRemaining =
          order.totalCents - order.refundedBaseCents - order.refundedFeeCents;
        // Full remaining refund is unambiguous. External partial refunds require allocation review.
        const full = refund.amount === totalRemaining;
        record = {
          id: `external:${refund.id}`,
          orderId,
          ticketIds: full ? remaining.map((t) => t.id) : [],
          feeCents: full ? order.feeCents - order.refundedFeeCents : 0,
          amountCents: refund.amount,
          reason: "Stripe dashboard refund",
          status: full ? "pending" : "review",
          providerId: refund.id,
          createdAt: now.toISOString(),
        };
        s.refunds.push(record);
      }
      record.providerId = refund.id;
      if (refund.currency !== "usd" || refund.amount !== record.amountCents) {
        record.status = "review";
        continue;
      }
      if (["failed", "canceled"].includes(refund.status ?? "")) {
        record.status = "failed";
        continue;
      }
      if (
        refund.status !== "succeeded" ||
        record.status === "review" ||
        order.status === "disputed"
      )
        continue;
      refundTickets(
        s,
        orderId,
        record.ticketIds,
        record.feeCents,
        "stripe",
        record.reason,
        now,
      );
      record.status = "succeeded";
    }
  });
}
export async function cancelCheckout(
  store: Store,
  token: string,
  gateway: StripeGateway,
  now = new Date(),
) {
  const state = await store.read();
  const order = state.orders.find(
    (o) => o.tokenHash === digest(token) && o.source === "stripe",
  );
  const attempt = state.checkouts.find((c) => c.orderId === order?.id);
  if (!order || !attempt?.sessionId)
    throw new Error(
      "Checkout is still being prepared. Retry the original request first.",
    );
  let session = await gateway.session(attempt.sessionId);
  if (session.status === "open") {
    try {
      session = await gateway.expire(session.id);
    } catch {
      session = await gateway.session(session.id);
    }
  }
  if (session.status === "complete") {
    await reconcileSession(store, session.id, gateway, now);
    return { paid: true, orderUrl: `/orders/${token}` };
  }
  if (session.status !== "expired")
    throw new Error("Checkout could not be closed. Please retry.");
  await store.transaction((s) => {
    const o = s.orders.find((o) => o.id === order.id)!;
    if (o.status === "pending") o.status = "expired";
    s.checkouts.find((c) => c.id === attempt.id)!.status = "expired";
  });
  return { paid: false };
}
const refundInput = z
  .object({
    requestKey: z.string().uuid(),
    id: z.string(),
    ticketIds: z.array(z.string()).max(50),
    feeCents: z.number().int().min(0),
    reason: z.string().trim().min(1).max(300),
  })
  .strict();
export async function requestStripeRefund(
  store: Store,
  raw: unknown,
  operator: string,
  gateway: StripeGateway,
  now = new Date(),
) {
  if (!stripeRefundWriteEnabled())
    throw new Error("Stripe refunds are handled by the account owner.");
  const input = refundInput.parse(raw);
  const record = await store.transaction((s) => {
    const previous = s.refunds.find((r) => r.id === input.requestKey);
    if (previous) {
      if (
        previous.orderId !== input.id ||
        previous.reason !== input.reason ||
        previous.feeCents !== input.feeCents ||
        JSON.stringify(previous.ticketIds) !== JSON.stringify(input.ticketIds)
      )
        throw new Error("Refund request changed.");
      if (
        previous.status === "requested" &&
        !previous.providerId &&
        now.getTime() - Date.parse(previous.createdAt) > 23 * 3600000
      ) {
        previous.status = "review";
        audit(
          s,
          operator,
          "refund-review",
          previous.id,
          "Uncertain refund exceeded the safe automatic retry window; inspect Stripe before any new request.",
          now,
        );
      }
      return structuredClone(previous);
    }
    const order = s.orders.find(
      (o) => o.id === input.id && o.source === "stripe",
    );
    const attempt = s.checkouts.find((c) => c.orderId === order?.id);
    if (
      !order ||
      !attempt?.paymentId ||
      !["paid", "partially-refunded"].includes(order.status)
    )
      throw new Error("Order is not eligible for a Stripe refund.");
    if (
      s.refunds.some(
        (r) =>
          r.orderId === order.id &&
          ["requested", "pending", "review"].includes(r.status),
      )
    )
      throw new Error("Resolve the existing pending refund first.");
    if (new Set(input.ticketIds).size !== input.ticketIds.length)
      throw new Error("Invalid repeated refund ticket.");
    let amountCents = input.feeCents;
    for (const id of input.ticketIds) {
      const t = s.tickets.find(
        (t) => t.id === id && t.orderId === order.id && !t.refunded,
      );
      if (!t) throw new Error("Invalid refund ticket.");
      amountCents += t.baseCents;
    }
    if (
      input.feeCents > order.feeCents - order.refundedFeeCents ||
      amountCents <= 0
    )
      throw new Error("Invalid refund amount.");
    const record = {
      id: input.requestKey,
      orderId: order.id,
      ticketIds: input.ticketIds,
      feeCents: input.feeCents,
      amountCents,
      reason: input.reason,
      status: "requested" as const,
      createdAt: now.toISOString(),
    };
    s.refunds.push(record);
    audit(s, operator, "stripe-refund-requested", order.id, input.reason, now);
    return record;
  });
  if (["succeeded", "failed", "review"].includes(record.status)) return record;
  const state = await store.read();
  const attempt = state.checkouts.find((c) => c.orderId === record.orderId)!;
  const refund = await gateway.refund(
    {
      payment_intent: attempt.paymentId,
      amount: record.amountCents,
      metadata: { refundId: record.id, orderId: record.orderId },
    },
    `refund:${record.id}`,
  );
  await store.transaction((s) => {
    const row = s.refunds.find((r) => r.id === record.id)!;
    row.providerId = refund.id;
    if (row.status !== "succeeded")
      row.status = ["failed", "canceled"].includes(refund.status ?? "")
        ? "failed"
        : "pending";
  });
  await reconcileSession(store, attempt.sessionId!, gateway, now);
  return (await store.read()).refunds.find((r) => r.id === record.id)!;
}
export async function receiveStripeEvent(
  store: Store,
  event: Stripe.Event,
  now = new Date(),
) {
  const config = checkoutConfig();
  if (
    event.livemode !== config.livemode ||
    (event.account && event.account !== config.accountId)
  )
    throw new Error("Wrong Stripe account or environment.");
  const supported =
    /^(checkout\.session\.(completed|expired|async_payment_succeeded|async_payment_failed)|charge\.(refunded|dispute\.(created|updated|closed))|refund\.(created|updated|failed)|payment_intent\.succeeded)$/;
  if (!supported.test(event.type)) return;
  const object = event.data.object as unknown as {
    id: string;
    payment_intent?: string | { id: string };
    charge?: string | { id: string };
    metadata?: Record<string, string>;
  };
  // Configuration probes never create an order or ticket and are expired by CLI.
  if (object.metadata?.ksigdillas_setup === "unpaid-configuration-check")
    return;
  const ref = (value: string | { id: string } | undefined) =>
    typeof value === "string" ? value : value?.id;
  const verified = {
    accountId: config.accountId,
    livemode: config.livemode,
    paymentId: event.type.startsWith("payment_intent.")
      ? object.id
      : ref(object.payment_intent),
    chargeId: event.type === "charge.refunded" ? object.id : ref(object.charge),
  };
  await store.transaction((s) => {
    if (!s.providerEvents.some((e) => e.id === event.id))
      s.providerEvents.push({
        id: event.id,
        type: event.type,
        objectId: (event.data.object as { id: string }).id,
        verified,
        status: "pending",
        attempts: 0,
        createdAt: now.toISOString(),
        nextAttemptAt: now.toISOString(),
      });
  });
}
export function nextReconciliationAt(
  s: State,
  attempt: CheckoutAttempt,
  now: Date,
) {
  const time = now.getTime();
  const unresolved =
    s.orders.find((o) => o.id === attempt.orderId)?.status === "disputed" ||
    s.refunds.some(
      (r) =>
        r.orderId === attempt.orderId &&
        ["requested", "pending"].includes(r.status),
    );
  if (!["complete", "expired"].includes(attempt.status)) return time + 60000;
  if (unresolved || (time >= saleStart && time < saleEnd)) return time + 300000;
  const next = time + 86400000;
  // Enter fast admission-hour checking even when yesterday's fallback was late.
  return time < saleStart ? Math.min(next, saleStart) : next;
}
export async function processStripeWork(
  store: Store,
  gateway: StripeGateway,
  now = new Date(),
  options: { deadline?: number; limit?: number } = {},
) {
  const deadline = options.deadline ?? Date.now() + 15000;
  const eventDeadline = Date.now() + Math.max(0, (deadline - Date.now()) / 2);
  const eventGateway = budgetStripeGateway(gateway, eventDeadline);
  gateway = budgetStripeGateway(gateway, deadline);
  const limit = options.limit ?? 10;
  const events = (await store.read()).providerEvents
    .filter(
      (e) =>
        e.status === "pending" &&
        Date.parse(e.nextAttemptAt) <= now.getTime() &&
        (!e.leaseUntil || Date.parse(e.leaseUntil) <= now.getTime()),
    )
    .sort((a, b) => a.nextAttemptAt.localeCompare(b.nextAttemptAt))
    .slice(0, limit);
  let eventCount = 0;
  let sessionCount = 0;
  let failed = 0;
  for (const row of events) {
    if (Date.now() >= eventDeadline) break;
    const claimed = await store.transaction((s) => {
      const current = s.providerEvents.find((e) => e.id === row.id)!;
      if (
        current.status !== "pending" ||
        Date.parse(current.nextAttemptAt) > now.getTime() ||
        (current.leaseUntil && Date.parse(current.leaseUntil) > now.getTime())
      )
        return false;
      current.leaseUntil = new Date(now.getTime() + 120000).toISOString();
      current.attempts++;
      return true;
    });
    if (!claimed) continue;
    eventCount++;
    try {
      // Only references from an already signature-verified event are stored.
      // Actual paid sessions/charges are still fetched and amount-validated.
      // Old rows retain the API-read recovery path; new keys need no Events Read.
      const event = row.verified
        ? {
            type: row.type,
            livemode: row.verified.livemode,
            account: row.verified.accountId,
            data: {
              object: {
                id: row.objectId,
                payment_intent: row.verified.paymentId,
                charge: row.verified.chargeId,
              },
            },
          }
        : await eventGateway.event(row.id);
      const config = checkoutConfig();
      if (
        event.livemode !== config.livemode ||
        (event.account && event.account !== config.accountId) ||
        event.type !== row.type ||
        (event.data.object as { id: string }).id !== row.objectId
      )
        throw new Error("Stripe event association changed.");
      const state = await store.read();
      const object = event.data.object as unknown as {
        id: string;
        payment_intent?: string;
        charge?: string;
      };
      const paymentId = event.type.startsWith("payment_intent.")
        ? object.id
        : typeof object.payment_intent === "string"
          ? object.payment_intent
          : null;
      const chargeId =
        event.type === "charge.refunded"
          ? object.id
          : typeof object.charge === "string"
            ? object.charge
            : null;
      let attempt = event.type.startsWith("checkout.session.")
        ? state.checkouts.find((c) => c.sessionId === object.id)
        : state.checkouts.find(
            (c) =>
              (paymentId && c.paymentId === paymentId) ||
              (chargeId && c.chargeId === chargeId),
          );
      if (
        !attempt &&
        event.type.startsWith("checkout.session.") &&
        process.env.STRIPE_PAYMENT_LINK_ENABLED === "true"
      ) {
        const linkId = process.env.STRIPE_PAYMENT_LINK_ID;
        if (!linkId?.startsWith("plink_"))
          throw new Error("Reviewed Payment Link ID is missing.");
        const session = await eventGateway.session(object.id);
        const actualLink =
          typeof session.payment_link === "string"
            ? session.payment_link
            : session.payment_link?.id;
        if (
          actualLink === linkId &&
          session.status === "complete" &&
          session.payment_status === "paid"
        ) {
          const { importPaymentLinkSession } = await import("./import");
          await store.transaction((s) =>
            importPaymentLinkSession(s, session, linkId, now),
          );
          attempt = (await store.read()).checkouts.find(
            (c) => c.sessionId === session.id,
          );
        }
      }
      // Unknown events stay reviewable. Periodic session reconciliation handles refund/dispute objects with only charge IDs.
      if (attempt?.sessionId)
        await reconcileSession(store, attempt.sessionId, eventGateway, now);
      await store.transaction((s) => {
        const e = s.providerEvents.find((e) => e.id === row.id)!;
        e.status = attempt ? "processed" : "review";
        e.error = attempt
          ? undefined
          : "Unmatched Stripe event; reconcile/import the associated order.";
        e.leaseUntil = undefined;
      });
    } catch {
      failed++;
      await store.transaction((s) => {
        const e = s.providerEvents.find((e) => e.id === row.id)!;
        e.error =
          "Stripe reconciliation failed; retry or inspect account/order mapping.";
        e.nextAttemptAt = new Date(
          now.getTime() +
            Math.min(3600000, 30000 * 2 ** Math.min(e.attempts, 7)),
        ).toISOString();
        e.leaseUntil = undefined;
      });
    }
  }
  const attempts = (await store.read()).checkouts
    .filter(
      (c) =>
        c.sessionId &&
        Date.parse(c.nextCheckAt) <= now.getTime() &&
        (!c.leaseUntil || Date.parse(c.leaseUntil) <= now.getTime()),
    )
    .sort((a, b) => a.nextCheckAt.localeCompare(b.nextCheckAt))
    .slice(0, limit);
  for (const a of attempts) {
    if (Date.now() >= deadline) break;
    const claimed = await store.transaction((s) => {
      const current = s.checkouts.find((c) => c.id === a.id)!;
      if (
        Date.parse(current.nextCheckAt) > now.getTime() ||
        (current.leaseUntil && Date.parse(current.leaseUntil) > now.getTime())
      )
        return false;
      current.leaseUntil = new Date(now.getTime() + 120000).toISOString();
      return true;
    });
    if (!claimed) continue;
    sessionCount++;
    let reconciled = false;
    try {
      if (now.getTime() >= saleEnd && a.status === "open") {
        try {
          await gateway.expire(a.sessionId!);
        } catch {
          /* A concurrent payment is reconciled below. */
        }
      }
      await reconcileSession(store, a.sessionId!, gateway, now);
      reconciled = true;
    } catch {
      failed++;
    } finally {
      await store.transaction((s) => {
        const c = s.checkouts.find((c) => c.id === a.id)!;
        c.leaseUntil = undefined;
        c.error = reconciled
          ? undefined
          : "Stripe reconciliation failed; automatic retry queued.";
        c.nextCheckAt = new Date(
          reconciled ? nextReconciliationAt(s, c, now) : now.getTime() + 60000,
        ).toISOString();
      });
    }
  }
  return { events: eventCount, sessions: sessionCount, failed };
}
