import { PolicyLinks } from "@/components/PolicyLinks";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { digest } from "@/lib/operations/crypto";
import { getStore } from "@/lib/operations/store";
import { appUrl } from "@/lib/email/delivery";
import { eventConfig } from "@/lib/eventConfig";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your ticket | KSigdillas",
  robots: { index: false, follow: false },
};
export default async function TicketPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) notFound();
  const state = await getStore().read();
  const ticket = state.tickets.find((t) => t.tokenHash === digest(token));
  if (!ticket) notFound();
  const qr = ticket.valid
    ? await QRCode.toDataURL(`${appUrl()}/tickets/${token}`, {
        width: 360,
        margin: 3,
      })
    : null;
  return (
    <main id="main-content" tabIndex={-1} className="ops-page">
      <div className="shell ticket-page">
        <section
          className={`ops-card admission-pass ${ticket.valid ? "" : "invalid-pass"}`}
        >
          <p className="eyebrow">Admission · November 19</p>
          <h1>KSIGDILLAS</h1>
          <p>Thursday, November 19, 2026 · 6–9 PM Central</p>
          <p>707 S Davis Dr backyard, Arlington</p>
          <h2>{ticket.name}</h2>
          <p>
            <strong>
              {ticket.tier === "basic" ? "Basicdilla" : "Meat/Veggie Pass"}
            </strong>{" "}
            · {ticket.teamId?.toUpperCase() ?? "No team"}
          </p>
          <p
            role="status"
            className={`ops-notice ${!ticket.valid ? "error" : ticket.checkedInAt ? "" : "success"}`}
          >
            {!ticket.valid
              ? "This ticket is not valid for admission. Contact the organizer for help."
              : ticket.checkedInAt
                ? "Already checked in. This QR cannot be used for a second admission."
                : "Ready for check-in. Show this QR at the door."}
          </p>
          {qr && (
            <Image
              className="ticket-qr"
              unoptimized
              src={qr}
              alt={`Admission QR for ${ticket.name}`}
              width={360}
              height={360}
            />
          )}
          <p>Ticket reference: {ticket.id}</p>
          <p>
            Cannot show a QR? Ask staff to look up your name or order reference.
            Keep this private link secure.
          </p>
          <p>
            Questions?{" "}
            <a href={`mailto:${eventConfig.contactEmail}`}>
              {eventConfig.contactEmail}
            </a>
          </p>
          <nav>
            <Link href="/">Event details</Link>
          </nav>
          <PolicyLinks />
        </section>
      </div>
    </main>
  );
}
