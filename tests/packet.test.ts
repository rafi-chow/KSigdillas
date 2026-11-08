import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { initialState } from "../src/lib/operations/rules";
import { emptyState } from "../src/lib/operations/model";
import {
  addEntry,
  addDonation,
  award,
  reverseEntry,
  standings,
  editRule,
} from "../src/lib/operations/service";
import { capRemaining, contestTotals } from "../src/lib/operations/contests";
import { applyPacket, packetPreview } from "../src/lib/operations/packet";
import { saveBrother, brotherReport } from "../src/lib/operations/brothers";
import { testEnvironment } from "./integration-fixtures";
import { donationProducts } from "../src/lib/eventConfig";
before(testEnvironment);
const monday = new Date("2026-11-16T12:00:00-06:00");
const end = new Date("2026-11-19T21:00:00-06:00");
const state = () => initialState(emptyState());
function input(
  ruleId: string,
  quantity = 1,
  teamId: string | null = "axo",
  day = "2026-11-16",
) {
  return {
    requestKey: randomUUID(),
    ruleId,
    quantity,
    teamId,
    day,
    reference: randomUUID(),
    paymentVerified: true,
  };
}
const result = (contest: string, teamId = "axo") => ({
  requestKey: randomUUID(),
  contest,
  teamId,
  reason: "Verified official result",
  evidence: "Official result sheet: verified placement/time",
  boxesVerified: true,
});

test("packet supplies including specified steak give 850 Monday / 445 ordinary; no invented money", () => {
  for (const [day, expected] of [
    ["2026-11-16", 850],
    ["2026-11-17", 445],
  ] as const) {
    const s = state();
    for (const id of [
      "cheese",
      "tortillas",
      "vegetables",
      "chicken",
      "steak",
      "soda",
      "water",
    ])
      addEntry(s, input(id, 1, "axo", day), "test", monday);
    assert.equal(standings(s).teams[0].donationPoints, expected);
    assert.equal(standings(s).fundsRaisedCents, 0);
  }
});

test("specified steak bags count once, earn the correct daily rate and reverse without invented cash", () => {
  const product = donationProducts.find((product) => product.id === "steak")!;
  assert.equal(product.enabled, true);
  assert.equal(product.url, "https://www.walmart.com/ip/5195803576");
  assert.match(product.unit, /Fire Roasted Vegetables · 18 oz bag/);
  const s = state();
  const bags = input("steak", 2);
  const id = addEntry(s, bags, "test", monday);
  addEntry(s, bags, "test", monday);
  assert.equal(standings(s).teams[0].donationPoints, 350);
  assert.equal(contestTotals(s)[0].mondayPackages, 2);
  assert.equal(capRemaining(s, "axo", "steak", "2026-11-16"), null);
  addEntry(s, input("steak", 1, "axo", "2026-11-18"), "test", monday);
  assert.equal(standings(s).teams[0].donationPoints, 450);
  assert.equal(standings(s).fundsRaisedCents, 0);
  reverseEntry(
    s,
    {
      requestKey: randomUUID(),
      id,
      reason: "Returned two verified steak packages",
    },
    "test",
    monday,
  );
  assert.equal(standings(s).teams[0].donationPoints, 100);
  assert.equal(contestTotals(s)[0].mondayPackages, 0);
});

test("caps refuse excess atomically; no box/donor credit; reversal restores allowance once", () => {
  const s = state();
  const brother = saveBrother(
    s,
    {
      name: "Synthetic donor",
      aliases: [],
      revision: 0,
      active: true,
      reason: "Test",
    },
    "test",
    monday,
  );
  const first = addEntry(
    s,
    { ...input("cheese", 9), donorBrotherId: brother.id },
    "test",
    monday,
  );
  assert.throws(
    () =>
      addEntry(
        s,
        { ...input("cheese", 3), donorBrotherId: brother.id },
        "test",
        monday,
      ),
    /only 1/,
  );
  assert.equal(s.entries.length, 1);
  const last = input("cheese", 1);
  addEntry(s, last, "test", monday);
  addEntry(s, last, "test", monday);
  assert.equal(contestTotals(s)[0].mondayPackages, 10);
  assert.equal(standings(s).teams[0].donationPoints, 750);
  assert.equal(brotherReport(s).rows[0].goods["cheese:2026-11-16"].quantity, 9);
  assert.throws(() => addEntry(s, input("cheese"), "test", monday), /only 0/);
  const reversal = {
    requestKey: randomUUID(),
    id: first,
    reason: "Returned nine accepted bags",
  };
  reverseEntry(s, reversal, "test", monday);
  reverseEntry(s, reversal, "test", monday);
  assert.equal(capRemaining(s, "axo", "cheese", "2026-11-16"), 9);
  assert.equal(contestTotals(s)[0].mondayPackages, 1);
  assert.equal(standings(s).teams[0].donationPoints, 75);
  assert.equal(brotherReport(s).rows[0].goods["cheese:2026-11-16"], undefined);
});

