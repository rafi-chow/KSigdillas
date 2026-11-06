# November 3 Payment Link verification

**November 5 replacement:** the current organizer link is https://buy.stripe.com/6oU4gz7Tugru8GeaOj2kw03. See [current tax-inclusive catalog and integration](NEW_PAYMENT_LINK_2026-11-05.md). Earlier observations below are historical; retired links remain explicitly allowed for reconciliation.

## Public inspection

No personal/payment information entered or payment submitted. Initial cart: one Basic $10.61; Meat/Veggies is an optional add-on at $15.76. A mixed cart totals $26.37. Adding Meat, removing Basic and confirming removal produces a meat-only $15.76 total. Required chapter values are axo/ddd/dz/zta/none; soldby is optional. Name/email are required. Card, Cash App Pay, Bank and Klarna are visible. Descriptions show November 19, 6–9 PM at 707 S Davis Dr, fee included and all sales final.

The link bundles 61 cents into each Basic ticket and 76 cents into each Meat ticket. For the illustrative configured 2.9% + 30 cents rate, the website’s one-order gross-up of a $25 mixed cart is $26.06, versus this link’s $26.37. Per-ticket pricing repeats the fixed portion on multi-ticket purchases; it is not exact recovery of actual Stripe fees. The website retains its order-level fee. Do not change the organizer’s Stripe settings without authorized account access.

The public page does not establish actual processing rates, payout readiness, credentials, catalog/link IDs or webhook configuration. Visible payment methods do not establish an approved buyer fee arrangement.

## Implemented locally

- New link is current; previous link remains supported for historical CLI reconciliation. Unrelated URLs fail review.
- Two separate, distinct reviewed price IDs map $10.61 to $10 base + $0.61 fee and $15.76 to $15 base + $0.76 fee. Product names or arbitrary amounts are never used to infer ticket tier. Original base-price imports remain supported.
- Full charged total and fee-inclusive catalog snapshot are preserved. Chapter points and brother ticket revenue use base value only. Missing guest names remain explicitly pending.
- `STRIPE_PAYMENT_LINK_ENABLED=true` permits automatic imports of paid signed checkout events for the configured reviewed `STRIPE_PAYMENT_LINK_ID`. Exact account/mode/link/catalog/quantities/currency/paid state are verified. Unknown links stay reviewable. Pausing new website sales preserves recovery of paid link orders.
- Duplicate sessions/events create one order, ticket set and logical email job. Refunds reconcile charged totals with separate base/fee reversal. No public untracked payment fallback was added.

## Executed tests

November 3: **71 passed, 0 failed, 0 skipped**, including isolated PostgreSQL, existing payment/signature/queue tests and four new Payment Link tests. TypeScript, lint and production build passed. Targeted Stripe suites: **16 passed**. No real payment was made. The prior **20** desktop/mobile browser cases passed November 1 and were not re-run for this server/CLI-only patch.

New fixtures verify catalog completeness/distinctness, explicit URL matching, two Basic + one Meat ($35 base / $1.98 included fees / $36.98 charged / 350 chapter points / three brother ticket units), full-refund allocation, duplicate paid events with website sales paused, unrelated-link review and transaction rollback for changed totals/unknown products.

Logs: `/tmp/ksigdillas-nov3-tests.log`, `/tmp/ksigdillas-nov3-lint.log`, `/tmp/ksigdillas-nov3-build.log`.

## Remaining acceptance

1. Establish authorized Stripe account access; verify capabilities, fee arrangement and enabled methods. Configure matching test/live credentials and signed webhook. `stripe-check` lists current/historical links and verifies configured price amounts.
2. Configure both `STRIPE_LINK_PRICE_BASIC` and `STRIPE_LINK_PRICE_MEAT`, plus the current reviewed `STRIPE_PAYMENT_LINK_ID`. The four separate website price IDs and normal Stripe runtime credentials remain required. Enable imports only after real sandbox paid-event acceptance.
3. Test actual single/mixed/multi-ticket, decline/authentication/pending cases, delayed/repeated webhooks and buyer closing the tab; compare tickets, chapter points, brother reports and email. Reconcile previous-link sales once before cutover.
4. Adjust/retire the static presale link at 6 PM Central November 19 and close it at event end. Website server-side door pricing and cutoff do not automatically change a separate Payment Link.
5. Configure verified email delivery, recurring maintenance and an independent heartbeat monitor; rehearse on real iPhone/Android. Emulated browsers are not physical phone acceptance.

See `DEPLOYMENT_SETUP_STATUS.md` for actual configuration. No production deployment or live-sales activation occurred.
