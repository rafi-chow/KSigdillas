import { Check, Ticket } from "lucide-react";

type TicketTierCardProps = {
  name: string;
  label: string;
  features: readonly string[];
  color: "yellow" | "orange" | "red";
  featured?: boolean;
  ticketUrl: string;
};

export function TicketTierCard({
  name,
  label,
  features,
  color,
  featured,
  ticketUrl,
}: TicketTierCardProps) {
  return (
    <article className={`tier-card tier-${color} ${featured ? "featured" : ""}`}>
      {featured && <span className="popular">Crowd favorite</span>}
      <div className="tier-icon"><Ticket /></div>
      <p className="tier-label">{label}</p>
      <h3>{name}</h3>
      <div className="tier-rule" />
      <ul>
        {features.map((feature) => (
          <li key={feature}>
            <span><Check size={15} /></span>
            {feature}
          </li>
        ))}
      </ul>
      <a className="tier-link" href={ticketUrl}>
        Choose this wristband <span>→</span>
      </a>
    </article>
  );
}
