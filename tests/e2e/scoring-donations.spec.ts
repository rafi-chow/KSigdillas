import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { quietDevelopmentReloads, resetLoginCounters } from "./isolation";
import { donationUrl } from "../../src/lib/payments/donationLink";
import {
  donationLinkId,
  donationPriceId,
  reconcileDonation,
} from "../../src/lib/payments/donations";
import { fakeStripe, testEnvironment } from "../integration-fixtures";
import { PgStore } from "../../src/lib/operations/store";
import type Stripe from "stripe";

test.beforeEach(quietDevelopmentReloads);
test.beforeEach(resetLoginCounters);

async function signIn(page: Page, role = "organizer") {
  await page.goto("/admin/leaderboard");
  await page.getByLabel("Staff ID", { exact: true }).fill(role);
  await page
    .getByLabel("Password", { exact: true })
    .fill(`local-preview-${role}-only`);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "KSIGDILLAS STAFF DESK." }),
  ).toBeVisible();
}

test("donation panel and rules stay readable at mobile, tablet and desktop sizes", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  for (const width of [320, 375, 390, 430, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const panel = page.locator("#give");
    await expect(
      panel.getByRole("heading", { name: "Make a donation." }),
    ).toBeVisible();
    await expect(panel).toContainText(
      "10 points per dollar on donations of $5 or more.",
    );
    await expect(panel).not.toContainText("$5 earns 50 points");
    const links = page.getByRole("link", { name: "Donate", exact: true });
    await expect(links).toHaveCount(3);
    for (const link of await links.all()) {
      await expect(link).toHaveAttribute("href", donationUrl);
      const box = await link.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
    await panel.screenshot({
      path: `test-results/donate-${info.project.name}-${width}.png`,
      animations: "disabled",
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText("Collection rules", { exact: true }).click();
  await expect(
    page.getByText("Monday’s winner has the most accepted supply points.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByText("Contest awards & points", { exact: true }).click();
  await expect(
    page.getByText("Thursday: most unique people attending the event.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByText("Activities & contributions", { exact: true }).click();
  await expect(
    page.getByText(/Points are calculated per donation/),
  ).toBeVisible();
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
  });
  await page.locator(".guide-content").screenshot({
    path: `test-results/scoring-guide-${info.project.name}.png`,
    animations: "disabled",
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.locator("#give").screenshot({
    path: `test-results/donate-zoom-${info.project.name}.png`,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("Donate navigates directly to the supplied Stripe link and Back returns to the site", async ({
  page,
}) => {
  await page.goto("/");
  await page.route(donationUrl, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<h1>Stripe donation checkout</h1>",
    }),
  );
  await page
    .locator("#give")
    .getByRole("link", { name: "Donate", exact: true })
    .click();
  await expect(page).toHaveURL(donationUrl);
  await page.goBack();
  await expect(page.locator("#give")).toContainText(
    "Donation only. Does not include admission.",
  );
});

test("staff winners and donation reports label points, attendance and referrals clearly", async ({
  page,
}, info) => {
  await signIn(page);
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  await expect(
    page.getByText("Monday supply points", { exact: true }),
  ).toHaveCount(4);
  await expect(
    page.getByText("Tuesday pie/slap points", { exact: true }),
  ).toHaveCount(4);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator(".contest-cards").screenshot({
      path: `test-results/winners-${info.project.name}-${width}.png`,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Brother contributions", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Online donations", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Find brother", { exact: true })
    .fill("Preview Brother A");
  await page.locator(".ops-responsive-table").screenshot({
    path: `test-results/brother-donations-${info.project.name}.png`,
  });
  await expect(page.locator(".ops-responsive-table")).toContainText(
    "$0.00 · 0 gifts",
  );
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("online donation appears in staff report and chapter correction updates public points", async ({
  page,
}, info) => {
  testEnvironment();
  // This database is fixed to the isolated browser server, never an environment URL.
  const store = new PgStore(
    "postgresql://postgres:isolated-local-preview@127.0.0.1:54387/postgres",
  );
  const fake = fakeStripe();
  const id = `cs_test_visual_${randomUUID()}`;
  fake.sessions.set(id, {
    id,
    livemode: false,
    mode: "payment",
    status: "complete",
    payment_status: "paid",
    payment_link: donationLinkId,
    payment_intent: `pi_${id}`,
    currency: "usd",
    amount_total: 700,
    created: Math.floor(Date.now() / 1000),
    total_details: { amount_discount: 0, amount_shipping: 0, amount_tax: 0 },
    line_items: {
      has_more: false,
      data: [
        {
          quantity: 1,
          currency: "usd",
          amount_total: 700,
          price: { id: donationPriceId, currency: "usd", unit_amount: null },
        },
      ],
    },
    custom_fields: [
      { key: "chapter", type: "dropdown", dropdown: { value: "none" } },
      {
        key: "soldby",
        type: "text",
        text: { value: "Synthetic unknown referral with a long name" },
      },
    ],
  } as unknown as Stripe.Checkout.Session);
  try {
    await reconcileDonation(store, id, fake.gateway);
    await signIn(page);
    await page
      .getByRole("button", { name: "Brother contributions", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Donation status", exact: true })
      .selectOption("review");
    const record = page.locator(".donation-record").filter({ hasText: id });
    await record.locator("summary").click();
    await expect(record).toContainText("Brother referral needs review");
    await page.setViewportSize({ width: 390, height: 844 });
    await record.screenshot({
      path: `test-results/donation-review-${info.project.name}.png`,
    });
    const before = await page.evaluate(
      async () =>
        (await (await fetch("/api/leaderboard")).json()).teams.find(
          (t: { id: string }) => t.id === "dz",
        ).totalPoints,
    );
    await record
      .getByRole("combobox", { name: "Donation chapter", exact: true })
      .selectOption("dz");
    await record
      .getByRole("combobox", { name: "Referring brother", exact: true })
      .selectOption({ label: "Preview Brother A" });
    await record
      .getByLabel("Donation correction reason", { exact: true })
      .fill("Synthetic donor confirmed chapter and referral");
    await record
      .getByRole("button", { name: "Save donation attribution", exact: true })
      .click();
    await expect(
      page.getByText("Saved. Contribution totals reconciled.", { exact: true }),
    ).toBeVisible();
    const after = await page.evaluate(
      async () =>
        (await (await fetch("/api/leaderboard")).json()).teams.find(
          (t: { id: string }) => t.id === "dz",
        ).totalPoints,
    );
    expect(after).toBe(before + 70);
    await page
      .getByRole("combobox", { name: "Donation status", exact: true })
      .selectOption("paid");
    const paid = page.locator(".donation-record").filter({ hasText: id });
    await paid.locator("summary").click();
    await expect(paid).toContainText("$7.00 · DZ · paid");
    await paid.screenshot({
      path: `test-results/donation-paid-${info.project.name}.png`,
    });
    fake.refunds.push({
      id: `re_${id}`,
      charge: `ch_${id}`,
      amount: 700,
      currency: "usd",
      status: "succeeded",
    } as Stripe.Refund);
    await reconcileDonation(store, id, fake.gateway);
    await page
      .getByRole("button", { name: "Scorekeeping", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Brother contributions", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Donation status", exact: true })
      .selectOption("refunded");
    await expect(
      page
        .locator(".donation-record")
        .filter({ hasText: id })
        .locator("summary"),
    ).toContainText("refunded");
  } finally {
    await store.close();
  }
});

test("organizer admission override counts distinct people once; scanner cannot override hours", async ({
  page,
}, info) => {
  test.setTimeout(60000);
  const fixture = JSON.parse(await readFile(".data/e2e-fixture.json", "utf8"));
  await signIn(page);
  const lookup = await page.evaluate(async () =>
    (await fetch("/api/operations/orders?q=Preview")).json(),
  );
  const tickets = lookup.orders.flatMap(
    (o: { tickets: { id: string }[] }) => o.tickets,
  );
  // Undo only this isolated preview fixture's check-ins from the previous browser project.
  for (const ticket of tickets)
    await page.evaluate(
      async (id) =>
        fetch("/api/operations/reverse-check-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            reason: "Reset isolated admission fixture",
          }),
        }),
      ticket.id,
    );
  await page.getByRole("button", { name: "Check-in", exact: true }).click();
  await page.getByLabel("Rehearsal mode", { exact: false }).uncheck();
  await page
    .getByLabel("Wristband / admission ID", { exact: true })
    .fill(`TEST-${randomUUID().slice(0, 8)}`);
  await page
    .getByLabel("Event-hours override reason", { exact: true })
    .fill("Isolated browser admission test");
  await page
    .getByLabel("Ticket link or QR token")
    .fill(new URL(fixture.tickets[0].url, page.url()).href);
  await page.getByRole("button", { name: "Check ticket", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Valid ticket. Admit");
  const id = await page.evaluate(async () => {
    const data = await (await fetch("/api/operations/orders?q=Preview")).json();
    return data.orders
      .flatMap((o: { tickets: { admissionCode?: string }[] }) => o.tickets)
      .find((t: { admissionCode?: string }) => t.admissionCode)?.admissionCode;
  });
  await page.getByLabel("Wristband / admission ID", { exact: true }).fill(id);
  await page
    .getByLabel("Ticket link or QR token")
    .fill(new URL(fixture.tickets[1].url, page.url()).href);
  await page.getByRole("button", { name: "Check ticket", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("already admitted");
  const desk = await page.evaluate(async () =>
    (await fetch("/api/operations/desk")).json(),
  );
  expect(desk.attendance).toBe(1);
  await page.screenshot({
    path: `test-results/admission-duplicate-${info.project.name}.png`,
    fullPage: true,
  });
  for (const ticket of tickets)
    await page.evaluate(
      async (id) =>
        fetch("/api/operations/reverse-check-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            reason: "Finished isolated admission test",
          }),
        }),
      ticket.id,
    );
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await signIn(page, "scanner");
  const forbidden = await page.evaluate(
    async () =>
      (
        await fetch("/api/operations/lookup-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: "irrelevant",
            admissionCode: "W999",
            overrideReason: "forged override",
          }),
        })
      ).status,
  );
  expect(forbidden).toBe(403);
});
