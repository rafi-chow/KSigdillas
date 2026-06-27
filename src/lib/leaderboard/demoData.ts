import { calculateTotalPoints } from "@/lib/scoringConfig";
import type { Team } from "@/types/leaderboard";

const demoUpdatedAt = "2026-06-27T15:00:00.000Z";

const samples: Array<Omit<Team, "totalPoints" | "lastUpdated">> = [
  {
    id: "axo",
    name: "Alpha Chi Omega",
    displayName: "AXO",
    accentColor: "#B5232B",
    ticketPoints: 0,
    volleyballPoints: 0,
    eatingCompetitionPoints: 0,
    donationPoints: 0,
    bonusPoints: 0,
  },
  {
    id: "dz",
    name: "Delta Zeta",
    displayName: "DZ",
    accentColor: "#E96B94",
    ticketPoints: 0,
    volleyballPoints: 0,
    eatingCompetitionPoints: 0,
    donationPoints: 0,
    bonusPoints: 0,
  },
  {
    id: "zta",
    name: "Zeta Tau Alpha",
    displayName: "ZTA",
    accentColor: "#179B83",
    ticketPoints: 0,
    volleyballPoints: 0,
    eatingCompetitionPoints: 0,
    donationPoints: 0,
    bonusPoints: 0,
  },
  {
    id: "ddd",
    name: "Delta Delta Delta",
    displayName: "DDD",
    accentColor: "#2E67A0",
    ticketPoints: 0,
    volleyballPoints: 0,
    eatingCompetitionPoints: 0,
    donationPoints: 0,
    bonusPoints: 0,
  },
];

export function getDemoTeams(): Team[] {
  return samples.map((team) => ({
    ...team,
    totalPoints: calculateTotalPoints(team),
    lastUpdated: demoUpdatedAt,
  }));
}
