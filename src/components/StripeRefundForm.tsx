"use client";
import { useState } from "react";
const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n / 100,
  );
export function StripeRefundForm({
  order,
  save,
  allocation,
}: {
  order: {
    id: string;
    feeCents?: number;
    refundedFeeCents?: number;
    tickets: {
      id: string;
      name: string;
      refunded: boolean;
      baseCents?: number;
    }[];
  };
  save: (path: string, body: Record<string, unknown>) => void;
  allocation?: { id: string; amountCents: number };
}) {
  const [ids, setIds] = useState<string[]>([]);
  const [fee, setFee] = useState(0);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState(false);
  const amount =
    fee +
    order.tickets
      .filter((t) => ids.includes(t.id))
      .reduce((n, t) => n + (t.baseCents ?? 0), 0);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!preview) {
          setPreview(true);
          return;
        }
        save(allocation ? "allocate-stripe-refund" : "stripe-refund", {
          id: allocation?.id ?? order.id,
          ticketIds: ids,
          feeCents: fee,
          reason,
        });
        setPreview(false);
      }}
    >
      <h3>
        {allocation ? "Allocate confirmed refund" : "Exceptional Stripe refund"}
      </h3>
      {allocation && (
        <p>
          Confirmed Stripe refund: {money(allocation.amountCents)}. Select the
          matching tickets and fee portion.
        </p>
      )}
      {order.tickets
        .filter((t) => !t.refunded)
        .map((t) => (
          <label key={t.id}>
            <input
              type="checkbox"
              checked={ids.includes(t.id)}
              onChange={(e) => {
                setIds(
                  e.target.checked
                    ? [...ids, t.id]
                    : ids.filter((id) => id !== t.id),
                );
                setPreview(false);
              }}
            />
            {t.name} · {money(t.baseCents ?? 0)}
          </label>
        ))}
      <label>
        Processing fee to refund ($)
        <input
          type="number"
          min="0"
          step="0.01"
          max={((order.feeCents ?? 0) - (order.refundedFeeCents ?? 0)) / 100}
          value={fee / 100}
          onChange={(e) => {
            setFee(Math.round(Number(e.target.value) * 100));
            setPreview(false);
          }}
        />
      </label>
      <label>
        Refund reason
        <input
          required
          maxLength={300}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setPreview(false);
          }}
        />
      </label>
      <p>
        {preview ? "Confirm" : "Preview"}: {money(amount)} · {ids.length}{" "}
        tickets.{" "}
        {allocation
          ? "The payment was already refunded in Stripe."
          : "Ticket cancellation and point reversal follow Stripe confirmation."}
      </p>
      <button
        className="ops-action"
        disabled={
          amount <= 0 ||
          (Boolean(allocation) && amount !== allocation?.amountCents)
        }
      >
        {preview
          ? allocation
            ? "Confirm allocation"
            : "Confirm Stripe refund"
          : "Review refund"}
      </button>
    </form>
  );
}
