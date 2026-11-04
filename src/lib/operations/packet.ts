import { randomUUID } from "node:crypto";
import { z } from "zod";
import { digest } from "./crypto";
import { defaultRules } from "./rules";
import { retiredAwards } from "./contests";
import { audit, reverseEntry } from "./service";
import type { State } from "./model";

export function packetPreview(s: State) {
  const changes = defaultRules
    .filter((target) => {
      const prior = s.rules.find((r) => r.id === target.id);
      return (
        !prior ||
        [
          "points",
          "mondayPoints",
          "mondayCap",
          "enabled",
          "category",
          "label",
        ].some(
          (key) =>
            prior[key as keyof typeof prior] !==
            target[key as keyof typeof target],
        )
      );
    })
    .map((target) => ({
      id: target.id,
      before: s.rules.find((r) => r.id === target.id),
      after: target,
    }));
  const reverseEntries = s.entries
    .filter(
      (e) =>
        !e.reversedAt &&
        e.policyVersion !== 1 &&
        (e.food || ["story", "reel", "feed"].includes(e.ruleId)),
    )
    .map((e) => e.id)
    .sort();
  const retireAwards = s.awards
    .filter(
      (a) =>
        !a.retiredAt &&
        (retiredAwards.includes(`award:${a.contest}`) ||
          a.contest.startsWith("food:") ||
          a.contest === "volleyball:1") &&
        s.settings[0]?.packetVersion !== 1,
    )
    .map((a) => a.id)
    .sort();
  const snapshot = {
    settings: s.settings,
    rules: [...s.rules].sort((a, b) => a.id.localeCompare(b.id)),
    entries: [...s.entries].sort((a, b) => a.id.localeCompare(b.id)),
    awards: [...s.awards].sort((a, b) => a.id.localeCompare(b.id)),
  };
  return {
    fingerprint: digest(JSON.stringify(snapshot)),
    changes,
    reverseEntries,
    retireAwards,
    manifest: {
      fingerprint: digest(JSON.stringify(snapshot)),
      reason: "",
      reverseEntries,
      retireAwards,
    },
  };
}

export function applyPacket(
  s: State,
  raw: unknown,
  operator: string,
  now: Date,
) {
  const input = z
    .object({
      fingerprint: z.string(),
      reason: z.string().trim().min(1).max(300),
      reverseEntries: z.array(z.string()),
      retireAwards: z.array(z.string()),
    })
    .strict()
    .parse(raw);
  if (
    s.audit.some(
      (a) =>
        a.action === "packet-rules-applied" && a.subject === input.fingerprint,
    )
  )
    return;
  const preview = packetPreview(s);
  if (preview.fingerprint !== input.fingerprint)
    throw new Error(
      "Packet migration snapshot changed; review a fresh dry run.",
    );
  if (
    JSON.stringify([...input.reverseEntries].sort()) !==
      JSON.stringify(preview.reverseEntries) ||
    JSON.stringify([...input.retireAwards].sort()) !==
      JSON.stringify(preview.retireAwards)
  )
    throw new Error(
      "Review every affected entry and award before the packet migration. Keep their source evidence for re-entry under the new rules.",
    );
  for (const id of input.reverseEntries)
    reverseEntry(
      s,
      {
        id,
        requestKey: randomUUID(),
        reason: `Packet reconciliation: ${input.reason}`.slice(0, 300),
      },
      operator,
      now,
    );
  for (const id of input.retireAwards) {
    const a = s.awards.find((a) => a.id === id)!;
    const original = s.ledger.find((e) =>
      e.source.startsWith(`award:${a.contest}:`),
    );
    s.ledger.push({
      id: randomUUID(),
      teamId: a.teamId,
      category: original?.category ?? "bonuses",
      points: -a.points,
      source: `packet-retire:${a.id}`,
      rule: a.contest,
      ruleRevision: a.revision,
      quantity: 1,
      day: now.toISOString().slice(0, 10),
      operator,
      reason: input.reason,
      createdAt: now.toISOString(),
    });
    a.retiredAt = now.toISOString();
    a.reviewRequired = true;
    audit(s, operator, "packet-award-retired", id, input.reason, now);
  }
  for (const target of defaultRules) {
    const r = s.rules.find((r) => r.id === target.id);
    if (r)
      Object.assign(r, structuredClone(target), { revision: r.revision + 1 });
    else s.rules.push(structuredClone(target));
  }
  for (const r of s.rules.filter((r) => retiredAwards.includes(r.id))) {
    r.enabled = false;
    r.revision++;
  }
  s.settings[0].packetVersion = 1;
  s.settings[0].revision++;
  audit(
    s,
    operator,
    "packet-rules-applied",
    input.fingerprint,
    input.reason,
    now,
  );
}
