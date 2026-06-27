import {
  scoreCategories,
  type ScoreCategory,
  type Team,
} from "@/types/leaderboard";

export const scoringConfig: Record<
  ScoreCategory,
  { label: string; shortLabel: string; description: string }
> = {
  ticketPoints: {
    label: "Ticket / Support",
    shortLabel: "Tickets",
    description: "Ticket sales and direct event support",
  },
  volleyballPoints: {
    label: "Volleyball",
    shortLabel: "Volleyball",
    description: "Points earned in the 4v4 tournament",
  },
  eatingCompetitionPoints: {
    label: "Eating Competition",
    shortLabel: "Eating",
    description: "Points earned in the most-eaten competition",
  },
  donationPoints: {
    label: "Donations",
    shortLabel: "Donations",
    description: "Approved philanthropy donation points",
  },
  bonusPoints: {
    label: "Bonus",
    shortLabel: "Bonus",
    description: "Admin-awarded spirit or competition bonuses",
  },
};

export const scoreUpdateLimits = {
  min: -10_000,
  max: 10_000,
} as const;

export const eventbriteTicketTierPoints = {
  Basicdilla: 1,
  "Chicken + Veggie": 2,
  "Beef Tier": 3,
} as const;

export function calculateTotalPoints(
  team: Pick<Team, ScoreCategory>,
): number {
  return scoreCategories.reduce((total, category) => total + team[category], 0);
}
