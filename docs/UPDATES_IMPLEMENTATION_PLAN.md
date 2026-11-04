# KSigdillas full implementation and launch plan

**November 1 authority update:** the user designated the [KSigdillas Packet](https://docs.google.com/document/d/18AXJPC4zIaVk6ucLsNTPeLRO6whajf8KZW4G0Efjvnw/edit) as authoritative. `PRODUCTION_READINESS_PLAN.md` is the current finishing/release plan and overrides older conflicting implementation details below. The later “implement and test” instruction authorized packet alignment. Code is implemented locally; 67 automated tests, 20 browser cases and typecheck/lint/build pass. See `PACKET_VERIFICATION.md` for current evidence and remaining production gates. The tests reported below are October 29 evidence, not verification of the new rules.

Updated October 29, 2026. The user authorized implementation. Event operations, Stripe Checkout integration code, buyer-fee configuration, brother sales/donor tracking, Brevo/Resend delivery and recovery are implemented locally. Current results: 56 domain/integration tests and 16 browser cases passed, plus typecheck/lint/build. See `STRIPE_BROTHER_VERIFICATION.md` and `STRIPE_EMAIL_SETUP.md`. Real account/fee approval, sender, scheduler, phones and production cutover remain pending. No real account settings, production data or deployment were changed. The companion plans retain the detailed design and acceptance requirements.

Repository baseline: `main` at `5175176`; reviewed `origin/updates` at `c247264c4ea0487fba52ce4181820d2409170122`. That branch adds requirements and `Fundraiser Quesadilla Logo.png`, not application functionality. Human clarifications override the [branch notes](https://github.com/rafi-chow/KSigdillas/blob/c247264c4ea0487fba52ce4181820d2409170122/updates.md). The implementation is local on `feat/event-operations`; it has not been merged, deployed, or activated for live payments.

## 1. Outcome and boundaries

Deliver a mobile-friendly event website with Stripe guest checkout, individual QR tickets, reliable email delivery, phone check-in, door sales, editable scoring, live team standings, and a fundraising total excluding buyer service fees. All required implementation and operational checks must pass before launch. Target expected use is roughly 100–200 tickets, with no overall or per-tier sales cap.

Retain the current Next.js/React/TypeScript/Tailwind application, Neon Postgres, and Vercel deployment. Preserve the visual style while updating the logo, content, and purchase flow. The October 29 integration proposal uses Stripe's supported embedded Checkout with a hosted fallback and recommends Brevo's free email tier after sender/quota verification; add its adapter behind the existing email interface. See `STRIPE_INTEGRATION_PLAN.md`; references to hosted checkout below describe the original plan and must use this refined presentation. No buyer accounts are required.

### Implementation authorization and current scope

The later “implement” instruction authorized the Stripe/brother/email work too. Code is now locally implemented and tested; actual provider, fee, sender, recurring scheduler, device and production acceptance remains pending. `STRIPE_BROTHER_VERIFICATION.md` is the current evidence report. Original design stages below remain the acceptance target and must not be treated as proof of completed external setup.

## 2. Confirmed event specification

All dates below are in 2026; all times use `America/Chicago`. Store timestamps in UTC and render local event time explicitly.

| Date | Activity | Time | Location |
| --- | --- | --- | --- |
| Monday, November 16 | Food collection; packet bonus supply points | 9 AM–3 PM | 707 S Davis Dr backyard |
| Tuesday, November 17 | Food collection | 9 AM–3 PM | Same backyard |
| Tuesday, November 17 | Pie / slap activities | 11 AM–3 PM | In front of UTA library |
| Wednesday, November 18 | Food collection | 9 AM–3 PM | Same backyard |
| Wednesday, November 18 | Hanging / pull-up-bar challenge | 11 AM–3 PM | In front of UTA library |
| Thursday, November 19 | KSigdillas main event | 6–9 PM | 707 S Davis Dr backyard |
| Thursday, November 19 | 4v4 volleyball tournament | Starts at 7 PM | Main event |

- Remove basketball; retain volleyball. Preserve other existing activities unless contradicted by approved requirements; do not invent new contest fees or awards.
- Use the branch logo `Fundraiser Quesadilla Logo.png`, with correct proportions and a suitable light background.
- Replace first-responder messaging with the supplied Movember paragraph about men's health, mental health and suicide prevention, prostate cancer, and testicular cancer. Do not invent a donation percentage or imply funds have already been transferred.
- Public contact and ticket-email reply-to: **zachzapalac@gmail.com**.
- Retain two wristband types. Staff sees the ticket tier clearly at check-in; wristband colors can be operational labels without requiring another planning decision.
- Existing teams: AXO, DZ, ZTA, DDD. Preserve their identifiers and existing valid balances.
- Ordinary ticket purchases are nonrefundable. Staff must still be able to handle exceptional refunds, cancellations, and disputes.

### Ticket catalog and sales window

| Tier | Presale base price | Door base price | Ticket points |
| --- | ---: | ---: | ---: |
| Basicdilla | $10 | $12 | 100 |
| Meat/Veggie Pass | $15 | $18 | 150 |

Presale ends **Thursday, November 19 at 6 PM**, confirmed by the user. New orders from 6–9 PM use door prices. Close new sales at 9 PM by default. Sales open when the release is activated; no invented advance opening date. No capacity caps or inventory reservations.

Implementation default for the cutoff: a server-created checkout quote remains valid for its displayed short expiry, including quotes created shortly before 6 PM. New quotes at or after 6 PM always use door prices. Use a 30-minute quote lifetime, shorten/expire where supported at event end, and reconcile any already-paid in-flight transaction rather than losing its tickets. Document this quote behavior in checkout and test the boundary. Never trust a stale client price.

Retain the existing Basicdilla benefits and combine the upgraded tier appropriately. Do not promise steak availability from the donation placeholder. Remove the old standalone Beef Tier and all third-tier pricing/mapping.

### Scoring rules

| Action / award | Points | Money collected |
| --- | ---: | --- |
| Paid Basicdilla ticket | 100 per valid ticket | Ticket catalog price |
| Paid Meat/Veggie ticket | 150 per valid ticket | Ticket catalog price |
| Slap | 10 per recorded participation | $2 per slap |
| Pie | 15 per recorded participation | $2 per pie |
| Hanging attempt | **10 per attempt** | **No price specified; do not assume $10** |
| Hanging winner | 300 to the winner's team | One overall winner |
| Instagram story | 25 per verified entry; both required tags | None |
| Instagram reel / feed post | 50 per distinct verified entry; both required tags | None |
| Monetary donations | 50 per complete $5 | Verified donation receipts only |
| Volleyball placements | 400 / 200 / 100 | First / second / third |
| Eating placements | 400 / 200 / 100 | First / second / third |
| Monday supply winner | 500 | Most accepted supply packages in the chapter’s box |
| Tuesday pie/slap revenue winner | 300 | Highest verified pie/slap revenue; exclude direct donations and ticket sales |
| Attendance winner | 1,000 | Most unique valid ticket check-ins |

Hanging attempts are score-only unless an organizer later configures a separate price. Do not show a made-up dollar price or describe the activity as explicitly free. Ordinary activity score entry must not manufacture a financial receipt.

Operational defaults: Monday supply, Tuesday pie/slap revenue and Wednesday hanging contests close at 3 PM on their respective days; attendance closes at 9 PM Thursday. There are no Tuesday/Wednesday food-winner awards in the packet. Staff finalizes awards once per contest. Ties remain pending a staff decision. Corrections reverse/replace prior awards with an audit trail. Social posts require both @kappasigmauta and @movember.usa, staff proof and duplicate prevention across reel/feed classifications. Donation scoring uses cumulative eligible cents per team: `floor(net donation cents / 500) × 50`; retain the remainder and recompute after reversals. Ticket and activity purchases do not earn donation points as well.

### Food and drink scoring units

One complete listed retail package is one scoring unit. Monday uses the explicit packet values below; Tuesday and Wednesday use ordinary points. Monday caps: cheese 10, tortillas 10, soda 6, water 4; vegetables/meat uncapped. Caps are per chapter on Monday; refuse excess packages and give them zero points and no box/donor credit. Monday winner is the most accepted packages across four sorority boxes. Tuesday winner is highest verified pie/slap revenue only. See the current production readiness plan. Do not label these values as a fixed multiplier.

| Package | Tue/Wed | Monday |
| --- | ---: | ---: |
| Great Value shredded Monterey Jack or finely shredded Triple Cheddar, 8 oz bag | 35 | 75 |
| Great Value small fajita flour tortillas, 20-count / 26 oz pack | 35 | 75 |
| Great Value frozen pepper & onion blend, 20 oz bag | 50 | 125 |
| Great Value frozen fajita-style sliced chicken breast, 3 lb bag | 100 | 175 |
| Steak — **placeholder, disabled; product/size TBD** | 100 | 175 |
| Coca-Cola, Sprite, Dr Pepper, or Diet Coke, twelve 12 fl oz cans | 75 | 150 |
| Great Value purified water, twenty-four 16.9 fl oz bottles | 50 | 75 |

Steak remains visible as a pending item in staff configuration and development review. Do not accept scored steak donations or present an invented package to the public. Before launch, either supply its package and enable it or keep that single item disabled; it does not block the rest of implementation.

### Product references supplied in screenshots

Use one complete retail package as one scoring unit. The two cheese varieties are alternatives within the same cheese category; each 8 oz bag earns the same cheese points. Do not infer approval for different package sizes or unnamed substitutions.

| Product | Package | Source |
| --- | --- | --- |
| Great Value Small Fajita Flour Tortillas | 20 count, 26 oz | [Walmart](https://www.walmart.com/ip/478147915); screenshot short link `KTrAioN5iteDT0GYn` |
| Great Value Shredded Monterey Jack Cheese | 8 oz | [Walmart](https://www.walmart.com/ip/106764433); `rike8mEuGYSPkvVCS` |
| Great Value Finely Shredded Triple Cheddar Cheese | 8 oz | [Walmart](https://www.walmart.com/ip/46491724); `Y0d2bqWlKUvfgYzd4` |
| Great Value Pepper & Onion Mixed Vegetable Blend, frozen | 20 oz | [Walmart](https://www.walmart.com/ip/539250805); `c1J7RdXvuTei7SmpR` |
| Great Value Fajita Style Sliced Chicken Breast, frozen | 3 lb | [Walmart Business, same product ID](https://business.walmart.com/ip/Great-Value-Fajita-Style-Sliced-Chicken-Breast/18248017222); `JN2JZeB0tNiCmH3jT` |
| Great Value Purified Drinking Water | 24 bottles, 16.9 fl oz each | [Walmart](https://www.walmart.com/ip/13448854); `b3JFBVW1uQ5bLR8c4` |
| Dr Pepper | 12 cans, 12 fl oz each | [Walmart](https://www.walmart.com/ip/10452492); `rpkCXN9tFDfjgjeBV` |
| Diet Coke Soda Fridge Pack | 12 cans, 12 fl oz each | Explicit product preview in original Photo 2; direct link not exposed |
| Coca-Cola Original Taste Soda Fridge Pack | 12 cans, 12 fl oz each | Follow-up Photo 1 shows product name and package; direct link not exposed |
| Sprite Lemon-Lime Soda | 12 cans, 12 fl oz each | Follow-up Photo 2 shows brand and package; direct link not exposed |

Verification: the water page opened directly; other short-link redirects identified product URLs, and Walmart listings confirmed the sizes above. The chicken size was verified on Walmart Business for the same product ID. The Diet Coke name and size are visible in the user's screenshot. The two short links previously returned Google share errors, but the user supplied follow-up product screenshots identifying Coca-Cola and Sprite. Their package sizes are visible; no further clarification of these soda items is needed. The exact mapping of each short-link token to each soda is not established and is not needed for scoring. Steak is an explicitly authorized placeholder: retain it in configuration as disabled until its product/package is supplied.

## 3. User flows

### Buyer

1. View schedule, cause, two ticket tiers, refund terms, and clear total pricing.
2. Select quantities, supply purchaser email, and enter attendee names and supported teams. Allow “No team” so unaffiliated guests can attend without allocating points to a sorority. Default repeated team selections for group orders while allowing per-ticket changes.
3. Review the base amount, service fee, any applicable tax, and total; pay through Stripe-hosted Checkout. Start with cards and supported card wallets; exclude delayed payment methods until their full lifecycle is implemented.
4. Return to a page showing verified paid, pending, failed, or expired status. A return URL alone never issues tickets.
5. Receive one QR per attendee, readable tier/name/order reference, date/location, and contact information by email. The confirmation page also provides tickets when paid, so email delays do not leave the buyer stranded.
6. Present QR on a phone or printed ticket; staff scans, confirms tier, and supplies the correct wristband.

### Staff

- Scan quickly on a protected phone page; show clear valid, already-used, unpaid, refunded, revoked, and unknown-ticket results.
- Search by attendee, email, or order reference; resend tickets and inspect payment status.
- Record cash door sales or create a buyer-operated Stripe checkout at door prices. Both produce the same ticket records. Never collect card details in staff forms or accept a payment screenshot as proof.
- Enter donation packages, social entries, activity participation, and verified offline receipts; preview the resulting point change before saving.
- Finalize food, volleyball, hanging, and attendance awards; correct entries with a reason.
- Edit event/scoring settings without redeploying; see payment reconciliation and email failures according to role.

## 4. Architecture and data integrity

### Existing code to evolve

| Area | Current files / issue | Planned change |
| --- | --- | --- |
| Event content | `src/lib/eventConfig.ts`, `src/app/page.tsx`, `HeroSection.tsx`, `TicketTierCard.tsx`, `WristbandFlow.tsx`, layout metadata | Shared event configuration; correct logo, schedule, two tiers, cause, contact, fee/refund copy |
| Scoring | `src/lib/scoringConfig.ts`, `src/types/leaderboard.ts`, `src/lib/leaderboard/*Repository.ts` | Versioned rules, immutable score entries, aggregate projections |
| Public totals | `src/lib/leaderboard/live.ts` currently overlays Eventbrite ticket points | Replace overlay with the new authoritative aggregates; explicitly reconcile legacy tickets |
| Staff UI | `AdminLeaderboard.tsx`, `/admin/leaderboard`, current admin routes | Retain useful team management; add scan/orders/receipts/rules/awards views |
| Authentication | `src/lib/adminAuth.ts` has a deterministic token without server-checked expiry | Individual staff identities, roles, revocable sessions, server-side expiration |
| Storage initialization | Runtime-created leaderboard table and destructive demo reset | Versioned migrations; disable production reset; preserve history |

Add focused server modules under `src/lib/payments`, `tickets`, `email`, and `scoring`; keep provider integration separate from domain rules. Proposed routes: `/checkout`, `/orders/[token]`, `/tickets/[token]`, `/admin/check-in`, `/admin/orders`, and `/admin/settings`; APIs for checkout, Stripe webhook, scans, receipts, score entries, awards, settings, and protected maintenance jobs. Reuse existing pages/routes where doing so is simpler.

### Persistent records

| Record | Required contents / constraints |
| --- | --- |
| Event and catalog | Time zone, schedule, sales status/window, tier prices, enabled donation products, contact, revision |
| Rule versions | Integer points, effective day/time, activity/package keys, operator and revision |
| Orders / items | Integer cents, currency, base/fee/tax/total, source, buyer email, attendee attribution, immutable price and rule snapshots, provider IDs, unique request key |
| Tickets | One per attendee; event, tier, team or unassigned, validity, check-in status, unique opaque token digest |
| Payments / provider events | Unique Stripe event and payment IDs, verified amounts, current state, processing attempts, refund/dispute records |
| Receipts | Verified offline amount/category, operator, reference, reversal link; not a duplicate of an online payment |
| Score ledger | Team, signed integer delta, rule version, source ID, day, quantity, operator, reason, reversal link; unique source/action keys |
| Awards | Contest/day/placement, winner, finalized status, unique active result, correction history |
| Email outbox | Order/template, unique delivery key, retry count, next attempt, delivery status, provider reference |
| Staff and audit | Individual staff identity, role, hashed credential/session token, expiry/revocation, material changes |

Use database transactions and unique constraints for payment fulfillment, score awards, cash-sale issuance, and check-in. A payment fulfillment transaction creates tickets, score entries, and the email-outbox item together. If it fails, none of those partial effects are retained. Do not hold a database transaction open while calling Stripe or an email provider; coordinate external calls using durable states and idempotency keys.

The ledger is the authoritative point history; public totals are projections of it. Do not count ticket points both from ticket rows and ledger entries. Configure the UI breakdown as Tickets, Giving, Activities, and Bonuses, with attendance separately. Migrate existing balances as explicitly identified opening entries and reconcile ticket contributions before importing real legacy orders.

All money is integer USD cents; all points are integers. Store event day explicitly in scoring records and validate it server-side. Rule edits apply prospectively; retroactive changes require a preview and explicit audited adjustment. Team correction on a ticket transfers its points and attendance attribution atomically with an audit entry; do not silently rewrite financial records.

## 5. Stripe, fees, and fulfillment

Use a single organizer Stripe account, with onboarding already underway. No Connect marketplace or payout routing is needed for the current scope. The account owner completes Stripe identity and bank requirements directly; secrets stay in server-side deployment settings.

- The server creates an order and checkout using an allowlisted tier/quantity/team, current sales window, and immutable pricing snapshot. Repeated submissions with the same request key reuse the existing attempt; a changed cart gets a new attempt.
- Signed webhooks use the raw request body. Verify event environment, order association, amount, currency, and paid state before fulfillment. Persist/retry processing durably and tolerate duplicate, concurrent, delayed, and out-of-order events. Reconcile from the provider's current state when event order is ambiguous. These requirements follow [Stripe's webhook guidance](https://docs.stripe.com/webhooks).
- Background reconciliation checks stuck checkout/fulfillment records and undelivered email jobs. A buyer closing the tab must not prevent fulfillment. Select and configure a scheduler with adequate retry frequency for event use; do not depend on continued browser activity.
- Return pages read authorized order status. Use high-entropy access tokens, no sequential public order lookup, no indexing, no personal data in public aggregates, and no bearer tokens in analytics/logs.
- QR tokens contain no buyer details. Store token digests for lookup; protect any recoverable material needed for ticket/email regeneration using server-side encryption. Resending preserves a valid ticket; an explicit replacement rotates and revokes the old token.

### Fee policy

Recover payment-processing costs with no organizer markup, disclose the fee-inclusive payable amount before commitment, and exclude buyer fees from points and funds raised. Calculate at order level so the fixed processor charge is not repeated for every ticket in one order.

The October 29 correction explicitly keeps **buyer-paid fees**. Do not switch to organizer absorption. The companion Stripe plan identifies a concrete constraint: ordinary Visa credit-card surcharge limits and debit/prepaid restrictions can prevent full recovery on low-priced tickets. The account owner must confirm a supported permitted fee mechanism with Stripe before activation; this is not resolved by renaming a fee or increasing a line item blindly.

US standard domestic card pricing currently lists 2.9% + $0.30 with no setup or monthly charge for standard payments ([Stripe US pricing](https://stripe.com/us/pricing), checked October 28, 2026). Treat account-specific rates and enabled methods as configurable. A gross-up estimate is `ceil((base cents + fixed fee cents) / (1 - percentage))`; its difference from base is the estimated buyer fee. Define rounding and tax interaction in tests before live use. Do not promise exact recovery across international cards, different payment methods, refunds, or disputes; reconcile actual fees separately.

Before enabling live fees, verify the account's permitted fee treatment, disclosures, applicable tax configuration, and method restrictions. This is an implementation/release prerequisite, not a request to invent an extra markup. If the proposed treatment is unsupported, surface the concrete issue before launch rather than disguising it with a new label.

### Refunds, cancellations, and disputes

Provide admin-only exceptional refund controls with a preview of amount, selected tickets, and point changes. A request is pending until confirmed by Stripe; handle failure and partial refunds without revoking the wrong attendees. Tie item refunds to explicit tickets, separate base and fee refunds, and record any processor fee retained. Fee-only refunds do not reverse ticket points. For an externally initiated partial refund without ticket allocation, surface a reconciliation task rather than guessing which ticket to revoke.

Suspend unused tickets and provisionally reverse affected points while a charge dispute is open; restore them on a resolved win when otherwise valid, or finalize reversals on a loss. Keep provisional disputed money separate from the confirmed fundraising metric. Refunds never erase historical scans or receipts; eligibility projections reflect the resulting validity. If an award has already been finalized, flag the affected result for staff review instead of silently changing the winner.

## 6. Email, scanning, and operational tools

Use a transactional email provider with a verified sender identity. Choose a provider compatible with the existing domain/account access and event volume; avoid unnecessary paid features. Zach's Gmail address is the reply-to/public contact, not an automatically authorized sending domain. Configure DNS verification if required and test delivery to real Gmail and Outlook inboxes. Email includes a readable fallback reference and a secure ticket link in addition to QR images.

Check-in is an atomic transition on a valid ticket: two concurrent scans can produce only one successful admission. A scan changes attendance once and never awards the original 100/150 ticket points again. Default one admission per ticket; staff may reverse a mistaken check-in with a reason. Do not build uncontrolled self-service re-entry.

Staff roles: check-in (scan and minimal lookup), scorer (verified scoring/receipts), organizer (rules, corrections, refunds, staff management). Use individual credentials and server-stored revocable sessions with expiry, secure cookies, login rate limits, request-origin protection, and server-side permission checks. Protect read endpoints containing attendee details as well as writes. Disable destructive reset in production.

Provide an event-day export and a documented connectivity fallback. During an outage, use one controlled manual check-in list and reconcile afterward; separate offline scanners cannot promise global duplicate prevention. Staff needs a one-page runbook for sold ticket lookup, lost email, duplicate QR, pending payment, correction, and escalation to Zach.

## 7. Leaderboard and money display

Private brother tracking is now requested: see `BROTHER_TRACKING_PLAN.md`. Report attributed paid ticket units/base revenue, personal monetary donations, and donated goods separately. Use stable roster IDs and reviewed aliases, audit corrections, and prevent attribution from duplicating event revenue or team points. This is an additional planned feature; earlier local results do not prove it works.

- Public standings use committed ledger totals and retain the current roughly 30-second refresh initially. Show last-updated state and useful stale/error feedback.
- Attendance is a separate count of unique valid checked-in tickets. Unassigned guests count toward event attendance but not a team award.
- Funds raised = verified ticket base receipts + verified monetary donations + verified paid-activity receipts, minus corresponding refunds and provisional disputed amounts. Exclude buyer fees and taxes; do not value donated goods as cash.
- Label this as funds raised, not net profit or money already donated to Movember. Expense accounting and actual Stripe payout reconciliation stay in staff reports.
- Public APIs expose aggregate team data only. Financial and attendee exports require organizer access.

## 8. Implementation tracks and integration status

Execution follows the two tracks below; completed local checks are recorded in `IMPLEMENTATION_VERIFICATION.md`. Track A does not require a Stripe account. Work needing other external services is tracked separately rather than silently treated as complete.

### Track A — complete after implementation is authorized, without Stripe

| Stage | Deliverables | Required verification / exit evidence |
| --- | --- | --- |
| A1. Public site | Shared config, supplied logo, Movember copy, full schedule, two tiers, donation guide, disabled steak, contact/refunds, remove basketball | Requirement-to-screen review, mobile/desktop screenshots, working internal links, no incorrect third tier or invented hanging price |
| A2. Durable foundation and staff access | Versioned migrations, rule seeds, orders/tickets/outbox/ledger, individual staff sessions and roles, production guards | Real test-Postgres migration/transaction tests, preservation of seeded legacy balances, role/expiry tests, production reset denied |
| A3. Order and pricing core | Guest order form, quantities, per-attendee team/no-team attribution, price snapshots, 6 PM cutoff, expiry, fee calculation interface, status pages | Deterministic clock tests, independent expected totals, invalid-input and tampering tests; no simulated payment can be accepted by production |
| A4. Tickets, email, and entry | QR generation/pages, lookup, resend/replacement, email outbox/retries, phone scanner, duplicate protection, verified cash door-sale flow | Test-issued and cash-fixture tickets survive restart; duplicate/concurrent scan tests; email rendering/retries; real inbox and phone checks when services/devices are available |
| A5. Scoring and public totals | Food/activity/social entry, donation receipts, editable rules, awards, corrections, attendance, public leaderboard/fundraising | Exact fixture calculations below, rule-version/reversal tests, aggregate/API/UI agreement, correct refresh and privacy behavior |
| A6. Recovery and operations | Provider-neutral refund/dispute state transitions, audit/export tools, background job contracts, alerts, backup/restore, staff runbook, legacy migration dry run | Injected failures recover without duplicates; restore preserves counts; redacted legacy fixtures reconcile; no production Eventbrite switch |
| A7. Non-Stripe acceptance | Full review of A1–A6, automated suites, browser flows, realistic synthetic volume, documented external dependencies | Acceptance report with evidence for every requirement, no unresolved application defects in Track A, provider/device checks accurately marked pending where needed |

Email provider/domain verification, preview Postgres, deployment access, a scheduler, and physical phones are independent of Stripe. Use available authorized test resources; if access is missing, finish code and isolated tests, then record the exact real-service check still pending. A local email capture proves template/job behavior, not Gmail/Outlook delivery. A browser camera fixture proves scanner logic, not actual phone camera compatibility.

### Temporary preview behavior and integration seams

- Use an injected payment-provider interface plus a deterministic fake only inside automated tests or explicitly isolated development previews. Keep fake and production data separate; mark preview tickets/receipts as test data.
- A fake provider can produce paid, failed, pending, expired, refunded, and disputed states to exercise our application logic. These are application simulations, not Stripe integration tests.
- Production configuration must reject the fake provider. With no real provider configured, the server refuses online payment initiation and the UI clearly indicates online sales are not open. No public “mark paid” shortcut or unrestricted fixture endpoint may exist.
- Build cash-sale logic with verified-receipt records; exercise it with synthetic cash records in test storage. Do not record invented receipts in production or open live cash sales during development.
- Prepare confirmation/ticket pages, email jobs, aggregate queries, and reconciliation logic against domain contracts. Leave hosted Stripe Checkout, signature handling, provider event mapping, and remote refunds/reconciliation for Track B.
- Keep existing live Eventbrite sales/tickets intact during development. The new preview uses isolated fixture/import data. Preparing the replacement totals is Track A; changing the live sales source is Track B.
- Keep live preview available during UI implementation, visibly distinguish test data, and avoid inserting developer configuration details into the public buyer flow.

### Track B — code implemented locally; real account/service acceptance pending

The detailed sequence, observed link issues, fee validation, embedded checkout proposal, real sender, scheduler, physical-phone rehearsal, and existing Payment Link sale reconciliation are in `STRIPE_INTEGRATION_PLAN.md` (October 29). A public payment link does not itself provide backend integration access or prove that payouts are enabled.

| Stage | Deferred work | Required acceptance |
| --- | --- | --- |
| B1. Account and integration | Complete organizer onboarding; configure SDK/API version, keys, hosted Checkout, allowed methods, actual fee/tax treatment, signed webhooks | Successful real Stripe test-mode session; verified signature/amount/currency/environment checks; missing secrets fail closed |
| B2. Provider lifecycle | Map Stripe payment/refund/dispute events into the tested domain core; remote retries, reconciliation, card door sales | Real test-mode success, decline, abandonment, duplicate/delayed events, refund and supported dispute scenarios; confirmation never depends on returning to the site |
| B3. Integrated acceptance | Repeat the payment-to-email-to-ticket-to-scan-to-leaderboard journey with Stripe and real sender; retest boundary/error paths | Provider records reconcile to database, tickets, email, funds, and points; contract differences found in Track A simulations are fixed and retested |
| B4. Production release | Production secrets/webhook, final legacy cutover, live configuration review, monitoring, organizer-operated real transaction check | Every launch gate passes; paid tickets remain valid during rollback; no fake provider or test data reaches production |

Do not describe Track A completion as payment-ready or launch-ready. A7 means the non-Stripe implementation is verified to the documented extent; B1–B4 and any pending independent service/device checks still gate launch.

Follow `DEVELOPMENT.md` during later implementation: use a descriptive feature branch, keep coherent changes, update documentation, and keep secrets/attendee data out of Git. Preserve unrelated working changes, including generated `next-env.d.ts` changes. Do not assume a clean checkout or replace other work.

## 9. Verification plan and proof of completion

`LAUNCH_TEST_PLAN.md` adds the full execution matrix, exact brother/fee/email-quota fixtures, real-service and phone checks, and release evidence requirements. It supplements the original cases below. New features must be implemented and freshly tested; do not relabel previous passes as evidence for them.

**Current test status:** local domain, real Postgres, and desktop/mobile browser checks have been executed during implementation. Consult `IMPLEMENTATION_VERIFICATION.md` for the final results and limits. Real email delivery, physical phone camera, scheduler operation, and Stripe acceptance remain pending.

The repository now has a TypeScript domain/integration runner and Playwright browser suite, documented commands, and CI configuration. Current local verification passed 56 domain/integration tests and 16 desktop/mobile browser cases; see `STRIPE_BROTHER_VERIFICATION.md` for exact scope. Actual provider/device checks remain separate. Use an isolated real Postgres database for transactions and concurrency; an in-memory fake is insufficient to validate SQL locking or unique constraints. Pin the test clock and use synthetic attendees, stable fixture IDs, and deterministic data resets confined to test storage.

### Requirement-to-evidence tracking

Maintain `docs/IMPLEMENTATION_VERIFICATION.md` as implementation proceeds. Give each requirement a stable ID (for example, CONTENT-01, SCORE-01, CHECKIN-01, PAYMENT-01) and map it to the responsible stage, expected result, automated test or manual check, actual result, commit, environment, and evidence path. Record status as **not run**, **pass**, **fail**, or **blocked**, and explicitly identify whether the evidence uses a fake, real test service, or production service. No blocked/skipped check counts as a pass.

Save a concise test summary, redacted browser screenshots, migration/reconciliation counts, and manual phone/email check results. Never put buyer data, QR bearer tokens, secrets, or production payment payloads in reports or CI artifacts. Do not create tests merely to mirror static text: review content visually and reserve automated assertions for significant behavior and data rules.

### Verification layers

| Layer | What it proves | When |
| --- | --- | --- |
| Content and visual review | Every approved schedule/item/price/point value appears correctly; no basketball, old cause, third tier, invented hanging charge, enabled steak, or broken placeholder links | A1 and final A7 review |
| Domain tests | Independent arithmetic for prices, points, donation remainder, cutoff/expiry, transitions, corrections, and awards | Alongside A3/A5/A6 |
| Postgres integration | Atomic fulfillment, idempotency, durable outbox, scan races, constraints, migrations, role-protected mutations, rollback/restore | Alongside A2/A4/A6 |
| Browser journeys | Public and staff flows work together, errors are actionable, roles restrict access, totals refresh, camera-denied/manual lookup works | Each finished flow, then A7 |
| Real service/device checks | Deliverability, actual phone camera behavior, scheduled retry jobs and alert delivery | Track A when independent access is available; otherwise explicitly pending |
| Stripe integration | Our code handles actual Checkout/webhook/refund behavior and agrees with provider records | Track B only |
| Release smoke checks | Reviewed production settings and real operation, without test data leaking or legacy tickets being lost | B4 |

### Focused case matrix

| Area | Required cases | Track |
| --- | --- | --- |
| Pricing | Both tiers, mixed cart, one fixed fee per order, integer rounding, invalid/negative quantity, client tampering, no-team choice, 5:59:59 PM vs 6:00 PM Chicago, pre-cutoff quote honored until expiry, 9 PM sales close | A: local rules; B: hosted sessions |
| Fulfillment | Success, decline, abandonment, duplicate/concurrent notifications, out-of-order state, DB failure/retry, amount/currency mismatch, closed buyer tab; invalid signature and test/live mismatch | A: domain simulations; B: actual Stripe events/signatures |
| Ticket access | One QR per attendee, no cross-order access, token revocation, resend, replaced QR denied, pending/unpaid ticket not admitted, provider timeout, retry without duplicate issuance | A; repeat paid journey in B |
| Admission | First scan, repeat scan, two simultaneous scanners, refunded/disputed ticket, manual lookup, corrected scan, no second ticket-point award | A: Postgres and browser; physical phones separately |
| Scoring | Every configured rule, Monday vs Tue/Wed, disabled steak, hanging 10 points/no receipt, donation remainder/reversal, duplicate entry, prospective rule edit, correction, tie, repeated award finalization | A |
| Money | Base/fee/tax separation, verified cash vs simulated card, fee-only refund, selected-ticket partial refund, dispute/reversal, no double-counted receipt, no invented cash value for food | A: core; B: provider reconciliation |
| Security | Expired/revoked sessions, every role boundary, rate limits, forged mutations, order enumeration, private API access, production fake-provider/reset rejection, no private data in public aggregates/logs | A; repeat configuration checks in B |
| Migration/recovery | Repeatable migrations, preserved balances, duplicate legacy import, no doubled opening points, backup restore, job replay, rollback preserving tickets | A: isolated dry run; B: production cutover |
| Experience | Narrow mobile and desktop, Safari/Chrome, camera permission denial, keyboard/focus/labels, slow network, loading/error states, multi-ticket email rendering, confirmation without email | A; actual hosted checkout in B |

### Exact acceptance fixtures

Expected results below are calculated from the approved rules, not by invoking the same production calculator in the test assertion. Use separate fixtures so unrelated test failures cannot obscure the cause.

1. **Ticket order:** two Basicdilla tickets plus one Meat/Veggie ticket, all AXO, before cutoff: base **$35**, **3 unique tickets**, **350 points**, attendance **0**. Use a deliberately synthetic **$1.23** service fee in this fixture to prove separation: paid total **$36.23**, displayed funds **$35**. This fee is not an approved real checkout fee. Replaying fulfillment must leave every result unchanged.
2. **Attendance:** scan those three tickets once: AXO attendance **3**, ticket points still **350**. Two simultaneous requests for the same fresh ticket produce one admission; a later duplicate produces no change. Repeat after restarting the application to prove persistence.
3. **Food:** on Monday, two cheese bags, one soda pack, and one water pack award **375 points** under the packet, before any prior cap usage. The same quantities Tuesday award **195 points**. Neither changes cash funds. Reject the disabled steak item and invalid package quantities. Test caps and reversals as specified in `PRODUCTION_READINESS_PLAN.md`.
4. **Activities:** three hanging attempts award **30 points** and create **no monetary receipt**. Two verified $2 slap participations award **20 points** with **$4** recorded activity receipts. One verified $2 pie awards **15 points** with **$2** recorded. Replaying the same submission does not repeat its receipt or points.
5. **Donation remainder:** verified donations of $7 then $3 award **50 then 50 additional points**, for **100 points / $10** total. Reversing $3 leaves **50 points / $7**. Keep this separate from ticket and activity revenue.
6. **Award:** finalizing an attendance winner adds **1,000 once**. Repeating finalization adds zero. Correcting the winner removes the prior 1,000 and assigns 1,000 to the new winner with a recorded reason. An unresolved tie creates no award.
7. **Refund:** from a fresh copy of fixture 1, reverse one selected Basicdilla ticket's $10 base payment: **2 valid tickets**, **250 ticket points**, **$25 base funds**. Keep service-fee refund treatment separate. A fee-only refund changes no ticket points; an unallocated external partial refund creates a staff reconciliation task.
8. **Clock and teams:** at 6 PM Chicago, the same three-ticket basket uses **$42 base** ($12 + $12 + $18), still **350 ticket points**. A ticket marked “No team” contributes money and overall attendance but no team points or team attendance bonus eligibility.
9. **Failure recovery:** interrupt a fulfillment transaction before commit: zero partial tickets/points/outbox entries remain. Retry after recovery: exactly three tickets, 350 points, and one logical email job. Simulate email timeout after send: retry may resend the same ticket message but must never create extra tickets or points; use provider idempotency where available.

### Volume, concurrency, and independent reconciliation

In isolated test storage, create 200 synthetic paid tickets (100 Basicdilla and 100 Meat/Veggie at presale prices): expect **25,000 ticket points** and **$2,500 base funds** before other activity. Process them in concurrent batches, repeat duplicate notifications, and scan with concurrent clients. The total number of successful first admissions must equal the number of unique valid scanned tickets, never the number of scan requests.

Measure response times, errors, job backlog, and public refresh under that bounded workload; investigate timeouts, failures, or a queue that does not drain. Verify committed leaderboard changes appear by the next normal refresh (roughly 30 seconds, allowing network overhead). Inspect totals with independent SQL/count reports against the fixture manifest and compare the database, API, and UI. Do not load-test live Stripe, send 200 real emails, or touch production records for this exercise.

### Stage completion and regression policy

For each stage, run the relevant checks and fix failures before marking its exit criteria complete. Run lint, production build, all domain/integration tests, and critical browser journeys at A7 and again for the integrated B3 release candidate. Re-run affected suites when implementation changes; after a gate passes, broaden testing only for new changes, failures, or unresolved concerns.

A7 deliverables: implemented non-Stripe features, repeatable test commands/fixtures, completed verification report, redacted preview evidence, and an explicit list of pending real-service/device/Stripe checks. B3/B4 add actual provider and production evidence. **No mock payment test, build success, or visual screenshot alone establishes readiness to take live payments.**

## 10. Environments, cutover, and launch gates

Maintain separate development/preview and production databases, Stripe keys/webhook secrets, sender credentials, and job secrets. Proposed configuration includes `APP_URL`, `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, email-provider credentials, `EMAIL_FROM`, `EMAIL_REPLY_TO`, session/encryption secrets, and maintenance-job authentication. No secret uses `NEXT_PUBLIC_`. Document actual chosen names in `.env.example` without values. Live payments fail closed if required durable services or approved fee configuration are missing.

### Eventbrite cutover

Track A prepares and verifies this process on isolated data. Execute the live cutover only in Track B after Stripe acceptance; do not close existing sales or mutate legacy production records while the account is pending.

1. Inspect existing live orders, manual balances, ticket mappings, and check-ins; do not presume they are test data.
2. Back up and reconcile counts/amounts by team and provider. Import valid legacy tickets with unique provider-qualified IDs and explicit scoring rules, preventing imported ticket points from duplicating opening balances.
3. Preserve a usable admission path for old Eventbrite confirmations: staff lookup/provider-qualified scan support, or safely deliver replacement site tickets with reconciled identity. Do not invalidate existing buyers without a transition.
4. Switch public purchase links to Stripe only after test acceptance. Close/disable the old sales path as part of the coordinated launch and remove the automatic Eventbrite total overlay.
5. Confirm no new order is omitted or counted twice around the cutover. Keep a read-only reconciliation record and rollback instructions.

### Required launch checklist

- [ ] Public site matches confirmed event, pricing, cause, schedule, logo, contact, and points.
- [ ] Steak is either fully specified and enabled or explicitly disabled; no bogus package or acceptance rule is live.
- [ ] Stripe onboarding, payment capability, payout owner/bank setup, fee treatment, and any applicable tax configuration are verified.
- [ ] Verified email sender, real inbox delivery, retry/resend, and support reply-to work.
- [ ] Free email provider's daily quota fits peak purchases plus resends; sender identity and quota/failure recovery tested.
- [ ] Brother seller/donor reports, alias resolution, refunds/corrections, imports and private access pass the dedicated fixtures without duplicated funds or team points.
- [ ] Production migrations and backup/restore are verified; no demo fallback/reset can affect real records.
- [ ] Checkout, webhook, ticket delivery, phone scanning, door sales, scorekeeping, refunds/disputes, and legacy migration meet acceptance tests.
- [ ] Staff identities/roles are provisioned and tested on the actual event phones; organizer has the runbook and export procedure.
- [ ] Reconciliation/email jobs are scheduled, authenticated, and observed running; alerts cover webhook failures, stuck payments, failed email, and database errors.
- [ ] All code checks pass and preview review is complete; no broken placeholder Instagram link or stale Eventbrite CTA remains. Hide unconfigured outbound social links rather than guessing an account URL.
- [ ] Deploy with reviewed production configuration; organizer performs any agreed real purchase/refund smoke check directly and results are reconciled.
- [ ] Confirm public totals, issued tickets, and support monitoring after launch. Keep rollback able to pause new sales while preserving paid tickets and check-in.

## 11. Remaining external setup, not open planning questions

The November 1 packet supersedes the earlier scoring decisions. `PRODUCTION_READINESS_PLAN.md` defines remaining packet implementation, confirmed cap/box-count/pie-slap-revenue rules, tests and release sequence. Hanging attempts remain 10 points, presale ends Thursday at 6 PM, and steak remains a placeholder until specified. Earlier operations and Stripe/brother/email code was locally tested; packet alignment and real account/service acceptance still need completion. The subsequent request authorized packet implementation/testing. That code is now local; production/service activation remains pending.

Organizer-owned setup: complete Stripe identity/bank onboarding, make the deployment/email-domain access available through secure channels, and designate staff when access is provisioned. Steak details can be supplied later; until then it stays disabled. Hanging has no configured monetary charge unless the organizer later supplies one.

Remaining implementation-owned work: the Track B integration plan, including email/job setup, production migration and reconciliation, security checks, actual provider/device test evidence, and deployment/runbook updates. Account capability and fee checks, any existing Payment Link purchases, and the live sales cutover must be verified before activation. Any new blocker must be concrete and accompanied by the affected launch requirement; do not reopen settled event decisions.
