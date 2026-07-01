import "server-only";

import { neon } from "@neondatabase/serverless";
import { getDemoTeams } from "@/lib/leaderboard/demoData";
import type { LeaderboardRepository } from "@/lib/leaderboard/repository";
import type {
  ScoreCategory,
  ScoreUpdate,
  Team,
  TeamInput,
} from "@/types/leaderboard";

type TeamRow = {
  id: string;
  name: string;
  display_name: string;
  accent_color: string;
  ticket_points: number;
  volleyball_points: number;
  eating_competition_points: number;
  donation_points: number;
  bonus_points: number;
  total_points: number;
  last_updated: string | Date;
};

const selectTeams = `
  SELECT
    id,
    name,
    display_name,
    accent_color,
    ticket_points,
    volleyball_points,
    eating_competition_points,
    donation_points,
    bonus_points,
    total_points,
    last_updated
  FROM leaderboard_teams
`;

const categoryColumns: Record<ScoreCategory, string> = {
  ticketPoints: "ticket_points",
  volleyballPoints: "volleyball_points",
  eatingCompetitionPoints: "eating_competition_points",
  donationPoints: "donation_points",
  bonusPoints: "bonus_points",
};

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for Postgres leaderboard storage.");
  }
  return databaseUrl;
}

function rowToTeam(row: TeamRow): Team {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    accentColor: row.accent_color,
    ticketPoints: Number(row.ticket_points),
    volleyballPoints: Number(row.volleyball_points),
    eatingCompetitionPoints: Number(row.eating_competition_points),
    donationPoints: Number(row.donation_points),
    bonusPoints: Number(row.bonus_points),
    totalPoints: Number(row.total_points),
    lastUpdated:
      row.last_updated instanceof Date
        ? row.last_updated.toISOString()
        : new Date(row.last_updated).toISOString(),
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function seedStatement(prefix = "INSERT INTO") {
  const teams = getDemoTeams();
  const values: unknown[] = [];
  const rows = teams.map((team, teamIndex) => {
    const offset = teamIndex * 10;
    values.push(
      team.id,
      team.name,
      team.displayName,
      team.accentColor,
      team.ticketPoints,
      team.volleyballPoints,
      team.eatingCompetitionPoints,
      team.donationPoints,
      team.bonusPoints,
      team.lastUpdated,
    );
    return `(${Array.from({ length: 10 }, (_, index) => `$${offset + index + 1}`).join(", ")})`;
  });

  return {
    text: `
      ${prefix} leaderboard_teams (
        id,
        name,
        display_name,
        accent_color,
        ticket_points,
        volleyball_points,
        eating_competition_points,
        donation_points,
        bonus_points,
        last_updated
      )
      VALUES ${rows.join(", ")}
    `,
    values,
  };
}

export class PostgresLeaderboardRepository implements LeaderboardRepository {
  private readonly sql = neon(getDatabaseUrl());
  private schemaPromise: Promise<void> | null = null;

  private ensureSchema() {
    if (!this.schemaPromise) {
      this.schemaPromise = (async () => {
        await this.sql.query(`
          CREATE TABLE IF NOT EXISTS leaderboard_teams (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            display_name TEXT NOT NULL,
            accent_color TEXT NOT NULL,
            ticket_points INTEGER NOT NULL DEFAULT 0 CHECK (ticket_points >= 0),
            volleyball_points INTEGER NOT NULL DEFAULT 0 CHECK (volleyball_points >= 0),
            eating_competition_points INTEGER NOT NULL DEFAULT 0 CHECK (eating_competition_points >= 0),
            donation_points INTEGER NOT NULL DEFAULT 0 CHECK (donation_points >= 0),
            bonus_points INTEGER NOT NULL DEFAULT 0 CHECK (bonus_points >= 0),
            total_points INTEGER GENERATED ALWAYS AS (
              ticket_points +
              volleyball_points +
              eating_competition_points +
              donation_points +
              bonus_points
            ) STORED,
            last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);

        const seed = seedStatement();
        await this.sql.query(
          `${seed.text}
           ON CONFLICT (id) DO NOTHING`,
          seed.values,
        );
      })().catch((error) => {
        this.schemaPromise = null;
        throw error;
      });
    }
    return this.schemaPromise;
  }

  private async findTeam(id: string) {
    const rows = (await this.sql.query(
      `${selectTeams} WHERE id = $1`,
      [id],
    )) as TeamRow[];
    return rows[0] ? rowToTeam(rows[0]) : null;
  }

  async getTeams() {
    await this.ensureSchema();
    const rows = (await this.sql.query(
      `${selectTeams}
       ORDER BY total_points DESC, display_name ASC`,
    )) as TeamRow[];
    return rows.map(rowToTeam);
  }

  async createTeam(input: TeamInput) {
    await this.ensureSchema();
    const baseId = slugify(input.name || input.displayName) || "team";
    let id = baseId;
    let suffix = 2;

    while (await this.findTeam(id)) {
      id = `${baseId}-${suffix++}`;
    }

    const rows = (await this.sql.query(
      `INSERT INTO leaderboard_teams (
         id, name, display_name, accent_color
       )
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, input.name, input.displayName, input.accentColor],
    )) as TeamRow[];

    return rowToTeam(rows[0]);
  }

  async updateTeam(id: string, input: TeamInput) {
    await this.ensureSchema();
    const rows = (await this.sql.query(
      `UPDATE leaderboard_teams
       SET
         name = $2,
         display_name = $3,
         accent_color = $4,
         last_updated = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, input.name, input.displayName, input.accentColor],
    )) as TeamRow[];

    if (!rows[0]) {
      throw new Error("Team not found.");
    }
    return rowToTeam(rows[0]);
  }

  async updateScore(update: ScoreUpdate) {
    await this.ensureSchema();
    const column = categoryColumns[update.category];
    const rows = (await this.sql.query(
      `UPDATE leaderboard_teams
       SET
         ${column} = ${column} + $2,
         last_updated = NOW()
       WHERE id = $1
         AND ${column} + $2 >= 0
       RETURNING *`,
      [update.teamId, update.amount],
    )) as TeamRow[];

    if (rows[0]) {
      return rowToTeam(rows[0]);
    }
    if (!(await this.findTeam(update.teamId))) {
      throw new Error("Team not found.");
    }
    throw new Error("A category score cannot be below zero.");
  }

  async replaceTicketPoints(pointsByTeamId: Record<string, number>) {
    await this.ensureSchema();
    for (const [teamId, points] of Object.entries(pointsByTeamId)) {
      if (!Number.isSafeInteger(points) || points < 0) {
        throw new Error(`Invalid Eventbrite ticket points for ${teamId}.`);
      }
    }

    const rows = (await this.sql.query(
      `UPDATE leaderboard_teams
       SET
         ticket_points = COALESCE(($1::jsonb ->> id)::integer, 0),
         last_updated = CASE
           WHEN ticket_points IS DISTINCT FROM COALESCE(($1::jsonb ->> id)::integer, 0)
             THEN NOW()
           ELSE last_updated
         END
       RETURNING *`,
      [JSON.stringify(pointsByTeamId)],
    )) as TeamRow[];

    return rows
      .map(rowToTeam)
      .sort(
        (a, b) =>
          b.totalPoints - a.totalPoints ||
          a.displayName.localeCompare(b.displayName),
      );
  }

  async resetDemoData() {
    await this.ensureSchema();
    const seed = seedStatement();
    const [, insertedRows] = await this.sql.transaction((transaction) => [
      transaction`DELETE FROM leaderboard_teams`,
      transaction.query(
        `${seed.text}
         RETURNING *`,
        seed.values,
      ),
    ]);
    const rows = insertedRows as TeamRow[];

    return rows
      .map(rowToTeam)
      .sort(
        (a, b) =>
          b.totalPoints - a.totalPoints ||
          a.displayName.localeCompare(b.displayName),
      );
  }
}
