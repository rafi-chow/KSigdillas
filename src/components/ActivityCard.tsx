import type { LucideIcon } from "lucide-react";

type ActivityCardProps = {
  icon: LucideIcon;
  number: string;
  title: string;
  description: string;
  accent: "red" | "orange" | "yellow";
};

export function ActivityCard({
  icon: Icon,
  number,
  title,
  description,
  accent,
}: ActivityCardProps) {
  return (
    <article className={`activity-card activity-${accent}`}>
      <div className="activity-top">
        <span className="activity-icon"><Icon /></span>
        <span className="activity-number">{number}</span>
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  );
}
