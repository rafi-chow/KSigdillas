import Link from "next/link";
export function PolicyLinks() {
  return (
    <nav className="policy-links" aria-label="Policies and support">
      <Link href="/terms">Ticket terms</Link>
      <Link href="/privacy">Privacy</Link>
      <Link href="/accessibility">Accessibility & food information</Link>
      <a href="mailto:zachzapalac@gmail.com">Contact organizer</a>
    </nav>
  );
}
