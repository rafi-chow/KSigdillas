import { JsonLeaderboardRepository } from "@/lib/leaderboard/jsonRepository";

const globalRepository = globalThis as typeof globalThis & {
  leaderboardRepository?: JsonLeaderboardRepository;
};

export const leaderboardRepository =
  globalRepository.leaderboardRepository ?? new JsonLeaderboardRepository();

if (process.env.NODE_ENV !== "production") {
  globalRepository.leaderboardRepository = leaderboardRepository;
}
