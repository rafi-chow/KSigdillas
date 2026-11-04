# Deployment configuration status

**Latest planning update:** follow [Finish to webhook handoff](FINISH_TO_WEBHOOK_HANDOFF_PLAN.md). Built-in-browser access to Netlify succeeded November 3: team `chowdhury-rafi01`, Free plan, 300/300 credits displayed remaining, October 22–November 21 billing period. Small request/bandwidth usage is rounded in that balance. Repository access/linking remains unverified; no Netlify deployment or environment upload has occurred. The plan prefers a bounded native Netlify scheduler, with separate independent monitoring, and ends before the owner edits Stripe’s webhook URL. Localhost and Brevo access were not rechecked in this continuation.

## Latest state — November 3, 2026

This section supersedes the earlier snapshot below. Code remains local on `feat/event-operations`; production is unchanged and sales remain closed. [HOSTING_DECISION.md](HOSTING_DECISION.md) records the approved Netlify preparation, credit-budget acceptance and minimal webhook URL edit.

- The user's Stripe aliases are supported. Live restricted-key access verified existing $10.61/$15.76 prices. One unshared embedded session was created and immediately expired, without payment, customer or ticket. This proves creation/expiry, not paid checkout or signed delivery. Private evidence: `.data/deployment/stripe-*.json`.
- Signature-verified event references avoid unnecessary Events Read access; actual sessions/charges/totals remain validated. Refund writes are disabled. Missing online door-price IDs close online sales at 6 PM; cash door tickets remain $12/$18.
- The approved restricted Brevo key is stored in ignored mode-0600 local configuration. Verified sender and free 300/day allowance were checked. A labeled non-admission QR test actually reached the designated Gmail inbox with PNG and support reply-to; SPF/DKIM/DMARC passed. Key expires February 3, 2027.
- Brevo's last global tracking-consent save was not verified because browser approval denied further access. Per-message opt-out is implemented locally but its latest payload has not been verified with the provider. No deployed delivery callback exists yet.
- Terms/acceptance, all-in pricing, privacy/accessibility pages, retention tooling, private launch checks, bounded requests, async rate-limited staff authentication, CSP and accessibility improvements are local. These do not establish tax exemption, event permissions, insurance or asset rights.
- Real recurring jobs/alerts, final hosting, signed callback delivery, paid acceptance and actual iPhone/Android rehearsal remain open. Organizer evidence has not been invented. No provider support message was sent.

Existing Vercel/Neon configuration and credentials remain intact. Never upload `.env*`, `.data`, operator credentials or backups to Git/public artifacts.

A merged private migration import file is staged at `.data/deployment/netlify-production.env` (0600, ignored). It preserves the existing database/encryption keys and supplied Stripe/Brevo credentials, disables sales/link imports/refund writes/test fixtures, and intentionally leaves APP_URL blank until the real final HTTPS hostname is available. It has not been uploaded. Import into production context only after account linking; do not place these values in `netlify.toml` or preview contexts.

## Earlier setup snapshot

November 3, 2026. Setup is in progress; the new code is **not deployed**. The user authorized database setup and confirmed the old leaderboard has no real data.

## Completed

