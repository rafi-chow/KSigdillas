import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { quietDevelopmentReloads } from "./e2e/isolation";
test.beforeEach(quietDevelopmentReloads);
const stripeLink = "https://buy.stripe.com/6oU4gz7Tugru8GeaOj2kw03";

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
