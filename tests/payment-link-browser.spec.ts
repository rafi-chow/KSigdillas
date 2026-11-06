import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { quietDevelopmentReloads } from "./e2e/isolation";
test.beforeEach(quietDevelopmentReloads);
const stripeLink = "https://buy.stripe.com/6oU4gz7Tugru8GeaOj2kw03";

test("approved hosted checkout shows the current totals and preserves the Meat/Veggie selection", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("$11.58", { exact: true })).toBeVisible();
  await expect(page.getByText("$17.20", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Buy tickets", exact: true }).first(),
  ).toHaveAttribute("href", "/checkout");
  await page.getByRole("link", { name: "Buy this ticket" }).nth(1).click();
  await expect(page).toHaveURL(/\/checkout\?tier=meat$/);
  await expect(page.getByText(/For Meat\/Veggie, add/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Continue to Stripe" }),
  ).toHaveAttribute("href", stripeLink);
  await expect(page.getByText("Online sales are not open yet.")).toHaveCount(0);
  await expect(
    page.getByText(/Sales tax and processing fee included/),
  ).toBeVisible();
});

test("hosted checkout remains accessible, private and within the mobile viewport", async ({
  page,
  request,
}) => {
  await page.goto("/checkout");
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
  const response = await request.get("/checkout");
  expect(response.headers()["cache-control"]).toContain("no-store");
  await expect(
    page.getByRole("link", { name: "Ticket terms", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Privacy", exact: true }),
  ).toBeVisible();
});
