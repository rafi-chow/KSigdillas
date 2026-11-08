import { resetLoginCounters, quietDevelopmentReloads } from "./isolation";
import { randomUUID } from "node:crypto";
import QRCode from "qrcode";
import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
test.beforeEach(quietDevelopmentReloads);
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
test.beforeEach(resetLoginCounters);

test("public site has approved schedule, two tiers, product units and responsive layout", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Basicdilla", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Meat/Veggie Pass", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Basketball", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("9 AM–3 PM", { exact: true })).toHaveCount(3);
  await expect(page.getByText("11 AM–3 PM", { exact: true })).toHaveCount(2);
  await expect(
    page.getByText(
      "Great Value Steak Fajitas with Fire Roasted Vegetables · 18 oz bag",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("Thursday, November 19, 2026", { exact: false }).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/home-${test.info().project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
});
test("ticket page and QR render; pending Stripe fails closed without taking buyer data", async ({
  page,
  request,
}) => {
  const fixture = JSON.parse(
    await readFile(resolve(".data/e2e-fixture.json"), "utf8"),
  );
  await page.goto(fixture.tickets[0].url);
  await expect(
    page.getByRole("img", {
      name: `Admission QR for ${fixture.tickets[0].name}`,
    }),
  ).toBeVisible();
  expect(
    (await request.get(fixture.tickets[0].url)).headers()["referrer-policy"],
  ).toBe("no-referrer");
  await page.goto("/checkout");
  await expect(page.getByRole("status").first()).toContainText(
    "Online sales are not open yet.",
  );
  const response = await request.post("/api/checkout", {
    data: { fake: "paid" },
  });
  expect(response.status()).toBe(503);
});
test("staff score entry appears in public totals; rule edit is prospective", async ({
  page,
}) => {
  await signIn(page);
  const before = await page.evaluate(async () =>
    (await fetch("/api/leaderboard")).json(),
  );
  await page.getByLabel("Item or activity").selectOption("hang");
  await page.getByLabel("Quantity", { exact: true }).fill("3");
  const note = `Browser verified hang ${test.info().project.name} ${randomUUID()}`;
  await page
    .getByLabel("Receipt / post reference or verification note")
    .fill(note);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Saved.");
  await expect(page.getByText(note, { exact: true })).toBeVisible();
  const after = await page.evaluate(async () =>
    (await fetch("/api/leaderboard")).json(),
  );
  expect(
    after.teams.find((t: { id: string }) => t.id === "axo").totalPoints,
  ).toBe(
    before.teams.find((t: { id: string }) => t.id === "axo").totalPoints + 30,
  );
  expect(after.fundsRaisedCents).toBe(before.fundsRaisedCents);

  await page
    .getByRole("button", { name: "Rules & access", exact: true })
    .click();
  const form = page.locator("form").filter({
    has: page.getByRole("heading", { name: /Hanging attempt · revision/ }),
  });
  await form.getByLabel("Ordinary points").fill("10");
  await form.getByLabel("Change reason").fill("Verified default remains 10");
  await form.getByRole("button", { name: "Save rule", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Rule updated.");
});
test("scanner rehearsal verifies QR repeatedly without consuming ticket or adding attendance", async ({
  page,
}) => {
  await signIn(page, "scanner");
  await page
    .getByRole("button", { name: "Orders & door sales", exact: true })
    .click();
  await page
    .getByLabel("Guest name, order reference", { exact: true })
    .fill("Preview Alex");
  await page
    .getByRole("button", { name: "Search orders", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /^Order / }).first(),
  ).toBeVisible();
  const fixture = JSON.parse(
    await readFile(resolve(".data/e2e-fixture.json"), "utf8"),
  );
  await page.getByRole("button", { name: "Check-in", exact: true }).click();
  await page
    .getByLabel("Ticket link or QR token")
    .fill(new URL(fixture.tickets[0].url, page.url()).href);
  await page.getByRole("button", { name: "Check ticket", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(/Rehearsal: valid QR/);
  await page.getByRole("button", { name: "Check ticket", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("no attendance counted");
  await expect(
    page.getByRole("button", { name: "Rules & access", exact: true }),
  ).toHaveCount(0);
});
test("security: private API, forged mutation, scorer authorization, logout and camera fallback", async ({
  page,
  request,
}) => {
  expect((await request.get("/api/operations/desk")).status()).toBe(401);
  expect(
    (
      await request.post("/api/operations/entry", {
        headers: { origin: "https://foreign.example" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  await signIn(page, "scorer");
  await expect(
    page.getByRole("button", { name: "Rules & access", exact: true }),
  ).toHaveCount(0);
  const forbidden = await page.evaluate(
    async () =>
      (
        await fetch("/api/operations/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            revision: 1,
            offlineSalesEnabled: true,
            reason: "forged",
          }),
        })
      ).status,
  );
  expect(forbidden).toBe(403);
  await page.getByRole("button", { name: "Check-in", exact: true }).click();
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Camera access is unavailable",
  );
  await expect(page.getByLabel("Ticket link or QR token")).toBeVisible();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
});

test("QR image decoder reads a generated ticket image safely in rehearsal", async ({
  page,
}) => {
  const fixture = JSON.parse(
    await readFile(resolve(".data/e2e-fixture.json"), "utf8"),
  );
  await signIn(page, "scanner");
  await page.getByRole("button", { name: "Check-in", exact: true }).click();
  const buffer = await QRCode.toBuffer(
    new URL(fixture.tickets[1].url, page.url()).href,
    { width: 360, margin: 3 },
  );
  await page.getByLabel("Read a ticket QR image").setInputFiles({
    name: "synthetic-ticket.png",
    mimeType: "image/png",
    buffer,
  });
  await expect(page.getByRole("status")).toContainText(/Rehearsal: valid QR/);
  await page.getByLabel("Read a ticket QR image").setInputFiles({
    name: "synthetic-ticket.png",
    mimeType: "image/png",
    buffer,
  });
  await expect(page.getByRole("status")).toContainText("no attendance counted");
});

test("brother roster, seller correction, personal donation and private CSV reconcile in the staff UI", async ({
  page,
}) => {
  await signIn(page);
  await page
    .getByRole("button", { name: "Brother contributions", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "BROTHER CONTRIBUTIONS", exact: true }),
  ).toBeVisible();
  const name = `Synthetic Brother ${test.info().project.name} ${randomUUID().slice(0, 8)}`;
  const form = page.locator("form").filter({
    has: page.getByRole("button", { name: "Add brother", exact: true }),
  });
  await form.getByLabel("Brother name", { exact: true }).fill(name);
  await form
    .getByLabel("Roster reason", { exact: true })
    .fill("Browser synthetic roster");
  await form.getByRole("button", { name: "Add brother", exact: true }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Contribution totals reconciled" }),
  ).toBeVisible();
  const data = await page.evaluate(async () => {
    const response = await fetch("/api/operations/brothers");
    return response.json();
  });
  const brother = data.roster.find((b: { name: string }) => b.name === name);
  const order = data.orders[0];
  const details = page.locator("details").filter({
    has: page
      .locator("summary")
      .filter({ hasText: `Order ${order.id.slice(0, 8)}` }),
  });
  await details.locator("summary").click();
  await details
    .getByRole("combobox", { name: "Ticket seller", exact: true })
    .selectOption(brother.id);
  await details
    .getByLabel("Attribution correction reason")
    .fill("Buyer confirmed seller");
  await details
    .getByRole("button", { name: "Correct seller", exact: true })
    .click();
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row.getByRole("cell").nth(1)).toHaveText("2");
  await expect(row.getByRole("cell").nth(2)).toHaveText("$25.00");
  await expect(row.getByRole("cell").nth(3)).toHaveText("$0.00");
  await page.getByRole("button", { name: "Scorekeeping", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Money donated by", exact: true })
    .selectOption(brother.id);
  await page
    .getByLabel("Verified amount received ($)", { exact: true })
    .fill("10");
  await page
    .getByLabel("Receipt reference", { exact: true })
    .fill(`Gift ${randomUUID()}`);
  await page
    .getByRole("button", { name: "Record verified donation", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Saved.");
  await page
    .getByRole("button", { name: "Brother contributions", exact: true })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: name }).getByRole("cell").nth(3),
  ).toHaveText("$10.00");
  const csv = await page.evaluate(async () => {
    const response = await fetch("/api/operations/brothers.csv");
    return { status: response.status, text: await response.text() };
  });
  expect(csv.status).toBe(200);
  expect(csv.text).toContain(name);
  const publicJson = await page.evaluate(async () =>
    JSON.stringify(await (await fetch("/api/leaderboard")).json()),
  );
  expect(publicJson).not.toContain(name);
});

test("brother reports and roster mutations deny scanner and scorer access; requested tier is preselected", async ({
  page,
}) => {
  await page.goto("/checkout?tier=meat");
  await expect(
    page.getByRole("combobox", { name: "Wristband", exact: true }),
  ).toHaveValue("meat");
  await signIn(page, "scorer");
  const denied = await page.evaluate(async () => ({
    read: (await fetch("/api/operations/brothers")).status,
    write: (
      await fetch("/api/operations/brother", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Unauthorized" }),
      })
    ).status,
  }));
  expect(denied).toEqual({ read: 403, write: 403 });
  await expect(
    page.getByRole("button", { name: "Brother contributions", exact: true }),
  ).toHaveCount(0);
});

test("packet public guide shows exact Monday points, caps, social tags and both contests", async ({
  page,
}) => {
  await page.goto("/");
  const cheese = page.locator('[data-product="cheese"] .supply-points');
  const water = page.locator('[data-product="water"] .supply-points');
  await expect(cheese).toContainText("75 pts");
  await expect(cheese).toContainText("Cap 10 / chapter");
  await expect(water).toContainText("75 pts");
  await expect(water).toContainText("Cap 4 / chapter");
  await page.getByRole("radio", { name: "Tue / Wed", exact: true }).check();
  await expect(cheese).toContainText("35 pts");
  await expect(water).toContainText("50 pts");
  await expect(
    page.getByText(/Excess supplies cannot be accepted/),
  ).toBeVisible();
  await page.getByText("Contest awards & points", { exact: true }).click();
  await expect(
    page
      .getByText("Tuesday pie/slap points winner", { exact: true })
      .locator(".."),
  ).toContainText("300 points");
  await expect(
    page.getByText(/Direct donations and ticket sales do not count/),
  ).toBeVisible();
  await page.getByText("Activities & contributions", { exact: true }).click();
  await expect(
    page.getByText(/Instagram posts must tag @kappasigmauta and @movember.usa/),
  ).toBeVisible();
  await expect(
    page
      .getByRole("heading", { name: "Eating challenge", exact: true })
      .first(),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Monday food winner|Tuesday food winner|Wednesday food winner/,
    ),
  ).toHaveCount(0);
});

test("staff can record the approved 18 oz steak package and manage its enabled rule", async ({
  page,
}) => {
  await signIn(page);
  const before = await page.evaluate(async () =>
    (await fetch("/api/leaderboard")).json(),
  );
  await page.getByLabel("Item or activity").selectOption("steak");
  await expect(
    page.getByText(
      "Accepted package: Great Value Steak Fajitas with Fire Roasted Vegetables · 18 oz bag",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Event day", exact: true })
    .selectOption("2026-11-16");
  await page.getByLabel("Quantity", { exact: true }).fill("1");
  const reference = `Verified 18 oz steak package ${randomUUID()}`;
  await page
    .getByLabel("Receipt / post reference or verification note")
    .fill(reference);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Saved.");
  await expect(page.getByText(reference, { exact: true })).toBeVisible();
  const after = await page.evaluate(async () =>
    (await fetch("/api/leaderboard")).json(),
  );
  const points = (data: { teams: { donationPoints: number }[] }) =>
    data.teams.reduce((sum, team) => sum + team.donationPoints, 0);
  expect(points(after)).toBe(points(before) + 175);
  await page
    .getByRole("button", { name: "Rules & access", exact: true })
    .click();
  const form = page.locator("form").filter({
    has: page.getByRole("heading", {
      name: /^Frozen fajita steak · revision /,
    }),
  });
  await expect(
    form.getByRole("checkbox", { name: "Enabled", exact: true }),
  ).toBeEnabled();
  await expect(
    form.getByRole("checkbox", { name: "Enabled", exact: true }),
  ).toBeChecked();
});

test("staff rejects excess supplies, shows box totals and verifies social tags without exposing representatives", async ({
  page,
}) => {
  await signIn(page);
  const chapter = test.info().project.name === "chromium" ? "zta" : "ddd";
  const form = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "FOOD / ACTIVITY / SOCIAL",
      exact: true,
    }),
  });
  await form
    .getByRole("combobox", { name: "Team", exact: true })
    .selectOption(chapter);
  await form.getByLabel("Item or activity").selectOption("water");
  await form.getByLabel("Quantity", { exact: true }).fill("3");
  await form
    .getByLabel("Receipt / post reference or verification note")
    .fill(`Accepted water ${randomUUID()}`);
  await form.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Saved.");
  await expect(page.getByRole("note")).toContainText("1 of 4");
  await form.getByLabel("Quantity", { exact: true }).fill("2");
  await form
    .getByLabel("Receipt / post reference or verification note")
    .fill(`Refuse excess ${randomUUID()}`);
  await form.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("only 1");
  await expect(page.getByRole("note")).toContainText("1 of 4");
  await form.getByLabel("Quantity", { exact: true }).fill("1");
  await form.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Saved.");
  const daily = page.locator("section").filter({
    has: page.getByRole("heading", { name: "DAILY WINNER TOTALS" }),
  });
  await expect(
    daily
      .locator(".contest-card")
      .filter({
        has: page.getByRole("heading", {
          name: chapter.toUpperCase(),
          exact: true,
        }),
      })
      .locator("dd")
      .nth(1),
  ).toHaveText("4");
  await form.getByLabel("Item or activity").selectOption("feed");
  await expect(form.getByLabel(/I verified @kappasigmauta/)).toBeVisible();
  await form.getByLabel(/I verified @kappasigmauta/).check();
  await form
    .getByLabel("Receipt / post reference or verification note")
    .fill(`https://instagram.com/p/${randomUUID()}/`);
  await form.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Saved.");
  await page
    .getByRole("button", { name: "Rules & access", exact: true })
    .click();
  const rep = page.locator("form").filter({
    has: page.getByRole("heading", {
      name: chapter.toUpperCase(),
      exact: true,
    }),
  });
  await rep
    .getByLabel("Representative / contender name")
    .fill("Synthetic private contender");
  await rep
    .getByLabel("Private contact")
    .fill("private-contender@example.test");
  await rep.getByLabel("Change reason").fill("Verified synthetic contact");
  await rep
    .getByRole("button", { name: "Save representative", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Representative saved.");
  const publicData = await page.evaluate(async () =>
    JSON.stringify(await (await fetch("/api/leaderboard")).json()),
  );
  expect(publicData).not.toContain("private-contender@example.test");
  await page.screenshot({
    path: `test-results/packet-desk-${test.info().project.name}.png`,
    fullPage: true,
  });
});
