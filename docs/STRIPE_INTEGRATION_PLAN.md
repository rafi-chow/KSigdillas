# Stripe integration and launch setup

**November 3 update:** the organizer replaced the link with https://buy.stripe.com/6oU3cva1Ccbe4pY3lR2kw01. See `PAYMENT_LINK_VERIFICATION.md` for current public behavior, fee-inclusive catalog mapping and automatic paid-event support. The original-link observations below are historical. Database and Vercel configuration status is in `DEPLOYMENT_SETUP_STATUS.md`; production activation remains outstanding.

Updated October 29, 2026. The user subsequently authorized “implement.” Stripe integration code, brother tracking, Brevo delivery and recovery are now implemented and locally tested; see `STRIPE_BROTHER_VERIFICATION.md` and `STRIPE_EMAIL_SETUP.md`. No live Stripe/email account, production data or deployment was changed. This document remains the Track B design specification. The buyer pays Stripe's fees; actual account capability, permitted fee setup, real services and phone acceptance remain launch gates.

## What the supplied link establishes

Inspected the public checkout at https://buy.stripe.com/bJe7sLehS2AEf4C5tZ2kw00 without entering buyer/payment details or submitting payment.

| Observed on the page | Consequence for integration |
| --- | --- |
| Merchant: Kappa Sigma Theta Omega Fraternity | Use this organizer account; the public name does not establish legal status, payout readiness, or completed onboarding. |
| Basic Pass $10 and Meat and Veggies Pass $15 | Matches the presale catalog. Retrieve and validate the real Product/Price IDs through authorized account access. |
| Both quantities default to 1; initial total $25 | The website must select the requested tier/quantity explicitly. A Basic buyer should not have to discover that they must remove a second product. |
| Required name/email and chapter selector with AXO, DDD, DZ, ZTA, and no chapter | Chapter options match. This page has one buyer name/chapter per order, not per guest. Preserve per-attendee attribution in our website. |
| Optional “Which brother sold you your ticket?” | Use this order-level field for the requested private brother ticket-sales report. Track personally donated money/items separately. See `BROTHER_TRACKING_PLAN.md`; no extra team points or public brother leaderboard. |
| Card, Cash App Pay, Bank, and Klarna visible | Do not inherit all account defaults. Start with cards and supported card wallets; independently verify Link's underlying enabled methods. Other methods need explicit fee/lifecycle support before enabling. |
| $25 total for $25 of tickets; no separate fee shown in the inspected state | The link does not presently demonstrate the requested buyer fee. Do not advertise that fees are already covered. |
| Event date/address and all-sales-final language | Keep these consistent with site terms and exceptional staff refund handling. |

The link alone does not expose API credentials, webhook configuration, production domain, account fee schedule, bank verification, existing transactions, or email delivery settings. It is not proof that our app receives payments or creates tickets. Existing purchases through it must be checked before cutover.

## Recommended website experience

Use **Stripe's supported embedded Checkout** inside our `/checkout` page, backed by server-created Checkout Sessions in the same Stripe account. Reuse the existing products after validating their identifiers. This is the proposed refinement of the previous hosted-only plan, responding to the request to embed payment in the site. Stripe still collects payment details; our server handles the order and ticket data.

1. “Buy Basicdilla” starts with one Basic ticket; “Buy Meat/Veggie” starts with one upgraded ticket. Guests can add/remove tickets or mix tiers.
2. Collect purchaser email, attendee names and team/no-team selections, plus the optional referring brother. Repeat the last team as a convenience while allowing individual changes. Do not ask twice for the same event information in Stripe.
3. Show base subtotal, any approved fee/tax, and final payable total before payment. Server chooses presale or door pricing. Changing the cart invalidates its old payment attempt safely.
4. Mount Stripe's embedded payment component. Preserve the entered cart if authentication, cancellation, or a network error interrupts payment. No buyer account is required.
5. After verified payment, show one QR ticket per guest immediately and email the same tickets. Pending payment shows an honest waiting/retry state, not a valid admission QR.
6. Credit 100/150 points per paid ticket to its selected team; funds exclude service fees/tax. Scanning later adds attendance once without awarding ticket points again.