- Completed Vercel CLI sign-in. Verified the linked `ksigdillas` project, free Hobby plan, deployment protection and verified `ksigdillas.vercel.app` domain. Changed its Node runtime from 24.x to the repository’s tested 22.x. Preserved the hosting plan and protection settings.
- Verified the existing Neon database, backed up its four zero-balance chapter rows, then applied approved additive migrations 1–3. Operations has four teams, packet version 1 and zero orders. Original leaderboard rows were unchanged. Private evidence: `.data/deployment/database-readiness.json`.
- Provisioned the approved initial `deployment-owner` organizer; credential is private at `.data/deployment/operator.json` (0600). No synthetic preview accounts were inserted into the linked database. Verified organizer login, revoked its test session, checked stored packet rules and restored the operations backup into isolated PostgreSQL successfully.
- Generated encryption, maintenance/cron and email-callback keys in Git-ignored `.env.deployment.local` (0600). Uploaded **17 prepared variables to Vercel production only**. All five secret variables use sensitive storage. Preserved every pre-existing variable; preview/test secrets were not connected to production.
- The next deployment enables operations against the prepared database. Stripe website sales, automatic Payment Link imports, fee approval and test fixtures remain disabled. No paid upgrade was purchased.
- Re-read remote settings: all 17 variables present, correct sensitive types, Node 22.x and production deployment ID unchanged. Redacted evidence: `.data/deployment/vercel-configuration-verification.json`. The public homepage is browser-accessible and still serves the old Eventbrite site, not the new code.
- Inspected the new organizer link without entering buyer/payment information or paying. Basic is $10.61, Meat/Veggies $15.76; required chapter and optional brother fields are present. Tested a mixed cart ($26.37) and removal of Basic for Meat only ($15.76). Implemented exact fee-inclusive mapping and opt-in signed-event imports; historical sales remain supported. See `PAYMENT_LINK_VERIFICATION.md`.
- November 3: **71 automated tests passed, zero failed/skipped; typecheck, lint and production build passed**. The previous 20 desktop/mobile browser cases passed November 1; no app UI changed in this patch.

## Remaining access and service setup

- Stripe account access, API keys, real price IDs, current `plink_` ID and signed webhook are unavailable. The public link does not supply them. The suggested Stripe connection’s account-list operation returned unavailable and did not establish access.
- Auto-review previously blocked opening Stripe’s private financial dashboard because account authorization was not established. The user has now chosen not to use his personal login. Future setup will use owner-executed configuration and a restricted integration credential; dashboard access is no longer requested. Do not work around the earlier rejection. The prior database rejection was resolved and setup completed. Accessing macOS Passwords was also rejected, but is now unnecessary because Vercel CLI sign-in completed without it.
- The separate Vercel connector needs team authorization; its CLI session already completed project configuration. This does not block the CLI workflow.
- No verified Brevo sender/account/API key or external minute scheduler account is available. No external email, recurring service or monitoring notification was created. Vercel Hobby supports once/day cron; do not configure incompatible minute cron or silently buy Pro.

## Next sequence

The latest planning-only direction in `PRODUCTION_READINESS_PLAN.md` supersedes the earlier link-only/read-only proposal: supported Embedded Checkout, a minimal owner-executed key/webhook handoff, and guided Brevo sign-in. No personal Stripe login is requested. Restricted-key/catalog changes are planned, not implemented. `LAUNCH_RISK_REVIEW.md` adds pricing, policies/privacy, accessibility/security, organizer approvals and hosting eligibility gates; `LAUNCH_TEST_PLAN.md` records their not-yet-run acceptance cases. The existing Hobby configuration is not evidence that paid admission is permitted on that plan.

1. Preserve the encryption key, organizer credential and private backups. Keep preview/test settings separate. Review all remaining credentials before deployment.
2. Resolve the new launch-risk gates, including hosting eligibility before deployment and the permitted buyer-price mechanism before activation. Implement the minimal restricted-key integration; retrieve and reconcile existing price IDs instead of asking the owner to recreate a fixed number of prices. Deploy the webhook receiver on the final origin, supply its registration instructions, then verify matching test/live credentials and actual sandbox acceptance. A public Payment Link does not alone create website tickets/points.
3. Configure the verified Brevo sender, callbacks and designated inbox tests. Connect minute maintenance and an independent heartbeat monitor. Cron-job.org supports free minute jobs and custom headers but needs an account.
4. Reconcile actual historical sales and real brother/staff roster, complete staging/service and physical-device acceptance, then execute the reviewed production release sequence. A static external Payment Link must be adjusted/retired at the door-pricing cutoff and closed at event end separately.

References: [Stripe Buy Button](https://docs.stripe.com/payment-links/buy-button), [Stripe embedded Checkout](https://docs.stripe.com/checkout/embedded/quickstart), [Stripe webhooks](https://docs.stripe.com/webhooks), [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), [cron-job.org](https://cron-job.org/en/).
