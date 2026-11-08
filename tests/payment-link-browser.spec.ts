import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { quietDevelopmentReloads } from "./e2e/isolation";
import { donationUrl } from "../src/lib/payments/donationLink";
test.beforeEach(quietDevelopmentReloads);
const stripeLink = "https://buy.stripe.com/6oU4gz7Tugru8GeaOj2kw03";

test("hero keeps ticket and event buttons prominent with a separate Donate link", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const hero = page.locator(".hero-copy");
  const actions = hero.locator(".hero-actions");
  const donate = hero.getByRole("link", { name: "Donate", exact: true });
  await expect(actions.getByRole("link")).toHaveCount(2);
  await expect(
    actions.getByRole("link", { name: "Buy tickets", exact: true }),
  ).toHaveAttribute("href", stripeLink);
  const week = actions.getByRole("link", {
    name: "See the week’s events",
    exact: true,
  });
  await expect(week).toHaveAttribute("href", "#schedule");
  await expect(donate).toHaveAttribute("href", donationUrl);
  for (const width of [320, 375, 390, 430, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const buttons = await actions.boundingBox();
    const link = await donate.boundingBox();
    expect(link!.y).toBeGreaterThanOrEqual(buttons!.y + buttons!.height);
    expect(link!.height).toBeGreaterThanOrEqual(44);
    expect(link!.width).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page
      .locator(".hero")
      .screenshot({
        path: `test-results/hero-donate-${info.project.name}-${width}.png`,
        animations: "disabled",
      });
  }
  await donate.focus();
  await expect(donate).toBeFocused();
  expect(
    await donate.evaluate((link) => getComputedStyle(link).outlineStyle),
  ).toBe("solid");
  await page.route(donationUrl, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<h1>Stripe donation checkout</h1>",
    }),
  );
  await donate.click();
  await expect(page).toHaveURL(donationUrl);
  await page.goBack();
  await page
    .locator(".hero-actions")
    .getByRole("link", { name: "See the week’s events", exact: true })
    .click();
  await expect(page).toHaveURL(/#schedule$/);
  await expect(
    page.getByRole("heading", { name: "This week.", exact: true }),
  ).toBeInViewport();
});

test("all purchase buttons open the approved Stripe checkout directly", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("$11.58", { exact: true })).toBeVisible();
  await expect(page.getByText("$17.20", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Buy tickets", exact: true }).first(),
  ).toHaveAttribute("href", stripeLink);
  const tierLinks = page.getByRole("link", { name: "Buy this ticket" });
  await expect(tierLinks).toHaveCount(2);
  for (const link of await tierLinks.all()) {
    await expect(link).toHaveAttribute("href", stripeLink);
  }
  await page.route(stripeLink, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<h1>Stripe checkout</h1>",
    }),
  );
  await page.getByRole("link", { name: "Buy this ticket" }).nth(1).click();
  await expect(page).toHaveURL(stripeLink);
});

test("homepage remains accessible and old checkout URLs redirect without caching", async ({
  page,
  request,
}) => {
  await page.goto("/");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  for (const path of ["/checkout", "/checkout?tier=meat"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe(stripeLink);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
  await expect(
    page.getByRole("link", { name: "Ticket terms", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Privacy", exact: true }),
  ).toBeVisible();
});
