# Website payments plan

Code reviewed October 27, 2026 against `main` at `5175176`; provider assessment updated October 28, 2026.
Status: earlier research; Stripe is now selected by the `updates` branch.

**Superseded requirements:** the `updates` branch now selects Stripe, two $10/$15 online tiers ($12/$18 at the door), Movember, November 19, and new scoring. See [the current implementation plan](UPDATES_IMPLEMENTATION_PLAN.md). The provider comparisons and three-tier examples below are retained as earlier research, not the current specification.

## Updated recommendation for the actual event

The expected volume is 100–200 tickets at approximately $10, $15, and $20. The user describes an informal group with payouts likely going to an individual's bank account, rather than a registered nonprofit with an organization bank account. Minimizing fees is a priority.

With those constraints, shortlist **direct Stripe Checkout** for low card fees, or **Ticket Tailor with Stripe** for ready-made ticket delivery and check-in. Embedded Eventbrite remains the smallest change to the current application, but is no longer the preferred option on price. Use Zelle or Venmo business payments as optional manually verified alternatives rather than assuming they provide automatic admission and scoring.

### Individual-account eligibility

Stripe supports US unregistered businesses, subject to identity and business verification. For individual accounts the bank account name must match the account owner or permitted DBA; sole-proprietor name rules are also documented. This means incorporating a company is not inherently required, but the actual seller and account type must be represented accurately. Do not classify an existing chapter or separate entity as an individual merely because an officer supplies a personal bank account. Bank permission for the intended activity still needs checking. Sources: [Stripe US requirements](https://support.stripe.com/questions/requirements-for-having-a-us-stripe-account?locale=en-GB), [bank ownership](https://support.stripe.com/questions/verify-your-bank-account-ownership?locale=en-GB).

Eventbrite explicitly offers individual/sole-proprietor onboarding. Ticket Tailor connects an external processor such as Stripe; it does not bypass that processor's verification. Sources: [Eventbrite onboarding](https://www.eventbrite.com/help/en-us/articles/856831/), [Ticket Tailor pricing](https://www.tickettailor.com/pricing).

Venmo business profiles support individual sellers and sole proprietors; an EIN is not mandatory when using personal information and an SSN/ITIN. Its signup guide also lists civic, social, and fraternal organizations among supported association categories. Sources: [Venmo signup](https://help.venmo.com/cs/articles/how-to-sign-up-for-a-business-profile-vhel163), [business profiles](https://venmo.com/business/profiles).

### Fee comparison

Planning estimates for one ticket per transaction, US domestic card payments where applicable, fees absorbed, and no tax, international-card charges, instant-transfer charges, or optional extras. Percentages and fixed fees are different components; multi-ticket orders may save per-transaction costs. Figures are rounded per transaction. Ticket Tailor assumes its USD $0.85 pay-as-you-go rate, before introductory credits, prepaid discounts, or applicable fee taxes.

| Option | $10 ticket | $15 ticket | $20 ticket | 100 / 200 separate $15 sales |
| --- | ---: | ---: | ---: | ---: |
| Zelle, if the bank permits this use without fees | $0 | $0 | $0 | $0 / $0 |
| Venmo business direct/QR, 1.9% + $0.10 | $0.29 | $0.39 | $0.48 | $39 / $78 |
| Stripe, 2.9% + $0.30 | $0.59 | $0.74 | $0.88 | $74 / $148 |
| Square Payment Links, 3.3% + $0.30 | $0.63 | $0.80 | $0.96 | $80 / $160 |
| Ticket Tailor pay-as-you-go + Stripe | $1.44 | $1.59 | $1.73 | $159 / $318 |
| Eventbrite, estimated absorbed fees | $2.45 | $2.78 | $3.11 | $278 / $556 |

Eventbrite publishes 3.7% + $1.79 per ticket and 2.9% of the order total. The estimates above treat the advertised price as the final, tax-free buyer total when absorbing fees. Confirm the actual event's “How fees work” breakdown before selecting a provider; adding fees on top changes the processing base. Passing fees to buyers shifts the expense rather than eliminating it.

Pricing evidence: [Stripe](https://stripe.com/pricing), [Eventbrite](https://www.eventbrite.com/help/en-us/articles/755615/how-much-does-it-cost-for-organizers-to-use-eventbrite/), [Venmo direct/QR rates](https://venmo.com/business/profiles), [Square links](https://squareup.com/us/en/payment-links), [Ticket Tailor pricing](https://www.tickettailor.com/pricing), [Ticket Tailor USD pay-as-you-go rate reference](https://help.tickettailor.com/en/articles/4096561-what-are-the-fees-for-using-seating-charts). The latter confirms the base rate by explaining that a reserved seat incurs a second usage at the same rate; no reserved seating is assumed here.

### Practical choice

- **Direct Stripe:** best processor-fee fit for the custom website. Implement the order/payment/ticket/check-in stages below. Payment Links could start payment collection with less code, but links alone do not provide our complete admission and leaderboard workflow. At 200 separate $15 sales, estimated processing is $148, leaving $2,852 before event expenses and other charges.
- **Ticket Tailor + Stripe:** strongest ready-made alternative. Its additional $0.85 per ticket buys a ticketing platform with a check-in app; at 200 tickets that is approximately $170 more than direct Stripe, before discounts. Investigate prepaid pricing after confirming expected attendance. Integrate team answers and verified tickets into the site's leaderboard; existing Eventbrite sync cannot simply remain the sole source.
- **Venmo business direct/QR:** low fees and fits individual sellers. The quoted rate applies to direct/QR payments, not arbitrary website card checkout. Plan manual receipt verification, order matching, ticket issuance, and refund tracking. Use a business profile or other permitted purchase flow, not personal-transfer labeling to avoid fees.
- **Zelle:** potentially free, but bank/account eligibility and fees must be verified. Plan a pending reservation with a reference, verify received funds inside the bank account, then approve admission and scoring. Do not auto-approve based on a buyer screenshot. Zelle offers no purchase protection, and its standard bank-app workflow is not a ready-made ticketing integration. Sources: [Zelle business FAQ](https://www.zelle.com/faq/im-small-business-using-zelle), [Chase business Zelle FAQ](https://www.chase.com/business/support/banking/online-banking/zelle).
- **Eventbrite:** retains the existing code and event-day workflow; highest fee estimate among the main options. At 200 separate $15 sales, approximately $408 more in fees than direct Stripe. This is a processing comparison, not a claim that custom development and maintenance are free.
- **Square Payment Links:** straightforward payment collection, but not cheaper than Stripe at standard published rates and still needs a ticket workflow around it.

### Free services and other alternatives checked

- **Zeffy:** not a fit for personal payouts. US eligibility requires an EIN and an organization-named bank account; personal accounts are excluded. Reconsider only if an eligible organization actually owns the event/payment account. [Eligibility](https://support.zeffy.com/is-my-organization-eligible-to-use-zeffy-8m24r).
- **Givebutter:** current eligibility documentation excludes standalone individual fundraising accounts. An affiliated fundraiser with a verified organization is a different arrangement, not a substitute for the requested personal-account setup. [Eligibility](https://help.givebutter.com/en/articles/1726576-who-can-use-givebutter-and-what-can-i-raise-money-for).
- **Humanitix:** ready-made ticketing; its help center publishes a standard USD booking fee of 5% + $1.29 per paid ticket, plus applicable taxes. This is about $2.04 at $15 and does not beat Ticket Tailor + Stripe or direct Stripe under these assumptions. Its marketing pricing page separates platform and processing components; verify order-level treatment for multi-ticket orders. [Booking fees](https://help.humanitix.com/en/articles/12292391-what-are-the-humanitix-booking-fees).
- **Kindbee:** advertises fee-free donation fundraising for individuals, but native admission ticketing and this paid-event use have not been verified. Do not treat required ticket payments as voluntary donations to fit a fundraising product. [How it works](https://kindbee.com/how-it-works).

### Payout timing and next decisions

Stripe's first payout commonly takes 7–14 days, sometimes longer; Ticket Tailor using a new Stripe account inherits the processor's payout timing. Eventbrite's standard payout is sent three business days after the event, with additional bank processing time; earlier schedules have eligibility conditions. Confirm timing before relying on ticket revenue to purchase event supplies. Sources: [Stripe first payout](https://support.stripe.com/questions/waiting-on-your-first-stripe-payout-what-you-need-to-know), [Eventbrite payouts](https://www.eventbrite.com/help/en-us/articles/111819/understanding-your-event-payout-amount/).

Before implementation, identify the actual seller/account holder, the payout bank, the event date, whether ticket revenue must fund advance expenses, and whether the priority is lowest fees or ready-made ticket operations. The account holder should own verification, refunds, and transaction records. No provider account has been created, and no payment integration has been implemented.

## Current setup

- Next.js App Router, React, TypeScript, Vercel, and Neon Postgres.
- All ticket calls to action open the same Eventbrite listing in a new tab.
- Three advertised tiers: Basicdilla, Chicken + Veggie, and Beef Tier. The local tier configuration does not contain prices.
- `src/lib/eventbrite/sync.ts` attributes valid attendees to teams and excludes cancelled/refunded attendees. `src/lib/scoringConfig.ts` assigns 1, 2, and 3 points to the three tiers.
- `src/lib/leaderboard/live.ts` overlays Eventbrite ticket totals on database scores. Adding Stripe points to the existing database field alone would not work: this overlay would hide them.
- Repository documentation describes Eventbrite email tickets and Organizer QR check-in. Account settings, current paid sales, payouts, and refund behavior have not been independently verified.

## Options

| Option | Buyer experience | Project impact | Best fit |
| --- | --- | --- | --- |
| Existing Eventbrite link | Leaves the site to pay on Eventbrite | Finish event/account configuration and validate the existing flow | Fastest route to paid ticket sales |
| Embedded Eventbrite checkout | Opens ticket checkout within the website | Add a reusable checkout UI; retain Eventbrite ticketing, check-in, and attribution | Smallest change; higher transaction fees |
| Stripe Checkout | Pays through Stripe using a hosted or embedded checkout | Add order storage, payment verification, ticket fulfillment, check-in, and leaderboard integration | Greater control over the complete purchasing experience |

Eventbrite documents both modal and inline embedded checkout, with modal checkout recommended for mobile. Its widget integrates with its existing ticketing and Organizer workflow. See [widget documentation](https://www.eventbrite.com/platform/docs/embedded-checkout) and [ticket widget overview](https://www.eventbrite.com/features/ticket-widget/).

Stripe offers hosted and embedded checkout interfaces. That solves payment collection; this application would still need its own ticket fulfillment and entry workflow. See [Stripe Checkout](https://docs.stripe.com/payments/checkout).

Compare actual fees using the final ticket prices, account country, and fee settings before choosing a provider. No fee savings are assumed here. Separate donations can be scoped after deciding whether they award team points and whether they grant admission.

## Implementation option: embedded Eventbrite

### 1. Validate the event configuration

Confirm the active event ID and paid ticket tiers, prices, capacity, sale window, payout setup, and buyer-facing refund policy. `TODO_PRODUCTION.md` already tracks these decisions. The homepage currently promises refunds through event day despite the checklist marking that policy as unresolved; reconcile those before enabling wider sales.

Require the support question for each attendee, using AXO, DZ, ZTA, and DDD choices. Verify where the question appears in the actual checkout and how incomplete answers affect attribution; payment completion alone does not establish a team. Eventbrite supports per-attendee questions, and its September 2026 update describes required questions before or after payment. See [custom questions](https://www.eventbrite.com/help/en-us/articles/228823/how-to-create-custom-questions-for-attendees/) and [product updates](https://www.eventbrite.com/product-updates/).

Acceptance: each enabled tier, team answer, and refund rule is recorded and matches the website.

### 2. Build the reusable checkout entry point

- Add `src/components/TicketCheckoutButton.tsx` and a shared client-side script loader/provider as needed.
- Load Eventbrite's documented widget once using Next.js Script. Guard initialization against React Strict Mode, rerenders, and navigation; use unique trigger IDs.
- Use the documented modal checkout with site colors. Preserve an obvious Eventbrite link when scripts are blocked, loading fails, or checkout redirects externally.
- Centralize public event ID and an embedded-checkout feature flag in `src/lib/eventConfig.ts` and `.env.example`. Keep the private API token server-only; validate that the public checkout event matches the server sync event.
- Update ticket buttons in `src/components/HeroSection.tsx`, `src/components/TicketTierCard.tsx`, and `src/app/page.tsx`, including the bottom and mobile calls to action.
- Update `src/components/WristbandFlow.tsx` to describe paying on the site through Eventbrite.
- Do not imply a tier is preselected unless verified support exists. Otherwise use wording such as “View tickets” and let the widget handle tier selection.
- Use the order-complete callback for UI feedback only; do not grant points or create proof of payment from a browser callback.

Acceptance: all ticket entry points work on mobile and desktop, including a usable fallback; opening checkout repeatedly never creates duplicate widgets.

### 3. Preserve scoring and event operations

Keep Eventbrite as the ticket source of truth and retain the existing server-side attendee sync. Verify that every paid tier maps to the intended points, multi-ticket orders attribute each attendee correctly, and refunds remove the relevant points. Missing answers should appear in the existing unmatched-answer report without invented attribution.

The board has a 30-second external snapshot cache and a separate public polling cycle; do not promise an immediate update after payment. Show a modest “Your support will appear after the next updates” message and a leaderboard link.

Acceptance: one valid ticket per tier contributes 1/2/3 points to the selected team; repeated sync does not duplicate points, and refunds reverse the correct ticket contribution.

### 4. Test and release

- Use a separate test event and database. Eventbrite warns that completing checkout in its preview creates a real registration; do not assume a payment sandbox.
- Verify HTTPS deployment, iPhone Safari, Android Chrome, desktop, keyboard/focus behavior, checkout dismissal, script failure, and slow networks. Check referrer policy if Safari fails.
- Exercise all tiers, each team, multiple attendees, missing answers, sold-out tickets, failed/cancelled checkout, email/QR delivery, duplicate check-in, and cancellation/refund removal.
- Add focused tests for any changed mapping or callback logic, plus browser coverage for fallback and repeated widget initialization.
- Run `npm run lint` and `npm run build`; validate on a Vercel HTTPS preview before production rollout.
- Roll out behind the feature flag. Revert to existing Eventbrite links if the widget fails. Confirm reconciliation and support ownership with the event owner.

Eventbrite's [embedded checkout help](https://www.eventbrite.com/help/en-sg/articles/347218/how-to-sell-eventbrite-tickets-on-your-website-through-an-embedded-checkout/) covers HTTPS, actual registrations in previews, Safari issues, and multiple-widget considerations.

## Alternative implementation: direct Stripe ticket sales

Choose this path if owning checkout and ticket operations is a priority. Implement as separate stages:

1. **Catalog and orders:** add versioned Postgres migrations for orders, order items, attendee tickets, provider events, and inventory reservations. Store currency and integer minor-unit amounts. Validate tier IDs, quantity limits, team IDs, prices, and available stock on the server. Require Postgres for payments; no JSON fallback.
2. **Payment session:** add a server-only Stripe client and `POST /api/checkout`. Use configured Price IDs, an application order ID, idempotency, fixed allowed return URLs, and rate limits. Start with one-time hosted Checkout for the simplest implementation; embedded Checkout is another UI option.
3. **Verified payment processing:** add a signature-verified webhook endpoint using the raw request body. Validate payment status, amount, currency, and order association. Process duplicate and out-of-order events safely in transactions. Handle payment failure, session expiration, refunds, and disputes. A success-page visit cannot mark an order paid. Reconcile stuck orders against the provider.
4. **Ticket delivery and entry:** generate one opaque ticket token per paid attendee; send confirmation/QR emails through a transactional outbox with retries. Build staff-authenticated check-in with atomic duplicate-scan prevention, refund invalidation, and attendee export. A Stripe receipt is not an admission ticket in the existing Eventbrite workflow.
5. **Leaderboard:** derive paid, non-refunded ticket points from an auditable payment ledger. Refactor `src/lib/leaderboard/live.ts` to select or explicitly combine providers. If retaining existing Eventbrite tickets, define a cutover and unique provider identifiers to prevent lost or double-counted points. Keep manual scoring independent and protect payment records from demo resets.
6. **Operations and rollout:** establish refund/support permissions, retention, receipt resends, capacity reservation expiry, reconciliation, and refund/partial-refund scoring rules. Test concurrent inventory claims, duplicate webhooks, failed emails, closed-browser success, refunds, and duplicate scans in Stripe test mode before enabling live keys.

Likely additions include `src/lib/payments/`, `src/lib/tickets/`, `src/app/api/checkout/route.ts`, `src/app/api/webhooks/stripe/route.ts`, payment status pages, protected check-in routes/UI, and database migrations. Add server-only Stripe API and webhook secrets through deployment environment settings.

## Work breakdown

- **Change 1:** reusable embedded checkout, fallback, updated button copy, and environment documentation.
- **Change 2:** targeted regression coverage and any attribution corrections revealed by tests.
- **Release:** complete account/content decisions, validate end-to-end purchases/refunds/check-in, and enable the feature flag.

For Stripe, replace these with the six stages above; payment collection alone is not a complete ticket-sales release. This plan does not assume a provider decision, and no payment code or account settings have been changed.
