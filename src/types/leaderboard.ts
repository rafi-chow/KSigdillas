export const scoreCategories = [
  "ticketPoints",
  "volleyballPoints",
  "eatingCompetitionPoints",
  "donationPoints",
  "bonusPoints",
] as const;

export type ScoreCategory = (typeof scoreCategories)[number];

export type Team = {
  id: string;
  name: string;
  displayName: string;
  accentColor: string;
  ticketPoints: number;
  volleyballPoints: number;
  eatingCompetitionPoints: number;
  donationPoints: number;
  bonusPoints: number;
  totalPoints: number;
  lastUpdated: string;
};

export type ScoreUpdate = {
  teamId: string;
  category: ScoreCategory;
  amount: number;
};

export type TeamInput = Pick<Team, "name" | "displayName" | "accentColor">;

export type LeaderboardResponse = {
  teams: Team[];
  lastUpdated: string;
  storageMode: "json" | "postgres";
};
