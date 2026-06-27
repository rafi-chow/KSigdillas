import { calculateTotalPoints } from "@/lib/scoringConfig";
import type { Team } from "@/types/leaderboard";

const demoUpdatedAt = "2026-06-27T15:00:00.000Z";

const samples: Array<Omit<Team, "totalPoints" | "lastUpdated">> = [
  {
    id: "alpha-chi-omega",
    name: "alpha-chi-omega",
    displayName: "Alpha Chi Omega",
    accentColor: "#B5232B",
    ticketPoints: 140,
    volleyballPoints: 120,
    eatingCompetitionPoints: 80,
    donationPoints: 95,
    bonusPoints: 10,
  },
  {
    id: "delta-delta-delta",
    name: "delta-delta-delta",
    displayName: "Delta Delta Delta",
    accentColor: "#2E67A0",
    ticketPoints: 125,
    volleyballPoints: 90,
    eatingCompetitionPoints: 110,
    donationPoints: 85,
    bonusPoints: 5,
  },
  {
    id: "delta-zeta",
    name: "delta-zeta",
    displayName: "Delta Zeta",
    accentColor: "#E96B94",
    ticketPoints: 105,
    volleyballPoints: 110,
    eatingCompetitionPoints: 70,
    donationPoints: 100,
    bonusPoints: 15,
  },
  {
    id: "zeta-tau-alpha",
    name: "zeta-tau-alpha",
    displayName: "Zeta Tau Alpha",
    accentColor: "#179B83",
    ticketPoints: 130,
    volleyballPoints: 80,
    eatingCompetitionPoints: 75,
    donationPoints: 80,
    bonusPoints: 10,
  },
  {
    id: "alpha-omicron-pi",
    name: "alpha-omicron-pi",
    displayName: "Alpha Omicron Pi",
    accentColor: "#A31D24",
    ticketPoints: 95,
    volleyballPoints: 100,
    eatingCompetitionPoints: 85,
    donationPoints: 70,
    bonusPoints: 0,
  },
  {
    id: "placeholder-team",
    name: "placeholder-team",
    displayName: "Placeholder Team",
    accentColor: "#F0A51B",
    ticketPoints: 70,
    volleyballPoints: 60,
    eatingCompetitionPoints: 65,
    donationPoints: 50,
    bonusPoints: 5,
  },
];

export function getDemoTeams(): Team[] {
  return samples.map((team) => ({
    ...team,
    totalPoints: calculateTotalPoints(team),
    lastUpdated: demoUpdatedAt,
  }));
}
