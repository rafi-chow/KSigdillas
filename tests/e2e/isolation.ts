import { Pool } from "pg";
import type { Page } from "@playwright/test";
// Keep Next's development-only Fast Refresh socket from reloading a previous
// document in the middle of the next navigation. Application requests, scripts,
// hydration and public-feed polling remain real and are still asserted.
export async function quietDevelopmentReloads({ page }: { page: Page }) {
  await page.routeWebSocket("**/_next/webpack-hmr*", () => {});
}
// This fixed loopback database is created only by scripts/preview.ts --e2e.
// Reset abuse counters between independent cases without relaxing server limits.
export async function resetLoginCounters() {
  const pool = new Pool({
    host: "127.0.0.1",
    port: 54387,
    database: "postgres",
    user: "postgres",
    password: "isolated-local-preview",
    max: 1,
  });
  try {
    await pool.query("DELETE FROM event_ops_attempts WHERE id LIKE 'login%'");
  } finally {
    await pool.end();
  }
}
