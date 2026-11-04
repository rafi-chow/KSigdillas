"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="ops-page" tabIndex={-1}>
      <div className="shell ticket-page ops-card">
        <h1>We couldn&apos;t load this page</h1>
        <p role="alert">
          Please try again. If you have already paid, check your order or
          contact the organizer before making another payment.
        </p>
        <button className="ops-action" onClick={reset}>
          Try again
        </button>
        <p>
          <Link href="/">Event home</Link> ·{" "}
          <a href="mailto:zachzapalac@gmail.com">Contact support</a>
        </p>
      </div>
    </main>
  );
}