Provide a supported hosted Checkout fallback if the embedded component cannot run in a browser. Both presentations use the same validated order pipeline. Do not leave two payable attempts for the same order: expire/check the old attempt before replacement and reconcile any payment race. Do not use the existing public link as an untracked fallback.

**Embedding options:** a normal link or Stripe Buy Button can send buyers to this Payment Link. That is the quickest payment-page entry, but still needs webhooks and ticket integration. A Buy Button is not the same as embedding the full checkout form. Do not place the `buy.stripe.com` page in an arbitrary iframe. Use the supported Checkout component for an on-site form. Embedding does not itself reduce the processor's transaction rate.

## Implementation sequence and exit criteria

### 1. Connect the account and catalog in a test environment

- Confirm account ownership, USD, live payment/payout capability, public support details, statement descriptor, and actual fee schedule. Complete identity/bank actions directly in Stripe with the account owner.
- Configure separate sandbox/test and live keys. The embedded browser component uses a publishable key; secret API keys and webhook signing secrets stay server-side in deployment secrets, never chat, Git, or browser bundles.
- Validate the two presale prices and configure $12/$18 door prices. No recurring subscription, coupons, optional donations, adaptive currency conversion, or automatic tax assumption is introduced.
- Pin a supported Stripe SDK/API version and verify its embedded Checkout parameter names against that version. Register the actual checkout domain for supported wallets where Stripe requires it, separately for the intended environments.
- Preserve the existing Payment Link until transaction history is reviewed. Do not activate new website purchases during setup.

Exit: a real Stripe sandbox session displays the correct selected cart, methods, currency, and total. Missing/mismatched configuration refuses payment creation.

### 2. Connect orders to Checkout

- Replace the deliberate `503` in `src/app/api/checkout/route.ts` with validated session creation; connect `OrderForm.tsx` to the endpoint and embedded component.
- Extend `Order.source` with a real Stripe source; add durable Checkout Session, PaymentIntent, price mapping, attempt, and refund references. Keep test fixtures rejected in production. Add optional referral storage without changing scoring.
- Server recalculates all prices and totals; ignore client-submitted prices/points. Persist the immutable cart and opaque internal order reference before contacting Stripe. Never send QR/order-access bearer tokens in Stripe metadata or `client_reference_id`.
- Use stable idempotency keys and a unique provider-session mapping. Retry after an uncertain API response must recover the same attempt, not create a second payment. Guest edits require a new validated quote and safe retirement of the prior attempt.
- Keep quantities fixed within the payment component once attendee details have been bound; use the site's edit-cart action to change them.
- Handle checkout/return access through the existing private order authorization. Knowing a Stripe Session ID alone must not grant access to somebody else's tickets.

**Clock details:** new orders at/after 6 PM Central on November 19 use $12/$18. Existing 30-minute presale quotes retain their quoted price. Stripe's documented `expires_at` minimum is 30 minutes; it cannot express a 5-minute remaining window at 8:55 PM. Stop new orders at 9 PM, explicitly expire outstanding provider sessions at close with a scheduled task, and hide/close the on-site payment view. Reconcile and fulfill any genuinely paid in-flight session; never silently drop a payment because the local quote expired. Test this provider constraint instead of passing an invalid expiry value. A distributed close can have a small race; document and monitor it.

Exit: single-tier, mixed-tier, multi-guest, no-team, retry, cart-edit, and cutoff cases produce exactly the intended cart and price, including recovery from interrupted session creation.

### 3. Confirm payments and issue tickets reliably

