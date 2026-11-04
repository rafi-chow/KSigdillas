import "server-only";
import { getStore, operationsEnabled } from "@/lib/operations/store";
import { standings } from "@/lib/operations/service";

import { unstable_cache } from "next/cache";
import { getEventbriteConfigStatus } from "@/lib/eventbrite/config";
import { fetchEventbriteTicketSnapshot } from "@/lib/eventbrite/sync";
import {
  leaderboardRepository,
  leaderboardStorageMode,
} from "@/lib/leaderboard";
import { calculateTotalPoints } from "@/lib/scoringConfig";
import type { LeaderboardResponse, Team } from "@/types/leaderboard";

const getCachedEventbriteSnapshot = unstable_cache(
  fetchEventbriteTicketSnapshot,
  ["eventbrite-ticket-snapshot-v1"],
  { revalidate: 30 },
);

function latestTeamUpdate(teams: Team[]) {
  return (
    teams
      .map((team) => team.lastUpdated)
      .sort()
      .at(-1) ?? new Date().toISOString()
  );
}

export async function getLiveLeaderboard(): Promise<LeaderboardResponse> {
  if (operationsEnabled()) return standings(await getStore().read());
  const teams = await leaderboardRepository.getTeams();
  let liveTeams = teams;
  let lastUpdated = latestTeamUpdate(teams);

  if (getEventbriteConfigStatus().configured) {
    try {
      const snapshot = await getCachedEventbriteSnapshot();
      liveTeams = teams
        .map((team) => {
          const ticketPoints = snapshot.teamPoints[team.id] ?? 0;
          const updated = {
            ...team,
            ticketPoints,
            lastUpdated:
              ticketPoints === team.ticketPoints
                ? team.lastUpdated
                : snapshot.syncedAt,
          };
          return {
            ...updated,
            totalPoints: calculateTotalPoints(updated),
          };
        })
        .sort(
          (a, b) =>
            b.totalPoints - a.totalPoints ||
            a.displayName.localeCompare(b.displayName),
        );
      lastUpdated = snapshot.syncedAt;
    } catch (error) {
      console.error("Automatic Eventbrite leaderboard refresh failed.", error);
    }
  }

  return {
    teams: liveTeams,
    lastUpdated,
    storageMode: leaderboardStorageMode,
  };
}
