# KSigdillas production readiness plan

**Current finish sequence:** [Finish to webhook handoff](FINISH_TO_WEBHOOK_HANDOFF_PLAN.md) is the latest planning-only revision: visual/copy cleanup, bounded Netlify jobs, deployment, email/operations, testing, and the exact Stripe-owner handoff. It supersedes older execution order below without erasing historical evidence. No application or account change was made for that revision.

## Current execution update — November 3, 2026

The later instruction authorized implementation. Policies/consent, all-in pricing, restricted Stripe integration, security/accessibility, retention tooling and launch checks are now local. Brevo sending and actual Gmail delivery were verified; the supplied Stripe key created and expired an unpaid embedded session. These replace earlier “planned, not implemented” statements below. See [DEPLOYMENT_SETUP_STATUS.md](DEPLOYMENT_SETUP_STATUS.md) for current completion and outstanding work.

Hosting is **unchanged until cutover**, and the user has now approved resuming Netlify Free preparation. Follow [HOSTING_DECISION.md](HOSTING_DECISION.md), including the measured credit-budget check. Hobby permits donation requests but does not clearly permit required paid admission. A move requires a webhook hostname edit; the current key cannot read endpoint configuration and write capability is not established.

Reuse the existing all-in $10.61/$15.76 prices without a second fee. Base revenue and chapter/brother credit remain $10/$15. Online door prices are optional and absent: close online sales at 6 PM and advertise cash $12/$18. Do not request additional prices just to launch presales. Refund writes remain owner-operated; no exact fee recovery is guaranteed for every card/quantity/method.

No deployment, upgrade or live payment occurred. Final hosting, signed callbacks, scheduler/alerts, paid acceptance, actual phones and applicable organizer approvals remain open. Historical planning/status paragraphs below are superseded by this update; their detailed requirements remain the design rationale.

Updated November 3, 2026. The user subsequently authorized implementation and testing. Packet-aligned code is now implemented locally; see `PACKET_VERIFICATION.md` for fresh evidence. External service setup and production activation remain outstanding.

November 3 setup: database and organizer are prepared; 17 production variables are uploaded to Vercel and Node 22.x verified. New Payment Link support passes 71 automated tests, typecheck, lint and build. The earlier 20 browser cases passed November 1. No new code is deployed. Stripe account/webhook, verified email, recurring jobs/monitor and real-device acceptance remain open. See `DEPLOYMENT_SETUP_STATUS.md` and `PAYMENT_LINK_VERIFICATION.md`.

## November 3 revision: remaining launch work, embedded Stripe and risk review

**Planning only.** This revision implements the user's request to update the plan and testing, not application code. It supersedes the earlier link-only/read-only plan and any earlier request for the Stripe owner's personal login. The later conversation selected an on-page Stripe payment form with a minimal owner handoff. The public Payment Link remains relevant for existing prices and historical fulfillment; it is not an iframe integration.

Read [LAUNCH_RISK_REVIEW.md](LAUNCH_RISK_REVIEW.md) for the researched legal, organizer, privacy, accessibility, hosting and security work. Its RISK-01 through RISK-08 gates supplement the packet rules below. A passing software suite does not establish lawful fees, event permission, insurance coverage or a lawsuit-proof website. No new acceptance tests were run for this planning revision.

### Payment experience and minimal owner handoff

Use Stripe's supported Embedded Checkout on our site, with server-created sessions, verified signed events, one ticket per paid attendee and private confirmation/email delivery. Keep card details inside Stripe. Preserve chapter and optional brother attribution. A Buy Button is the simpler hosted-checkout alternative, but does not embed the full payment form. Do not iframe the raw Payment Link. [Stripe Embedded Checkout](https://docs.stripe.com/checkout/embedded/quickstart).

The owner does not need website editing access. After the endpoint is deployed and reachable, supply its exact URL and required event list for his Stripe dashboard. The only integration handoff is:

- The account's public publishable key and a dedicated restricted server key capable of creating/retrieving Checkout Sessions and the specific reads needed for existing prices, verification and reconciliation. Audit the actual API calls before giving the owner the exact permissions. Include session expiry only if the implementation uses it; no payout, transfer or account-management access. Keep refunds owner-operated unless refund-write access is separately intended. Retrieve existing price/account identifiers ourselves; do not ask him to recreate prices or reconfirm that Stripe is open.
- Registration of `https://ksigdillas.vercel.app/api/stripe/webhook` (or the final production origin if hosting changes), with the exact implemented checkout/payment/refund/dispute events, and secure delivery of its signing secret. We create/deploy the receiver; he registers its address in Stripe. Use separate sandbox and live configurations.