test("all capped categories, independent chapters and uncapped ordinary days", () => {
  for (const [id, cap] of [
    ["cheese", 10],
    ["tortillas", 10],
    ["soda", 6],
    ["water", 4],
  ] as const) {
    const s = state();
    addEntry(s, input(id, cap), "test", monday);
    assert.throws(() => addEntry(s, input(id), "test", monday), /cap reached/);
    addEntry(s, input(id, cap, "dz"), "test", monday);
    addEntry(s, input(id, cap + 1, "axo", "2026-11-17"), "test", monday);
    assert.equal(capRemaining(s, "axo", id, "2026-11-16"), 0);
    assert.equal(capRemaining(s, "axo", id, "2026-11-17"), null);
  }
});

test("Monday winner uses accepted supply points even with fewer packages", () => {
  const s = state();
  addEntry(s, input("cheese", 4), "test", monday);
  addEntry(s, input("chicken", 3, "dz"), "test", monday);
  assert.deepEqual(
    contestTotals(s)
      .slice(0, 2)
      .map((t) => [t.mondayPackages, t.mondayPoints]),
    [
      [4, 300],
      [3, 525],
    ],
  );
  assert.throws(
    () => award(s, result("food:2026-11-16", "dz"), "test", monday),
    /cutoff/,
  );
  assert.throws(
    () =>
      award(
        s,
        { ...result("food:2026-11-16", "dz"), boxesVerified: false },
        "test",
        end,
      ),
    /physical/,
  );
  assert.throws(
    () => award(s, result("food:2026-11-16"), "test", end),
    /supply points/,
  );
  award(s, result("food:2026-11-16", "dz"), "test", end);
  award(s, result("food:2026-11-16", "dz"), "test", end);
  assert.equal(standings(s).teams.find((t) => t.id === "dz")!.bonusPoints, 500);
});

test("Tuesday uses pie/slap points rather than dollars and excludes other days and donations", () => {
  const s = state();
  const pies = addEntry(
    s,
    input("pie", 3, "axo", "2026-11-17"),
    "test",
    monday,
  );
  addEntry(s, input("slap", 4, "dz", "2026-11-17"), "test", monday);
  addDonation(
    s,
    {
      requestKey: randomUUID(),
      teamId: "dz",
      cents: 10000,
      reference: "Excluded gift",
    },
    "test",
    monday,
  );
  addEntry(s, input("pie", 10, "dz", "2026-11-16"), "test", monday);
  addEntry(s, input("pie", 10, null, "2026-11-17"), "test", monday);
  assert.deepEqual(
    contestTotals(s)
      .slice(0, 2)
      .map((t) => [t.tuesdayCents, t.tuesdayPoints]),
    [
      [600, 45],
      [800, 40],
    ],
  );
  assert.throws(
    () => award(s, result("participation:2026-11-17", "dz"), "test", end),
    /pie\/slap points/,
  );
  award(s, result("participation:2026-11-17"), "test", end);
  reverseEntry(
    s,
    { requestKey: randomUUID(), id: pies, reason: "Reverse pies" },
    "test",
    end,
  );
  assert.equal(s.awards[0].reviewRequired, true);
  award(s, result("participation:2026-11-17", "dz"), "test", end);
  assert.equal(standings(s).teams.find((t) => t.id === "dz")!.bonusPoints, 300);
  assert.equal(standings(s).teams.find((t) => t.id === "axo")!.bonusPoints, 0);
});

test("equal Tuesday points with unequal revenue remains a staff-resolved tie", () => {
  const s = state();
  addEntry(s, input("pie", 2, "axo", "2026-11-17"), "test", monday);
  addEntry(s, input("slap", 1, "axo", "2026-11-17"), "test", monday);
  addEntry(s, input("slap", 4, "dz", "2026-11-17"), "test", monday);
  assert.deepEqual(
    contestTotals(s)
      .slice(0, 2)
      .map((t) => t.tuesdayPoints),
    [40, 40],
  );
  award(s, result("participation:2026-11-17"), "test", end);
  assert.equal(s.awards[0].teamId, "axo");
});

test("social requires both tags, scores 25/50/50 and deduplicates feed/reel URLs", () => {
  const s = state();
  assert.throws(
    () => addEntry(s, input("story"), "test", monday),
    /Verify both/,
  );
  for (const [ruleId, reference] of [
    ["story", "archived-story-1"],
    ["reel", "https://www.instagram.com/reel/ABC/?igsh=x"],
    ["feed", "https://instagram.com/p/DEF/"],
  ])
    addEntry(
      s,
      { ...input(ruleId), reference, tagsVerified: true },
      "test",
      monday,
    );
  assert.equal(standings(s).teams[0].volleyballPoints, 125);
  assert.throws(
    () =>
      addEntry(
        s,
        {
          ...input("feed", 1, "dz"),
          reference: "https://instagram.com/p/ABC/",
          tagsVerified: true,
        },
        "test",
        monday,
      ),
    /already/,
  );
  assert.throws(
    () =>
      addEntry(s, { ...input("feed", 2), tagsVerified: true }, "test", monday),
    /one verified/,
  );
});

