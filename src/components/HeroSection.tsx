import { ArrowDown, CalendarDays, MapPin, Ticket } from "lucide-react";
import { eventConfig } from "@/lib/eventConfig";
import { QuesadillaArt } from "./CheeseArt";
import { KappaSigmaMark } from "./KappaSigmaMark";
import { publicPrices, money } from "@/lib/policies";

export function HeroSection({ canBuy = false }: { canBuy?: boolean }) {
  const prices = publicPrices();
  return (
    <header className="hero" id="top">
      <nav className="nav shell" aria-label="Main navigation">
        <a className="brand" href="#top" aria-label="KSigdillas home">
          <KappaSigmaMark />
          <span>KSIGDILLAS</span>
        </a>
        <div className="nav-links">
          <a href="#about">About</a>
          <a href="#tickets">Tickets</a>
          <a href="#activities">Activities</a>
          <a href="#faq">FAQ</a>
        </div>
      </nav>

      <div className="hero-grid shell">
        <div className="hero-copy">
          <p className="eyebrow light">
            <span />
            Hosted by {eventConfig.organization}
          </p>
          <h1>
            K<span>SIG</span>DILLAS
          </h1>
          <p className="hero-subtitle">
            Quesadillas &amp; volleyball.
            <br />
            Thursday, November 19 · 6–9 PM Central.
          </p>
          <p className="hero-prices">
            {!prices.door || canBuy
              ? `Basicdilla ${money(prices.online.basic)} · Meat/Veggie ${money(prices.online.meat)}. Processing fee included.`
              : "Cash door tickets: Basicdilla $12 · Meat/Veggie $18."}
          </p>
          <div className="hero-actions">
            <a className="button button-cheese" href={eventConfig.ticketUrl}>
              {canBuy ? "Buy Tickets" : "Ticket Details"} <Ticket size={19} />
            </a>
            <a className="button button-outline" href="#leaderboard">
              View Leaderboard <ArrowDown size={18} />
            </a>
          </div>
          <div className="hero-meta">
            <div>
              <CalendarDays />
              <span>
                <strong>{eventConfig.dayAndTime}</strong>
                {eventConfig.date}
              </span>
            </div>
            <div>
              <MapPin />
              <span>
                <strong>{eventConfig.venue}</strong>
                {eventConfig.venueNote}
              </span>
            </div>
          </div>
        </div>
        <QuesadillaArt />
      </div>
      <div className="hero-ticker" aria-hidden="true">
        <span>Quesadillas</span>
        <span>Movember</span>
        <span>Volleyball</span>
        <span>Philanthropy</span>
      </div>
    </header>
  );
}
