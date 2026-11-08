import type { State } from "./model";

export const monday = "2026-11-16";
export const tuesday = "2026-11-17";
export const socialRules = ["story", "reel", "feed"];
export const retiredAwards = [
  "award:food:2026-11-17",
  "award:food:2026-11-18",
  "award:volleyball:4",
];

// A reel and a feed URL for the same Instagram shortcode identify one post.
export function socialReference(reference: string) {
  try {
    const url = new URL(reference);
    if (["instagram.com", "www.instagram.com"].includes(url.hostname)) {
      const path = url.pathname.split("/").filter(Boolean);
      if (["p", "reel", "reels"].includes(path[0]) && path[1])
        return `instagram:${path[1]}`;
      return `instagram:${path.join("/")}`;
    }
  } catch {
    /* Staff may supply a stable archive/evidence reference. */
  }
  return reference.trim().replace(/\s+/g, " ");
}

export function capRemaining(
  s: State,
  teamId: string | null,
  ruleId: string,
  day: string,
) {
  const rule = s.rules.find((r) => r.id === ruleId);
  if (day !== monday || rule?.mondayCap == null) return null;
  const accepted = s.entries
    .filter(
      (e) =>
        e.food &&
        !e.reversedAt &&
        e.teamId === teamId &&
        e.ruleId === ruleId &&
        e.day === monday,
    )
    .reduce((n, e) => n + e.quantity, 0);
  return Math.max(0, rule.mondayCap - accepted);
}

export function contestTotals(s: State) {
  return s.teams.map((team) => {
    const entries = s.entries.filter(
      (e) => e.teamId === team.id && !e.reversedAt,
    );
    const mondayPackages = entries
      .filter((e) => e.food && e.day === monday)
      .reduce((n, e) => n + e.quantity, 0);
    const mondayPoints = entries
      .filter((e) => e.food && e.day === monday)
      .reduce((n, e) => n + e.points, 0);
    const tuesdayPoints = entries
      .filter((e) => e.day === tuesday && ["pie", "slap"].includes(e.ruleId))
      .reduce((n, e) => n + e.points, 0);
    const tuesdayCents = s.receipts
      .filter(
        (r) =>
          !r.reversedAt &&
          r.teamId === team.id &&
          r.category === "activity" &&
          entries.some(
            (e) =>
              e.id === r.source &&
              e.day === tuesday &&
              ["pie", "slap"].includes(e.ruleId),
          ),
      )
      .reduce((n, r) => n + r.cents, 0);
    const hangMillis = Math.max(
      0,
      ...entries
        .filter((e) => e.ruleId === "hang" && e.day === "2026-11-18")
        .map((e) => e.hangMillis ?? 0),
    );
    return {
      teamId: team.id,
      name: team.displayName,
      mondayPackages,
      mondayPoints,
      tuesdayPoints,
      tuesdayCents,
      hangMillis,
      caps: Object.fromEntries(
        s.rules
          .filter((r) => r.mondayCap != null)
          .map((r) => [r.id, capRemaining(s, team.id, r.id, monday)]),
      ),
    };
  });
}

export function flagDailyAwards(
  s: State,
  entry: { food: boolean; day: string; ruleId: string },
) {
  const contest =
    entry.food && entry.day === monday
      ? `food:${monday}`
      : ["pie", "slap"].includes(entry.ruleId) && entry.day === tuesday
        ? `participation:${tuesday}`
        : entry.ruleId === "hang" && entry.day === "2026-11-18"
          ? "hanging"
          : null;
  if (contest)
    s.awards
      .filter((a) => a.contest === contest)
      .forEach((a) => {
        a.reviewRequired = true;
      });
}
