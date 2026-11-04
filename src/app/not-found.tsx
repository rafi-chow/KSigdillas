import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main-content" className="ops-page" tabIndex={-1}>
      <div className="shell ticket-page ops-card">
        <h1>Page not found</h1>
        <p>
          This link may be incorrect or no longer available. For a private
          ticket, use the link from your ticket email or contact the organizer
          with your order reference.
        </p>
        <Link href="/">Return to KSigdillas</Link>
        <p>
          <a href="mailto:zachzapalac@gmail.com">Get ticket help</a>
        </p>
      </div>
    </main>
  );
}
