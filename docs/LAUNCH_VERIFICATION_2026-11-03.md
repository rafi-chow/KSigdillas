# Local launch verification — November 3, 2026

Branch: `feat/event-operations`. Work is local and uncommitted; earlier user changes were preserved. No new code was published and sales are disabled. This report supersedes earlier test-count/status summaries without changing their historical evidence.

## Passed

- **85 domain, HTTP, email, Stripe and real PostgreSQL integration tests:** `npm test`. Includes versioned consent, all-in prices/base-point separation, restricted-key configuration, signed-event recovery without Events Read permission, shared Payment Link/embedded catalog, capped supplies, Monday/Tuesday awards, brother reports, authorization/abuse bounds, retention/restore and concurrent check-in handling. External failure cases use synthetic providers; they are not evidence of real payments.
- **26 browser cases:** `npm run test:e2e`, Chromium desktop and iPhone WebKit emulation, against isolated synthetic PostgreSQL. Includes staff/scanner/seller flows and axe WCAG checks on ten public/private/policy pages per browser. A new hydration-error assertion caught WebKit/Node date punctuation differences; the explicit Central-time composition fix passed the full rerun. This is not a physical phone/camera rehearsal or complete accessibility certification.
- **Typecheck and lint:** `npm run typecheck`, `npm run lint`; typecheck now generates Next route types first so a clean CI checkout does not depend on a prior dev session.
- **Production build:** `npm run build -- --webpack`. Default local Turbopack failed because the execution environment blocked a required port; webpack completed successfully. No type errors were bypassed.
- **Netlify local adapter build:** official CLI 27.16.2, Build 37.7.5, Next runtime 5.16.6, Node 22.23.4, `netlify build --offline --context deploy-preview`. Next compilation, server-function bundling and middleware/edge bundling completed successfully. This did not create, link or deploy a site, and does not establish live runtime performance, final callback routing or credit consumption.
- **Production dependency audit:** `npm audit --omit=dev --audit-level=high` reported zero vulnerabilities. The full earlier audit had 15 moderate development-tool findings in minimatch through ESLint tooling, no high/critical. Trusted repository-only glob inputs are the current exposure; no forced package downgrades were applied.
- **Whitespace and credential review:** `git diff --check` passed. Earlier working-tree/history credential-pattern scan found no matches; the final scan checked 104 public build assets against actual configured credential values and found zero matches, without printing credentials. Ignored private configuration remains outside Git.

## Real-service evidence

Brevo accepted the authorized labeled test and Gmail's designated inbox actually received it with non-admission PNG, KSigdillas display name, support reply-to and passing SPF/DKIM/DMARC. Free allowance: 300/day. Restricted key expires February 3, 2027. The last global tracking-consent setting save and latest per-message opt-out were not provider-verified after browser access was blocked. A final deployed delivery callback is still absent.

The user's restricted live Stripe key retrieved the existing $10.61/$15.76 prices, created one unshared embedded session and immediately expired it. No payment, customer or ticket was created; no client secret was exposed. Webhook endpoint read was denied and write permission is not established. The signing secret alone does not prove the endpoint URL, events or delivery. Detailed evidence stays privately under `.data/deployment/`.

## Not passed / not run

Netlify account linking was blocked by browser approval review. There is no final Netlify hostname, cloud environment import or deployed acceptance. Netlify's 60-second worker limit and monthly credit budget still require adaptation/measurement; see [HOSTING_DECISION.md](HOSTING_DECISION.md). The user approved transition preparation; no paid plan is authorized.

Signed live/sandbox callback delivery, actual paid checkout/3DS/cancel/failure, recurring worker/alerts with browsers closed, provider callback correlation, physical iPhone/Android camera and cellular checks, organizer tax/permissions/activity/asset evidence and retention approval remain open. These must not be marked passed from the automated suite. Preserve Neon/encryption keys and keep sales closed until the applicable launch checks and provider acceptance are satisfied.
