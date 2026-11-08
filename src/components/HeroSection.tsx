import { ArrowDown, ArrowRight, ArrowUpRight } from "lucide-react";
import { eventConfig } from "@/lib/eventConfig";
import { donationUrl } from "@/lib/payments/donationLink";
import { QuesadillaArt } from "./CheeseArt";
import { KappaSigmaMark } from "./KappaSigmaMark";

export function HeroSection({
  canBuy = false,
  ticketUrl = eventConfig.ticketUrl,
}: {
  canBuy?: boolean;
  ticketUrl?: string;
}) {
  return (
    <header className="hero" id="top">
      <nav className="nav shell" aria-label="Main navigation">
        <a className="brand" href="#top" aria-label="KSigdillas home">
          <KappaSigmaMark />
          <span>KSIGDILLAS</span>
        </a>
        <div className="nav-links">
          <a href="#schedule">The week</a>
          <a href="#tickets">Tickets</a>
          <a href="#leaderboard">Standings</a>
        </div>
      </nav>
      <div className="hero-grid shell">
        <div className="hero-copy">
          <p className="eyebrow light">{eventConfig.organization}</p>
          <h1 aria-label="KSigdillas">
            K<span>SIG</span>DILLAS
          </h1>
          <p className="hero-subtitle">Quesadillas &amp; volleyball.</p>
          <div className="hero-event">
            <p>Thursday, November 19, 2026</p>
            <p>6–9 PM Central</p>
            <p>707 S Davis Dr · Arlington, Texas</p>
          </div>
          <div className="hero-actions">
            <a className="button button-light" href={ticketUrl}>
              {canBuy ? "Buy tickets" : "Ticket details"}
              <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a className="hero-text-link" href="#schedule">
              See the week’s events
              <ArrowDown size={18} aria-hidden="true" />
            </a>
          </div>
          <a className="hero-donate-link" href={donationUrl}>
            Donate <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </div>
        <QuesadillaArt />
      </div>
      <div className="hero-caption shell">
        <span>November 16–19 · Philanthropy week</span>
        <a href="#donations">
          Supply guide <ArrowRight size={16} aria-hidden="true" />
        </a>
      </div>
    </header>
  );
}
