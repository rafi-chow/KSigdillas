import { PolicyPage } from "@/components/PolicyPage";
export const metadata = { title: "Privacy | KSigdillas" };
export default function PrivacyPage() {
  return (
    <PolicyPage title="Privacy">
      <h2>Who handles your information</h2>
      <p>
        Kappa Sigma Theta-Omega organizes KSigdillas. Contact{" "}
        <a href="mailto:zachzapalac@gmail.com">zachzapalac@gmail.com</a> about
        your information, ticket access, corrections or deletion requests. We
        verify a request before disclosing or changing private records.
      </p>
      <h2>Information we use</h2>
      <p>
        We use purchaser email, guest names, selected wristbands, optional
        chapter and brother attribution, payment references, ticket and check-in
        records to process purchases, deliver tickets, prevent duplicate
        admission, support buyers and calculate event results. Private staff
        records include account credentials stored as password hashes,
        permissions and an audit of staff actions. Request limits may use hashed
        network identifiers.
      </p>
      <p>
        Stripe collects payment details in its own secure payment component. Our
        application does not receive or store your full card number or security
        code. Payment and dispute references remain in financial records.
      </p>
      <h2>Services and visibility</h2>
      <p>
        Our hosting provider and Neon process application/database data; Stripe
        processes payments; Brevo delivers transactional ticket emails and
        reports delivery or bounce status. An authenticated scheduler invokes
        maintenance jobs without receiving attendee lists. These providers may
        process data outside Texas under their own terms and privacy practices.
        Hosting changes will be reflected here before launch.
      </p>
      <p>
        Authorized event staff have access appropriate to their roles. Brother
        contribution and ticket-seller reports are private. Public standings
        show chapter totals, not purchaser emails or individual brother
        donations. We do not sell personal information or use ticket purchases
        to subscribe you to marketing.
      </p>
      <h2>Cookies and private links</h2>
      <p>
        Essential session cookies keep staff signed in. Stripe may use its own
        technologies for payment security and fraud prevention. We do not add
        advertising trackers. Ticket and order URLs grant access to those
        tickets: keep them private, and contact us if a link is exposed. Do not
        post a QR publicly.
      </p>
      <h2>Retention and requests</h2>
      <p>
        Our retention process removes unneeded abandoned-order contact details
        after 30 days and reviews attendee-identifying data for removal 90 days
        after the event. Records needed for unresolved payments, disputes,
        required accounting, legal obligations or a documented hold are retained
        longer. Necessary financial records and aggregate scoring history may
        remain after attendee details are removed.
      </p>
      <p>
        Operational logs are targeted for 30-day retention where provider
        controls allow. Provider records and encrypted backups can have separate
        retention periods; deletion is not an immediate erasure of every backup
        or provider copy. Restores must reapply recorded deletion requests.
        Contact us to request the applicable retention details or a
        correction/deletion review.
      </p>
      <h2>Security and updates</h2>
      <p>
        We restrict staff access, protect private links, encrypt recoverable
        ticket credentials and use HTTPS in production. No internet service is
        risk-free. Report suspected exposure to the organizer. This notice
        describes this event&apos;s service; material processing changes require
        a notice update.
      </p>
    </PolicyPage>
  );
}
