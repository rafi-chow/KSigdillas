# Scoring and donation update plan

Status: planning only. No application code, production settings, payment settings, or production records changed. Updated November 8, 2026 after the user's scoring clarification and $5 donation threshold.

## Agreed behavior

| Contest | Winner determined by | Existing winner award |
| --- | --- | --- |
| Monday | Most accepted supply points earned Monday | 500 points |
| Tuesday | Most pie/slap points earned Tuesday | 300 points |
| Wednesday | Longest verified hang | 300 points |
| Thursday | Most unique people attending the event | 1,000 points |

Keep supply caps, individual activity rates, and other contest awards. Donation and ticket points do not contribute to Monday's or Tuesday's winner calculation. Staff resolves tied leaders with a recorded reason; zero participation does not produce a winner.

Donation interpretation for implementation: calculate points separately for each verified donation, at 50 points per complete $5. Under $5 earns zero. Thus $5 = 50, $10 = 100, $15 = 150; $7 = 50 and $12 = 100. Separate $3 and $2 donations earn zero, rather than combining into 50. Formula in cents: `floor(eligibleDonationCents / 500) * 50`. The threshold is for points, not a request to reject smaller donations at Stripe checkout.

## 1. Update scoring and attendance

- Change `src/lib/operations/contests.ts` and award validation in `service.ts` to sum active, recorded supply/activity points for the correct day. Use the rate recorded when the activity was accepted. Exclude reversals, rejected supplies, unrelated activities, and winner bonuses themselves. Keep package counts available for physical supply reconciliation, clearly separate from the winning points total.
- Update rule labels, the public supply/contest guide, and the EventDesk daily-winner panel together. Use short wording: “Monday: most supply points”; “Tuesday: most pie/slap points”; “Wednesday: longest hang”; “Thursday: most unique attendees.” Provide matching wording for the packet so it does not contradict the website.
- Fix the distinction between ticket scans and people. The current code counts checked-in tickets, even though some UI already says unique check-ins. Add an admission/person record that staff can associate with a ticket and an event wristband or admission identifier. One person has one counted admission and one chapter attribution. Repeat scans and additional tickets linked to that person do not add attendance. Group purchases can still admit each separate guest. Do not deduplicate by purchaser email or name alone.
- Staff confirms the person is physically present and has not already been admitted. Include an audited duplicate-link/correction action. Software cannot identify one person using two unrelated tickets without staff linking the records; include that step in the check-in instructions.
- Separate rehearsal from actual event attendance, using the configured event timezone and admission window, with an audited staff override for exceptions. Read-only inspection found one checked-in ticket before the event. Confirm whether that was a rehearsal and correct it explicitly during implementation; do not silently erase it or invalidate the paid ticket.
- Introduce a targeted scoring-policy version and dry-run migration. Recheck existing entries and awards before applying it; flag affected awards for review. Preserve paid orders, QR codes, roster, audit history, supply caps, and recorded rates. Do not rerun a broad packet reset.

## 2. Connect the new donation link

Use https://donate.stripe.com/7sYaEX4Hidfif4Cg8D2kw02 directly. Read-only Stripe inspection confirmed an active custom-amount donation link, with a $1 checkout minimum, chapter selection, and an optional “Which brother sent you here?” field. This permits smaller gifts, which earn no points under the new rule.

- Add a compact donation panel near the ticket section and a Donate action in the existing cause section. Keep the burgundy/cream styling, red logo, and floating cheese. Keep Buy tickets as the primary ticket action. Use a solid, high-contrast Donate button and a normal vector icon if needed, without an emoji arrow or another oversized hero button.
- Suggested copy: “Donate” / “Donation only. Does not include admission.” / “Donations of $5 or more earn 50 chapter points per complete $5.” Include the chapter selection requirement in supporting help. Give the monetary donation panel its own anchor; `#donations` currently belongs to the supply guide.
- Route donations separately through the existing signed Stripe webhook. Allowlist the new Payment Link and price, verify paid status, currency, amount, and chapter, and store a durable donation record. A donation must never create an admission ticket, QR code, ticket email, or ticket-sale credit.
- Replace cumulative chapter donation rounding in `donationDelta` with per-receipt rounding. Apply the same policy to online and manually verified donations. Preserve rate/policy snapshots and use audited ledger adjustments. Points are based on the donated amount, before Stripe processing fees, less any refunded amount. A partial refund that takes a donation below $5 removes its points. Reconcile disputes and later reinstatements without duplicate credit.
- Replays, concurrent webhook delivery, asynchronous payment success, and missed-delivery recovery must all converge on one donation receipt and one net points result. Prevent a manually recorded Stripe donation from being credited again when its webhook arrives. Chapter “none” contributes funds but no chapter points; invalid attribution goes to review.
- Treat the brother field as referral attribution. Show referred donation count/amount separately from ticket sales and personally donated funds. It is not evidence that the referring brother paid the donation.
- Keep Stripe's existing receipt and donation confirmation. Leave tax settings as configured by the Stripe owner; do not infer exemption or change them as part of this update. Preserve the working ticket checkout and webhook path.

