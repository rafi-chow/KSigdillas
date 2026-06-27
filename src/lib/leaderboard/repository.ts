import type {
  ScoreUpdate,
  Team,
  TeamInput,
} from "@/types/leaderboard";

export interface LeaderboardRepository {
  getTeams(): Promise<Team[]>;
  createTeam(input: TeamInput): Promise<Team>;
  updateTeam(id: string, input: TeamInput): Promise<Team>;
  updateScore(update: ScoreUpdate): Promise<Team>;
  resetDemoData(): Promise<Team[]>;
}
