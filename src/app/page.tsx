import { PolicyLinks } from "@/components/PolicyLinks";
import { FAQItem } from "@/components/FAQItem";
import { HeroSection } from "@/components/HeroSection";
import { LeaderboardPreview } from "@/components/LeaderboardPreview";
import { TicketTierCard } from "@/components/TicketTierCard";
import { KappaSigmaMark } from "@/components/KappaSigmaMark";
import { EventGuide } from "@/components/EventGuide";
import { checkoutAvailable } from "@/lib/payments/stripe";
import { operationsEnabled } from "@/lib/operations/store";
import { salesWindowOpen } from "@/lib/operations/rules";
import { publicPrices, money } from "@/lib/policies";
import {
  paymentLinkAvailable,
  currentPaymentLinkTotals,
  currentPaymentLinkUrl,
} from "@/lib/payments/paymentLink";
import { ArrowUpRight } from "lucide-react";
import { donationUrl } from "@/lib/payments/donationLink";
import { causeCopy, eventConfig, ticketTiers } from "@/lib/eventConfig";
import styles from "./modern.module.css";

export const dynamic = "force-dynamic";

const faqs = [
  [
    "Is food included?",
    "Yes. Basicdilla includes cheese quesadillas and sodas. Meat/Veggie adds chicken and veggie options. Food is available while supplies last; ingredients may vary.",
  ],
  [
    "Do I have to play volleyball?",
    "No. You can come for the food and watch the games.",
  ],
  [
    "How do I check in?",
    "After payment, your admission QR code arrives by email. Show it at the door to get your wristband. Each ticket admits one guest.",
  ],
  ["Is alcohol allowed?", "No. KSigdillas is an alcohol-free event."],
  [
    "Are tickets refundable?",
    "Tickets are nonrefundable except where required by law. Contact the organizer about cancellation, postponement or payment errors. See the ticket terms for details.",
  ],
  [
    "Can I pay at the door?",
    "Yes. Cash tickets are $12 for Basicdilla or $18 for Meat/Veggie. Online presale ends Thursday at 6 PM.",
  ],
  [
    "What if the date changes?",
    "Ticket holders will be notified directly of any schedule changes.",
  ],
] as const;

export default function Home() {
  const hosted = paymentLinkAvailable();
  const canBuy =
    hosted || (operationsEnabled() && checkoutAvailable() && salesWindowOpen());
  const prices = publicPrices();
  const online = hosted ? currentPaymentLinkTotals : prices.online;
  const ticketUrl = hosted ? currentPaymentLinkUrl : eventConfig.ticketUrl;
  return (
    <main id="main-content" tabIndex={-1} className={styles.home}>
      <HeroSection canBuy={canBuy} ticketUrl={ticketUrl} />
      <section
        className="tickets-section section"
        id="tickets"
        aria-labelledby="tickets-heading"
      >
        <div className="shell">
          <div className="section-heading">
            <p className="eyebrow">Thursday, November 19</p>
            <h2 id="tickets-heading">Tickets.</h2>
            <p>Choose your wristband. Both include admission and sodas.</p>
          </div>
          <div className="tier-grid">
            {ticketTiers.map((tier) => (
              <TicketTierCard
                key={tier.id}
                {...tier}
                ticketUrl={ticketUrl}
                canBuy={canBuy}
                onlinePrice={online[tier.id]}
              />
            ))}
          </div>
          <div className="ticket-notes">
            <p>
              Online totals include{" "}
              {hosted
                ? "sales tax and the processing fee"
                : "the processing fee"}
              : {money(online.basic)} / {money(online.meat)}. Presale ends
              Thursday at 6 PM.
            </p>
            <p>
              Food is available while supplies last. Door tickets are cash only.
            </p>
          </div>
          <aside
            className="donate-panel"
            id="give"
            aria-labelledby="donate-heading"
          >
            <div>
              <p className="eyebrow">Chapter points</p>
              <h3 id="donate-heading">Make a donation.</h3>
              <p>$5 earns 50 points. $10 earns 100.</p>
              <p className="donate-note">
                Select a chapter at checkout. $5 minimum for points.
              </p>
            </div>
            <div className="donate-action">
              <a className="button donate-button" href={donationUrl}>
                Donate <ArrowUpRight size={18} aria-hidden="true" />
              </a>
              <p>Donation only. Does not include admission.</p>
            </div>
          </aside>
        </div>
      </section>
      <section
        className="about-section section"
        id="about"
        aria-labelledby="about-heading"
      >
        <div className="shell event-overview">
          <div>
            <p className="eyebrow">Thursday · 6–9 PM Central</p>
            <h2 id="about-heading">
              Quesadillas &amp;
              <br />
              volleyball.
            </h2>
            <p className="section-intro">
              At 707 S Davis Dr, Arlington. Join us in the backyard after three
              days of chapter events and supply collection.
            </p>
          </div>
          <div className="evening-list" id="activities">
            <article>
              <span>01</span>
              <div>
                <h3>Food</h3>
                <p>
                  Cheese, chicken and veggie quesadillas, based on your
                  wristband.
                </p>
              </div>
            </article>
            <article>
              <span>02</span>
              <div>
                <h3>4v4 volleyball</h3>
                <p>Starts at 7 PM. Sand court, double elimination.</p>
              </div>
            </article>
            <article>
              <span>03</span>
              <div>
                <h3>Eating challenge</h3>
                <p>
                  10 quesadillas. 6 minutes. Placements earn chapter points.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>
      <EventGuide />
      <LeaderboardPreview />
      <section
        className="faq-section section"
        id="faq"
        aria-labelledby="faq-heading"
      >
        <div className="shell faq-grid">
          <div className="faq-intro">
            <p className="eyebrow">Before you come</p>
            <h2 id="faq-heading">Questions.</h2>
            <p>
              Contact{" "}
              <a href={`mailto:${eventConfig.contactEmail}`}>
                {eventConfig.contactEmail}
              </a>
            </p>
          </div>
          <div className="faq-list">
            {faqs.map(([question, answer]) => (
              <FAQItem key={question} question={question} answer={answer} />
            ))}
          </div>
        </div>
      </section>
      <section
        className="cause-section section"
        aria-labelledby="cause-heading"
      >
        <div className="shell cause-layout">
          <KappaSigmaMark />
          <div>
            <p className="eyebrow">Kappa Sigma Theta-Omega</p>
            <h2 id="cause-heading">Supporting Movember.</h2>
            <p>{causeCopy}</p>
            <a className="button donate-button cause-donate" href={donationUrl}>
              Donate <ArrowUpRight size={18} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>
      <footer>
        <div className="shell footer-grid">
          <div className="footer-brand">
            <strong>KSIGDILLAS</strong>
            <span>{eventConfig.organization}</span>
          </div>
          <div className="footer-links">
            <a href={`mailto:${eventConfig.contactEmail}`}>Contact</a>
            {eventConfig.instagramUrl && (
              <a href={eventConfig.instagramUrl}>Instagram</a>
            )}
            <a href="#top">Back to top ↑</a>
          </div>
          <PolicyLinks />
          <p>November 19, 2026 · Arlington, Texas · All times Central.</p>
        </div>
      </footer>
    </main>
  );
}
