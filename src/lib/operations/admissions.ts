import { randomUUID } from "node:crypto";
import type { EventTicket, State } from "./model";
import { saleStart, saleEnd } from "./rules";

export const admissionWindowOpen = (now: Date) =>
  now.getTime() >= saleStart && now.getTime() <= saleEnd;

export function admissionCode(raw: string) {
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{1,39}$/.test(code))
    throw new Error(
      "Use a wristband or admission ID of 2–40 letters, numbers or hyphens.",
    );
  return code;
}

export function activeAdmissions(s: State) {
  return s.admissions.filter((a) =>
    s.tickets.some(
      (t) => t.admissionId === a.id && t.valid && !t.refunded && t.checkedInAt,
    ),
  );
}

export function attachAdmission(
  s: State,
  ticket: EventTicket,
  code: string,
  operator: string,
  now: Date,
  overrideReason?: string,
) {
  const normalized = admissionCode(code);
  let admission = s.admissions.find((a) => a.code === normalized);
  const alreadyAdmitted =
    admission && activeAdmissions(s).some((a) => a.id === admission!.id);
  if (!admission) {
    admission = {
      id: randomUUID(),
      code: normalized,
      teamId: ticket.teamId,
      checkedInAt: now.toISOString(),
      operator,
      overrideReason,
    };
    s.admissions.push(admission);
  } else if (!alreadyAdmitted) {
    admission.checkedInAt = now.toISOString();
    admission.operator = operator;
    admission.teamId = ticket.teamId;
    admission.overrideReason = overrideReason;
  }
  ticket.admissionId = admission.id;
  ticket.checkedInAt = admission.checkedInAt;
  ticket.checkedInBy = operator;
  return { admission, alreadyAdmitted: Boolean(alreadyAdmitted) };
}
