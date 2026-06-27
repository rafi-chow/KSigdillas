import { ArrowDown, CalendarDays, MapPin, Ticket } from "lucide-react";
import { eventConfig } from "@/lib/eventConfig";
import { QuesadillaArt } from "./CheeseArt";
import { KappaSigmaMark } from "./KappaSigmaMark";

export function HeroSection() {
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
        <a className="button button-light nav-cta" href={eventConfig.ticketUrl}>
          <Ticket size={17} />
          Get Tickets
        </a>
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
            Quesadillas. Hoops. Volleyball.
            <br />
            <strong>Philanthropy.</strong>
          </p>
          <div className="hero-actions">
            <a className="button button-cheese" href={eventConfig.ticketUrl}>
              Get Tickets <Ticket size={19} />
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
        <span>QUESADILLAS</span><i>★</i><span>HOOPS</span><i>★</i>
        <span>VOLLEYBALL</span><i>★</i><span>PHILANTHROPY</span><i>★</i>
        <span>QUESADILLAS</span><i>★</i>
      </div>
    </header>
  );
}
