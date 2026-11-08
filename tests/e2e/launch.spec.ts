import { resetLoginCounters, quietDevelopmentReloads } from "./isolation";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

test.beforeEach(resetLoginCounters);
test.beforeEach(quietDevelopmentReloads);

test("launch policies, all-in prices, consent and keyboard access", async ({
  page,
  request,
  browserName,
}) => {
  await page.goto("/");
  await expect(page.getByText("$10.61", { exact: true })).toBeVisible();
  await expect(page.getByText("$15.76", { exact: true })).toBeVisible();
  await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await page.getByRole("link", { name: "Ticket terms", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ticket terms", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Tickets are nonrefundable except where required by law.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/checkout?tier=meat");
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await expect(page.getByText("$15.76", { exact: true }).last()).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Wristband", exact: true }),
  ).toHaveValue("meat");
  const headers = (await request.get("/checkout")).headers();
  expect(headers["content-security-policy"]).toContain("nonce-");
  expect(headers["content-security-policy"]).toContain("object-src 'none'");
  expect(headers["cache-control"]).toContain("no-store");
  expect(headers["permissions-policy"]).toContain("camera=(self)");
  const publicScores = await request.get("/api/leaderboard");
  expect(publicScores.headers()["cache-control"]).toContain("s-maxage=15");
  expect(publicScores.headers()["cache-control"]).not.toContain("private");
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /tickets/");
  expect((await request.get("/api/operations/launch")).status()).toBe(401);
  await page.goto("/not-a-real-page");
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
});

test("public, policy, ticket and staff pages pass automated WCAG accessibility checks", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const clientErrors: string[] = [];
  page.on("pageerror", (error) => clientErrors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /hydration|didn.t match|server rendered/i.test(message.text())
    )
      clientErrors.push(message.text());
  });
  const fixture = JSON.parse(await readFile(".data/e2e-fixture.json", "utf8"));
  for (const path of [
    "/",
    "/checkout",
    "/terms",
    "/privacy",
    "/accessibility",
    "/leaderboard",
    "/admin/leaderboard",
    "/admin/launch",
    fixture.orderUrl,
    fixture.tickets[0].url,
  ]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    await info.attach(`accessibility-${path.split("/")[1] || "home"}`, {
      body: JSON.stringify(
        {
          path: path.startsWith("/tickets/") ? "/tickets/[synthetic]" : path,
          violations: results.violations,
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
    expect(
      results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
      `Accessibility: ${path}`,
    ).toEqual([]);
  }
  expect(clientErrors, "Client rendering and hydration").toEqual([]);
});

test("chunked-size guard, legacy login closure and organizer-only launch checks", async ({
  request,
}) => {
  const oversized = await request.post("/api/operations/auth", {
    headers: {
      origin: new URL(test.info().project.use.baseURL!).origin,
      "Content-Type": "application/json",
    },
    data: JSON.stringify({ id: "x".repeat(41000), password: "bad" }),
  });
  expect(oversized.status()).toBe(413);
  expect(
    (
      await request.post("/api/admin/auth", { data: { passcode: "anything" } })
    ).status(),
  ).toBe(410);
  expect((await request.get("/api/operations/launch")).status()).toBe(401);
  const signedIn = await request.post("/api/operations/auth", {
    headers: { origin: new URL(test.info().project.use.baseURL!).origin },
    data: { id: "scanner", password: "local-preview-scanner-only" },
  });
  expect(signedIn.status()).toBe(200);
  expect((await request.get("/api/operations/launch")).status()).toBe(403);
});
