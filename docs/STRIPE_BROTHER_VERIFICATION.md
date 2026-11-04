# Stripe, brother tracking and email verification

Historical October 29 report. The November 1 packet revision and current verification are in `PACKET_VERIFICATION.md`; food/social/award numbers below describe the earlier build.

October 29, 2026. Branch `feat/event-operations`. Local implementation only; no commit, push, deployment, live payment, external email, production migration, or live import was performed.

## Executed results

| Check | Result | Scope |
| --- | --- | --- |
| Domain, provider-adapter, endpoint and PostgreSQL suite | **56 passed, 0 failed, 0 skipped** | Supported Node 22; real isolated PostgreSQL 18; synthetic payments/attendees/receipts |
| Desktop/mobile browser journeys | **16 passed** | Chromium and iPhone-sized WebKit; real local server/Postgres; synthetic data |
| TypeScript | PASS | `npm run typecheck` |
| ESLint | PASS | `npm run lint` |
| Production build | PASS | Next 16.4.3 on Node 22, real data/payment/email connections disabled |
| Dependency install audit | 0 known vulnerabilities reported | Official Stripe SDK packages installed; lockfile updated |
| Visual review | PASS, local synthetic report | `test-results/brother-preview.png`, `brother-desk-preview.png`; browser home screenshots |

Logs are local `/tmp/ksigdillas-stripe-tests.log`, `/tmp/ksigdillas-stripe-browser.log`, and `/tmp/ksigdillas-stripe-build.log`. Screenshots and local database fixtures are ignored by Git. Browser tests use a fresh database for each suite run; the visible preview uses separate persistent synthetic storage at localhost:3100.

## Implemented behavior and evidence

| Requirement | Implementation | Executed evidence |
| --- | --- | --- |
| Embedded and hosted Checkout | Official Stripe React/JS components, server-created sessions, exact tier/cart selection, order status and reconciliation | Domain/provider tests, actual Stripe SDK HTTP serialization against an injected transport, browser tier selection and closed-sales behavior |
| Buyer-paid processing charge | One server-calculated order-level fee; disclosed base/fee/total; external approved-policy gate; no silent organizer absorption | Mixed-cart integer math and separation; missing/unapproved policy closes new sales; price/currency/catalog tampering rejected |
| Account/catalog validation | Real adapter checks the key's own account and retrieves/validates catalog prices before creating payment; pinned API `2026-10-28.endive` | SDK transport contract test proves the endpoint/payload and rejects a wrong price before the create-payment call; no actual account call without credentials |
| Payment verification and recovery | Raw signed webhook, durable provider inbox, current session/charge/refund/dispute verification, idempotent fulfillment, leased worker and periodic reconciliation | Official SDK signed-payload checks; modified body/wrong secret rejected; endpoint refuses acknowledgment when persistence unavailable; duplicate/retry/closed-tab simulation |
| Cancel/edit/fallback/cutoff | Explicit provider-session retirement, recover completed race, durable quote/catalog, supported expiry minimum, 9 PM close | Idempotent lost-response recovery, catalog change, cancellation race, paused-sales reconciliation and cutoff tests |
| Refunds/disputes | Private refund review/confirmation, selected ticket or fee refund, remote pending state, replay protection and review of ambiguous external partial refund | Exact refund/dispute fixtures; original points and active seller credit reverse/restore once; unallocated partial refund is provisionally withheld from public funds |
| Brother sales | Roster/aliases/archival, optional public/cash seller field, private counts/base revenue, reviewed correction and CSV | Domain fixtures, actual Postgres concurrent correction, desktop/mobile UI add-roster → correct-seller → donate → report/CSV journey |
| Personal donations and goods | Separate donor attribution on verified money/food; no team supported; shared allocations bounded by source; historical package-point snapshots | Donation/reversal, food/day arithmetic, joint gift bounds, no-team gifts, invalid/archived brother and CSV formula cases |
| Original Payment Link imports | Explicit check/import CLI, allowlisted link/catalog, paid-only import, actual quantities, raw seller text, unknown/ambiguous review, pending guest names | Import twice and correction preservation; unknown/unpaid inputs roll back; refunded/disputed historical cases require manual reconciliation |
| Free email adapter | Brevo plus existing Resend, one message/order, QR attachments and secure fallback links, sender/reply-to configuration | Payload/endpoint/header assertions with intercepted transport; actual QR generation for a 50-guest message; no real delivery |
| Email durability/quota | Atomic rolling-day reservations, provider 429 retries, conservative uncertain-send review, lease identity, delivery callback inbox | Concurrent last-free-slot claim, 301st-message queue behavior and next-day recovery, worker interruption, duplicate/old/wrong-recipient callbacks |
| Scheduler/monitor support | Authenticated GET/POST worker, bounded batches, provider recovery, private heartbeat, authenticated health check and one-shot scheduler client | Authentication and disabled-storage HTTP checks, existing Postgres email/recovery tests; no recurring service provisioned |
| Privacy and regression | Organizer-only brother reports/export/corrections, scorer donor entry, scanner admission-only, public aggregates | Browser role-denial and public-data assertions; original content/scoring/auth/check-in suites still pass |

