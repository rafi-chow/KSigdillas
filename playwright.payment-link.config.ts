import { defineConfig, devices } from "@playwright/test";
const production = process.env.E2E_PRODUCTION === "true";
const origin = `${production ? "https" : "http"}://127.0.0.1:3101`;
export default defineConfig({
  testDir: "./tests",
  testMatch: "payment-link-browser.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 60000,
  reporter: "list",
  use: { baseURL: origin, ignoreHTTPSErrors: production },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-webkit", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: `npx tsx scripts/preview.ts --e2e --payment-link${production ? " --production" : ""}`,
    url: `${origin}/api/leaderboard`,
    ignoreHTTPSErrors: production,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