Store secret keys in the deployment secret store through a secure handoff, never in chat, email, Git or browser code. Restricted keys still grant resource-level account permissions, not automatic isolation to this event. Filter and validate actual account/mode/prices/sessions. [Stripe keys](https://docs.stripe.com/keys).

### Pricing reconciliation before activation

Current link: https://buy.stripe.com/6oU3cva1Ccbe4pY3lR2kw01. Its observed prices are $10.61 Basic / $15.76 Meat, with bundled amounts per ticket. Local custom Checkout currently expects separate $10/$15 presale and $12/$18 door base prices plus an order-level fee. Do not treat these as interchangeable or add a second fee.

Resolve RISK-01's all-in-price and surcharge issues, then reuse the existing price objects where compatible. Preserve approved base revenue/points separately from the amount paid. Do not claim exact Stripe cost recovery for every payment method. Record the approved per-ticket or per-order policy and use it everywhere, including multi-ticket carts, refunds and door-price cutover. The user's buyer-paid preference remains the economic goal, not evidence that any surcharge mechanism is permitted. Keep `STRIPE_FEE_POLICY_APPROVED` closed until the actual mechanism is resolved.

Refactor restricted `rk_test_`/`rk_live_` validation, provider capabilities and catalog checks; current code does not support the proposed restricted-key configuration yet. Remove unnecessary key permissions and disable unsupported refund-write actions. Keep historical Payment Link fulfillment/reconciliation and corrected attribution intact. A site sales switch does not disable an externally shareable Stripe Payment Link: coordinate its lifecycle with the owner and reconcile any intervening sales.

### Work to finish while access is pending

1. Complete the developer-owned tasks in `LAUNCH_RISK_REVIEW.md`: policy pages and versioned acceptance, price presentation, accurate fundraiser identity, data inventory/retention, accessibility, asset permissions, secret/dependency checks, browser headers and authorization/abuse/failure tests. Drafts may identify unresolved organizer facts internally; publish no invented claims or placeholder legal terms.
2. Obtain one consolidated organizer facts/approvals pass for seller/beneficiary/tax treatment, cancellation/weather/refunds, campus/food/venue permissions and activity coverage. Reuse all established packet details. The new safety/permit questions cannot be answered by code.
3. Resolve hosting eligibility: the currently configured Hobby team is not automatically permitted for paid admission. Select an eligible host/plan or obtain an applicable provider determination before deployment. No automatic paid upgrade.
4. When collaborative setup begins, have the user sign into Brevo, configure and verify the sender/API/callbacks, then the scheduler and alert destination. Finish local implementation and isolated testing before requesting provider acceptance.

### Email, scheduler and physical phones

**Brevo:** the user signs into an account they control. Configure transactional sending, display name KSigdillas Tickets and reply-to zachzapalac@gmail.com. One order email contains all tickets. The free allowance is 300/day shared with other sending; reserve resend headroom. Prefer an authenticated controlled domain. A personal Gmail sender may use Brevo's documented temporary sender rewriting; verify the actual From and inbox behavior and do not invent a no-reply address. [Brevo plan](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans), [sender requirements](https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders).

**Scheduler:** retain a free external one-minute authenticated maintenance job if suitable for the chosen host. User sign-in to [cron-job.org](https://cron-job.org/en/) can enable it. Verify worker heartbeat, queue age and failure alerts with browsers closed. A monitor on the same scheduler is not independent protection against that provider's outage; document the limitation or use a separate monitor. Existing Vercel CLI access is sufficient if Vercel remains the host.

**Phones:** together test an actual iPhone and Android with sandbox Checkout, ticket email, rear-camera scanning, denied-camera manual lookup, duplicate/refunded tickets and slow cellular. Browser emulation is useful but is not this evidence.

### Verification and completion

Use the updated [LAUNCH_TEST_PLAN.md](LAUNCH_TEST_PLAN.md), including the new legal/content, privacy, accessibility, security, hosting and embedded-key cases. Keep automated, sandbox, inbox, physical-device and organizer-document evidence separate. Prior evidence remains **71 automated tests plus typecheck/lint/build on November 3**, and **20 browser cases on November 1**; it does not cover these newly planned changes. The release candidate must pass fresh regression checks after implementation, real-service acceptance and the applicable RISK gates before sales activation.

## Authority and current status

The user designated the [KSigdillas Packet](https://docs.google.com/document/d/18AXJPC4zIaVk6ucLsNTPeLRO6whajf8KZW4G0Efjvnw/edit) as the source of truth on November 1. This plan uses the packet retrieved that day (modified 18:23:36 UTC). Its explicit numbers override earlier conversation-derived scoring, branch notes and implementation defaults. The user subsequently clarified cap rejection, Monday box counts, and Tuesday pie/slap revenue; these clarifications govern the ambiguous packet wording. Earlier decisions still fill gaps: event times/location, ticket prices, buyer-paid processing, brother tracking, contact email and steak's unspecified package. Freeze the accepted packet revision with release evidence and review later edits explicitly.

Existing checkout, QR tickets, staff roles, scoring ledger, brother reports, email queue and recovery are implemented locally on `feat/event-operations`. October 29 evidence records 56 automated tests, 16 browser cases, typecheck, lint and build passing. Those historical results do not prove the new packet rules or real-service readiness; the packet revision has its own current verification report. Production deployment, actual Stripe/email acceptance, recurring jobs, historical imports and real-phone rehearsal are outstanding. See `STRIPE_BROTHER_VERIFICATION.md` for historical results and `STRIPE_EMAIL_SETUP.md` for setup procedures.

## 1. Reconcile the packet and publish one ruleset

### Exact point schedule

| Supply category                 | Ordinary points/package | Monday points/package | Packet Monday cap |
| ------------------------------- | ----------------------: | --------------------: | ----------------: |
| Cheese, either approved variety |                      35 |                    75 |                10 |
| Tortillas                       |                      35 |                    75 |                10 |
| Frozen fajita vegetables        |                      50 |                   125 |              None |
| Frozen fajita meat              |                     100 |                   175 |              None |
| Soda, approved 12-pack          |                      75 |                   150 |                 6 |
| Water, approved 24-pack         |                      50 |                    75 |                 4 |

Store explicit Monday values, not a multiplier. Describe Monday as “bonus supply points” and show the table: the packet's “1.5x–2x” heading does not match its own numbers. The supplied product sizes remain applicable unless the packet's linked products establish a different package. Validate all package links against the actual document before release; extracted plain text does not verify embedded images or hyperlinks. Steak needs an actual product/package before acceptance; it can remain disabled with a clear pending note while the rest launches.

| Action/award                    | Authoritative target                               |
| ------------------------------- | -------------------------------------------------- |
| Basic / Meat-Veggie tickets     | 100 / 150 per valid paid ticket                    |
| Verified cash donation          | 50 per complete cumulative $5; preserve remainder  |
| Instagram story                 | 25; both @kappasigmauta and @movember.usa required |
| Instagram reel or feed post     | 50; both tags required                             |
| Pie / slap                      | 15 / 10; retain $2 each from earlier instructions  |
| Hanging attempt                 | 10; no monetary price supplied                     |
| Monday supply winner            | 500                                                |
| Tuesday pie/slap revenue winner | 300; highest verified pie/slap revenue only        |
| Wednesday overall longest hang  | 300 to winner's chapter                            |
| Volleyball placements           | 400 / 200 / 100                                    |
| Eating placements               | 400 / 200 / 100                                    |
| Most chapter members checked in | 1,000                                              |

Remove Tuesday and Wednesday food-winner awards. Keep food collection on those days at ordinary points. Preserve one overall hanging winner. No separate fourth-place award is needed. Keep ticket prices $10/$15 presale, $12/$18 from Thursday 6 PM; event closes at 9 PM. Ticket quantity has no event capacity cap; supply scoring caps are a separate policy.

### Confirmed organizer clarifications

1. **Supply caps:** per chapter on Monday, shared across donors and product variants within a category. Refuse supplies above the category cap: they earn zero points and must not enter the accepted-donation record or the chapter box. They do not earn ordinary points instead. No-team contributions cannot count toward any chapter box or winner.
2. **Monday winner:** four boxes, one for each sorority (AXO, DZ, ZTA, DDD). The chapter with the most accepted approved supply packages wins 500 points. Count whole retail bags/packs, not individual bottles/cans or the supplies’ point value. Staff reconciles the physical box count with accepted package records. Rejected excess does not count.
3. **Tuesday winner:** highest verified dollar total from pie/slap purchases only earns 300 points. Exclude direct monetary donations, ticket sales, supply values, fees, and unrelated receipts. Count amounts net of reversals/refunds, using integer cents. Tuesday is not ranked by activity points or unique participants. Both activities currently cost $2, but the authoritative measure remains money.

Use a staff-selected, documented resolution for ties, including Monday/Tuesday, hanging and attendance; never silently choose a chapter or award multiple first places. Tournament/eating organizers submit placements and supporting results. Do not require a new bracket-management product for launch.

### Public content and staff workflow

- Show exact ordinary/Monday supply points, package sizes, cap scope and overflow treatment together; remove inconsistent multipliers everywhere.
- Publish packet volleyball rules: 4v4 sand, first to 15, double elimination, championship/consolation placements. Capture the organizer's official results; resolve ambiguous bracket situations with event staff before awarding.
- Publish eating rules: 10 quesadillas in 6 minutes, fastest finish then most consumed, two waters supplied. Record completion time or consumed amount and final placements; unresolved ties stay pending staff decision.
- Record hanging time and contender/chapter as evidence for the single overall winner. Avoid interpreting “longest hang” as summed chapter time.
- Support a chapter representative/contact and Queso Queen contender using a private organizer record; no public personal-contact directory is needed.
- Add feed posts to staff scoring. Record proof/reference and tag verification; the same Instagram post cannot be credited twice by changing reel/feed classification. Stories need a stable staff evidence reference after expiry.
- Explain live website standings and organizer daily Instagram updates without promising automated social posting. Add the optional brother-seller field to purchase instructions. Public standings stay separate from private brother contributions.

## 2. Implement rule changes with safe history

Primary files: `src/lib/eventConfig.ts`, `src/lib/operations/{rules,model,validation,service}.ts`, `src/components/{EventGuide,EventDesk}.tsx`, aggregate projections, migrations and relevant tests.

- Add explicit Monday points and a versioned cap policy. Store accepted package quantity, applied rate and policy version. Refused excess must never increase package totals, brother contributions, chapter box counts or points; an optional refusal audit is separate from accepted donations. Never assign invented cash value to supplies.
- Enforce caps inside the existing database transaction, across concurrent staff submissions, donor identities and alternative cheese/soda products. Show remaining allowance and a score preview. Reject an over-limit submission with the remaining allowed quantity; staff can submit only that accepted portion and return the excess. Do not silently reduce the entered amount. The server is authoritative if another entry consumes the allowance first.
- A valid accepted-donation reversal appends an audited point reversal, reduces accepted quantities/brother attribution and restores the corresponding cap allowance once. Flag a finalized Monday winner for review. There is no automatic promotion of rejected supplies: they were not accepted. A later donation requires a new verified acceptance within the collection window. Test repeated corrections and concurrent use of restored allowance.
- Add Tuesday pie/slap revenue and eating contests to schema validation, award eligibility, staff forms and public totals. Preserve unique placements and one award per contest; corrections reverse/replace prior credit with a reason. Route eating points to the eating category rather than leaving that projection fixed at zero.
- Add date/cutoff eligibility: Monday supplies and Tuesday pie/slap revenue close at 3 PM; Wednesday hang closes at 3 PM; Thursday attendance closes at 9 PM. Late corrections require an auditable staff process. Other placements require official event results.
- Separate confirmed observations from winner selection. Use reconciled box package counts for Monday and verified pie/slap receipt cents for Tuesday. Preserve explicit event date, activity type, chapter and source on receipts so direct donations/tickets cannot enter Tuesday totals. Refunds, reversals and chapter corrections update eligibility and flag finalized awards for review. Use measured hanging results and organizer-recorded eating/volleyball results. No payment receipt is manufactured by a score-only entry.
- Provide an idempotent packet-rules migration for existing operations databases; editing seed defaults alone will not update persisted rules. Back up first; show a dry-run diff. Preserve paid orders, immutable price/score snapshots and audit history. Identify any real earlier score/award records, calculate reconciliation adjustments for review, and never silently rewrite or double-award history. Clearly discard only identified synthetic preview data.

Exit condition: packet/public guide/admin choices/ledger/API/export agree; no unsupported old food bonus or old social rate remains active. The confirmed cap, box-count and pie/slap-revenue rules are covered by tests.

## 3. Complete service configuration

| Work                  | Responsible party                                                   | Required evidence                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stripe account        | Stripe account owner retains control                                | Existing account setup is acknowledged; no repeated onboarding questionnaire or personal login request. Deployment verifies the integration with the supplied restricted credentials. |
| Buyer-paid fees       | Account owner with Stripe; implementation config by developer       | Permitted arrangement for enabled payment types, actual configured fee math and visible checkout total; no claim that a generic extra line item proves acceptance                     |
| Stripe integration    | Developer; owner supplies minimal key/webhook handoff               | Matching sandbox/live account, least-privilege capabilities, reconciled existing price catalog, signed webhook, HTTPS/method requirements and actual sandbox results                  |
| Ticket email          | Developer with sender/account access                                | Activated Brevo transactional sender, current free quota checked, reply-to Zach, real designated Gmail/Outlook delivery, all QR tickets reachable, callback/resend tested             |
| Background processing | Developer with hosting access                                       | Recurring authenticated one-minute job observed with browsers closed; compatible hosting duration; independent missing-heartbeat/error monitor and designated operator destination    |
| Real staff/brothers   | Organizer supplies roster; developer imports/provisions             | Correct aliases, private roles, secure staff credentials, no synthetic names in production                                                                                            |
| Historical sales      | Developer reconciles; organizer resolves ambiguous buyers/referrals | Paid Eventbrite and original Payment Link tickets counted once, refunds/disputes reviewed, buyer admission and seller credit preserved                                                |

Use existing authorized connected access where available. Configure secrets through the deployment/provider secret store, never chat or Git. Verify current email/hosting limits at setup; do not silently purchase upgrades. Prefer an existing suitable free scheduler if hosting cannot support the required cadence. A Payment Link alone supplies neither API credentials nor the webhook needed for this checkout.

## 4. Prove readiness

Expand `LAUNCH_TEST_PLAN.md` with the packet and organizer-clarification fixtures below. Keep local deterministic tests, actual PostgreSQL concurrency tests, browser journeys and real-service acceptance as separate evidence.

### Packet fixtures with independently calculated expectations

- One of each approved active supply category (cheese, tortillas, veggies, chicken, soda, water): ordinary **345** points; Monday **675**. Two Monday cheese plus Tuesday water = **200** points. Two Monday cheese + soda + water = **375**; ordinary same cart remains **195**.
- A story + reel + distinct feed post = **125** points. Resubmitting the reel as a feed post earns zero additional credit; missing tag evidence is not accepted.
- Cap fixture: accept 9 Monday cheese packages for **675** points. A subsequent submission of 3 is rejected with **1 remaining**, leaving all totals unchanged. Staff accepts only 1 and refuses 2: **10 accepted packages / 750 points**, with no donor or box credit for the refused packages. Two concurrent one-package submissions at the final slot accept exactly one and award exactly **75** additional points. Test each cap, shared varieties, other chapter isolation, Tuesday ordinary rules, backdated entries and reversals.
- Cap reversal fixture: after accepting 9+1 cheese packages, reverse the first 9. Exactly **1 accepted package / 75 points** remains; **9 slots** reopen and the audited point delta is **-675**. Refused packages are not promoted. Repeat reversal changes nothing. A separate new verified acceptance can use restored slots before cutoff.
- Tuesday revenue fixture: A has 2 pies + 1 slap (**40 activity points / $6 receipts**); B has 4 slaps (**40 / $8**). B alone receives **300** despite tied activity points. Add a **$100 direct donation** and a **$15 ticket sale** for A: Tuesday eligibility remains **$6 versus $8**. Reverse/refund two B slaps: B becomes **$4**, A becomes the candidate at **$6**, and any finalized award is flagged for reviewed correction. Duplicate requests/refunds cannot alter totals twice. No-team receipts do not credit a chapter.
- Monday box fixture: A donates **4 cheese bags = 4 packages / 300 points**; B donates **3 chicken bags = 3 packages / 525 points**. A receives the **500** bonus for the larger accepted box count. Soda/water packs each count as one package. Rejected excess and reversed entries never increase the count; staff verifies the physical count before finalization.
- Volleyball and eating each distribute **700** placement points: **400 + 200 + 100**. A chapter winning both receives **800**; repeating finalization adds zero. Correcting a placement preserves unrelated awards and flags affected standings correctly.
- Hanging: 3 attempts = **30**, one overall winning chapter = **300** additional. Attendance winner = **1,000** once. No Tuesday/Wednesday food bonus can be created.
- Re-run existing payment/refund/brother/scan fixtures: 200 tickets, **$2,500** base, **25,000** ticket points; fees excluded, unique scans and no duplicate credits. Add capped supply allocation to brother export fixtures.
- Run migration twice, old-schema restore, rule-history preservation, concurrent caps, winner correction and backup restore against real isolated Postgres. Never use production data for load tests.

### External acceptance

- Actual Stripe sandbox: Basic, Meat, mixed cart, optional seller/no team, success, decline, authentication, abandoned browser, duplicate/delayed webhooks, refunds and supported dispute scenarios. Reconcile provider totals with database/tickets/points/brother reports.
- Actual email: small designated inbox tests for QR attachments/links, spam-folder behavior, sender/reply-to, resend and delivery callback. Simulate 200+ jobs and quota exhaustion locally; do not bulk-send test mail.
- Deployed jobs: force a controlled transient failure, close browsers, observe automatic recovery; stop the test scheduler and observe the independent heartbeat alert.
- Actual iPhone Safari and Android Chrome on HTTPS: checkout/wallet, email access, rear-camera QR scan, printed ticket, duplicate/refunded ticket, denied camera/manual lookup, slow cellular and two staff scanners.
- Staff rehearsal: sell a door ticket, credit seller, record donation/capped supplies, score social/activities, finalize/correct all contest types, export/reconcile reports. Verify scanners cannot view private brother reports or change awards.

Record commit, environment, date, expected/actual result and redacted evidence for every required case. Run Node 22 `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e` after the revised implementation. Do not label the old 56/16 results as verification of this revision.

## 5. Release sequence and stop conditions

1. Complete the remaining RISK-01–08 launch work and packet alignment, verify organizer evidence and hosting eligibility, review preview, and pass fresh automated checks. Commit reviewed changes to the feature branch and prepare the release review.
2. Provision an HTTPS staging environment with isolated data and sandbox credentials. Complete service/device/staff acceptance. Verify secure configuration, sender/quota and hosting/scheduler requirements.
3. Prepare production backup and restore evidence, preserve ticket encryption key, apply reviewed migrations, provision real staff/roster, dry-run historical imports and reconcile exceptions. Re-run imports to demonstrate idempotency before cutover.
4. Coordinate the sales transition: reconcile purchases during the transition, replace old public sales links, disable the old automatic scoring overlay only when its records are accounted for. Preserve old buyers' admission path. Prevent simultaneous competing sales paths from losing orders.
5. Deploy with new sales closed; verify production database, signed event processing, email/jobs/monitoring and staff access. Enable sales only after all required gates pass. The organizer performs a controlled live purchase and any agreed refund; verify charge, fee, ticket, delivery, seller, chapter points and scan end to end.
6. Observe initial real orders and queue/heartbeat health. Keep the organizer runbook, exports, support contact and rollback procedure accessible. Pause new sales if needed while retaining paid-order recovery, tickets and check-in; never roll back by erasing paid records.

Production ready means every applicable RISK-01–08 and testing gate has evidence, the actual organizer and pricing facts are resolved, and no unresolved scoring policy can change a winner. Missing account access is a setup dependency, not an implementation pass. Steak may remain visibly pending/disabled; it is not a blocker for the rest of the launch.

## Completion checklist

- [x] Packet authority and cap/winner interpretations settled: refuse over-cap supplies; Monday accepted package count; Tuesday pie/slap revenue only.
- [x] Public guide, staff scoring, caps, social evidence and all awards updated locally.
- [ ] Production persisted rules/history migrated and reconciled; existing buyer data preserved. Reviewed migration tooling and isolated-database checks are implemented.
- [x] Historical local checks passed: 71 automated tests plus typecheck/lint/build November 3; 20 browser cases November 1. New planned changes require fresh evidence.
- [ ] RISK-01–08 completed: pricing/terms/privacy/accessibility, seller/beneficiary/tax facts, event approvals/coverage, hosting eligibility and security review.
- [ ] New launch acceptance matrix passes for the final release revision; no placeholders or unverified compliance claims published.
- [ ] Real Stripe, buyer-fee configuration, email and recurring jobs pass acceptance.
- [ ] Staff/brother roster and historical purchases reconciled.
- [ ] Actual phone and staff rehearsal passes.
- [ ] Production backup, migration, cutover, live smoke and monitoring complete.
