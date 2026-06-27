import {
  Award,
  CircleDotDashed,
  Drumstick,
  HeartHandshake,
  Trophy,
  Utensils,
  Volleyball,
} from "lucide-react";
import { ActivityCard } from "@/components/ActivityCard";
import { FAQItem } from "@/components/FAQItem";
import { HeroSection } from "@/components/HeroSection";
import { LeaderboardPreview } from "@/components/LeaderboardPreview";
import { TicketTierCard } from "@/components/TicketTierCard";
import { WristbandFlow } from "@/components/WristbandFlow";
import { KappaSigmaMark } from "@/components/KappaSigmaMark";
import { eventConfig, ticketTiers } from "@/lib/eventConfig";

const faqs = [
  ["Is alcohol allowed?", "No. KSigdillas is a no-alcohol event."],
  ["Can I attend without playing?", "Absolutely. Come eat, cheer, and support your favorite chapter."],
  ["Is food included?", "Yes, based on your wristband tier and while supplies last. Menu options may vary based on donated ingredients."],
  ["Are tickets refundable?", "Yes. Tickets are refundable up to the day of the event."],
  ["Are tickets cheaper online?", "Yes. Tickets at the door may be more expensive, so buying ahead is your best bet."],
  ["Where is the address?", "The backyard event is at 707 S Davis Dr."],
  ["What if the date changes?", "Ticket holders will be notified directly of any schedule changes."],
] as const;

export default function Home() {
  return (
    <main>
      <HeroSection />

      <section className="about-section section" id="about">
        <div className="shell about-grid">
          <div className="about-copy">
            <p className="eyebrow"><span />The grand finale</p>
            <h2>WHAT IS <em>KSIGDILLAS?</em></h2>
            <p className="lead">
              The final event of Kappa Sigma Theta-Omega&apos;s philanthropy
              week—and the one you&apos;ll want to come hungry for.
            </p>
            <p>
              We&apos;re taking over the backyard for an evening of free food,
              basketball, volleyball, and chapter-versus-chapter competition.
              Come play, cheer, eat, or just hang out. Every bit of support
              helps make philanthropy week count.
            </p>
            <div className="about-stats">
              <div><strong>4</strong><span>Ways to compete</span></div>
              <div><strong>3</strong><span>Wristband tiers</span></div>
              <div><strong>1</strong><span>Winning chapter</span></div>
            </div>
          </div>
          <div className="about-poster">
            <span className="poster-tape" />
            <p>FRIDAY NIGHT</p>
            <Utensils />
            <strong>COME<br />HUNGRY.</strong>
            <small>Food · Games · Good cause</small>
            <span className="poster-stamp">NO<br />ALCOHOL</span>
          </div>
        </div>
      </section>

      <section className="tickets-section section" id="tickets">
        <div className="shell">
          <div className="section-heading centered">
            <p className="eyebrow"><span />Pick your plate</p>
            <h2>CHOOSE YOUR <em>WRISTBAND.</em></h2>
            <p>One ticket gets you in. Your tier decides what lands on your plate.</p>
          </div>
          <div className="tier-grid">
            {ticketTiers.map((tier) => (
              <TicketTierCard
                key={tier.name}
                {...tier}
                ticketUrl={eventConfig.ticketUrl}
              />
            ))}
          </div>
          <div className="ticket-notes">
            <p><strong>Heads up:</strong> Tickets at the door may be more expensive.</p>
            <p>Food is available while supplies last. Menu may vary based on donated ingredients.</p>
          </div>
        </div>
      </section>

      <section className="activities-section section" id="activities">
        <div className="shell">
          <div className="section-heading split-heading">
            <div>
              <p className="eyebrow"><span />Bring your game</p>
              <h2>MORE THAN<br /><em>QUESADILLAS.</em></h2>
            </div>
            <p>Rack up points for your chapter—or claim a spot on the sideline and enjoy the show.</p>
          </div>
          <div className="activity-grid">
            <ActivityCard icon={Utensils} number="01" title="Quesadillas" description="Hot off the griddle, with fillings based on your wristband tier." accent="yellow" />
            <ActivityCard icon={CircleDotDashed} number="02" title="Basketball" description="A fast-paced backyard tournament built for buckets and bragging rights." accent="orange" />
            <ActivityCard icon={Volleyball} number="03" title="4v4 Volleyball" description="Sorority-versus-sorority representatives face off for leaderboard points." accent="red" />
            <ActivityCard icon={Drumstick} number="04" title="Most Eaten" description="One representative per sorority. One appetite. Plenty of glory." accent="orange" />
          </div>
          <div className="prize-strip">
            <Trophy />
            <div><strong>One trophy. Maximum bragging rights.</strong><span>Every activity adds points to the live chapter leaderboard.</span></div>
            <Award />
          </div>
        </div>
      </section>

      <LeaderboardPreview />

      <section className="entry-section section" id="entry">
        <div className="shell">
          <div className="section-heading centered">
            <p className="eyebrow"><span />Easy in, good times out</p>
            <h2>HOW ENTRY <em>WORKS.</em></h2>
          </div>
          <WristbandFlow />
        </div>
      </section>

      <section className="philanthropy-section section">
        <div className="shell philanthropy-card">
          <div className="heart-art"><HeartHandshake /></div>
          <div>
            <p className="eyebrow light"><span />The reason we gather</p>
            <h2>FOOD, FRIENDS &amp; <em>A PURPOSE.</em></h2>
            <p>
              KSigdillas supports Kappa Sigma Theta-Omega&apos;s philanthropy
              week efforts, with the intended beneficiary focused on Arlington
              first responders. Final beneficiary details will be announced
              once confirmed.
            </p>
          </div>
          <div className="impact-note">
            <strong>Community first.</strong>
            <span>Beneficiary details are pending final confirmation.</span>
          </div>
        </div>
      </section>

      <section className="faq-section section" id="faq">
        <div className="shell faq-grid">
          <div className="faq-intro">
            <p className="eyebrow"><span />Good to know</p>
            <h2>QUESTIONS?<br /><em>ANSWERED.</em></h2>
            <p>Still need something? Reach us at <a href={`mailto:${eventConfig.contactEmail}`}>{eventConfig.contactEmail}</a>.</p>
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
          <p>FRIDAY · 6:00 PM · BACKYARD</p>
          <h2>READY TO GET <em>CHEESY?</em></h2>
          <a className="button button-dark" href={eventConfig.ticketUrl}>Get Tickets Now <span>→</span></a>
        </div>
      </section>

      <footer>
        <div className="shell footer-grid">
          <div className="footer-brand">
            <KappaSigmaMark />
            <div><strong>KSIGDILLAS</strong><span>{eventConfig.organization}</span></div>
          </div>
          <div className="footer-links">
            <a href={`mailto:${eventConfig.contactEmail}`}>Contact</a>
            <a href={eventConfig.instagramUrl}>Instagram</a>
            <a href="#top">Back to top ↑</a>
          </div>
          <p>Event details subject to final approval and confirmation.</p>
        </div>
      </footer>

      <a className="mobile-ticket-cta" href={eventConfig.ticketUrl}>
        Get Tickets <span>→</span>
      </a>
    </main>
  );
}
