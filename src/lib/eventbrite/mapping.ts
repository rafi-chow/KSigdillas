import {
  eventbriteTicketTierPoints,
} from "@/lib/scoringConfig";
import type { Team } from "@/types/leaderboard";

export function normalizeEventbriteValue(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function getTicketTierPoints(ticketTier: string) {
  const normalizedTier = normalizeEventbriteValue(ticketTier);
  const match = Object.entries(eventbriteTicketTierPoints).find(
    ([name]) => normalizeEventbriteValue(name) === normalizedTier,
  );
  return match?.[1] ?? null;
}

export function findTeamForAnswer(teams: Team[], answer: string) {
  const normalizedAnswer = normalizeEventbriteValue(answer);
  if (!normalizedAnswer) return null;

  return (
    teams.find((team) =>
      [team.id, team.name, team.displayName].some(
        (candidate) =>
          normalizeEventbriteValue(candidate) === normalizedAnswer,
      ),
    ) ?? null
  );
}
