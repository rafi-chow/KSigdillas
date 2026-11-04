"use client";
import Link from "next/link";
import { purchaseTerms, money } from "@/lib/policies";
import { PolicyLinks } from "./PolicyLinks";
import { useMemo, useState } from "react";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { BrotherSelect } from "./BrotherDesk";
import type { TeamRecord } from "@/lib/operations/model";
export type Attendee = {
  name: string;
  tier: "basic" | "meat";
  teamId: string | null;
};
export function AttendeeForm({
  attendees,
  onChange,
  teams,
}: {
  attendees: Attendee[];
  onChange: (value: Attendee[]) => void;
  teams: Pick<TeamRecord, "id" | "displayName">[];
}) {
  function change(index: number, patch: Partial<Attendee>) {
    onChange(attendees.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }
  return (
    <>
      {attendees.map((a, i) => (
        <div className="ops-ticket" key={i}>
          <h3>Guest {i + 1}</h3>
          <label>
            Name
            <input
              required
              value={a.name}
              onChange={(e) => change(i, { name: e.target.value })}
              maxLength={100}
            />
          </label>
          <div className="ops-inline">
            <label>
              Wristband
              <select
                value={a.tier}
                onChange={(e) =>
                  change(i, { tier: e.target.value as Attendee["tier"] })
                }
              >
                <option value="basic">Basicdilla</option>
                <option value="meat">Meat/Veggie Pass</option>
              </select>
            </label>
            <label>
              Supporting team
              <select
                value={a.teamId ?? ""}
                onChange={(e) => change(i, { teamId: e.target.value || null })}
              >
                <option value="">No team</option>
                {teams.map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.displayName}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {attendees.length > 1 && (
            <button
              className="ops-action"
              type="button"
              onClick={() =>
                onChange(attendees.filter((_, index) => i !== index))
              }
            >
              Remove guest {i + 1}
            </button>
          )}
        </div>
      ))}
      <button
        className="ops-action"
        type="button"
        disabled={attendees.length >= 50}
        onClick={() =>
          onChange([
            ...attendees,
            {
              name: "",
              tier: "basic",
              teamId: attendees.at(-1)?.teamId ?? null,
            },
          ])
        }
      >
        Add another guest
      </button>
    </>
  );
}
type CheckoutResult = {
  orderUrl: string;
  clientSecret?: string;
  publishableKey?: string;
  url?: string;
  complete?: boolean;
  baseCents?: number;
  feeCents?: number;
  totalCents?: number;
};
async function checkout(
  body: unknown,
): Promise<CheckoutResult & { paid?: boolean }> {
  const response = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
}
export function OrderForm({
  teams,
  brothers = [],
  available = false,
  initialTier = "basic",
  prices = { basic: 1061, meat: 1576 },
}: {
  teams: Pick<TeamRecord, "id" | "displayName">[];
  brothers?: { id: string; name: string }[];
  available?: boolean;
  initialTier?: "basic" | "meat";
  prices?: { basic: number; meat: number };
}) {
  const [attendees, setAttendees] = useState<Attendee[]>([
    { name: "", tier: initialTier, teamId: null },
  ]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [mode, setMode] = useState<"embedded" | "hosted">("embedded");
  const stripe = useMemo(
    () => (result?.publishableKey ? loadStripe(result.publishableKey) : null),
    [result],
  );
  const options = useMemo(
    () => ({
      clientSecret: result?.clientSecret,
      onComplete: () => {
        if (result) window.location.assign(result.orderUrl);
      },
    }),
    [result],
  );
  async function pay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!available) {
      setMessage(
        "Online ticket sales are not open yet. Your details have not been submitted.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      let order = draft;
      if (!order) {
        const v = Object.fromEntries(new FormData(e.currentTarget));
        order = {
          requestKey: crypto.randomUUID(),
          email: v.email,
          termsVersion: v.terms === "accepted" ? purchaseTerms.version : "",
          attendees,
          sellerBrotherId: v.sellerBrotherId || null,
        };
        setDraft(order);
      }
      const data = await checkout({
        action: "create",
        mode,
        order,
      });
      setResult(data);
      if (data.url) window.location.assign(data.url);
      if (data.complete) window.location.assign(data.orderUrl);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to prepare checkout.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function edit(nextMode = mode) {
    if (!result) return;
    setBusy(true);
    try {
      const token = result.orderUrl.split("/").at(-1);
      const closed = await checkout({ action: "cancel", token });
      if (closed.paid) {
        window.location.assign(result.orderUrl);
        return;
      }
      setResult(null);
      setDraft(null);
      setMode(nextMode);
      setMessage(
        "Previous checkout closed. Review your guests and continue again.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to close checkout. Retry the original payment request.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <form onSubmit={(e) => void pay(e)}>
        <fieldset disabled={busy || Boolean(result) || Boolean(draft)}>
          <label>
            Purchaser email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              maxLength={254}
            />
          </label>
          <AttendeeForm
            teams={teams}
            attendees={attendees}
            onChange={setAttendees}
          />
          <BrotherSelect
            brothers={brothers}
            name="sellerBrotherId"
            label="Which brother sold you your ticket?"
          />
          <p>Optional. Applies to every ticket in this order.</p>
        </fieldset>
        <p>
          <span className="price-total">Order total</span>{" "}
          <strong>
            {money(attendees.reduce((sum, a) => sum + prices[a.tier], 0))}
          </strong>
        </p>
        <p>
          Processing fee included. No second fee is added. Presale ends November
          19 at 6 PM Central. {purchaseTerms.refund}
        </p>
        {!result && (
          <>
            <label>
              <input
                type="checkbox"
                name="terms"
                value="accepted"
                required
                disabled={Boolean(draft)}
              />{" "}
              I agree to the{" "}
              <Link href="/terms" target="_blank">
                ticket terms
              </Link>{" "}
              and have read the{" "}
              <Link href="/privacy" target="_blank">
                privacy notice
              </Link>
              .
            </label>
            <button className="button button-dark" disabled={busy}>
              {busy
                ? "Preparing checkout…"
                : draft
                  ? "Retry saved checkout"
                  : available
                    ? "Continue to payment"
                    : "Check ticket availability"}
            </button>
          </>
        )}
      </form>
      <PolicyLinks />
      {message && (
        <p className="ops-notice" role="status">
          {message}
        </p>
      )}
      {result && (
        <section className="checkout-payment">
          <h2>REVIEW & PAY</h2>
          <dl>
            <dt>Total · processing fee included</dt>
            <dd>{money(result.totalCents ?? 0)}</dd>
          </dl>
          <p>
            <a href={result.orderUrl}>Check your order status</a>
          </p>
          {result.clientSecret && stripe && (
            <EmbeddedCheckoutProvider stripe={stripe} options={options}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          )}
          <button
            className="ops-action"
            type="button"
            disabled={busy}
            onClick={() => void edit()}
          >
            Edit guests or cancel checkout
          </button>
          {mode === "embedded" && (
            <button
              className="ops-action"
              type="button"
              disabled={busy}
              onClick={() => void edit("hosted")}
            >
              Use the separate Stripe payment page
            </button>
          )}
        </section>
      )}
    </>
  );
}
