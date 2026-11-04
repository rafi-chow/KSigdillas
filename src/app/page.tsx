import { PolicyLinks } from "@/components/PolicyLinks";
import { publicPrices, money } from "@/lib/policies";
import {
  Award,
  Drumstick,
  HeartHandshake,
  Trophy,
  Utensils,
  WineOff,
  Volleyball,
} from "lucide-react";
import { ActivityCard } from "@/components/ActivityCard";
import { FAQItem } from "@/components/FAQItem";
import { HeroSection } from "@/components/HeroSection";
import { LeaderboardPreview } from "@/components/LeaderboardPreview";
import { TicketTierCard } from "@/components/TicketTierCard";
import { WristbandFlow } from "@/components/WristbandFlow";
import { KappaSigmaMark } from "@/components/KappaSigmaMark";
import { checkoutAvailable } from "@/lib/payments/stripe";
import { operationsEnabled } from "@/lib/operations/store";
import { salesWindowOpen } from "@/lib/operations/rules";
export const dynamic = "force-dynamic";
import { EventGuide } from "@/components/EventGuide";
import { causeCopy, eventConfig, ticketTiers } from "@/lib/eventConfig";

const faqs = [
  ["Is alcohol allowed?", "No. KSigdillas is a no-alcohol event."],
  [
    "Can I attend without playing?",
    "Absolutely. Come eat, cheer, and support your favorite chapter.",
  ],
  [
    "Is food included?",
    "Yes, based on your wristband tier and while supplies last. Menu options may vary based on donated ingredients.",
  ],
  [
    "Are tickets refundable?",
    "Tickets are nonrefundable except where required by law. Contact the organizer about cancellation, postponement or payment errors. Read the ticket terms for details.",
  ],
  [
    "Are tickets cheaper online?",
    `Current online totals are ${money(publicPrices().online.basic)} Basicdilla / ${money(publicPrices().online.meat)} Meat/Veggie, including the processing fee. Cash door tickets are $12 / $18. Presale ends Thursday at 6 PM.`,
  ],
  ["Where is the address?", "The backyard event is at 707 S Davis Dr."],
  [
    "What if the date changes?",
    "Ticket holders will be notified directly of any schedule changes.",
  ],
] as const;

