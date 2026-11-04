import { purchaseTerms, retentionPolicy } from "./policies";
export type LaunchCheck = { id: string; label: string; ready: boolean };
export function launchChecks(
  env: Record<string, string | undefined> = process.env,
): LaunchCheck[] {
  return [
    {
      id: "organizer",
      label:
        "Organizer, nonrefund policy and awareness-only beneficiary wording",
      ready: env.EVENT_ORGANIZER_APPROVED === purchaseTerms.version,
    },
    {
      id: "event",
      label:
        "Applicable campus, food, venue and activity requirements reviewed",
      ready: Boolean(env.EVENT_APPROVAL_REFERENCE?.trim()),
    },
    {
      id: "hosting",
      label: "Hosting plan permits paid event admission",
      ready: Boolean(env.HOSTING_APPROVAL_REFERENCE?.trim()),
    },
    {
      id: "tax",
      label: "Documented tax treatment supported by checkout",
      ready:
        Boolean(env.EVENT_TAX_REFERENCE?.trim()) &&
        env.EVENT_TAX_TREATMENT === "exempt",
    },
    {
      id: "retention",
      label: "Retention schedule and financial/dispute holds reviewed",
      ready: env.DATA_RETENTION_APPROVED === retentionPolicy.version,
    },
    {
      id: "assets",
      label: "Logo, photography and dependency permissions reviewed",
      ready: Boolean(env.ASSET_RIGHTS_REFERENCE?.trim()),
    },
    {
      id: "email",
      label: "Verified sender and actual ticket delivery accepted",
      ready: Boolean(
        env.BREVO_API_KEY &&
        env.EMAIL_FROM &&
        env.EMAIL_ACCEPTANCE_REFERENCE?.trim(),
      ),
    },
    {
      id: "jobs",
      label: "Recurring worker and operator alerts accepted",
      ready: Boolean(
        env.MAINTENANCE_JOB_SECRET && env.JOBS_ACCEPTANCE_REFERENCE?.trim(),
      ),
    },
    {
      id: "phones",
      label: "Actual phone checkout, ticket and scanner rehearsal accepted",
      ready: Boolean(env.PHONE_ACCEPTANCE_REFERENCE?.trim()),
    },
  ];
}
export function assertLaunchReady(
  env: Record<string, string | undefined> = process.env,
) {
  if (launchChecks(env).some((c) => !c.ready))
    throw new Error("Online ticket sales are not open yet.");
}
