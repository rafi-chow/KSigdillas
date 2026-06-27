import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { calculateTotalPoints } from "@/lib/scoringConfig";
import { getDemoTeams } from "@/lib/leaderboard/demoData";
import type { LeaderboardRepository } from "@/lib/leaderboard/repository";
import type {
  ScoreUpdate,
  Team,
  TeamInput,
} from "@/types/leaderboard";

function getDataPath() {
  if (process.env.LEADERBOARD_DATA_PATH) {
    return process.env.LEADERBOARD_DATA_PATH;
  }

  // Vercel functions can write only to /tmp. This keeps the mock deployable,
  // but production should replace this adapter with a persistent database.
  return process.env.VERCEL
    ? join("/tmp", "ksigdillas-leaderboard.json")
    : join(process.cwd(), ".data", "leaderboard.json");
}

function sortTeams(teams: Team[]) {
  return [...teams].sort(
    (a, b) =>
      b.totalPoints - a.totalPoints ||
      a.displayName.localeCompare(b.displayName),
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export class JsonLeaderboardRepository implements LeaderboardRepository {
  private readonly dataPath = getDataPath();
  private writeQueue: Promise<unknown> = Promise.resolve();

  private async read(): Promise<Team[]> {
    try {
      const contents = await readFile(this.dataPath, "utf8");
      const teams = JSON.parse(contents) as Team[];
      return sortTeams(
        teams.map((team) => ({
          ...team,
          totalPoints: calculateTotalPoints(team),
        })),
      );
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== "ENOENT") {
        throw error;
      }

      const teams = getDemoTeams();
      await this.write(teams);
      return sortTeams(teams);
    }
  }

  private async write(teams: Team[]) {
    await mkdir(dirname(this.dataPath), { recursive: true });
    const temporaryPath = `${this.dataPath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(teams, null, 2), "utf8");
    await rename(temporaryPath, this.dataPath);
  }

  private mutate<T>(operation: () => Promise<T>): Promise<T> {
    const queued = this.writeQueue.then(operation, operation);
    this.writeQueue = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  }

  async getTeams() {
    await this.writeQueue;
    return this.read();
  }

  async createTeam(input: TeamInput) {
    return this.mutate(async () => {
      const teams = await this.read();
      const baseId = slugify(input.name || input.displayName) || "team";
      let id = baseId;
      let suffix = 2;

      while (teams.some((team) => team.id === id)) {
        id = `${baseId}-${suffix++}`;
      }

      const now = new Date().toISOString();
      const team: Team = {
        id,
        ...input,
        ticketPoints: 0,
        volleyballPoints: 0,
        eatingCompetitionPoints: 0,
        donationPoints: 0,
        bonusPoints: 0,
        totalPoints: 0,
        lastUpdated: now,
      };

      await this.write([...teams, team]);
      return team;
    });
  }

  async updateTeam(id: string, input: TeamInput) {
    return this.mutate(async () => {
      const teams = await this.read();
      const index = teams.findIndex((team) => team.id === id);
      if (index === -1) {
        throw new Error("Team not found.");
      }

      const updated = {
        ...teams[index],
        ...input,
        lastUpdated: new Date().toISOString(),
      };
      teams[index] = updated;
      await this.write(teams);
      return updated;
    });
  }

  async updateScore(update: ScoreUpdate) {
    return this.mutate(async () => {
      const teams = await this.read();
      const index = teams.findIndex((team) => team.id === update.teamId);
      if (index === -1) {
        throw new Error("Team not found.");
      }

      const team = teams[index];
      const categoryPoints = team[update.category] + update.amount;
      if (categoryPoints < 0) {
        throw new Error("A category score cannot be below zero.");
      }

      const updated = {
        ...team,
        [update.category]: categoryPoints,
        lastUpdated: new Date().toISOString(),
      };
      updated.totalPoints = calculateTotalPoints(updated);
      teams[index] = updated;
      await this.write(teams);
      return updated;
    });
  }

  async resetDemoData() {
    return this.mutate(async () => {
      const now = new Date().toISOString();
      const teams = getDemoTeams().map((team) => ({
        ...team,
        lastUpdated: now,
      }));
      await this.write(teams);
      return sortTeams(teams);
    });
  }
}
