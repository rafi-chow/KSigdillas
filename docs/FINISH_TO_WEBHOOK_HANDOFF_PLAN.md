# Finish plan: design, Netlify, and Stripe handoff

**Latest implementation status:** [Netlify handoff verification](NETLIFY_HANDOFF_2026-11-03.md) records the deployed site, current tests and remaining external gates. The planning snapshots below are retained as history.

Updated November 3, 2026. **Planning only:** this revision changes documentation, not application code, accounts, or deployments. This is the current execution order; earlier plans remain supporting requirements and historical evidence.

## Finish line

Have the polished site deployed at its final Netlify HTTPS address, with the existing database preserved, email delivery and maintenance running, staff tools ready, and all independent acceptance checks recorded. Keep website sales disabled. Prepare one exact webhook destination URL for the Stripe owner to change. Do not require his personal login, new products, or replacement prices.

The owner’s URL change and actual Stripe-to-Netlify delivery are a dependency boundary: we cannot honestly mark those tests passed beforehand. The final activation checks are listed separately below.

## What is already done

- Local ticketing, embedded Stripe integration, QR check-in, packet scoring, chapter awards, brother attribution, policies/consent, staff roles, retention tooling, and launch checks exist.
- The latest recorded run passed 85 automated tests, 26 Chromium/WebKit browser cases, typecheck, lint, production webpack build, and the local Netlify adapter build. Production dependency audit found no vulnerabilities. These are previous results, not a new run for this plan. See [verification evidence](LAUNCH_VERIFICATION_2026-11-03.md).
- Neon migrations and initial organizer access are prepared. An isolated restore was tested. Preserve the existing encryption key and records.
- Brevo delivered a labeled test to the designated inbox. Its final tracking behavior, deployed callbacks, and retry scheduling still need verification.
- The supplied restricted Stripe key read the current prices and created/expired an unpaid embedded session. No paid acceptance or live webhook delivery has been demonstrated.
- Netlify configuration and a private environment import file are prepared, but no Netlify site has been linked or deployed. On November 3, built-in-browser access succeeded and the signed-in team's Free plan and credit balance were inspected; details follow.

## November 3 continuation — verified access and next work

This continuation is planning only. Application code, service configuration, credentials, deployments, and sales settings were not changed. No tests were rerun; the recorded results above remain historical evidence.

### Account evidence

