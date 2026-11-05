import { Pool, type PoolClient } from "pg";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { collections, emptyState, type State } from "./model";
import { initialState } from "./rules";
export interface Store {
  read(): Promise<State>;
  transaction<T>(fn: (state: State) => T | Promise<T>): Promise<T>;
  maintenanceDue?(now: Date, refundWrites: boolean): Promise<boolean>;
}
// One event and a few hundred guests: serialize short mutations in Postgres.
// Never make network/provider calls inside this transaction.
export class PgStore implements Store {
  readonly pool: Pool;
  constructor(
    url: string,
    private readonly deadline?: number,
  ) {
    this.pool = new Pool({
      connectionString: url,
      max: 5,
      connectionTimeoutMillis: deadline ? 3000 : 10000,
      statement_timeout: deadline ? 1000 : 15000,
      lock_timeout: deadline ? 1000 : 10000,
    });
  }
  private query(client: PoolClient, text: string, values?: unknown[]) {
    if (this.deadline && Date.now() >= this.deadline)
      throw new Error("Maintenance storage deadline reached.");
    const config = {
      text,
      values,
      query_timeout: this.deadline
        ? Math.max(1, Math.min(1000, this.deadline - Date.now()))
        : 0,
    };
    return client.query(config);
  }
  async migrate() {
    const client = await this.pool.connect();
    try {
      await this.query(client, "BEGIN");
      await this.query(client, "SELECT pg_advisory_xact_lock(6874531)");
      await this.query(
        client,
        await readFile(
          resolve(process.cwd(), "migrations/001_event_operations.sql"),
          "utf8",
        ),
      );
      await this.query(
        client,
        await readFile(
          resolve(process.cwd(), "migrations/002_stripe_and_brothers.sql"),
          "utf8",
        ),
      );
      await this.query(
        client,
        await readFile(
          resolve(process.cwd(), "migrations/003_packet_rules.sql"),
          "utf8",
        ),
      );
      await this.query(client, "COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    await this.transaction((s) => {
      if (s.settings.length === 0) initialState(s);
    });
  }
  private async load(client: PoolClient) {
    const state = emptyState();
    const result = await this.query(
      client,
      collections
        .map(
          (key) =>
            `SELECT '${key}' AS collection, payload FROM "event_ops_${key}"`,
        )
        .join(" UNION ALL "),
    );
    for (const row of result.rows)
      (state[row.collection as keyof State] as unknown[]).push(row.payload);
    return state;
  }
  async read() {
    const client = await this.pool.connect();
    try {
      await this.query(
        client,
        "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
      );
      const state = await this.load(client);
      await this.query(client, "COMMIT");
      return state;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  // The minute trigger needs only a queue-existence check, not attendee records.
  async maintenanceDue(now: Date, refundWrites: boolean) {
    const client = await this.pool.connect();
    try {
      const result = await this.query(
        client,
        `
        SELECT EXISTS (
          SELECT 1 FROM event_ops_jobs WHERE
            ((payload->>'status' = 'sending' AND payload->>'leaseUntil' <= $1)
            OR (payload->>'status' <> 'sent'
              AND COALESCE((payload->>'uncertain')::boolean, false) = false
              AND (payload->>'attempts')::int < 8
              AND payload->>'nextAttemptAt' <= $1
              AND (payload->>'leaseUntil' IS NULL OR payload->>'leaseUntil' <= $1)))
          UNION ALL
          SELECT 1 FROM "event_ops_providerEvents" WHERE
            payload->>'status' = 'pending' AND payload->>'nextAttemptAt' <= $1
            AND (payload->>'leaseUntil' IS NULL OR payload->>'leaseUntil' <= $1)
          UNION ALL
          SELECT 1 FROM event_ops_checkouts WHERE
            payload->>'sessionId' IS NOT NULL AND payload->>'nextCheckAt' <= $1
            AND (payload->>'leaseUntil' IS NULL OR payload->>'leaseUntil' <= $1)
          UNION ALL
          SELECT 1 FROM event_ops_refunds WHERE
            $2::boolean AND payload->>'status' = 'requested'
        ) AS due
      `,
        [now.toISOString(), refundWrites],
      );
      return result.rows[0].due as boolean;
    } finally {
      client.release();
    }
  }
  // Separate scheduler telemetry: no financial/attendee rows or revision changes.
  async recordMaintenanceProbe(now: Date) {
    const client = await this.pool.connect();
    try {
      await this.query(
        client,
        `
        INSERT INTO event_ops_attempts (id, payload)
        VALUES ('maintenance-probe-heartbeat', jsonb_build_object(
          'id', 'maintenance-probe-heartbeat', 'count', 1, 'resetsAt', $1::text))
        ON CONFLICT (id) DO UPDATE SET payload = jsonb_build_object(
          'id', 'maintenance-probe-heartbeat',
          'count', (event_ops_attempts.payload->>'count')::int + 1,
          'resetsAt', GREATEST(event_ops_attempts.payload->>'resetsAt', $1::text))
      `,
        [now.toISOString()],
      );
    } finally {
      client.release();
    }
  }
  async transaction<T>(fn: (state: State) => T | Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await this.query(client, "BEGIN");
      await this.query(
        client,
        "SELECT revision FROM event_ops_revision WHERE id=1 FOR UPDATE",
      );
      const before = await this.load(client);
      const state = structuredClone(before);
      const result = await fn(state);
      for (const key of collections) {
        const previous = new Map(
          (before[key] as { id: string }[]).map((row) => [
            row.id,
            JSON.stringify(row),
          ]),
        );
        const retained = new Set(state[key].map((row) => row.id));
        const removed = before[key]
          .filter((row) => !retained.has(row.id))
          .map((row) => row.id);
        if (removed.length) {
          if (key !== "sessions" && key !== "attempts")
            throw new Error(
              "Records cannot be deleted. Use an audited reversal.",
            );
        }
        for (const record of state[key]) {
          const serialized = JSON.stringify(record);
          if (previous.get(record.id) === serialized) continue;
          await this.query(
            client,
            `INSERT INTO "event_ops_${key}"(id,payload) VALUES ($1,$2::jsonb) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload`,
            [record.id, serialized],
          );
        }
        if (removed.length)
          await this.query(
            client,
            `DELETE FROM "event_ops_${key}" WHERE id=ANY($1::text[])`,
            [removed],
          );
      }
      await this.query(
        client,
        "UPDATE event_ops_revision SET revision=revision+1 WHERE id=1",
      );
      await this.query(client, "COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  async close() {
    await this.pool.end();
  }
}
let store: PgStore | undefined;
export const operationsEnabled = () =>
  process.env.EVENT_OPERATIONS_ENABLED === "true";
export function getStore() {
  if (!operationsEnabled())
    throw new Error("The new event desk is not open yet.");
  const url = process.env.OPERATIONS_DATABASE_URL;
  if (!url) throw new Error("Event storage is not configured.");
  // Intentionally never fall back to existing DATABASE_URL or JSON financial storage.
  return (store ??= new PgStore(url));
}
