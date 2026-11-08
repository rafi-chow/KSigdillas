# Scoring and donations — November 8, 2026

Published at https://ksigdillas.netlify.app as [Netlify deploy `6af0cca04845678b97fc627e`](https://app.netlify.com/projects/ksigdillas/deploys/6af0cca04845678b97fc627e), from [commit `ad55484`](https://github.com/rafi-chow/KSigdillas/commit/ad55484208dcdd667a1a4e59cff2390d23eda4ac) on `feat/event-operations`. The branch is pushed to GitHub; main was not merged. Approved scope: [implementation plan](SCORING_AND_DONATIONS_PLAN_2026-11-08.md).

## Behavior

Monday's 500-point winner uses accepted supply points. Tuesday's 300-point winner uses pie/slap points, excluding direct donations and ticket sales. Wednesday's 300-point longest-hang contest stays. Thursday's 1,000-point attendance award counts unique actual attendees using wristband/admission IDs; repeat QRs and linked tickets cannot add another person. Staff must check for an existing wristband. Rehearsal mode verifies a QR without consuming a ticket. Organizer corrections and hours overrides are audited.

The public Donate actions go directly to https://donate.stripe.com/7sYaEX4Hidfif4Cg8D2kw02. Stripe API and the actual hosted page confirmed the approved custom-amount price, $1 payment minimum, $10 preset, required chapter selection and optional brother referral. Gifts under $5 are accepted but earn zero points. Each donation earns 50 points per complete $5: $5/$10/$15 earn 50/100/150; $7 earns 50; separate $3+$2 earn zero. No remainder pooling.

The existing signed webhook worker imports this donation link separately from ticket fulfillment, validates the paid session and charge, and updates event funds, chapter points, and brother referral totals. Replayed or reordered events converge on one receipt. Delayed payments wait for confirmation. Actual refund/dispute changes reconcile points and funds; test refunds are synthetic only. No new charge, real refund, donation email, ticket, or QR is created during these tests. The organizer-only recovery CLI can reconcile a missed delivery. Genuine live donation settlement remains untested until an authorized donation occurs.

Brother referrals are separate from ticket sales and verified personal donations. Unknown attribution is reviewable and correctable with an audit reason. Stripe receipt links appear in the private donation report when available. Stripe's automatic receipt-email setting requires the account owner's Dashboard login; it was not accessible here, and the restricted key cannot read webhook-destination settings. The existing genuine ticket purchase already verified the shared signed-webhook transport. See [receipt instructions](https://docs.stripe.com/receipts#automatic). No tax settings, invoice billing, or tax-deduction claims were added.

## Verification

- 118 unit/domain/HTTP/Postgres tests passed, including winner inversions, donation thresholds, per-receipt rounding, retries, out-of-order payment events, refunds/disputes, attribution correction, migration adjustments, and concurrent donation/import/admission operations.
- 44 browser cases passed in Chromium and mobile WebKit against the compiled production build over a loopback-only HTTPS proxy. The isolated local certificate is trusted only by that test browser. Production HTTPS requirements and Secure cookies remain enforced.
- Typecheck, lint, and the complete production webpack build passed. The full Netlify production adapter build and publish passed, including the scheduled worker bundles.
- Visuals reviewed at 320/375/390/430/768/1280/1440 pixels, including 200% text zoom, accessibility audits, long identifiers/referrals, zero totals, paid/review states, and duplicate admission messages. Actual rendered PNGs were inspected. No physical iPhone test is claimed.
- Working ticket checkout, QR rendering/decoding, authentication, role restrictions, supply caps, public feed behavior and existing packet rules have regression coverage.

[Mobile donation panel](images/donation-mobile-2026-11-08.png) · [Mobile daily winners](images/scoring-admin-mobile-2026-11-08.png). Additional synthetic evidence remains in ignored `test-results/`, with raw logs and private production evidence in `.data/deployment/`.

## Production preparation

A private consistent snapshot preserves the existing one paid order, one valid ticket, zero refunds, and 46 brothers. Additive schema migration 004 creates donation/admission records. The policy dry run finds zero donation receipts to rescore, zero existing awards to review, and one pre-event check-in. Its original timestamp is preserved as rehearsal history when policy v2 is applied; the paid ticket remains valid and unused for event admission. No financial records are deleted or restored over live orders.

The signed-in Netlify Free ledger showed 193.7 used / 106.3 credits remaining. One coordinated publication reserves another 15 credits; runtime/traffic remains monitored. No paid upgrade or credit purchase is made. See [credit budget](NETLIFY_CREDIT_BUDGET.md).

## Matching packet wording

“Monday: most accepted supply points. Tuesday: most pie/slap points. Wednesday: longest verified hang. Thursday: most unique people attending. Monetary donations earn 50 chapter points per complete $5, calculated separately for each donation; gifts under $5 earn no points.” External packet text was not edited by this release.

## Production acceptance

Policy v2 was applied with the reviewed snapshot and audited reason. The existing paid order, QR token, 46 brothers, and $10 ticket base revenue are unchanged. One pre-event scan is retained as rehearsal history; actual attendance is zero and the ticket is valid for admission. Production has zero refunds and zero paid donations.

Live verification confirmed both Donate links and all three ticket buttons use their exact approved Stripe destinations, updated public rules render, all 11 referenced static assets return 200, legacy ticket checkout URLs still redirect, private APIs require authentication, staff responses are no-store, and login uses Secure/HttpOnly/SameSite cookies. Strict health returned 200 with a current scheduler heartbeat and zero business attention. Both Chromium and WebKit rendered the live mobile donation panel without client errors or horizontal overflow; the deployed PNG was visually inspected. Configured-private-value scans checked 176 candidate source files, 52 public assets, and six rendered routes with zero matches. Production dependency audit reports zero vulnerabilities.

A uniquely identified donation checkout was opened without buyer/payment details and explicitly expired unpaid. No matching expired-event delivery was observed by 1:31 PM Central; the restricted API key cannot inspect the destination's event subscriptions. This probe does not establish signed donation delivery. The successful live ticket purchase proves the existing paid-checkout transport; paid-donation settlement and its receipt email remain unverified until a genuine authorized donation. Confirm the relevant Checkout completion/async event subscriptions with the Stripe owner if delayed-payment delivery needs independent provider evidence. The importer recovery commands remain available.

Private evidence: `scoring-live-verification.json`, `scoring-policy-applied.json`, `donation-stripe-verification.json`, `donation-unpaid-delivery.json`, `scoring-netlify-publish.log`, production backups, and screenshots under `.data/deployment/`. No actual payment, refund, or attendee data is included in shared visual fixtures.