export default function Home() {
  const canBuy =
    operationsEnabled() && checkoutAvailable() && salesWindowOpen();
  return (
    <main id="main-content" tabIndex={-1}>
      <HeroSection canBuy={canBuy} />

      <section className="about-section section" id="about">
        <div className="shell about-grid">
          <div className="about-copy">
            <p className="eyebrow">
              <span />
              Kappa Sigma Theta-Omega · Arlington
            </p>
            <h2>
              WHAT IS <em>KSIGDILLAS?</em>
            </h2>
            <p className="lead">
              Join us November 19 for quesadillas and 4v4 volleyball at 707 S
              Davis Dr. Food and activities close our November 16–19
              philanthropy week.
            </p>
            <p>{causeCopy}</p>
          </div>
          <div className="about-poster">
            <span className="poster-tape" />
            <p>THURSDAY NIGHT</p>
            <Utensils />
            <strong>
              COME
              <br />
              HUNGRY.
            </strong>
            <small>Food · Games · Good cause</small>
            <span className="poster-policy">
              <WineOff />
              Alcohol-free event
            </span>
          </div>
        </div>
      </section>

      <section className="tickets-section section" id="tickets">
        <div className="shell">
          <div className="section-heading centered">
            <p className="eyebrow">
              <span />
              Admission &amp; menu
            </p>
            <h2>
              CHOOSE YOUR <em>WRISTBAND.</em>
            </h2>
            <p>
              Basicdilla includes cheese quesadillas and sodas. The Meat/Veggie
              Pass adds chicken and veggie options. Food is available while
              supplies last.
            </p>
          </div>
          <div className="tier-grid">
            {ticketTiers.map((tier) => (
              <TicketTierCard
                key={tier.name}
                {...tier}
                ticketUrl={eventConfig.ticketUrl}
                canBuy={canBuy}
              />
            ))}
          </div>
          <div className="ticket-notes">
            <p>
              <strong>Presale ends Thursday at 6 PM.</strong> Door prices: $12
              Basicdilla / $18 Meat-Veggie, paid in cash. Online prices above
              include the processing fee; no second fee is added.
            </p>
            <p>
              Food is available while supplies last. Menu may vary based on
              donated ingredients.
            </p>
          </div>
        </div>
      </section>

      <section className="activities-section section" id="activities">
        <div className="shell">
          <div className="section-heading split-heading">
            <div>
              <p className="eyebrow">
                <span />
                Bring your game
              </p>
              <h2>
                MORE THAN
                <br />
                <em>QUESADILLAS.</em>
              </h2>
            </div>
            <p>
              Rack up points for your chapter—or claim a spot on the sideline
              and enjoy the show.
            </p>
          </div>
          <div className="activity-grid">
            <ActivityCard
              icon={Utensils}
              number="01"
              title="Quesadillas"
              description="Hot off the griddle, with fillings based on your wristband tier."
              accent="yellow"
            />
            <ActivityCard
              icon={Volleyball}
              number="02"
              title="4v4 Volleyball"
              description="Starts Thursday at 7 PM. Placement points: 400 / 200 / 100."
              accent="red"
            />
            <ActivityCard
              icon={Drumstick}
              number="03"
              title="Most Eaten"
              description="10 quesadillas in 6 minutes. Placements earn 400 / 200 / 100 points."
              accent="orange"
            />
          </div>
          <div className="prize-strip">
            <Trophy />
            <div>
              <strong>Queso Queen chapter award</strong>
              <span>
                Every activity adds points to the live chapter leaderboard.
              </span>
            </div>
            <Award />
          </div>
        </div>
      </section>

      <EventGuide />

      <LeaderboardPreview />

      <section className="entry-section section" id="entry">
        <div className="shell">
          <div className="section-heading centered">
            <p className="eyebrow">
              <span />
              How tickets work
            </p>
            <h2>
              HOW ENTRY <em>WORKS.</em>
            </h2>
          </div>
          <WristbandFlow />
        </div>
      </section>

      <section className="philanthropy-section section">
        <div className="shell philanthropy-card">
          <div className="heart-art">
            <HeartHandshake />
          </div>
          <div>
            <p className="eyebrow light">
              <span />
              The reason we gather
            </p>
            <h2>
              FOOD, FRIENDS &amp; <em>A PURPOSE.</em>
            </h2>
            <p>
              Supporting Movember and the conversations that help men live
              healthier lives. Together, we can raise awareness of mental health
              and suicide prevention, prostate cancer, and testicular cancer.
            </p>
          </div>
          <div className="impact-note">
            <strong>Men’s health matters.</strong>
            <span>Supporting Movember. Every conversation counts.</span>
          </div>
        </div>
      </section>

      <section className="faq-section section" id="faq">
        <div className="shell faq-grid">
          <div className="faq-intro">
            <p className="eyebrow">
              <span />
              Good to know
            </p>
            <h2>
              QUESTIONS?
              <br />
              <em>ANSWERED.</em>
            </h2>
            <p>
              Still need something? Reach us at{" "}
              <a href={`mailto:${eventConfig.contactEmail}`}>
                {eventConfig.contactEmail}
              </a>
              .
            </p>
          </div>
          <div className="faq-list">
            {faqs.map(([question, answer]) => (
              <FAQItem key={question} question={question} answer={answer} />
            ))}
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="shell">
          <p>THURSDAY, NOVEMBER 19 · 6–9 PM · BACKYARD</p>
          <h2>
            READY TO GET <em>CHEESY?</em>
          </h2>
          <a className="button button-dark" href={eventConfig.ticketUrl}>
            {canBuy ? "Buy Tickets" : "View Ticket Details"} <span>→</span>
          </a>
        </div>
      </section>

      <footer>
        <div className="shell footer-grid">
          <div className="footer-brand">
            <KappaSigmaMark />
            <div>
              <strong>KSIGDILLAS</strong>
              <span>{eventConfig.organization}</span>
            </div>
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

      <a className="mobile-ticket-cta" href={eventConfig.ticketUrl}>
        {canBuy ? "Buy Tickets" : "Ticket Details"} <span>→</span>
      </a>
    </main>
  );
}
