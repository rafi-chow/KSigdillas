import { publicPrices, money } from "@/lib/policies";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OrderForm } from "@/components/OrderForm";
import { eventConfig } from "@/lib/eventConfig";
import { getStore, operationsEnabled } from "@/lib/operations/store";
import {
  initialState,
  salesWindowOpen,
  saleStart,
  saleEnd,
} from "@/lib/operations/rules";
import { emptyState } from "@/lib/operations/model";
import { checkoutAvailable } from "@/lib/payments/stripe";
import {
  currentPaymentLinkUrl,
  paymentLinkAvailable,
} from "@/lib/payments/paymentLink";
export const dynamic = "force-dynamic";
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string }>;
}) {
  const { tier } = await searchParams;
  const now = new Date();
  if (paymentLinkAvailable(now)) redirect(currentPaymentLinkUrl);
  const presaleEnded = now.getTime() >= saleStart;
  const eventEnded = now.getTime() >= saleEnd;
  let available = operationsEnabled() && checkoutAvailable(now);
  const prices = publicPrices(now).online;
  try {
    if (!salesWindowOpen()) available = false;
  } catch {
    available = false;
  }
  let teams = initialState(emptyState()).teams;
  let brothers: { id: string; name: string }[] = [];
  if (operationsEnabled()) {
    try {
      const state = await getStore().read();
      teams = state.teams;
      brothers = state.brothers
        .filter((b) => b.active)
        .map(({ id, name }) => ({ id, name }));
    } catch {
      available = false;
    }
  }
  return (
    <main id="main-content" tabIndex={-1} className="ops-page">
      <div className="shell ticket-page">
        <Link href="/">← Back to KSigdillas</Link>
        <section className="ops-card checkout-sheet">
          <p className="eyebrow">November 19 · 6–9 PM</p>
          <h1>TICKETS.</h1>
          {!available && (
            <p className="ops-notice" role="status">
              <strong>
                {eventEnded
                  ? "Ticket sales have ended."
                  : presaleEnded
                    ? "Online presale has ended."
                    : "Online sales are not open yet."}
              </strong>{" "}
              {presaleEnded && !eventEnded
                ? "Cash door tickets are $12 Basicdilla / $18 Meat/Veggie until 9 PM Central."
                : !eventEnded
                  ? "Check back here for tickets."
                  : "Contact the organizer for existing ticket help."}
            </p>
          )}
          {(!presaleEnded || available) && (
            <p>
              <strong>
                Online total: {money(prices.basic)} Basicdilla /{" "}
                {money(prices.meat)} Meat/Veggie.
              </strong>{" "}
              Processing fee included. Cash door tickets are $12 / $18.
            </p>
          )}
          {(!presaleEnded || available) && (
            <OrderForm
              teams={teams}
              brothers={brothers}
              available={available}
              initialTier={tier === "meat" ? "meat" : "basic"}
              prices={prices}
            />
          )}
          <p>
            Questions?{" "}
            <a href={`mailto:${eventConfig.contactEmail}`}>
              {eventConfig.contactEmail}
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
