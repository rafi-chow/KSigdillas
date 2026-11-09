import type { State } from "./model";
import { digest } from "./crypto";
import { admissionWindowOpen, attachAdmission } from "./admissions";
import { audit, donationDelta } from "./service";

const labels: Record<string, string> = {
  "award:food:2026-11-16": "Monday supply points winner",
  "award:participation:2026-11-17": "Tuesday pie/slap points winner",
  donation: "Donation · $5 minimum for points",
};
export function scoringPolicyPreview(s: State) {
  const legacyPolicy = (s.settings[0]?.scoringPolicyVersion ?? 0) < 2;
  const snapshot = {
    settings: s.settings,
    entries: s.entries,
    ledger: s.ledger,
    receipts: s.receipts,
    awards: s.awards,
    tickets: s.tickets.map(({ id, checkedInAt, checkedInBy, admissionId }) => ({
      id,
      checkedInAt,
      checkedInBy,
      admissionId,
    })),
    rules: s.rules,
  };
  return {
    fingerprint: digest(JSON.stringify(snapshot)),
    alreadyApplied: s.settings[0]?.scoringPolicyVersion === 3,
    activeDonations: s.receipts.filter(
      (r) => r.category === "donation" && !r.reversedAt,
    ).length,
    affectedAwards: s.awards
      .filter(
        (a) =>
          legacyPolicy &&
          !a.retiredAt &&
          [
            "attendance",
            "food:2026-11-16",
            "participation:2026-11-17",
          ].includes(a.contest),
      )
      .map((a) => a.id),
    rehearsalCheckIns: s.tickets
      .filter(
        (t) =>
          legacyPolicy &&
          t.checkedInAt &&
          !admissionWindowOpen(new Date(t.checkedInAt)),
      )
      .map((t) => t.id),
  };
}
export function applyScoringPolicy(
  s: State,
  fingerprint: string,
  reason: string,
  operator: string,
  now: Date,
) {
  if (s.settings[0]?.scoringPolicyVersion === 3) return;
  const preview = scoringPolicyPreview(s);
  if (preview.fingerprint !== fingerprint || !reason.trim())
    throw new Error(
      "Scoring policy snapshot changed or reason missing; review a fresh dry run.",
    );
  const legacyPolicy = (s.settings[0]?.scoringPolicyVersion ?? 0) < 2;
  for (const r of s.rules)
    if (legacyPolicy && labels[r.id]) {
      r.label = labels[r.id];
      r.revision++;
    }
  for (const receipt of s.receipts.filter((r) => r.category === "donation"))
    receipt.donationPolicy = 3;
  for (const t of s.teams.filter(
    (t) =>
      s.receipts.some((r) => r.teamId === t.id && r.category === "donation") ||
      s.ledger.some((e) => e.teamId === t.id && e.rule === "donation"),
  ))
    donationDelta(s, t.id, `scoring-policy:3:${t.id}`, operator, now);
  for (const ticket of s.tickets.filter(
    (t) => legacyPolicy && t.checkedInAt && !t.admissionId,
  )) {
    const admittedAt = new Date(ticket.checkedInAt!);
    if (!admissionWindowOpen(admittedAt)) {
      ticket.rehearsalAt = ticket.checkedInAt!;
      ticket.checkedInAt = null;
      ticket.checkedInBy = null;
      audit(
        s,
        operator,
        "check-in-reclassified-as-rehearsal",
        ticket.id,
        `Outside event hours: ${ticket.rehearsalAt}. ${reason}`,
        now,
      );
    } else
      attachAdmission(
        s,
        ticket,
        `L-${ticket.id}`,
        ticket.checkedInBy ?? operator,
        admittedAt,
      );
  }
  for (const a of s.awards)
    if (preview.affectedAwards.includes(a.id)) a.reviewRequired = true;
  s.settings[0].scoringPolicyVersion = 3;
  s.settings[0].revision++;
  s.settings[0].updatedAt = now.toISOString();
  audit(s, operator, "scoring-policy-applied", fingerprint, reason, now);
}