- Opening `https://app.netlify.com` in the built-in browser reached the signed-in `chowdhury-rafi01` team's Projects page. The earlier Netlify observation denial is resolved for this session; no new login was needed.
- [Usage & billing](https://app.netlify.com/teams/chowdhury-rafi01/billing/general) shows **Free**, **300 credits/month**, and a current billing period of **October 22–November 21, 2026**. The balance displays **300/300 remaining**, expiring November 21.
- Usage displays 13 web requests, less than one credit each for requests and bandwidth, zero compute credits, and zero production-deploy credits. The displayed total is zero, but this is rounded/delayed reporting, not evidence of exactly zero consumption.
- Projects lists `stepsofvalor` and `venerable-druid-1b82f6`; no KSigdillas-named project is visible. Do not repurpose either existing site. KSigdillas repository authorization, project creation/linking, hostname availability, environment import, and deployment remain unverified/unperformed.
- November 16–19 event week falls inside the displayed billing period. The 30% reserve means a **210-credit ceiling for projected total team usage**, leaving at least 90 credits unused. Subtract other-site use and all planned production publishes before allocating the remainder to KSigdillas traffic, compute, monitoring, and recovery. This is a planning ceiling, not a completed cost estimate.

### Concrete implementation checkpoints — after planning approval

| Order | Work and principal files | Exit evidence |
| --- | --- | --- |
| 1 | Establish an isolated rendered baseline using the existing preview workflow; then apply the design/copy requirements below to `src/app/page.tsx`, `src/app/globals.css`, and the event, checkout, ticket, leaderboard, and staff components. | Desktop and 360/390-pixel views plus loading/error/empty states reviewed; packet values and existing behavior preserved. Localhost browser access must be checked separately. |
| 2 | Extract a shared maintenance service under `src/lib/jobs/`; adapt `src/app/api/jobs/route.ts`, `src/lib/payments/stripe.ts`, and `src/lib/email/delivery.ts`; add a native scheduled entry point and its `netlify.toml` configuration. Keep authenticated manual execution and health access. | Whole-pass deadline below 25 seconds, bounded provider and storage work, fair progress between work types, safe recovery after overlap/crash, separate liveness and business-backlog signals. |
| 3 | Consolidate homepage leaderboard requests and update `LeaderboardPreview.tsx` / `PublicLeaderboard.tsx` polling. Measure idle/busy maintenance, public traffic and preview consumption. | Hidden tabs stop polling, failures back off, public freshness is documented, private responses stay uncached, and a billing-period estimate including other sites stays within 210 credits. |
| 4 | Review the existing dirty tree on `feat/event-operations`, private-file exclusions, repository access and Vercel automatic deployment triggers. Then prepare the tested commit and Netlify release. | No accidental Vercel publish; isolated previews; current backup and encryption recovery; stable final HTTPS hostname; production-only secrets; sales/imports/refund writes remain disabled. |
| 5 | Complete deployed Brevo callbacks/tracking verification, native schedule, independent monitor, historical-sale reconciliation, staff/roster setup and operational rehearsal. | Actual service evidence and runbooks; unresolved provider, organizer and physical-device checks explicitly identified. |
| 6 | Run the full acceptance matrix on the final candidate and prepare the exact existing-destination Stripe URL-edit message. | Deliver “ready for webhook cutover,” with the final address and evidence. Actual signed Stripe delivery and sales activation remain after the owner's change. |

Source review confirms why checkpoint 2 is substantive: `/api/jobs` exports 120 seconds and runs Stripe, optional refunds, then email. Stripe has a local 15-second loop deadline, but it is not a whole-pass deadline. Email claims up to three jobs and sends sequentially with a 15-second provider timeout per request. Claiming all three before starting also risks marking an unstarted send uncertain after a worker dies. Plan just-in-time claims or an explicit claimed-versus-send-started distinction, preserve quota reservations and ambiguous-send protection, and reserve time for durable writes. The current heartbeat only advances when there are no overdue business exceptions; decouple that from proof the worker ran.

Netlify's [function limits](https://docs.netlify.com/build/functions/configuration/), [scheduled-function behavior](https://docs.netlify.com/build/functions/scheduled-functions/), and [credit rates](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/) were rechecked for this continuation. Schedules run automatically only on published deploys; preview isolation must also cover manual invocation. The deployment must still prove actual runtime duration, allocation, cadence, and cost.

## 1. Redesign the additions and rewrite the copy

Direction: a clear chapter event poster and food menu, using the existing deep red, warm cream, dark ink, and restrained yellow. Keep recognizable KSigdillas identity; use typography, alignment, whitespace, and rules between sections instead of decorating every fact with a box. Prioritize the new schedule, scoring, checkout, ticket, and staff screens.

This audit is source-based. Saved browser permissions prevented a fresh rendered review of localhost; visual judgments must be checked in the actual browser when access is restored.

### What makes the current additions feel generic

The source repeats rounded schedule cards, rounded rule tiles, nested white operations cards, and similar button-like treatments across navigation and content. The problem is repetition and weak hierarchy, not that every rounded corner is inherently bad. Generic slogans recur where visitors need dates, prices, and instructions. Checkout also exposes developer/accounting terminology.

Research supports concise, scannable writing with meaningful headings over promotional filler. [Nielsen Norman Group](https://www.nngroup.com/articles/how-users-read-on-the-web/) provides the usability basis. [Smashing Magazine’s design opinion](https://www.smashingmagazine.com/2023/03/ai-technology-transform-design/) discusses homogenization from shared tools and conventions. These are reasons to make the design specific; visual conventions are not reliable evidence that a site was authored by AI.

| Area | Planned change | Acceptance |
| --- | --- | --- |
| Homepage | Put event name, Thursday date/time, address, all-in ticket prices, and one purchase action first. Remove filler statistics and repeated motivational eyebrows. Retain useful brand art; avoid invented photos, testimonials, or impact claims. | A visitor can find when, where, cost, and how to attend without scrolling through promotional copy. |
| Schedule | Group activities under four day headings, with aligned times and thin dividers. Replace the repeated card grid with a readable agenda. | All packet times remain correct; the mobile reading order is obvious. |
| Points and supplies | Keep a proper product/points/cap table, with readable mobile rows. Replace the sea of rounded rule tiles with compact labeled rows and contest sections. Put supplementary rules in accessible disclosures where appropriate. | Caps, refused excess supplies, package size, and point values remain easy to find. No crucial condition is hidden. |
| Checkout | Use one normal embedded-payment path. Remove the customer-facing “Payment display” implementation selector. Keep a fallback link only when needed. Show guests, optional brother attribution, clear total, and consent in a single hierarchy. | No nested card stack, no second fee, no unexplained accounting labels, no loss of edit/cancel/recovery behavior. |
| Ticket and order status | Design a recognizable admission pass with guest, tier, date, location, and clear QR. Use a clean status message with the next action. | QR has a white quiet zone, remains scannable, and does not require navigating tiny text. Loading, paid, failed, refunded, and checked-in states are distinct. |
| Leaderboard | Use a simple four-chapter ranking with aligned points; keep explanations secondary and use honest money labels. | No buyer or private brother data leaks. Dates remain Central time and hydrate consistently. |
| Staff tools | Organize by task: check-in, sales/orders, contributions, brothers, results, settings. Replace wrapped chip-like navigation with clear tabs or a compact navigation list. Use forms and tables with consistent spacing. | Staff can complete common actions on a phone; current role checks and audit history remain intact. |
| Policy pages | Quiet, readable typography and ordinary footer links. Surface relevant refund and food information at the decision point. | Useful disclosure survives the visual cleanup; no unsupported legal or charity promises. |

Copy examples to implement after planning:

| Current | Replacement direction |
| --- | --- |
| “A WEEK WITH PURPOSE.” | “November 16–19” / “This week” |
| “Bring a little. Make it count.” | Remove; explain accepted packages directly. |
| “Easy in, good times out” | “How tickets work” |
| “One ticket gets you in. Your tier decides what lands on your plate.” | Describe each tier’s actual inclusions. |
| “Included processing allocation” | “Processing fee included,” with the all-in total shown once. |
| “One trophy. Maximum bragging rights.” | State the contest and award, without a slogan. |

Use one display type style and a legible body style, consistent button states, small consistent corner radii, and deliberate spacing. Pills are reserved for genuinely compact statuses or selections. Do not replace all boxes with another repeated template. Review desktop and 360/390-pixel mobile screenshots together; check the real page before calling the redesign finished.

## 2. Make background work fit Netlify and the free budget

The current combined `/api/jobs` route permits 120 seconds and performs several provider operations sequentially. Merely changing its duration export will not fix timeout risk. Netlify documents 60 seconds for synchronous functions and 30 seconds for scheduled functions. [Function limits](https://docs.netlify.com/build/functions/configuration/)

Prefer a native Netlify scheduled function calling a shared maintenance service directly. This avoids requiring another scheduler login. Scheduled functions are available on all plans, run automatically only on published deploys, and need deployment-level testing. [Scheduled functions](https://docs.netlify.com/build/functions/scheduled-functions/)

- Extract bounded work passes with a total deadline below 25 seconds, per-request timeouts, small claims, durable progress, and recoverable leases. Reserve time to save results. Prove that one slow provider cannot starve email or payment recovery indefinitely.
- Retain authenticated manual maintenance and health endpoints. Separate scheduler liveness from outstanding business exceptions so a bounced email does not masquerade as a dead scheduler.
- Select the active cadence from measured queue throughput. Start with a one-minute active-event target, not a claim that every email will always arrive in a minute. After the event, reduce idle work while preserving pending delivery, reconciliation, refunds/disputes, and retention duties.
- Remove duplicate homepage leaderboard fetches; pause hidden-tab polling, back off failures, and share updates. Cache only safe public aggregates with a documented freshness target. Never publicly cache order, ticket, staff, or private brother responses.
- Configure an independent stale-heartbeat alert through an available free monitoring service. A worker sending its own failure email cannot detect that the worker never ran. If no usable monitor account is available, record that as an actual external setup dependency rather than silently claiming monitoring is complete.

Netlify’s current credit-based Free plan has 300 monthly credits shared across the team. Exhaustion pauses its sites. Confirm this account’s actual plan, remaining balance, and billing window before relying on that allowance. Production publishes cost 15 credits; traffic and compute also count. [Credit documentation](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)

Measure function allocation, idle/busy runtimes, transferred bytes, polling, scheduler cadence, and recovery traffic. Project the launch month including other team sites and deploys; target at least 30% unused allowance as an internal margin. Reduce usage and remeasure if it does not fit. Do not silently upgrade. Use local previews for routine design work and batch production publishes. A ticket count alone is not a cost estimate.

## 3. Complete the Netlify transition with sales closed

1. Use the verified signed-in account. Recheck the team's remaining credits before deployment, verify KSigdillas repository access, and retain the Free plan; do not request another sign-in unnecessarily.
2. Review the full existing working tree, preserve user changes, exclude private files, and commit the tested implementation. Check existing automatic Vercel deploy triggers before pushing a branch so publishing changes there is not accidental.
3. Create/link the Netlify site, select the final stable hostname, and use the tested Node 22/OpenNext configuration. A purchased custom domain is optional, not a launch prerequisite.
4. Back up production data. Import existing database, encryption, Stripe, and Brevo configuration into production only. Set the real HTTPS `APP_URL`; preserve keys. Disable production credentials and jobs in deploy previews/branch environments.
5. Deploy with new sales, automatic historical imports, refund writes, demo fixtures, and obsolete Eventbrite sync disabled. Check actual runtime database access, TLS, cookies, CSP/Stripe compatibility, private caching, callback routes, and staff authentication.
6. Verify the native schedule on the published deployment with browsers closed. Verify monitoring notifications and usage alerts. Record rollback instructions and recovery access independently of the laptop.
7. Prepare old-URL handling, including any previously issued ticket/order links. Do not redirect Stripe POST callbacks through a generic website redirect. Do not delete the old project or disable a working payment receiver before the cutover is verified.

Pass condition: final deployment serves the intended build, private data stays private, jobs recover automatically, usage fits the verified budget, rollback is documented, and sales remain closed awaiting provider acceptance.

## 4. Finish Brevo and event operations

- Register the final `/api/email/webhook` callback with its separate secret header and only needed delivery events. Verify callback correlation and authentication on the deployed site.
- Verify tracking consent settings and the latest per-message opt-out with one labeled test to the designated inbox. Check headers, attachments, links using the final origin, reply-to, image-blocked rendering, and actual delivery. Do not send test mail to guests or the contact address without a specific reason and authorization.
- Exercise quota, bounce, suppression, timeout-after-acceptance, delayed delivery, and resend behavior with synthetic providers. Confirm the live account allowance; earlier verification found 300 messages/day. Do not promise exactly-once email after an ambiguous provider timeout.
- Record the existing February 3, 2027 key expiry in the handover. No new sender/domain purchase is required solely for this launch if the verified sender continues to work.
- Load the real brother roster and necessary staff roles when available. Confirm seller attribution and personal contributions remain separate; unassigned sellers must not block buying.
- Audit existing Payment Link sales using available read access. Reconcile identifiers, quantities, chapter/referral fields, already fulfilled orders, and missing guest details before enabling imports. If there are no historical sales, record that evidence rather than assuming it.
- Rehearse scanner admission, duplicate scans, manual lookup, corrections, exports, and backup/restore on isolated data. Never wipe real purchases to clear demo data.
- Finish the event-day runbook: named operator, door prices, online cutoff, network/camera fallback, delayed-email help, usage alerts, and incident recovery.

Preserve packet values and decisions already settled: Monday accepted-box counts; Tuesday only pie/slap receipts; per-chapter supply caps and refusal of excess; 10-point hanging attempts and one overall winner; 1,000 attendance bonus; volleyball at 7; Thursday at 6; base credit separated from buyer fees; no event capacity cap. Packet Monday water is 75 points. Steak remains disabled pending an exact package and is not a blocker to launching the rest.

Remaining organizer evidence in [the risk review](LAUNCH_RISK_REVIEW.md) is not supplied by a passing software test: applicable seller/tax treatment, venue/food/activity permission and insurance, asset rights, and an accountable operator. Preserve the chosen no-refund policy with required legal exceptions. Do not invent tax deductibility, a guaranteed remittance percentage, or claim that owning the house establishes every permission. Ask only for an unresolved fact that actually affects launch; do not reopen settled prices or refund preferences.

## 5. Verification before the owner handoff

Run the existing [full acceptance matrix](LAUNCH_TEST_PLAN.md), adding the following targeted cases. Record the commit, environment, expected/actual results, and redacted evidence. Mark blocked checks explicitly; do not equate mocks with real service verification.

| Group | Required evidence |
| --- | --- |
| Design and copy | Rendered review of homepage, agenda, supplies, leaderboard, checkout, order, ticket, policies, and staff tools; no unwanted chip/card repetition, overflow, clipped labels, misleading fee text, or stale packet values. Review empty/loading/error/success states. |
| Accessibility | Keyboard-only flow, visible focus, form errors and labels, contrast, reduced motion, 200% zoom/reflow, accessible disclosure/tab behavior, screen-reader announcements, and existing axe checks. |
| Money and scoring | Mixed carts, exact all-in totals without a second charge, no fee points, refunds/attribution corrections, brother donations versus sales, cap concurrency/reversal, Monday/Tuesday award measures, tie handling, and event-clock cutoffs. |
| Payment integrity | Invalid signatures/replayed or duplicate events, wrong amounts/currency/price, unpaid sessions, out-of-order events, closed-tab recovery, retry after outage, and no ticket from a success URL alone. Use isolated signed fixtures; do not inject fake paid events into live storage. |
| Hosting and security | Clean install/typecheck/lint/tests/build/Netlify adapter; production-only secret scope; no secrets in assets/logs; private cache and indexing behavior; role/IDOR/CSRF/rate-limit tests; invalid callback authentication; dependency review. |
| Worker and limits | Provider calls stall, deadline arrives mid-batch, invocation dies, leases expire, invocations overlap, 200-order queue bursts, and recovery resumes without duplicate tickets/points. Demonstrate fair progress and correct liveness/backlog alerts. |
| Email | Final-origin links, provider callback and actual inbox receipt, no unwanted tracking, blocked images, attachments, resend, bounced/suppressed state, quota reset and retry control. Load tests use a fake mailer. |
| Migration | Backup/restore with current encryption and retention manifest; existing data preserved; preview isolation; historical sale reconciliation; rollback that retains valid admissions and payment recovery. |
| Devices and load | Chromium and WebKit emulation plus actual iPhone/Android camera, QR, checkout layout, cellular/slow connection, refresh/back navigation, and two-device scan contention. Synthetic 100–200-order tests stay out of live Stripe/email and production records. |

Before the owner changes the URL, test every independent service and deployment path. Real Stripe sandbox/3DS acceptance requires usable test credentials; current live keys are not test keys. If those credentials are unavailable, record that limitation and retain the activation gate. Do not create a real charge merely to fill a test checkbox.

## 6. Exact handoff and stopping point

Prepare the final address only after it exists and passes deployed receiver checks:

> Please edit the URL on the existing KSigdillas Stripe webhook destination to `https://FINAL-NETLIFY-HOST/api/stripe/webhook`. Keep the same destination and current products/prices.

Stripe supports editing an existing endpoint URL. [Stripe API documentation](https://docs.stripe.com/api/webhook_endpoints/update) The current key cannot read endpoint configuration; write access is not established. Do not require personal account access or ask for new keys simply to change the hostname.

Keep an event subscription checklist ready, but only request missing subscriptions if evidence shows they are absent: `checkout.session.completed`, `.expired`, `.async_payment_succeeded`, `.async_payment_failed`; `payment_intent.succeeded`; `charge.refunded`; `charge.dispute.created/updated/closed`; `refund.created/updated/failed`. Changing the existing URL normally avoids creating a new signing secret; if the owner instead creates a new destination, its secret must be supplied privately.

The user’s existing Payment Link and prices stay in place. Website cutoff flags do not deactivate an independently shared Payment Link, so document its separate cutoff/end-of-event handling and reconcile any sales during the transition.

Deliver at this stopping point: final site URL; completed design and test evidence; email/scheduler/monitor evidence; recorded credit estimate; backup/rollback and event-day runbooks; exact owner handoff message; and a short list of genuinely blocked external checks. Do not send the owner a message on the user’s behalf.

## Immediately after his change — outside this plan’s stopping point

Observe a real signed delivery at the new receiver, verify mode/secret/events and retry behavior, reconcile cutover sales, complete controlled payment-to-email-to-QR acceptance, then open website sales when launch gates pass. Keep any required paid check buyer-controlled and deliberate. Verify the old public entry points and monitor the first real orders. Until that evidence exists, report “ready for webhook cutover,” not “fully live and verified.”

## Access status

The earlier automatic browser approval rejection for Netlify is resolved: the built-in browser successfully read Projects and Usage & billing on November 3 after the user's permission change. Localhost and Brevo access were not retried during this planning continuation and must be verified separately when needed. Do not infer that access to one site resolves another site's saved permissions, or bypass any remaining denial through another browser or API.
