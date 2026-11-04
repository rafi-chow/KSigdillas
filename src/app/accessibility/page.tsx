import { PolicyPage } from "@/components/PolicyPage";
export const metadata = {
  title: "Accessibility and food information | KSigdillas",
};
export default function AccessibilityPage() {
  return (
    <PolicyPage title="Accessibility & food information">
      <h2>Get help before you buy</h2>
      <p>
        Contact <a href="mailto:zachzapalac@gmail.com">zachzapalac@gmail.com</a>{" "}
        for access arrangements, an alternative purchase/check-in method, or
        help using this website. Describe the step you need help with; you do
        not need to send medical records.
      </p>
      <p>
        The event is in the backyard at 707 S Davis Dr, Arlington. Ask the
        organizer about the entrance, ground surface, seating and restroom
        access for your needs. We do not represent that the venue has a verified
        step-free route or accessible facilities.
      </p>
      <h2>Tickets without a camera</h2>
      <p>
        You can display or print your ticket. Staff can look up a valid ticket
        by guest name or order reference if you cannot show a QR or a scanner
        camera is unavailable. Each ticket still admits one person once.
      </p>
      <h2>Food ingredients and allergens</h2>
      <p>
        Quesadillas contain cheese and tortillas; options may include chicken
        and fajita vegetables. Milk and wheat may be present. Donated products,
        fillings, sauces and shared preparation equipment can introduce other
        allergens and cross-contact. This is not an allergen-free kitchen.
      </p>
      <p>
        Ask staff to inspect the actual ingredient packaging before eating. We
        cannot guarantee a meal suitable for a particular allergy or dietary
        need. Food is available while supplies last; menu options may change.
        Steak is not being accepted or offered as a confirmed item until its
        details are settled.
      </p>
      <h2>Website access</h2>
      <p>
        We aim for WCAG 2.2 AA and test keyboard navigation, readable forms,
        contrast, zoom and screen-reader use. Automated checks alone cannot
        establish full accessibility. Please report the page and problem if
        something prevents you from using the site. Activities are optional;
        contact the organizer about alternatives.
      </p>
    </PolicyPage>
  );
}
