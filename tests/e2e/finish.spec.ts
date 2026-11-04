import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("supply guide switches days with keyboard controls and exposes accepted products", async ({
  page,
}) => {
  await page.goto("/");
  await page.screenshot({
    path: `test-results/modern-home-${test.info().project.name}.png`,
    animations: "disabled",
  });
  await page.getByRole("link", { name: "Supply guide", exact: true }).click();
  await page.screenshot({
    path: `test-results/modern-guide-${test.info().project.name}.png`,
    animations: "disabled",
  });
  const cheese = page.locator('[data-product="cheese"]');
  const water = page.locator('[data-product="water"]');
  await expect(cheese.locator(".supply-points")).toContainText("75");
  await expect(cheese.locator(".supply-points")).toContainText(
    "Cap 10 / chapter",
  );
  await page.getByRole("radio", { name: "Monday", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("radio", { name: "Tue / Wed", exact: true }),
  ).toBeChecked();
  await expect(cheese.locator(".supply-points")).toContainText("35");
  await expect(cheese.locator(".supply-points")).toContainText("No cap");
  await expect(water.locator(".supply-points")).toContainText("50");
  await page.keyboard.press("ArrowLeft");
  await expect(cheese.locator(".supply-points")).toContainText("75");
  await cheese.getByText("Accepted products", { exact: true }).click();
  await expect(
    cheese.getByRole("link", { name: "Triple Cheddar option" }),
  ).toHaveAttribute("href", "https://www.walmart.com/ip/46491724");
  await expect(page.locator(".mobile-ticket-cta")).toHaveCount(0);
  await page.setViewportSize({ width: 640, height: 900 });
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});

test("homepage shares one public feed, backs off failures, and pauses hidden polling", async ({
  page,
  request,
}) => {
  const data = await (await request.get("/api/leaderboard")).json();
  await page.clock.install();
  let calls = 0;
  await page.route("**/api/leaderboard", async (route) => {
    calls++;
    await route.fulfill({
      status: calls === 2 ? 503 : 200,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  await page.goto("/");
  await expect(page.locator(".leaderboard-row")).toHaveCount(4);
  expect(calls).toBe(1);
  await page.clock.fastForward(30000);
  await expect(page.getByRole("status")).toContainText(
    "temporarily unavailable",
  );
  expect(calls).toBe(2);
  await page.clock.fastForward(30000);
  expect(calls).toBe(2);
  await page.clock.fastForward(30000);
  await expect(page.getByRole("status")).toHaveCount(0);
  expect(calls).toBe(3);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.fastForward(120000);
  expect(calls).toBe(3);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => calls).toBe(4);
});

test("finish layouts reflow at 360/390px, retain disclosures and remove checkout implementation controls", async ({
  page,
}, info) => {
  const fixture = JSON.parse(await readFile(".data/e2e-fixture.json", "utf8"));
  for (const width of [360, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, path] of Object.entries({
      home: "/",
      checkout: "/checkout",
      leaderboard: "/leaderboard",
      order: fixture.orderUrl,
      ticket: fixture.tickets[0].url,
      policy: "/terms",
    })) {
      await page.goto(path as string);
      await expect(page.locator("main")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `${name} at ${width}`,
      ).toBe(true);
      if (name === "home") {
        await expect(page.locator(".agenda-day")).toHaveCount(4);
        await page
          .getByText("Contest awards & points", { exact: true })
          .click();
        await expect(
          page.getByText("Overall hanging winner", { exact: true }),
        ).toBeVisible();
      }
      if (name === "checkout")
        await expect(
          page.getByText("Payment display", { exact: true }),
        ).toHaveCount(0);
      await page.screenshot({
        path: `test-results/finish-${info.project.name}-${name}-${width}.png`,
        animations: "disabled",
      });
    }
  }
  await page.setViewportSize({ width: 640, height: 900 });
  await page.goto("/checkout");
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
