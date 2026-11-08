# Scoring and donations — November 8, 2026

Release candidate: implementation and local acceptance complete; production publish and migration verification will be recorded below. Approved scope: [implementation plan](SCORING_AND_DONATIONS_PLAN_2026-11-08.md).

## Behavior

Monday's 500-point winner uses accepted supply points. Tuesday's 300-point winner uses pie/slap points, excluding direct donations and ticket sales. Wednesday's 300-point longest-hang contest stays. Thursday's 1,000-point attendance award counts unique actual attendees using wristband/admission IDs; repeat QRs and linked tickets cannot add another person. Staff must check for an existing wristband. Rehearsal mode verifies a QR without consuming a ticket. Organizer corrections and hours overrides are audited.

The public Donate actions go directly to https://donate.stripe.com/7sYaEX4Hidfif4Cg8D2kw02. Stripe API and the actual hosted page confirmed the approved custom-amount price, $1 payment minimum, $10 preset, required chapter selection and optional brother referral. Gifts under $5 are accepted but earn zero points. Each donation earns 50 points per complete $5: $5/$10/$15 earn 50/100/150; $7 earns 50; separate $3+$2 earn zero. No remainder pooling.

The existing signed webhook worker imports this donation link separately from ticket fulfillment, validates the paid session and charge, and updates event funds, chapter points, and brother referral totals. Replayed or reordered events converge on one receipt. Delayed payments wait for confirmation. Actual refund/dispute changes reconcile points and funds; test refunds are synthetic only. No new charge, real refund, donation email, ticket, or QR is created during these tests. The organizer-only recovery CLI can reconcile a missed delivery. Genuine live donation settlement remains untested until an authorized donation occurs.

Brother referrals are separate from ticket sales and verified personal donations. Unknown attribution is reviewable and correctable with an audit reason. Stripe receipt links appear in the private donation report when available. Stripe's automatic receipt-email setting requires the account owner's Dashboard login; it was not accessible here, and the restricted key cannot read webhook-destination settings. The existing genuine ticket purchase already verified the shared signed-webhook transport. See [receipt instructions](https://docs.stripe.com/receipts#automatic). No tax settings, invoice billing, or tax-deduction claims were added.

## Verification

- 118 unit/domain/HTTP/Postgres tests passed, including winner inversions, donation thresholds, per-receipt rounding, retries, out-of-order payment events, refunds/disputes, attribution correction, migration adjustments, and concurrent donation/import/admission operations.
- 44 browser cases passed in Chromium and mobile WebKit against the compiled production build over a loopback-only HTTPS proxy. The isolated local certificate is trusted only by that test browser. Production HTTPS requirements and Secure cookies remain enforced.
- Typecheck, lint, and the complete production webpack build passed. A final Netlify adapter build and production smoke check accompany publication.
- Visuals reviewed at 320/375/390/430/768/1280/1440 pixels, including 200% text zoom, accessibility audits, long identifiers/referrals, zero totals, paid/review states, and duplicate admission messages. Actual rendered PNGs were inspected. No physical iPhone test is claimed.
- Working ticket checkout, QR rendering/decoding, authentication, role restrictions, supply caps, public feed behavior and existing packet rules have regression coverage.

[Mobile donation panel](images/donation-mobile-2026-11-08.png) · [Mobile daily winners](images/scoring-admin-mobile-2026-11-08.png). Additional synthetic evidence remains in ignored `test-results/`, with raw logs and private production evidence in `.data/deployment/`.

## Production preparation

A private consistent snapshot preserves the existing one paid order, one valid ticket, zero refunds, and 46 brothers. Additive schema migration 004 creates donation/admission records. The policy dry run finds zero donation receipts to rescore, zero existing awards to review, and one pre-event check-in. Its original timestamp is preserved as rehearsal history when policy v2 is applied; the paid ticket remains valid and unused for event admission. No financial records are deleted or restored over live orders.

The signed-in Netlify Free ledger showed 193.7 used / 106.3 credits remaining. One coordinated publication reserves another 15 credits; runtime/traffic remains monitored. No paid upgrade or credit purchase is made. See [credit budget](NETLIFY_CREDIT_BUDGET.md).

## Matching packet wording

“Monday: most accepted supply points. Tuesday: most pie/slap points. Wednesday: longest verified hang. Thursday: most unique people attending. Monetary donations earn 50 chapter points per complete $5, calculated separately for each donation; gifts under $5 earn no points.” External packet text was not edited by this release.
