import { JsonLeaderboardRepository } from "@/lib/leaderboard/jsonRepository";
import { PostgresLeaderboardRepository } from "@/lib/leaderboard/postgresRepository";
import type { LeaderboardRepository } from "@/lib/leaderboard/repository";

const globalRepository = globalThis as typeof globalThis & {
  leaderboardRepository?: LeaderboardRepository;
};

export const leaderboardStorageMode = process.env.DATABASE_URL
  ? "postgres"
  : "json";

export const leaderboardRepository =
  globalRepository.leaderboardRepository ??
  (leaderboardStorageMode === "postgres"
    ? new PostgresLeaderboardRepository()
    : new JsonLeaderboardRepository());

if (process.env.NODE_ENV !== "production") {
  globalRepository.leaderboardRepository = leaderboardRepository;
}
