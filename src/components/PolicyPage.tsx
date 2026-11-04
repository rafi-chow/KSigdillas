import Link from "next/link";
import { PolicyLinks } from "./PolicyLinks";
export function PolicyPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main id="main-content" className="ops-page policy-page" tabIndex={-1}>
      <div className="shell ticket-page">
        <Link href="/">← Back to KSigdillas</Link>
        <article className="ops-card">
          <h1>{title}</h1>
          <p className="ops-muted">Updated November 3, 2026</p>
          {children}
        </article>
        <PolicyLinks />
      </div>
    </main>
  );
}