test("timed hanging and eating/volleyball awards retain official evidence and distinct totals", () => {
  const s = state();
  addEntry(
    s,
    {
      ...input("hang", 1, "axo", "2026-11-18"),
      participant: "A",
      hangMillis: 90000,
    },
    "test",
    monday,
  );
  addEntry(
    s,
    {
      ...input("hang", 1, "dz", "2026-11-18"),
      participant: "B",
      hangMillis: 80000,
    },
    "test",
    monday,
  );
  assert.throws(
    () => award(s, result("hanging", "dz"), "test", end),
    /hang time/,
  );
  award(s, result("hanging"), "test", end);
  for (const contest of ["volleyball", "eating"]) {
    for (const [place, team] of [
      [1, "axo"],
      [2, "dz"],
      [3, "zta"],
    ] as const)
      award(s, result(`${contest}:${place}`, team), "test", end);
    assert.throws(
      () => award(s, result(`${contest}:2`), "test", end),
      /already has a placement/,
    );
  }
  assert.equal(
    standings(s).teams.find((t) => t.id === "axo")!.eatingCompetitionPoints,
    400,
  );
  assert.equal(
    s.awards.reduce((n, a) => n + a.points, 0),
    1700,
  );
  assert.ok(s.awards.every((a) => a.evidence));
});

test("packet migration is reviewed, stale-safe, repeatable and preserves original ledger", () => {
  const s = state();
  addEntry(s, input("cheese", 2), "test", monday);
  s.entries[0].policyVersion = undefined;
  s.settings[0].packetVersion = undefined;
  s.rules.find((r) => r.id === "cheese")!.mondayPoints = 70;
  const priorLedger = structuredClone(s.ledger);
  const report = packetPreview(s);
  assert.throws(
    () => addEntry(s, input("cheese"), "test", monday),
    /migration is required/,
  );
  assert.throws(
    () =>
      applyPacket(
        s,
        { ...report.manifest, reason: "Review", reverseEntries: [] },
        "test",
        monday,
      ),
    /Review every/,
  );
  assert.throws(
    () =>
      applyPacket(
        s,
        { ...report.manifest, reason: "Review", fingerprint: "stale" },
        "test",
        monday,
      ),
    /snapshot changed/,
  );
  const manifest = {
    ...report.manifest,
    reason:
      "Reviewed old supply entry; re-enter accepted packages after migration",
  };
  applyPacket(s, manifest, "test", monday);
  applyPacket(s, manifest, "test", monday);
  assert.equal(s.settings[0].packetVersion, 1);
  assert.deepEqual(s.ledger[0], priorLedger[0]);
  assert.equal(standings(s).teams[0].totalPoints, 0);
  assert.equal(s.entries[0].reversedAt, monday.toISOString());
  addEntry(s, input("cheese", 2), "test", monday);
  assert.equal(standings(s).teams[0].donationPoints, 150);
  s.rules.push({
    ...s.rules.find((r) => r.id === "award:food:2026-11-16")!,
    id: "award:food:2026-11-17",
    enabled: false,
  });
  assert.throws(
    () =>
      editRule(
        s,
        {
          id: "award:food:2026-11-17",
          revision: s.rules.at(-1)!.revision,
          points: 300,
          enabled: true,
          reason: "Try old bonus",
        },
        "test",
        monday,
      ),
    /retired/,
  );
});

test("migration retires old awards once; an official new placement does not reverse the old award twice", () => {
  const s = state();
  s.rules.find((r) => r.id === "award:volleyball:1")!.points = 300;
  award(s, result("volleyball:1"), "test", end);
  s.settings[0].packetVersion = undefined;
  const original = structuredClone(s.ledger[0]);
  const manifest = {
    ...packetPreview(s).manifest,
    reason: "Reviewed old 300-point championship result",
  };
  assert.equal(manifest.retireAwards.length, 1);
  applyPacket(s, manifest, "test", end);
  applyPacket(s, manifest, "test", end);
  assert.equal(standings(s).teams[0].totalPoints, 0);
  assert.deepEqual(s.ledger[0], original);
  award(s, result("volleyball:1"), "test", end);
  assert.equal(standings(s).teams[0].totalPoints, 400);
  assert.equal(s.awards[0].retiredAt, undefined);
  assert.equal(s.ledger.length, 3);
});
