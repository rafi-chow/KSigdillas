# Hosting decision — November 3, 2026

**Current execution plan:** [Finish to webhook handoff](FINISH_TO_WEBHOOK_HANDOFF_PLAN.md). Built-in-browser inspection succeeded November 3: team `chowdhury-rafi01` is on Free with 300/300 credits displayed remaining for October 22–November 21; small request/bandwidth usage is rounded. Two existing projects share the allowance. Target no more than 210 total team credits for the period to preserve the planned 30% reserve; KSigdillas runtime/traffic estimates remain outstanding. Prefer a native scheduled worker bounded below its 30-second limit, with independent monitoring. The synchronous 60-second limit discussed below does not apply to native scheduled functions. Preserve pending recovery after the event when reducing the active schedule.

The user has approved **resuming the free-host transition** after the webhook/Vercel discussion. No Netlify site has been created or deployed, and no plan purchased or upgraded. The existing Vercel project and URL are unchanged until cutover. `netlify.toml` is a preparation configuration; deployed acceptance remains outstanding.

## Webhook change

The existing `ksigdillas.vercel.app` hostname belongs to Vercel and cannot be carried to Netlify. Stripe's webhook must point to `https://FINAL-HOST/api/stripe/webhook`. Stripe supports [editing an existing endpoint's URL](https://docs.stripe.com/api/webhook_endpoints/update); the Stripe account, products and prices do not need to be recreated. Verify signed delivery against the deployed receiver after the change. A controlled custom domain could provide a stable endpoint across future host moves; none is assumed here.

The supplied restricted Stripe key cannot read webhook endpoints (verified API denial). Webhook-write permission has not been established. Do not promise an automatic update or request the owner's personal login. The minimal fallback is one URL edit by the account owner after the exact deployed address is available. Verify subscribed events and the signing secret: a supplied `whsec_` value alone does not establish its endpoint URL.

## Vercel finding

Vercel's [fair-use policy](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage) reserves Hobby for noncommercial personal use, lists processing visitor payments and advertising products/services as commercial examples, and exempts asking for donations. This project sells required admission with food tiers. Treating it as an exempt donation site would be an unsupported inference. Keep hosting approval pending unless Vercel confirms this particular use or an eligible plan is selected. No support message has been sent on the user's behalf.

## Netlify fallback

Netlify explicitly [permits commercial projects on Free](https://www.netlify.com/blog/introducing-netlify-free-plan/) and supports [Next.js through OpenNext](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/). Current [credit limits](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/) are 300/month; each production deployment costs 15 and traffic/compute also consume credits. Exhaustion pauses all projects on the team. The older announcement's bandwidth/build-minute figures do not describe a new credit-based account.

Before switching: authenticate a user-controlled Free account; verify its actual plan/usage; test the current adapter; import production-only credentials; retain Neon and the existing encryption key; set final APP_URL; deploy with sales closed; verify Stripe/Brevo callbacks, scheduler and alerts; perform deployed payment/email/ticket/scanner acceptance; then enable sales. Netlify synchronous functions have a [60-second limit](https://docs.netlify.com/build/functions/configuration/); adapt and test the combined Stripe/email worker's worst case before accepting this host. A generic Next build alone does not establish full Netlify compatibility.

## Credit budget and acceptance

300 credits are a monthly team-wide usage budget, not a ticket/visitor limit. Current rates are 15 per production publish, 2 per 10,000 web requests, 20 per GB served and 10 per GB-hour of allocated function runtime. Preview/branch deployment publishing has no deployment charge, but traffic and functions on them still consume credits. Avoid production publishing for routine editing and avoid Netlify Preview Servers/Agent Runners; local development does not consume hosting credits.

Illustration, not a forecast: four production publishes (60), 2 GB served (40) and 100,000 requests (20) use 120 credits **before compute**. A continuously running one-minute job invoked 43,200 times over 30 days, hypothetically averaging one second at 1 GB allocation, adds 120 compute credits plus 8.64 request credits. A separate minute-by-minute health monitor adds its own usage. Do not assume 100–200 ticket sales alone establishes adequate allowance.

Release acceptance must measure the adapted worker's actual allocated memory and idle/busy duration, expected active schedule window, browser response sizes, leaderboard polling and webhook retries. Prefer an event-window schedule with explicit shutdown; stop unnecessary hidden-tab polling, cache only public aggregate data where valid, and keep private order/check-in responses uncached. Record a month/event estimate with unused headroom, enable usage notifications, inspect the account's actual balance before opening sales and before event day, and document who will respond if the host pauses. No automatic plan purchase or upgrade is authorized.
