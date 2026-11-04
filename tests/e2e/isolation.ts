import { Pool } from "pg";
// This fixed loopback database is created only by scripts/preview.ts --e2e.
// Reset abuse counters between independent cases without relaxing server limits.
export async function resetLoginCounters() {
  const pool = new Pool({ host: "127.0.0.1", port: 54387, database: "postgres", user: "postgres", password: "isolated-local-preview", max: 1 });
  try { await pool.query("DELETE FROM event_ops_attempts WHERE id LIKE 'login%'" ); }
  finally { await pool.end(); }
}