- Add `/api/stripe/webhook` with raw-body signature verification. Validate environment, account, order/session association, allowed products/quantities, USD, total, and authoritative paid state.
- Persist a unique provider event in a durable inbox before acknowledging it. Return a retryable error if persistence fails. Run fulfillment through the existing transactional ticket/ledger/outbox functions; reconcile unresolved inbox entries in maintenance jobs.
- Handle completion, expiry, relevant asynchronous payment results, refunds, and disputes. A completed checkout is not automatically a paid checkout. If an unexpected method leaves payment pending, issue no valid ticket until confirmed.
- The authenticated return page may request server-side reconciliation for a fast result, but the webhook and background worker must finish even if the buyer closes the tab.
- Adapt provider refund events carefully: the existing `VerifiedPaymentEvent.amountCents` is the original order total, not the amount of a partial refund. Retrieve and validate the original payment, deduplicate each actual refund, and map refunded base/fee amounts to specific tickets. Unallocated dashboard partial refunds require staff review.
- Track both event IDs and underlying financial objects: different events reporting the same payment/refund must not repeat effects. Reconcile current provider state when events arrive out of order.
- Preserve the existing rules for disputed/refunded ticket validity, points, fundraising, audit history, and award-review flags. Add organizer refund preview and pending/succeeded/failed states for real remote refunds.

Exit: payment creates the correct number of tickets, one set of score entries, and one logical email job despite duplicated/concurrent events, outages, or a closed buyer tab. Unsupported/mismatched events cannot issue tickets.

### 4. Resolve the fee configuration

The user explicitly reconfirmed: **the buyer pays Stripe's processing fees**, with no organizer markup. Do not change base ticket prices or switch to organizer absorption silently. The mechanism must be verified before activation.

- The observed Payment Link currently shows no added service fee. Adding a link/button does not implement fee recovery.
- Standard domestic online card pricing is advertised as 2.9% + $0.30; actual account rates and method choices must be confirmed. Klarna and other methods can have materially different prices. Restrict the launch methods accordingly.
- Keep any permitted fee at order level, with integer-cent rounding, one fixed processor component per order, clear disclosure, and separate accounting. The existing gross-up calculator is an estimate, not authorization to surcharge or a guarantee of exact net receipts.
- Confirm applicable merchant/card-network fee restrictions and tax treatment before turning on a separate buyer charge, including restrictions affecting debit/prepaid cards. Do not rename a card surcharge to evade restrictions. If full fee recovery is not supported under the selected arrangement, bring back that concrete choice to the organizer before launch.
- Reconcile actual Stripe balance-transaction fees and payouts in private reports. International cards, refunds, and disputes can change costs; do not promise a universal exact pass-through.

