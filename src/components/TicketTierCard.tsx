import { money, publicPrices } from "@/lib/policies";
import { Check, Ticket } from "lucide-react";

type TicketTierCardProps = {
  name: string;
  price: number;
  doorPrice: number;
  label: string;
  features: readonly string[];
  color: "yellow" | "orange" | "red";
  featured?: boolean;
  ticketUrl: string;
  canBuy?: boolean;
  onlinePrice?: number;
};

export function TicketTierCard({
  name,
  doorPrice,
  label,
  features,
  color,
  featured,
  ticketUrl,
  canBuy = false,
  onlinePrice,
}: TicketTierCardProps) {
  const prices = publicPrices();
  const showOnlinePrice = !prices.door || canBuy;
  return (
    <article
      className={`tier-card tier-${color} ${featured ? "featured" : ""}`}
    >
      <div className="tier-icon">
        <Ticket />
      </div>
      <p className="tier-label">{label}</p>
      <h3>{name}</h3>
      <p className="tier-price">
        {showOnlinePrice ? (
          <>
            <strong>
              {money(
                onlinePrice ??
                  prices.online[name === "Basicdilla" ? "basic" : "meat"],
              )}
            </strong>{" "}
            online total <span>· ${doorPrice} cash at the door</span>
          </>
        ) : (
          <>
            <strong>${doorPrice}</strong> cash at the door
          </>
        )}
      </p>
      <div className="tier-rule" />
      <ul>
        {features.map((feature) => (
          <li key={feature}>
            <span>
              <Check size={15} />
            </span>
            {feature}
          </li>
        ))}
      </ul>
      <a
        className="tier-link"
        href={`${ticketUrl}?tier=${name === "Basicdilla" ? "basic" : "meat"}`}
      >
        {canBuy ? "Buy this ticket" : "View ticket details"} <span>→</span>
      </a>
    </article>
  );
}