## Independently checked arithmetic

- Three-ticket fixture: two Basic + one Meat = **$35 base / 3 tickets / 350 team ticket points**. Under the deliberately synthetic approved fee configuration (2.9% + 30 cents gross-up), the adapter quotes **$1.36 fee / $36.36 total**. This verifies arithmetic; it does **not** approve a real surcharge arrangement. The historical arbitrary $1.23 separation fixture remains a separate test.
- Brother A initially receives **3 sales / $35 ticket revenue / $0 personal donations**. Personal gifts of $7 and $3 yield **$10 donations / 100 team donation points**; reversing $3 leaves **$7 / 50 points**. Gifts do not increase ticket counts.
- Two Monday cheese bags and one Tuesday water pack yield **3 packages / 190 food points / $0 invented cash value**. Reversing the cheese leaves 50 food points in the brother report.
- Refunding one Basic leaves **2 tickets / $25 / 250 ticket points**. Correcting the seller moves those sales to B while preserving A's personal gifts and event/team money.
- **200 separate orders:** 100 Basic + 100 Meat = **$2,500 base / 25,000 points / 200 tickets**. A: **100 / $1,250**; B: **80 / $1,000**; unassigned: **20 / $250**. Independent SQL confirms count/revenue. All 200 logical email jobs drain through a delivery fake without duplication. A concurrent conflicting seller correction commits once.
- The original scan fixture still admits **200 unique tickets**, with 12 concurrent requests for one QR producing exactly **one** first admission.
- Brevo quota fixture reserves 299 previous attempts; two workers contend for the last slot and send **one** message. Remaining jobs queue, then recover after the rolling 24-hour window. No real quota was consumed.

## Still required before live activation

| Gate | Actual status / missing evidence |
| --- | --- |
| Stripe account access and sandbox checkout | **Not run:** no API credentials, account/price IDs or signing secret supplied in local configuration. SDK transport tests never contacted Stripe. Need success/decline/authentication/refund and supported dispute tests against the actual sandbox. |
| Permitted buyer fee arrangement and actual account rates | **Pending account owner/Stripe confirmation.** Buyer-pays intent is retained. Ordinary credit surcharge limits and debit/prepaid restrictions cannot be bypassed with a label. Leave fee approval and live-sales flags false until resolved. |
| Brevo activation/sender and real inbox delivery | **Not run:** no sending account/API key/sender configured. Need designated Gmail/Outlook delivery and actual From/reply-to/QR rendering/callback tests. |
| Deployed scheduler and independent monitor | **Not provisioned:** code supports a one-minute schedule and missing-heartbeat detection, but a deployed recurring service, notification destination, hosting cadence and function-duration support still need verification. |
| Actual event phones/network | **Not run:** iPhone Safari and Android Chrome checkout/wallet/camera/cellular rehearsal remains required; desktop browser emulation is not that evidence. |
| Real brother roster / historical sales | **Not supplied/imported:** preview names are explicitly synthetic. Add real roster/approved aliases; dry-run and reconcile Eventbrite and original Stripe purchases before cutover. |
| Production release | **Not performed:** reviewed secrets, migration, staff provisioning, backup, sales cutover, organizer-operated live smoke transaction and rollback checks remain required. |

`STRIPE_EMAIL_SETUP.md` provides the exact remaining setup. Keep new sales closed until these gates pass. Paid-order recovery remains available when only new Stripe sales are paused.
