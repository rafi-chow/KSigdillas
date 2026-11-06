import { PolicyPage } from "@/components/PolicyPage";
import { purchaseTerms } from "@/lib/policies";
export const metadata = { title: "Ticket terms | KSigdillas" };
export default function TermsPage() {
  return (
    <PolicyPage title="Ticket terms">
      <h2>Organizer and event</h2>
      <p>
        KSigdillas is organized by {purchaseTerms.organizer}. Thursday, November
        19, 2026, 6–9 PM Central, at 707 S Davis Dr backyard, Arlington, Texas.
        Questions and purchase support:{" "}
        <a href="mailto:zachzapalac@gmail.com">zachzapalac@gmail.com</a>.
      </p>
      <h2>Your purchase</h2>
      <p>{purchaseTerms.availability}</p>
      <p>
        The online total is displayed before payment. Ticket base amounts used
        for chapter points and brother sales credit are accounting allocations,
        not additional charges. You will receive one QR ticket per guest after
        payment is verified. If email is delayed, contact the organizer with
        your Stripe receipt. Any existing private order link remains available.
      </p>
      <h2>Refunds and changes</h2>
      <p>{purchaseTerms.refund}</p>
      <p>{purchaseTerms.cancellation}</p>
      <p>
        Contact the organizer with your order reference for payment errors or
        duplicate charges. Any approved refund is returned through the original
        payment method; provider processing times may vary. These terms do not
        limit rights that cannot legally be waived.
      </p>
      <h2>Tickets and entry</h2>
      <p>{purchaseTerms.transfer}</p>
      <p>
        This is an alcohol-free event. Participation in games is optional.
        Follow organizer safety instructions and respect other guests. Ask the
        organizer about access needs or food ingredients before buying; see our
        accessibility and food information page.
      </p>
      <h2>Men&apos;s health awareness</h2>
      <p>
        This event promotes men&apos;s health awareness and support for
        Movember&apos;s mission. A ticket is an admission purchase, not a
        charitable tax receipt. We do not promise a tax deduction or a specific
        amount or percentage remitted to a charity. Ask the organizer for
        information about event expenses and the allocation of proceeds.
      </p>
      <h2>Terms version</h2>
      <p>
        Version {purchaseTerms.version}. Direct website checkout records the
        accepted version with your order. Purchases on the organizer&apos;s
        Stripe Payment Link are tracked separately; website acceptance is not
        recorded for those purchases. Later changes do not silently replace
        accepted terms.
      </p>
    </PolicyPage>
  );
}