**Concrete account-owner question:** ask Stripe which supported buyer-fee arrangement can cover this event's costs, for the intended credit/debit/wallet methods, and what registration/disclosure is required. This is not solved just by adding a product called “service fee.” [Visa's US guidance](https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf) limits credit surcharges to the lower of the applicable merchant discount rate or 3%, prohibits debit/prepaid surcharges, and calls for advance acquirer notice. A domestic $10 card payment at 2.9% + $0.30 already costs $0.59 before any gross-up, exceeding 3% of $10. Therefore full recovery cannot be assumed through an ordinary Visa card surcharge. This calculation identifies a constraint, not an approved fee recommendation. The account owner must resolve the permitted arrangement with Stripe before enabling it; do not bypass the restrictions by relabeling the charge or silently change the buyer-pays objective. [Stripe's surcharge overview](https://stripe.com/resources/more/credit-card-surcharges-explained-what-businesses-need-to-know) also distinguishes credit from debit/prepaid treatment.

Exit: displayed total, Stripe charged total, ticket base, fee/tax accounting, and actual processing costs reconcile, with an approved permitted fee treatment.

### 5. Connect ticket email and automatic recovery

**Email delivery means:** the QR email templates and retry queue already exist, but we must connect a real sender and prove that messages arrive. Stripe's payment receipt does not replace our attendee-specific admission tickets.

- **Prefer Brevo Free for this event's expected peak**, subject to sender/account activation and delivery tests. Add a provider adapter behind the existing delivery interface; retain ticket templates/outbox and the existing Resend adapter. Verify Brevo's attachment/inline-image and retry/idempotency semantics rather than copying Resend-specific request fields or assuming identical guarantees.
- Use display name **KSigdillas Tickets**. If an owned domain is available, `tickets@<owned-domain>` or `noreply@<owned-domain>` can be the sender, with `zachzapalac@gmail.com` as reply-to. A sender address is not a paid human mailbox. The repository currently points to `ksigdillas.vercel.app`; this does not establish ownership of a mail domain or control over Vercel's email DNS.
- If no owned domain is available, try a verified existing or new dedicated Gmail sender through Brevo's supported sender flow. Brevo documents rewriting unauthenticated/free-mail sender domains to `@brevosend.com`; inspect the actual delivered From address and confirm replies work. Do not promise a custom-domain sender for free or pretend to authenticate `gmail.com`. If account activation disallows this setup, record that concrete blocker before choosing another option.
- Gmail itself remains a fallback: use the existing address or a dedicated event account through an authenticated, tested delivery adapter, not a hardcoded personal password. A new Gmail account alone is not an automated ticket sender. Prefer the transactional provider for delivery callbacks and queue visibility; do not switch providers automatically after an uncertain send and duplicate messages.
- Keep one ticket email per order with all its QR tickets, not one email per guest. Account for purchases, resends, staff messages and any other shared-account usage when checking daily headroom. Disable marketing sends during the event if they would consume the ticket quota.
- Send authorized test messages to designated Gmail/Outlook inboxes. Verify QR rendering, text fallback, all guests, correct links, reply-to, and spam/bounce behavior. Provider API acceptance alone is not proof of inbox delivery.
- Distinguish queued, provider-accepted, delivered, and bounced status where the provider exposes those events; the current `sent` state means accepted by the delivery adapter. Route actionable failures to the staff desk and an approved operator alert destination.
- Attempt delivery promptly after durable fulfillment through a supported bounded worker invocation. Keep the outbox for recovery; do not rely on a detached promise continuing after a serverless response.

**Scheduler setup means:** a small automatic timer calls the maintenance worker even if nobody visits the website. It sends/retries queued emails, retries provider events, checks payments stuck pending, expires quotes, and reports failures. It does not schedule event activities or change the public leaderboard's ordinary refresh.

- Existing `/api/jobs` accepts authenticated **POST** and currently expires local quotes and processes email. Extend it for Stripe reconciliation and provider-session expiry.
- Target one-minute processing during sales/event operations, with bounded batches, leases, retries, and an alert for a failed/stale worker or a queue overdue by five minutes. No attendee/payment data goes in scheduler URLs or logs.
- Inspect the actual hosting plan first. If Vercel Pro already exists, its minute-level cron is suitable; add a narrowly authenticated adapter for Vercel's cron request convention. The current POST route cannot be wired blindly to a GET scheduler.
- Vercel Hobby's once-daily cron is too slow for tickets. If that is the deployment, choose a compatible low-cost external HTTPS scheduler that can POST with a secret header, after verifying its limits; do not upgrade the hosting account merely by assumption. Record the chosen provider, cadence, timezone, quota, authentication, and failure alert in the runbook.
- Exercise scheduler recovery with all browsers closed: deliberately fail one email attempt, restore the provider, and confirm delivery without duplicate tickets/points. Monitor worker heartbeat as well as HTTP failures so a stopped scheduler is detected.

Exit: real ticket emails arrive; retries run unattended; failed/stalled jobs are visible and actionable. Tickets remain available on the order page during email delays.

### Free email comparison, checked October 29

| Option | Published free allowance | Fit for this event |
| --- | --- | --- |
| Brevo | 300 sends/day; transactional sending included | Recommended free candidate for 100–200 ticket purchases plus reasonable resend headroom. Account activation and actual quota still require verification. |
| Resend | 3,000/month, at most 100/day | Adapter already exists, but 200 separate orders in one day could exceed the free daily allowance. Good only if peak daily volume fits; do not delay event tickets to the next day merely to stay free. |
| Personal/new Gmail | Google documents blocking around more than 500 emails/day for consumer Gmail | Possible authenticated fallback; not a guarantee of delivery/throughput and lacks the same transactional workflow. Separate event account avoids mixing personal quota. |

Sources: [Brevo free limits](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan), [Brevo plan features](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans), [Resend pricing](https://resend.com/pricing), [Gmail sending limits](https://support.google.com/mail/answer/22839/limits-for-sending-and-receiving-emails?hl=en-GB), and [Brevo sender rewriting](https://help.brevo.com/hc/en-us/articles/16045394674066-Troubleshooting-Domain-authentication). These are provider limits, not unlimited email guarantees. Domain registration, if needed, is separate from a free sending service. Keep within the free allowance with visible quota monitoring; no paid upgrade is authorized by this plan.

### 6. Verify on actual phones

**Physical phone checks mean:** a short rehearsal on one iPhone using Safari and one Android using Chrome, on the real HTTPS preview/production domain. The earlier mobile WebKit/Chromium tests ran on a computer; they do not prove camera permission, autofocus, wallet availability, or cellular behavior.

- Complete a test checkout on each phone, including available wallet/authentication behavior and return to tickets. Confirm the wallet appears only when supported/configured.
- Open the ticket from email. Scan it using a staff phone's rear camera, then scan again and confirm “already used.” Test phone-screen and printed QR presentation, permission denial, manual lookup, and slow/reconnecting cellular data.
- Have two staff devices scan the same ticket together; only one admission counts. Check the tier/wristband and attendance result. Check a replaced/refunded QR is rejected.
- Test on cellular as well as Wi-Fi and rehearse the controlled manual admission fallback if connectivity fails.

Exit: record devices/browser versions and pass/fail evidence in `IMPLEMENTATION_VERIFICATION.md`. This can be done with organizer-held phones; no new hardware purchase is implied.

### 7. Preserve existing sales, then launch

- Reconcile Eventbrite and any already-paid orders from the supplied Stripe Payment Link before changing purchase buttons. Existing real sales are not test data.
- For Payment Link orders without an internal order reference, import only verified paid sessions from the allowlisted link and validated prices. Use provider-qualified unique IDs, real quantities, email, chapter, and referral. Preserve one QR per paid unit; do not invent different attendee names from a single buyer name. Flag guest-name completion/correction for the buyer or staff. Unknown products/chapter values need review, never guessed credits.
- Avoid keeping the supplied link as a second unmaintained sales path. After reconciling its purchases and testing the new checkout, coordinate its retirement and replace shared purchase URLs with the website URL. Account for sessions already in flight, and continue processing genuine late payment events.
- Apply production migrations and secrets, register the production webhook and checkout domain, verify email/scheduler operation, and establish real staff accounts. Back up legacy data and remove duplicate Eventbrite aggregation only at coordinated cutover.
- Have the organizer perform one small live end-to-end purchase, then verify the charge, QR email, points, private accounting, scan, and any intentionally tested refund. Do not submit a real purchase merely to test a public link.
- Rollback disables new checkout creation while preserving payment webhooks, reconciliation, ticket access, scanning, and recovery for buyers who already paid.

## Test evidence required before activation

`LAUNCH_TEST_PLAN.md` is the detailed execution/evidence checklist across the entire website, Stripe, buyer fees, brother tracking, email quota/recovery, real devices, and launch. `BROTHER_TRACKING_PLAN.md` defines the attribution-specific expected numbers. The summary below remains useful, but does not replace those new cases.

| Test | Expected outcome |
| --- | --- |
| One Basic / one Meat / mixed cart | Correct selected quantities and server prices; no accidental $25 two-ticket default |
| Two Basic + one Meat, same team | $35 base, 3 unique tickets, 350 points; any approved fee/tax separately reconciled |
| Mixed teams and no team | Each ticket credits only its own team; no-team remains unassigned; referral earns no invented points |
| Card success, decline, authentication, abandonment | Only confirmed payments issue valid tickets; retry preserves cart and avoids another unintended charge |
| Repeated clicks, webhook replay, concurrent processing | One paid order fulfillment and one set of tickets/points |
| Invalid signature, wrong account/environment/currency/amount | Rejected or quarantined; zero ticket issuance |
| Closed buyer tab, missed webhook, transient DB/API failure | Durable recovery fulfills genuine paid orders without duplicates |
| Partial refund, fee-only refund, dispute, out-of-order events | Correct ticket allocation, validity, money and point reversal; no guessed ticket cancellation |
| 6 PM cutoff, near 9 PM expiry and payment race | Correct door prices, valid provider expiry parameters, new sales closed, no lost paid order |
| Email outage, worker restart, scheduler stopped | Queue recovers unattended; stalled worker is detected; ticket page still works |
| Actual phones and two simultaneous scanners | Payment/QR journey works; exactly one first admission |
| Legacy Eventbrite + Payment Link import twice | Counts, money and team points reconcile without duplicate credit or lost existing admission |

Reuse the existing domain/Postgres and browser suites; add adapter/inbox/refund tests and actual Stripe sandbox acceptance. Use Stripe's supported test methods and manual sandbox checkout checks where required; do not load-test or aggressively automate the hosted Stripe UI. Repeat the 200-ticket workload against isolated local fixtures, not 200 real payments/emails. Run typecheck, lint, build, and affected browser regression tests after implementation. Update the verification report with actual evidence; previous local passes are not Stripe integration passes.

## Remaining access, not another event questionnaire

The event details are settled. Implementation needs authorized Stripe test/live configuration, deployment access, a verified email sender, a compatible scheduler, and access to the two phones for rehearsal. Discover existing domain/DNS resources first; use the documented free-sender alternative if no owned mail domain exists. Brother tracking needs the actual roster/approved aliases when available; unresolved historic referrals are retained until then. The fee treatment is the remaining business decision only if the intended full pass-through cannot be implemented as permitted. Do not ask the organizer to paste secret keys into chat.

## What to tell the Stripe account owner

The owner does not need to build the brother report, emailer, or scanner in Stripe. Those are application work. Provide this concrete checklist:

1. Finish identity/bank verification; confirm both live payments and payouts are enabled, with the correct event/support details and actual account fee schedule.
2. Keep Basic $10 and Meat/Veggie $15 presale products. The integration also needs one-time $12/$18 door prices. Keep the existing optional brother field and chapter field so early sales retain their original attribution; do not delete or change field meanings before import. Export/review any sales already made.
3. Confirm the permitted **buyer-paid processing fee** mechanism directly with Stripe for the intended card/wallet types, including registration/disclosure and the full-recovery limitation above. No setup can be declared complete just because a manual fee line was added.
4. Coordinate appropriate developer access or securely provision the required test/live API settings in the deployment. When the application endpoint is ready, register its signed webhook and required checkout domains. Do not send secret keys through chat; product/price identifiers are not secret.
5. Coordinate payment-method restrictions with the integration: launch with verified card/card-wallet methods; leave Klarna/bank/other unsupported methods out. Do not change a shared account globally if it serves other events—apply the relevant session/link configuration. Retire the original link only after its payments are reconciled and the new flow passes testing.

No new Stripe account, Connect platform, Stripe-hosted brother leaderboard, or paid ticketing service is required by this plan. If the original link is still being shared, its initial one-of-each cart should be corrected or clearly reviewed before further promotion; server-created website sessions will use the buyer's actual selected cart.

## Sources checked

- [Observed organizer Payment Link](https://buy.stripe.com/bJe7sLehS2AEf4C5tZ2kw00), October 29, 2026, read-only browser inspection.
- [Stripe Buy Button](https://docs.stripe.com/payment-links/buy-button) and [Payment Link references](https://docs.stripe.com/payment-links/url-parameters): entry options and correlation; URL references are not payment proof.
- [Checkout Session API](https://docs.stripe.com/api/checkout/sessions/create) and [Checkout presentations](https://docs.stripe.com/payments/checkout/how-checkout-works): server-created sessions, embedded/hosted choices, 30-minute minimum expiry. Use the pinned SDK/API version's supported enum values.
- [Stripe webhooks](https://docs.stripe.com/webhooks): authentication, durable handling, duplicates/retries.
- [Payment domain registration](https://docs.stripe.com/payments/payment-methods/pmd-registration).
- [Stripe pricing](https://stripe.com/pricing): method-dependent costs; account-specific rates still require confirmation.
- [Resend verified domains](https://resend.com/docs/dashboard/domains/introduction).
- [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing): Hobby once daily; Pro minute-level scheduling.
- [Stripe automated testing guidance](https://docs.stripe.com/automated-testing).
