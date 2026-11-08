import { defineConfig, devices } from "@playwright/test";
const production = process.env.E2E_PRODUCTION === "true";
const origin = `${production ? "https" : "http"}://127.0.0.1:3101`;
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: origin,
    ignoreHTTPSErrors: production,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-webkit", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: `npx tsx scripts/preview.ts --e2e${process.env.E2E_PRODUCTION === "true" ? " --production" : ""}`,
    url: `${origin}/api/leaderboard`,
    ignoreHTTPSErrors: production,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