## 3. Functional tests

Use isolated fixtures and a test database; never insert synthetic payments into production.

- Monday: three 175-point chicken packages beat four 75-point cheese packages, despite fewer packages. Test caps, reversals, ties, zero entries, and wrong-day exclusion.
- Tuesday: three pies produce 45 points for $6 and beat four slaps producing 40 points for $8. Test an equal-points tie with unequal revenue, entry reversals, and exclusion of tickets/donations/social points.
- Wednesday: longest valid hang still wins. Thursday: duplicate scan, simultaneous scans, two linked tickets for one person, separate people on a group order, reversal/readmission, chapter correction, rehearsal, and event-time boundaries all count correctly.
- Donations: test $1, $4.99, $5, $9.99, $10, and $15; separate $3 + $2 and $7 + $3; no chapter; valid/unknown brother alias; unpaid and delayed payment; invalid signature/link/currency; retries; concurrent duplicates; manual/webhook duplicates; full and partial refunds; and dispute recovery. Verify money, chapter points, and referral totals independently. Assert no tickets are issued.
- Exercise the existing ticket purchase/import, QR delivery, check-in, brother tracking, and admin authentication regressions. Run lint, typecheck, unit/integration tests, production build, and relevant browser tests.
- A real donation is not required for calculation and webhook fixture tests. If live end-to-end proof is desired later, arrange one explicitly authorized $5 donation and confirm exactly one receipt and 50 points. The earlier authorization to buy a ticket is not authorization to make a donation. Until then, report live donation settlement as unverified.

## 4. Visual and interaction tests

Capture before/after screenshots of the homepage donation placement, supply/contest rules, public standings, admin daily winners, donation/referral reports, and check-in result states. Inspect the actual rendered images, not just DOM assertions.

- Viewports: 320, 375, 390, and 430 pixels for mobile; 768 for tablet; 1280 and 1440 for desktop. Cover Chromium and mobile WebKit, plus 200% text zoom. A physical iPhone Safari check is additional evidence, not something browser emulation proves.
- Confirm the Donate panel stands apart from its background; text stays brief and readable; logo and cheese remain correctly placed; buttons have visible keyboard focus and at least 44-pixel targets. Check text contrast, wrapping, spacing, and no page-wide horizontal scroll. Mobile admin totals should stack cleanly rather than force a wide table.
- Inspect realistic long names and large totals, empty/loading/error states, point ties, pending donations, refunds, and duplicate check-in messages. Clearly distinguish points, dollars, and people, including without color. Keep private donor/contact data out of public views and shared screenshots.
- Use deterministic fixture data, loaded fonts, and frozen animation for screenshot comparisons; separately verify the floating cheese and reduced-motion behavior. Review each changed screenshot at full size and fix visual defects before accepting new baselines.
- Click Donate from every placement and verify the exact destination, donation-only description, custom amount, chapter field, and optional referral field without submitting payment. Check browser Back behavior. Confirm ticket buttons still go directly to the current ticket checkout. Stripe hosts the payment page; our website styling does not control its layout.

## 5. Release and evidence

After implementation is requested, finish local and preview checks first, review the migration dry run, and refresh the Netlify free-plan budget before one coordinated release. Record the tested commit, deployment URL, test results, screenshots, migration result, and remaining live-payment verification limits. Verify GitHub and deployment commits separately rather than assuming deployment also pushed GitHub.

Use additive, compatible data changes. Rollback must preserve real orders and donation events for reconciliation; never restore an old database over new purchases. After deployment, make read-only production checks of links, public rules, admin units, health, and webhook configuration. No deployment, production correction, payment, or application implementation is part of this planning step.
