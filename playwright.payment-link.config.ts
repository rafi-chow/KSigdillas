import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "payment-link-browser.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 60000,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3101" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-webkit", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: "npx tsx scripts/preview.ts --e2e --payment-link",
    url: "http://127.0.0.1:3101/api/leaderboard",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
