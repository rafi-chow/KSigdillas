import { PolicyLinks } from "@/components/PolicyLinks";
import Link from "next/link";
import { notFound } from "next/navigation";
import { digest, unseal } from "@/lib/operations/crypto";
import { getStore } from "@/lib/operations/store";
import { OrderStatus } from "@/components/OrderStatus";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your order | KSigdillas",
  robots: { index: false, follow: false },
};
const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
export default async function OrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) notFound();
  const state = await getStore().read();
  const order = state.orders.find((o) => o.tokenHash === digest(token));
  if (!order) notFound();
  const paid = ["paid", "partially-refunded"].includes(order.status);
  return (
    <main id="main-content" tabIndex={-1} className="ops-page">
      <div className="shell ticket-page">
        <section className="ops-card">
          <Link href="/">← Event home</Link>
          <h1>YOUR ORDER.</h1>
          <OrderStatus
            token={token}
            pending={order.source === "stripe" && order.status === "pending"}
          />
          <p
            role="status"
            className={`ops-notice ${paid ? "success" : order.status === "pending" ? "" : "error"}`}
          >
            {paid
              ? "Payment confirmed. Your tickets are below."
              : order.status === "pending"
                ? "Payment is pending. Tickets become valid after confirmation. Contact the organizer if this does not update."
                : `Order status: ${order.status}. Contact the organizer if you need help.`}
          </p>
          <p>Reference: {order.id}</p>
          {order.terms && <p>Accepted ticket terms: {order.terms.version}</p>}
          <dl>
            <dt>Tickets</dt>
            <dd>{money(order.baseCents)}</dd>
            <dt>Processing fee included</dt>
            <dd>{money(order.feeCents)}</dd>
            <dt>Tax</dt>
            <dd>{money(order.taxCents)}</dd>
            <dt>Total paid{!paid ? " / quoted" : ""}</dt>
            <dd>{money(order.totalCents)}</dd>
          </dl>
          {paid &&
            state.tickets
              .filter((t) => t.orderId === order.id)
              .map((t) => (
                <article key={t.id} className="ops-ticket">
                  <h2>{t.name}</h2>
                  <p>
                    {t.tier === "basic" ? "Basicdilla" : "Meat/Veggie Pass"} ·{" "}
                    {t.teamId?.toUpperCase() ?? "No team"}
                  </p>
                  {t.valid ? (
                    <Link
                      className="ops-action"
                      href={`/tickets/${unseal(t.tokenBox)}`}
                    >
                      Open QR ticket →
                    </Link>
                  ) : (
                    <p>Ticket is no longer valid.</p>
                  )}
                </article>
              ))}
          <p>
            Ticket email delayed? You can use the ticket links above. For help:{" "}
            <a href="mailto:zachzapalac@gmail.com">zachzapalac@gmail.com</a>.
          </p>
          <PolicyLinks />
        </section>
      </div>
    </main>
  );
}
